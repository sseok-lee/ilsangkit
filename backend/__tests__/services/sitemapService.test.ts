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
