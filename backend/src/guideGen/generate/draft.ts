import { writeFile, mkdir } from 'node:fs/promises';
import { callLLM } from '../shared/llm.js';
import { draftPath } from '../shared/paths.js';
import { DRAFT_DIR } from '../shared/config.js';
import type { FactsJson, PlanJson } from './types.js';
import {
  DRAFT_SYSTEM_PROMPT,
  buildDraftUserPrompt,
} from './prompts/draft.js';

export interface DraftInput {
  candidateId: string;
  facts: FactsJson;
  plan: PlanJson;
  publishedAt?: Date;
  retryFeedback?: string;
}

export async function runDraft(input: DraftInput): Promise<string> {
  const markdown = await callLLM({
    stage: 'draft',
    systemPrompt: DRAFT_SYSTEM_PROMPT,
    userPrompt: buildDraftUserPrompt({
      facts: input.facts,
      plan: input.plan,
      retryFeedback: input.retryFeedback,
    }),
    responseFormat: 'text',
    temperature: 0.4,
  });

  const publishedAt = input.publishedAt ?? new Date();
  await mkdir(DRAFT_DIR, { recursive: true });
  await writeFile(
    draftPath({ publishedAt, slug: input.plan.slug }),
    markdown,
    'utf-8'
  );

  return markdown;
}
