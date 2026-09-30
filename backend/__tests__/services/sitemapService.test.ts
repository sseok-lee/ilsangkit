import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockQueryRaw,
  getCategoryCountAndMaxDateMock,
  wasteCountMock,
  wasteLatestMock,
  subscriptionIdsMock,
  subscriptionCountMock,
  subscriptionLatestMock,
  getWasteScheduleRegionsMock,
  getActiveWasteGenerationMock,
  listIndexableWasteAreasMock,
  mockAttachCanonicalPaths,
  mockIsPreservedMode,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  getCategoryCountAndMaxDateMock: vi.fn(),
  wasteCountMock: vi.fn(),
  wasteLatestMock: vi.fn(),
  subscriptionIdsMock: vi.fn(),
  subscriptionCountMock: vi.fn(),
  subscriptionLatestMock: vi.fn(),
  getWasteScheduleRegionsMock: vi.fn(),
  getActiveWasteGenerationMock: vi.fn(),
  listIndexableWasteAreasMock: vi.fn(),
  mockAttachCanonicalPaths: vi.fn(),
  mockIsPreservedMode: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $queryRawUnsafe: mockQueryRaw,
    wasteSchedule: {
      count: wasteCountMock,
      findFirst: wasteLatestMock,
    },
    subscription: {
      findMany: subscriptionIdsMock,
      count: subscriptionCountMock,
      findFirst: subscriptionLatestMock,
    },
  },
  default: {
    $queryRaw: mockQueryRaw,
    $queryRawUnsafe: mockQueryRaw,
    wasteSchedule: {
      count: wasteCountMock,
      findFirst: wasteLatestMock,
    },
    subscription: {
      findMany: subscriptionIdsMock,
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
  getWasteScheduleRegions: getWasteScheduleRegionsMock,
}));
vi.mock('../../src/services/wasteAreaService.js', () => ({
  isWasteAreaDiscoveryEnabled: () => process.env.WASTE_AREA_DISCOVERY_ENABLED === 'true',
  getActiveWasteGeneration: getActiveWasteGenerationMock,
  listIndexableWasteAreas: listIndexableWasteAreasMock,
}));
vi.mock('../../src/services/categoryRegistry.js', () => ({
  ALL_CATEGORIES: [],
}));
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  attachRealEstateCanonicalPaths: mockAttachCanonicalPaths,
  isPreservedRealEstateUrlMode: mockIsPreservedMode,
}));

import {
  getSubscriptionIds,
  getRealEstateBuildings,
  getRealEstateBuildingCount,
  getRealEstateCityDistrictHubs,
  getSitemapPageCounts,
  dealKeyToDateString,
  _resetSitemapCacheForTests,
} from '../../src/services/sitemapService.js';

function flattenSql(call: unknown[]): string {
  const first = call[0];
  if (typeof first === 'string') return first;
  const strings = first as unknown as readonly string[];
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
  getWasteScheduleRegionsMock.mockResolvedValue([]);
  getActiveWasteGenerationMock.mockResolvedValue(null);
  listIndexableWasteAreasMock.mockResolvedValue([]);
  mockQueryRaw.mockResolvedValue([{ cnt: 0n }]);
  mockAttachCanonicalPaths.mockImplementation((rows: unknown[]) => Promise.resolve(rows));
  mockIsPreservedMode.mockReturnValue(false);
  delete process.env.WASTE_AREA_DISCOVERY_ENABLED;
  process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
});

describe('getSitemapPageCounts facility policy', () => {
  it('includes AED with the crawl-budget limit and keeps wifi out of indexed facility chunks', async () => {
    const result = await getSitemapPageCounts();
    const categories = result.facilities.map((item) => item.category);

    expect(categories).toContain('aed');
    expect(categories).not.toContain('wifi');
    expect(getCategoryCountAndMaxDateMock).toHaveBeenCalledWith('aed', 15000);
  });

  it('uses legacy waste regions when discovery is disabled without reading area tables', async () => {
    getWasteScheduleRegionsMock.mockResolvedValue([
      { city: '서울특별시', district: '강남구', updatedAt: new Date('2026-09-20T00:00:00.000Z') },
    ]);

    const result = await getSitemapPageCounts();

    expect(result.waste).toEqual({ count: 1, maxUpdatedAt: '2026-09-20' });
    expect(getActiveWasteGenerationMock).not.toHaveBeenCalled();
    expect(listIndexableWasteAreasMock).not.toHaveBeenCalled();
  });

  it('adds W9 eligible area URLs to the waste sitemap count when discovery is enabled', async () => {
    process.env.WASTE_AREA_DISCOVERY_ENABLED = 'true';
    getActiveWasteGenerationMock.mockResolvedValue('generation-1');
    getWasteScheduleRegionsMock.mockResolvedValue([
      { city: '서울특별시', district: '강남구', updatedAt: new Date('2026-09-20T00:00:00.000Z') },
    ]);
    listIndexableWasteAreasMock.mockResolvedValue([
      { areaId: 101, contentUpdatedAt: '2026-09-22T00:00:00.000Z' },
      { areaId: 102, contentUpdatedAt: '2026-09-21T00:00:00.000Z' },
    ]);

    const result = await getSitemapPageCounts();

    expect(result.waste).toEqual({ count: 3, maxUpdatedAt: '2026-09-22' });
    expect(listIndexableWasteAreasMock).toHaveBeenCalledWith('generation-1');
  });
});

describe('getRealEstateBuildings — RealEstateBuildingSummary 기반', () => {
  // 종전에는 거래 6.7M행을 UNION ALL + GROUP BY 로 집계해 56초가 걸렸고, 그래서 6시간 캐시와
  // 배포 워밍업이 필요했다. 그 메모리 스파이크가 PM2 재시작을 유발했다(2026-07-28).
  // 이미 있던 RealEstateBuildingSummary 로 바꿔 0.34초가 됐다. URL 수 356,461 는 동일.
  it('거래 테이블이 아니라 RealEstateBuildingSummary 에서 읽는다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('RealEstateBuildingSummary');
    // 거래 테이블을 다시 집계하면 56초 문제가 되살아난다.
    for (const t of ['AptSaleTransaction', 'AptRentTransaction', 'VillaSaleTransaction']) {
      expect(sql).not.toContain(t);
    }
  });

  it('URL 생성에 필요한 필드를 모두 선택한다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('type AS realEstateType');
    expect(sql).toContain('city');
    expect(sql).toContain('district');
    expect(sql).toContain('buildingName');
    expect(sql).toContain('bjdCode');
  });

  it('건물명 품질 필터를 유지한다 (URL 집합이 바뀌면 안 된다)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('CHAR_LENGTH(buildingName) >= 2');
    expect(sql).toContain("'^[[:space:]]*[(][0-9]'");
    expect(sql).toContain("'^[0-9()[:space:]-]+$'");
    expect(sql).toContain('buildingName IS NOT NULL');
    expect(sql).toContain("buildingName != ''");
  });

  it('lastmod 키에 latestDealDay 를 포함한다 (없으면 356,461개 URL 이 월초로 밀린다)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('latestDealYear * 10000');
    expect(sql).toContain('latestDealMonth * 100');
    // refresh 가 아직 안 돈 행은 latestDealDay 가 NULL — 원본 dealDay 가 NULL 일 때와 같게 1 일로.
    expect(sql).toContain('COALESCE(latestDealDay, 1)');
  });

  it('lastDealKey(BigInt)를 YYYY-MM-DD 문자열로 바꾼다 — BigInt 누출 없음', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        realEstateType: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
        bjdCode: '1168010100',
        lastDealKey: BigInt(20260715),
      },
    ]);
    const rows = await getRealEstateBuildings();
    expect(rows[0].lastmod).toBe('2026-07-15');
    expect(typeof rows[0].lastmod).toBe('string');
    expect(JSON.stringify(rows)).toContain('2026-07-15');
  });

  it('lastDealKey 가 null 이면 lastmod 는 빈 문자열', async () => {
    mockQueryRaw.mockResolvedValue([
      {
        realEstateType: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
        bjdCode: '1168010100',
        lastDealKey: null,
      },
    ]);
    const rows = await getRealEstateBuildings();
    expect(rows[0].lastmod).toBe('');
  });

  it('returns registry canonicalPath for real-estate sitemap rows', async () => {
    const key = 'e'.repeat(64);
    mockQueryRaw.mockResolvedValue([
      {
        realEstateType: 'apt-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '래미안강남',
        bjdCode: '1168010100',
        buildingKey: key,
        lastDealKey: BigInt(20260715),
      },
    ]);
    mockAttachCanonicalPaths.mockImplementationOnce((rows: Array<{ type: string; buildingKey?: string | null }>) =>
      Promise.resolve(rows.map((row) => ({ ...row, canonicalPath: `/registered/${row.type}/${row.buildingKey}` }))),
    );

    const rows = await getRealEstateBuildings();

    expect(mockAttachCanonicalPaths).toHaveBeenCalledWith([expect.objectContaining({
      type: 'apt-sale',
      realEstateType: 'apt-sale',
      buildingKey: key,
    })]);
    expect(rows[0].canonicalPath).toBe(`/registered/apt-sale/${key}`);
  });

  it('deduplicates shared registry canonicalPath values within a sitemap page', async () => {
    const sharedPath = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
    mockQueryRaw.mockResolvedValue([
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은빌라',
        bjdCode: '1168010100',
        buildingKey: 'a'.repeat(64),
        lastDealKey: BigInt(20260715),
      },
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은빌라',
        bjdCode: '1168010100',
        buildingKey: 'b'.repeat(64),
        lastDealKey: BigInt(20260716),
      },
    ]);
    mockAttachCanonicalPaths.mockImplementationOnce((rows: Array<{ type: string }>) =>
      Promise.resolve(rows.map((row) => ({ ...row, canonicalPath: sharedPath }))),
    );

    const rows = await getRealEstateBuildings();

    expect(rows).toHaveLength(1);
    expect(rows[0].canonicalPath).toBe(sharedPath);
  });

  it('preserved URL mode counts distinct public canonical paths instead of summary rows', async () => {
    mockIsPreservedMode.mockReturnValue(true);
    process.env.REAL_ESTATE_SUMMARY_MODE = 'address';
    mockQueryRaw.mockResolvedValue([{ cnt: 5103n }]);

    const count = await getRealEstateBuildingCount();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(count).toBe(5103);
    expect(sql).toContain('COUNT(DISTINCT u.pathHash) AS cnt');
    expect(sql).toContain('FROM RealEstateBuildingSummaryV2 s');
    expect(sql).toContain('INNER JOIN RealEstatePublicUrl u');
    expect(sql).toContain('u.type = s.type');
    expect(sql).toContain('u.buildingKey = s.buildingKey');
    expect(sql).toContain('s.buildingName IS NOT NULL');
    expect(sql).toContain("s.buildingName NOT REGEXP '^[0-9()[:space:]-]+$'");
  });

  it('preserved URL mode pages unique canonical paths through internal pathHash groups ordered by newest grouped deal date', async () => {
    const sharedPath = `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('같은빌라')}`;
    mockIsPreservedMode.mockReturnValue(true);
    process.env.REAL_ESTATE_SUMMARY_MODE = 'address';
    mockQueryRaw.mockResolvedValue([
      {
        realEstateType: 'villa-sale',
        city: '서울특별시',
        district: '강남구',
        buildingName: '같은빌라',
        bjdCode: '1168010100',
        buildingKey: 'a'.repeat(64),
        canonicalPath: sharedPath,
        lastDealKey: BigInt(20260716),
      },
    ]);

    const rows = await getRealEstateBuildings({ page: 2, limit: 50 });

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('GROUP BY u.pathHash');
    expect(sql).toContain('MIN(s.id) AS representativeId');
    expect(sql).toContain('MAX(s.latestDealYear * 10000');
    expect(sql).toContain('ORDER BY lastDealKey DESC, u.pathHash ASC');
    expect(sql).toContain('JOIN RealEstateBuildingSummaryV2 s ON s.id = grouped.representativeId');
    expect(sql).not.toContain('ROW_NUMBER() OVER');
    expect(sql).not.toContain('PARTITION BY u.canonicalPath');
    expect(sql).toContain('LIMIT ? OFFSET ?');
    expect(mockQueryRaw.mock.calls[0].slice(-2)).toEqual([50, 50]);
    expect(mockAttachCanonicalPaths).not.toHaveBeenCalled();
    expect(rows).toEqual([
      expect.objectContaining({
        realEstateType: 'villa-sale',
        buildingKey: 'a'.repeat(64),
        canonicalPath: sharedPath,
        lastmod: '2026-07-16',
      }),
    ]);
  });

  it('캐시하지 않는다 — 매 호출마다 조회한다', async () => {
    // 6시간 캐시가 356,312행을 상주시켜 +169MB 를 먹었고 그게 PM2 재시작의 원인이었다.
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateBuildings();
    await getRealEstateBuildings();
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
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

describe('getRealEstateCityDistrictHubs — RealEstateBuildingSummary 기반', () => {
  it('거래 테이블이 아니라 Summary 에서 DISTINCT 로 읽는다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain('RealEstateBuildingSummary');
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('type AS realEstateType');
    expect(sql).not.toContain('AptSaleTransaction');
  });

  it('건물명 품질 필터를 유지한다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    expect(sql).toContain("'^[0-9()[:space:]-]+$'");
    expect(sql).toContain('CHAR_LENGTH(buildingName) >= 2');
  });

  it('bjdCode 없이 (realEstateType, city, district) 단위로만 구분한다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();

    const sql = flattenSql(mockQueryRaw.mock.calls[0]);
    const distinctClause = sql.slice(sql.indexOf('SELECT DISTINCT'), sql.indexOf('FROM'));
    expect(distinctClause).not.toContain('bjdCode');
  });

  it('캐시하지 않는다', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getRealEstateCityDistrictHubs();
    await getRealEstateCityDistrictHubs();
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
  });
});

 it('excludes superseded public rental detail URLs from the sitemap', async () => {
   subscriptionIdsMock.mockResolvedValue([]);
   await getSubscriptionIds();
   expect(subscriptionIdsMock).toHaveBeenCalledWith(expect.objectContaining({ where: { supersededById: null } }));
 });
