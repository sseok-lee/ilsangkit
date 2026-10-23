import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockQueryRaw,
  mockGetBuildingInfo,
  mockGetCanonicalPath,
  mockIsPreservedMode,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockGetBuildingInfo: vi.fn(),
  mockGetCanonicalPath: vi.fn(),
  mockIsPreservedMode: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $queryRaw: mockQueryRaw,
  };
  return { prisma, default: prisma };
});

vi.mock('../../src/services/realEstateService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/realEstateService.js')>();
  return {
    ...actual,
    getBuildingInfo: mockGetBuildingInfo,
  };
});
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  getRealEstateCanonicalPath: mockGetCanonicalPath,
  isPreservedRealEstateUrlMode: mockIsPreservedMode,
}));

import { getDetailOverview } from '../../src/services/realEstateDetailService.js';

function sqlText(query: unknown): string {
  const sql = query as Prisma.Sql;
  return sql.strings.join('?');
}

beforeEach(() => {
  mockQueryRaw.mockReset();
  // 대표 시세용 매매·전세 로드(6·7번째 쿼리)는 별도 지정이 없으면 빈 결과
  mockQueryRaw.mockResolvedValue([]);
  mockGetBuildingInfo.mockReset();
  mockGetCanonicalPath.mockReset();
  mockGetCanonicalPath.mockResolvedValue(null);
  mockIsPreservedMode.mockReset();
  mockIsPreservedMode.mockReturnValue(false);
  mockGetBuildingInfo.mockResolvedValue({
    bjdCode: '11680',
    buildingName: 'A',
    buildYear: 2010,
    minArea: 59.9,
    maxArea: 114.8,
  });
});

const OCT_SALE: Array<[number, string, number, number]> = [
  [1, '2026-10-19', 91000, 20],
  [2, '2026-10-18', 88000, 5],
  [3, '2026-10-17', 94000, 8],
  [4, '2026-10-17', 95000, 9],
  [5, '2026-10-14', 53000, 12],
  [6, '2026-10-14', 97000, 20],
  [7, '2026-10-12', 100000, 17],
  [8, '2026-10-04', 91000, 8],
  [9, '2026-10-02', 103000, 15],
  [10, '2026-09-22', 92500, 10],
  [11, '2026-09-10', 90000, 7],
];

const rawBasis = (id: number, date: string, amount: number, area: string, floor: number | null = 5, direct = 0n) => ({
  id, date, amount: BigInt(amount), area, floor, direct,
});

const NOW = new Date('2026-10-23T03:00:00Z');

function mockOverviewBase(): void {
  mockQueryRaw
    .mockResolvedValueOnce([])
    .mockResolvedValueOnce([{ count: 0n }])
    .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
    .mockResolvedValueOnce([{ dongName: '역삼동', jibun: '1', roadName: null }])
    .mockResolvedValueOnce([]);
}

describe('getDetailOverview price basis', () => {
  it('adds area groups and sale basis on sale URL', async () => {
    mockOverviewBase();
    mockQueryRaw
      .mockResolvedValueOnce(OCT_SALE.map(([id, date, amount, floor]) => rawBasis(id, date, amount, '84.97', floor)))
      .mockResolvedValueOnce([rawBasis(50, '2026-10-01', 40000, '59.89')]);

    const overview = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, NOW);

    expect(overview?.basisMode).toBe('sale');
    expect(overview?.defaultAreaGroup).toBe('85');
    expect(overview?.areaGroups.map((g) => g.key)).toEqual(['60', '85']);
    expect(overview?.saleBasis['85'].representative).toBe(94000);
    expect(overview?.saleBasis['85'].sampleCount).toBe(5);
    expect(overview?.saleBasis['85'].latestAny).toMatchObject({ id: 1, direct: false });
    expect(overview?.saleBasis['85'].excluded).toEqual([]);
    expect(Object.keys(overview?.jeonseBasis ?? {})).toEqual(['60']);
    expect(overview?.latestSale).toBeNull();
  });

  it('sale basis includes direct deals and low-priced deals', async () => {
    mockOverviewBase();
    mockQueryRaw
      .mockResolvedValueOnce([
        rawBasis(1, '2026-10-19', 52000, '84.97', 3, 1n),
        rawBasis(2, '2026-10-18', 91000, '84.97'),
        rawBasis(3, '2026-10-17', 45000, '84.97'),
        rawBasis(4, '2026-10-16', 93000, '84.97'),
        rawBasis(5, '2026-10-15', 94000, '84.97'),
        rawBasis(6, '2026-10-14', 95000, '84.97'),
      ])
      .mockResolvedValueOnce([]);

    const overview = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, NOW);

    // 최신 5건: 52000(직거래), 91000, 45000, 93000, 94000 → 중간값 91000
    expect(overview?.saleBasis['85'].representative).toBe(91000);
    expect(overview?.saleBasis['85'].latestAny).toMatchObject({ id: 1, amount: 52000, direct: true });
  });

  it('rent URL prefers jeonse', async () => {
    mockOverviewBase();
    mockQueryRaw
      .mockResolvedValueOnce([
        rawBasis(1, '2026-10-01', 90000, '84.97'),
        rawBasis(2, '2026-09-01', 91000, '84.97'),
      ])
      .mockResolvedValueOnce([
        rawBasis(10, '2026-10-05', 40000, '59.89'),
        rawBasis(11, '2026-09-05', 41000, '59.89'),
        rawBasis(12, '2026-08-05', 42000, '59.89'),
        rawBasis(13, '2026-08-01', 60000, '84.97'),
      ]);

    const overview = await getDetailOverview('apt-rent', { bjdCode: '11680', buildingName: 'A' }, NOW);

    expect(overview?.basisMode).toBe('jeonse');
    expect(overview?.defaultAreaGroup).toBe('60');
    expect(overview?.jeonseBasis['60'].representative).toBe(41000);
    expect(overview?.jeonseBasis['60'].sampleCount).toBe(3);
    expect(sqlText(mockQueryRaw.mock.calls[5][0])).toContain('FROM AptSaleTransaction t');
    expect(sqlText(mockQueryRaw.mock.calls[6][0])).toContain('FROM AptRentTransaction t');
    expect((mockQueryRaw.mock.calls[6][0] as Prisma.Sql).values).toContain('전세');
  });

  it('sale URL with no sale deals', async () => {
    mockOverviewBase();
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        rawBasis(10, '2026-10-05', 40000, '59.89'),
        rawBasis(11, '2026-09-05', 41000, '59.89'),
      ]);

    const overview = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, NOW);

    expect(overview?.basisMode).toBe('sale');
    expect(overview?.areaGroups).toHaveLength(1);
    expect(overview?.defaultAreaGroup).toBe('60');
    expect(overview?.saleBasis).toEqual({});
    expect(overview?.jeonseBasis['60'].representative).toBeNull();
    expect(overview?.jeonseBasis['60'].latestAny?.id).toBe(10);
  });

  it('building without any deals has no area groups', async () => {
    mockOverviewBase();

    const overview = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, NOW);

    expect(overview?.areaGroups).toEqual([]);
    expect(overview?.defaultAreaGroup).toBeNull();
    expect(overview?.saleBasis).toEqual({});
    expect(overview?.jeonseBasis).toEqual({});
  });

  it('basis loader keeps address scope', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2', roadName: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getDetailOverview('villa-sale', { bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: 'a'.repeat(64) }, NOW);

    expect(mockQueryRaw).toHaveBeenCalledTimes(8);
    for (const index of [6, 7]) {
      const sql = mockQueryRaw.mock.calls[index][0] as Prisma.Sql;
      expect(sqlText(sql)).toContain('t.dongName');
      expect(sqlText(sql)).toContain('t.jibun');
      expect(sql.values).toContain('대치동');
      expect(sql.values).toContain('934-2');
    }
    expect(sqlText(mockQueryRaw.mock.calls[6][0])).toContain('FROM VillaSaleTransaction t');
    expect(sqlText(mockQueryRaw.mock.calls[7][0])).toContain('FROM VillaRentTransaction t');
  });

  it('basis loader excludes cancellations', async () => {
    mockOverviewBase();

    await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, NOW);

    const saleSql = sqlText(mockQueryRaw.mock.calls[5][0]);
    expect(saleSql).toContain('cancelDealDay');
    expect(saleSql).toContain('cancelDealType');
    expect(saleSql).toContain('직거래');
    expect(saleSql).toContain('dealAmount');
    // 기준일 이전 42개월(36개월 + 6개월)부터
    expect((mockQueryRaw.mock.calls[5][0] as Prisma.Sql).values).toContain('2023-04-23');
    const jeonseSql = sqlText(mockQueryRaw.mock.calls[6][0]);
    expect(jeonseSql).toContain('t.deposit');
    expect(jeonseSql).not.toContain('직거래');
  });
});

describe('getDetailOverview', () => {
  it('uses sale table independently even when current type is rent', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 9, dealAmount: 81000n, dealYear: 2026, dealMonth: 9, dealDay: null, exclusiveArea: new Prisma.Decimal('84.90'), floor: 12 }])
      .mockResolvedValueOnce([{ count: 3n }])
      .mockResolvedValueOnce([{ minArea: new Prisma.Decimal('59.90'), maxArea: new Prisma.Decimal('114.80') }])
      .mockResolvedValueOnce([{ dongName: '역삼동', jibun: '1', roadName: '테헤란로' }])
      .mockResolvedValueOnce([{ lat: new Prisma.Decimal('37.5000000'), lng: new Prisma.Decimal('127.0000000') }]);

    const overview = await getDetailOverview('apt-rent', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    expect(mockGetBuildingInfo).toHaveBeenCalledWith('apt-rent', '11680', 'A');
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('FROM AptSaleTransaction t');
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('cancelDealType');
    expect(overview?.latestSale).toEqual({
      id: 9,
      amount: 81000,
      year: 2026,
      month: 9,
      day: null,
      area: '84.90',
      floor: 12,
    });
    expect(overview?.saleCount6m).toBe(3);
  });

  it('returns overview with latestSale null when the building only has rent rows', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: new Prisma.Decimal('84.90'), maxArea: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ dongName: '역삼동', jibun: '1', roadName: null }])
      .mockResolvedValueOnce([]);

    const overview = await getDetailOverview('apt-rent', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    expect(overview?.latestSale).toBeNull();
    expect(overview?.minArea).toBe('84.90');
    expect(overview?.maxArea).toBe('84.90');
  });

  it('sorts null latest sale day after known days in the same month and excludes invalid/future calendar dates', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    const sql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(sql).toContain('dealDay IS NULL ASC');
    expect(sql).toContain('dealDay DESC');
    expect(sql).toContain('DAY(LAST_DAY');
    expect(sql).toContain('STR_TO_DATE');
    expect(sql).toContain('<= ?');
  });

  it('marks location ambiguous when one property has multiple addresses', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([
        { dongName: '역삼동', jibun: '1', roadName: 'A로' },
        { dongName: '역삼동', jibun: '2', roadName: 'B로' },
      ])
      .mockResolvedValueOnce([{ lat: new Prisma.Decimal('37.5000000'), lng: new Prisma.Decimal('127.0000000') }]);

    const overview = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    expect(overview?.addresses).toHaveLength(2);
    expect(overview?.locationAmbiguous).toBe(true);
    expect(overview?.location).toBeNull();
  });

  it('merges road-name variants of the same parcel and restores coordinates', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([
        { dongName: '도곡동', jibun: '527', roadName: null },
        { dongName: '도곡동', jibun: '527', roadName: '선릉로 221' },
      ])
      .mockResolvedValueOnce([{ lat: 37.5, lng: 127.0 }]);
    const result = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: '도곡렉슬' });
    expect(result?.addresses).toEqual([{ dongName: '도곡동', jibun: '527', roadName: '선릉로 221' }]);
    expect(result?.locationAmbiguous).toBe(false);
    expect(result?.location).toEqual({ lat: 37.5, lng: 127 });
  });

  it('filters all overview sources to the address resolved by buildingKey', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2', roadName: null }])
      .mockResolvedValueOnce([]);
    const key = 'a'.repeat(64);
    await getDetailOverview('villa-sale', { bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: key });
    expect(mockGetBuildingInfo).toHaveBeenCalledWith('villa-sale', '11680', '스톤빌리지', key);
    for (const [query] of mockQueryRaw.mock.calls.slice(1)) {
      const sql = query as Prisma.Sql;
      expect(sql.values).toContain('대치동');
      expect(sql.values).toContain('934-2');
    }
  });

  it('keyed mode skips canonical registry lookup for buildingKey detail pages', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2', roadName: null }])
      .mockResolvedValueOnce([]);

    await getDetailOverview('villa-sale', {
      bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: 'a'.repeat(64),
    });

    expect(mockIsPreservedMode).toHaveBeenCalled();
    expect(mockGetCanonicalPath).not.toHaveBeenCalled();
  });

  it('preserved mode resolves and returns the registered canonicalPath', async () => {
    const key = 'c'.repeat(64);
    mockIsPreservedMode.mockReturnValue(true);
    mockGetCanonicalPath.mockResolvedValue('/real-estate/villa-sale/seoul/gangnam/%EC%8A%A4%ED%86%A4%EB%B9%8C%EB%A6%AC%EC%A7%80');
    mockQueryRaw
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2', roadName: null }])
      .mockResolvedValueOnce([]);

    const overview = await getDetailOverview('villa-sale', {
      bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: key,
    });

    expect(mockGetCanonicalPath).toHaveBeenCalledWith('villa-sale', key);
    expect(overview?.identity.canonicalPath).toBe('/real-estate/villa-sale/seoul/gangnam/%EC%8A%A4%ED%86%A4%EB%B9%8C%EB%A6%AC%EC%A7%80');
  });

  it('rejects an unknown key instead of querying other same-name addresses', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(getDetailOverview('villa-sale', {
      bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: 'b'.repeat(64),
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns null when getBuildingInfo fallback cannot find the building', async () => {
    mockGetBuildingInfo.mockResolvedValue(null);

    await expect(getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' })).resolves.toBeNull();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
