import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../../src/guideGen/shared/llm.js', () => ({
  callLLM: vi.fn(),
}));

vi.mock('../../../src/lib/prisma.js', () => ({
  default: {
    guideCandidate: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    guide: {
      findFirst: vi.fn(),
    },
  },
}));

import { callLLM } from '../../../src/guideGen/shared/llm.js';
import prisma from '../../../src/lib/prisma.js';
import { runPipeline } from '../../../src/guideGen/generate/pipeline.js';

const factsRaw = readFileSync(
  path.join(__dirname, '../fixtures/facts-sample.json'),
  'utf-8'
);
const planRaw = readFileSync(
  path.join(__dirname, '../fixtures/plan-sample.json'),
  'utf-8'
);
const draftRaw = readFileSync(
  path.join(__dirname, '../fixtures/draft-sample.md'),
  'utf-8'
);
const modelReviewPass = JSON.stringify({
  noUnsupported: { passed: true, locations: [] },
  conclusionFirst: { passed: true },
});

const candidateRow = {
  id: 'cand_test_001',
  sourceUrl: 'https://test.example.com/policy-001',
  sourceProvider: 'korea.kr',
  sourceTitle: '서울시 EV 보조금',
  sourcePublishedAt: new Date('2026-05-12'),
  sourceExcerpt: '서울시 EV 보조금 200만원 발표',
  matchedCategory: 'ev-charger',
  status: 'approved',
};

describe('runPipeline', () => {
  beforeEach(() => {
    vi.mocked(callLLM).mockReset();
    vi.mocked(prisma.guideCandidate.findUnique).mockReset();
    vi.mocked(prisma.guideCandidate.update).mockReset();
    vi.mocked(prisma.guide.findFirst).mockReset();
    vi.mocked(prisma.guide.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue(candidateRow as never);
    vi.mocked(prisma.guideCandidate.update).mockImplementation(async ({ data }) => ({
      ...candidateRow,
      ...data,
    }) as never);
  });

  it('runs all 4 stages and marks status=drafted on success', async () => {
    vi.mocked(callLLM)
      .mockResolvedValueOnce(factsRaw)         // extract
      .mockResolvedValueOnce(planRaw)          // plan
      .mockResolvedValueOnce(draftRaw)         // draft
      .mockResolvedValueOnce(modelReviewPass); // check (model)

    const result = await runPipeline({ candidateId: 'cand_test_001' });
    expect(result.passed).toBe(true);
    expect(vi.mocked(callLLM)).toHaveBeenCalledTimes(4);
    const updateCalls = vi.mocked(prisma.guideCandidate.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect((finalUpdate.data as { status: string }).status).toBe('drafted');
  });

  it('retries Draft once when Check FAILs, then marks failed if still failing', async () => {
    const badDraft = draftRaw + '\n최근에 발표된 정책이다.\n';
    vi.mocked(callLLM)
      .mockResolvedValueOnce(factsRaw)
      .mockResolvedValueOnce(planRaw)
      .mockResolvedValueOnce(badDraft)       // draft attempt 1 (bad)
      .mockResolvedValueOnce(modelReviewPass) // check attempt 1
      .mockResolvedValueOnce(badDraft)       // draft attempt 2 (still bad)
      .mockResolvedValueOnce(modelReviewPass); // check attempt 2

    const result = await runPipeline({ candidateId: 'cand_test_001' });
    expect(result.passed).toBe(false);
    const updateCalls = vi.mocked(prisma.guideCandidate.update).mock.calls;
    const finalUpdate = updateCalls[updateCalls.length - 1][0];
    expect((finalUpdate.data as { status: string }).status).toBe('failed');
  });

  it('rejects when candidate status is not approved', async () => {
    vi.mocked(prisma.guideCandidate.findUnique).mockResolvedValue({
      ...candidateRow,
      status: 'pending',
    } as never);
    await expect(runPipeline({ candidateId: 'cand_test_001' })).rejects.toThrow(/approved/);
  });
});
