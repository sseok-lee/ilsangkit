import { Prisma } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import gaepo from '../fixtures/kaptFeeGaepo.json';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));
vi.mock('../../src/lib/prisma.js', () => {
  const prisma = { $queryRaw: mockQueryRaw };
  return { prisma, default: prisma };
});

import { loadMaintenanceFee } from '../../src/services/kaptFeeLoader.js';

const sqlText = (query: unknown): string => (query as Prisma.Sql).strings.join('?');

interface Fixture {
  baseMonth: string | null;
  complex: Record<string, unknown> | null;
  median: Record<string, unknown> | null;
}

/** MySQL BIGINT 는 $queryRaw 에서 BigInt 로 온다 */
const asBigInt = (row: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(row).map(([k, v]) => [k, typeof v === 'number' ? BigInt(v) : v]));

function mockDb({ baseMonth, complex, median }: Fixture) {
  mockQueryRaw.mockImplementation(async (query: unknown) => {
    const sql = sqlText(query);
    if (sql.includes('MAX(yearMonth)')) return [{ yearMonth: baseMonth }];
    if (sql.includes('FROM KaptComplex ')) return complex ? [complex] : [];
    if (sql.includes('medianCommonPerM2')) return median ? [median] : [];
    if (sql.includes('FROM KaptMaintenanceFee')) return gaepo.rows.map(asBigInt);
    throw new Error(`unexpected query: ${sql}`);
  });
}

const COMPLEX_ROW = {
  householdCount: 2296,
  managementArea: '244894.45',
  raw: JSON.stringify({ '관리사무소 연락처': '02-575-1234', '관리사무소 주소': '서울특별시 강남구 개포로109길 9', 단지코드: 'A10024564' }),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('loadMaintenanceFee', () => {
  it('기준 월·단지·시군구 중간값·최근 24개월 행으로 요약을 만든다 (BigInt 없이)', async () => {
    mockDb({ baseMonth: '202608', complex: COMPLEX_ROW, median: { medianCommonPerM2: 1527, complexCount: 178n } });
    const fee = await loadMaintenanceFee('A10024564');

    expect(fee?.total).toBe(444578);
    expect(fee?.commonPerM2).toEqual({ complex: 1626, sggMedian: 1527, sggComplexCount: 178 });
    expect(fee?.office).toEqual({ phone: '02-575-1234', address: '서울특별시 강남구 개포로109길 9' });
    expect(() => JSON.stringify(fee)).not.toThrow();

    const feeQuery = mockQueryRaw.mock.calls.map((c) => c[0] as Prisma.Sql).find((q) => sqlText(q).includes('FROM KaptMaintenanceFee'))!;
    expect(feeQuery.values).toEqual(['A10024564', '202409']);
  });

  it('관리사무소 값이 비어 있거나 raw 가 객체여도 읽는다', async () => {
    mockDb({
      baseMonth: '202608',
      complex: { ...COMPLEX_ROW, raw: { '관리사무소 연락처': ' ', '관리사무소 주소': '서울' } },
      median: null,
    });
    const fee = await loadMaintenanceFee('A10024564');
    expect(fee?.office).toEqual({ phone: null, address: '서울' });
    expect(fee?.commonPerM2).toBeNull();
  });

  it('기준 월이 없으면(중간값 미계산) null', async () => {
    mockDb({ baseMonth: null, complex: COMPLEX_ROW, median: null });
    expect(await loadMaintenanceFee('A10024564')).toBeNull();
  });

  it('활성 단지가 없으면 null', async () => {
    mockDb({ baseMonth: '202608', complex: null, median: null });
    expect(await loadMaintenanceFee('A10024564')).toBeNull();
  });
});
