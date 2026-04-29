import { describe, expect, it } from 'vitest';
import {
  aggregateTransactions,
  type TxInput,
} from '../../src/services/realEstateTrendService.js';

function makeTx(
  dong: string,
  year: number,
  month: number,
  area: number,
  amount: number
): TxInput {
  return {
    dongName: dong,
    dealYear: year,
    dealMonth: month,
    exclusiveArea: area,
    dealAmount: BigInt(amount),
  };
}

describe('aggregateTransactions', () => {
  it('빈 입력 → []', () => {
    expect(aggregateTransactions('서울특별시', '마포구', 'sale', [])).toEqual([]);
  });

  it('5건 미만 그룹은 결과에서 제외 (hide)', () => {
    const txs = [
      makeTx('상암동', 2026, 4, 84, 100000),
      makeTx('상암동', 2026, 4, 84, 100000),
      makeTx('상암동', 2026, 4, 84, 100000),
      makeTx('상암동', 2026, 4, 84, 100000),
    ];
    expect(aggregateTransactions('서울특별시', '마포구', 'sale', txs)).toEqual([]);
  });

  it('5건 이상 그룹은 평균 계산 (trimmed mean 10%)', () => {
    // 84㎡대 5건 — trimmed 10%면 0개 trim (floor(0.5)=0), 평균 100000
    const txs = Array.from({ length: 5 }, () => makeTx('상암동', 2026, 4, 84, 100000));
    const rows = aggregateTransactions('서울특별시', '마포구', 'sale', txs);
    expect(rows).toHaveLength(1);
    expect(rows[0].avgPrice).toBe(BigInt(100000));
    expect(rows[0].txCount).toBe(5);
    expect(rows[0].dong).toBe('상암동');
    expect(rows[0].areaBucket).toBe('84㎡대');
    expect(rows[0].yearMonth).toBe('2026-04');
  });

  it('이상치는 trim으로 평균에 영향이 작음', () => {
    // 10건: 9건 100000, 1건 1000000 (이상치)
    const txs: TxInput[] = [
      ...Array.from({ length: 9 }, () => makeTx('상암동', 2026, 4, 84, 100000)),
      makeTx('상암동', 2026, 4, 84, 1000000),
    ];
    const rows = aggregateTransactions('서울특별시', '마포구', 'sale', txs);
    expect(rows).toHaveLength(1);
    // 10건에 trim 10%면 양쪽 1개씩 제거 → 8건 모두 100000 → avg 100000
    expect(rows[0].avgPrice).toBe(BigInt(100000));
    expect(rows[0].txCount).toBe(10);
  });

  it('동·평형·yearMonth 단위로 그룹 분리', () => {
    const txs: TxInput[] = [
      ...Array.from({ length: 5 }, () => makeTx('상암동', 2026, 4, 59, 80000)),
      ...Array.from({ length: 5 }, () => makeTx('상암동', 2026, 4, 84, 120000)),
      ...Array.from({ length: 5 }, () => makeTx('망원동', 2026, 4, 84, 110000)),
    ];
    const rows = aggregateTransactions('서울특별시', '마포구', 'sale', txs);
    expect(rows).toHaveLength(3);
    const sangam59 = rows.find((r) => r.dong === '상암동' && r.areaBucket === '59㎡대');
    const sangam84 = rows.find((r) => r.dong === '상암동' && r.areaBucket === '84㎡대');
    const mangwon84 = rows.find((r) => r.dong === '망원동' && r.areaBucket === '84㎡대');
    expect(sangam59?.avgPrice).toBe(BigInt(80000));
    expect(sangam84?.avgPrice).toBe(BigInt(120000));
    expect(mangwon84?.avgPrice).toBe(BigInt(110000));
  });

  it('전월·전3개월·전년 변동률 계산', () => {
    const baseAmount = 100000;
    const prevMonth = 90000; // -10% MoM
    const prev3Month = 80000; // (100000-80000)/80000 = +25%
    const prevYear = 95000; // (100000-95000)/95000 ≈ +5.26%

    const txs: TxInput[] = [
      // 2026-04 (현재월)
      ...Array.from({ length: 5 }, () => makeTx('상암동', 2026, 4, 84, baseAmount)),
      // 2026-03 (전월)
      ...Array.from({ length: 5 }, () => makeTx('상암동', 2026, 3, 84, prevMonth)),
      // 2026-01 (전3개월)
      ...Array.from({ length: 5 }, () => makeTx('상암동', 2026, 1, 84, prev3Month)),
      // 2025-04 (전년)
      ...Array.from({ length: 5 }, () => makeTx('상암동', 2025, 4, 84, prevYear)),
    ];

    const rows = aggregateTransactions('서울특별시', '마포구', 'sale', txs);
    const current = rows.find((r) => r.yearMonth === '2026-04');

    expect(current).toBeDefined();
    expect(current?.prevMonthAvg).toBe(BigInt(prevMonth));
    expect(current?.prev3MonthAvg).toBe(BigInt(prev3Month));
    expect(current?.prevYearAvg).toBe(BigInt(prevYear));
    expect(current?.monthOverMonth).toBeCloseTo((baseAmount - prevMonth) / prevMonth, 5);
    expect(current?.qtrOverQtr).toBeCloseTo((baseAmount - prev3Month) / prev3Month, 5);
    expect(current?.yearOverYear).toBeCloseTo((baseAmount - prevYear) / prevYear, 5);
  });

  it('과거 데이터가 없으면 변동률 null', () => {
    const txs = Array.from({ length: 5 }, () => makeTx('상암동', 2026, 4, 84, 100000));
    const rows = aggregateTransactions('서울특별시', '마포구', 'sale', txs);
    expect(rows[0].prevMonthAvg).toBeNull();
    expect(rows[0].monthOverMonth).toBeNull();
    expect(rows[0].qtrOverQtr).toBeNull();
    expect(rows[0].yearOverYear).toBeNull();
  });

  it('exclusiveArea null → 기타 버킷', () => {
    const txs: TxInput[] = Array.from({ length: 5 }, () => ({
      dongName: '상암동',
      dealYear: 2026,
      dealMonth: 4,
      exclusiveArea: null,
      dealAmount: BigInt(100000),
    }));
    const rows = aggregateTransactions('서울특별시', '마포구', 'sale', txs);
    expect(rows[0].areaBucket).toBe('기타');
  });

  it('txType은 입력 그대로 전달 (sale / rent)', () => {
    const txs = Array.from({ length: 5 }, () => makeTx('상암동', 2026, 4, 84, 100000));
    expect(aggregateTransactions('서울특별시', '마포구', 'sale', txs)[0].txType).toBe('sale');
    expect(aggregateTransactions('서울특별시', '마포구', 'rent', txs)[0].txType).toBe('rent');
  });
});
