import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';

const {
  getDetailOverview,
  getDetailPage,
  getDetailSnapshot,
  getTransactionStats,
  searchTransactions,
} = vi.hoisted(() => ({
  getDetailOverview: vi.fn(),
  getDetailPage: vi.fn(),
  getDetailSnapshot: vi.fn(),
  getTransactionStats: vi.fn(),
  searchTransactions: vi.fn(),
}));

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
}));

import realEstateRouter from '../../src/routes/realEstate.js';

function makeApp() {
  const app = express();
  app.use('/api/real-estate', realEstateRouter);
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code,
          message: err.message,
          requestId: req.requestId,
        },
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

const overview = {
  identity: { bjdCode: '11680', buildingName: 'A' },
  latestSale: null,
  buildYear: 2001,
  minArea: '59.90',
  maxArea: '84.90',
  saleCount6m: 3,
  window6m: { from: '2026-03-21', to: '2026-09-21' },
  addresses: [{ dongName: '역삼동', jibun: '1', roadName: null }],
  location: { lat: 37.5, lng: 127.0 },
  locationAmbiguous: false,
  generatedAt: '2026-09-21T00:00:00.000Z',
};

const snapshot = {
  filters: {
    bjdCode: '11680',
    buildingName: 'A',
    mode: 'wolse',
    months: 6,
    area: '84.90',
    deposit: 0,
  },
  window: { from: '2026-03-21', to: '2026-09-21' },
  options: { areas: ['84.90'], deposits: [{ amount: 0, count: 2 }] },
  points: [{ id: 1, date: '2026-09-01', amount: 120, area: '84.90', floor: 7, deposit: 0 }],
  table: { items: [{ id: 1, monthlyRent: 120, deposit: 0 }], total: 1, page: 1, totalPages: 1 },
  generatedAt: '2026-09-21T00:00:00.000Z',
  adjustment: null,
};

describe('real estate detail routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDetailOverview.mockResolvedValue(overview);
    getDetailSnapshot.mockResolvedValue(snapshot);
    getDetailPage.mockResolvedValue(snapshot.table);
    searchTransactions.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
    getTransactionStats.mockResolvedValue({ monthly: [], summary: { totalCount: 0 } });
  });

  it('detail-overview wires params and query to service with success envelope', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-sale/detail-overview')
      .query({ bjdCode: '11680', buildingName: 'A' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: overview });
    expect(getDetailOverview).toHaveBeenCalledWith('apt-sale', { bjdCode: '11680', buildingName: 'A' });
  });

  it('preserves buildingKey across overview, chart and transaction-page routes', async () => {
    const buildingKey = 'a'.repeat(64);
    const identity = { bjdCode: '11680', buildingName: '스톤빌리지', buildingKey };
    const first = await request(app).get('/api/real-estate/villa-sale/detail-overview').query(identity);
    const chart = await request(app).get('/api/real-estate/villa-sale/detail').query({ ...identity, mode: 'sale', months: 6 });
    const page = await request(app).get('/api/real-estate/villa-sale/detail-page').query({ ...identity, mode: 'sale', months: 6, area: '84.90', page: 2 });
    expect([first.status, chart.status, page.status]).toEqual([200, 200, 200]);
    for (const service of [getDetailOverview, getDetailSnapshot, getDetailPage]) {
      expect(service).toHaveBeenCalledWith('villa-sale', expect.objectContaining(identity));
    }
  });

  it('overview returns 404 only when service confirms null', async () => {
    getDetailOverview.mockResolvedValueOnce(null);
    const res = await request(app)
      .get('/api/real-estate/apt-sale/detail-overview')
      .query({ bjdCode: '11680', buildingName: 'A' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('overview service exceptions propagate as 5xx', async () => {
    getDetailOverview.mockRejectedValueOnce(new Error('db down'));
    const res = await request(app)
      .get('/api/real-estate/apt-sale/detail-overview')
      .query({ bjdCode: '11680', buildingName: 'A' });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe('INTERNAL_ERROR');
  });

  it('detail validates query and serializes wire response', async () => {
    const res = await request(app)
      .get('/api/real-estate/apt-rent/detail')
      .query({ bjdCode: '11680', buildingName: 'A', mode: 'wolse', months: '6', area: '84.9', deposit: '0' });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: snapshot });
    expect(getDetailSnapshot).toHaveBeenCalledWith('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: 0,
    });
  });

  it('rent-only overview accepts rent type with sale overview service', async () => {
    const res = await request(app)
      .get('/api/real-estate/villa-rent/detail-overview')
      .query({ bjdCode: '11680', buildingName: 'A' });

    expect(res.status).toBe(200);
    expect(getDetailOverview).toHaveBeenCalledWith('villa-rent', { bjdCode: '11680', buildingName: 'A' });
  });

  it('invalid type/mode and empty deposit are 422 validation errors', async () => {
    const invalidMode = await request(app)
      .get('/api/real-estate/apt-sale/detail')
      .query({ bjdCode: '11680', buildingName: 'A', mode: 'wolse', months: '6', area: '84.90', deposit: '0' });
    const emptyDeposit = await request(app)
      .get('/api/real-estate/apt-rent/detail')
      .query({ bjdCode: '11680', buildingName: 'A', mode: 'wolse', months: '6', area: '84.90', deposit: '' });

    expect(invalidMode.status).toBe(422);
    expect(invalidMode.body.error.code).toBe('VALIDATION_ERROR');
    expect(emptyDeposit.status).toBe(422);
    expect(emptyDeposit.body.error.code).toBe('VALIDATION_ERROR');
    expect(getDetailSnapshot).not.toHaveBeenCalled();
  });

  it('detail-page requires exact area and wolse deposit without auto-reset', async () => {
    const missingDeposit = await request(app)
      .get('/api/real-estate/apt-rent/detail-page')
      .query({ bjdCode: '11680', buildingName: 'A', mode: 'wolse', months: '6', area: '84.90' });
    const valid = await request(app)
      .get('/api/real-estate/apt-rent/detail-page')
      .query({ bjdCode: '11680', buildingName: 'A', mode: 'wolse', months: '6', area: '84.90', deposit: '0', page: '2' });

    expect(missingDeposit.status).toBe(422);
    expect(valid.status).toBe(200);
    expect(valid.body).toEqual({ success: true, data: snapshot.table });
    expect(getDetailPage).toHaveBeenCalledWith('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: 0,
      page: 2,
    });
  });

  it('legacy search and stats routes keep existing service call shape', async () => {
    const search = await request(app)
      .get('/api/real-estate/apt-sale/search')
      .query({ bjdCode: '11680', buildingName: 'A', page: '3', limit: '5' });
    const stats = await request(app)
      .get('/api/real-estate/apt-rent/stats')
      .query({ bjdCode: '11680', buildingName: 'A', months: '6', rentType: '월세' });

    expect(search.status).toBe(200);
    expect(stats.status).toBe(200);
    expect(searchTransactions).toHaveBeenCalledWith('apt-sale', {
      city: undefined,
      district: undefined,
      bjdCode: '11680',
      buildingName: 'A',
      dealYear: undefined,
      dealMonth: undefined,
      exclusiveArea: undefined,
      rentType: undefined,
      months: undefined,
      page: 3,
      limit: 5,
    });
    expect(getTransactionStats).toHaveBeenCalledWith('apt-rent', '11680', 'A', 6, undefined, '월세');
  });
});
