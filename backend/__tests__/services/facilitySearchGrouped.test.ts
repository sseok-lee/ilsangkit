import { describe, it, expect, vi, beforeEach } from 'vitest';

// Prisma mock — 모든 모델에 count/findMany를 제공
const { mockCount, mockFindMany, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockFindMany: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

const { mockFtIds, mockFtCount } = vi.hoisted(() => ({
  mockFtIds: vi.fn(), mockFtCount: vi.fn(),
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

vi.mock('../../src/services/search/fulltextKeyword.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/fulltextKeyword.js');
  return { ...actual, fulltextIds: mockFtIds, fulltextCount: mockFtCount };
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
  // fulltext 헬퍼 기본값
  mockFtIds.mockResolvedValue([]);
  mockFtCount.mockResolvedValue(0);
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

  it('categoryToken이 없으면(freeText) 전체 카테고리를 조회한다 (fulltext 또는 LIKE)', async () => {
    await searchGrouped({ keyword: '래미안', grouped: true } as any);
    // 2자 이상 freeText → fulltext 경로: fulltextCount가 13개 카테고리에 대해 호출됨
    // ev-charger는 raw, wasteSchedule은 별도 — 총 13회
    expect(mockFtCount.mock.calls.length + mockCount.mock.calls.length).toBeGreaterThanOrEqual(13);
  });
});

describe('searchGrouped (fulltext 경로)', () => {
  it('freeText 2자 이상이면 LIKE count 대신 fulltextCount를 사용한다', async () => {
    mockFtCount.mockResolvedValue(3);
    mockFtIds.mockResolvedValue(['1', '2', '3']);
    mockFindMany.mockResolvedValue([]);
    await searchGrouped({ keyword: '래미안', grouped: true } as any);
    expect(mockFtCount).toHaveBeenCalled();
    // findMany는 id in 형태로 호출됨
    const idInCall = mockFindMany.mock.calls.find(
      (c) => c[0]?.where?.id?.in !== undefined,
    );
    expect(idInCall).toBeTruthy();
  });

  it('1자 키워드는 기존 LIKE 경로를 유지한다', async () => {
    // '갸' — 지역/카테고리 토큰으로 소비되지 않는 1자 freeText
    await searchGrouped({ keyword: '갸', grouped: true } as any);
    expect(mockFtCount).not.toHaveBeenCalled();
  });

  it('trash 키워드 검색이 fulltext id 경로로 동작한다', async () => {
    mockFindMany.mockResolvedValue([]);
    // '서초동' — 지역/카테고리 토큰으로 소비되지 않는 freeText → trash 블록 진입
    await searchGrouped({ keyword: '서초동', grouped: true } as any);
    const matchCall = mockQueryRawUnsafe.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('MATCH(targetRegion, emissionPlace)'),
    );
    expect(matchCall).toBeTruthy();
    expect(matchCall![1]).toBe('"서초동"'); // toBooleanPhrase 구문 검색
  });

  it('1자 freeText의 trash 검색은 기존 LIKE(contains) 경로를 유지한다', async () => {
    await searchGrouped({ keyword: '갸', grouped: true } as any);
    const matchCall = mockQueryRawUnsafe.mock.calls.find(
      (c) => typeof c[0] === 'string' && (c[0] as string).includes('MATCH(targetRegion'),
    );
    expect(matchCall).toBeUndefined();
  });
});
