// LH 공고 (분양/임대) 서비스 — list / detail

import prisma from '../lib/prisma.js';
import { NotFoundError } from '../lib/errors.js';
import type { LhAnnouncementListQuery } from '../schemas/lhAnnouncement.js';
import type { Prisma } from '@prisma/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeLhRow(row: any): any {
  if (!row) return row;
  if (Array.isArray(row)) return row.map(serializeLhRow);
  if (row instanceof Date) return row;
  if (typeof row === 'bigint') return Number(row);
  if (typeof row === 'object' && row !== null) {
    if (row.constructor && row.constructor.name === 'Decimal') {
      return Number(row);
    }
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      result[key] = serializeLhRow(value);
    }
    return result;
  }
  return row;
}

function buildWhere(params: LhAnnouncementListQuery): Prisma.LhAnnouncementWhereInput {
  const where: Prisma.LhAnnouncementWhereInput = {};
  if (params.uppAisTpCd) where.uppAisTpCd = params.uppAisTpCd;
  if (params.aisTpCd) where.aisTpCd = params.aisTpCd;
  if (params.cnpNm) where.cnpNm = { contains: params.cnpNm };
  if (params.panSs) where.panSs = params.panSs;
  return where;
}

export async function getLhAnnouncementList(params: LhAnnouncementListQuery) {
  const where = buildWhere(params);
  const skip = (params.page - 1) * params.limit;

  const [rows, total] = await Promise.all([
    prisma.lhAnnouncement.findMany({
      where,
      orderBy: [
        { panSs: 'asc' }, // 공고중(가나다순으로 '공고중' < '마감')
        { clsgDt: 'asc' },
      ],
      skip,
      take: params.limit,
    }),
    prisma.lhAnnouncement.count({ where }),
  ]);

  return {
    items: rows.map(serializeLhRow),
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / params.limit)),
    },
  };
}

export async function getLhAnnouncementDetail(id: number) {
  const row = await prisma.lhAnnouncement.findUnique({
    where: { id },
    include: {
      supplies: { orderBy: [{ listType: 'asc' }, { rsdnDdoAr: 'asc' }] },
      attachments: true,
    },
  });
  if (!row) throw new NotFoundError(`LhAnnouncement ${id} not found`);
  return serializeLhRow(row);
}
