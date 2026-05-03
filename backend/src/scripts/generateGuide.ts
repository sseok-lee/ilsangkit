// Guide 자동 생성 — 슬림 버전
// 플로우: category → 트렌드 키워드 자동 발굴(LLM) → 심층 리서치 → 글 생성 → 저장
// Usage:
//   npm run generate:guide -- --category apt-sale
//   npm run generate:guide -- --category apt-sale --topic "스트레스 DSR"
//   npm run generate:guide -- --category apt-sale --dry-run
//   npm run generate:guide                              # 카테고리도 랜덤

import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import OpenAI from 'openai';
import { execFileSync } from 'child_process';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const GUIDE_CATEGORIES = [
  'toilet',
  'aed',
  'hospital',
  'pharmacy',
  'parking',
  'wifi',
  'clothes',
  'park',
  'school',
  'market',
  'library',
  'trash',
  'childcare',
  'ev-charger',
  'sports',
  'apt-sale',
  'apt-rent',
  'subscription',
  'public-rental',
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

const REAL_ESTATE_LIKE: readonly GuideCategory[] = ['apt-sale', 'apt-rent', 'subscription', 'public-rental'];

const CATEGORY_LABELS: Record<GuideCategory, string> = {
  toilet: '공공화장실',
  aed: '자동심장충격기',
  hospital: '병원',
  pharmacy: '약국',
  parking: '공영주차장',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  park: '공원',
  school: '학교',
  market: '전통시장',
  library: '공공도서관',
  trash: '쓰레기배출',
  childcare: '어린이집',
  'ev-charger': '전기차 충전소',
  sports: '체육시설',
  'apt-sale': '아파트 매매',
  'apt-rent': '아파트 전월세',
  subscription: '아파트 청약',
  'public-rental': '공공임대',
};

export function isGuideCategory(v: string): v is GuideCategory {
  return (GUIDE_CATEGORIES as readonly string[]).includes(v);
}

function isRealEstateLike(c: GuideCategory): boolean {
  return REAL_ESTATE_LIKE.includes(c);
}

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
// Naver search
// ---------------------------------------------------------------------------

export interface NaverSearchItem {
  title: string;
  description: string;
  link: string;
}

type NaverSearchType = 'news' | 'blog';

function stripHtmlTags(s: string): string {
  return s.replace(/<[^>]*>/g, '').trim();
}

export async function fetchNaverSearch(
  searchType: NaverSearchType,
  keyword: string,
  maxItems = 10
): Promise<NaverSearchItem[]> {
  const clientId = process.env.NAVER_CLIENT_ID;
  const clientSecret = process.env.NAVER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('NAVER_CLIENT_ID/SECRET 누락 — 리서치 스킵');
    return [];
  }

  const url = `https://openapi.naver.com/v1/search/${searchType}.json?query=${encodeURIComponent(keyword)}&display=${maxItems}&sort=date`;

  try {
    const res = await fetch(url, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`네이버 ${searchType} 검색 실패 ("${keyword}"): HTTP ${res.status}`);
      return [];
    }

    const data = (await res.json()) as { items?: NaverSearchItem[] };
    return (data.items ?? []).map((it) => ({
      title: stripHtmlTags(it.title),
      description: stripHtmlTags(it.description),
      link: it.link,
    }));
  } catch (err) {
    console.warn(`네이버 검색 에러 ("${keyword}"):`, err instanceof Error ? err.message : err);
    return [];
  }
}

function dedupItems(items: NaverSearchItem[]): NaverSearchItem[] {
  const seen = new Set<string>();
  const out: NaverSearchItem[] = [];
  for (const it of items) {
    const key = it.link || it.title;
    if (!it.title || seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Step 1: Trending keyword discovery (LLM-picked from fresh news)
// ---------------------------------------------------------------------------

export async function discoverTrendingKeyword(
  openai: OpenAI,
  category: GuideCategory,
  recentTitles: string[] = []
): Promise<string> {
  const label = CATEGORY_LABELS[category];
  const items = await fetchNaverSearch('news', label, 30);
  const titles = items.map((it) => it.title).slice(0, 30);

  if (titles.length === 0) {
    console.log(`⚠️ 뉴스 0건 — 카테고리 라벨로 fallback: "${label}"`);
    return label;
  }

  const avoidBlock =
    recentTitles.length > 0
      ? `\n\n최근 7일 내 이미 다룬 제목 (겹치지 마세요):\n${recentTitles
          .slice(0, 15)
          .map((t) => `- ${t}`)
          .join('\n')}`
      : '';

  const prompt = `다음은 [${label}] 관련 최근 뉴스 제목 ${titles.length}개입니다:
${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}

요즘 가장 화제가 되는 구체적이고 검색할 만한 키워드 1개를 뽑아주세요.
- 너무 일반적인 단어 금지 (예: "${label}", "정책" 같은 추상어)
- 구체적인 제도명·이슈명·사건명 선호 (예: "스트레스 DSR", "특별공급 개편")
- 2~8단어 길이
- 반드시 [${label}] 범주 안에서${avoidBlock}

JSON으로만 응답: { "keyword": "..." }`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.4,
      max_tokens: 200,
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    const keyword = String(parsed.keyword ?? '').trim();
    if (keyword.length < 2 || keyword.length > 60) {
      console.log(`⚠️ LLM 키워드 유효성 실패 — 라벨로 fallback`);
      return label;
    }
    return keyword;
  } catch (err) {
    console.warn('키워드 선정 실패 — 라벨로 fallback:', err instanceof Error ? err.message : err);
    return label;
  }
}

// ---------------------------------------------------------------------------
// Step 2: Deep research by selected keyword
// ---------------------------------------------------------------------------

export async function researchByKeyword(keyword: string): Promise<NaverSearchItem[]> {
  const [news, blog] = await Promise.all([
    fetchNaverSearch('news', keyword, 10),
    fetchNaverSearch('blog', keyword, 8),
  ]);
  return dedupItems([...news, ...blog]).slice(0, 15);
}

function formatResearchContext(keyword: string, items: NaverSearchItem[]): string {
  if (items.length === 0) return `주제: ${keyword}`;
  const lines = items.map(
    (it, i) => `${i + 1}. ${it.title}${it.description ? `\n   요약: ${it.description}` : ''}`
  );
  return `[리서치 자료]
주제: ${keyword}

${lines.join('\n')}
[/리서치 자료]

위 자료에서 확인되는 사실만 사용하세요. 자료에 없는 수치·조건·일정은 임의로 만들지 마세요.`;
}

// ---------------------------------------------------------------------------
// Step 3: Article generation (single template, 6 sections fixed)
// ---------------------------------------------------------------------------

const MIN_SECTION_COUNT = 5;
const MAX_SECTION_COUNT = 8;
const VALIDATION_MIN_CHARS = 2000;
const SECTION_MIN_CHARS = 200;
const REFERENCES_MIN_CHARS = 80;
const REFERENCES_MAX_CHARS = 500;

export function isSummaryHeading(h: string): boolean {
  return /요약|한눈에|미리\s*보기/.test(h);
}

export function isReferencesHeading(h: string): boolean {
  return /참고\s*자료|참고\s*링크|확인\s*채널|기준\s*시점.*참고/.test(h);
}

function sectionMinChars(heading: string): number {
  return isReferencesHeading(heading) ? REFERENCES_MIN_CHARS : SECTION_MIN_CHARS;
}

export interface ArticleResult {
  title: string;
  summary: string;
  content: string;
  keywords: string;
}

export function extractHeadings(content: string): string[] {
  return content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('## '))
    .map((l) => l.replace(/^##\s+/, '').trim());
}

function extractSectionBodies(content: string): Array<{ heading: string; body: string }> {
  const sections: Array<{ heading: string; body: string[] }> = [];
  let current: { heading: string; body: string[] } | null = null;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trimEnd();
    if (line.trim().startsWith('## ')) {
      if (current) sections.push(current);
      current = { heading: line.trim().replace(/^##\s+/, ''), body: [] };
      continue;
    }
    if (current) current.body.push(line);
  }
  if (current) sections.push(current);

  return sections.map((s) => ({ heading: s.heading, body: s.body.join('\n').trim() }));
}

export function validateArticleStructure(content: string): { valid: boolean; errors: string[] } {
  const headings = extractHeadings(content);
  const errors: string[] = [];

  if (headings.length < MIN_SECTION_COUNT || headings.length > MAX_SECTION_COUNT) {
    errors.push(
      `section count out of range: expected ${MIN_SECTION_COUNT}~${MAX_SECTION_COUNT}, got ${headings.length}`
    );
  }
  if (headings.length > 0 && !isSummaryHeading(headings[0])) {
    errors.push(`first section must be a summary-like heading, got "${headings[0]}"`);
  }
  if (headings.length > 0 && !isReferencesHeading(headings[headings.length - 1])) {
    errors.push(
      `last section must be a references-like heading, got "${headings[headings.length - 1]}"`
    );
  }

  const totalChars = content.trim().length;
  if (totalChars < VALIDATION_MIN_CHARS) {
    errors.push(`content too short: ${totalChars} chars < ${VALIDATION_MIN_CHARS}`);
  }

  if (errors.length === 0) {
    const sections = extractSectionBodies(content);
    const shortSections = sections.filter((s) => s.body.length < sectionMinChars(s.heading));
    if (shortSections.length > 0) {
      errors.push(
        `sections too short: ${shortSections
          .map((s) => `"${s.heading}"(${s.body.length} < ${sectionMinChars(s.heading)})`)
          .join(', ')}`
      );
    }
  }

  return { valid: errors.length === 0, errors };
}

export function stripDateMarkers(content: string): string {
  return content
    .replace(/\s*이\s*글은[^.\n]*?기준[^.\n]*?작성되었습니다\.?/g, '')
    .replace(/\s*20\d{2}년\s*\d{1,2}월(?:\s*\d{1,2}일)?\s*기준(?:으로|에|,)?/g, '')
    .replace(/\s*오늘(?:\s*날짜)?\s*기준(?:으로|에|,)?/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

export interface SectionPlan {
  heading: string;
  description: string;
}

export interface ArticleMeta {
  title: string;
  summary: string;
  keywords: string;
  sections: SectionPlan[];
}

async function generateArticleMeta(
  openai: OpenAI,
  category: GuideCategory,
  keyword: string,
  researchContext: string,
  dbStats: string
): Promise<ArticleMeta> {
  const label = CATEGORY_LABELS[category];
  const prompt = `아래 주제로 한국어 블로그 글의 제목·요약·키워드·섹션 구성을 설계해주세요.

<context>
카테고리: ${label}
주제 키워드: ${keyword}
${researchContext}
${dbStats}
</context>

<section-rules>
- 총 ${MIN_SECTION_COUNT}~${MAX_SECTION_COUNT}개의 섹션을 주제에 맞게 자유롭게 구성
- 첫 섹션은 반드시 "핵심 요약" 계열 (예: "핵심 요약", "한눈에 보기")
- 마지막 섹션은 반드시 "참고 자료" 계열 (예: "참고 자료", "공식 확인 채널")
- 중간 섹션은 주제에 가장 잘 맞는 구체적 제목으로 (일반적 "핵심 내용" 대신 "이번에 달라지는 3가지", "당번약국 찾는 방법" 같이 구체적으로)
- 각 섹션의 description은 그 섹션에서 무엇을 써야 할지 한 문장으로
</section-rules>

JSON으로만 응답:
{
  "title": "20~40자, 핵심이 드러나는 제목",
  "summary": "50~100자 요약",
  "keywords": "키워드1, 키워드2, 키워드3, 키워드4, 키워드5",
  "sections": [
    { "heading": "핵심 요약", "description": "독자가 가장 궁금해할 답을 먼저 제시" },
    { "heading": "...(주제별 구체적 제목)", "description": "..." },
    { "heading": "참고 자료", "description": "공식 확인 채널 목록" }
  ]
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 1200,
  });

  const parsed = JSON.parse(completion.choices[0].message.content ?? '{}') as Partial<ArticleMeta>;
  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const sections: SectionPlan[] = rawSections
    .map((s) => ({
      heading: String(s?.heading ?? '').trim(),
      description: String(s?.description ?? '').trim(),
    }))
    .filter((s) => s.heading.length > 0);

  return {
    title: String(parsed.title ?? '').trim(),
    summary: String(parsed.summary ?? '').trim(),
    keywords: String(parsed.keywords ?? '').trim(),
    sections,
  };
}

function inferSectionStyleHints(heading: string): string {
  if (isSummaryHeading(heading)) {
    return '글머리표 3~4개로 요점만 한눈에 스캔 가능하게. 긴 문단 금지. 200~400자.';
  }
  if (isReferencesHeading(heading)) {
    return `마크다운 리스트로 기관명(또는 사이트명) + 도메인만. 6~8줄 이내. ${REFERENCES_MIN_CHARS}~${REFERENCES_MAX_CHARS}자. 인사말/요약 문장 금지.`;
  }
  if (/확인|체크|단계|방법|절차|신청|따라/.test(heading)) {
    return '번호 리스트(1. 2. 3.) 우선. 각 항목은 짧고 행동 가능하게. 사이트명·도메인 명시. 500~800자.';
  }
  if (/주의|흔한|실수|오해|유의/.test(heading)) {
    return '불릿 리스트 위주. 각 항목 한두 줄로 짧게. 300~500자.';
  }
  if (/필요한\s*사람|대상|추천/.test(heading)) {
    return '짧게 2~3문장 또는 2~3개 불릿. 150~300자.';
  }
  return '리드 1~2문장 + 이어서 짧은 문단 2~3개 또는 리스트 조합. 한 문단 3~5문장 이내. 500~900자.';
}

async function generateSectionBody(
  openai: OpenAI,
  category: GuideCategory,
  keyword: string,
  researchContext: string,
  section: SectionPlan,
  meta: ArticleMeta
): Promise<string> {
  const label = CATEGORY_LABELS[category];
  const role = isRealEstateLike(category)
    ? '부동산·주거 정책 전문 기자'
    : '생활 정보 전문 기자';
  const { heading, description } = section;
  const isReferences = isReferencesHeading(heading);
  const styleHint = inferSectionStyleHints(heading);

  const prompt = `당신은 ${role}입니다. 아래 블로그 글의 "${heading}" 섹션 본문만 작성하세요.

<article>
제목: ${meta.title}
카테고리: ${label}
주제 키워드: ${keyword}
</article>

<context>
${researchContext}
</context>

<section>
이 섹션 제목: ${heading}
역할: ${description}
스타일·분량 힌트: ${styleHint}
</section>

<readability>
- 한 문장은 80자 이내로 짧게
- 한 문단은 3~5문장 이내, 긴 블록 금지
- 나열·단계형 정보는 "- " 불릿 또는 "1. " 번호 리스트로
- 중요 키워드·수치·사이트명은 **볼드** 강조
- 섹션 시작은 1~2문장 리드로 요점 먼저
- 비교·분류는 간단한 마크다운 표 활용 가능
</readability>

<rules>
- "${heading}" 섹션 본문만 작성 (섹션 제목 "## ${heading}" 라인은 출력 금지)
- 친절한 한국어 경어체
- 구체적 예시·사이트명·기관명·서류명·비용·절차 포함
- 리서치 자료에 없는 수치·금액·일정은 임의 생성 금지
- 본문에 "YYYY년 N월 기준", "오늘 기준", "이 글은 ~기준으로 작성되었습니다" 같은 날짜 메타 표기 일절 금지 (등록 날짜는 시스템이 따로 관리함)
- 코드 블록 금지, ## 헤더 금지 (본문만 출력)
</rules>

본문만 출력하세요:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: isReferences ? 500 : 1500,
  });

  return (completion.choices[0].message.content ?? '').trim();
}

export function normalizeSections(sections: SectionPlan[]): SectionPlan[] {
  const seen = new Set<string>();
  const cleaned: SectionPlan[] = [];
  for (const s of sections) {
    const heading = s.heading.replace(/^#+\s*/, '').trim();
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    cleaned.push({ heading, description: s.description.trim() });
  }
  if (cleaned.length === 0) return cleaned;

  if (!isSummaryHeading(cleaned[0].heading)) {
    cleaned.unshift({ heading: '핵심 요약', description: '독자가 가장 궁금해할 답을 먼저 제시' });
  }
  if (!isReferencesHeading(cleaned[cleaned.length - 1].heading)) {
    cleaned.push({ heading: '참고 자료', description: '공식 확인 채널 목록' });
  }
  return cleaned;
}

async function generateArticle(
  openai: OpenAI,
  category: GuideCategory,
  keyword: string,
  researchContext: string,
  dbStats: string
): Promise<ArticleResult> {
  const meta = await generateArticleMeta(openai, category, keyword, researchContext, dbStats);
  if (!meta.title || !meta.summary) {
    throw new Error('meta generation returned empty title/summary');
  }

  const sections = normalizeSections(meta.sections);
  if (sections.length < MIN_SECTION_COUNT || sections.length > MAX_SECTION_COUNT) {
    throw new Error(
      `meta returned ${sections.length} sections, expected ${MIN_SECTION_COUNT}~${MAX_SECTION_COUNT}`
    );
  }

  const sectionBodies: string[] = [];
  for (const section of sections) {
    let body = await generateSectionBody(openai, category, keyword, researchContext, section, meta);
    if (body.length < sectionMinChars(section.heading)) {
      body = await generateSectionBody(openai, category, keyword, researchContext, section, meta);
    }
    sectionBodies.push(body);
  }

  const rawContent = sections
    .map((s, i) => `## ${s.heading}\n\n${sectionBodies[i]}`)
    .join('\n\n');
  const content = stripDateMarkers(rawContent);

  const { valid, errors } = validateArticleStructure(content);
  if (!valid) {
    throw new Error(`assembled article failed validation: ${errors.join('; ')}`);
  }

  return {
    title: meta.title,
    summary: meta.summary,
    keywords: meta.keywords,
    content,
  };
}


// ---------------------------------------------------------------------------
// Step 4: Thumbnail
// ---------------------------------------------------------------------------

async function generateThumbnail(
  openai: OpenAI,
  category: GuideCategory,
  title: string,
  outputPath: string
): Promise<boolean> {
  try {
    const style = isRealEstateLike(category)
      ? 'Minimal clean illustration. No text, image only. Professional tone. Korean housing theme.'
      : 'Minimal clean illustration. No text, image only. Bright, friendly tone. Korean urban life theme.';

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: `Blog thumbnail. Title: "${title}". ${style}`,
      n: 1,
      size: '1024x1024',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) return false;

    const buffer = Buffer.from(b64, 'base64');
    await mkdir(path.dirname(outputPath), { recursive: true });
    const tmpPath = `${outputPath}.tmp.png`;
    await writeFile(tmpPath, buffer);

    try {
      execFileSync('convert', [tmpPath, '-resize', '800x', '-quality', '80', outputPath], {
        stdio: 'pipe',
      });
      const optimized = await stat(outputPath);
      console.log(
        `썸네일: ${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.size / 1024).toFixed(0)}KB`
      );
    } catch {
      await writeFile(outputPath, buffer);
      console.log(`썸네일 (리사이즈 스킵): ${(buffer.length / 1024).toFixed(0)}KB`);
    }

    await unlink(tmpPath).catch(() => {});
    return true;
  } catch (err) {
    console.warn('썸네일 생성 실패:', err instanceof Error ? err.message : err);
    return false;
  }
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
  'public-rental': ['subscription', 'apt-rent'],
};

function getHubUrl(c: GuideCategory): string {
  if (c === 'apt-sale') return '/real-estate/apt-sale';
  if (c === 'apt-rent') return '/real-estate/apt-rent';
  if (c === 'subscription') return '/real-estate/subscription';
  if (c === 'public-rental') return '/public-rental';
  return `/${c}`;
}

function getCta(c: GuideCategory): string {
  const label = CATEGORY_LABELS[c];
  if (c === 'subscription') return `일상킷에서 ${label} 정보를 바로 확인해보세요!`;
  if (c === 'public-rental') return `일상킷에서 ${label} 매물을 바로 확인해보세요!`;
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
// DB stats (facility only)
// ---------------------------------------------------------------------------

const FACILITY_COUNT: Partial<Record<GuideCategory, () => Promise<number>>> = {
  toilet: () => prisma.toilet.count(),
  aed: () => prisma.aed.count(),
  hospital: () => prisma.hospital.count(),
  pharmacy: () => prisma.pharmacy.count(),
  parking: () => prisma.parking.count(),
  wifi: () => prisma.wifi.count(),
  clothes: () => prisma.clothes.count(),
  park: () => prisma.park.count(),
  school: () => prisma.school.count(),
  market: () => prisma.market.count(),
  library: () => prisma.library.count(),
  trash: () => prisma.wasteSchedule.count(),
  childcare: () => prisma.childcare.count(),
  'ev-charger': () => prisma.evCharger.count(),
  sports: () => prisma.sports.count(),
};

async function getDbStats(category: GuideCategory): Promise<string> {
  const fn = FACILITY_COUNT[category];
  if (!fn) return '';
  try {
    const total = await fn();
    if (total === 0) return '';
    const unit = category === 'trash' ? '건 등록' : '개소 등록';
    return `\n일상킷 DB: ${CATEGORY_LABELS[category]} ${total.toLocaleString('ko-KR')}${unit}`;
  } catch {
    return '';
  }
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
