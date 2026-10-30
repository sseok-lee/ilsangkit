import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryRawUnsafe, mockListKeys, mockAttach, deleteMany, createMany, transaction } = vi.hoisted(() => ({
  queryRawUnsafe: vi.fn(),
  deleteMany: vi.fn(),
  createMany: vi.fn(),
  transaction: vi.fn(),
  mockListKeys: vi.fn(),
  mockAttach: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    $queryRawUnsafe: queryRawUnsafe,
    $transaction: transaction,
    regionMarketSummary: { deleteMany, createMany },
  },
}));
vi.mock('../../src/services/baseSyncService.js', () => ({
  runSync: async (_c: string, fn: (s: { totalRecords: number }) => Promise<void>) => {
    const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] };
    await fn(stats);
    return stats;
  },
}));
vi.mock('../../src/services/marketRegionResolver.js', () => ({ listMarketRegionKeys: mockListKeys }));
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({ attachRealEstateCanonicalPaths: mockAttach }));

import {
  computeRegionMarketSummaries,
  histogramMedian,
  isRising,
  median,
  refreshRegionMarketSummaries,
  regionMarketWindows,
  yoyPct,
} from '../../src/services/regionMarketSummaryService.js';

describe('regionMarketWindows', () => {
  it('오늘(KST) 기준 4개 구간을 계산한다', () => {
    expect(regionMarketWindows('2026-10-30')).toEqual({
      last12: { from: '2025-10-30', to: '2026-10-29' },
      prev12: { from: '2024-10-30', to: '2025-10-29' },
      recent: { from: '2026-08-31', to: '2026-09-29' },
      prev: { from: '2026-08-01', to: '2026-08-30' },
    });
  });
});

describe('median', () => {
  it('홀수·짝수·빈 배열', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(3);
    expect(median([])).toBeNull();
  });
});

describe('histogramMedian', () => {
  it('짝수 건수는 가운데 둘 평균 반올림, 홀수·빈 값', () => {
    expect(histogramMedian(new Map([[1, 1], [2, 1], [3, 1], [4, 1]]))).toBe(3);
    expect(histogramMedian(new Map([[10, 2], [11, 2]]))).toBe(11);
    expect(histogramMedian(new Map([[5, 3]]))).toBe(5);
    expect(histogramMedian(new Map())).toBeNull();
  });
});

describe('yoyPct', () => {
  it('표본·null 조건', () => {
    expect(yoyPct(7840, 7120, 25)).toBe(10.1);
    expect(yoyPct(7840, 7120, 19)).toBeNull();
    expect(yoyPct(null, 7120, 30)).toBeNull();
    expect(yoyPct(7840, null, 30)).toBeNull();
  });
});

describe('isRising', () => {
  it('최소 거래량·직전 1건 이상·증가', () => {
    expect(isRising(20, 10)).toBe(true);
    expect(isRising(19, 5)).toBe(false);
    expect(isRising(30, 0)).toBe(false);
    expect(isRising(25, 25)).toBe(false);
  });
});

describe('computeRegionMarketSummaries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAttach.mockImplementation(async (rows: object[]) => rows.map((r) => ({ ...r, canonicalPath: '/p' })));
  });

  const keys = [
    { scope: 'nation', citySlug: '', districtSlug: '', label: '전국' },
    { scope: 'city', citySlug: 'seoul', districtSlug: '', label: '서울', queryCity: '서울특별시', districtLimit: ['강남구', '송파구'] },
    { scope: 'district', citySlug: 'seoul', districtSlug: 'gangnam', label: '서울 강남구', queryCity: '서울특별시', queryDistrict: '강남구' },
    { scope: 'district', citySlug: 'seoul', districtSlug: 'songpa', label: '서울 송파구', queryCity: '서울특별시', queryDistrict: '송파구' },
  ];

  it('SQL 에 직거래·취소 제외 조건이 들어가고 거래 0건 지역도 행이 생긴다', async () => {
    mockListKeys.mockResolvedValue(keys);
    queryRawUnsafe.mockImplementation(async (sql: string) => {
      if (sql.includes('GROUP BY city, district, cur, pp')) {
        return [
          { city: '서울', district: '강남구', cur: 1, pp: 8000, cnt: 3 },
          { city: '서울특별시', district: '강남구', cur: 0, pp: 7000, cnt: 1 },
        ];
      }
      if (sql.includes('ROW_NUMBER')) return [{ id: 1 }];
      if (sql.includes('volRecent')) {
        return [{ city: '서울특별시', district: '강남구', volRecent: 4, volPrev: 2 }];
      }
      return [
        { city: '서울특별시', district: '강남구', buildingName: 'A', bjdCode: '11680', dongName: '대치동', jibun: '1', area: '84.9', amount: 300000, date: '2026-01-02', transactionId: 1 },
      ];
    });

    const rows = await computeRegionMarketSummaries('2026-10-30');
    const sqls = queryRawUnsafe.mock.calls.map((c) => c[0] as string);
    for (const sql of sqls) {
      expect(sql).toContain("'직거래'");
      expect(sql).toContain('cancelDealDay');
      expect(sql).toContain('cancelDealType');
      expect(sql).toContain('dealDay IS NOT NULL');
    }
    expect(rows).toHaveLength(4);
    const gangnam = rows.find((r) => r.districtSlug === 'gangnam')!;
    expect(gangnam.ppMedian12m).toBe(8000);
    expect(gangnam.dealCount12m).toBe(3);
    expect(gangnam.ppMedianPrev12m).toBe(7000);
    expect(gangnam.volRecent).toBe(4);
    expect(gangnam.volPrev).toBe(2);
    expect(gangnam.topDeals[0]).toMatchObject({ buildingName: 'A', amount: 300000, canonicalPath: '/p' });
    expect(rows.find((r) => r.scope === 'nation')!.dealCount12m).toBe(3);
    const songpa = rows.find((r) => r.districtSlug === 'songpa')!;
    expect(songpa).toMatchObject({ ppMedian12m: null, dealCount12m: 0, topDeals: [], volRecent: 0, volPrev: 0 });
    expect(songpa.recentFrom).toBe('2026-08-31');
  });
});

describe('refreshRegionMarketSummaries', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockAttach.mockImplementation(async (rows: object[]) => rows.map((r) => ({ ...r, canonicalPath: '/p' })));
    deleteMany.mockReturnValue('DELETE');
    createMany.mockReturnValue('CREATE');
    transaction.mockResolvedValue([]);
    queryRawUnsafe.mockResolvedValue([]);
  });

  const nation = { scope: 'nation', citySlug: '', districtSlug: '', label: '전국' };

  it('계산이 throw 하면 deleteMany 를 호출하지 않는다', async () => {
    mockListKeys.mockRejectedValue(new Error('boom'));
    await expect(refreshRegionMarketSummaries('2026-10-30')).rejects.toThrow('boom');
    expect(deleteMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('0행이면 throw 하고 deleteMany 를 호출하지 않는다', async () => {
    mockListKeys.mockResolvedValue([]);
    await expect(refreshRegionMarketSummaries('2026-10-30')).rejects.toThrow();
    expect(deleteMany).not.toHaveBeenCalled();
    expect(transaction).not.toHaveBeenCalled();
  });

  it('정상이면 $transaction 1회에 delete→create 순서, totalRecords=행 수', async () => {
    mockListKeys.mockResolvedValue([nation]);
    const stats = await refreshRegionMarketSummaries('2026-10-30');
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(transaction.mock.calls[0][0]).toEqual(['DELETE', 'CREATE']);
    expect(createMany.mock.calls[0][0].data).toHaveLength(1);
    expect(stats.totalRecords).toBe(1);
  });
});
