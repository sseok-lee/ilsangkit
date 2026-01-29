// 쓰레기 배출 일정 서비스
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import prisma from '../lib/prisma.js';

// 배출 일정 아이템 타입
interface WasteScheduleItem {
  id: number;
  city: string;
  district: string;
  targetRegion: string | null;
  emissionPlace: string | null;
  details: {
    emissionItem?: string;
    emissionDay?: string;
    emissionTime?: string;
    emissionMethod?: string;
    collectDay?: string;
    collectTime?: string;
    collectMethod?: string;
    manageInstitute?: string;
    managePhone?: string;
    dataStandardDate?: string;
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
  city: string,
  district?: string,
  options: { page?: number; limit?: number } = {}
): Promise<WasteScheduleResult> {
  const { page = 1, limit = 20 } = options;

  const where: { city: string; district?: string } = { city };
  if (district) {
    where.district = district;
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
  const { page = 1, limit = 20 } = options;

  // 그룹별 카운트 조회
  const grouped = await prisma.wasteSchedule.groupBy({
    by: ['city', 'district'],
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
    where: { city },
    orderBy: { district: 'asc' },
  });

  return districts.map((item) => item.district);
}
