import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/auctionService.js', () => ({
  getItems: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }),
  getItemDetail: vi.fn().mockResolvedValue({ item: { cltrMngNo: 'A' }, nearby: [] }),
  getRegionList: vi.fn().mockResolvedValue({ items: [] }),
  getRegionDetail: vi.fn().mockResolvedValue({ usageGroups: [], activeItems: [], recentSold: [] }),
  getCityDetail: vi.fn().mockResolvedValue({ districts: [] }),
  getHubSummary: vi.fn().mockResolvedValue({ totalActive: 0, totalSold: 0, regionCount: 0 }),
  getRanking: vi.fn().mockResolvedValue([]),
  getSitemapEntries: vi.fn().mockResolvedValue({ regions: [], items: [] }),
}));

import app from '../../src/app.js';

describe('auction routes', () => {
  it('GET /api/auction/items 200', async () => {
    const res = await request(app).get('/api/auction/items?usage=residential');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  it('GET /api/auction/item/:cltrMngNo 200', async () => {
    const res = await request(app).get('/api/auction/item/A');
    expect(res.status).toBe(200);
    expect(res.body.data.item.cltrMngNo).toBe('A');
  });
  it('GET /api/auction/items 잘못된 usage 422', async () => {
    const res = await request(app).get('/api/auction/items?usage=bogus');
    expect(res.status).toBe(422);
  });
  it('GET /api/auction/ranking 200', async () => {
    expect((await request(app).get('/api/auction/ranking')).status).toBe(200);
  });
});
