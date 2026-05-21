import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetComplexHotspots } = vi.hoisted(() => ({
  mockGetComplexHotspots: vi.fn(),
}));

vi.mock('../../src/services/realEstateComplexHotspotService.js', () => ({
  getComplexHotspots: mockGetComplexHotspots,
  _complexHotspotCache: new Map(),
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
  newHigh: [],
  active: [],
  topPyeong: [],
};

beforeEach(() => {
  mockGetComplexHotspots.mockReset();
});

describe('GET /api/meta/complex-hotspots', () => {
  it('valid propertyType=apt returns 200 with ComplexHotspots payload', async () => {
    mockGetComplexHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/complex-hotspots?propertyType=apt');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.newHigh).toEqual(expect.any(Array));
    expect(res.body.data.active).toEqual(expect.any(Array));
    expect(res.body.data.topPyeong).toEqual(expect.any(Array));
    expect(mockGetComplexHotspots).toHaveBeenCalledWith('apt');
  });

  it('valid propertyType=villa returns 200', async () => {
    mockGetComplexHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/complex-hotspots?propertyType=villa');
    expect(res.status).toBe(200);
    expect(mockGetComplexHotspots).toHaveBeenCalledWith('villa');
  });

  it('valid propertyType=offitel returns 200', async () => {
    mockGetComplexHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/complex-hotspots?propertyType=offitel');
    expect(res.status).toBe(200);
    expect(mockGetComplexHotspots).toHaveBeenCalledWith('offitel');
  });

  it('invalid propertyType returns 422', async () => {
    const res = await request(app).get('/api/meta/complex-hotspots?propertyType=house');
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('missing propertyType returns 422', async () => {
    const res = await request(app).get('/api/meta/complex-hotspots');
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('sets Cache-Control max-age=3600', async () => {
    mockGetComplexHotspots.mockResolvedValue(MOCK_PAYLOAD);
    const res = await request(app).get('/api/meta/complex-hotspots?propertyType=apt');
    expect(res.headers['cache-control']).toContain('max-age=3600');
  });

  it('returns 500 when getComplexHotspots throws', async () => {
    mockGetComplexHotspots.mockRejectedValueOnce(new Error('db error'));
    const res = await request(app).get('/api/meta/complex-hotspots?propertyType=apt');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
