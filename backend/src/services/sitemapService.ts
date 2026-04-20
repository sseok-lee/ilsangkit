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

export async function getRealEstateBuildings() {
  return prisma.$queryRaw<
    Array<{ propertyType: string; buildingName: string; bjdCode: string }>
  >`
    SELECT 'apt' AS propertyType, buildingName, bjdCode FROM (
      SELECT buildingName, bjdCode, SUM(cnt) AS total
      FROM (
        SELECT buildingName, bjdCode, COUNT(*) AS cnt FROM AptSaleTransaction
        WHERE buildingName IS NOT NULL
          AND buildingName != ''
          AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY buildingName, bjdCode
        UNION ALL
        SELECT buildingName, bjdCode, COUNT(*) AS cnt FROM AptRentTransaction
        WHERE buildingName IS NOT NULL
          AND buildingName != ''
          AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY buildingName, bjdCode
      ) apt_counts
      GROUP BY buildingName, bjdCode
      HAVING SUM(cnt) >= 10
    ) apt
    UNION ALL
    SELECT 'villa' AS propertyType, buildingName, bjdCode FROM (
      SELECT buildingName, bjdCode, SUM(cnt) AS total
      FROM (
        SELECT buildingName, bjdCode, COUNT(*) AS cnt FROM VillaSaleTransaction
        WHERE buildingName IS NOT NULL
          AND buildingName != ''
          AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY buildingName, bjdCode
        UNION ALL
        SELECT buildingName, bjdCode, COUNT(*) AS cnt FROM VillaRentTransaction
        WHERE buildingName IS NOT NULL
          AND buildingName != ''
          AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY buildingName, bjdCode
      ) villa_counts
      GROUP BY buildingName, bjdCode
      HAVING SUM(cnt) >= 10
    ) villa
    UNION ALL
    SELECT 'offitel' AS propertyType, buildingName, bjdCode FROM (
      SELECT buildingName, bjdCode, SUM(cnt) AS total
      FROM (
        SELECT buildingName, bjdCode, COUNT(*) AS cnt FROM OffitelSaleTransaction
        WHERE buildingName IS NOT NULL
          AND buildingName != ''
          AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY buildingName, bjdCode
        UNION ALL
        SELECT buildingName, bjdCode, COUNT(*) AS cnt FROM OffitelRentTransaction
        WHERE buildingName IS NOT NULL
          AND buildingName != ''
          AND CHAR_LENGTH(buildingName) >= 2
          AND buildingName NOT REGEXP '^[[:space:]]*[(]'
          AND buildingName NOT REGEXP '^[0-9()[:space:]-]+$'
        GROUP BY buildingName, bjdCode
      ) offitel_counts
      GROUP BY buildingName, bjdCode
      HAVING SUM(cnt) >= 10
    ) offitel
  `;
}
