import { prisma } from '../lib/prisma.js';
import * as facilityService from './facilityService.js';
import * as wasteScheduleService from './wasteScheduleService.js';
import type { FacilityCategory } from './facilityService.js';
import { ALL_CATEGORIES } from './categoryRegistry.js';

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
 * US-008: 신규 URL 포맷 `/real-estate/{apt-sale|apt-rent|villa-sale|villa-rent|offitel-sale|offitel-rent}/{citySlug}/{districtSlug}/{buildingName}` 에 필요한
 * 모든 정보를 집계 쿼리로 반환한다.
 *
 * - 매매/전월세를 개별 realEstateType 으로 분리 (같은 건물이 매매·전월세 두 줄로 방출)
 * - (city, district, buildingName, bjdCode) 튜플 기준으로 그룹핑
 * - buildingName 필터: frontend `isValidBuildingName` 과 동일 규칙 — 빈값/공백/괄호 전체 지번 / 숫자 시작 괄호 접두사 제외
 * - 최소 거래 10건 이상만 포함 (thin content 회피)
 * - city/district는 DB 원본 문자열 그대로 반환 (frontend 측 toCitySlug/toDistrictSlug 로 slug 변환)
 */
export async function getRealEstateBuildings() {
  return prisma.$queryRaw<
    Array<{
      realEstateType: string;
      city: string;
      district: string;
      buildingName: string;
      bjdCode: string;
    }>
  >`
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
}
