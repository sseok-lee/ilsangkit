import express, { type NextFunction, type Request, type Response } from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../../src/lib/errors.js';

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { regionMarketSummary: { findMany } },
}));
vi.mock('../../src/services/homeMarketService.js', () => ({ getHomeMarket: vi.fn() }));
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
  getNearbyByBjd: vi.fn(),
  regionFilterToSql: vi.fn(() => ({ clauses: [], params: [] })),
}));

import realEstateRouter from '../../src/routes/realEstate.js';
import { __resetRisingRegionsCacheForTest } from '../../src/services/risingRegionsService.js';

const app = express();
app.use('/api/real-estate', realEstateRouter);
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }
  res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: String(err) } });
});

const row = (citySlug: string, districtSlug: string, volRecent: number, volPrev: number, over = {}) => ({
  scope: 'district',
  citySlug,
  districtSlug,
  label: `${citySlug} ${districtSlug}`,
  ppMedian12m: 3000,
  volRecent,
  volPrev,
  recentFrom: '2026-08-31',
  recentTo: '2026-09-29',
  prevFrom: '2026-07-31',
  prevTo: '2026-08-30',
  computedAt: new Date('2026-10-30T00:00:00Z'),
  ...over,
});

describe('GET /api/real-estate/rising-regions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetRisingRegionsCacheForTest();
    findMany.mockResolvedValue([
      row('seoul', 'a', 30, 20),
      row('gyeonggi', 'b', 40, 20),
      row('incheon', 'c', 25, 20),
      row('busan', 'd', 60, 20),
      row('daegu', 'e', 19, 10),
      row('ulsan', 'f', 50, 50),
      row('sejong', 'g', 30, 0),
      row('daejeon', 'h', 21, 20, { ppMedian12m: null }),
    ]);
  });

  it('기본(all): 조건 미달 행을 빼고 changePct 내림차순', async () => {
    const res = await request(app).get('/api/real-estate/rising-regions');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.scope).toBe('all');
    expect(res.body.data.items.map((i: { districtSlug: string }) => i.districtSlug)).toEqual(['d', 'b', 'a', 'c', 'h']);
    expect(res.body.data.items[0]).toMatchObject({ changePct: 200, volRecent: 60, volPrev: 20 });
    expect(res.body.data.items[4].ppMedian).toBeNull();
    expect(res.body.data.window).toEqual({ from: '2026-08-31', to: '2026-09-29' });
    expect(res.body.data.prevWindow).toEqual({ from: '2026-07-31', to: '2026-08-30' });
    expect(res.body.data.computedAt).toBe('2026-10-30T00:00:00.000Z');
  });

  it('capital 은 seoul/gyeonggi/incheon 만, nonCapital 은 그 외', async () => {
    const cap = await request(app).get('/api/real-estate/rising-regions').query({ scope: 'capital' });
    expect(cap.body.data.items.map((i: { citySlug: string }) => i.citySlug).sort()).toEqual(['gyeonggi', 'incheon', 'seoul']);
    const non = await request(app).get('/api/real-estate/rising-regions').query({ scope: 'nonCapital' });
    expect(non.body.data.items.map((i: { citySlug: string }) => i.citySlug)).toEqual(['busan', 'daejeon']);
  });

  it('최대 10개', async () => {
    findMany.mockResolvedValue(Array.from({ length: 15 }, (_, i) => row('busan', `d${i}`, 30 + i, 20)));
    const res = await request(app).get('/api/real-estate/rising-regions');
    expect(res.body.data.items).toHaveLength(10);
    expect(res.body.data.items[0].districtSlug).toBe('d14');
  });

  it('테이블이 비어 있으면 200 + 빈 items + computedAt null + 오늘 기준 구간', async () => {
    findMany.mockResolvedValue([]);
    const res = await request(app).get('/api/real-estate/rising-regions');
    expect(res.status).toBe(200);
    expect(res.body.data.items).toEqual([]);
    expect(res.body.data.computedAt).toBeNull();
    expect(res.body.data.window.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(res.body.data.prevWindow.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('잘못된 scope 는 422', async () => {
    const res = await request(app).get('/api/real-estate/rising-regions').query({ scope: 'foo' });
    expect(res.status).toBe(422);
  });

  it('10분 캐시: 같은 scope 재호출은 DB 를 다시 읽지 않는다', async () => {
    await request(app).get('/api/real-estate/rising-regions');
    await request(app).get('/api/real-estate/rising-regions');
    expect(findMany).toHaveBeenCalledTimes(1);
  });
});
