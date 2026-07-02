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
  getWasteScheduleRegions: vi.fn(),
}));
vi.mock('../../src/services/categoryRegistry.js', () => ({
  ALL_CATEGORIES: [],
}));

import {
  getRealEstateBuildings,
  getRealEstateCityDistrictHubs,
  getSitemapPageCounts,
  dealKeyToDateString,
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

  it('computes per-building MAX(dealYmd) key in all 6 branches and selects lastDealKey', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();
    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    // MAX(dealYear*10000 + dealMonth*100 + COALESCE(dealDay,1)) in each of the 6 branches
    const maxKeyMatches = sql.match(
      /MAX\(dealYear\s*\*\s*10000\s*\+\s*dealMonth\s*\*\s*100\s*\+\s*COALESCE\(dealDay,\s*1\)\)/g,
    );
    expect(maxKeyMatches?.length).toBe(6);
    // outer SELECT exposes lastDealKey
    expect(sql).toMatch(/SELECT\s+realEstateType,\s*city,\s*district,\s*buildingName,\s*bjdCode,\s*lastDealKey/);
  });

  it('maps lastDealKey (BigInt) to a real per-building lastmod string, no BigInt leak', async () => {
    mockQueryRaw.mockResolvedValue([
      { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '래미안', bjdCode: '1168011700', lastDealKey: 20260615n },
      { realEstateType: 'villa-rent', city: '부산광역시', district: '해운대구', buildingName: '해운대빌라', bjdCode: '2635011700', lastDealKey: 20260301n },
    ]);
    const rows = await getRealEstateBuildings();
    expect(rows[0].lastmod).toBe('2026-06-15');
    expect(rows[1].lastmod).toBe('2026-03-01');
    // no BigInt survives to the API boundary (JSON.stringify would throw on BigInt)
    expect(() => JSON.stringify(rows)).not.toThrow();
  });

  it('falls back to empty lastmod when a building has no dealKey (null)', async () => {
    mockQueryRaw.mockResolvedValue([
      { realEstateType: 'apt-sale', city: '서울특별시', district: '강남구', buildingName: '래미안', bjdCode: '1168011700', lastDealKey: null },
    ]);
    const rows = await getRealEstateBuildings();
    expect(rows[0].lastmod).toBe('');
  });
});

describe('dealKeyToDateString', () => {
  it('converts YYYYMMDD integer key to W3C YYYY-MM-DD', () => {
    expect(dealKeyToDateString(20260615)).toBe('2026-06-15');
    expect(dealKeyToDateString(20260701)).toBe('2026-07-01');
  });

  it('pads single-digit month/day', () => {
    expect(dealKeyToDateString(20260305)).toBe('2026-03-05');
  });

  it('COALESCE(dealDay,1) → day 01 when dealDay was null', () => {
    // dealYear*10000 + dealMonth*100 + 1
    expect(dealKeyToDateString(20260601)).toBe('2026-06-01');
  });

  it('clamps out-of-range month/day defensively', () => {
    expect(dealKeyToDateString(20261399)).toBe('2026-12-31');
    expect(dealKeyToDateString(20260000)).toBe('2026-01-01');
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
