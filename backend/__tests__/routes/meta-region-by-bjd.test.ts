import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const getRegionByBjdCodeMock = vi.fn();

vi.mock('../../src/services/metaService.js', async () => {
  return {
    getRegionByBjdCode: getRegionByBjdCodeMock,
    getCategories: vi.fn().mockResolvedValue([]),
    getStats: vi.fn().mockResolvedValue({ data: {} }),
    getRegionByDistrictName: vi.fn().mockResolvedValue(null),
    getRegions: vi.fn().mockResolvedValue([]),
  };
});

vi.mock('../../src/services/facilityService.js', async () => {
  return {
    getStatsByCity: vi.fn().mockResolvedValue(null),
    getStatsByDistrict: vi.fn().mockResolvedValue(null),
    getSyncStatus: vi.fn().mockResolvedValue({}),
    SHORT_TO_SLUG: {},
  };
});

// Dynamically import router AFTER mocks are installed
const metaRouter = (await import('../../src/routes/meta.js')).default;

const app = express();
app.use('/api/meta', metaRouter);
app.use((err: Error & { statusCode?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  res.status(err.statusCode ?? 500).json({ success: false, error: { message: err.message } });
});

describe('GET /api/meta/region-by-bjd', () => {
  beforeEach(() => {
    getRegionByBjdCodeMock.mockReset();
  });

  it('returns city/district for 5-digit lawd code', async () => {
    getRegionByBjdCodeMock.mockResolvedValue({
      city: '서울특별시',
      district: '강남구',
      bjdCode: '11680',
    });

    const res = await request(app).get('/api/meta/region-by-bjd').query({ bjdCode: '11680' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: { city: '서울특별시', district: '강남구', bjdCode: '11680' },
    });
    expect(getRegionByBjdCodeMock).toHaveBeenCalledWith('11680');
  });

  it('accepts 10-digit full bjdCode (service does the slicing)', async () => {
    getRegionByBjdCodeMock.mockResolvedValue({
      city: '서울특별시',
      district: '강남구',
      bjdCode: '11680',
    });

    const res = await request(app).get('/api/meta/region-by-bjd').query({ bjdCode: '1168010100' });
    expect(res.status).toBe(200);
    expect(getRegionByBjdCodeMock).toHaveBeenCalledWith('1168010100');
  });

  it('returns 404 for unknown bjdCode', async () => {
    getRegionByBjdCodeMock.mockResolvedValue(null);
    const res = await request(app).get('/api/meta/region-by-bjd').query({ bjdCode: '99999' });
    expect(res.status).toBe(404);
  });

  it('rejects malformed bjdCode with 422', async () => {
    const res = await request(app).get('/api/meta/region-by-bjd').query({ bjdCode: 'abcde' });
    expect(res.status).toBe(422);
  });

  it('rejects too-short bjdCode', async () => {
    const res = await request(app).get('/api/meta/region-by-bjd').query({ bjdCode: '123' });
    expect(res.status).toBe(422);
  });

  it('rejects missing bjdCode', async () => {
    const res = await request(app).get('/api/meta/region-by-bjd');
    expect(res.status).toBe(422);
  });
});

