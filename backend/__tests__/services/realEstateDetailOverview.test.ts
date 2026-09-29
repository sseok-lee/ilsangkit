import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockQueryRaw,
  mockGetBuildingInfo,
} = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
  mockGetBuildingInfo: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $queryRaw: mockQueryRaw,
  };
  return { prisma, default: prisma };
});

vi.mock('../../src/services/realEstateService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/realEstateService.js')>();
  return {
    ...actual,
    getBuildingInfo: mockGetBuildingInfo,
  };
});

import { getDetailOverview } from '../../src/services/realEstateDetailService.js';

function sqlText(query: unknown): string {
  const sql = query as Prisma.Sql;
  return sql.strings.join('?');
}

beforeEach(() => {
  mockQueryRaw.mockReset();
  mockGetBuildingInfo.mockReset();
  mockGetBuildingInfo.mockResolvedValue({
    bjdCode: '11680',
    buildingName: 'A',
    buildYear: 2010,
    minArea: 59.9,
    maxArea: 114.8,
  });
});

describe('getDetailOverview', () => {
  it('uses sale table independently even when current type is rent', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ id: 9, dealAmount: 81000n, dealYear: 2026, dealMonth: 9, dealDay: null, exclusiveArea: new Prisma.Decimal('84.90'), floor: 12 }])
      .mockResolvedValueOnce([{ count: 3n }])
      .mockResolvedValueOnce([{ minArea: new Prisma.Decimal('59.90'), maxArea: new Prisma.Decimal('114.80') }])
      .mockResolvedValueOnce([{ dongName: '역삼동', jibun: '1', roadName: '테헤란로' }])
      .mockResolvedValueOnce([{ lat: new Prisma.Decimal('37.5000000'), lng: new Prisma.Decimal('127.0000000') }]);

    const overview = await getDetailOverview('apt-rent', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    expect(mockGetBuildingInfo).toHaveBeenCalledWith('apt-rent', '11680', 'A');
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('FROM AptSaleTransaction t');
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('cancelDealType');
    expect(overview?.latestSale).toEqual({
      id: 9,
      amount: 81000,
      year: 2026,
      month: 9,
      day: null,
      area: '84.90',
      floor: 12,
    });
    expect(overview?.saleCount6m).toBe(3);
  });

  it('returns overview with latestSale null when the building only has rent rows', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: new Prisma.Decimal('84.90'), maxArea: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ dongName: '역삼동', jibun: '1', roadName: null }])
      .mockResolvedValueOnce([]);

    const overview = await getDetailOverview('apt-rent', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    expect(overview?.latestSale).toBeNull();
    expect(overview?.minArea).toBe('84.90');
    expect(overview?.maxArea).toBe('84.90');
  });

  it('sorts null latest sale day after known days in the same month and excludes invalid/future calendar dates', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    const sql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(sql).toContain('dealDay IS NULL ASC');
    expect(sql).toContain('dealDay DESC');
    expect(sql).toContain('DAY(LAST_DAY');
    expect(sql).toContain('STR_TO_DATE');
    expect(sql).toContain('<= ?');
  });

  it('marks location ambiguous when one property has multiple addresses', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([
        { dongName: '역삼동', jibun: '1', roadName: 'A로' },
        { dongName: '역삼동', jibun: '2', roadName: 'B로' },
      ])
      .mockResolvedValueOnce([{ lat: new Prisma.Decimal('37.5000000'), lng: new Prisma.Decimal('127.0000000') }]);

    const overview = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' }, new Date('2026-09-21T03:00:00Z'));

    expect(overview?.addresses).toHaveLength(2);
    expect(overview?.locationAmbiguous).toBe(true);
    expect(overview?.location).toBeNull();
  });

  it('merges road-name variants of the same parcel and restores coordinates', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([
        { dongName: '도곡동', jibun: '527', roadName: null },
        { dongName: '도곡동', jibun: '527', roadName: '선릉로 221' },
      ])
      .mockResolvedValueOnce([{ lat: 37.5, lng: 127.0 }]);
    const result = await getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: '도곡렉슬' });
    expect(result?.addresses).toEqual([{ dongName: '도곡동', jibun: '527', roadName: '선릉로 221' }]);
    expect(result?.locationAmbiguous).toBe(false);
    expect(result?.location).toEqual({ lat: 37.5, lng: 127 });
  });

  it('filters all overview sources to the address resolved by buildingKey', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ count: 0n }])
      .mockResolvedValueOnce([{ minArea: null, maxArea: null }])
      .mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2', roadName: null }])
      .mockResolvedValueOnce([]);
    const key = 'a'.repeat(64);
    await getDetailOverview('villa-sale', { bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: key });
    expect(mockGetBuildingInfo).toHaveBeenCalledWith('villa-sale', '11680', '스톤빌리지', key);
    for (const [query] of mockQueryRaw.mock.calls.slice(1)) {
      const sql = query as Prisma.Sql;
      expect(sql.values).toContain('대치동');
      expect(sql.values).toContain('934-2');
    }
  });

  it('rejects an unknown key instead of querying other same-name addresses', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    await expect(getDetailOverview('villa-sale', {
      bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: 'b'.repeat(64),
    })).rejects.toMatchObject({ statusCode: 404 });
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });

  it('returns null when getBuildingInfo fallback cannot find the building', async () => {
    mockGetBuildingInfo.mockResolvedValue(null);

    await expect(getDetailOverview('apt-sale', { bjdCode: '11680', buildingName: 'A' })).resolves.toBeNull();
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });
});
