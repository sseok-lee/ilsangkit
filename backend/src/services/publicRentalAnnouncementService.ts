// 마이홈 공공임대 입주자 모집공고 서비스
//
// PublicRentalAnnouncement 테이블을 조회하면서:
//   - 오늘 날짜 기준 status (ongoing / upcoming / closed / unknown) 계산
//   - 상세 조회 시 PNU로 PublicRentalComplex 와 조인하여 단지 카드 노출
//
// PNU 가 없는 공고는 hsmpNm + 시/시군구 fuzzy 매칭으로 fallback.

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import {
  CITY_SLUG_TO_FULL,
  CITY_SLUG_TO_SHORT,
} from './cityMapping.js';
import { serializePublicRentalRow } from './publicRentalService.js';
import type {
  PublicRentalAnnouncementListQuery,
} from '../schemas/publicRentalAnnouncement.js';
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

function applyStatusFilter(
  rows: PublicRentalAnnouncement[],
  status: AnnouncementStatus | undefined,
  today: string,
): Array<PublicRentalAnnouncement & { status: AnnouncementStatus }> {
  const decorated = rows.map((r) => ({ ...r, status: computeStatus(r.beginDe, r.endDe, today) }));
  if (!status) return decorated;
  return decorated.filter((r) => r.status === status);
}

export async function listAnnouncements(params: PublicRentalAnnouncementListQuery) {
  const where = buildWhere(params);
  const today = todayInKst();
  // 정렬: 진행중 → 예정 → 마감 (status 정렬은 메모리에서). DB에서는 endDe DESC 로 가져와 최신부터.
  const rawRows = await prisma.publicRentalAnnouncement.findMany({
    where,
    orderBy: [{ endDe: 'desc' }, { rcritPblancDe: 'desc' }, { id: 'desc' }],
    take: 1000, // status 필터 후 페이지네이션이므로 합리적 상한
  });

  const decorated = applyStatusFilter(rawRows, params.status, today);
  // status 별 정렬: ongoing(0) < upcoming(1) < closed(2) < unknown(3)
  const order: Record<AnnouncementStatus, number> = { ongoing: 0, upcoming: 1, closed: 2, unknown: 3 };
  decorated.sort((a, b) => {
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    if (a.endDe && b.endDe) return a.endDe < b.endDe ? 1 : -1;
    return 0;
  });

  const total = decorated.length;
  const skip = (params.page - 1) * params.limit;
  const items = decorated.slice(skip, skip + params.limit);

  return {
    items: items.map(serializeAnnouncement),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getAnnouncement(pblancId: string) {
  const row = await prisma.publicRentalAnnouncement.findUnique({ where: { pblancId } });
  if (!row) throw new NotFoundError(`PublicRentalAnnouncement ${pblancId} not found`);
  const status = computeStatus(row.beginDe, row.endDe);

  // PNU 우선 매칭 → 빈 경우 hsmpNm + 시/시군구 fallback
  const matchedComplexes = await findMatchingComplexes(row);

  return {
    ...serializeAnnouncement({ ...row, status }),
    matchedComplexes: matchedComplexes.map(serializePublicRentalRow),
  };
}

async function findMatchingComplexes(row: PublicRentalAnnouncement) {
  if (row.pnu) {
    const byPnu = await prisma.publicRentalComplex.findMany({
      where: { pnu: row.pnu },
      orderBy: [{ rentalType: 'asc' }, { exclusiveArea: 'asc' }],
      take: 24,
    });
    if (byPnu.length > 0) return byPnu;
  }
  if (row.hsmpNm && row.brtcNm && row.signguNm) {
    return prisma.publicRentalComplex.findMany({
      where: {
        complexNameKor: { contains: row.hsmpNm },
        city: row.brtcNm,
        district: row.signguNm,
      },
      orderBy: [{ rentalType: 'asc' }, { exclusiveArea: 'asc' }],
      take: 24,
    });
  }
  return [];
}

function serializeAnnouncement(
  row: (PublicRentalAnnouncement & { status?: AnnouncementStatus }),
): Record<string, unknown> {
  const status = row.status ?? computeStatus(row.beginDe, row.endDe);
  return {
    id: row.id,
    pblancId: row.pblancId,
    pblancNo: row.pblancNo,
    pblancNm: row.pblancNm,
    source: row.source,
    suplyInsttNm: row.suplyInsttNm,
    suplyTyNm: row.suplyTyNm,
    brtcNm: row.brtcNm,
    signguNm: row.signguNm,
    hsmpNm: row.hsmpNm,
    pnu: row.pnu,
    rcritPblancDe: row.rcritPblancDe,
    beginDe: row.beginDe,
    endDe: row.endDe,
    totSplyHshldco: row.totSplyHshldco,
    url: row.url,
    status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * 사이트맵용 — 진행중 + 30일 이내 마감 공고만 노출.
 * 마감된 지 오래된 공고는 색인 대상에서 제외.
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
    take: 5000,
  });
  return rows.map((r) => ({
    pblancId: r.pblancId,
    updatedAt: r.updatedAt,
    status: computeStatus(r.beginDe, r.endDe, today),
  }));
}
