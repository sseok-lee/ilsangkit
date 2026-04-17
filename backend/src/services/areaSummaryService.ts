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
 * Haversine 공식으로 두 좌표 간 거리(km) 계산
 */
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
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

  // 3. district slug → district name + 중심 좌표
  const region = await prisma.region.findFirst({
    where: { city: { in: cityVariants }, slug: districtSlug },
    select: { district: true, lat: true, lng: true },
  });
  if (!region) return null;

  const baseWhere = { city: cityCondition, district: region.district };
  const currentLat = Number(region.lat);
  const currentLng = Number(region.lng);
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
    getNearbyDistricts(region.district, currentLat, currentLng, category, cityCondition),
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
 * 같은 시의 다른 구 목록 — 지리적 거리 기준 가까운 5개
 *
 * Region.lat/lng (공공데이터 지오코딩 값)과 현재 구 중심 좌표의 Haversine distance로 정렬.
 * 해당 카테고리 시설이 0건인 구는 제외 (유의미한 링크만 노출).
 */
async function getNearbyDistricts(
  currentDistrict: string,
  currentLat: number,
  currentLng: number,
  category: SummaryCategory,
  cityCondition: unknown,
): Promise<NearbyDistrict[]> {
  const model = getModel(category);

  const [groups, otherRegions] = await Promise.all([
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (model as any).groupBy({
      by: ['district'],
      where: { city: cityCondition },
      _count: true,
    }) as Promise<Array<{ district: string | null; _count: number }>>,
    prisma.region.findMany({
      where: {
        city: cityCondition as Record<string, unknown>,
        district: { not: currentDistrict },
      },
      select: { district: true, slug: true, lat: true, lng: true },
    }),
  ]);

  const countMap = new Map<string, number>();
  for (const g of groups) {
    if (g.district) countMap.set(g.district, g._count);
  }

  return otherRegions
    .map((r) => ({
      slug: r.slug,
      district: r.district,
      count: countMap.get(r.district) ?? 0,
      distance: haversineKm(currentLat, currentLng, Number(r.lat), Number(r.lng)),
    }))
    .filter((r) => r.count > 0)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 5)
    .map(({ slug, district, count }) => ({ slug, district, count }));
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
