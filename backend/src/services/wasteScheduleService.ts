// 쓰레기 배출 일정 서비스
// NOTE: 지도 마커가 아닌 지역별 일정 조회용

import { prisma } from '../lib/prisma.js';
import { PAGINATION } from '../constants/index.js';

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

  const where: { city?: string; district?: string; targetRegion?: { contains: string } } = {};
  if (city) {
    where.city = city;
  }
  if (district) {
    where.district = district;
  }
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

/**
 * 사이트맵용 전체 ID 조회
 * @returns { id, updatedAt } 배열
 */
export async function getAllIds(): Promise<{ id: number; updatedAt: Date }[]> {
  return prisma.wasteSchedule.findMany({ select: { id: true, updatedAt: true } });
}

// ── 다음 수거일(D-Day) 계산 ──────────────────────────────────────────────

const KOREAN_DAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

/**
 * 한글 요일 문자열에서 dayOfWeek(0~6) 배열 추출.
 * 예: "월·수·금" → [1, 3, 5]
 */
export function parseKoreanDays(input: string | undefined | null): number[] {
  if (!input) return [];
  const result: number[] = [];
  for (let i = 0; i < KOREAN_DAYS.length; i++) {
    if (input.includes(KOREAN_DAYS[i])) result.push(i);
  }
  return result;
}

/**
 * 오늘 기준 가장 가까운 수거일까지의 일수(D-Day) 계산.
 * 0 = 오늘, 1 = 내일, ...
 * 매칭 요일이 없으면 null.
 */
export function calcDDay(today: Date, daysOfWeek: number[]): number | null {
  if (daysOfWeek.length === 0) return null;
  const todayNum = today.getDay();
  const offsets = daysOfWeek.map((d) => (d - todayNum + 7) % 7);
  return Math.min(...offsets);
}

/**
 * 다음 수거일을 사람-친화적 라벨로 포맷.
 * 0 → "오늘 (월)", 1 → "내일 (화)", 그 이상 → "4월 30일 (수)"
 */
export function formatNextDate(today: Date, dDay: number): string {
  const next = new Date(today);
  next.setDate(next.getDate() + dDay);
  const dayLabel = KOREAN_DAYS[next.getDay()];
  if (dDay === 0) return `오늘 (${dayLabel})`;
  if (dDay === 1) return `내일 (${dayLabel})`;
  return `${next.getMonth() + 1}월 ${next.getDate()}일 (${dayLabel})`;
}

export interface UpcomingWasteItem {
  type: 'living' | 'food' | 'recyclable';
  label: string;
  daysOfWeekLabel: string;
  beginTime: string | null;
  endTime: string | null;
  dDay: number | null;
  nextDateLabel: string | null;
}

export interface UpcomingWasteResult {
  city: string;
  district: string;
  hasData: boolean;
  items: UpcomingWasteItem[];
  source: { sourceId: string | null; targetRegion: string | null };
}

const WASTE_TYPE_META: Array<{
  type: UpcomingWasteItem['type'];
  label: string;
  detailsKey: 'livingWaste' | 'foodWaste' | 'recyclable';
}> = [
  { type: 'recyclable', label: '재활용', detailsKey: 'recyclable' },
  { type: 'food', label: '음식물쓰레기', detailsKey: 'foodWaste' },
  { type: 'living', label: '일반쓰레기', detailsKey: 'livingWaste' },
];

/**
 * 시·구 단위 다음 수거일 조회 (구 단위 fallback — WasteSchedule에 동 정보 없음).
 *
 * - 매칭되는 row가 여러 개면 첫 번째 사용 (관리구역 단위 분리되어 있음)
 * - 매칭 없으면 hasData=false 반환 (가짜 데이터 노출 금지)
 */
export async function getUpcoming(
  city: string,
  district: string,
  today: Date = new Date()
): Promise<UpcomingWasteResult> {
  const row = await prisma.wasteSchedule.findFirst({
    where: { city, district },
    orderBy: [{ targetRegion: 'asc' }],
    select: {
      sourceId: true,
      targetRegion: true,
      details: true,
    },
  });

  if (!row) {
    return {
      city,
      district,
      hasData: false,
      items: [],
      source: { sourceId: null, targetRegion: null },
    };
  }

  const details = (row.details ?? {}) as WasteScheduleItem['details'];
  const items: UpcomingWasteItem[] = WASTE_TYPE_META.map(({ type, label, detailsKey }) => {
    const info = details?.[detailsKey] as WasteTypeInfo | undefined;
    const daysOfWeekLabel = info?.dayOfWeek ?? '';
    const days = parseKoreanDays(daysOfWeekLabel);
    const dDay = calcDDay(today, days);
    return {
      type,
      label,
      daysOfWeekLabel,
      beginTime: info?.beginTime ?? null,
      endTime: info?.endTime ?? null,
      dDay,
      nextDateLabel: dDay === null ? null : formatNextDate(today, dDay),
    };
  }).filter((item) => item.dDay !== null || item.daysOfWeekLabel.length > 0);

  return {
    city,
    district,
    hasData: items.length > 0,
    items,
    source: { sourceId: row.sourceId, targetRegion: row.targetRegion },
  };
}

/**
 * 단건 조회 (상세 페이지용)
 * @param id - WasteSchedule id
 * @returns 배출 일정 아이템 또는 null
 */
export async function getById(id: number): Promise<WasteScheduleItem | null> {
  const item = await prisma.wasteSchedule.findUnique({
    where: { id },
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
