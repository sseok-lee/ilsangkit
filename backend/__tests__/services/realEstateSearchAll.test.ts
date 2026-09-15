import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Prisma mock ────────────────────────────────────────────────────────────
const { mockGroupBy, mockCount, mockSummaryFindMany, mockQueryRawUnsafe } = vi.hoisted(() => ({
  mockGroupBy: vi.fn(),
  mockCount: vi.fn(),
  mockSummaryFindMany: vi.fn(),
  mockQueryRawUnsafe: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const txModel = { groupBy: mockGroupBy };
  const summaryModel = { count: mockCount, findMany: mockSummaryFindMany };
  const prismaClient = {
    aptSaleTransaction: txModel,
    aptRentTransaction: txModel,
    villaSaleTransaction: txModel,
    villaRentTransaction: txModel,
    offitelSaleTransaction: txModel,
    offitelRentTransaction: txModel,
    realEstateBuildingSummary: summaryModel,
    // searchAll이 유형별 유니크 건물수를 COUNT(DISTINCT ...) raw로 조회 — DB-free 기본값 제공
    $queryRawUnsafe: mockQueryRawUnsafe,
  };
  return { default: prismaClient, prisma: prismaClient };
});

// ─── Parser region index mock — DB 의존 제거 ────────────────────────────────
vi.mock('../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/search/searchRegionIndex.js');
  return {
    ...actual,
    getRegionIndex: async () =>
      actual.buildRegionIndex([
        { city: '서울특별시', district: '강남구' },
        { city: '부산광역시', district: '해운대구' },
      ]),
  };
});

import { searchAll } from '../../src/services/realEstateService.js';

beforeEach(() => {
  vi.clearAllMocks();
  mockGroupBy.mockResolvedValue([]);
  mockCount.mockResolvedValue(0);
  mockSummaryFindMany.mockResolvedValue([]);
  mockQueryRawUnsafe.mockImplementation((sql: string) => {
    const text = String(sql);
    if (text.includes('COUNT(DISTINCT')) return Promise.resolve([{ c: 0n }]);
    if (text.includes('COUNT(*)')) return Promise.resolve([{ total: 0n }]);
    return Promise.resolve([]);
  });
});

describe('searchAll (파서 연동)', () => {
  it('지역+이름 키워드에서 에러 없이 categories를 반환', async () => {
    const res = await searchAll('강남 래미안');
    expect(res).toHaveProperty('categories');
    expect(Array.isArray(res.categories)).toBe(true);
  });

  it('categories 배열이 6개 타입을 포함', async () => {
    const res = await searchAll('강남 래미안');
    expect(res.categories).toHaveLength(6);
    const types = res.categories.map((c) => c.type);
    expect(types).toContain('apt-sale');
    expect(types).toContain('apt-rent');
    expect(types).toContain('villa-sale');
    expect(types).toContain('offitel-sale');
  });

  it('키워드 없이 호출해도 정상 반환 (freeText·지역 없으므로 빈 배열)', async () => {
    const res = await searchAll();
    expect(res).toHaveProperty('categories');
    expect(res.categories).toEqual([]);
  });

  it('파서가 강남을 district로 파싱하여 summary where에 district 포함', async () => {
    await searchAll('강남 래미안');
    const call = mockQueryRawUnsafe.mock.calls.find((c) => String(c[0]).includes('SELECT buildingName'));
    expect(String(call?.[0] ?? '')).toContain('district = ?');
    expect(call).toContain('강남구');
  });

  it('이름 토큰이 buildingName startsWith로 전달됨', async () => {
    await searchAll('강남 래미안');
    const call = mockQueryRawUnsafe.mock.calls.find((c) => String(c[0]).includes('SELECT buildingName'));
    expect(String(call?.[0] ?? '')).toContain("buildingName LIKE CONCAT(?, '%')");
    expect(call).toContain('래미안');
  });

  it('명시적 city 파라미터가 파서보다 우선', async () => {
    // 키워드에 부산 토큰이 있어도, 명시적 city='서울특별시'가 우선해야 함
    await searchAll('부산 래미안', '서울특별시');
    const call = mockQueryRawUnsafe.mock.calls.find((c) => String(c[0]).includes('SELECT buildingName'));
    expect(String(call?.[0] ?? '')).toContain('city IN');
    expect(call).toContain('서울특별시');
    expect(call).toContain('서울');
    // 부산은 포함되어서는 안 됨
    expect(call?.some((v) => typeof v === 'string' && v.includes('부산'))).toBe(false);
  });

  it('freeText도 지역도 없으면(순수 카테고리어) DB 접근 없이 빈 categories 반환', async () => {
    // '화장실'은 파서가 categoryToken으로 흡수 → freeText 없음, 지역 없음
    const res = await searchAll('화장실');
    expect(res.categories).toEqual([]);
    expect(mockGroupBy).not.toHaveBeenCalled();
    expect(mockCount).not.toHaveBeenCalled();
  });

  it('freeText가 있으면(래미안) 검색을 실행한다', async () => {
    const res = await searchAll('래미안');
    expect(res.categories).toHaveLength(6);
  });

  it('지역만 있어도(강남구) 검색을 실행한다', async () => {
    const res = await searchAll('강남구');
    expect(res.categories).toHaveLength(6);
  });

  it('summary 테이블에서 조회하고 거래 테이블 groupBy를 호출하지 않는다', async () => {
    mockQueryRawUnsafe.mockImplementation((sql: string, type?: string) => {
      const text = String(sql);
      if (text.includes('COUNT(DISTINCT')) return Promise.resolve([{ c: 0n }]);
      if (text.includes('COUNT(*)')) return Promise.resolve([{ total: 1n }]);
      if (type === 'apt-sale') {
        return Promise.resolve([{
          buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
          dongName: '역삼동', buildYear: 2010, latestDealYear: 2026, latestDealMonth: 5,
          latestPrice: 150000n, transactionCount: 12,
        }]);
      }
      return Promise.resolve([]);
    });
    const res = await searchAll('래미안');
    expect(mockGroupBy).not.toHaveBeenCalled();
    expect(mockSummaryFindMany).not.toHaveBeenCalled();
    const aptSale = res.categories.find((c) => c.type === 'apt-sale');
    // 응답 shape 불변: dealYear/dealAmount 키 유지, BigInt → Number 직렬화
    expect(aptSale!.items[0]).toMatchObject({
      buildingName: '래미안강남', dongName: '역삼동',
      dealYear: 2026, dealMonth: 5, dealAmount: 150000, deposit: null, transactionCount: 12,
    });
  });

  it('전월세 타입은 latestPrice를 deposit으로 매핑한다', async () => {
    mockQueryRawUnsafe.mockImplementation((sql: string, type?: string) => {
      const text = String(sql);
      if (text.includes('COUNT(DISTINCT')) return Promise.resolve([{ c: 0n }]);
      if (text.includes('COUNT(*)')) return Promise.resolve([{ total: 1n }]);
      if (type === 'apt-rent') {
        return Promise.resolve([{
          buildingName: '래미안강남', bjdCode: '11680', city: '서울', district: '강남구',
          dongName: '역삼동', buildYear: 2010, latestDealYear: 2026, latestDealMonth: 5,
          latestPrice: 50000n, transactionCount: 3,
        }]);
      }
      return Promise.resolve([]);
    });
    const res = await searchAll('래미안');
    const aptRent = res.categories.find((c) => c.type === 'apt-rent');
    expect(aptRent!.items[0]).toMatchObject({ dealAmount: null, deposit: 50000 });
  });

  it('latest 필드가 null이어도 응답 shape를 유지한다', async () => {
    mockQueryRawUnsafe.mockImplementation((sql: string, type?: string) => {
      const text = String(sql);
      if (text.includes('COUNT(DISTINCT')) return Promise.resolve([{ c: 0n }]);
      if (text.includes('COUNT(*)')) return Promise.resolve([{ total: 1n }]);
      if (type === 'apt-sale') {
        return Promise.resolve([{
          buildingName: '신축단지', bjdCode: '11680', city: '서울', district: '강남구',
          dongName: '역삼동', buildYear: null, latestDealYear: null, latestDealMonth: null,
          latestPrice: null, transactionCount: 0,
        }]);
      }
      return Promise.resolve([]);
    });
    const res = await searchAll('신축단지');
    const aptSale = res.categories.find((c) => c.type === 'apt-sale');
    expect(aptSale!.items[0]).toMatchObject({ dealYear: null, dealMonth: null, dealAmount: null, deposit: null });
  });

  it('유형별 유니크 건물수를 apt/villa/offitel 순서로 buildingCounts에 매핑한다', async () => {
    mockQueryRawUnsafe.mockImplementation((sql: string, ...params: unknown[]) => {
      const text = String(sql);
      if (text.includes('COUNT(DISTINCT') && params.includes('apt-sale')) return Promise.resolve([{ c: 6n }]);
      if (text.includes('COUNT(DISTINCT') && params.includes('villa-sale')) return Promise.resolve([{ c: 2n }]);
      if (text.includes('COUNT(DISTINCT')) return Promise.resolve([{ c: 0n }]);
      if (text.includes('COUNT(*)')) return Promise.resolve([{ total: 0n }]);
      return Promise.resolve([]);
    });
    const res = await searchAll('래미안');
    expect(res.buildingCounts).toEqual({ apt: 6, villa: 2, offitel: 0 });
    const distinctCallCount = mockQueryRawUnsafe.mock.calls.filter((c) =>
      String(c[0]).includes('COUNT(DISTINCT')
    ).length;
    expect(distinctCallCount).toBe(3);
  });

  it('유니크 건물수는 groupBy/distinct(앱메모리)가 아닌 COUNT(DISTINCT) raw SQL로 집계한다 (OOM 방지)', async () => {
    await searchAll('강남 래미안');
    // 거래/summary groupBy를 쓰지 않는다
    expect(mockGroupBy).not.toHaveBeenCalled();
    const distinctCall = mockQueryRawUnsafe.mock.calls.find((c) => String(c[0]).includes('COUNT(DISTINCT'));
    const sql = distinctCall![0] as string;
    expect(sql).toContain('COUNT(DISTINCT buildingName, bjdCode)');
    expect(sql).toContain('FROM RealEstateBuildingSummary');
    expect(sql).toContain('buildingName NOT REGEXP');
    // type IN (?, ?) — apt 묶음 두 타입이 파라미터로 바인딩된다
    expect(sql).toContain('type IN (?, ?)');
    const aptParams = distinctCall!.slice(1);
    expect(aptParams).toContain('apt-sale');
    expect(aptParams).toContain('apt-rent');
    // 이름 토큰(래미안)이 LIKE 바인딩으로 전달
    expect(aptParams).toContain('래미안');
  });

  it('미리보기 행도 더보기와 같은 유효 단지명 필터와 최신 거래 정렬을 쓴다', async () => {
    await searchAll('잠실');
    const previewCall = mockQueryRawUnsafe.mock.calls.find((c) => String(c[0]).includes('SELECT buildingName'));
    const sql = String(previewCall?.[0] ?? '');
    expect(sql).toContain('buildingName NOT REGEXP');
    expect(sql).toContain('ORDER BY latestDealYear DESC, latestDealMonth DESC, transactionCount DESC, buildingName ASC');
  });

  it('freeText/지역이 없으면 buildingCounts는 0이고 raw SQL을 호출하지 않는다', async () => {
    const res = await searchAll('화장실');
    expect(res.buildingCounts).toEqual({ apt: 0, villa: 0, offitel: 0 });
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });
});
