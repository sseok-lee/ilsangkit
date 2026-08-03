# Naver Blog Reviews Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Naver-blog-review section to facility detail pages (15 categories) and real-estate building detail pages (6 realEstateType slugs), reusing the YouTube section's caching/quota/lazy-CSR/SSR architecture.

**Architecture:** Express backend exposes two new endpoints — `GET /api/facilities/:category/:id/naver-blog` and `GET /api/real-estate/:type/:city/:district/:buildingName/naver-blog`. Both consult Prisma cache tables (`FacilityNaverBlogCache`, `RealEstateNaverBlogCache`); on miss, an in-memory quota guard (KST midnight reset, 5,000/day) permits a Naver Search blog API call. Results pass through an aggressive ad-keyword + age + length filter, get HTML-stripped, then cached for 14 days. The Nuxt frontend renders a lazy `<BlogReviewSection>` (IntersectionObserver-triggered fetch on an always-rendered `min-h-[1px]` sentinel — the same fix that closed the YouTube IO bug). Each card is a plain `<a target="_blank" rel="nofollow noopener noreferrer">` to the original post; no modal, no schema markup.

**Tech Stack:** Express 5 + TypeScript ESM (`.js` import extensions), Prisma + MySQL 8, Zod, Vitest, MSW, Nuxt 3 + Vue 3 + Tailwind, IntersectionObserver, Naver Search API v1.

**Spec:** `docs/superpowers/specs/2026-05-15-naver-blog-reviews-design.md`

**Project conventions to honor:**
- Node 20 (`nvm use 20`) — shell state does NOT persist between Bash calls, so chain commands with `&&` in a single call or prefix every Bash call with `source ~/.nvm/nvm.sh && nvm use 20 &&`
- Backend ESM `.js` import extensions
- Routes via `asyncHandler()` + `validate()`/`validateMultiple()` middleware
- Errors via classes from `src/lib/errors.ts`
- Composables return `readonly()` refs
- Frontend `$fetch` + `useRuntimeConfig().public.apiBase`
- TDD: failing test FIRST every task
- Feature branch + PR workflow (never push to `main` or `develop` directly)
- Explicit return types on EXPORTED functions (project ESLint rule)

---

## File Structure

### Backend (create unless noted)
- `backend/src/services/naverBlogQuotaService.ts` — daily counter (5,000/day)
- `backend/src/services/naverBlogService.ts` — query builders × 2, stripHtml, filter, fetchFromNaver, types, constants
- `backend/src/services/naverBlogCacheService.ts` — `getOrFetchNaverBlogForFacility`, `getOrFetchNaverBlogForRealEstate`, in-flight dedup
- `backend/src/schemas/naverBlog.ts` — Zod params schemas (× 2)
- `backend/src/routes/facilityNaverBlog.ts` — facility route
- `backend/src/routes/realEstateNaverBlog.ts` — real estate route
- `backend/src/app.ts` — **modify**: mount both routers
- `backend/prisma/schema.prisma` — **modify**: add `FacilityNaverBlogCache` and `RealEstateNaverBlogCache` models

### Backend tests
- `backend/__tests__/services/naverBlogQuotaService.test.ts`
- `backend/__tests__/services/naverBlogService.test.ts`
- `backend/__tests__/services/naverBlogCacheService.test.ts`
- `backend/__tests__/routes/facilityNaverBlog.test.ts`
- `backend/__tests__/routes/realEstateNaverBlog.test.ts`

### Frontend (create unless noted)
- `frontend/types/naverBlog.ts` — `NaverBlogPost` interface
- `frontend/composables/useBlogReviews.ts` — `kind`-discriminated fetch
- `frontend/components/blog/BlogReviewCard.vue`
- `frontend/components/blog/BlogReviewSection.vue`
- `frontend/mocks/handlers/naverBlog.ts`
- `frontend/mocks/browser.ts` — **modify**: register new handlers
- `frontend/pages/[category]/[id].vue` — **modify**: insert `<BlogReviewSection kind="facility" ... />` after `<FacilityYoutubeSection>`
- `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — **modify**: insert `<BlogReviewSection kind="real-estate" ... />`

### Frontend tests
- `frontend/tests/composables/useBlogReviews.test.ts`
- `frontend/tests/components/blog/BlogReviewCard.test.ts`
- `frontend/tests/components/blog/BlogReviewSection.test.ts`

---

## Phase 0 — Branch

### Task 0: Feature branch + Node 20

- [ ] **Step 1: Switch to Node 20 and branch from latest develop**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
source ~/.nvm/nvm.sh && nvm use 20
git checkout develop
git pull origin develop
git checkout -b feat/naver-blog-reviews
git status
```

Expected: clean working tree on `feat/naver-blog-reviews`.

---

## Phase 1 — Prisma schema

### Task 1: Two cache models

**Files:** Modify `backend/prisma/schema.prisma`

- [ ] **Step 1: Append both models at end of schema**

```prisma
// 시설 상세 페이지 네이버 블로그 후기 캐시 (14일 TTL, negative caching)
model FacilityNaverBlogCache {
  id         Int      @id @default(autoincrement())
  category   String   @db.VarChar(20)
  facilityId String   @db.VarChar(100)
  query      String   @db.VarChar(300)
  posts      Json
  itemCount  Int      @default(0)
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime

  @@unique([category, facilityId])
  @@index([expiresAt])
}

// 부동산 단지 상세 페이지 네이버 블로그 후기 캐시 (14일 TTL, negative caching)
model RealEstateNaverBlogCache {
  id              Int      @id @default(autoincrement())
  realEstateType  String   @db.VarChar(20)
  buildingKey     String   @db.VarChar(200)
  query           String   @db.VarChar(300)
  posts           Json
  itemCount       Int      @default(0)
  fetchedAt       DateTime @default(now())
  expiresAt       DateTime

  @@unique([realEstateType, buildingKey])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Push schema and regenerate Prisma client**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20 && npm run db:push && npm run db:generate
```

Expected: Prisma reports both tables created, client regenerated, no errors.

- [ ] **Step 3: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/prisma/schema.prisma
git commit -m "feat(naver-blog): add FacilityNaverBlogCache and RealEstateNaverBlogCache models"
```

---

## Phase 2 — Backend services (TDD)

### Task 2: `naverBlogQuotaService` — 5,000/day counter

**Files:**
- Create: `backend/src/services/naverBlogQuotaService.ts`
- Test: `backend/__tests__/services/naverBlogQuotaService.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// backend/__tests__/services/naverBlogQuotaService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNaverBlogQuotaCounter } from '../../src/services/naverBlogQuotaService.js';

describe('naverBlogQuotaService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T09:00:00+09:00'));
  });

  it('첫 호출은 허용되고 used가 1 증가한다', () => {
    const counter = createNaverBlogQuotaCounter({ dailyLimit: 5000 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.used()).toBe(1);
  });

  it('한도에 도달하면 false를 반환한다', () => {
    const counter = createNaverBlogQuotaCounter({ dailyLimit: 2 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(false);
  });

  it('KST 자정이 지나면 카운터가 리셋된다', () => {
    const counter = createNaverBlogQuotaCounter({ dailyLimit: 1 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(false);
    vi.setSystemTime(new Date('2026-05-16T00:00:01+09:00'));
    expect(counter.tryConsume()).toBe(true);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run __tests__/services/naverBlogQuotaService.test.ts
```

Expected: `Cannot find module '../../src/services/naverBlogQuotaService.js'`.

- [ ] **Step 3: Implement**

```ts
// backend/src/services/naverBlogQuotaService.ts
export interface NaverBlogQuotaCounter {
  tryConsume(): boolean;
  used(): number;
}

interface Options { dailyLimit: number }
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(now: Date): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10);
}

export function createNaverBlogQuotaCounter({ dailyLimit }: Options): NaverBlogQuotaCounter {
  let currentKey = kstDateKey(new Date());
  let usedCount = 0;
  function rollOverIfNeeded(): void {
    const key = kstDateKey(new Date());
    if (key !== currentKey) { currentKey = key; usedCount = 0; }
  }
  return {
    tryConsume(): boolean {
      rollOverIfNeeded();
      if (usedCount >= dailyLimit) return false;
      usedCount += 1;
      return true;
    },
    used(): number {
      rollOverIfNeeded();
      return usedCount;
    },
  };
}

// Naver Search API 무료 일일 한도 25,000건. 다른 잠재 사용처 보호 위해 보수적으로 5,000건 사용.
export const naverBlogQuotaCounter = createNaverBlogQuotaCounter({ dailyLimit: 5000 });
```

- [ ] **Step 4: Verify pass (3/3)**

```bash
npx vitest run __tests__/services/naverBlogQuotaService.test.ts
```

- [ ] **Step 5: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/naverBlogQuotaService.ts backend/__tests__/services/naverBlogQuotaService.test.ts
git commit -m "feat(naver-blog): add daily quota counter with KST midnight rollover"
```

---

### Task 3: `naverBlogService.ts` — query builders + stripHtml (TDD)

**Files:**
- Create: `backend/src/services/naverBlogService.ts`
- Test: `backend/__tests__/services/naverBlogService.test.ts`

- [ ] **Step 1: Write failing tests for `buildNaverBlogQuery` (facility) and `stripHtml`**

```ts
// backend/__tests__/services/naverBlogService.test.ts
import { describe, it, expect } from 'vitest';
import { buildNaverBlogQuery, stripHtml } from '../../src/services/naverBlogService.js';

describe('buildNaverBlogQuery', () => {
  const base = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('parking: name + district + "주차장"', () => {
    expect(buildNaverBlogQuery(base, 'parking')).toBe('종로주차장 종로구 주차장');
  });
  it('toilet', () => {
    expect(buildNaverBlogQuery({ name: '광화문역', city: '서울특별시', district: '종로구' }, 'toilet'))
      .toBe('광화문역 공중화장실 종로구');
  });
  it('park uses city short', () => {
    expect(buildNaverBlogQuery({ name: '남산공원', city: '서울특별시', district: '중구' }, 'park'))
      .toBe('남산공원 서울');
  });
  it('library / hospital / school / market / sports / wifi / clothes / subway → name + district', () => {
    expect(buildNaverBlogQuery({ name: '종로도서관', city: '서울특별시', district: '종로구' }, 'library'))
      .toBe('종로도서관 종로구');
    expect(buildNaverBlogQuery({ name: '서울대병원', city: '서울특별시', district: '종로구' }, 'hospital'))
      .toBe('서울대병원 종로구');
  });
  it('pharmacy', () => {
    expect(buildNaverBlogQuery({ name: '종로약국', city: '서울특별시', district: '종로구' }, 'pharmacy'))
      .toBe('종로약국 종로구 약국');
  });
  it('ev-charger', () => {
    expect(buildNaverBlogQuery({ name: '이마트 종로점', city: '서울특별시', district: '종로구' }, 'ev-charger'))
      .toBe('이마트 종로점 전기차 충전소');
  });
  it('childcare', () => {
    expect(buildNaverBlogQuery({ name: '해님', city: '서울특별시', district: '종로구' }, 'childcare'))
      .toBe('해님 종로구 어린이집');
  });
  it('aed', () => {
    expect(buildNaverBlogQuery({ name: '시청', city: '서울특별시', district: '중구' }, 'aed'))
      .toBe('시청 AED 중구');
  });
  it('district 누락 시 city short 폴백', () => {
    expect(buildNaverBlogQuery({ name: '광장시장', city: '서울특별시', district: '' }, 'market'))
      .toBe('광장시장 서울');
  });
});

describe('stripHtml', () => {
  it('<b> 태그 제거', () => {
    expect(stripHtml('<b>광장시장</b> 후기')).toBe('광장시장 후기');
  });
  it('여러 태그 + 엔티티 제거', () => {
    expect(stripHtml('<b>주차장</b>은 &quot;좋다&quot; &amp; 깨끗')).toBe('주차장은 "좋다" & 깨끗');
  });
  it('&#39; &nbsp; &lt; &gt; 처리', () => {
    expect(stripHtml('it&#39;s&nbsp;great&lt;3&gt;')).toBe('it\'s great<3>');
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

Expected: module not found.

- [ ] **Step 3: Implement facility builder + stripHtml**

```ts
// backend/src/services/naverBlogService.ts
import type { FacilityCategory } from './categoryRegistry.js';

export interface FacilityQueryInput {
  name: string;
  city: string;
  district: string;
}

export interface RealEstateQueryInput {
  buildingName: string;
  city: string;
  district: string;
}

const CITY_SHORT: Record<string, string> = {
  '서울특별시': '서울', '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
  '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산',
  '세종특별자치시': '세종', '제주특별자치도': '제주',
};

function cityShort(city: string): string {
  return CITY_SHORT[city] ?? city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '');
}

function regionToken(d: string, c: string): string {
  return d?.trim() || cityShort(c);
}

export function buildNaverBlogQuery(input: FacilityQueryInput, category: FacilityCategory): string {
  const region = regionToken(input.district, input.city);
  const name = input.name.trim();
  switch (category) {
    case 'parking':   return `${name} ${region} 주차장`;
    case 'toilet':    return `${name} 공중화장실 ${region}`;
    case 'park':      return `${name} ${cityShort(input.city)}`;
    case 'pharmacy':  return `${name} ${region} 약국`;
    case 'ev-charger':return `${name} 전기차 충전소`;
    case 'childcare': return `${name} ${region} 어린이집`;
    case 'aed':       return `${name} AED ${region}`;
    case 'library':
    case 'hospital':
    case 'school':
    case 'market':
    case 'sports':
    case 'wifi':
    case 'clothes':
    case 'subway':    return `${name} ${region}`;
  }
}

// Naver API title/description의 <b>...</b> 강조 태그 + 흔한 엔티티 제거
const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'",
  '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ',
};

export function stripHtml(input: string): string {
  if (!input) return '';
  return input
    .replace(/<[^>]+>/g, '')
    .replace(/&[#a-zA-Z0-9]+;/g, (m) => HTML_ENTITY_MAP[m] ?? m);
}
```

- [ ] **Step 4: Verify pass**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

Expected: 13 tests pass (10 builder + 3 stripHtml).

- [ ] **Step 5: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/naverBlogService.ts backend/__tests__/services/naverBlogService.test.ts
git commit -m "feat(naver-blog): add facility query builder and stripHtml helper"
```

---

### Task 4: Real-estate query builder

**Files:**
- Modify: `backend/src/services/naverBlogService.ts`
- Modify: `backend/__tests__/services/naverBlogService.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { buildNaverBlogQueryForRealEstate } from '../../src/services/naverBlogService.js';

describe('buildNaverBlogQueryForRealEstate', () => {
  const base = { buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' };

  it('apt-sale → 아파트 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'apt-sale'))
      .toBe('롯데캐슬 골드 종로구 아파트 매매');
  });
  it('apt-rent → 아파트 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'apt-rent'))
      .toBe('롯데캐슬 골드 종로구 아파트 전세');
  });
  it('villa-sale → 빌라 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'villa-sale'))
      .toBe('롯데캐슬 골드 종로구 빌라 매매');
  });
  it('villa-rent → 빌라 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'villa-rent'))
      .toBe('롯데캐슬 골드 종로구 빌라 전세');
  });
  it('offitel-sale → 오피스텔 매매', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'offitel-sale'))
      .toBe('롯데캐슬 골드 종로구 오피스텔 매매');
  });
  it('offitel-rent → 오피스텔 전세', () => {
    expect(buildNaverBlogQueryForRealEstate(base, 'offitel-rent'))
      .toBe('롯데캐슬 골드 종로구 오피스텔 전세');
  });
  it('district 누락 시 city short 폴백', () => {
    expect(buildNaverBlogQueryForRealEstate({ buildingName: '롯데캐슬', city: '서울특별시', district: '' }, 'apt-sale'))
      .toBe('롯데캐슬 서울 아파트 매매');
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

Expected: `buildNaverBlogQueryForRealEstate` not exported.

- [ ] **Step 3: Append implementation**

Add to `backend/src/services/naverBlogService.ts`:

```ts
export type RealEstateType =
  | 'apt-sale' | 'apt-rent'
  | 'villa-sale' | 'villa-rent'
  | 'offitel-sale' | 'offitel-rent';

const REAL_ESTATE_TYPE_LABEL: Record<RealEstateType, string> = {
  'apt-sale':    '아파트 매매',
  'apt-rent':    '아파트 전세',
  'villa-sale':  '빌라 매매',
  'villa-rent':  '빌라 전세',
  'offitel-sale':'오피스텔 매매',
  'offitel-rent':'오피스텔 전세',
};

export function buildNaverBlogQueryForRealEstate(
  input: RealEstateQueryInput,
  type: RealEstateType,
): string {
  const region = regionToken(input.district, input.city);
  return `${input.buildingName.trim()} ${region} ${REAL_ESTATE_TYPE_LABEL[type]}`;
}
```

- [ ] **Step 4: Verify pass (13 + 7 = 20)**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/naverBlogService.ts backend/__tests__/services/naverBlogService.test.ts
git commit -m "feat(naver-blog): add real-estate query builder"
```

---

### Task 5: `filterNaverBlogPosts` — ad keywords + age + length

**Files:**
- Modify: `backend/src/services/naverBlogService.ts`
- Modify: `backend/__tests__/services/naverBlogService.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { filterNaverBlogPosts, type RawNaverBlogPost, NAVER_BLOG_MIN_RESULTS } from '../../src/services/naverBlogService.js';

function mkPost(overrides: Partial<RawNaverBlogPost> = {}): RawNaverBlogPost {
  return {
    url: 'https://blog.naver.com/x/1',
    title: '종로주차장 후기',
    description: '여기는 종로 한가운데에 있어서 가기 편하고 요금도 합리적이었어요. 추천합니다',
    bloggerName: '여행객A',
    bloggerLink: 'https://blog.naver.com/x',
    postDate: '20250901',
    ...overrides,
  };
}

describe('filterNaverBlogPosts', () => {
  const FIXED_NOW = new Date('2026-05-15T00:00:00+09:00');

  it('광고 키워드 포함 시 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', title: '[광고] 종로주차장 추천' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('description에 협찬 포함 시 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', description: '소개해드릴게요. 본 후기는 협찬 받아 작성되었습니다 (충분한 내용입니다 진짜로)' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('도메인 블랙리스트', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', bloggerLink: 'https://blog.naver.com/blocked-fixture' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW, blockedBloggerLinks: ['https://blog.naver.com/blocked-fixture'] });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('3년 초과 글 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', postDate: '20220101' }), // 4+ years old
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('description 30자 미만 제외', () => {
    const out = filterNaverBlogPosts([
      mkPost({ url: 'a', description: '짧음' }),
      mkPost({ url: 'b' }),
    ], { now: FIXED_NOW });
    expect(out.map((p) => p.url)).toEqual(['b']);
  });

  it('상위 5건만 반환', () => {
    const inputs = Array.from({ length: 10 }, (_, i) => mkPost({ url: `u${i}` }));
    expect(filterNaverBlogPosts(inputs, { now: FIXED_NOW })).toHaveLength(5);
  });

  it('NAVER_BLOG_MIN_RESULTS = 3', () => {
    expect(NAVER_BLOG_MIN_RESULTS).toBe(3);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

- [ ] **Step 3: Append implementation**

```ts
export interface RawNaverBlogPost {
  url: string;
  title: string;
  description: string;
  bloggerName: string;
  bloggerLink: string;
  postDate: string; // YYYYMMDD
}

export const NAVER_BLOG_MIN_RESULTS = 3;
const MAX_POSTS = 5;
const MIN_DESCRIPTION_LENGTH = 30;
const MAX_AGE_YEARS = 3;

const AD_KEYWORDS = [
  '체험단', '협찬', '광고', '#광고', '#협찬', '[광고]', '[Ad]', '[AD]',
  '원고료', '무료초대', '소정의 대가', '제공받아',
];

const DEFAULT_BLOCKED_BLOGGER_LINKS: string[] = [];

interface FilterOptions {
  now?: Date;
  adKeywords?: string[];
  blockedBloggerLinks?: string[];
}

function parsePostDate(s: string): Date | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function filterNaverBlogPosts(
  posts: RawNaverBlogPost[],
  opts: FilterOptions = {},
): RawNaverBlogPost[] {
  const now = opts.now ?? new Date();
  const ads = opts.adKeywords ?? AD_KEYWORDS;
  const blocked = opts.blockedBloggerLinks ?? DEFAULT_BLOCKED_BLOGGER_LINKS;
  const cutoff = new Date(now.getTime());
  cutoff.setFullYear(cutoff.getFullYear() - MAX_AGE_YEARS);

  return posts
    .filter((p) => p.description.length >= MIN_DESCRIPTION_LENGTH)
    .filter((p) => !ads.some((kw) => p.title.includes(kw) || p.description.includes(kw)))
    .filter((p) => !blocked.includes(p.bloggerLink))
    .filter((p) => {
      const d = parsePostDate(p.postDate);
      return d ? d >= cutoff : true; // 파싱 실패는 통과 (보수적)
    })
    .slice(0, MAX_POSTS);
}
```

- [ ] **Step 4: Verify pass (20 + 7 = 27)**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/naverBlogService.ts backend/__tests__/services/naverBlogService.test.ts
git commit -m "feat(naver-blog): add post filter (ad keywords, age, length, blocklist, top 5)"
```

---

### Task 6: `fetchFromNaver` — API client

**Files:**
- Modify: `backend/src/services/naverBlogService.ts`
- Modify: `backend/__tests__/services/naverBlogService.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
import { fetchFromNaver } from '../../src/services/naverBlogService.js';
import { vi, afterEach } from 'vitest';

describe('fetchFromNaver', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('정상 응답을 RawNaverBlogPost 배열로 매핑 (HTML strip 적용)', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        title: '<b>종로주차장</b> 후기',
        link: 'https://blog.naver.com/x/1',
        description: '여기는 <b>종로</b> 한가운데에 있어서 가기 편함',
        bloggername: '여행객A',
        bloggerlink: 'https://blog.naver.com/x',
        postdate: '20260301',
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const out = await fetchFromNaver('test query', 'CID', 'CSEC');
    expect(out).toEqual([{
      url: 'https://blog.naver.com/x/1',
      title: '종로주차장 후기',
      description: '여기는 종로 한가운데에 있어서 가기 편함',
      bloggerName: '여행객A',
      bloggerLink: 'https://blog.naver.com/x',
      postDate: '20260301',
    }]);
  });

  it('4xx 응답이면 빈 배열', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    expect(await fetchFromNaver('q', 'CID', 'CSEC')).toEqual([]);
  });

  it('네트워크 에러면 빈 배열', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    expect(await fetchFromNaver('q', 'CID', 'CSEC')).toEqual([]);
  });

  it('clientId 또는 secret 미설정이면 호출 스킵', async () => {
    const spy = vi.fn();
    globalThis.fetch = spy as unknown as typeof fetch;
    expect(await fetchFromNaver('q', '', 'CSEC')).toEqual([]);
    expect(await fetchFromNaver('q', 'CID', '')).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

- [ ] **Step 3: Append implementation**

```ts
interface NaverApiItem {
  title: string;
  link: string;
  description: string;
  bloggername: string;
  bloggerlink: string;
  postdate: string;
}

interface NaverApiResponse {
  items?: NaverApiItem[];
}

const NAVER_BLOG_SEARCH_URL = 'https://openapi.naver.com/v1/search/blog.json';

export async function fetchFromNaver(
  query: string,
  clientId: string,
  clientSecret: string,
): Promise<RawNaverBlogPost[]> {
  if (!clientId || !clientSecret) return [];

  const params = new URLSearchParams({
    query,
    display: '15',
    start: '1',
    sort: 'sim',
  });

  try {
    const res = await fetch(`${NAVER_BLOG_SEARCH_URL}?${params.toString()}`, {
      headers: {
        'X-Naver-Client-Id': clientId,
        'X-Naver-Client-Secret': clientSecret,
      },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as NaverApiResponse;
    return (json.items ?? []).map<RawNaverBlogPost>((it) => ({
      url: it.link,
      title: stripHtml(it.title),
      description: stripHtml(it.description),
      bloggerName: it.bloggername,
      bloggerLink: it.bloggerlink,
      postDate: it.postdate,
    }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Verify pass (27 + 4 = 31)**

```bash
npx vitest run __tests__/services/naverBlogService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/naverBlogService.ts backend/__tests__/services/naverBlogService.test.ts
git commit -m "feat(naver-blog): add Naver Search API client"
```

---

### Task 7: `naverBlogCacheService` — facility cache

**Files:**
- Create: `backend/src/services/naverBlogCacheService.ts`
- Test: `backend/__tests__/services/naverBlogCacheService.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// backend/__tests__/services/naverBlogCacheService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUniqueF, mockUpsertF, mockQuotaTry, mockFetchNaver } = vi.hoisted(() => ({
  mockFindUniqueF: vi.fn(),
  mockUpsertF: vi.fn(),
  mockQuotaTry: vi.fn(),
  mockFetchNaver: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    facilityNaverBlogCache: { findUnique: mockFindUniqueF, upsert: mockUpsertF },
    realEstateNaverBlogCache: { findUnique: vi.fn(), upsert: vi.fn() },
  };
  return { default: prismaClient, prisma: prismaClient };
});

vi.mock('../../src/services/naverBlogQuotaService.js', () => ({
  naverBlogQuotaCounter: { tryConsume: mockQuotaTry, used: () => 0 },
}));

vi.mock('../../src/services/naverBlogService.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/naverBlogService.js')>(
    '../../src/services/naverBlogService.js',
  );
  return { ...actual, fetchFromNaver: mockFetchNaver };
});

import { getOrFetchNaverBlogForFacility, facilityInFlight } from '../../src/services/naverBlogCacheService.js';

function makePosts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    url: `u${i}`, title: 't', description: 'd'.repeat(40),
    bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101',
  }));
}

describe('getOrFetchNaverBlogForFacility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    facilityInFlight.clear();
    process.env.NAVER_CLIENT_ID = 'CID';
    process.env.NAVER_CLIENT_SECRET = 'CSEC';
  });
  const facility = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('캐시 히트', async () => {
    mockFindUniqueF.mockResolvedValueOnce({
      posts: makePosts(3),
      itemCount: 3,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toHaveLength(3);
    expect(mockFetchNaver).not.toHaveBeenCalled();
  });

  it('미스 + quota 여유 → fetch + upsert', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(5));
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toHaveLength(5);
    expect(mockUpsertF).toHaveBeenCalledTimes(1);
  });

  it('미스 + quota 소진 → 빈 배열', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(false);
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockUpsertF).not.toHaveBeenCalled();
  });

  it('만료 캐시 → 미스 처리', async () => {
    mockFindUniqueF.mockResolvedValueOnce({
      posts: makePosts(3), itemCount: 3, expiresAt: new Date(Date.now() - 1000),
    });
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(4));
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toHaveLength(4);
  });

  it('필터링 결과 < MIN_RESULTS → negative caching, 빈 배열', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(2));
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockUpsertF).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ itemCount: 0, posts: [] }),
    }));
  });

  it('cacheOnly + 미스 → 빈 배열 + fetch 호출 안 함', async () => {
    mockFindUniqueF.mockResolvedValueOnce(null);
    const out = await getOrFetchNaverBlogForFacility('parking', '123', facility, { cacheOnly: true });
    expect(out).toEqual([]);
    expect(mockFetchNaver).not.toHaveBeenCalled();
    expect(mockUpsertF).not.toHaveBeenCalled();
  });

  it('in-flight dedup', async () => {
    mockFindUniqueF.mockResolvedValue(null);
    mockQuotaTry.mockReturnValue(true);
    mockUpsertF.mockResolvedValue({});
    let resolve!: (v: unknown) => void;
    mockFetchNaver.mockImplementationOnce(() => new Promise((r) => { resolve = r; }));
    const p1 = getOrFetchNaverBlogForFacility('parking', 'dup', facility);
    const p2 = getOrFetchNaverBlogForFacility('parking', 'dup', facility);
    await Promise.resolve(); await Promise.resolve();
    resolve(makePosts(5));
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(mockFetchNaver).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run __tests__/services/naverBlogCacheService.test.ts
```

- [ ] **Step 3: Implement (facility only — real-estate added in Task 8)**

```ts
// backend/src/services/naverBlogCacheService.ts
import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import {
  buildNaverBlogQuery, buildNaverBlogQueryForRealEstate,
  fetchFromNaver, filterNaverBlogPosts, NAVER_BLOG_MIN_RESULTS,
  type FacilityQueryInput, type RealEstateQueryInput, type RealEstateType, type RawNaverBlogPost,
} from './naverBlogService.js';
import { naverBlogQuotaCounter } from './naverBlogQuotaService.js';

const TTL_MS = 14 * 24 * 60 * 60 * 1000;

export const facilityInFlight = new Map<string, Promise<RawNaverBlogPost[]>>();
export const realEstateInFlight = new Map<string, Promise<RawNaverBlogPost[]>>();

interface GetOptions { cacheOnly?: boolean }

export async function getOrFetchNaverBlogForFacility(
  category: FacilityCategory,
  facilityId: string,
  facility: FacilityQueryInput,
  options: GetOptions = {},
): Promise<RawNaverBlogPost[]> {
  const hit = await prisma.facilityNaverBlogCache.findUnique({
    where: { category_facilityId: { category, facilityId } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.posts as unknown as RawNaverBlogPost[]) ?? [];
  }
  if (options.cacheOnly) return [];

  const key = `${category}:${facilityId}`;
  const existing = facilityInFlight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<RawNaverBlogPost[]> => {
    try {
      if (!naverBlogQuotaCounter.tryConsume()) return [];
      const query = buildNaverBlogQuery(facility, category);
      const cid = process.env.NAVER_CLIENT_ID ?? '';
      const sec = process.env.NAVER_CLIENT_SECRET ?? '';
      const raw = await fetchFromNaver(query, cid, sec);
      const filtered = filterNaverBlogPosts(raw);
      const useful = filtered.length >= NAVER_BLOG_MIN_RESULTS;
      const posts: RawNaverBlogPost[] = useful ? filtered : [];
      const itemCount = posts.length;
      const expiresAt = new Date(Date.now() + TTL_MS);
      await prisma.facilityNaverBlogCache.upsert({
        where: { category_facilityId: { category, facilityId } },
        create: { category, facilityId, query, posts: posts as unknown as object, itemCount, expiresAt },
        update: { query, posts: posts as unknown as object, itemCount, expiresAt, fetchedAt: new Date() },
      });
      return posts;
    } finally {
      facilityInFlight.delete(key);
    }
  })();

  facilityInFlight.set(key, job);
  return job;
}
```

(Note: `buildNaverBlogQueryForRealEstate`, `RealEstateQueryInput`, `RealEstateType` imported here are used in Task 8.)

- [ ] **Step 4: Verify pass (7/7)**

```bash
npx vitest run __tests__/services/naverBlogCacheService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/naverBlogCacheService.ts backend/__tests__/services/naverBlogCacheService.test.ts
git commit -m "feat(naver-blog): add facility cache service with negative caching and in-flight dedup"
```

---

### Task 8: Real-estate cache service

**Files:**
- Modify: `backend/src/services/naverBlogCacheService.ts`
- Modify: `backend/__tests__/services/naverBlogCacheService.test.ts`

- [ ] **Step 1: Append failing tests**

```ts
const { mockFindUniqueR, mockUpsertR } = vi.hoisted(() => ({
  mockFindUniqueR: vi.fn(),
  mockUpsertR: vi.fn(),
}));

// Update the prisma mock to use the real-estate-specific spies.
// Replace the prismaClient.realEstateNaverBlogCache object in the existing vi.mock call
// with mockFindUniqueR / mockUpsertR. Implementer: refactor the mock setup at the top of
// the file to use mockFindUniqueR / mockUpsertR for the real-estate model.

import { getOrFetchNaverBlogForRealEstate, realEstateInFlight } from '../../src/services/naverBlogCacheService.js';

describe('getOrFetchNaverBlogForRealEstate', () => {
  beforeEach(() => {
    realEstateInFlight.clear();
  });
  const building = { buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' };

  it('캐시 히트', async () => {
    mockFindUniqueR.mockResolvedValueOnce({
      posts: makePosts(3), itemCount: 3, expiresAt: new Date(Date.now() + 86_400_000),
    });
    const out = await getOrFetchNaverBlogForRealEstate('apt-sale', 'seoul|jongro|lotte', building);
    expect(out).toHaveLength(3);
    expect(mockFetchNaver).not.toHaveBeenCalled();
  });

  it('미스 + quota 여유 → fetch + upsert', async () => {
    mockFindUniqueR.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchNaver.mockResolvedValueOnce(makePosts(5));
    const out = await getOrFetchNaverBlogForRealEstate('apt-sale', 'seoul|jongro|lotte', building);
    expect(out).toHaveLength(5);
    expect(mockUpsertR).toHaveBeenCalledTimes(1);
  });

  it('cacheOnly + 미스 → 빈 배열', async () => {
    mockFindUniqueR.mockResolvedValueOnce(null);
    const out = await getOrFetchNaverBlogForRealEstate('apt-sale', 'seoul|jongro|lotte', building, { cacheOnly: true });
    expect(out).toEqual([]);
    expect(mockFetchNaver).not.toHaveBeenCalled();
  });
});
```

**IMPORTANT — refactor the prisma mock at the top of the test file** so that the `realEstateNaverBlogCache` mock fields use `mockFindUniqueR` and `mockUpsertR`:

```ts
vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    facilityNaverBlogCache: { findUnique: mockFindUniqueF, upsert: mockUpsertF },
    realEstateNaverBlogCache: { findUnique: mockFindUniqueR, upsert: mockUpsertR },
  };
  return { default: prismaClient, prisma: prismaClient };
});
```

Also add `mockFindUniqueR`, `mockUpsertR` to the `vi.hoisted` call near the top.

- [ ] **Step 2: Verify failure**

```bash
npx vitest run __tests__/services/naverBlogCacheService.test.ts
```

- [ ] **Step 3: Append implementation**

Add to `backend/src/services/naverBlogCacheService.ts`:

```ts
export async function getOrFetchNaverBlogForRealEstate(
  type: RealEstateType,
  buildingKey: string,
  building: RealEstateQueryInput,
  options: GetOptions = {},
): Promise<RawNaverBlogPost[]> {
  const hit = await prisma.realEstateNaverBlogCache.findUnique({
    where: { realEstateType_buildingKey: { realEstateType: type, buildingKey } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.posts as unknown as RawNaverBlogPost[]) ?? [];
  }
  if (options.cacheOnly) return [];

  const key = `${type}:${buildingKey}`;
  const existing = realEstateInFlight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<RawNaverBlogPost[]> => {
    try {
      if (!naverBlogQuotaCounter.tryConsume()) return [];
      const query = buildNaverBlogQueryForRealEstate(building, type);
      const cid = process.env.NAVER_CLIENT_ID ?? '';
      const sec = process.env.NAVER_CLIENT_SECRET ?? '';
      const raw = await fetchFromNaver(query, cid, sec);
      const filtered = filterNaverBlogPosts(raw);
      const useful = filtered.length >= NAVER_BLOG_MIN_RESULTS;
      const posts: RawNaverBlogPost[] = useful ? filtered : [];
      const expiresAt = new Date(Date.now() + TTL_MS);
      await prisma.realEstateNaverBlogCache.upsert({
        where: { realEstateType_buildingKey: { realEstateType: type, buildingKey } },
        create: { realEstateType: type, buildingKey, query, posts: posts as unknown as object, itemCount: posts.length, expiresAt },
        update: { query, posts: posts as unknown as object, itemCount: posts.length, expiresAt, fetchedAt: new Date() },
      });
      return posts;
    } finally {
      realEstateInFlight.delete(key);
    }
  })();

  realEstateInFlight.set(key, job);
  return job;
}
```

- [ ] **Step 4: Verify pass (7 + 3 = 10)**

```bash
npx vitest run __tests__/services/naverBlogCacheService.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/naverBlogCacheService.ts backend/__tests__/services/naverBlogCacheService.test.ts
git commit -m "feat(naver-blog): add real-estate cache service"
```

---

### Task 9: Zod params schemas

**Files:**
- Create: `backend/src/schemas/naverBlog.ts`

- [ ] **Step 1: Create schema file**

```ts
// backend/src/schemas/naverBlog.ts
import { z } from 'zod';
import { FacilityCategorySchema } from './facility.js';

export const FacilityNaverBlogParamsSchema = z.object({
  category: FacilityCategorySchema,
  id: z.string().min(1).max(100),
});

export const REAL_ESTATE_TYPES = ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'] as const;

export const RealEstateNaverBlogParamsSchema = z.object({
  type: z.enum(REAL_ESTATE_TYPES),
  city: z.string().min(1).max(50),
  district: z.string().min(1).max(50),
  buildingName: z.string().min(1).max(200),
});

export type FacilityNaverBlogParams = z.infer<typeof FacilityNaverBlogParamsSchema>;
export type RealEstateNaverBlogParams = z.infer<typeof RealEstateNaverBlogParamsSchema>;
```

- [ ] **Step 2: Commit (no test — these schemas are exercised by the route tests in Tasks 10–11)**

```bash
git add backend/src/schemas/naverBlog.ts
git commit -m "feat(naver-blog): add Zod params schemas"
```

---

### Task 10: Facility route

**Files:**
- Create: `backend/src/routes/facilityNaverBlog.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/__tests__/routes/facilityNaverBlog.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// backend/__tests__/routes/facilityNaverBlog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetFacility, mockFindParking } = vi.hoisted(() => ({
  mockGetFacility: vi.fn(),
  mockFindParking: vi.fn(),
}));

vi.mock('../../src/services/naverBlogCacheService.js', () => ({
  getOrFetchNaverBlogForFacility: mockGetFacility,
  getOrFetchNaverBlogForRealEstate: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = { parking: { findUnique: mockFindParking } };
  return { default: prismaClient, prisma: prismaClient };
});

import app from '../../src/app.js';

describe('GET /api/facilities/:category/:id/naver-blog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('정상 응답', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetFacility.mockResolvedValueOnce([
      { url: 'u', title: 't', description: 'd'.repeat(40), bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101' },
    ]);
    const res = await request(app).get('/api/facilities/parking/123/naver-blog');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { posts: [expect.objectContaining({ url: 'u' })] } });
  });

  it('시설 미존재 404', async () => {
    mockFindParking.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/facilities/parking/missing/naver-blog');
    expect(res.status).toBe(404);
  });

  it('잘못된 category 422', async () => {
    const res = await request(app).get('/api/facilities/INVALID/1/naver-blog');
    expect(res.status).toBe(422);
  });

  it('영상이 없으면 빈 배열', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetFacility.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/facilities/parking/123/naver-blog');
    expect(res.status).toBe(200);
    expect(res.body.data.posts).toEqual([]);
  });

  it('?ssr=1 cache-only 전달', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetFacility.mockResolvedValueOnce([]);
    await request(app).get('/api/facilities/parking/123/naver-blog?ssr=1');
    expect(mockGetFacility).toHaveBeenCalledWith('parking', '123', expect.any(Object), { cacheOnly: true });
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement route**

```ts
// backend/src/routes/facilityNaverBlog.ts
import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { FacilityNaverBlogParamsSchema } from '../schemas/naverBlog.js';
import { CATEGORY_REGISTRY, type FacilityCategory } from '../services/categoryRegistry.js';
import { getOrFetchNaverBlogForFacility } from '../services/naverBlogCacheService.js';

const router = Router();

router.get(
  '/:category/:id/naver-blog',
  validate(FacilityNaverBlogParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, id } = req.params as { category: FacilityCategory; id: string };
    const model = CATEGORY_REGISTRY[category].model();
    const facility = await model.findUnique({
      where: { id },
      select: { id: true, name: true, city: true, district: true },
    });
    if (!facility) throw new NotFoundError('Facility not found');

    const cacheOnly = req.query.ssr === '1';
    const posts = await getOrFetchNaverBlogForFacility(category, id, {
      name: facility.name, city: facility.city, district: facility.district,
    }, { cacheOnly });

    res.json({ success: true, data: { posts } });
  }),
);

export default router;
```

- [ ] **Step 4: Mount router in `backend/src/app.ts`**

Add the import near the other route imports:

```ts
import facilityNaverBlogRouter from './routes/facilityNaverBlog.js';
```

Add the `app.use(...)` call after the existing `app.use('/api/facilities', ...)` registrations (order matters only for catch-all routes; this specific suffix is non-conflicting):

```ts
app.use('/api/facilities', facilityNaverBlogRouter);
```

- [ ] **Step 5: Verify pass (5/5)**

```bash
npx vitest run __tests__/routes/facilityNaverBlog.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/facilityNaverBlog.ts backend/src/app.ts backend/__tests__/routes/facilityNaverBlog.test.ts
git commit -m "feat(naver-blog): add GET /api/facilities/:category/:id/naver-blog route"
```

---

### Task 11: Real-estate route

**Files:**
- Create: `backend/src/routes/realEstateNaverBlog.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/__tests__/routes/realEstateNaverBlog.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// backend/__tests__/routes/realEstateNaverBlog.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetRealEstate, mockGetBuilding } = vi.hoisted(() => ({
  mockGetRealEstate: vi.fn(),
  mockGetBuilding: vi.fn(),
}));

vi.mock('../../src/services/naverBlogCacheService.js', () => ({
  getOrFetchNaverBlogForFacility: vi.fn(),
  getOrFetchNaverBlogForRealEstate: mockGetRealEstate,
}));

vi.mock('../../src/services/realEstateService.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/realEstateService.js')>(
    '../../src/services/realEstateService.js',
  );
  return { ...actual, getBuildingInfo: mockGetBuilding };
});

import app from '../../src/app.js';

describe('GET /api/real-estate/:type/:city/:district/:buildingName/naver-blog', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('정상 응답', async () => {
    mockGetBuilding.mockResolvedValueOnce({ buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' });
    mockGetRealEstate.mockResolvedValueOnce([
      { url: 'u', title: 't', description: 'd'.repeat(40), bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101' },
    ]);
    const res = await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/롯데캐슬 골드/naver-blog');
    expect(res.status).toBe(200);
    expect(res.body.data.posts[0].url).toBe('u');
  });

  it('단지 미존재 404', async () => {
    mockGetBuilding.mockResolvedValueOnce(null);
    const res = await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/없는단지/naver-blog');
    expect(res.status).toBe(404);
  });

  it('잘못된 type 422', async () => {
    const res = await request(app).get('/api/real-estate/BAD/서울특별시/종로구/롯데캐슬/naver-blog');
    expect(res.status).toBe(422);
  });

  it('빈 배열', async () => {
    mockGetBuilding.mockResolvedValueOnce({ buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' });
    mockGetRealEstate.mockResolvedValueOnce([]);
    const res = await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/롯데캐슬 골드/naver-blog');
    expect(res.body.data.posts).toEqual([]);
  });

  it('?ssr=1 cache-only 전달', async () => {
    mockGetBuilding.mockResolvedValueOnce({ buildingName: '롯데캐슬 골드', city: '서울특별시', district: '종로구' });
    mockGetRealEstate.mockResolvedValueOnce([]);
    await request(app).get('/api/real-estate/apt-sale/서울특별시/종로구/롯데캐슬 골드/naver-blog?ssr=1');
    expect(mockGetRealEstate).toHaveBeenCalledWith(
      'apt-sale',
      expect.stringContaining('서울특별시|종로구|롯데캐슬 골드'),
      expect.any(Object),
      { cacheOnly: true },
    );
  });
});
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement route**

```ts
// backend/src/routes/realEstateNaverBlog.ts
import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { RealEstateNaverBlogParamsSchema } from '../schemas/naverBlog.js';
import { getOrFetchNaverBlogForRealEstate } from '../services/naverBlogCacheService.js';
import type { RealEstateType } from '../services/naverBlogService.js';
import { getBuildingInfo } from '../services/realEstateService.js';

const router = Router();

function makeBuildingKey(city: string, district: string, buildingName: string): string {
  return `${city.trim()}|${district.trim()}|${buildingName.trim()}`;
}

router.get(
  '/:type/:city/:district/:buildingName/naver-blog',
  validate(RealEstateNaverBlogParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { type, city, district, buildingName } = req.params as {
      type: RealEstateType; city: string; district: string; buildingName: string;
    };

    // getBuildingInfo는 (realEstateType, bjdCode, buildingName)를 받음. 여기선 bjdCode 없이 buildingName으로 조회.
    const info = await getBuildingInfo(type, '', buildingName);
    if (!info) throw new NotFoundError('Building not found');

    const cacheOnly = req.query.ssr === '1';
    const buildingKey = makeBuildingKey(city, district, buildingName);
    const posts = await getOrFetchNaverBlogForRealEstate(type, buildingKey, {
      buildingName, city, district,
    }, { cacheOnly });

    res.json({ success: true, data: { posts } });
  }),
);

export default router;
```

- [ ] **Step 4: Mount in `backend/src/app.ts`**

Add the import:

```ts
import realEstateNaverBlogRouter from './routes/realEstateNaverBlog.js';
```

Add the `app.use(...)` call alongside or after the existing `app.use('/api/real-estate', ...)` registration:

```ts
app.use('/api/real-estate', realEstateNaverBlogRouter);
```

- [ ] **Step 5: Verify pass (5/5)**

```bash
npx vitest run __tests__/routes/realEstateNaverBlog.test.ts
```

If `getBuildingInfo`'s signature doesn't match `(type, bjdCode, buildingName)` exactly, adapt the call. Verify via:

```bash
grep -n "export async function getBuildingInfo" /Users/leemyeongseok/projects/ilsangkit/backend/src/services/realEstateService.ts
```

and adjust accordingly.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/realEstateNaverBlog.ts backend/src/app.ts backend/__tests__/routes/realEstateNaverBlog.test.ts
git commit -m "feat(naver-blog): add real-estate route"
```

---

### Task 12: Full backend suite

- [ ] **Step 1: Run lint + tests + build**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npm run test && npm run build
```

Expected: lint 0 errors, all tests pass (1067 baseline + ~50 new = ~1117), tsc clean.

- [ ] **Step 2: Commit any fixes**

```bash
git add -A && git commit -m "chore(backend): lint/build fixes" || echo "no changes"
```

---

## Phase 3 — Frontend type + composable (TDD)

### Task 13: `NaverBlogPost` type

**Files:** Create `frontend/types/naverBlog.ts`

- [ ] **Step 1: Create file**

```ts
export interface NaverBlogPost {
  url: string
  title: string
  description: string
  bloggerName: string
  bloggerLink: string
  postDate: string // YYYYMMDD
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types/naverBlog.ts
git commit -m "feat(naver-blog): add NaverBlogPost type"
```

---

### Task 14: `useBlogReviews` composable

**Files:**
- Create: `frontend/composables/useBlogReviews.ts`
- Test: `frontend/tests/composables/useBlogReviews.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// frontend/tests/composables/useBlogReviews.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useBlogReviews } from '~/composables/useBlogReviews'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api' } }))
})

describe('useBlogReviews', () => {
  it('초기 상태', () => {
    const { posts, loading } = useBlogReviews()
    expect(posts.value).toEqual([])
    expect(loading.value).toBe(false)
  })

  it('kind=facility URL', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: [{ url: 'u', title: 't', description: 'd', bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101' }] } })
    const { posts, fetchPosts } = useBlogReviews()
    await fetchPosts('facility', 'parking', '123')
    expect(posts.value).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('http://api/api/facilities/parking/123/naver-blog')
  })

  it('kind=real-estate URL (segments are encoded)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: [] } })
    const { fetchPosts } = useBlogReviews()
    await fetchPosts('real-estate', 'apt-sale', '서울특별시|종로구|롯데캐슬 골드')
    // composable splits the buildingKey back into URL segments
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/^http:\/\/api\/api\/real-estate\/apt-sale\/.+\/.+\/.+\/naver-blog$/),
    )
  })

  it('에러 시 빈 배열, throw 안 함', async () => {
    fetchMock.mockRejectedValueOnce(new Error('boom'))
    const { posts, fetchPosts } = useBlogReviews()
    await fetchPosts('facility', 'parking', '123')
    expect(posts.value).toEqual([])
  })

  it('동일 인자 dedup', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { posts: [] } })
    const { fetchPosts } = useBlogReviews()
    await Promise.all([fetchPosts('facility', 'parking', '123'), fetchPosts('facility', 'parking', '123')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Verify failure**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useBlogReviews.test.ts
```

- [ ] **Step 3: Implement**

```ts
// frontend/composables/useBlogReviews.ts
import { ref, readonly } from 'vue'
import type { NaverBlogPost } from '~/types/naverBlog'

export type BlogReviewKind = 'facility' | 'real-estate'

export function useBlogReviews() {
  const posts = ref<NaverBlogPost[]>([])
  const loading = ref(false)
  let lastKey = ''
  let inFlight: Promise<void> | null = null

  function urlFor(kind: BlogReviewKind, primary: string, secondary: string, apiBase: string): string {
    if (kind === 'facility') {
      return `${apiBase}/api/facilities/${primary}/${secondary}/naver-blog`
    }
    // real-estate: secondary is `city|district|buildingName`
    const [city, district, buildingName] = secondary.split('|')
    return `${apiBase}/api/real-estate/${primary}/${encodeURIComponent(city)}/${encodeURIComponent(district)}/${encodeURIComponent(buildingName)}/naver-blog`
  }

  async function fetchPosts(kind: BlogReviewKind, primary: string, secondary: string): Promise<void> {
    const key = `${kind}:${primary}:${secondary}`
    if (key === lastKey && inFlight) return inFlight
    lastKey = key

    const config = useRuntimeConfig()
    const apiBase = config.public.apiBase
    loading.value = true

    inFlight = (async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { posts: NaverBlogPost[] } }>(
          urlFor(kind, primary, secondary, apiBase),
        )
        posts.value = res?.data?.posts ?? []
      } catch {
        posts.value = []
      } finally {
        loading.value = false
      }
    })()

    return inFlight
  }

  return {
    posts: readonly(posts),
    loading: readonly(loading),
    fetchPosts,
  }
}
```

- [ ] **Step 4: Verify pass (5/5)**

```bash
npx vitest run tests/composables/useBlogReviews.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/composables/useBlogReviews.ts frontend/tests/composables/useBlogReviews.test.ts
git commit -m "feat(naver-blog): add useBlogReviews composable (facility + real-estate)"
```

---

## Phase 4 — Frontend components (TDD)

### Task 15: `BlogReviewCard.vue`

**Files:**
- Create: `frontend/components/blog/BlogReviewCard.vue`
- Test: `frontend/tests/components/blog/BlogReviewCard.test.ts`

- [ ] **Step 1: Create test directory + failing test**

```bash
mkdir -p /Users/leemyeongseok/projects/ilsangkit/frontend/tests/components/blog
```

```ts
// frontend/tests/components/blog/BlogReviewCard.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import BlogReviewCard from '~/components/blog/BlogReviewCard.vue'

const post = {
  url: 'https://blog.naver.com/x/1',
  title: '종로주차장 후기',
  description: '여기는 종로 한가운데에 있어서 가기 편하고 요금도 합리적이었어요. 추천합니다',
  bloggerName: '여행객A',
  bloggerLink: 'https://blog.naver.com/x',
  postDate: '20260301',
}

describe('BlogReviewCard', () => {
  it('제목/스니펫/블로거/날짜 렌더', () => {
    const w = mount(BlogReviewCard, { props: { post } })
    expect(w.text()).toContain('종로주차장 후기')
    expect(w.text()).toContain('가기 편하고')
    expect(w.text()).toContain('여행객A')
    expect(w.text()).toContain('2026.03.01')
  })

  it('a 태그 target/rel 속성', () => {
    const w = mount(BlogReviewCard, { props: { post } })
    const a = w.find('a')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('nofollow')
    expect(a.attributes('rel')).toContain('noopener')
    expect(a.attributes('rel')).toContain('noreferrer')
    expect(a.attributes('href')).toBe(post.url)
  })

  it('description 80자 초과 시 80자 + 말줄임으로 표시', () => {
    const longPost = { ...post, description: 'a'.repeat(200) }
    const w = mount(BlogReviewCard, { props: { post: longPost } })
    expect(w.text()).toContain('a'.repeat(80))
    expect(w.text()).toContain('…')
    expect(w.text()).not.toContain('a'.repeat(81))
  })
})
```

- [ ] **Step 2: Verify failure**

```bash
npx vitest run tests/components/blog/BlogReviewCard.test.ts
```

- [ ] **Step 3: Implement**

```vue
<template>
  <a
    :href="post.url"
    target="_blank"
    rel="nofollow noopener noreferrer"
    class="block rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-md"
  >
    <p class="text-base font-semibold text-slate-900 line-clamp-1">{{ post.title }}</p>
    <p class="mt-2 text-sm text-slate-600 line-clamp-2 leading-relaxed">{{ snippet }}</p>
    <div class="mt-3 flex items-center justify-between text-xs text-slate-500">
      <span>{{ post.bloggerName }} · {{ formattedDate }}</span>
      <span class="material-symbols-outlined text-[16px]">open_in_new</span>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NaverBlogPost } from '~/types/naverBlog'

const props = defineProps<{ post: NaverBlogPost }>()

const snippet = computed(() => {
  const d = props.post.description ?? ''
  return d.length > 80 ? `${d.slice(0, 80)}…` : d
})

const formattedDate = computed(() => {
  const s = props.post.postDate
  if (!/^\d{8}$/.test(s)) return s
  return `${s.slice(0, 4)}.${s.slice(4, 6)}.${s.slice(6, 8)}`
})
</script>
```

- [ ] **Step 4: Verify pass (3/3)**

```bash
npx vitest run tests/components/blog/BlogReviewCard.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/blog/BlogReviewCard.vue frontend/tests/components/blog/BlogReviewCard.test.ts
git commit -m "feat(naver-blog): add BlogReviewCard component"
```

---

### Task 16: `BlogReviewSection.vue` (sentinel + IO + fetch)

**Files:**
- Create: `frontend/components/blog/BlogReviewSection.vue`
- Test: `frontend/tests/components/blog/BlogReviewSection.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// frontend/tests/components/blog/BlogReviewSection.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api' } }))
  class IO {
    cb: IntersectionObserverCallback
    constructor(cb: IntersectionObserverCallback) { this.cb = cb }
    observe(el: Element) { this.cb([{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry], this as unknown as IntersectionObserver) }
    unobserve() {}
    disconnect() {}
    takeRecords() { return [] }
    root = null
    rootMargin = ''
    thresholds = []
  }
  vi.stubGlobal('IntersectionObserver', IO as unknown as typeof IntersectionObserver)
})

function mkPosts(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    url: `u${i}`, title: 't'+i, description: 'd'.repeat(40),
    bloggerName: 'b', bloggerLink: 'bl', postDate: '20260101',
  }))
}

describe('BlogReviewSection', () => {
  it('결과 0~2건이면 콘텐츠 미렌더 (sentinel은 남음)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: mkPosts(2) } })
    const w = mount(BlogReviewSection, { props: { kind: 'facility' as const, primaryKey: 'parking', secondaryKey: '123' } })
    await flushPromises(); await nextTick()
    expect(w.find('[data-testid="blog-section"]').exists()).toBe(true)
    expect(w.find('h2').exists()).toBe(false)
    expect(w.findAll('[data-testid="blog-card"]')).toHaveLength(0)
  })

  it('3건 이상이면 카드 N개 (최대 5)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: mkPosts(8) } })
    const w = mount(BlogReviewSection, { props: { kind: 'facility' as const, primaryKey: 'parking', secondaryKey: '123' } })
    await flushPromises(); await nextTick()
    expect(w.findAll('[data-testid="blog-card"]')).toHaveLength(5)
    expect(w.find('h2').text()).toContain('방문자 후기')
  })

  it('kind=real-estate 경로 호출', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { posts: mkPosts(3) } })
    mount(BlogReviewSection, { props: { kind: 'real-estate' as const, primaryKey: 'apt-sale', secondaryKey: '서울특별시|종로구|롯데캐슬 골드' } })
    await flushPromises(); await nextTick()
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/api/real-estate/apt-sale/'))
  })
})
```

- [ ] **Step 2: Verify failure**

- [ ] **Step 3: Implement (always-rendered sentinel — IO bug fix learned from YouTube section)**

```vue
<template>
  <section
    ref="rootEl"
    data-testid="blog-section"
    :class="['min-h-[1px]', hasResults || loading ? 'mt-8' : '']"
  >
    <template v-if="hasResults || loading">
      <header class="mb-4 flex items-baseline justify-between">
        <h2 class="text-lg font-bold text-slate-900">방문자 후기</h2>
        <p class="text-xs text-slate-500">네이버 블로그 검색 · 자동 수집</p>
      </header>

      <div v-if="loading" class="flex flex-col gap-3">
        <div v-for="i in 5" :key="i" class="h-24 rounded-xl bg-slate-100 animate-pulse" />
      </div>

      <div v-else class="flex flex-col gap-3">
        <BlogReviewCard
          v-for="p in displayed"
          :key="p.url"
          :post="p"
          data-testid="blog-card"
        />
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useBlogReviews, type BlogReviewKind } from '~/composables/useBlogReviews'
import BlogReviewCard from './BlogReviewCard.vue'

const props = defineProps<{ kind: BlogReviewKind; primaryKey: string; secondaryKey: string }>()

const { posts, loading, fetchPosts } = useBlogReviews()
const rootEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const MIN_RESULTS = 3
const hasResults = computed(() => posts.value.length >= MIN_RESULTS)
const displayed = computed(() => posts.value.slice(0, 5))

onMounted(() => {
  if (typeof IntersectionObserver === 'undefined') {
    void fetchPosts(props.kind, props.primaryKey, props.secondaryKey)
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      void fetchPosts(props.kind, props.primaryKey, props.secondaryKey)
      observer?.disconnect()
      observer = null
    }
  }, { rootMargin: '200px' })
  if (rootEl.value) observer.observe(rootEl.value)
})

onBeforeUnmount(() => {
  observer?.disconnect()
})
</script>
```

- [ ] **Step 4: Verify pass (3/3)**

```bash
npx vitest run tests/components/blog/BlogReviewSection.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add frontend/components/blog/BlogReviewSection.vue frontend/tests/components/blog/BlogReviewSection.test.ts
git commit -m "feat(naver-blog): add BlogReviewSection container with sentinel + IO"
```

---

## Phase 5 — MSW + page integration

### Task 17: MSW handler

**Files:**
- Create: `frontend/mocks/handlers/naverBlog.ts`
- Modify: `frontend/mocks/browser.ts`

- [ ] **Step 1: Create handler**

```ts
// frontend/mocks/handlers/naverBlog.ts
import { http, HttpResponse } from 'msw'

function mkPosts(prefix: string) {
  return [
    { url: `https://blog.naver.com/${prefix}/1`, title: `${prefix} 후기 1`, description: '여기 진짜 깔끔하고 좋아요. 추천합니다. 다시 또 갈 의향 있습니다', bloggerName: '모킹A', bloggerLink: `https://blog.naver.com/${prefix}`, postDate: '20260301' },
    { url: `https://blog.naver.com/${prefix}/2`, title: `${prefix} 다녀온 후기`, description: '한 30분 정도 머물렀는데 잘 정비되어 있어서 만족스러웠어요', bloggerName: '모킹B', bloggerLink: `https://blog.naver.com/${prefix}`, postDate: '20260215' },
    { url: `https://blog.naver.com/${prefix}/3`, title: `이용해본 ${prefix}`, description: '직원이 친절했고 시설도 깨끗했습니다. 다음에 또 방문 예정이에요', bloggerName: '모킹C', bloggerLink: `https://blog.naver.com/${prefix}`, postDate: '20260120' },
  ]
}

export const naverBlogHandlers = [
  http.get('*/api/facilities/:category/:id/naver-blog', ({ params }) =>
    HttpResponse.json({ success: true, data: { posts: mkPosts(`facility-${String(params.id)}`) } }),
  ),
  http.get('*/api/real-estate/:type/:city/:district/:buildingName/naver-blog', ({ params }) =>
    HttpResponse.json({ success: true, data: { posts: mkPosts(`real-estate-${String(params.buildingName)}`) } }),
  ),
]
```

- [ ] **Step 2: Register handlers**

In `frontend/mocks/browser.ts`, add the import and spread into the handlers array — match the same pattern used for `facilityYoutubeHandlers`:

```ts
import { naverBlogHandlers } from './handlers/naverBlog'
// ... in setupWorker([...existing, ...naverBlogHandlers])
```

- [ ] **Step 3: Commit**

```bash
git add frontend/mocks/
git commit -m "feat(naver-blog): add MSW handlers for naver-blog endpoints"
```

---

### Task 18: Insert into facility detail page

**Files:** Modify `frontend/pages/[category]/[id].vue`

- [ ] **Step 1: Add import**

Near the existing `FacilityYoutubeSection` import, add:

```ts
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'
```

- [ ] **Step 2: Insert section in template**

Locate the `<FacilityYoutubeSection ... />` block. Immediately after it, insert:

```html
<!-- 네이버 블로그 후기 -->
<BlogReviewSection
  v-if="facility"
  kind="facility"
  :primary-key="facility.category"
  :secondary-key="facility.id"
/>
```

- [ ] **Step 3: Run frontend tests**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test
```

- [ ] **Step 4: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add 'frontend/pages/[category]/[id].vue'
git commit -m "feat(naver-blog): render BlogReviewSection in facility detail page"
```

---

### Task 19: Insert into real-estate building detail page

**Files:** Modify `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

- [ ] **Step 1: Read the page and identify a suitable insertion location**

Inspect the file first:

```bash
sed -n '1,60p' '/Users/leemyeongseok/projects/ilsangkit/frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'
```

Find the section that displays recent transactions or building info card, and insert BlogReviewSection AFTER it, BEFORE any ad banner / footer area. If unclear, place it at the bottom of the main content `<article>` or `<main>` block, before any sidebar/footer.

- [ ] **Step 2: Add import**

Add to `<script setup>`:

```ts
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'
```

- [ ] **Step 3: Insert section in template**

Identify the page's accessors for `realEstateType`, `city`, `district`, `buildingName` (typically from `useRoute().params`). Then add:

```html
<BlogReviewSection
  v-if="city && district && buildingName"
  kind="real-estate"
  :primary-key="(realEstateType as string)"
  :secondary-key="`${city}|${district}|${buildingName}`"
/>
```

(Use the same variable names the page already exposes — adapt the `v-if`/expressions to existing reactive refs.)

- [ ] **Step 4: Frontend tests still pass**

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test
```

- [ ] **Step 5: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add 'frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'
git commit -m "feat(naver-blog): render BlogReviewSection in real-estate building detail page"
```

---

### Task 20: Verify Material Symbols subset includes `open_in_new`

**Files:** Possibly modify `frontend/nuxt.config.ts`

- [ ] **Step 1: Check the icon_names subset**

```bash
grep -n "icon_names\|Material Symbols\|open_in_new" /Users/leemyeongseok/projects/ilsangkit/frontend/nuxt.config.ts | head -10
```

If `open_in_new` is missing from the subset list, add it. If subset is not enforced (full font loaded), skip.

- [ ] **Step 2: Commit if changed**

```bash
git add frontend/nuxt.config.ts
git commit -m "fix(naver-blog): add open_in_new to Material Symbols subset" || echo "no change"
```

---

## Phase 6 — Verification + PR

### Task 21: Full lint + test + build (backend + frontend)

- [ ] **Step 1: Backend**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npm run test && npm run build
```

- [ ] **Step 2: Frontend**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run lint && npm run test && npm run build
```

Both must exit 0. Fix any errors introduced by our changes; ignore pre-existing warnings on unrelated files.

- [ ] **Step 3: Commit fixes (if any)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add -A && git commit -m "chore: lint/build fixes for naver-blog" || echo "no changes"
```

---

### Task 22: Local browser smoke test

Before pushing, verify the IntersectionObserver actually fires in a real browser (the YouTube section's bug class).

- [ ] **Step 1: Start backend + frontend dev servers**

```bash
# terminal A
cd /Users/leemyeongseok/projects/ilsangkit/backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run dev
# terminal B
cd /Users/leemyeongseok/projects/ilsangkit/frontend && source ~/.nvm/nvm.sh && nvm use 20 && NUXT_PUBLIC_DISABLE_MSW=true npm run dev
```

- [ ] **Step 2: Pick a facility id**

```bash
docker compose exec mysql mysql -uilsangkit -pilsangkit123 ilsangkit \
  -e "SELECT id, name, city, district FROM Parking LIMIT 3;"
```

- [ ] **Step 3: Visit the page**

In a browser open `http://localhost:3000/parking/<id>` and scroll to the bottom past the YouTube section. The "방문자 후기" section should either show 3-5 cards or remain invisible (sentinel-only) if results are insufficient.

- [ ] **Step 4: Verify network**

DevTools → Network → filter `naver-blog` → ensure the request appears as status 200. Verify the response `data.posts` shape.

- [ ] **Step 5: Verify cache + DB**

```bash
docker compose exec mysql mysql -uilsangkit -pilsangkit123 ilsangkit \
  -e "SELECT category, facilityId, itemCount, fetchedAt FROM FacilityNaverBlogCache ORDER BY fetchedAt DESC LIMIT 5;"
```

Should show the row just written.

- [ ] **Step 6: Visit a real-estate building page and repeat**

Similar verification on `/real-estate/{type}/{city}/{district}/{buildingName}` — find a valid URL from `RealEstateNaverBlogCache` table after first visit.

Stop both dev servers when done.

---

### Task 23: Push branch + open PR

- [ ] **Step 1: Push**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin feat/naver-blog-reviews
```

- [ ] **Step 2: Open PR**

```bash
gh pr create \
  --base develop \
  --head feat/naver-blog-reviews \
  --title "feat(naver-blog): 시설·부동산 단지 상세에 네이버 블로그 후기 섹션" \
  --body "$(cat <<'EOF'
## 변경 사항
- `/[category]/[id]` 시설 상세 + `/real-estate/{type}/{city}/{district}/{buildingName}` 부동산 단지 상세에 네이버 블로그 후기 카드 5개 섹션 추가
- 카테고리·realEstateType별 검색 쿼리 빌더, 14일 DB 캐시, 일일 quota 5,000회 가드, in-flight dedup, SSR cache-only 모드
- 적극적 광고/협찬 키워드 필터 + 3년 초과 글 제외 + description 30자 미만 제외
- 결과 < 3건이면 섹션 자동 숨김 (negative caching)
- 카드 클릭 시 새 탭으로 네이버 블로그 원문 이동 (`rel="nofollow noopener noreferrer"`)
- IntersectionObserver lazy fetch + always-rendered sentinel (YouTube fix 동일 패턴)
- Review/Article schema는 출력하지 않음 (외부 콘텐츠 — Helpful Content 리스크 회피)

## 환경
- `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET` 운영 환경변수 이미 설정됨

## 스펙 & 플랜
- 스펙: `docs/superpowers/specs/2026-05-15-naver-blog-reviews-design.md`
- 플랜: `docs/superpowers/plans/2026-05-15-naver-blog-reviews.md`

## 테스트
- backend: lint clean, ~1117 tests pass, build OK
- frontend: lint clean, ~899 tests pass, build OK
- 로컬 브라우저 smoke test로 IO 발화 + API 호출 + 캐시 누적 확인
EOF
)"
```

---

## Spec Coverage Check

| Spec section | Tasks |
|---|---|
| 1 적용 범위 & UX | T18 (facility insertion), T19 (real-estate insertion) |
| 1 모달 없음, 새 탭 이동 | T15 |
| 1 결과 < 3건 시 섹션 숨김 | T7, T8 (negative caching), T16 (component v-if) |
| 2 카테고리별 쿼리 빌더 (facility) | T3 |
| 2 realEstateType별 쿼리 빌더 | T4 |
| 2 결과 필터링 (광고/도메인/연식/길이) | T5 |
| 2 API 응답 매핑 + stripHtml | T3 (stripHtml), T6 (fetch+map) |
| 2 NAVER_BLOG_MIN_RESULTS = 3 | T5 |
| 3 환경변수 사용 | T2 (quota), T7/T8 (cache fetch) |
| 3 Prisma 두 모델 | T1 |
| 3 14일 TTL | T7, T8 |
| 3 라우트 두 개 | T10, T11 |
| 3 Quota guard 5000/day | T2 |
| 3 in-flight dedup | T7, T8 |
| 3 SSR cache-only (?ssr=1) | T7, T8, T10, T11 |
| 4 컴포넌트 구조 (Card + Section) | T15, T16 |
| 4 Composable (kind 분기) | T14 |
| 4 sentinel + IntersectionObserver | T16 |
| 4 schema 없음 | (의도적으로 task 없음) |
| 4 Material Symbols `open_in_new` | T20 |
| 5 백엔드 5종 테스트 | T2, T3-T6, T7-T8, T10, T11 |
| 5 프론트 3종 테스트 | T14, T15, T16 |
| 5 MSW | T17 |
| 5 수동 smoke test | T22 |

No spec section uncovered.
