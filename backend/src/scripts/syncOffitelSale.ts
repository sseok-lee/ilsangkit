#!/usr/bin/env tsx
// @TASK Phase2-6 - 오피스텔 매매 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { submitIndexNow, buildRealEstateUrls } from '../services/indexNowService.js';

const API_ENDPOINT = 'RTMSDataSvcOffiTrade/getRTMSDataSvcOffiTrade';

export interface RawOffitelSaleItem extends Record<string, unknown> {
  dealAmount: string;
  buildYear: string;
  floor: string;
  excluUseAr: string;
  offiNm: string;
  umdNm: string;
  sggCd: string;
  jibun: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  dealingGbn: string;
  cdealDay: string;
  cdealType: string;
  buyerGbn: string;
  slerGbn: string;
  city: string;
  district: string;
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

export function transformOffitelSaleItem(item: RawOffitelSaleItem) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);
  const buildYearStr = String(item.buildYear ?? '').trim();
  const floorStr = String(item.floor ?? '').trim();
  const areaStr = String(item.excluUseAr ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();

  if (!bjdCode || isNaN(dealYear) || isNaN(dealMonth)) return null;

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmount = BigInt(dealAmountStr || '0');

  const sourceId = generateSourceId('offitelSale', {
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
    buildingName: String(item.offiNm ?? '').trim(),
    buildYear: parseIntOrNull(buildYearStr),
    floor: parseIntOrNull(floorStr),
    exclusiveArea: parseFloatOrNull(areaStr),
    jibun: String(item.jibun ?? '').trim(),
    roadName: '',
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    dealAmount,
    dealType: dealTypeStr || null,
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
    buyerType: String(item.buyerGbn ?? '').trim() || null,
    sellerType: String(item.slerGbn ?? '').trim() || null,
  };
}

export async function syncOffitelSaleByLawd(lawdCd: string, dealYmd: string) {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';

  const regions = await prisma.region.findMany({
    where: { bjdCode: lawdCd },
    select: { bjdCode: true, city: true, district: true },
  });
  const regionInfo = regions[0] ?? { city: '', district: '' };

  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);

  const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0 };

  for (const raw of items) {
    const item = { ...raw, city: regionInfo.city, district: regionInfo.district } as unknown as RawOffitelSaleItem;
    const record = transformOffitelSaleItem(item);
    if (!record) continue;

    stats.totalRecords++;
    await prisma.offitelSaleTransaction.upsert({
      where: { sourceId: record.sourceId },
      create: { ...record, syncedAt: new Date() },
      update: { ...record, syncedAt: new Date() },
    });
    stats.newRecords++;
  }

  return stats;
}

async function main(): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) {
    throw new Error('OPENAPI_SERVICE_KEY environment variable is not set');
  }

  const args = process.argv.slice(2);
  const lawdIndex = args.indexOf('--lawd');
  const ymIndex = args.indexOf('--ym');
  const lawdCdArg = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const dealYmdArg = ymIndex !== -1 ? args[ymIndex + 1] : undefined;

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

  console.info(`[offitelSale] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);

  for (const lawdCd of lawdCodes) {
    for (const ym of ymList) {
      try {
        const stats = await syncOffitelSaleByLawd(lawdCd, ym);
        if (stats.totalRecords > 0) {
          console.info(`[offitelSale] ${lawdCd}/${ym}: ${stats.totalRecords}건`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[offitelSale] ${lawdCd}/${ym} 실패: ${msg}`);
      }
    }
  }

  // IndexNow: 동기화된 건물 URL 제출
  const buildings = await prisma.offitelSaleTransaction.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { buildingName: true, bjdCode: true },
    distinct: ['buildingName', 'bjdCode'],
  });
  if (buildings.length > 0) {
    const urls = buildRealEstateUrls('offitel', buildings.map(b => ({
      buildingName: b.buildingName,
      bjdCode: b.bjdCode,
    })));
    await submitIndexNow(urls);
  }

  console.info('\n=== offitelSale sync completed ===');
  await prisma.$disconnect();
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
