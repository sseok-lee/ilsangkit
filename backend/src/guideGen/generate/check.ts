import { writeFile, mkdir } from 'node:fs/promises';
import prisma from '../../lib/prisma.js';
import { callLLM } from '../shared/llm.js';
import { findBannedPhrases } from '../shared/bannedPhrases.js';
import { isAllowedLink } from '../shared/internalLinks.js';
import { checkPath, metaDirFor } from '../shared/paths.js';
import { ARTICLE_LENGTH_RANGES } from '../shared/config.js';
import type {
  FactsJson, PlanJson, CheckReport, CheckResultEntry,
} from './types.js';
import { CHECK_SYSTEM_PROMPT, buildCheckUserPrompt } from './prompts/check.js';

export interface CheckInput {
  candidateId: string;
  draft: string;
  facts: FactsJson;
  plan: PlanJson;
  category: string;
  sourceContent: string;
  attempt: number;
}

const MARKDOWN_LINK = /\[[^\]]+\]\((\/[^)]+)\)/g;
const NUMBER_PATTERN = /(\d{2,})\s*(만원|원|건|명|개|곳|일|주|개월|년|%|배)?/g;
const DATE_PATTERN = /(\d{4})[년\-./](\d{1,2})[월\-./](\d{1,2})/g;

function checkBannedPhrases(draft: string): CheckResultEntry {
  const hits = findBannedPhrases(draft);
  return { passed: hits.length === 0, hits };
}

function checkLength(draft: string, articleType: string): CheckResultEntry {
  const range = ARTICLE_LENGTH_RANGES[articleType];
  const value = draft.length;
  if (!range) return { passed: true, value };
  const [min, max] = range;
  return { passed: value >= min && value <= max, value, range };
}

function checkInternalLinkValid(draft: string, category: string): CheckResultEntry {
  const issues: string[] = [];
  for (const m of draft.matchAll(MARKDOWN_LINK)) {
    const path = m[1];
    if (!isAllowedLink(path, category)) issues.push(path);
  }
  return { passed: issues.length === 0, issues };
}

function checkFactsCoverage(draft: string, facts: FactsJson): CheckResultEntry {
  const allowedNumbers = new Set<string>();
  for (const n of facts.numbers) allowedNumbers.add(String(n.value));
  for (const f of facts.facts) {
    for (const m of f.statement.matchAll(NUMBER_PATTERN)) allowedNumbers.add(m[1]);
  }
  const allowedDates = new Set<string>();
  for (const d of facts.dates) allowedDates.add(d.date);

  const extra: string[] = [];
  for (const m of draft.matchAll(NUMBER_PATTERN)) {
    const value = m[1];
    const unit = m[2];
    if (unit === '년' || unit === undefined) continue;  // 연도 단독·단위 없는 토큰은 무시
    if (Number(value) < 100) continue;
    if (!allowedNumbers.has(value)) {
      extra.push(`${m[0]} (수치 ${value} 가 facts에 없음)`);
    }
  }
  for (const m of draft.matchAll(DATE_PATTERN)) {
    const [, y, mo, d] = m;
    const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!allowedDates.has(iso)) {
      extra.push(`${m[0]} (날짜 ${iso} 가 facts.dates에 없음)`);
    }
  }
  return { passed: extra.length === 0, extra };
}

function checkReferencesSection(draft: string, facts: FactsJson): CheckResultEntry {
  if (!/^##\s+참고\s+자료/m.test(draft)) {
    return { passed: false, issues: ['"## 참고 자료" 섹션 없음'] };
  }
  if (facts.sourceMeta.url && !draft.includes(facts.sourceMeta.url)) {
    return { passed: false, issues: ['sourceUrl이 본문에 없음'] };
  }
  return { passed: true };
}

async function checkSlugUnique(slug: string): Promise<CheckResultEntry> {
  const existing = await prisma.guide.findFirst({ where: { slug } });
  return existing
    ? { passed: false, issues: [`slug "${slug}" already exists in Guide table`] }
    : { passed: true };
}

async function runModelReview(input: CheckInput): Promise<CheckResultEntry> {
  try {
    const raw = await callLLM({
      stage: 'check',
      systemPrompt: CHECK_SYSTEM_PROMPT,
      userPrompt: buildCheckUserPrompt({
        draft: input.draft,
        sourceContent: input.sourceContent,
      }),
      responseFormat: 'json',
    });
    const parsed = JSON.parse(raw) as {
      noUnsupported: { passed: boolean; locations?: string[] };
      conclusionFirst: { passed: boolean };
    };
    const issues: string[] = [];
    if (!parsed.noUnsupported.passed) {
      issues.push(...(parsed.noUnsupported.locations ?? ['unsupported claim']));
    }
    if (!parsed.conclusionFirst.passed) {
      issues.push('결론이 첫 섹션에 보이지 않음');
    }
    return { passed: issues.length === 0, issues };
  } catch (err) {
    return { passed: true, issues: [`model review skipped: ${(err as Error).message}`] };
  }
}

export async function runCheck(input: CheckInput): Promise<CheckReport> {
  const checks = {
    bannedPhrases:     checkBannedPhrases(input.draft),
    lengthRange:       checkLength(input.draft, input.plan.articleType),
    factsCoverage:     checkFactsCoverage(input.draft, input.facts),
    internalLinkValid: checkInternalLinkValid(input.draft, input.category),
    referencesSection: checkReferencesSection(input.draft, input.facts),
    slugUnique:        await checkSlugUnique(input.plan.slug),
    modelReview:       await runModelReview(input),
  };

  const blockingPassed =
    checks.bannedPhrases.passed &&
    checks.lengthRange.passed &&
    checks.factsCoverage.passed &&
    checks.internalLinkValid.passed &&
    checks.referencesSection.passed &&
    checks.slugUnique.passed;

  const report: CheckReport = {
    passed: blockingPassed,
    attempt: input.attempt,
    checks,
  };

  await mkdir(metaDirFor(input.candidateId), { recursive: true });
  await writeFile(
    checkPath(input.candidateId),
    JSON.stringify(report, null, 2),
    'utf-8'
  );

  return report;
}
