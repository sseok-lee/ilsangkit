import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  getCategoryCountAndMaxDateMock,
  wasteCountMock,
  wasteLatestMock,
  subscriptionCountMock,
  subscriptionLatestMock,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  getCategoryCountAndMaxDateMock: vi.fn(),
  wasteCountMock: vi.fn(),
  wasteLatestMock: vi.fn(),
  subscriptionCountMock: vi.fn(),
  subscriptionLatestMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    wasteSchedule: {
      count: wasteCountMock,
      findFirst: wasteLatestMock,
    },
    subscription: {
      count: subscriptionCountMock,
      findFirst: subscriptionLatestMock,
    },
  },
  default: {
    $queryRaw: mockQueryRaw,
    wasteSchedule: {
      count: wasteCountMock,
      findFirst: wasteLatestMock,
    },
    subscription: {
      count: subscriptionCountMock,
      findFirst: subscriptionLatestMock,
    },
  },
}));

vi.mock('../../src/services/facilityService.js', () => ({
  getAllIds: vi.fn(),
  getRegionCategoryCombinations: vi.fn(),
  getCategoryCountAndMaxDate: getCategoryCountAndMaxDateMock,
}));
vi.mock('../../src/services/wasteScheduleService.js', () => ({
  getAllIds: vi.fn(),
}));
vi.mock('../../src/services/categoryRegistry.js', () => ({
  ALL_CATEGORIES: [],
}));

import {
  getRealEstateBuildings,
  getRealEstateCityDistrictHubs,
  getSitemapPageCounts,
  _resetSitemapCacheForTests,
} from '../../src/services/sitemapService.js';

function flattenSql(call: unknown[]): string {
  const strings = call[0] as unknown as readonly string[];
  return strings.join('?');
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetSitemapCacheForTests();
  getCategoryCountAndMaxDateMock.mockResolvedValue({
    count: 10,
    maxUpdatedAt: new Date('2026-05-01T00:00:00Z'),
  });
  wasteCountMock.mockResolvedValue(0);
  wasteLatestMock.mockResolvedValue(null);
  subscriptionCountMock.mockResolvedValue(0);
  subscriptionLatestMock.mockResolvedValue(null);
  mockQueryRaw.mockResolvedValue([{ cnt: 0n }]);
});

describe('getSitemapPageCounts facility policy', () => {
  it('includes AED with the crawl-budget limit and keeps wifi out of indexed facility chunks', async () => {
    const result = await getSitemapPageCounts();
    const categories = result.facilities.map((item) => item.category);

    expect(categories).toContain('aed');
    expect(categories).not.toContain('wifi');
    expect(getCategoryCountAndMaxDateMock).toHaveBeenCalledWith('aed', 15000);
  });
});

describe('getRealEstateBuildings (US-008 new URL contract)', () => {
  it('emits 6 realEstateType branches (apt|villa|offitel × sale|rent)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    for (const t of [
      'apt-sale',
      'apt-rent',
      'villa-sale',
      'villa-rent',
      'offitel-sale',
      'offitel-rent',
    ]) {
      expect(sql).toContain(`'${t}'`);
    }
    // 6-way union produces 5 UNION ALL between them
    const unionCount = sql.match(/UNION ALL/g)?.length ?? 0;
    expect(unionCount).toBeGreaterThanOrEqual(5);
  });

  it('groups by (city, district, buildingName, bjdCode) — fields required by new URL', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const groupByMatches = sql.match(
      /GROUP BY\s+city,\s*district,\s*buildingName,\s*bjdCode/g,
    );
    expect(groupByMatches?.length).toBe(6);
  });

  it('거래 건수 임계값 없음 — HAVING COUNT 필터 제거됨 (noindex 정책과 일치)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).not.toMatch(/HAVING\s+COUNT\(\*\)\s*>=\s*10/);
  });

  it('keeps isValidBuildingName-equivalent regex filter in all 6 branches', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    // digit-opener paren prefix
    const parenMatches = sql.match(
      /buildingName\s+NOT\s+REGEXP\s+'\^\[\[:space:\]\]\*\[\(\]\[0-9\]'/g,
    );
    expect(parenMatches?.length).toBe(6);
    // pure-digit/hyphen/paren/space-only
    const numericMatches = sql.match(
      /buildingName\s+NOT\s+REGEXP\s+'\^\[0-9\(\)\[:space:\]-\]\+\$'/g,
    );
    expect(numericMatches?.length).toBe(6);
    // length >= 2
    const lenMatches = sql.match(/CHAR_LENGTH\(buildingName\)\s*>=\s*2/g);
    expect(lenMatches?.length).toBe(6);
  });

  it('selects realEstateType + city + district + buildingName + bjdCode', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();
    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toMatch(/SELECT\s+realEstateType,\s*city,\s*district,\s*buildingName,\s*bjdCode/);
  });

  it('keeps NOT NULL / != "" guards', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();
    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql.match(/buildingName\s+IS\s+NOT\s+NULL/g)?.length).toBe(6);
    expect(sql.match(/buildingName\s*!=\s*''/g)?.length).toBe(6);
  });
});

describe('getRealEstateCityDistrictHubs', () => {
  it('emits 6 realEstateType branches (apt|villa|offitel × sale|rent)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    for (const t of ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent']) {
      expect(sql).toContain(`'${t}'`);
    }
    const unionCount = sql.match(/UNION ALL/g)?.length ?? 0;
    expect(unionCount).toBeGreaterThanOrEqual(5);
  });

  it('inner subqueries group by buildingName; outer uses DISTINCT', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    // inner GROUP BY must include buildingName so each unique building shows up once per district
    expect(sql).toMatch(/GROUP BY\s+city,\s*district,\s*buildingName/);
    // outer query deduplicates with DISTINCT, not GROUP BY
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+realEstateType,\s*city,\s*district/);
  });

  it('거래 건수 임계값 없음 — HAVING COUNT 필터 제거됨', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).not.toMatch(/HAVING\s+COUNT\(\*\)\s*>=\s*10/);
  });

  it('applies isValidBuildingName-equivalent regex filter in all 6 branches', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const parenMatches = sql.match(/buildingName\s+NOT\s+REGEXP\s+'\^\[\[:space:\]\]\*\[\(\]\[0-9\]'/g);
    expect(parenMatches?.length).toBe(6);
    const numericMatches = sql.match(/buildingName\s+NOT\s+REGEXP\s+'\^\[0-9\(\)\[:space:\]-\]\+\$'/g);
    expect(numericMatches?.length).toBe(6);
  });

  it('outer SELECT uses DISTINCT on (realEstateType, city, district) without bjdCode', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    // outer SELECT must use DISTINCT on (realEstateType, city, district)
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+realEstateType,\s*city,\s*district/);
    // bjdCode must not be selected
    expect(sql).not.toMatch(/SELECT[^)]*bjdCode/);
  });

  it('returns typed rows with realEstateType, city, district fields', async () => {
    mockQueryRaw.mockResolvedValue([
      { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구' },
      { realEstateType: 'villa-rent', city: '부산광역시', district: '해운대구' },
    ]);
    const result = await getRealEstateCityDistrictHubs();
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ realEstateType: 'apt-sale', city: '서울특별시', district: '강남구' });
    expect(result[1]).toEqual({ realEstateType: 'villa-rent', city: '부산광역시', district: '해운대구' });
  });
});
