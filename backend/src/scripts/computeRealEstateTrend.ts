// 부동산 거래 변동률 배치 (apt v1).
// 실행: `npm run compute:trend` (cron 또는 syncAll 후 수동).
//
// 메모리 [MySQL Zombie 사고]: 긴 트랜잭션 + per-item upsert 회피.
// → city·district 단위로 fetch → in-memory 집계 → 500건씩 트랜잭션으로 upsert.

import { prisma } from '../lib/prisma.js';
import {
  aggregateTransactions,
  upsertTrendRows,
  type TxType,
  type TxInput,
} from '../services/realEstateTrendService.js';
import { formatYearMonth, shiftMonth } from '../lib/realEstateTrendHelpers.js';

const MONTHS_BACK = 13; // 현재 월 + 과거 12개월 (전년 대비 비교용)

interface TxRecord {
  dongName: string;
  dealYear: number;
  dealMonth: number;
  exclusiveArea: { toString(): string } | null;
  dealAmount: bigint;
}

async function fetchTransactions(
  txType: TxType,
  city: string,
  district: string,
  startYear: number,
  startMonth: number
): Promise<TxInput[]> {
  const where = {
    city,
    district,
    OR: [
      { dealYear: { gt: startYear } },
      { dealYear: startYear, dealMonth: { gte: startMonth } },
    ],
  };
  const select = {
    dongName: true,
    dealYear: true,
    dealMonth: true,
    exclusiveArea: true,
    dealAmount: true,
  } as const;

  const txs: TxRecord[] =
    txType === 'sale'
      ? await prisma.aptSaleTransaction.findMany({ where, select })
      : await prisma.aptRentTransaction.findMany({ where, select });

  return txs.map((t) => ({
    dongName: t.dongName,
    dealYear: t.dealYear,
    dealMonth: t.dealMonth,
    exclusiveArea: t.exclusiveArea === null ? null : Number(t.exclusiveArea.toString()),
    dealAmount: t.dealAmount,
  }));
}

async function listCityDistricts(txType: TxType): Promise<Array<{ city: string; district: string }>> {
  if (txType === 'sale') {
    const rows = await prisma.aptSaleTransaction.groupBy({
      by: ['city', 'district'],
      orderBy: [{ city: 'asc' }, { district: 'asc' }],
    });
    return rows.map((r) => ({ city: r.city, district: r.district }));
  }
  const rows = await prisma.aptRentTransaction.groupBy({
    by: ['city', 'district'],
    orderBy: [{ city: 'asc' }, { district: 'asc' }],
  });
  return rows.map((r) => ({ city: r.city, district: r.district }));
}

async function main(): Promise<void> {
  let aborted = false;
  const handleSig = (sig: string): void => {
    console.warn(`[compute:trend] ${sig} 수신 — 현재 city·district 마무리 후 종료`);
    aborted = true;
  };
  process.on('SIGTERM', () => handleSig('SIGTERM'));
  process.on('SIGINT', () => handleSig('SIGINT'));

  const today = new Date();
  const currentYM = formatYearMonth(today.getFullYear(), today.getMonth() + 1);
  const startYM = shiftMonth(currentYM, -(MONTHS_BACK - 1));
  const [startYear, startMonth] = startYM.split('-').map((s) => Number(s));

  console.info(`[compute:trend] 기간: ${startYM} ~ ${currentYM}`);

  const totals = { sale: 0, rent: 0 };

  for (const txType of ['sale', 'rent'] as const) {
    if (aborted) break;
    const cityDistricts = await listCityDistricts(txType);
    console.info(`[compute:trend] ${txType}: ${cityDistricts.length}개 (city·district)`);

    for (const { city, district } of cityDistricts) {
      if (aborted) break;
      const txs = await fetchTransactions(txType, city, district, startYear, startMonth);
      if (txs.length === 0) continue;
      const rows = aggregateTransactions(city, district, txType, txs);
      if (rows.length === 0) continue;
      await upsertTrendRows(rows);
      totals[txType] += rows.length;
      console.info(`  ${txType} ${city} ${district}: ${txs.length} txs → ${rows.length} trend rows`);
    }
  }

  console.info(`[compute:trend] 완료 — sale: ${totals.sale} rows, rent: ${totals.rent} rows`);
  await prisma.$disconnect();
}

main().catch(async (err: unknown) => {
  console.error('[compute:trend] 실패:', err);
  await prisma.$disconnect();
  process.exit(1);
});
