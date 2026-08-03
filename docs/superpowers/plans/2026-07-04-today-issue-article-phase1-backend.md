# 오늘의 이슈(/article) — Phase 1: 백엔드 기반 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `Article` 데이터 모델과, 기존 뉴스 생성 파이프라인을 재활용하는 "오늘의 이슈" 전용 생성기 `generateArticle.ts`를 추가해, 검토 대기(draft) 상태의 시의성 기사를 생성할 수 있게 한다(공개 노출·자동 발행 없음).

**Architecture:** 기존 `backend/src/scripts/generateGuide.ts`의 모델-불가지론적 생성 로직(키워드 발굴·리서치·기사 생성·썸네일·검증)을 `backend/src/services/articleGenerationCore.ts`로 추출하고, `generateArticle.ts`가 이 코어 + Article 전용 오케스트레이션(교차-테이블 slug 충돌 회피, /article 내부링크, 출처 캡처, 썸네일 실패=중단, `prisma.article` draft 저장)을 구성한다. 기존 `generateGuide.ts`는 코어를 재-import해 동작·테스트를 그대로 유지한다(가이드 생성기 은퇴는 Phase 5).

**Tech Stack:** TypeScript ESM(로컬 import에 `.js` 확장자 필수), Prisma(MySQL), OpenAI(`gpt-4o-mini` + `gpt-image-1`), 네이버 검색 API, Vitest.

## Global Constraints

- **Node 20 필수.** 의존성 추가/설치는 `nvm use 20 && npm install`만 사용, **package-lock.json 삭제·재생성 금지**.
- **ESM**: 모든 로컬 import에 `.js` 확장자(`import x from './y.js'`).
- **데이터 수집 최대화**: 리서치 소스는 선별하지 말고 사용한 것 전량 저장.
- **PR 기반**: 이 Phase는 단일 PR. main 직접 커밋 금지, CI 통과 후 머지.
- **TDD**: 각 Task는 실패 테스트 → 최소 구현 → 통과 → 커밋.
- **썸네일 함정**: `.webp` 경로에 PNG를 그대로 쓰지 말 것(Safari 거부). 인코딩 실패 시 **throw**(초안 미생성), PNG 폴백 금지.
- **Article은 항상 `status:'draft'`, `publishedAt:null`로 생성** — 이 Phase에 자동 발행 경로를 만들지 않는다.
- 스키마 컨벤션: `status`/`articleType`는 `String @db.VarChar`(앱 레벨 enum), cuid id, `@@index` 스타일은 기존 `Guide` 모델을 따른다.

---

## Phase 0 — 프리플라이트 (코드 아님, 착수 전 확인)

구현 전 아래를 실측하고 결과를 이 문서 하단 "Preflight Results"에 기록한다. 미해소 시 조용한 실패(초안 0건)·D3 붕괴 위험.

- [ ] **P0-1**: Cafe24 서버에 이미지 인코딩 바이너리(`cwebp` 또는 `convert`)가 설치돼 있는지 확인. 없으면 (a) 서버에 `libwebp` 설치, 또는 (b) 생성을 CI/로컬에서 수행하고 이미지 SCP — 택1 확정. (Phase 5 배포 전 필수, Phase 1 코드에는 영향 없음.)
- [ ] **P0-2**: **서버 crontab에 `generate:guide`(generateGuide) 스케줄이 있는지 확인**(레포엔 없음 → 서버 crontab 의심). 있으면 Phase 5에서 `generate:article`로 교체 대상으로 기록. (Phase 1 코드에는 영향 없음.)
- [ ] **P0-3**: 서버 `backend/.env`에 `OPENAI_API_KEY`/`NAVER_CLIENT_ID`/`NAVER_CLIENT_SECRET`이 존재하는지 확인(생성기 런타임 의존).

---

## File Structure

- **Create** `backend/src/services/articleGenerationCore.ts` — 모델-불가지론적 생성 파이프라인(generateGuide에서 추출). 순수/재사용 함수만. Prisma·모델 결합 없음.
- **Modify** `backend/prisma/schema.prisma` — `Article` 모델 추가.
- **Modify** `backend/src/scripts/generateGuide.ts` — 추출된 함수를 코어에서 re-import(동작 불변). 가이드 전용 오케스트레이션(`generateOneGuide`, `buildInternalLinks`, `getRecentTitles`, `getDbStats`, `getCta`, `getHubUrl`)은 그대로 유지.
- **Create** `backend/src/scripts/generateArticle.ts` — Article 전용 오케스트레이터(draft 생성).
- **Create** `backend/__tests__/scripts/generateArticle.test.ts` — generateArticle happy-path·엣지 테스트.
- **Modify** `backend/__tests__/scripts/generateGuide.test.ts` — 코어 추출 후에도 green 유지(import 경로 불변; generateGuide.js가 re-export).
- **Modify** `backend/package.json` — `generate:article` npm 스크립트 추가.

기존 `generateGuide.test.ts`가 `generateGuide.js`에서 import하는 심볼(`parseCliOptions, isGuideCategory, fetchNaverSearch, discoverTrendingKeyword, researchByKeyword, extractHeadings, validateArticleStructure, stripDateMarkers, normalizeSections, isSummaryHeading, isReferencesHeading, GUIDE_CATEGORIES, generateOneGuide`)은 추출 후에도 `generateGuide.js`에서 계속 export되어야 한다(코어 re-export).

---

## Task 1: `Article` Prisma 모델 추가

**Files:**
- Modify: `backend/prisma/schema.prisma` (Guide 모델 뒤, line 773 이후)

**Interfaces:**
- Produces: `prisma.article` delegate — fields `id, title, slug, content, summary, category, articleType, thumbnailUrl, keywords, sources(Json?), status, viewCount, publishedAt(DateTime?), createdAt, updatedAt`.

- [ ] **Step 1: `Article` 모델을 스키마에 추가**

`backend/prisma/schema.prisma`의 `Guide` 모델(line 773 `}` 닫힘) 바로 다음에 삽입:

```prisma
// 오늘의 이슈(/article) 콘텐츠 테이블 — 시의성 뉴스/정책. 검토 워크플로우(draft→published) 지원.
model Article {
  id           String    @id @default(cuid())
  title        String    @db.VarChar(200)
  slug         String    @unique @db.VarChar(200)
  content      String    @db.LongText
  summary      String    @db.VarChar(500)
  category     String    @db.VarChar(50)
  articleType  String    @default("news-brief") @db.VarChar(20)
  thumbnailUrl String?   @db.VarChar(500)
  keywords     String?   @db.VarChar(500)
  sources      Json?
  status       String    @default("draft") @db.VarChar(20)
  viewCount    Int       @default(0)
  publishedAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([status, publishedAt])
  @@index([category])
  @@index([slug])
  @@index([articleType])
}
```

- [ ] **Step 2: 스키마를 DB에 반영하고 클라이언트 재생성**

Run:
```bash
cd backend && npm run db:push && npm run db:generate
```
Expected: `db:push`가 `Article` 테이블 생성 성공, `db:generate`가 `prisma.article` 타입 생성. 에러 없음.

- [ ] **Step 3: 모델 접근 가능 확인(스모크)**

Run:
```bash
cd backend && node -e "const {PrismaClient}=require('@prisma/client'); const p=new PrismaClient(); p.article.count().then(n=>{console.log('article count:',n); return p.\$disconnect();}).catch(e=>{console.error(e);process.exit(1);})"
```
Expected: `article count: 0` 출력(테이블 존재·쿼리 가능).

- [ ] **Step 4: 커밋**

```bash
cd backend && git add prisma/schema.prisma
git commit -m "feat(article): Article 모델 추가 (오늘의 이슈 draft/published 워크플로우)"
```

---

## Task 2: 공유 생성 코어 추출 (`articleGenerationCore.ts`)

**목표:** generateGuide.ts의 모델-불가지론적 함수를 코어로 **이동**하고, generateGuide.ts는 코어에서 re-import한다. 기존 generateGuide 테스트가 그대로 green이면 리팩터가 안전하다는 증거.

**Files:**
- Create: `backend/src/services/articleGenerationCore.ts`
- Modify: `backend/src/scripts/generateGuide.ts`
- Test(안전망): `backend/__tests__/scripts/generateGuide.test.ts` (수정 없이 green 유지)

**Interfaces:**
- Produces (코어 export): `GUIDE_CATEGORIES`, `GuideCategory`, `CATEGORY_LABELS`, `isGuideCategory`, `isRealEstateLike`, `NaverSearchItem`, `fetchNaverSearch`, `dedupItems`, `discoverTrendingKeyword`, `researchByKeyword`, `formatResearchContext`, `SectionPlan`, `ArticleMeta`, `ArticleResult`, `generateArticleMeta`, `generateSectionBody`, `generateArticle`, `generateThumbnail`, `extractHeadings`, `validateArticleStructure`, `stripDateMarkers`, `normalizeSections`, `isSummaryHeading`, `isReferencesHeading`, `getDbStats`, `sectionMinChars`.
- Consumes: `prisma` (from `../lib/prisma.js`) — `getDbStats`만 사용(시설 count). 나머지는 모델 불가지론적.

- [ ] **Step 1: 코어 파일 생성 — generateGuide.ts에서 함수 이동**

`backend/src/services/articleGenerationCore.ts` 생성. `generateGuide.ts`의 **line 9~742 영역**에서 아래를 그대로 이동(cut)한다: import 블록(dotenv/openai/child_process/fs/path/prisma), `GUIDE_CATEGORIES`, `GuideCategory`, `REAL_ESTATE_LIKE`, `CATEGORY_LABELS`, `isGuideCategory`, `isRealEstateLike`, `NaverSearchItem`, `stripHtmlTags`, `fetchNaverSearch`, `dedupItems`, `discoverTrendingKeyword`, `researchByKeyword`, `formatResearchContext`, 상수(`MIN_SECTION_COUNT`~`REFERENCES_MAX_CHARS`), `isSummaryHeading`, `isReferencesHeading`, `sectionMinChars`, `ArticleResult`, `extractHeadings`, `extractSectionBodies`, `validateArticleStructure`, `stripDateMarkers`, `SectionPlan`, `ArticleMeta`, `generateArticleMeta`, `inferSectionStyleHints`, `generateSectionBody`, `normalizeSections`, `generateArticle`, `generateThumbnail`, `getDbStats`(+ `FACILITY_COUNT`).

이동 시 **현재 private(비-export)인 함수 5개를 export로 변경**: `generateArticleMeta`, `generateSectionBody`, `generateArticle`, `generateThumbnail`, `formatResearchContext`, `getDbStats`, `dedupItems`, `sectionMinChars`, `CATEGORY_LABELS`, `isRealEstateLike`. (기존에 이미 export였던 것은 그대로.)

`getDbStats`가 참조하는 `prisma`는 코어에서 `import prisma from '../lib/prisma.js';`로 유지(경로가 `services/`로 바뀌므로 `../lib/prisma.js`가 맞음).

- [ ] **Step 2: generateGuide.ts를 코어 re-import로 전환**

`generateGuide.ts` 상단 import 영역을, 이동한 심볼을 코어에서 가져오도록 교체하고, 테스트 호환을 위해 re-export한다. `generateGuide.ts` 상단을 다음으로 시작하도록 수정:

```ts
// Guide 자동 생성 — 슬림 버전 (생성 코어는 services/articleGenerationCore.ts로 추출)
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
```

`generateGuide.ts`에는 가이드 전용 로직만 남긴다: `CliOptions`/`parseCliOptions`, `RELATED`, `getHubUrl`, `getCta`, `buildInternalLinks`, `getRecentTitles`, `generateSlug`, `pickRandomCategory`, `GeneratedGuide`, `generateOneGuide`, `main`, CLI entry. 이들이 참조하던 이동 심볼(`CATEGORY_LABELS`, `discoverTrendingKeyword`, `researchByKeyword`, `formatResearchContext`, `generateArticle`, `generateThumbnail`, `getDbStats`, `isRealEstateLike`)은 위 import로 해결된다.

`parseCliOptions`는 `generateGuide.test.ts`가 import하므로 generateGuide.ts에 그대로 두고 export 유지. (article용은 Task 3에서 별도 정의.)

- [ ] **Step 3: 백엔드 타입체크/린트로 이동 정합성 확인**

Run:
```bash
cd backend && npx tsc --noEmit && npm run lint
```
Expected: 타입 에러·미해결 import 없음. (누락 export/경로 문제가 여기서 드러남 → 수정.)

- [ ] **Step 4: 기존 generateGuide 테스트가 그대로 통과하는지 확인(리팩터 안전망)**

Run:
```bash
cd backend && npx vitest run __tests__/scripts/generateGuide.test.ts
```
Expected: PASS (전부). import 경로(`../../src/scripts/generateGuide.js`)는 그대로이고 re-export로 심볼이 유지되므로 green. 실패 시 Step 2의 re-export 목록·경로를 점검.

- [ ] **Step 5: 커밋**

```bash
cd backend && git add src/services/articleGenerationCore.ts src/scripts/generateGuide.ts
git commit -m "refactor(article): 생성 파이프라인을 articleGenerationCore로 추출 (guide 동작 불변)"
```

---

## Task 3: `generateArticle.ts` — 오늘의 이슈 draft 생성기

**Files:**
- Create: `backend/src/scripts/generateArticle.ts`
- Create: `backend/__tests__/scripts/generateArticle.test.ts`
- Modify: `backend/package.json`

**Interfaces:**
- Consumes (코어): `discoverTrendingKeyword`, `researchByKeyword`, `formatResearchContext`, `generateArticle`, `generateThumbnail`, `getDbStats`, `CATEGORY_LABELS`, `GUIDE_CATEGORIES`, `isGuideCategory`, `GuideCategory`, `NaverSearchItem`.
- Produces: `parseArticleCliOptions(args?)→{category?, topic?, count, dryRun}`, `getRecentTitlesCrossTable(category, days?)→string[]`, `buildArticleInternalLinks(category, currentSlug)→Promise<string>`, `toSources(items)→Array<{title,url}>`, `generateUniqueArticleSlug(category)→Promise<string>`, `generateOneArticle({category?, topic?})→Promise<{id,slug,title,category,keyword}>`, `generateArticles(count, opts)`.

- [ ] **Step 1: 실패 테스트 작성 — happy path + draft 저장 + 교차 slug + 썸네일 실패**

`backend/__tests__/scripts/generateArticle.test.ts` 생성:

```ts
// generateArticle — 오늘의 이슈 draft 생성기 테스트
import { describe, it, expect, vi, beforeEach } from 'vitest';

const {
  mockArticleCreate,
  mockArticleFindMany,
  mockArticleFindUnique,
  mockGuideFindMany,
  mockGuideFindUnique,
  mockCount,
  mockFetch,
  mockChatCreate,
  mockImageGenerate,
} = vi.hoisted(() => ({
  mockArticleCreate: vi.fn(),
  mockArticleFindMany: vi.fn().mockResolvedValue([]),
  mockArticleFindUnique: vi.fn().mockResolvedValue(null),
  mockGuideFindMany: vi.fn().mockResolvedValue([]),
  mockGuideFindUnique: vi.fn().mockResolvedValue(null),
  mockCount: vi.fn().mockResolvedValue(100),
  mockFetch: vi.fn(),
  mockChatCreate: vi.fn(),
  mockImageGenerate: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  default: {
    article: { create: mockArticleCreate, findMany: mockArticleFindMany, findUnique: mockArticleFindUnique },
    guide: { findMany: mockGuideFindMany, findUnique: mockGuideFindUnique },
    toilet: { count: mockCount }, aed: { count: mockCount }, hospital: { count: mockCount },
    pharmacy: { count: mockCount }, parking: { count: mockCount }, wifi: { count: mockCount },
    clothes: { count: mockCount }, park: { count: mockCount }, school: { count: mockCount },
    market: { count: mockCount }, library: { count: mockCount }, childcare: { count: mockCount },
    evCharger: { count: mockCount }, sports: { count: mockCount }, wasteSchedule: { count: mockCount },
    $disconnect: vi.fn(),
  },
}));

vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
    images = { generate: mockImageGenerate };
  },
}));
vi.mock('child_process', () => ({ execFileSync: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

process.env.NAVER_CLIENT_ID = 'test-id';
process.env.NAVER_CLIENT_SECRET = 'test-secret';
process.env.OPENAI_API_KEY = 'test-openai-key';

import {
  parseArticleCliOptions,
  toSources,
  buildArticleInternalLinks,
  generateOneArticle,
} from '../../src/scripts/generateArticle.js';

const DEFAULT_HEADINGS = ['핵심 요약', '이번 이슈에서 봐야 할 점', '달라지는 내용', '지금 확인할 것', '주의할 점', '참고 자료'];
const SECTION_BODY = '이 섹션 본문입니다. 실제 확인 행동과 사이트 데이터 연결을 구체적으로 설명합니다. 기관명·절차를 포함합니다. '.repeat(10);

function setupNaver(items: unknown[]) {
  mockFetch.mockImplementation(async () => ({ ok: true, json: async () => ({ items }) }));
}
function setupGen() {
  mockChatCreate.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const prompt = messages[0]?.content ?? '';
    if (prompt.includes('제목·요약·키워드')) {
      return { choices: [{ message: { content: JSON.stringify({
        title: '오늘의 이슈 테스트 제목입니다 스무자 이상',
        summary: '오늘의 이슈 테스트 요약입니다. 50자 이상의 요약 텍스트를 작성합니다.',
        keywords: '키워드1, 키워드2, 키워드3',
        sections: DEFAULT_HEADINGS.map((h) => ({ heading: h, description: `${h} 설명` })),
      }) } }] };
    }
    return { choices: [{ message: { content: SECTION_BODY } }] };
  });
}

describe('parseArticleCliOptions', () => {
  it('count를 1..3으로 clamp하고 파싱', () => {
    expect(parseArticleCliOptions(['--count', '3']).count).toBe(3);
    expect(parseArticleCliOptions(['--count', '99']).count).toBe(3);
    expect(parseArticleCliOptions(['--count', '0']).count).toBe(1);
    expect(parseArticleCliOptions([]).count).toBe(3); // 기본 3
  });
  it('알 수 없는 카테고리는 throw', () => {
    expect(() => parseArticleCliOptions(['--category', 'nope'])).toThrow(/Unknown category/);
  });
});

describe('toSources', () => {
  it('리서치 아이템을 {title,url}로 전량 매핑', () => {
    const out = toSources([
      { title: 'A', description: 'd', link: 'https://a.com' },
      { title: 'B', description: 'd', link: 'https://b.com' },
    ]);
    expect(out).toEqual([
      { title: 'A', url: 'https://a.com' },
      { title: 'B', url: 'https://b.com' },
    ]);
  });
});

describe('buildArticleInternalLinks', () => {
  beforeEach(() => { mockArticleFindMany.mockReset().mockResolvedValue([]); });
  it('/article/ 경로로 내부링크 생성 (/guide 아님)', async () => {
    mockArticleFindMany.mockResolvedValue([{ slug: 'pharmacy-x', title: '다른 이슈' }]);
    const md = await buildArticleInternalLinks('pharmacy', 'pharmacy-cur');
    expect(md).toContain('/article/pharmacy-x');
    expect(md).not.toContain('/guide/');
  });
});

describe('generateOneArticle — happy path', () => {
  beforeEach(() => {
    mockFetch.mockReset(); mockChatCreate.mockReset(); mockImageGenerate.mockReset();
    mockArticleCreate.mockReset(); mockArticleFindMany.mockReset().mockResolvedValue([]);
    mockArticleFindUnique.mockReset().mockResolvedValue(null);
    mockGuideFindUnique.mockReset().mockResolvedValue(null);
    mockGuideFindMany.mockReset().mockResolvedValue([]);
  });

  it('draft 상태(status:draft, publishedAt:null)로 저장', async () => {
    setupNaver([{ title: '관련 뉴스', description: '...', link: 'https://a.com' }]);
    setupGen();
    mockImageGenerate.mockResolvedValue({ data: [{ b64_json: Buffer.from('x').toString('base64') }] });
    mockArticleCreate.mockImplementation(async ({ data }: any) => ({ id: 'a1', ...data }));

    const result = await generateOneArticle({ category: 'pharmacy', topic: '야간 약국 운영' });

    expect(result.category).toBe('pharmacy');
    expect(result.slug).toMatch(/^pharmacy-/);
    expect(mockArticleCreate).toHaveBeenCalledOnce();
    const arg = mockArticleCreate.mock.calls[0][0].data;
    expect(arg.status).toBe('draft');
    expect(arg.publishedAt).toBeNull();
    expect(arg.articleType).toBe('news-brief');
    expect(Array.isArray(arg.sources)).toBe(true);
    expect(arg.thumbnailUrl).toMatch(/^\/api\/images\/articles\//);
  });

  it('slug가 Guide와 충돌하면 새 slug 재발급', async () => {
    setupNaver([{ title: '뉴스', description: '...', link: 'https://a.com' }]);
    setupGen();
    mockImageGenerate.mockResolvedValue({ data: [{ b64_json: Buffer.from('x').toString('base64') }] });
    // 첫 slug는 guide에 존재, 두 번째는 없음
    mockGuideFindUnique.mockResolvedValueOnce({ id: 'g1' }).mockResolvedValue(null);
    mockArticleCreate.mockImplementation(async ({ data }: any) => ({ id: 'a2', ...data }));

    await generateOneArticle({ category: 'toilet', topic: '개방화장실' });
    expect(mockGuideFindUnique).toHaveBeenCalled(); // 교차 테이블 확인함
    expect(mockArticleCreate).toHaveBeenCalledOnce();
  });

  it('썸네일 생성 실패 시 throw하고 저장 스킵', async () => {
    setupNaver([{ title: '뉴스', description: '...', link: 'https://a.com' }]);
    setupGen();
    mockImageGenerate.mockRejectedValue(new Error('image fail'));
    await expect(generateOneArticle({ category: 'pharmacy', topic: '야간 약국' }))
      .rejects.toThrow(/썸네일/);
    expect(mockArticleCreate).not.toHaveBeenCalled();
  });

  it('OPENAI_API_KEY 없으면 throw', async () => {
    const k = process.env.OPENAI_API_KEY; delete process.env.OPENAI_API_KEY;
    await expect(generateOneArticle({ category: 'toilet', topic: 't' })).rejects.toThrow(/OPENAI_API_KEY/);
    process.env.OPENAI_API_KEY = k;
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run:
```bash
cd backend && npx vitest run __tests__/scripts/generateArticle.test.ts
```
Expected: FAIL — `generateArticle.js` 모듈/심볼 미존재.

- [ ] **Step 3: `generateArticle.ts` 구현**

`backend/src/scripts/generateArticle.ts` 생성:

```ts
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
} from '../services/articleGenerationCore.js';
import type { GuideCategory, NaverSearchItem } from '../services/articleGenerationCore.js';

export interface ArticleCliOptions {
  category?: GuideCategory;
  topic?: string;
  count: number;
  dryRun: boolean;
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
  return {
    category: rawCategory as GuideCategory | undefined,
    topic: read('--topic'),
    count,
    dryRun: args.includes('--dry-run'),
  };
}

// 오늘의 이슈 내부링크는 /article/ 경로로. 광고 CTA 아닌 "다음 확인 행동".
function getArticleHubUrl(c: GuideCategory): string {
  if (c === 'apt-sale') return '/real-estate/apt-sale';
  if (c === 'apt-rent') return '/real-estate/apt-rent';
  if (c === 'subscription') return '/real-estate/subscription';
  if (c === 'public-rental') return '/public-rental';
  return `/${c}`;
}

const RELATED_HUB: Partial<Record<GuideCategory, GuideCategory>> = {
  toilet: 'parking', aed: 'hospital', hospital: 'pharmacy', pharmacy: 'hospital',
  parking: 'ev-charger', clothes: 'trash', park: 'sports', school: 'childcare',
  market: 'parking', library: 'school', trash: 'clothes', childcare: 'school',
  'ev-charger': 'parking', sports: 'park', 'apt-sale': 'subscription',
  'apt-rent': 'apt-sale', subscription: 'apt-sale', 'public-rental': 'subscription',
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
  if (c === 'public-rental') return `일상킷에서 ${label} 매물을 바로 확인해보세요.`;
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
```

- [ ] **Step 4: 썸네일 PNG-as-webp 폴백 제거 (코어 수정)**

`articleGenerationCore.ts`의 `generateThumbnail` 내부 `catch { await writeFile(outputPath, buffer); ... }`(원본 generateGuide.ts line 631-634) 블록을 **인코딩 실패 시 false 반환**으로 변경(PNG를 .webp로 쓰지 않음):

```ts
    try {
      execFileSync('convert', [tmpPath, '-resize', '800x', '-quality', '80', outputPath], { stdio: 'pipe' });
      const optimized = await stat(outputPath);
      console.log(`썸네일: ${(buffer.length / 1024).toFixed(0)}KB → ${(optimized.size / 1024).toFixed(0)}KB`);
    } catch (e) {
      await unlink(tmpPath).catch(() => {});
      console.warn('썸네일 인코딩 실패(webp 변환 불가) — 초안 미생성:', e instanceof Error ? e.message : e);
      return false; // PNG를 .webp로 저장하지 않음(Safari 거부 방지). 호출부가 throw 처리.
    }
```

(주: `generateOneArticle`은 `imageOk===false`면 이미 throw한다. 가이드 생성기도 같은 코어를 쓰지만 Phase 5에서 은퇴 예정이므로 동작 변화 무해.)

- [ ] **Step 5: `generate:article` npm 스크립트 추가**

`backend/package.json`의 scripts에 (기존 `generate:guide` 항목 근처) 추가:

```json
    "generate:article": "tsx src/scripts/generateArticle.ts",
```

- [ ] **Step 6: 테스트 통과 확인**

Run:
```bash
cd backend && npx vitest run __tests__/scripts/generateArticle.test.ts
```
Expected: PASS (전부).

- [ ] **Step 7: 전체 백엔드 테스트·린트·타입체크로 회귀 없음 확인**

Run:
```bash
cd backend && npm run test && npm run lint && npx tsc --noEmit
```
Expected: PASS. (generateGuide 테스트 포함 기존 스위트 green — 코어 추출 회귀 없음 재확인.)

- [ ] **Step 8: 커밋**

```bash
cd backend && git add src/scripts/generateArticle.ts src/services/articleGenerationCore.ts __tests__/scripts/generateArticle.test.ts package.json
git commit -m "feat(article): 오늘의 이슈 draft 생성기 generateArticle 추가 (교차-slug·출처 캡처·썸네일 throw)"
```

---

## Self-Review (spec 대비)

- **Article 모델(spec §1)** → Task 1. ✅ (status/sources/publishedAt/인덱스 포함)
- **공유 코어 추출 + private→export(spec §3, 리뷰 arch minor)** → Task 2. ✅
- **draft 저장·자동발행 없음(D4)** → Task 3 Step 1/3(`status:'draft'`, `publishedAt:null`, publish 경로 부재). ✅
- **출처 전량 캡처(spec §3, 데이터 최대화)** → `toSources` + `sources` 저장. ✅ (publisher/date는 Phase 3 상세 렌더 전 확장 여지 — 현재 title/url. §5 빈 sources 미렌더로 안전.)
- **교차-테이블 slug 유일성(리뷰 SEO minor)** → `generateUniqueArticleSlug` + 테스트. ✅
- **/article 내부링크(/guide 아님)** → `buildArticleInternalLinks` + 테스트. ✅
- **썸네일 PNG-as-webp 함정 제거(리뷰 arch major)** → Task 3 Step 4. ✅
- **교차 dedup(리뷰 arch minor)** → `getRecentTitlesCrossTable`(guide+article). ✅
- **AdminSession 모델** → 이 Phase 아님. Phase 2(인증)에서 사용처와 함께 추가.
- **generateGuide news 하드 제거 + D3 테스트** → 이 Phase 아님. Phase 5(자동화, crontab 교체 시점)로 이동 — Phase 1을 순수 추가형으로 유지해 회귀 위험 최소화.
- **키/cwebp/crontab 프리플라이트(리뷰 arch major)** → Phase 0 체크리스트.

## Preflight Results (P0-1~3 기록)

- P0-1 (cwebp/convert): _(착수 시 기록)_
- P0-2 (server crontab generate:guide): _(착수 시 기록)_
- P0-3 (server .env keys): _(착수 시 기록)_

## Phase 1 완료 기준(DoD)

- `npm run generate:article -- --category pharmacy --topic "테스트"` 실행 시 Article이 `status:'draft'`로 생성(로컬 DB, 키 필요).
- `npm run test`(백엔드) green, `npm run lint` green, `npx tsc --noEmit` green.
- `/guide` 및 기존 생성기 동작 불변(회귀 없음).
- 공개 노출·자동 발행 경로 없음(의도).
