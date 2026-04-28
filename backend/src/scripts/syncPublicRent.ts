#!/usr/bin/env tsx
// LH 공공임대 매물 동기화 스크립트
// API: data.myhome.go.kr/rentalHouseList (brtcCode + signguCode 필수)
// 지역 코드: Region 테이블 bjdCode에서 동적 파생 (brtcCode=앞2자리, signguCode=3-5번째 자리)

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runSync } from '../services/baseSyncService.js';
import type { SyncStats } from '../services/baseSyncService.js';
import { processPublicRentals } from './geocodePublicRent.js';

const API_BASE = 'https://data.myhome.go.kr:443/rentalHouseList';
const PAGE_SIZE = 1000;
const MAX_RETRIES = 2;
const RETRY_BACKOFF_MS = 500;

// myhome API 가 가끔 일시적 5xx 를 던지면 region 단위로 통째로 skip 되는 사고가 있어
// 5xx 에 한해 짧게 backoff retry. 4xx 는 즉시 throw (서버 측 영구 오류).
async function fetchWithRetry(url: string): Promise<Response> {
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url);
    } catch (err) {
      // 네트워크 에러 — retry 대상.
      lastErr = err;
      if (attempt === MAX_RETRIES) throw err;
      await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
      continue;
    }
    if (res.ok) return res;
    // 4xx 는 영구 오류 — 즉시 throw (retry 무의미).
    if (res.status < 500 || attempt === MAX_RETRIES) {
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    // 5xx — backoff 후 retry.
    lastErr = new Error(`HTTP ${res.status} ${res.statusText}`);
    await new Promise((r) => setTimeout(r, RETRY_BACKOFF_MS * (attempt + 1)));
  }
  throw lastErr instanceof Error ? lastErr : new Error('fetchWithRetry exhausted');
}


export interface MyhomeRentalItem {
  hsmpSn: number;
  insttNm?: string;
  brtcCode: string;
  brtcNm: string;
  signguCode: string;
  signguNm: string;
  hsmpNm?: string;
  rnAdres: string;
  hshldCo?: number;
  suplyTyNm: string;
  styleNm?: string;
  suplyPrvuseAr?: number;
  houseTyNm?: string;
  bassRentGtn?: number;
  bassMtRntchrg?: number;
  // 신규 필드 (API #15058476)
  pnu?: string;
  competDe?: string;
  suplyCmnuseAr?: number;
  heatMthdDetailNm?: string;
  buldStleNm?: string;
  elvtrInstlAtNm?: string;
  parkngCo?: number;
  bassCnvrsGtnLmt?: number;
}

async function fetchRegionPage(
  brtcCode: string,
  signguCode: string,
  pageNo: number,
  serviceKey: string
): Promise<{ items: MyhomeRentalItem[]; totalCount: number }> {
  const url = new URL(API_BASE);
  url.searchParams.set('brtcCode', brtcCode);
  url.searchParams.set('signguCode', signguCode);
  url.searchParams.set('numOfRows', String(PAGE_SIZE));
  url.searchParams.set('pageNo', String(pageNo));
  const urlStr = `${url.toString()}&ServiceKey=${serviceKey}`;

  const res = await fetchWithRetry(urlStr);
  const data = await res.json() as { code: string; msg?: string; hsmpList?: MyhomeRentalItem[] };
  if (data.code === '22') throw new Error(`RATE_LIMIT: ${data.msg ?? 'API 일일 호출 한도 초과'}`);
  if (data.code !== '000') return { items: [], totalCount: 0 };

  const list = data.hsmpList ?? [];
  const totalCount = list[0] ? (list[0] as unknown as Record<string, number>)['totalCount'] ?? 0 : 0;
  return { items: list, totalCount };
}

async function fetchAllRegions(): Promise<MyhomeRentalItem[]> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY 환경변수가 설정되지 않았습니다.');

  const allItems: MyhomeRentalItem[] = [];

  // Region 테이블에서 전국 시군구 코드를 동적으로 가져옴 — 행정구역 변경 시 자동 반영
  const regionRows = await prisma.region.findMany({
    select: { bjdCode: true },
    distinct: ['bjdCode'],
  });
  const seenRegion = new Set<string>();
  const regions = regionRows
    .map((r) => ({ brtcCode: r.bjdCode.slice(0, 2), signguCode: r.bjdCode.slice(2, 5) }))
    .filter(({ brtcCode, signguCode }) => {
      const key = `${brtcCode}-${signguCode}`;
      if (seenRegion.has(key)) return false;
      seenRegion.add(key);
      return true;
    });
  console.info(`Region 테이블에서 ${regions.length}개 시군구 로드 (동 중복 제거 후)`);

  for (const region of regions) {
    try {
      const first = await fetchRegionPage(region.brtcCode, region.signguCode, 1, serviceKey);
      if (first.items.length === 0) continue;

      allItems.push(...first.items);

      let fetched = first.items.length;
      let page = 2;
      while (fetched < first.totalCount) {
        const next = await fetchRegionPage(region.brtcCode, region.signguCode, page, serviceKey);
        if (next.items.length === 0) break; // 빈 페이지 → 무한루프 방지
        allItems.push(...next.items);
        fetched += next.items.length;
        page++;
      }

      console.info(`  ${region.brtcCode}-${region.signguCode}: ${first.totalCount}건`);
      await new Promise((r) => setTimeout(r, 200)); // rate limit
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.startsWith('RATE_LIMIT')) {
        console.warn(`[RATE_LIMIT] 일일 API 호출 한도 초과 — 이후 지역 수집 중단. 수집된 건수: ${allItems.length}`);
        break;
      }
      console.warn(`  ${region.brtcCode}-${region.signguCode} skip:`, msg);
    }
  }

  return allItems;
}

export function transformMyhomeItem(item: MyhomeRentalItem) {
  // API가 빈 값을 {} 로 반환하는 경우가 있으므로 타입 체크 필수
  const toNumber = (v: unknown): number | null =>
    typeof v === 'number' && isFinite(v) ? v : null;
  const toStr = (v: unknown): string | null =>
    typeof v === 'string' && v.length > 0 ? v : null;

  const deposit = toNumber(item.bassRentGtn);
  const monthly = toNumber(item.bassMtRntchrg);
  const area = toNumber(item.suplyPrvuseAr);
  const household = toNumber(item.hshldCo);
  const convDeposit = toNumber(item.bassCnvrsGtnLmt);
  const commonArea = toNumber(item.suplyCmnuseAr);
  const parking = toNumber(item.parkngCo);

  return {
    complexCode: String(item.hsmpSn),
    complexName: (typeof item.rnAdres === 'string' && item.rnAdres) ? item.rnAdres : (item.hsmpNm ?? ''),
    city: item.brtcNm,
    district: item.signguNm,
    rentalType: item.suplyTyNm,
    houseType: toStr(item.houseTyNm),
    householdCount: household,
    exclusiveArea: area,
    depositAmount: deposit !== null ? BigInt(deposit) : null,
    monthlyRent: monthly,
    conversionDeposit: convDeposit !== null ? BigInt(convDeposit) : null,
    landlordAgency: toStr(item.insttNm) ?? 'LH',
    pnu: toStr(item.pnu),
    completionDate: toStr(item.competDe),
    commonArea,
    heatingMethod: toStr(item.heatMthdDetailNm),
    buildingStyle: toStr(item.buldStleNm),
    hasElevator: toStr(item.elvtrInstlAtNm),
    parkingCount: parking !== null ? Math.round(parking) : null,
    complexNameKor: toStr(item.hsmpNm),
    sourceId: `lh-${item.hsmpSn}-${item.suplyTyNm}-${item.suplyPrvuseAr ?? 0}`,
  };
}

async function syncPublicRent(): Promise<SyncStats> {
  return runSync('public-rental', async (stats) => {
    console.info('LH 공공임대 매물 수집 시작...');
    const rawItems = await fetchAllRegions();
    stats.totalRecords = rawItems.length;
    console.info(`총 ${rawItems.length}건 수집`);

    const seen = new Set<string>();
    const items = rawItems.map(transformMyhomeItem).filter((item) => {
      if (seen.has(item.sourceId)) return false;
      seen.add(item.sourceId);
      return true;
    });
    console.info(`중복 제거 후 ${items.length}건 (원본 ${rawItems.length}건)`);

    // upsert (concurrency 제한 — Prisma 풀 thrashing 방지).
    // 이전엔 batch=500 동시 실행이라 connection pool 압박 + MySQL 좀비 패턴 위험.
    const CONCURRENCY = 20;
    let newCount = 0;
    let updateCount = 0;

    for (let i = 0; i < items.length; i += CONCURRENCY) {
      const slice = items.slice(i, i + CONCURRENCY);
      await Promise.all(
        slice.map(async (item) => {
          const existing = await prisma.publicRentalComplex.findUnique({
            where: { sourceId: item.sourceId },
            select: { id: true },
          });
          await prisma.publicRentalComplex.upsert({
            where: { sourceId: item.sourceId },
            create: item,
            update: {
              complexName: item.complexName,
              city: item.city,
              district: item.district,
              rentalType: item.rentalType,
              houseType: item.houseType,
              householdCount: item.householdCount,
              exclusiveArea: item.exclusiveArea,
              depositAmount: item.depositAmount,
              monthlyRent: item.monthlyRent,
              conversionDeposit: item.conversionDeposit,
              landlordAgency: item.landlordAgency,
              pnu: item.pnu,
              completionDate: item.completionDate,
              commonArea: item.commonArea,
              heatingMethod: item.heatingMethod,
              buildingStyle: item.buildingStyle,
              hasElevator: item.hasElevator,
              parkingCount: item.parkingCount,
              complexNameKor: item.complexNameKor,
            },
          });
          if (existing) updateCount++; else newCount++;
        })
      );
    }

    stats.newRecords = newCount;
    stats.updatedRecords = updateCount;
    console.info(`완료 — 신규: ${newCount}, 업데이트: ${updateCount}`);
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncPublicRent()
    .then(async () => {
      console.log('✅ 공공임대 동기화 완료');
      try {
        console.log('\n공공임대 주소 지오코딩 시작...');
        await processPublicRentals(prisma);
        console.log('공공임대 주소 지오코딩 완료\n');
      } catch (err) {
        console.error('공공임대 주소 지오코딩 실패:', err);
      }
      process.exit(0);
    })
    .catch((e) => { console.error('❌ 공공임대 동기화 실패:', e); process.exit(1); });
}

export { syncPublicRent, fetchWithRetry };
