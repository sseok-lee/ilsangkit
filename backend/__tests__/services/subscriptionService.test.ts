import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();
const mockCount = vi.fn();

vi.mock('../../src/lib/prisma', () => ({
  default: {
    subscription: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
      count: (...args: unknown[]) => mockCount(...args),
    },
  },
}));

import {
  getSubscriptionList,
  getSubscriptionDetail,
  getUpcomingSubscriptions,
  dateBasedStatusFilter,
} from '../../src/services/subscriptionService';

// 테스트 헬퍼: dateBasedStatusFilter 가 만든 prisma 절을 인식.
// 외부 wrap: `{ AND: [base, dateFilter] }` (status 필터 적용 시).
// 내부 형태:
//   ongoing : { AND: [{ receptionStartDate: { lte } }, { OR: [...] }] }
//   upcoming: { receptionStartDate: { gt } }
//   closed  : { OR: [{ receptionStartDate: null }, { receptionEndDate: { lt } }] }
function statusFromWhere(
  where: Record<string, unknown>,
): 'ongoing' | 'upcoming' | 'closed' | null {
  const outerAnd = (where as { AND?: unknown[] }).AND;
  const filter = (Array.isArray(outerAnd) ? outerAnd[1] : where) as Record<string, unknown>;
  const start = filter.receptionStartDate as { gt?: Date; lte?: Date } | undefined;
  if (start && 'gt' in start) return 'upcoming';
  const innerAnd = filter.AND as Array<Record<string, unknown>> | undefined;
  if (
    Array.isArray(innerAnd) &&
    (innerAnd[0]?.receptionStartDate as { lte?: Date } | undefined)?.lte instanceof Date
  ) {
    return 'ongoing';
  }
  const orList = filter.OR as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(orList) && orList.some((o) => o.receptionStartDate === null)) {
    return 'closed';
  }
  return null;
}

function baseFromAndWhere(where: Record<string, unknown>): Record<string, unknown> {
  const and = (where as { AND?: unknown[] }).AND;
  if (Array.isArray(and) && and.length >= 1) return and[0] as Record<string, unknown>;
  return where;
}

const mockSubscription = {
  id: 1,
  houseManageNo: '2026000121',
  pblancNo: '2026000121',
  houseName: '테스트 아파트',
  houseType: 'APT',
  regionName: '서울',
  status: 'upcoming',
  totalSupplyCount: 199,
  announcementDate: new Date('2026-04-10'),
  receptionStartDate: new Date('2026-04-20'),
  receptionEndDate: new Date('2026-04-22'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

function makeSubscription(overrides: Partial<typeof mockSubscription> = {}) {
  return {
    ...mockSubscription,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSubscriptionList', () => {
  it('필터 없이 목록을 조회해야 한다', async () => {
    mockFindMany.mockResolvedValueOnce([makeSubscription({ status: 'ongoing' })]);
    mockCount
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const result = await getSubscriptionList({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(statusFromWhere(mockFindMany.mock.calls[0][0].where)).toBe('ongoing');
    expect(mockCount).toHaveBeenCalledTimes(4);
  });

  it('status 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([mockSubscription]);
    mockCount.mockResolvedValue(1);

    await getSubscriptionList({ status: 'upcoming', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(statusFromWhere(whereArg)).toBe('upcoming');
  });

  it('region 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', region: '서울', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(baseFromAndWhere(whereArg).regionName).toEqual({ contains: '서울' });
  });

  it('sourceType 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', sourceType: 'OFFITEL', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(baseFromAndWhere(whereArg).sourceType).toBe('OFFITEL');
  });

  it('category=sale 필터를 적용해야 한다 (rentType NULL 포함)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', category: 'sale', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    // Prisma notIn은 NULL 행을 매칭에서 제외하므로, rentType이 NULL인 분양 건을
    // 포함하기 위한 별도 OR 절이 필요하다.
    expect(baseFromAndWhere(whereArg).OR).toEqual([
      { sourceType: { in: ['OFFITEL', 'REMAINING', 'OPTIONAL'] } },
      { sourceType: 'APT', rentType: null },
      { sourceType: 'APT', rentType: { notIn: ['분양전환 가능임대', '분양전환 불가임대'] } },
    ]);
  });

  it('category=rent 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', category: 'rent', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(baseFromAndWhere(whereArg).OR).toEqual([
      { sourceType: 'PRIVATE_RENT' },
      { sourceType: 'APT', rentType: { in: ['분양전환 가능임대', '분양전환 불가임대'] } },
    ]);
  });

  it('전체 목록은 청약중→청약예정→마감 순으로 정렬되어야 한다', async () => {
    const ongoing = makeSubscription({ id: 11, status: 'ongoing', announcementDate: new Date('2026-04-01') });
    const upcoming = makeSubscription({ id: 12, status: 'upcoming', announcementDate: new Date('2026-04-20') });

    mockFindMany
      .mockResolvedValueOnce([ongoing])
      .mockResolvedValueOnce([upcoming]);
    mockCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const result = await getSubscriptionList({ page: 1, limit: 2 });

    expect(result.items.map((item) => item.status)).toEqual(['ongoing', 'upcoming']);
    const firstCall = mockFindMany.mock.calls[0][0];
    expect(statusFromWhere(firstCall.where)).toBe('ongoing');
    expect(firstCall.orderBy).toEqual({ announcementDate: 'desc' });
    expect(firstCall.skip).toBe(0);
    expect(firstCall.take).toBe(1);
    const secondCall = mockFindMany.mock.calls[1][0];
    expect(statusFromWhere(secondCall.where)).toBe('upcoming');
    expect(secondCall.orderBy).toEqual({ announcementDate: 'desc' });
    expect(secondCall.skip).toBe(0);
    expect(secondCall.take).toBe(1);
  });

  it('전체 목록 페이지네이션은 상태 그룹을 건너뛰어야 한다', async () => {
    const closedItems = [
      makeSubscription({ id: 21, status: 'closed' }),
      makeSubscription({ id: 22, status: 'closed', houseName: '마감 단지 2' }),
    ];

    mockFindMany.mockResolvedValueOnce(closedItems);
    mockCount
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);

    const result = await getSubscriptionList({ page: 2, limit: 2 });

    expect(result.items.map((item) => item.status)).toEqual(['closed', 'closed']);
    expect(result.page).toBe(2);
    expect(result.totalPages).toBe(2);
    const lastCall = mockFindMany.mock.calls[mockFindMany.mock.calls.length - 1][0];
    expect(statusFromWhere(lastCall.where)).toBe('closed');
    expect(lastCall.orderBy).toEqual({ announcementDate: 'desc' });
    expect(lastCall.skip).toBe(0);
    expect(lastCall.take).toBe(2);
  });

  it('status 필터가 있으면 일반 페이지네이션을 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(50);

    const result = await getSubscriptionList({ status: 'upcoming', page: 3, limit: 10 });

    expect(result.totalPages).toBe(5);
    expect(result.page).toBe(3);
    expect(mockFindMany.mock.calls[0][0].skip).toBe(20);
    expect(mockFindMany.mock.calls[0][0].take).toBe(10);
  });

  it('sort=deadline 이면 receptionEndDate 오름차순(nulls last)으로 정렬한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'ongoing', sort: 'deadline', page: 1, limit: 5 });

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({
      receptionEndDate: { sort: 'asc', nulls: 'last' },
    });
  });

  it('sort=startSoon 이면 receptionStartDate 오름차순(nulls last)으로 정렬한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', sort: 'startSoon', page: 1, limit: 5 });

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({
      receptionStartDate: { sort: 'asc', nulls: 'last' },
    });
  });

  it('status 없이 sort=deadline 이면 그룹 분기도 buildOrderBy를 사용한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount
      .mockResolvedValueOnce(1) // total
      .mockResolvedValueOnce(1) // ongoing
      .mockResolvedValueOnce(0) // upcoming
      .mockResolvedValueOnce(0); // closed

    await getSubscriptionList({ sort: 'deadline', page: 1, limit: 5 });

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({
      receptionEndDate: { sort: 'asc', nulls: 'last' },
    });
  });
});

describe('getSubscriptionDetail', () => {
  it('존재하는 청약 상세를 반환해야 한다', async () => {
    mockFindUnique.mockResolvedValue({ ...mockSubscription, unitTypes: [], competitions: [], scores: [], specialStatuses: [] });

    const result = await getSubscriptionDetail(1);

    expect(result.id).toBe(1);
    expect(result.houseName).toBe('테스트 아파트');
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { id: 1 },
      include: {
        unitTypes: true,
        competitions: { orderBy: [{ modelNo: 'asc' }, { rank: 'asc' }, { regionCode: 'asc' }] },
        scores: { orderBy: [{ modelNo: 'asc' }, { regionCode: 'asc' }] },
        specialStatuses: { orderBy: { houseType: 'asc' } },
      },
    });
  });

  it('존재하지 않는 청약은 NotFoundError를 던져야 한다', async () => {
    mockFindUnique.mockResolvedValue(null);

    await expect(getSubscriptionDetail(999)).rejects.toThrow('청약 공고를 찾을 수 없습니다');
  });
});

describe('dateBasedStatusFilter', () => {
  // 접수일은 시각 없는 날짜(KST 달력 날짜가 UTC 자정으로 저장)라 경계도 날짜여야 한다.
  // 예전에는 현재 "시각"을 그대로 썼고, 그래서 마감일 당일 09:00 KST(=00:00Z)부터
  // 목록에서 마감으로 빠졌다(2026-08-13 프로덕션 표본 100건 중 5건 실측).
  const fixedNow = new Date('2026-04-25T12:00:00Z');   // 2026-04-25 21:00 KST
  const kstToday = new Date('2026-04-25T00:00:00.000Z');

  it('ongoing — start <= KST 오늘 AND (end IS NULL OR end >= KST 오늘)', () => {
    const f = dateBasedStatusFilter('ongoing', fixedNow);
    expect(f).toEqual({
      AND: [
        { receptionStartDate: { lte: kstToday } },
        {
          OR: [
            { receptionEndDate: null },
            { receptionEndDate: { gte: kstToday } },
          ],
        },
      ],
    });
  });

  it('upcoming — start > KST 오늘 (start NULL 자동 제외)', () => {
    const f = dateBasedStatusFilter('upcoming', fixedNow);
    expect(f).toEqual({ receptionStartDate: { gt: kstToday } });
  });

  it('closed — start IS NULL OR end < KST 오늘', () => {
    const f = dateBasedStatusFilter('closed', fixedNow);
    expect(f).toEqual({
      OR: [
        { receptionStartDate: null },
        { receptionEndDate: { lt: kstToday } },
      ],
    });
  });
});

describe('getUpcomingSubscriptions', () => {
  it('다가오는 청약 목록을 반환해야 한다 — 쿼리 시점의 receptionStartDate > now', async () => {
    mockFindMany.mockResolvedValue([mockSubscription]);

    const result = await getUpcomingSubscriptions(5);

    expect(result).toHaveLength(1);
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.receptionStartDate).toEqual(expect.objectContaining({ gt: expect.any(Date) }));
    expect(args.take).toBe(5);
    expect(args.orderBy.receptionStartDate).toBe('asc');
  });
});
