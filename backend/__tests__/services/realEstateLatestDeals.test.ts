import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prisma = {
    $queryRaw: mockQueryRaw,
  };
  return { prisma, default: prisma };
});

import {
  getLatestDeals,
  latestDealsKey,
} from '../../src/services/realEstateLatestDeals.js';
import type { BuildingKey } from '../../src/types/realEstateExploration.js';

function sqlText(query: unknown): string {
  const sql = query as Prisma.Sql;
  return sql.strings.join('?');
}

function sqlValues(query: unknown): unknown[] {
  return (query as Prisma.Sql).values;
}

describe('getLatestDeals', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('returns the latest sale source row without filling missing fields from older same-price rows', async () => {
    const key: BuildingKey = {
      propertyType: 'apt',
      buildingName: '검증아파트',
      bjdCode: '11680',
    };
    mockQueryRaw.mockResolvedValueOnce([
      {
        buildingName: '검증아파트',
        bjdCode: '11680',
        dealAmount: 125000n,
        deposit: null,
        monthlyRent: null,
        exclusiveArea: null,
        floor: 12,
        dealYear: 2026,
        dealMonth: 8,
        dealDay: 20,
      },
    ]);

    const result = await getLatestDeals([key], 'sale');

    expect(result.get(latestDealsKey(key))?.sale).toMatchObject({
      kind: 'sale',
      amount: 125000,
      deposit: null,
      monthlyRent: null,
      exclusiveArea: null,
      floor: 12,
      dealYear: 2026,
      dealMonth: 8,
      dealDay: 20,
    });
    expect(result.get(latestDealsKey(key))?.jeonse).toBeNull();
    expect(result.get(latestDealsKey(key))?.wolse).toBeNull();
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('ROW_NUMBER() OVER');
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('dealDay IS NULL ASC');
  });

  it('keeps every requested key in the result and batches sale/rent once per property type for all scope', async () => {
    const keys: BuildingKey[] = [
      { propertyType: 'apt', buildingName: '검증아파트', bjdCode: '11680' },
      { propertyType: 'apt', buildingName: '동명아파트', bjdCode: '11710' },
    ];
    mockQueryRaw
      .mockResolvedValueOnce([
        {
          buildingName: '검증아파트',
          bjdCode: '11680',
          dealAmount: 125000n,
          deposit: null,
          monthlyRent: null,
          exclusiveArea: new Prisma.Decimal('84.92'),
          floor: 3,
          dealYear: 2026,
          dealMonth: 8,
          dealDay: 20,
        },
      ])
      .mockResolvedValueOnce([
        {
          buildingName: '검증아파트',
          bjdCode: '11680',
          rentType: '전세',
          dealAmount: null,
          deposit: 70000n,
          monthlyRent: null,
          exclusiveArea: new Prisma.Decimal('59.98'),
          floor: 4,
          dealYear: 2026,
          dealMonth: 7,
          dealDay: 31,
        },
        {
          buildingName: '검증아파트',
          bjdCode: '11680',
          rentType: '월세',
          dealAmount: null,
          deposit: 10000n,
          monthlyRent: 120,
          exclusiveArea: new Prisma.Decimal('59.98'),
          floor: 5,
          dealYear: 2026,
          dealMonth: 8,
          dealDay: null,
        },
      ]);

    const result = await getLatestDeals(keys, 'all');

    expect([...result.keys()]).toEqual(keys.map(latestDealsKey));
    expect(result.get(latestDealsKey(keys[0]))).toMatchObject({
      sale: { kind: 'sale', amount: 125000, deposit: null, monthlyRent: null },
      jeonse: { kind: 'jeonse', amount: null, deposit: 70000, monthlyRent: null },
      wolse: { kind: 'wolse', amount: null, deposit: 10000, monthlyRent: 120 },
    });
    expect(result.get(latestDealsKey(keys[1]))).toEqual({
      sale: null,
      jeonse: null,
      wolse: null,
    });
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    expect(sqlValues(mockQueryRaw.mock.calls[0][0]).slice(0, 4)).toEqual([
      '11680',
      '검증아파트',
      '11710',
      '동명아파트',
    ]);
    expect(sqlText(mockQueryRaw.mock.calls[1][0])).toContain(
      "PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), ''), t.rentType",
    );
  });

  it('does not let an explicitly unknown address inherit a known parcel latest deal', async () => {
    const unknownAddress: BuildingKey = {
      propertyType: 'villa',
      buildingName: '스톤빌리지',
      bjdCode: '11680',
      dongName: '',
      jibun: null,
    };
    mockQueryRaw.mockResolvedValueOnce([
      {
        buildingName: '스톤빌리지',
        bjdCode: '11680',
        dongName: '대치동',
        jibun: '934-2',
        dealAmount: 81000n,
        deposit: null,
        monthlyRent: null,
        exclusiveArea: 59.7,
        floor: 2,
        dealYear: 2026,
        dealMonth: 8,
        dealDay: 3,
      },
    ]);

    const result = await getLatestDeals([unknownAddress], 'sale');

    expect(result.get(latestDealsKey(unknownAddress))?.sale).toBeNull();
    expect(sqlValues(mockQueryRaw.mock.calls[0][0]).slice(0, 4)).toEqual([
      '11680',
      '스톤빌리지',
      '',
      '',
    ]);
  });

  it('normalizes null jibun as an empty address component for a known dong', async () => {
    const noJibun: BuildingKey = {
      propertyType: 'villa',
      buildingName: '스톤빌리지',
      bjdCode: '11680',
      dongName: '대치동',
      jibun: null,
    };
    mockQueryRaw.mockResolvedValueOnce([
      {
        buildingName: '스톤빌리지',
        bjdCode: '11680',
        dongName: '대치동',
        jibun: '',
        dealAmount: 72000n,
        deposit: null,
        monthlyRent: null,
        exclusiveArea: 48.2,
        floor: 1,
        dealYear: 2026,
        dealMonth: 8,
        dealDay: 2,
      },
    ]);

    const result = await getLatestDeals([noJibun], 'sale');

    expect(result.get(latestDealsKey(noJibun))?.sale?.amount).toBe(72000);
    expect(sqlValues(mockQueryRaw.mock.calls[0][0]).slice(0, 4)).toEqual([
      '11680',
      '스톤빌리지',
      '대치동',
      '',
    ]);
  });

  it('keeps same-name buildings at different parcels isolated', async () => {
    const keys: BuildingKey[] = [
      { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680', dongName: '대치동', jibun: '934-2' },
      { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680', dongName: '역삼동', jibun: '785-10' },
    ];
    mockQueryRaw.mockResolvedValueOnce([
      {
        buildingName: '스톤빌리지',
        bjdCode: '11680',
        dongName: '대치동',
        jibun: '934-2',
        dealAmount: 81000n,
        deposit: null,
        monthlyRent: null,
        exclusiveArea: 59.7,
        floor: 2,
        dealYear: 2026,
        dealMonth: 8,
        dealDay: 3,
      },
    ]);

    const result = await getLatestDeals(keys, 'sale');

    expect([...result.keys()]).toEqual(keys.map(latestDealsKey));
    expect(result.get(latestDealsKey(keys[0]))?.sale?.amount).toBe(81000);
    expect(result.get(latestDealsKey(keys[1]))?.sale).toBeNull();
    const sql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(sql).toContain("PARTITION BY t.buildingName, t.bjdCode, TRIM(t.dongName), COALESCE(TRIM(t.jibun), '')");
    expect(sql).toContain('t.jibun');
    expect(sqlValues(mockQueryRaw.mock.calls[0][0]).slice(0, 8)).toEqual([
      '11680',
      '스톤빌리지',
      '대치동',
      '934-2',
      '11680',
      '스톤빌리지',
      '역삼동',
      '785-10',
    ]);
  });

  it('projects only latest-deal DTO source fields inside ranking subqueries', async () => {
    const key: BuildingKey = {
      propertyType: 'apt',
      buildingName: '검증아파트',
      bjdCode: '11680',
    };
    mockQueryRaw.mockResolvedValue([]);

    await getLatestDeals([key], 'all');

    const saleSql = sqlText(mockQueryRaw.mock.calls[0][0]);
    const rentSql = sqlText(mockQueryRaw.mock.calls[1][0]);

    expect(saleSql).not.toMatch(/SELECT\s+t\.\*/);
    expect(saleSql).not.toMatch(/SELECT\s+\*/);
    expect(saleSql).toContain('t.dealAmount');
    expect(saleSql).toContain('t.exclusiveArea');
    expect(saleSql).toContain('t.floor');
    expect(saleSql).toContain('t.id DESC');

    expect(rentSql).not.toMatch(/SELECT\s+t\.\*/);
    expect(rentSql).not.toMatch(/SELECT\s+\*/);
    expect(rentSql).toContain('t.rentType');
    expect(rentSql).toContain('t.deposit');
    expect(rentSql).toContain('t.monthlyRent');
    expect(rentSql).toContain('t.exclusiveArea');
    expect(rentSql).toContain('t.floor');
    expect(rentSql).toContain('t.id DESC');
  });

  it('does not issue SQL for an empty candidate list', async () => {
    await expect(getLatestDeals([], 'all')).resolves.toEqual(new Map());
    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('propagates database errors', async () => {
    mockQueryRaw.mockRejectedValueOnce(new Error('db down'));

    await expect(getLatestDeals([
      { propertyType: 'apt', buildingName: '검증아파트', bjdCode: '11680' },
    ], 'sale')).rejects.toThrow('db down');
  });
});
