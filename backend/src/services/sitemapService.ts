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
type RealEstateRow = { realEstateType: string; city: string; district: string; buildingName: string; bjdCode: string };
type HubRow = { realEstateType: string; city: string; district: string };
let buildingsCache: { data: RealEstateRow[]; expiresAt: number } | null = null;
let hubsCache: { data: HubRow[]; expiresAt: number } | null = null;
let realEstateMaxUpdatedAtCache: { data: Date | null; expiresAt: number } | null = null;

/** 테스트 전용 — 모듈 레벨 캐시 초기화 */
export function _resetSitemapCacheForTests() {
  buildingsCache = null;
  hubsCache = null;
  realEstateMaxUpdatedAtCache = null;
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
 * 6개 부동산 트랜잭션 테이블의 MAX(updatedAt) 중 최댓값.
 * 사이트맵 lastmod 갱신용. updatedAt 컬럼에 인덱스가 없어 풀스캔이지만,
 * 6시간 캐시 + sitemap.xml 호출 빈도 고려 시 허용 가능.
 */
async function getRealEstateMaxUpdatedAt(): Promise<Date | null> {
  if (realEstateMaxUpdatedAtCache && realEstateMaxUpdatedAtCache.expiresAt > Date.now()) {
    return realEstateMaxUpdatedAtCache.data;
  }
  try {
    const result = await prisma.$queryRaw<[{ maxUpdatedAt: Date | null }]>`
      SELECT GREATEST(
        (SELECT MAX(updatedAt) FROM AptSaleTransaction),
        (SELECT MAX(updatedAt) FROM AptRentTransaction),
        (SELECT MAX(updatedAt) FROM VillaSaleTransaction),
        (SELECT MAX(updatedAt) FROM VillaRentTransaction),
        (SELECT MAX(updatedAt) FROM OffitelSaleTransaction),
        (SELECT MAX(updatedAt) FROM OffitelRentTransaction)
      ) AS maxUpdatedAt
    `;
    const data = result[0]?.maxUpdatedAt ?? null;
    realEstateMaxUpdatedAtCache = { data, expiresAt: Date.now() + SITEMAP_CACHE_TTL };
    return data;
  } catch (err) {
    console.error('[sitemap] getRealEstateMaxUpdatedAt error:', err);
    return null;
  }
}

export async function getSitemapPageCounts() {
  const [facilities, wasteCount, wasteLatest, subCount, subLatest, realEstateCount, realEstateMaxUpdatedAt] =
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
      getRealEstateMaxUpdatedAt(),
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
      maxUpdatedAt: toKstDateString(realEstateMaxUpdatedAt),
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
    ) unioned
  `;
  buildingsCache = { data: result, expiresAt: Date.now() + SITEMAP_CACHE_TTL };
  return result;
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

      UNION ALL

      SELECT 'apt-rent', city, district, buildingName, COUNT(*)
      FROM AptRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName

      UNION ALL

      SELECT 'villa-sale', city, district, buildingName, COUNT(*)
      FROM VillaSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName

      UNION ALL

      SELECT 'villa-rent', city, district, buildingName, COUNT(*)
      FROM VillaRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName

      UNION ALL

      SELECT 'offitel-sale', city, district, buildingName, COUNT(*)
      FROM OffitelSaleTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName

      UNION ALL

      SELECT 'offitel-rent', city, district, buildingName, COUNT(*)
      FROM OffitelRentTransaction
      WHERE buildingName IS NOT NULL
        AND buildingName != ''
        AND CHAR_LENGTH(buildingName) >= 2
        AND buildingName NOT REGEXP '^[[:space:]]*[(][0-9]'
        AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
      GROUP BY city, district, buildingName
    ) buildings_with_enough_tx
  `;
  hubsCache = { data: result, expiresAt: Date.now() + SITEMAP_CACHE_TTL };
  return result;
}
