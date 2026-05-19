import prisma from '../../lib/prisma.js';
import { CANDIDATE_STATUS } from '../shared/config.js';
import {
  factsPath, planPath, draftPath,
} from '../shared/paths.js';
import { runExtract } from './extract.js';
import { runPlan } from './plan.js';
import { runDraft } from './draft.js';
import { runCheck } from './check.js';
import type { CheckReport } from './types.js';

const MAX_DRAFT_ATTEMPTS = 2;

export interface PipelineInput {
  candidateId: string;
}

export async function runPipeline(input: PipelineInput): Promise<CheckReport> {
  const cand = await prisma.guideCandidate.findUnique({
    where: { id: input.candidateId },
  });
  if (!cand) throw new Error(`candidate not found: ${input.candidateId}`);
  if (cand.status !== CANDIDATE_STATUS.APPROVED) {
    throw new Error(`candidate ${input.candidateId} is not approved (status=${cand.status})`);
  }
  if (!cand.matchedCategory) {
    throw new Error(`candidate ${input.candidateId} has no matchedCategory`);
  }

  if (!cand.sourceExcerpt) {
    console.warn(`[pipeline] sourceExcerpt is null for ${cand.id} — Check model review will use title only`);
  }
  const sourceContent = [cand.sourceTitle, cand.sourceExcerpt ?? ''].join('\n');

  const facts = await runExtract({
    candidateId: cand.id,
    sourceUrl: cand.sourceUrl,
    sourceProvider: cand.sourceProvider,
    sourceTitle: cand.sourceTitle,
    sourcePublishedAt: cand.sourcePublishedAt,
    sourceContent,
  });
  await prisma.guideCandidate.update({
    where: { id: cand.id },
    data: { factsPath: factsPath(cand.id) },
  });

  const plan = await runPlan({
    candidateId: cand.id,
    facts,
    category: cand.matchedCategory,
  });
  await prisma.guideCandidate.update({
    where: { id: cand.id },
    data: { planPath: planPath(cand.id) },
  });

  let draft: string | null = null;
  let report: CheckReport | null = null;
  let retryFeedback: string | undefined;
  for (let attempt = 1; attempt <= MAX_DRAFT_ATTEMPTS; attempt += 1) {
    draft = await runDraft({
      candidateId: cand.id,
      facts,
      plan,
      publishedAt: cand.sourcePublishedAt,
      retryFeedback,
    });
    report = await runCheck({
      candidateId: cand.id,
      draft,
      facts,
      plan,
      category: cand.matchedCategory,
      sourceContent,
      attempt,
    });
    if (report.passed) break;
    // Slug collision is set by Plan, not Draft — retry cannot fix it
    if (!report.checks.slugUnique.passed) {
      console.warn(`[pipeline] slug "${plan.slug}" collides with existing Guide; skipping Draft retry`);
      break;
    }
    retryFeedback = summarizeFailures(report);
  }

  if (!draft || !report) {
    throw new Error('pipeline produced no draft');
  }

  await prisma.guideCandidate.update({
    where: { id: cand.id },
    data: {
      status: report.passed ? CANDIDATE_STATUS.DRAFTED : CANDIDATE_STATUS.FAILED,
      draftPath: draftPath({ publishedAt: cand.sourcePublishedAt, slug: plan.slug }),
      checkReport: JSON.stringify(report, null, 2),
    },
  });

  return report;
}

function summarizeFailures(report: CheckReport): string {
  const parts: string[] = [];
  if (!report.checks.bannedPhrases.passed) {
    parts.push(`금지어 발견: ${report.checks.bannedPhrases.hits?.join(', ')}`);
  }
  if (!report.checks.lengthRange.passed) {
    parts.push(`길이 범위 위반: ${report.checks.lengthRange.value}자 (허용 ${report.checks.lengthRange.range?.join('~')})`);
  }
  if (!report.checks.factsCoverage.passed) {
    parts.push(`facts에 없는 수치/날짜: ${report.checks.factsCoverage.extra?.join(', ')}`);
  }
  if (!report.checks.internalLinkValid.passed) {
    parts.push(`허용되지 않은 internal link: ${report.checks.internalLinkValid.issues?.join(', ')}`);
  }
  if (!report.checks.referencesSection.passed) {
    parts.push(`참고 자료 섹션: ${report.checks.referencesSection.issues?.join(', ')}`);
  }
  if (!report.checks.slugUnique.passed) {
    parts.push(`slug 충돌`);
  }
  return parts.join('\n');
}
