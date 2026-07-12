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

  // FAQ: 프론트와 동일하게 "## 자주 묻는 질문" 블록을 먼저 잘라 그 안에서만 Q/A 카운트
  if (!has(/자주\s*묻는\s*질문/)) {
    errors.push('requires a "자주 묻는 질문" (FAQ) section');
  } else {
    const faqBlock = content.match(/## 자주 묻는 질문[\s\S]*?(?=\n## |$)/)?.[0] ?? '';
    const faqCount = [...faqBlock.matchAll(/\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*([\s\S]*?)(?=\n\*\*Q\.|$)/g)].length;
    if (faqCount < 3) {
      errors.push(`FAQ items must be "**Q. ...**\\nA. ..." within the FAQ section and >=3 (got ${faqCount})`);
    }
  }

  // howto: "## 단계별 방법" 블록 안에서 번호 단계 >=3 강제
  if (articleType === 'howto') {
    if (!has(/단계별\s*방법/)) {
      errors.push('howto requires a "단계별 방법" section');
    } else {
      const stepBlock = content.match(/## 단계별 방법[\s\S]*?(?=\n## |$)/)?.[0] ?? '';
      const stepCount = [...stepBlock.matchAll(/\d+\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\d+\.\s*\*\*|$)/g)].length;
      if (stepCount < 3) {
        errors.push(`howto "단계별 방법" needs >=3 steps formatted "1. **name**\\n text" (got ${stepCount})`);
      }
    }
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
- summary는 '해요체'로 끝맺고("…해요/…이에요"), "~를 안내합니다 / ~를 살펴봅니다" 같은 상투적 소개형 종결을 쓰지 마세요.

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

  // howto는 "## 단계별 방법"에 번호 단계 4개 이상을 예시 형식으로 강제한다.
  const stepSection =
    articleType === 'howto'
      ? `## 단계별 방법
1. **첫 번째 단계 이름**
   이 단계에서 실제로 무엇을 하는지 2~3문장으로 구체적으로 씁니다. 앱·사이트·서류·요금 등 실물 정보를 포함합니다.
2. **두 번째 단계 이름**
   2~3문장.
3. **세 번째 단계 이름**
   2~3문장.
4. **네 번째 단계 이름**
   2~3문장.
(단계는 최소 4개. 각 줄은 반드시 "번호. **단계 이름**" 다음 줄에 설명.)

`
      : '';

  // guide는 단계별 방법이 없어 본문 섹션을 3개로 늘려 분량을 확보한다.
  const bodySections =
    articleType === 'howto'
      ? `## 알아두면 좋은 배경
관련 배경·기준·유의점을 4~6문장으로 설명합니다.

## 주의사항과 팁
실전 팁·자주 하는 실수·유의점을 4~6문장으로 설명합니다.

`
      : `## 핵심 포인트
개념·차이·기준을 4~6문장으로 설명합니다.

## 자세한 이용 방법
실제 이용 절차·조건·준비물을 5~7문장으로 구체적으로 설명합니다.

## 주의사항과 팁
자주 하는 실수·유의점·꿀팁을 4~6문장으로 설명합니다.

`;

  const prompt = `당신은 ${role}입니다. "${title}"에 대한 실용 가이드 본문을 한국어 마크다운으로 작성합니다.

<참고>
카테고리: ${label}
주제: ${topic}
${researchContext}
${dbStats}
</참고>

아래 골격을 **그대로** 따르되 각 부분을 충분히 상세히 채웁니다. **전체 분량은 공백 포함 1800자 이상**이어야 합니다(짧으면 안 됩니다).

## 개요
이 글이 해결하는 문제와 핵심 결론을 3~4문장으로 설명합니다.

${bodySections}${stepSection}## 자주 묻는 질문
**Q. 자주 나오는 질문 1?**
A. 2~3문장 답변.
**Q. 자주 나오는 질문 2?**
A. 2~3문장 답변.
**Q. 자주 나오는 질문 3?**
A. 2~3문장 답변.
(FAQ는 최소 3개. 각 항목은 반드시 "**Q. 질문?**" 다음 줄에 "A. 답변." 형식.)

<규칙>
- 위의 "## " 헤딩 문구와 "번호. **단계 이름**", "**Q. …**" / "A. …" 형식을 정확히 지킵니다(글자·기호 변경 금지).
- 문장 종결은 '해요체'로 통일하세요 (예: "…해요", "…이에요", "…돼요", "…있어요"). '합니다/습니다'체와 개조식 명사 종결('…함', '…임')은 쓰지 마세요. FAQ의 'A.' 답변도 해요체로 씁니다.
- 상투적인 소개형 종결을 반복하지 마세요: "~를 안내합니다", "~를 살펴봅니다", "~를 알아봅니다" 같은 표현으로 문단을 열거나 닫지 말고, 구체적이고 실용적으로 핵심부터 제시하세요.
- "YYYY년 N월 기준", "오늘 기준" 등 날짜 표기 금지(에버그린).
- 리서치 자료에 없는 수치·금액은 임의 생성 금지.
- 코드 블록·표 금지. "일상킷"에서 해당 시설을 찾을 수 있음을 자연스럽게 1회 언급.
- 마크다운 본문만 출력.`;

  const c = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.6,
    max_tokens: 3500,
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

  // 에버그린 보장: 제목/요약에 "YYYY년" 연도 표기 금지 (본문은 stripDateMarkers가 처리)
  if (/(19|20)\d{2}\s*년/.test(`${meta.title} ${meta.summary}`)) {
    throw new Error(`evergreen guide title/summary must not contain a year: "${meta.title}"`);
  }

  // 본문은 LLM 변동으로 가끔 분량/섹션 미달이 나므로 검증 통과까지 최대 MAX_BODY_ATTEMPTS회 재시도한다.
  const MAX_BODY_ATTEMPTS = 3;
  let lastErrors: string[] = [];
  for (let attempt = 1; attempt <= MAX_BODY_ATTEMPTS; attempt += 1) {
    const rawBody = await generateGuideBody(openai, category, topic, articleType, researchContext, dbStats, meta.title);
    const content = stripDateMarkers(rawBody);
    const { valid, errors } = validateGuideDraftStructure(content, articleType);
    if (valid) {
      return { title: meta.title, summary: meta.summary, keywords: meta.keywords, content };
    }
    lastErrors = errors;
  }
  throw new Error(`guide draft failed validation after ${MAX_BODY_ATTEMPTS} attempts: ${lastErrors.join('; ')}`);
}
