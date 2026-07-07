// Guide 자동 생성 — 슬림 버전 (생성 코어는 services/articleGenerationCore.ts로 추출)
// 플로우: category → 트렌드 키워드 자동 발굴(LLM) → 심층 리서치 → 글 생성 → 저장
// Usage:
//   npm run generate:guide -- --category apt-sale
//   npm run generate:guide -- --category apt-sale --topic "스트레스 DSR"
//   npm run generate:guide -- --category apt-sale --dry-run
//   npm run generate:guide                              # 카테고리도 랜덤

import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import OpenAI from 'openai';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma from '../lib/prisma.js';
import {
  GUIDE_CATEGORIES,
  CATEGORY_LABELS,
  isGuideCategory,
  isRealEstateLike,
  discoverTrendingKeyword,
  researchByKeyword,
  formatResearchContext,
  generateArticle,
  generateThumbnail,
  getDbStats,
} from '../services/articleGenerationCore.js';
import type { GuideCategory } from '../services/articleGenerationCore.js';

// 테스트/외부 호환용 re-export (기존 import 경로 유지)
export {
  GUIDE_CATEGORIES,
  isGuideCategory,
  fetchNaverSearch,
  discoverTrendingKeyword,
  researchByKeyword,
  extractHeadings,
  validateArticleStructure,
  stripDateMarkers,
  normalizeSections,
  isSummaryHeading,
  isReferencesHeading,
} from '../services/articleGenerationCore.js';
export type { GuideCategory } from '../services/articleGenerationCore.js';

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

export interface CliOptions {
  category?: GuideCategory;
  topic?: string;
  dryRun: boolean;
}

export function parseCliOptions(args: string[] = process.argv.slice(2)): CliOptions {
  const read = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };

  const rawCategory = read('--category');
  const topic = read('--topic');
  const dryRun = args.includes('--dry-run');

  if (rawCategory && !isGuideCategory(rawCategory)) {
    throw new Error(`Unknown category "${rawCategory}". Valid: ${GUIDE_CATEGORIES.join(', ')}`);
  }

  return {
    category: rawCategory as GuideCategory | undefined,
    topic,
    dryRun,
  };
}

// ---------------------------------------------------------------------------
// Internal linking + CTA
// ---------------------------------------------------------------------------

const RELATED: Record<GuideCategory, GuideCategory[]> = {
  toilet: ['parking'],
  aed: ['hospital'],
  hospital: ['pharmacy', 'aed'],
  pharmacy: ['hospital'],
  parking: ['ev-charger'],
  wifi: [],
  clothes: ['trash'],
  park: ['sports', 'childcare'],
  school: ['childcare', 'library'],
  market: ['parking'],
  library: ['school'],
  trash: ['clothes'],
  childcare: ['school', 'park'],
  'ev-charger': ['parking'],
  sports: ['park'],
  'apt-sale': ['apt-rent', 'subscription'],
  'apt-rent': ['apt-sale', 'subscription'],
  subscription: ['apt-sale', 'apt-rent'],
};

function getHubUrl(c: GuideCategory): string {
  if (c === 'apt-sale') return '/real-estate/apt-sale';
  if (c === 'apt-rent') return '/real-estate/apt-rent';
  if (c === 'subscription') return '/real-estate/subscription';
  return `/${c}`;
}

function getCta(c: GuideCategory): string {
  const label = CATEGORY_LABELS[c];
  if (c === 'subscription') return `일상킷에서 ${label} 정보를 바로 확인해보세요!`;
  if (isRealEstateLike(c)) return `일상킷에서 ${label} 실거래가를 바로 확인해보세요!`;
  return `일상킷에서 내 주변 ${label} 정보를 바로 확인해보세요!`;
}

async function buildInternalLinks(category: GuideCategory, currentSlug: string): Promise<string> {
  const lines = ['## 함께 보면 좋은 글', ''];

  const same = await prisma.guide.findMany({
    where: { category, published: true, slug: { not: currentSlug } },
    select: { slug: true, title: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });
  for (const g of same) {
    lines.push(`- [${g.title}](/guide/${g.slug})`);
  }

  lines.push(`- [${CATEGORY_LABELS[category]} 전체 정보 보러가기](${getHubUrl(category)})`);

  const rel = RELATED[category]?.[0];
  if (rel) {
    lines.push(`- [${CATEGORY_LABELS[rel]} 정보도 함께 확인하기](${getHubUrl(rel)})`);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Recent duplicate check
// ---------------------------------------------------------------------------

async function getRecentTitles(category: GuideCategory, days = 7): Promise<string[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.guide.findMany({
    where: { category, createdAt: { gte: since } },
    select: { title: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  return rows.map((r) => r.title);
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

function generateSlug(category: GuideCategory): string {
  return `${category}-${createId()}`;
}

function pickRandomCategory(): GuideCategory {
  return GUIDE_CATEGORIES[Math.floor(Math.random() * GUIDE_CATEGORIES.length)];
}

export interface GeneratedGuide {
  id: string;
  slug: string;
  title: string;
  category: GuideCategory;
  keyword: string;
}

export async function generateOneGuide(options: {
  category?: GuideCategory;
  topic?: string;
}): Promise<GeneratedGuide> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY 환경변수가 필요합니다');

  const openai = new OpenAI({ apiKey });
  const category = options.category ?? pickRandomCategory();

  console.log(`카테고리: ${category} (${CATEGORY_LABELS[category]})`);

  let keyword: string;
  if (options.topic) {
    keyword = options.topic;
    console.log(`직접 지정 주제: "${keyword}"`);
  } else {
    console.log('트렌드 키워드 발굴 중...');
    const avoid = await getRecentTitles(category);
    keyword = await discoverTrendingKeyword(openai, category, avoid);
    console.log(`선정된 키워드: "${keyword}"`);
  }

  console.log('심층 리서치 중...');
  const research = await researchByKeyword(keyword);
  console.log(`수집된 자료: ${research.length}건`);
  const researchContext = formatResearchContext(keyword, research);

  const dbStats = await getDbStats(category);
  if (dbStats) console.log(`DB 통계:${dbStats}`);

  console.log('OpenAI 기사 생성 중...');
  const article = await generateArticle(openai, category, keyword, researchContext, dbStats);
  console.log(`제목: ${article.title}`);

  const slug = generateSlug(category);
  const cta = getCta(category);
  if (!article.content.includes(cta)) {
    article.content = `${article.content.trimEnd()}\n\n${cta}\n`;
  }
  const links = await buildInternalLinks(category, slug);
  article.content = `${article.content.trimEnd()}\n\n${links}\n`;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'guides', `${slug}.webp`);

  console.log('썸네일 생성 중...');
  const imageOk = await generateThumbnail(openai, category, article.title, imagePath);
  if (!imageOk) {
    throw new Error(`썸네일 생성 실패 — 글 등록 중단 (category: ${category})`);
  }
  const thumbnailUrl = `/api/images/guides/${slug}.webp`;

  console.log('DB 저장 중...');
  const guide = await prisma.guide.upsert({
    where: { slug },
    create: {
      slug,
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      articleType: 'news',
      keywords: article.keywords || null,
      thumbnailUrl,
      published: true,
    },
    update: {
      title: article.title,
      summary: article.summary,
      content: article.content,
      articleType: 'news',
      keywords: article.keywords || null,
      thumbnailUrl,
    },
  });

  console.log(`저장 완료: id=${guide.id}, slug=${guide.slug}`);

  return {
    id: guide.id,
    slug: guide.slug,
    title: article.title,
    category,
    keyword,
  };
}

// ---------------------------------------------------------------------------
// CLI entry
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseCliOptions();
  const category = options.category ?? pickRandomCategory();

  if (options.dryRun) {
    const apiKey = process.env.OPENAI_API_KEY;
    const openai = apiKey ? new OpenAI({ apiKey }) : null;

    let keyword = options.topic ?? '';
    if (!keyword && openai) {
      const avoid = await getRecentTitles(category);
      keyword = await discoverTrendingKeyword(openai, category, avoid);
    }

    console.log(
      JSON.stringify(
        {
          category,
          categoryLabel: CATEGORY_LABELS[category],
          keyword: keyword || '(OPENAI_API_KEY 없음 — 키워드 발굴 스킵)',
          dryRun: true,
        },
        null,
        2
      )
    );
    return;
  }

  await generateOneGuide({ category, topic: options.topic });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('완료');
      process.exitCode = 0;
    })
    .catch((err) => {
      console.error('실패:', err);
      process.exitCode = 1;
    })
    .finally(async () => {
      await prisma.$disconnect().catch(() => {});
    });
}
