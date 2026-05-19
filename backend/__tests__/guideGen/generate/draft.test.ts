import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../../src/guideGen/shared/llm.js', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '../../../src/guideGen/shared/llm.js';
import { runDraft } from '../../../src/guideGen/generate/draft.js';
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

describe('runDraft', () => {
  beforeEach(() => vi.mocked(callLLM).mockReset());

  it('returns the markdown body from LLM', async () => {
    vi.mocked(callLLM).mockResolvedValue(draftFixture);
    const md = await runDraft({
      candidateId: 'cand_test_001',
      facts: factsFixture,
      plan: planFixture,
    });
    expect(md).toContain('## 핵심 요약');
    expect(md).toContain('## 참고 자료');
  });

  it('passes feedback to LLM when retrying after Check FAIL', async () => {
    vi.mocked(callLLM).mockResolvedValue(draftFixture);
    await runDraft({
      candidateId: 'cand_test_001',
      facts: factsFixture,
      plan: planFixture,
      retryFeedback: '금지어 "최근에"가 포함됨. 제거할 것.',
    });
    const call = vi.mocked(callLLM).mock.calls[0][0];
    expect(call.userPrompt).toContain('최근에');
  });
});
