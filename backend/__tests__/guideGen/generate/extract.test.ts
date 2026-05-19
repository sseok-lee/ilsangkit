import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('../../../src/guideGen/shared/llm.js', () => ({
  callLLM: vi.fn(),
}));

import { callLLM } from '../../../src/guideGen/shared/llm.js';
import { runExtract } from '../../../src/guideGen/generate/extract.js';

const sampleFacts = readFileSync(
  path.join(__dirname, '../fixtures/facts-sample.json'),
  'utf-8'
);

describe('runExtract', () => {
  beforeEach(() => {
    vi.mocked(callLLM).mockReset();
  });

  it('returns parsed FactsJson from LLM JSON response', async () => {
    vi.mocked(callLLM).mockResolvedValue(sampleFacts);
    const result = await runExtract({
      candidateId: 'cand_test_001',
      sourceUrl: 'https://test.example.com/policy-001',
      sourceProvider: 'korea.kr',
      sourceTitle: '서울시 EV 보조금',
      sourcePublishedAt: new Date('2026-05-12'),
      sourceContent: '서울특별시는 EV 충전소 보조금 200만원을 발표했다.',
    });
    expect(result.facts).toHaveLength(1);
    expect(result.facts[0].id).toBe('F1');
    expect(result.numbers[0].value).toBe(200);
  });

  it('throws when LLM returns empty facts array', async () => {
    vi.mocked(callLLM).mockResolvedValue(JSON.stringify({
      candidateId: 'x', sourceMeta: { url: '', provider: '', publishedAt: '', issuedBy: '' },
      facts: [], numbers: [], dates: [], targets: [], unknowns: [],
    }));
    await expect(runExtract({
      candidateId: 'x',
      sourceUrl: '', sourceProvider: '', sourceTitle: '',
      sourcePublishedAt: new Date(), sourceContent: '본문 없음',
    })).rejects.toThrow(/no facts/i);
  });

  it('throws on invalid JSON response', async () => {
    vi.mocked(callLLM).mockResolvedValue('not json');
    await expect(runExtract({
      candidateId: 'x',
      sourceUrl: '', sourceProvider: '', sourceTitle: '',
      sourcePublishedAt: new Date(), sourceContent: 'x',
    })).rejects.toThrow(/parse/i);
  });
});
