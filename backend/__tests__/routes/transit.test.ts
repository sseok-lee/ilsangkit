import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockFindMany, mockBusFindMany } = vi.hoisted(() => ({
  mockFindMany: vi.fn(),
  mockBusFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    subwayStation: {
      findMany: mockFindMany,
    },
    busStop: {
      findMany: mockBusFindMany,
    },
  };
  return {
    default: prismaClient,
    prisma: prismaClient,
  };
});

import app from '../../src/app';

const SEED_STATIONS = [
  // 강남 (37.4979, 127.0276) — 좌표가 (37.4979, 127.0276)에서 0m
  { id: 'subway-1', name: '강남', nameSlug: 'gangnam', line: '2호선', lat: 37.4979, lng: 127.0276 },
  // 신논현 — 강남에서 약 800m
  { id: 'subway-2', name: '신논현', nameSlug: 'sinnonhyeon', line: '신분당선', lat: 37.5048, lng: 127.0246 },
  // 사당 — 강남에서 약 4.7km (1km 반경 밖)
  { id: 'subway-3', name: '사당', nameSlug: 'sadang', line: '2호선', lat: 37.4767, lng: 126.9818 },
];

describe('GET /api/transit/nearby (DB-backed)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // findMany는 BBox 안 후보를 반환 — Haversine 필터는 서비스에서 적용
    mockFindMany.mockResolvedValue(SEED_STATIONS);
  });

  it('1km 반경 검색이 강남·신논현을 반환하고 사당을 제외한다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276, radius: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const names = res.body.data.stations.map((s: { name: string }) => s.name);
    expect(names).toContain('강남');
    expect(names).toContain('신논현');
    expect(names).not.toContain('사당');
  });

  it('응답에 type: subway 디스크리미네이터를 포함한다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276, radius: 1000 });

    expect(res.body.data.stations[0].type).toBe('subway');
  });

  it('가장 가까운 역이 첫 번째에 정렬된다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276, radius: 1000 });

    expect(res.body.data.stations[0].name).toBe('강남');
    expect(res.body.data.stations[0].distance).toBeLessThanOrEqual(50);
  });

  it('lat 누락 시 422를 반환한다', async () => {
    const res = await request(app).get('/api/transit/nearby').query({ lng: 127.0276 });
    expect(res.status).toBe(422);
  });

  it('lng 누락 시 422를 반환한다', async () => {
    const res = await request(app).get('/api/transit/nearby').query({ lat: 37.4979 });
    expect(res.status).toBe(422);
  });

  it('한국 좌표 범위 밖이면 422를 반환한다', async () => {
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 0, lng: 127.0 });
    expect(res.status).toBe(422);
  });

  it('Kakao API 의존성을 호출하지 않는다 (외부 fetch 없음)', async () => {
    // findMany가 호출되었는지 확인 — DB 기반임을 검증
    await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276, radius: 1000 });

    expect(mockFindMany).toHaveBeenCalledTimes(1);
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where).toHaveProperty('lat');
    expect(args.where).toHaveProperty('lng');
  });

  it('빈 결과는 빈 배열을 반환한다', async () => {
    mockFindMany.mockResolvedValueOnce([]);
    const res = await request(app)
      .get('/api/transit/nearby')
      .query({ lat: 37.4979, lng: 127.0276, radius: 1000 });

    expect(res.status).toBe(200);
    expect(res.body.data.stations).toEqual([]);
  });

  describe('busRadius', () => {
    beforeEach(() => {
      mockBusFindMany.mockResolvedValue([
        { nodeId: 'b1', name: '강남역', lat: 37.498, lng: 127.0276, collectedAt: '2025-10-31' },
        { nodeId: 'b2', name: '강남역', lat: 37.4985, lng: 127.0276, collectedAt: '2025-10-31' },
      ]);
    });

    it('busRadius 가 있으면 busStops·busStopCount·busCollectedAt 을 더한다', async () => {
      const res = await request(app)
        .get('/api/transit/nearby')
        .query({ lat: 37.4979, lng: 127.0276, radius: 1000, busRadius: 1000 });
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data.busStops)).toBe(true);
      expect(res.body.data.busStops).toHaveLength(1);
      expect(res.body.data.busStopCount).toBe(1);
      expect(res.body.data.busCollectedAt).toBe('2025-10-31');
    });

    it('버스 조회가 실패해도 지하철은 200 으로 내려주고 버스는 빈 값이다', async () => {
      mockBusFindMany.mockRejectedValue(new Error('bus db down'));
      const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = await request(app)
        .get('/api/transit/nearby')
        .query({ lat: 37.4979, lng: 127.0276, radius: 1000, busRadius: 1000 });
      errSpy.mockRestore();
      expect(res.status).toBe(200);
      expect(res.body.data.stations.length).toBeGreaterThan(0);
      expect(res.body.data.busStops).toEqual([]);
      expect(res.body.data.busStopCount).toBe(0);
      expect(res.body.data.busCollectedAt).toBeNull();
    });

    it('busRadius 가 없으면 stations 만 있고 busStop 을 조회하지 않는다', async () => {
      const res = await request(app)
        .get('/api/transit/nearby')
        .query({ lat: 37.4979, lng: 127.0276, radius: 1000 });
      expect(Object.keys(res.body.data)).toEqual(['stations']);
      expect(mockBusFindMany).not.toHaveBeenCalled();
    });

    it('busRadius 가 2000 을 넘으면 422', async () => {
      const res = await request(app)
        .get('/api/transit/nearby')
        .query({ lat: 37.4979, lng: 127.0276, busRadius: 3000 });
      expect(res.status).toBe(422);
    });
  });
});
