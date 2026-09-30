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

function enqueueSnapshotRows(): void {
  mockQueryRaw
    .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.91') }, { area: new Prisma.Decimal('84.90') }])
    .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
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
      { id: 1, date: '2026-09-12', area: '84.90', floor: 0, amount: 120, deposit: 0 },
      { id: 2, date: '2026-09-13', area: '84.90', floor: null, amount: 130, deposit: null },
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

  it.each(TYPES)('uses the allowlisted table and exact identity/area for %s', async (type) => {
    const mode = type.endsWith('-sale') ? 'sale' : 'jeonse';
    mockQueryRaw
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    await getDetailSnapshot(type, {
      bjdCode: '11680',
      buildingName: 'A',
      mode,
      months: 6,
      area: '84.9',
    }, new Date('2026-09-21T03:00:00Z'));

    const areaSql = sqlText(mockQueryRaw.mock.calls[0][0]);
    const pointsSql = sqlText(mockQueryRaw.mock.calls[3][0]);
    const pointsValues = sqlValues(mockQueryRaw.mock.calls[3][0]);

    expect(areaSql).toContain(`FROM ${TABLE_FOR_TYPE[type]} t`);
    expect(areaSql).toContain('SELECT DISTINCT t.exclusiveArea AS area');
    expect(areaSql).toContain('ORDER BY area ASC');
    expect(areaSql).not.toContain('SELECT DISTINCT CAST(t.exclusiveArea AS CHAR) AS area');
    expect(pointsSql).toContain('t.bjdCode = ?');
    expect(pointsSql).toContain('t.buildingName = ?');
    expect(pointsSql).toContain('t.exclusiveArea = ?');
    expect(pointsSql).toContain('STR_TO_DATE');
    expect(pointsValues).toContain('11680');
    expect(pointsValues).toContain('A');
    expect(pointsValues.some((value) => value instanceof Prisma.Decimal && value.toFixed(2) === '84.90')).toBe(true);
  });

  it('excludes sale cancellation signals using both cancel fields', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([])
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

    const sql = sqlText(mockQueryRaw.mock.calls[3][0]);
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
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
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
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
    const issuedSql = mockQueryRaw.mock.calls.map((call) => sqlText(call[0])).join('\n');
    expect(issuedSql).not.toContain('t.deposit = ?');
  });

  it('resets invalid requested area A2/84.91 to the latest valid 84.90 area', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ amount: 0n, count: 1n }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: 0n }])
      .mockResolvedValueOnce([]);

    const snapshot = await getDetailSnapshot('apt-rent', {
      bjdCode: '11680',
      buildingName: 'A2',
      mode: 'wolse',
      months: 6,
      area: '84.91',
      deposit: 0,
    }, new Date('2026-09-21T03:00:00Z'));

    expect(snapshot.filters.buildingName).toBe('A2');
    expect(snapshot.filters.area).toBe('84.90');
    expect(snapshot.adjustment).toBe('area-reset');
  });

  it('months=0 uses the earliest retained exact-filter deal date instead of a 36-month cap', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
      .mockResolvedValueOnce([{ area: new Prisma.Decimal('84.90') }])
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

    const retainedWindowSql = sqlText(mockQueryRaw.mock.calls[2][0]);
    expect(retainedWindowSql).toContain('MIN(');
    expect(retainedWindowSql).toContain('t.exclusiveArea = ?');

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
    expect(sqlValues(mockQueryRaw.mock.calls[1][0]).slice(-2)).toEqual([20, 20]);
    expect(page).toMatchObject({ total: 21, page: 2, totalPages: 2 });
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
