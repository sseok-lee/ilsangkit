// 쓰레기 배출 일정 서비스
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { PAGINATION } from '../constants/index.js';
import { buildRegionFilter } from './cityMapping.js';

// 검증되지 않은 seed 데이터(`prisma/seed.ts`)를 공개 조회에서 제외한다.
// 운영 DB 에 id 15345~15349 (sourceId `seed-waste-schedule-1`~`5`) 5건이 남아
// 서울 중구·종로구·용산구, 경기 수원시, 부산 중구 목록에 예시 일정으로 섞여 나갔다
// (실측 2026-09-08, RESEARCH/naver-decline-2026-09-08/recheck-waste.md).
// 구형 `emissionDays`/`emissionTime` 구조라 상세 모달에서도 요일·시간이 렌더되지 않는다.
// 원본 행은 보존하고 조회 경로에서만 뺀다 — 사이트맵/상세도 같은 기준이라야
// sitemap 은 광고하는데 상세는 없는 불일치가 생기지 않는다.
// sourceId 는 NOT NULL 이므로 `not startsWith` 가 정상 행을 떨구지 않는다.
const EXCLUDE_SEED: Prisma.StringFilter = { not: { startsWith: 'seed-' } };

// 유형별 배출 정보 타입
interface WasteTypeInfo {
  dayOfWeek?: string;
  beginTime?: string;
  endTime?: string;
  method?: string;
}

interface BulkWasteInfo {
  beginTime?: string;
  endTime?: string;
  method?: string;
  place?: string;
}

// 배출 일정 아이템 타입
interface WasteScheduleItem {
  id: number;
  city: string;
  district: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: {
    emissionPlaceType?: string;
    managementZone?: string;
    livingWaste?: WasteTypeInfo;
    foodWaste?: WasteTypeInfo;
    recyclable?: WasteTypeInfo;
    bulkWaste?: BulkWasteInfo;
    uncollectedDay?: string;
    manageDepartment?: string;
    managePhone?: string;
    dataCreatedDate?: string;
    lastModified?: string;
  } | null;
}

// 조회 결과 타입
interface WasteScheduleResult {
  items: WasteScheduleItem[];
  total: number;
  page: number;
  totalPages: number;
}

// 지역 목록 타입
interface RegionItem {
  city: string;
  district: string;
  count: number;
}

interface RegionsResult {
  items: RegionItem[];
  total: number;
  page: number;
  totalPages: number;
}

/**
 * 지역별 쓰레기 배출 일정 조회
 * @param city - 시/도
 * @param district - 구/군 (선택)
 * @param options - 페이지네이션 옵션
 * @returns 배출 일정 목록
 */
export async function getByRegion(
  city?: string,
  district?: string,
  keyword?: string,
  options: { page?: number; limit?: number } = {}
): Promise<WasteScheduleResult> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

  // city variant: 축약명(서울)/정식명(서울특별시) 양쪽 매칭.
  // WasteSchedule 행은 정식명으로 저장되는데 지역 칩은 축약명을 보내므로
  // 정확 일치로 조회하면 0건이 된다(facilityService 와 동일 규약).
  // districtVariants: WasteSchedule 만 원본 표기를 그대로 담아 경기 남양주·동두천이
  // 접미사 없이 저장돼 있다. 허브는 slug 를 Region 정식명('남양주시')으로 되돌려 보내므로
  // 정확 일치로는 0건이 되고, 허브가 빈 페이지로 나간다(cityMapping.districtVariantList 주석).
  const where: Prisma.WasteScheduleWhereInput = buildRegionFilter(city, district, {
    districtVariants: true,
  });
  where.sourceId = EXCLUDE_SEED;
  if (keyword) {
    where.targetRegion = { contains: keyword };
  }

  const [items, total] = await Promise.all([
    prisma.wasteSchedule.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: [{ district: 'asc' }, { targetRegion: 'asc' }],
      select: {
        id: true,
        city: true,
        district: true,
        targetRegion: true,
        emissionPlace: true,
        details: true,
      },
    }),
    prisma.wasteSchedule.count({ where }),
  ]);

  return {
    items: items.map((item) => ({
      ...item,
      details: item.details as WasteScheduleItem['details'],
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 쓰레기 배출 일정이 있는 지역 목록 조회
 * @param options - 페이지네이션 옵션
 * @returns 지역 목록
 */
export async function getRegions(
  options: { page?: number; limit?: number } = {}
): Promise<RegionsResult> {
  const { page = PAGINATION.DEFAULT_PAGE, limit = PAGINATION.DEFAULT_LIMIT } = options;

  // 그룹별 카운트 조회
  const grouped = await prisma.wasteSchedule.groupBy({
    by: ['city', 'district'],
    where: { sourceId: EXCLUDE_SEED },
    _count: { id: true },
    orderBy: [{ city: 'asc' }, { district: 'asc' }],
  });

  const total = grouped.length;
  const startIndex = (page - 1) * limit;
  const paginated = grouped.slice(startIndex, startIndex + limit);

  return {
    items: paginated.map((item) => ({
      city: item.city,
      district: item.district,
      count: item._count.id,
    })),
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 시/도 목록 조회
 * @returns 시/도 목록
 */
export async function getCities(): Promise<string[]> {
  const cities = await prisma.wasteSchedule.groupBy({
    by: ['city'],
    where: { sourceId: EXCLUDE_SEED },
    orderBy: { city: 'asc' },
  });

  return cities.map((item) => item.city);
}

/**
 * 특정 시/도의 구/군 목록 조회
 * @param city - 시/도
 * @returns 구/군 목록
 */
export async function getDistricts(city: string): Promise<string[]> {
  const districts = await prisma.wasteSchedule.groupBy({
    by: ['district'],
    where: { ...buildRegionFilter(city), sourceId: EXCLUDE_SEED },
    orderBy: { district: 'asc' },
  });

  return districts.map((item) => item.district);
}

/**
 * 사이트맵용 전체 ID 조회
 * @returns { id, updatedAt } 배열
 */
export async function getAllIds(): Promise<{ id: number; updatedAt: Date }[]> {
  return prisma.wasteSchedule.findMany({
    where: { sourceId: EXCLUDE_SEED },
    select: { id: true, updatedAt: true },
  });
}

/**
 * 사이트맵용 지역(구·군) distinct 목록 조회
 * city/district null 레코드 제외, 그룹별 최신 updatedAt 포함
 * @returns { city, district, updatedAt } 배열
 */
export async function getWasteScheduleRegions(): Promise<
  { city: string; district: string; updatedAt: Date }[]
> {
  const grouped = await prisma.wasteSchedule.groupBy({
    by: ['city', 'district'],
    where: { sourceId: EXCLUDE_SEED },
    _max: { updatedAt: true },
    orderBy: [{ city: 'asc' }, { district: 'asc' }],
  });

  return grouped
    .filter((item) => item.city != null && item.district != null && item._max.updatedAt != null)
    .map((item) => ({
      city: item.city,
      district: item.district,
      updatedAt: item._max.updatedAt as Date,
    }));
}

/**
 * 단건 조회 (상세 페이지용)
 * @param id - WasteSchedule id
 * @returns 배출 일정 아이템 또는 null
 */
export async function getById(id: number): Promise<WasteScheduleItem | null> {
  const item = await prisma.wasteSchedule.findFirst({
    where: { id, sourceId: EXCLUDE_SEED },
    select: {
      id: true,
      city: true,
      district: true,
      targetRegion: true,
      emissionPlace: true,
      details: true,
    },
  });

  if (!item) return null;

  return {
    ...item,
    details: item.details as WasteScheduleItem['details'],
  };
}
