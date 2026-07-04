import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockListArticles, mockListRecentArticles, mockGetArticleBySlug } = vi.hoisted(() => ({
  mockListArticles: vi.fn(),
  mockListRecentArticles: vi.fn(),
  mockGetArticleBySlug: vi.fn(),
}));

vi.mock('../../src/services/articleService.js', () => ({
  listArticles: mockListArticles,
  listRecentArticles: mockListRecentArticles,
  getArticleBySlug: mockGetArticleBySlug,
}));

import app from '../../src/app.js';

beforeEach(() => vi.clearAllMocks());

describe('GET /api/articles', () => {
  it('published 목록 + 페이지네이션 결과를 {success,data}로 반환', async () => {
    mockListArticles.mockResolvedValue({
      items: [{ id: 'a1', title: '기사1', slug: 'article-1' }],
      total: 1,
      page: 1,
      totalPages: 1,
    });

    const res = await request(app).get('/api/articles');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        items: [{ id: 'a1', title: '기사1', slug: 'article-1' }],
        total: 1,
        page: 1,
        totalPages: 1,
      },
    });
    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, limit: 10 })
    );
  });

  it('page/limit 쿼리가 서비스에 전달된다', async () => {
    mockListArticles.mockResolvedValue({ items: [], total: 0, page: 2, totalPages: 0 });

    await request(app).get('/api/articles?page=2&limit=5');

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ page: 2, limit: 5 })
    );
  });

  it('category 필터 쿼리가 서비스에 전달된다', async () => {
    mockListArticles.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });

    await request(app).get('/api/articles?category=toilet');

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ category: 'toilet' })
    );
  });

  it('categories 콤마 구분 쿼리가 배열로 변환되어 전달된다', async () => {
    mockListArticles.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });

    await request(app).get('/api/articles?categories=toilet,parking');

    expect(mockListArticles).toHaveBeenCalledWith(
      expect.objectContaining({ categories: ['toilet', 'parking'] })
    );
  });

  it('limit이 100 초과면 422', async () => {
    const res = await request(app).get('/api/articles?limit=101');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/articles/recent', () => {
  it('limit 쿼리로 최근 기사 목록 반환', async () => {
    mockListRecentArticles.mockResolvedValue([{ id: 'a1', slug: 'article-1' }]);

    const res = await request(app).get('/api/articles/recent?limit=3');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 'a1', slug: 'article-1' }] });
    expect(mockListRecentArticles).toHaveBeenCalledWith(3);
  });

  it('limit 생략 시 기본값 사용', async () => {
    mockListRecentArticles.mockResolvedValue([]);

    await request(app).get('/api/articles/recent');

    expect(mockListRecentArticles).toHaveBeenCalledWith(4);
  });
});

describe('GET /api/articles/:slug', () => {
  it('published 기사는 200 + {success,data}', async () => {
    mockGetArticleBySlug.mockResolvedValue({ id: 'a1', slug: 'article-1', viewCount: 6 });

    const res = await request(app).get('/api/articles/article-1');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { id: 'a1', slug: 'article-1', viewCount: 6 } });
    expect(mockGetArticleBySlug).toHaveBeenCalledWith('article-1');
  });

  it('미발행/부재 기사는 404 {success:false,error:{code:NOT_FOUND}}', async () => {
    mockGetArticleBySlug.mockResolvedValue(null);

    const res = await request(app).get('/api/articles/missing-or-draft');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: '오늘의 이슈를 찾을 수 없습니다' },
    });
  });

  it('slug 패턴 위반(대문자/특수문자)은 422', async () => {
    const res = await request(app).get('/api/articles/Invalid_Slug!');
    expect(res.status).toBe(422);
    expect(mockGetArticleBySlug).not.toHaveBeenCalled();
  });
});
