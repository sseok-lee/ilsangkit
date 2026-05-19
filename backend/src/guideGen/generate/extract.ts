import { writeFile, mkdir } from 'node:fs/promises';
import { callLLM } from '../shared/llm.js';
import { factsPath, metaDirFor } from '../shared/paths.js';
import type { FactsJson } from './types.js';
import {
  EXTRACT_SYSTEM_PROMPT,
  buildExtractUserPrompt,
} from './prompts/extract.js';

export interface ExtractInput {
  candidateId: string;
  sourceUrl: string;
  sourceProvider: string;
  sourceTitle: string;
  sourcePublishedAt: Date;
  sourceContent: string;
  issuedBy?: string;
}

export async function runExtract(input: ExtractInput): Promise<FactsJson> {
  const raw = await callLLM({
    stage: 'extract',
    systemPrompt: EXTRACT_SYSTEM_PROMPT,
    userPrompt: buildExtractUserPrompt(input),
    responseFormat: 'json',
  });

  let parsed: FactsJson;
  try {
    parsed = JSON.parse(raw) as FactsJson;
  } catch {
    throw new Error(`[extract] failed to parse LLM JSON response`);
  }

  if (!Array.isArray(parsed.facts) || parsed.facts.length === 0) {
    throw new Error(`[extract] no facts extracted from source (candidate=${input.candidateId})`);
  }

  parsed.candidateId = input.candidateId;
  parsed.sourceMeta = {
    url: input.sourceUrl,
    provider: input.sourceProvider,
    publishedAt: input.sourcePublishedAt.toISOString().slice(0, 10),
    issuedBy: input.issuedBy ?? input.sourceProvider,
  };

  await mkdir(metaDirFor(input.candidateId), { recursive: true });
  await writeFile(
    factsPath(input.candidateId),
    JSON.stringify(parsed, null, 2),
    'utf-8'
  );

  return parsed;
}
