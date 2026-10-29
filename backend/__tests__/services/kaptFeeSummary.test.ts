import { describe, it, expect } from 'vitest';
import gaepo from '../fixtures/kaptFeeGaepo.json';
import { summarizeMaintenanceFee, type FeeMonthRow } from '../../src/services/kaptFeeSummary.js';

const OFFICE = { phone: '02-575-1234', address: '서울특별시 강남구 개포로 109길 9' };

function input(overrides: Partial<Parameters<typeof summarizeMaintenanceFee>[0]> = {}) {
  return {
    rows: gaepo.rows as FeeMonthRow[],
    baseMonth: '202608',
    householdCount: gaepo.householdCount,
    managementArea: gaepo.managementArea,
    sggMedian: { median: 1527, complexCount: 178 },
    office: OFFICE,
    ...overrides,
  };
}

/** 세대 평균 합계가 amount(원)인 달 — 세대수 2,296 기준 */
function monthRow(yearMonth: string, perHousehold: number): FeeMonthRow {
  return { yearMonth, commonTotal: perHousehold * 2296, individualTotal: 0, ltrCharge: 0 };
}

const without = (...months: string[]) => (gaepo.rows as FeeMonthRow[]).filter((r) => !months.includes(r.yearMonth));

describe('summarizeMaintenanceFee — 개포래미안포레스트 실제 값', () => {
  const summary = summarizeMaintenanceFee(input())!;

  it('기준 월 세대 평균과 구성', () => {
    expect(summary.month).toBe('2026-08');
    expect(summary.total).toBe(444578);
    expect(summary.common).toBe(173395);
    expect(summary.individual).toBe(252105);
    expect(summary.longTermRepair).toBe(19078);
  });

  it('여름·겨울·연평균', () => {
    expect(summary.summer).toEqual({ from: '2026-07', to: '2026-08', amount: 435664, months: 2 });
    expect(summary.winter).toEqual({ from: '2025-12', to: '2026-02', amount: 473096, months: 3 });
    expect(summary.yearly).toEqual({ from: '2025-09', to: '2026-08', amount: 414348, months: 12 });
  });

  it('월별: 기준 월로 끝나는 12개월 + 뒤에 일부만 올라온 달은 partial', () => {
    expect(summary.monthly).toHaveLength(13);
    expect(summary.monthly[0].month).toBe('2025-09');
    expect(summary.monthly.find((m) => m.month === '2026-01')).toEqual({ month: '2026-01', amount: 491205, partial: false });
    expect(summary.monthly.at(-1)).toEqual({ month: '2026-09', amount: 377106, partial: true });
    expect(summary.monthly.slice(0, 12).every((m) => !m.partial)).toBe(true);
  });

  it('㎡당 공용관리비와 같은 시군구 중간값', () => {
    expect(summary.commonPerM2).toEqual({ complex: 1626, sggMedian: 1527, sggComplexCount: 178 });
  });

  it('항목 상세: 0 원 항목은 빼고, 공용·전용은 합친다', () => {
    expect(summary.items.every((item) => item.amount > 0)).toBe(true);
    expect(summary.items[0]).toEqual({ group: 'common', label: '일반관리비', amount: 49305 });
    expect(summary.items.map((item) => item.label)).toEqual([
      '일반관리비', '청소비', '경비비',
      '난방비', '급탕비', '전기료', '수도료',
      '장기수선충당금',
    ]);
    // 난방비 = 공용 12,635,410 + 전용 0, 전기료 = 공용 109,882,048 + 전용 318,077,792
    expect(summary.items.find((item) => item.label === '난방비')?.amount).toBe(5503);
    expect(summary.items.find((item) => item.label === '전기료')?.amount).toBe(186394);
    expect(summary.items.find((item) => item.label === '장기수선충당금')).toEqual({ group: 'longTermRepair', label: '장기수선충당금', amount: 19078 });
  });

  it('관리사무소는 그대로', () => {
    expect(summary.office).toEqual(OFFICE);
  });
});

describe('summarizeMaintenanceFee — 대체·숨김 규칙', () => {
  it('기준 월이 없으면 최대 2개월 전까지 최근 달로 대체하고 ㎡ 비교는 숨긴다', () => {
    const summary = summarizeMaintenanceFee(input({ rows: without('202608', '202609') }))!;
    expect(summary.month).toBe('2026-07');
    expect(summary.total).toBe(426750);
    expect(summary.commonPerM2).toBeNull();
  });

  it('기준 월부터 2개월 전까지 값이 없으면 null', () => {
    expect(summarizeMaintenanceFee(input({ rows: without('202606', '202607', '202608', '202609') }))).toBeNull();
  });

  it('기준 월 세대 평균이 범위 밖이면 이전 달로 대체하지 않고 null', () => {
    expect(summarizeMaintenanceFee(input({ rows: [...without('202608'), monthRow('202608', 9_999)] }))).toBeNull();
    expect(summarizeMaintenanceFee(input({ rows: [...without('202608'), monthRow('202608', 2_000_001)] }))).toBeNull();
  });

  it('범위 밖인 달은 월별·계절에서 빠지고, 여름은 그 전 해 7·8월로', () => {
    const summary = summarizeMaintenanceFee(input({ rows: [...without('202607'), monthRow('202607', 5_000_000)] }))!;
    expect(summary.monthly.some((m) => m.month === '2026-07')).toBe(false);
    // 2025-07 (387,598,684+559,094,912+48,633,408)/2296, 2025-08 (386,796,002+559,544,960+48,633,408)/2296
    expect(summary.summer).toEqual({ from: '2025-07', to: '2025-08', amount: 433428, months: 2 });
  });

  it('12개월 중 정상 달이 10개 미만이면 연평균 없음', () => {
    const summary = summarizeMaintenanceFee(input({ rows: without('202509', '202510', '202511') }))!;
    expect(summary.yearly).toBeNull();
  });

  it('겨울 세 달 중 하나라도 없으면 그 전 겨울, 그것도 없으면 null', () => {
    // 2025-01·02 는 있지만 2024-12 가 없어 그 전 겨울도 안 된다
    expect(summarizeMaintenanceFee(input({ rows: without('202601') }))!.winter).toBeNull();
    const withDec2024 = [...without('202601'), monthRow('202412', 400_000)];
    expect(summarizeMaintenanceFee(input({ rows: withDec2024 }))!.winter).toMatchObject({ from: '2024-12', to: '2025-02', months: 3 });
  });

  it('세대수가 0·없음이면 null, 관리비부과면적·시군구 중간값이 없으면 ㎡ 비교만 숨긴다', () => {
    expect(summarizeMaintenanceFee(input({ householdCount: 0 }))).toBeNull();
    expect(summarizeMaintenanceFee(input({ householdCount: null }))).toBeNull();
    expect(summarizeMaintenanceFee(input({ managementArea: null }))!.commonPerM2).toBeNull();
    expect(summarizeMaintenanceFee(input({ sggMedian: null }))!.commonPerM2).toBeNull();
    expect(summarizeMaintenanceFee(input({ managementArea: null }))!.total).toBe(444578);
  });
});
