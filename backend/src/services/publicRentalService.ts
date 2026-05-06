// LH myhome 공공임대 단지 카탈로그 서비스 (PublicRentalComplex 테이블)

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import {
  CITY_SLUG_TO_FULL,
  CITY_SLUG_TO_SHORT,
  SHORT_TO_SLUG,
  FULL_TO_SLUG,
} from './cityMapping.js';
import type { PublicRentalListQuery } from '../schemas/publicRental.js';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializePublicRentalRow(row: any): any {
  if (!row) return row;
  const result = { ...row };
  for (const key of Object.keys(result)) {
    const value = result[key];
    if (value === null || value === undefined) continue;
    if (typeof value === 'bigint') {
      result[key] = Number(value);
    } else if (typeof value === 'object' && value.constructor && value.constructor.name === 'Decimal') {
      result[key] = Number(value);
    }
  }
  return result;
}

function resolveCityVariants(input?: string): string[] | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const slug = trimmed.toLowerCase();
  const full = CITY_SLUG_TO_FULL[slug];
  const short = CITY_SLUG_TO_SHORT[slug];
  if (full || short) {
    return [full, short].filter((v): v is string => Boolean(v));
  }
  return [trimmed];
}

function buildWhere(params: PublicRentalListQuery): Prisma.PublicRentalComplexWhereInput {
  const where: Prisma.PublicRentalComplexWhereInput = {};
  const cityVariants = resolveCityVariants(params.city);
  if (cityVariants) {
    where.city = cityVariants.length > 1 ? { in: cityVariants } : cityVariants[0];
  }
  if (params.district) where.district = params.district;
  if (params.rentalType) where.rentalType = params.rentalType;

  const depositMin = params.depositMin;
  const depositMax = params.depositMax;
  if (depositMin !== undefined || depositMax !== undefined) {
    where.depositAmount = {};
    if (depositMin !== undefined) (where.depositAmount as Prisma.BigIntNullableFilter).gte = BigInt(depositMin);
    if (depositMax !== undefined) (where.depositAmount as Prisma.BigIntNullableFilter).lte = BigInt(depositMax);
  }

  const rentMin = params.monthlyRentMin;
  const rentMax = params.monthlyRentMax;
  if (rentMin !== undefined || rentMax !== undefined) {
    where.monthlyRent = {};
    if (rentMin !== undefined) (where.monthlyRent as Prisma.IntNullableFilter).gte = rentMin;
    if (rentMax !== undefined) (where.monthlyRent as Prisma.IntNullableFilter).lte = rentMax;
  }

  return where;
}

export async function getPublicRentalList(params: PublicRentalListQuery) {
  const where = buildWhere(params);
  const skip = (params.page - 1) * params.limit;

  const [rows, groups] = await Promise.all([
    prisma.publicRentalComplex.findMany({
      where,
      distinct: ['complexCode'],
      orderBy: [{ city: 'asc' }, { district: 'asc' }, { complexName: 'asc' }],
      skip,
      take: params.limit,
    }),
    prisma.publicRentalComplex.groupBy({ by: ['complexCode'], where }),
  ]);

  const total = groups.length;

  return {
    items: rows.map(serializePublicRentalRow),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getPublicRentalDetail(id: number) {
  const row = await prisma.publicRentalComplex.findUnique({ where: { id } });
  if (!row) throw new NotFoundError(`PublicRentalComplex ${id} not found`);
  return serializePublicRentalRow(row);
}

export async function getPublicRentalSiblings(id: number) {
  const base = await prisma.publicRentalComplex.findUnique({
    where: { id },
    select: { complexCode: true },
  });
  if (!base) throw new NotFoundError(`PublicRentalComplex ${id} not found`);

  const rows = await prisma.publicRentalComplex.findMany({
    where: {
      complexCode: base.complexCode,
      NOT: { id },
    },
    orderBy: [{ rentalType: 'asc' }, { exclusiveArea: 'asc' }],
    take: 12,
  });

  return rows.map(serializePublicRentalRow);
}

export async function getPublicRentalNearby(id: number, limit = 6) {
  const base = await prisma.publicRentalComplex.findUnique({
    where: { id },
    select: { city: true, district: true, complexCode: true },
  });
  if (!base) throw new NotFoundError(`PublicRentalComplex ${id} not found`);

  const slug = SHORT_TO_SLUG[base.city] ?? FULL_TO_SLUG[base.city];
  const cityVariants = slug
    ? Array.from(
        new Set(
          [base.city, CITY_SLUG_TO_FULL[slug], CITY_SLUG_TO_SHORT[slug]].filter(
            (v): v is string => Boolean(v),
          ),
        ),
      )
    : [base.city];

  const rows = await prisma.publicRentalComplex.findMany({
    where: {
      city: cityVariants.length > 1 ? { in: cityVariants } : cityVariants[0],
      district: base.district,
      NOT: { complexCode: base.complexCode },
    },
    distinct: ['complexCode'],
    orderBy: [{ complexName: 'asc' }],
    take: limit,
  });

  return rows.map(serializePublicRentalRow);
}

export async function getPublicRentalStats() {
  const grouped = await prisma.publicRentalComplex.groupBy({
    by: ['rentalType'],
    _count: { _all: true },
  });
  return grouped.map((g) => ({
    rentalType: g.rentalType,
    count: g._count._all,
  }));
}
