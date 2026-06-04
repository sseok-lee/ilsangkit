import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetRegionList, mockGetRegionDetail, mockGetHubSummary } = vi.hoisted(() => ({
  mockGetRegionList: vi.fn(),
  mockGetRegionDetail: vi.fn(),
  mockGetHubSummary: vi.fn(),
}));

vi.mock('../../src/services/landService.js', () => ({
  getRegionList: mockGetRegionList,
  getRegionDetail: mockGetRegionDetail,
  getHubSummary: mockGetHubSummary,
}));

import app from '../../src/app.js';

describe('GET /api/real-estate/land/regions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('정상 응답 {success, data}', async () => {
    mockGetRegionList.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
    const res = await request(app).get('/api/real-estate/land/regions?city=서울특별시');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGetRegionList).toHaveBeenCalledWith(
      expect.objectContaining({ city: '서울특별시', page: 1, limit: 20 })
    );
  });
});

describe('GET /api/real-estate/land/region', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bjdCode+dongName 정상 응답', async () => {
    mockGetRegionDetail.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, jimokDistribution: [], landUseDistribution: [], priceTimeline: [] });
    const res = await request(app).get('/api/real-estate/land/region?bjdCode=11680&dongName=역삼동');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('필수 파라미터 누락 시 422', async () => {
    const res = await request(app).get('/api/real-estate/land/region?bjdCode=11680');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/real-estate/land/hub-summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('정상 응답', async () => {
    mockGetHubSummary.mockResolvedValue({ cities: [], totalTransactions: 0 });
    const res = await request(app).get('/api/real-estate/land/hub-summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
