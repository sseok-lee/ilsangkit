// Guide 자동 생성 스크립트
// Usage: tsx src/scripts/generateGuide.ts [--category <slug>]
// Pipeline: CLI args → RSS 뉴스 수집 → OpenAI 기사 생성 → 이미지 생성 → DB upsert

import 'dotenv/config';
import { createId } from '@paralleldrive/cuid2';
import { XMLParser } from 'fast-xml-parser';
import OpenAI from 'openai';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';
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
  clothes: ['의류수거함', '헌옷 기부', '의류 재활용', '패스트패션 환경', '중고 의류 기부', '섬유 재활용'],
  park: ['공원 산책', '도시 공원 조성', '공원 운동시설', '근린공원', '어린이 놀이터', '공원 문화행사'],
  school: ['초등학교 입학', '학교 배정', '통학구역', '학교 정보 공개', '교육환경', '학구도'],
  market: ['전통시장 활성화', '재래시장', '상설시장', '시장 장날', '온누리상품권', '전통시장 주차'],
  library: ['공공도서관', '도서 대출', '독서', '전자도서관', '도서관 프로그램', '북스타트'],
  trash: ['쓰레기 분리수거', '재활용', '대형폐기물', '음식물 쓰레기 줄이기', '제로웨이스트', '분리배출 방법'],
  childcare: ['어린이집 찾기', '국공립 어린이집', '어린이집 입소 대기', '보육료 지원', '어린이집 안전', '직장 어린이집'],
  'ev-charger': ['전기차 충전소', '전기차 충전 요금', '급속 충전기', '충전 인프라 확대', '전기차 보조금', '공용 충전기'],
  sports: ['체육시설', '공공 체육관', '생활체육', '국민체육센터', '스포츠 강좌 바우처', '주민 체육시설'],
  'apt-sale': ['아파트 매매', '아파트 시세', '아파트 실거래가', '아파트 매수 전략', '부동산 매매 동향', '신축 아파트 분양'],
  'apt-rent': ['아파트 전세', '아파트 월세', '전월세 시세', '전세 사기 예방', '임대차 보호법', '전세 보증보험'],
  'villa-sale': ['빌라 매매', '연립다세대 매매', '빌라 투자', '빌라 실거래가', '다세대 주택 매매', '빌라 매수 주의사항'],
  'villa-rent': ['빌라 전세', '빌라 월세', '다세대 전월세', '빌라 전세 사기', '연립 전월세 시세', '빌라 임대차'],
  'offitel-sale': ['오피스텔 매매', '오피스텔 투자', '오피스텔 시세', '오피스텔 분양', '오피스텔 수익률', '오피스텔 실거래가'],
  'offitel-rent': ['오피스텔 전세', '오피스텔 월세', '오피스텔 임대', '오피스텔 전월세 시세', '오피스텔 관리비', '오피스텔 임대 수익'],
};

const CATEGORY_LABELS: Record<string, string> = {
  toilet: '공공화장실',
  aed: '자동심장충격기',
  hospital: '병원',
  pharmacy: '약국',
  parking: '공영주차장',
  wifi: '무료와이파이',
  clothes: '의류수거함',
  library: '공공도서관',
  trash: '쓰레기배출',
  park: '공원',
  school: '학교',
  market: '전통시장',
  childcare: '어린이집',
  'ev-charger': '전기차 충전소',
  sports: '체육시설',
  'apt-sale': '아파트 매매',
  'apt-rent': '아파트 전월세',
  'villa-sale': '빌라 매매',
  'villa-rent': '빌라 전월세',
  'offitel-sale': '오피스텔 매매',
  'offitel-rent': '오피스텔 전월세',
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

const REAL_ESTATE_CATEGORIES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'];

const ARTICLE_TEMPLATE_REAL_ESTATE = `
## 최근 이슈: {뉴스에서 영감받은 소제목}
(수집된 뉴스 2~3건을 자연스럽게 언급하며 최근 시장 동향 해설. 왜 지금 이 주제가 중요한지 맥락 제공. 반드시 3~4문단, 각 문단 3줄 이상)

## {카테고리} 시장, 지금 어떤 상황인가요?
(현재 시장 흐름, 가격 추이, 거래량 변화, 지역별 특성 등을 구체적 수치와 함께 설명. 반드시 3~4문단, 각 문단 3줄 이상)

## 똑똑하게 거래하는 방법
(거래 절차, 체크리스트, 유용한 사이트/앱을 번호 리스트로 구체적 설명. 반드시 7개 이상 항목, 각 항목 2줄 이상 설명)

## 관련 제도와 정책
(부동산 관련 세금, 대출 규제, 정부 정책, 청약 제도 등을 구체적으로 설명. 반드시 3~4문단, 각 문단 3줄 이상)

## 자주 하는 실수와 해결법
(거래 시 흔한 실수 5가지 이상. 아래 형식을 정확히 따를 것:

1. **실수 제목**
**이런 실수를 해요:** 구체적 상황 설명 (2~3줄)
**이렇게 해결하세요:** 올바른 방법과 근거 (2~3줄)

이 형식으로 5개 이상 작성. ### 소제목 사용 금지, 반드시 번호 리스트 + 볼드 형식 사용)

## 이것만은 꼭! 실용 꿀팁
(대부분 모르는 유용한 팁 7개 이상. 번호 리스트(1. 2. 3.)로 작성하고, 각 항목은 **팁 제목**으로 시작 후 구체적 설명 2줄 이상)

## 마무리
(핵심 3~4줄 요약 + "일상킷에서 {카테고리} 실거래가 정보를 바로 확인해보세요!")
`;

const ARTICLE_TEMPLATE = `
## 최근 이슈: {뉴스에서 영감받은 소제목}
(수집된 뉴스 2~3건을 자연스럽게 언급하며 최근 동향 해설. 왜 지금 이 주제가 중요한지 맥락 제공. 반드시 3~4문단, 각 문단 3줄 이상)

## {카테고리}, 제대로 알고 계신가요?
(이 시설/서비스의 정의, 위치, 법적 근거, 설치 기준 등 기본 정보. 역사적 배경이나 제도 변화 포함. 반드시 3~4문단, 각 문단 3줄 이상)

## 똑똑하게 활용하는 방법
(이용 절차, 찾는 법, 사용법을 번호 리스트로 구체적 설명. 유용한 앱/웹사이트 소개 포함. 반드시 7개 이상 항목, 각 항목 2줄 이상 설명)

## 관련 제도와 정책
(이 시설/서비스와 관련된 법률, 조례, 정부 정책, 지자체 지원 제도 등. 반드시 3~4문단, 각 문단 3줄 이상)

## 자주 하는 실수와 해결법
(이용 시 흔히 하는 실수나 오해 5가지 이상. 아래 형식을 정확히 따를 것:

1. **실수 제목**
**이런 실수를 해요:** 구체적 상황 설명 (2~3줄)
**이렇게 해결하세요:** 올바른 방법과 근거 (2~3줄)

이 형식으로 5개 이상 작성. ### 소제목 사용 금지, 반드시 번호 리스트 + 볼드 형식 사용)

## 이것만은 꼭! 실용 꿀팁
(대부분 모르는 유용한 팁 7개 이상. 번호 리스트(1. 2. 3.)로 작성하고, 각 항목은 **팁 제목**으로 시작 후 구체적 설명 2줄 이상)

## 마무리
(핵심 3~4줄 요약 + "일상킷에서 내 주변 {카테고리}를 바로 찾아보세요!")
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
  const isRealEstate = REAL_ESTATE_CATEGORIES.includes(category);

  const titlesBlock =
    newsTitles.length > 0
      ? newsTitles.join('\n')
      : `(최근 뉴스 없음 - ${categoryLabel} 관련 일반 생활 정보 기사 작성)`;

  const role = isRealEstate ? '부동산 전문 기자' : '생활 정보 전문 기자';
  const template = isRealEstate ? ARTICLE_TEMPLATE_REAL_ESTATE : ARTICLE_TEMPLATE;

  const prompt = `당신은 ${role}입니다.
최근 뉴스를 해설하고, 관련 실용 정보를 함께 제공하는 가이드 기사를 작성해주세요.

카테고리: ${categoryLabel} (${category})
참고 뉴스 제목:
${titlesBlock}

## 글 구조 (반드시 아래 7개 섹션을 순서대로 작성)

${template.split('{카테고리}').join(categoryLabel)}

## 작성 규칙 (매우 중요 — 반드시 전부 준수)
- **전체 3000~4500자 분량** (반드시 3000자 이상. 2500자 미만 절대 금지)
- **7개 섹션 전부 작성 필수** — 하나라도 빠지면 실패. 각 섹션은 반드시 "## " 마크다운 제목으로 시작
- 각 섹션마다 최소 3문단 또는 리스트 항목 5개 이상 포함 (1~2문단으로 끝내지 마세요)
- 마크다운 형식 (## 소제목, **강조**, - 리스트, 1. 번호 리스트)
- 참고 뉴스 제목을 자연스럽게 녹여서 해설 (원문 복사 금지)
- 독자가 바로 실천할 수 있는 구체적 정보 위주 (구체적 수치, 사이트명, 절차 포함)
- 친근하고 자연스러운 한국어 경어체
- 반드시 순수 한국어로 작성 (영어 단어 사용 금지, 고유명사/약어 제외)
- content 필드에 위 7개 섹션의 마크다운만 포함
- 응답 전 스스로 검증: ① "##"으로 시작하는 섹션이 7개인가? ② 전체 3000자 이상인가? ③ 각 섹션이 충분히 긴가?

다음 JSON 형식으로 응답:
{
  "title": "뉴스 트렌드를 반영한 흥미로운 제목 (20~40자)",
  "summary": "1~2문장 요약 (검색/SNS용, 50~100자)",
  "content": "위 7개 섹션 구조의 마크다운 본문 (3000자 이상)",
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
  imageStyle?: string,
): Promise<boolean> {
  try {
    // 글 내용 요약을 포함한 이미지 프롬프트 생성
    const contentSummary = content.slice(0, 300);
    const style = imageStyle ?? 'Minimal clean illustration. No text, image only. Bright and friendly tone. Korean urban life theme.';
    const imagePrompt = `Generate a blog thumbnail image.
Title: "${title}"
Context: ${contentSummary}
Style: ${style}`;

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

    // sharp로 800px WebP 리사이즈
    const optimized = await sharp(buffer)
      .resize(800, null, { withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
    await writeFile(outputPath, optimized);
    console.log(`썸네일 저장: ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.length / 1024).toFixed(0)}KB)`);
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
  const isRealEstate = REAL_ESTATE_CATEGORIES.includes(category);
  const imageStyle = isRealEstate
    ? 'Minimal clean illustration. No text, image only. Professional and modern tone. Korean real estate and apartment theme.'
    : undefined;
  const imageGenerated = await generateThumbnail(openai, article.title, article.content, imagePath, imageStyle);
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
