import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/metaService.js', () => ({
  getHomeDashboard: vi.fn().mockResolvedValue({
    total: 100000,
    buildingCount: 30000,
    realEstateBuildings: { apt: 20000, villa: 8000, offitel: 2000 },
    subscriptionActiveCount: 42,
    newlyListedToday: 1284,
    realEstateTrends: [],
    trendingBuildings: { sale: [], jeonse: [], wolse: [] },
    subscriptionSummary: { closingThisWeek: 0, upcomingNextWeek: 0, avgSupplyPrice: null, imminent: [] },
  }),
  getCategories: vi.fn().mockResolvedValue([]),
  getStats: vi.fn().mockResolvedValue({ cached: false, data: {} }),
  getRegionByDistrictName: vi.fn().mockResolvedValue(null),
  getRegionByBjdCode: vi.fn().mockResolvedValue(null),
  getRegions: vi.fn().mockResolvedValue([]),
}));

// Mock other services that app imports
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
import { getHomeDashboard } from '../../src/services/metaService.js';

describe('GET /api/meta/home-dashboard', () => {
  it('returns 200 with success envelope and dashboard payload', async () => {
    const res = await request(app).get('/api/meta/home-dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('newlyListedToday', 1284);
    expect(res.body.data).toHaveProperty('realEstateTrends');
    expect(res.body.data).toHaveProperty('trendingBuildings');
    expect(res.body.data.trendingBuildings).toHaveProperty('sale');
  });

  it('returns 500 when getHomeDashboard throws', async () => {
    (getHomeDashboard as any).mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/meta/home-dashboard');
    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
  });
});
