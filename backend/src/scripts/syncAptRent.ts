#!/usr/bin/env tsx
// @TASK Phase2-3 - 아파트 전월세 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { runSync, batchUpsert, transformAndDedupe } from '../services/baseSyncService.js';
import { submitIndexNow, buildRealEstateUrlsV2 } from '../services/indexNowService.js';
import { isValidBuildingName } from '../lib/realEstateBuildingName.js';

const API_ENDPOINT = 'RTMSDataSvcAptRent/getRTMSDataSvcAptRent';
const CATEGORY = 'aptRent';

export interface RawAptRentItem extends Record<string, unknown> {
  deposit: string;
  monthlyRent: string;
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
  contractTerm: string;
  roadnm: string;
  contractType: string;
  preDeposit: string;
  preMonthlyRent: string;
  useRRRight: string;
  city: string;
  district: string;
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

export function transformAptRentItem(item: RawAptRentItem) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);
  const buildYearStr = String(item.buildYear ?? '').trim();
  const floorStr = String(item.floor ?? '').trim();
  const areaStr = String(item.excluUseAr ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const roadNameStr = String(item.roadnm ?? '').trim();
  const contractTermStr = String(item.contractTerm ?? '').trim();
  const monthlyRentStr = String(item.monthlyRent ?? '').trim();

  const depositStr = String(item.deposit ?? '').replace(/,/g, '').trim();
  const deposit = BigInt(depositStr || '0');

  const monthlyRentNum = parseIntOrNull(monthlyRentStr);
  const rentType = monthlyRentNum !== null && monthlyRentNum > 0 ? '월세' : '전세';

  const sourceId = generateSourceId(CATEGORY, {
    bjdCode,
    buildYear: buildYearStr,
    dealYear: String(dealYear),
    dealMonth: String(dealMonth),
    dealDay: dayStr,
    floor: floorStr,
    area: areaStr,
    deposit: depositStr,
    monthlyRent: monthlyRentStr,
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
    roadName: roadNameStr || null,
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    deposit,
    monthlyRent: monthlyRentNum,
    rentType,
    contractTerm: contractTermStr || null,
    contractType: String(item.contractType ?? '').trim() || null,
    preDeposit: (() => { const s = String(item.preDeposit ?? '').replace(/,/g, '').trim(); return s ? BigInt(s) : null; })(),
    preMonthlyRent: parseIntOrNull(String(item.preMonthlyRent ?? '').trim()),
    useRenewalRight: String(item.useRRRight ?? '').trim() || null,
  };
}

export async function syncAptRentByLawd(lawdCd: string, dealYmd: string, serviceKey: string, regionMap: Map<string, { city: string; district: string }>): Promise<void> {
  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);

  if (items.length === 0) return;

  const regionInfo = regionMap.get(lawdCd) ?? { city: '', district: '' };
  const enriched = items.map((item) => ({
    ...(item as Record<string, unknown>),
    city: regionInfo.city,
    district: regionInfo.district,
  })) as RawAptRentItem[];

  const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] as string[] };
  const records = transformAndDedupe(
    enriched,
    transformAptRentItem,
    (r) => r.sourceId,
    stats
  );

  if (records.length === 0) return;

  await batchUpsert(records, async (record) => {
    const existing = await prisma.aptRentTransaction.findUnique({
      where: { sourceId: record.sourceId },
      select: { id: true },
    });
    await prisma.aptRentTransaction.upsert({
      where: { sourceId: record.sourceId },
      create: { ...record, syncedAt: new Date() },
      update: { ...record, syncedAt: new Date() },
    });
    return existing ? 'updated' : 'new';
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
  const lawdCdArg = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const dealYmdArg = ymIndex !== -1 ? args[ymIndex + 1] : undefined;
  const fromArg = fromIndex !== -1 ? args[fromIndex + 1] : undefined;
  const toArg = toIndex !== -1 ? args[toIndex + 1] : undefined;

  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = new Map(regions.map((r) => [r.bjdCode, { city: r.city, district: r.district }]));

  await runSync(CATEGORY, async (_stats) => {
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

    console.info(`[aptRent] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);

    for (const lawdCd of lawdCodes) {
      for (const ym of ymList) {
        try {
          await syncAptRentByLawd(lawdCd, ym, serviceKey, regionMap);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[aptRent] ${lawdCd}/${ym} 실패: ${msg}`);
        }
      }
    }
  });

  // IndexNow: 동기화된 건물 URL 제출
  const buildings = await prisma.aptRentTransaction.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { buildingName: true, city: true, district: true },
    distinct: ['buildingName', 'city', 'district'],
  });
  const validBuildings = buildings.filter((b) => isValidBuildingName(b.buildingName));
  if (validBuildings.length > 0) {
    const urls = buildRealEstateUrlsV2(validBuildings.map(b => ({
      realEstateType: 'apt-rent' as const,
      city: b.city,
      district: b.district,
      buildingName: b.buildingName,
    })));
    console.info(`[aptRent] IndexNow: ${buildings.length} candidates → ${validBuildings.length} valid (filtered ${buildings.length - validBuildings.length})`);
    await submitIndexNow(urls);
  }

  console.info('\n=== aptRent sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  installRuntimeGuard({ maxMinutes: 20, name: 'syncAptRent', prisma });
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
