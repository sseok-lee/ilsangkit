#!/usr/bin/env tsx
// @TASK Phase2-5 - 빌라 전월세 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { runSync, batchUpsert, transformAndDedupe } from '../services/baseSyncService.js';

const API_ENDPOINT = 'RTMSDataSvcRHRent/getRTMSDataSvcRHRent';
const CATEGORY = 'villaRent';

/**
 * 공공데이터 API 원본 아이템 타입 (city/district는 Region 조회 후 주입)
 */
export interface RawVillaRentItem extends Record<string, unknown> {
  deposit: string;
  monthlyRent: string;
  contractTerm: string;
  mhouseNm: string;
  buildYear: string;
  floor: string;
  excluUseAr: string;
  umdNm: string;
  sggCd: string;
  jibun: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  city: string;
  district: string;
  houseType: string;
  contractType: string;
  preDeposit: string;
  preMonthlyRent: string;
  useRRRight: string;
}

/**
 * DB upsert용 변환 결과 타입
 */
export interface VillaRentRecord {
  sourceId: string;
  city: string;
  district: string;
  bjdCode: string;
  dongName: string;
  buildingName: string;
  buildYear: number | null;
  floor: number | null;
  exclusiveArea: number | null;
  jibun: string;
  roadName: string;
  dealYear: number;
  dealMonth: number;
  dealDay: number | null;
  deposit: bigint;
  monthlyRent: number | null;
  rentType: string;
  contractTerm: string | null;
  houseType: string | null;
  contractType: string | null;
  preDeposit: bigint | null;
  preMonthlyRent: number | null;
  useRenewalRight: string | null;
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

function parseFloatOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseFloat(trimmed);
  return isNaN(parsed) ? null : parsed;
}

/**
 * API 원본 아이템을 DB 레코드로 변환
 */
export function transformVillaRentItem(item: RawVillaRentItem): VillaRentRecord | null {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);
  const floor = String(item.floor ?? '').trim();
  const exclusiveAreaStr = String(item.excluUseAr ?? '').trim();
  const buildYearStr = String(item.buildYear ?? '').trim();

  if (!bjdCode || isNaN(dealYear) || isNaN(dealMonth)) return null;

  const depositStr = String(item.deposit ?? '').replace(/,/g, '').trim();
  const deposit = BigInt(depositStr || '0');

  const exclusiveArea = parseFloatOrNull(exclusiveAreaStr);

  const sourceId = generateSourceId(CATEGORY, {
    bjdCode,
    buildYear: buildYearStr,
    dealYear: String(dealYear),
    dealMonth: String(dealMonth),
    dealDay: String(item.dealDay ?? '').trim(),
    floor,
    area: exclusiveAreaStr,
  });

  const monthlyRentInt = parseIntOrNull(String(item.monthlyRent ?? '').trim());
  const rentType = monthlyRentInt !== null && monthlyRentInt > 0 ? '월세' : '전세';

  return {
    sourceId,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName: String(item.umdNm ?? '').trim(),
    buildingName: String(item.mhouseNm ?? '').trim(),
    buildYear: parseIntOrNull(buildYearStr),
    floor: parseIntOrNull(floor),
    exclusiveArea,
    jibun: String(item.jibun ?? '').trim(),
    roadName: '',
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(String(item.dealDay ?? '').trim()),
    deposit,
    monthlyRent: monthlyRentInt,
    rentType,
    contractTerm: String(item.contractTerm ?? '').trim() || null,
    houseType: String(item.houseType ?? '').trim() || null,
    contractType: String(item.contractType ?? '').trim() || null,
    preDeposit: (() => { const s = String(item.preDeposit ?? '').replace(/,/g, '').trim(); return s ? BigInt(s) : null; })(),
    preMonthlyRent: parseIntOrNull(String(item.preMonthlyRent ?? '').trim()),
    useRenewalRight: String(item.useRRRight ?? '').trim() || null,
  };
}

/**
 * 단일 법정동 코드 + 년월로 동기화
 */
async function syncByLawdAndYm(
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
  })) as RawVillaRentItem[];

  const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] as string[] };
  const records = transformAndDedupe(
    enriched,
    transformVillaRentItem,
    (r) => r.sourceId,
    stats
  );

  if (records.length === 0) return;

  await batchUpsert(records, async (record) => {
    const existing = await prisma.villaRentTransaction.findUnique({
      where: { sourceId: record.sourceId },
      select: { id: true },
    });
    await prisma.villaRentTransaction.upsert({
      where: { sourceId: record.sourceId },
      create: { ...record, syncedAt: new Date() },
      update: { ...record, syncedAt: new Date() },
    });
    return existing ? 'updated' : 'new';
  });
}

/**
 * 메인 동기화 함수
 */
async function syncVillaRent(options: { lawdCd?: string; dealYmd?: string }): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY environment variable is not set');
  }

  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = new Map(regions.map((r) => [r.bjdCode, { city: r.city, district: r.district }]));

  await runSync(CATEGORY, async (_stats) => {
    if (options.lawdCd && options.dealYmd) {
      await syncByLawdAndYm(options.lawdCd, options.dealYmd, serviceKey, regionMap);
      return;
    }

    const lawdCodes = options.lawdCd ? [options.lawdCd] : await getAllLawdCodes();
    const now = new Date();
    const ymList: string[] = [];

    if (options.dealYmd) {
      ymList.push(options.dealYmd);
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const ym = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
        ymList.push(ym);
      }
    }

    for (const lawdCd of lawdCodes) {
      for (const ym of ymList) {
        try {
          await syncByLawdAndYm(lawdCd, ym, serviceKey, regionMap);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[villaRent] ${lawdCd}/${ym} 실패: ${msg}`);
        }
      }
    }
  });
}

/**
 * CLI 진입점
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const lawdIndex = args.indexOf('--lawd');
  const ymIndex = args.indexOf('--ym');

  const lawdCd = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const dealYmd = ymIndex !== -1 ? args[ymIndex + 1] : undefined;

  await syncVillaRent({ lawdCd, dealYmd });
  console.info('\n=== villaRent sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
