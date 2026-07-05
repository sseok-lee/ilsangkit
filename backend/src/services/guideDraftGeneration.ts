import type OpenAI from 'openai';
import {
  CATEGORY_LABELS,
  isRealEstateLike,
  extractHeadings,
  stripDateMarkers,
  getDbStats,
  researchByKeyword,
  formatResearchContext,
  type GuideCategory,
} from './articleGenerationCore.js';

export type GuideArticleType = 'howto' | 'guide';

export interface GuideDraftResult {
  title: string;
  summary: string;
  content: string;
  keywords: string;
}

export function validateGuideDraftStructure(
  content: string,
  articleType: GuideArticleType
): { valid: boolean; errors: string[] } {
  const headings = extractHeadings(content);
  const errors: string[] = [];
  const has = (re: RegExp) => headings.some((h) => re.test(h));

  if (articleType === 'howto' && !has(/단계별\s*방법/)) {
    errors.push('howto requires a "단계별 방법" section');
  }
  if (!has(/자주\s*묻는\s*질문/)) {
    errors.push('requires a "자주 묻는 질문" (FAQ) section');
  }
  if (articleType === 'howto' && !/^\s*\d+\.\s+\*\*.+\*\*/m.test(content)) {
    errors.push('howto steps must be "1. **name**\\n text" formatted');
  }
  // 프론트 FAQ 정규식과 동일 형태로 최소 3개 파싱되는지 확인
  const faqCount = [...content.matchAll(/\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*([\s\S]*?)(?=\n\*\*Q\.|$)/g)].length;
  if (faqCount < 3) {
    errors.push(`FAQ items must be "**Q. ...**\\nA. ..." and >=3 (got ${faqCount})`);
  }
  if (content.trim().length < 1200) {
    errors.push(`content too short: ${content.trim().length} chars`);
  }
  return { valid: errors.length === 0, errors };
}

async function generateGuideMeta(
  openai: OpenAI,
  category: GuideCategory,
  topic: string,
  articleType: GuideArticleType,
  researchContext: string,
  dbStats: string
): Promise<{ title: string; summary: string; keywords: string }> {
  const label = CATEGORY_LABELS[category];
  const kind = articleType === 'howto' ? '따라 하기만 하면 되는 실전 방법 안내' : '개념·기준을 정리한 안내';
  const prompt = `당신은 시의성 뉴스가 아니라 오래 유효한 "생활 정보 가이드"를 쓰는 편집자입니다.
아래 주제로 한국어 가이드 글의 제목·요약·키워드를 설계하세요. (${kind})

<context>
카테고리: ${label}
주제: ${topic}
${researchContext}
${dbStats}
</context>

- 특정 연도·시점에 의존하지 않는 "에버그린" 제목(연도/날짜 금지)
- 검색 의도에 바로 답하는 실용적 제목

JSON으로만 응답:
{ "title": "20~40자", "summary": "50~100자", "keywords": "키워드1, 키워드2, 키워드3, 키워드4, 키워드5" }`;

  const c = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
    max_tokens: 600,
  });
  const p = JSON.parse(c.choices[0]?.message?.content ?? '{}');
  return {
    title: String(p.title ?? '').trim(),
    summary: String(p.summary ?? '').trim(),
    keywords: String(p.keywords ?? '').trim(),
  };
}

async function generateGuideBody(
  openai: OpenAI,
  category: GuideCategory,
  topic: string,
  articleType: GuideArticleType,
  researchContext: string,
  dbStats: string,
  title: string
): Promise<string> {
  const label = CATEGORY_LABELS[category];
  const role = isRealEstateLike(category)
    ? '부동산·주거 정보를 알기 쉽게 정리하는 생활 가이드 에디터'
    : '생활 정보를 알기 쉽게 정리하는 생활 가이드 에디터';

  const stepBlock =
    articleType === 'howto'
      ? `## 단계별 방법
- 3~8개의 순서를 반드시 번호 리스트로 작성
- 각 단계는 정확히 이 형식: \`1. **단계 이름**\\n   설명 문장\`
- 각 단계는 행동 가능하게, 사이트명·서류명·비용을 구체적으로

`
      : '';

  const prompt = `당신은 ${role}입니다. "${title}" 가이드 본문을 마크다운으로 작성하세요.

<context>
카테고리: ${label}
주제: ${topic}
${researchContext}
${dbStats}
</context>

<structure>
아래 "## " 섹션 제목을 그대로 사용하고 순서를 지키세요.
## 개요
- 2~3문장으로 이 글이 답하는 문제와 결론 요약

(주제에 맞는 "## 소제목" 1~3개를 추가로 작성 — 자유 제목)

${stepBlock}## 자주 묻는 질문
- 3~5개 문답
- 각 항목은 정확히 이 형식: \`**Q. 질문?**\\nA. 답변.\`
</structure>

<rules>
- 친절한 한국어 경어체, 한 문장 80자 이내
- "YYYY년 N월 기준", "오늘 기준" 등 날짜 표기 금지(에버그린)
- 리서치 자료에 없는 수치·금액은 임의 생성 금지
- 코드 블록 금지
- 일상킷(사이트)에서 해당 시설을 찾을 수 있음을 자연스럽게 1회 언급
</rules>

마크다운 본문만 출력하세요:`;

  const c = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.5,
    max_tokens: 2500,
  });
  return (c.choices[0]?.message?.content ?? '').trim();
}

export async function generateGuideDraft(
  openai: OpenAI,
  opts: { category: GuideCategory; topic: string; articleType: GuideArticleType }
): Promise<GuideDraftResult> {
  const { category, topic, articleType } = opts;

  // 선택적 그라운딩 — 실패해도 계속
  let researchContext = '';
  try {
    const research = await researchByKeyword(topic);
    researchContext = formatResearchContext(topic, research);
  } catch {
    researchContext = '';
  }
  let dbStats = '';
  try {
    dbStats = await getDbStats(category);
  } catch {
    dbStats = '';
  }

  const meta = await generateGuideMeta(openai, category, topic, articleType, researchContext, dbStats);
  if (!meta.title || !meta.summary) throw new Error('guide meta returned empty title/summary');

  const rawBody = await generateGuideBody(openai, category, topic, articleType, researchContext, dbStats, meta.title);
  const content = stripDateMarkers(rawBody);

  const { valid, errors } = validateGuideDraftStructure(content, articleType);
  if (!valid) throw new Error(`guide draft failed validation: ${errors.join('; ')}`);

  return { title: meta.title, summary: meta.summary, keywords: meta.keywords, content };
}
