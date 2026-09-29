import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';

const {
  getComplexList,
  searchComplexesByKeyword,
  searchPropertyComplexesByKeyword,
  searchAll,
  fetchBuildings,
  fetchRegions,
} = vi.hoisted(() => ({
  getComplexList: vi.fn(),
  searchComplexesByKeyword: vi.fn(),
  searchPropertyComplexesByKeyword: vi.fn(),
  searchAll: vi.fn(),
  fetchBuildings: vi.fn(),
  fetchRegions: vi.fn(),
}));

vi.mock('../../src/services/realEstateService.js', () => ({
  searchTransactions: vi.fn(),
  getTransactionStats: vi.fn(),
  getComplexList,
  searchComplexesByKeyword,
  searchPropertyComplexesByKeyword,
  getBuildingInfo: vi.fn(),
  searchAll,
  getAreaGroups: vi.fn(),
  getApartmentPriceAnalysis: vi.fn(),
  getNearbyByBjd: vi.fn(),
}));

vi.mock('../../src/services/realEstateMapService.js', () => ({
  fetchBuildings,
  fetchRegions,
}));

vi.mock('../../src/services/realEstateDetailService.js', () => ({
  getDetailOverview: vi.fn(),
  getDetailPage: vi.fn(),
  getDetailSnapshot: vi.fn(),
}));

vi.mock('../../src/services/homeMarketService.js', () => ({
  getHomeMarket: vi.fn(),
}));

vi.mock('../../src/services/realEstateHubSummaryService.js', () => ({
  getHubSummary: vi.fn(),
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

const latestDeals = {
  sale: { kind: 'sale', amount: 150000, deposit: null, monthlyRent: null, exclusiveArea: 84.9, floor: 12, dealYear: 2026, dealMonth: 5, dealDay: 20 },
  jeonse: null,
  wolse: null,
};

const listData = {
  items: [{
    buildingName: '래미안강남',
    bjdCode: '11680',
    city: '서울',
    district: '강남구',
    dongName: '역삼동',
    transactionCount: 12,
    latestPrice: 150000,
    lat: 37.5,
    lng: 127.0,
    lastDealYear: 2026,
    lastDealMonth: 5,
    buildYear: 2010,
    latestDeals,
  }],
  total: 30,
  page: 1,
  totalPages: 2,
};

const app = makeApp();

describe('real estate exploration routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getComplexList.mockResolvedValue(listData);
    searchComplexesByKeyword.mockResolvedValue(listData);
    searchPropertyComplexesByKeyword.mockResolvedValue(listData);
    searchAll.mockResolvedValue({ categories: [], buildingCounts: { apt: 0, villa: 0, offitel: 0 } });
    fetchBuildings.mockResolvedValue({ items: listData.items, total: 1, exact: true });
    fetchRegions.mockResolvedValue([]);
  });

  it('returns enriched legacy complex list contract unchanged around pagination', async () => {
    const response = await request(app)
      .get('/api/real-estate/apt-sale/complexes')
      .query({ city: '서울특별시', district: '강남구', page: '1', limit: '15' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ total: 30, page: 1, totalPages: 2 });
    expect(response.body.data.items[0]).toHaveProperty('latestPrice');
    expect(response.body.data.items[0]).toHaveProperty('latestDeals.sale.exclusiveArea');
    expect(response.body.data.items[0].latestDeals.jeonse).toBeNull();
  });

  it('does not cache or swallow building enrichment failure at route boundary', async () => {
    fetchBuildings.mockRejectedValueOnce(new Error('latest deals failed'));

    const response = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: '5', swLat: '37.4', swLng: '126.8', neLat: '37.7', neLng: '127.2' });

    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('keeps region map responses unenriched', async () => {
    fetchRegions.mockResolvedValueOnce([{ name: '서울특별시', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: 5000, transactionCount: 10 }]);

    const response = await request(app)
      .get('/api/real-estate/apt-sale/map')
      .query({ level: '12', swLat: '33', swLng: '124', neLat: '39', neLng: '132' });

    expect(response.status).toBe(200);
    expect(response.body.data.granularity).toBe('city');
    expect(response.body.data.items[0]).not.toHaveProperty('latestDeals');
  });
});
