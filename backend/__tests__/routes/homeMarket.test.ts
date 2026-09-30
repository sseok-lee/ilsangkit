import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';

const {
  getHomeMarket,
  getDetailOverview,
  getDetailPage,
  getDetailSnapshot,
  getTransactionStats,
  searchTransactions,
} = vi.hoisted(() => ({
  getHomeMarket: vi.fn(),
  getDetailOverview: vi.fn(),
  getDetailPage: vi.fn(),
  getDetailSnapshot: vi.fn(),
  getTransactionStats: vi.fn(),
  searchTransactions: vi.fn(),
}));

vi.mock('../../src/services/homeMarketService.js', () => ({ getHomeMarket }));

vi.mock('../../src/services/realEstateDetailService.js', () => ({
  getDetailOverview,
  getDetailPage,
  getDetailSnapshot,
}));

vi.mock('../../src/services/realEstateService.js', () => ({
  searchTransactions,
  getTransactionStats,
  getComplexList: vi.fn(),
  searchComplexesByKeyword: vi.fn(),
  searchPropertyComplexesByKeyword: vi.fn(),
  getBuildingInfo: vi.fn(),
  searchAll: vi.fn(),
  getAreaGroups: vi.fn(),
  getApartmentPriceAnalysis: vi.fn(),
  getNearbyByBjd: vi.fn(),
  regionFilterToSql: vi.fn(() => ({ clauses: [], params: [] })),
}));

import realEstateRouter from '../../src/routes/realEstate.js';

function makeApp() {
  const app = express();
  app.use('/api/real-estate', realEstateRouter);
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, requestId: req.requestId },
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' },
    });
  });
  return app;
}

const app = makeApp();

const homeMarket = {
  region: { city: 'seoul', district: 'gangnam', label: '서울 강남구' },
  window: { from: '2026-08-23', to: '2026-09-21' },
  generatedAt: '2026-09-21T03:00:00.000Z',
  counts: {
    apt: { status: 'ok', data: { total: 1, daily: [] } },
    villa: { status: 'ok', data: { total: 0, daily: [] } },
    offitel: { status: 'ok', data: { total: 0, daily: [] } },
  },
  recent: { status: 'ok', data: [] },
};

describe('GET /api/real-estate/home-market', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getHomeMarket.mockResolvedValue(homeMarket);
  });

  it('동적 :type 라우트보다 먼저 등록되어 홈 시장 서비스를 호출한다', async () => {
    const res = await request(app)
      .get('/api/real-estate/home-market')
      .query({ city: 'seoul', district: 'gangnam' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: homeMarket });
    expect(getHomeMarket).toHaveBeenCalledWith({ city: 'seoul', district: 'gangnam' });
    expect(getDetailSnapshot).not.toHaveBeenCalled();
  });

  it('city 없이 district만 오면 기존 validation path로 422를 반환한다', async () => {
    const res = await request(app)
      .get('/api/real-estate/home-market')
      .query({ district: 'gangnam' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(getHomeMarket).not.toHaveBeenCalled();
  });

  it('알 수 없는 city slug는 422를 반환한다', async () => {
    const res = await request(app)
      .get('/api/real-estate/home-market')
      .query({ city: 'unknown' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(getHomeMarket).not.toHaveBeenCalled();
  });
});
