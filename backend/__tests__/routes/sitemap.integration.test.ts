import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const getRealEstateBuildingsMock = vi.fn();
const getFacilityIdsMock = vi.fn();
const getWasteScheduleIdsMock = vi.fn();
const getRegionCategoryCombinationsMock = vi.fn();
const getSubscriptionIdsMock = vi.fn();
// isValidCategory 는 테스트별로 override 가능한 mock 으로 둔다 (invalid category → 400 검증).
const isValidCategoryMock = vi.fn<(c: string) => boolean>();

vi.mock('../../src/services/sitemapService.js', () => ({
  isValidCategory: (c: string) => isValidCategoryMock(c),
  getFacilityIds: (...args: unknown[]) => getFacilityIdsMock(...args),
  getWasteScheduleIds: () => getWasteScheduleIdsMock(),
  getRegionCategoryCombinations: () => getRegionCategoryCombinationsMock(),
  getRealEstateBuildings: () => getRealEstateBuildingsMock(),
  getSubscriptionIds: () => getSubscriptionIdsMock(),
}));

const sitemapRouter = (await import('../../src/routes/sitemap.js')).default;

const app = express();
app.use('/api/sitemap', sitemapRouter);
app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.statusCode ?? 500).json({ success: false, error: { message: err.message } });
});

beforeEach(() => {
  getRealEstateBuildingsMock.mockReset();
  getFacilityIdsMock.mockReset().mockResolvedValue([]);
  getWasteScheduleIdsMock.mockReset().mockResolvedValue([]);
  getRegionCategoryCombinationsMock.mockReset().mockResolvedValue([]);
  getSubscriptionIdsMock.mockReset().mockResolvedValue([]);
  isValidCategoryMock.mockReset().mockReturnValue(true);
});

describe('GET /api/sitemap/facilities/:category', () => {
  it('returns 400 with BAD_REQUEST when category is invalid', async () => {
    isValidCategoryMock.mockReturnValue(false);
    const res = await request(app).get('/api/sitemap/facilities/notreal');
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 200 with data when category is valid', async () => {
    isValidCategoryMock.mockReturnValue(true);
    getFacilityIdsMock.mockResolvedValue([
      { id: '1', updatedAt: '2026-04-01T00:00:00Z' },
      { id: '2', updatedAt: '2026-04-02T00:00:00Z' },
    ]);
    const res = await request(app).get('/api/sitemap/facilities/toilet');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('passes limit query param through to getFacilityIds', async () => {
    isValidCategoryMock.mockReturnValue(true);
    getFacilityIdsMock.mockResolvedValue([]);
    const res = await request(app).get('/api/sitemap/facilities/toilet?limit=5');
    expect(res.status).toBe(200);
    expect(getFacilityIdsMock).toHaveBeenCalledWith('toilet', 5);
  });

  it('returns 422 when limit query param is not a positive integer (Zod validation)', async () => {
    isValidCategoryMock.mockReturnValue(true);
    const res = await request(app).get('/api/sitemap/facilities/toilet?limit=-3');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/sitemap/subscriptions', () => {
  it('returns 200 with subscription ids', async () => {
    getSubscriptionIdsMock.mockResolvedValue([
      { id: 1, updatedAt: '2026-04-10T00:00:00Z' },
      { id: 2, updatedAt: '2026-04-11T00:00:00Z' },
    ]);
    const res = await request(app).get('/api/sitemap/subscriptions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
  });

  it('returns empty array without 500 when DB has no subscriptions', async () => {
    getSubscriptionIdsMock.mockResolvedValue([]);
    const res = await request(app).get('/api/sitemap/subscriptions');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/sitemap/region-categories', () => {
  it('returns 200 with region-category combinations', async () => {
    getRegionCategoryCombinationsMock.mockResolvedValue([
      { city: '서울특별시', district: '강남구', citySlug: 'seoul', districtSlug: 'gangnam', category: 'toilet' },
      { city: '부산광역시', district: '해운대구', citySlug: 'busan', districtSlug: 'haeundae', category: 'parking' },
    ]);
    const res = await request(app).get('/api/sitemap/region-categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0]).toHaveProperty('citySlug');
    expect(res.body.data[0]).toHaveProperty('districtSlug');
    expect(res.body.data[0]).toHaveProperty('category');
  });

  it('returns empty array without 500 when no combinations exist', async () => {
    getRegionCategoryCombinationsMock.mockResolvedValue([]);
    const res = await request(app).get('/api/sitemap/region-categories');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });
});

describe('GET /api/sitemap/real-estate-buildings (US-008 integration)', () => {
  it('returns new-format records with realEstateType + city + district fields', async () => {
    getRealEstateBuildingsMock.mockResolvedValue([
      {
        realEstateType: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
        bjdCode: '11680',
      },
      {
        realEstateType: 'villa-rent',
        city: '서울특별시',
        district: '관악구',
        buildingName: 'ABC빌라',
        bjdCode: '11620',
      },
    ]);

    const res = await request(app).get('/api/sitemap/real-estate-buildings');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    for (const item of res.body.data) {
      expect(item).toHaveProperty('realEstateType');
      expect(item).toHaveProperty('city');
      expect(item).toHaveProperty('district');
      expect(item).toHaveProperty('buildingName');
      expect(item).toHaveProperty('bjdCode');
      // 레거시 필드는 더 이상 노출되지 않아야 한다
      expect(item).not.toHaveProperty('propertyType');
    }
  });

  it('returns empty array without 500 when DB is empty', async () => {
    getRealEstateBuildingsMock.mockResolvedValue([]);
    const res = await request(app).get('/api/sitemap/real-estate-buildings');
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('supports all 6 realEstateType variants', async () => {
    const types = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'];
    getRealEstateBuildingsMock.mockResolvedValue(
      types.map((t, i) => ({
        realEstateType: t,
        city: '서울특별시',
        district: '강남구',
        buildingName: `건물${i}`,
        bjdCode: '11680',
      })),
    );
    const res = await request(app).get('/api/sitemap/real-estate-buildings');
    expect(res.status).toBe(200);
    const returnedTypes = (res.body.data as { realEstateType: string }[]).map((b) => b.realEstateType);
    expect(returnedTypes.sort()).toEqual([...types].sort());
  });
});
