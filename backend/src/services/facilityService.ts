// @TASK T1.1, T1.3 - 시설 검색/지역별 조회 서비스
// @SPEC docs/planning/02-trd.md#API-설계

import prisma from '../lib/prisma.js';
import { FacilitySearchInput } from '../schemas/facility.js';
import { Prisma, FacilityCategory } from '@prisma/client';

// 기본 select 필드
const FACILITY_SELECT_FIELDS = {
  id: true,
  category: true,
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
  category: string;
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

/**
 * Haversine 공식을 사용한 두 지점 간 거리 계산
 * @param lat1 - 기준점 위도
 * @param lng1 - 기준점 경도
 * @param lat2 - 대상점 위도
 * @param lng2 - 대상점 경도
 * @returns 거리 (km)
 */
function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // 지구 반경 (km)
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

/**
 * 검색 조건 필터 생성
 */
function buildWhereClause(params: FacilitySearchInput): Prisma.FacilityWhereInput {
  const { keyword, category, city, district } = params;
  const where: Prisma.FacilityWhereInput = {};

  // 카테고리 필터
  if (category) {
    where.category = category;
  }

  // 지역 필터
  if (city) where.city = city;
  if (district) where.district = district;

  // 키워드 검색
  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { address: { contains: keyword } },
    ];
  }

  return where;
}

/**
 * 시설 검색
 * - 키워드 검색
 * - 카테고리 필터
 * - 지역 필터
 * - 위치 기반 검색 (Haversine 공식)
 * - 페이지네이션
 */
export async function search(params: FacilitySearchInput): Promise<SearchResult> {
  const { lat, lng, radius = 1000, page = 1, limit = 20 } = params;
  const where = buildWhereClause(params);

  // 위치 기반 검색 (Haversine 공식)
  if (lat !== undefined && lng !== undefined) {
    return searchByLocation({ where, lat, lng, radius, page, limit });
  }

  // 일반 검색 (위치 없음)
  return searchWithoutLocation({ where, page, limit });
}

/**
 * 위치 기반 검색
 */
async function searchByLocation(options: {
  where: Prisma.FacilityWhereInput;
  lat: number;
  lng: number;
  radius: number;
  page: number;
  limit: number;
}): Promise<SearchResult> {
  const { where, lat, lng, radius, page, limit } = options;

  // 모든 조건에 맞는 시설 조회
  const allFacilities = await prisma.facility.findMany({
    where,
    select: FACILITY_SELECT_FIELDS,
  });

  // 거리 계산 및 필터링
  const facilitiesWithDistance = allFacilities
    .map((f) => {
      const facilityLat = Number(f.lat);
      const facilityLng = Number(f.lng);
      const distanceKm = haversineDistance(lat, lng, facilityLat, facilityLng);
      return {
        ...f,
        lat: facilityLat,
        lng: facilityLng,
        distance: Math.round(distanceKm * 1000), // km to meters
      };
    })
    .filter((f) => f.distance <= radius)
    .sort((a, b) => a.distance - b.distance);

  // 페이지네이션
  const total = facilitiesWithDistance.length;
  const startIndex = (page - 1) * limit;
  const paginatedFacilities = facilitiesWithDistance.slice(startIndex, startIndex + limit);

  return {
    items: paginatedFacilities,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 일반 검색 (위치 없음)
 */
async function searchWithoutLocation(options: {
  where: Prisma.FacilityWhereInput;
  page: number;
  limit: number;
}): Promise<SearchResult> {
  const { where, page, limit } = options;

  const [facilities, total] = await Promise.all([
    prisma.facility.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { viewCount: 'desc' },
      select: FACILITY_SELECT_FIELDS,
    }),
    prisma.facility.count({ where }),
  ]);

  return {
    items: facilities.map((f) => ({
      ...f,
      lat: Number(f.lat),
      lng: Number(f.lng),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
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
    category: category as FacilityCategory,
  };

  const [items, total] = await Promise.all([
    prisma.facility.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { name: 'asc' },
      select: FACILITY_SELECT_FIELDS,
    }),
    prisma.facility.count({ where }),
  ]);

  return {
    region: {
      city: resolved.city,
      district: resolved.district,
      bjdCode: resolved.bjdCode,
    },
    category,
    items: items.map((f) => ({
      ...f,
      lat: Number(f.lat),
      lng: Number(f.lng),
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}
