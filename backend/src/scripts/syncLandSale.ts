#!/usr/bin/env tsx
// 토지 매매 실거래가 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import {
  fetchRealEstateData,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { runSync, batchUpsert, transformAndDedupe } from '../services/baseSyncService.js';

const API_ENDPOINT = 'RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade';
const CATEGORY = 'landSale';

const PYEONG_PER_SQM = 3.305;
const RECENT_MONTHS = 12;
const INDEX_RECENT_MIN = 5;
const INDEX_TOTAL_MIN = 10;

export interface LandTxnForSummary {
  dealAmount: number;
  dealArea: number;
  dealYear: number;
  dealMonth: number;
  jimok: string | null;
}

export interface AreaSummaryResult {
  transactionCount: number;
  recentCount: number;
  avgPricePerPyeong: number | null;
  jimokBreakdown: Record<string, number>;
  isIndexable: boolean;
}

export function computeAreaSummary(txns: LandTxnForSummary[], now: Date): AreaSummaryResult {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - RECENT_MONTHS + 1, 1);
  let recentCount = 0;
  const pyeongPrices: number[] = [];
  const jimokBreakdown: Record<string, number> = {};

  for (const t of txns) {
    const txnDate = new Date(t.dealYear, t.dealMonth - 1, 1);
    if (txnDate >= cutoff) recentCount++;

    if (t.dealArea && t.dealArea > 0) {
      const pyeong = t.dealArea / PYEONG_PER_SQM;
      pyeongPrices.push(t.dealAmount / pyeong);
    }
    const key = t.jimok && t.jimok.trim() ? t.jimok.trim() : '기타';
    jimokBreakdown[key] = (jimokBreakdown[key] ?? 0) + 1;
  }

  const avgPricePerPyeong = pyeongPrices.length
    ? Math.round((pyeongPrices.reduce((a, b) => a + b, 0) / pyeongPrices.length) * 100) / 100
    : null;
  const transactionCount = txns.length;
  const isIndexable = recentCount >= INDEX_RECENT_MIN || transactionCount >= INDEX_TOTAL_MIN;

  return { transactionCount, recentCount, avgPricePerPyeong, jimokBreakdown, isIndexable };
}

export interface RawLandSaleItem extends Record<string, unknown> {
  sggCd: string;
  umdNm: string;
  jibun: string;
  jimok: string;
  landUse: string;
  dealArea: string;
  dealAmount: string;
  shareDealingType: string;
  dealingGbn: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  cdealType: string;
  cdealDay: string;
  city: string;
  district: string;
}

function parseIntOrNull(value: string): number | null {
  const t = String(value ?? '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

export function transformLandSaleItem(item: RawLandSaleItem) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dongName = String(item.umdNm ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const jimokStr = String(item.jimok ?? '').trim();
  const landUseStr = String(item.landUse ?? '').trim();
  const areaStr = String(item.dealArea ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmountVal = BigInt(dealAmountStr || '0');

  const shareDeal = String(item.shareDealingType ?? '').trim() === '지분';

  const sourceId = [CATEGORY, bjdCode, dongName, jibunStr, dealYear, dealMonth, dayStr, areaStr, dealAmountStr].join('-');

  return {
    sourceId,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName,
    jibun: jibunStr || null,
    jimok: jimokStr || null,
    landUse: landUseStr || null,
    dealArea: areaStr || null,
    shareDeal,
    dealAmount: dealAmountVal,
    dealType: dealTypeStr || null,
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
  };
}

export async function refreshLandAreaSummary(): Promise<void> {
  const groups = await prisma.landSaleTransaction.findMany({
    select: { bjdCode: true, dongName: true, city: true, district: true },
    distinct: ['bjdCode', 'dongName'],
  });
  const now = new Date();

  for (const g of groups) {
    const rows = await prisma.landSaleTransaction.findMany({
      where: { bjdCode: g.bjdCode, dongName: g.dongName, cancelDealDay: null },
      select: { dealAmount: true, dealArea: true, dealYear: true, dealMonth: true, dealDay: true, jimok: true },
    });
    const txns: LandTxnForSummary[] = rows.map((r) => ({
      dealAmount: Number(r.dealAmount),
      dealArea: r.dealArea ? Number(r.dealArea) : 0,
      dealYear: r.dealYear,
      dealMonth: r.dealMonth,
      jimok: r.jimok,
    }));
    const summary = computeAreaSummary(txns, now);

    const latest = rows.reduce<Date | null>((acc, r) => {
      const d = new Date(r.dealYear, r.dealMonth - 1, r.dealDay ?? 1);
      return !acc || d > acc ? d : acc;
    }, null);

    await prisma.landAreaSummary.upsert({
      where: { bjdCode_dongName: { bjdCode: g.bjdCode, dongName: g.dongName } },
      create: {
        bjdCode: g.bjdCode, dongName: g.dongName, city: g.city, district: g.district,
        transactionCount: summary.transactionCount, recentCount: summary.recentCount,
        avgPricePerPyeong: summary.avgPricePerPyeong, latestDealDate: latest,
        jimokBreakdown: summary.jimokBreakdown, isIndexable: summary.isIndexable,
      },
      update: {
        city: g.city, district: g.district,
        transactionCount: summary.transactionCount, recentCount: summary.recentCount,
        avgPricePerPyeong: summary.avgPricePerPyeong, latestDealDate: latest,
        jimokBreakdown: summary.jimokBreakdown, isIndexable: summary.isIndexable,
      },
    });
  }
  console.info(`[landSale] LandAreaSummary 갱신: ${groups.length}개 동`);
}

export async function syncLandSaleByLawd(
  lawdCd: string,
  dealYmd: string,
  serviceKey: string,
  regionMap: Map<string, { city: string; district: string }>
): Promise<void> {
  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);
  if (items.length === 0) return;

  const regionInfo = regionMap.get(lawdCd) ?? { city: '', district: '' };
  const enriched = items.map((item) => ({
    ...(item as Record<string, unknown>),
    city: regionInfo.city,
    district: regionInfo.district,
  })) as RawLandSaleItem[];

  const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] as string[] };
  const records = transformAndDedupe(enriched, transformLandSaleItem, (r) => r.sourceId, stats);
  if (records.length === 0) return;

  await batchUpsert(records, async (record) => {
    const existing = await prisma.landSaleTransaction.findUnique({
      where: { sourceId: record.sourceId },
      select: { id: true },
    });
    await prisma.landSaleTransaction.upsert({
      where: { sourceId: record.sourceId },
      create: { ...record, syncedAt: new Date() },
      update: { ...record, syncedAt: new Date() },
    });
    return existing ? 'updated' : 'new';
  });
}

async function main(): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY environment variable is not set');

  const args = process.argv.slice(2);
  const lawdIndex = args.indexOf('--lawd');
  const ymIndex = args.indexOf('--ym');
  const lawdCdArg = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const dealYmdArg = ymIndex !== -1 ? args[ymIndex + 1] : undefined;

  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = new Map(regions.map((r) => [r.bjdCode, { city: r.city, district: r.district }]));

  await runSync(CATEGORY, async () => {
    const lawdCodes = lawdCdArg ? [lawdCdArg] : await getAllLawdCodes();
    const now = new Date();
    const ymList: string[] = [];
    if (dealYmdArg) {
      ymList.push(dealYmdArg);
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        ymList.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    console.info(`[landSale] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);
    for (const lawdCd of lawdCodes) {
      for (const ym of ymList) {
        try {
          await syncLandSaleByLawd(lawdCd, ym, serviceKey, regionMap);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[landSale] ${lawdCd}/${ym} 실패: ${msg}`);
        }
      }
    }
  });

  await refreshLandAreaSummary();

  console.info('\n=== landSale sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  installRuntimeGuard({ maxMinutes: 20, name: 'syncLandSale', prisma });
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
