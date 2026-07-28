import { prisma } from '../lib/prisma.js';
import * as facilityService from './facilityService.js';
import * as wasteScheduleService from './wasteScheduleService.js';
import type { FacilityCategory } from './facilityService.js';
import { ALL_CATEGORIES } from './categoryRegistry.js';
import { toKstDateString } from '../lib/dateUtils.js';

const SITEMAP_FACILITY_CATS: FacilityCategory[] = [
  'toilet', 'clothes', 'parking', 'library', 'hospital', 'pharmacy',
  'park', 'school', 'market', 'childcare', 'ev-charger', 'sports', 'aed',
];

// 부동산 사이트맵 쿼리는 6-table UNION으로 느림 — 6시간 모듈 레벨 캐시로 콜드 스타트 최소화
const SITEMAP_CACHE_TTL = 6 * 60 * 60 * 1000;
// lastmod은 건물의 "가장 최근 실거래월"(MAX dealYmd) 기반 — 매 sync마다 today로 오염되는 updatedAt 대신
// 실제 콘텐츠 변경 신호(실거래 발생)를 반영해 Google lastmod 신뢰(consistently/verifiably accurate)를 확보한다.
type RealEstateRow = {
  realEstateType: string;
  city: string;
  district: string;
  buildingName: string;
  bjdCode: string;
  lastmod: string;
};
// $queryRaw 원본 행: 정수식 MAX는 MySQL에서 BIGINT → Prisma가 bigint로 반환하므로 API 경계 전에 문자열로 변환한다.
type RealEstateRawRow = Omit<RealEstateRow, 'lastmod'> & { lastDealKey: bigint | number | null };
type HubRow = { realEstateType: string; city: string; district: string };
let realEstateMaxDealDateCache: { data: string | null; expiresAt: number } | null = null;

/** 테스트 전용 — 모듈 레벨 캐시 초기화 */
export function _resetSitemapCacheForTests() {
  realEstateMaxDealDateCache = null;
}

/**
 * `dealYear*10000 + dealMonth*100 + COALESCE(dealDay,1)` 정수 키를 W3C 'YYYY-MM-DD'로 변환.
 * month/day는 방어적으로 clamp(1..12, 1..31)해 항상 유효한 날짜 문자열을 반환한다.
 */
export function dealKeyToDateString(key: number): string {
  const y = Math.floor(key / 10000);
  const m = Math.min(12, Math.max(1, Math.floor((key % 10000) / 100)));
  const d = Math.min(31, Math.max(1, key % 100));
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const SITEMAP_FACILITY_LIMITS: Partial<Record<FacilityCategory, number>> = {
  'ev-charger': 20000,
  childcare: 15000,
  aed: 15000,
  sports: 10000,
  clothes: 10000,
};

async function getRealEstateBuildingCount(): Promise<number> {
  const result = await prisma.$queryRaw<[{ cnt: bigint }]>`
    SELECT COUNT(*) AS cnt FROM (
      SELECT 1 FROM AptSaleTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode
      UNION ALL
      SELECT 1 FROM AptRentTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode
      UNION ALL
      SELECT 1 FROM VillaSaleTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode
      UNION ALL
      SELECT 1 FROM VillaRentTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode
      UNION ALL
      SELECT 1 FROM OffitelSaleTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode
      UNION ALL
      SELECT 1 FROM OffitelRentTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode
    ) t
  `;
  return Number(result[0].cnt);
}

/**
 * 6개 부동산 트랜잭션 테이블 전체에서 가장 최근 실거래월(MAX dealYmd)을 'YYYY-MM-DD'로 반환.
 * 사이트맵 인덱스의 real-estate 청크 lastmod 용. dealYear/Month/Day에 인덱스가 있어 저비용,
 * 6시간 캐시 + sitemap.xml 호출 빈도 고려 시 허용 가능.
 * updatedAt 대신 dealYmd를 쓰는 이유: updatedAt은 매 sync(12개월 rolling window)마다 today로
 * 갱신돼 freshness 신호로 무의미하지만, dealYmd는 실제 거래 발생 시점이라 신뢰 가능.
 */
async function getRealEstateMaxDealDate(): Promise<string | null> {
  if (realEstateMaxDealDateCache && realEstateMaxDealDateCache.expiresAt > Date.now()) {
    return realEstateMaxDealDateCache.data;
  }
  try {
    const result = await prisma.$queryRaw<[{ maxKey: bigint | number | null }]>`
      SELECT MAX(k) AS maxKey FROM (
        SELECT MAX(dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)) AS k FROM AptSaleTransaction
        UNION ALL SELECT MAX(dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)) FROM AptRentTransaction
        UNION ALL SELECT MAX(dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)) FROM VillaSaleTransaction
        UNION ALL SELECT MAX(dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)) FROM VillaRentTransaction
        UNION ALL SELECT MAX(dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)) FROM OffitelSaleTransaction
        UNION ALL SELECT MAX(dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1)) FROM OffitelRentTransaction
      ) t
    `;
    const key = result[0]?.maxKey;
    const data = key == null ? null : dealKeyToDateString(Number(key));
    realEstateMaxDealDateCache = { data, expiresAt: Date.now() + SITEMAP_CACHE_TTL };
    return data;
  } catch (err) {
    console.error('[sitemap] getRealEstateMaxDealDate error:', err);
    return null;
  }
}

export async function getSitemapPageCounts() {
  const [facilities, wasteCount, wasteLatest, subCount, subLatest, realEstateCount, realEstateMaxDealDate] =
    await Promise.all([
      Promise.all(
        SITEMAP_FACILITY_CATS.map((cat) =>
          facilityService
            .getCategoryCountAndMaxDate(cat, SITEMAP_FACILITY_LIMITS[cat])
            .then((r) => ({
              category: cat,
              count: r.count,
              maxUpdatedAt: toKstDateString(r.maxUpdatedAt),
            }))
        )
      ),
      prisma.wasteSchedule.count(),
      prisma.wasteSchedule.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      prisma.subscription.count(),
      prisma.subscription.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      getRealEstateBuildingCount(),
      getRealEstateMaxDealDate(),
    ]);

  return {
    facilities,
    waste: {
      count: wasteCount,
      maxUpdatedAt: toKstDateString(wasteLatest?.updatedAt),
    },
    subscriptions: {
      count: subCount,
      maxUpdatedAt: toKstDateString(subLatest?.updatedAt),
    },
    realEstateBuildings: {
      count: realEstateCount,
      // dealYmd 기반 'YYYY-MM-DD' 문자열 (이미 KST date-only) — toKstDateString 불필요
      maxUpdatedAt: realEstateMaxDealDate,
    },
  };
}

export function isValidCategory(category: string): category is FacilityCategory {
  return ALL_CATEGORIES.includes(category as FacilityCategory);
}

export async function getFacilityIds(category: FacilityCategory, limit?: number) {
  return facilityService.getAllIds(category, limit);
}

export async function getWasteScheduleIds() {
  return wasteScheduleService.getAllIds();
}

export async function getWasteScheduleRegions() {
  return wasteScheduleService.getWasteScheduleRegions();
}

export async function getRegionCategoryCombinations() {
  return facilityService.getRegionCategoryCombinations();
}

export async function getSubscriptionIds() {
  return prisma.subscription.findMany({
    select: { id: true, updatedAt: true },
    orderBy: { id: 'asc' },
  });
}

/**
 * 사이트맵 생성용 부동산 건물 리스트.
 *
 * - 같은 건물이 매매/전월세 두 줄로 방출되도록 6-way realEstateType UNION
 * - (city, district, buildingName, bjdCode) 튜플 기준 GROUP BY
 * - buildingName 품질 필터: frontend `isValidBuildingName` 과 동일 규칙
 *   (빈값/공백/순수 숫자-하이픈 / 숫자로 시작하는 괄호 접두사 제외)
 * - 거래 건수 임계값 없음 — `shouldNoindexRealEstateDetail`이 buildingName 품질만 검사하므로
 *   같은 기준으로 sitemap에 포함. thin content 위험은 인근 단지 cross-property 섹션이 완화.
 * - city/district는 DB 원본 문자열 그대로 반환 → 프론트 사이트맵/IndexNow 단계에서 slug 변환
 */
export async function getRealEstateBuildings() {
  // RealEstateBuildingSummary 는 refreshRealEstateSummary 가 매일 새벽 갱신하는 건물 요약이다
  // (type × 건물, 387,013행). 종전에는 이 테이블을 두고도 거래 6.7M행을 UNION ALL + GROUP BY 로
  // 다시 집계해 56초가 걸렸고, 그래서 6시간 캐시(+169MB 상주)와 배포 워밍업이 필요했다.
  // 그 메모리 스파이크가 PM2 max_memory_restart(500MB)를 넘겨 사이트맵 생성 중 백엔드를
  // 재시작시켰다(2026-07-28). 프로덕션 실측: 이 쿼리 0.34초 / 종전 56초, URL 수 356,461 동일.
  //
  // 캐시를 두지 않는다 — 0.34초짜리를 6시간 메모리에 들고 있을 이유가 없고,
  // 그 상주 메모리가 애초에 문제의 원인이었다.
  const rows = await prisma.$queryRaw<RealEstateRawRow[]>`
    SELECT type AS realEstateType, city, district, buildingName, bjdCode,
           latestDealYear * 10000 + latestDealMonth * 100 + COALESCE(latestDealDay, 1) AS lastDealKey
    FROM RealEstateBuildingSummary
    WHERE buildingName IS NOT NULL
      AND buildingName != ''
      AND CHAR_LENGTH(buildingName) >= 2
      AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
      AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
  `;
  // BigInt(lastDealKey)를 API 경계 전에 'YYYY-MM-DD' 문자열로 변환 (res.json BigInt 직렬화 오류 방지)
  return rows.map((r) => ({
    realEstateType: r.realEstateType,
    city: r.city,
    district: r.district,
    buildingName: r.buildingName,
    bjdCode: r.bjdCode,
    lastmod: r.lastDealKey == null ? '' : dealKeyToDateString(Number(r.lastDealKey)),
  }));
}

/**
 * 사이트맵용 부동산 city/district 허브 조합 목록.
 *
 * 거래 건수 임계값 없음 — `shouldNoindexRealEstateDetail` 정책과 동일하게
 * 유효 buildingName 단지가 1개라도 있는 district는 모두 포함.
 *
 * city hub(/real-estate/apt-sale/seoul/)와
 * district hub(/real-estate/apt-sale/seoul/gangnam/) 사이트맵 생성에 사용.
 */
export async function getRealEstateCityDistrictHubs() {
  // 위와 같은 이유로 Summary 에서 읽는다. 프로덕션 실측 1.4초 / 종전 14.1초, 결과 1,463건 동일.
  return prisma.$queryRaw<HubRow[]>`
    SELECT DISTINCT type AS realEstateType, city, district
    FROM RealEstateBuildingSummary
    WHERE buildingName IS NOT NULL
      AND buildingName != ''
      AND CHAR_LENGTH(buildingName) >= 2
      AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
      AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
  `;
}
