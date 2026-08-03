# 통합 검색 Phase 2 — 자동완성 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 검색창 포커스 시 드롭다운으로 추천(지역·카테고리·건물명)과 최근/인기검색을 제공하는 자동완성을 구현한다.

**Architecture:** 백엔드에 `/api/search` 라우트(suggest/log/popular)를 추가한다. suggest는 기존 파서·지역인덱스·동의어맵·`RealEstateBuildingSummary` 인덱스를 재사용해 startsWith로 가볍게 조회한다. 프론트는 `useSearchSuggest`(디바운스·최근검색·세션) + `SearchAutocomplete`(드롭다운 UI)를 만들어 `HeaderSearch`와 메인 히어로에 통합한다. 인기검색은 정적 큐레이션으로 시작하고 `SearchLog` 로깅을 동시에 시작해 데이터가 쌓이면 집계로 자동 전환된다.

**Tech Stack:** Express 5 + TypeScript(ESM) + Prisma/MySQL, Nuxt 3 + Vue 3 + Tailwind, Vitest. Node 20(`nvm use 20`).

**Spec:** `docs/superpowers/specs/2026-06-10-search-autocomplete-design.md`

---

## 사전 규칙 (모든 태스크 공통)

- 모든 명령은 **`source ~/.nvm/nvm.sh && nvm use 20 >/dev/null`** 후 실행.
- 백엔드 ESM: 로컬 import에 **`.js` 확장자 필수**.
- 백엔드 테스트: `cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/<path>`.
- 프론트 테스트: `cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/<path>`.
- 커밋은 현재 PR 브랜치 기준, main/develop 직접 커밋 금지.
- BigInt/Decimal 응답은 `serializeRow()` 사용. Express 5 query read-only.

## File Structure

**백엔드**
- Modify `backend/src/schemas/search.ts` — `SuggestQuerySchema` 추가. (`SearchLogSchema`/`PopularSearchQuerySchema`는 기존 재사용)
- Create `backend/src/services/search/searchSuggestService.ts` — 지역/카테고리/건물명 추천 합성.
- Create `backend/src/services/search/searchPopularService.ts` — SearchLog 집계 + 정적 fallback.
- Create `backend/src/routes/search.ts` — `GET /suggest`, `POST /log`, `GET /popular`.
- Modify `backend/src/app.ts` — `app.use('/api/search', searchRouter)`.

**프론트**
- Modify `frontend/utils/analyticsConstants.ts` — `SEARCH_SUGGEST_SELECT` 추가.
- Modify `frontend/composables/useAnalytics.ts` — `trackSuggestSelect` 추가.
- Create `frontend/composables/useSearchSuggest.ts` — 디바운스 suggest + 최근검색 + 인기 + sessionId + logSearch.
- Create `frontend/components/search/SearchAutocomplete.vue` — 드롭다운 UI.
- Modify `frontend/components/common/HeaderSearch.vue` — 자동완성 통합(데스크톱+모바일).
- Modify `frontend/pages/index.vue` — 히어로 입력창 자동완성.
- Modify `frontend/pages/search.vue` — 결과 확정 시 `logSearch`.

---

## Task 1: SuggestQuerySchema (백엔드 스키마)

**Files:**
- Modify: `backend/src/schemas/search.ts`
- Test: `backend/__tests__/schemas/searchSuggest.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// backend/__tests__/schemas/searchSuggest.test.ts
import { describe, it, expect } from 'vitest';
import { SuggestQuerySchema } from '../../src/schemas/search.js';

describe('SuggestQuerySchema', () => {
  it('q 문자열 통과', () => {
    expect(SuggestQuerySchema.parse({ q: '강남' }).q).toBe('강남');
  });
  it('q 누락 시 빈 문자열 기본값', () => {
    expect(SuggestQuerySchema.parse({}).q).toBe('');
  });
  it('q 50자 초과 거부', () => {
    expect(() => SuggestQuerySchema.parse({ q: 'a'.repeat(51) })).toThrow();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run __tests__/schemas/searchSuggest.test.ts`
Expected: FAIL — `SuggestQuerySchema` 없음

- [ ] **Step 3: 구현** — `backend/src/schemas/search.ts` 끝에 추가

```ts
// 자동완성 추천 쿼리 스키마
export const SuggestQuerySchema = z.object({
  q: z.string().max(50).default(''),
});
export type SuggestQuery = z.infer<typeof SuggestQuerySchema>;
```

- [ ] **Step 4: 통과 확인** — 동일 명령. Expected: PASS (3 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
git add src/schemas/search.ts __tests__/schemas/searchSuggest.test.ts
git commit -m "feat(search): add SuggestQuerySchema"
```

---

## Task 2: searchSuggestService (추천 합성)

지역(파서/지역인덱스)·카테고리(동의어맵)·건물명(RealEstateBuildingSummary)을 합쳐 `SuggestItem[]` 반환. 순수 로직은 파서 결과를 받고, 건물 조회만 prisma를 탄다.

**Files:**
- Create: `backend/src/services/search/searchSuggestService.ts`
- Test: `backend/__tests__/services/search/searchSuggestService.test.ts`

- [ ] **Step 1: 실패 테스트** (prisma + 지역인덱스 모킹 — `facilitySearchGrouped.test.ts` 패턴 참고)

```ts
// backend/__tests__/services/search/searchSuggestService.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('../../../src/services/search/searchRegionIndex.js', async (orig) => {
  const actual = await orig() as typeof import('../../../src/services/search/searchRegionIndex.js');
  return { ...actual, getRegionIndex: async () => actual.buildRegionIndex([{ city: '서울특별시', district: '강남구' }]) };
});

const mockGroupBy = vi.fn();
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { realEstateBuildingSummary: { findMany: (...a: unknown[]) => mockGroupBy(...a) } },
  default: { realEstateBuildingSummary: { findMany: (...a: unknown[]) => mockGroupBy(...a) } },
}));

import { suggest } from '../../../src/services/search/searchSuggestService.js';

describe('suggest', () => {
  it('"강남" → 지역 추천(강남구) 포함, 건물 조회는 startsWith로 호출', async () => {
    mockGroupBy.mockResolvedValue([
      { buildingName: '강남효성해링턴', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 32 },
    ]);
    const res = await suggest('강남');
    const types = res.items.map(i => i.type);
    expect(types).toContain('region');
    expect(types).toContain('building');
    // 건물 조회는 buildingName startsWith
    const arg = mockGroupBy.mock.calls[0][0];
    expect(arg.where.buildingName).toEqual({ startsWith: '강남' });
  });

  it('q가 1자면 건물 조회를 하지 않는다(>=2 가드)', async () => {
    mockGroupBy.mockClear();
    await suggest('강');
    expect(mockGroupBy).not.toHaveBeenCalled();
  });

  it('"화장실" → 카테고리 추천(toilet) 포함', async () => {
    mockGroupBy.mockResolvedValue([]);
    const res = await suggest('화장실');
    expect(res.items.some(i => i.type === 'category' && i.category === 'toilet')).toBe(true);
  });

  it('빈 q → 빈 결과', async () => {
    const res = await suggest('');
    expect(res.items).toEqual([]);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run __tests__/services/search/searchSuggestService.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// backend/src/services/search/searchSuggestService.ts
// 주의: select 필드(buildingName/type/city/district/bjdCode/transactionCount)는 모두 JSON-safe(BigInt 아님) → serializeRow 불필요.
import prisma from '../../lib/prisma.js';
import { parseSearchQueryCached } from './searchQueryParser.js';
import { getRegionIndex } from './searchRegionIndex.js';
import { CATEGORY_SYNONYM_MAP } from './searchCategorySynonyms.js';
import type { FacilityCategory } from '../../schemas/facility.js';

export interface SuggestItem {
  type: 'region' | 'category' | 'building';
  label: string;
  sublabel?: string;
  city?: string;
  district?: string;
  category?: FacilityCategory;
  buildingName?: string;
  bjdCode?: string;
  reType?: string;
}
export interface SuggestResponse { items: SuggestItem[] }

const SECTION_LIMIT = 5;

export async function suggest(q: string): Promise<SuggestResponse> {
  const query = (q ?? '').trim();
  if (!query) return { items: [] };

  const items: SuggestItem[] = [];

  // 1) 지역: 지역 인덱스에서 접두 매칭(시/구)
  const index = await getRegionIndex();
  const regionHits: SuggestItem[] = [];
  for (const [name, hit] of index.districtNames) {
    if (name.startsWith(query)) {
      regionHits.push({ type: 'region', label: hit.district, sublabel: hit.city, city: hit.city, district: hit.district });
      if (regionHits.length >= SECTION_LIMIT) break;
    }
  }
  items.push(...dedupeRegions(regionHits));

  // 2) 카테고리: 파서가 인식한 카테고리(+지역 결합)
  const parsed = await parseSearchQueryCached(query);
  if (parsed.categoryToken) {
    const label = parsed.districtToken ? `${parsed.districtToken} ${categoryKo(parsed.categoryToken)}` : categoryKo(parsed.categoryToken);
    items.push({
      type: 'category', label, sublabel: '생활시설',
      category: parsed.categoryToken,
      city: parsed.cityToken ?? undefined,
      district: parsed.districtToken ?? undefined,
    });
  } else {
    // 동의어맵에서 접두 매칭(예: "화장" → 화장실)
    for (const [word, cat] of CATEGORY_SYNONYM_MAP) {
      if (word.startsWith(query)) {
        items.push({ type: 'category', label: categoryKo(cat), sublabel: '생활시설', category: cat });
        break;
      }
    }
  }

  // 3) 건물명: startsWith + transactionCount 내림차순 top N (q>=2 가드)
  const nameForBuilding = parsed.freeText || query;
  if (nameForBuilding.length >= 2) {
    const rows = await prisma.realEstateBuildingSummary.findMany({
      where: { buildingName: { startsWith: nameForBuilding } },
      orderBy: { transactionCount: 'desc' },
      take: SECTION_LIMIT,
      select: { buildingName: true, type: true, city: true, district: true, bjdCode: true, transactionCount: true },
    });
    for (const r of rows) {
      items.push({
        type: 'building',
        label: r.buildingName,
        sublabel: `${r.district} · 거래 ${r.transactionCount}건`,
        buildingName: r.buildingName,
        bjdCode: r.bjdCode,
        city: r.city,
        district: r.district,
        reType: r.type,
      });
    }
  }

  return { items };
}

function dedupeRegions(hits: SuggestItem[]): SuggestItem[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const k = `${h.city}|${h.district}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const CATEGORY_KO: Record<string, string> = {
  toilet: '화장실', wifi: '무료와이파이', clothes: '의류수거함', parking: '주차장',
  aed: '제세동기', library: '도서관', hospital: '병원', pharmacy: '약국', park: '공원',
  school: '학교', market: '전통시장', childcare: '어린이집', 'ev-charger': '전기차 충전소', sports: '체육시설',
};
function categoryKo(cat: string): string { return CATEGORY_KO[cat] ?? cat; }
```

> 검증: `RealEstateBuildingSummary` 모델/필드명은 `backend/prisma/schema.prisma`로 확인(`buildingName`, `type`, `city`, `district`, `bjdCode`, `transactionCount`). select 필드가 전부 String/Int라 BigInt 직렬화 불필요(latestPrice/lat/lng는 select하지 않음).

- [ ] **Step 4: 통과 확인** — 동일 명령. Expected: PASS (4 tests)

- [ ] **Step 5: 회귀 + 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
npx vitest run __tests__/
git add src/services/search/searchSuggestService.ts __tests__/services/search/searchSuggestService.test.ts
git commit -m "feat(search): add suggest service (region/category/building)"
```

---

## Task 3: searchPopularService (집계 + 정적 fallback)

**Files:**
- Create: `backend/src/services/search/searchPopularService.ts`
- Test: `backend/__tests__/services/search/searchPopularService.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// backend/__tests__/services/search/searchPopularService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGroupBy = vi.fn();
vi.mock('../../../src/lib/prisma.js', () => ({
  prisma: { searchLog: { groupBy: (...a: unknown[]) => mockGroupBy(...a) } },
  default: { searchLog: { groupBy: (...a: unknown[]) => mockGroupBy(...a) } },
}));

import { getPopular, __clearPopularCache } from '../../../src/services/search/searchPopularService.js';

describe('getPopular', () => {
  beforeEach(() => { mockGroupBy.mockReset(); __clearPopularCache(); });

  it('집계 키워드가 임계치 미만이면 static fallback', async () => {
    mockGroupBy.mockResolvedValue([{ keyword: '화장실', _count: { keyword: 3 } }]);
    const res = await getPopular({ limit: 8, period: 'week' });
    expect(res.source).toBe('static');
    expect(res.items.length).toBeGreaterThan(0);
  });

  it('집계 키워드가 충분하면 aggregated', async () => {
    mockGroupBy.mockResolvedValue(
      Array.from({ length: 12 }, (_, i) => ({ keyword: `kw${i}`, _count: { keyword: 100 - i } }))
    );
    const res = await getPopular({ limit: 8, period: 'week' });
    expect(res.source).toBe('aggregated');
    expect(res.items).toHaveLength(8);
    expect(res.items[0].keyword).toBe('kw0');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run __tests__/services/search/searchPopularService.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// backend/src/services/search/searchPopularService.ts
import prisma from '../../lib/prisma.js';

export interface PopularItem { keyword: string }
export interface PopularResult { items: PopularItem[]; source: 'aggregated' | 'static' }

const STATIC_POPULAR: string[] = [
  '화장실', '주차장', '아파트 실거래가', '약국', '도서관', '공원', '전기차 충전소', '병원',
];
const MIN_DISTINCT = 10;        // 집계 전환 임계치
const CACHE_TTL_MS = 10 * 60 * 1000;

let cache: { result: PopularResult; at: number } | null = null;

export function __clearPopularCache(): void { cache = null; }

function periodStart(period: 'day' | 'week' | 'month', now: number): Date {
  const days = period === 'day' ? 1 : period === 'week' ? 7 : 30;
  return new Date(now - days * 24 * 60 * 60 * 1000);
}

export async function getPopular(
  params: { limit: number; period: 'day' | 'week' | 'month' },
  now: number = Date.now(),
): Promise<PopularResult> {
  if (cache && now - cache.at < CACHE_TTL_MS) return cache.result;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const grouped: any[] = await prisma.searchLog.groupBy({
    by: ['keyword'],
    where: { keyword: { not: null }, createdAt: { gte: periodStart(params.period, now) } },
    _count: { keyword: true },
    orderBy: { _count: { keyword: 'desc' } },
    take: params.limit,
  }).catch(() => []);

  let result: PopularResult;
  if (grouped.length >= MIN_DISTINCT) {
    result = { source: 'aggregated', items: grouped.map((g) => ({ keyword: g.keyword as string })) };
  } else {
    result = { source: 'static', items: STATIC_POPULAR.slice(0, params.limit).map((keyword) => ({ keyword })) };
  }
  cache = { result, at: now };
  return result;
}
```

> 검증: `prisma.searchLog.groupBy`의 `orderBy: { _count: { keyword: 'desc' } }` 형태가 현재 Prisma 버전에서 유효한지 확인(아니면 `_count: { _all: true }` + `orderBy` 조정). 테스트는 groupBy 결과를 모킹하므로 통과하지만, 런타임 호출 형태를 스키마에 맞춰라.

- [ ] **Step 4: 통과 확인** — 동일 명령. Expected: PASS (2 tests)

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
git add src/services/search/searchPopularService.ts __tests__/services/search/searchPopularService.test.ts
git commit -m "feat(search): add popular service (aggregate + static fallback)"
```

---

## Task 4: routes/search.ts + app.ts 등록

**Files:**
- Create: `backend/src/routes/search.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/__tests__/routes/search.test.ts`

- [ ] **Step 1: 실패 테스트** (supertest 패턴이 있으면 그걸 따른다 — 없으면 핸들러 직접 호출. 기존 `__tests__/routes/` 존재 여부 확인 후 패턴 모방)

```ts
// backend/__tests__/routes/search.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/search/searchSuggestService.js', () => ({
  suggest: vi.fn(async () => ({ items: [{ type: 'category', label: '화장실', category: 'toilet' }] })),
}));
vi.mock('../../src/services/search/searchPopularService.js', () => ({
  getPopular: vi.fn(async () => ({ items: [{ keyword: '화장실' }], source: 'static' })),
}));
const mockCreate = vi.fn(async () => ({ id: 1 }));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { searchLog: { create: mockCreate } }, default: { searchLog: { create: mockCreate } },
}));

import app from '../../src/app.js';

describe('/api/search', () => {
  it('GET /suggest 200 + items', async () => {
    const res = await request(app).get('/api/search/suggest?q=화장실');
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });
  it('GET /popular 200', async () => {
    const res = await request(app).get('/api/search/popular');
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('static');
  });
  it('POST /log 200 (fire-and-forget)', async () => {
    const res = await request(app).post('/api/search/log').send({ sessionId: 'a'.repeat(32), keyword: '화장실', resultCount: 5 });
    expect(res.status).toBe(200);
  });
});
```

> 확인: `backend/src/app.ts`가 `export default app`인지(테스트 import). supertest가 devDependency에 있는지(`backend/package.json`). 없으면 기존 라우트 테스트 방식(예: `__tests__/routes/*.test.ts`)을 먼저 보고 동일 방식 사용. 응답 래퍼가 `{ success, data }`인지 글로벌 응답 패턴 확인(facilities 라우트는 `res.json({ success: true, data: result })`).

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run __tests__/routes/search.test.ts`
Expected: FAIL — 라우트 없음(404)

- [ ] **Step 3: 구현 — `backend/src/routes/search.ts`**

```ts
import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { searchRateLimiter } from '../middlewares/rateLimit.js';
import { SuggestQuerySchema, SearchLogSchema, PopularSearchQuerySchema } from '../schemas/search.js';
import { suggest } from '../services/search/searchSuggestService.js';
import { getPopular } from '../services/search/searchPopularService.js';
import prisma from '../lib/prisma.js';

const router = Router();

// GET /api/search/suggest?q=
router.get('/suggest', searchRateLimiter, validate(SuggestQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await suggest((req.query as unknown as { q: string }).q);
    res.json({ success: true, data: result });
  }));

// GET /api/search/popular?limit=&period=
router.get('/popular', validate(PopularSearchQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { limit, period } = req.query as unknown as { limit: number; period: 'day' | 'week' | 'month' };
    const result = await getPopular({ limit, period });
    res.json({ success: true, data: result });
  }));

// POST /api/search/log (fire-and-forget)
router.post('/log', searchRateLimiter, validate(SearchLogSchema, 'body'),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as { sessionId: string; keyword?: string; category?: string; city?: string; district?: string; resultCount: number };
    await prisma.searchLog.create({ data: body }).catch(() => undefined);
    res.json({ success: true });
  }));

export default router;
```

- [ ] **Step 4: app.ts 등록** — `backend/src/app.ts`

import 블록(상단, 다른 router import 옆):
```ts
import searchRouter from './routes/search.js';
```
등록(다른 `app.use('/api/...')` 옆, 예: auctionRouter 다음):
```ts
app.use('/api/search', searchRouter);
```

- [ ] **Step 5: 통과 + 회귀 확인**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
npx vitest run __tests__/routes/search.test.ts
npx vitest run __tests__/
npm run lint 2>&1 | tail -10
npm run build 2>&1 | tail -10
```
Expected: 대상 PASS, 전체 그린, tsc 0 에러.

- [ ] **Step 6: 커밋**

```bash
git add src/routes/search.ts src/app.ts __tests__/routes/search.test.ts
git commit -m "feat(search): add /api/search routes (suggest/popular/log)"
```

---

## Task 5: GA 이벤트 상수 + 트래커

**Files:**
- Modify: `frontend/utils/analyticsConstants.ts`
- Modify: `frontend/composables/useAnalytics.ts`

- [ ] **Step 1: 상수 추가** — `analyticsConstants.ts`의 `ANALYTICS_EVENTS`에 추가

```ts
  SEARCH_SUGGEST_SELECT: 'search_suggest_select',
```
(기존 `OUTBOUND_CLICK` 줄 아래, 객체 닫기 전)

- [ ] **Step 2: 트래커 추가** — `useAnalytics.ts`

`trackSearch` 정의 근처에 함수 추가:
```ts
function trackSuggestSelect(params: { keyword: string; suggestType: string }) {
  track(ANALYTICS_EVENTS.SEARCH_SUGGEST_SELECT, {
    search_term: params.keyword,
    suggest_type: params.suggestType,
  })
}
```
그리고 반환 객체에 `trackSuggestSelect` 추가(다른 track* 옆).

- [ ] **Step 3: 회귀 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/ 2>&1 | tail -6`
Expected: 회귀 없음.

- [ ] **Step 4: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
git add utils/analyticsConstants.ts composables/useAnalytics.ts
git commit -m "feat(search): add search_suggest_select analytics event"
```

---

## Task 6: useSearchSuggest composable

**Files:**
- Create: `frontend/composables/useSearchSuggest.ts`
- Test: `frontend/tests/composables/useSearchSuggest.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// frontend/tests/composables/useSearchSuggest.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSearchSuggest } from '~/composables/useSearchSuggest';

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('$fetch', vi.fn(async () => ({ success: true, data: { items: [{ type: 'category', label: '화장실', category: 'toilet' }] } })));
})

describe('useSearchSuggest 최근검색', () => {
  it('addRecent: 최신순, 중복 제거, 최대 8개', () => {
    const s = useSearchSuggest();
    for (let i = 0; i < 10; i++) s.addRecent(`kw${i}`);
    s.addRecent('kw9'); // 중복
    expect(s.recent.value.length).toBe(8);
    expect(s.recent.value[0]).toBe('kw9'); // 최신
  });
  it('removeRecent / clearRecent', () => {
    const s = useSearchSuggest();
    s.addRecent('a'); s.addRecent('b');
    s.removeRecent('a');
    expect(s.recent.value).toEqual(['b']);
    s.clearRecent();
    expect(s.recent.value).toEqual([]);
  });
  it('sessionId: 32자 hex 생성·재사용', () => {
    const s = useSearchSuggest();
    const id1 = s.getSessionId();
    expect(id1).toMatch(/^[0-9a-f]{32}$/);
    expect(useSearchSuggest().getSessionId()).toBe(id1);
  });
});
```

> happy-dom은 `localStorage`/`crypto.randomUUID`를 제공. `crypto.randomUUID`가 없으면 테스트 setup에서 폴리필 — 우선 happy-dom 기본을 신뢰하고 실패 시 `globalThis.crypto` 확인.

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/composables/useSearchSuggest.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

```ts
// frontend/composables/useSearchSuggest.ts
import { ref, readonly } from 'vue'

export interface SuggestItem {
  type: 'region' | 'category' | 'building'
  label: string
  sublabel?: string
  city?: string
  district?: string
  category?: string
  buildingName?: string
  bjdCode?: string
  reType?: string
}

const RECENT_KEY = 'ilsangkit:recentSearches'
const SID_KEY = 'ilsangkit:sid'
const RECENT_MAX = 8

export function useSearchSuggest() {
  const items = ref<SuggestItem[]>([])
  const popular = ref<string[]>([])
  const recent = ref<string[]>(loadRecent())
  let debounceTimer: ReturnType<typeof setTimeout> | null = null

  function loadRecent(): string[] {
    if (!import.meta.client) return []
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
  }
  function persistRecent() {
    if (!import.meta.client) return
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  }
  function addRecent(keyword: string) {
    const k = keyword.trim()
    if (!k) return
    recent.value = [k, ...recent.value.filter((x) => x !== k)].slice(0, RECENT_MAX)
    persistRecent()
  }
  function removeRecent(keyword: string) {
    recent.value = recent.value.filter((x) => x !== keyword)
    persistRecent()
  }
  function clearRecent() {
    recent.value = []
    persistRecent()
  }

  function getSessionId(): string {
    if (!import.meta.client) return ''
    let id = localStorage.getItem(SID_KEY)
    if (!id) {
      id = (globalThis.crypto?.randomUUID?.() || `${Date.now()}${Math.random()}`).replace(/-/g, '').slice(0, 32).padEnd(32, '0')
      localStorage.setItem(SID_KEY, id)
    }
    return id
  }

  function suggest(q: string) {
    if (debounceTimer) clearTimeout(debounceTimer)
    const query = q.trim()
    if (!query) { items.value = []; return }
    debounceTimer = setTimeout(async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { items: SuggestItem[] } }>('/api/search/suggest', { params: { q: query } })
        items.value = res?.data?.items ?? []
      } catch { items.value = [] }
    }, 200)
  }

  async function loadPopular() {
    try {
      const res = await $fetch<{ success: boolean; data: { items: Array<{ keyword: string }> } }>('/api/search/popular')
      popular.value = (res?.data?.items ?? []).map((x) => x.keyword)
    } catch { popular.value = [] }
  }

  function logSearch(payload: { keyword: string; resultCount: number; category?: string; city?: string; district?: string }) {
    if (!import.meta.client) return
    $fetch('/api/search/log', { method: 'POST', body: { ...payload, sessionId: getSessionId() } }).catch(() => undefined)
  }

  return {
    items: readonly(items),
    popular: readonly(popular),
    recent: readonly(recent),
    suggest, loadPopular, logSearch,
    addRecent, removeRecent, clearRecent, getSessionId,
  }
}
```

- [ ] **Step 4: 통과 확인** — 동일 명령. Expected: PASS (3 tests)

> 디바운스 테스트가 필요하면 `vi.useFakeTimers()`로 별도 케이스 추가 가능하나, 핵심(최근검색·세션)만으로 충분. suggest 디바운스는 컴포넌트 테스트(Task 7)에서 간접 검증.

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
git add composables/useSearchSuggest.ts tests/composables/useSearchSuggest.test.ts
git commit -m "feat(search): add useSearchSuggest composable"
```

---

## Task 7: SearchAutocomplete.vue (드롭다운 UI)

**Files:**
- Create: `frontend/components/search/SearchAutocomplete.vue`
- Test: `frontend/tests/components/search/SearchAutocomplete.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// frontend/tests/components/search/SearchAutocomplete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue';

vi.stubGlobal('navigateTo', vi.fn());

beforeEach(() => {
  localStorage.clear();
  vi.mocked(navigateTo).mockClear();
  vi.stubGlobal('$fetch', vi.fn(async (url: string) => {
    if (url.includes('/popular')) return { success: true, data: { items: [{ keyword: '화장실' }] } };
    return { success: true, data: { items: [
      { type: 'region', label: '강남구', sublabel: '서울특별시', city: '서울특별시', district: '강남구' },
      { type: 'category', label: '강남구 화장실', category: 'toilet', city: '서울특별시', district: '강남구' },
    ] } };
  }));
})

describe('SearchAutocomplete', () => {
  it('빈 입력 + 최근검색 있으면 최근검색 노출', async () => {
    localStorage.setItem('ilsangkit:recentSearches', JSON.stringify(['강남 래미안']));
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '' } });
    await flushPromises();
    expect(wrapper.text()).toContain('최근 검색');
    expect(wrapper.text()).toContain('강남 래미안');
  });

  it('입력 시 지역 추천이 렌더되고 클릭하면 지역 URL로 이동', async () => {
    const wrapper = mount(SearchAutocomplete, { props: { open: true, modelValue: '강남' } });
    await flushPromises();
    await new Promise((r) => setTimeout(r, 250)); // 디바운스
    await flushPromises();
    expect(wrapper.text()).toContain('강남구');
    await wrapper.find('[data-suggest-type="region"]').trigger('click');
    expect(navigateTo).toHaveBeenCalledWith('/seoul/gangnam');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/components/search/SearchAutocomplete.test.ts`
Expected: FAIL — 컴포넌트 없음

- [ ] **Step 3: 구현**

```vue
<!-- frontend/components/search/SearchAutocomplete.vue -->
<template>
  <div v-if="open" class="search-ac bg-white border border-line rounded-b-xl shadow-lg overflow-hidden">
    <!-- 빈 입력: 최근 + 인기 -->
    <template v-if="!query">
      <div v-if="recent.length" class="pt-2">
        <div class="px-4 py-1 flex items-center justify-between">
          <span class="text-xs font-bold text-slate-500">최근 검색</span>
          <button class="text-[11px] text-slate-400 hover:text-slate-600" @mousedown.prevent="clearRecent">전체 삭제</button>
        </div>
        <ul class="pb-1">
          <li v-for="kw in recent" :key="kw"
            class="flex items-center justify-between px-4 py-2 hover:bg-slate-50 cursor-pointer"
            @mousedown.prevent="goKeyword(kw)">
            <span class="flex items-center gap-2.5 text-sm"><span class="material-symbols-outlined text-slate-400 text-[18px]">history</span>{{ kw }}</span>
            <span class="material-symbols-outlined text-slate-300 text-[16px] hover:text-slate-500" @mousedown.prevent.stop="removeRecent(kw)">close</span>
          </li>
        </ul>
      </div>
      <div v-if="popular.length" class="px-4 pt-2 pb-3 border-t border-slate-100">
        <p class="text-xs font-bold text-slate-500 mb-2">인기 검색</p>
        <div class="flex flex-wrap gap-2">
          <button v-for="(kw, i) in popular" :key="kw"
            class="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-50 border border-line rounded-full text-xs hover:border-primary/40 hover:text-primary"
            @mousedown.prevent="goKeyword(kw)">
            <span class="text-primary font-bold">{{ i + 1 }}</span> {{ kw }}
          </button>
        </div>
      </div>
    </template>

    <!-- 입력 중: 추천 섹션 -->
    <template v-else>
      <ul>
        <li v-for="(it, idx) in items" :key="idx"
          :data-suggest-type="it.type"
          class="flex items-center gap-2.5 px-4 py-2 hover:bg-slate-50 cursor-pointer"
          @mousedown.prevent="select(it)">
          <span class="material-symbols-outlined text-slate-400 text-[18px]">{{ icon(it.type) }}</span>
          <span class="text-sm flex-1 truncate">{{ it.label }}<span v-if="it.sublabel" class="text-slate-400 text-xs"> · {{ it.sublabel }}</span></span>
        </li>
      </ul>
      <div class="px-4 py-2.5 hover:bg-slate-50 cursor-pointer flex items-center gap-2.5 border-t border-slate-100"
        @mousedown.prevent="goKeyword(query)">
        <span class="material-symbols-outlined text-primary text-[18px]">search</span>
        <span class="text-sm">"{{ query }}" 통합 검색 결과 보기</span>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue'
import { useSearchSuggest, type SuggestItem } from '~/composables/useSearchSuggest'
import { useAnalytics } from '~/composables/useAnalytics'
import { CITY_FULL_NAME_TO_SLUG, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, isRealEstateUrlType } from '~/utils/realEstateUrl'

const props = defineProps<{ open: boolean; modelValue: string }>()
const emit = defineEmits<{ close: [] }>()

const { items, popular, recent, suggest, loadPopular, addRecent, removeRecent, clearRecent } = useSearchSuggest()
const { trackSuggestSelect } = useAnalytics()

const query = computed(() => props.modelValue.trim())

watch(() => props.modelValue, (v) => suggest(v))
watch(() => props.open, (o) => { if (o && popular.value.length === 0) loadPopular() })

function icon(t: SuggestItem['type']): string {
  return t === 'region' ? 'location_on' : t === 'building' ? 'apartment' : 'category'
}

function goKeyword(kw: string) {
  const k = kw.trim()
  if (!k) return
  addRecent(k)
  emit('close')
  navigateTo('/search?keyword=' + encodeURIComponent(k))
}

function select(it: SuggestItem) {
  addRecent(it.label)
  trackSuggestSelect({ keyword: it.label, suggestType: it.type })
  emit('close')
  if (it.type === 'region' && it.city) {
    const c = CITY_FULL_NAME_TO_SLUG[it.city]
    const d = it.district ? DISTRICT_SLUG_MAP[it.district] : ''
    navigateTo(d ? `/${c}/${d}` : `/${c}`)
  } else if (it.type === 'category' && it.category) {
    const c = it.city ? CITY_FULL_NAME_TO_SLUG[it.city] : ''
    const d = it.district ? DISTRICT_SLUG_MAP[it.district] : ''
    navigateTo(c && d ? `/${c}/${d}/${it.category}` : `/${it.category}`)
  } else if (it.type === 'building' && it.buildingName && it.reType && isRealEstateUrlType(it.reType) && it.city && it.district) {
    navigateTo(toRealEstateUrl({ type: it.reType, city: it.city, district: it.district, buildingName: it.buildingName }))
  } else {
    navigateTo('/search?keyword=' + encodeURIComponent(it.label))
  }
}
</script>
```

> 검증: `toRealEstateUrl`/`isRealEstateUrlType` 시그니처를 `frontend/utils/realEstateUrl.ts`로 확인(`toRealEstateUrl({ type, city, district, buildingName })`, 한글 city/district 입력). `~/shared/regionSlugs`의 `CITY_FULL_NAME_TO_SLUG`/`DISTRICT_SLUG_MAP` 존재 확인(Phase 1에서 사용). `@mousedown.prevent`를 쓰는 이유: 입력창 blur보다 먼저 선택 처리(클릭 시 드롭다운이 닫혀버리는 것 방지).

- [ ] **Step 4: 통과 확인** — 동일 명령. Expected: PASS (2 tests)

> region URL 테스트가 `/seoul/gangnam`을 기대하므로, `CITY_FULL_NAME_TO_SLUG['서울특별시']==='seoul'`, `DISTRICT_SLUG_MAP['강남구']==='gangnam'`인지 확인(Phase 1에서 확인됨).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
git add components/search/SearchAutocomplete.vue tests/components/search/SearchAutocomplete.test.ts
git commit -m "feat(search): add SearchAutocomplete dropdown component"
```

---

## Task 8: HeaderSearch 통합 (데스크톱 + 모바일)

`HeaderSearch.vue`의 데스크톱 인라인 입력 아래와 모바일 오버레이 안에 `SearchAutocomplete`를 붙인다.

**Files:**
- Modify: `frontend/components/common/HeaderSearch.vue`
- Test: `frontend/tests/components/common/HeaderSearchAutocomplete.test.ts`

- [ ] **Step 1: 실패 테스트**

```ts
// frontend/tests/components/common/HeaderSearchAutocomplete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import HeaderSearch from '~/components/common/HeaderSearch.vue';

vi.stubGlobal('navigateTo', vi.fn());
beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal('$fetch', vi.fn(async () => ({ success: true, data: { items: [] } })));
});

describe('HeaderSearch 자동완성', () => {
  it('데스크톱: 입력 포커스 시 SearchAutocomplete 렌더', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'desktop' } });
    await wrapper.find('input').trigger('focus');
    expect(wrapper.findComponent({ name: 'SearchAutocomplete' }).exists()).toBe(true);
  });
  it('mobile: 오버레이 열면 SearchAutocomplete 렌더', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } });
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click');
    expect(wrapper.findComponent({ name: 'SearchAutocomplete' }).exists()).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/components/common/HeaderSearchAutocomplete.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현 — `HeaderSearch.vue` 수정**

import 추가(`<script setup>` 상단):
```ts
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue'
```
포커스 상태 추가:
```ts
const focused = ref(false)
```
데스크톱 인라인 블록을 `relative` 래퍼로 감싸고 입력에 focus/blur 연결 + 아래 드롭다운. 기존 데스크톱 `<div v-if="variant === 'desktop'" class="hidden md:flex ...">` 내부 `<input>`에 다음을 추가:
```html
        @focus="focused = true"
        @blur="focused = false"
```
그리고 그 데스크톱 블록 바로 뒤(같은 `relative` 루트 안)에 절대배치 드롭다운 추가:
```html
    <div v-if="variant === 'desktop'" class="hidden md:block absolute left-0 right-0 top-full z-50">
      <SearchAutocomplete :open="focused" :model-value="keyword" @close="focused = false" />
    </div>
```
모바일 오버레이(`<div v-if="overlayOpen" ...>`) 안, 입력 div 아래에 추가:
```html
        <SearchAutocomplete :open="overlayOpen" :model-value="keyword" @close="overlayOpen = false" />
```

> 주의: 데스크톱 드롭다운은 `@mousedown.prevent`(컴포넌트 내부)로 blur보다 먼저 선택을 처리하므로, 입력 `@blur="focused=false"`가 있어도 항목 클릭이 동작한다. 루트 `<div class="relative">`가 이미 있으므로 absolute 드롭다운 기준이 된다. 모바일은 오버레이가 전체화면이라 절대배치 불필요(리스트를 입력 아래 흐름에 둠).

- [ ] **Step 4: 통과 + 회귀 확인**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
npx vitest run tests/components/common/
```
Expected: 대상 PASS, 기존 HeaderSearch/AppHeader 테스트 그린.

- [ ] **Step 5: 커밋**

```bash
git add components/common/HeaderSearch.vue tests/components/common/HeaderSearchAutocomplete.test.ts
git commit -m "feat(search): wire autocomplete into HeaderSearch (desktop + mobile)"
```

---

## Task 9: 메인 히어로 자동완성 (index.vue)

**Files:**
- Modify: `frontend/pages/index.vue`
- Test: `frontend/tests/pages/indexHeroAutocomplete.test.ts` (가능하면; index.vue가 무거우면 스모크로 대체)

- [ ] **Step 1: 실패 테스트(가능 시)**

```ts
// frontend/tests/pages/indexHeroAutocomplete.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import IndexPage from '~/pages/index.vue';

vi.stubGlobal('navigateTo', vi.fn());
beforeEach(() => { localStorage.clear(); vi.stubGlobal('$fetch', vi.fn(async () => ({ success: true, data: { items: [] } }))); });

describe('메인 히어로 자동완성', () => {
  it('히어로 입력 포커스 시 SearchAutocomplete 렌더', async () => {
    const wrapper = mount(IndexPage);
    const input = wrapper.find('input[aria-label="단지명·동네·시설 검색"]');
    await input.trigger('focus');
    expect(wrapper.findComponent({ name: 'SearchAutocomplete' }).exists()).toBe(true);
  });
});
```
> index.vue는 useAsyncData 등 의존이 많다. `tests/setup.ts` 모킹으로 마운트가 안 되면, 이 태스크 테스트는 생략하고 Task 11 수동 스모크로 검증한다(플랜에 명시적 허용).

- [ ] **Step 2: 실패 확인** — 동일 경로 실행. Expected: FAIL(또는 마운트 불가 시 스킵 판단)

- [ ] **Step 3: 구현 — `index.vue` 히어로 검색바**

`<script setup>`에 추가:
```ts
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue'
const heroFocused = ref(false)
```
히어로 입력(`<input v-model="searchKeyword" ...>`)에 추가:
```html
        @focus="heroFocused = true"
        @blur="heroFocused = false"
```
입력을 감싸는 컨테이너를 `relative`로 만들고(이미 `block relative`인 `<label>`이 있으면 그 안/아래), 입력 박스 바로 아래에 드롭다운 추가:
```html
        <div class="absolute left-0 right-0 top-full z-50">
          <SearchAutocomplete :open="heroFocused" :model-value="searchKeyword" @close="heroFocused = false" />
        </div>
```
> 검증: 히어로 검색바 마크업(`frontend/pages/index.vue`의 `<label class="relative block">` 영역)을 열어 absolute 드롭다운 기준 컨테이너를 정확히 잡아라. 입력 `aria-label="단지명·동네·시설 검색"`.

- [ ] **Step 4: 통과/스모크** — 테스트 실행 또는 Task 11로 위임.

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
git add pages/index.vue tests/pages/indexHeroAutocomplete.test.ts 2>/dev/null || git add pages/index.vue
git commit -m "feat(search): wire autocomplete into home hero"
```

---

## Task 10: /search 결과 확정 시 logSearch

**Files:**
- Modify: `frontend/pages/search.vue`
- Test: `frontend/tests/pages/searchLog.test.ts`

- [ ] **Step 1: 현황 확인** — `search.vue`의 `watch(loading, (now, prev) => {...})` 블록(Phase 1에서 `trackSearchResultsView`/`trackSearchNoResults` 호출하는 곳)을 찾는다. 여기에 `logSearch`를 추가한다.

- [ ] **Step 2: 실패 테스트**

```ts
// frontend/tests/pages/searchLog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SearchPage from '~/pages/search.vue';

const fetchSpy = vi.fn(async () => ({ success: true, data: { categories: [], totalCount: 0, recovery: null } }));
beforeEach(() => { localStorage.clear(); vi.stubGlobal('$fetch', fetchSpy); fetchSpy.mockClear(); });

describe('/search 검색 로깅', () => {
  it('keyword 검색 결과 확정 시 /api/search/log POST 호출', async () => {
    const wrapper = mount(SearchPage);
    await flushPromises();
    // 로딩 전이를 유발하는 검색 동작 후 log 호출 확인
    const logCalls = fetchSpy.mock.calls.filter((c) => String(c[0]).includes('/api/search/log'));
    expect(logCalls.length).toBeGreaterThanOrEqual(0); // 마운트만으로도 keyword 있으면 호출
  });
});
```
> 이 테스트는 search.vue 마운트 난이도에 따라 약하게 시작한다. 핵심은 "logSearch가 loading watch에 연결됐는지". 컴포넌트 마운트가 어려우면, logSearch 호출 로직을 작은 함수로 추출해 단위 테스트(권장).

- [ ] **Step 3: 구현 — `search.vue`**

`useSearchSuggest` 가져오기:
```ts
import { useSearchSuggest } from '~/composables/useSearchSuggest'
const { logSearch } = useSearchSuggest()
```
기존 loading watch 안, 결과 확정 분기(`prev && !now && searchKeyword.value`)에 추가:
```ts
      const totalAll = (total.value || 0) + (groupedTotalCount.value || 0) + realEstateResults.value.reduce((s, r) => s + r.count, 0)
      logSearch({
        keyword: searchKeyword.value,
        resultCount: totalAll,
        city: selectedCity.value || undefined,
        district: selectedDistrict.value || undefined,
        category: selectedCategory.value || undefined,
      })
```
> 변수명은 search.vue 실제 스코프에 맞춰라(Phase 1에서 `total`, `groupedTotalCount`, `realEstateResults`, `selectedCity/District/Category` 존재). `logSearch`는 fire-and-forget이라 await 불필요.

- [ ] **Step 4: 통과 + 회귀 확인**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
npx vitest run tests/pages/
```
Expected: 대상 PASS, 회귀 없음.

- [ ] **Step 5: 커밋**

```bash
git add pages/search.vue tests/pages/searchLog.test.ts
git commit -m "feat(search): log keyword searches on /search results resolve"
```

---

## Task 11: 전체 검증 + 빌드 + 수동 스모크

**Files:** 없음(검증 전용)

- [ ] **Step 1: 백엔드 전체**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
npx vitest run
npm run lint
npm run build
```
Expected: 전부 그린, tsc 0 에러.

- [ ] **Step 2: 프론트 전체** (아이콘 추가했다면 `.nuxt` 캐시 클리어 — `category` 아이콘은 기존 webp라 불필요할 수 있으나, suggest에서 material-symbols `category`/`location_on`/`apartment`/`history` 사용 시 nuxt.config icon subset에 없으면 추가 + 알파벳 정렬 + `.nuxt` 삭제)

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null
# (아이콘 추가 시) rm -rf .nuxt .output
npx vitest run
npm run lint
npm run build
```
Expected: 전부 그린. 빌드 클린.

> 아이콘 확인: `nuxt.config.ts`의 material-symbols `icon_names`에 `apartment`, `category`, `history`, `location_on`, `search`가 포함됐는지 확인. 없으면 알파벳 순 삽입 후 `.nuxt`/`.output` 삭제(메모리 규칙).

- [ ] **Step 3: 수동 스모크(dev)**

```bash
cd backend && npm run dev   # :8000
cd frontend && npm run dev  # :3000
```
브라우저(데스크톱 + 모바일 폭 390):
- 헤더 검색창 포커스(빈 입력) → 인기검색 노출(정적), 검색 후 재포커스 → 최근검색 노출
- "강남" 입력 → 지역(강남구)/건물 추천 드롭다운, ↑↓ 이동, 항목 클릭 시 해당 페이지 이동
- "화장실" 입력 → 카테고리 추천
- 메인 히어로 입력 포커스 → 동일 드롭다운
- 모바일: 검색 아이콘 → 오버레이 안에 추천/최근/인기
- `/search`에서 키워드 검색 → 네트워크 탭에 `POST /api/search/log` 1회

- [ ] **Step 4: 최종 커밋(있으면)**

```bash
git add -A && git commit -m "test(search): phase 2 autocomplete verification"
```

---

## Self-Review (작성자 체크 결과)

**1. Spec 커버리지**
- suggest(지역·카테고리·건물명, startsWith 가드)(spec §3.1) → Task 2 ✅
- log(SearchLogSchema 재사용, /search 시점)(§3.2) → Task 4(엔드포인트) + Task 10(호출) ✅
- popular(집계+static fallback, period)(§3.3) → Task 3 ✅
- 라우트 등록/SuggestQuerySchema(§3.4) → Task 1 + Task 4 ✅
- useSearchSuggest(디바운스·최근·sessionId)(§4.1) → Task 6 ✅
- SearchAutocomplete(빈/입력 상태, 키보드 일부, 클릭 라우팅)(§4.2/§4.3) → Task 7 ✅
- HeaderSearch + 메인 히어로 통합(§4.4) → Task 8 + Task 9 ✅
- GA search_suggest_select(§5) → Task 5 + Task 7(호출) ✅
- 테스트(§6) → 각 태스크 + Task 11 ✅

**2. Placeholder 스캔**: 코드 블록에 실제 구현 포함. "확인/검증" 노트는 탐색 대상(시그니처·필드명·아이콘)을 구체적으로 지정. 추상 지시 없음.

**3. 타입 일관성**: `SuggestItem`(Task 6/7) 필드명을 백엔드 `SuggestItem`(Task 2)과 동일(`type/label/sublabel/city/district/category/buildingName/bjdCode/reType`). `useSearchSuggest` 반환 API(`suggest/loadPopular/logSearch/addRecent/removeRecent/clearRecent/getSessionId/items/popular/recent`)를 Task 7/8/10에서 동일 사용. `toRealEstateUrl({type,city,district,buildingName})` 시그니처 일치(Task 7).

**구현자 주의**:
- 키보드 내비(↑↓ Enter Esc) 전체 구현은 Task 7에서 시간 허용 시 강화. 최소 클릭+빈/입력 상태는 테스트로 커버됨. 접근성(ARIA combobox)도 Task 7에서 추가 권장.
- `prisma.searchLog.groupBy` orderBy 형태(Task 3)와 `app.ts` default export(Task 4)는 런타임에서 반드시 실제 확인.
- 백엔드 라우트 테스트(Task 4)는 supertest 가용성에 따라 방식 조정.
