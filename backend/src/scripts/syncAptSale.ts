#!/usr/bin/env tsx
// @TASK Phase2-2 - 아파트 매매 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { submitIndexNow, buildRealEstateUrls } from '../services/indexNowService.js';

const API_ENDPOINT = 'RTMSDataSvcAptTrade/getRTMSDataSvcAptTrade';
const CATEGORY = 'aptSale';

export interface AptSaleItem {
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
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

export function transformAptSaleItem(item: AptSaleItem, city: string, district: string) {
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
    city,
    district,
    bjdCode,
    dongName: String(item.umdNm ?? '').trim(),
    buildingName: String(item.aptNm ?? '').trim(),
    buildYear: parseIntOrNull(buildYearStr),
    floor: parseIntOrNull(floorStr),
    exclusiveArea: areaStr || null,
    jibun: jibunStr || null,
    roadName: null,
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

export async function syncAptSaleByLawd(lawdCd: string, dealYmd: string) {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';

  const regions = await prisma.region.findMany({
    where: { bjdCode: lawdCd },
    select: { bjdCode: true, city: true, district: true },
  });
  const regionInfo = regions[0] ?? { city: '', district: '' };

  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);

  const stats = { totalRecords: items.length, newRecords: 0, updatedRecords: 0 };

  for (const raw of items) {
    const item = raw as unknown as AptSaleItem;
    const record = transformAptSaleItem(item, regionInfo.city, regionInfo.district);

    await prisma.aptSaleTransaction.upsert({
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
  const fromIndex = args.indexOf('--from');
  const toIndex = args.indexOf('--to');
  const lawdCdArg = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const dealYmdArg = ymIndex !== -1 ? args[ymIndex + 1] : undefined;
  const fromArg = fromIndex !== -1 ? args[fromIndex + 1] : undefined;
  const toArg = toIndex !== -1 ? args[toIndex + 1] : undefined;

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
        const stats = await syncAptSaleByLawd(lawdCd, ym);
        if (stats.totalRecords > 0) {
          console.info(`[aptSale] ${lawdCd}/${ym}: ${stats.totalRecords}건`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[aptSale] ${lawdCd}/${ym} 실패: ${msg}`);
      }
    }
  }

  // IndexNow: 동기화된 건물 URL 제출
  const buildings = await prisma.aptSaleTransaction.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { buildingName: true, bjdCode: true },
    distinct: ['buildingName', 'bjdCode'],
  });
  if (buildings.length > 0) {
    const urls = buildRealEstateUrls('apt', buildings.map(b => ({
      buildingName: b.buildingName,
      bjdCode: b.bjdCode,
    })));
    await submitIndexNow(urls);
  }

  // Summary 테이블 갱신
  console.info('\n[Summary] apt-sale 요약 갱신 중...');
  const { refreshSummary } = await import('../services/realEstateSummaryService.js');
  await refreshSummary('apt-sale');

  console.info('\n=== aptSale sync completed ===');
  await prisma.$disconnect();
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
