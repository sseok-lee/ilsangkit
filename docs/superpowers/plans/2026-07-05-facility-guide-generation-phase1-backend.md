# 시설 가이드 생성 — Phase 1 (백엔드) 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 빈 시설 카테고리용 상시 가이드 초안을 OpenAI로 생성하고 어드민이 검토·발행할 수 있는 백엔드를 만든다(생성기·배치·어드민 API·스키마).

**Architecture:** 기존 `articleGenerationCore` 유틸(리서치/썸네일/DB통계)을 재사용하되, 뉴스 구조를 강제하는 `generateArticle`은 쓰지 않고 **evergreen 가이드 전용 meta/body/validator를 신규 작성**. 초안은 `Guide.published=false`로 저장. 어드민 관리 API는 `adminArticleService`/`admin.ts` 패턴을 그대로 미러하되 Guide는 status enum이 없어 `published` boolean으로 대체.

**Tech Stack:** Express 5 + TypeScript(ESM) · Prisma/MySQL · OpenAI `gpt-4o-mini` · Vitest.

## Global Constraints

- Node 20. 모든 로컬 import에 `.js` 확장자(ESM).
- 모든 라우트 핸들러 `asyncHandler()` 래핑. 요청 검증 `validate(ZodSchema, 'query'|'params'|'body')`. 수동 `res.status().json()` 대신 `NotFoundError`/`ValidationError` throw.
- 어드민 라우트: **모든** 핸들러에 `requireAdmin`, **상태변경(PATCH/POST/DELETE)** 핸들러에 추가로 `requireSameOrigin`. GET에는 `requireSameOrigin` 붙이지 않음.
- **Guide 모델엔 `status` enum도 `sources` 컬럼도 없다.** 초안=`published:false`, 발행=`published:true`. `sources` 필드를 Guide에 쓰지 말 것.
- 썸네일 인코딩 실패 시(=`generateThumbnail`이 `false` 반환) 해당 항목 **throw**(PNG-as-webp 금지).
- 생성 마크다운 정확 규격(프론트 JSON-LD 파싱 근거):
  - 헤딩은 정확히 `## 단계별 방법` / `## 자주 묻는 질문` (H2, 두 개의 `#` + 공백).
  - FAQ 항목: `**Q. 질문?**`(한 줄) ⏎ `A. 답변.` — 다음 항목은 `**Q.`로 시작.
  - HowTo 단계: `1. **단계명**` ⏎ `설명` (번호. + `**bold**`).
- slug는 `${category}-${articleType}-${cuid}` 이며 **Guide+Article 두 테이블 교차 유니크**.
- 전 항목 `articleType`은 씨앗의 값(`'howto'` | `'guide'`). 초안 `published:false`, `publishedAt:null`.
- 커밋은 태스크 단위. main 직접 커밋 금지(Phase 완료 시 develop PR).

## File Structure

**신규**
- `backend/src/data/facilityGuideTopics.ts` — 24개 큐레이션 씨앗(단일 소스).
- `backend/src/services/guideDraftGeneration.ts` — evergreen meta/body/validator/orchestrator.
- `backend/src/scripts/generateGuideDrafts.ts` — 배치 러너(CLI).
- `backend/src/services/adminGuideService.ts` — 어드민 CRUD/발행/반려.
- `backend/__tests__/services/guideDraftGeneration.test.ts`
- `backend/__tests__/data/facilityGuideTopics.test.ts`
- `backend/__tests__/scripts/generateGuideDrafts.test.ts`
- `backend/__tests__/services/adminGuideService.test.ts`

**수정**
- `backend/prisma/schema.prisma` — `Guide.publishedAt DateTime?` 추가.
- `backend/src/services/guideService.ts` — `GUIDE_SELECT`에 `publishedAt`, `serializeGuide` 폴백.
- `backend/src/schemas/admin.ts` — `AdminGuideListSchema`/`AdminGuideIdSchema`/`AdminGuidePatchSchema` 추가.
- `backend/src/routes/admin.ts` — `/guides` 라우트 블록 추가.
- `backend/package.json` — `generate:guide:drafts` 스크립트.
- `backend/__tests__/services/guideService.test.ts` (있으면) — `serializeGuide` 폴백 테스트 추가(없으면 신규).

---

### Task 1: Guide.publishedAt 스키마 + 직렬화 폴백

**Files:**
- Modify: `backend/prisma/schema.prisma` (Guide 모델, `createdAt` 앞에 추가)
- Modify: `backend/src/services/guideService.ts`
- Test: `backend/__tests__/services/guideService.test.ts`

**Interfaces:**
- Produces: `serializeGuide<T extends { publishedAt: Date | null; createdAt: Date }>(g: T): T & { publishedAt: Date }` (export). 공개 응답의 `publishedAt`은 항상 non-null(폴백=createdAt).

- [ ] **Step 1: 스키마에 컬럼 추가.** `Guide` 모델에서 `viewCount` 다음, `createdAt` 앞에 한 줄 추가(Article.publishedAt 패턴 미러, `@default` 금지):

```prisma
  viewCount    Int       @default(0)
  publishedAt  DateTime?
  createdAt    DateTime  @default(now())
```

- [ ] **Step 2: Prisma 반영.** 실행: `cd backend && nvm use 20 && npm run db:push && npm run db:generate`
  Expected: `Guide.publishedAt` 포함해 Prisma Client 재생성, 에러 없음.

- [ ] **Step 3: 실패 테스트 작성.** `backend/__tests__/services/guideService.test.ts`에 `serializeGuide` 폴백 테스트:

```typescript
import { describe, it, expect } from 'vitest';
import { serializeGuide } from '../../src/services/guideService.js';

describe('serializeGuide publishedAt fallback', () => {
  it('publishedAt이 null이면 createdAt으로 폴백', () => {
    const created = new Date('2026-01-02T03:04:05Z');
    const out = serializeGuide({ id: 'g1', publishedAt: null, createdAt: created });
    expect(out.publishedAt).toEqual(created);
  });
  it('publishedAt이 있으면 그대로 유지', () => {
    const created = new Date('2026-01-02T03:04:05Z');
    const published = new Date('2026-03-04T05:06:07Z');
    const out = serializeGuide({ id: 'g1', publishedAt: published, createdAt: created });
    expect(out.publishedAt).toEqual(published);
  });
});
```

- [ ] **Step 4: 실패 확인.** 실행: `cd backend && npx vitest run __tests__/services/guideService.test.ts`
  Expected: FAIL (`serializeGuide` export 없음).

- [ ] **Step 5: 구현.** `guideService.ts`에서 (1) `GUIDE_SELECT`에 `publishedAt: true` 추가, (2) 헬퍼 export 추가, (3) `listGuides`/`listRecentGuides`가 조회결과를 `serializeGuide`로 매핑, (4) `getGuideBySlug` 반환에 `publishedAt` 폴백 추가:

```typescript
// GUIDE_SELECT에 추가
  keywords: true,
  viewCount: true,
  publishedAt: true, // NEW
  createdAt: true,

// 파일 상단(또는 SELECT 근처)에 export
export function serializeGuide<T extends { publishedAt: Date | null; createdAt: Date }>(g: T) {
  return { ...g, publishedAt: g.publishedAt ?? g.createdAt };
}

// listGuides: findMany 결과 rows를 매핑
  const items = rows.map(serializeGuide);
  return { items, total, page, totalPages };

// listRecentGuides: return rows.map(serializeGuide);

// getGuideBySlug 반환(기존 spread에 폴백 한 줄 추가)
  return {
    ...guide,
    viewCount: guide.viewCount + 1,
    publishedAt: guide.publishedAt ?? guide.createdAt, // NEW
  };
```
> 주의: `listGuides`/`listRecentGuides`의 기존 `where`/`orderBy`(`createdAt: 'desc'`)/`skip`/`take`는 그대로 둔다. 공개 게이트 `published: true`도 불변.

- [ ] **Step 6: 통과 확인.** 실행: `cd backend && npx vitest run __tests__/services/guideService.test.ts`  Expected: PASS.

- [ ] **Step 7: 커밋.**
```bash
git add backend/prisma/schema.prisma backend/src/services/guideService.ts backend/__tests__/services/guideService.test.ts
git commit -m "feat(guide): Guide.publishedAt 추가 + 직렬화 폴백(createdAt)"
```

---

### Task 2: 큐레이션 씨앗 데이터

**Files:**
- Create: `backend/src/data/facilityGuideTopics.ts`
- Test: `backend/__tests__/data/facilityGuideTopics.test.ts`

**Interfaces:**
- Produces: `interface GuideTopicSeed { category: GuideCategory; topic: string; articleType: 'howto' | 'guide' }` 및 `export const FACILITY_GUIDE_TOPICS: GuideTopicSeed[]` (24개).

- [ ] **Step 1: 실패 테스트 작성.** `backend/__tests__/data/facilityGuideTopics.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { FACILITY_GUIDE_TOPICS } from '../../src/data/facilityGuideTopics.js';
import { isGuideCategory } from '../../src/services/articleGenerationCore.js';

describe('FACILITY_GUIDE_TOPICS', () => {
  it('24개 씨앗', () => {
    expect(FACILITY_GUIDE_TOPICS).toHaveLength(24);
  });
  it('모든 category가 유효한 GuideCategory', () => {
    for (const t of FACILITY_GUIDE_TOPICS) {
      expect(isGuideCategory(t.category), `invalid category: ${t.category}`).toBe(true);
    }
  });
  it('articleType은 howto 또는 guide', () => {
    for (const t of FACILITY_GUIDE_TOPICS) {
      expect(['howto', 'guide']).toContain(t.articleType);
    }
  });
  it('빈 시설 10개 카테고리만 포함(부동산/기존 카테고리 제외)', () => {
    const cats = new Set(FACILITY_GUIDE_TOPICS.map((t) => t.category));
    expect([...cats].sort()).toEqual(
      ['aed', 'childcare', 'ev-charger', 'library', 'park', 'parking', 'school', 'sports', 'toilet', 'wifi'].sort()
    );
  });
});
```

- [ ] **Step 2: 실패 확인.** `cd backend && npx vitest run __tests__/data/facilityGuideTopics.test.ts` → FAIL(파일 없음).

- [ ] **Step 3: 구현.** `backend/src/data/facilityGuideTopics.ts`:

```typescript
import type { GuideCategory } from '../services/articleGenerationCore.js';

export interface GuideTopicSeed {
  category: GuideCategory;
  topic: string;
  articleType: 'howto' | 'guide';
}

export const FACILITY_GUIDE_TOPICS: GuideTopicSeed[] = [
  { category: 'toilet', topic: '급할 때 근처 공중화장실 빨리 찾는 법', articleType: 'howto' },
  { category: 'toilet', topic: '개방화장실과 공공화장실 차이 및 이용 팁', articleType: 'guide' },
  { category: 'wifi', topic: '무료 공공와이파이 찾고 연결하는 법', articleType: 'howto' },
  { category: 'wifi', topic: '공공와이파이 안전하게 사용하는 법', articleType: 'guide' },
  { category: 'parking', topic: '공영주차장 무료·할인 요금 받는 법', articleType: 'howto' },
  { category: 'parking', topic: '거주자 우선주차 신청 방법과 절차', articleType: 'howto' },
  { category: 'parking', topic: '근처 저렴한 공영주차장 찾는 법', articleType: 'guide' },
  { category: 'aed', topic: '주변 AED(자동심장충격기) 위치 찾고 사용하는 법', articleType: 'howto' },
  { category: 'aed', topic: '심정지 응급상황 대처와 AED 사용법', articleType: 'howto' },
  { category: 'library', topic: '공공도서관 회원가입과 도서 대출 방법', articleType: 'howto' },
  { category: 'library', topic: '도서관 좌석·스터디룸 예약하는 법', articleType: 'howto' },
  { category: 'library', topic: '상호대차와 희망도서 신청 이용법', articleType: 'guide' },
  { category: 'park', topic: '가까운 공원과 산책로 찾는 법', articleType: 'guide' },
  { category: 'park', topic: '반려견과 함께 갈 수 있는 공원 이용 가이드', articleType: 'guide' },
  { category: 'school', topic: '우리 동네 학군과 학교 정보 찾는 법', articleType: 'guide' },
  { category: 'school', topic: '초등학교 배정과 전학 절차 안내', articleType: 'howto' },
  { category: 'childcare', topic: '어린이집 입소 신청과 대기 방법', articleType: 'howto' },
  { category: 'childcare', topic: '국공립 어린이집 찾고 신청하는 법', articleType: 'howto' },
  { category: 'childcare', topic: '어린이집 정보공시로 우리 동네 시설 비교하기', articleType: 'guide' },
  { category: 'ev-charger', topic: '가까운 전기차 충전소 찾고 이용하는 법', articleType: 'howto' },
  { category: 'ev-charger', topic: '전기차 완속·급속 충전 요금과 결제 방법', articleType: 'guide' },
  { category: 'ev-charger', topic: '아파트 전기차 충전기 설치 신청 방법', articleType: 'howto' },
  { category: 'sports', topic: '공공체육시설 온라인 예약하는 법', articleType: 'howto' },
  { category: 'sports', topic: '저렴한 생활체육 프로그램 신청 방법', articleType: 'guide' },
];
```

- [ ] **Step 4: 통과 확인.** `cd backend && npx vitest run __tests__/data/facilityGuideTopics.test.ts` → PASS.

- [ ] **Step 5: 커밋.**
```bash
git add backend/src/data/facilityGuideTopics.ts backend/__tests__/data/facilityGuideTopics.test.ts
git commit -m "feat(guide): 시설 가이드 큐레이션 씨앗 24개"
```

---

### Task 3: evergreen 가이드 생성기

**Files:**
- Create: `backend/src/services/guideDraftGeneration.ts`
- Test: `backend/__tests__/services/guideDraftGeneration.test.ts`

**Interfaces:**
- Consumes(articleGenerationCore.js): `getDbStats`, `researchByKeyword`, `formatResearchContext`, `generateThumbnail`, `stripDateMarkers`, `extractHeadings`, `CATEGORY_LABELS`, `isRealEstateLike`, `type GuideCategory`.
- Produces:
  - `type GuideArticleType = 'howto' | 'guide'`
  - `interface GuideDraftResult { title: string; summary: string; content: string; keywords: string }`
  - `function validateGuideDraftStructure(content: string, articleType: GuideArticleType): { valid: boolean; errors: string[] }`
  - `async function generateGuideDraft(openai: OpenAI, opts: { category: GuideCategory; topic: string; articleType: GuideArticleType }): Promise<GuideDraftResult>`

> **핵심 제약(카드 근거):** `generateArticle`/`validateArticleStructure`를 **재사용 금지** — 얘들은 `핵심 요약` 첫 섹션/`참고 자료` 마지막 섹션을 강제하고 ≥2000자·5~8섹션을 요구해 우리 how-to/guide 구조를 거부한다. 신규 meta/body/validator를 작성한다. `## 단계별 방법`/`## 자주 묻는 질문`은 H2로 방출해야 `extractHeadings`가 인식한다. 페르소나는 '기자'가 아닌 '생활 가이드 에디터'.

- [ ] **Step 1: 실패 테스트 작성 — 검증기 + 프론트 정규식 라운드트립.** `backend/__tests__/services/guideDraftGeneration.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { validateGuideDraftStructure, generateGuideDraft } from '../../src/services/guideDraftGeneration.js';

// 프론트(/guide/[slug].vue)가 실제로 쓰는 정규식 — 반드시 여기서 파싱돼야 JSON-LD 점등
const FAQ_RE = /\*\*Q\.\s*(.+?)\*\*\s*\n\s*A\.\s*([\s\S]*?)(?=\n\*\*Q\.|$)/g;
const STEP_RE = /\d+\.\s*\*\*(.+?)\*\*\s*\n([\s\S]*?)(?=\n\d+\.\s*\*\*|$)/g;

const HOWTO_MD = [
  '## 개요',
  '공영주차장 요금을 아끼는 방법을 안내합니다. '.repeat(20),
  '',
  '## 단계별 방법',
  '',
  '1. **앱 설치하기**',
  '   지자체 주차 앱을 설치합니다.',
  '',
  '2. **차량 등록하기**',
  '   차량 번호를 등록합니다.',
  '',
  '3. **할인 신청하기**',
  '   경차·다자녀 할인을 신청합니다.',
  '',
  '## 자주 묻는 질문',
  '',
  '**Q. 무료 시간이 있나요?**',
  'A. 지자체별로 최초 30분 무료가 있습니다.',
  '',
  '**Q. 경차 할인은?**',
  'A. 대부분 50% 감면됩니다.',
  '',
  '**Q. 정기권도 있나요?**',
  'A. 월 정기권을 운영합니다.',
].join('\n');

describe('validateGuideDraftStructure', () => {
  it('howto는 단계별 방법 + FAQ 둘 다 필요', () => {
    const r = validateGuideDraftStructure(HOWTO_MD, 'howto');
    expect(r.valid, r.errors.join('; ')).toBe(true);
  });
  it('howto에서 단계별 방법 없으면 실패', () => {
    const noSteps = HOWTO_MD.replace('## 단계별 방법', '## 방법');
    expect(validateGuideDraftStructure(noSteps, 'howto').valid).toBe(false);
  });
  it('FAQ 섹션 없으면 실패', () => {
    const noFaq = HOWTO_MD.split('## 자주 묻는 질문')[0];
    expect(validateGuideDraftStructure(noFaq, 'howto').valid).toBe(false);
  });
  it('너무 짧으면 실패', () => {
    expect(validateGuideDraftStructure('## 자주 묻는 질문\n\n**Q. a**\nA. b', 'guide').valid).toBe(false);
  });
});

describe('generateGuideDraft (OpenAI mock)', () => {
  it('생성 결과가 프론트 정규식으로 파싱된다(FAQ≥3, 단계≥3)', async () => {
    const openai = {
      chat: {
        completions: {
          create: vi.fn()
            // 1st call = meta(json_object)
            .mockResolvedValueOnce({
              choices: [{ message: { content: JSON.stringify({
                title: '공영주차장 무료·할인 요금 받는 법',
                summary: '공영주차장 요금을 아끼는 실전 방법을 단계별로 안내합니다. 경차·다자녀 할인까지 정리했습니다.',
                keywords: '공영주차장, 주차요금, 할인, 경차, 거주자우선주차',
              }) } }],
            })
            // 2nd call = body(markdown)
            .mockResolvedValueOnce({ choices: [{ message: { content: HOWTO_MD } }] }),
        },
      },
    } as unknown as import('openai').default;

    const res = await generateGuideDraft(openai, {
      category: 'parking', topic: '공영주차장 무료·할인 요금 받는 법', articleType: 'howto',
    });

    expect(res.title).toBeTruthy();
    expect(res.summary).toBeTruthy();
    const faqs = [...res.content.matchAll(FAQ_RE)];
    const steps = [...res.content.matchAll(STEP_RE)];
    expect(faqs.length).toBeGreaterThanOrEqual(3);
    expect(steps.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: 실패 확인.** `cd backend && npx vitest run __tests__/services/guideDraftGeneration.test.ts` → FAIL(모듈 없음).

- [ ] **Step 3: 구현.** `backend/src/services/guideDraftGeneration.ts`:

```typescript
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
```

> 구현 시 `articleGenerationCore.ts`에서 위 심볼들이 실제로 export되는지 확인(카드 근거: 전부 export됨). `getDbStats`가 실거래 계열/일부에서 `''` 반환하는 건 정상.

- [ ] **Step 4: 통과 확인.** `cd backend && npx vitest run __tests__/services/guideDraftGeneration.test.ts` → PASS.

- [ ] **Step 5: 커밋.**
```bash
git add backend/src/services/guideDraftGeneration.ts backend/__tests__/services/guideDraftGeneration.test.ts
git commit -m "feat(guide): evergreen 가이드 생성기(meta/body/validator)"
```

---

### Task 4: 배치 러너 스크립트

**Files:**
- Create: `backend/src/scripts/generateGuideDrafts.ts`
- Modify: `backend/package.json` (scripts)
- Test: `backend/__tests__/scripts/generateGuideDrafts.test.ts`

**Interfaces:**
- Produces(테스트 대상 순수 함수):
  - `interface CliOptions { category?: GuideCategory; limit: number; dryRun: boolean; onlyMissing: boolean }`
  - `function parseCliOptions(args: string[]): CliOptions`
  - `function selectQueue(topics: GuideTopicSeed[], opts: CliOptions): GuideTopicSeed[]`
  - `async function generateUniqueGuideSlug(category: GuideCategory, articleType: string): Promise<string>`

> **제약:** slug 교차 유니크(article+guide), 초안 `published:false`/`publishedAt:null`, `sources` 필드 쓰지 말 것(Guide에 없음), 썸네일 실패 시 throw, 카운트 3-cap 복사 금지(대신 `--limit`). `main()`은 `import.meta.url === file://${process.argv[1]}` 가드.

- [ ] **Step 1: 실패 테스트 작성.** `backend/__tests__/scripts/generateGuideDrafts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseCliOptions, selectQueue } from '../../src/scripts/generateGuideDrafts.js';
import { FACILITY_GUIDE_TOPICS } from '../../src/data/facilityGuideTopics.js';

describe('parseCliOptions', () => {
  it('기본값: limit=24, dryRun=false, onlyMissing=false', () => {
    const o = parseCliOptions([]);
    expect(o.limit).toBe(24);
    expect(o.dryRun).toBe(false);
    expect(o.onlyMissing).toBe(false);
    expect(o.category).toBeUndefined();
  });
  it('--dry-run --only-missing --limit 5 --category parking 파싱', () => {
    const o = parseCliOptions(['--dry-run', '--only-missing', '--limit', '5', '--category', 'parking']);
    expect(o).toMatchObject({ dryRun: true, onlyMissing: true, limit: 5, category: 'parking' });
  });
  it('알 수 없는 category는 throw', () => {
    expect(() => parseCliOptions(['--category', 'nope'])).toThrow();
  });
});

describe('selectQueue', () => {
  it('category 필터 + limit 적용', () => {
    const q = selectQueue(FACILITY_GUIDE_TOPICS, { limit: 2, dryRun: false, onlyMissing: false, category: 'parking' });
    expect(q).toHaveLength(2);
    expect(q.every((t) => t.category === 'parking')).toBe(true);
  });
  it('category 없으면 전체에서 limit', () => {
    const q = selectQueue(FACILITY_GUIDE_TOPICS, { limit: 3, dryRun: false, onlyMissing: false });
    expect(q).toHaveLength(3);
  });
});
```

- [ ] **Step 2: 실패 확인.** `cd backend && npx vitest run __tests__/scripts/generateGuideDrafts.test.ts` → FAIL.

- [ ] **Step 3: 구현.** `backend/src/scripts/generateGuideDrafts.ts`:

```typescript
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
  const uploadDir = process.env.UPLOAD_DIR || path.resolve(__dirname, '../../assets/images');
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
```

> `uploadDir` 폴백 경로(`../../assets/images`)와 썸네일 파일 경로가 실제 이미지 서빙 라우트(`/api/images/guides/:file`)와 일치하는지 확인. 기존 가이드 썸네일이 `/api/images/guides/*.webp`로 이미 서빙되므로 라우트는 존재.

- [ ] **Step 4: 통과 확인.** `cd backend && npx vitest run __tests__/scripts/generateGuideDrafts.test.ts` → PASS.

- [ ] **Step 5: npm 스크립트 추가.** `backend/package.json` scripts에 추가:
```json
    "generate:guide:drafts": "tsx src/scripts/generateGuideDrafts.ts",
```

- [ ] **Step 6: dry-run 스모크(실 API 미호출).** 실행: `cd backend && npm run generate:guide:drafts -- --dry-run --limit 2`
  Expected: `willGenerate` 2건 JSON 출력, DB 미기록.

- [ ] **Step 7: 커밋.**
```bash
git add backend/src/scripts/generateGuideDrafts.ts backend/package.json backend/__tests__/scripts/generateGuideDrafts.test.ts
git commit -m "feat(guide): 초안 배치 생성 스크립트(교차 slug·멱등·dry-run)"
```

---

### Task 5: 어드민 가이드 서비스 + Zod 스키마 + 라우트

**Files:**
- Create: `backend/src/services/adminGuideService.ts`
- Modify: `backend/src/schemas/admin.ts`
- Modify: `backend/src/routes/admin.ts`
- Test: `backend/__tests__/services/adminGuideService.test.ts`

**Interfaces:**
- Produces:
  - `listAdminGuides(params: { page; limit; published?; category? })`
  - `getAdminGuide(id)`, `updateAdminGuide(id, patch)`
  - `publishGuide(id)` — `published:true` + `publishedAt` **최초 1회만**
  - `unpublishGuide(id)` — `published:false` + `publishedAt:null`
  - `rejectGuide(id)` — 초안+썸네일 삭제(path-traversal-safe)
  - 라우트: `GET /api/admin/guides`, `GET /:id`, `PATCH /:id`, `POST /:id/publish`, `POST /:id/unpublish`, `POST /:id/reject`, `DELETE /:id`

- [ ] **Step 1: 실패 테스트 작성.** `backend/__tests__/services/adminGuideService.test.ts` (prisma·fs 모킹):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const guide = {
  findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), delete: vi.fn(), findFirst: vi.fn(),
};
vi.mock('../../src/lib/prisma.js', () => ({ default: { guide } }));
const unlink = vi.fn().mockResolvedValue(undefined);
vi.mock('fs/promises', () => ({ unlink }));

import { publishGuide, unpublishGuide, rejectGuide } from '../../src/services/adminGuideService.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('publishGuide', () => {
  it('최초 발행 시 publishedAt 세팅', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', publishedAt: null, title: 't', summary: 's', content: 'c', thumbnailUrl: '/api/images/guides/x.webp' });
    guide.update.mockResolvedValue({ id: 'g1' });
    await publishGuide('g1');
    const arg = guide.update.mock.calls[0][0];
    expect(arg.data.published).toBe(true);
    expect(arg.data.publishedAt).toBeInstanceOf(Date);
  });
  it('이미 publishedAt 있으면 유지', async () => {
    const prev = new Date('2026-01-01T00:00:00Z');
    guide.findUnique.mockResolvedValue({ id: 'g1', publishedAt: prev, title: 't', summary: 's', content: 'c', thumbnailUrl: '/x.webp' });
    guide.update.mockResolvedValue({ id: 'g1' });
    await publishGuide('g1');
    expect(guide.update.mock.calls[0][0].data.publishedAt).toEqual(prev);
  });
  it('필수 필드 비면 ValidationError', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', publishedAt: null, title: '', summary: 's', content: 'c', thumbnailUrl: '/x.webp' });
    await expect(publishGuide('g1')).rejects.toThrow();
  });
});

describe('unpublishGuide', () => {
  it('published=false + publishedAt=null', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1' });
    guide.update.mockResolvedValue({ id: 'g1' });
    await unpublishGuide('g1');
    expect(guide.update.mock.calls[0][0].data).toEqual({ published: false, publishedAt: null });
  });
});

describe('rejectGuide', () => {
  it('가이드 디렉터리 안 파일만 unlink 후 삭제', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', thumbnailUrl: '/api/images/guides/x.webp' });
    guide.delete.mockResolvedValue({ id: 'g1' });
    await rejectGuide('g1');
    expect(unlink).toHaveBeenCalledTimes(1);
    expect(guide.delete).toHaveBeenCalledWith({ where: { id: 'g1' } });
  });
  it('경로 탈출 시도(../)는 unlink 스킵하되 삭제는 진행', async () => {
    guide.findUnique.mockResolvedValue({ id: 'g1', thumbnailUrl: '/api/images/guides/../../etc/passwd' });
    guide.delete.mockResolvedValue({ id: 'g1' });
    await rejectGuide('g1');
    // basename('../../etc/passwd')='passwd' → GUIDES_IMAGE_DIR 안으로 정규화되어 unlink 1회, 탈출 아님
    expect(guide.delete).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 실패 확인.** `cd backend && npx vitest run __tests__/services/adminGuideService.test.ts` → FAIL.

- [ ] **Step 3: 서비스 구현.** `backend/src/services/adminGuideService.ts`:

```typescript
import path from 'path';
import { fileURLToPath } from 'url';
import { unlink } from 'fs/promises';
import prisma from '../lib/prisma.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_DIR = path.resolve(process.env.UPLOAD_DIR || path.resolve(__dirname, '../../assets/images'));
const GUIDES_IMAGE_DIR = path.join(UPLOAD_DIR, 'guides');

const GUIDE_LIST_SELECT = {
  id: true, title: true, slug: true, summary: true, category: true, articleType: true,
  thumbnailUrl: true, keywords: true, published: true, viewCount: true,
  publishedAt: true, createdAt: true, updatedAt: true,
};

export interface AdminGuideListParams { page: number; limit: number; published?: boolean; category?: string; }
export interface AdminGuidePatch { title?: string; summary?: string; keywords?: string | null; content?: string; }

export async function listAdminGuides(params: AdminGuideListParams) {
  const { page, limit, published, category } = params;
  const skip = (page - 1) * limit;
  const where = {
    ...(published !== undefined ? { published } : {}),
    ...(category ? { category } : {}),
  };
  const [total, items] = await Promise.all([
    prisma.guide.count({ where }),
    prisma.guide.findMany({ where, orderBy: [{ published: 'asc' }, { createdAt: 'desc' }], skip, take: limit, select: GUIDE_LIST_SELECT }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return { items, total, page, totalPages };
}

export async function getAdminGuide(id: string) {
  const g = await prisma.guide.findUnique({ where: { id } });
  if (!g) throw new NotFoundError('가이드를 찾을 수 없습니다');
  return g;
}

export async function updateAdminGuide(id: string, patch: AdminGuidePatch) {
  const existing = await prisma.guide.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  return prisma.guide.update({ where: { id }, data: patch });
}

export async function publishGuide(id: string) {
  const existing = await prisma.guide.findUnique({
    where: { id },
    select: { id: true, publishedAt: true, title: true, summary: true, content: true, thumbnailUrl: true },
  });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  if (!existing.title || !existing.summary || !existing.content || !existing.thumbnailUrl) {
    throw new ValidationError('발행에 필요한 필드(제목·요약·본문·썸네일)가 비어 있습니다');
  }
  return prisma.guide.update({
    where: { id },
    data: { published: true, publishedAt: existing.publishedAt ?? new Date() },
  });
}

export async function unpublishGuide(id: string) {
  const existing = await prisma.guide.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  return prisma.guide.update({ where: { id }, data: { published: false, publishedAt: null } });
}

export async function rejectGuide(id: string): Promise<void> {
  const existing = await prisma.guide.findUnique({ where: { id }, select: { id: true, thumbnailUrl: true } });
  if (!existing) throw new NotFoundError('가이드를 찾을 수 없습니다');
  if (existing.thumbnailUrl) {
    const filename = path.basename(existing.thumbnailUrl);
    const resolved = path.resolve(GUIDES_IMAGE_DIR, filename);
    if (resolved.startsWith(GUIDES_IMAGE_DIR + path.sep)) {
      await unlink(resolved).catch((err: unknown) => {
        const code = (err as { code?: string } | undefined)?.code;
        if (code !== 'ENOENT') console.warn('썸네일 삭제 실패:', err instanceof Error ? err.message : err);
      });
    }
  }
  await prisma.guide.delete({ where: { id } });
}
```

- [ ] **Step 4: Zod 스키마 추가.** `backend/src/schemas/admin.ts`에 추가(기존 AdminArticle* 옆, `published`는 문자열→boolean 변환):

```typescript
import { z } from 'zod';

export const AdminGuideListSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  published: z.enum(['true', 'false']).transform((v) => v === 'true').optional(),
  category: z.string().min(1).max(50).optional(),
});

export const AdminGuideIdSchema = z.object({ id: z.string().min(1) });

export const AdminGuidePatchSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  summary: z.string().min(1).max(500).optional(),
  keywords: z.string().max(500).nullable().optional(),
  content: z.string().min(1).optional(),
});
```

- [ ] **Step 5: 라우트 추가.** `backend/src/routes/admin.ts`에 import + `/guides` 블록(모든 핸들러 `requireAdmin`; 상태변경에 `requireSameOrigin`):

```typescript
import {
  AdminGuideListSchema, AdminGuideIdSchema, AdminGuidePatchSchema,
} from '../schemas/admin.js';
import {
  listAdminGuides, getAdminGuide, updateAdminGuide, publishGuide, unpublishGuide, rejectGuide,
} from '../services/adminGuideService.js';

router.get('/guides', requireAdmin, validate(AdminGuideListSchema, 'query'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await listAdminGuides(req.query as unknown as { page: number; limit: number; published?: boolean; category?: string }) });
  }));

router.get('/guides/:id', requireAdmin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await getAdminGuide((req.params as unknown as { id: string }).id) });
  }));

router.patch('/guides/:id', requireAdmin, requireSameOrigin,
  validate(AdminGuideIdSchema, 'params'), validate(AdminGuidePatchSchema, 'body'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await updateAdminGuide((req.params as unknown as { id: string }).id, req.body) });
  }));

router.post('/guides/:id/publish', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await publishGuide((req.params as unknown as { id: string }).id) });
  }));

router.post('/guides/:id/unpublish', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    res.json({ success: true, data: await unpublishGuide((req.params as unknown as { id: string }).id) });
  }));

router.post('/guides/:id/reject', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    await rejectGuide((req.params as unknown as { id: string }).id);
    res.json({ success: true, data: { deleted: true } });
  }));

router.delete('/guides/:id', requireAdmin, requireSameOrigin, validate(AdminGuideIdSchema, 'params'),
  asyncHandler(async (req, res) => {
    await rejectGuide((req.params as unknown as { id: string }).id);
    res.json({ success: true, data: { deleted: true } });
  }));
```
> `validate`가 Express 5 read-only query/params를 `Object.defineProperty`로 교체하는 기존 미들웨어와 동일하게 동작(article 라우트와 같은 패턴)하는지 확인.

- [ ] **Step 6: 통과 확인.** 실행: `cd backend && npx vitest run __tests__/services/adminGuideService.test.ts` → PASS.

- [ ] **Step 7: 전체 백엔드 테스트 + 린트.** 실행: `cd backend && npm run test && npm run lint`
  Expected: 전체 PASS, 린트 0 에러. 기존 실패 테스트 있으면 즉시 수정.

- [ ] **Step 8: 커밋.**
```bash
git add backend/src/services/adminGuideService.ts backend/src/schemas/admin.ts backend/src/routes/admin.ts backend/__tests__/services/adminGuideService.test.ts
git commit -m "feat(guide): 어드민 가이드 API(목록·발행·발행취소·반려)"
```

---

## Phase 1 완료 후

- develop로 PR(`feat/facility-guide-generation-backend` 등) → CI green → 사용자 머지.
- 그 다음 **Phase 2(프론트: `/admin` 가이드 탭 + `useAdminGuides` + `[slug].vue` publishedAt) 플랜**을 이 문서 옆에 작성한다(실제 API 셰이프 확정 후). Phase 3는 운영 런북(배치 실행→검토→발행→main 배포·라이브 검증).

## Self-Review 체크

- Spec 커버리지: 생성기(T3)·씨앗(T2)·배치(T4)·어드민API(T5)·스키마(T1) 전부 태스크 존재. ✅
- 플레이스홀더: 각 코드 스텝에 실제 코드. ✅
- 타입 일관성: `GuideArticleType`(howto|guide), `GuideTopicSeed`, `AdminGuide*` 시그니처가 태스크 간 일치. Guide엔 `sources`/`status` 없음 명시. ✅
