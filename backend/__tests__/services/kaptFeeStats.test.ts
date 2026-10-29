import { describe, it, expect, vi, beforeEach } from 'vitest';

const db = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  $transaction: vi.fn(),
  kaptFeeSggMedian: { deleteMany: vi.fn(), createMany: vi.fn(), count: vi.fn() },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: db }));

import {
  FEE_VALID_RANGE,
  NATIONAL_SGG,
  isValidMonthlyFee,
  pickBaseMonth,
  median,
  refreshFeeSggMedians,
  hasFeeSggMedians,
} from '../../src/services/kaptFeeStats.js';

describe('isValidMonthlyFee', () => {
  it('세대 평균 1만~200만 원만 정상', () => {
    expect(FEE_VALID_RANGE).toEqual({ min: 10_000, max: 2_000_000 });
    expect(isValidMonthlyFee(9_999)).toBe(false);
    expect(isValidMonthlyFee(10_000)).toBe(true);
    expect(isValidMonthlyFee(2_000_000)).toBe(true);
    expect(isValidMonthlyFee(2_000_001)).toBe(false);
    expect(isValidMonthlyFee(Number.NaN)).toBe(false);
  });
});

describe('pickBaseMonth', () => {
  it('단지 수가 가장 많은 달의 95% 이상인 가장 최근 달', () => {
    expect(pickBaseMonth([
      { yearMonth: '202607', complexes: 20_100 },
      { yearMonth: '202609', complexes: 11_370 },
      { yearMonth: '202608', complexes: 20_083 },
    ])).toBe('202608');
  });

  it('빈 목록이면 null', () => {
    expect(pickBaseMonth([])).toBeNull();
  });
});

describe('median', () => {
  it('홀수·짝수 개', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe('hasFeeSggMedians', () => {
  it('행이 있으면 true', async () => {
    db.kaptFeeSggMedian.count.mockResolvedValue(3);
    expect(await hasFeeSggMedians()).toBe(true);
    db.kaptFeeSggMedian.count.mockResolvedValue(0);
    expect(await hasFeeSggMedians()).toBe(false);
  });
});

describe('refreshFeeSggMedians', () => {
  // 세대 100, 면적 10,000㎡ — 공용 1,000만 원이면 ㎡당 1,000원, 세대 평균 합계 = (공용+개별+장충)/100
  function feeRow(kaptCode: string, common: number, extra: Partial<Record<string, unknown>> = {}) {
    return {
      kaptCode, commonTotal: BigInt(common), individualTotal: BigInt(10_000_000), ltrCharge: BigInt(1_000_000),
      householdCount: 100, managementArea: '10000.00', ...extra,
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    db.$transaction.mockResolvedValue([]);
    db.kaptFeeSggMedian.deleteMany.mockReturnValue('delete');
    db.kaptFeeSggMedian.createMany.mockReturnValue('create');
  });

  it('기준 월 정상 단지로 시군구(5단지 이상)·전국 중간값을 다시 만든다', async () => {
    const seoulRows = [10, 11, 12, 13, 14].map((n, i) => feeRow(`G${i}`, n * 1_000_000));
    db.$queryRaw
      .mockResolvedValueOnce([{ yearMonth: '202608', complexes: 20_083n }, { yearMonth: '202609', complexes: 11_370n }])
      .mockResolvedValueOnce([
        ...seoulRows,
        feeRow('S0', 9_000_000), // 시군구 4단지뿐 → 시군구 행 없음, 전국에는 들어간다
        feeRow('S1', 9_000_000),
        feeRow('S2', 9_000_000),
        feeRow('S3', 9_000_000),
        feeRow('X0', 500_000_000), // 세대 평균 511만 원 → 범위 밖, 제외
        feeRow('X1', 10_000_000, { householdCount: 0 }), // 세대수 0 → 제외
        feeRow('X2', 10_000_000, { managementArea: null }), // 면적 없음 → 제외
      ])
      .mockResolvedValueOnce([
        ...['G0', 'G1', 'G2', 'G3', 'G4'].map((kaptCode) => ({ kaptCode, sggCode: '11680' })),
        ...['S0', 'S1', 'S2', 'S3', 'X0', 'X1', 'X2'].map((kaptCode) => ({ kaptCode, sggCode: '26110' })),
      ]);

    const result = await refreshFeeSggMedians();

    expect(result).toEqual({ baseMonth: '202608', sggCount: 1 });
    expect(db.kaptFeeSggMedian.deleteMany).toHaveBeenCalledWith({});
    const { data } = db.kaptFeeSggMedian.createMany.mock.calls[0][0];
    expect(data).toEqual([
      { sggCode: NATIONAL_SGG, yearMonth: '202608', medianCommonPerM2: 1_000, complexCount: 9 },
      { sggCode: '11680', yearMonth: '202608', medianCommonPerM2: 1_200, complexCount: 5 },
    ]);
    expect(db.$transaction).toHaveBeenCalledWith(['delete', 'create']);
  });

  it('관리비 행이 없으면 아무것도 바꾸지 않는다', async () => {
    db.$queryRaw.mockResolvedValueOnce([]);
    expect(await refreshFeeSggMedians()).toEqual({ baseMonth: null, sggCount: 0 });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});
