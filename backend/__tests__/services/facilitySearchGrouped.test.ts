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
