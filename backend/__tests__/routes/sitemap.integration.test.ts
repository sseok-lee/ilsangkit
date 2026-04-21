import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const getRealEstateBuildingsMock = vi.fn();

vi.mock('../../src/services/sitemapService.js', () => ({
  isValidCategory: () => true,
  getFacilityIds: vi.fn().mockResolvedValue([]),
  getWasteScheduleIds: vi.fn().mockResolvedValue([]),
  getRegionCategoryCombinations: vi.fn().mockResolvedValue([]),
  getRealEstateBuildings: getRealEstateBuildingsMock,
  getSubscriptionIds: vi.fn().mockResolvedValue([]),
}));

const sitemapRouter = (await import('../../src/routes/sitemap.js')).default;

const app = express();
app.use('/api/sitemap', sitemapRouter);
app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.statusCode ?? 500).json({ success: false, error: { message: err.message } });
});

describe('GET /api/sitemap/real-estate-buildings (US-008 integration)', () => {
  beforeEach(() => getRealEstateBuildingsMock.mockReset());

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
