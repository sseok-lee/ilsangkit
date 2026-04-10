#!/usr/bin/env tsx
// Store Sale Transaction 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { submitIndexNow, buildRealEstateUrls } from '../services/indexNowService.js';

const API_ENDPOINT = 'RTMSDataSvcNrgTrade/getRTMSDataSvcNrgTrade';
const CATEGORY = 'storeSale';

// 국토교통부 상업·업무용 부동산 매매 API(NRG) 실제 응답 필드
export interface StoreSaleItem {
  sggCd: string;
  sggNm: string;
  umdNm: string;
  jibun: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  dealAmount: string;            // 콤마 포함 — "372,900"
  buildYear: string;
  floor: string;
  buildingAr: string;            // 건물면적 m²
  plottageAr: string;            // 대지면적 m² (집합은 빈 값)
  buildingUse: string;           // 주용도 (제1종근린생활시설 등)
  buildingType: string;          // 집합/일반
  landUse: string;               // 용도지역 (제3종일반주거 등)
  dealingGbn: string;            // 중개거래/직거래
  shareDealingType: string;      // 지분 거래 유형
  estateAgentSggNm: string;      // 중개사 소재지
  cdealDay: string;
  cdealType: string;
  buyerGbn: string;
  slerGbn: string;
}

function parseIntOrNull(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = parseInt(trimmed, 10);
  return isNaN(parsed) ? null : parsed;
}

export function transformStoreSaleItem(item: StoreSaleItem, city: string, district: string) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);
  const buildYearStr = String(item.buildYear ?? '').trim();
  const floorStr = String(item.floor ?? '').trim();
  const buildingArStr = String(item.buildingAr ?? '').trim();
  const plottageArStr = String(item.plottageAr ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const dongNameStr = String(item.umdNm ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();
  const buildingUseStr = String(item.buildingUse ?? '').trim();
  const buildingTypeStr = String(item.buildingType ?? '').trim();
  const landUseStr = String(item.landUse ?? '').trim();
  const shareDealingTypeStr = String(item.shareDealingType ?? '').trim();
  const estateAgentSggNmStr = String(item.estateAgentSggNm ?? '').trim();
  const sggNmStr = String(item.sggNm ?? '').trim();

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmountVal = BigInt(dealAmountStr || '0');

  // 상가 API는 건물명을 제공하지 않으므로 "{법정동} {지번}" 합성값 사용
  const buildingName = `${dongNameStr} ${jibunStr}`.trim() || '미상';

  const sourceId = generateSourceId(CATEGORY, {
    bjdCode,
    buildYear: buildYearStr,
    dealYear: String(dealYear),
    dealMonth: String(dealMonth),
    dealDay: dayStr,
    floor: floorStr,
    area: buildingArStr,
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
    buildYear: parseIntOrNull(buildYearStr),
    floor: parseIntOrNull(floorStr),
    buildingAr: buildingArStr || null,
    plottageAr: plottageArStr || null,
    buildingUse: buildingUseStr || null,
    buildingType: buildingTypeStr || null,
    landUse: landUseStr || null,
    jibun: jibunStr || null,
    roadName: null,
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    dealAmount: dealAmountVal,
    dealType: dealTypeStr || null,
    shareDealingType: shareDealingTypeStr || null,
    estateAgentSggNm: estateAgentSggNmStr || null,
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
    buyerType: String(item.buyerGbn ?? '').trim() || null,
    sellerType: String(item.slerGbn ?? '').trim() || null,
  };
}

export async function syncStoreSaleByLawd(lawdCd: string, dealYmd: string) {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';

  const regions = await prisma.region.findMany({
    where: { bjdCode: lawdCd },
    select: { bjdCode: true, city: true, district: true },
  });
  const regionInfo = regions[0] ?? { city: '', district: '' };

  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);

  const stats = { totalRecords: items.length, newRecords: 0, updatedRecords: 0 };

  for (const raw of items) {
    const item = raw as unknown as StoreSaleItem;
    const record = transformStoreSaleItem(item, regionInfo.city, regionInfo.district);

    await prisma.storeSaleTransaction.upsert({
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

  console.info(`[storeSale] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);

  for (const lawdCd of lawdCodes) {
    for (const ym of ymList) {
      try {
        const stats = await syncStoreSaleByLawd(lawdCd, ym);
        if (stats.totalRecords > 0) {
          console.info(`[storeSale] ${lawdCd}/${ym}: ${stats.totalRecords}건`);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[storeSale] ${lawdCd}/${ym} 실패: ${msg}`);
      }
    }
  }

  // 좌표 보강 (Kakao Geocoding) — 좌표 없는 신규 건물만 대상
  if (process.env.KAKAO_REST_API_KEY) {
    console.info('\n[Geocode] storeSaleTransaction 좌표 보강 중...');
    const { processTable } = await import('./geocodeRealEstate.js');
    try {
      await processTable(prisma, 'storeSaleTransaction');
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`[Geocode] storeSaleTransaction 보강 실패: ${msg}`);
    }
  } else {
    console.info('\n[Geocode] KAKAO_REST_API_KEY 미설정 — 좌표 보강 건너뜀');
  }

  // IndexNow: 동기화된 건물 URL 제출
  const buildings = await prisma.storeSaleTransaction.findMany({
    where: { syncedAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) } },
    select: { buildingName: true, bjdCode: true },
    distinct: ['buildingName', 'bjdCode'],
  });
  if (buildings.length > 0) {
    const urls = buildRealEstateUrls('store', buildings.map(b => ({
      buildingName: b.buildingName,
      bjdCode: b.bjdCode,
    })));
    await submitIndexNow(urls);
  }

  // Summary 테이블 갱신
  console.info('\n[Summary] store-sale 요약 갱신 중...');
  const { refreshSummary } = await import('../services/realEstateSummaryService.js');
  await refreshSummary('store-sale');

  console.info('\n=== storeSale sync completed ===');
  await prisma.$disconnect();
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
