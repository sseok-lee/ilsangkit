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
    // 옛 형식 키(동·지번 없음)는 한 키에 여러 파티션이 걸리므로 기존 창 함수 경로를 그대로 쓴다.
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
    expect(sqlText(mockQueryRaw.mock.calls[1][0])).toContain(
      "ORDER BY latest.buildingName, latest.bjdCode, TRIM(latest.dongName), COALESCE(TRIM(latest.jibun), ''), latest.rentType",
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
    expect(sql).not.toContain('ROW_NUMBER() OVER');
    expect(sql.match(/LIMIT 1\)/g)).toHaveLength(2);
    expect(sql).toContain("COALESCE(TRIM(t.jibun), '') = ?");
    const values = sqlValues(mockQueryRaw.mock.calls[0][0]);
    const perBranch = values.length / 2;
    expect(values.slice(0, 4)).toEqual(['11680', '스톤빌리지', '대치동', '934-2']);
    expect(values.slice(perBranch, perBranch + 4)).toEqual(['11680', '스톤빌리지', '역삼동', '785-10']);
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

  it('reads one row per address key with an index-ordered LIMIT 1 branch instead of ranking every deal', async () => {
    const keys: BuildingKey[] = [
      { propertyType: 'apt', buildingName: '검증아파트', bjdCode: '11680', dongName: '대치동', jibun: '1' },
      { propertyType: 'apt', buildingName: '동명아파트', bjdCode: '11710', dongName: '잠실동', jibun: null },
    ];
    mockQueryRaw.mockResolvedValue([]);

    await getLatestDeals(keys, 'sale');

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const sql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(sql).not.toContain('ROW_NUMBER() OVER');
    expect(sql.match(/UNION ALL/g)).toHaveLength(1);
    expect(sql.match(/ORDER BY t\.dealYear DESC, t\.dealMonth DESC, t\.dealDay DESC, t\.id DESC\s+LIMIT 1\)/g)).toHaveLength(2);
    expect(sql).toContain('FROM AptSaleTransaction t');
    expect(sql.match(/SELECT \/\*\+ INDEX\(t AptSaleTransaction_buildingName_bjdCode_dealYear_dealMonth_d_idx\) \*\//g))
      .toHaveLength(2);
    expect(sql).toContain('t.dealAmount IS NOT NULL');
    expect(sql).toContain('cancelDealDay');
    expect(sql).toContain(
      "ORDER BY latest.buildingName, latest.bjdCode, TRIM(latest.dongName), COALESCE(TRIM(latest.jibun), '')",
    );
  });

  it('splits rent into one jeonse and one wolse branch per address key, keeping the existing rent filters', async () => {
    const key: BuildingKey = {
      propertyType: 'offitel', buildingName: '오피스텔', bjdCode: '11680', dongName: '역삼동', jibun: '7',
    };
    mockQueryRaw.mockResolvedValueOnce([
      {
        buildingName: '오피스텔', bjdCode: '11680', dongName: '역삼동', jibun: '7', rentType: '월세',
        deposit: 1000n, monthlyRent: 80, exclusiveArea: 20.5, floor: 9, dealYear: 2026, dealMonth: 9, dealDay: 1,
      },
      {
        buildingName: '오피스텔', bjdCode: '11680', dongName: '역삼동', jibun: '7', rentType: '전세',
        deposit: 20000n, monthlyRent: 0, exclusiveArea: 20.5, floor: 3, dealYear: 2026, dealMonth: 8, dealDay: null,
      },
    ]);

    const result = await getLatestDeals([key], 'rent');

    const sql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(sql).toContain('FROM OffitelRentTransaction t');
    expect(sql).toContain('/*+ INDEX(t OffitelRentTransaction_buildingName_bjdCode_dealYear_dealMon_idx) */');
    expect(sql.match(/LIMIT 1\)/g)).toHaveLength(2);
    expect(sql).toContain("t.rentType = '전세' AND t.deposit IS NOT NULL");
    expect(sql).toContain("t.rentType = '월세' AND t.deposit IS NOT NULL AND t.monthlyRent IS NOT NULL");
    expect(result.get(latestDealsKey(key))).toMatchObject({
      sale: null,
      jeonse: { kind: 'jeonse', deposit: 20000, dealDay: null },
      wolse: { kind: 'wolse', deposit: 1000, monthlyRent: 80 },
    });
  });

  it('keeps legacy keys on the ranking path and address keys on LIMIT 1 branches in the same round trip', async () => {
    const keys: BuildingKey[] = [
      { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680' },
      { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680', dongName: '대치동', jibun: '934-2' },
    ];
    mockQueryRaw.mockResolvedValueOnce([]);

    await getLatestDeals(keys, 'sale');

    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
    const sql = sqlText(mockQueryRaw.mock.calls[0][0]);
    expect(sql.match(/ROW_NUMBER\(\) OVER/g)).toHaveLength(1);
    expect(sql.match(/LIMIT 1\)/g)).toHaveLength(1);
    expect(sql).toContain('UNION ALL');
  });

  it('lets the last row win when several partitions map to one legacy key, as before', async () => {
    const key: BuildingKey = { propertyType: 'villa', buildingName: '스톤빌리지', bjdCode: '11680' };
    mockQueryRaw.mockResolvedValueOnce([
      {
        buildingName: '스톤빌리지', bjdCode: '11680', dongName: '대치동', jibun: '1', dealAmount: 1n,
        exclusiveArea: 1, floor: 1, dealYear: 2026, dealMonth: 1, dealDay: 1,
      },
      {
        buildingName: '스톤빌리지', bjdCode: '11680', dongName: '역삼동', jibun: '2', dealAmount: 2n,
        exclusiveArea: 1, floor: 1, dealYear: 2025, dealMonth: 1, dealDay: 1,
      },
    ]);

    const result = await getLatestDeals([key], 'sale');

    expect(result.get(latestDealsKey(key))?.sale?.amount).toBe(2);
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

describe('getLatestDeals 면적 옵션', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
    mockQueryRaw.mockResolvedValue([]);
  });

  const key: BuildingKey = { propertyType: 'apt', buildingName: '가', bjdCode: '11680', dongName: '대치동', jibun: '1' };

  it('옵션이 없거나 area=null 이면 SQL 이 예전과 글자까지 같다', async () => {
    await getLatestDeals([key], 'all');
    await getLatestDeals([key], 'all', {});
    await getLatestDeals([key], 'all', { area: null });
    const [a, b] = [sqlText(mockQueryRaw.mock.calls[0][0]), sqlText(mockQueryRaw.mock.calls[1][0])];
    expect(sqlText(mockQueryRaw.mock.calls[2][0])).toBe(a);
    expect(sqlText(mockQueryRaw.mock.calls[4][0])).toBe(a);
    expect(sqlText(mockQueryRaw.mock.calls[3][0])).toBe(b);
    expect(sqlText(mockQueryRaw.mock.calls[5][0])).toBe(b);
    expect(a).not.toContain('exclusiveArea >');
    expect(sqlValues(mockQueryRaw.mock.calls[2][0])).toEqual(sqlValues(mockQueryRaw.mock.calls[0][0]));
  });

  it('하한 초과·상한 이하 조건을 매매·전세·월세 갈래마다 건다', async () => {
    await getLatestDeals([key], 'all', { area: { min: 60, max: 85 } });
    const sale = sqlText(mockQueryRaw.mock.calls[0][0]);
    const rent = sqlText(mockQueryRaw.mock.calls[1][0]);
    expect(sale.match(/t\.exclusiveArea > \?/g)).toHaveLength(1);
    expect(sale.match(/t\.exclusiveArea <= \?/g)).toHaveLength(1);
    expect(rent.match(/t\.exclusiveArea > \?/g)).toHaveLength(2);
    expect(rent.match(/t\.exclusiveArea <= \?/g)).toHaveLength(2);
    expect(sqlValues(mockQueryRaw.mock.calls[0][0])).toEqual(expect.arrayContaining([60, 85]));
    // 인덱스 힌트·LIMIT 1 갈래 구조는 그대로
    expect(sale).toContain('/*+ INDEX(t AptSaleTransaction_buildingName_bjdCode_dealYear_dealMonth_d_idx) */');
    expect(sale).toContain('LIMIT 1');
  });

  it('열린 끝은 조건을 넣지 않는다(60 이하 / 135 초과)', async () => {
    await getLatestDeals([key], 'sale', { area: { min: null, max: 60 } });
    await getLatestDeals([key], 'sale', { area: { min: 135, max: null } });
    const le60 = sqlText(mockQueryRaw.mock.calls[0][0]);
    const gt135 = sqlText(mockQueryRaw.mock.calls[1][0]);
    expect(le60).not.toContain('exclusiveArea >');
    expect(le60).toContain('t.exclusiveArea <= ?');
    expect(gt135).toContain('t.exclusiveArea > ?');
    expect(gt135).not.toContain('exclusiveArea <=');
  });
});
