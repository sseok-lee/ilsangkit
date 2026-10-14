/**
 * 시설 통계 서비스
 * - 시/도별, 구/군별 카테고리 통계
 * - 동기화 상태 조회
 */

import { prisma } from '../lib/prisma.js';
import { countWifiGroups, countWifiGroupsByDistrict } from './wifiService.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from './cityMapping.js';
import { CATEGORY_REGISTRY } from './categoryRegistry.js';
import type { FacilityCategory } from './categoryRegistry.js';
import { getWasteDistrictDisplay } from './wasteAreaService.js';
import type { WasteDistrictMode } from '../types/wasteArea.js';
import { ServiceUnavailableError } from '../lib/errors.js';

const ALL_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market', 'childcare', 'ev-charger', 'sports'];

/** 쓰레기배출은 시설이 아니고 단위(동 수/원본 건수)도 달라 합계·상위 카테고리에서 뺀다. */
function facilityTotals(categories: Record<string, number>): { total: number; topCategories: string[] } {
  const facilities = Object.entries(categories).filter(([cat]) => cat !== 'trash');
  return {
    total: facilities.reduce((sum, [, count]) => sum + count, 0),
    topCategories: facilities.sort(([, a], [, b]) => b - a).slice(0, 3).map(([cat]) => cat),
  };
}

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
        // wifi 는 AP 1대=1행이라 그대로 세면 장소 수가 아니라 AP 수가 나온다.
        // 상세·목록과 같은 장소 단위로 센다.
        if (cat === 'wifi') {
          const rows = await countWifiGroupsByDistrict(cityVariants);
          return { category: cat, groups: rows.map((r) => ({ district: r.district, _count: r.count })) };
        }
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
      where: { city: cityCondition, stagedMarker: null },
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

  const { total, topCategories } = facilityTotals(cityCategories);

  // district별 total
  const districts = [...districtMap.entries()]
    .map(([district, cats]) => ({
      district,
      total: facilityTotals(cats).total,
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
const districtStatsByCityCache = new Map<string, { data: Map<string, { total: number; categories: Record<string, number>; topCategories: string[] }>; expiresAt: number }>();

export async function getDistrictStatsByCity(citySlug: string): Promise<Map<string, { total: number; categories: Record<string, number>; topCategories: string[] }>> {
  // 캐시 체크 (5분 TTL)
  const cached = districtStatsByCityCache.get(citySlug);
  if (cached && cached.expiresAt > Date.now()) return cached.data;

  const fullName = CITY_SLUG_TO_FULL[citySlug];
  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  if (!fullName) return new Map();

  const cityVariants = [fullName, shortName].filter(Boolean);
  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;

  const [categoryGroupResults, trashGroups] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => {
        // wifi 는 AP 1대=1행이라 그대로 세면 장소 수가 아니라 AP 수가 나온다.
        // 상세·목록과 같은 장소 단위로 센다.
        if (cat === 'wifi') {
          const rows = await countWifiGroupsByDistrict(cityVariants);
          return { category: cat, groups: rows.map((r) => ({ district: r.district, _count: r.count })) };
        }
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
      where: { city: cityCondition, stagedMarker: null },
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
    const { total, topCategories } = facilityTotals(categories);
    result.set(district, { total, categories, topCategories });
  }

  districtStatsByCityCache.set(citySlug, { data: result, expiresAt: Date.now() + STATS_CACHE_TTL });
  return result;
}

/**
 * 구/군별 카테고리별 시설 통계 조회
 */
export async function getStatsByDistrict(citySlug: string, districtSlug: string): Promise<{
  total: number;
  categories: Record<string, number>;
  topCategories: string[];
  wasteMode: WasteDistrictMode | 'legacy';
} | null> {
  const cacheKey = `${citySlug}:${districtSlug}`;
  const cached = statsByDistrictCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as { total: number; categories: Record<string, number>; topCategories: string[]; wasteMode: WasteDistrictMode | 'legacy' };
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
  const trashWhere = { ...where, stagedMarker: null };

  const [categoryCounts, wasteDisplay] = await Promise.all([
    Promise.all(
      ALL_CATEGORIES.map(async (cat) => ({
        category: cat,
        count: cat === 'wifi'
          ? await countWifiGroups(cityVariants, region.district)
          : await CATEGORY_REGISTRY[cat].model().count({ where }),
      }))
    ),
    getWasteDistrictDisplay(fullName, region.district).catch((err: unknown) => {
      // 표시 건수 조회 실패는 허브 전체를 죽이지 않고 레거시 count 로 폴백한다.
      if (err instanceof ServiceUnavailableError) return null;
      throw err;
    }),
  ]);
  const legacyCount = wasteDisplay ? 0 : await prisma.wasteSchedule.count({ where: trashWhere });

  const categories: Record<string, number> = {};
  for (const { category, count } of categoryCounts) {
    categories[category] = count;
  }
  categories.trash = wasteDisplay ? wasteDisplay.count : legacyCount;
  const wasteMode: WasteDistrictMode | 'legacy' = wasteDisplay ? wasteDisplay.mode : 'legacy';

  const { total, topCategories } = facilityTotals(categories);

  const districtResult = { total, categories, topCategories, wasteMode };
  statsByDistrictCache.set(cacheKey, { data: districtResult, expiresAt: Date.now() + STATS_CACHE_TTL });
  return districtResult;
}

/**
 * 카테고리별 최신 동기화 완료 시간 조회
 * 시설/trash: SyncHistory GROUP BY 1쿼리로 통합 (기존 15개 → 1개)
 */
export async function getSyncStatus(): Promise<Record<string, string | null>> {
  const syncRows = await prisma.$queryRaw<Array<{ category: string; completedAt: Date | null }>>`
    SELECT category, MAX(completedAt) AS completedAt
    FROM SyncHistory
    WHERE status = 'success'
    GROUP BY category
  `;
  const syncMap = new Map(syncRows.map((r) => [r.category, r.completedAt?.toISOString() ?? null]));

  const categories = [...ALL_CATEGORIES, 'trash'] as const;
  const results: [string, string | null][] = categories.map((cat) => [cat, syncMap.get(cat) ?? null]);

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
