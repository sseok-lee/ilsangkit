import prisma from '../../lib/prisma.js';
import { CANDIDATE_STATUS, type CandidateStatus } from '../shared/config.js';

export interface ApproveOpts {
  id: string;
  category?: string;
  note?: string;
}

export async function approveCandidate(opts: ApproveOpts) {
  const cand = await prisma.guideCandidate.findUnique({
    where: { id: opts.id },
  });
  if (!cand) throw new Error(`candidate not found: ${opts.id}`);

  const category = opts.category ?? cand.matchedCategory;
  if (!category) {
    throw new Error(
      `candidate ${opts.id} has no matchedCategory; pass --category=<slug>`
    );
  }

  return prisma.guideCandidate.update({
    where: { id: opts.id },
    data: {
      status: CANDIDATE_STATUS.APPROVED,
      matchedCategory: category,
      notes: opts.note
        ? [cand.notes, `[approve] ${opts.note}`].filter(Boolean).join('\n')
        : cand.notes,
      approvedAt: new Date(),
    },
  });
}

export interface RejectOpts {
  id: string;
  reason: string;
}

export async function rejectCandidate(opts: RejectOpts) {
  const cand = await prisma.guideCandidate.findUnique({
    where: { id: opts.id },
  });
  if (!cand) throw new Error(`candidate not found: ${opts.id}`);

  return prisma.guideCandidate.update({
    where: { id: opts.id },
    data: {
      status: CANDIDATE_STATUS.REJECTED,
      notes: [cand.notes, `[reject] ${opts.reason}`].filter(Boolean).join('\n'),
    },
  });
}

export interface ListOpts {
  status?: CandidateStatus;
  limit?: number;
}

export async function listCandidates(opts: ListOpts = {}) {
  return prisma.guideCandidate.findMany({
    where: opts.status ? { status: opts.status } : undefined,
    orderBy: { createdAt: 'desc' },
    take: opts.limit ?? 50,
  });
}

export async function showCandidate(opts: { id: string }) {
  return prisma.guideCandidate.findUnique({ where: { id: opts.id } });
}
