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

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getSubscriptionList', () => {
  it('필터 없이 목록을 조회해야 한다', async () => {
    mockFindMany.mockResolvedValue([mockSubscription]);
    mockCount.mockResolvedValue(1);

    const result = await getSubscriptionList({ page: 1, limit: 20 });

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(mockCount).toHaveBeenCalledOnce();
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

    await getSubscriptionList({ region: '서울', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.regionName).toEqual({ contains: '서울' });
  });

  it('sourceType 필터를 적용해야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ sourceType: 'OFFITEL', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.sourceType).toBe('OFFITEL');
  });

  it('category=sale 필터를 적용해야 한다 (rentType NULL 포함)', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ category: 'sale', page: 1, limit: 20 });

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

    await getSubscriptionList({ category: 'rent', page: 1, limit: 20 });

    const whereArg = mockFindMany.mock.calls[0][0].where;
    expect(whereArg.OR).toEqual([
      { sourceType: 'PRIVATE_RENT' },
      { sourceType: 'APT', rentType: { in: ['분양전환 가능임대', '분양전환 불가임대'] } },
    ]);
  });

  it('페이지네이션이 올바르게 적용되어야 한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(50);

    const result = await getSubscriptionList({ page: 3, limit: 10 });

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
