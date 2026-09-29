import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({ findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn(), queryRaw: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => ({ default: { subscription: db, $queryRaw: db.queryRaw } }));
import { getSubscriptionList, getSubscriptionDetail, dateBasedStatusFilter } from '../../src/services/subscriptionService.js';
import { SubscriptionListSchema } from '../../src/schemas/subscription.js';

beforeEach(() => {
  vi.clearAllMocks();
  db.findMany.mockResolvedValue([]);
  db.count.mockResolvedValue(0);
  db.queryRaw.mockResolvedValue([]);
});

describe('public rental subscription integration', () => {
  it('accepts the public source and unknown schedule filters', () => {
    const result = SubscriptionListSchema.safeParse({ sourceType: 'PUBLIC_RENT', status: 'unknown' });
    expect(result.success).toBe(true);
  });

  it('includes public-source notices alongside ApplyHome rentals', async () => {
    await getSubscriptionList({ category: 'rent', rentType: '임대주택', status: 'upcoming', page: 1, limit: 20 });
    const base = db.findMany.mock.calls[0][0].where.AND[0];
    expect(base.rentType.in).toContain('임대주택');
    expect(base.OR).toContainEqual({ sourceType: 'PUBLIC_RENT' });
    expect(base.supersededById).toBe(null);
  });

  it('does not mark an unverified public rental schedule as closed', async () => {
    db.findUnique.mockResolvedValue({ id: 1, sourceType: 'PUBLIC_RENT', status: 'unknown', receptionStartDate: null, receptionEndDate: null });
    expect((await getSubscriptionDetail(1)).status).toBe('unknown');
  });

  it('keeps a source-confirmed closed notice closed even without dates', async () => {
    db.findUnique.mockResolvedValue({ id: 1, sourceType: 'PUBLIC_RENT', status: 'closed', receptionStartDate: null, receptionEndDate: null });
    expect((await getSubscriptionDetail(1)).status).toBe('closed');
  });

  it('follows a superseded notice to its canonical detail', async () => {
    db.findUnique.mockResolvedValueOnce({ id: 2, supersededById: 1 }).mockResolvedValueOnce({ id: 1, houseName: '정정된 공고', sourceType: 'PUBLIC_RENT', status: 'unknown' });
    expect((await getSubscriptionDetail(2)).houseName).toBe('정정된 공고');
  });

  it('selects unknown schedules separately from closed', () => {
    expect(dateBasedStatusFilter('unknown')).toEqual({ sourceType: 'PUBLIC_RENT', receptionStartDate: null, status: 'unknown' });
    const closed = dateBasedStatusFilter('closed');
    expect(closed.OR?.[0]).toEqual({ receptionStartDate: null, NOT: { sourceType: 'PUBLIC_RENT', status: 'unknown' } });
  });

  it('finds a secondary supply region even when it is absent from the notice summary', async () => {
    db.queryRaw.mockResolvedValue([{ id: 77 }]);
    await getSubscriptionList({ region: '경기 수원시', status: 'upcoming', page: 1, limit: 20 });
    const base = db.findMany.mock.calls[0][0].where.AND[0];
    expect(base.AND).toEqual([expect.objectContaining({ OR: expect.arrayContaining([{ id: { in: [77] } }]) })]);
  });

  it('combines keyword IDs with the existing rent category filter', async () => {
    db.queryRaw.mockResolvedValue([{ id: 88 }]);

    await getSubscriptionList({ category: 'rent', q: '서울 매입', status: 'upcoming', page: 1, limit: 20 });

    const base = db.findMany.mock.calls[0][0].where.AND[0];
    expect(base.AND).toEqual([
      expect.objectContaining({
        OR: expect.arrayContaining([{ sourceType: 'PUBLIC_RENT' }]),
      }),
      { id: { in: [88] } },
    ]);
  });
});
