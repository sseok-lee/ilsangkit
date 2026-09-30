import { describe, it, expect, vi, beforeEach } from 'vitest';

const { queryRawUnsafe, mockGetLatestDeals, mockAttachCanonicalPaths } = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  mockGetLatestDeals: vi.fn(),
  mockAttachCanonicalPaths: vi.fn(),
}));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));

vi.mock('../../src/services/realEstateLatestDeals.js', async (orig) => {
  const actual = await orig() as typeof import('../../src/services/realEstateLatestDeals.js');
  return {
    ...actual,
    getLatestDeals: mockGetLatestDeals,
  };
});
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  attachRealEstateCanonicalPaths: mockAttachCanonicalPaths,
}));

import { fetchBuildings, BUILDING_LIMIT, __resetIndexWarningForTest } from '../../src/services/realEstateMapService.js';
import { latestDealsKey } from '../../src/services/realEstateLatestDeals.js';
import type { BuildingKey, LatestDeals } from '../../src/types/realEstateExploration.js';

function emptyLatestDeals(): LatestDeals {
  return { sale: null, jeonse: null, wolse: null };
}

const BOUNDS = { swLat: 37.46, swLng: 127.0, neLat: 37.54, neLng: 127.1 };

describe('fetchBuildings', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    mockGetLatestDeals.mockReset();
    mockAttachCanonicalPaths.mockReset();
    mockAttachCanonicalPaths.mockImplementation((rows: unknown[]) => Promise.resolve(rows));
    mockGetLatestDeals.mockImplementation((keys: BuildingKey[]) => {
      const bundles = new Map<string, LatestDeals>();
      for (const key of keys) bundles.set(latestDealsKey(key), emptyLatestDeals());
      return Promise.resolve(bundles);
    });
  });

  it('지도 건물 항목에 canonicalPath를 붙인다', async () => {
    const key = 'd'.repeat(64);
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([{
      buildingKey: key,
      buildingName: '도곡렉슬',
      bjdCode: '11680',
      city: '서울',
      district: '강남구',
      dongName: '도곡동',
      jibun: '527',
      lat: 37.49,
      lng: 127.05,
      latestPrice: 245000n,
      monthlyRent: null,
      latestDealYear: 2026,
      latestDealMonth: 7,
      latestDealDay: 25,
      transactionCount: 83,
    }]);
    mockAttachCanonicalPaths.mockImplementationOnce((rows: Array<{ buildingKey?: string }>, type?: string) =>
      Promise.resolve(rows.map((row) => ({ ...row, canonicalPath: `/registered/${type}/${row.buildingKey}` }))),
    );

    const result = await fetchBuildings('apt-sale', BOUNDS);

    expect(mockAttachCanonicalPaths).toHaveBeenCalledWith(expect.arrayContaining([
      expect.objectContaining({ buildingKey: key, buildingName: '도곡렉슬' }),
    ]), 'apt-sale');
    expect(result.items[0].canonicalPath).toBe(`/registered/apt-sale/${key}`);
  });

  it('FORCE INDEX 힌트를 건다 — 없으면 옵티마이저가 21배 느린 경로를 고른다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 5n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-sale', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    expect(listSql).toContain('FORCE INDEX (RealEstateBuildingSummaryV2_type_lat_lng_idx)');
  });

  it('total 을 items.length 가 아니라 별도 COUNT 로 구한다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1820n }])
      .mockResolvedValueOnce([{ buildingName: 'A', bjdCode: '11680', latestPrice: 100n, monthlyRent: null, transactionCount: 3, lat: 37.5, lng: 127.05 }]);
    const r = await fetchBuildings('apt-sale', BOUNDS);
    expect(r.total).toBe(1820);
    expect(r.items).toHaveLength(1);
  });

  it('total 이 상한을 넘으면 exact=false', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: BigInt(BUILDING_LIMIT + 1) }]).mockResolvedValueOnce([]);
    expect((await fetchBuildings('apt-sale', BOUNDS)).exact).toBe(false);
  });

  it('total 이 상한 이하면 exact=true', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 12n }]).mockResolvedValueOnce([]);
    expect((await fetchBuildings('apt-sale', BOUNDS)).exact).toBe(true);
  });

  it('BigInt 를 Number 로 직렬화한다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1n }])
      .mockResolvedValueOnce([{ buildingName: 'A', bjdCode: '11680', latestPrice: 168340n, monthlyRent: 0, transactionCount: 3 }]);
    const r = await fetchBuildings('apt-rent', BOUNDS);
    expect(r.items[0].latestPrice).toBe(168340);
    expect(typeof r.items[0].latestPrice).toBe('number');
  });

  it('좌표가 NULL 인 행을 제외한다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 0n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-sale', BOUNDS);
    expect(queryRawUnsafe.mock.calls[1][0]).toContain('lat IS NOT NULL');
  });

  it('알 수 없는 type 은 던진다', async () => {
    await expect(fetchBuildings('bogus', BOUNDS)).rejects.toThrow();
  });

  it('전세/월세 분리 컬럼을 SELECT 에 싣는다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-rent', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    for (const col of ['buildingKey', 'bjdCode', 'jibun', 'jeonseDeposit', 'jeonseDealKey', 'wolseDeposit', 'wolseMonthlyRent', 'wolseDealKey']) {
      expect(listSql).toContain(col);
    }
  });

  it('분리 컬럼 값을 그대로 항목에 담는다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([{
      buildingName: '은마', bjdCode: '11680', city: '서울', district: '강남구', dongName: '대치동',
      buildingKey: 'key-daechi-934-2', jibun: '934-2',
      lat: 37.5, lng: 127.06, latestPrice: 75000n, monthlyRent: 340,
      latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 114,
      jeonseDeposit: 96000, jeonseDealKey: 20260712,
      wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
    }]);
    const r = await fetchBuildings('apt-rent', BOUNDS);
    expect(r.items[0].jeonseDeposit).toBe(96000);
    expect(r.items[0].buildingKey).toBe('key-daechi-934-2');
    expect(r.items[0].jibun).toBe('934-2');
    expect(r.items[0].wolseDeposit).toBe(75000);
    expect(r.items[0].wolseMonthlyRent).toBe(340);
  });

  it('매매는 분리 컬럼이 null 이다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([{
      buildingName: '도곡렉슬', bjdCode: '11680', city: '서울', district: '강남구', dongName: '도곡동',
      lat: 37.48, lng: 127.05, latestPrice: 245000n, monthlyRent: null,
      latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 83,
      jeonseDeposit: null, jeonseDealKey: null,
      wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
    }]);
    const r = await fetchBuildings('apt-sale', BOUNDS);
    expect(r.items[0].jeonseDeposit).toBeNull();
    expect(r.items[0].wolseMonthlyRent).toBeNull();
  });

  it('FORCE INDEX 와 WHERE 는 그대로다 — 컬럼 추가가 인덱스 경로를 바꾸면 안 된다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-rent', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    expect(listSql).toContain('FORCE INDEX (RealEstateBuildingSummaryV2_type_lat_lng_idx)');
    expect(listSql).toContain('ORDER BY transactionCount DESC');
  });

  it.each([1, 24, BUILDING_LIMIT])('최종 반환 %i개만 한 번에 latestDeals 보완한다', async (rowCount) => {
    const rows = Array.from({ length: rowCount }, (_, i) => ({
      buildingName: `단지${i}`,
      bjdCode: `1168${String(i).padStart(2, '0')}`,
      city: '서울',
      district: '강남구',
      dongName: '역삼동',
      lat: 37.5,
      lng: 127.0,
      latestPrice: 100000n,
      monthlyRent: null,
      transactionCount: 3,
    }));
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: BigInt(rowCount + 10) }]).mockResolvedValueOnce(rows);

    const result = await fetchBuildings('apt-sale', BOUNDS);

    expect(result.items).toHaveLength(rowCount);
    expect(mockGetLatestDeals).toHaveBeenCalledTimes(1);
    expect(mockGetLatestDeals.mock.calls[0][0]).toHaveLength(rowCount);
    expect(mockGetLatestDeals.mock.calls[0][1]).toBe('sale');
    expect(queryRawUnsafe).toHaveBeenCalledTimes(2);
    expect(result.items[0]).toHaveProperty('bjdCode');
    expect(mockGetLatestDeals.mock.calls[0][0][0]).toMatchObject({
      buildingName: '단지0',
      bjdCode: '116800',
      dongName: '역삼동',
      jibun: null,
    });
    expect(result.items[0]).toHaveProperty('latestDeals');
  });

  it('같은 이름의 다른 지번 지도 항목을 별도 키로 최신거래 보완한다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 2n }]).mockResolvedValueOnce([
      {
        buildingKey: 'key-a',
        buildingName: '스톤빌리지',
        bjdCode: '11680',
        city: '서울',
        district: '강남구',
        dongName: '대치동',
        jibun: '934-2',
        lat: 37.5,
        lng: 127.06,
        latestPrice: 81000n,
        monthlyRent: null,
        transactionCount: 3,
      },
      {
        buildingKey: 'key-b',
        buildingName: '스톤빌리지',
        bjdCode: '11680',
        city: '서울',
        district: '강남구',
        dongName: '역삼동',
        jibun: '785-10',
        lat: 37.49,
        lng: 127.04,
        latestPrice: 72000n,
        monthlyRent: null,
        transactionCount: 2,
      },
    ]);

    const result = await fetchBuildings('villa-sale', BOUNDS);

    expect(result.items.map((item) => item.buildingKey)).toEqual(['key-a', 'key-b']);
    expect(mockGetLatestDeals.mock.calls[0][0]).toEqual([
      { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680', dongName: '대치동', jibun: '934-2' },
      { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680', dongName: '역삼동', jibun: '785-10' },
    ]);
  });
});

// 운영 확인 중 발견(2026-08-03): 배포 전 운영 DB 에는 아직 좌표 인덱스가 없어
// FORCE INDEX 가 MySQL 1176 을 내고 부동산 허브 지도가 통째로 500 이었다.
// 배포는 db push 를 pm2 restart 앞에 돌리지만, 그게 실패하거나 DB 를 롤백·복원하면
// 같은 상황이 된다. 느린 건 감수하되 죽지는 않게 폴백한다.
describe('좌표 인덱스 부재 시 폴백', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    __resetIndexWarningForTest();
  });

  it('인덱스가 없으면 힌트 없이 재시도해 결과를 돌려준다', async () => {
    const missing = new Error(
      "Raw query failed. Code: `1176`. Message: `Key 'RealEstateBuildingSummary_type_lat_lng_idx' doesn't exist in table 'RealEstateBuildingSummary'`",
    );
    queryRawUnsafe
      .mockRejectedValueOnce(missing) // COUNT + 힌트
      .mockResolvedValueOnce([{ cnt: 3n }]) // COUNT 폴백
      .mockRejectedValueOnce(missing) // 목록 + 힌트
      .mockResolvedValueOnce([{ buildingName: 'A', bjdCode: '11680', latestPrice: 100n, monthlyRent: 0, transactionCount: 1 }]);

    const r = await fetchBuildings('apt-sale', BOUNDS);

    expect(r.total).toBe(3);
    expect(r.items).toHaveLength(1);
    // 폴백 쿼리에는 힌트가 없어야 한다
    const fallbackSql = queryRawUnsafe.mock.calls[1][0] as string;
    expect(fallbackSql).not.toContain('FORCE INDEX');
  });

  it('인덱스와 무관한 오류는 삼키지 않고 그대로 던진다', async () => {
    queryRawUnsafe.mockRejectedValueOnce(new Error('Connection pool timeout'));
    await expect(fetchBuildings('apt-sale', BOUNDS)).rejects.toThrow('Connection pool timeout');
  });
});
