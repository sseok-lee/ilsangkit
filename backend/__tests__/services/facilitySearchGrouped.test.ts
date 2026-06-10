import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma mock — 모든 모델에 count/findMany를 제공
const { mockCount, mockFindMany, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindMany: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const model = { findMany: mockFindMany, count: mockCount, findUnique: vi.fn(), update: vi.fn().mockResolvedValue({}) };
  const prismaClient = {
    toilet: model, wifi: model, clothes: model, parking: model, aed: model,
    library: model, hospital: model, pharmacy: model, park: model, school: model,
    market: model, childcare: model, evCharger: model, sports: model, subway: model,
    wasteSchedule: model,
    region: { findFirst: vi.fn() },
    // ev-charger uses $queryRawUnsafe for GROUP BY statId
    $queryRawUnsafe: mockQueryRawUnsafe,
  };
  return { default: prismaClient, prisma: prismaClient };
});

// 파서 캐시가 DB(getRegionIndex)를 타지 않도록 region index를 모킹
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]),
  };
});

import { searchGrouped } from '../../src/services/facilityService.js';

beforeEach(() => {
  vi.clearAllMocks();
  // 기본: count=0, findMany=[]
  mockCount.mockResolvedValue(0);
  mockFindMany.mockResolvedValue([]);
  // ev-charger: first call = count, second call = rows
  mockQueryRawUnsafe
    .mockResolvedValueOnce([{ cnt: 0n }])
    .mockResolvedValue([]);
});

describe('searchGrouped (다중토큰)', () => {
  it('응답에 parsed 토큰과 recovery 키를 포함한다', async () => {
    const res = await searchGrouped({ keyword: '서울 화장실', grouped: true } as any);
    expect(res.parsed.cityToken).toBe('서울특별시');
    expect(res.parsed.categoryToken).toBe('toilet');
    expect(res).toHaveProperty('recovery');
  });
});

describe('searchGrouped (카테고리 스코핑)', () => {
  it('categoryToken이 있으면 해당 카테고리만 조회한다 (화장실 → count 1회)', async () => {
    mockCount.mockResolvedValue(5);
    mockFindMany.mockResolvedValue([]);
    await searchGrouped({ keyword: '화장실', grouped: true } as any);
    // toilet 1개 카테고리만 count (wasteSchedule·나머지 13개 스킵)
    expect(mockCount).toHaveBeenCalledTimes(1);
    // ev-charger raw 쿼리도 스킵
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('categoryToken이 없으면(freeText) 기존처럼 전체 카테고리를 조회한다', async () => {
    await searchGrouped({ keyword: '래미안', grouped: true } as any);
    // 13개 일반 카테고리 + wasteSchedule = 14회 count (ev-charger는 raw)
    expect(mockCount.mock.calls.length).toBeGreaterThanOrEqual(14);
  });

  it('categoryToken이 일반 카테고리면 WasteSchedule을 조회하지 않는다', async () => {
    mockCount.mockResolvedValue(5);
    await searchGrouped({ keyword: '화장실', grouped: true } as any);
    expect(mockCount).toHaveBeenCalledTimes(1); // toilet만, waste 미포함
  });
});
