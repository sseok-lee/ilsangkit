import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

vi.mock('../../src/services/facilityService.js', () => ({
  getAllIds: vi.fn(),
  getRegionCategoryCombinations: vi.fn(),
}));
vi.mock('../../src/services/wasteScheduleService.js', () => ({
  getAllIds: vi.fn(),
}));
vi.mock('../../src/services/categoryRegistry.js', () => ({
  ALL_CATEGORIES: [],
}));

import { getRealEstateBuildings, getRealEstateCityDistrictHubs, _resetSitemapCacheForTests } from '../../src/services/sitemapService.js';

function flattenSql(call: unknown[]): string {
  const strings = call[0] as unknown as readonly string[];
  return strings.join('?');
}

beforeEach(() => {
  vi.clearAllMocks();
  _resetSitemapCacheForTests();
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

  it('HAVING COUNT(*) >= 10 in each branch (thin-content filter)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const havingMatches = sql.match(/HAVING\s+COUNT\(\*\)\s*>=\s*10/g);
    expect(havingMatches?.length).toBe(6);
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

  it('inner subqueries group by buildingName for per-building threshold; outer uses DISTINCT', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    // inner GROUP BY must include buildingName so HAVING COUNT(*) >= 10 applies per building
    expect(sql).toMatch(/GROUP BY\s+city,\s*district,\s*buildingName/);
    // outer query deduplicates with DISTINCT, not GROUP BY
    expect(sql).toMatch(/SELECT\s+DISTINCT\s+realEstateType,\s*city,\s*district/);
  });

  it('applies HAVING COUNT(*) >= 10 in each branch', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const havingMatches = sql.match(/HAVING\s+COUNT\(\*\)\s*>=\s*10/g);
    expect(havingMatches?.length).toBe(6);
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
