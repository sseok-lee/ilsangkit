import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminAuth } from '../../composables/useAdminAuth';

beforeEach(() => { vi.mocked($fetch).mockReset?.(); });

describe('useAdminAuth', () => {
  it('login: POST /api/admin/login with password', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { authenticated: true } });
    await useAdminAuth().login('secret');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/login');
    expect(opts).toMatchObject({ method: 'POST', body: { password: 'secret' }, credentials: 'include' });
  });
  it('checkSession: true on 200, false on throw(401)', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { authenticated: true } });
    expect(await useAdminAuth().checkSession()).toBe(true);
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/session');
    expect(opts).toMatchObject({ credentials: 'include' });
    vi.mocked($fetch).mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }));
    expect(await useAdminAuth().checkSession()).toBe(false);
  });
  it('logout: POST /api/admin/logout', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: {} });
    await useAdminAuth().logout();
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/logout');
    expect(opts).toMatchObject({ method: 'POST', credentials: 'include' });
  });
});
