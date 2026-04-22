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
} from '../../src/services/subscriptionService';

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
    expect(mockFindMany.mock.calls[0][0].where.status).toBe('ongoing');
    expect(mockCount).toHaveBeenCalledTimes(4);
  });

  it('status 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([mockSubscription]);
    mockCount.mockResolvedValue(1);

    await getSubscriptionList({ status: 'upcoming', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.status).toBe('upcoming');
  });

  it('region 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', region: '서울', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.regionName).toEqual({ contains: '서울' });
  });

  it('sourceType 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', sourceType: 'OFFITEL', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.sourceType).toBe('OFFITEL');
  });

  it('category=sale 필터를 적용해야 한다 (rentType NULL 포함)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', category: 'sale', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    // Prisma notIn은 NULL 행을 매칭에서 제외하므로, rentType이 NULL인 분양 건을
    // 포함하기 위한 별도 OR 절이 필요하다.
    expect(whereArg.OR).toEqual([
      { sourceType: { in: ['OFFITEL', 'REMAINING'] } },
      { sourceType: 'APT', rentType: null },
      { sourceType: 'APT', rentType: { notIn: ['분양전환 가능임대', '분양전환 불가임대'] } },
    ]);
  });

  it('category=rent 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', category: 'rent', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual([
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
    expect(mockFindMany).toHaveBeenNthCalledWith(1, {
      where: { status: 'ongoing' },
      orderBy: { announcementDate: 'desc' },
      skip: 0,
      take: 1,
    });
    expect(mockFindMany).toHaveBeenNthCalledWith(2, {
      where: { status: 'upcoming' },
      orderBy: { announcementDate: 'desc' },
      skip: 0,
      take: 1,
    });
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
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { status: 'closed' },
      orderBy: { announcementDate: 'desc' },
      skip: 0,
      take: 2,
    });
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

describe('getUpcomingSubscriptions', () => {
  it('다가오는 청약 목록을 반환해야 한다', async () => {
    mockFindMany.mockResolvedValue([mockSubscription]);

    const result = await getUpcomingSubscriptions(5);

    expect(result).toHaveLength(1);
    const args = mockFindMany.mock.calls[0][0];
    expect(args.where.status).toBe('upcoming');
    expect(args.take).toBe(5);
    expect(args.orderBy.receptionStartDate).toBe('asc');
  });
});
