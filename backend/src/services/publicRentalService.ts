// LH myhome 공공임대 단지 카탈로그 서비스 (PublicRentalComplex 테이블)

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import {
  CITY_SLUG_TO_FULL,
  CITY_SLUG_TO_SHORT,
  SHORT_TO_SLUG,
  FULL_TO_SLUG,
} from './cityMapping.js';
import { computeStatus, todayInKst } from './publicRentalAnnouncementService.js';
import type { PublicRentalListQuery } from '../schemas/publicRental.js';
import type { Prisma, PublicRentalComplex } from '@prisma/client';

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

type ActiveStatus = 'ongoing' | 'upcoming';

interface AnnouncementMatchMaps {
  pnu: Map<string, ActiveStatus>;
  nameKey: Map<string, ActiveStatus>;
}

/**
 * 활성(ongoing/upcoming) 모집공고를 한 번 가져와서 PNU/이름 매칭 맵으로 빌드.
 * 공고 데이터는 수백건 수준이라 인메모리 매칭이 합리적.
 * 우선순위: ongoing > upcoming.
 */
async function buildActiveAnnouncementMaps(): Promise<AnnouncementMatchMaps> {
  const today = todayInKst();
  const rows = await prisma.publicRentalAnnouncement.findMany({
    where: {
      OR: [
        { endDe: null },
        { endDe: { gte: today } },
      ],
    },
    select: {
      pnu: true, hsmpNm: true, brtcNm: true, signguNm: true, beginDe: true, endDe: true,
    },
  });

  const pnu = new Map<string, ActiveStatus>();
  const nameKey = new Map<string, ActiveStatus>();
  const promote = (cur: ActiveStatus | undefined, next: ActiveStatus): ActiveStatus =>
    cur === 'ongoing' || next === 'ongoing' ? 'ongoing' : 'upcoming';

  for (const r of rows) {
    const status = computeStatus(r.beginDe, r.endDe, today);
    if (status !== 'ongoing' && status !== 'upcoming') continue;
    if (r.pnu) pnu.set(r.pnu, promote(pnu.get(r.pnu), status));
    if (r.hsmpNm && r.brtcNm && r.signguNm) {
      const key = `${r.brtcNm}|${r.signguNm}|${r.hsmpNm}`;
      nameKey.set(key, promote(nameKey.get(key), status));
    }
  }
  return { pnu, nameKey };
}

function decorateAnnouncementStatus(
  row: { pnu: string | null; complexNameKor: string | null; city: string; district: string },
  maps: AnnouncementMatchMaps,
): ActiveStatus | null {
  if (row.pnu) {
    const byPnu = maps.pnu.get(row.pnu);
    if (byPnu) return byPnu;
  }
  const name = row.complexNameKor;
  if (name && row.city && row.district) {
    const byName = maps.nameKey.get(`${row.city}|${row.district}|${name}`);
    if (byName) return byName;
  }
  return null;
}

/**
 * 현재 필터에 해당하는 단지 중 활성 공고와 매칭되는 complexCode 목록을 반환.
 * 정렬: ongoing → upcoming → city/district/name ASC.
 */
async function getMatchedComplexCodesOrdered(
  baseWhere: Prisma.PublicRentalComplexWhereInput,
  maps: AnnouncementMatchMaps,
): Promise<string[]> {
  const pnuList = [...maps.pnu.keys()];
  const nameKeys = [...maps.nameKey.keys()];
  const orClauses: Prisma.PublicRentalComplexWhereInput[] = [];
  if (pnuList.length > 0) orClauses.push({ pnu: { in: pnuList } });
  for (const key of nameKeys) {
    const [c, d, n] = key.split('|');
    if (c && d && n) orClauses.push({ city: c, district: d, complexNameKor: n });
  }
  if (orClauses.length === 0) return [];

  const matched = await prisma.publicRentalComplex.findMany({
    where: { AND: [baseWhere, { OR: orClauses }] },
    select: { complexCode: true, pnu: true, complexNameKor: true, city: true, district: true, complexName: true },
    distinct: ['complexCode'],
  });

  const order: Record<string, number> = { ongoing: 0, upcoming: 1 };
  const decorated = matched.map((r) => ({
    code: r.complexCode,
    status: decorateAnnouncementStatus(r, maps),
    sortKey: `${r.city}|${r.district}|${r.complexName}`,
  }));
  decorated.sort((a, b) => {
    const ap = order[a.status ?? ''] ?? 9;
    const bp = order[b.status ?? ''] ?? 9;
    if (ap !== bp) return ap - bp;
    return a.sortKey < b.sortKey ? -1 : a.sortKey > b.sortKey ? 1 : 0;
  });
  return decorated.map((d) => d.code);
}

export async function getPublicRentalList(params: PublicRentalListQuery) {
  const where = buildWhere(params);
  const skip = (params.page - 1) * params.limit;

  const [groups, maps] = await Promise.all([
    prisma.publicRentalComplex.groupBy({ by: ['complexCode'], where }),
    buildActiveAnnouncementMaps(),
  ]);
  const total = groups.length;

  // 매칭된 complexCode 를 위쪽으로 우선 노출. 없으면 기본 정렬만.
  const matchedCodes = await getMatchedComplexCodesOrdered(where, maps);
  const matchedTotal = matchedCodes.length;

  const rows: PublicRentalComplex[] = [];

  if (skip < matchedTotal) {
    // 1) 매칭된 단지부터 채우기
    const codesPage = matchedCodes.slice(skip, skip + params.limit);
    if (codesPage.length > 0) {
      const matchedRows = await prisma.publicRentalComplex.findMany({
        where: { AND: [where, { complexCode: { in: codesPage } }] },
        distinct: ['complexCode'],
      });
      // codesPage 순서대로 정렬
      const idx: Record<string, number> = {};
      codesPage.forEach((c, i) => { idx[c] = i; });
      matchedRows.sort((a, b) => (idx[a.complexCode] ?? 0) - (idx[b.complexCode] ?? 0));
      rows.push(...matchedRows);
    }
  }

  if (rows.length < params.limit) {
    const need = params.limit - rows.length;
    const unmatchedSkip = Math.max(0, skip - matchedTotal);
    const unmatchedRows = await prisma.publicRentalComplex.findMany({
      where: matchedTotal > 0
        ? { AND: [where, { complexCode: { notIn: matchedCodes } }] }
        : where,
      distinct: ['complexCode'],
      orderBy: [{ city: 'asc' }, { district: 'asc' }, { complexName: 'asc' }],
      skip: unmatchedSkip,
      take: need,
    });
    rows.push(...unmatchedRows);
  }

  return {
    items: rows.map((row) => ({
      ...serializePublicRentalRow(row),
      announcementStatus: decorateAnnouncementStatus(row, maps),
    })),
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
  const maps = await buildActiveAnnouncementMaps();
  return {
    ...serializePublicRentalRow(row),
    announcementStatus: decorateAnnouncementStatus(row, maps),
  };
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
