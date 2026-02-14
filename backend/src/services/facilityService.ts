// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

import prisma from '../lib/prisma.js';
import { FacilitySearchInput } from '../schemas/facility.js';
import { PAGINATION, SEARCH_DEFAULTS } from '../constants/index.js';

// 카테고리 타입
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'kiosk' | 'parking' | 'aed' | 'library';

const ALL_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library'];

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

// --- Category Registry ---

interface CategoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: () => any;
  detailFields: string[];
}

const CATEGORY_REGISTRY: Record<FacilityCategory, CategoryConfig> = {
  toilet: {
    model: () => prisma.toilet,
    detailFields: ['operatingHours', 'maleToilets', 'maleUrinals', 'femaleToilets', 'hasDisabledToilet', 'openTime', 'managingOrg'],
  },
  wifi: {
    model: () => prisma.wifi,
    detailFields: ['ssid', 'installDate', 'serviceProvider', 'installLocation', 'managementAgency', 'phoneNumber'],
  },
  clothes: {
    model: () => prisma.clothes,
    detailFields: ['managementAgency', 'phoneNumber', 'dataDate', 'detailLocation'],
  },
  kiosk: {
    model: () => prisma.kiosk,
    detailFields: ['detailLocation', 'operationAgency', 'weekdayOperatingHours', 'saturdayOperatingHours', 'holidayOperatingHours', 'blindKeypad', 'voiceGuide', 'brailleOutput', 'wheelchairAccessible', 'availableDocuments'],
  },
  parking: {
    model: () => prisma.parking,
    detailFields: ['parkingType', 'lotType', 'capacity', 'baseFee', 'baseTime', 'additionalFee', 'additionalTime', 'dailyMaxFee', 'monthlyFee', 'operatingHours', 'phone', 'paymentMethod', 'remarks', 'hasDisabledParking'],
  },
  aed: {
    model: () => prisma.aed,
    detailFields: ['buildPlace', 'org', 'clerkTel', 'mfg', 'model', 'monSttTme', 'monEndTme', 'tueSttTme', 'tueEndTme', 'wedSttTme', 'wedEndTme', 'thuSttTme', 'thuEndTme', 'friSttTme', 'friEndTme', 'satSttTme', 'satEndTme', 'sunSttTme', 'sunEndTme', 'holSttTme', 'holEndTme'],
  },
  library: {
    model: () => prisma.library,
    detailFields: ['libraryType', 'closedDays', 'weekdayOpenTime', 'weekdayCloseTime', 'saturdayOpenTime', 'saturdayCloseTime', 'holidayOpenTime', 'holidayCloseTime', 'seatCount', 'bookCount', 'serialCount', 'nonBookCount', 'loanableBooks', 'loanableDays', 'phoneNumber', 'homepageUrl', 'operatingOrg'],
  },
};

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
}

interface SearchResult {
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toFacilityItem(record: any, category: FacilityCategory): FacilityItem {
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
    ],
  };
}

/**
 * 지역 필터 조건 생성
 */
function buildRegionFilter(city?: string, district?: string): { city?: string; district?: string } {
  const filter: { city?: string; district?: string } = {};
  if (city) filter.city = city;
  if (district) filter.district = district;
  return filter;
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
 * 시설 검색
 * - 좌표 기반 검색 (lat/lng + radius)
 * - bounds 기반 검색 (swLat/swLng/neLat/neLng)
 * - 키워드 검색
 * - 카테고리 필터
 * - 지역 필터
 */
export async function search(params: FacilitySearchInput): Promise<SearchResult> {
  const { category, keyword, lat, lng, radius = SEARCH_DEFAULTS.RADIUS_METERS, swLat, swLng, neLat, neLng, city, district, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = params;

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
        const where = { ...keywordFilter, ...approxBounds };
        const records = await CATEGORY_REGISTRY[cat].model().findMany({
          where,
          select: BASE_SELECT_FIELDS,
        });
        return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
      }),
    );

    for (const items of fetchResults) {
      allItems.push(...items);
    }

    // Haversine으로 정확한 거리 계산 + radius 필터
    const withDistance = allItems
      .map((item) => ({
        ...item,
        distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
      }))
      .filter((item) => item.distance <= radius)
      .sort((a, b) => a.distance - b.distance);

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
          select: BASE_SELECT_FIELDS,
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
  };

  // 단일 카테고리: DB skip/take + count
  if (category) {
    const model = CATEGORY_REGISTRY[category as FacilityCategory].model();
    const [records, total] = await Promise.all([
      model.findMany({ where, skip, take: limit, select: BASE_SELECT_FIELDS }),
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
        select: BASE_SELECT_FIELDS,
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

  const model = config.model();
  const record = await model.findUnique({ where: { id } });
  if (!record) return null;

  // 조회수 증가 (비동기)
  model.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});

  return toDetail(record, category as FacilityCategory);
}

/**
 * 사이트맵용 전체 ID 조회
 * @param category - 시설 카테고리
 * @returns { id, updatedAt } 배열
 */
export async function getAllIds(
  category: FacilityCategory
): Promise<{ id: string; updatedAt: Date }[]> {
  const config = CATEGORY_REGISTRY[category];
  if (!config) return [];
  return config.model().findMany({ select: { id: true, updatedAt: true } });
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
  // Region 테이블에서 조회 (city + district 또는 city + slug)
  const region = await prisma.region.findFirst({
    where: {
      OR: [
        { city, district },
        { city, slug: district },
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
  options: { page?: number; limit?: number } = {}
): Promise<RegionSearchResult> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

  // slug -> 한글 변환
  const resolved = await resolveRegion(city, district);

  const where = {
    city: resolved.city,
    district: resolved.district,
  };

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
        select: BASE_SELECT_FIELDS,
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
 * 사이트맵용: 실제 데이터가 있는 지역-카테고리 조합 조회
 */
export async function getRegionCategoryCombinations(): Promise<
  Array<{ city: string; district: string; category: string }>
> {
  const results: Array<{ city: string; district: string; category: string }> = [];

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
      results.push({
        city: region.city,
        district: region.district,
        category,
      });
    }
  }

  return results;
}
