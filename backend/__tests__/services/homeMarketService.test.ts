import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError, ValidationError } from '../../src/lib/errors.js';
import {
  __resetHomeMarketCacheForTest,
  buildMarketCount,
  getHomeMarket,
} from '../../src/services/homeMarketService.js';

const { queryRawUnsafe, regionFindMany } = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  regionFindMany: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
    region: { findMany: regionFindMany },
  },
}));

const seoulRegions = [
  { bjdCode: '11680', city: '서울특별시', district: '강남구', slug: 'gangnam' },
  { bjdCode: '11710', city: '서울특별시', district: '송파구', slug: 'songpa' },
];

const mergedRegions = [
  { bjdCode: '12210', city: '전남광주통합특별시', district: '동구', slug: 'dong' },
  { bjdCode: '12240', city: '전남광주통합특별시', district: '서구', slug: 'seo' },
  { bjdCode: '12330', city: '전남광주통합특별시', district: '광산구', slug: 'gwangsan' },
  { bjdCode: '12110', city: '전남광주통합특별시', district: '목포시', slug: 'mokpo' },
  { bjdCode: '12130', city: '전남광주통합특별시', district: '여수시', slug: 'yeosu' },
];

describe('buildMarketCount', () => {
  it('정확히 30일을 채우며 일별 합과 총건수가 일치한다', () => {
    const result = buildMarketCount({ from: '2026-08-23', to: '2026-09-21' }, [
      { date: '2026-08-23', count: 2n },
      { date: '2026-09-21', count: 3n },
    ]);

    expect(result.total).toBe(5);
    expect(result.daily).toHaveLength(30);
    expect(result.daily[1]).toEqual({ date: '2026-08-24', count: 0 });
    expect(result.daily.reduce((n, day) => n + day.count, 0)).toBe(result.total);
  });
});

describe('getHomeMarket', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    __resetHomeMarketCacheForTest();
    regionFindMany.mockResolvedValue(seoulRegions);
  });

  it('세 sale 테이블을 지역·정확한 30일·취소 제외 조건으로 집계하고 최근 top5를 합친다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ date: '2026-09-21', count: 2n }])
      .mockResolvedValueOnce([{ date: '2026-09-20', count: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt',
          transactionId: 7,
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '현대',
          jibun: '1',
          date: '2026-09-21',
          amount: 210000n,
          area: '84.90',
        },
        {
          type: 'apt',
          transactionId: 6,
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '현대',
          jibun: '2',
          date: '2026-09-20',
          amount: 200000n,
          area: '84.90',
        },
      ])
      .mockResolvedValueOnce([
        {
          type: 'villa',
          transactionId: 5,
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '현대',
          jibun: '3',
          date: '2026-09-19',
          amount: 90000n,
          area: null,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await getHomeMarket(
      { city: 'seoul', district: 'gangnam' },
      new Date('2026-09-21T12:00:00+09:00'),
    );

    expect(result.window).toEqual({ from: '2026-08-23', to: '2026-09-21' });
    expect(result.region).toEqual({ city: 'seoul', district: 'gangnam', label: '서울 강남구' });
    expect(result.counts.apt.status).toBe('ok');
    expect(result.counts.apt.data?.total).toBe(2);
    expect(result.counts.villa.status).toBe('ok');
    expect(result.counts.villa.data?.total).toBe(1);
    expect(result.recent.status).toBe('ok');
    expect(result.recent.data?.map((row) => `${row.type}:${row.transactionId}:${row.jibun}`)).toEqual([
      'apt:7:1',
      'apt:6:2',
      'villa:5:3',
    ]);

    expect(result.recent.data?.[0].buildingKey).toMatch(/^[a-f0-9]{64}$/);
    expect(result.recent.data?.[0].buildingKey).not.toBe(result.recent.data?.[1].buildingKey);

    const [countSql, ...countParams] = queryRawUnsafe.mock.calls[0];
    expect(countSql).toContain('`AptSaleTransaction`');
    expect(countSql).toContain('DATE_FORMAT');
    expect(countSql).toContain('dealDay IS NOT NULL');
    expect(countSql).toContain('(cancelDealDay IS NULL OR cancelDealDay = \'\')');
    expect(countSql).toContain('(cancelDealType IS NULL OR cancelDealType = \'\')');
    expect(countSql).toContain('city IN (?, ?)');
    expect(countSql).toContain('district = ?');
    expect(countParams).toEqual(['2026-08-23', '2026-09-21', '서울특별시', '서울', '강남구']);

    const [recentSql] = queryRawUnsafe.mock.calls[3];
    expect(recentSql).toContain('ROW_NUMBER() OVER');
    expect(recentSql).toContain("PARTITION BY city, district, bjdCode, buildingName, TRIM(dongName), COALESCE(TRIM(jibun), '')");
    expect(recentSql).toContain('ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC, id DESC');
  });

  it('최근 거래는 같은 날짜에서 유형 오름차순 후 거래 id 내림차순으로 정렬한다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          type: 'apt',
          transactionId: 1,
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '같은날아파트',
          jibun: '1',
          date: '2026-09-21',
          amount: 200000n,
          area: '84.90',
        },
      ])
      .mockResolvedValueOnce([
        {
          type: 'villa',
          transactionId: 9,
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '같은날빌라',
          jibun: '2',
          date: '2026-09-21',
          amount: 120000n,
          area: '84.90',
        },
      ])
      .mockResolvedValueOnce([
        {
          type: 'offitel',
          transactionId: 8,
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '같은날오피스텔',
          jibun: '3',
          date: '2026-09-21',
          amount: 150000n,
          area: '84.90',
        },
      ]);

    const result = await getHomeMarket(
      { city: 'seoul', district: 'gangnam' },
      new Date('2026-09-21T12:00:00+09:00'),
    );

    expect(result.recent.status).toBe('ok');
    expect(result.recent.data?.map((row) => `${row.type}:${row.transactionId}`)).toEqual([
      'apt:1',
      'offitel:8',
      'villa:9',
    ]);
  });

  it('legacy gwangju는 canonical-only 통합 Region rows에서 광주 5구 subset만 유지한다', async () => {
    regionFindMany.mockResolvedValueOnce(mergedRegions);
    queryRawUnsafe.mockResolvedValue([]);

    await getHomeMarket({ city: 'gwangju' }, new Date('2026-09-21T12:00:00+09:00'));

    expect(regionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { city: { in: ['광주광역시', '광주', '전남광주통합특별시'] } },
    }));
    const [sql, ...params] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('city IN (?, ?, ?)');
    expect(sql).toContain('district IN (?, ?, ?)');
    expect(params).toEqual([
      '2026-08-23',
      '2026-09-21',
      '광주광역시',
      '광주',
      '전남광주통합특별시',
      '동구',
      '서구',
      '광산구',
    ]);
  });

  it('legacy jeonnam은 canonical-only 통합 Region rows에서 전남 시군 subset만 유지한다', async () => {
    regionFindMany.mockResolvedValueOnce(mergedRegions);
    queryRawUnsafe.mockResolvedValue([]);

    await getHomeMarket({ city: 'jeonnam' }, new Date('2026-09-21T12:00:00+09:00'));

    expect(regionFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { city: { in: ['전라남도', '전남', '전남광주통합특별시'] } },
    }));
    const [sql, ...params] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('city IN (?, ?, ?)');
    expect(sql).toContain('district IN (?, ?)');
    expect(params).toEqual([
      '2026-08-23',
      '2026-09-21',
      '전라남도',
      '전남',
      '전남광주통합특별시',
      '목포시',
      '여수시',
    ]);
  });

  it('legacy merged city+district selections resolve against canonical rows without cross-subset leakage', async () => {
    regionFindMany.mockResolvedValue(mergedRegions);
    queryRawUnsafe.mockResolvedValue([]);

    const gwangju = await getHomeMarket({ city: 'gwangju', district: 'seo' }, new Date('2026-09-21T12:00:00+09:00'));
    expect(gwangju.region).toEqual({ city: 'gwangju', district: 'seo', label: '광주 서구' });
    let [, ...params] = queryRawUnsafe.mock.calls[0];
    expect(params).toEqual([
      '2026-08-23',
      '2026-09-21',
      '광주광역시',
      '광주',
      '전남광주통합특별시',
      '서구',
    ]);

    __resetHomeMarketCacheForTest();
    queryRawUnsafe.mockClear();
    const jeonnam = await getHomeMarket({ city: 'jeonnam', district: 'mokpo' }, new Date('2026-09-21T12:00:00+09:00'));
    expect(jeonnam.region).toEqual({ city: 'jeonnam', district: 'mokpo', label: '전남 목포시' });
    [, ...params] = queryRawUnsafe.mock.calls[0];
    expect(params).toEqual([
      '2026-08-23',
      '2026-09-21',
      '전라남도',
      '전남',
      '전남광주통합특별시',
      '목포시',
    ]);

    __resetHomeMarketCacheForTest();
    await expect(getHomeMarket({ city: 'gwangju', district: 'mokpo' }))
      .rejects.toBeInstanceOf(ValidationError);
    await expect(getHomeMarket({ city: 'jeonnam', district: 'seo' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('canonical merged city remains flat 27 and accepts both original subsets', async () => {
    regionFindMany.mockResolvedValue(mergedRegions);
    queryRawUnsafe.mockResolvedValue([]);

    const result = await getHomeMarket(
      { city: 'jeonnamgwangju', district: 'seo' },
      new Date('2026-09-21T12:00:00+09:00'),
    );

    expect(result.region).toEqual({
      city: 'jeonnamgwangju',
      district: 'seo',
      label: '전남광주통합특별시 서구',
    });
    const [sql, ...params] = queryRawUnsafe.mock.calls[0];
    expect(sql).toContain('city = ?');
    expect(sql).toContain('district = ?');
    expect(params).toEqual(['2026-08-23', '2026-09-21', '전남광주통합특별시', '서구']);
  });

  it('잘못된 parent-child region은 ValidationError로 거절한다', async () => {
    await expect(getHomeMarket({ city: 'seoul', district: 'haeundae' }))
      .rejects.toBeInstanceOf(ValidationError);
  });

  it('count와 recent 부분 실패를 빈 데이터로 숨기지 않는다', async () => {
    queryRawUnsafe
      .mockRejectedValueOnce(new Error('apt down'))
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error('recent villa down'))
      .mockResolvedValueOnce([]);

    const result = await getHomeMarket({ city: 'seoul', district: 'gangnam' });

    expect(result.counts.apt).toEqual({ status: 'error', data: null, code: 'UNAVAILABLE' });
    expect(result.counts.villa.status).toBe('ok');
    expect(result.recent).toEqual({ status: 'error', data: null, code: 'UNAVAILABLE' });
  });

  it('전체 query 실패는 503이고 캐시하지 않아 다음 요청에서 재시도한다', async () => {
    queryRawUnsafe.mockRejectedValue(new Error('db down'));

    await expect(getHomeMarket({ city: 'seoul', district: 'gangnam' })).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: 'UNAVAILABLE',
    });
    expect(queryRawUnsafe).toHaveBeenCalledTimes(6);

    await expect(getHomeMarket({ city: 'seoul', district: 'gangnam' })).rejects.toMatchObject<AppError>({
      statusCode: 503,
      code: 'UNAVAILABLE',
    });
    expect(queryRawUnsafe).toHaveBeenCalledTimes(12);
  });

  it('동일 key in-flight 요청을 합치고 기준일 변경 시 cache miss 처리한다', async () => {
    const resolvers: Array<(value: unknown[]) => void> = [];
    queryRawUnsafe.mockImplementation(() => new Promise((resolve) => { resolvers.push(resolve); }));

    const first = getHomeMarket({ city: 'seoul', district: 'gangnam' }, new Date('2026-09-21T12:00:00+09:00'));
    const second = getHomeMarket({ city: 'seoul', district: 'gangnam' }, new Date('2026-09-21T12:00:00+09:00'));
    await Promise.resolve();
    await Promise.resolve();
    expect(queryRawUnsafe).toHaveBeenCalledTimes(3);
    resolvers.splice(0).forEach((resolve) => resolve([]));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryRawUnsafe).toHaveBeenCalledTimes(6);
    resolvers.splice(0).forEach((resolve) => resolve([]));

    await Promise.all([first, second]);
    queryRawUnsafe.mockResolvedValue([]);
    await getHomeMarket({ city: 'seoul', district: 'gangnam' }, new Date('2026-09-22T00:01:00+09:00'));
    expect(queryRawUnsafe).toHaveBeenCalledTimes(12);
  });

  it('LRU cache를 500개로 제한한다', async () => {
    queryRawUnsafe.mockResolvedValue([]);

    await getHomeMarket({ city: 'seoul', district: 'gangnam' }, new Date('2026-09-21T12:00:00+09:00'));
    for (let i = 0; i < 500; i += 1) {
      const date = new Date('2026-01-01T12:00:00+09:00');
      date.setUTCDate(date.getUTCDate() + i);
      await getHomeMarket({}, date);
    }
    await getHomeMarket({ city: 'seoul', district: 'gangnam' }, new Date('2026-09-21T12:00:00+09:00'));

    expect(queryRawUnsafe.mock.calls.length).toBeGreaterThan(501 * 6);
  });
});
