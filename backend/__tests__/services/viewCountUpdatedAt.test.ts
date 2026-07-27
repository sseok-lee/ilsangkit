/**
 * 조회수 플러시가 @updatedAt 을 오염시키지 않는지 고정하는 회귀 테스트.
 *
 * 배경: prisma 의 model.update() 는 @updatedAt 을 SET 절에 함께 실어 보낸다
 * (프로덕션 DDL 31개 테이블 전부 ON UPDATE 절이 없다 = 갱신 주체는 오직 Prisma Client).
 * 그 결과 "조회수 반영"이 "문서 수정"으로 둔갑해 상세 페이지의 dateModified·
 * article:modified_time 과 시설 사이트맵 lastmod 를 오염시켰다.
 * raw UPDATE 는 viewCount 만 건드리므로 updatedAt 이 보존된다.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockExecuteRaw,
  mockExecuteRawUnsafe,
  mockArticleUpdate,
  mockGuideUpdate,
  mockToiletUpdate,
} = vi.hoisted(() => ({
  mockExecuteRaw: vi.fn(),
  mockExecuteRawUnsafe: vi.fn(),
  mockArticleUpdate: vi.fn(),
  mockGuideUpdate: vi.fn(),
  mockToiletUpdate: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $executeRaw: mockExecuteRaw,
    $executeRawUnsafe: mockExecuteRawUnsafe,
    article: { update: mockArticleUpdate },
    guide: { update: mockGuideUpdate },
    toilet: { update: mockToiletUpdate },
  };
  return { prisma, default: prisma };
});

import { flushArticleViewCounts, articleViewBuffer } from '../../src/services/articleService.js';
import { flushGuideViewCounts, guideViewBuffer } from '../../src/services/guideService.js';
import { flushViewCounts, viewCountBuffer, bufferViewCount } from '../../src/services/viewCountService.js';

/** 태그드 템플릿 호출에서 SQL 문자열을 복원한다. */
function sqlOf(call: unknown[]): string {
  const strings = call[0] as TemplateStringsArray;
  return strings.join('?');
}

beforeEach(() => {
  vi.clearAllMocks();
  articleViewBuffer.clear();
  guideViewBuffer.clear();
  viewCountBuffer.clear();
  mockExecuteRaw.mockResolvedValue(1);
  mockExecuteRawUnsafe.mockResolvedValue(1);
});

describe('flushArticleViewCounts — updatedAt 보존', () => {
  it('prisma.article.update 를 쓰지 않고 raw UPDATE 로 viewCount 만 증가시킨다', async () => {
    articleViewBuffer.set('article-1', 3);

    await flushArticleViewCounts();

    expect(mockArticleUpdate).not.toHaveBeenCalled();
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

    const sql = sqlOf(mockExecuteRaw.mock.calls[0]);
    expect(sql).toContain('UPDATE');
    expect(sql).toContain('Article');
    expect(sql).toContain('viewCount');
    // 핵심: SET 절에 updatedAt 이 없어야 한다.
    expect(sql).not.toContain('updatedAt');
    // 값은 파라미터로 바인딩된다 (문자열 보간 금지).
    expect(mockExecuteRaw.mock.calls[0].slice(1)).toEqual([3, 'article-1']);
  });

  it('여러 항목을 각각 증가시키고 버퍼를 비운다', async () => {
    articleViewBuffer.set('article-1', 3);
    articleViewBuffer.set('article-2', 1);

    await flushArticleViewCounts();

    expect(mockExecuteRaw).toHaveBeenCalledTimes(2);
    const params = mockExecuteRaw.mock.calls.map(c => c.slice(1));
    expect(params).toContainEqual([3, 'article-1']);
    expect(params).toContainEqual([1, 'article-2']);
    expect(articleViewBuffer.size).toBe(0);
  });

  it('버퍼가 비어있으면 쿼리를 실행하지 않는다', async () => {
    await flushArticleViewCounts();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('삭제된 article 로 실패해도 전체가 죽지 않는다', async () => {
    articleViewBuffer.set('gone', 1);
    articleViewBuffer.set('alive', 2);
    mockExecuteRaw.mockRejectedValueOnce(new Error('row gone'));

    await expect(flushArticleViewCounts()).resolves.toBeUndefined();
  });
});

describe('flushGuideViewCounts — updatedAt 보존', () => {
  it('prisma.guide.update 를 쓰지 않고 raw UPDATE 로 viewCount 만 증가시킨다', async () => {
    guideViewBuffer.set('guide-1', 5);

    await flushGuideViewCounts();

    expect(mockGuideUpdate).not.toHaveBeenCalled();
    expect(mockExecuteRaw).toHaveBeenCalledTimes(1);

    const sql = sqlOf(mockExecuteRaw.mock.calls[0]);
    expect(sql).toContain('Guide');
    expect(sql).toContain('viewCount');
    expect(sql).not.toContain('updatedAt');
    expect(mockExecuteRaw.mock.calls[0].slice(1)).toEqual([5, 'guide-1']);
  });

  it('버퍼가 비어있으면 쿼리를 실행하지 않는다', async () => {
    await flushGuideViewCounts();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });
});

describe('flushViewCounts (시설) — updatedAt 보존', () => {
  it('model().update 를 쓰지 않고 카테고리별 테이블에 raw UPDATE 를 실행한다', async () => {
    bufferViewCount('toilet', 't1');
    bufferViewCount('toilet', 't1');

    await flushViewCounts();

    expect(mockToiletUpdate).not.toHaveBeenCalled();
    expect(mockExecuteRawUnsafe).toHaveBeenCalledTimes(1);

    const [sql, ...params] = mockExecuteRawUnsafe.mock.calls[0];
    expect(sql).toContain('`Toilet`');
    expect(sql).toContain('viewCount');
    expect(sql).not.toContain('updatedAt');
    // 값은 ? 플레이스홀더로만 들어간다.
    expect(sql).toContain('?');
    expect(params).toEqual([2, 't1']);
  });

  it('카테고리마다 올바른 테이블명을 쓴다 (모델명 = 테이블명, @@map 없음)', async () => {
    bufferViewCount('ev-charger', 'e1');
    bufferViewCount('pharmacy', 'p1');
    bufferViewCount('subway', 's1');

    await flushViewCounts();

    const sqls = mockExecuteRawUnsafe.mock.calls.map(c => c[0] as string);
    expect(sqls.some(s => s.includes('`EvCharger`'))).toBe(true);
    expect(sqls.some(s => s.includes('`Pharmacy`'))).toBe(true);
    expect(sqls.some(s => s.includes('`SubwayStation`'))).toBe(true);
  });

  it('버퍼가 비어있으면 쿼리를 실행하지 않는다', async () => {
    await flushViewCounts();
    expect(mockExecuteRawUnsafe).not.toHaveBeenCalled();
  });

  it('한 건이 실패해도 나머지가 계속 처리된다', async () => {
    bufferViewCount('toilet', 't1');
    bufferViewCount('aed', 'a1');
    mockExecuteRawUnsafe.mockRejectedValueOnce(new Error('deadlock'));

    await expect(flushViewCounts()).resolves.toBeUndefined();
    expect(viewCountBuffer.size).toBe(0);
  });
});
