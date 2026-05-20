import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetPropertyHotspots } = vi.hoisted(() => ({
  mockGetPropertyHotspots: vi.fn(),
}));

vi.mock('../../src/services/realEstateHotspotService.js', () => ({
  getPropertyHotspots: mockGetPropertyHotspots,
  getPricedSliceHotspots: vi.fn(),
  getWolseHotspots: vi.fn(),
  _hotspotCache: new Map(),
}));

vi.mock('../../src/services/metaService.js', () => ({
  getCategories: vi.fn().mockResolvedValue([]),
  getStats: vi.fn().mockResolvedValue({ cached: false, data: {} }),
  getRegionByDistrictName: vi.fn().mockResolvedValue(null),
  getRegionByBjdCode: vi.fn().mockResolvedValue(null),
  getRegions: vi.fn().mockResolvedValue([]),
  getHomeDashboard: vi.fn().mockResolvedValue({}),
}));

vi.mock('../../src/services/facilityService.js', () => ({
  getStatsByCity: vi.fn(),
  getStatsByDistrict: vi.fn(),
  getSyncStatus: vi.fn().mockResolvedValue([]),
  SHORT_TO_SLUG: {},
  CATEGORY_REGISTRY: {},
  ALL_CATEGORIES: [],
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: { hospitalDepartment: { groupBy: vi.fn().mockResolvedValue([]) } },
  prisma: { hospitalDepartment: { groupBy: vi.fn().mockResolvedValue([]) } },
}));

import app from '../../src/app.js';

const MOCK_PAYLOAD = {
  sale: { rising: [], falling: [], active: [] },
  jeonse: { rising: [], falling: [], active: [] },
  wolse: { active: [] },
};

beforeEach(() => {
  mockGetPropertyHotspots.mockReset();
});

describe('GET /api/meta/hotspots', () => {
  it('valid propertyType=apt returns 200 with PropertyHotspots payload', async () => {
    mockGetPropertyHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/hotspots?propertyType=apt');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sale).toBeDefined();
    expect(res.body.data.jeonse).toBeDefined();
    expect(res.body.data.wolse).toBeDefined();
    expect(mockGetPropertyHotspots).toHaveBeenCalledWith('apt');
  });

  it('valid propertyType=villa returns 200', async () => {
    mockGetPropertyHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/hotspots?propertyType=villa');
    expect(res.status).toBe(200);
    expect(mockGetPropertyHotspots).toHaveBeenCalledWith('villa');
  });

  it('valid propertyType=offitel returns 200', async () => {
    mockGetPropertyHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/hotspots?propertyType=offitel');
    expect(res.status).toBe(200);
    expect(mockGetPropertyHotspots).toHaveBeenCalledWith('offitel');
  });

  it('invalid propertyType returns 422', async () => {
    const res = await request(app).get('/api/meta/hotspots?propertyType=house');
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('missing propertyType returns 422', async () => {
    const res = await request(app).get('/api/meta/hotspots');
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('sets Cache-Control max-age=3600', async () => {
    mockGetPropertyHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/hotspots?propertyType=apt');
    expect(res.headers['cache-control']).toContain('max-age=3600');
  });

  it('returns 500 when getPropertyHotspots throws', async () => {
    mockGetPropertyHotspots.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app).get('/api/meta/hotspots?propertyType=apt');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
