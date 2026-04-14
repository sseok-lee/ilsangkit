#!/usr/bin/env tsx
// LH 공공임대 매물 동기화 스크립트
// API: data.myhome.go.kr/rentalHouseList (brtcCode + signguCode 필수)
// signguCode = MOIS 행정기관코드 3-5번째 자리 (예: 서울 종로구=110, 중구=140)

import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { runSync } from '../services/baseSyncService.js';
import type { SyncStats } from '../services/baseSyncService.js';

const API_BASE = 'https://data.myhome.go.kr:443/rentalHouseList';
const PAGE_SIZE = 100;

// 전국 주요 시군구 코드 (brtcCode: 시도, signguCode: MOIS 행정기관코드 3-5자리)
const REGIONS: { brtcCode: string; signguCode: string }[] = [
  // 서울특별시 (11)
  { brtcCode: '11', signguCode: '110' }, // 종로구
  { brtcCode: '11', signguCode: '140' }, // 중구
  { brtcCode: '11', signguCode: '170' }, // 용산구
  { brtcCode: '11', signguCode: '200' }, // 성동구
  { brtcCode: '11', signguCode: '215' }, // 광진구
  { brtcCode: '11', signguCode: '230' }, // 동대문구
  { brtcCode: '11', signguCode: '260' }, // 중랑구
  { brtcCode: '11', signguCode: '290' }, // 성북구
  { brtcCode: '11', signguCode: '305' }, // 강북구
  { brtcCode: '11', signguCode: '320' }, // 도봉구
  { brtcCode: '11', signguCode: '350' }, // 노원구
  { brtcCode: '11', signguCode: '380' }, // 은평구
  { brtcCode: '11', signguCode: '410' }, // 서대문구
  { brtcCode: '11', signguCode: '440' }, // 마포구
  { brtcCode: '11', signguCode: '470' }, // 양천구
  { brtcCode: '11', signguCode: '500' }, // 강서구
  { brtcCode: '11', signguCode: '530' }, // 구로구
  { brtcCode: '11', signguCode: '545' }, // 금천구
  { brtcCode: '11', signguCode: '560' }, // 영등포구
  { brtcCode: '11', signguCode: '590' }, // 동작구
  { brtcCode: '11', signguCode: '620' }, // 관악구
  { brtcCode: '11', signguCode: '650' }, // 서초구
  { brtcCode: '11', signguCode: '680' }, // 강남구
  { brtcCode: '11', signguCode: '710' }, // 송파구
  { brtcCode: '11', signguCode: '740' }, // 강동구
  // 부산광역시 (26)
  { brtcCode: '26', signguCode: '110' }, // 중구
  { brtcCode: '26', signguCode: '140' }, // 서구
  { brtcCode: '26', signguCode: '170' }, // 동구
  { brtcCode: '26', signguCode: '200' }, // 영도구
  { brtcCode: '26', signguCode: '230' }, // 부산진구
  { brtcCode: '26', signguCode: '260' }, // 동래구
  { brtcCode: '26', signguCode: '290' }, // 남구
  { brtcCode: '26', signguCode: '320' }, // 북구
  { brtcCode: '26', signguCode: '350' }, // 해운대구
  { brtcCode: '26', signguCode: '380' }, // 사하구
  { brtcCode: '26', signguCode: '410' }, // 금정구
  { brtcCode: '26', signguCode: '440' }, // 강서구
  { brtcCode: '26', signguCode: '470' }, // 연제구
  { brtcCode: '26', signguCode: '500' }, // 수영구
  { brtcCode: '26', signguCode: '530' }, // 사상구
  { brtcCode: '26', signguCode: '710' }, // 기장군
  // 대구광역시 (27)
  { brtcCode: '27', signguCode: '110' }, // 중구
  { brtcCode: '27', signguCode: '140' }, // 동구
  { brtcCode: '27', signguCode: '170' }, // 서구
  { brtcCode: '27', signguCode: '200' }, // 남구
  { brtcCode: '27', signguCode: '230' }, // 북구
  { brtcCode: '27', signguCode: '260' }, // 수성구
  { brtcCode: '27', signguCode: '290' }, // 달서구
  { brtcCode: '27', signguCode: '710' }, // 달성군
  // 인천광역시 (28)
  // ⚠️ 2026-07-01 개편 예정: 중구+동구 → 제물포구+영종구, 서구 → 서구+검단구 (신규 signguCode 미확정)
  { brtcCode: '28', signguCode: '110' }, // 중구 (→ 제물포구·영종구로 재편 예정)
  { brtcCode: '28', signguCode: '140' }, // 동구 (→ 제물포구로 편입 예정)
  { brtcCode: '28', signguCode: '177' }, // 미추홀구
  { brtcCode: '28', signguCode: '185' }, // 연수구
  { brtcCode: '28', signguCode: '200' }, // 남동구
  { brtcCode: '28', signguCode: '237' }, // 부평구
  { brtcCode: '28', signguCode: '245' }, // 계양구
  { brtcCode: '28', signguCode: '260' }, // 서구 (→ 서구+검단구 분리 예정)
  { brtcCode: '28', signguCode: '710' }, // 강화군
  // 광주광역시 (29)
  // ⚠️ 2026-07-01 광주+전남 → 전남광주통합특별시 출범 예정 (신규 brtcCode 미확정)
  { brtcCode: '29', signguCode: '110' }, // 동구
  { brtcCode: '29', signguCode: '140' }, // 서구
  { brtcCode: '29', signguCode: '155' }, // 남구
  { brtcCode: '29', signguCode: '170' }, // 북구
  { brtcCode: '29', signguCode: '200' }, // 광산구
  // 대전광역시 (30)
  { brtcCode: '30', signguCode: '110' }, // 동구
  { brtcCode: '30', signguCode: '140' }, // 중구
  { brtcCode: '30', signguCode: '170' }, // 서구
  { brtcCode: '30', signguCode: '200' }, // 유성구
  { brtcCode: '30', signguCode: '230' }, // 대덕구
  // 울산광역시 (31)
  { brtcCode: '31', signguCode: '110' }, // 중구
  { brtcCode: '31', signguCode: '140' }, // 남구
  { brtcCode: '31', signguCode: '170' }, // 동구
  { brtcCode: '31', signguCode: '200' }, // 북구
  { brtcCode: '31', signguCode: '710' }, // 울주군
  // 세종특별자치시 (36)
  { brtcCode: '36', signguCode: '110' },
  // 경기도 (41) - 주요 시
  { brtcCode: '41', signguCode: '111' }, // 수원시 장안구
  { brtcCode: '41', signguCode: '113' }, // 수원시 권선구
  { brtcCode: '41', signguCode: '115' }, // 수원시 팔달구
  { brtcCode: '41', signguCode: '117' }, // 수원시 영통구
  { brtcCode: '41', signguCode: '131' }, // 성남시 수정구
  { brtcCode: '41', signguCode: '133' }, // 성남시 중원구
  { brtcCode: '41', signguCode: '135' }, // 성남시 분당구
  { brtcCode: '41', signguCode: '150' }, // 의정부시
  { brtcCode: '41', signguCode: '171' }, // 안양시 만안구
  { brtcCode: '41', signguCode: '173' }, // 안양시 동안구
  { brtcCode: '41', signguCode: '190' }, // 부천시
  { brtcCode: '41', signguCode: '210' }, // 광명시
  { brtcCode: '41', signguCode: '220' }, // 평택시
  { brtcCode: '41', signguCode: '250' }, // 동두천시
  { brtcCode: '41', signguCode: '271' }, // 안산시 상록구
  { brtcCode: '41', signguCode: '273' }, // 안산시 단원구
  { brtcCode: '41', signguCode: '281' }, // 고양시 덕양구
  { brtcCode: '41', signguCode: '285' }, // 고양시 일산동구
  { brtcCode: '41', signguCode: '287' }, // 고양시 일산서구
  { brtcCode: '41', signguCode: '310' }, // 구리시
  { brtcCode: '41', signguCode: '360' }, // 남양주시
  { brtcCode: '41', signguCode: '390' }, // 시흥시
  { brtcCode: '41', signguCode: '410' }, // 군포시
  { brtcCode: '41', signguCode: '450' }, // 하남시
  { brtcCode: '41', signguCode: '461' }, // 용인시 처인구
  { brtcCode: '41', signguCode: '463' }, // 용인시 기흥구
  { brtcCode: '41', signguCode: '465' }, // 용인시 수지구
  { brtcCode: '41', signguCode: '480' }, // 파주시
  { brtcCode: '41', signguCode: '500' }, // 이천시
  { brtcCode: '41', signguCode: '570' }, // 김포시
  // ⚠️ 2026-02-01 시행: 화성시(590) → 만세구·효행구·병점구·동탄구 4개 일반구 신설
  // myhome API가 구 단위 signguCode를 지원하면 아래 4개로 교체 필요 (코드 확정 후 업데이트)
  { brtcCode: '41', signguCode: '590' }, // 화성시 (일반구 신설로 세분화 예정, API 지원 여부 확인 필요)
  { brtcCode: '41', signguCode: '610' }, // 광주시
  { brtcCode: '41', signguCode: '630' }, // 양주시
  // 강원도 (42) 주요 시
  { brtcCode: '42', signguCode: '110' }, // 춘천시
  { brtcCode: '42', signguCode: '130' }, // 원주시
  { brtcCode: '42', signguCode: '150' }, // 강릉시
  // 충청북도 (43) 주요 시
  { brtcCode: '43', signguCode: '111' }, // 청주시 상당구
  { brtcCode: '43', signguCode: '113' }, // 청주시 서원구
  { brtcCode: '43', signguCode: '115' }, // 청주시 흥덕구
  { brtcCode: '43', signguCode: '117' }, // 청주시 청원구
  { brtcCode: '43', signguCode: '130' }, // 충주시
  // 충청남도 (44) 주요 시
  { brtcCode: '44', signguCode: '130' }, // 천안시 동남구
  { brtcCode: '44', signguCode: '133' }, // 천안시 서북구
  { brtcCode: '44', signguCode: '150' }, // 공주시
  { brtcCode: '44', signguCode: '180' }, // 아산시
  // 전라북도 (45) 주요 시
  { brtcCode: '45', signguCode: '111' }, // 전주시 완산구
  { brtcCode: '45', signguCode: '113' }, // 전주시 덕진구
  { brtcCode: '45', signguCode: '130' }, // 군산시
  // 전라남도 (46) 주요 시
  // ⚠️ 2026-07-01 광주+전남 → 전남광주통합특별시 출범 예정 (신규 brtcCode 미확정)
  { brtcCode: '46', signguCode: '110' }, // 목포시
  { brtcCode: '46', signguCode: '130' }, // 여수시
  { brtcCode: '46', signguCode: '150' }, // 순천시
  // 경상북도 (47) 주요 시
  { brtcCode: '47', signguCode: '110' }, // 포항시 남구
  { brtcCode: '47', signguCode: '111' }, // 포항시 북구
  { brtcCode: '47', signguCode: '130' }, // 경주시
  { brtcCode: '47', signguCode: '150' }, // 김천시
  { brtcCode: '47', signguCode: '170' }, // 안동시
  // 경상남도 (48) 주요 시
  { brtcCode: '48', signguCode: '121' }, // 창원시 의창구
  { brtcCode: '48', signguCode: '123' }, // 창원시 성산구
  { brtcCode: '48', signguCode: '125' }, // 창원시 마산합포구
  { brtcCode: '48', signguCode: '127' }, // 창원시 마산회원구
  { brtcCode: '48', signguCode: '129' }, // 창원시 진해구
  { brtcCode: '48', signguCode: '170' }, // 진주시
  // 제주특별자치도 (50)
  { brtcCode: '50', signguCode: '110' }, // 제주시
  { brtcCode: '50', signguCode: '130' }, // 서귀포시
];

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

  for (const region of REGIONS) {
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
    .then(() => { console.log('✅ 공공임대 동기화 완료'); process.exit(0); })
    .catch((e) => { console.error('❌ 공공임대 동기화 실패:', e); process.exit(1); });
}

export { syncPublicRent };
