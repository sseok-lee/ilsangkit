import { prisma } from '../lib/prisma.js';
import * as facilityService from './facilityService.js';
import * as wasteScheduleService from './wasteScheduleService.js';
import type { FacilityCategory } from './facilityService.js';
import { ALL_CATEGORIES } from './categoryRegistry.js';

const SITEMAP_FACILITY_CATS: FacilityCategory[] = [
  'toilet', 'clothes', 'parking', 'library', 'hospital', 'pharmacy',
  'park', 'school', 'market', 'childcare', 'ev-charger', 'sports', 'aed',
];

// 부동산 사이트맵 쿼리는 6-table UNION으로 느림 — 6시간 모듈 레벨 캐시로 콜드 스타트 최소화
const SITEMAP_CACHE_TTL = 6 * 60 * 60 * 1000;
type RealEstateRow = { realEstateType: string; city: string; district: string; buildingName: string; bjdCode: string };
type HubRow = { realEstateType: string; city: string; district: string };
let buildingsCache: { data: RealEstateRow[]; expiresAt: number } | null = null;
let hubsCache: { data: HubRow[]; expiresAt: number } | null = null;

/** 테스트 전용 — 모듈 레벨 캐시 초기화 */
export function _resetSitemapCacheForTests() {
  buildingsCache = null;
  hubsCache = null;
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
        GROUP BY city, district, buildingName, bjdCode HAVING COUNT(*) >= 10
      UNION ALL
      SELECT 1 FROM AptRentTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode HAVING COUNT(*) >= 10
      UNION ALL
      SELECT 1 FROM VillaSaleTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode HAVING COUNT(*) >= 10
      UNION ALL
      SELECT 1 FROM VillaRentTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode HAVING COUNT(*) >= 10
      UNION ALL
      SELECT 1 FROM OffitelSaleTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode HAVING COUNT(*) >= 10
      UNION ALL
      SELECT 1 FROM OffitelRentTransaction
        WHERE buildingName IS NOT NULL AND buildingName != '' AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY city, district, buildingName, bjdCode HAVING COUNT(*) >= 10
    ) t
  `;
  return Number(result[0].cnt);
}

export async function getSitemapPageCounts() {
  const [facilities, wasteCount, wasteLatest, subCount, subLatest, realEstateCount] =
    await Promise.all([
      Promise.all(
        SITEMAP_FACILITY_CATS.map((cat) =>
          facilityService
            .getCategoryCountAndMaxDate(cat, SITEMAP_FACILITY_LIMITS[cat])
            .then((r) => ({
              category: cat,
              count: r.count,
              maxUpdatedAt: r.maxUpdatedAt?.toISOString().split('T')[0] ?? null,
            }))
        )
      ),
      prisma.wasteSchedule.count(),
      prisma.wasteSchedule.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      prisma.subscription.count(),
      prisma.subscription.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
      getRealEstateBuildingCount(),
    ]);

  return {
    facilities,
    waste: {
      count: wasteCount,
      maxUpdatedAt: wasteLatest?.updatedAt?.toISOString().split('T')[0] ?? null,
    },
    subscriptions: {
      count: subCount,
      maxUpdatedAt: subLatest?.updatedAt?.toISOString().split('T')[0] ?? null,
    },
    realEstateBuildings: { count: realEstateCount },
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
 * - 거래 10건 미만 단지 제외 (thin content 회피)
 * - city/district는 DB 원본 문자열 그대로 반환 → 프론트 사이트맵/IndexNow 단계에서 slug 변환
 */
export async function getRealEstateBuildings() {
  if (buildingsCache && buildingsCache.expiresAt > Date.now()) return buildingsCache.data;
  const result = await prisma.$queryRaw<RealEstateRow[]>`
    SELECT realEstateType, city, district, buildingName, bjdCode
    FROM (
      -- apt-sale
      SELECT 'apt-sale' AS realEstateType, city, district, buildingName, bjdCode, COUNT(*) AS cnt
      FROM AptSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName, bjdCode
      HAVING COUNT(*) >= 10

      UNION ALL

      -- apt-rent
      SELECT 'apt-rent', city, district, buildingName, bjdCode, COUNT(*)
      FROM AptRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName, bjdCode
      HAVING COUNT(*) >= 10

      UNION ALL

      -- villa-sale
      SELECT 'villa-sale', city, district, buildingName, bjdCode, COUNT(*)
      FROM VillaSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName, bjdCode
      HAVING COUNT(*) >= 10

      UNION ALL

      -- villa-rent
      SELECT 'villa-rent', city, district, buildingName, bjdCode, COUNT(*)
      FROM VillaRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName, bjdCode
      HAVING COUNT(*) >= 10

      UNION ALL

      -- offitel-sale
      SELECT 'offitel-sale', city, district, buildingName, bjdCode, COUNT(*)
      FROM OffitelSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName, bjdCode
      HAVING COUNT(*) >= 10

      UNION ALL

      -- offitel-rent
      SELECT 'offitel-rent', city, district, buildingName, bjdCode, COUNT(*)
      FROM OffitelRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName, bjdCode
      HAVING COUNT(*) >= 10
    ) unioned
  `;
  buildingsCache = { data: result, expiresAt: Date.now() + SITEMAP_CACHE_TTL };
  return result;
}

/**
 * 사이트맵용 부동산 city/district 허브 조합 목록.
 *
 * 프론트엔드 district 허브 페이지의 noindex 조건과 동일한 기준 적용:
 *   건물 단위로 거래 10건 이상인 단지가 1개 이상 있는 district만 포함.
 * (지역 전체 합산 10건 기준이 아님 — 그러면 개별 건물이 모두 thin해도 허브가 포함됨)
 *
 * city hub(/real-estate/apt-sale/seoul/)와
 * district hub(/real-estate/apt-sale/seoul/gangnam/) 사이트맵 생성에 사용.
 */
export async function getRealEstateCityDistrictHubs() {
  if (hubsCache && hubsCache.expiresAt > Date.now()) return hubsCache.data;
  const result = await prisma.$queryRaw<HubRow[]>`
    SELECT DISTINCT realEstateType, city, district
    FROM (
      SELECT 'apt-sale' AS realEstateType, city, district, buildingName, COUNT(*) AS cnt
      FROM AptSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
      HAVING COUNT(*) >= 10

      UNION ALL

      SELECT 'apt-rent', city, district, buildingName, COUNT(*)
      FROM AptRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
      HAVING COUNT(*) >= 10

      UNION ALL

      SELECT 'villa-sale', city, district, buildingName, COUNT(*)
      FROM VillaSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
      HAVING COUNT(*) >= 10

      UNION ALL

      SELECT 'villa-rent', city, district, buildingName, COUNT(*)
      FROM VillaRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
      HAVING COUNT(*) >= 10

      UNION ALL

      SELECT 'offitel-sale', city, district, buildingName, COUNT(*)
      FROM OffitelSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
      HAVING COUNT(*) >= 10

      UNION ALL

      SELECT 'offitel-rent', city, district, buildingName, COUNT(*)
      FROM OffitelRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
      HAVING COUNT(*) >= 10
    ) buildings_with_enough_tx
  `;
  hubsCache = { data: result, expiresAt: Date.now() + SITEMAP_CACHE_TTL };
  return result;
}
