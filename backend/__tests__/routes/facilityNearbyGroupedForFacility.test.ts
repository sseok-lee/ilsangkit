// GET /api/facilities/:category/:id/nearby-grouped — 시설 상세 "주변 시설"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGrouped, mockGetDetail, mockGetNearby } = vi.hoisted(() => ({
  mockGrouped: vi.fn(),
  mockGetDetail: vi.fn(),
  mockGetNearby: vi.fn(),
}));

vi.mock('../../src/services/facilityService.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  nearbyGroupedForFacility: mockGrouped,
  getDetail: mockGetDetail,
  getNearbyFacilities: mockGetNearby,
}));

import app from '../../src/app';

const GROUPS = {
  radius: 1000,
  groups: [
    { category: 'pharmacy', count: 1, exact: true, items: [{ id: 'p2', name: '온누리약국', category: 'pharmacy', distance: 300 }] },
    { category: 'hospital', count: 0, exact: true, items: [] },
  ],
};

beforeEach(() => {
  mockGrouped.mockReset().mockResolvedValue(GROUPS);
  mockGetDetail.mockReset().mockResolvedValue({ id: 'me', lat: 37.5, lng: 127.0 });
  mockGetNearby.mockReset().mockResolvedValue([]);
});

describe('GET /api/facilities/:category/:id/nearby-grouped', () => {
  it('{ success, data: { radius, groups } } 를 돌려주고 limit 기본값은 5', async () => {
    const res = await request(app).get('/api/facilities/pharmacy/pharmacy-3488dfe3648e/nearby-grouped');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: GROUPS });
    expect(mockGrouped).toHaveBeenCalledWith('pharmacy', 'pharmacy-3488dfe3648e', 5);
  });

  it('limit 을 1~10 정수로 받는다', async () => {
    await request(app).get('/api/facilities/pharmacy/me/nearby-grouped').query({ limit: 10 }).expect(200);
    expect(mockGrouped).toHaveBeenLastCalledWith('pharmacy', 'me', 10);
    for (const bad of ['0', '11', '1.5', 'abc']) {
      const res = await request(app).get('/api/facilities/pharmacy/me/nearby-grouped').query({ limit: bad });
      expect(res.status).toBe(422);
    }
  });

  it('시설이 없으면 404', async () => {
    mockGrouped.mockResolvedValue(null);
    const res = await request(app).get('/api/facilities/pharmacy/nope/nearby-grouped');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('지원하지 않는 카테고리는 422', async () => {
    const res = await request(app).get('/api/facilities/subway/x/nearby-grouped');
    expect(res.status).toBe(422);
    expect(mockGrouped).not.toHaveBeenCalled();
  });

  it('Cache-Control 은 기존 /:category/:id/nearby 와 같다', async () => {
    const legacy = await request(app).get('/api/facilities/pharmacy/me/nearby');
    const grouped = await request(app).get('/api/facilities/pharmacy/me/nearby-grouped');
    expect(legacy.status).toBe(200);
    expect(grouped.headers['cache-control']).toBe(legacy.headers['cache-control']);
  });
});
