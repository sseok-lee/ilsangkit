import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindMany } = vi.hoisted(() => ({ mockFindMany: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { findMany: mockFindMany, count: vi.fn(), findUnique: vi.fn(), update: vi.fn() };
  const prismaClient = {
    toilet: model, wifi: model, clothes: model, parking: model, aed: model,
    library: model, hospital: model, pharmacy: model, park: model, school: model,
    market: model, childcare: model, evCharger: model, sports: model,
    subwayStation: model, wasteSchedule: model,
    region: { findFirst: vi.fn() },
    $queryRawUnsafe: vi.fn(), $executeRawUnsafe: vi.fn(),
  };
  return { default: prismaClient, prisma: prismaClient };
});

import { countNearby } from '../../src/services/facilityService.js';
import { NEARBY_SUMMARY } from '../../src/constants/index.js';

// 중심 (37.5, 127.0), 반경 1000m 기준 바운딩박스:
//   latDelta = 1/111            ≈ 0.009009
//   lngDelta = 1/(111*cos37.5°) ≈ 0.011356
const CENTER = { lat: 37.5, lng: 127.0 };

/** 바운딩박스 안이면서 원 밖 — 박스 모서리(대각 ≈1.41km) */
const CORNER_INSIDE_BOX_OUTSIDE_CIRCLE = { lat: 37.509009, lng: 127.011356 };
/** 정동쪽 약 704m — 원 안 */
const INSIDE_CIRCLE = { lat: 37.5, lng: 127.008 };

beforeEach(() => {
  mockFindMany.mockReset();
});

describe('countNearby', () => {
  it('바운딩박스에 걸렸어도 반경 밖이면 세지 않는다', async () => {
    // 이 테스트가 이 함수의 존재 이유다. 박스만으로 세면 원보다 4/π(≈27%) 넓게 잡힌다.
    mockFindMany.mockResolvedValue([INSIDE_CIRCLE, CORNER_INSIDE_BOX_OUTSIDE_CIRCLE]);

    const result = await countNearby({ ...CENTER, radius: 1000, categories: ['hospital'] });

    expect(result.hospital).toEqual({ count: 1, exact: true });
  });

  it('요청한 카테고리만 조회하고 카테고리별로 개수를 돌려준다', async () => {
    mockFindMany
      .mockResolvedValueOnce([INSIDE_CIRCLE, INSIDE_CIRCLE, INSIDE_CIRCLE])
      .mockResolvedValueOnce([INSIDE_CIRCLE]);

    const result = await countNearby({
      ...CENTER, radius: 1000, categories: ['hospital', 'pharmacy'],
    });

    expect(result).toEqual({
      hospital: { count: 3, exact: true },
      pharmacy: { count: 1, exact: true },
    });
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });

  it('lat/lng 두 컬럼만 select 한다 — 목록 생성 비용을 치르지 않는다', async () => {
    mockFindMany.mockResolvedValue([]);

    await countNearby({ ...CENTER, radius: 300, categories: ['school'] });

    const arg = mockFindMany.mock.calls[0][0];
    expect(arg.select).toEqual({ lat: true, lng: true });
    expect(arg.take).toBe(NEARBY_SUMMARY.SCAN_CAP);
    // 바운딩박스 사전 필터가 걸려 있어야 인덱스를 탄다
    expect(arg.where.lat.gte).toBeCloseTo(37.5 - 300 / 1000 / 111, 6);
    expect(arg.where.lng.lte).toBeGreaterThan(127.0);
  });

  it('스캔 상한에 걸리면 exact=false 로 하한값임을 알린다', async () => {
    mockFindMany.mockResolvedValue(
      Array.from({ length: NEARBY_SUMMARY.SCAN_CAP }, () => INSIDE_CIRCLE),
    );

    const result = await countNearby({ ...CENTER, radius: 2000, categories: ['hospital'] });

    expect(result.hospital.exact).toBe(false);
    expect(result.hospital.count).toBe(NEARBY_SUMMARY.SCAN_CAP);
  });

  it('Prisma Decimal 로 온 좌표도 정확히 센다', async () => {
    // 스키마상 lat/lng 는 Decimal? 이라 Prisma 는 number 가 아닌 Decimal 객체를 준다.
    // Number() 변환이 빠지면 산술이 조용히 어긋난다.
    const asDecimal = (v: number) => ({ valueOf: () => String(v), toString: () => String(v) });
    mockFindMany.mockResolvedValue([
      { lat: asDecimal(INSIDE_CIRCLE.lat), lng: asDecimal(INSIDE_CIRCLE.lng) },
      {
        lat: asDecimal(CORNER_INSIDE_BOX_OUTSIDE_CIRCLE.lat),
        lng: asDecimal(CORNER_INSIDE_BOX_OUTSIDE_CIRCLE.lng),
      },
    ]);

    const result = await countNearby({ ...CENTER, radius: 1000, categories: ['hospital'] });

    expect(result.hospital).toEqual({ count: 1, exact: true });
  });

  it('좌표가 NULL 인 행은 건너뛴다', async () => {
    mockFindMany.mockResolvedValue([INSIDE_CIRCLE, { lat: null, lng: null }]);

    const result = await countNearby({ ...CENTER, radius: 1000, categories: ['hospital'] });

    expect(result.hospital).toEqual({ count: 1, exact: true });
  });

  it('반경 내 시설이 없으면 0 을 돌려준다 (키 자체는 존재)', async () => {
    mockFindMany.mockResolvedValue([]);

    const result = await countNearby({ ...CENTER, radius: 300, categories: ['sports'] });

    expect(result.sports).toEqual({ count: 0, exact: true });
  });
});
