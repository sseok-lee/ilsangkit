/**
 * 시설 통계 서비스
 * - 시/도별, 구/군별 카테고리 통계
 * - 동기화 상태 조회
 */

import prisma from '../lib/prisma.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from './cityMapping.js';
import { CATEGORY_REGISTRY } from './categoryRegistry.js';
import type { FacilityCategory } from './categoryRegistry.js';

const ALL_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports'];

// --- In-memory caches ---
export const statsByCityCache = new Map<string, { data: unknown; expiresAt: number }>();
export const statsByDistrictCache = new Map<string, { data: unknown; expiresAt: number }>();
export const STATS_CACHE_TTL = 300_000; // 5 minutes

/**
 * 시/도별 카테고리별 시설 통계 조회
 * - City Hub 페이지에서 동적 콘텐츠 생성용
 * - district별 total도 포함
 */
export async function getStatsByCity(citySlug: string): Promise<{
  city: string;
  citySlug: string;
  total: number;
  categories: Record<string, number>;
  topCategories: string[];
  districts: Array<{ district: string; total: number }>;
} | null> {
  const cached = statsByCityCache.get(citySlug);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as ReturnType<typeof getStatsByCity> extends Promise<infer T> ? T : never;
  }

  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return null;

  const cityVariants = [fullName, shortName].filter(Boolean);
  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;

  // groupBy district로 일괄 조회 — N+1 제거 (14 categories × 1 groupBy = 14 queries)
  const [categoryGroupResults, trashGroups] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => {
        const groups = await CATEGORY_REGISTRY[cat].model().groupBy({
          by: ['district'],
          where: { city: cityCondition },
          _count: true,
        });
        return { category: cat, groups };
      })
    ),
    prisma.wasteSchedule.groupBy({
      by: ['district'],
      where: { city: cityCondition },
      _count: true,
    }),
  ]);

  // 시 전체 카테고리별 합계 + district별 카테고리 카운트 동시 집계
  const cityCategories: Record<string, number> = {};
  const districtMap = new Map<string, Record<string, number>>();

  for (const { category, groups } of categoryGroupResults) {
    let catTotal = 0;
    for (const g of groups) {
      catTotal += g._count;
      if (g.district) {
        if (!districtMap.has(g.district)) districtMap.set(g.district, {});
        districtMap.get(g.district)![category] = g._count;
      }
    }
    cityCategories[category] = catTotal;
  }

  let trashTotal = 0;
  for (const g of trashGroups) {
    trashTotal += g._count;
    if (g.district) {
      if (!districtMap.has(g.district)) districtMap.set(g.district, {});
      districtMap.get(g.district)!.trash = g._count;
    }
  }
  cityCategories.trash = trashTotal;

  const total = Object.values(cityCategories).reduce((sum, c) => sum + c, 0);

  const topCategories = Object.entries(cityCategories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  // district별 total
  const districts = [...districtMap.entries()]
    .map(([district, cats]) => ({
      district,
      total: Object.values(cats).reduce((sum, c) => sum + c, 0),
    }))
    .filter((d) => d.total > 0)
    .sort((a, b) => a.district.localeCompare(b.district));

  const result = { city: fullName, citySlug, total, categories: cityCategories, topCategories, districts };
  statsByCityCache.set(citySlug, { data: result, expiresAt: Date.now() + STATS_CACHE_TTL });
  return result;
}

/**
 * 시 단위 전체 구/군별 시설 통계 — area 라우트용 (groupBy로 N+1 제거)
 * 기존: 14 categories × 25 districts = 350 COUNT queries
 * 개선: 14 categories × 1 groupBy = 14 GROUP BY queries
 */
export async function getDistrictStatsByCity(citySlug: string): Promise<Map<string, { total: number; categories: Record<string, number>; topCategories: string[] }>> {
  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return new Map();

  const cityVariants = [fullName, shortName].filter(Boolean);
  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;

  const [categoryGroupResults, trashGroups] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => {
        const groups = await CATEGORY_REGISTRY[cat].model().groupBy({
          by: ['district'],
          where: { city: cityCondition },
          _count: true,
        });
        return { category: cat, groups };
      })
    ),
    prisma.wasteSchedule.groupBy({
      by: ['district'],
      where: { city: cityCondition },
      _count: true,
    }),
  ]);

  const districtMap = new Map<string, Record<string, number>>();

  for (const { category, groups } of categoryGroupResults) {
    for (const g of groups) {
      if (!g.district) continue;
      if (!districtMap.has(g.district)) districtMap.set(g.district, {});
      districtMap.get(g.district)![category] = g._count;
    }
  }

  for (const g of trashGroups) {
    if (!g.district) continue;
    if (!districtMap.has(g.district)) districtMap.set(g.district, {});
    districtMap.get(g.district)!.trash = g._count;
  }

  const result = new Map<string, { total: number; categories: Record<string, number>; topCategories: string[] }>();

  for (const [district, categories] of districtMap) {
    const total = Object.values(categories).reduce((sum, c) => sum + c, 0);
    const topCategories = Object.entries(categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([cat]) => cat);
    result.set(district, { total, categories, topCategories });
  }

  return result;
}

/**
 * 구/군별 카테고리별 시설 통계 조회
 */
export async function getStatsByDistrict(citySlug: string, districtSlug: string): Promise<{
  total: number;
  categories: Record<string, number>;
  topCategories: string[];
} | null> {
  const cacheKey = `${citySlug}:${districtSlug}`;
  const cached = statsByDistrictCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as { total: number; categories: Record<string, number>; topCategories: string[] };
  }

  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return null;

  const cityVariants = [fullName, shortName].filter(Boolean);

  // districtSlug로 district name 조회
  const region = await prisma.region.findFirst({
    where: { city: { in: cityVariants }, slug: districtSlug },
    select: { district: true },
  });
  if (!region) return null;

  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;
  const where = { city: cityCondition, district: region.district };

  const [categoryCounts, trashCount] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => ({
        category: cat,
        count: await CATEGORY_REGISTRY[cat].model().count({ where }),
      }))
    ),
    prisma.wasteSchedule.count({ where }),
  ]);

  const categories: Record<string, number> = {};
  for (const { category, count } of categoryCounts) {
    categories[category] = count;
  }
  categories.trash = trashCount;

  const total = Object.values(categories).reduce((sum, c) => sum + c, 0);

  const topCategories = Object.entries(categories)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([cat]) => cat);

  const districtResult = { total, categories, topCategories };
  statsByDistrictCache.set(cacheKey, { data: districtResult, expiresAt: Date.now() + STATS_CACHE_TTL });
  return districtResult;
}

/**
 * 카테고리별 최신 동기화 완료 시간 조회
 */
export async function getSyncStatus(): Promise<Record<string, string | null>> {
  const categories = [...ALL_CATEGORIES, 'trash'] as const;

  const results = await Promise.all(
    categories.map(async (cat) => {
      const record = await prisma.syncHistory.findFirst({
        where: { category: cat, status: 'success' },
        orderBy: { completedAt: 'desc' },
        select: { completedAt: true },
      });
      return [cat, record?.completedAt?.toISOString() ?? null] as const;
    }),
  );

  // 부동산 카테고리: SyncHistory 대신 각 테이블의 MAX(syncedAt) 조회
  const realEstateModels = [
    { key: 'aptSale', model: prisma.aptSaleTransaction },
    { key: 'aptRent', model: prisma.aptRentTransaction },
    { key: 'villaSale', model: prisma.villaSaleTransaction },
    { key: 'villaRent', model: prisma.villaRentTransaction },
    { key: 'offitelSale', model: prisma.offitelSaleTransaction },
    { key: 'offitelRent', model: prisma.offitelRentTransaction },
  ] as const;

  const reResults = await Promise.all(
    realEstateModels.map(async ({ key, model }) => {
      const record = await (model as any).findFirst({ // eslint-disable-line @typescript-eslint/no-explicit-any
        orderBy: { syncedAt: 'desc' },
        select: { syncedAt: true },
      });
      return [key, record?.syncedAt?.toISOString() ?? null] as const;
    }),
  );

  return Object.fromEntries([...results, ...reResults]);
}
