import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const wasteScheduleServiceMock = vi.hoisted(() => ({
  getByRegion: vi.fn(),
  getRegions: vi.fn(),
  getCities: vi.fn(),
  getDistricts: vi.fn(),
  getById: vi.fn(),
}));

vi.mock('../../src/services/wasteScheduleService.js', () => wasteScheduleServiceMock);

const { ServiceUnavailableError } = await import('../../src/lib/errors.js');
const { default: app } = await import('../../src/app.js');

beforeEach(() => {
  vi.clearAllMocks();
});


describe('GET /api/waste-schedules success cache headers', () => {
  it.each([
    ['list', '/api/waste-schedules?city=서울', 'getByRegion', { schedules: [], total: 0, page: 1, totalPages: 1 }],
    ['regions', '/api/waste-schedules/regions', 'getRegions', { items: [], total: 0, page: 1, totalPages: 1 }],
    ['cities', '/api/waste-schedules/cities', 'getCities', []],
    ['districts', '/api/waste-schedules/districts/서울', 'getDistricts', []],
    ['detail', '/api/waste-schedules/1', 'getById', { id: 1, city: '서울', district: '강남구', targetRegion: '역삼1동' }],
  ] as const)('sets no-store on %s success responses', async (_label, path, mockName, value) => {
    wasteScheduleServiceMock[mockName].mockResolvedValue(value);

    const res = await request(app).get(path);

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });
});

describe('GET /api/waste-schedules source errors', () => {
  it('sets no-store when preserving service-wrapped publication 503 errors', async () => {
    wasteScheduleServiceMock.getByRegion.mockRejectedValue(
      new ServiceUnavailableError('쓰레기 배출 정보 발행 상태를 조회할 수 없습니다', 'WASTE_PUBLICATION_UNAVAILABLE')
    );

    const res = await request(app).get('/api/waste-schedules?city=서울');

    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error.code).toBe('WASTE_PUBLICATION_UNAVAILABLE');
  });

  it('maps unexpected source read failures to 503 with no-store', async () => {
    wasteScheduleServiceMock.getByRegion.mockRejectedValue(new Error('database unavailable'));

    const res = await request(app).get('/api/waste-schedules?city=서울');

    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error.code).toBe('WASTE_SOURCE_UNAVAILABLE');
  });
});
