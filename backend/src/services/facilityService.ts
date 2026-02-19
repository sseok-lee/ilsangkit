// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

import prisma from '../lib/prisma.js';
import { FacilitySearchInput } from '../schemas/facility.js';
import { PAGINATION, SEARCH_DEFAULTS } from '../constants/index.js';

// 카테고리 타입
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'kiosk' | 'parking' | 'aed' | 'library' | 'hospital' | 'pharmacy';

const ALL_CATEGORIES: FacilityCategory[] = ['toilet', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library', 'hospital', 'pharmacy'];

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

// --- Category Registry ---

interface CategoryConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: () => any;
  listFields: string[];
  detailFields: string[];
}

const CATEGORY_REGISTRY: Record<FacilityCategory, CategoryConfig> = {
  toilet: {
    model: () => prisma.toilet,
    listFields: ['operatingHours', 'hasDisabledToilet'],
    detailFields: ['operatingHours', 'maleToilets', 'maleUrinals', 'femaleToilets', 'hasDisabledToilet', 'openTime', 'managingOrg', 'phoneNumber', 'installDate', 'ownershipType', 'sewageTreatment', 'hasEmergencyBell', 'emergencyBellLocation', 'hasCCTV', 'hasDiaperChangingTable', 'diaperChangingLocation', 'maleDisabledToilets', 'maleDisabledUrinals', 'maleChildToilets', 'maleChildUrinals', 'femaleDisabledToilets', 'femaleChildToilets', 'remodelingDate', 'facilityType', 'legalBasis', 'govCode', 'dataDate'],
  },
  wifi: {
    model: () => prisma.wifi,
    listFields: ['ssid', 'installLocation'],
    detailFields: ['ssid', 'installDate', 'serviceProvider', 'installLocation', 'managementAgency', 'phoneNumber', 'installLocationDetail', 'govCode', 'dataDate'],
  },
  clothes: {
    model: () => prisma.clothes,
    listFields: ['detailLocation'],
    detailFields: ['managementAgency', 'phoneNumber', 'dataDate', 'detailLocation', 'providerCode', 'providerName'],
  },
  kiosk: {
    model: () => prisma.kiosk,
    listFields: ['weekdayOperatingHours', 'wheelchairAccessible'],
    detailFields: ['detailLocation', 'operationAgency', 'weekdayOperatingHours', 'saturdayOperatingHours', 'holidayOperatingHours', 'blindKeypad', 'voiceGuide', 'brailleOutput', 'wheelchairAccessible', 'availableDocuments', 'govCode', 'installPosition', 'dataDate'],
  },
  parking: {
    model: () => prisma.parking,
    listFields: ['capacity', 'baseFee', 'feeType'],
    detailFields: ['parkingType', 'lotType', 'capacity', 'baseFee', 'baseTime', 'additionalFee', 'additionalTime', 'dailyMaxFee', 'monthlyFee', 'operatingHours', 'phone', 'paymentMethod', 'remarks', 'hasDisabledParking', 'zoneClass', 'alternateParking', 'operatingDays', 'feeType', 'dailyMaxFeeHours', 'managingOrg', 'dataDate', 'providerCode', 'providerName'],
  },
  aed: {
    model: () => prisma.aed,
    listFields: ['buildPlace', 'org'],
    detailFields: ['buildPlace', 'org', 'clerkTel', 'mfg', 'model', 'monSttTme', 'monEndTme', 'tueSttTme', 'tueEndTme', 'wedSttTme', 'wedEndTme', 'thuSttTme', 'thuEndTme', 'friSttTme', 'friEndTme', 'satSttTme', 'satEndTme', 'sunSttTme', 'sunEndTme', 'holSttTme', 'holEndTme', 'dataDate'],
  },
  library: {
    model: () => prisma.library,
    listFields: ['weekdayOpenTime', 'weekdayCloseTime', 'seatCount'],
    detailFields: ['libraryType', 'closedDays', 'weekdayOpenTime', 'weekdayCloseTime', 'saturdayOpenTime', 'saturdayCloseTime', 'holidayOpenTime', 'holidayCloseTime', 'seatCount', 'bookCount', 'serialCount', 'nonBookCount', 'loanableBooks', 'loanableDays', 'phoneNumber', 'homepageUrl', 'operatingOrg', 'lotArea', 'buildingArea', 'dataDate', 'providerCode', 'providerName'],
  },
  hospital: {
    model: () => prisma.hospital,
    listFields: ['clCdNm', 'phone', 'drTotCnt'],
    detailFields: ['phone', 'homepage', 'postNo', 'estbDd', 'ykiho', 'clCd', 'clCdNm', 'sidoCd', 'sgguCd', 'emdongNm', 'drTotCnt', 'mdeptSdrCnt', 'mdeptGdrCnt', 'mdeptIntnCnt', 'mdeptResdntCnt', 'detySdrCnt', 'detyGdrCnt', 'detyIntnCnt', 'detyResdntCnt', 'cmdcSdrCnt', 'cmdcGdrCnt', 'cmdcIntnCnt', 'cmdcResdntCnt', 'pnursCnt', 'dataDate'],
  },
  pharmacy: {
    model: () => prisma.pharmacy,
    listFields: ['phone', 'dutyTime1s', 'dutyTime1c'],
    detailFields: ['phone', 'dutyTel3', 'hpid', 'postCdn1', 'postCdn2', 'dutyTime1s', 'dutyTime1c', 'dutyTime2s', 'dutyTime2c', 'dutyTime3s', 'dutyTime3c', 'dutyTime4s', 'dutyTime4c', 'dutyTime5s', 'dutyTime5c', 'dutyTime6s', 'dutyTime6c', 'dutyTime7s', 'dutyTime7c', 'dutyTime8s', 'dutyTime8c', 'dutyMapimg', 'dutyInf', 'dutyEtc', 'dataDate'],
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
}

const CATEGORY_LABELS: Record<FacilityCategory, string> = {
  toilet: '공공화장실',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  kiosk: '무인민원발급기',
  parking: '공영주차장',
  aed: '자동심장충격기',
  library: '공공도서관',
  hospital: '병원',
  pharmacy: '약국',
};

// 크로스 카테고리 추천 맵
const CROSS_CATEGORY_MAP: Record<FacilityCategory, FacilityCategory[]> = {
  hospital: ['pharmacy'],
  pharmacy: ['hospital'],
  parking: ['toilet', 'library', 'kiosk'],
  library: ['parking', 'toilet', 'wifi'],
  toilet: ['wifi'],
  wifi: ['toilet'],
  aed: ['hospital'],
  kiosk: ['parking'],
  clothes: [],
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
      const records = await CATEGORY_REGISTRY[cat].model().findMany({
        where: approxBounds,
        select: buildListSelect(cat),
      });
      return records.map((r: any) => toFacilityItem(r, cat)); // eslint-disable-line @typescript-eslint/no-explicit-any
    }),
  );

  const allItems = fetchResults.flat();

  return allItems
    .map((item) => ({
      ...item,
      distance: Math.round(haversineDistance(lat, lng, item.lat, item.lng) * 1000),
    }))
    .filter((item) => item.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 6);
}

/**
 * 카테고리별 그룹핑 검색
 * - 각 카테고리별 건수 + 상위 3건 미리보기 반환
 * - count가 0인 카테고리는 제외
 */
export async function searchGrouped(params: FacilitySearchInput): Promise<GroupedSearchResult> {
  const { keyword, city, district } = params;

  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  const results = await Promise.all(
    ALL_CATEGORIES.map(async (cat) => {
      const model = CATEGORY_REGISTRY[cat].model();
      const [count, records] = await Promise.all([
        model.count({ where }),
        model.findMany({ where, take: 3, select: buildListSelect(cat) }),
      ]);
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        count,
        items: records.map((r: any) => toFacilityItem(r, cat)), // eslint-disable-line @typescript-eslint/no-explicit-any
      };
    }),
  );

  const categories = results.filter((r) => r.count > 0);
  const totalCount = categories.reduce((sum, r) => sum + r.count, 0);

  return { categories, totalCount };
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
  const { category, keyword, lat, lng, radius = SEARCH_DEFAULTS.RADIUS_METERS, swLat, swLng, neLat, neLng, city, district, page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT, sort = 'name' } = params;

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
          select: buildListSelect(cat),
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
          select: buildListSelect(cat),
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

const CITY_SLUG_TO_FULL: Record<string, string> = {
  seoul: '서울특별시',
  busan: '부산광역시',
  daegu: '대구광역시',
  incheon: '인천광역시',
  gwangju: '광주광역시',
  daejeon: '대전광역시',
  ulsan: '울산광역시',
  sejong: '세종특별자치시',
  gyeonggi: '경기도',
  gangwon: '강원특별자치도',
  chungbuk: '충청북도',
  chungnam: '충청남도',
  jeonbuk: '전북특별자치도',
  jeonnam: '전라남도',
  gyeongbuk: '경상북도',
  gyeongnam: '경상남도',
  jeju: '제주특별자치도',
};

const CITY_SLUG_TO_SHORT: Record<string, string> = {
  seoul: '서울',
  busan: '부산',
  daegu: '대구',
  incheon: '인천',
  gwangju: '광주',
  daejeon: '대전',
  ulsan: '울산',
  sejong: '세종',
  gyeonggi: '경기',
  gangwon: '강원',
  chungbuk: '충북',
  chungnam: '충남',
  jeonbuk: '전북',
  jeonnam: '전남',
  gyeongbuk: '경북',
  gyeongnam: '경남',
  jeju: '제주',
};

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
  options: { page?: number; limit?: number } = {}
): Promise<RegionSearchResult> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

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

  // 전체 카테고리 카운트
  const counts = await Promise.all(
    ALL_CATEGORIES.map((cat) => CATEGORY_REGISTRY[cat].model().count({ where })),
  );
  const total = counts.reduce((sum, c) => sum + c, 0);

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

  return {
    region: {
      city: resolved.city,
      district: resolved.district,
      bjdCode: resolved.bjdCode,
    },
    items: fetchResults.flat(),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 사이트맵용: 실제 데이터가 있는 지역-카테고리 조합 조회
 */
export async function getRegionCategoryCombinations(): Promise<
  Array<{ city: string; district: string; citySlug: string; districtSlug: string; category: string }>
> {
  // Region 테이블에서 slug 조회
  const allRegions = await prisma.region.findMany({
    select: { city: true, district: true, slug: true },
  });

  // district slug lookup: "서울|강남구" -> "gangnam"
  const regionSlugMap = new Map<string, string>();
  for (const r of allRegions) {
    regionSlugMap.set(`${r.city}|${r.district}`, r.slug);
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

  return results;
}
