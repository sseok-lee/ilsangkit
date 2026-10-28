#!/usr/bin/env tsx
// @TASK Phase2-2 - 아파트 매매 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import { withRealEstateWriteLock } from '../utils/realEstateWriteLock.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
  buildRegionMap,
  toMolitLawdCode,
} from '../services/syncRealEstateBase.js';
import { runSync, batchUpsert, transformAndDedupe, createSyncStats, type SyncStats } from '../services/baseSyncService.js';
// IndexNow 제출 비활성화 (2026-09-01) — 아래 호출부 주석 참고.
// import { submitNewlyTransactedBuildings } from '../services/indexNowService.js';

// 상세 API: 기본 API(getRTMSDataSvcAptTrade)와 거래 목록·필드가 같고 도로명(roadNm·건물 본번/부번)이 더 온다.
// 기본 API 에는 도로명이 없어 매매 행의 roadName 이 늘 비어 있었다(단지 매칭의 도로명 단계가 전월세에만 기댐).
const API_ENDPOINT = 'RTMSDataSvcAptTradeDev/getRTMSDataSvcAptTradeDev';
const CATEGORY = 'aptSale';

export interface RawAptSaleItem extends Record<string, unknown> {
  dealAmount: string;
  buildYear: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  umdNm: string;
  aptNm: string;
  excluUseAr: string;
  jibun: string;
  sggCd: string;
  floor: string;
  dealingGbn: string;
  aptDong: string;
  cdealDay: string;
  cdealType: string;
  buyerGbn: string;
  slerGbn: string;
  rgstDate: string;
  /** 상세 API 전용. 도로명(번호 없음)과 건물 본번·부번(0 채움 5자리) */
  roadNm?: string;
  roadNmBonbun?: string;
  roadNmBubun?: string;
  city: string;
  district: string;
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

/** "개포로" + "00307" + "00000" → "개포로 307" (전월세 roadnm 과 같은 꼴). 도로명이 없으면 null. */
export function formatSaleRoadName(item: Pick<RawAptSaleItem, 'roadNm' | 'roadNmBonbun' | 'roadNmBubun'>): string | null {
  const road = String(item.roadNm ?? '').trim();
  if (!road) return null;
  const main = parseIntOrNull(String(item.roadNmBonbun ?? ''));
  if (!main) return road;
  const sub = parseIntOrNull(String(item.roadNmBubun ?? ''));
  return sub ? `${road} ${main}-${sub}` : `${road} ${main}`;
}

export function transformAptSaleItem(item: RawAptSaleItem) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);
  const buildYearStr = String(item.buildYear ?? '').trim();
  const floorStr = String(item.floor ?? '').trim();
  const areaStr = String(item.excluUseAr ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmountVal = BigInt(dealAmountStr || '0');

  const sourceId = generateSourceId(CATEGORY, {
    bjdCode,
    buildYear: buildYearStr,
    dealYear: String(dealYear),
    dealMonth: String(dealMonth),
    dealDay: dayStr,
    floor: floorStr,
    area: areaStr,
    dealAmount: dealAmountStr,
  });

  return {
    sourceId,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName: String(item.umdNm ?? '').trim(),
    buildingName: String(item.aptNm ?? '').trim(),
    buildYear: parseIntOrNull(buildYearStr),
    floor: parseIntOrNull(floorStr),
    exclusiveArea: areaStr || null,
    jibun: jibunStr || null,
    roadName: formatSaleRoadName(item),
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    dealAmount: dealAmountVal,
    dealType: dealTypeStr || null,
    aptDong: String(item.aptDong ?? '').trim() || null,
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
    buyerType: String(item.buyerGbn ?? '').trim() || null,
    sellerType: String(item.slerGbn ?? '').trim() || null,
    registrationDate: String(item.rgstDate ?? '').trim() || null,
  };
}

export async function syncAptSaleByLawd(
  lawdCd: string,
  dealYmd: string,
  serviceKey: string,
  regionMap: Map<string, { city: string; district: string }>,
  // 호출자(runSync)가 넘긴 stats 에 누적한다. 여기서 지역 변수를 새로 만들면
  // SyncHistory 카운터가 영원히 0으로 남는다 — baseSyncService.runSync 주석 참조.
  stats: SyncStats = createSyncStats(),
): Promise<void> {
  return withRealEstateWriteLock('syncAptSaleByLawd', async () => {
  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);

  if (items.length === 0) return;

  stats.totalRecords += items.length;

  const regionInfo = regionMap.get(lawdCd) ?? { city: '', district: '' };
  const enriched = items.map((item) => ({
    ...(item as Record<string, unknown>),
    city: regionInfo.city,
    district: regionInfo.district,
  })) as RawAptSaleItem[];

  const records = transformAndDedupe(
    enriched,
    transformAptSaleItem,
    (r) => r.sourceId,
    stats
  );

  if (records.length === 0) return;

  const { newCount, updateCount } = await batchUpsert(records, async (record) => {
    const existing = await prisma.aptSaleTransaction.findUnique({
      where: { sourceId: record.sourceId },
      select: { id: true },
    });
    await prisma.aptSaleTransaction.upsert({
      where: { sourceId: record.sourceId },
      create: { ...record, syncedAt: new Date() },
      update: { ...record, syncedAt: new Date() },
    });
    return existing ? 'updated' : 'new';
  });

  stats.newRecords += newCount;
  stats.updatedRecords += updateCount;

  });
}

async function main(): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY environment variable is not set');
  }

  const args = process.argv.slice(2);
  const lawdIndex = args.indexOf('--lawd');
  const ymIndex = args.indexOf('--ym');
  const fromIndex = args.indexOf('--from');
  const toIndex = args.indexOf('--to');
  const lawdCdRaw = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const lawdCdArg = lawdCdRaw ? toMolitLawdCode(lawdCdRaw) : undefined;
  const dealYmdArg = ymIndex !== -1 ? args[ymIndex + 1] : undefined;
  const fromArg = fromIndex !== -1 ? args[fromIndex + 1] : undefined;
  const toArg = toIndex !== -1 ? args[toIndex + 1] : undefined;

  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = buildRegionMap(regions);

  await runSync(CATEGORY, async (stats) => {
    const lawdCodes = lawdCdArg ? [lawdCdArg] : await getAllLawdCodes();
    const now = new Date();
    const ymList: string[] = [];

    if (fromArg && toArg) {
      const start = new Date(parseInt(fromArg.slice(0, 4), 10), parseInt(fromArg.slice(4, 6), 10) - 1, 1);
      const end = new Date(parseInt(toArg.slice(0, 4), 10), parseInt(toArg.slice(4, 6), 10) - 1, 1);
      for (let d = new Date(start); d <= end; d.setMonth(d.getMonth() + 1)) {
        ymList.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    } else if (dealYmdArg) {
      ymList.push(dealYmdArg);
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        ymList.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }

    console.info(`[aptSale] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);

    for (const lawdCd of lawdCodes) {
      for (const ym of ymList) {
        try {
          await syncAptSaleByLawd(lawdCd, ym, serviceKey, regionMap, stats);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[aptSale] ${lawdCd}/${ym} 실패: ${msg}`);
        }
      }
    }
  });

  // IndexNow 제출 비활성화 (2026-09-01) — 부동산이 크롤 큐 앞자리를 독점해
  // 시설 상세 화석의 재크롤이 밀린다. 근거와 복구 조건은
  // submitNewlyTransactedBuildings 주석의 "2026-09-01 호출부 비활성화" 참고.
  // await submitNewlyTransactedBuildings(
  //   prisma.aptSaleTransaction,
  //   'apt-sale',
  //   'aptSale',
  //   new Date(Date.now() - 2 * 60 * 60 * 1000),
  // );

  console.info('\n=== aptSale sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  installRuntimeGuard({ maxMinutes: 20, name: 'syncAptSale', prisma });
  withRealEstateWriteLock('syncAptSale', main).catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
