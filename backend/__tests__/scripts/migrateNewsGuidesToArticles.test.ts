// migrateNewsGuidesToArticles — news 가이드 → published Article 멱등 마이그레이션 테스트
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockGuideFindMany,
  mockGuideDelete,
  mockArticleCreate,
  mockArticleFindUnique,
  mockTransaction,
  mockExecuteRaw,
} = vi.hoisted(() => ({
  mockGuideFindMany: vi.fn(),
  mockGuideDelete: vi.fn(),
  mockArticleCreate: vi.fn(),
  mockArticleFindUnique: vi.fn(),
  mockTransaction: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    guide: { findMany: mockGuideFindMany, delete: mockGuideDelete },
    article: { create: mockArticleCreate, findUnique: mockArticleFindUnique },
    $transaction: mockTransaction,
    $executeRaw: mockExecuteRaw,
    $disconnect: vi.fn(),
  },
}));

vi.mock('fs/promises', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return {
    ...actual,
    copyFile: vi.fn(),
    stat: vi.fn(),
    mkdir: vi.fn(),
  };
});

import { copyFile, stat } from 'fs/promises';
import {
  mapGuideToArticleData,
  migrateNewsGuides,
  parseMigrateOptions,
} from '../../src/scripts/migrateNewsGuidesToArticles.js';

function makeGuide(overrides: Partial<{
  id: string; slug: string; title: string; content: string; summary: string;
  category: string; keywords: string | null; viewCount: number; createdAt: Date;
}> = {}) {
  return {
    id: 'g1',
    slug: 'toilet-news-1',
    title: '뉴스 제목',
    content: '뉴스 본문',
    summary: '뉴스 요약',
    category: 'toilet',
    keywords: '키워드1, 키워드2',
    viewCount: 42,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('parseMigrateOptions', () => {
  it('--dry-run 있으면 dryRun:true', () => {
    expect(parseMigrateOptions(['--dry-run'])).toEqual({ dryRun: true });
  });
  it('--dry-run 없으면 dryRun:false', () => {
    expect(parseMigrateOptions([])).toEqual({ dryRun: false });
  });
});

describe('mapGuideToArticleData', () => {
  it('news 가이드를 published Article 데이터로 매핑', () => {
    const guide = makeGuide();
    const data = mapGuideToArticleData(guide);

    expect(data.slug).toBe(guide.slug);
    expect(data.title).toBe(guide.title);
    expect(data.content).toBe(guide.content);
    expect(data.summary).toBe(guide.summary);
    expect(data.category).toBe(guide.category);
    expect(data.keywords).toBe(guide.keywords);
    expect(data.articleType).toBe('news-brief');
    expect(data.viewCount).toBe(42); // 보존
    expect(data.status).toBe('published');
    expect(data.publishedAt).toBe(guide.createdAt);
    expect(data.createdAt).toBe(guide.createdAt);
    expect(data.sources).toBeUndefined(); // → Prisma가 null로 저장
    expect(data.thumbnailUrl).toBe(`/api/images/articles/${guide.slug}.webp`);
  });
});

describe('migrateNewsGuides', () => {
  beforeEach(() => {
    mockGuideFindMany.mockReset();
    mockGuideDelete.mockReset();
    mockArticleCreate.mockReset();
    mockArticleFindUnique.mockReset().mockResolvedValue(null);
    mockTransaction.mockReset().mockResolvedValue([{}, {}]);
    mockExecuteRaw.mockReset().mockResolvedValue(1);
    vi.mocked(copyFile).mockReset().mockResolvedValue(undefined);
    vi.mocked(stat).mockReset().mockResolvedValue({} as any);
  });

  it('dry-run: 대상 조회만 하고 create/delete/copyFile 미호출, 예상 건수 반환', async () => {
    mockGuideFindMany.mockResolvedValue([makeGuide({ slug: 'a' }), makeGuide({ slug: 'b' })]);

    const result = await migrateNewsGuides({ dryRun: true });

    expect(mockGuideFindMany).toHaveBeenCalledWith({ where: { articleType: 'news' } });
    expect(mockArticleCreate).not.toHaveBeenCalled();
    expect(mockGuideDelete).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
    expect(result).toEqual({ migrated: 2, skipped: 0, thumbnailsCopied: 0, failures: [] });
  });

  it('실제 실행: guide당 $transaction([article.create, guide.delete]) + $executeRaw(updatedAt) + 썸네일 copyFile', async () => {
    const guide = makeGuide();
    mockGuideFindMany.mockResolvedValue([guide]);

    const result = await migrateNewsGuides({ dryRun: false });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(mockArticleCreate).toHaveBeenCalledOnce();
    expect(mockArticleCreate.mock.calls[0][0].data.slug).toBe(guide.slug);
    expect(mockGuideDelete).toHaveBeenCalledWith({ where: { id: guide.id } });
    expect(mockExecuteRaw).toHaveBeenCalledOnce();
    expect(copyFile).toHaveBeenCalledOnce();
    expect(result.migrated).toBe(1);
    expect(result.thumbnailsCopied).toBe(1);
    expect(result.failures).toEqual([]);
  });

  it('멱등성: 이미 같은 slug의 Article 존재 시 스킵(create/delete 안 함), skipped 카운트 증가', async () => {
    const guide = makeGuide();
    mockGuideFindMany.mockResolvedValue([guide]);
    mockArticleFindUnique.mockResolvedValue({ id: 'existing-article-id' });

    const result = await migrateNewsGuides({ dryRun: false });

    expect(mockArticleCreate).not.toHaveBeenCalled();
    expect(mockGuideDelete).not.toHaveBeenCalled();
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(copyFile).not.toHaveBeenCalled();
    expect(result).toEqual({ migrated: 0, skipped: 1, thumbnailsCopied: 0, failures: [] });
  });

  it('썸네일 원본 없음(stat throw) → 경고, thumbnailsCopied 미증가, 마이그레이션은 계속됨', async () => {
    const guide = makeGuide();
    mockGuideFindMany.mockResolvedValue([guide]);
    vi.mocked(stat).mockRejectedValue(new Error('ENOENT'));
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await migrateNewsGuides({ dryRun: false });

    expect(mockTransaction).toHaveBeenCalledOnce();
    expect(copyFile).not.toHaveBeenCalled();
    expect(result.migrated).toBe(1);
    expect(result.thumbnailsCopied).toBe(0);
    expect(result.failures).toEqual([]);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('per-guide 실패는 failures 배열에 담기고 루프는 계속 진행됨', async () => {
    const guide1 = makeGuide({ id: 'g1', slug: 'fail-1' });
    const guide2 = makeGuide({ id: 'g2', slug: 'ok-2' });
    mockGuideFindMany.mockResolvedValue([guide1, guide2]);
    mockTransaction
      .mockRejectedValueOnce(new Error('DB 오류'))
      .mockResolvedValueOnce([{}, {}]);

    const result = await migrateNewsGuides({ dryRun: false });

    expect(result.migrated).toBe(1);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('fail-1');
    expect(result.failures[0]).toContain('DB 오류');
    // 실패한 guide는 썸네일 복사도 스킵되어야 함(트랜잭션 실패 후 진행 안 함)
    expect(copyFile).toHaveBeenCalledOnce();
  });
});
