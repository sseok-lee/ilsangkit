#!/usr/bin/env tsx
// Land Sale Transaction 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { submitIndexNow, buildRealEstateUrls } from '../services/indexNowService.js';

const API_ENDPOINT = 'RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade';
const CATEGORY = 'landSale';

// 국토교통부 토지 매매 API(LandTrade) 실제 응답 필드
export interface LandSaleItem {
  sggCd: string;
  sggNm: string;
  umdNm: string;
  jibun: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  dealAmount: string;            // 콤마 포함 — "750,000"
  dealArea: string;              // 거래면적 m²
  jimok: string;                 // 지목 (대/전/답/임야 등)
  landUse: string;               // 용도지역 (제1종일반주거지역 등)
  dealingGbn: string;            // 중개거래/직거래
  shareDealingType: string;      // 지분 거래 유형
  estateAgentSggNm: string;      // 중개사 소재지
  cdealDay: string;
  cdealType: string;
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

export function transformLandSaleItem(item: LandSaleItem, city: string, district: string) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);
  const dayStr = String(item.dealDay ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();
  const dealAreaStr = String(item.dealArea ?? '').trim();
  const jimokStr = String(item.jimok ?? '').trim();
  const landUseStr = String(item.landUse ?? '').trim();
  const shareDealingTypeStr = String(item.shareDealingType ?? '').trim();
  const estateAgentSggNmStr = String(item.estateAgentSggNm ?? '').trim();
  const sggNmStr = String(item.sggNm ?? '').trim();
  const dongNameStr = String(item.umdNm ?? '').trim();

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmountVal = BigInt(dealAmountStr || '0');

  // buildingName 합성: "{dongName} {jibun}" 또는 '미상'
  const buildingName = `${dongNameStr} ${jibunStr}`.trim() || '미상';

  const sourceId = generateSourceId(CATEGORY, {
    bjdCode,
    buildYear: '0', // Land has no buildYear
    dealYear: String(dealYear),
    dealMonth: String(dealMonth),
    dealDay: dayStr,
    floor: '0', // Land has no floor
    area: dealAreaStr,
    dealAmount: dealAmountStr,
  });

  return {
    sourceId,
    city,
    district,
    bjdCode,
    sggNm: sggNmStr || null,
    dongName: dongNameStr,
    buildingName,
    jibun: jibunStr || null,
    roadName: null,
    lat: null,
    lng: null,
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    dealAmount: dealAmountVal,
    dealArea: dealAreaStr || null,
    jimok: jimokStr || null,
    landUse: landUseStr || null,
    shareDealingType: shareDealingTypeStr || null,
    estateAgentSggNm: estateAgentSggNmStr || null,
    dealType: dealTypeStr || null,
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
  };
}

export async function syncLandSaleByLawd(lawdCd: string, dealYmd: string) {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';

  const regions = await prisma.region.findMany({
    where: { bjdCode: lawdCd },
    select: { bjdCode: true, city: true, district: true },
  });
  const regionInfo = regions[0] ?? { city: '', district: '' };

  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);

  const stats = { totalRecords: items.length, newRecords: 0, updatedRecords: 0 };

  for (const raw of items) {
    const item = raw as unknown as LandSaleItem;
    const record = transformLandSaleItem(item, regionInfo.city, regionInfo.district);

    await prisma.landSaleTransaction.upsert({
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

  console.info(`[landSale] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);

  for (const lawdCd of lawdCodes) {
    for (const ym of ymList) {
      try {
        const stats = await syncLandSaleByLawd(lawdCd, ym);
        if (stats.totalRecords > 0) {
          console.info(`[landSale] ${lawdCd}/${ym}: ${stats.totalRecords}건`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[landSale] ${lawdCd}/${ym} 실패: ${msg}`);
      }
    }
  }

  // IndexNow: 동기화된 건물 URL 제출
  const buildings = await prisma.landSaleTransaction.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { buildingName: true, bjdCode: true },
    distinct: ['buildingName', 'bjdCode'],
  });
  if (buildings.length > 0) {
    const urls = buildRealEstateUrls('land', buildings.map(b => ({
      buildingName: b.buildingName,
      bjdCode: b.bjdCode,
    })));
    await submitIndexNow(urls);
  }

  // Summary 테이블 갱신
  console.info('\n[Summary] land-sale 요약 갱신 중...');
  const { refreshSummary } = await import('../services/realEstateSummaryService.js');
  await refreshSummary('land-sale');

  console.info('\n=== landSale sync completed ===');
  await prisma.$disconnect();
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
