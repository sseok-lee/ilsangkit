/**
 * 지역 요약 집계 서비스 — near-duplicate 방지용 페이지 상단 데이터
 * /api/area/:citySlug/:districtSlug/:category/summary
 *
 * 응답: count, countDiff(최근 30일), highlights[], nearbyDistricts[], lastSyncedAt
 */

import { prisma } from '../lib/prisma.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from './cityMapping.js';
import { CATEGORY_REGISTRY } from './categoryRegistry.js';
import type { FacilityCategory } from './categoryRegistry.js';

export type SummaryCategory = FacilityCategory | 'trash';

interface HighlightDef {
  key: string;
  label: string;
  where: Record<string, unknown>;
}

// 카테고리별 highlight 3개 (MVP: toilet/parking/pharmacy/library/aed/childcare)
// 나머지는 빈 배열 → 기본 count만 표시
const CATEGORY_HIGHLIGHTS: Partial<Record<SummaryCategory, HighlightDef[]>> = {
  toilet: [
    { key: 'disabled', label: '장애인 화장실', where: { hasDisabledToilet: true } },
    { key: 'diaper', label: '수유실', where: { hasDiaperChangingTable: true } },
    { key: 'open24h', label: '24시간 개방', where: { operatingHours: '24시간' } },
  ],
  parking: [
    { key: 'disabled', label: '장애인 주차', where: { hasDisabledParking: true } },
  ],
  pharmacy: [
    // 월요일 24시간 운영: 0000~2400 (국립중앙의료원 등 당번약국)
    { key: 'open24h', label: '24시간 운영', where: { dutyTime1s: '0000', dutyTime1c: '2400' } },
  ],
  library: [
    { key: 'largeSeats', label: '좌석 100석 이상', where: { seatCount: { gte: 100 } } },
    { key: 'largeBooks', label: '장서 5만권 이상', where: { bookCount: { gte: 50000 } } },
  ],
  aed: [
    { key: 'hospital24h', label: '의료기관', where: { org: { contains: '의료원' } } },
  ],
  childcare: [
    { key: 'publicNational', label: '국공립', where: { crtypename: { contains: '국공립' } } },
  ],
};

// 인메모리 캐시 (5분 TTL)
interface CacheEntry {
  data: AreaSummary;
  expiresAt: number;
}
const summaryCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_SIZE = 1000;

export function clearAreaSummaryCache(): void {
  summaryCache.clear();
}

export interface Highlight {
  key: string;
  label: string;
  count: number;
  percent: number;
}

export interface NearbyDistrict {
  slug: string;
  district: string;
  count: number;
}

export interface AreaSummary {
  count: number;
  countDiff: number;
  highlights: Highlight[];
  nearbyDistricts: NearbyDistrict[];
  lastSyncedAt: string | null;
}

function getCached(key: string): AreaSummary | null {
  const entry = summaryCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    summaryCache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: AreaSummary): void {
  if (summaryCache.size >= MAX_CACHE_SIZE) {
    const oldest = summaryCache.keys().next().value;
    if (oldest !== undefined) summaryCache.delete(oldest);
  }
  summaryCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

/**
 * 카테고리별 Prisma 모델 획득 (trash 포함)
 */
function getModel(category: SummaryCategory) {
  if (category === 'trash') return prisma.wasteSchedule;
  return CATEGORY_REGISTRY[category].model();
}

/**
 * 지역 요약 데이터 조회
 */
export async function getAreaSummary(
  citySlug: string,
  districtSlug: string,
  category: SummaryCategory,
): Promise<AreaSummary | null> {
  // 1. city slug 검증
  const fullName = CITY_SLUG_TO_FULL[citySlug];
  if (!fullName) return null;

  // 2. 캐시 확인
  const cacheKey = `${citySlug}:${districtSlug}:${category}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const shortName = CITY_SLUG_TO_SHORT[citySlug];
  const cityVariants = [fullName, shortName].filter(Boolean) as string[];
  const cityCondition = cityVariants.length > 1 ? { in: cityVariants } : fullName;

  // 3. district slug → district name
  const region = await prisma.region.findFirst({
    where: { city: { in: cityVariants }, slug: districtSlug },
    select: { district: true },
  });
  if (!region) return null;

  const baseWhere = { city: cityCondition, district: region.district };
  const model = getModel(category);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const countableModel = model as any;

  // 4. 병렬 집계: 총 count, highlights, countDiff, 인근 구
  const highlightDefs = CATEGORY_HIGHLIGHTS[category] ?? [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [count, highlightCounts, countDiff, nearbyDistricts, lastSyncedAt] = await Promise.all([
    countableModel.count({ where: baseWhere }) as Promise<number>,
    Promise.all(
      highlightDefs.map(async (def) => ({
        def,
        count: (await countableModel.count({ where: { ...baseWhere, ...def.where } })) as number,
      })),
    ),
    countableModel.count({
      where: { ...baseWhere, createdAt: { gte: thirtyDaysAgo } },
    }) as Promise<number>,
    getNearbyDistricts(citySlug, region.district, category, cityCondition),
    getCategoryLastSync(category),
  ]);

  const highlights: Highlight[] = highlightCounts.map(({ def, count: c }) => ({
    key: def.key,
    label: def.label,
    count: c,
    percent: count > 0 ? Math.round((c / count) * 100) : 0,
  }));

  const summary: AreaSummary = {
    count,
    countDiff,
    highlights,
    nearbyDistricts,
    lastSyncedAt,
  };

  setCache(cacheKey, summary);
  return summary;
}

/**
 * 같은 시의 다른 구 목록 (같은 카테고리 count 포함) 상위 5개
 */
async function getNearbyDistricts(
  citySlug: string,
  currentDistrict: string,
  category: SummaryCategory,
  cityCondition: unknown,
): Promise<NearbyDistrict[]> {
  const model = getModel(category);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groups = await (model as any).groupBy({
    by: ['district'],
    where: { city: cityCondition },
    _count: true,
  }) as Array<{ district: string | null; _count: number }>;

  // 현재 구 제외, count 내림차순 상위 5개
  const nearby = groups
    .filter((g) => g.district && g.district !== currentDistrict)
    .sort((a, b) => (b._count as number) - (a._count as number))
    .slice(0, 5);

  if (nearby.length === 0) return [];

  // district name → slug 매핑
  const regions = await prisma.region.findMany({
    where: {
      district: { in: nearby.map((n) => n.district!) },
      city: cityCondition as Record<string, unknown>,
    },
    select: { district: true, slug: true },
  });
  const slugMap = new Map(regions.map((r) => [r.district, r.slug]));
  void citySlug; // reserved for future per-city filtering

  return nearby
    .map((n) => ({
      slug: slugMap.get(n.district!) ?? '',
      district: n.district!,
      count: n._count as number,
    }))
    .filter((n) => n.slug);
}

/**
 * 카테고리별 마지막 동기화 시간
 */
async function getCategoryLastSync(category: SummaryCategory): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ completedAt: Date | null }>>`
    SELECT MAX(completedAt) AS completedAt
    FROM SyncHistory
    WHERE status = 'success' AND category = ${category}
  `;
  return rows[0]?.completedAt?.toISOString() ?? null;
}
