// 오늘의 이슈(/article) 자동 생성 — draft 생성기
// 플로우: category → 트렌드 키워드 발굴 → 리서치 → 기사 생성 → 썸네일 → Article draft 저장
// Usage:
//   npm run generate:article -- --count 3
//   npm run generate:article -- --category pharmacy --topic "야간 약국"
//   npm run generate:article -- --dry-run

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
  formatPolicyContext,
  selectPolicyCandidate,
  POLICY_FOCUS_CATEGORIES,
} from '../services/articleGenerationCore.js';
import type { GuideCategory, NaverSearchItem } from '../services/articleGenerationCore.js';
import { fetchRecentPolicyWindows } from '../services/policyBriefingClient.js';
import type { PolicyNewsItem } from '../services/policyBriefingClient.js';

export interface ArticleCliOptions {
  category?: GuideCategory;
  topic?: string;
  count: number;
  dryRun: boolean;
  track: 'news' | 'policy';
}

export function parseArticleCliOptions(args: string[] = process.argv.slice(2)): ArticleCliOptions {
  const read = (name: string): string | undefined => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1] : undefined;
  };
  const rawCategory = read('--category');
  if (rawCategory && !isGuideCategory(rawCategory)) {
    throw new Error(`Unknown category "${rawCategory}". Valid: ${GUIDE_CATEGORIES.join(', ')}`);
  }
  const rawCount = Number(read('--count') ?? '3');
  const count = Number.isFinite(rawCount) ? Math.min(3, Math.max(1, Math.trunc(rawCount))) : 3;
  const rawTrack = read('--track');
  const track: 'news' | 'policy' = rawTrack === 'policy' ? 'policy' : 'news';
  return {
    category: rawCategory as GuideCategory | undefined,
    topic: read('--topic'),
    count,
    dryRun: args.includes('--dry-run'),
    track,
  };
}

// 오늘의 이슈 내부링크는 /article/ 경로로. 광고 CTA 아닌 "다음 확인 행동".
function getArticleHubUrl(c: GuideCategory): string {
  if (c === 'apt-sale') return '/real-estate/apt-sale';
  if (c === 'apt-rent') return '/real-estate/apt-rent';
  if (c === 'subscription') return '/real-estate/subscription';
  return `/${c}`;
}

const RELATED_HUB: Partial<Record<GuideCategory, GuideCategory>> = {
  toilet: 'parking', aed: 'hospital', hospital: 'pharmacy', pharmacy: 'hospital',
  parking: 'ev-charger', clothes: 'trash', park: 'sports', school: 'childcare',
  market: 'parking', library: 'school', trash: 'clothes', childcare: 'school',
  'ev-charger': 'parking', sports: 'park', 'apt-sale': 'subscription',
  'apt-rent': 'apt-sale', subscription: 'apt-sale',
};

export async function buildArticleInternalLinks(category: GuideCategory, currentSlug: string): Promise<string> {
  const lines = ['## 함께 보면 좋은 이슈', ''];
  const same = await prisma.article.findMany({
    where: { category, status: 'published', slug: { not: currentSlug } },
    select: { slug: true, title: true },
    orderBy: { publishedAt: 'desc' },
    take: 3,
  });
  for (const a of same) lines.push(`- [${a.title}](/article/${a.slug})`);
  lines.push(`- [${CATEGORY_LABELS[category]} 전체 정보 보러가기](${getArticleHubUrl(category)})`);
  const rel = RELATED_HUB[category];
  if (rel) lines.push(`- [${CATEGORY_LABELS[rel]} 정보도 함께 확인하기](${getArticleHubUrl(rel)})`);
  return lines.join('\n');
}

function getArticleCta(c: GuideCategory): string {
  const label = CATEGORY_LABELS[c];
  if (c === 'subscription') return `일상킷에서 ${label} 정보를 바로 확인해보세요.`;
  if (isRealEstateLike(c)) return `일상킷에서 ${label} 실거래가를 바로 확인해보세요.`;
  return `일상킷에서 내 주변 ${label} 정보를 바로 확인해보세요.`;
}

// 데이터 수집 최대화: 리서치에 사용한 소스 전량 저장.
export function toSources(items: NaverSearchItem[]): Array<{ title: string; url: string }> {
  return items.filter((it) => it.link).map((it) => ({ title: it.title, url: it.link }));
}

// 최근 중복 회피: article + guide(이전된 news 포함) 교차 조회.
export async function getRecentTitlesCrossTable(category: GuideCategory, days = 7): Promise<string[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const [articles, guides] = await Promise.all([
    prisma.article.findMany({ where: { category, createdAt: { gte: since } }, select: { title: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.guide.findMany({ where: { category, createdAt: { gte: since } }, select: { title: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
  ]);
  return [...articles, ...guides].map((r) => r.title);
}

// 교차 테이블 slug 유일성 보장(/guide/x·/article/x 근접중복 방지).
export async function generateUniqueArticleSlug(category: GuideCategory): Promise<string> {
  for (let i = 0; i < 5; i += 1) {
    const slug = `${category}-${createId()}`;
    const [a, g] = await Promise.all([
      prisma.article.findUnique({ where: { slug }, select: { id: true } }),
      prisma.guide.findUnique({ where: { slug }, select: { id: true } }),
    ]);
    if (!a && !g) return slug;
  }
  throw new Error('slug 충돌 회피 실패(5회 시도)');
}

function pickRandomCategory(): GuideCategory {
  return GUIDE_CATEGORIES[Math.floor(Math.random() * GUIDE_CATEGORIES.length)];
}

export interface GeneratedArticle {
  id: string;
  slug: string;
  title: string;
  category: GuideCategory;
  keyword: string;
}

export async function generateOneArticle(options: { category?: GuideCategory; topic?: string }): Promise<GeneratedArticle> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY 환경변수가 필요합니다');

  const openai = new OpenAI({ apiKey });
  const category = options.category ?? pickRandomCategory();
  console.log(`[article] 카테고리: ${category} (${CATEGORY_LABELS[category]})`);

  let keyword: string;
  if (options.topic) {
    keyword = options.topic;
  } else {
    const avoid = await getRecentTitlesCrossTable(category);
    keyword = await discoverTrendingKeyword(openai, category, avoid);
  }
  console.log(`[article] 키워드: "${keyword}"`);

  const research = await researchByKeyword(keyword);
  const researchContext = formatResearchContext(keyword, research);
  const dbStats = await getDbStats(category);

  const article = await generateArticle(openai, category, keyword, researchContext, dbStats);

  const slug = await generateUniqueArticleSlug(category);
  const cta = getArticleCta(category);
  if (!article.content.includes(cta)) {
    article.content = `${article.content.trimEnd()}\n\n${cta}\n`;
  }
  const links = await buildArticleInternalLinks(category, slug);
  article.content = `${article.content.trimEnd()}\n\n${links}\n`;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'articles', `${slug}.webp`);

  const imageOk = await generateThumbnail(openai, category, article.title, imagePath);
  if (!imageOk) {
    throw new Error(`썸네일 생성 실패 — 오늘의 이슈 등록 중단 (category: ${category})`);
  }
  const thumbnailUrl = `/api/images/articles/${slug}.webp`;

  const created = await prisma.article.create({
    data: {
      slug,
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      articleType: 'news-brief',
      keywords: article.keywords || null,
      thumbnailUrl,
      sources: toSources(research),
      status: 'draft',
      publishedAt: null,
    },
  });
  console.log(`[article] draft 저장: id=${created.id}, slug=${created.slug}`);

  return { id: created.id, slug: created.slug, title: article.title, category, keyword };
}

// 이미 쓴 정책 제외 — Article.sourceExternalId 기준.
export async function filterUnseenPolicyItems(items: PolicyNewsItem[]): Promise<PolicyNewsItem[]> {
  const ids = items.map((it) => it.newsItemId).filter(Boolean);
  if (ids.length === 0) return [];
  const seen = await prisma.article.findMany({
    where: { sourceExternalId: { in: ids } },
    select: { sourceExternalId: true },
  });
  const seenSet = new Set(seen.map((r) => r.sourceExternalId));
  return items.filter((it) => !seenSet.has(it.newsItemId));
}

// 정책 브리핑 트랙: 정책뉴스 원문 전문 1건을 골라 그 근거로 draft 생성.
// 적합 후보가 없으면 null(무생성). 뉴스 트랙과 달리 키워드 발굴 대신 정책 항목이 주제가 된다.
export async function generateOnePolicyArticle(
  options: { lookbackDays?: number } = {}
): Promise<GeneratedArticle | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY 환경변수가 필요합니다');
  const openai = new OpenAI({ apiKey });

  const raw = await fetchRecentPolicyWindows(options.lookbackDays ?? 9);
  const unseen = await filterUnseenPolicyItems(raw);
  const candidate = await selectPolicyCandidate(openai, unseen, POLICY_FOCUS_CATEGORIES);
  if (!candidate) {
    console.log('[policy] 적합한 신규 정책 후보 없음 — 무생성 종료');
    return null;
  }
  const { item, category, keyword } = candidate;
  console.log(`[policy] 선정: "${item.title}" → ${category} / "${keyword}"`);

  const researchContext = formatPolicyContext(item);
  const dbStats = await getDbStats(category);
  const article = await generateArticle(openai, category, keyword, researchContext, dbStats);

  const slug = await generateUniqueArticleSlug(category);
  const cta = getArticleCta(category);
  if (!article.content.includes(cta)) {
    article.content = `${article.content.trimEnd()}\n\n${cta}\n`;
  }
  const links = await buildArticleInternalLinks(category, slug);
  article.content = `${article.content.trimEnd()}\n\n${links}\n`;

  // 출처 표기(공공누리 제1유형) — 항상 삽입.
  const attribution = `> 출처: 대한민국 정책브리핑(korea.kr)${
    item.originalUrl ? ` · [원문 보기](${item.originalUrl})` : ''
  }`;
  article.content = `${article.content.trimEnd()}\n\n${attribution}\n`;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'articles', `${slug}.webp`);

  const imageOk = await generateThumbnail(openai, category, article.title, imagePath);
  if (!imageOk) {
    throw new Error(`썸네일 생성 실패 — 오늘의 이슈(정책) 등록 중단 (category: ${category})`);
  }
  const thumbnailUrl = `/api/images/articles/${slug}.webp`;

  const created = await prisma.article.create({
    data: {
      slug,
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      articleType: 'policy-brief',
      keywords: article.keywords || null,
      thumbnailUrl,
      sources: [{ title: item.title, url: item.originalUrl }],
      sourceExternalId: item.newsItemId,
      status: 'draft',
      publishedAt: null,
    },
  });
  console.log(`[policy] draft 저장: id=${created.id}, slug=${created.slug}`);

  return { id: created.id, slug: created.slug, title: article.title, category, keyword };
}

export async function generateArticles(count: number, opts: { category?: GuideCategory } = {}): Promise<GeneratedArticle[]> {
  const out: GeneratedArticle[] = [];
  for (let i = 0; i < count; i += 1) {
    try {
      out.push(await generateOneArticle({ category: opts.category }));
    } catch (err) {
      console.error(`[article] 후보 ${i + 1}/${count} 실패:`, err instanceof Error ? err.message : err);
    }
  }
  return out;
}

async function main(): Promise<void> {
  const options = parseArticleCliOptions();
  if (options.track === 'policy') {
    await generateOnePolicyArticle();
    return;
  }
  if (options.dryRun) {
    const category = options.category ?? pickRandomCategory();
    console.log(JSON.stringify({ category, categoryLabel: CATEGORY_LABELS[category], count: options.count, dryRun: true }, null, 2));
    return;
  }
  if (options.category || options.topic) {
    await generateOneArticle({ category: options.category, topic: options.topic });
  } else {
    await generateArticles(options.count);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => { console.log('완료'); process.exitCode = 0; })
    .catch((err) => { console.error('실패:', err); process.exitCode = 1; })
    .finally(async () => { await prisma.$disconnect().catch(() => {}); });
}
