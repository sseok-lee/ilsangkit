import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAdminAuth } from '../../composables/useAdminAuth';

beforeEach(() => { vi.mocked($fetch).mockReset?.(); });

describe('useAdminAuth', () => {
  it('login: POST /api/admin/login with password', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { authenticated: true } });
    await useAdminAuth().login('secret');
    const [url, opts] = vi.mocked($fetch).mock.calls[0];
    expect(url).toContain('/api/admin/login');
    expect(opts).toMatchObject({ method: 'POST', body: { password: 'secret' } });
  });
  it('checkSession: true on 200, false on throw(401)', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: { authenticated: true } });
    expect(await useAdminAuth().checkSession()).toBe(true);
    vi.mocked($fetch).mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }));
    expect(await useAdminAuth().checkSession()).toBe(false);
  });
  it('logout: POST /api/admin/logout', async () => {
    vi.mocked($fetch).mockResolvedValueOnce({ success: true, data: {} });
    await useAdminAuth().logout();
    expect(vi.mocked($fetch).mock.calls[0][0]).toContain('/api/admin/logout');
  });
});
