import { describe, it, expect, vi, beforeEach } from 'vitest';

const { groupByMock } = vi.hoisted(() => ({
  groupByMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    wasteSchedule: {
      groupBy: groupByMock,
    },
  },
  default: {
    wasteSchedule: {
      groupBy: groupByMock,
    },
  },
}));

import { getWasteScheduleRegions } from '../../src/services/wasteScheduleService.js';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('getWasteScheduleRegions', () => {
  it('returns distinct (city, district) with max updatedAt', async () => {
    const t1 = new Date('2026-06-01T00:00:00Z');
    const t2 = new Date('2026-06-10T00:00:00Z');

    groupByMock.mockResolvedValue([
      { city: '경기도', district: '가평군', _max: { updatedAt: t1 } },
      { city: '서울특별시', district: '강남구', _max: { updatedAt: t2 } },
    ]);

    const result = await getWasteScheduleRegions();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ city: '경기도', district: '가평군', updatedAt: t1 });
    expect(result[1]).toEqual({ city: '서울특별시', district: '강남구', updatedAt: t2 });
  });

  it('calls groupBy with city and district keys and _max updatedAt', async () => {
    groupByMock.mockResolvedValue([]);

    await getWasteScheduleRegions();

    expect(groupByMock).toHaveBeenCalledOnce();
    const callArg = groupByMock.mock.calls[0][0];
    expect(callArg.by).toEqual(['city', 'district']);
    expect(callArg._max).toHaveProperty('updatedAt', true);
  });

  it('excludes records where _max.updatedAt is null', async () => {
    const t1 = new Date('2026-06-01T00:00:00Z');

    groupByMock.mockResolvedValue([
      { city: '경기도', district: '가평군', _max: { updatedAt: t1 } },
      { city: '서울특별시', district: '강남구', _max: { updatedAt: null } },
    ]);

    const result = await getWasteScheduleRegions();

    expect(result).toHaveLength(1);
    expect(result[0].city).toBe('경기도');
  });

  it('returns empty array when no waste schedule records exist', async () => {
    groupByMock.mockResolvedValue([]);

    const result = await getWasteScheduleRegions();

    expect(result).toEqual([]);
  });

  it('orders results by city asc then district asc', async () => {
    groupByMock.mockResolvedValue([]);

    await getWasteScheduleRegions();

    const callArg = groupByMock.mock.calls[0][0];
    expect(callArg.orderBy).toEqual([{ city: 'asc' }, { district: 'asc' }]);
  });
});
