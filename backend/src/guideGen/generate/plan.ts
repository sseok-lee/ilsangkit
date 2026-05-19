import { writeFile, mkdir } from 'node:fs/promises';
import { callLLM } from '../shared/llm.js';
import { planPath, metaDirFor } from '../shared/paths.js';
import { allowedLinksFor } from '../shared/internalLinks.js';
import type { FactsJson, PlanJson } from './types.js';
import { PLAN_SYSTEM_PROMPT, buildPlanUserPrompt } from './prompts/plan.js';

export interface PlanInput {
  candidateId: string;
  facts: FactsJson;
  category: string;
}

const COVERAGE_THRESHOLD = 0.7;

export async function runPlan(input: PlanInput): Promise<PlanJson> {
  const allowedPaths = allowedLinksFor(input.category);

  const raw = await callLLM({
    stage: 'plan',
    systemPrompt: PLAN_SYSTEM_PROMPT,
    userPrompt: buildPlanUserPrompt({
      facts: input.facts,
      category: input.category,
      allowedPaths,
    }),
    responseFormat: 'json',
  });

  let parsed: PlanJson;
  try {
    parsed = JSON.parse(raw) as PlanJson;
  } catch {
    throw new Error(`[plan] failed to parse LLM JSON response`);
  }

  const factIds = new Set([
    ...input.facts.facts.map((f) => f.id),
    ...input.facts.numbers.map((n) => n.id),
    ...input.facts.dates.map((d) => d.id),
    ...input.facts.targets.map((t) => t.id),
  ]);
  for (const section of parsed.sections) {
    for (const ref of section.factsRefs) {
      if (!factIds.has(ref)) {
        throw new Error(`[plan] unknown facts id in section "${section.heading}": ${ref}`);
      }
    }
  }

  for (const link of parsed.internalLinks) {
    if (!allowedPaths.includes(link.path)) {
      throw new Error(`[plan] internalLink not allowed for category ${input.category}: ${link.path}`);
    }
  }

  const highConfidence = input.facts.facts.filter((f) => f.confidence === 'high');
  if (highConfidence.length > 0) {
    const mappedRefs = new Set(parsed.sections.flatMap((s) => s.factsRefs));
    const coveredHigh = highConfidence.filter((f) => mappedRefs.has(f.id)).length;
    const ratio = coveredHigh / highConfidence.length;
    if (ratio < COVERAGE_THRESHOLD) {
      throw new Error(`[plan] high-confidence fact coverage ${(ratio * 100).toFixed(0)}% below threshold`);
    }
  }

  await mkdir(metaDirFor(input.candidateId), { recursive: true });
  await writeFile(
    planPath(input.candidateId),
    JSON.stringify(parsed, null, 2),
    'utf-8'
  );

  return parsed;
}
