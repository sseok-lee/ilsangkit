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

/**
 * 청약 status 를 sync 시점이 아닌 **쿼리 시점**의 시각으로 동적 판정.
 * 저장된 `status` 컬럼은 daily sync 후 최대 24h stale — start/end 가
 * 오늘 안에서 transition 하는 row 가 잘못된 상태로 잡히는 사고가 있어 도입.
 *
 * 규칙:
 *   ongoing  = receptionStartDate <= now AND (receptionEndDate IS NULL OR receptionEndDate >= now)
 *   upcoming = receptionStartDate > now
 *   closed   = receptionStartDate IS NULL OR receptionEndDate < now
 */
export function computeSubscriptionStatus(
  receptionStartDate: Date | null | undefined,
  receptionEndDate: Date | null | undefined,
  now: Date = new Date(),
): 'ongoing' | 'upcoming' | 'closed' {
  if (!receptionStartDate) return 'closed';
  if (receptionStartDate > now) return 'upcoming';
  if (receptionEndDate && receptionEndDate < now) return 'closed';
  return 'ongoing';
}

export function dateBasedStatusFilter(
  status: 'ongoing' | 'upcoming' | 'closed',
  now: Date = new Date(),
): Prisma.SubscriptionWhereInput {
  switch (status) {
    case 'ongoing':
      return {
        AND: [
          { receptionStartDate: { lte: now } },
          {
            OR: [
              { receptionEndDate: null },
              { receptionEndDate: { gte: now } },
            ],
          },
        ],
      };
    case 'upcoming':
      return { receptionStartDate: { gt: now } };
    case 'closed':
      return {
        OR: [
          { receptionStartDate: null },
          { receptionEndDate: { lt: now } },
        ],
      };
  }
}

type SubscriptionSort = 'announcement' | 'deadline' | 'startSoon';

function buildOrderBy(sort?: SubscriptionSort): Prisma.SubscriptionOrderByWithRelationInput {
  if (sort === 'deadline') return { receptionEndDate: { sort: 'asc', nulls: 'last' } };
  if (sort === 'startSoon') return { receptionStartDate: { sort: 'asc', nulls: 'last' } };
  return { announcementDate: 'desc' };
}

export async function getSubscriptionList(params: SubscriptionListParams) {
  const { status, region, houseType, rentType, sourceType, category, page, limit, sort } = params;

  const where: Prisma.SubscriptionWhereInput = {};
  // 공공임대 실제 rentType 값 (청약홈 API가 '임대주택' 대신 이 값들을 반환함)
  const PUBLIC_RENT_TYPES = ['분양전환 가능임대', '분양전환 불가임대'];

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
      { sourceType: { in: ['OFFITEL', 'REMAINING', 'OPTIONAL'] } },
      { sourceType: 'APT', rentType: null },
      { sourceType: 'APT', rentType: { notIn: PUBLIC_RENT_TYPES } },
    ];
  } else if (category === 'rent') {
    where.OR = [
      { sourceType: 'PRIVATE_RENT' },
      { sourceType: 'APT', rentType: { in: PUBLIC_RENT_TYPES } },
    ];
  }

  const skip = (page - 1) * limit;

  if (status) {
    const filteredWhere: Prisma.SubscriptionWhereInput = {
      AND: [where, dateBasedStatusFilter(status)],
    };
    const [items, total] = await Promise.all([
      prisma.subscription.findMany({
        where: filteredWhere,
        orderBy: buildOrderBy(sort),
        skip,
        take: limit,
      }),
      prisma.subscription.count({ where: filteredWhere }),
    ]);

    // 필터가 날짜 기반 동적 분류 — 응답에 담는 row 의 status 도 그 그룹값으로 덮어써야 카드 라벨 일치.
    return {
      items: items.map((row) => ({ ...row, status })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  const statusOrder = ['ongoing', 'upcoming', 'closed'] as const;
  const counts = await Promise.all([
    prisma.subscription.count({ where }),
    ...statusOrder.map((statusKey) =>
      prisma.subscription.count({ where: { AND: [where, dateBasedStatusFilter(statusKey)] } })
    ),
  ]);

  const [total, ...statusCounts] = counts;
  const countByStatus = statusOrder.reduce<Record<typeof statusOrder[number], number>>(
    (acc, statusKey, index) => {
      acc[statusKey] = statusCounts[index] ?? 0;
      return acc;
    },
    { ongoing: 0, upcoming: 0, closed: 0 }
  );

  let remainingSkip = skip;
  let remainingTake = limit;
  const items = [];

  for (const statusKey of statusOrder) {
    const groupTotal = countByStatus[statusKey];
    if (groupTotal === 0) continue;

    if (remainingSkip >= groupTotal) {
      remainingSkip -= groupTotal;
      continue;
    }

    if (remainingTake <= 0) break;

    const take = Math.min(remainingTake, groupTotal - remainingSkip);
    if (take <= 0) break;

    const batch = await prisma.subscription.findMany({
      where: { AND: [where, dateBasedStatusFilter(statusKey)] },
      orderBy: { announcementDate: 'desc' },
      skip: remainingSkip,
      take,
    });

    // 저장된 status 컬럼은 sync 시점 기준 (최대 24h stale).
    // 필터 자체가 날짜 기반으로 동적 분류했으므로, 응답에 담는 row 의 status 도
    // 그 동적 그룹 값으로 덮어써야 카드 라벨이 일치한다.
    items.push(...batch.map((row) => ({ ...row, status: statusKey })));
    remainingTake -= take;
    remainingSkip = 0;
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

  // status 동적 재계산 (sync 시점 stale 방지 — 목록과 동일한 정책)
  const status = computeSubscriptionStatus(
    subscription.receptionStartDate,
    subscription.receptionEndDate,
  );
  return serializeRow({ ...subscription, status });
}

export async function getUpcomingSubscriptions(limit = 5) {
  return prisma.subscription.findMany({
    where: dateBasedStatusFilter('upcoming'),
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
