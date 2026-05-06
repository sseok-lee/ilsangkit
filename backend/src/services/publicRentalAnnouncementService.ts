// 마이홈 공공임대 입주자 모집공고 서비스
//
// 한 공고(pblancId) 안에 여러 호수(houseSn) 행이 들어 있어:
//   - 목록: pblancId 기준 dedupe 후 카드 하나로 보여줌 (대표 메타 + 합산 호수)
//   - 상세: 해당 pblancId 의 모든 행을 가져와 PNU 합집합으로 단지 카탈로그 조인
//
// status 는 KST 기준 today 와 beginDe/endDe 비교로 계산.

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import {
  CITY_SLUG_TO_FULL,
  CITY_SLUG_TO_SHORT,
} from './cityMapping.js';
import { serializePublicRentalRow } from './publicRentalService.js';
import type { PublicRentalAnnouncementListQuery } from '../schemas/publicRentalAnnouncement.js';
import type { Prisma, PublicRentalAnnouncement } from '@prisma/client';

export type AnnouncementStatus = 'ongoing' | 'upcoming' | 'closed' | 'unknown';

export function todayInKst(now: Date = new Date()): string {
  // KST = UTC+9. now.getTime() 는 호스트 TZ 와 무관하게 UTC epoch ms.
  const kst = new Date(now.getTime() + 9 * 3600 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function computeStatus(
  beginDe: string | null,
  endDe: string | null,
  today: string = todayInKst(),
): AnnouncementStatus {
  if (!beginDe && !endDe) return 'unknown';
  if (beginDe && today < beginDe) return 'upcoming';
  if (endDe && today > endDe) return 'closed';
  return 'ongoing';
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

function buildWhere(
  params: PublicRentalAnnouncementListQuery,
): Prisma.PublicRentalAnnouncementWhereInput {
  const where: Prisma.PublicRentalAnnouncementWhereInput = {};
  const cityVariants = resolveCityVariants(params.city);
  if (cityVariants) {
    where.brtcNm = cityVariants.length > 1 ? { in: cityVariants } : cityVariants[0];
  }
  if (params.district) where.signguNm = params.district;
  if (params.rentalType) where.suplyTyNm = params.rentalType;
  if (params.source) where.source = params.source;
  if (params.q) {
    where.OR = [
      { pblancNm: { contains: params.q } },
      { hsmpNm: { contains: params.q } },
      { suplyInsttNm: { contains: params.q } },
    ];
  }
  return where;
}

interface AggregatedAnnouncement {
  pblancId: string;
  representative: PublicRentalAnnouncement;
  status: AnnouncementStatus;
  variantCount: number;
  totalSupply: number | null;
  pnus: string[];
}

function aggregateByPblancId(
  rows: PublicRentalAnnouncement[],
  today: string,
): AggregatedAnnouncement[] {
  const map = new Map<string, AggregatedAnnouncement>();
  for (const r of rows) {
    let agg = map.get(r.pblancId);
    if (!agg) {
      agg = {
        pblancId: r.pblancId,
        representative: r,
        status: computeStatus(r.beginDe, r.endDe, today),
        variantCount: 0,
        totalSupply: null,
        pnus: [],
      };
      map.set(r.pblancId, agg);
    }
    agg.variantCount += 1;
    if (typeof r.sumSuplyCo === 'number') {
      agg.totalSupply = (agg.totalSupply ?? 0) + r.sumSuplyCo;
    }
    if (r.pnu && !agg.pnus.includes(r.pnu)) agg.pnus.push(r.pnu);
  }
  return [...map.values()];
}

export async function listAnnouncements(params: PublicRentalAnnouncementListQuery) {
  const where = buildWhere(params);
  const today = todayInKst();
  // dedupe 가 메모리에서 일어나므로 충분한 raw 페이지 가져온 뒤 aggregation 후 페이지네이션.
  const rawRows = await prisma.publicRentalAnnouncement.findMany({
    where,
    orderBy: [{ endDe: 'desc' }, { rcritPblancDe: 'desc' }, { id: 'desc' }],
    take: 4000,
  });

  let aggregated = aggregateByPblancId(rawRows, today);
  if (params.status) aggregated = aggregated.filter((a) => a.status === params.status);

  // status 우선순위: ongoing → upcoming → closed → unknown
  const order: Record<AnnouncementStatus, number> = { ongoing: 0, upcoming: 1, closed: 2, unknown: 3 };
  aggregated.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    const ae = a.representative.endDe ?? '';
    const be = b.representative.endDe ?? '';
    return ae < be ? 1 : ae > be ? -1 : 0;
  });

  const total = aggregated.length;
  const skip = (params.page - 1) * params.limit;
  const items = aggregated.slice(skip, skip + params.limit).map(serializeListItem);

  return {
    items,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getAnnouncement(pblancId: string) {
  const rows = await prisma.publicRentalAnnouncement.findMany({
    where: { pblancId },
    orderBy: [{ houseSn: 'asc' }],
  });
  if (rows.length === 0) {
    throw new NotFoundError(`PublicRentalAnnouncement ${pblancId} not found`);
  }
  const today = todayInKst();
  const rep = rows[0];
  const status = computeStatus(rep.beginDe, rep.endDe, today);

  // 모든 호수의 PNU 합집합으로 단지 카탈로그 조인.
  const pnus = Array.from(new Set(rows.map((r) => r.pnu).filter((p): p is string => !!p)));
  const matchedComplexes = await findMatchingComplexes(pnus, rep);

  return {
    ...serializeBase(rep, status),
    variants: rows.map((r) => serializeVariant(r)),
    matchedComplexes: matchedComplexes.map(serializePublicRentalRow),
  };
}

async function findMatchingComplexes(
  pnus: string[],
  rep: PublicRentalAnnouncement,
) {
  if (pnus.length > 0) {
    const byPnu = await prisma.publicRentalComplex.findMany({
      where: { pnu: { in: pnus } },
      orderBy: [{ rentalType: 'asc' }, { exclusiveArea: 'asc' }],
      take: 48,
    });
    if (byPnu.length > 0) return byPnu;
  }
  if (rep.hsmpNm && rep.brtcNm && rep.signguNm) {
    return prisma.publicRentalComplex.findMany({
      where: {
        complexNameKor: { contains: rep.hsmpNm },
        city: rep.brtcNm,
        district: rep.signguNm,
      },
      orderBy: [{ rentalType: 'asc' }, { exclusiveArea: 'asc' }],
      take: 24,
    });
  }
  return [];
}

function serializeBase(row: PublicRentalAnnouncement, status: AnnouncementStatus) {
  return {
    pblancId: row.pblancId,
    pblancNm: row.pblancNm,
    source: row.source,
    sttusNm: row.sttusNm,
    suplyInsttNm: row.suplyInsttNm,
    suplyTyNm: row.suplyTyNm,
    houseTyNm: row.houseTyNm,
    brtcNm: row.brtcNm,
    signguNm: row.signguNm,
    hsmpNm: row.hsmpNm,
    fullAdres: row.fullAdres,
    rcritPblancDe: row.rcritPblancDe,
    beginDe: row.beginDe,
    endDe: row.endDe,
    przwnerDe: row.przwnerDe,
    refrnc: row.refrnc,
    url: row.url,
    pcUrl: row.pcUrl,
    mobileUrl: row.mobileUrl,
    status,
    updatedAt: row.updatedAt,
  };
}

function serializeVariant(row: PublicRentalAnnouncement) {
  return {
    houseSn: row.houseSn,
    hsmpNm: row.hsmpNm,
    pnu: row.pnu,
    fullAdres: row.fullAdres,
    suplyTyNm: row.suplyTyNm,
    houseTyNm: row.houseTyNm,
    sumSuplyCo: row.sumSuplyCo,
    totHshldCo: row.totHshldCo,
    rentGtn: row.rentGtn !== null ? Number(row.rentGtn) : null,
    enty: row.enty !== null ? Number(row.enty) : null,
    prtpay: row.prtpay !== null ? Number(row.prtpay) : null,
    surlus: row.surlus !== null ? Number(row.surlus) : null,
    mtRntchrg: row.mtRntchrg,
    heatMthdNm: row.heatMthdNm,
  };
}

function serializeListItem(agg: AggregatedAnnouncement) {
  const r = agg.representative;
  return {
    pblancId: agg.pblancId,
    pblancNm: r.pblancNm,
    source: r.source,
    suplyInsttNm: r.suplyInsttNm,
    suplyTyNm: r.suplyTyNm,
    houseTyNm: r.houseTyNm,
    brtcNm: r.brtcNm,
    signguNm: r.signguNm,
    hsmpNm: r.hsmpNm,
    rcritPblancDe: r.rcritPblancDe,
    beginDe: r.beginDe,
    endDe: r.endDe,
    totalSupply: agg.totalSupply,
    variantCount: agg.variantCount,
    status: agg.status,
    pcUrl: r.pcUrl,
    url: r.url,
  };
}

/**
 * 사이트맵용 — 진행중 + 30일 이내 마감 공고 (pblancId 단위 dedup).
 */
export async function listAnnouncementsForSitemap() {
  const today = todayInKst();
  const cutoff = (() => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const rows = await prisma.publicRentalAnnouncement.findMany({
    where: {
      OR: [{ endDe: null }, { endDe: { gte: cutoff } }],
    },
    select: { pblancId: true, updatedAt: true, endDe: true, beginDe: true },
    orderBy: [{ endDe: 'desc' }, { id: 'desc' }],
    take: 10000,
  });

  const seen = new Set<string>();
  const dedup: Array<{ pblancId: string; updatedAt: Date; status: AnnouncementStatus }> = [];
  for (const r of rows) {
    if (seen.has(r.pblancId)) continue;
    seen.add(r.pblancId);
    dedup.push({
      pblancId: r.pblancId,
      updatedAt: r.updatedAt,
      status: computeStatus(r.beginDe, r.endDe, today),
    });
  }
  return dedup;
}
