import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    publicRentalComplex: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
  prisma: {
    publicRentalComplex: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
  },
}));

import prisma from '../../src/lib/prisma.js';
import {
  getPublicRentalList,
  getPublicRentalDetail,
  getPublicRentalStats,
  getPublicRentalSiblings,
  getPublicRentalNearby,
  serializePublicRentalRow,
} from '../../src/services/publicRentalService.js';
import { NotFoundError } from '../../src/lib/errors.js';

const mocked = prisma as unknown as {
  publicRentalComplex: {
    findMany: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    count: ReturnType<typeof vi.fn>;
    groupBy: ReturnType<typeof vi.fn>;
  };
};

beforeEach(() => {
  vi.clearAllMocks();
});

class FakeDecimal {
  value: number;
  constructor(v: number) {
    this.value = v;
  }
  toNumber() {
    return this.value;
  }
  valueOf() {
    return this.value;
  }
}
// Make constructor.name === 'Decimal' for serializeRow detection
Object.defineProperty(FakeDecimal, 'name', { value: 'Decimal' });

describe('serializePublicRentalRow', () => {
  it('converts BigInt to Number and Decimal to Number', () => {
    const row = {
      id: 1,
      depositAmount: 80000000n,
      exclusiveArea: new FakeDecimal(59.96),
      city: '서울특별시',
    };
    const out = serializePublicRentalRow(row);
    expect(out.depositAmount).toBe(80000000);
    expect(typeof out.depositAmount).toBe('number');
    expect(out.exclusiveArea).toBe(59.96);
  });

  it('returns falsy values unchanged', () => {
    expect(serializePublicRentalRow(null)).toBeNull();
    expect(serializePublicRentalRow(undefined)).toBeUndefined();
  });
});

describe('getPublicRentalList', () => {
  it('returns paginated rows with default page/limit', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([
      { id: 1, complexCode: 'a', complexName: 'A', city: '서울특별시', district: '강남구', rentalType: '매입임대', depositAmount: 50000000n, monthlyRent: 200000 },
    ]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue([{ complexCode: 'a' }]);

    const result = await getPublicRentalList({ page: 1, limit: 20 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].depositAmount).toBe(50000000);
    expect(result.pagination).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
  });

  it('findMany에 distinct complexCode 포함', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue([]);

    await getPublicRentalList({ page: 1, limit: 20 });
    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.distinct).toEqual(['complexCode']);
  });

  it('maps city slug to variant array (서울특별시 + 서울)', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue([]);

    await getPublicRentalList({ page: 1, limit: 20, city: 'seoul' });
    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.where.city).toEqual({ in: ['서울특별시', '서울'] });
  });

  it('applies rentalType filter', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue([]);

    await getPublicRentalList({ page: 1, limit: 20, rentalType: '전세임대' });
    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.where.rentalType).toBe('전세임대');
  });

  it('applies deposit range filter as BigInt', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue([]);

    await getPublicRentalList({ page: 1, limit: 20, depositMin: 10000000, depositMax: 100000000 });
    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.where.depositAmount.gte).toBe(BigInt(10000000));
    expect(call.where.depositAmount.lte).toBe(BigInt(100000000));
  });

  it('applies monthlyRent range filter', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue([]);

    await getPublicRentalList({ page: 1, limit: 20, monthlyRentMin: 100000, monthlyRentMax: 500000 });
    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.where.monthlyRent).toEqual({ gte: 100000, lte: 500000 });
  });

  it('paginates with skip computed from (page-1)*limit', async () => {
    mocked.publicRentalComplex.findMany.mockResolvedValue([]);
    mocked.publicRentalComplex.groupBy.mockResolvedValue(Array.from({ length: 60 }, (_, i) => ({ complexCode: String(i) })));

    const result = await getPublicRentalList({ page: 3, limit: 20 });
    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.skip).toBe(40);
    expect(call.take).toBe(20);
    expect(result.pagination.totalPages).toBe(3);
  });
});

describe('getPublicRentalDetail', () => {
  it('returns detail with BigInt → Number serialization', async () => {
    mocked.publicRentalComplex.findUnique.mockResolvedValue({
      id: 5,
      complexName: '강남 매입임대 1단지',
      depositAmount: 120000000n,
      monthlyRent: 350000,
    });
    const detail = await getPublicRentalDetail(5);
    expect(detail.depositAmount).toBe(120000000);
    expect(detail.id).toBe(5);
  });

  it('throws NotFoundError when id missing', async () => {
    mocked.publicRentalComplex.findUnique.mockResolvedValue(null);
    await expect(getPublicRentalDetail(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getPublicRentalSiblings', () => {
  it('returns rows sharing complexCode but excludes self id', async () => {
    mocked.publicRentalComplex.findUnique.mockResolvedValue({ complexCode: 'abc' });
    mocked.publicRentalComplex.findMany.mockResolvedValue([
      { id: 2, complexCode: 'abc', exclusiveArea: new FakeDecimal(39.6), depositAmount: 50000000n },
      { id: 3, complexCode: 'abc', exclusiveArea: new FakeDecimal(59.8), depositAmount: 80000000n },
    ]);

    const rows = await getPublicRentalSiblings(1);
    expect(rows).toHaveLength(2);
    expect(rows[0].depositAmount).toBe(50000000);

    const findManyCall = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(findManyCall.where.complexCode).toBe('abc');
    expect(findManyCall.where.NOT).toEqual({ id: 1 });
  });

  it('throws NotFoundError when base id missing', async () => {
    mocked.publicRentalComplex.findUnique.mockResolvedValue(null);
    await expect(getPublicRentalSiblings(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getPublicRentalNearby', () => {
  it('returns same-district complexes excluding base complexCode (city variant matching)', async () => {
    mocked.publicRentalComplex.findUnique.mockResolvedValue({
      complexCode: 'abc',
      city: '서울특별시',
      district: '강남구',
    });
    mocked.publicRentalComplex.findMany.mockResolvedValue([
      { id: 10, complexCode: 'xyz', complexName: '강남 매입임대 2단지', depositAmount: 80000000n },
    ]);

    const rows = await getPublicRentalNearby(1);
    expect(rows).toHaveLength(1);

    const call = mocked.publicRentalComplex.findMany.mock.calls[0][0];
    expect(call.where.city).toEqual({ in: ['서울특별시', '서울'] });
    expect(call.where.district).toBe('강남구');
    expect(call.where.NOT).toEqual({ complexCode: 'abc' });
    expect(call.distinct).toEqual(['complexCode']);
  });

  it('throws NotFoundError when base id missing', async () => {
    mocked.publicRentalComplex.findUnique.mockResolvedValue(null);
    await expect(getPublicRentalNearby(999)).rejects.toBeInstanceOf(NotFoundError);
  });
});

describe('getPublicRentalStats', () => {
  it('returns rentalType counts', async () => {
    mocked.publicRentalComplex.groupBy.mockResolvedValue([
      { rentalType: '매입임대', _count: { _all: 120 } },
      { rentalType: '전세임대', _count: { _all: 80 } },
    ]);
    const stats = await getPublicRentalStats();
    expect(stats).toEqual([
      { rentalType: '매입임대', count: 120 },
      { rentalType: '전세임대', count: 80 },
    ]);
  });
});
