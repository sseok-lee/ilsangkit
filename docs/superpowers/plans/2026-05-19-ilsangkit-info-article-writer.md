# 일상킷 정보 아티클 작성 스킬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local `ilsangkit-info-article-writer` skill and align the backend guide generator with its news·policy·public-info article quality contract.

**Architecture:** Keep the existing `Guide` DB/API/frontend publication path. Add a project-local Codex skill for editorial usage, then encode the same article-type, source, date, length, and anti-slop rules into `backend/src/scripts/generateGuide.ts` so generated content follows the skill contract. Validate behavior through targeted Vitest coverage in the existing `backend/__tests__/scripts/generateGuide.test.ts` suite.

**Tech Stack:** Codex skills (`.codex/skills` markdown), TypeScript ESM, Vitest, existing OpenAI/Naver guide generator, Prisma `Guide` model.

---

## Scope Check

The approved spec covers one subsystem: guide/article generation quality. It does not require admin UI, Prisma schema changes, frontend route changes, thumbnail overhaul, or approval workflow. This plan keeps those out of scope.

## File Structure

### Create

- `.codex/skills/ilsangkit-info-article-writer/SKILL.md` — project-local skill entrypoint; defines input, workflow, output JSON, and self-review.
- `.codex/skills/ilsangkit-info-article-writer/references/editorial-voice.md` — 일상킷 편집팀 tone rules.
- `.codex/skills/ilsangkit-info-article-writer/references/article-type-patterns.md` — five article-type structures and length ranges.
- `.codex/skills/ilsangkit-info-article-writer/references/source-rules.md` — source priority, date rules, and factuality constraints.
- `.codex/skills/ilsangkit-info-article-writer/references/category-context.md` — category-specific cautions and user-impact framing.
- `.codex/skills/ilsangkit-info-article-writer/references/internal-link-rules.md` — internal link candidates and CTA-as-next-action rules.
- `.codex/skills/ilsangkit-info-article-writer/references/anti-ai-slop-checklist.md` — banned phrases and cleanup checklist.

### Modify

- `backend/src/scripts/generateGuide.ts` — add exported info-article contract types/helpers, update date stripping, update meta prompt, validate article quality, and preserve `Guide.articleType = 'news'` for DB compatibility.
- `backend/__tests__/scripts/generateGuide.test.ts` — add tests for article type inference, length policy, relative date handling, anti-slop validation, output prompt contract, and updated absolute-date behavior.

### No change

- `backend/prisma/schema.prisma` — keep existing `Guide` model.
- `backend/src/routes/guides.ts` — public API remains unchanged.
- `frontend/pages/guide/*` — rendering remains unchanged.

---

## Task 1: Add Failing Tests for the Info-Article Contract

**Files:**
- Modify: `backend/__tests__/scripts/generateGuide.test.ts`

- [ ] **Step 1: Extend the import list with new contract exports**

In `backend/__tests__/scripts/generateGuide.test.ts`, update the import from `../../src/scripts/generateGuide.js` to include the new symbols. The complete import block should be:

```ts
import {
  parseCliOptions,
  isGuideCategory,
  fetchNaverSearch,
  discoverTrendingKeyword,
  researchByKeyword,
  extractHeadings,
  validateArticleStructure,
  validateInfoArticleQuality,
  inferInfoArticleType,
  getArticleLengthPolicy,
  getInternalLinkCandidates,
  stripDateMarkers,
  normalizeSections,
  isSummaryHeading,
  isReferencesHeading,
  generateOneGuide,
  GUIDE_CATEGORIES,
  INFO_ARTICLE_TYPES,
} from '../../src/scripts/generateGuide.js';
```

- [ ] **Step 2: Add tests for article type inference**

Append this block after the `heading classifiers` describe block:

```ts
describe('info article type contract', () => {
  it('INFO_ARTICLE_TYPES exposes the approved five article types', () => {
    expect(INFO_ARTICLE_TYPES).toEqual([
      'news-brief',
      'policy-explainer',
      'living-impact',
      'data-update',
      'how-to-check',
    ]);
  });

  it('inferInfoArticleType identifies policy explainer topics', () => {
    const result = inferInfoArticleType({
      category: 'public-rental',
      keyword: '공공임대 입주자 모집 기준 개편',
      researchContext: '국토교통부가 공공임대 입주자 모집 기준과 소득 요건을 발표했다.',
    });

    expect(result.articleType).toBe('policy-explainer');
    expect(result.typeMix).toContain('policy-explainer');
  });

  it('inferInfoArticleType identifies data update topics', () => {
    const result = inferInfoArticleType({
      category: 'ev-charger',
      keyword: '전기차 충전소 설치 현황 증가',
      researchContext: '공공데이터 기준 충전기 설치 수와 운영 현황이 갱신됐다.',
    });

    expect(result.articleType).toBe('data-update');
    expect(result.typeMix).toContain('data-update');
  });

  it('inferInfoArticleType falls back to news brief for general issue topics', () => {
    const result = inferInfoArticleType({
      category: 'pharmacy',
      keyword: '휴일 약국 운영 이슈',
      researchContext: '휴일 약국 운영 관련 보도가 이어졌다.',
    });

    expect(result.articleType).toBe('news-brief');
  });
});
```

- [ ] **Step 3: Add tests for length policy and quality validation**

Append this block after the new article type tests:

```ts
describe('info article quality validation', () => {
  function repeatToLength(seed: string, minLength: number): string {
    let out = seed;
    while (out.length < minLength) out += ` ${seed}`;
    return out;
  }

  it('getArticleLengthPolicy returns type-specific ranges', () => {
    expect(getArticleLengthPolicy('news-brief')).toEqual({ min: 1200, targetMin: 1200, targetMax: 1800, max: 2800 });
    expect(getArticleLengthPolicy('policy-explainer')).toEqual({ min: 1200, targetMin: 1800, targetMax: 2700, max: 2800 });
    expect(getArticleLengthPolicy('living-impact')).toEqual({ min: 1200, targetMin: 1500, targetMax: 2300, max: 2800 });
    expect(getArticleLengthPolicy('data-update')).toEqual({ min: 1200, targetMin: 1200, targetMax: 2000, max: 2800 });
    expect(getArticleLengthPolicy('how-to-check')).toEqual({ min: 1200, targetMin: 1500, targetMax: 2500, max: 2800 });
  });

  it('validateInfoArticleQuality passes dense editorial content', () => {
    const content = repeatToLength(
      [
        '## 핵심 요약',
        '- 공식 자료에서 확인된 내용만 정리합니다.',
        '- 사용자는 대상, 기간, 공식 확인 채널을 먼저 봐야 합니다.',
        '## 이번 이슈에서 봐야 할 점',
        '정책 발표만으로 실제 이용 가능 여부를 판단하기는 어렵습니다.',
        '일상킷에서는 관련 위치나 목록을 먼저 좁혀볼 수 있습니다.',
        '## 참고 자료',
        '- 국토교통부 molit.go.kr',
      ].join('\n\n'),
      1300
    );

    const result = validateInfoArticleQuality(content, 'news-brief');
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('validateInfoArticleQuality rejects content below minimum length', () => {
    const result = validateInfoArticleQuality('짧은 글입니다.', 'news-brief');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('content too short: 7 chars < 1200');
  });

  it('validateInfoArticleQuality rejects content above maximum length', () => {
    const result = validateInfoArticleQuality('가'.repeat(2801), 'news-brief');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('content too long: 2801 chars > 2800');
  });

  it('validateInfoArticleQuality rejects banned AI-slop phrases', () => {
    const content = repeatToLength('많은 분들이 궁금해합니다. 공식 자료를 확인합니다.', 1300);
    const result = validateInfoArticleQuality(content, 'news-brief');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('banned phrase found: 많은 분들이 궁금해합니다');
  });

  it('validateInfoArticleQuality rejects relative date markers', () => {
    const content = repeatToLength('현재는 정책이 바뀐 상태입니다. 공식 자료를 확인합니다.', 1300);
    const result = validateInfoArticleQuality(content, 'policy-explainer');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('relative date marker found: 현재는');
  });
});
```

- [ ] **Step 4: Update date marker tests to preserve absolute dates**

Replace the current `stripDateMarkers` describe block with this complete block:

```ts
describe('stripDateMarkers', () => {
  it('"이 글은 ~ 기준으로 작성되었습니다" 문장 제거', () => {
    const input = '본문 내용입니다. 이 글은 2026년 4월 24일 기준으로 작성되었습니다. 이어지는 내용.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('작성되었습니다');
    expect(output).toContain('본문 내용입니다.');
    expect(output).toContain('이어지는 내용.');
  });

  it('절대 발표일은 보존', () => {
    const input = '발표일: 2026년 4월 24일. 접수 기간은 공고문에서 확인해야 합니다.';
    const output = stripDateMarkers(input);
    expect(output).toContain('2026년 4월 24일');
    expect(output).toContain('공고문에서 확인');
  });

  it('"오늘 기준" / "오늘 날짜 기준" 표기 제거', () => {
    const input = '오늘 기준으로 확인된 사실입니다. 오늘 날짜 기준에서도 동일합니다.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('오늘 기준');
    expect(output).not.toContain('오늘 날짜 기준');
  });

  it('상대 날짜 표현 제거', () => {
    const input = '최근에 발표됐고 현재는 신청을 받습니다. 곧 시행됩니다.';
    const output = stripDateMarkers(input);
    expect(output).not.toContain('최근에');
    expect(output).not.toContain('현재는');
    expect(output).not.toContain('곧 시행됩니다');
  });

  it('날짜 표기 없는 본문은 변경 없음', () => {
    const input = '아파트 매매 시 등기부등본을 반드시 확인하세요.';
    const output = stripDateMarkers(input);
    expect(output).toBe(input);
  });
});
```

- [ ] **Step 5: Add tests for internal link candidates**

Append after the quality validation tests:

```ts
describe('internal link candidates', () => {
  it('returns real-estate link for apt-sale', () => {
    expect(getInternalLinkCandidates('apt-sale')).toEqual(['/real-estate/apt-sale']);
  });

  it('returns public-rental and subscription links for public-rental', () => {
    expect(getInternalLinkCandidates('public-rental')).toEqual([
      '/public-rental',
      '/subscription',
    ]);
  });

  it('returns facility hub link for pharmacy', () => {
    expect(getInternalLinkCandidates('pharmacy')).toEqual(['/pharmacy']);
  });
});
```

- [ ] **Step 6: Run the targeted test and verify it fails**

Run:

```bash
cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts
```

Expected: FAIL because `validateInfoArticleQuality`, `inferInfoArticleType`, `getArticleLengthPolicy`, `getInternalLinkCandidates`, and `INFO_ARTICLE_TYPES` do not exist yet.

- [ ] **Step 7: Commit the failing tests**

```bash
git add backend/__tests__/scripts/generateGuide.test.ts
git commit -m "Specify info-article generation contracts" \
  -m "Constraint: The approved spec shifts generated Guide content from generic guides to source-grounded information articles." \
  -m "Rejected: Test publication UI now | the first implementation slice is generator quality." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Keep Guide DB compatibility while strengthening article generation." \
  -m "Tested: cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts (expected failing contract tests)." \
  -m "Not-tested: Full backend suite." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

## Task 2: Implement Info-Article Contract Helpers

**Files:**
- Modify: `backend/src/scripts/generateGuide.ts`

- [ ] **Step 1: Add info-article types and policy constants**

In `backend/src/scripts/generateGuide.ts`, insert this block after `function isRealEstateLike(c: GuideCategory): boolean { ... }`:

```ts
// ---------------------------------------------------------------------------
// Info article editorial contract
// ---------------------------------------------------------------------------

export const INFO_ARTICLE_TYPES = [
  'news-brief',
  'policy-explainer',
  'living-impact',
  'data-update',
  'how-to-check',
] as const;

export type InfoArticleType = (typeof INFO_ARTICLE_TYPES)[number];

export interface ArticleTypeInferenceInput {
  category: GuideCategory;
  keyword: string;
  researchContext: string;
}

export interface ArticleTypeInferenceResult {
  articleType: InfoArticleType;
  typeMix: string;
}

export interface ArticleLengthPolicy {
  min: number;
  targetMin: number;
  targetMax: number;
  max: number;
}

const ARTICLE_LENGTH_POLICIES: Record<InfoArticleType, ArticleLengthPolicy> = {
  'news-brief': { min: 1200, targetMin: 1200, targetMax: 1800, max: 2800 },
  'policy-explainer': { min: 1200, targetMin: 1800, targetMax: 2700, max: 2800 },
  'living-impact': { min: 1200, targetMin: 1500, targetMax: 2300, max: 2800 },
  'data-update': { min: 1200, targetMin: 1200, targetMax: 2000, max: 2800 },
  'how-to-check': { min: 1200, targetMin: 1500, targetMax: 2500, max: 2800 },
};

const BANNED_AI_SLOP_PHRASES = [
  '많은 분들이 궁금해합니다',
  '꼼꼼히 확인해보세요',
  '도움이 되셨길 바랍니다',
  '반드시 혜택을 받을 수 있습니다',
  '지금 바로 신청하세요',
  '자세한 내용은 검색해보세요',
] as const;

const RELATIVE_DATE_MARKERS = [
  '오늘 기준',
  '오늘 날짜 기준',
  '현재는',
  '최근에',
  '곧 시행됩니다',
  '조만간',
] as const;

const INTERNAL_LINK_CANDIDATES: Record<GuideCategory, string[]> = {
  toilet: ['/toilet'],
  aed: ['/aed'],
  hospital: ['/hospital'],
  pharmacy: ['/pharmacy'],
  parking: ['/parking'],
  wifi: ['/wifi'],
  clothes: ['/clothes'],
  park: ['/park'],
  school: ['/school'],
  market: ['/market'],
  library: ['/library'],
  trash: ['/trash'],
  childcare: ['/childcare'],
  'ev-charger': ['/ev-charger'],
  sports: ['/sports'],
  'apt-sale': ['/real-estate/apt-sale'],
  'apt-rent': ['/real-estate/apt-rent'],
  subscription: ['/subscription'],
  'public-rental': ['/public-rental', '/subscription'],
};

export function getArticleLengthPolicy(articleType: InfoArticleType): ArticleLengthPolicy {
  return ARTICLE_LENGTH_POLICIES[articleType];
}

export function getInternalLinkCandidates(category: GuideCategory): string[] {
  return INTERNAL_LINK_CANDIDATES[category] || [getHubUrl(category)];
}
```

- [ ] **Step 2: Add article type inference**

Insert this function immediately after the constants from Step 1:

```ts
export function inferInfoArticleType(input: ArticleTypeInferenceInput): ArticleTypeInferenceResult {
  const text = `${input.category} ${input.keyword} ${input.researchContext}`.toLowerCase();
  const hasPolicySignal = /정책|제도|기준|개편|규제|지원|공고|모집|자격|소득|자산|국토교통부|보건복지부/.test(text);
  const hasCheckSignal = /신청|접수|방법|절차|확인|서류|공고문|당번|운영시간/.test(text);
  const hasDataSignal = /데이터|현황|통계|증가|감소|등록|설치|공급|물량|건수/.test(text);
  const hasImpactSignal = /영향|요금|운영|생활|이용자|대상|가구|주민|방문/.test(text);

  if (hasPolicySignal) {
    return {
      articleType: 'policy-explainer',
      typeMix: hasImpactSignal ? 'policy-explainer 60% + living-impact 40%' : 'policy-explainer 70% + how-to-check 30%',
    };
  }

  if (hasDataSignal) {
    return {
      articleType: 'data-update',
      typeMix: hasImpactSignal ? 'data-update 60% + living-impact 40%' : 'data-update 70% + news-brief 30%',
    };
  }

  if (hasCheckSignal) {
    return {
      articleType: 'how-to-check',
      typeMix: 'how-to-check 70% + living-impact 30%',
    };
  }

  if (hasImpactSignal) {
    return {
      articleType: 'living-impact',
      typeMix: 'living-impact 70% + news-brief 30%',
    };
  }

  return {
    articleType: 'news-brief',
    typeMix: 'news-brief 70% + living-impact 30%',
  };
}
```

- [ ] **Step 3: Add quality validation**

Insert this function after `validateArticleStructure`:

```ts
export function validateInfoArticleQuality(
  content: string,
  articleType: InfoArticleType
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const policy = getArticleLengthPolicy(articleType);
  const length = content.trim().length;

  if (length < policy.min) {
    errors.push(`content too short: ${length} chars < ${policy.min}`);
  }

  if (length > policy.max) {
    errors.push(`content too long: ${length} chars > ${policy.max}`);
  }

  for (const phrase of BANNED_AI_SLOP_PHRASES) {
    if (content.includes(phrase)) {
      errors.push(`banned phrase found: ${phrase}`);
    }
  }

  for (const marker of RELATIVE_DATE_MARKERS) {
    if (content.includes(marker)) {
      errors.push(`relative date marker found: ${marker}`);
    }
  }

  return { valid: errors.length === 0, errors };
}
```

- [ ] **Step 4: Run targeted tests and verify remaining failures**

Run:

```bash
cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts
```

Expected: Some tests still fail because `stripDateMarkers` still removes absolute dates and generation prompts do not yet use the info-article contract.

- [ ] **Step 5: Commit helper implementation**

```bash
git add backend/src/scripts/generateGuide.ts
git commit -m "Add info-article generation contracts" \
  -m "Constraint: Generated Guide rows must remain DB-compatible while the content contract changes." \
  -m "Rejected: Add a new Article table | publication storage is not in the first scope." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Treat article type as editorial metadata unless the schema is intentionally migrated later." \
  -m "Tested: cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts (expected remaining failures)." \
  -m "Not-tested: Full backend suite." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

## Task 3: Wire the Backend Generator to the Info-Article Contract

**Files:**
- Modify: `backend/src/scripts/generateGuide.ts`
- Modify: `backend/__tests__/scripts/generateGuide.test.ts`

- [ ] **Step 1: Update article structure length constants**

In `backend/src/scripts/generateGuide.ts`, replace:

```ts
const VALIDATION_MIN_CHARS = 2000;
```

with:

```ts
const VALIDATION_MIN_CHARS = 1200;
```

Keep `MIN_SECTION_COUNT = 5`, `MAX_SECTION_COUNT = 8`, and section minimums unchanged.

- [ ] **Step 2: Extend `ArticleMeta` and `ArticleResult`**

Replace the two interfaces with:

```ts
export interface ArticleResult {
  title: string;
  summary: string;
  content: string;
  keywords: string;
  infoArticleType: InfoArticleType;
  typeMix: string;
}

export interface ArticleMeta {
  title: string;
  summary: string;
  keywords: string;
  infoArticleType: InfoArticleType;
  typeMix: string;
  sections: SectionPlan[];
}
```

- [ ] **Step 3: Update `stripDateMarkers` to preserve absolute dates**

Replace the whole function with:

```ts
export function stripDateMarkers(content: string): string {
  return content
    .replace(/\s*이\s*글은[^.\n]*?기준[^.\n]*?작성되었습니다\.?/g, '')
    .replace(/오늘(?:\s*날짜)?\s*기준(?:으로|에|,)?/g, '')
    .replace(/\b현재는\b/g, '')
    .replace(/\b최근에\b/g, '')
    .replace(/\b곧\s*시행됩니다\b/g, '')
    .replace(/\b조만간\b/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}
```

- [ ] **Step 4: Update `generateArticleMeta` to infer type and request structured info-article output**

Inside `generateArticleMeta`, after `const label = CATEGORY_LABELS[category];`, add:

```ts
  const inferred = inferInfoArticleType({ category, keyword, researchContext });
  const lengthPolicy = getArticleLengthPolicy(inferred.articleType);
  const internalLinks = getInternalLinkCandidates(category);
```

Then replace the `prompt` string in `generateArticleMeta` with:

```ts
  const prompt = `아래 주제로 일상킷 정보 아티클의 제목·요약·키워드·섹션 구성을 설계해주세요.

<context>
카테고리: ${label}
주제 키워드: ${keyword}
아티클 중심축: ${inferred.typeMix}
권장 본문 길이: ${lengthPolicy.targetMin}~${lengthPolicy.targetMax}자 (허용 ${lengthPolicy.min}~${lengthPolicy.max}자)
일상킷 내부 링크 후보: ${internalLinks.join(', ')}
${researchContext}
${dbStats}
</context>

<editorial-role>
당신은 일상킷 편집팀입니다. 뉴스·정책·공공정보에서 확인된 사실을 바탕으로 사용자가 실제로 확인해야 할 의미를 정리합니다.
글쓰기보다 편집이 우선입니다. 기사 제목을 반복하지 말고, 사용자 영향과 다음 행동을 먼저 정리하세요.
</editorial-role>

<source-rules>
- 자료에 없는 수치·일정·조건·지역·지원 대상 생성 금지
- 공식 발표/공고문 > 공공기관 안내 > 언론보도 > 블로그 순으로 신뢰도 적용
- 정책·지원·청약·임대 조건은 단정하지 말고 공고문 확인 필요성을 함께 제시
- "오늘 기준", "현재는", "최근에", "곧 시행됩니다" 같은 상대 날짜 표현 금지
- 발표일·보도일처럼 자료에 있는 절대 날짜는 사용 가능
</source-rules>

<section-rules>
- 총 ${MIN_SECTION_COUNT}~${MAX_SECTION_COUNT}개의 섹션을 주제에 맞게 자유롭게 구성
- 첫 섹션은 반드시 "핵심 요약" 계열
- 마지막 섹션은 반드시 "참고 자료" 또는 "공식 확인 채널" 계열
- 중간 섹션은 다음 후보 중 주제에 맞는 것을 선택하거나 더 구체화: "이번 이슈에서 봐야 할 점", "달라지는 내용", "내게 영향이 있는 경우", "확인할 것", "일상킷에서 바로 확인하기"
- 일상킷 링크는 광고 CTA가 아니라 사용자가 다음에 확인할 경로로 설명
- 각 섹션의 description은 그 섹션에서 무엇을 써야 할지 한 문장으로
</section-rules>

JSON으로만 응답:
{
  "title": "25~45자, 핵심이 드러나는 제목",
  "summary": "70~120자 요약",
  "keywords": "키워드1, 키워드2, 키워드3, 키워드4, 키워드5",
  "infoArticleType": "${inferred.articleType}",
  "typeMix": "${inferred.typeMix}",
  "sections": [
    { "heading": "핵심 요약", "description": "독자가 가장 궁금해할 답을 먼저 제시" },
    { "heading": "...", "description": "..." },
    { "heading": "참고 자료", "description": "공식 확인 채널 목록" }
  ]
}`;
```

- [ ] **Step 5: Parse the new metadata fields**

In the return object of `generateArticleMeta`, replace it with:

```ts
  const parsedType = INFO_ARTICLE_TYPES.includes(parsed.infoArticleType as InfoArticleType)
    ? (parsed.infoArticleType as InfoArticleType)
    : inferred.articleType;

  return {
    title: String(parsed.title || '').trim(),
    summary: String(parsed.summary || '').trim(),
    keywords: String(parsed.keywords || '').trim(),
    infoArticleType: parsedType,
    typeMix: String(parsed.typeMix || inferred.typeMix).trim() || inferred.typeMix,
    sections,
  };
```

- [ ] **Step 6: Update `generateSectionBody` prompt for editorial style**

Inside `generateSectionBody`, replace `<readability>` and `<rules>` blocks in the prompt with:

```ts
<readability>
- 결론을 먼저 제시
- 한 문장은 80자 이내로 짧게
- 한 문단은 2~4문장 이내, 긴 블록 금지
- 나열·단계형 정보는 "- " 불릿 또는 "1. " 번호 리스트로
- 중요 키워드·수치·사이트명은 **볼드** 강조
- 비교·분류는 간단한 마크다운 표 활용 가능
</readability>

<voice>
- 일상킷 편집팀 톤: 짧고 깔끔한 문장, 데이터·바로가기 중심, 감정 표현 최소화
- "많은 분들이 궁금해합니다", "꼼꼼히 확인해보세요", "도움이 되셨길 바랍니다" 금지
- 일상킷 연결은 광고가 아니라 다음 확인 행동으로 설명
</voice>

<rules>
- "${heading}" 섹션 본문만 작성 (섹션 제목 "## ${heading}" 라인은 출력 금지)
- 친절하지만 단정한 한국어 경어체
- 자료에서 확인된 사실과 사용자가 확인해야 할 행동을 구분
- 리서치 자료에 없는 수치·금액·일정·조건은 임의 생성 금지
- 정책·지원·청약·임대 조건은 공고문 확인 필요성을 함께 제시
- 본문에 "오늘 기준", "현재는", "최근에", "곧 시행됩니다" 같은 상대 날짜 표현 금지
- 발표일·보도일처럼 자료에 있는 절대 날짜는 사용 가능
- 코드 블록 금지, ## 헤더 금지 (본문만 출력)
</rules>
```

- [ ] **Step 7: Validate final article quality in `generateArticle`**

In `generateArticle`, after existing `validateArticleStructure(content)` check, add:

```ts
  const quality = validateInfoArticleQuality(content, meta.infoArticleType);
  if (!quality.valid) {
    throw new Error(`assembled article failed info quality validation: ${quality.errors.join('; ')}`);
  }
```

Then update the final return object to:

```ts
  return {
    title: meta.title,
    summary: meta.summary,
    keywords: meta.keywords,
    content,
    infoArticleType: meta.infoArticleType,
    typeMix: meta.typeMix,
  };
```

- [ ] **Step 8: Update article generation mocks to include new metadata**

In `setupArticleGenerationMocks`, update the JSON response object to include:

```ts
                infoArticleType: 'news-brief',
                typeMix: 'news-brief 70% + living-impact 30%',
```

The complete JSON object inside `setupArticleGenerationMocks` should be:

```ts
              content: JSON.stringify({
                title: overrides?.title || '슬림 버전 테스트 가이드 스무자 이상의 제목입니다',
                summary:
                  overrides?.summary || '슬림 버전 테스트 요약입니다. 50자 이상의 요약 텍스트를 작성합니다.',
                keywords: overrides?.keywords || '키워드1, 키워드2, 키워드3',
                infoArticleType: 'news-brief',
                typeMix: 'news-brief 70% + living-impact 30%',
                sections,
              }),
```

Also update the auto-selected keyword test metadata JSON with:

```ts
                  infoArticleType: 'news-brief',
                  typeMix: 'news-brief 70% + living-impact 30%',
```

- [ ] **Step 9: Run targeted tests and verify pass**

Run:

```bash
cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts
```

Expected: PASS for `generateGuide.test.ts`.

- [ ] **Step 10: Commit generator wiring**

```bash
git add backend/src/scripts/generateGuide.ts backend/__tests__/scripts/generateGuide.test.ts
git commit -m "Apply info-article rules to guide generation" \
  -m "Constraint: Existing Guide publication storage and routes remain unchanged in this slice." \
  -m "Rejected: Store infoArticleType in Prisma now | the approved first scope avoids schema migration." \
  -m "Confidence: high" \
  -m "Scope-risk: moderate" \
  -m "Directive: Preserve absolute source dates; only remove relative freshness claims." \
  -m "Tested: cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts" \
  -m "Not-tested: Full backend suite." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

## Task 4: Create the Project-Local Info Article Writer Skill

**Files:**
- Create: `.codex/skills/ilsangkit-info-article-writer/SKILL.md`
- Create: `.codex/skills/ilsangkit-info-article-writer/references/editorial-voice.md`
- Create: `.codex/skills/ilsangkit-info-article-writer/references/article-type-patterns.md`
- Create: `.codex/skills/ilsangkit-info-article-writer/references/source-rules.md`
- Create: `.codex/skills/ilsangkit-info-article-writer/references/category-context.md`
- Create: `.codex/skills/ilsangkit-info-article-writer/references/internal-link-rules.md`
- Create: `.codex/skills/ilsangkit-info-article-writer/references/anti-ai-slop-checklist.md`

- [ ] **Step 1: Create the skill directory**

Run:

```bash
mkdir -p .codex/skills/ilsangkit-info-article-writer/references
```

Expected: directory exists.

- [ ] **Step 2: Write `SKILL.md`**

Create `.codex/skills/ilsangkit-info-article-writer/SKILL.md` with exactly:

```markdown
---
name: ilsangkit-info-article-writer
description: Write source-grounded Korean information articles for ilsangkit from news, policy, public data, and living-issue inputs. Use when creating or reviewing Guide/정보 아티클 content for ilsangkit.
---

# 일상킷 정보 아티클 작성

뉴스·정책·공공정보·생활 이슈를 읽고 일상킷 사용자에게 필요한 의미를 정리하는 편집 스킬이다.

## Required Inputs

- `category`: 일상킷 카테고리 slug
- `keyword`: 글의 중심 키워드
- `researchContext`: 뉴스, 공공기관, 공식 자료, 블로그 검색 결과 등 입력 자료
- `dbStats` optional: 일상킷 DB 통계
- `internalLinkCandidates` optional: 일상킷 내부 링크 후보

자료가 부족하면 내용을 지어내지 말고 `status: "needs-more-source"`로 반환한다.

## References

Read these before writing:

1. `references/editorial-voice.md`
2. `references/article-type-patterns.md`
3. `references/source-rules.md`
4. `references/category-context.md`
5. `references/internal-link-rules.md`
6. `references/anti-ai-slop-checklist.md`

## Workflow

1. **Source Reading** — 입력 자료에서 확인된 사실만 추출한다.
2. **Article Type Selection** — 중심축을 `news-brief`, `policy-explainer`, `living-impact`, `data-update`, `how-to-check` 중 하나로 정하고 보조축을 적는다.
3. **User Impact Framing** — 사용자에게 중요한 이유, 영향 대상, 확인할 항목, 일상킷에서 먼저 볼 수 있는 정보를 정리한다.
4. **Draft** — 일상킷 편집팀 톤으로 5~7개 섹션의 마크다운 본문을 작성한다.
5. **Self Review** — 금지 표현, 상대 날짜, 근거 없는 단정, 광고성 CTA, 긴 문단을 제거한다.
6. **Structured Output** — 아래 JSON 형식으로만 반환한다.

## Output Schema

```json
{
  "status": "ready",
  "articleType": "policy-explainer",
  "typeMix": "policy-explainer 60% + living-impact 40%",
  "title": "25~45자 제목",
  "summary": "70~120자 요약",
  "category": "public-rental",
  "keywords": ["공공임대", "청약", "입주자모집"],
  "sourceNotes": ["확인된 사실", "주의할 해석"],
  "content": "## 핵심 요약\n\n- ...",
  "internalLinks": ["/public-rental", "/subscription"]
}
```

If source material is insufficient:

```json
{
  "status": "needs-more-source",
  "reason": "공식 자료나 보도 내용이 부족해 조건·일정을 확인할 수 없습니다.",
  "missing": ["발표 주체", "발표일", "공식 공고문 URL"]
}
```

## Hard Rules

- 자료에 없는 수치·일정·조건·지역·대상을 만들지 않는다.
- 절대 날짜는 허용하지만 `오늘 기준`, `현재는`, `최근에`, `곧 시행됩니다` 같은 상대 날짜는 쓰지 않는다.
- 정책·지원·청약·임대 조건은 공식 공고문 확인 필요성을 함께 적는다.
- 일상킷 링크는 광고 CTA가 아니라 다음 확인 행동으로 배치한다.
- 본문 기본 목표는 1,800~2,300자, 허용 범위는 1,200~2,800자다.
```

- [ ] **Step 3: Write `editorial-voice.md`**

Create `.codex/skills/ilsangkit-info-article-writer/references/editorial-voice.md`:

```markdown
# 일상킷 편집팀 문체

## 목표 톤

- 짧고 깔끔한 문장
- 데이터·조건·바로가기 중심
- 감정 표현 최소화
- 결론 우선
- 사용자 다음 행동 명확화

## 문단 규칙

- 한 문장은 80자 이내를 목표로 한다.
- 한 문단은 2~4문장으로 제한한다.
- 첫 섹션은 bullet 3~5개로 핵심 요약을 제시한다.
- 정보가 나열되면 번호 리스트나 bullet을 사용한다.

## 좋은 문장

- `정책 발표만으로 실제 이용 가능 여부를 판단하기는 어렵습니다.`
- `이용자 입장에서는 대상, 기간, 공식 확인 채널을 먼저 봐야 합니다.`
- `일상킷에서는 주변 시설 위치를 먼저 좁혀볼 수 있습니다.`

## 피할 문장

- `많은 분들이 궁금해합니다.`
- `꼼꼼히 확인해보세요.`
- `도움이 되셨길 바랍니다.`
- `지금 바로 신청하세요.`
```

- [ ] **Step 4: Write `article-type-patterns.md`**

Create `.codex/skills/ilsangkit-info-article-writer/references/article-type-patterns.md`:

```markdown
# 아티클 타입 패턴

## news-brief

용도: 최근 이슈를 짧게 요약하고 달라진 점을 설명한다.
길이: 1,200~1,800자.
섹션 예시:

- 핵심 요약
- 이번 이슈에서 봐야 할 점
- 달라지는 내용
- 확인할 것
- 참고 자료

## policy-explainer

용도: 정책·제도·공고 조건을 쉽게 풀어 설명한다.
길이: 1,800~2,700자.
섹션 예시:

- 핵심 요약
- 이번 정책의 핵심
- 영향 받는 대상
- 확인해야 할 조건
- 일상킷에서 먼저 볼 정보
- 참고 자료

## living-impact

용도: 사용자 생활에 미치는 영향을 중심으로 해석한다.
길이: 1,500~2,300자.
섹션 예시:

- 핵심 요약
- 내게 영향이 있는 경우
- 실제 확인할 것
- 주의할 점
- 일상킷에서 바로 확인하기
- 참고 자료

## data-update

용도: 공공데이터, 시설 수, 운영 정보 변화 등을 설명한다.
길이: 1,200~2,000자.
섹션 예시:

- 핵심 요약
- 데이터에서 달라진 점
- 이용자에게 중요한 이유
- 확인할 정보
- 참고 자료

## how-to-check

용도: 사용자가 실제로 무엇을 확인해야 하는지 단계로 안내한다.
길이: 1,500~2,500자.
섹션 예시:

- 핵심 요약
- 확인 순서
- 공식 채널에서 볼 항목
- 일상킷에서 좁혀볼 항목
- 자주 놓치는 점
- 참고 자료
```

- [ ] **Step 5: Write `source-rules.md`**

Create `.codex/skills/ilsangkit-info-article-writer/references/source-rules.md`:

```markdown
# 출처·날짜 규칙

## 출처 우선순위

1. 공식 발표 / 공고문
2. 공공기관 안내
3. 언론보도
4. 블로그·커뮤니티

공식 자료와 언론보도가 충돌하면 공식 자료를 우선한다.
블로그·커뮤니티는 사용자 경험 참고로만 사용하고 조건·일정의 근거로 쓰지 않는다.

## 허용 날짜 표현

- `발표일: 2026년 5월 12일`
- `보도일: 2026년 5월 12일`
- `접수 기간은 공고문에서 확인해야 합니다.`
- `기사 작성 시점에 확인된 내용입니다.`

## 금지 날짜 표현

- 오늘 기준
- 오늘 날짜 기준
- 현재는
- 최근에
- 곧 시행됩니다
- 조만간

## 단정 금지

자료에 없는 수치, 일정, 조건, 대상, 지역은 만들지 않는다.
정책·지원·청약·임대 조건은 `공고문 확인 필요`를 함께 적는다.
```

- [ ] **Step 6: Write `category-context.md`**

Create `.codex/skills/ilsangkit-info-article-writer/references/category-context.md`:

```markdown
# 카테고리별 작성 주의사항

## 부동산: apt-sale, apt-rent

- 거래량, 가격, 대출 규제는 지역·시점별 차이가 크다.
- 투자 판단처럼 읽히는 문장을 피한다.
- 실거래가 확인과 공식 통계 확인을 분리한다.

## 청약·공공임대: subscription, public-rental

- 모집 대상, 소득, 자산, 거주지, 접수 기간을 단정하지 않는다.
- 세부 조건은 공고문 확인이 필요하다고 쓴다.
- 일상킷은 목록 확인과 후보 좁히기 도구로 설명한다.

## 병원·약국·AED: hospital, pharmacy, aed

- 운영시간, 야간·휴일 여부, 응급 상황은 현장 확인이 중요하다.
- 의료 조언처럼 보이는 표현을 피한다.
- 전화 확인 또는 공식 채널 확인을 안내한다.

## 주차·충전: parking, ev-charger

- 요금, 운영시간, 충전 가능 여부는 현장·운영기관 변동이 있다.
- 위치 확인과 실제 운영 상태 확인을 분리한다.

## 생활시설: toilet, wifi, clothes, park, school, market, library, trash, childcare, sports

- 공공데이터 등록 여부와 실제 운영 상태는 다를 수 있다.
- 사용자가 방문 전 확인해야 할 항목을 먼저 제시한다.
```

- [ ] **Step 7: Write `internal-link-rules.md`**

Create `.codex/skills/ilsangkit-info-article-writer/references/internal-link-rules.md`:

```markdown
# 일상킷 내부 링크 규칙

## 원칙

일상킷 링크는 광고 CTA가 아니다.
사용자가 다음에 확인할 수 있는 도구로 자연스럽게 배치한다.

## 나쁜 예

`일상킷에서 전기차 충전소를 바로 확인해보세요!`

## 좋은 예

`정책 발표만으로 실제 이용 가능 여부를 판단하기는 어렵습니다. 일상킷에서는 주변 전기차 충전소 위치를 먼저 좁혀볼 수 있습니다. 다만 충전기 운영 상태와 요금은 현장 또는 운영기관 정보를 함께 확인하는 것이 좋습니다.`

## 링크 후보

- `apt-sale`: `/real-estate/apt-sale`
- `apt-rent`: `/real-estate/apt-rent`
- `subscription`: `/subscription`
- `public-rental`: `/public-rental`, `/subscription`
- `pharmacy`: `/pharmacy`
- `hospital`: `/hospital`
- `parking`: `/parking`
- `ev-charger`: `/ev-charger`
- `aed`: `/aed`
- 기타 시설: `/{category}`
```

- [ ] **Step 8: Write `anti-ai-slop-checklist.md`**

Create `.codex/skills/ilsangkit-info-article-writer/references/anti-ai-slop-checklist.md`:

```markdown
# AI Slop 제거 체크리스트

최종 출력 전에 아래 항목을 제거한다.

## 금지 표현

- 많은 분들이 궁금해합니다
- 꼼꼼히 확인해보세요
- 도움이 되셨길 바랍니다
- 반드시 혜택을 받을 수 있습니다
- 지금 바로 신청하세요
- 자세한 내용은 검색해보세요

## 금지 패턴

- 기사 제목을 도입부에서 그대로 반복
- 같은 의미의 문장을 두 번 설명
- 자료에 없는 숫자나 조건 생성
- `최근`, `현재`, `곧` 같은 상대 시점 표현
- 일상킷 링크를 광고처럼 마무리 문장에만 붙이기
- 5문장 이상 이어지는 긴 문단

## 최종 확인

- 첫 섹션에서 결론이 보이는가?
- 사용자가 다음에 확인할 행동이 있는가?
- 공식 자료 확인이 필요한 부분을 단정하지 않았는가?
- 본문 길이가 1,200~2,800자 안에 있는가?
```

- [ ] **Step 9: Verify the skill files exist**

Run:

```bash
find .codex/skills/ilsangkit-info-article-writer -type f | sort
```

Expected output includes all seven files.

- [ ] **Step 10: Commit the skill files**

```bash
git add .codex/skills/ilsangkit-info-article-writer
git commit -m "Add the ilsangkit info-article writer skill" \
  -m "Constraint: Project-local skill references need to encode the same rules as the backend generator contract." \
  -m "Rejected: User-level skill installation | this repo needs a reviewable project-local skill first." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Keep skill references factual and small; add category detail only when generation failures prove the need." \
  -m "Tested: find .codex/skills/ilsangkit-info-article-writer -type f | sort" \
  -m "Not-tested: Live Codex skill invocation." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

## Task 5: Add Regression Coverage for Prompt Contract

**Files:**
- Modify: `backend/__tests__/scripts/generateGuide.test.ts`

- [ ] **Step 1: Add assertions to the happy-path test for the new meta prompt**

In the `--topic 지정 시 트렌드 선정 스킵 + 글 생성 + 저장` test, after `expect(mockChatCreate).toHaveBeenCalledTimes(7);`, add:

```ts
    const metaPrompt = mockChatCreate.mock.calls[0][0].messages[0].content as string;
    expect(metaPrompt).toContain('일상킷 정보 아티클');
    expect(metaPrompt).toContain('아티클 중심축');
    expect(metaPrompt).toContain('공식 발표/공고문 > 공공기관 안내 > 언론보도 > 블로그');
    expect(metaPrompt).toContain('상대 날짜 표현 금지');
    expect(metaPrompt).toContain('/real-estate/apt-sale');
```

- [ ] **Step 2: Add assertions to verify stored DB articleType compatibility**

In the same test, after `expect(mockGuideUpsert).toHaveBeenCalledOnce();`, add:

```ts
    const upsertArg = mockGuideUpsert.mock.calls[0][0];
    expect(upsertArg.create.articleType).toBe('news');
    expect(upsertArg.update.articleType).toBe('news');
```

- [ ] **Step 3: Add a test that banned phrases fail generation before DB save**

Append inside `describe('generateOneGuide — happy path', () => { ... })`:

```ts
  it('금지 표현이 생성되면 DB 저장 전 실패', async () => {
    setupNaverResponse([
      { title: '뉴스', description: '...', link: 'https://a.com' },
    ]);
    setupArticleGenerationMocks({
      sectionBody: '많은 분들이 궁금해합니다. 공식 자료를 확인합니다. '.repeat(40),
    });
    mockImageGenerate.mockResolvedValue({
      data: [{ b64_json: Buffer.from('fake').toString('base64') }],
    });

    await expect(
      generateOneGuide({ category: 'pharmacy', topic: '야간 약국' })
    ).rejects.toThrow(/info quality validation/);

    expect(mockGuideUpsert).not.toHaveBeenCalled();
  });
```

- [ ] **Step 4: Run targeted tests**

```bash
cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit prompt contract tests**

```bash
git add backend/__tests__/scripts/generateGuide.test.ts
git commit -m "Protect the info-article prompt contract" \
  -m "Constraint: Prompt regressions can silently degrade generated content quality." \
  -m "Rejected: Snapshot every prompt | targeted contract strings are more stable and reviewable." \
  -m "Confidence: high" \
  -m "Scope-risk: narrow" \
  -m "Directive: Update these assertions only when the editorial contract intentionally changes." \
  -m "Tested: cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts" \
  -m "Not-tested: Full backend suite." \
  -m "Co-authored-by: OmX <omx@oh-my-codex.dev>"
```

---

## Task 6: Final Verification

**Files:**
- Verify only

- [ ] **Step 1: Run backend targeted test**

```bash
cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run backend full test suite**

```bash
cd backend && npm run test
```

Expected: PASS. If existing unrelated failures appear, capture the failing test names and error messages before deciding whether to fix or report them.

- [ ] **Step 3: Run backend lint**

```bash
cd backend && npm run lint
```

Expected: PASS.

- [ ] **Step 4: Run backend build**

```bash
cd backend && npm run build
```

Expected: PASS.

- [ ] **Step 5: Verify git status is clean**

```bash
git status --short
```

Expected: no output.

- [ ] **Step 6: Final report**

Report:

```markdown
Implemented the info-article writer direction.

Changed:
- Added `.codex/skills/ilsangkit-info-article-writer/` with editorial references.
- Added info-article type, length, date, internal-link, and anti-slop contracts to `backend/src/scripts/generateGuide.ts`.
- Updated `generateGuide` tests to protect the contract and DB compatibility.

Verified:
- `cd backend && npm run test -- __tests__/scripts/generateGuide.test.ts`
- `cd backend && npm run test`
- `cd backend && npm run lint`
- `cd backend && npm run build`

Risks:
- The public `Guide.articleType` DB field remains `news`; `infoArticleType` is editorial metadata only until a future schema migration.
- Live article quality still depends on the quality of Naver/OpenAI source inputs.
```
