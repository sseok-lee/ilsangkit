import { describe, it, expect, vi, beforeEach } from 'vitest';

const { groupByMock, findManyMock, countMock } = vi.hoisted(() => ({
  groupByMock: vi.fn(),
  findManyMock: vi.fn(),
  countMock: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const wasteSchedule = {
    groupBy: groupByMock,
    findMany: findManyMock,
    count: countMock,
  };
  return { prisma: { wasteSchedule }, default: { wasteSchedule } };
});

import { getByRegion, getDistricts, getWasteScheduleRegions } from '../../src/services/wasteScheduleService.js';

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

describe('getByRegion — city variant matching', () => {
  beforeEach(() => {
    findManyMock.mockResolvedValue([]);
    countMock.mockResolvedValue(0);
  });

  it('축약명(서울)으로 조회해도 정식명(서울특별시) 행을 매칭한다', async () => {
    await getByRegion('서울');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울', '서울특별시']) });
  });

  it('정식명(서울특별시)으로 조회해도 축약명(서울)을 함께 매칭한다', async () => {
    await getByRegion('서울특별시');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울특별시', '서울']) });
  });

  it('city 가 없으면 city 조건 없이 전국을 조회한다', async () => {
    await getByRegion();

    const where = findManyMock.mock.calls[0][0].where;
    expect(where).not.toHaveProperty('city');
  });

  it('district 는 정확 일치로 함께 전달한다', async () => {
    await getByRegion('서울', '강남구');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.district).toBe('강남구');
  });

  it('keyword 는 city variant 필터와 공존한다', async () => {
    await getByRegion('서울', undefined, '역삼');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울특별시']) });
    expect(where.targetRegion).toEqual({ contains: '역삼' });
  });

  it('findMany 와 count 가 동일한 where 를 사용한다', async () => {
    await getByRegion('서울', '강남구', '역삼');

    expect(findManyMock.mock.calls[0][0].where).toEqual(countMock.mock.calls[0][0].where);
  });

  it('slug 매칭에 실패한 city 는 정확 일치로 넘긴다', async () => {
    await getByRegion('없는도시');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toBe('없는도시');
  });

  it('통합명(전남광주통합특별시)은 variant 확장 없이 그대로 매칭한다', async () => {
    await getByRegion('전남광주통합특별시');

    const where = findManyMock.mock.calls[0][0].where;
    expect(where.city).toBe('전남광주통합특별시');
  });
});

describe('getDistricts — city variant matching', () => {
  it('축약명(서울)으로도 정식명(서울특별시) 행의 구/군을 매칭한다', async () => {
    groupByMock.mockResolvedValue([{ district: '강남구' }, { district: '강동구' }]);

    const result = await getDistricts('서울');

    const where = groupByMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울', '서울특별시']) });
    expect(result).toEqual(['강남구', '강동구']);
  });

  it('정식명(서울특별시)으로 조회해도 축약명을 함께 매칭한다', async () => {
    groupByMock.mockResolvedValue([]);

    await getDistricts('서울특별시');

    const where = groupByMock.mock.calls[0][0].where;
    expect(where.city).toEqual({ in: expect.arrayContaining(['서울특별시', '서울']) });
  });
});
