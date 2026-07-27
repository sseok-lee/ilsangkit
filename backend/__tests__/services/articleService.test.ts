import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockArticleCount, mockArticleFindMany, mockArticleFindUnique, mockArticleUpdate, mockExecuteRaw } = vi.hoisted(() => ({
  mockArticleCount: vi.fn(),
  mockArticleFindMany: vi.fn(),
  mockArticleFindUnique: vi.fn(),
  mockArticleUpdate: vi.fn(),
  mockExecuteRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $executeRaw: mockExecuteRaw,
    article: {
      count: mockArticleCount,
      findMany: mockArticleFindMany,
      findUnique: mockArticleFindUnique,
      update: mockArticleUpdate,
    },
  },
}));

import {
  listArticles,
  listRecentArticles,
  getArticleBySlug,
  flushArticleViewCounts,
  articleViewBuffer,
} from '../../src/services/articleService.js';

beforeEach(() => {
  vi.clearAllMocks();
  articleViewBuffer.clear();
  mockExecuteRaw.mockResolvedValue(1);
});

describe('listArticles', () => {
  it('published만 필터 + publishedAt desc + 페이지네이션 결과 반환', async () => {
    mockArticleCount.mockResolvedValue(2);
    mockArticleFindMany.mockResolvedValue([
      { id: 'a1', title: '기사1', slug: 'article-1' },
      { id: 'a2', title: '기사2', slug: 'article-2' },
    ]);

    const result = await listArticles({ page: 1, limit: 10 });

    expect(result).toEqual({
      items: [
        { id: 'a1', title: '기사1', slug: 'article-1' },
        { id: 'a2', title: '기사2', slug: 'article-2' },
      ],
      total: 2,
      page: 1,
      totalPages: 1,
    });

    expect(mockArticleCount).toHaveBeenCalledWith({ where: { status: 'published' } });
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        skip: 0,
        take: 10,
      })
    );
  });

  it('category 필터가 where에 반영된다', async () => {
    mockArticleCount.mockResolvedValue(0);
    mockArticleFindMany.mockResolvedValue([]);

    await listArticles({ page: 1, limit: 10, category: 'toilet' });

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', category: 'toilet' },
      })
    );
  });

  it('categories 배열 필터가 where.category.in으로 반영된다', async () => {
    mockArticleCount.mockResolvedValue(0);
    mockArticleFindMany.mockResolvedValue([]);

    await listArticles({ page: 1, limit: 10, categories: ['toilet', 'parking'] });

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', category: { in: ['toilet', 'parking'] } },
      })
    );
  });

  it('articleType 필터가 where에 반영된다', async () => {
    mockArticleCount.mockResolvedValue(0);
    mockArticleFindMany.mockResolvedValue([]);

    await listArticles({ page: 1, limit: 10, articleType: 'news-brief' });

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published', articleType: 'news-brief' },
      })
    );
  });

  it('page 2에서 skip이 올바르게 계산된다', async () => {
    mockArticleCount.mockResolvedValue(25);
    mockArticleFindMany.mockResolvedValue([]);

    const result = await listArticles({ page: 2, limit: 10 });

    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 })
    );
    expect(result.totalPages).toBe(3);
  });
});

describe('listRecentArticles', () => {
  it('published만 필터 + publishedAt desc + limit', async () => {
    mockArticleFindMany.mockResolvedValue([{ id: 'a1', slug: 'article-1' }]);

    const result = await listRecentArticles(4);

    expect(result).toEqual([{ id: 'a1', slug: 'article-1' }]);
    expect(mockArticleFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'published' },
        orderBy: { publishedAt: 'desc' },
        take: 4,
      })
    );
  });
});

describe('getArticleBySlug', () => {
  it('published 기사는 detail 반환 + viewCount는 낙관적으로 +1, 버퍼에 증가분 기록', async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: 'a1',
      slug: 'article-1',
      status: 'published',
      viewCount: 5,
      title: '제목',
    });

    const result = await getArticleBySlug('article-1');

    expect(mockArticleFindUnique).toHaveBeenCalledWith({ where: { slug: 'article-1' } });
    expect(result).toMatchObject({ id: 'a1', slug: 'article-1', viewCount: 6 });
    expect(articleViewBuffer.get('article-1')).toBe(1);
  });

  it('draft 상태면 null 반환', async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: 'a2',
      slug: 'article-2',
      status: 'draft',
      viewCount: 0,
    });

    const result = await getArticleBySlug('article-2');

    expect(result).toBeNull();
    expect(articleViewBuffer.has('article-2')).toBe(false);
  });

  it('rejected 상태면 null 반환', async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: 'a3',
      slug: 'article-3',
      status: 'rejected',
      viewCount: 0,
    });

    const result = await getArticleBySlug('article-3');

    expect(result).toBeNull();
  });

  it('존재하지 않으면 null 반환', async () => {
    mockArticleFindUnique.mockResolvedValue(null);

    const result = await getArticleBySlug('missing');

    expect(result).toBeNull();
  });

  it('같은 slug를 연속 조회하면 버퍼 카운트가 누적된다', async () => {
    mockArticleFindUnique.mockResolvedValue({
      id: 'a1',
      slug: 'article-1',
      status: 'published',
      viewCount: 5,
    });

    await getArticleBySlug('article-1');
    await getArticleBySlug('article-1');

    expect(articleViewBuffer.get('article-1')).toBe(2);
  });
});

describe('flushArticleViewCounts', () => {
  // model.update() 가 아니라 raw UPDATE 를 쓴다 — update() 는 @updatedAt 을 함께 갱신해
  // 조회수 반영이 dateModified 오염으로 이어지기 때문이다.
  // SQL 형태 자체의 회귀는 __tests__/services/viewCountUpdatedAt.test.ts 가 고정한다.
  it('버퍼를 raw UPDATE increment로 flush 후 clear', async () => {
    articleViewBuffer.set('article-1', 3);
    articleViewBuffer.set('article-2', 1);

    await flushArticleViewCounts();

    expect(mockArticleUpdate).not.toHaveBeenCalled();
    const params = mockExecuteRaw.mock.calls.map(c => c.slice(1));
    expect(params).toContainEqual([3, 'article-1']);
    expect(params).toContainEqual([1, 'article-2']);
    expect(articleViewBuffer.size).toBe(0);
  });

  it('버퍼가 비어있으면 쿼리 실행 없이 종료', async () => {
    await flushArticleViewCounts();
    expect(mockArticleUpdate).not.toHaveBeenCalled();
    expect(mockExecuteRaw).not.toHaveBeenCalled();
  });

  it('개별 쿼리 실패는 무시되고 나머지는 계속 진행된다', async () => {
    articleViewBuffer.set('article-1', 1);
    articleViewBuffer.set('article-2', 1);
    mockExecuteRaw.mockRejectedValueOnce(new Error('삭제된 기사'));

    await expect(flushArticleViewCounts()).resolves.toBeUndefined();
    expect(articleViewBuffer.size).toBe(0);
  });
});
