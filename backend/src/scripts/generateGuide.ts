// Guide 자동 생성 스크립트
// Usage: tsx src/scripts/generateGuide.ts [--category <slug>]
// Pipeline: CLI args → RSS 뉴스 수집 → OpenAI 기사 생성 → 이미지 생성 → DB upsert

import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import { XMLParser } from 'fast-xml-parser';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import prisma from '../lib/prisma.js';

// ---------------------------------------------------------------------------
// Category configuration
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  toilet: ['공공화장실', '공중화장실 위생', '화장실 찾기', '화장실 리모델링', '스마트 화장실', '화장실 청결'],
  aed: ['자동심장충격기', 'AED 사용법', '심폐소생술', '심정지 응급처치', '골든타임 구조', 'AED 설치 확대'],
  hospital: ['병원 찾기', '야간진료', '응급실', '동네 의원 진료', '비대면 진료', '의료비 절약'],
  pharmacy: ['약국 영업시간', '야간약국', '처방전', '복약 지도', '일반의약품 편의점', '당번 약국'],
  parking: ['공영주차장', '주차요금', '주차장 찾기', '주차 요금 감면', '전기차 충전 주차', '스마트 주차'],
  wifi: ['공공와이파이', '무료인터넷', '공공WiFi', '와이파이 보안', '공공 인터넷 속도', '디지털 격차'],
  kiosk: ['무인민원', '주민등록등본 발급', '민원서류', '무인발급기 사용법', '전자증명서', '디지털 민원'],
  clothes: ['의류수거함', '헌옷 기부', '의류 재활용', '패스트패션 환경', '중고 의류 기부', '섬유 재활용'],
  library: ['공공도서관', '도서 대출', '독서', '전자도서관', '도서관 프로그램', '북스타트'],
  trash: ['쓰레기 분리수거', '재활용', '대형폐기물', '음식물 쓰레기 줄이기', '제로웨이스트', '분리배출 방법'],
};

const CATEGORY_LABELS: Record<string, string> = {
  toilet: '공공화장실',
  aed: '자동심장충격기',
  hospital: '병원',
  pharmacy: '약국',
  parking: '공영주차장',
  wifi: '무료와이파이',
  kiosk: '무인민원발급기',
  clothes: '의류수거함',
  library: '공공도서관',
  trash: '쓰레기배출',
};

const ALL_CATEGORIES = Object.keys(CATEGORY_KEYWORDS);

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseCategory(): string {
  const args = process.argv.slice(2);
  const idx = args.indexOf('--category');
  if (idx !== -1 && args[idx + 1]) {
    const cat = args[idx + 1];
    if (!ALL_CATEGORIES.includes(cat)) {
      console.error(`Unknown category "${cat}". Valid: ${ALL_CATEGORIES.join(', ')}`);
      process.exit(1);
    }
    return cat;
  }
  // Random category
  return ALL_CATEGORIES[Math.floor(Math.random() * ALL_CATEGORIES.length)];
}

// ---------------------------------------------------------------------------
// RSS fetch
// ---------------------------------------------------------------------------

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  parseTagValue: true,
  trimValues: true,
});

async function fetchNewsTitles(keyword: string, maxItems = 10): Promise<string[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ilsangkit-guide-bot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.warn(`RSS fetch failed for "${keyword}": HTTP ${res.status}`);
      return [];
    }
    const xml = await res.text();
    const parsed = xmlParser.parse(xml);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];
    const itemList = Array.isArray(items) ? items : [items];
    const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
    return itemList
      .filter((item: { pubDate?: string }) => {
        if (!item.pubDate) return false;
        const pubTime = new Date(item.pubDate).getTime();
        return !isNaN(pubTime) && pubTime >= oneDayAgo;
      })
      .slice(0, maxItems)
      .map((item: { title?: string | number }) => (item.title ? String(item.title).trim() : ''))
      .filter(Boolean);
  } catch (err) {
    console.warn(`RSS fetch error for "${keyword}":`, err instanceof Error ? err.message : err);
    return [];
  }
}

export async function collectNewsTitles(category: string): Promise<string[]> {
  const keywords = CATEGORY_KEYWORDS[category] ?? [];
  const allTitles: string[] = [];
  for (const kw of keywords) {
    const titles = await fetchNewsTitles(kw, 5);
    allTitles.push(...titles);
    if (allTitles.length >= 10) break;
  }
  // Deduplicate
  return [...new Set(allTitles)].slice(0, 10);
}

// ---------------------------------------------------------------------------
// Article template
// ---------------------------------------------------------------------------

const ARTICLE_TEMPLATE = `
## 최근 이슈: {뉴스에서 영감받은 소제목}
(수집된 뉴스 2~3건을 자연스럽게 언급하며 최근 동향 해설. 왜 지금 이 주제가 중요한지 맥락 제공. 3~4문단)

## {카테고리}, 제대로 알고 계신가요?
(이 시설/서비스의 정의, 위치, 법적 근거, 설치 기준 등 기본 정보. 역사적 배경이나 제도 변화 포함. 3~4문단)

## 똑똑하게 활용하는 방법
(이용 절차, 찾는 법, 사용법을 번호 리스트로 구체적 설명. 유용한 앱/웹사이트 소개 포함. 5개 이상 항목)

## 관련 제도와 정책
(이 시설/서비스와 관련된 법률, 조례, 정부 정책, 지자체 지원 제도 등을 2~3문단으로 설명)

## 자주 하는 실수와 해결법
(이용 시 흔히 하는 실수나 오해 3~5가지를 "**실수:** 설명 → **해결:** 올바른 방법" 형식으로 정리)

## 이것만은 꼭! 실용 꿀팁
(대부분 모르는 유용한 팁 5~7개. 각각 "**팁제목:** 설명" 형식의 리스트)

## 마무리
(핵심 2~3줄 요약 + "일상킷에서 내 주변 {카테고리}를 바로 찾아보세요!")
`;

// ---------------------------------------------------------------------------
// OpenAI article generation
// ---------------------------------------------------------------------------

interface ArticleResult {
  title: string;
  summary: string;
  content: string;
  keywords: string;
}

async function generateArticle(
  openai: OpenAI,
  category: string,
  newsTitles: string[],
): Promise<ArticleResult> {
  const categoryLabel = CATEGORY_LABELS[category] ?? category;

  const titlesBlock =
    newsTitles.length > 0
      ? newsTitles.join('\n')
      : `(최근 뉴스 없음 - ${categoryLabel} 관련 일반 생활 정보 기사 작성)`;

  const prompt = `당신은 생활 정보 전문 기자입니다.
최근 뉴스를 해설하고, 관련 실용 정보를 함께 제공하는 가이드 기사를 작성해주세요.

카테고리: ${categoryLabel} (${category})
참고 뉴스 제목:
${titlesBlock}

## 글 구조 (반드시 아래 7개 섹션을 순서대로 작성)

${ARTICLE_TEMPLATE.split('{카테고리}').join(categoryLabel)}

## 작성 규칙
- 전체 2500~3500자 분량 (반드시 2500자 이상)
- 마크다운 형식 (## 소제목, **강조**, - 리스트, 1. 번호 리스트)
- 참고 뉴스 제목을 자연스럽게 녹여서 해설 (원문 복사 금지)
- 독자가 바로 실천할 수 있는 구체적 정보 위주
- 각 섹션마다 2~4문단 또는 3개 이상의 리스트 항목 포함
- 친근하고 자연스러운 한국어 경어체
- 반드시 순수 한국어로 작성 (영어 단어 사용 금지, 고유명사/약어 제외)
- content 필드에 위 7개 섹션의 마크다운만 포함

다음 JSON 형식으로 응답:
{
  "title": "뉴스 트렌드를 반영한 흥미로운 제목",
  "summary": "1~2문장 요약 (검색/SNS용)",
  "content": "위 5개 섹션 구조의 마크다운 본문",
  "keywords": "키워드1, 키워드2, 키워드3, 키워드4, 키워드5"
}`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
  });

  const text = (completion.choices[0].message.content ?? '').trim();

  // Try to parse JSON, with sanitization for unescaped control characters
  function tryParseJson(raw: string): ArticleResult {
    try {
      return JSON.parse(raw) as ArticleResult;
    } catch {
      // Fix unescaped newlines/tabs inside JSON string values
      const sanitized = raw.replace(
        /("(?:[^"\\]|\\.)*")/g,
        (match) => match.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t'),
      );
      return JSON.parse(sanitized) as ArticleResult;
    }
  }

  function cleanArticle(parsed: ArticleResult): ArticleResult {
    const title = String(parsed.title ?? '').trim();
    const summary = String(parsed.summary ?? '').trim();
    const keywords = String(parsed.keywords ?? '').trim();

    // content 첫 줄이 title과 중복이면 제거
    let cleanContent = String(parsed.content ?? '').trim();
    const firstLine = cleanContent.split('\n')[0].replace(/^#{1,3}\s*/, '').trim();
    if (firstLine === title) {
      cleanContent = cleanContent.split('\n').slice(1).join('\n').trim();
    }

    return { title, summary, content: cleanContent, keywords };
  }

  try {
    const parsed = tryParseJson(text);
    return cleanArticle(parsed);
  } catch {
    // Fallback: extract JSON object via regex
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const fallback = tryParseJson(match[0]);
      return cleanArticle(fallback);
    }
    throw new Error(`Failed to parse OpenAI article JSON. Raw response:\n${text}`);
  }
}

// ---------------------------------------------------------------------------
// OpenAI image generation
// ---------------------------------------------------------------------------

async function generateThumbnail(
  openai: OpenAI,
  title: string,
  content: string,
  outputPath: string,
): Promise<boolean> {
  try {
    // 글 내용 요약을 포함한 이미지 프롬프트 생성
    const contentSummary = content.slice(0, 300);
    const imagePrompt = `Generate a blog thumbnail image.
Title: "${title}"
Context: ${contentSummary}
Style: Minimal clean illustration. No text, image only. Bright and friendly tone. Korean urban life theme.`;

    const response = await openai.images.generate({
      model: 'gpt-image-1',
      prompt: imagePrompt,
      n: 1,
      size: '1024x1024',
    });

    const imageData = response.data?.[0]?.b64_json;
    if (!imageData) {
      console.warn('이미지 데이터를 찾을 수 없습니다.');
      return false;
    }

    const buffer = Buffer.from(imageData, 'base64');
    await mkdir(path.dirname(outputPath), { recursive: true });

    // 원본 임시 저장 후 ImageMagick으로 800px WebP 리사이즈
    const tmpPath = outputPath + '.tmp.png';
    await writeFile(tmpPath, buffer);
    try {
      execSync(`convert "${tmpPath}" -resize 800x -quality 80 "${outputPath}"`, { stdio: 'pipe' });
      const { size: optimizedSize } = await import('fs').then(fs => fs.statSync(outputPath));
      console.log(`썸네일 저장: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB → ${(optimizedSize / 1024).toFixed(0)}KB)`);
    } catch {
      // ImageMagick 없으면 원본 그대로 저장
      await writeFile(outputPath, buffer);
      console.log(`썸네일 저장 (리사이즈 건너뜀): ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`);
    } finally {
      import('fs').then(fs => { try { fs.unlinkSync(tmpPath); } catch {} });
    }
    return true;
  } catch (err) {
    console.warn(
      '이미지 생성 실패 - thumbnailUrl을 null로 설정합니다:',
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

// ---------------------------------------------------------------------------
// Reusable guide generation (used by CLI and scheduler)
// ---------------------------------------------------------------------------

export interface GeneratedGuide {
  id: string;
  slug: string;
  title: string;
  category: string;
}

export async function generateOneGuide(category: string): Promise<GeneratedGuide | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다.');
  }

  const openai = new OpenAI({ apiKey });

  console.log(`카테고리: ${category} (${CATEGORY_LABELS[category]})`);

  // 1. Collect news titles from RSS
  console.log('뉴스 RSS 수집 중...');
  const newsTitles = await collectNewsTitles(category);
  console.log(`수집된 뉴스 제목 ${newsTitles.length}건:`);
  newsTitles.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));

  if (newsTitles.length === 0) {
    console.log('24시간 이내 관련 뉴스가 없어 글 생성을 건너뜁니다.');
    return null;
  }

  // 2. Generate article via OpenAI
  console.log('OpenAI 기사 생성 중...');
  const article = await generateArticle(openai, category, newsTitles);
  console.log(`기사 제목: ${article.title}`);

  // 3. Generate slug
  const cuid = createId();
  const slug = `${category}-${cuid}`;
  console.log(`슬러그: ${slug}`);

  // 4. Generate thumbnail image
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../../assets/images');
  const imagePath = path.join(uploadDir, 'guides', `${slug}.webp`);

  console.log('썸네일 이미지 생성 중...');
  const imageGenerated = await generateThumbnail(openai, article.title, article.content, imagePath);
  if (!imageGenerated) {
    throw new Error(`썸네일 이미지 생성 실패 - 글 등록을 중단합니다. (category: ${category})`);
  }
  const thumbnailUrl = `/api/images/guides/${slug}.webp`;

  // 5. Upsert Guide record in DB
  console.log('데이터베이스에 저장 중...');
  const guide = await prisma.guide.upsert({
    where: { slug },
    create: {
      slug,
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      keywords: article.keywords || null,
      thumbnailUrl,
      published: true,
    },
    update: {
      title: article.title,
      summary: article.summary,
      content: article.content,
      category,
      keywords: article.keywords || null,
      thumbnailUrl,
    },
  });

  console.log(`가이드 저장 완료: id=${guide.id}, slug=${guide.slug}`);
  return { id: guide.id, slug: guide.slug, title: article.title, category };
}

// ---------------------------------------------------------------------------
// Main (CLI)
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const category = parseCategory();
  const result = await generateOneGuide(category);
  if (!result) {
    console.log('24시간 이내 관련 뉴스가 없어 글 생성을 건너뛰었습니다.');
  }
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
    .then(() => {
      console.log('완료');
      process.exit(0);
    })
    .catch((error) => {
      console.error('실패:', error);
      process.exit(1);
    })
    .finally(() => {
      prisma.$disconnect().catch(() => {});
    });
}
