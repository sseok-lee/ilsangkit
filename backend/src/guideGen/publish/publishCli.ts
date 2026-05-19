import { readFile } from 'node:fs/promises';
import prisma from '../../lib/prisma.js';
import { CANDIDATE_STATUS } from '../shared/config.js';
import { confirmDestructive } from '../shared/confirm.js';
import { generateThumbnail } from './thumbnail.js';
import type { PlanJson } from '../generate/types.js';

export interface PublishOpts {
  id: string;
  force: boolean;
  yes: boolean;
}

export async function publishCandidate(opts: PublishOpts) {
  const cand = await prisma.guideCandidate.findUnique({ where: { id: opts.id } });
  if (!cand) throw new Error(`candidate not found: ${opts.id}`);

  const allowedStatuses: string[] = opts.force
    ? [CANDIDATE_STATUS.DRAFTED, CANDIDATE_STATUS.FAILED]
    : [CANDIDATE_STATUS.DRAFTED];
  if (!allowedStatuses.includes(cand.status)) {
    throw new Error(
      `candidate ${opts.id} is not in a publishable state (status=${cand.status}); use --force to override`
    );
  }
  if (!cand.matchedCategory) {
    throw new Error(`candidate ${opts.id} has no matchedCategory`);
  }
  if (!cand.draftPath || !cand.planPath) {
    throw new Error(`candidate ${opts.id} has no draft/plan paths (was generate run?)`);
  }

  const report = cand.checkReport ? JSON.parse(cand.checkReport) as { passed?: boolean } : null;
  if (!opts.force && report?.passed !== true) {
    throw new Error(
      `candidate ${opts.id}: last check did not pass; use --force --yes to publish anyway`
    );
  }

  if (opts.force) {
    const confirmed = await confirmDestructive({ yes: opts.yes, action: 'publish --force' });
    if (!confirmed) throw new Error('publish --force requires --yes confirmation');
  }

  const planRaw = await readFile(cand.planPath, 'utf-8');
  const plan = JSON.parse(planRaw) as PlanJson;
  const content = await readFile(cand.draftPath, 'utf-8');

  const thumb = await generateThumbnail({
    slug: plan.slug,
    title: plan.title,
    category: cand.matchedCategory,
  });
  if (!thumb.ok) {
    console.warn(`[publish] thumbnail generation failed for ${plan.slug}; publishing with thumbnailUrl=null`);
  }

  const guide = await prisma.guide.create({
    data: {
      slug: plan.slug,
      title: plan.title,
      summary: plan.summary,
      content,
      category: cand.matchedCategory,
      articleType: plan.articleType,
      keywords: plan.keywords?.join(',') || null,
      thumbnailUrl: thumb.thumbnailUrl,
      published: true,
      candidateId: cand.id,
      sourceUrl: cand.sourceUrl,
      sourcePublishedAt: cand.sourcePublishedAt,
    },
  });

  await prisma.guideCandidate.update({
    where: { id: cand.id },
    data: {
      status: CANDIDATE_STATUS.PUBLISHED,
      publishedAt: new Date(),
      publishedGuideId: guide.id,
    },
  });

  return guide;
}

export interface UnpublishOpts {
  id: string;
  yes: boolean;
}

export async function unpublishCandidate(opts: UnpublishOpts) {
  const cand = await prisma.guideCandidate.findUnique({ where: { id: opts.id } });
  if (!cand) throw new Error(`candidate not found: ${opts.id}`);
  if (!cand.publishedGuideId) {
    throw new Error(`candidate ${opts.id} is not published (no publishedGuideId)`);
  }
  const confirmed = await confirmDestructive({ yes: opts.yes, action: 'unpublish' });
  if (!confirmed) throw new Error('unpublish requires --yes confirmation');

  return prisma.guide.update({
    where: { id: cand.publishedGuideId },
    data: { published: false },
  });
}
