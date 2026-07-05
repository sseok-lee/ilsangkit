import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useArticles } from '../../composables/useArticles';

beforeEach(() => { vi.mocked($fetch).mockReset?.(); });

describe('useArticles', () => {
  it('fetchArticles: GET /api/articles with page/limit/category query, returns res.data', async () => {
    const paginated = { items: [{ id: '1' }], total: 1, page: 1, totalPages: 1 };
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: paginated });
    const r = await useArticles().fetchArticles({ page: 2, limit: 10, category: 'toilet' });
    expect(r).toEqual(paginated);
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/articles');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(url).toContain('category=toilet');
  });

  it('fetchArticles: categories array joins with comma and takes precedence over category', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useArticles().fetchArticles({ categories: ['toilet', 'parking'], category: 'ignored' });
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('categories=toilet%2Cparking');
    expect(url).not.toContain('category=ignored');
  });

  it('fetchArticles: no params → no query string', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useArticles().fetchArticles();
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/articles');
  });

  it('fetchArticles: no credentials option (public API)', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useArticles().fetchArticles();
    const [, opts] = vi.mocked($fetch).mock.calls[0];
    expect(opts).toBeUndefined();
  });

  it('fetchRecentArticles: GET /api/articles/recent?limit=, returns res.data', async () => {
    const items = [{ id: '1' }, { id: '2' }];
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: items });
    const r = await useArticles().fetchRecentArticles(2);
    expect(r).toEqual(items);
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/articles/recent?limit=2');
  });

  it('fetchRecentArticles: defaults limit to 4', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: [] });
    await useArticles().fetchRecentArticles();
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/articles/recent?limit=4');
  });

  it('fetchArticleBySlug: GET /api/articles/:slug, returns res.data with content+sources', async () => {
    const detail = {
      id: 'a1',
      title: 't',
      slug: 'today-issue',
      summary: 's',
      category: 'toilet',
      articleType: 'news-brief',
      thumbnailUrl: null,
      keywords: null,
      viewCount: 3,
      publishedAt: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-06-30T00:00:00.000Z',
      content: '<p>본문</p>',
      sources: [{ title: '출처', url: 'https://example.com' }],
    };
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: detail });
    const r = await useArticles().fetchArticleBySlug('today-issue');
    expect(r).toEqual(detail);
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/articles/today-issue');
    expect(opts).toBeUndefined();
  });
});
