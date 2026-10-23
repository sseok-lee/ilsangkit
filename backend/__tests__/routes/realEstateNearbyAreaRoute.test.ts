// GET /api/real-estate/nearby — areaKey·type 검증과 서비스 전달(DB 없이 서비스 mock).
import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';

const { getNearbyByBjd } = vi.hoisted(() => ({ getNearbyByBjd: vi.fn() }));

vi.mock('../../src/services/realEstateDetailService.js', () => ({
  getDetailOverview: vi.fn(),
  getDetailPage: vi.fn(),
  getDetailSnapshot: vi.fn(),
}));

vi.mock('../../src/services/realEstateService.js', () => ({
  searchTransactions: vi.fn(),
  getTransactionStats: vi.fn(),
  getComplexList: vi.fn(),
  searchComplexesByKeyword: vi.fn(),
  searchPropertyComplexesByKeyword: vi.fn(),
  getBuildingInfo: vi.fn(),
  searchAll: vi.fn(),
  getAreaGroups: vi.fn(),
  getApartmentPriceAnalysis: vi.fn(),
  getNearbyByBjd,
}));

import realEstateRouter from '../../src/routes/realEstate.js';

const app = express();
app.use('/api/real-estate', realEstateRouter);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  res.status(500).json({ success: false });
});

beforeEach(() => {
  getNearbyByBjd.mockReset();
  getNearbyByBjd.mockResolvedValue({ apt: [], villa: [], offitel: [], targetArea: { key: '85', label: '84' } });
});

describe('GET /api/real-estate/nearby areaKey·type', () => {
  it('type·areaKey 를 서비스에 넘기고 targetArea 를 응답에 싣는다', async () => {
    const res = await request(app)
      .get('/api/real-estate/nearby')
      .query({ bjdCode: '11680', mode: 'sale', type: 'apt-sale', areaKey: '85', excludeBuildingName: 'A' });
    expect(res.status).toBe(200);
    expect(res.body.data.targetArea).toEqual({ key: '85', label: '84' });
    expect(getNearbyByBjd).toHaveBeenCalledWith('11680', 'sale', expect.objectContaining({
      type: 'apt-sale', areaKey: '85', excludeBuildingName: 'A',
    }));
  });

  it.each(['84.9', '12345', 'abc', ''])('areaKey=%s 는 422', async (areaKey) => {
    const res = await request(app)
      .get('/api/real-estate/nearby')
      .query({ bjdCode: '11680', mode: 'sale', areaKey });
    expect(res.status).toBe(422);
    expect(getNearbyByBjd).not.toHaveBeenCalled();
  });

  it('잘못된 type 은 422', async () => {
    const res = await request(app).get('/api/real-estate/nearby').query({ bjdCode: '11680', mode: 'sale', type: 'apt' });
    expect(res.status).toBe(422);
  });
});
