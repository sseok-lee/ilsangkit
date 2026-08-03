# 오늘의 이슈 — 정책 브리핑 트랙 P1(백엔드) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 기존 "오늘의 이슈"(`/article`) 생성 파이프라인에 정부 정책뉴스 원문 전문을 근거로 삼는 "정책 브리핑" 생성 트랙을 추가하고, 공유 제목 프롬프트를 관심유발형으로 강화한다.

**Architecture:** 새 `policyBriefingClient.ts`가 data.go.kr 정책뉴스 API(15095335)에서 본문 전문을 가져오고, `articleGenerationCore.ts`에 정책 컨텍스트 포매터·후보 선정 로직을 추가한다. `generateArticle.ts`는 `--track policy` 분기로 정책 항목 1건을 골라 기존 `generateArticle()` 코어를 그대로 재사용해 draft를 만든다. 뉴스 트랙은 불변, 어드민 트리거(track 파라미터)와 프론트는 P2.

**Tech Stack:** Node 20, TypeScript(ESM), Express 5, Prisma(MySQL 8), OpenAI `gpt-4o-mini`, Vitest.

## Global Constraints

- **Node 20 필수** — 작업 전 `nvm use 20`. lock 파일 삭제·재생성 금지(`rm package-lock.json` 금지).
- **ESM import 규칙** — 모든 로컬 import에 `.js` 확장자 필수 (`import x from '../lib/x.js'`).
- **PR 워크플로우** — `develop`에서 브랜치 분기, main 직접 커밋 금지, CI 통과 후 머지. 커밋 전 `npm run test`·`npm run lint` 통과.
- **모델** — 모든 텍스트 생성은 `gpt-4o-mini`, 썸네일은 `gpt-image-1`(기존 `generateThumbnail` 재사용).
- **썸네일 실패 = throw** — PNG를 `.webp`로 저장 금지. `generateThumbnail`이 false 반환 시 호출부가 throw (기존 계약).
- **articleType** — 정책 트랙 저장 시 반드시 `'policy-brief'`. 뉴스 트랙 기본값 `'news-brief'` 불변.
- **출처 표기 필수** — 정책 글 본문 말미에 "출처: 대한민국 정책브리핑(korea.kr)" + 원문 링크(공공누리 제1유형 의무). 원문 이미지는 재사용 안 함.
- **제목 규칙** — 관심유발형이되 과장·낚시(클릭베이트) 금지(브랜드 성격: 실용적·신뢰감·깔끔함).
- **API 키** — 정책뉴스 API는 기존 `OPENAPI_SERVICE_KEY`(data.go.kr) 재사용.
- **포커스 카테고리** — P1 대상은 `subscription`, `apt-sale`, `apt-rent`, `childcare` 4개(모두 기존 `GUIDE_CATEGORIES`에 존재).
- **작업 브랜치** — 예: `feat/today-issue-policy-track-p1`.

---

## File Structure

**신규**
- `backend/src/services/policyBriefingClient.ts` — data.go.kr 정책뉴스 클라이언트(fetch + 파싱 + 날짜/HTML 유틸)
- `backend/__tests__/services/policyBriefingClient.test.ts`
- `backend/__tests__/services/articleGenerationCore.policy.test.ts` — 정책 코어 + 제목 규칙 테스트

**수정**
- `backend/prisma/schema.prisma` — `Article.sourceExternalId` 추가(Task 1)
- `backend/src/services/articleGenerationCore.ts` — `formatPolicyContext`·`POLICY_FOCUS_CATEGORIES`·`selectPolicyCandidate`(Task 3), 제목 프롬프트 강화(Task 4)
- `backend/src/scripts/generateArticle.ts` — `--track` 파싱·`filterUnseenPolicyItems`·`generateOnePolicyArticle`·main 분기(Task 5)
- `backend/__tests__/scripts/generateArticle.test.ts` — 정책 트랙 테스트 추가(Task 5)

---

## Task 1: Prisma 스키마 — `Article.sourceExternalId` dedup 컬럼

**Files:**
- Modify: `backend/prisma/schema.prisma:777-798` (Article 모델)

**Interfaces:**
- Produces: `Article.sourceExternalId: string | null` 컬럼 + `@@index([sourceExternalId])`. Task 5의 dedup 조회(`prisma.article.findMany({ where: { sourceExternalId: { in } } })`)와 저장(`create({ data: { sourceExternalId } })`)이 이 컬럼에 의존.

- [ ] **Step 1: 스키마에 컬럼 추가**

`backend/prisma/schema.prisma`의 Article 모델을 수정. `sources Json?` 다음 줄에 컬럼을 추가하고, 인덱스 블록에 인덱스를 추가:

```prisma
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
  sourceExternalId String? @db.VarChar(100)
  status       String    @default("draft") @db.VarChar(20)
  viewCount    Int       @default(0)
  publishedAt  DateTime?
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@index([status, publishedAt])
  @@index([category])
  @@index([slug])
  @@index([articleType])
  @@index([sourceExternalId])
}
```

- [ ] **Step 2: 스키마 검증**

Run: `cd backend && npx prisma validate`
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 3: Prisma Client 재생성 + 로컬 DB 반영**

Run: `cd backend && npm run db:generate && npm run db:push`
Expected: `db:generate`는 `Generated Prisma Client` 출력, `db:push`는 `Your database is now in sync with your Prisma schema` (로컬 MySQL 3307 실행 중이어야 함 — `docker compose up -d`).

- [ ] **Step 4: 타입 반영 확인**

Run: `cd backend && npx tsc --noEmit`
Expected: 에러 없음(기존 코드가 새 필드로 깨지지 않음).

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(article): add sourceExternalId column for policy dedup"
```

---

## Task 2: `policyBriefingClient.ts` — data.go.kr 정책뉴스 클라이언트

**Files:**
- Create: `backend/src/services/policyBriefingClient.ts`
- Test: `backend/__tests__/services/policyBriefingClient.test.ts`

**Interfaces:**
- Consumes: `process.env.OPENAPI_SERVICE_KEY`, 전역 `fetch`.
- Produces:
  - `interface PolicyNewsItem { newsItemId: string; title: string; subTitle: string; ministerCode: string; dataContents: string; approveDate: string; originalUrl: string; thumbnailUrl: string; }`
  - `interface FetchPolicyOptions { startDate: string; endDate: string; numOfRows?: number; pageNo?: number; }`
  - `function toYyyymmdd(d: Date): string`
  - `function stripHtml(s: string): string`
  - `function parsePolicyResponse(raw: unknown): PolicyNewsItem[]`
  - `async function fetchRecentPolicyNews(opts: FetchPolicyOptions): Promise<PolicyNewsItem[]>`
- Task 3(`selectPolicyCandidate`, `formatPolicyContext`)과 Task 5(`generateOnePolicyArticle`)가 `PolicyNewsItem`·`fetchRecentPolicyNews`·`toYyyymmdd`를 소비.

> **라이브 검증 주의(구현자 필수):** 이 클라이언트는 문서화된 JSON 응답 형태를 가정한다. P1 착수 시 활용신청된 키로 실제 엔드포인트를 1회 호출해 (a) `type=json`이 실제 JSON을 주는지(일부 data.go.kr는 XML 전용) (b) 최상위 배열 위치와 필드명(`NewsItem`/`NewsItemId`/`DataContents` 등)을 확인하고, 어긋나면 `parsePolicyResponse`의 매핑만 조정한다. XML 전용이면 `res.json()`이 throw → `[]` 반환되므로, 그때만 XML 파싱 경로를 추가(다른 함수는 불변).

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/__tests__/services/policyBriefingClient.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  toYyyymmdd,
  stripHtml,
  parsePolicyResponse,
  fetchRecentPolicyNews,
} from '../../src/services/policyBriefingClient.js';

const SAMPLE = {
  NewsItem: [
    {
      NewsItemId: 'P1001',
      Title: '청약제도 개편안 발표',
      SubTitle1: '무주택 실수요자 중심 개편',
      MinisterCode: '1741000',
      DataContents: '<p>국토교통부는 청약제도를 <b>개편</b>한다.</p>',
      ContentsType: 'H',
      ApproveDate: '20260705',
      OriginalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
      ThumbnailUrl: 'https://www.korea.kr/thumb/P1001.jpg',
    },
    { NewsItemId: '', Title: '', DataContents: '' }, // 불완전 → 필터링됨
  ],
};

describe('toYyyymmdd', () => {
  it('YYYYMMDD로 0패딩 포맷', () => {
    expect(toYyyymmdd(new Date(2026, 6, 5))).toBe('20260705'); // month는 0-index(6=July)
  });
});

describe('stripHtml', () => {
  it('태그 제거 후 trim', () => {
    expect(stripHtml('<p>국토교통부는 <b>개편</b>한다.</p>')).toBe('국토교통부는 개편한다.');
  });
});

describe('parsePolicyResponse', () => {
  it('필드 매핑 + HTML 제거 + 불완전 항목 필터', () => {
    const out = parsePolicyResponse(SAMPLE);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({
      newsItemId: 'P1001',
      title: '청약제도 개편안 발표',
      subTitle: '무주택 실수요자 중심 개편',
      ministerCode: '1741000',
      dataContents: '국토교통부는 청약제도를 개편한다.',
      approveDate: '20260705',
      originalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
      thumbnailUrl: 'https://www.korea.kr/thumb/P1001.jpg',
    });
  });
  it('알 수 없는 형태면 빈 배열', () => {
    expect(parsePolicyResponse({})).toEqual([]);
    expect(parsePolicyResponse(null)).toEqual([]);
  });
});

describe('fetchRecentPolicyNews', () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal('fetch', mockFetch);
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
  });

  it('키 없으면 빈 배열(fail-soft)', async () => {
    delete process.env.OPENAPI_SERVICE_KEY;
    const out = await fetchRecentPolicyNews({ startDate: '20260601', endDate: '20260705' });
    expect(out).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    process.env.OPENAPI_SERVICE_KEY = 'test-key';
  });

  it('HTTP 실패면 빈 배열', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });
    const out = await fetchRecentPolicyNews({ startDate: '20260601', endDate: '20260705' });
    expect(out).toEqual([]);
  });

  it('성공 시 파싱 + startDate/endDate 쿼리 포함', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => SAMPLE });
    const out = await fetchRecentPolicyNews({ startDate: '20260601', endDate: '20260705', numOfRows: 50 });
    expect(out).toHaveLength(1);
    expect(out[0].newsItemId).toBe('P1001');
    const calledUrl = String(mockFetch.mock.calls[0][0]);
    expect(calledUrl).toContain('startDate=20260601');
    expect(calledUrl).toContain('endDate=20260705');
    expect(calledUrl).toContain('numOfRows=50');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/policyBriefingClient.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/policyBriefingClient.js'`

- [ ] **Step 3: 클라이언트 구현**

Create `backend/src/services/policyBriefingClient.ts`:

```ts
// data.go.kr 정책브리핑 정책뉴스 API(15095335) 클라이언트.
// 정책 원문 전문(DataContents)을 근거로 오늘의 이슈 정책 트랙 글을 생성하기 위한 소스.
// 엔드포인트: http://apis.data.go.kr/1371000/policyNewsService/policyNewsList
// 라이선스: 공공누리 제1유형(출처표시). 인증: OPENAPI_SERVICE_KEY(data.go.kr).

import 'dotenv/config';

const POLICY_NEWS_ENDPOINT =
  'http://apis.data.go.kr/1371000/policyNewsService/policyNewsList';

export interface PolicyNewsItem {
  newsItemId: string;
  title: string;
  subTitle: string;
  ministerCode: string;
  dataContents: string; // HTML 제거된 본문 전문
  approveDate: string;
  originalUrl: string;
  thumbnailUrl: string;
}

export interface FetchPolicyOptions {
  startDate: string; // YYYYMMDD
  endDate: string; // YYYYMMDD
  numOfRows?: number;
  pageNo?: number;
}

export function toYyyymmdd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}${m}${day}`;
}

export function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 응답 최상위 배열 위치가 문서/실측 간 다를 수 있어 알려진 형태를 관대하게 탐색.
function pickItemsArray(raw: unknown): Record<string, unknown>[] {
  if (!raw || typeof raw !== 'object') return [];
  const r = raw as Record<string, any>;
  if (Array.isArray(r.NewsItem)) return r.NewsItem;
  if (r.NewsItem) return [r.NewsItem];
  const body = r.response?.body ?? r.body;
  const items = body?.items;
  if (Array.isArray(items)) return items;
  if (items?.item) return Array.isArray(items.item) ? items.item : [items.item];
  if (Array.isArray(r.items)) return r.items;
  return [];
}

function mapRawItem(r: Record<string, unknown>): PolicyNewsItem {
  const g = (...keys: string[]): string => {
    for (const k of keys) {
      const v = r[k];
      if (v !== undefined && v !== null) return String(v).trim();
    }
    return '';
  };
  return {
    newsItemId: g('NewsItemId', 'newsItemId'),
    title: stripHtml(g('Title', 'title')),
    subTitle: stripHtml(g('SubTitle1', 'subTitle1', 'SubTitle')),
    ministerCode: g('MinisterCode', 'ministerCode'),
    dataContents: stripHtml(g('DataContents', 'dataContents')),
    approveDate: g('ApproveDate', 'approveDate'),
    originalUrl: g('OriginalUrl', 'originalUrl'),
    thumbnailUrl: g('ThumbnailUrl', 'thumbnailUrl'),
  };
}

export function parsePolicyResponse(raw: unknown): PolicyNewsItem[] {
  return pickItemsArray(raw)
    .map(mapRawItem)
    .filter((it) => it.newsItemId && it.title && it.dataContents);
}

export async function fetchRecentPolicyNews(
  opts: FetchPolicyOptions
): Promise<PolicyNewsItem[]> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY;
  if (!serviceKey) {
    console.warn('OPENAPI_SERVICE_KEY 누락 — 정책 리서치 스킵');
    return [];
  }

  const url = new URL(POLICY_NEWS_ENDPOINT);
  url.searchParams.set('serviceKey', serviceKey);
  url.searchParams.set('startDate', opts.startDate);
  url.searchParams.set('endDate', opts.endDate);
  url.searchParams.set('pageNo', String(opts.pageNo ?? 1));
  url.searchParams.set('numOfRows', String(opts.numOfRows ?? 50));
  url.searchParams.set('type', 'json');

  try {
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      console.warn(`정책뉴스 API 실패: HTTP ${res.status}`);
      return [];
    }
    const data = (await res.json()) as unknown;
    return parsePolicyResponse(data);
  } catch (err) {
    console.warn('정책뉴스 API 에러:', err instanceof Error ? err.message : err);
    return [];
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/policyBriefingClient.test.ts`
Expected: PASS (모든 테스트 green)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/policyBriefingClient.ts backend/__tests__/services/policyBriefingClient.test.ts
git commit -m "feat(article): add data.go.kr policy news client for policy track"
```

---

## Task 3: 코어 — 정책 컨텍스트 포매터 + 후보 선정

**Files:**
- Modify: `backend/src/services/articleGenerationCore.ts` (파일 끝, 기존 export들 뒤에 추가)
- Test: `backend/__tests__/services/articleGenerationCore.policy.test.ts`

**Interfaces:**
- Consumes: `PolicyNewsItem`(Task 2), 기존 `CATEGORY_LABELS`·`isGuideCategory`·`GuideCategory`(동일 파일), `OpenAI`.
- Produces:
  - `const POLICY_FOCUS_CATEGORIES: GuideCategory[]` = `['subscription','apt-sale','apt-rent','childcare']`
  - `function formatPolicyContext(item: PolicyNewsItem): string`
  - `interface PolicyCandidate { item: PolicyNewsItem; category: GuideCategory; keyword: string; }`
  - `async function selectPolicyCandidate(openai, items: PolicyNewsItem[], focusCategories: GuideCategory[]): Promise<PolicyCandidate | null>`
- Task 5(`generateOnePolicyArticle`)가 이 셋을 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

Create `backend/__tests__/services/articleGenerationCore.policy.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockChatCreate } = vi.hoisted(() => ({ mockChatCreate: vi.fn() }));
vi.mock('openai', () => ({
  default: class MockOpenAI {
    chat = { completions: { create: mockChatCreate } };
  },
}));
// 코어는 prisma를 import하므로 최소 stub (이 테스트에선 미사용)
vi.mock('../../src/lib/prisma.js', () => ({ default: {} }));

import OpenAI from 'openai';
import {
  POLICY_FOCUS_CATEGORIES,
  formatPolicyContext,
  selectPolicyCandidate,
} from '../../src/services/articleGenerationCore.js';
import type { PolicyNewsItem } from '../../src/services/policyBriefingClient.js';

const ITEM: PolicyNewsItem = {
  newsItemId: 'P1001',
  title: '청약제도 개편안 발표',
  subTitle: '무주택 실수요자 중심',
  ministerCode: '1741000',
  dataContents: '국토교통부는 특별공급을 확대한다. 신혼부부 물량이 늘어난다.',
  approveDate: '20260705',
  originalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
  thumbnailUrl: '',
};

describe('POLICY_FOCUS_CATEGORIES', () => {
  it('부동산·주거·육아 4종', () => {
    expect(POLICY_FOCUS_CATEGORIES).toEqual(['subscription', 'apt-sale', 'apt-rent', 'childcare']);
  });
});

describe('formatPolicyContext', () => {
  it('원문 전문 포함 + 임의생성 금지 계약 + 정책 원문 블록', () => {
    const ctx = formatPolicyContext(ITEM);
    expect(ctx).toContain('[정책 원문]');
    expect(ctx).toContain('국토교통부는 특별공급을 확대한다');
    expect(ctx).toContain('임의로 만들지 마세요');
    expect(ctx).toContain('정책브리핑');
  });
});

describe('selectPolicyCandidate', () => {
  beforeEach(() => mockChatCreate.mockReset());
  const openai = new OpenAI({ apiKey: 'test' });

  it('유효 응답이면 후보 반환', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 0, category: 'subscription', keyword: '청약 특별공급 개편' }) } }] });
    const out = await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES);
    expect(out).not.toBeNull();
    expect(out!.category).toBe('subscription');
    expect(out!.item.newsItemId).toBe('P1001');
    expect(out!.keyword).toBe('청약 특별공급 개편');
  });

  it('none:true면 null', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ none: true }) } }] });
    expect(await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES)).toBeNull();
  });

  it('포커스 밖 카테고리면 null', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 0, category: 'toilet', keyword: 'x 정책' }) } }] });
    expect(await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES)).toBeNull();
  });

  it('index 범위 밖이면 null', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ index: 9, category: 'subscription', keyword: 'x 정책' }) } }] });
    expect(await selectPolicyCandidate(openai, [ITEM], POLICY_FOCUS_CATEGORIES)).toBeNull();
  });

  it('빈 목록이면 null', async () => {
    expect(await selectPolicyCandidate(openai, [], POLICY_FOCUS_CATEGORIES)).toBeNull();
    expect(mockChatCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/articleGenerationCore.policy.test.ts`
Expected: FAIL — `POLICY_FOCUS_CATEGORIES`/`formatPolicyContext`/`selectPolicyCandidate` export 없음

- [ ] **Step 3: 코어에 구현 추가**

`backend/src/services/articleGenerationCore.ts` 상단 import 블록(기존 `import prisma from '../lib/prisma.js';` 아래)에 타입 import 추가:

```ts
import type { PolicyNewsItem } from './policyBriefingClient.js';
```

그리고 파일 **맨 끝**에 아래를 추가:

```ts
// ---------------------------------------------------------------------------
// 정책 브리핑 트랙 — 정책뉴스 원문 전문 기반 생성 앞단
// ---------------------------------------------------------------------------

// 국가 정책이 실제로 움직이고 독자 관심도 높은 카테고리로 한정(국토부·복지부 중심).
export const POLICY_FOCUS_CATEGORIES: GuideCategory[] = [
  'subscription',
  'apt-sale',
  'apt-rent',
  'childcare',
];

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

  const catList = focusCategories.map((c) => `${c}(${CATEGORY_LABELS[c]})`).join(', ');
  const listing = items
    .map((it, i) => `${i}. [${it.title}] ${it.subTitle}\n   ${it.dataContents.slice(0, 200)}`)
    .join('\n');

  const prompt = `다음은 최근 정부 정책뉴스 후보 ${items.length}건입니다.
${listing}

아래 카테고리 중 하나에 명확히 해당하고, 시민 관심도가 가장 높은 정책 1건을 고르세요.
카테고리: ${catList}

규칙:
- 위 카테고리 중 하나에 명확히 해당하는 정책만 선택
- 해당하는 정책이 없으면 none
- keyword는 글 주제가 될 구체적인 2~8단어

JSON으로만 응답: { "index": 0, "category": "subscription", "keyword": "..." } 또는 { "none": true }`;

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
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/articleGenerationCore.policy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/articleGenerationCore.ts backend/__tests__/services/articleGenerationCore.policy.test.ts
git commit -m "feat(article): add policy context formatter and candidate selector"
```

---

## Task 4: 코어 — 제목 프롬프트 강화(공유, 양 트랙 적용)

**Files:**
- Modify: `backend/src/services/articleGenerationCore.ts:350-377` (`generateArticleMeta`의 prompt)
- Test: `backend/__tests__/services/articleGenerationCore.policy.test.ts` (Task 3 파일에 describe 추가)

**Interfaces:**
- 시그니처 변경 없음. `generateArticleMeta`가 openai에 보내는 프롬프트 문자열에 `<title-rules>`가 포함되도록 하는 동작 변경. 뉴스·정책 트랙 공유(코어 함수라 양쪽 제목 개선).

> **회귀 주의:** 기존 `__tests__/scripts/generateArticle.test.ts`의 meta mock은 프롬프트 내용과 무관하게 고정 title을 반환하므로 이 변경으로 깨지지 않는다(Step 4에서 재확인).

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/services/articleGenerationCore.policy.test.ts` 파일 하단에 describe 추가. 상단 import에 `generateArticleMeta`를 추가:

```ts
// (파일 상단 import 문에 generateArticleMeta 추가)
import {
  POLICY_FOCUS_CATEGORIES,
  formatPolicyContext,
  selectPolicyCandidate,
  generateArticleMeta,
} from '../../src/services/articleGenerationCore.js';
```

```ts
describe('generateArticleMeta — 제목 규칙 강화', () => {
  beforeEach(() => mockChatCreate.mockReset());
  const openai = new OpenAI({ apiKey: 'test' });

  it('프롬프트에 title-rules(관심유발·과장금지)가 포함된다', async () => {
    mockChatCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({
      title: '테스트 제목입니다 스무자 이상으로 작성',
      summary: '테스트 요약입니다. 50자 이상의 요약 텍스트를 채워 넣습니다 채워요.',
      keywords: 'a, b, c',
      sections: [{ heading: '핵심 요약', description: 'x' }, { heading: '참고 자료', description: 'y' }],
    }) } }] });

    await generateArticleMeta(openai, 'subscription', '청약 개편', '[정책 원문] ...', '');

    const sentPrompt = String(mockChatCreate.mock.calls[0][0].messages[0].content);
    expect(sentPrompt).toContain('title-rules');
    expect(sentPrompt).toContain('낚시');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/articleGenerationCore.policy.test.ts -t "제목 규칙"`
Expected: FAIL — 프롬프트에 `title-rules` 없음

- [ ] **Step 3: 프롬프트 수정**

`articleGenerationCore.ts`의 `generateArticleMeta` 내 prompt를 수정. `<section-rules>` 블록 **앞**에 `<title-rules>` 블록을 추가하고, JSON 스키마 예시의 title 줄을 교체:

```ts
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
```

- [ ] **Step 4: 테스트 통과 + 뉴스 트랙 회귀 확인**

Run: `cd backend && npx vitest run __tests__/services/articleGenerationCore.policy.test.ts __tests__/scripts/generateArticle.test.ts`
Expected: PASS (신규 제목 규칙 테스트 + 기존 generateArticle 테스트 전부 green)

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/articleGenerationCore.ts backend/__tests__/services/articleGenerationCore.policy.test.ts
git commit -m "feat(article): strengthen title prompt for engaging non-clickbait titles"
```

---

## Task 5: 오케스트레이터 — `--track policy` + `generateOnePolicyArticle`

**Files:**
- Modify: `backend/src/scripts/generateArticle.ts`
- Test: `backend/__tests__/scripts/generateArticle.test.ts` (기존 파일에 추가)

**Interfaces:**
- Consumes: `fetchRecentPolicyNews`·`toYyyymmdd`·`PolicyNewsItem`(Task 2), `formatPolicyContext`·`selectPolicyCandidate`·`POLICY_FOCUS_CATEGORIES`(Task 3), 기존 `generateArticle`·`getDbStats`·`generateThumbnail`(core), 기존 `generateUniqueArticleSlug`·`buildArticleInternalLinks`·`getArticleCta`(동일 파일), `Article.sourceExternalId`(Task 1).
- Produces:
  - `ArticleCliOptions`에 `track: 'news' | 'policy'` 추가(기본 `'news'`)
  - `async function filterUnseenPolicyItems(items: PolicyNewsItem[]): Promise<PolicyNewsItem[]>`
  - `async function generateOnePolicyArticle(options?: { lookbackDays?: number }): Promise<GeneratedArticle | null>`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/scripts/generateArticle.test.ts`에 추가. 먼저 파일 상단 env 스텁 블록(`process.env.OPENAI_API_KEY = ...` 근처)에 정책 API 키를 추가:

```ts
process.env.OPENAPI_SERVICE_KEY = 'test-service-key';
```

그리고 import 블록의 `generateOneArticle` 옆에 정책 함수들을 추가:

```ts
import {
  parseArticleCliOptions,
  toSources,
  buildArticleInternalLinks,
  generateOneArticle,
  generateOnePolicyArticle,
} from '../../src/scripts/generateArticle.js';
```

파일 하단에 아래 describe 블록들을 추가:

```ts
// ---------------------------------------------------------------------------
// 정책 브리핑 트랙
// ---------------------------------------------------------------------------
function setupPolicyFetch() {
  mockFetch.mockImplementation(async () => ({
    ok: true,
    json: async () => ({
      NewsItem: [
        {
          NewsItemId: 'P1001',
          Title: '청약제도 개편안 발표',
          SubTitle1: '무주택 실수요자 중심',
          MinisterCode: '1741000',
          DataContents: '<p>국토교통부는 특별공급을 확대한다. 신혼부부 물량이 늘어난다.</p>'.repeat(3),
          ApproveDate: '20260705',
          OriginalUrl: 'https://www.korea.kr/news/policyView.do?newsId=P1001',
          ThumbnailUrl: '',
        },
      ],
    }),
  }));
}

function setupPolicyGen(candidate: object = { index: 0, category: 'subscription', keyword: '청약 특별공급 개편' }) {
  mockChatCreate.mockImplementation(async ({ messages }: { messages: Array<{ content: string }> }) => {
    const prompt = messages[0]?.content ?? '';
    if (prompt.includes('정책뉴스 후보')) {
      return { choices: [{ message: { content: JSON.stringify(candidate) } }] };
    }
    if (prompt.includes('제목·요약·키워드')) {
      return { choices: [{ message: { content: JSON.stringify({
        title: '청약 특별공급 이렇게 바뀐다 실수요자 3가지 변화',
        summary: '이번 청약 개편의 핵심을 무주택 실수요자 관점에서 정리했습니다. 무엇이 달라지는지 봅니다.',
        keywords: '청약, 특별공급, 개편',
        sections: DEFAULT_HEADINGS.map((h) => ({ heading: h, description: `${h} 설명` })),
      }) } }] };
    }
    return { choices: [{ message: { content: SECTION_BODY } }] };
  });
}

describe('parseArticleCliOptions — track', () => {
  it('기본 track은 news', () => {
    expect(parseArticleCliOptions([]).track).toBe('news');
  });
  it('--track policy 파싱', () => {
    expect(parseArticleCliOptions(['--track', 'policy']).track).toBe('policy');
  });
  it('알 수 없는 track은 news로 폴백', () => {
    expect(parseArticleCliOptions(['--track', 'garbage']).track).toBe('news');
  });
});

describe('generateOnePolicyArticle', () => {
  beforeEach(() => {
    mockFetch.mockReset(); mockChatCreate.mockReset(); mockImageGenerate.mockReset();
    mockArticleCreate.mockReset();
    mockArticleFindMany.mockReset().mockResolvedValue([]);
    mockArticleFindUnique.mockReset().mockResolvedValue(null);
    mockGuideFindUnique.mockReset().mockResolvedValue(null);
    mockGuideFindMany.mockReset().mockResolvedValue([]);
  });

  it('policy-brief로 저장 + sourceExternalId + 출처 표기', async () => {
    setupPolicyFetch();
    setupPolicyGen();
    mockImageGenerate.mockResolvedValue({ data: [{ b64_json: Buffer.from('x').toString('base64') }] });
    mockArticleCreate.mockImplementation(async ({ data }: any) => ({ id: 'p1', ...data }));

    const result = await generateOnePolicyArticle();

    expect(result).not.toBeNull();
    expect(result!.category).toBe('subscription');
    const arg = mockArticleCreate.mock.calls[0][0].data;
    expect(arg.articleType).toBe('policy-brief');
    expect(arg.sourceExternalId).toBe('P1001');
    expect(arg.status).toBe('draft');
    expect(arg.sources[0].url).toContain('korea.kr');
    expect(arg.content).toContain('정책브리핑');
    expect(arg.content).toContain('https://www.korea.kr/news/policyView.do?newsId=P1001');
  });

  it('적합 후보 없으면 null + 미저장', async () => {
    setupPolicyFetch();
    setupPolicyGen({ none: true });
    const result = await generateOnePolicyArticle();
    expect(result).toBeNull();
    expect(mockArticleCreate).not.toHaveBeenCalled();
  });

  it('이미 쓴 정책(sourceExternalId 중복)은 제외 → null', async () => {
    setupPolicyFetch();
    setupPolicyGen();
    mockArticleFindMany.mockResolvedValue([{ sourceExternalId: 'P1001' }]); // 이미 사용됨
    const result = await generateOnePolicyArticle();
    expect(result).toBeNull();
    expect(mockArticleCreate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/scripts/generateArticle.test.ts -t "정책|track|Policy"`
Expected: FAIL — `generateOnePolicyArticle` export 없음 / `track` 없음

- [ ] **Step 3: 오케스트레이터 구현**

`backend/src/scripts/generateArticle.ts` 수정.

3a. import 블록에 정책 심볼 추가. 기존 core import에 세 개를 추가하고, 정책 클라이언트 import를 새로 추가:

```ts
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
import {
  fetchRecentPolicyNews,
  toYyyymmdd,
} from '../services/policyBriefingClient.js';
import type { PolicyNewsItem } from '../services/policyBriefingClient.js';
```

3b. `ArticleCliOptions` 인터페이스와 `parseArticleCliOptions`에 `track` 추가:

```ts
export interface ArticleCliOptions {
  category?: GuideCategory;
  topic?: string;
  count: number;
  dryRun: boolean;
  track: 'news' | 'policy';
}
```

`parseArticleCliOptions`의 `return` 직전과 return 객체를 수정:

```ts
  const rawTrack = read('--track');
  const track: 'news' | 'policy' = rawTrack === 'policy' ? 'policy' : 'news';
  return {
    category: rawCategory as GuideCategory | undefined,
    topic: read('--topic'),
    count,
    dryRun: args.includes('--dry-run'),
    track,
  };
```

3c. `generateOneArticle` 함수 **뒤**에 dedup 헬퍼와 정책 생성기를 추가:

```ts
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

  const lookbackDays = options.lookbackDays ?? 10;
  const end = new Date();
  const start = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);
  const raw = await fetchRecentPolicyNews({
    startDate: toYyyymmdd(start),
    endDate: toYyyymmdd(end),
    numOfRows: 50,
  });
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
```

3d. `main()` 함수 시작부에 track 분기를 추가(`if (options.dryRun)` **앞**):

```ts
async function main(): Promise<void> {
  const options = parseArticleCliOptions();
  if (options.track === 'policy') {
    await generateOnePolicyArticle();
    return;
  }
  if (options.dryRun) {
    // ...기존 코드 유지...
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/scripts/generateArticle.test.ts`
Expected: PASS (신규 정책 테스트 + 기존 뉴스 테스트 전부 green)

- [ ] **Step 5: 전체 백엔드 게이트 (lint + build + test)**

Run: `cd backend && npm run lint && npm run build && npm run test`
Expected: 린트 통과, `tsc` 빌드 성공(새 필드/함수 타입 정상), 전체 vitest green.

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/generateArticle.ts backend/__tests__/scripts/generateArticle.test.ts
git commit -m "feat(article): add policy briefing generation track (--track policy)"
```

---

## Self-Review (작성자 점검 완료)

**1. Spec 커버리지** — §3 소스(Task 2 client), §4.1 policyBriefingClient(Task 2), §4.2 formatPolicyContext·POLICY_FOCUS_CATEGORIES·selectPolicyCandidate(Task 3), §4.3 generateOnePolicyArticle·`--track`(Task 5), §4.4 sourceExternalId 스키마(Task 1), §4.6 출처 표기(Task 5 attribution), §4.7 제목 강화(Task 4). **P1 범위 외**(계획대로 제외): §4.5 어드민 track 파라미터(P2), 공개/SEO(P3), MinisterCode 부처 프리필터(GPT 배정이 실질 게이트라 P1 생략 — 스펙 §4.3 2번 "코드 확정 전 스킵 가능"과 일치).
**2. 플레이스홀더 스캔** — 없음. 모든 코드/테스트 전문 기재. 라이브 검증 노트(Task 2)는 TODO가 아니라 검증 지침.
**3. 타입 일관성** — `PolicyNewsItem`(client) → core/orchestrator 동일 소비. `PolicyCandidate.{item,category,keyword}` ↔ `generateOnePolicyArticle` 구조분해 일치. `articleType='policy-brief'`·`sourceExternalId` ↔ Task 1 컬럼 일치. `track: 'news'|'policy'` ↔ `parseArticleCliOptions`·`main` 일치.

---

## Execution Handoff

이 플랜은 P1(백엔드)만 다룬다. 완료 후 P2(어드민 track 트리거·"정책" 뱃지)·P3(공개·SEO·배포)는 각각 별도 플랜으로 작성한다(스펙 §8).
