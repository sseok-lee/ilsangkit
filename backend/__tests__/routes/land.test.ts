import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetRegionList, mockGetRegionDetail, mockGetHubSummary, mockGetSitemapEntries } = vi.hoisted(() => ({
  mockGetRegionList: vi.fn(),
  mockGetRegionDetail: vi.fn(),
  mockGetHubSummary: vi.fn(),
  mockGetSitemapEntries: vi.fn(),
}));

vi.mock('../../src/services/landService.js', () => ({
  getRegionList: mockGetRegionList,
  getRegionDetail: mockGetRegionDetail,
  getHubSummary: mockGetHubSummary,
  getSitemapEntries: mockGetSitemapEntries,
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
    mockGetRegionDetail.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, jimokGroups: [], daeSamples: [], daeNonShareCount: 0, landUseDistribution: [], priceTimeline: [] });
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

describe('GET /api/real-estate/land/sitemap', () => {
  beforeEach(() => vi.clearAllMocks());

  it('200 + success:true + {cities, indexableDongs} shape', async () => {
    const mockData = {
      cities: [
        { city: '서울', district: '강남구' },
        { city: '서울', district: '강북구' },
      ],
      indexableDongs: [
        { city: '서울', district: '강남구', dongName: '역삼동' },
      ],
    };
    mockGetSitemapEntries.mockResolvedValue(mockData);

    const res = await request(app).get('/api/real-estate/land/sitemap');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('cities');
    expect(res.body.data).toHaveProperty('indexableDongs');
    expect(res.body.data.cities).toHaveLength(2);
    expect(res.body.data.indexableDongs).toHaveLength(1);
    expect(res.body.data.indexableDongs[0]).toMatchObject({
      city: '서울',
      district: '강남구',
      dongName: '역삼동',
    });
  });
});
