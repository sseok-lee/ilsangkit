import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminArticles } from '../../composables/useAdminArticles';

beforeEach(() => { vi.mocked($fetch).mockReset?.(); });

describe('useAdminArticles', () => {
  it('list: GET /api/admin/articles with status/category/page/limit query, returns res.data', async () => {
    const paginated = { items: [{ id: '1' }], total: 1, page: 1, totalPages: 1 };
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: paginated });
    const r = await useAdminArticles().list({ status: 'draft', category: 'toilet', page: 2, limit: 10 });
    expect(r).toEqual(paginated);
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles');
    expect(url).toContain('status=draft');
    expect(url).toContain('category=toilet');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
    expect(opts).toMatchObject({ credentials: 'include' });
  });

  it('list: no params → no query string, still credentials include', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useAdminArticles().list();
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/articles');
  });

  it('get: GET /api/admin/articles/:id, returns res.data', async () => {
    const detail = { id: 'a1', title: 't', content: 'c' };
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: detail });
    const r = await useAdminArticles().get('a1');
    expect(r).toEqual(detail);
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1');
    expect(opts).toMatchObject({ credentials: 'include' });
  });

  it('update: PATCH /api/admin/articles/:id with body=patch', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { id: 'a1', title: 'new' } });
    const r = await useAdminArticles().update('a1', { title: 'new' });
    expect(r).toEqual({ id: 'a1', title: 'new' });
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1');
    expect(opts).toMatchObject({ method: 'PATCH', body: { title: 'new' }, credentials: 'include' });
  });

  it('publish: POST /api/admin/articles/:id/publish', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { id: 'a1', status: 'published' } });
    await useAdminArticles().publish('a1');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1/publish');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('unpublish: POST /api/admin/articles/:id/unpublish', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { id: 'a1', status: 'draft' } });
    await useAdminArticles().unpublish('a1');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1/unpublish');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('reject: POST /api/admin/articles/:id/reject', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { id: 'a1', status: 'rejected' } });
    await useAdminArticles().reject('a1');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1/reject');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('remove: DELETE /api/admin/articles/:id', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { deleted: true } });
    await useAdminArticles().remove('a1');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1');
    expect(opts).toMatchObject({ method: 'DELETE', credentials: 'include' });
  });

  it('generate: POST /api/admin/articles/generate with optional body', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { started: true, count: 3, category: null } });
    await useAdminArticles().generate({ count: 3, category: 'toilet' });
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/generate');
    expect(opts).toMatchObject({ method: 'POST', body: { count: 3, category: 'toilet' }, credentials: 'include' });
  });

  it('generate: no body defaults to empty object', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { started: true, count: 3, category: null } });
    await useAdminArticles().generate();
    const [, opts] = vi.mocked($fetch).mock.calls[0];
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('generate: track=policy를 body로 전달', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { started: true, count: 3, category: null, track: 'policy' } });
    await useAdminArticles().generate({ track: 'policy' });
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/generate');
    expect(opts).toMatchObject({ method: 'POST', body: { track: 'policy' }, credentials: 'include' });
  });

  it('regenerate: POST /api/admin/articles/:id/regenerate', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { started: true, count: 1, category: 'toilet' } });
    await useAdminArticles().regenerate('a1');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/articles/a1/regenerate');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });
});
