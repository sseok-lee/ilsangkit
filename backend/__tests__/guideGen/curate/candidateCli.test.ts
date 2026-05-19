import { describe, it, expect, beforeEach } from 'vitest';
import prisma from '../../../src/lib/prisma.js';
import {
  approveCandidate,
  rejectCandidate,
  showCandidate,
  listCandidates,
} from '../../../src/guideGen/curate/candidateCli.js';

async function seedCandidate(overrides: Partial<{
  sourceUrl: string;
  status: string;
  matchedCategory: string | null;
}> = {}) {
  return prisma.guideCandidate.create({
    data: {
      sourceUrl: overrides.sourceUrl ?? 'https://test.example.com/curate/cli-001',
      sourceProvider: 'korea.kr',
      sourceTitle: '테스트 후보',
      sourcePublishedAt: new Date('2026-05-12'),
      matchedCategory: 'matchedCategory' in overrides ? overrides.matchedCategory : 'ev-charger',
      status: overrides.status ?? 'pending',
    },
  });
}

describe('candidate CLI handlers', () => {
  beforeEach(async () => {
    await prisma.guideCandidate.deleteMany({
      where: { sourceUrl: { startsWith: 'https://test.example.com/curate/' } },
    });
  });

  it('approveCandidate sets status=approved and approvedAt', async () => {
    const cand = await seedCandidate();
    await approveCandidate({ id: cand.id });
    const row = await prisma.guideCandidate.findUnique({ where: { id: cand.id } });
    expect(row?.status).toBe('approved');
    expect(row?.approvedAt).not.toBeNull();
  });

  it('approveCandidate rejects when matchedCategory is null and no override given', async () => {
    const cand = await seedCandidate({ matchedCategory: null });
    await expect(approveCandidate({ id: cand.id })).rejects.toThrow(
      /matchedCategory/
    );
  });

  it('approveCandidate accepts category override', async () => {
    const cand = await seedCandidate({ matchedCategory: null });
    await approveCandidate({ id: cand.id, category: 'public-rental' });
    const row = await prisma.guideCandidate.findUnique({ where: { id: cand.id } });
    expect(row?.matchedCategory).toBe('public-rental');
    expect(row?.status).toBe('approved');
  });

  it('rejectCandidate stores reason in notes', async () => {
    const cand = await seedCandidate();
    await rejectCandidate({ id: cand.id, reason: '주제 부적합' });
    const row = await prisma.guideCandidate.findUnique({ where: { id: cand.id } });
    expect(row?.status).toBe('rejected');
    expect(row?.notes).toContain('주제 부적합');
  });

  it('listCandidates filters by status', async () => {
    await seedCandidate({ sourceUrl: 'https://test.example.com/curate/cli-list-1' });
    await seedCandidate({
      sourceUrl: 'https://test.example.com/curate/cli-list-2',
      status: 'approved',
    });
    const pending = await listCandidates({ status: 'pending' });
    const approved = await listCandidates({ status: 'approved' });
    expect(pending.some((c) => c.sourceUrl.endsWith('cli-list-1'))).toBe(true);
    expect(approved.some((c) => c.sourceUrl.endsWith('cli-list-2'))).toBe(true);
    expect(pending.some((c) => c.sourceUrl.endsWith('cli-list-2'))).toBe(false);
  });

  it('showCandidate returns full row by id', async () => {
    const cand = await seedCandidate();
    const found = await showCandidate({ id: cand.id });
    expect(found?.id).toBe(cand.id);
  });

  it('showCandidate returns null for unknown id', async () => {
    const found = await showCandidate({ id: 'nope_____' });
    expect(found).toBeNull();
  });
});
