import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuction } from '~/composables/useAuction';

beforeEach(() => { vi.clearAllMocks(); });

describe('useAuction', () => {
  it('getItems: 쿼리스트링 구성 + data 언랩', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } });
    const { getItems } = useAuction();
    const r = await getItems({ usage: 'residential', page: 1, limit: 20 });
    expect(r.total).toBe(0);
    const url = (globalThis as any).$fetch.mock.calls[0][0];
    expect(url).toContain('/api/auction/items');
    expect(url).toContain('usage=residential');
  });
  it('getItemDetail: cltrMngNo 경로', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { item: { cltrMngNo: 'A' }, nearby: [] } });
    const { getItemDetail } = useAuction();
    const r = await getItemDetail('A');
    expect(r.item.cltrMngNo).toBe('A');
    expect((globalThis as any).$fetch.mock.calls[0][0]).toContain('/api/auction/item/A');
  });
  it('getRanking 호출', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: [] });
    await useAuction().getRanking({ order: 'high', limit: 20 });
    expect((globalThis as any).$fetch.mock.calls[0][0]).toContain('/api/auction/ranking');
  });
});


it('serializes keyword, exact status and page together', async () => {
  globalThis.$fetch = vi.fn().mockResolvedValue({ success: true, data: {} }) as any
  await useAuction().getItems({ keyword: 'CLTR-1', status: 'scheduled', statusMode: 'exact', usage: 'land', page: 2 })
  const url = new URL((globalThis.$fetch as any).mock.calls[0][0], 'http://localhost')
  expect(Object.fromEntries(url.searchParams)).toMatchObject({ keyword: 'CLTR-1', status: 'scheduled', statusMode: 'exact', usage: 'land', page: '2' })
})


it('serializes ranking search with server ordering and limit', async () => {
  globalThis.$fetch = vi.fn().mockResolvedValue({ success: true, data: [] }) as any
  await useAuction().getRanking({ keyword: '강남', usage: 'land', order: 'count', limit: 50 })
  const url = new URL((globalThis.$fetch as any).mock.calls[0][0], 'http://localhost')
  expect(Object.fromEntries(url.searchParams)).toEqual({ keyword: '강남', usage: 'land', order: 'count', limit: '50' })
})
