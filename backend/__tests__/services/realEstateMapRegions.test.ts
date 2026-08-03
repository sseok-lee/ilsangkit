import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRawUnsafe = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));

import { fetchRegions, __resetMapCacheForTest } from '../../src/services/realEstateMapService.js';

describe('fetchRegions', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    __resetMapCacheForTest();
  });

  it('sargable 날짜 조건을 쓴다 — dealYear 에 연산을 걸지 않는다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city');
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/dealYear\s*\*/);
    expect(sql).toContain('(dealYear = ? AND dealMonth >= ?) OR dealYear > ?');
  });

  it('매매는 dealAmount 를 쓴다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city');
    expect(queryRawUnsafe.mock.calls[0][0]).toContain('dealAmount');
  });

  it('전월세는 deposit 을 쓰고 전세(monthlyRent=0)만 집계한다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-rent', 'city');
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('deposit');
    expect(sql).toContain('monthlyRent = 0');
  });

  it('같은 (type, level) 두 번째 호출은 캐시를 쓴다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city');
    await fetchRegions('apt-sale', 'city');
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('동시 호출을 한 번의 쿼리로 합친다 (in-flight)', async () => {
    let resolve!: (v: unknown) => void;
    queryRawUnsafe.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const p1 = fetchRegions('villa-sale', 'district');
    const p2 = fetchRegions('villa-sale', 'district');
    resolve([]);
    await Promise.all([p1, p2]);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('쿼리가 실패하면 빈 배열을 주고 캐시하지 않는다 (fail-open)', async () => {
    queryRawUnsafe.mockRejectedValueOnce(new Error('db down'));
    expect(await fetchRegions('apt-sale', 'city')).toEqual([]);
    queryRawUnsafe.mockResolvedValueOnce([]);
    await fetchRegions('apt-sale', 'city');
    expect(queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('BigInt/Decimal 을 Number 로 바꾼다', async () => {
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: null, lat: '37.5513', lng: '126.9891', avgPricePerPyeong: 7732n, transactionCount: 12043n },
    ]);
    const r = await fetchRegions('apt-sale', 'city');
    expect(r[0]).toEqual({
      name: '서울', district: null, lat: 37.5513, lng: 126.9891,
      avgPricePerPyeong: 7732, transactionCount: 12043,
    });
  });
});
