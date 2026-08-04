import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRawUnsafe = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));

import { fetchBuildings, BUILDING_LIMIT, __resetIndexWarningForTest } from '../../src/services/realEstateMapService.js';

const BOUNDS = { swLat: 37.46, swLng: 127.0, neLat: 37.54, neLng: 127.1 };

describe('fetchBuildings', () => {
  beforeEach(() => queryRawUnsafe.mockReset());

  it('FORCE INDEX 힌트를 건다 — 없으면 옵티마이저가 21배 느린 경로를 고른다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 5n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-sale', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    expect(listSql).toContain('FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)');
  });

  it('total 을 items.length 가 아니라 별도 COUNT 로 구한다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1820n }])
      .mockResolvedValueOnce([{ buildingName: 'A', latestPrice: 100n, monthlyRent: null, transactionCount: 3, lat: 37.5, lng: 127.05 }]);
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
      .mockResolvedValueOnce([{ buildingName: 'A', latestPrice: 168340n, monthlyRent: 0, transactionCount: 3 }]);
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
      .mockResolvedValueOnce([{ buildingName: 'A', latestPrice: 100n, monthlyRent: 0, transactionCount: 1 }]);

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
