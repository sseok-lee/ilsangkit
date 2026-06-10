// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

import { prisma } from '../lib/prisma.js';
import { FacilitySearchInput } from '../schemas/facility.js';
import { PAGINATION, SEARCH_DEFAULTS } from '../constants/index.js';

// --- Re-exports from sub-modules ---
export type { FacilityCategory } from './categoryRegistry.js';
export { CATEGORY_REGISTRY, ALL_CATEGORIES } from './categoryRegistry.js';
export {
  CITY_SLUG_TO_FULL,
  CITY_SLUG_TO_SHORT,
  SHORT_TO_SLUG,
  FULL_TO_SLUG,
  buildRegionFilter,
} from './cityMapping.js';
export { flushViewCounts } from './viewCountService.js';
export {
  getStatsByCity,
  getStatsByDistrict,
  getDistrictStatsByCity,
  getSyncStatus,
  statsByCityCache,
  statsByDistrictCache,
  STATS_CACHE_TTL,
} from './facilityStatsService.js';
export { evChargerStationSearch, getEvChargerStationDetail } from './evChargerService.js';

// --- Local imports from sub-modules for internal use ---
import type { FacilityCategory } from './categoryRegistry.js';
import { CATEGORY_REGISTRY, ALL_CATEGORIES } from './categoryRegistry.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT, buildRegionFilter } from './cityMapping.js';
import { bufferViewCount } from './viewCountService.js';
import { evChargerStationSearch } from './evChargerService.js';
import { parseSearchQueryCached, resolveScope } from './search/searchQueryParser.js';
import { buildRecovery, type Recovery } from './search/searchRecovery.js';

// 정렬 옵션 매핑
const ORDER_BY_MAP: Record<string, Record<string, string>> = {
  name: { name: 'asc' },
  latest: { updatedAt: 'desc' },
  popular: { viewCount: 'desc' },
};

// --- Haversine 거리 계산 ---

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 기본 select 필드 (공통 필드)
const BASE_SELECT_FIELDS = {
  id: true,
  name: true,
  address: true,
  roadAddress: true,
  lat: true,
  lng: true,
  city: true,
  district: true,
} as const;

/**
 * 카테고리별 리스트 select 필드 생성
 * BASE_SELECT_FIELDS + 카테고리별 listFields
 */
function buildListSelect(category: FacilityCategory): Record<string, boolean> {
  const { listFields } = CATEGORY_REGISTRY[category];
  return {
    ...BASE_SELECT_FIELDS,
    ...Object.fromEntries(listFields.map((f) => [f, true])),
  };
}

// 응답 타입 정의
interface FacilityItem {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  distance?: number;
  extras?: Record<string, unknown>;
}

interface SearchResult {
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFacilityItem(record: any, category: FacilityCategory): FacilityItem {
  const { listFields } = CATEGORY_REGISTRY[category];
  const extras: Record<string, unknown> = {};
  for (const field of listFields) {
    if (record[field] !== undefined && record[field] !== null && record[field] !== '') {
      extras[field] = record[field];
    }
  }

  return {
    id: record.id,
    category,
    name: record.name,
    address: record.address,
    roadAddress: record.roadAddress,
    lat: Number(record.lat) || 0,
    lng: Number(record.lng) || 0,
    city: record.city,
    district: record.district,
    ...(Object.keys(extras).length > 0 ? { extras } : {}),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapWasteScheduleToFacilityItem(r: any): FacilityItem {
  return {
    id: String(r.id),
    category: 'trash' as FacilityCategory,
    name: r.targetRegion || `${r.district} 쓰레기 배출`,
    address: r.emissionPlace || null,
    roadAddress: null,
    lat: 0,
    lng: 0,
    city: r.city,
    district: r.district,
  };
}

/**
 * 키워드 기반 검색 조건 생성
 */
function buildKeywordFilter(keyword?: string): Record<string, unknown> {
  if (!keyword) return {};
  return {
    OR: [
      { name: { contains: keyword } },
      { address: { contains: keyword } },
      { roadAddress: { contains: keyword } },
    ],
  };
}

/**
 * bounds 필터 조건 생성
 */
function buildBoundsFilter(swLat: number, swLng: number, neLat: number, neLng: number): { lat: { gte: number; lte: number }; lng: { gte: number; lte: number } } {
  return {
    lat: { gte: swLat, lte: neLat },
    lng: { gte: swLng, lte: neLng },
  };
}

/**
 * 병원 진료과목 AND 매칭 필터.
 * 선택된 모든 진료과목을 보유한 병원만 통과한다.
 *   ["내과", "외과"] → 내과와 외과 둘 다 있는 병원
 */
function buildDepartmentFilter(category: string | undefined, departments?: string[]): Record<string, unknown> {
  if (category !== 'hospital' || !departments || departments.length === 0) return {};
  return {
    AND: departments.map((dept) => ({
      departments: { some: { dgsbjtCdNm: dept } },
    })),
  };
}

// 그룹별 검색 응답 타입
interface GroupedCategoryResult {
  category: FacilityCategory;
  label: string;
  count: number;
  items: FacilityItem[];
}

interface GroupedSearchResult {
  categories: GroupedCategoryResult[];
  totalCount: number;
  parsed: import('./search/searchQueryParser.js').ParsedQuery;
  recovery: Recovery | null;
}

const CATEGORY_LABELS: Record<FacilityCategory, string> = {
  toilet: '공공화장실',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  parking: '공영주차장',
  aed: '자동심장충격기',
  library: '공공도서관',
  hospital: '병원',
  pharmacy: '약국',
  park: '공원',
  school: '학교',
  market: '전통시장',
  childcare: '어린이집',
  'ev-charger': '전기차충전소',
  sports: '체육시설',
  subway: '지하철역',
};

// 크로스 카테고리 추천 맵
export const CROSS_CATEGORY_MAP: Record<FacilityCategory, FacilityCategory[]> = {
  toilet: ['park', 'wifi'],
  wifi: ['library', 'park', 'toilet'],
  parking: ['ev-charger', 'toilet', 'market'],
  hospital: ['pharmacy', 'aed'],
  pharmacy: ['hospital', 'childcare'],
  aed: ['hospital', 'pharmacy'],
  library: ['parking', 'wifi', 'park'],
  clothes: ['toilet', 'park'],
  park: ['toilet', 'parking', 'sports'],
  school: ['childcare', 'library', 'park'],
  market: ['parking', 'toilet'],
  childcare: ['school', 'hospital', 'pharmacy', 'park'],
  'ev-charger': ['parking', 'park', 'market', 'library'],
  sports: ['parking', 'park', 'toilet'],
  subway: ['parking', 'ev-charger', 'toilet', 'market'],
};

/**
 * 크로스 카테고리 주변 시설 조회
 * - 현재 카테고리와 연관된 다른 카테고리 시설을 조회
 * - 거리순 정렬, 최대 6개 반환
 */
export async function getNearbyFacilities(
  category: FacilityCategory,
  lat: number,
  lng: number,
  radius = 1000
): Promise<FacilityItem[]> {
  const targetCategories = CROSS_CATEGORY_MAP[category];
  if (!targetCategories || targetCategories.length === 0) return [];

  const radiusKm = radius / 1000;
  const latDelta = radiusKm / 111;
  const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
  const approxBounds = {
    lat: { gte: lat - latDelta, lte: lat + latDelta },
    lng: { gte: lng - lngDelta, lte: lng + lngDelta },
  };

  const fetchResults = await Promise.all(
    targetCategories.map(async (cat) => {
      // ev-charger: 충전소 단위 그룹핑
      if (cat === 'ev-charger') {
        const stationResult = await evChargerStationSearch({
          lat, lng, radius,
          page: 1, limit: 10,
        });
        return stationResult.items;
      }
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where: approxBounds,
        select: buildListSelect(cat),
        take: 500,
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  const allItems = fetchResults.flat();

  // ev-charger는 이미 거리 계산됨, 나머지만 계산
  return allItems
    .map((item) => item.distance !== undefined ? item : {
      ...item,
      distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
    })
    .filter((item) => item.distance! <= radius)
    .sort((a, b) => a.distance! - b.distance!)
    .slice(0, 6);
}

/**
 * 카테고리별 그룹핑 검색
 * - 각 카테고리별 건수 + 상위 3건 미리보기 반환
 * - count가 0인 카테고리는 제외
 */
export async function searchGrouped(params: FacilitySearchInput): Promise<GroupedSearchResult> {
  const { keyword, city, district } = params;

  const parsed = await parseSearchQueryCached(keyword);
  const { effectiveCity, effectiveDistrict, nameText } = resolveScope({ city, district }, parsed);

  const where = {
    ...buildKeywordFilter(nameText),
    ...buildRegionFilter(effectiveCity, effectiveDistrict),
  };

  // 파서가 카테고리를 특정하면("화장실"→toilet) 그 카테고리만 조회 — 나머지 13개 테이블 스킵.
  // 토큰이 ALL_CATEGORIES 밖이면(예: 미래의 subway 동의어) 조용히 0건이 되지 않도록 전체 검색으로 폴백.
  const categoryTokenStr = parsed.categoryToken as string | null;
  const tokenInScope = !!categoryTokenStr && categoryTokenStr !== 'trash'
    && (ALL_CATEGORIES as string[]).includes(categoryTokenStr);
  const scopedCategories: FacilityCategory[] = tokenInScope
    ? [categoryTokenStr as FacilityCategory]
    : categoryTokenStr === 'trash' ? [] : ALL_CATEGORIES;
  // categoryToken이 trash이거나, 스코프된 일반 카테고리가 아닐 때만 WasteSchedule 조회
  const shouldSearchTrash = !tokenInScope;

  // Phase 1: count만 먼저 — 병렬
  const countResults = await Promise.all(
    scopedCategories.map(async (cat) => {
      if (cat === 'ev-charger') {
        const stationResult = await evChargerStationSearch({
          keyword: nameText, city: effectiveCity, district: effectiveDistrict, page: 1, limit: 3,
        });
        return { category: cat, count: stationResult.total, items: stationResult.items };
      }
      const model = CATEGORY_REGISTRY[cat].model();
      const count = await model.count({ where });
      return { category: cat, count, items: null };
    }),
  );

  // Phase 2: count > 0인 카테고리만 findMany — N개 병렬 (보통 5~8개)
  const results = await Promise.all(
    countResults.map(async (cr) => {
      if (cr.items !== null) {
        // ev-charger: 이미 Phase 1에서 items 포함
        return {
          category: cr.category,
          label: CATEGORY_LABELS[cr.category],
          count: cr.count,
          items: cr.items,
        };
      }
      if (cr.count === 0) {
        return { category: cr.category, label: CATEGORY_LABELS[cr.category], count: 0, items: [] };
      }
      const model = CATEGORY_REGISTRY[cr.category].model();
      const records = await model.findMany({ where, take: 3, select: buildListSelect(cr.category) });
      return {
        category: cr.category,
        label: CATEGORY_LABELS[cr.category],
        count: cr.count,
        items: records.map((r: any) => toFacilityItem(r, cr.category)), // eslint-disable-line @typescript-eslint/no-explicit-any
      };
    }),
  );

  const categories = results.filter((r) => r.count > 0);

  // trash(WasteSchedule) 별도 조회 — 좌표 없는 일정 데이터이므로 ALL_CATEGORIES와 분리
  // categoryToken이 trash이거나 미특정일 때만 조회
  if (shouldSearchTrash) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trashWhere: any = {
      ...buildRegionFilter(effectiveCity, effectiveDistrict),
    };
    if (nameText) {
      trashWhere.OR = [
        { targetRegion: { contains: nameText } },
        { emissionPlace: { contains: nameText } },
      ];
    }
    const [trashCount, trashRecords] = await Promise.all([
      prisma.wasteSchedule.count({ where: trashWhere }),
      prisma.wasteSchedule.findMany({ where: trashWhere, take: 3, orderBy: { targetRegion: 'asc' } }),
    ]);
    if (trashCount > 0) {
      categories.push({
        category: 'trash' as FacilityCategory,
        label: '쓰레기배출',
        count: trashCount,
        items: trashRecords.map(mapWasteScheduleToFacilityItem),
      });
    }
  }

  const totalCount = categories.reduce((sum, r) => sum + r.count, 0);
  const recovery = totalCount === 0 ? buildRecovery(parsed) : null;

  return { categories, totalCount, parsed, recovery };
}

/**
 * 시설 검색
 * - 좌표 기반 검색 (lat/lng + radius)
 * - bounds 기반 검색 (swLat/swLng/neLat/neLng)
 * - 키워드 검색
 * - 카테고리 필터
 * - 지역 필터
 */
export async function search(params: FacilitySearchInput): Promise<SearchResult> {
  const { category, keyword, lat, lng, radius = SEARCH_DEFAULTS.RADIUS_METERS, swLat, swLng, neLat, neLng, city, district, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, sort = 'name', departments } = params;

  // ev-charger: 충전소 단위 그룹 검색 (모든 검색 유형)
  if (category === 'ev-charger') {
    return evChargerStationSearch({ keyword, city, district, lat, lng, radius, swLat, swLng, neLat, neLng, page, limit });
  }

  // trash: WasteSchedule 별도 처리 (좌표 없는 일정 데이터)
  if (category === 'trash') {
    const skip = (page - 1) * limit;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const trashWhere: any = { ...buildRegionFilter(city, district) };
    if (keyword) {
      trashWhere.OR = [
        { targetRegion: { contains: keyword } },
        { emissionPlace: { contains: keyword } },
      ];
    }
    const [records, total] = await Promise.all([
      prisma.wasteSchedule.findMany({ where: trashWhere, skip, take: limit, orderBy: { targetRegion: 'asc' } }),
      prisma.wasteSchedule.count({ where: trashWhere }),
    ]);
    const items: FacilityItem[] = records.map(mapWasteScheduleToFacilityItem);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // --- 좌표 기반 검색: Haversine 거리 계산 ---
  if (lat !== undefined && lng !== undefined) {
    const categories = category ? [category as FacilityCategory] : ALL_CATEGORIES;
    const keywordFilter = buildKeywordFilter(keyword);
    const radiusKm = radius / 1000;

    // 대략적인 위경도 범위로 사전 필터링 (성능 최적화)
    const latDelta = radiusKm / 111;
    const lngDelta = radiusKm / (111 * Math.cos(toRad(lat)));
    const approxBounds = {
      lat: { gte: lat - latDelta, lte: lat + latDelta },
      lng: { gte: lng - lngDelta, lte: lng + lngDelta },
    };

    const allItems: FacilityItem[] = [];

    const fetchResults = await Promise.all(
      categories.map(async (cat) => {
        // ev-charger: 충전소 단위 그룹핑
        if (cat === 'ev-charger') {
          const stationResult = await evChargerStationSearch({
            keyword, lat, lng, radius, swLat, swLng, neLat, neLng,
            page: 1, limit: 100,
          });
          return stationResult.items;
        }
        const where = { ...keywordFilter, ...approxBounds, ...buildDepartmentFilter(cat, departments) };
        const records = await CATEGORY_REGISTRY[cat].model().findMany({
          where,
          select: buildListSelect(cat),
          take: 1000,
        });
        return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    );

    for (const items of fetchResults) {
      allItems.push(...items);
    }

    // Haversine으로 정확한 거리 계산 + radius 필터
    // ev-charger는 이미 거리 계산됨, 나머지만 계산
    const withDistance = allItems
      .map((item) => item.distance !== undefined ? item : ({
        ...item,
        distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
      }))
      .filter((item) => item.distance! <= radius)
      .sort((a, b) => a.distance! - b.distance!);

    const total = withDistance.length;
    const skip = (page - 1) * limit;
    const paged = withDistance.slice(skip, skip + limit);

    return { items: paged, total, page, totalPages: Math.ceil(total / limit) };
  }

  // --- bounds 기반 검색 ---
  if (swLat !== undefined && swLng !== undefined && neLat !== undefined && neLng !== undefined) {
    const categories = category ? [category as FacilityCategory] : ALL_CATEGORIES;
    const keywordFilter = buildKeywordFilter(keyword);
    const boundsFilter = buildBoundsFilter(swLat, swLng, neLat, neLng);

    const allItems: FacilityItem[] = [];

    const fetchResults = await Promise.all(
      categories.map(async (cat) => {
        const where = { ...keywordFilter, ...boundsFilter };
        const records = await CATEGORY_REGISTRY[cat].model().findMany({
          where,
          select: buildListSelect(cat),
          take: 1000,
        });
        return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    );

    for (const items of fetchResults) {
      allItems.push(...items);
    }

    const total = allItems.length;
    const skip = (page - 1) * limit;
    const paged = allItems.slice(skip, skip + limit);

    return { items: paged, total, page, totalPages: Math.ceil(total / limit) };
  }

  // --- 키워드/지역 기반 검색 (기존 로직) ---
  const skip = (page - 1) * limit;

  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
    ...buildDepartmentFilter(category, departments),
  };

  // 단일 카테고리: DB skip/take + count
  const orderBy = ORDER_BY_MAP[sort] || ORDER_BY_MAP.name;
  if (category) {
    const model = CATEGORY_REGISTRY[category as FacilityCategory].model();
    const [records, total] = await Promise.all([
      model.findMany({ where, skip, take: limit, orderBy, select: buildListSelect(category as FacilityCategory) }),
      model.count({ where }),
    ]);
    const items = records.map((r: any) => toFacilityItem(r, category as FacilityCategory)); // eslint-disable-line @typescript-eslint/no-explicit-any
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  // 전체 카테고리: 카운트 먼저 → 필요한 카테고리만 fetch
  const counts = await Promise.all(
    ALL_CATEGORIES.map((cat) => CATEGORY_REGISTRY[cat].model().count({ where })),
  );
  const total = counts.reduce((sum, c) => sum + c, 0);

  // 어떤 카테고리에서 몇 개씩 가져올지 계산
  const fetchParams: { cat: FacilityCategory; catSkip: number; catTake: number }[] = [];
  let remainingSkip = skip;
  let remainingTake = limit;

  for (let i = 0; i < ALL_CATEGORIES.length && remainingTake > 0; i++) {
    const catCount = counts[i];
    if (remainingSkip >= catCount) {
      remainingSkip -= catCount;
      continue;
    }
    const catSkip = remainingSkip;
    const catTake = Math.min(remainingTake, catCount - catSkip);
    remainingSkip = 0;
    remainingTake -= catTake;
    fetchParams.push({ cat: ALL_CATEGORIES[i], catSkip, catTake });
  }

  // 필요한 카테고리만 병렬 fetch
  const fetchResults = await Promise.all(
    fetchParams.map(async ({ cat, catSkip, catTake }) => {
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where,
        skip: catSkip,
        take: catTake,
        orderBy,
        select: buildListSelect(cat),
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  return {
    items: fetchResults.flat(),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

// @TASK T1.2 - 시설 상세 조회
// @SPEC docs/planning/02-trd.md#시설-상세-조회

// 상세 조회 응답 타입
interface FacilityDetail {
  id: string;
  category: FacilityCategory;
  name: string;
  address: string | null;
  roadAddress: string | null;
  lat: number;
  lng: number;
  city: string;
  district: string;
  bjdCode: string | null;
  details: Record<string, unknown>;
  sourceId: string;
  sourceUrl: string | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  syncedAt: Date;
}

/**
 * 레코드를 FacilityDetail로 변환 (레지스트리 기반)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDetail(record: any, category: FacilityCategory): FacilityDetail {
  const { detailFields } = CATEGORY_REGISTRY[category];
  const details: Record<string, unknown> = {};
  for (const field of detailFields) {
    details[field] = record[field];
  }
  // hospital: departments 관계 포함
  if (category === 'hospital' && record.departments) {
    details.departments = record.departments.map((d: { dgsbjtCdNm: string; dgsbjtPrSdrCnt: number | null }) => ({
      dgsbjtCdNm: d.dgsbjtCdNm,
      dgsbjtPrSdrCnt: d.dgsbjtPrSdrCnt,
    }));
  }
  // school: enrollments + departments 관계 포함
  if (category === 'school') {
    if (record.enrollments) {
      details.enrollments = record.enrollments.map((e: { grade: number; classCount: number | null }) => ({
        grade: e.grade,
        classCount: e.classCount,
      }));
    }
    if (record.departments) {
      details.departments = record.departments.map((d: { departmentName: string }) => ({
        departmentName: d.departmentName,
      }));
    }
  }

  return {
    id: record.id,
    category,
    name: record.name,
    address: record.address,
    roadAddress: record.roadAddress,
    lat: Number(record.lat),
    lng: Number(record.lng),
    city: record.city,
    district: record.district,
    bjdCode: record.bjdCode,
    details,
    sourceId: record.sourceId,
    sourceUrl: record.sourceUrl,
    viewCount: record.viewCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    syncedAt: record.syncedAt,
  };
}

/**
 * 시설 상세 조회
 * - 카테고리와 ID로 시설 조회
 * - 조회 시 viewCount 증가 (비동기, 응답 대기 안함)
 *
 * @param category - 시설 카테고리
 * @param id - 시설 ID
 * @returns 시설 상세 정보 또는 null
 */
export async function getDetail(category: string, id: string): Promise<FacilityDetail | null> {
  const config = CATEGORY_REGISTRY[category as FacilityCategory];
  if (!config) return null;

  // ev-charger: statId로 충전소 단위 조회
  if (category === 'ev-charger') {
    const { getEvChargerStationDetail } = await import('./evChargerService.js');
    return getEvChargerStationDetail(id);
  }

  const model = config.model();
  const findOptions: { where: { id: string }; include?: Record<string, boolean> } = { where: { id } };
  if (category === 'hospital') {
    findOptions.include = { departments: true };
  }
  if (category === 'school') {
    findOptions.include = { enrollments: true, departments: true };
  }
  const record = await model.findUnique(findOptions);
  if (!record) return null;

  // 조회수 증가 (배치 처리 — 인메모리 버퍼에 누적 후 일괄 flush)
  bufferViewCount(category as FacilityCategory, id);

  return toDetail(record, category as FacilityCategory);
}

/**
 * 사이트맵용 전체 ID 조회
 * @param category - 시설 카테고리
 * @returns { id, updatedAt } 배열
 */
export async function getAllIds(
  category: FacilityCategory,
  limit?: number
): Promise<{ id: string; updatedAt: Date }[]> {
  const config = CATEGORY_REGISTRY[category];
  if (!config) return [];

  // ev-charger: statId 단위로 반환 (충전소 단위 사이트맵)
  if (category === 'ev-charger') {
    const stations = await prisma.evCharger.findMany({
      where: { statId: { not: null } },
      select: { statId: true, updatedAt: true },
      distinct: ['statId'],
      ...(limit !== undefined ? { take: limit } : {}),
    });
    return stations.map((s) => ({ id: s.statId!, updatedAt: s.updatedAt }));
  }

  return config.model().findMany({
    select: { id: true, updatedAt: true },
    ...(limit !== undefined ? { take: limit } : {}),
  });
}

export async function getCategoryCountAndMaxDate(
  category: FacilityCategory,
  limit?: number
): Promise<{ count: number; maxUpdatedAt: Date | null }> {
  const config = CATEGORY_REGISTRY[category];
  if (!config) return { count: 0, maxUpdatedAt: null };

  if (category === 'ev-charger') {
    const [cntResult, latest] = await Promise.all([
      prisma.$queryRaw<[{ cnt: bigint }]>`
        SELECT COUNT(DISTINCT statId) AS cnt FROM EvCharger WHERE statId IS NOT NULL
      `,
      prisma.evCharger.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
    ]);
    const rawCount = Number(cntResult[0].cnt);
    return {
      count: limit ? Math.min(rawCount, limit) : rawCount,
      maxUpdatedAt: latest?.updatedAt ?? null,
    };
  }

  const model = config.model() as {
    count(): Promise<number>;
    findFirst(args: object): Promise<{ updatedAt: Date } | null>;
  };
  const [rawCount, latest] = await Promise.all([
    model.count(),
    model.findFirst({ select: { updatedAt: true }, orderBy: { updatedAt: 'desc' } }),
  ]);
  return {
    count: limit ? Math.min(rawCount, limit) : rawCount,
    maxUpdatedAt: latest?.updatedAt ?? null,
  };
}

// @TASK T1.3 - 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

// 지역별 조회 결과 타입
interface RegionSearchResult {
  region: {
    city: string;
    district: string;
    bjdCode: string | null;
  };
  category: string;
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * slug 또는 한글 지역명을 실제 지역 정보로 변환
 * @param city - 시/도 (한글 또는 slug)
 * @param district - 구/군 (한글 또는 slug)
 * @returns 해결된 지역 정보
 */
async function resolveRegion(
  city: string,
  district: string
): Promise<{ city: string; district: string; bjdCode: string | null }> {
  const fullCityName = CITY_SLUG_TO_FULL[city];
  const shortCityName = CITY_SLUG_TO_SHORT[city];

  // Region 테이블에서 조회 (city + district 또는 city + slug, slug city도 지원)
  const region = await prisma.region.findFirst({
    where: {
      OR: [
        // 기존 조건 (slug 그대로)
        { city, district },
        { city, slug: district },
        // fullCityName (서울특별시) 조건
        ...(fullCityName
          ? [
              { city: fullCityName, district },
              { city: fullCityName, slug: district },
            ]
          : []),
        // shortCityName (서울) 조건
        ...(shortCityName
          ? [
              { city: shortCityName, district },
              { city: shortCityName, slug: district },
            ]
          : []),
      ],
    },
  });

  if (region) {
    return {
      city: region.city,
      district: region.district,
      bjdCode: region.bjdCode,
    };
  }

  // Region 테이블에 없으면 입력값 그대로 반환
  return {
    city,
    district,
    bjdCode: null,
  };
}

/**
 * 지역별 시설 조회
 * @param city - 시/도 (한글 또는 slug)
 * @param district - 구/군 (한글 또는 slug)
 * @param category - 시설 카테고리
 * @param options - 페이지네이션 옵션
 * @returns 지역별 시설 목록
 */
export async function getByRegion(
  city: string,
  district: string,
  category: string,
  options: { page?: number; limit?: number; departments?: string[] } = {}
): Promise<RegionSearchResult> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, departments } = options;

  // slug -> 한글 변환
  const resolved = await resolveRegion(city, district);

  // 시설 테이블은 '서울특별시', Region 테이블은 '서울'처럼 city 형태가 다를 수 있음
  const cityVariants = [
    resolved.city,
    CITY_SLUG_TO_FULL[city],
    CITY_SLUG_TO_SHORT[city],
  ].filter((v): v is string => !!v && v !== resolved.city);
  const cityCondition = cityVariants.length > 0
    ? { in: [resolved.city, ...cityVariants] }
    : resolved.city;

  const where = {
    city: cityCondition,
    district: resolved.district,
    ...buildDepartmentFilter(category, departments),
  };

  // trash: WasteSchedule 테이블 조회 (좌표 없는 일정 데이터)
  if (category === 'trash') {
    const cityVariants = [
      resolved.city,
      CITY_SLUG_TO_FULL[city],
      CITY_SLUG_TO_SHORT[city],
    ].filter((v): v is string => !!v);
    const uniqueCities = [...new Set(cityVariants)];

    const wasteWhere = {
      city: uniqueCities.length > 1 ? { in: uniqueCities } : uniqueCities[0],
      district: resolved.district,
    };

    const [records, total] = await Promise.all([
      prisma.wasteSchedule.findMany({
        where: wasteWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ targetRegion: 'asc' }],
      }),
      prisma.wasteSchedule.count({ where: wasteWhere }),
    ]);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const items = records.map((r: any) => ({
      ...mapWasteScheduleToFacilityItem(r),
      ...(r.details ? { extras: r.details as Record<string, unknown> } : {}),
    }));

    return {
      region: { city: resolved.city, district: resolved.district, bjdCode: resolved.bjdCode },
      category: 'trash',
      items,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ev-charger: 충전소 단위 그룹 검색 (search()와 동일)
  if (category === 'ev-charger') {
    const result = await evChargerStationSearch({
      city: resolved.city,
      district: resolved.district,
      page,
      limit,
    });
    return {
      region: { city: resolved.city, district: resolved.district, bjdCode: resolved.bjdCode },
      category,
      items: result.items,
      total: result.total,
      page: result.page,
      totalPages: result.totalPages,
    };
  }

  const config = CATEGORY_REGISTRY[category as FacilityCategory];
  let items: FacilityItem[] = [];
  let total = 0;

  if (config) {
    const model = config.model();
    const [records, count] = await Promise.all([
      model.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
        select: buildListSelect(category as FacilityCategory),
      }),
      model.count({ where }),
    ]);
    items = records.map((r: any) => toFacilityItem(r, category as FacilityCategory)); // eslint-disable-line @typescript-eslint/no-explicit-any
    total = count;
  }

  return {
    region: {
      city: resolved.city,
      district: resolved.district,
      bjdCode: resolved.bjdCode,
    },
    category,
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 지역별 전체 카테고리 시설 조회
 * - 모든 카테고리의 시설을 합산하여 페이지네이션
 * - search()의 전체-카테고리 페이지네이션 로직 재활용
 */
export async function getByRegionAll(
  city: string,
  district: string,
  options: { page?: number; limit?: number } = {}
): Promise<{
  region: { city: string; district: string; bjdCode: string | null };
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

  const resolved = await resolveRegion(city, district);

  // 시설 테이블은 '서울특별시', Region 테이블은 '서울'처럼 city 형태가 다를 수 있음
  const cityVariants = [
    CITY_SLUG_TO_FULL[city],
    CITY_SLUG_TO_SHORT[city],
  ].filter((v): v is string => !!v && v !== resolved.city);
  const cityCondition = cityVariants.length > 0
    ? { in: [resolved.city, ...cityVariants] }
    : resolved.city;

  const where = {
    city: cityCondition,
    district: resolved.district,
  };

  // 전체 카테고리 카운트 (trash 포함)
  const trashWhere = { city: cityCondition, district: resolved.district };
  const [counts, trashCount] = await Promise.all([
    Promise.all(ALL_CATEGORIES.map((cat) => CATEGORY_REGISTRY[cat].model().count({ where }))),
    prisma.wasteSchedule.count({ where: trashWhere }),
  ]);
  const total = counts.reduce((sum, c) => sum + c, 0) + trashCount;

  // skip/take 계산 → 필요한 카테고리만 병렬 fetch
  const skip = (page - 1) * limit;
  const fetchParams: { cat: FacilityCategory; catSkip: number; catTake: number }[] = [];
  let remainingSkip = skip;
  let remainingTake = limit;

  for (let i = 0; i < ALL_CATEGORIES.length && remainingTake > 0; i++) {
    const catCount = counts[i];
    if (remainingSkip >= catCount) {
      remainingSkip -= catCount;
      continue;
    }
    const catSkip = remainingSkip;
    const catTake = Math.min(remainingTake, catCount - catSkip);
    remainingSkip = 0;
    remainingTake -= catTake;
    fetchParams.push({ cat: ALL_CATEGORIES[i], catSkip, catTake });
  }

  const fetchResults = await Promise.all(
    fetchParams.map(async ({ cat, catSkip, catTake }) => {
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where,
        skip: catSkip,
        take: catTake,
        orderBy: { name: 'asc' },
        select: buildListSelect(cat),
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  const allItems = fetchResults.flat();

  // trash(WasteSchedule) 페이지네이션 처리
  if (remainingTake > 0 && trashCount > 0) {
    if (remainingSkip < trashCount) {
      const trashSkip = remainingSkip;
      const trashTake = Math.min(remainingTake, trashCount - trashSkip);
      const trashRecords = await prisma.wasteSchedule.findMany({
        where: trashWhere,
        skip: trashSkip,
        take: trashTake,
        orderBy: { targetRegion: 'asc' },
      });
      allItems.push(...trashRecords.map(mapWasteScheduleToFacilityItem));
    }
  }

  return {
    region: {
      city: resolved.city,
      district: resolved.district,
      bjdCode: resolved.bjdCode,
    },
    items: allItems,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getRegionCategoryCombinations(): Promise<
  Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }>
> {
  // Region 테이블에서 slug 조회
  const allRegions = await prisma.region.findMany({
    select: { city: true, district: true, slug: true },
  });

  // district slug lookup: "서울|강남구" -> "gangnam"
  // DB slug에서 잔존하는 -(gu|si|gun) 접미사 정규화 (slug 변경 후 미동기화 대응)
  const SUFFIX_RE = /-(gu|si|gun)$/;
  const regionSlugMap = new Map<string, string>();
  for (const r of allRegions) {
    const normalized = SUFFIX_RE.test(r.slug) ? r.slug.replace(SUFFIX_RE, '') : r.slug;
    regionSlugMap.set(`${r.city}|${r.district}`, normalized);
  }

  // city name -> slug reverse map (서울 -> seoul, 서울특별시 -> seoul)
  const cityToSlug = new Map<string, string>();
  for (const [slug, shortName] of Object.entries(CITY_SLUG_TO_SHORT)) {
    cityToSlug.set(shortName, slug);
  }
  for (const [slug, fullName] of Object.entries(CITY_SLUG_TO_FULL)) {
    cityToSlug.set(fullName, slug);
  }

  const results: Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }> = [];

  for (const category of ALL_CATEGORIES) {
    const config = CATEGORY_REGISTRY[category];
    const model = config.model();
    const regions = await model.findMany({
      select: { city: true, district: true },
      distinct: ['city', 'district'],
      where: {
        city: { not: '' },
        district: { not: '' },
      },
    });

    for (const region of regions) {
      const cs = cityToSlug.get(region.city);
      if (!cs) continue;

      // 시설 테이블 city(서울특별시)와 Region 테이블 city(서울) 불일치 대응
      const ds = regionSlugMap.get(`${region.city}|${region.district}`)
        || regionSlugMap.get(`${CITY_SLUG_TO_SHORT[cs]}|${region.district}`);
      if (!ds) continue;

      results.push({
        city: region.city,
        district: region.district,
        citySlug: cs,
        districtSlug: ds,
        category,
      });
    }
  }

  // trash(WasteSchedule) 지역 조합 추가
  const wasteRegions = await prisma.wasteSchedule.findMany({
    select: { city: true, district: true },
    distinct: ['city', 'district'],
    where: {
      city: { not: '' },
      district: { not: '' },
    },
  });

  for (const region of wasteRegions) {
    const cs = cityToSlug.get(region.city);
    if (!cs) continue;

    const ds = regionSlugMap.get(`${region.city}|${region.district}`)
      || regionSlugMap.get(`${CITY_SLUG_TO_SHORT[cs]}|${region.district}`);
    if (!ds) continue;

    results.push({
      city: region.city,
      district: region.district,
      citySlug: cs,
      districtSlug: ds,
      category: 'trash',
    });
  }

  return results;
}
