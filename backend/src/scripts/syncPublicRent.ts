#!/usr/bin/env tsx
// LH 공공임대 매물 동기화 스크립트
// API: data.myhome.go.kr/rentalHouseList (brtcCode + signguCode 필수)
// 지역 코드: Region 테이블 bjdCode에서 동적 파생 (brtcCode=앞2자리, signguCode=3-5번째 자리)

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runSync } from '../services/baseSyncService.js';
import type { SyncStats } from '../services/baseSyncService.js';
import { processSubscriptions } from './geocodeSubscriptions.js';

const API_BASE = 'https://data.myhome.go.kr:443/rentalHouseList';
const PAGE_SIZE = 100;


export interface MyhomeRentalItem {
  hsmpSn: number;
  insttNm: string;
  brtcCode: string;
  brtcNm: string;
  signguCode: string;
  signguNm: string;
  hsmpNm: string;
  rnAdres: string;
  hshldCo: number;
  suplyTyNm: string;
  styleNm?: string;
  suplyPrvuseAr?: number;
  houseTyNm?: string;
  bassRentGtn?: number;
  bassMtRntchrg?: number;
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

  const res = await fetch(urlStr);
  if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

  const data = await res.json() as { code: string; msg?: string; hsmpList?: MyhomeRentalItem[] };
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
  const regions = regionRows.map((r) => ({
    brtcCode: r.bjdCode.slice(0, 2),
    signguCode: r.bjdCode.slice(2, 5),
  }));
  console.info(`Region 테이블에서 ${regions.length}개 시군구 로드`);

  for (const region of regions) {
    try {
      const first = await fetchRegionPage(region.brtcCode, region.signguCode, 1, serviceKey);
      if (first.items.length === 0) continue;

      allItems.push(...first.items);

      let fetched = first.items.length;
      let page = 2;
      while (fetched < first.totalCount) {
        const next = await fetchRegionPage(region.brtcCode, region.signguCode, page, serviceKey);
        allItems.push(...next.items);
        fetched += next.items.length;
        page++;
      }

      console.info(`  ${region.brtcCode}-${region.signguCode}: ${first.totalCount}건`);
      await new Promise((r) => setTimeout(r, 200)); // rate limit
    } catch (e) {
      console.warn(`  ${region.brtcCode}-${region.signguCode} skip:`, (e as Error).message);
    }
  }

  return allItems;
}

export function transformMyhomeItem(item: MyhomeRentalItem) {
  // API가 빈 값을 {} 로 반환하는 경우가 있으므로 타입 체크 필수
  const toNumber = (v: unknown): number | null =>
    typeof v === 'number' && isFinite(v) ? v : null;

  const deposit = toNumber(item.bassRentGtn);
  const monthly = toNumber(item.bassMtRntchrg);
  const area = toNumber(item.suplyPrvuseAr);
  const household = toNumber(item.hshldCo);

  return {
    complexCode: String(item.hsmpSn),
    complexName: (typeof item.rnAdres === 'string' && item.rnAdres) ? item.rnAdres : item.hsmpNm,
    city: item.brtcNm,
    district: item.signguNm,
    rentalType: item.suplyTyNm,
    houseType: (typeof item.houseTyNm === 'string' && item.houseTyNm) ? item.houseTyNm : null,
    householdCount: household,
    exclusiveArea: area,
    depositAmount: deposit !== null ? BigInt(deposit) : null,
    monthlyRent: monthly,
    landlordAgency: 'LH',
    sourceId: `lh-${item.hsmpSn}`,
  };
}

async function syncPublicRent(): Promise<SyncStats> {
  return runSync('public-rental', async (stats) => {
    console.info('LH 공공임대 매물 수집 시작...');
    const rawItems = await fetchAllRegions();
    stats.totalRecords = rawItems.length;
    console.info(`총 ${rawItems.length}건 수집`);

    // 중복 제거 (hsmpSn 기준)
    const seen = new Set<string>();
    const items = rawItems
      .map(transformMyhomeItem)
      .filter((item) => {
        if (seen.has(item.sourceId)) return false;
        seen.add(item.sourceId);
        return true;
      });

    // 배치 upsert (500건씩)
    const BATCH = 500;
    let newCount = 0;
    let updateCount = 0;

    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      await Promise.all(
        batch.map(async (item) => {
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
        await processSubscriptions(prisma);
        console.log('공공임대 주소 지오코딩 완료\n');
      } catch (err) {
        console.error('공공임대 주소 지오코딩 실패:', err);
      }
      process.exit(0);
    })
    .catch((e) => { console.error('❌ 공공임대 동기화 실패:', e); process.exit(1); });
}

export { syncPublicRent };
