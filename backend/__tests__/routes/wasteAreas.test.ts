import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { AppError } from '../../src/lib/errors.js';

const areaServiceMock = vi.hoisted(() => ({
  getWasteArea: vi.fn(),
  hasPublishedWasteAreaDetailHistory: vi.fn(),
  listWasteAreas: vi.fn(),
}));

vi.mock('../../src/services/wasteAreaService.js', () => areaServiceMock);

const { default: app } = await import('../../src/app.js');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /api/waste-areas', () => {
  it('sets no-store on list success responses', async () => {
    areaServiceMock.listWasteAreas.mockResolvedValue({
      generationId: 'g1',
      items: [],
      total: 0,
      page: 1,
      totalPages: 1,
      unresolved: { count: 0, href: null },
    });

    const res = await request(app).get('/api/waste-areas?city=서울특별시&district=강남구');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('rejects district-only requests with waste-specific 400 without calling service', async () => {
    const res = await request(app).get('/api/waste-areas?district=강남구');

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_WASTE_AREA_QUERY');
    expect(areaServiceMock.listWasteAreas).not.toHaveBeenCalled();
  });

  it('returns service-unavailable errors with no-store when the backend flag is disabled', async () => {
    areaServiceMock.listWasteAreas.mockRejectedValue(
      new AppError(503, 'disabled', 'WASTE_AREA_DISABLED')
    );

    const res = await request(app).get('/api/waste-areas');

    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error.code).toBe('WASTE_AREA_DISABLED');
  });

  it('maps unexpected area service read failures to 503 with no-store', async () => {
    areaServiceMock.listWasteAreas.mockRejectedValue(new Error('database unavailable'));

    const res = await request(app).get('/api/waste-areas');

    expect(res.status).toBe(503);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.error.code).toBe('WASTE_AREA_UNAVAILABLE');
  });
});

describe('GET /api/waste-areas/:areaId', () => {
  it('sets no-store on detail success responses', async () => {
    areaServiceMock.getWasteArea.mockResolvedValue({
      generationId: 'g1',
      area: { areaId: 123, name: '역삼1동', city: '서울특별시', district: '강남구', href: '/trash/areas/123' },
      schedules: [],
      unresolved: { count: 0, href: null },
      indexEligible: false,
      indexReason: 'no-practical-content',
      contentUpdatedAt: '2026-09-28T00:00:00.000Z',
      predecessorOrSuccessorLinks: [],
    });

    const res = await request(app).get('/api/waste-areas/123');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
  });

  it('uses the W5 400 contract for malformed waste ids', async () => {
    const res = await request(app).get('/api/waste-areas/not-a-number');

    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_WASTE_ID',
      message: '잘못된 쓰레기 정보 ID입니다',
    });
  });

  it('returns 404 for areas without published public detail history', async () => {
    areaServiceMock.getWasteArea.mockResolvedValue(null);
    areaServiceMock.hasPublishedWasteAreaDetailHistory.mockResolvedValue(false);

    const res = await request(app).get('/api/waste-areas/123');

    expect(res.status).toBe(404);
  });

  it('returns 410 for historical public detail areas that are no longer active', async () => {
    areaServiceMock.getWasteArea.mockResolvedValue(null);
    areaServiceMock.hasPublishedWasteAreaDetailHistory.mockResolvedValue(true);

    const res = await request(app).get('/api/waste-areas/123');

    expect(res.status).toBe(410);
  });
});
