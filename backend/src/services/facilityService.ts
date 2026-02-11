// @TASK T1.1, T1.2, T1.3 - 시설 검색, 상세 조회, 지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

import prisma from '../lib/prisma.js';
import { FacilitySearchInput } from '../schemas/facility.js';
import type { Toilet, Wifi, Clothes, Kiosk, Parking } from '@prisma/client';

// 카테고리 타입
export type FacilityCategory = 'toilet' | 'wifi' | 'clothes' | 'kiosk' | 'parking';

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
}

interface SearchResult {
  items: FacilityItem[];
  total: number;
  page: number;
  totalPages: number;
}

// 각 테이블 레코드를 FacilityItem으로 변환
type FacilityRecord = Pick<Toilet | Wifi | Clothes | Kiosk | Parking,
  'id' | 'name' | 'address' | 'roadAddress' | 'lat' | 'lng' | 'city' | 'district'>;

function toFacilityItem(record: FacilityRecord, category: FacilityCategory): FacilityItem {
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
function buildKeywordFilter(keyword?: string) {
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
function buildRegionFilter(city?: string, district?: string) {
  const filter: { city?: string; district?: string } = {};
  if (city) filter.city = city;
  if (district) filter.district = district;
  return filter;
}

/**
 * 단일 테이블 검색 함수들
 */
async function searchToilets(params: FacilitySearchInput): Promise<FacilityItem[]> {
  const { keyword, city, district } = params;
  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  const records = await prisma.toilet.findMany({
    where,
    select: BASE_SELECT_FIELDS,
  });

  return records.map((r) => toFacilityItem(r, 'toilet'));
}

async function searchWifis(params: FacilitySearchInput): Promise<FacilityItem[]> {
  const { keyword, city, district } = params;
  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  const records = await prisma.wifi.findMany({
    where,
    select: BASE_SELECT_FIELDS,
  });

  return records.map((r) => toFacilityItem(r, 'wifi'));
}

async function searchClothes(params: FacilitySearchInput): Promise<FacilityItem[]> {
  const { keyword, city, district } = params;
  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  const records = await prisma.clothes.findMany({
    where,
    select: BASE_SELECT_FIELDS,
  });

  return records.map((r) => toFacilityItem(r, 'clothes'));
}

async function searchKiosks(params: FacilitySearchInput): Promise<FacilityItem[]> {
  const { keyword, city, district } = params;
  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  const records = await prisma.kiosk.findMany({
    where,
    select: BASE_SELECT_FIELDS,
  });

  return records.map((r) => toFacilityItem(r, 'kiosk'));
}

async function searchParkings(params: FacilitySearchInput): Promise<FacilityItem[]> {
  const { keyword, city, district } = params;
  const where = {
    ...buildKeywordFilter(keyword),
    ...buildRegionFilter(city, district),
  };

  const records = await prisma.parking.findMany({
    where,
    select: BASE_SELECT_FIELDS,
  });

  return records.map((r) => toFacilityItem(r, 'parking'));
}

/**
 * 단일 카테고리 검색
 */
async function searchSingleCategory(
  category: FacilityCategory,
  params: FacilitySearchInput
): Promise<FacilityItem[]> {
  switch (category) {
    case 'toilet':
      return searchToilets(params);
    case 'wifi':
      return searchWifis(params);
    case 'clothes':
      return searchClothes(params);
    case 'kiosk':
      return searchKiosks(params);
    case 'parking':
      return searchParkings(params);
    default:
      return [];
  }
}

/**
 * 시설 검색
 * - 키워드 검색
 * - 카테고리 필터
 * - 지역 필터
 * - 페이지네이션
 *
 * NOTE: 거리 계산/정렬은 클라이언트에서 수행 (위치정보사업 신고 의무 회피)
 */
export async function search(params: FacilitySearchInput): Promise<SearchResult> {
  const { category, page = 1, limit = 20 } = params;

  let allItems: FacilityItem[];

  // 특정 카테고리면 해당 테이블만, 아니면 전체 테이블 병렬 쿼리
  if (category) {
    allItems = await searchSingleCategory(category as FacilityCategory, params);
  } else {
    const [toilets, wifis, clothes, kiosks, parkings] = await Promise.all([
      searchToilets(params),
      searchWifis(params),
      searchClothes(params),
      searchKiosks(params),
      searchParkings(params),
    ]);
    allItems = [...toilets, ...wifis, ...clothes, ...kiosks, ...parkings];
  }

  const total = allItems.length;
  const startIndex = (page - 1) * limit;
  const paginatedItems = allItems.slice(startIndex, startIndex + limit);

  return {
    items: paginatedItems,
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
 * Toilet 레코드를 FacilityDetail로 변환
 */
function toiletToDetail(toilet: Toilet): FacilityDetail {
  return {
    id: toilet.id,
    category: 'toilet',
    name: toilet.name,
    address: toilet.address,
    roadAddress: toilet.roadAddress,
    lat: Number(toilet.lat),
    lng: Number(toilet.lng),
    city: toilet.city,
    district: toilet.district,
    bjdCode: toilet.bjdCode,
    details: {
      operatingHours: toilet.operatingHours,
      maleToilets: toilet.maleToilets,
      maleUrinals: toilet.maleUrinals,
      femaleToilets: toilet.femaleToilets,
      hasDisabledToilet: toilet.hasDisabledToilet,
      openTime: toilet.openTime,
      managingOrg: toilet.managingOrg,
    },
    sourceId: toilet.sourceId,
    sourceUrl: toilet.sourceUrl,
    viewCount: toilet.viewCount,
    createdAt: toilet.createdAt,
    updatedAt: toilet.updatedAt,
    syncedAt: toilet.syncedAt,
  };
}

/**
 * Wifi 레코드를 FacilityDetail로 변환
 */
function wifiToDetail(wifi: Wifi): FacilityDetail {
  return {
    id: wifi.id,
    category: 'wifi',
    name: wifi.name,
    address: wifi.address,
    roadAddress: wifi.roadAddress,
    lat: Number(wifi.lat),
    lng: Number(wifi.lng),
    city: wifi.city,
    district: wifi.district,
    bjdCode: wifi.bjdCode,
    details: {
      ssid: wifi.ssid,
      installDate: wifi.installDate,
      serviceProvider: wifi.serviceProvider,
      installLocation: wifi.installLocation,
      managementAgency: wifi.managementAgency,
      phoneNumber: wifi.phoneNumber,
    },
    sourceId: wifi.sourceId,
    sourceUrl: wifi.sourceUrl,
    viewCount: wifi.viewCount,
    createdAt: wifi.createdAt,
    updatedAt: wifi.updatedAt,
    syncedAt: wifi.syncedAt,
  };
}

/**
 * Clothes 레코드를 FacilityDetail로 변환
 */
function clothesToDetail(clothes: Clothes): FacilityDetail {
  return {
    id: clothes.id,
    category: 'clothes',
    name: clothes.name,
    address: clothes.address,
    roadAddress: clothes.roadAddress,
    lat: Number(clothes.lat),
    lng: Number(clothes.lng),
    city: clothes.city,
    district: clothes.district,
    bjdCode: clothes.bjdCode,
    details: {
      managementAgency: clothes.managementAgency,
      phoneNumber: clothes.phoneNumber,
      dataDate: clothes.dataDate,
      detailLocation: clothes.detailLocation,
    },
    sourceId: clothes.sourceId,
    sourceUrl: clothes.sourceUrl,
    viewCount: clothes.viewCount,
    createdAt: clothes.createdAt,
    updatedAt: clothes.updatedAt,
    syncedAt: clothes.syncedAt,
  };
}

/**
 * Kiosk 레코드를 FacilityDetail로 변환
 */
function kioskToDetail(kiosk: Kiosk): FacilityDetail {
  return {
    id: kiosk.id,
    category: 'kiosk',
    name: kiosk.name,
    address: kiosk.address,
    roadAddress: kiosk.roadAddress,
    lat: Number(kiosk.lat),
    lng: Number(kiosk.lng),
    city: kiosk.city,
    district: kiosk.district,
    bjdCode: kiosk.bjdCode,
    details: {
      detailLocation: kiosk.detailLocation,
      operationAgency: kiosk.operationAgency,
      weekdayOperatingHours: kiosk.weekdayOperatingHours,
      saturdayOperatingHours: kiosk.saturdayOperatingHours,
      holidayOperatingHours: kiosk.holidayOperatingHours,
      blindKeypad: kiosk.blindKeypad,
      voiceGuide: kiosk.voiceGuide,
      brailleOutput: kiosk.brailleOutput,
      wheelchairAccessible: kiosk.wheelchairAccessible,
      availableDocuments: kiosk.availableDocuments,
    },
    sourceId: kiosk.sourceId,
    sourceUrl: kiosk.sourceUrl,
    viewCount: kiosk.viewCount,
    createdAt: kiosk.createdAt,
    updatedAt: kiosk.updatedAt,
    syncedAt: kiosk.syncedAt,
  };
}

/**
 * Parking 레코드를 FacilityDetail로 변환
 */
function parkingToDetail(parking: Parking): FacilityDetail {
  return {
    id: parking.id,
    category: 'parking',
    name: parking.name,
    address: parking.address,
    roadAddress: parking.roadAddress,
    lat: Number(parking.lat),
    lng: Number(parking.lng),
    city: parking.city,
    district: parking.district,
    bjdCode: parking.bjdCode,
    details: {
      parkingType: parking.parkingType,
      lotType: parking.lotType,
      capacity: parking.capacity,
      baseFee: parking.baseFee,
      baseTime: parking.baseTime,
      additionalFee: parking.additionalFee,
      additionalTime: parking.additionalTime,
      dailyMaxFee: parking.dailyMaxFee,
      monthlyFee: parking.monthlyFee,
      operatingHours: parking.operatingHours,
      phone: parking.phone,
      paymentMethod: parking.paymentMethod,
      remarks: parking.remarks,
      hasDisabledParking: parking.hasDisabledParking,
    },
    sourceId: parking.sourceId,
    sourceUrl: parking.sourceUrl,
    viewCount: parking.viewCount,
    createdAt: parking.createdAt,
    updatedAt: parking.updatedAt,
    syncedAt: parking.syncedAt,
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
  let facility: FacilityDetail | null = null;

  switch (category) {
    case 'toilet': {
      const toilet = await prisma.toilet.findUnique({ where: { id } });
      if (toilet) {
        facility = toiletToDetail(toilet);
        // 조회수 증가 (비동기)
        prisma.toilet.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      }
      break;
    }
    case 'wifi': {
      const wifi = await prisma.wifi.findUnique({ where: { id } });
      if (wifi) {
        facility = wifiToDetail(wifi);
        prisma.wifi.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      }
      break;
    }
    case 'clothes': {
      const clothes = await prisma.clothes.findUnique({ where: { id } });
      if (clothes) {
        facility = clothesToDetail(clothes);
        prisma.clothes.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      }
      break;
    }
    case 'kiosk': {
      const kiosk = await prisma.kiosk.findUnique({ where: { id } });
      if (kiosk) {
        facility = kioskToDetail(kiosk);
        prisma.kiosk.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      }
      break;
    }
    case 'parking': {
      const parking = await prisma.parking.findUnique({ where: { id } });
      if (parking) {
        facility = parkingToDetail(parking);
        prisma.parking.update({ where: { id }, data: { viewCount: { increment: 1 } } }).catch(() => {});
      }
      break;
    }
  }

  return facility;
}

/**
 * 사이트맵용 전체 ID 조회
 * @param category - 시설 카테고리
 * @returns { id, updatedAt } 배열
 */
export async function getAllIds(
  category: FacilityCategory
): Promise<{ id: string; updatedAt: Date }[]> {
  switch (category) {
    case 'toilet':
      return prisma.toilet.findMany({ select: { id: true, updatedAt: true } });
    case 'wifi':
      return prisma.wifi.findMany({ select: { id: true, updatedAt: true } });
    case 'clothes':
      return prisma.clothes.findMany({ select: { id: true, updatedAt: true } });
    case 'kiosk':
      return prisma.kiosk.findMany({ select: { id: true, updatedAt: true } });
    case 'parking':
      return prisma.parking.findMany({ select: { id: true, updatedAt: true } });
    default:
      return [];
  }
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
  const { page = 1, limit = 20 } = options;

  // slug -> 한글 변환
  const resolved = await resolveRegion(city, district);

  const where = {
    city: resolved.city,
    district: resolved.district,
  };

  let items: FacilityItem[] = [];
  let total = 0;

  switch (category) {
    case 'toilet': {
      const [records, count] = await Promise.all([
        prisma.toilet.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: BASE_SELECT_FIELDS,
        }),
        prisma.toilet.count({ where }),
      ]);
      items = records.map((r) => toFacilityItem(r, 'toilet'));
      total = count;
      break;
    }
    case 'wifi': {
      const [records, count] = await Promise.all([
        prisma.wifi.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: BASE_SELECT_FIELDS,
        }),
        prisma.wifi.count({ where }),
      ]);
      items = records.map((r) => toFacilityItem(r, 'wifi'));
      total = count;
      break;
    }
    case 'clothes': {
      const [records, count] = await Promise.all([
        prisma.clothes.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: BASE_SELECT_FIELDS,
        }),
        prisma.clothes.count({ where }),
      ]);
      items = records.map((r) => toFacilityItem(r, 'clothes'));
      total = count;
      break;
    }
    case 'kiosk': {
      const [records, count] = await Promise.all([
        prisma.kiosk.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: BASE_SELECT_FIELDS,
        }),
        prisma.kiosk.count({ where }),
      ]);
      items = records.map((r) => toFacilityItem(r, 'kiosk'));
      total = count;
      break;
    }
    case 'parking': {
      const [records, count] = await Promise.all([
        prisma.parking.findMany({
          where,
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { name: 'asc' },
          select: BASE_SELECT_FIELDS,
        }),
        prisma.parking.count({ where }),
      ]);
      items = records.map((r) => toFacilityItem(r, 'parking'));
      total = count;
      break;
    }
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
