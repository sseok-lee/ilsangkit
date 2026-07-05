// 시설 가이드 배치 draft 생성기
// 플로우: FACILITY_GUIDE_TOPICS 시드 → 카테고리/limit 필터 → 가이드 생성 → 썸네일 → Guide draft 저장
// Usage:
//   npm run generate:guide:drafts -- --dry-run --limit 2
//   npm run generate:guide:drafts -- --category parking --limit 5
//   npm run generate:guide:drafts -- --only-missing

import 'dotenv/config';
import path from 'path';
import { fileURLToPath } from 'url';
import { createId } from '@paralleldrive/cuid2';
import OpenAI from 'openai';
import prisma from '../lib/prisma.js';
import { GUIDE_CATEGORIES, isGuideCategory, type GuideCategory } from '../services/articleGenerationCore.js';
import { generateThumbnail } from '../services/articleGenerationCore.js';
import { generateGuideDraft } from '../services/guideDraftGeneration.js';
import { FACILITY_GUIDE_TOPICS, type GuideTopicSeed } from '../data/facilityGuideTopics.js';

export interface CliOptions {
  category?: GuideCategory;
  limit: number;
  dryRun: boolean;
  onlyMissing: boolean;
}

export function parseCliOptions(args: string[] = process.argv.slice(2)): CliOptions {
  const read = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const rawCategory = read('--category');
  if (rawCategory && !isGuideCategory(rawCategory)) {
    throw new Error(`Unknown category "${rawCategory}". Valid: ${GUIDE_CATEGORIES.join(', ')}`);
  }
  const rawLimit = Number(read('--limit') ?? '24');
  const limit = Number.isFinite(rawLimit) ? Math.max(1, Math.trunc(rawLimit)) : 24;
  return {
    category: rawCategory as GuideCategory | undefined,
    limit,
    dryRun: args.includes('--dry-run'),
    onlyMissing: args.includes('--only-missing'),
  };
}

export function selectQueue(topics: GuideTopicSeed[], opts: CliOptions): GuideTopicSeed[] {
  return topics.filter((t) => !opts.category || t.category === opts.category).slice(0, opts.limit);
}

export async function generateUniqueGuideSlug(category: GuideCategory, articleType: string): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const slug = `${category}-${articleType}-${createId()}`;
    const [a, g] = await Promise.all([
      prisma.article.findUnique({ where: { slug }, select: { id: true } }),
      prisma.guide.findUnique({ where: { slug }, select: { id: true } }),
    ]);
    if (!a && !g) return slug;
  }
  throw new Error('slug 충돌 회피 실패(5회 시도)');
}

async function alreadyExists(category: GuideCategory, topic: string): Promise<boolean> {
  const hit = await prisma.guide.findFirst({
    where: { category, title: { contains: topic } },
    select: { id: true },
  });
  return !!hit;
}

async function generateOneDraft(openai: OpenAI, seed: GuideTopicSeed): Promise<string> {
  const draft = await generateGuideDraft(openai, {
    category: seed.category, topic: seed.topic, articleType: seed.articleType,
  });

  const slug = await generateUniqueGuideSlug(seed.category, seed.articleType);

  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'guides', `${slug}.webp`);
  const imageOk = await generateThumbnail(openai, seed.category, draft.title, imagePath);
  if (!imageOk) throw new Error(`썸네일 생성 실패 — 초안 등록 중단 (${seed.category}/${seed.topic})`);
  const thumbnailUrl = `/api/images/guides/${slug}.webp`;

  const created = await prisma.guide.create({
    data: {
      slug,
      title: draft.title,
      summary: draft.summary,
      content: draft.content,
      category: seed.category,
      articleType: seed.articleType,
      keywords: draft.keywords || null,
      thumbnailUrl,
      published: false, // DRAFT
      publishedAt: null,
      // NOTE: Guide 모델엔 sources 컬럼이 없다 — 넣지 말 것
    },
    select: { id: true, slug: true },
  });
  console.log(`[guide] draft 저장: ${created.slug}`);
  return created.id;
}

async function main(): Promise<void> {
  const opts = parseCliOptions();
  const queue = selectQueue(FACILITY_GUIDE_TOPICS, opts);

  if (opts.dryRun) {
    console.log(JSON.stringify({ willGenerate: queue, ...opts }, null, 2));
    return;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  let ok = 0, skipped = 0, failed = 0;
  for (const seed of queue) {
    try {
      if (opts.onlyMissing && (await alreadyExists(seed.category, seed.topic))) {
        skipped += 1;
        console.log(`[guide] skip(exists): ${seed.category}/${seed.topic}`);
        continue;
      }
      await generateOneDraft(openai, seed);
      ok += 1;
    } catch (err) {
      failed += 1;
      console.error(`[guide] 실패 ${seed.category}/${seed.topic}:`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`[guide] 완료 — 생성 ${ok} / 스킵 ${skipped} / 실패 ${failed}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => { process.exitCode = 0; })
    .catch((err) => { console.error('실패:', err); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect().catch(() => {}); });
}
