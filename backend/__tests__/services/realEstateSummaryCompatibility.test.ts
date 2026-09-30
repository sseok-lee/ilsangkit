import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRawUnsafeMock, queryRawMock, getLatestDealsMock, latestDealsKeyMock } = vi.hoisted(() => ({
  queryRawUnsafeMock: vi.fn(),
  queryRawMock: vi.fn(),
  getLatestDealsMock: vi.fn(),
  latestDealsKeyMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $queryRaw: queryRawMock,
    aptSaleTransaction: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
  },
  default: {
    $queryRawUnsafe: queryRawUnsafeMock,
    $queryRaw: queryRawMock,
    aptSaleTransaction: {
      groupBy: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}));

vi.mock('../../src/services/realEstateLatestDeals.js', () => ({
  getLatestDeals: getLatestDealsMock,
  latestDealsKey: latestDealsKeyMock,
}));

vi.mock('../../src/services/search/searchQueryParser.js', () => ({
  parseSearchQueryCached: vi.fn(async (keyword?: string) => ({ freeText: keyword ?? '' })),
  resolveScope: vi.fn((_scope, parsed) => ({ nameText: parsed.freeText, effectiveCity: undefined, effectiveDistrict: undefined })),
}));

import { getBuildingInfo, getComplexList, searchPropertyComplexesByKeyword } from '../../src/services/realEstateService.js';

function sqlAt(index: number): string {
  return String(queryRawUnsafeMock.mock.calls[index]?.[0] ?? '').replace(/\s+/g, ' ');
}

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.REAL_ESTATE_SUMMARY_MODE;
  getLatestDealsMock.mockResolvedValue(new Map());
  latestDealsKeyMock.mockImplementation((key: unknown) => JSON.stringify(key));
});

describe('real estate summary read-mode consumers', () => {
  it('uses V2 summary rows by default for list consumers', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0n }]);

    await getComplexList('apt-sale', '서울특별시', '강남구', undefined, 1, 10);

    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummaryV2');
    expect(sqlAt(1)).toContain('FROM RealEstateBuildingSummaryV2');
    expect(sqlAt(0)).toContain('buildingKey');
    expect(sqlAt(0)).toContain('jibun');
  });

  it('keeps compatibility list consumers on legacy summary without physical key/jibun columns', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawUnsafeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0n }]);

    await getComplexList('apt-sale', '서울특별시', '강남구', undefined, 1, 10);

    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummary');
    expect(sqlAt(0)).not.toContain('FROM RealEstateBuildingSummaryV2');
    expect(sqlAt(0)).toContain('NULL AS buildingKey');
    expect(sqlAt(0)).toContain('NULL AS jibun');
    expect(sqlAt(1)).toContain('FROM RealEstateBuildingSummary WHERE');
  });

  it('uses legacy building tuple distinct counts in compatibility mode', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawUnsafeMock.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0n }]);

    await searchPropertyComplexesByKeyword('apt', '래미안', 1, 10);

    expect(sqlAt(0)).toContain('PARTITION BY type, buildingName, bjdCode');
    expect(sqlAt(0)).not.toContain('PARTITION BY buildingKey');
    expect(sqlAt(1)).toContain('COUNT(DISTINCT type, buildingName, bjdCode)');
    expect(sqlAt(1)).not.toContain('COUNT(DISTINCT buildingKey)');
  });

  it('validates keyed detail identity from V2 even in compatibility mode', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawUnsafeMock.mockResolvedValueOnce([]);

    await getBuildingInfo('apt-sale', '1168010100', '같은아파트', 'a'.repeat(64));

    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummaryV2');
    expect(sqlAt(0)).toContain('buildingKey = ?');
  });
});

vi.mock('../../src/services/search/searchRegionIndex.js', () => ({
  getRegionIndex: vi.fn(async () => ({ districtNames: new Map() })),
}));

import { fetchBuildings } from '../../src/services/realEstateMapService.js';
import { suggest } from '../../src/services/search/searchSuggestService.js';
import { getRealEstateBuildings } from '../../src/services/sitemapService.js';
import { checkActiveSummaryReadiness } from '../../src/services/realEstateSummaryReadiness.js';

describe('mode-specific summary consumers outside list service', () => {
  it('uses V2 table and V2 coordinate index for address map reads by default', async () => {
    queryRawUnsafeMock
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([]);

    await fetchBuildings('apt-sale', { swLat: 37, neLat: 38, swLng: 126, neLng: 127 });

    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummaryV2 FORCE INDEX (RealEstateBuildingSummaryV2_type_lat_lng_idx)');
    expect(sqlAt(1)).toContain('SELECT buildingKey, jibun');
  });

  it('keeps compatibility map reads on legacy table without physical key/jibun columns', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawUnsafeMock
      .mockResolvedValueOnce([{ cnt: 0n }])
      .mockResolvedValueOnce([]);

    await fetchBuildings('apt-sale', { swLat: 37, neLat: 38, swLng: 126, neLng: 127 });

    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummary FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)');
    expect(sqlAt(1)).toContain('NULL AS buildingKey, NULL AS jibun');
    expect(sqlAt(1)).not.toContain('FROM RealEstateBuildingSummaryV2');
  });

  it('uses raw V2 suggestions by default and raw legacy projection in compatibility mode', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await suggest('래미안', 'realestate');
    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummaryV2');
    expect(sqlAt(0)).toContain('buildingKey, dongName, jibun');

    vi.clearAllMocks();
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await suggest('래미안', 'realestate');
    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummary');
    expect(sqlAt(0)).toContain('NULL AS buildingKey, dongName, NULL AS jibun');
    expect(sqlAt(0)).not.toContain('FROM RealEstateBuildingSummaryV2');
  });

  it('generates keyed sitemap rows in address mode and legacy sitemap rows in compatibility mode', async () => {
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await getRealEstateBuildings({ page: 1, limit: 10 });
    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummaryV2');
    expect(sqlAt(0)).toContain('buildingKey');

    vi.clearAllMocks();
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawUnsafeMock.mockResolvedValueOnce([]);
    await getRealEstateBuildings({ page: 1, limit: 10 });
    expect(sqlAt(0)).toContain('FROM RealEstateBuildingSummary');
    expect(sqlAt(0)).toContain('NULL AS buildingKey');
    expect(sqlAt(0)).not.toContain('FROM RealEstateBuildingSummaryV2');
  });

  it('requires V2 readiness even for compatibility candidate processes', async () => {
    process.env.REAL_ESTATE_SUMMARY_MODE = 'compatibility';
    queryRawMock
      .mockResolvedValueOnce([{ status: 'ready', runId: 'run-1', validatedAt: new Date('2026-09-29T00:00:00.000Z') }])
      .mockResolvedValueOnce([{ cnt: 2n }]);

    const result = await checkActiveSummaryReadiness(process.env);

    expect(result.ready).toBe(true);
    expect(result.mode).toBe('compatibility');
    expect(result.table).toBe('RealEstateBuildingSummaryV2');
  });
});
