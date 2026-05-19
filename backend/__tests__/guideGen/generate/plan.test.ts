import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../../src/guideGen/shared/llm.js', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '../../../src/guideGen/shared/llm.js';
import { runPlan } from '../../../src/guideGen/generate/plan.js';
import type { FactsJson } from '../../../src/guideGen/generate/types.js';

const factsFixture = JSON.parse(
  readFileSync(path.join(__dirname, '../fixtures/facts-sample.json'), 'utf-8')
) as FactsJson;

const planFixture = readFileSync(
  path.join(__dirname, '../fixtures/plan-sample.json'),
  'utf-8'
);

describe('runPlan', () => {
  beforeEach(() => vi.mocked(callLLM).mockReset());

  it('returns parsed PlanJson and writes file', async () => {
    vi.mocked(callLLM).mockResolvedValue(planFixture);
    const result = await runPlan({
      candidateId: 'cand_test_001',
      facts: factsFixture,
      category: 'ev-charger',
    });
    expect(result.articleType).toBe('policy-explainer');
    expect(result.slug).toBe('seoul-ev-charger-subsidy-2026');
  });

  it('rejects plan with factsRef pointing to unknown id', async () => {
    const bad = JSON.parse(planFixture);
    bad.sections[0].factsRefs = ['F99'];
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(bad));
    await expect(runPlan({
      candidateId: 'cand_test_001',
      facts: factsFixture,
      category: 'ev-charger',
    })).rejects.toThrow(/unknown facts id/i);
  });

  it('rejects plan with internalLink not in category whitelist', async () => {
    const bad = JSON.parse(planFixture);
    bad.internalLinks = [{ path: '/hospital', reason: 'wrong' }];
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(bad));
    await expect(runPlan({
      candidateId: 'cand_test_001',
      facts: factsFixture,
      category: 'ev-charger',
    })).rejects.toThrow(/internalLink/i);
  });

  it('rejects when high-confidence fact coverage below 70%', async () => {
    const facts: FactsJson = {
      ...factsFixture,
      facts: [
        { id: 'F1', statement: 'a', sourceQuote: '', confidence: 'high' },
        { id: 'F2', statement: 'b', sourceQuote: '', confidence: 'high' },
        { id: 'F3', statement: 'c', sourceQuote: '', confidence: 'high' },
        { id: 'F4', statement: 'd', sourceQuote: '', confidence: 'high' },
      ],
    };
    const bad = JSON.parse(planFixture);
    bad.sections = [{ heading: 'x', intent: 'y', factsRefs: ['F1'] }];
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify(bad));
    await expect(runPlan({
      candidateId: 'cand_test_001',
      facts,
      category: 'ev-charger',
    })).rejects.toThrow(/coverage/i);
  });
});
