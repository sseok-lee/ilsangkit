import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../../src/guideGen/shared/llm.js', () => ({
  callLLM: vi.fn(),
}));

vi.mock('../../../src/lib/prisma.js', () => ({
  default: {
    guide: {
      findFirst: vi.fn(),
    },
  },
}));

import { callLLM } from '../../../src/guideGen/shared/llm.js';
import prisma from '../../../src/lib/prisma.js';
import { runCheck } from '../../../src/guideGen/generate/check.js';
import type {
  FactsJson, PlanJson,
} from '../../../src/guideGen/generate/types.js';

const factsFixture = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/facts-sample.json'), 'utf-8')
) as FactsJson;
const planFixture = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/plan-sample.json'), 'utf-8')
) as PlanJson;
const draftFixture = readFileSync(
  path.join(__dirname, '../fixtures/draft-sample.md'),
  'utf-8'
);

const passedModelReview = JSON.stringify({
  noUnsupported: { passed: true, locations: [] },
  conclusionFirst: { passed: true },
});

describe('runCheck', () => {
  beforeEach(() => {
    vi.mocked(callLLM).mockReset();
    vi.mocked(prisma.guide.findFirst).mockReset();
    vi.mocked(prisma.guide.findFirst).mockResolvedValue(null);
  });

  it('returns passed=true when all checks pass', async () => {
    vi.mocked(callLLM).mockResolvedValue(passedModelReview);
    const report = await runCheck({
      candidateId: 'cand_test_001',
      draft: draftFixture,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '서울시는 EV 충전소 보조금 200만원을 발표했다.',
      attempt: 1,
    });
    expect(report.passed).toBe(true);
    expect(report.checks.bannedPhrases.passed).toBe(true);
    expect(report.checks.lengthRange.passed).toBe(true);
    expect(report.checks.factsCoverage.passed).toBe(true);
    expect(report.checks.internalLinkValid.passed).toBe(true);
    expect(report.checks.referencesSection.passed).toBe(true);
    expect(report.checks.slugUnique.passed).toBe(true);
  });

  it('fails bannedPhrases when draft contains "최근에"', async () => {
    vi.mocked(callLLM).mockResolvedValue(passedModelReview);
    const bad = draftFixture + '\n최근에 발표된 정책이다.\n';
    const report = await runCheck({
      candidateId: 'x',
      draft: bad,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '...',
      attempt: 1,
    });
    expect(report.passed).toBe(false);
    expect(report.checks.bannedPhrases.passed).toBe(false);
    expect(report.checks.bannedPhrases.hits).toContain('최근에');
  });

  it('fails factsCoverage when draft introduces 300만원 not in facts', async () => {
    vi.mocked(callLLM).mockResolvedValue(passedModelReview);
    const bad = draftFixture.replace('200만원', '300만원');
    const report = await runCheck({
      candidateId: 'x',
      draft: bad,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '...',
      attempt: 1,
    });
    expect(report.checks.factsCoverage.passed).toBe(false);
    expect(report.checks.factsCoverage.extra?.some((s) => s.includes('300'))).toBe(true);
  });

  it('fails internalLinkValid when draft contains /hospital', async () => {
    vi.mocked(callLLM).mockResolvedValue(passedModelReview);
    const bad = draftFixture + '\n[관련 페이지](/hospital)\n';
    const report = await runCheck({
      candidateId: 'x',
      draft: bad,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '...',
      attempt: 1,
    });
    expect(report.checks.internalLinkValid.passed).toBe(false);
  });

  it('fails referencesSection when draft has no ## 참고 자료', async () => {
    vi.mocked(callLLM).mockResolvedValue(passedModelReview);
    const bad = draftFixture.replace('## 참고 자료', '## 끝맺음');
    const report = await runCheck({
      candidateId: 'x',
      draft: bad,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '...',
      attempt: 1,
    });
    expect(report.checks.referencesSection.passed).toBe(false);
  });

  it('fails slugUnique when Guide row with same slug exists', async () => {
    vi.mocked(callLLM).mockResolvedValue(passedModelReview);
    vi.mocked(prisma.guide.findFirst).mockResolvedValue({ id: 'existing' } as never);
    const report = await runCheck({
      candidateId: 'x',
      draft: draftFixture,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '...',
      attempt: 1,
    });
    expect(report.checks.slugUnique.passed).toBe(false);
  });

  it('does not block when modelReview fails (advisory only)', async () => {
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
      noUnsupported: { passed: false, locations: ['line 5'] },
      conclusionFirst: { passed: true },
    }));
    const report = await runCheck({
      candidateId: 'x',
      draft: draftFixture,
      facts: factsFixture,
      plan: planFixture,
      category: 'ev-charger',
      sourceContent: '...',
      attempt: 1,
    });
    expect(report.checks.modelReview.passed).toBe(false);
    // Overall report.passed depends on code checks only
    expect(report.passed).toBe(true);
  });
});
