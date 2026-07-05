import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminGuides } from '../../composables/useAdminGuides';

beforeEach(() => { vi.mocked($fetch).mockReset?.(); });

const rawGuide = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'g1',
  title: 't',
  slug: 's',
  summary: 'x',
  category: 'toilet',
  articleType: 'howto',
  thumbnailUrl: null,
  keywords: null,
  published: false,
  publishedAt: null,
  viewCount: 0,
  createdAt: 'c',
  updatedAt: 'u',
  ...overrides,
});

describe('useAdminGuides.list', () => {
  it('published:false 아이템을 status:draft로 파생', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({
      success: true,
      data: { items: [rawGuide({ published: false, publishedAt: null })], total: 1, page: 1, totalPages: 1 },
    });
    const res = await useAdminGuides().list();
    expect(res.items[0].status).toBe('draft');
    expect(res.items[0].published).toBe(false);
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides');
    expect(opts).toMatchObject({ credentials: 'include' });
  });

  it('published:true 아이템을 status:published로 파생', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({
      success: true,
      data: { items: [rawGuide({ published: true, publishedAt: 'p' })], total: 1, page: 1, totalPages: 1 },
    });
    const res = await useAdminGuides().list();
    expect(res.items[0].status).toBe('published');
  });

  it('status 필터를 published 쿼리로 매핑 (published→true)', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useAdminGuides().list({ status: 'published' });
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('published=true');
  });

  it('status 필터를 published 쿼리로 매핑 (draft→false)', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useAdminGuides().list({ status: 'draft' });
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('published=false');
  });

  it('status 미지정 시 published 쿼리 파라미터 생략', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 1, totalPages: 1 } });
    await useAdminGuides().list();
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).not.toContain('published=');
  });

  it('category/page/limit 쿼리 전달', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { items: [], total: 0, page: 2, totalPages: 1 } });
    await useAdminGuides().list({ category: 'toilet', page: 2, limit: 10 });
    const [url] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('category=toilet');
    expect(url).toContain('page=2');
    expect(url).toContain('limit=10');
  });
});

describe('useAdminGuides.get', () => {
  it('GET /api/admin/guides/:id, content 포함하고 status 파생', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({
      success: true,
      data: { ...rawGuide({ published: true, publishedAt: 'p' }), content: 'body' },
    });
    const r = await useAdminGuides().get('g1');
    expect(r.status).toBe('published');
    expect(r.content).toBe('body');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides/g1');
    expect(opts).toMatchObject({ credentials: 'include' });
  });
});

describe('useAdminGuides.update', () => {
  it('PATCH /api/admin/guides/:id with body=patch', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({
      success: true,
      data: { ...rawGuide({ title: 'new' }), content: 'c' },
    });
    const r = await useAdminGuides().update('g1', { title: 'new' });
    expect(r.title).toBe('new');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides/g1');
    expect(opts).toMatchObject({ method: 'PATCH', body: { title: 'new' }, credentials: 'include' });
  });
});

describe('useAdminGuides mutations', () => {
  it('publish는 POST + credentials, status 파생', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({
      success: true,
      data: { ...rawGuide({ published: true, publishedAt: 'p' }), content: 'c' },
    });
    const d = await useAdminGuides().publish('g1');
    expect(d.status).toBe('published');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides/g1/publish');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('unpublish는 POST + credentials, status:draft로 파생', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({
      success: true,
      data: { ...rawGuide({ published: false, publishedAt: null }), content: 'c' },
    });
    const d = await useAdminGuides().unpublish('g1');
    expect(d.status).toBe('draft');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides/g1/unpublish');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('reject는 POST + credentials, { deleted } 반환', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { deleted: true } });
    const r = await useAdminGuides().reject('g1');
    expect(r).toEqual({ deleted: true });
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides/g1/reject');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });

  it('remove는 DELETE + credentials, { deleted } 반환', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { deleted: true } });
    const r = await useAdminGuides().remove('g1');
    expect(r).toEqual({ deleted: true });
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toBe('http://localhost:8000/api/admin/guides/g1');
    expect(opts).toMatchObject({ method: 'DELETE', credentials: 'include' });
  });
});
