// Guide/Article 공유 생성 코어 — 모델-불가지론적 생성 파이프라인
// (트렌드 키워드 발굴 → 심층 리서치 → 섹션 설계 → 본문 생성 → 구조 검증 → 썸네일)
// generateGuide.ts, generateArticle.ts가 공통으로 재사용한다.

import 'dotenv/config';
import OpenAI from 'openai';
import { execFileSync } from 'child_process';
import { mkdir, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';

import prisma from '../lib/prisma.js';
import type { PolicyNewsItem } from './policyBriefingClient.js';

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
] as const;

export type GuideCategory = (typeof GUIDE_CATEGORIES)[number];

const REAL_ESTATE_LIKE: readonly GuideCategory[] = ['apt-sale', 'apt-rent', 'subscription'];

export const CATEGORY_LABELS: Record<GuideCategory, string> = {
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
};

export function isGuideCategory(v: string): v is GuideCategory {
  return (GUIDE_CATEGORIES as readonly string[]).includes(v);
}

export function isRealEstateLike(c: GuideCategory): boolean {
  return REAL_ESTATE_LIKE.includes(c);
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

export function dedupItems(items: NaverSearchItem[]): NaverSearchItem[] {
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

export function formatResearchContext(keyword: string, items: NaverSearchItem[]): string {
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

export function sectionMinChars(heading: string): number {
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

export async function generateArticleMeta(
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

<title-rules>
- 25~40자. 독자가 "내 얘기다" 싶게 구체적 대상·변화·이득을 담을 것
- 무엇이 → 누구에게 → 어떻게 달라지는지가 드러나게
- 숫자·핵심 변화를 앞에 (예: "3가지", "6개월 내", "이렇게 바뀐다")
- 금지: 과장어("충격·대박·필독"), 낚시 물음표 남발, 허위 긴급성, 근거 없는 단정
- 카테고리/지역 키워드를 자연스럽게 포함
</title-rules>

<section-rules>
- 총 ${MIN_SECTION_COUNT}~${MAX_SECTION_COUNT}개의 섹션을 주제에 맞게 자유롭게 구성
- 첫 섹션은 반드시 "핵심 요약" 계열 (예: "핵심 요약", "한눈에 보기")
- 마지막 섹션은 반드시 "참고 자료" 계열 (예: "참고 자료", "공식 확인 채널")
- 중간 섹션은 주제에 가장 잘 맞는 구체적 제목으로 (일반적 "핵심 내용" 대신 "이번에 달라지는 3가지", "당번약국 찾는 방법" 같이 구체적으로)
- 각 섹션의 description은 그 섹션에서 무엇을 써야 할지 한 문장으로
</section-rules>

JSON으로만 응답:
{
  "title": "25~40자, 구체적이고 눈이 가는 제목 (title-rules 준수)",
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

export async function generateSectionBody(
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

export async function generateArticle(
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

export async function generateThumbnail(
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
    } catch (e) {
      await unlink(tmpPath).catch(() => {});
      await unlink(outputPath).catch(() => {}); // convert가 outputPath를 부분 생성했을 수 있음 — 정리
      console.warn('썸네일 인코딩 실패(webp 변환 불가) — 초안 미생성:', e instanceof Error ? e.message : e);
      return false; // PNG를 .webp로 저장하지 않음(Safari 거부 방지). 호출부가 throw 처리.
    }

    await unlink(tmpPath).catch(() => {});
    return true;
  } catch (err) {
    console.warn('썸네일 생성 실패:', err instanceof Error ? err.message : err);
    return false;
  }
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

export async function getDbStats(category: GuideCategory): Promise<string> {
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
// 정책 브리핑 트랙 — 정책뉴스 원문 전문 기반 생성 앞단
// ---------------------------------------------------------------------------

// 생활정보 사이트 성격에 맞춰 국가 정책 커버리지가 있는 카테고리로 확장.
export const POLICY_FOCUS_CATEGORIES: GuideCategory[] = [
  'subscription', 'apt-sale', 'apt-rent', 'childcare',
  'hospital', 'pharmacy', 'park', 'trash',
  'school', 'library', 'market', 'ev-charger', 'sports',
];

// 카테고리를 '시설'이 아니라 '생활 주제'로 설명 — 정책(제도·요금·규제)은 시설 위치가 아니므로
// 이 주제 설명으로 물어야 진짜 매칭된다(예: 전기차 충전요금 개편→ev-charger, 도수치료 급여→hospital).
export const POLICY_CATEGORY_DOMAINS: Partial<Record<GuideCategory, string>> = {
  subscription: '주택청약',
  'apt-sale': '아파트매매·부동산시장',
  'apt-rent': '전세·월세·임대',
  childcare: '보육·육아·어린이집',
  hospital: '의료·건강·병원',
  pharmacy: '의약품·약국',
  park: '공원·녹지',
  trash: '폐기물·재활용·환경',
  school: '학교·교육',
  library: '도서관·독서',
  market: '전통시장·소상공인·골목상권',
  'ev-charger': '전기차·충전',
  sports: '체육·생활체육',
};

// 뉴스 트랙의 formatResearchContext와 동일 계약이되, 스니펫이 아닌 정책 원문 전문을 근거로 제공.
export function formatPolicyContext(item: PolicyNewsItem): string {
  const sub = item.subTitle ? `부제: ${item.subTitle}\n` : '';
  return `[정책 원문]
제목: ${item.title}
${sub}출처: 대한민국 정책브리핑(korea.kr)

${item.dataContents}
[/정책 원문]

위 정책 원문에서 확인되는 사실만 사용하세요. 원문에 없는 수치·조건·일정은 임의로 만들지 마세요.`;
}

export interface PolicyCandidate {
  item: PolicyNewsItem;
  category: GuideCategory;
  keyword: string;
}

// 후보 정책 목록에서 (a) 시민 관심도 높은 1건 (b) 포커스 카테고리 배정 (c) 주제 키워드를 뽑는다.
// 적합 후보가 없으면 null(억지 생성 방지).
export async function selectPolicyCandidate(
  openai: OpenAI,
  items: PolicyNewsItem[],
  focusCategories: GuideCategory[]
): Promise<PolicyCandidate | null> {
  if (items.length === 0) return null;

  const catList = focusCategories
    .map((c) => `${c}=${POLICY_CATEGORY_DOMAINS[c] ?? CATEGORY_LABELS[c]}`)
    .join(', ');
  const listing = items
    .map((it, i) => `${i}. [${it.ministerCode}] ${it.title} / ${it.subTitle}`)
    .join('\n');

  const prompt = `아래는 최근 정부 정책뉴스 ${items.length}건입니다.
${listing}

다음 '생활 주제' 중 하나에 실질적으로 해당하는(그 주제 독자가 관심 가질) 정책 1건을 고르세요.
주제: ${catList}

규칙:
- 그 주제의 제도·지원·요금·규제 변화면 해당됨(시설 위치가 아니어도 됨).
- 위 주제와 무관하거나(외교·국방·산업기술·행정내부 등) 단순 해명·보도설명 자료뿐이면 none.
- 억지로 끼워맞추지 말 것.
- keyword는 글 주제가 될 구체적인 2~8단어.

JSON으로만 응답: { "index": 0, "category": "apt-sale", "keyword": "..." } 또는 { "none": true }`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 200,
    });
    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    if (parsed.none === true) return null;

    const index = Number(parsed.index);
    const category = String(parsed.category ?? '').trim();
    const keyword = String(parsed.keyword ?? '').trim();

    if (!Number.isInteger(index) || index < 0 || index >= items.length) return null;
    if (!isGuideCategory(category) || !focusCategories.includes(category)) return null;
    if (keyword.length < 2 || keyword.length > 60) return null;

    return { item: items[index], category, keyword };
  } catch (err) {
    console.warn('정책 후보 선정 실패:', err instanceof Error ? err.message : err);
    return null;
  }
}
