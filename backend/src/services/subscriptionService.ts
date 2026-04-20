import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import type { SubscriptionListParams } from '../schemas/subscription.js';
import type { Prisma } from '@prisma/client';

/**
 * Decimal → Number 변환 (JSON 직렬화 호환)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRow(row: any): any {
  if (!row) return row;
  const result = { ...row };
  for (const key of Object.keys(result)) {
    if (typeof result[key] === 'object' && result[key] !== null && result[key].constructor.name === 'Decimal') {
      result[key] = Number(result[key]);
    }
  }
  return result;
}

export async function getSubscriptionList(params: SubscriptionListParams) {
  const { status, region, houseType, rentType, sourceType, category, page, limit } = params;

  const where: Prisma.SubscriptionWhereInput = {};
  // 공공임대 실제 rentType 값 (청약홈 API가 '임대주택' 대신 이 값들을 반환함)
  const PUBLIC_RENT_TYPES = ['분양전환 가능임대', '분양전환 불가임대'];

  if (status) where.status = status;
  if (region) where.regionName = { contains: region };
  if (houseType) where.houseType = houseType;
  if (rentType) {
    // '임대주택'은 실제 API 값인 '분양전환 가능임대'/'분양전환 불가임대'로 변환
    where.rentType = rentType === '임대주택'
      ? { in: PUBLIC_RENT_TYPES }
      : rentType;
  }

  // sourceType 직접 필터 (개별 카테고리 페이지)
  if (sourceType) {
    where.sourceType = sourceType;
  }

  // category 필터 (분양/임대 그룹)
  // 주의: Prisma `notIn`은 NULL 값을 매칭에서 제외하므로, rentType이 NULL인 분양 레코드도
  // 포함되도록 OR + null 조건을 명시적으로 추가한다.
  if (category === 'sale') {
    where.OR = [
      { sourceType: { in: ['OFFITEL', 'REMAINING'] } },
      { sourceType: 'APT', rentType: null },
      { sourceType: 'APT', rentType: { notIn: PUBLIC_RENT_TYPES } },
    ];
  } else if (category === 'rent') {
    where.OR = [
      { sourceType: 'PRIVATE_RENT' },
      { sourceType: 'APT', rentType: { in: PUBLIC_RENT_TYPES } },
    ];
  }

  const STATUS_ORDER: Record<string, number> = { ongoing: 0, upcoming: 1, closed: 2 };

  const [items, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: { announcementDate: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  // status 필터가 없을 때(전체): 접수중→접수예정→마감 순 정렬
  if (!status) {
    items.sort((a, b) => {
      const sa = STATUS_ORDER[a.status] ?? 9;
      const sb = STATUS_ORDER[b.status] ?? 9;
      if (sa !== sb) return sa - sb;
      // 같은 status 내에서는 최신 공고순 (이미 announcementDate desc로 정렬됨)
      return 0;
    });
  }

  return {
    items,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getSubscriptionDetail(id: number) {
  const subscription = await prisma.subscription.findUnique({
    where: { id },
    include: {
      unitTypes: true,
      competitions: { orderBy: [{ modelNo: 'asc' }, { rank: 'asc' }, { regionCode: 'asc' }] },
      scores: { orderBy: [{ modelNo: 'asc' }, { regionCode: 'asc' }] },
      specialStatuses: { orderBy: { houseType: 'asc' } },
    },
  });

  if (!subscription) {
    throw new NotFoundError('청약 공고를 찾을 수 없습니다');
  }

  return serializeRow(subscription);
}

export async function getUpcomingSubscriptions(limit = 5) {
  return prisma.subscription.findMany({
    where: { status: 'upcoming' },
    orderBy: { receptionStartDate: 'asc' },
    take: limit,
  });
}

export async function getRentalPriceStats(regionName: string) {
  // Parse regionName: "서울 강남구" → city="서울", district="강남구"
  const parts = regionName.trim().split(/\s+/);
  if (parts.length < 2) {
    return {
      jeonsae: { avgDeposit: null, count: 0 },
      wolse: { avgDeposit: null, avgMonthlyRent: null, count: 0 },
      period: '',
    };
  }

  const city = parts[0];
  const district = parts[1];

  // Calculate 3 months ago from now
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const startYear = threeMonthsAgo.getFullYear();
  const startMonth = threeMonthsAgo.getMonth() + 1;

  // Fetch 전세 (jeonse) data: monthlyRent is null or 0
  const jeonsaeData = await prisma.aptRentTransaction.findMany({
    where: {
      city,
      district,
      OR: [{ monthlyRent: null }, { monthlyRent: 0 }],
      dealYear: { gte: startYear },
    },
  });

  // Filter jeonsae by month range (after query-level year filter)
  const jeonsaeFiltered = jeonsaeData.filter((row) => {
    if (row.dealYear === startYear) {
      return row.dealMonth >= startMonth;
    }
    return true; // dealYear > startYear
  });

  // Fetch 월세 (wolse) data: monthlyRent > 0
  const wolseData = await prisma.aptRentTransaction.findMany({
    where: {
      city,
      district,
      monthlyRent: { gt: 0 },
      dealYear: { gte: startYear },
    },
  });

  // Filter wolse by month range
  const wolseFiltered = wolseData.filter((row) => {
    if (row.dealYear === startYear) {
      return row.dealMonth >= startMonth;
    }
    return true;
  });

  // Calculate averages for jeonse
  let jeonsaeAvg: number | null = null;
  if (jeonsaeFiltered.length > 0) {
    const total = jeonsaeFiltered.reduce((sum, row) => sum + row.deposit, 0n);
    jeonsaeAvg = Number(total) / jeonsaeFiltered.length;
  }

  // Calculate averages for wolse
  let wolseDepositAvg: number | null = null;
  let wolseMonthlyAvg: number | null = null;
  if (wolseFiltered.length > 0) {
    const totalDeposit = wolseFiltered.reduce((sum, row) => sum + row.deposit, 0n);
    wolseDepositAvg = Number(totalDeposit) / wolseFiltered.length;

    const totalMonthly = wolseFiltered.reduce((sum, row) => sum + (row.monthlyRent || 0), 0);
    wolseMonthlyAvg = totalMonthly / wolseFiltered.length;
  }

  // Format period
  const periodStr = `${startYear}.${String(startMonth).padStart(2, '0')}~${currentYear}.${String(currentMonth).padStart(2, '0')}`;

  return {
    jeonsae: {
      avgDeposit: jeonsaeAvg,
      count: jeonsaeFiltered.length,
    },
    wolse: {
      avgDeposit: wolseDepositAvg,
      avgMonthlyRent: wolseMonthlyAvg,
      count: wolseFiltered.length,
    },
    period: periodStr,
  };
}
