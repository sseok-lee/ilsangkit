import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const serviceMocks = vi.hoisted(() => ({
  search: vi.fn(),
  searchGrouped: vi.fn(),
  countNearby: vi.fn(),
  getByRegionAll: vi.fn(),
  getByRegion: vi.fn(),
  browseFacilities: vi.fn(),
}));

vi.mock('../../src/services/facilityService.js', () => ({
  search: serviceMocks.search,
  searchGrouped: serviceMocks.searchGrouped,
  countNearby: serviceMocks.countNearby,
  getByRegionAll: serviceMocks.getByRegionAll,
  getByRegion: serviceMocks.getByRegion,
}));

vi.mock('../../src/services/facilityBrowseService.js', () => ({
  browseFacilities: serviceMocks.browseFacilities,
}));

const { default: app } = await import('../../src/app.js');

beforeEach(() => {
  vi.clearAllMocks();
  serviceMocks.search.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
  serviceMocks.searchGrouped.mockResolvedValue({ groups: [] });
  serviceMocks.countNearby.mockResolvedValue({ toilet: 1 });
  serviceMocks.getByRegionAll.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
  serviceMocks.getByRegion.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 1 });
  serviceMocks.browseFacilities.mockResolvedValue({ mode: 'grouped', groups: [] });
});

describe('shared facility endpoints waste-bearing cache headers', () => {
  it.each([
    ['search aggregate', () => request(app).post('/api/facilities/search').send({ page: 1, limit: 10 })],
    ['search trash', () => request(app).post('/api/facilities/search').send({ category: 'trash', page: 1, limit: 10 })],
    ['grouped aggregate search', () => request(app).post('/api/facilities/search').send({ grouped: true, page: 1, limit: 10 })],
    ['browse aggregate', () => request(app).get('/api/facilities/browse').query({ city: 'seoul', district: 'gangnam' })],
    ['browse trash', () => request(app).get('/api/facilities/browse').query({ city: 'seoul', district: 'gangnam', category: 'trash' })],
    ['region all aggregate', () => request(app).get('/api/facilities/region/seoul/gangnam')],
    ['region trash category', () => request(app).get('/api/facilities/region/seoul/gangnam/trash')],
  ] as const)('sets no-store for %s requests that can include waste', async (_label, send) => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it.each([
    ['search explicit non-trash', () => request(app).post('/api/facilities/search').send({ category: 'toilet', page: 1, limit: 10 })],
    ['browse explicit non-trash', () => request(app).get('/api/facilities/browse').query({ city: 'seoul', district: 'gangnam', category: 'toilet' })],
    ['region explicit non-trash', () => request(app).get('/api/facilities/region/seoul/gangnam/toilet')],
  ] as const)('preserves cacheability for %s requests', async (_label, send) => {
    const res = await send();

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBeUndefined();
  });

  it('keeps a later non-waste public cache route public', async () => {
    const res = await request(app)
      .get('/api/facilities/nearby-counts')
      .query({ lat: 37.5, lng: 127.0, radius: 1000, categories: 'toilet' });

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=600, stale-while-revalidate=1800');
  });
});
