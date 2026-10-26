// GET /api/subway/stations/:slug/nearby-grouped — 지하철역 상세 "주변 시설"
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGrouped } = vi.hoisted(() => ({ mockGrouped: vi.fn() }));

vi.mock('../../src/services/subwayService.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  nearbyGroupedForStation: mockGrouped,
}));

import app from '../../src/app';

const GROUPS = {
  radius: 1000,
  groups: [
    { category: 'subway', count: 1, exact: true, items: [{ id: 's1', name: '신논현', nameSlug: 'sinnonhyeon', category: 'subway', lines: ['9호선'], distance: 450 }] },
    { category: 'parking', count: 0, exact: true, items: [] },
  ],
};

beforeEach(() => {
  mockGrouped.mockReset().mockResolvedValue(GROUPS);
});

describe('GET /api/subway/stations/:slug/nearby-grouped', () => {
  it('{ success, data: { radius, groups } } 를 돌려주고 limit 기본값은 5', async () => {
    const res = await request(app).get('/api/subway/stations/gangnam/nearby-grouped');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: GROUPS });
    expect(mockGrouped).toHaveBeenCalledWith('gangnam', 5);
  });

  it('limit 을 넘긴다', async () => {
    await request(app).get('/api/subway/stations/gangnam/nearby-grouped').query({ limit: 3 });
    expect(mockGrouped).toHaveBeenCalledWith('gangnam', 3);
  });

  it('역이 없으면 404', async () => {
    mockGrouped.mockResolvedValue(null);
    const res = await request(app).get('/api/subway/stations/nope/nearby-grouped');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it.each([['0'], ['11'], ['abc']])('limit=%s 는 422', async (limit) => {
    const res = await request(app).get('/api/subway/stations/gangnam/nearby-grouped').query({ limit });
    expect(res.status).toBe(422);
    expect(mockGrouped).not.toHaveBeenCalled();
  });

  it('slug 가 ASCII 소문자가 아니면 422', async () => {
    const res = await request(app).get(`/api/subway/stations/${encodeURIComponent('강남')}/nearby-grouped`);
    expect(res.status).toBe(422);
    expect(mockGrouped).not.toHaveBeenCalled();
  });
});
