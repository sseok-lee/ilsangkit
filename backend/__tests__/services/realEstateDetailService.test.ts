import { Prisma } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RealEstateType } from '../../src/services/realEstateService.js';

const {
  mockTransaction,
  mockQueryRaw,
  mockGetBuildingInfo,
  mockGetCanonicalPath,
  mockIsPreservedMode,
} = vi.hoisted(() => ({
  mockTransaction: vi.fn(),
  mockQueryRaw: vi.fn(),
  mockGetBuildingInfo: vi.fn(),
  mockGetCanonicalPath: vi.fn(),
  mockIsPreservedMode: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const client = {
    $queryRaw: mockQueryRaw,
  };
  const prisma = {
    $transaction: mockTransaction,
    $queryRaw: mockQueryRaw,
  };
  return { prisma, default: prisma, __mockClient: client };
});

vi.mock('../../src/services/realEstateService.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/services/realEstateService.js')>();
  return {
    ...actual,
    getBuildingInfo: mockGetBuildingInfo,
  };
});
vi.mock('../../src/services/realEstateUrlRegistry.js', () => ({
  getRealEstateCanonicalPath: mockGetCanonicalPath,
  isPreservedRealEstateUrlMode: mockIsPreservedMode,
}));

beforeEach(() => {
  mockGetBuildingInfo.mockReset();
  mockGetBuildingInfo.mockResolvedValue({ bjdCode: '11680', dongName: '역삼동', jibun: '1', regionMatched: true });
  mockGetCanonicalPath.mockReset();
  mockGetCanonicalPath.mockResolvedValue(null);
  mockIsPreservedMode.mockReset();
  mockIsPreservedMode.mockReturnValue(false);
});

import {
  getDetailPage,
  getDetailSnapshot,
  serializeDetailPoints,
} from '../../src/services/realEstateDetailService.js';
import { normalizeAreaGroupParam } from '../../src/services/realEstateExactFilter.js';

const TYPES: RealEstateType[] = [
  'apt-sale',
  'apt-rent',
  'villa-sale',
  'villa-rent',
  'offitel-sale',
  'offitel-rent',
];

function sqlText(query: unknown): string {
  const sql = query as Prisma.Sql;
  return sql.strings.join('?');
}

function sqlValues(query: unknown): unknown[] {
  return (query as Prisma.Sql).values;
}

function wolseAreaRows(): Array<Record<string, unknown>> {
  return [
    { area: '84.91', total: 1n, recent: 1n },
    { area: '84.90', total: 2n, recent: 2n },
  ];
}

function basisRow(id: number, date: string, amount: number, area = '84.90', direct = 0): Record<string, unknown> {
  return { id, date, amount: BigInt(amount), area, floor: 3, direct };
}

function enqueueSnapshotRows(): void {
  mockQueryRaw
    .mockResolvedValueOnce(wolseAreaRows())
    .mockResolvedValueOnce([{ amount: 0n, count: 1n }, { amount: 10000n, count: 2n }])
    .mockResolvedValueOnce([
      { id: 2, date: '2026-09-12', area: '84.90', floor: 5, amount: 120, deposit: 0n },
      { id: 1, date: '2026-09-12', area: '84.90', floor: 3, amount: 110, deposit: 0n },
    ])
    .mockResolvedValueOnce([{ total: 2n }])
    .mockResolvedValueOnce([
      {
        id: 2,
        buildingName: 'A',
        bjdCode: '11680',
        city: '서울특별시',
        district: '강남구',
        dongName: '역삼동',
        floor: 5,
        exclusiveArea: new Prisma.Decimal('84.90'),
        buildYear: 2010,
        dealYear: 2026,
        dealMonth: 9,
        dealDay: 12,
        deposit: 0n,
        monthlyRent: 120,
        rentType: '월세',
        contractType: '신규',
        contractTerm: '24',
        preDeposit: 0n,
        preMonthlyRent: 110,
      },
      {
        id: 1,
        buildingName: 'A',
        bjdCode: '11680',
        city: '서울특별시',
        district: '강남구',
        dongName: '역삼동',
        floor: 3,
        exclusiveArea: new Prisma.Decimal('84.90'),
        buildYear: 2010,
        dealYear: 2026,
        dealMonth: 9,
        dealDay: 12,
        deposit: 0n,
        monthlyRent: 110,
        rentType: '월세',
        contractType: null,
        contractTerm: null,
        preDeposit: null,
        preMonthlyRent: null,
      },
    ]);
}

describe('serializeDetailPoints', () => {
  it('같은 날 거래를 모두 유지하고 Decimal/BigInt를 직렬화한다', () => {
    const rows = [
      { id: 2, date: '2026-09-12', area: '84.90', floor: 5, amount: 81000n, deposit: null },
      { id: 1, date: '2026-09-12', area: '84.90', floor: 3, amount: 80000n, deposit: null },
    ];
    const result = serializeDetailPoints(rows);

    expect(result.map((p) => p.id).sort()).toEqual([1, 2]);
    expect(result.find((p) => p.id === 2)?.amount).toBe(81000);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('0 보증금과 0층/null층을 구분한다', () => {
    const result = serializeDetailPoints([
      { id: 1, date: '2026-09-12', area: new Prisma.Decimal('84.90'), floor: 0, amount: 120, deposit: 0n },
      { id: 2, date: '2026-09-13', area: new Prisma.Decimal('84.90'), floor: null, amount: 130, deposit: null },
    ]);

    expect(result).toEqual([
      { id: 1, date: '2026-09-12', area: '84.90', floor: 0, amount: 120, deposit: 0, flag: 'normal' },
      { id: 2, date: '2026-09-13', area: '84.90', floor: null, amount: 130, deposit: null, flag: 'normal' },
    ]);
  });

  it('Prisma가 Date를 반환해도 YYYY-MM-DD wire date로 직렬화한다', () => {
    const result = serializeDetailPoints([
      { id: 1, date: new Date('2026-09-12T00:00:00.000Z'), area: '84.90', floor: 1, amount: 120, deposit: 0n },
    ]);

    expect(result[0].date).toBe('2026-09-12');
  });
});

describe('getDetailSnapshot exact filters', () => {
  beforeEach(() => {
    mockTransaction.mockReset();
    mockQueryRaw.mockReset();
    mockTransaction.mockImplementation(async (callback) => callback({ $queryRaw: mockQueryRaw }));
  });

  it.each(TYPES)('uses the allowlisted table and area group filter for %s', async (type) => {
    const mode = type.endsWith('-sale') ? 'sale' : 'jeonse';
    mockQueryRaw
      .mockResolvedValueOnce([basisRow(1, '2026-09-01', 1000)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot(type, {
      bjdCode: '11680',
      buildingName: 'A',
      mode,
      months: 6,
      area: '84.9',
    }, new Date('2026-09-21T03:00:00Z'));

    const basisSql = sqlText(mockQueryRaw.mock.calls[0][0]);
    const pointsSql = sqlText(mockQueryRaw.mock.calls[1][0]);
    const pointsValues = sqlValues(mockQueryRaw.mock.calls[1][0]);

    expect(basisSql).toContain(`FROM ${TABLE_FOR_TYPE[type]} t`);
    expect(basisSql).toContain('AS direct');
    expect(snapshot.filters.area).toBe('85');
    expect(snapshot.options.areas).toEqual([{ key: '85', label: '84', count: 1 }]);
    expect(pointsSql).toContain('t.bjdCode = ?');
    expect(pointsSql).toContain('t.buildingName = ?');
    expect(pointsSql).toContain('ROUND(t.exclusiveArea) = ?');
    expect(pointsSql).not.toContain('t.exclusiveArea = ?');
    expect(pointsSql).toContain('STR_TO_DATE');
    expect(pointsValues).toContain('11680');
    expect(pointsValues).toContain('A');
    expect(pointsValues).toContain(85);
  });

  it('excludes sale cancellation signals using both cancel fields', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([basisRow(1, '2026-09-01', 1000)])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    await getDetailSnapshot('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 6,
      area: '84.90',
    }, new Date('2026-09-21T03:00:00Z'));

    const sql = sqlText(mockQueryRaw.mock.calls[1][0]);
    expect(sql).toContain('cancelDealDay');
    expect(sql).toContain('cancelDealType');
    expect(sql).toContain("cancelDealDay = ''");
    expect(sql).toContain("cancelDealType = ''");
  });

  it('normalizes wolse deposit options and keeps 0 deposit when requested', async () => {
    enqueueSnapshotRows();

    const snapshot = await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: 0,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.filters.deposit).toBe(0);
    expect(snapshot.options.deposits).toEqual([{ amount: 0, count: 1 }, { amount: 10000, count: 2 }]);
    expect(snapshot.points.map((point) => point.id)).toEqual([2, 1]);
    expect(snapshot.table.items[0]).toMatchObject({ id: 2, deposit: 0, monthlyRent: 120, preDeposit: 0 });
  });

  it('does not turn a missing wolse deposit option into an exact zero deposit query', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ area: '84.90', total: 1n, recent: 1n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.filters.deposit).toBeNull();
    expect(snapshot.points).toEqual([]);
    expect(snapshot.table.total).toBe(0);
    expect(mockQueryRaw).toHaveBeenCalledTimes(2);
    const issuedSql = mockQueryRaw.mock.calls.map((call) => sqlText(call[0])).join('\n');
    expect(issuedSql).not.toContain('t.deposit = ?');
  });

  it('area param accepts group key and legacy decimal', () => {
    expect(normalizeAreaGroupParam('84.97')).toBe('85');
    expect(normalizeAreaGroupParam('85')).toBe('85');
    expect(normalizeAreaGroupParam(undefined)).toBeNull();
    expect(() => normalizeAreaGroupParam('84.901')).toThrow();
    expect(() => normalizeAreaGroupParam('abc')).toThrow();
  });

  it('unknown area resets to default group', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        basisRow(1, '2026-09-10', 50000, '59.97'),
        basisRow(2, '2025-03-01', 90000, '84.97'),
        basisRow(3, '2025-04-01', 91000, '84.97'),
        basisRow(4, '2025-05-01', 92000, '84.91'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A2',
      mode: 'sale',
      months: 6,
      area: '99',
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.options.areas.map((option) => option.key)).toEqual(['60', '85']);
    expect(snapshot.filters.area).toBe('85');
    expect(snapshot.adjustment).toBe('area-reset');
  });

  it('default area is most traded group, not latest deal', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        basisRow(1, '2026-09-10', 50000, '59.97'),
        basisRow(2, '2025-03-01', 90000, '84.97'),
        basisRow(3, '2025-04-01', 91000, '84.97'),
        basisRow(4, '2025-05-01', 92000, '84.91'),
        basisRow(5, '2020-05-01', 70000, '84.97'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 6,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.filters.area).toBe('85');
    expect(snapshot.adjustment).toBeNull();
    expect(snapshot.options.areas).toEqual([
      { key: '60', label: '59', count: 1 },
      { key: '85', label: '84', count: 3 },
    ]);
  });

  it('points carry only the direct tag (no outlier flag)', async () => {
    const amounts = [100000, 101000, 99000, 100500, 200000, 99500, 100200, 100800, 99800, 100100];
    const basis = amounts.map((amount, index) => basisRow(index + 1, `2026-0${1 + Math.floor(index / 2)}-1${index % 2}`, amount, '84.90'));
    basis.push(basisRow(11, '2026-03-15', 50000, '84.90', 1));
    mockQueryRaw
      .mockResolvedValueOnce(basis)
      .mockResolvedValueOnce([
        { id: 4, date: '2026-02-11', area: '84.90', floor: 3, amount: 100500n, deposit: null },
        { id: 5, date: '2026-03-10', area: '84.90', floor: 3, amount: 200000n, deposit: null },
        { id: 11, date: '2026-03-15', area: '84.90', floor: 3, amount: 50000n, deposit: null },
        { id: 99, date: '2026-03-16', area: '84.90', floor: 3, amount: 100000n, deposit: null },
      ])
      .mockResolvedValueOnce([{ total: 4n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 12,
      area: '85',
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.points.find((point) => point.id === 5)?.flag).toBe('normal');
    expect(snapshot.points.find((point) => point.id === 4)?.flag).toBe('normal');
    expect(snapshot.points.find((point) => point.id === 11)?.flag).toBe('direct');
    expect(snapshot.points.find((point) => point.id === 99)?.flag).toBe('normal');
    // 태그용 거래는 기간 제한 없이 읽는다
    const basisValues = sqlValues(mockQueryRaw.mock.calls[0][0]);
    expect(basisValues).not.toContain('2025-09-21');
  });

  it('wolse points are all normal and deposit filter still applies', async () => {
    enqueueSnapshotRows();

    const snapshot = await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '85',
      deposit: 0,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.options.areas).toEqual([{ key: '85', label: '84', count: 3 }]);
    expect(snapshot.points.length).toBeGreaterThan(0);
    expect(snapshot.points.every((point) => point.flag === 'normal')).toBe(true);
    const issued = mockQueryRaw.mock.calls.map((call) => sqlText(call[0]));
    expect(issued.some((sql) => sql.includes('AS direct'))).toBe(false);
    const pointsSql = issued[2];
    expect(pointsSql).toContain('t.deposit = ?');
    expect(pointsSql).toContain('ROUND(t.exclusiveArea) = ?');
  });

  it('wolse default area is the group with most 36-month deals', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { area: '59.90', total: 10n, recent: 2n },
        { area: '84.90', total: 3n, recent: 3n },
      ])
      .mockResolvedValueOnce([{ amount: 0n, count: 1n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.filters.area).toBe('85');
    expect(snapshot.options.areas).toEqual([
      { key: '60', label: '59', count: 2 },
      { key: '85', label: '84', count: 3 },
    ]);
    const aggregateValues = sqlValues(mockQueryRaw.mock.calls[0][0]);
    expect(aggregateValues).toContain('2023-09-21');
  });

  it('colliding group labels get one decimal in sale snapshot options', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        basisRow(1, '2026-09-10', 90000, '84.43'),
        basisRow(2, '2026-08-10', 91000, '84.43'),
        basisRow(3, '2026-07-10', 92000, '84.97'),
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 6,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.options.areas).toEqual([
      { key: '84', label: '84.4', count: 2 },
      { key: '85', label: '84.9', count: 1 },
    ]);
  });

  it('colliding group labels get one decimal in wolse snapshot options', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([
        { area: '84.43', total: 2n, recent: 2n },
        { area: '84.97', total: 3n, recent: 3n },
      ])
      .mockResolvedValueOnce([{ amount: 0n, count: 1n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.options.areas).toEqual([
      { key: '84', label: '84.4', count: 2 },
      { key: '85', label: '84.9', count: 3 },
    ]);
  });

  it('months=0 uses the earliest retained group-filter deal date instead of a 36-month cap', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([basisRow(1, '2010-01-02', 1000)])
      .mockResolvedValueOnce([{ fromDate: '2010-01-02' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 0,
      area: '84.90',
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.filters.months).toBe(0);
    expect(snapshot.window).toEqual({ from: '2010-01-02', to: '2026-09-21' });

    const retainedWindowSql = sqlText(mockQueryRaw.mock.calls[1][0]);
    expect(retainedWindowSql).toContain('MIN(');
    expect(retainedWindowSql).toContain('ROUND(t.exclusiveArea) = ?');
    expect(retainedWindowSql).not.toContain('t.exclusiveArea = ?');

    const issuedValues = mockQueryRaw.mock.calls.flatMap(([query]) => sqlValues(query));
    expect(issuedValues).toContain('2010-01-02');
    expect(issuedValues).not.toContain('2023-09-21');
  });

  it('wraps coherent snapshot reads in RepeatableRead transaction', async () => {
    enqueueSnapshotRows();

    await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: 0,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(mockTransaction).toHaveBeenCalledWith(expect.any(Function), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  });
});

describe('getDetailPage exact filters', () => {
  beforeEach(() => {
    mockQueryRaw.mockReset();
  });

  it('requires exact area and keeps table pagination independent from snapshot normalization', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 21n }]).mockResolvedValueOnce([{ id: 1, exclusiveArea: new Prisma.Decimal('84.90'), dealAmount: 80000n }]);

    const page = await getDetailPage('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 6,
      area: '84.90',
      page: 2,
    }, new Date('2026-09-21T03:00:00Z'));

    const tableSql = sqlText(mockQueryRaw.mock.calls[1][0]);
    expect(tableSql).toContain('LIMIT ? OFFSET ?');
    expect(tableSql).toContain('ROUND(t.exclusiveArea) = ?');
    expect(tableSql).not.toContain('t.exclusiveArea = ?');
    expect(sqlValues(mockQueryRaw.mock.calls[0][0])).toContain(85);
    expect(sqlValues(mockQueryRaw.mock.calls[1][0]).slice(-2)).toEqual([15, 15]);
    expect(page).toMatchObject({ total: 21, page: 2, totalPages: 2 });
  });

  it('detail page filters by group', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 1n }]).mockResolvedValueOnce([]);

    await getDetailPage('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 6,
      area: '85',
      page: 1,
    }, new Date('2026-09-21T03:00:00Z'));

    for (const [query] of mockQueryRaw.mock.calls) {
      expect(sqlText(query)).toContain('ROUND(t.exclusiveArea) = ?');
      expect(sqlText(query)).not.toContain('t.exclusiveArea = ?');
      expect(sqlValues(query)).toContain(85);
    }
  });

  it('months=0 table pages use the same earliest retained exact-filter window', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ fromDate: '2011-03-04' }])
      .mockResolvedValueOnce([{ total: 21n }])
      .mockResolvedValueOnce([{ id: 1, exclusiveArea: new Prisma.Decimal('84.90'), dealAmount: 80000n }]);

    const page = await getDetailPage('apt-sale', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'sale',
      months: 0,
      area: '84.90',
      page: 2,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(page).toMatchObject({ total: 21, page: 2, totalPages: 2 });
    expect(sqlText(mockQueryRaw.mock.calls[0][0])).toContain('MIN(');
    expect(sqlValues(mockQueryRaw.mock.calls[1][0])).toContain('2011-03-04');
    expect(sqlValues(mockQueryRaw.mock.calls[2][0])).toContain('2011-03-04');
  });

  it('rejects missing/null wolse deposit instead of querying deposit 0', async () => {
    await expect(getDetailPage('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      page: 1,
    }, new Date('2026-09-21T03:00:00Z'))).rejects.toThrow(/requires exact deposit/);

    await expect(getDetailPage('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: null as unknown as number,
      page: 1,
    }, new Date('2026-09-21T03:00:00Z'))).rejects.toThrow(/requires exact deposit/);

    expect(mockQueryRaw).not.toHaveBeenCalled();
  });

  it('keeps valid zero wolse deposit as an exact filter', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ total: 1n }]).mockResolvedValueOnce([{ id: 1, deposit: 0n, monthlyRent: 120 }]);

    const page = await getDetailPage('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A',
      mode: 'wolse',
      months: 6,
      area: '84.90',
      deposit: 0,
      page: 1,
    }, new Date('2026-09-21T03:00:00Z'));

    const tableSql = sqlText(mockQueryRaw.mock.calls[1][0]);
    const tableValues = sqlValues(mockQueryRaw.mock.calls[1][0]);
    expect(tableSql).toContain('t.deposit = ?');
    expect(tableValues).toContain(0n);
    expect(page.items[0]).toMatchObject({ id: 1, deposit: 0, monthlyRent: 120 });
  });

  it.each([
    ['apt-sale', 'sale', null, ['t.aptDong', 'NULL AS houseType', 't.registrationDate'], ['t.houseType', 'NULL AS aptDong']],
    ['apt-rent', 'jeonse', null, ['NULL AS aptDong', 'NULL AS houseType'], ['t.aptDong', 't.houseType', 't.registrationDate']],
    ['villa-sale', 'sale', null, ['NULL AS aptDong', 't.houseType', 't.registrationDate'], ['t.aptDong']],
    ['villa-rent', 'jeonse', null, ['NULL AS aptDong', 't.houseType'], ['t.aptDong', 't.registrationDate']],
    ['offitel-sale', 'sale', null, ['NULL AS aptDong', 'NULL AS houseType', 'NULL AS registrationDate'], ['t.aptDong', 't.houseType', 't.registrationDate']],
    ['offitel-rent', 'jeonse', null, ['NULL AS aptDong', 'NULL AS houseType'], ['t.aptDong', 't.houseType', 't.registrationDate']],
  ] as Array<[RealEstateType, 'sale' | 'jeonse', number | null, string[], string[]]>)(
    'projects only schema-valid optional columns for %s',
    async (type, mode, deposit, expectedFragments, rejectedFragments) => {
      mockQueryRaw.mockResolvedValueOnce([{ total: 1n }]).mockResolvedValueOnce([]);

      await getDetailPage(type, {
        bjdCode: '11680',
        buildingName: 'A',
        mode,
        months: 6,
        area: '84.90',
        ...(deposit === null ? {} : { deposit }),
        page: 1,
      }, new Date('2026-09-21T03:00:00Z'));

      const tableSql = sqlText(mockQueryRaw.mock.calls[1][0]);
      for (const fragment of expectedFragments) {
        expect(tableSql).toContain(fragment);
      }
      for (const fragment of rejectedFragments) {
        expect(tableSql).not.toContain(fragment);
      }
    },
  );
});

const TABLE_FOR_TYPE: Record<RealEstateType, string> = {
  'apt-sale': 'AptSaleTransaction',
  'apt-rent': 'AptRentTransaction',
  'villa-sale': 'VillaSaleTransaction',
  'villa-rent': 'VillaRentTransaction',
  'offitel-sale': 'OffitelSaleTransaction',
  'offitel-rent': 'OffitelRentTransaction',
};

describe('address-specific detail boundaries', () => {
  beforeEach(() => {
    mockTransaction.mockReset();
    mockQueryRaw.mockReset();
    mockTransaction.mockImplementation(async (callback) => callback({ $queryRaw: mockQueryRaw }));
  });

  it('scopes area/deposit options, chart, total and first page to one parcel', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ dongName: '역삼동', jibun: '785-10' }]);
    enqueueSnapshotRows();
    const result = await getDetailSnapshot('villa-rent', {
      bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: 'a'.repeat(64),
      mode: 'wolse', months: 6, area: '84.90', deposit: 0,
    }, new Date('2026-09-21T03:00:00Z'));
    expect(result.filters).toMatchObject({ dongName: '역삼동', jibun: '785-10', buildingKey: 'a'.repeat(64) });
    for (const [query] of mockQueryRaw.mock.calls.slice(1)) {
      expect(sqlValues(query)).toContain('역삼동');
      expect(sqlValues(query)).toContain('785-10');
    }
  });

  it('preserves the parcel filter when paging through transactions', async () => {
    mockQueryRaw.mockResolvedValueOnce([{ dongName: '대치동', jibun: '934-2' }])
      .mockResolvedValueOnce([{ total: 21n }]).mockResolvedValueOnce([]);
    const result = await getDetailPage('villa-sale', {
      bjdCode: '11680', buildingName: '스톤빌리지', buildingKey: 'b'.repeat(64),
      mode: 'sale', months: 6, area: '84.90', page: 2,
    }, new Date('2026-09-21T03:00:00Z'));
    expect(result.page).toBe(2);
    for (const [query] of mockQueryRaw.mock.calls.slice(1)) {
      expect(sqlValues(query)).toContain('대치동');
      expect(sqlValues(query)).toContain('934-2');
    }
  });

  it('keeps deferred legacy grouped details unfiltered by parcel', async () => {
    mockGetBuildingInfo.mockResolvedValueOnce({
      bjdCode: '11680',
      buildingName: '스톤빌리지',
      canonicalPath: `/real-estate/villa-sale/seoul/gangnam/${encodeURIComponent('스톤빌리지')}`,
      legacyGrouped: true,
      regionMatched: true,
    });
    enqueueSnapshotRows();

    const result = await getDetailSnapshot('villa-rent', {
      bjdCode: '11680',
      buildingName: '스톤빌리지',
      mode: 'wolse',
      months: 6,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(result.filters).toMatchObject({
      bjdCode: '11680',
      buildingName: '스톤빌리지',
      legacyGrouped: true,
    });
    expect(result.filters.buildingKey).toBeUndefined();
    for (const [query] of mockQueryRaw.mock.calls) {
      expect(sqlText(query)).not.toContain('TRIM(t.dongName)');
      expect(sqlText(query)).not.toContain('TRIM(s.dongName)');
      expect(sqlText(query)).not.toContain('TRIM(r.dongName)');
    }
  });
});

it('rejects keyless mixed-address snapshots instead of merging their transactions', async () => {
  mockGetBuildingInfo.mockResolvedValue(null);
  await expect(getDetailSnapshot('villa-sale', { bjdCode: '11680', buildingName: '스톤빌리지', mode: 'sale', months: 6 }))
    .rejects.toMatchObject({ statusCode: 404 });
});
