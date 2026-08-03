# Facility Detail — YouTube Videos Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "related YouTube videos" section to facility detail pages (`/[category]/[id]`) that searches YouTube by facility name + region, caches results for 30 days, and renders 6 video cards with in-modal embed playback.

**Architecture:** Express backend exposes `GET /api/facilities/:category/:id/youtube`. The route consults `FacilityYoutubeCache` (Prisma); on miss, a quota guard permits a `search.list` call to YouTube Data API v3, the result is filtered, persisted, and returned. The Nuxt frontend renders a lazy section (IntersectionObserver-triggered fetch) with 6 thumbnail cards; clicking a card opens an in-site modal that mounts a `youtube-nocookie.com` iframe. When SSR finds a cache hit, it emits VideoObject JSON-LD for rich-result eligibility.

**Tech Stack:** Express 5 + TypeScript (ESM, `.js` extensions), Prisma + MySQL 8, Zod, Vitest, MSW, Nuxt 3 + Vue 3 + Tailwind, IntersectionObserver, YouTube Data API v3.

**Spec:** `docs/superpowers/specs/2026-05-15-facility-detail-youtube-design.md`

**Project conventions to honor:**
- Node 20 (`nvm use 20` before any `npm` work — see project memory)
- All backend ESM imports use `.js` extension
- Routes use `asyncHandler()` wrapper + `validate()` middleware
- Errors via classes from `src/lib/errors.ts`
- Composables return `readonly()` refs
- Frontend `$fetch` + `useRuntimeConfig().public.apiBase`
- TDD: write failing test first; mark commits per task
- All work on a feature branch; PR-based merge (never push to `main`)

---

## File Structure

### Backend (create unless noted)
- `backend/src/services/youtubeQuotaService.ts` — in-process daily counter
- `backend/src/services/youtubeService.ts` — query builder, filter, YouTube API fetch
- `backend/src/services/youtubeCacheService.ts` — DB cache + in-flight dedup
- `backend/src/schemas/youtube.ts` — Zod params schema
- `backend/src/routes/facilityYoutube.ts` — `GET /api/facilities/:category/:id/youtube`
- `backend/src/app.ts` — **modify**: mount the new router
- `backend/prisma/schema.prisma` — **modify**: add `FacilityYoutubeCache` model
- `backend/.env.example` — **modify**: add `YOUTUBE_API_KEY=` placeholder

### Backend tests
- `backend/__tests__/services/youtubeQuotaService.test.ts`
- `backend/__tests__/services/youtubeService.test.ts`
- `backend/__tests__/services/youtubeCacheService.test.ts`
- `backend/__tests__/routes/facilityYoutube.test.ts`

### Frontend (create unless noted)
- `frontend/composables/useFacilityYoutube.ts`
- `frontend/types/youtube.ts` — `YoutubeVideo` interface
- `frontend/components/facility/youtube/YoutubeVideoCard.vue`
- `frontend/components/facility/youtube/YoutubeEmbedModal.vue`
- `frontend/components/facility/youtube/FacilityYoutubeSection.vue`
- `frontend/mocks/handlers/facilityYoutube.ts`
- `frontend/mocks/handlers/index.ts` — **modify**: register handler (if barrel exists; otherwise wherever `facilities.ts` handler is registered)
- `frontend/pages/[category]/[id].vue` — **modify**: insert `<FacilityYoutubeSection>` after `DetailNearby`
- `frontend/composables/useStructuredData.ts` — **modify**: add `setVideoListSchema()` helper

### Frontend tests
- `frontend/tests/composables/useFacilityYoutube.test.ts`
- `frontend/tests/components/facility/youtube/YoutubeVideoCard.test.ts`
- `frontend/tests/components/facility/youtube/YoutubeEmbedModal.test.ts`
- `frontend/tests/components/facility/youtube/FacilityYoutubeSection.test.ts`

---

## Phase 0 — Branch + environment

### Task 0: Create feature branch and verify Node version

- [ ] **Step 1: Switch to Node 20 and create branch**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
nvm use 20
git checkout develop
git pull origin develop
git checkout -b feat/facility-youtube-section
```

Expected: `Now using node v20.x.x`, branch created.

- [ ] **Step 2: Verify Node and clean state**

```bash
node -v
git status
```

Expected: `v20.*`, working tree clean apart from untracked `.superpowers/`.

---

### Task 1: Add `YOUTUBE_API_KEY` env wiring

**Files:**
- Modify: `backend/.env.example`
- Modify: `backend/.env` (locally only, NOT committed — gitignored)

- [ ] **Step 1: Append placeholder to `.env.example`**

Edit `backend/.env.example` and add at the end:

```
# YouTube Data API v3 key (server-side; do not expose to frontend)
YOUTUBE_API_KEY=
```

- [ ] **Step 2: Add the real key to local `.env`**

Add `YOUTUBE_API_KEY=<user-supplied-key>` to `backend/.env`. Confirm `.env` is gitignored:

```bash
grep -E '^\.env$|^backend/\.env$' backend/.gitignore .gitignore 2>/dev/null
git check-ignore -v backend/.env
```

Expected: `git check-ignore` returns a `.gitignore` match (path is ignored).

- [ ] **Step 3: Commit the example placeholder**

```bash
git add backend/.env.example
git commit -m "feat(youtube): add YOUTUBE_API_KEY placeholder to .env.example"
```

---

## Phase 1 — Prisma schema

### Task 2: Add `FacilityYoutubeCache` model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Append the model at the end of the schema**

```prisma
// 시설 상세 페이지 YouTube 검색 결과 캐시 (30일 TTL, negative caching 포함)
model FacilityYoutubeCache {
  id         Int      @id @default(autoincrement())
  category   String   @db.VarChar(20)
  facilityId String   @db.VarChar(100)
  query      String   @db.VarChar(300)
  videos     Json
  itemCount  Int      @default(0)
  fetchedAt  DateTime @default(now())
  expiresAt  DateTime

  @@unique([category, facilityId])
  @@index([expiresAt])
}
```

- [ ] **Step 2: Push the schema to the local DB and regenerate the client**

Ensure docker compose is up (`docker compose up -d` from repo root if needed), then:

```bash
cd backend
nvm use 20
npm run db:push
npm run db:generate
```

Expected: Prisma reports `FacilityYoutubeCache` created, client regenerates without error.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(youtube): add FacilityYoutubeCache model"
```

---

## Phase 2 — Backend services (TDD)

### Task 3: `youtubeQuotaService` — daily counter

**Files:**
- Create: `backend/src/services/youtubeQuotaService.ts`
- Test: `backend/__tests__/services/youtubeQuotaService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/services/youtubeQuotaService.test.ts`:

```ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createYoutubeQuotaCounter } from '../../src/services/youtubeQuotaService.js';

describe('youtubeQuotaService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-15T09:00:00+09:00'));
  });

  it('첫 호출은 허용되고 used가 1 증가한다', () => {
    const counter = createYoutubeQuotaCounter({ dailyLimit: 90 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.used()).toBe(1);
  });

  it('한도에 도달하면 false를 반환한다', () => {
    const counter = createYoutubeQuotaCounter({ dailyLimit: 2 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(false);
    expect(counter.used()).toBe(2);
  });

  it('KST 자정이 지나면 카운터가 리셋된다', () => {
    const counter = createYoutubeQuotaCounter({ dailyLimit: 1 });
    expect(counter.tryConsume()).toBe(true);
    expect(counter.tryConsume()).toBe(false);

    vi.setSystemTime(new Date('2026-05-16T00:00:01+09:00'));
    expect(counter.tryConsume()).toBe(true);
    expect(counter.used()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd backend && nvm use 20 && npx vitest run __tests__/services/youtubeQuotaService.test.ts
```

Expected: FAIL — `Cannot find module '../../src/services/youtubeQuotaService.js'`.

- [ ] **Step 3: Implement the service**

Create `backend/src/services/youtubeQuotaService.ts`:

```ts
/**
 * 인메모리 일일 quota 카운터. KST(UTC+9) 자정 기준 리셋.
 * 추후 Redis로 옮길 수 있도록 인터페이스 형태로 노출.
 */

export interface YoutubeQuotaCounter {
  tryConsume(): boolean;
  used(): number;
}

interface Options {
  dailyLimit: number;
}

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

function kstDateKey(now: Date): string {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return kst.toISOString().slice(0, 10);
}

export function createYoutubeQuotaCounter({ dailyLimit }: Options): YoutubeQuotaCounter {
  let currentKey = kstDateKey(new Date());
  let usedCount = 0;

  function rollOverIfNeeded(): void {
    const key = kstDateKey(new Date());
    if (key !== currentKey) {
      currentKey = key;
      usedCount = 0;
    }
  }

  return {
    tryConsume() {
      rollOverIfNeeded();
      if (usedCount >= dailyLimit) return false;
      usedCount += 1;
      return true;
    },
    used() {
      rollOverIfNeeded();
      return usedCount;
    },
  };
}

// 모듈 싱글톤. YouTube Data API search.list = 100 units, 일일 무료 10,000 units → 90회로 제한 (여유 10회).
export const youtubeQuotaCounter = createYoutubeQuotaCounter({ dailyLimit: 90 });
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/services/youtubeQuotaService.test.ts
```

Expected: PASS, 3/3.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/youtubeQuotaService.ts backend/__tests__/services/youtubeQuotaService.test.ts
git commit -m "feat(youtube): add daily quota counter with KST midnight rollover"
```

---

### Task 4: `youtubeService.buildYoutubeQuery()` — query builder

**Files:**
- Create: `backend/src/services/youtubeService.ts`
- Test: `backend/__tests__/services/youtubeService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/services/youtubeService.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildYoutubeQuery } from '../../src/services/youtubeService.js';

describe('buildYoutubeQuery', () => {
  const base = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('parking: name + district + "주차장"', () => {
    expect(buildYoutubeQuery({ ...base }, 'parking')).toBe('종로주차장 종로구 주차장');
  });

  it('toilet: name + "공중화장실" + district', () => {
    expect(buildYoutubeQuery({ name: '광화문역', city: '서울특별시', district: '종로구' }, 'toilet'))
      .toBe('광화문역 공중화장실 종로구');
  });

  it('park: name + city (short)', () => {
    expect(buildYoutubeQuery({ name: '남산공원', city: '서울특별시', district: '중구' }, 'park'))
      .toBe('남산공원 서울');
  });

  it('library: name + district', () => {
    expect(buildYoutubeQuery({ name: '종로도서관', city: '서울특별시', district: '종로구' }, 'library'))
      .toBe('종로도서관 종로구');
  });

  it('hospital: name + district', () => {
    expect(buildYoutubeQuery({ name: '서울대병원', city: '서울특별시', district: '종로구' }, 'hospital'))
      .toBe('서울대병원 종로구');
  });

  it('ev-charger: name + "전기차 충전소"', () => {
    expect(buildYoutubeQuery({ name: '이마트 종로점', city: '서울특별시', district: '종로구' }, 'ev-charger'))
      .toBe('이마트 종로점 전기차 충전소');
  });

  it('pharmacy: name + district + "약국"', () => {
    expect(buildYoutubeQuery({ name: '종로약국', city: '서울특별시', district: '종로구' }, 'pharmacy'))
      .toBe('종로약국 종로구 약국');
  });

  it('school/market/sports: name + district', () => {
    expect(buildYoutubeQuery({ name: '경복초등학교', city: '서울특별시', district: '종로구' }, 'school'))
      .toBe('경복초등학교 종로구');
    expect(buildYoutubeQuery({ name: '광장시장', city: '서울특별시', district: '종로구' }, 'market'))
      .toBe('광장시장 종로구');
    expect(buildYoutubeQuery({ name: '종로체육관', city: '서울특별시', district: '종로구' }, 'sports'))
      .toBe('종로체육관 종로구');
  });

  it('childcare: name + district + "어린이집"', () => {
    expect(buildYoutubeQuery({ name: '해님', city: '서울특별시', district: '종로구' }, 'childcare'))
      .toBe('해님 종로구 어린이집');
  });

  it('aed: name + "AED" + district', () => {
    expect(buildYoutubeQuery({ name: '시청', city: '서울특별시', district: '중구' }, 'aed'))
      .toBe('시청 AED 중구');
  });

  it('district 누락 시 city short로 폴백', () => {
    expect(buildYoutubeQuery({ name: '광장시장', city: '서울특별시', district: '' }, 'market'))
      .toBe('광장시장 서울');
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run __tests__/services/youtubeService.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement query builder**

Create `backend/src/services/youtubeService.ts`:

```ts
import type { FacilityCategory } from './categoryRegistry.js';

export interface FacilityQueryInput {
  name: string;
  city: string;
  district: string;
}

const CITY_SHORT: Record<string, string> = {
  '서울특별시': '서울',
  '부산광역시': '부산',
  '대구광역시': '대구',
  '인천광역시': '인천',
  '광주광역시': '광주',
  '대전광역시': '대전',
  '울산광역시': '울산',
  '세종특별자치시': '세종',
  '제주특별자치도': '제주',
};

function cityShort(city: string): string {
  return CITY_SHORT[city] ?? city.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '');
}

function regionToken(input: FacilityQueryInput): string {
  return input.district?.trim() || cityShort(input.city);
}

export function buildYoutubeQuery(input: FacilityQueryInput, category: FacilityCategory): string {
  const region = regionToken(input);
  const name = input.name.trim();

  switch (category) {
    case 'parking':
      return `${name} ${region} 주차장`;
    case 'toilet':
      return `${name} 공중화장실 ${region}`;
    case 'park':
      return `${name} ${cityShort(input.city)}`;
    case 'pharmacy':
      return `${name} ${region} 약국`;
    case 'ev-charger':
      return `${name} 전기차 충전소`;
    case 'childcare':
      return `${name} ${region} 어린이집`;
    case 'aed':
      return `${name} AED ${region}`;
    case 'library':
    case 'hospital':
    case 'school':
    case 'market':
    case 'sports':
    case 'wifi':
    case 'clothes':
    case 'subway':
      return `${name} ${region}`;
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/services/youtubeService.test.ts
```

Expected: PASS for all 11 cases.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/youtubeService.ts backend/__tests__/services/youtubeService.test.ts
git commit -m "feat(youtube): add per-category query builder"
```

---

### Task 5: `youtubeService.filterVideos()` — blacklist & min count

**Files:**
- Modify: `backend/src/services/youtubeService.ts`
- Modify: `backend/__tests__/services/youtubeService.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `backend/__tests__/services/youtubeService.test.ts`:

```ts
import { filterVideos, type RawYoutubeVideo } from '../../src/services/youtubeService.js';

function mkVideo(overrides: Partial<RawYoutubeVideo> = {}): RawYoutubeVideo {
  return {
    videoId: 'v1',
    title: '제목',
    channelTitle: '채널',
    thumbnail: 'https://i.ytimg.com/vi/v1/mqdefault.jpg',
    publishedAt: '2026-05-01T00:00:00Z',
    duration: 'PT5M',
    ...overrides,
  };
}

describe('filterVideos', () => {
  it('제목에 광고 키워드가 포함되면 제외한다', () => {
    const out = filterVideos([
      mkVideo({ videoId: 'a', title: '[광고] 종로주차장' }),
      mkVideo({ videoId: 'b', title: '종로주차장 솔직 후기' }),
    ]);
    expect(out.map((v) => v.videoId)).toEqual(['b']);
  });

  it('채널이 차단 리스트에 있으면 제외한다', () => {
    const out = filterVideos([
      mkVideo({ videoId: 'a', channelTitle: 'BLOCKED_CHANNEL_FIXTURE' }),
      mkVideo({ videoId: 'b' }),
    ], { blockedChannels: ['BLOCKED_CHANNEL_FIXTURE'] });
    expect(out.map((v) => v.videoId)).toEqual(['b']);
  });

  it('상위 6개로 잘라낸다', () => {
    const inputs = Array.from({ length: 10 }, (_, i) => mkVideo({ videoId: `v${i}` }));
    expect(filterVideos(inputs)).toHaveLength(6);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run __tests__/services/youtubeService.test.ts
```

Expected: FAIL — `filterVideos`/`RawYoutubeVideo` not exported.

- [ ] **Step 3: Add filter implementation**

Append to `backend/src/services/youtubeService.ts`:

```ts
export interface RawYoutubeVideo {
  videoId: string;
  title: string;
  channelTitle: string;
  thumbnail: string;
  publishedAt: string;
  duration: string;
}

const AD_KEYWORDS = ['[광고]', '광고', '협찬', 'AD', '#광고', '#협찬'];
const DEFAULT_BLOCKED_CHANNELS: string[] = [];
const MAX_VIDEOS = 6;

interface FilterOptions {
  blockedChannels?: string[];
  adKeywords?: string[];
}

export function filterVideos(videos: RawYoutubeVideo[], opts: FilterOptions = {}): RawYoutubeVideo[] {
  const blocked = opts.blockedChannels ?? DEFAULT_BLOCKED_CHANNELS;
  const ad = opts.adKeywords ?? AD_KEYWORDS;
  return videos
    .filter((v) => !ad.some((kw) => v.title.includes(kw)))
    .filter((v) => !blocked.includes(v.channelTitle))
    .slice(0, MAX_VIDEOS);
}

export const YOUTUBE_MIN_RESULTS = 2;
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/services/youtubeService.test.ts
```

Expected: PASS — 14 total.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/youtubeService.ts backend/__tests__/services/youtubeService.test.ts
git commit -m "feat(youtube): add video filter (ad keywords, blocked channels, top 6)"
```

---

### Task 6: `youtubeService.fetchFromYoutube()` — API call

**Files:**
- Modify: `backend/src/services/youtubeService.ts`
- Modify: `backend/__tests__/services/youtubeService.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `backend/__tests__/services/youtubeService.test.ts`:

```ts
import { fetchFromYoutube } from '../../src/services/youtubeService.js';

describe('fetchFromYoutube', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = originalFetch; });

  it('정상 응답을 RawYoutubeVideo 배열로 매핑한다', async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({
      items: [{
        id: { kind: 'youtube#video', videoId: 'abc' },
        snippet: {
          title: '제목',
          channelTitle: '채널',
          publishedAt: '2026-05-01T00:00:00Z',
          thumbnails: { medium: { url: 'https://i.ytimg.com/vi/abc/mqdefault.jpg' } },
        },
      }],
    }), { status: 200 })) as unknown as typeof fetch;

    const out = await fetchFromYoutube('test query', 'KEY');
    expect(out).toEqual([{
      videoId: 'abc',
      title: '제목',
      channelTitle: '채널',
      thumbnail: 'https://i.ytimg.com/vi/abc/mqdefault.jpg',
      publishedAt: '2026-05-01T00:00:00Z',
      duration: '',
    }]);
  });

  it('4xx 응답이면 빈 배열을 반환한다', async () => {
    globalThis.fetch = vi.fn(async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    expect(await fetchFromYoutube('q', 'KEY')).toEqual([]);
  });

  it('네트워크 에러면 빈 배열을 반환한다', async () => {
    globalThis.fetch = vi.fn(async () => { throw new Error('boom'); }) as unknown as typeof fetch;
    expect(await fetchFromYoutube('q', 'KEY')).toEqual([]);
  });

  it('API key 미설정이면 호출을 건너뛰고 빈 배열을 반환한다', async () => {
    const fetchSpy = vi.fn();
    globalThis.fetch = fetchSpy as unknown as typeof fetch;
    expect(await fetchFromYoutube('q', '')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
```

Also add to imports at top of the test file:

```ts
import { afterEach, vi } from 'vitest';
```

(if `vi`/`afterEach` not already imported)

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run __tests__/services/youtubeService.test.ts
```

Expected: FAIL — `fetchFromYoutube` not exported.

- [ ] **Step 3: Implement `fetchFromYoutube`**

Append to `backend/src/services/youtubeService.ts`:

```ts
interface YoutubeApiSnippet {
  title: string;
  channelTitle: string;
  publishedAt: string;
  thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
}

interface YoutubeApiItem {
  id: { kind?: string; videoId?: string };
  snippet: YoutubeApiSnippet;
}

interface YoutubeApiResponse {
  items?: YoutubeApiItem[];
}

const YOUTUBE_SEARCH_URL = 'https://www.googleapis.com/youtube/v3/search';

export async function fetchFromYoutube(query: string, apiKey: string): Promise<RawYoutubeVideo[]> {
  if (!apiKey) return [];

  const params = new URLSearchParams({
    key: apiKey,
    q: query,
    part: 'snippet',
    type: 'video',
    maxResults: '10',
    relevanceLanguage: 'ko',
    regionCode: 'KR',
    safeSearch: 'moderate',
    videoEmbeddable: 'true',
    order: 'relevance',
  });

  try {
    const res = await fetch(`${YOUTUBE_SEARCH_URL}?${params.toString()}`);
    if (!res.ok) return [];
    const json = (await res.json()) as YoutubeApiResponse;
    return (json.items ?? [])
      .filter((it) => it.id?.videoId)
      .map<RawYoutubeVideo>((it) => ({
        videoId: it.id.videoId!,
        title: it.snippet.title,
        channelTitle: it.snippet.channelTitle,
        thumbnail: it.snippet.thumbnails?.medium?.url ?? it.snippet.thumbnails?.default?.url ?? '',
        publishedAt: it.snippet.publishedAt,
        duration: '',
      }));
  } catch {
    return [];
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/services/youtubeService.test.ts
```

Expected: PASS — 18 total.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/youtubeService.ts backend/__tests__/services/youtubeService.test.ts
git commit -m "feat(youtube): add YouTube Data API search.list client"
```

---

### Task 7: `youtubeCacheService.getOrFetch()` — DB cache + in-flight dedup

**Files:**
- Create: `backend/src/services/youtubeCacheService.ts`
- Test: `backend/__tests__/services/youtubeCacheService.test.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/__tests__/services/youtubeCacheService.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFindUnique, mockUpsert, mockQuotaTry, mockFetchYoutube } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
  mockUpsert: vi.fn(),
  mockQuotaTry: vi.fn(),
  mockFetchYoutube: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    facilityYoutubeCache: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  };
  return { default: prismaClient, prisma: prismaClient };
});

vi.mock('../../src/services/youtubeQuotaService.js', () => ({
  youtubeQuotaCounter: { tryConsume: mockQuotaTry, used: () => 0 },
}));

vi.mock('../../src/services/youtubeService.js', async () => {
  const actual = await vi.importActual<typeof import('../../src/services/youtubeService.js')>(
    '../../src/services/youtubeService.js',
  );
  return { ...actual, fetchFromYoutube: mockFetchYoutube };
});

import { getOrFetchYoutubeVideos } from '../../src/services/youtubeCacheService.js';

describe('getOrFetchYoutubeVideos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.YOUTUBE_API_KEY = 'KEY';
  });

  const facility = { name: '종로주차장', city: '서울특별시', district: '종로구' };

  it('캐시 히트: API 호출 없이 캐시된 영상을 반환', async () => {
    mockFindUnique.mockResolvedValueOnce({
      videos: [{ videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }],
      itemCount: 1,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toHaveLength(1);
    expect(mockFetchYoutube).not.toHaveBeenCalled();
  });

  it('캐시 미스 + quota 여유: API 호출 후 upsert 저장', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchYoutube.mockResolvedValueOnce([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
      { videoId: 'b', title: 't2', channelTitle: 'c2', thumbnail: '', publishedAt: '', duration: '' },
    ]);

    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toHaveLength(2);
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  it('캐시 미스 + quota 소진: 빈 배열 반환, upsert 호출 안 함', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(false);
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockFetchYoutube).not.toHaveBeenCalled();
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it('만료된 캐시는 미스로 처리한다', async () => {
    mockFindUnique.mockResolvedValueOnce({
      videos: [{ videoId: 'old', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }],
      itemCount: 1,
      expiresAt: new Date(Date.now() - 1000),
    });
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchYoutube.mockResolvedValueOnce([
      { videoId: 'new', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
      { videoId: 'new2', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
    ]);
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out.map((v) => v.videoId)).toEqual(['new', 'new2']);
  });

  it('결과 < 최소건수: itemCount=0으로 negative caching, 빈 배열 반환', async () => {
    mockFindUnique.mockResolvedValueOnce(null);
    mockQuotaTry.mockReturnValueOnce(true);
    mockFetchYoutube.mockResolvedValueOnce([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
    ]);
    const out = await getOrFetchYoutubeVideos('parking', '123', facility);
    expect(out).toEqual([]);
    expect(mockUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ itemCount: 0, videos: [] }),
    }));
  });

  it('동시 호출은 단 한 번만 fetch한다 (in-flight dedup)', async () => {
    mockFindUnique.mockResolvedValue(null);
    mockQuotaTry.mockReturnValue(true);
    let resolveFetch!: (v: unknown) => void;
    mockFetchYoutube.mockImplementationOnce(() => new Promise((r) => { resolveFetch = r; }));

    const [p1, p2] = [
      getOrFetchYoutubeVideos('parking', 'dup', facility),
      getOrFetchYoutubeVideos('parking', 'dup', facility),
    ];
    resolveFetch([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
      { videoId: 'b', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' },
    ]);
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual(r2);
    expect(mockFetchYoutube).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run __tests__/services/youtubeCacheService.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the cache service**

Create `backend/src/services/youtubeCacheService.ts`:

```ts
import { prisma } from '../lib/prisma.js';
import type { FacilityCategory } from './categoryRegistry.js';
import {
  buildYoutubeQuery,
  fetchFromYoutube,
  filterVideos,
  YOUTUBE_MIN_RESULTS,
  type FacilityQueryInput,
  type RawYoutubeVideo,
} from './youtubeService.js';
import { youtubeQuotaCounter } from './youtubeQuotaService.js';

const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const inFlight = new Map<string, Promise<RawYoutubeVideo[]>>();

function cacheKey(category: string, facilityId: string): string {
  return `${category}:${facilityId}`;
}

export async function getOrFetchYoutubeVideos(
  category: FacilityCategory,
  facilityId: string,
  facility: FacilityQueryInput,
): Promise<RawYoutubeVideo[]> {
  const hit = await prisma.facilityYoutubeCache.findUnique({
    where: { category_facilityId: { category, facilityId } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.videos as unknown as RawYoutubeVideo[]) ?? [];
  }

  const key = cacheKey(category, facilityId);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const job = (async (): Promise<RawYoutubeVideo[]> => {
    try {
      if (!youtubeQuotaCounter.tryConsume()) {
        return [];
      }
      const query = buildYoutubeQuery(facility, category);
      const apiKey = process.env.YOUTUBE_API_KEY ?? '';
      const raw = await fetchFromYoutube(query, apiKey);
      const filtered = filterVideos(raw);
      const isUseful = filtered.length >= YOUTUBE_MIN_RESULTS;
      const videos: RawYoutubeVideo[] = isUseful ? filtered : [];
      const itemCount = videos.length;
      const expiresAt = new Date(Date.now() + TTL_MS);

      await prisma.facilityYoutubeCache.upsert({
        where: { category_facilityId: { category, facilityId } },
        create: { category, facilityId, query, videos: videos as unknown as object, itemCount, expiresAt },
        update: { query, videos: videos as unknown as object, itemCount, expiresAt, fetchedAt: new Date() },
      });

      return videos;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, job);
  return job;
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run __tests__/services/youtubeCacheService.test.ts
```

Expected: PASS — 6/6.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/youtubeCacheService.ts backend/__tests__/services/youtubeCacheService.test.ts
git commit -m "feat(youtube): add cache service with negative caching and in-flight dedup"
```

---

### Task 8: Route `GET /api/facilities/:category/:id/youtube`

**Files:**
- Create: `backend/src/schemas/youtube.ts`
- Create: `backend/src/routes/facilityYoutube.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/__tests__/routes/facilityYoutube.test.ts`

- [ ] **Step 1: Write failing route tests**

Create `backend/__tests__/routes/facilityYoutube.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetOrFetch, mockFindParking } = vi.hoisted(() => ({
  mockGetOrFetch: vi.fn(),
  mockFindParking: vi.fn(),
}));

vi.mock('../../src/services/youtubeCacheService.js', () => ({
  getOrFetchYoutubeVideos: mockGetOrFetch,
}));

vi.mock('../../src/lib/prisma.js', () => {
  const prismaClient = {
    parking: { findUnique: mockFindParking },
  };
  return { default: prismaClient, prisma: prismaClient };
});

import { createApp } from '../../src/app.js';

describe('GET /api/facilities/:category/:id/youtube', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('정상: { success: true, data: { videos } } 형태로 응답', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetOrFetch.mockResolvedValueOnce([
      { videoId: 'a', title: 't', channelTitle: 'c', thumbnail: 'thumb', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
    ]);

    const app = createApp();
    const res = await request(app).get('/api/facilities/parking/123/youtube');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { videos: [expect.objectContaining({ videoId: 'a' })] } });
  });

  it('시설이 없으면 404', async () => {
    mockFindParking.mockResolvedValueOnce(null);
    const app = createApp();
    const res = await request(app).get('/api/facilities/parking/missing/youtube');
    expect(res.status).toBe(404);
  });

  it('잘못된 category는 422', async () => {
    const app = createApp();
    const res = await request(app).get('/api/facilities/INVALID/1/youtube');
    expect(res.status).toBe(422);
  });

  it('영상이 없으면 빈 배열로 정상 응답', async () => {
    mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
    mockGetOrFetch.mockResolvedValueOnce([]);
    const app = createApp();
    const res = await request(app).get('/api/facilities/parking/123/youtube');
    expect(res.status).toBe(200);
    expect(res.body.data.videos).toEqual([]);
  });
});
```

If `createApp` doesn't yet exist as a named export, check `backend/src/app.ts` first. If only a default export exists, replace `import { createApp }` with the matching name. The route file mounting must be additive.

- [ ] **Step 2: Run tests — expect failure**

```bash
npx vitest run __tests__/routes/facilityYoutube.test.ts
```

Expected: FAIL — schema/route not found.

- [ ] **Step 3: Add the params schema**

Create `backend/src/schemas/youtube.ts`:

```ts
import { z } from 'zod';
import { FacilityCategorySchema } from './facility.js';

export const FacilityYoutubeParamsSchema = z.object({
  category: FacilityCategorySchema,
  id: z.string().min(1).max(100),
});

export type FacilityYoutubeParams = z.infer<typeof FacilityYoutubeParamsSchema>;
```

- [ ] **Step 4: Add the route**

Create `backend/src/routes/facilityYoutube.ts`:

```ts
import { Router, Request, Response } from 'express';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { NotFoundError } from '../lib/errors.js';
import { FacilityYoutubeParamsSchema } from '../schemas/youtube.js';
import { CATEGORY_REGISTRY, type FacilityCategory } from '../services/categoryRegistry.js';
import { getOrFetchYoutubeVideos } from '../services/youtubeCacheService.js';

const router = Router();

router.get(
  '/:category/:id/youtube',
  validate(FacilityYoutubeParamsSchema, 'params'),
  asyncHandler(async (req: Request, res: Response) => {
    const { category, id } = req.params as { category: FacilityCategory; id: string };

    const model = CATEGORY_REGISTRY[category].model();
    const facility = await model.findUnique({
      where: { id },
      select: { id: true, name: true, city: true, district: true },
    });
    if (!facility) {
      throw new NotFoundError('Facility not found');
    }

    const videos = await getOrFetchYoutubeVideos(category, id, {
      name: facility.name,
      city: facility.city,
      district: facility.district,
    });

    res.json({ success: true, data: { videos } });
  }),
);

export default router;
```

- [ ] **Step 5: Mount the router**

Open `backend/src/app.ts`, locate the existing `app.use('/api/facilities', ...)` line, and add:

```ts
import facilityYoutubeRouter from './routes/facilityYoutube.js';
// ...
app.use('/api/facilities', facilityYoutubeRouter);
```

Mount it AFTER the existing `facilitiesRouter` so its `/search`, `/region/...` routes still match. Both share `/api/facilities` prefix but use different path suffixes — Express tries each router in order, so the order matters only for catch-all patterns. The new router only handles `/:category/:id/youtube`.

- [ ] **Step 6: Run tests — expect pass**

```bash
npx vitest run __tests__/routes/facilityYoutube.test.ts
```

Expected: PASS — 4/4.

- [ ] **Step 7: Commit**

```bash
git add backend/src/schemas/youtube.ts backend/src/routes/facilityYoutube.ts backend/src/app.ts backend/__tests__/routes/facilityYoutube.test.ts
git commit -m "feat(youtube): add GET /api/facilities/:category/:id/youtube route"
```

---

### Task 9: Run full backend test suite

- [ ] **Step 1: Run all backend tests + lint**

```bash
cd backend && nvm use 20
npm run lint
npm run test
```

Expected: All green. If pre-existing failures appear, fix them inline per project memory rule.

- [ ] **Step 2: Commit lint/test fixes (if any)**

```bash
git add -A && git commit -m "chore(backend): lint/test fixes" || echo "no changes"
```

---

## Phase 3 — Frontend types + composable (TDD)

### Task 10: `YoutubeVideo` type

**Files:**
- Create: `frontend/types/youtube.ts`

- [ ] **Step 1: Define the type**

```ts
export interface YoutubeVideo {
  videoId: string
  title: string
  channelTitle: string
  thumbnail: string
  publishedAt: string
  duration: string
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types/youtube.ts
git commit -m "feat(youtube): add YoutubeVideo type"
```

---

### Task 11: `useFacilityYoutube` composable

**Files:**
- Create: `frontend/composables/useFacilityYoutube.ts`
- Test: `frontend/tests/composables/useFacilityYoutube.test.ts`

- [ ] **Step 1: Write failing tests**

Create `frontend/tests/composables/useFacilityYoutube.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useFacilityYoutube } from '~/composables/useFacilityYoutube'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api' } }))
})

describe('useFacilityYoutube', () => {
  it('초기 상태: videos 빈 배열, loading false', () => {
    const { videos, loading } = useFacilityYoutube()
    expect(videos.value).toEqual([])
    expect(loading.value).toBe(false)
  });

  it('fetchVideos 호출 시 API 응답 데이터로 videos 채워짐', async () => {
    fetchMock.mockResolvedValueOnce({
      success: true,
      data: { videos: [{ videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }] },
    })
    const { videos, fetchVideos } = useFacilityYoutube()
    await fetchVideos('parking', '123')
    expect(videos.value).toHaveLength(1)
    expect(fetchMock).toHaveBeenCalledWith('http://api/api/facilities/parking/123/youtube')
  });

  it('네트워크 에러 시 빈 배열 유지, 에러 throw 안 함', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'))
    const { videos, fetchVideos } = useFacilityYoutube()
    await fetchVideos('parking', '123')
    expect(videos.value).toEqual([])
  });

  it('동일 인자로 두 번 호출해도 한 번만 fetch (dedup)', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { videos: [] } })
    const { fetchVideos } = useFacilityYoutube()
    await Promise.all([fetchVideos('parking', '123'), fetchVideos('parking', '123')])
    expect(fetchMock).toHaveBeenCalledTimes(1)
  });
})
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd frontend && nvm use 20
npx vitest run tests/composables/useFacilityYoutube.test.ts
```

Expected: FAIL — composable not found.

- [ ] **Step 3: Implement composable**

Create `frontend/composables/useFacilityYoutube.ts`:

```ts
import { ref, readonly } from 'vue'
import type { YoutubeVideo } from '~/types/youtube'

export function useFacilityYoutube() {
  const videos = ref<YoutubeVideo[]>([])
  const loading = ref(false)
  let lastKey = ''
  let inFlight: Promise<void> | null = null

  async function fetchVideos(category: string, id: string): Promise<void> {
    const key = `${category}:${id}`
    if (key === lastKey && inFlight) return inFlight
    lastKey = key

    const config = useRuntimeConfig()
    const apiBase = config.public.apiBase
    loading.value = true

    inFlight = (async () => {
      try {
        const res = await $fetch<{ success: boolean; data: { videos: YoutubeVideo[] } }>(
          `${apiBase}/api/facilities/${category}/${id}/youtube`,
        )
        videos.value = res?.data?.videos ?? []
      } catch {
        videos.value = []
      } finally {
        loading.value = false
      }
    })()

    return inFlight
  }

  return {
    videos: readonly(videos),
    loading: readonly(loading),
    fetchVideos,
  }
}
```

- [ ] **Step 4: Run tests — expect pass**

```bash
npx vitest run tests/composables/useFacilityYoutube.test.ts
```

Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add frontend/composables/useFacilityYoutube.ts frontend/tests/composables/useFacilityYoutube.test.ts
git commit -m "feat(youtube): add useFacilityYoutube composable"
```

---

## Phase 4 — Frontend components (TDD)

### Task 12: `YoutubeVideoCard.vue`

**Files:**
- Create: `frontend/components/facility/youtube/YoutubeVideoCard.vue`
- Test: `frontend/tests/components/facility/youtube/YoutubeVideoCard.test.ts`

- [ ] **Step 1: Write failing test**

Create the test directory first:

```bash
mkdir -p frontend/tests/components/facility/youtube
```

Then create `frontend/tests/components/facility/youtube/YoutubeVideoCard.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import YoutubeVideoCard from '~/components/facility/youtube/YoutubeVideoCard.vue'

const video = {
  videoId: 'abc',
  title: '종로주차장 후기',
  channelTitle: '드라이브TV',
  thumbnail: 'https://i.ytimg.com/vi/abc/mqdefault.jpg',
  publishedAt: '2026-05-01T00:00:00Z',
  duration: '',
}

describe('YoutubeVideoCard', () => {
  it('썸네일, 제목, 채널을 렌더한다', () => {
    const w = mount(YoutubeVideoCard, { props: { video } })
    expect(w.find('img').attributes('src')).toBe(video.thumbnail)
    expect(w.text()).toContain('종로주차장 후기')
    expect(w.text()).toContain('드라이브TV')
  })

  it('썸네일에 loading="lazy" 적용', () => {
    const w = mount(YoutubeVideoCard, { props: { video } })
    expect(w.find('img').attributes('loading')).toBe('lazy')
  })

  it('클릭하면 select 이벤트를 videoId 페이로드로 emit', async () => {
    const w = mount(YoutubeVideoCard, { props: { video } })
    await w.trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['abc'])
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx vitest run tests/components/facility/youtube/YoutubeVideoCard.test.ts
```

Expected: FAIL — component not found.

- [ ] **Step 3: Implement the card**

Create `frontend/components/facility/youtube/YoutubeVideoCard.vue`:

```vue
<template>
  <button
    type="button"
    class="group block w-full text-left rounded-xl overflow-hidden bg-white border border-slate-200 hover:shadow-md transition-shadow"
    @click="$emit('select', video.videoId)"
  >
    <div class="relative aspect-video bg-gray-100">
      <img
        :src="video.thumbnail"
        :alt="video.title"
        loading="lazy"
        decoding="async"
        class="w-full h-full object-cover"
      />
      <span class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/30 transition-opacity">
        <span class="material-symbols-outlined text-white text-[40px]">play_circle</span>
      </span>
    </div>
    <div class="p-3">
      <p class="text-sm font-semibold text-slate-900 line-clamp-2">{{ video.title }}</p>
      <p class="mt-1 text-xs text-slate-500 line-clamp-1">{{ video.channelTitle }}</p>
    </div>
  </button>
</template>

<script setup lang="ts">
import type { YoutubeVideo } from '~/types/youtube'

defineProps<{ video: YoutubeVideo }>()
defineEmits<{ (e: 'select', videoId: string): void }>()
</script>
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx vitest run tests/components/facility/youtube/YoutubeVideoCard.test.ts
```

Expected: PASS — 3/3.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/facility/youtube/YoutubeVideoCard.vue frontend/tests/components/facility/youtube/YoutubeVideoCard.test.ts
git commit -m "feat(youtube): add YoutubeVideoCard component"
```

---

### Task 13: `YoutubeEmbedModal.vue`

**Files:**
- Create: `frontend/components/facility/youtube/YoutubeEmbedModal.vue`
- Test: `frontend/tests/components/facility/youtube/YoutubeEmbedModal.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import YoutubeEmbedModal from '~/components/facility/youtube/YoutubeEmbedModal.vue'

describe('YoutubeEmbedModal', () => {
  it('open=false면 iframe이 mount되지 않는다', () => {
    const w = mount(YoutubeEmbedModal, { props: { open: false, videoId: 'abc' }, attachTo: document.body })
    expect(w.find('iframe').exists()).toBe(false)
  })

  it('open=true면 youtube-nocookie iframe이 mount되고 videoId 포함', () => {
    const w = mount(YoutubeEmbedModal, { props: { open: true, videoId: 'abc' }, attachTo: document.body })
    const iframe = w.find('iframe')
    expect(iframe.exists()).toBe(true)
    expect(iframe.attributes('src')).toContain('youtube-nocookie.com/embed/abc')
  })

  it('배경 클릭 시 close emit', async () => {
    const w = mount(YoutubeEmbedModal, { props: { open: true, videoId: 'abc' }, attachTo: document.body })
    await w.find('[data-testid="yt-modal-backdrop"]').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })

  it('닫기 버튼 클릭 시 close emit', async () => {
    const w = mount(YoutubeEmbedModal, { props: { open: true, videoId: 'abc' }, attachTo: document.body })
    await w.find('[data-testid="yt-modal-close"]').trigger('click')
    expect(w.emitted('close')).toBeTruthy()
  })
})
```

Save as `frontend/tests/components/facility/youtube/YoutubeEmbedModal.test.ts`.

- [ ] **Step 2: Run test — expect failure**

```bash
npx vitest run tests/components/facility/youtube/YoutubeEmbedModal.test.ts
```

- [ ] **Step 3: Implement the modal**

Create `frontend/components/facility/youtube/YoutubeEmbedModal.vue`:

```vue
<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity duration-200"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        data-testid="yt-modal-backdrop"
        class="fixed inset-0 z-[70] bg-black/70 flex items-center justify-center p-4"
        @click.self="$emit('close')"
        @keydown.esc="$emit('close')"
      >
        <div class="relative w-full max-w-3xl aspect-video bg-black rounded-xl overflow-hidden shadow-2xl">
          <button
            data-testid="yt-modal-close"
            type="button"
            class="absolute -top-12 right-0 size-10 flex items-center justify-center rounded-full bg-white/90 text-slate-900 shadow"
            aria-label="닫기"
            @click="$emit('close')"
          >
            <span class="material-symbols-outlined">close</span>
          </button>
          <iframe
            :src="`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`"
            class="w-full h-full"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowfullscreen
            referrerpolicy="strict-origin-when-cross-origin"
          />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'

const props = defineProps<{ open: boolean; videoId: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

function handleKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) emit('close')
}

onMounted(() => { if (import.meta.client) window.addEventListener('keydown', handleKey) })
onUnmounted(() => { if (import.meta.client) window.removeEventListener('keydown', handleKey) })

watch(() => props.open, (v) => {
  if (!import.meta.client) return
  document.body.style.overflow = v ? 'hidden' : ''
})
</script>
```

- [ ] **Step 4: Run test — expect pass**

```bash
npx vitest run tests/components/facility/youtube/YoutubeEmbedModal.test.ts
```

Expected: PASS — 4/4.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/facility/youtube/YoutubeEmbedModal.vue frontend/tests/components/facility/youtube/YoutubeEmbedModal.test.ts
git commit -m "feat(youtube): add YoutubeEmbedModal component"
```

---

### Task 14: `FacilityYoutubeSection.vue` — container with IntersectionObserver

**Files:**
- Create: `frontend/components/facility/youtube/FacilityYoutubeSection.vue`
- Test: `frontend/tests/components/facility/youtube/FacilityYoutubeSection.test.ts`

- [ ] **Step 1: Write failing test**

Create `frontend/tests/components/facility/youtube/FacilityYoutubeSection.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import FacilityYoutubeSection from '~/components/facility/youtube/FacilityYoutubeSection.vue'

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://api' } }))
  // happy-dom has no IntersectionObserver — stub so component invokes callback immediately
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

const props = { category: 'parking' as const, facilityId: '123' }

describe('FacilityYoutubeSection', () => {
  it('영상이 0~1건이면 섹션 자체를 렌더링하지 않는다', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { videos: [{ videoId: 'a', title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' }] } })
    const w = mount(FacilityYoutubeSection, { props })
    await flushPromises(); await nextTick()
    expect(w.find('[data-testid="yt-section"]').exists()).toBe(false)
  })

  it('영상이 2건 이상이면 카드 N개를 렌더링한다 (최대 6)', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { videos: Array.from({ length: 8 }, (_, i) => ({ videoId: `v${i}`, title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' })) } })
    const w = mount(FacilityYoutubeSection, { props })
    await flushPromises(); await nextTick()
    expect(w.findAll('[data-testid="yt-card"]')).toHaveLength(6)
  })

  it('카드 클릭 시 모달이 열린다', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: { videos: Array.from({ length: 2 }, (_, i) => ({ videoId: `v${i}`, title: 't', channelTitle: 'c', thumbnail: '', publishedAt: '', duration: '' })) } })
    const w = mount(FacilityYoutubeSection, { props, attachTo: document.body })
    await flushPromises(); await nextTick()
    await w.findAll('[data-testid="yt-card"]')[0].trigger('click')
    expect(document.body.querySelector('iframe')).not.toBeNull()
  })
})
```

- [ ] **Step 2: Run test — expect failure**

```bash
npx vitest run tests/components/facility/youtube/FacilityYoutubeSection.test.ts
```

- [ ] **Step 3: Implement the section**

Create `frontend/components/facility/youtube/FacilityYoutubeSection.vue`:

```vue
<template>
  <section
    v-if="hasResults || loading"
    ref="rootEl"
    data-testid="yt-section"
    class="mt-8"
  >
    <header class="mb-4 flex items-baseline justify-between">
      <h2 class="text-lg font-bold text-slate-900">관련 영상</h2>
      <p class="text-xs text-slate-500">YouTube 검색 결과 · 자동 수집</p>
    </header>

    <div v-if="loading" class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <div v-for="i in 6" :key="i" class="aspect-video rounded-xl bg-slate-100 animate-pulse" />
    </div>

    <div v-else class="grid grid-cols-2 md:grid-cols-3 gap-3">
      <YoutubeVideoCard
        v-for="v in displayed"
        :key="v.videoId"
        :video="v"
        data-testid="yt-card"
        @select="onSelect"
      />
    </div>

    <YoutubeEmbedModal
      :open="modalOpen"
      :video-id="activeVideoId"
      @close="closeModal"
    />
  </section>
  <section v-else ref="rootEl" data-testid="yt-section-placeholder" class="hidden" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useFacilityYoutube } from '~/composables/useFacilityYoutube'
import type { FacilityCategory } from '~/types/facility'
import YoutubeVideoCard from './YoutubeVideoCard.vue'
import YoutubeEmbedModal from './YoutubeEmbedModal.vue'

const props = defineProps<{ category: FacilityCategory; facilityId: string }>()

const { videos, loading, fetchVideos } = useFacilityYoutube()
const rootEl = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

const MIN_RESULTS = 2
const hasResults = computed(() => videos.value.length >= MIN_RESULTS)
const displayed = computed(() => videos.value.slice(0, 6))

const modalOpen = ref(false)
const activeVideoId = ref('')

function onSelect(id: string) {
  activeVideoId.value = id
  modalOpen.value = true
}
function closeModal() {
  modalOpen.value = false
  activeVideoId.value = ''
}

onMounted(() => {
  if (!import.meta.client) return
  if (typeof IntersectionObserver === 'undefined') {
    void fetchVideos(props.category, props.facilityId)
    return
  }
  observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      void fetchVideos(props.category, props.facilityId)
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

- [ ] **Step 4: Run test — expect pass**

```bash
npx vitest run tests/components/facility/youtube/FacilityYoutubeSection.test.ts
```

Expected: PASS — 3/3. Note: the test's IntersectionObserver stub fires immediately for the placeholder element; if the test fails for the "0~1건" case because the placeholder isn't being observed, adjust the component to also observe `rootEl` from the placeholder branch (the v-else branch already uses the same ref).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/facility/youtube/FacilityYoutubeSection.vue frontend/tests/components/facility/youtube/FacilityYoutubeSection.test.ts
git commit -m "feat(youtube): add FacilityYoutubeSection container"
```

---

## Phase 5 — Wire into detail page + MSW

### Task 15: MSW handler for development

**Files:**
- Create: `frontend/mocks/handlers/facilityYoutube.ts`
- Modify: wherever existing handlers are aggregated (check `frontend/mocks/handlers/` index/barrel; otherwise register in the same place `facilities.ts` is registered)

- [ ] **Step 1: Create handler**

```ts
import { http, HttpResponse } from 'msw'

const fixture = (id: string) => ({
  success: true,
  data: {
    videos: [
      { videoId: `mock-${id}-1`, title: `시설 ${id} 관련 영상 1`, channelTitle: '모킹 채널', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
      { videoId: `mock-${id}-2`, title: `시설 ${id} 관련 영상 2`, channelTitle: '모킹 채널', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
      { videoId: `mock-${id}-3`, title: `시설 ${id} 관련 영상 3`, channelTitle: '모킹 채널', thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/mqdefault.jpg', publishedAt: '2026-05-01T00:00:00Z', duration: '' },
    ],
  },
})

export const facilityYoutubeHandlers = [
  http.get('*/api/facilities/:category/:id/youtube', ({ params }) => HttpResponse.json(fixture(String(params.id)))),
]
```

- [ ] **Step 2: Register the handler**

Check `frontend/mocks/handlers/` for an aggregator (e.g., `index.ts`). If one exists, add `...facilityYoutubeHandlers` to the exported array. If none exists, find where `facilities.ts` handler list is imported (likely `frontend/mocks/browser.ts` or `frontend/mocks/server.ts`) and append `facilityYoutubeHandlers`.

- [ ] **Step 3: Commit**

```bash
git add frontend/mocks/
git commit -m "feat(youtube): add MSW handler for facility youtube endpoint"
```

---

### Task 16: Insert section into `[id].vue`

**Files:**
- Modify: `frontend/pages/[category]/[id].vue`

- [ ] **Step 1: Add import**

In the `<script setup>` import block (around lines 293–311) add:

```ts
import FacilityYoutubeSection from '~/components/facility/youtube/FacilityYoutubeSection.vue'
```

- [ ] **Step 2: Place the section in the template**

Open `frontend/pages/[category]/[id].vue`. Locate the `<DetailNearby ... />` block (around line 166–172). Immediately AFTER it (before the `<!-- Ad: NEARBY 이후 -->` `<AdBanner />`) insert:

```html
<!-- 관련 YouTube 영상 -->
<FacilityYoutubeSection
  v-if="facility"
  :category="facility.category"
  :facility-id="facility.id"
/>
```

- [ ] **Step 3: Smoke test the detail page**

```bash
cd backend && npm run dev &
cd frontend && nvm use 20 && npm run dev
```

Then in a browser open `http://localhost:3000/parking/<any-valid-id>` and confirm: scroll down to "관련 영상" section, MSW returns 3 mock videos, click a card → modal opens with YouTube iframe; ESC closes.

Stop dev servers when done.

- [ ] **Step 4: Run frontend tests**

```bash
cd frontend && nvm use 20
npm run test
```

Expected: all green (component + composable tests for the new code, plus existing tests untouched).

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/[category]/[id].vue
git commit -m "feat(youtube): render FacilityYoutubeSection in facility detail page"
```

---

## Phase 6 — VideoObject JSON-LD (SSR on cache hit)

This SSR addition emits JSON-LD only when the API call from the detail page has resolved with results during SSR. We do NOT trigger the YouTube fetch from SSR — the existing facility-detail endpoint already runs server-side; we add a parallel SSR call to the youtube endpoint that returns the cached array if a cache row exists. If the cache is cold, the SSR call short-circuits (the cache service returns `[]` when quota is consumed during SSR but for cold pages this is the same as a miss — the *route handler* on the server enforces the lazy strategy: on SSR we add a `?ssr=1` flag the backend interprets as "do not call YouTube; cache-only".

### Task 17: Backend — cache-only SSR mode

**Files:**
- Modify: `backend/src/routes/facilityYoutube.ts`
- Modify: `backend/src/services/youtubeCacheService.ts`
- Modify: `backend/__tests__/routes/facilityYoutube.test.ts`

- [ ] **Step 1: Add failing test**

Append to `backend/__tests__/routes/facilityYoutube.test.ts`:

```ts
it('ssr=1: 캐시 없으면 fetch하지 않고 빈 배열만 반환', async () => {
  mockFindParking.mockResolvedValueOnce({ id: '123', name: '종로주차장', city: '서울특별시', district: '종로구' });
  mockGetOrFetch.mockResolvedValueOnce([]);
  const app = createApp();
  const res = await request(app).get('/api/facilities/parking/123/youtube?ssr=1');
  expect(res.status).toBe(200);
  expect(res.body.data.videos).toEqual([]);
  expect(mockGetOrFetch).toHaveBeenCalledWith('parking', '123', expect.any(Object), { cacheOnly: true });
});
```

Run: `npx vitest run __tests__/routes/facilityYoutube.test.ts` — expect FAIL (signature mismatch).

- [ ] **Step 2: Extend `getOrFetchYoutubeVideos` with `cacheOnly`**

In `backend/src/services/youtubeCacheService.ts` change the signature:

```ts
interface GetOptions { cacheOnly?: boolean }

export async function getOrFetchYoutubeVideos(
  category: FacilityCategory,
  facilityId: string,
  facility: FacilityQueryInput,
  options: GetOptions = {},
): Promise<RawYoutubeVideo[]> {
  const hit = await prisma.facilityYoutubeCache.findUnique({
    where: { category_facilityId: { category, facilityId } },
  });
  if (hit && hit.expiresAt > new Date()) {
    return (hit.videos as unknown as RawYoutubeVideo[]) ?? [];
  }
  if (options.cacheOnly) return [];

  // ... existing in-flight + fetch logic unchanged ...
}
```

- [ ] **Step 3: Add `?ssr=1` parsing in the route**

In `backend/src/routes/facilityYoutube.ts`:

```ts
const ssrOnly = req.query.ssr === '1';
const videos = await getOrFetchYoutubeVideos(category, id, {
  name: facility.name, city: facility.city, district: facility.district,
}, { cacheOnly: ssrOnly });
```

- [ ] **Step 4: Run all route + cache tests**

```bash
npx vitest run __tests__/routes/facilityYoutube.test.ts __tests__/services/youtubeCacheService.test.ts
```

Expected: PASS for all (including the new SSR test). Update the existing `getOrFetchYoutubeVideos` cache-service tests if they assert a specific signature — pass `{}` explicitly where needed.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/facilityYoutube.ts backend/src/services/youtubeCacheService.ts backend/__tests__/routes/facilityYoutube.test.ts
git commit -m "feat(youtube): add SSR cache-only mode (?ssr=1)"
```

---

### Task 18: Frontend — SSR fetch + JSON-LD emission

**Files:**
- Modify: `frontend/composables/useStructuredData.ts`
- Modify: `frontend/pages/[category]/[id].vue`

- [ ] **Step 1: Add `setVideoListSchema` to `useStructuredData`**

Open `frontend/composables/useStructuredData.ts` and add a helper that sets a `useHead` script entry with `type: 'application/ld+json'` containing an `ItemList` of `VideoObject` items. The exact existing pattern in that file should be followed — read the file first; reuse the same helpers it uses for the existing facility/breadcrumb schemas.

If the file doesn't yet expose a generic "set script" helper, add:

```ts
function setVideoListSchema(videos: { videoId: string; title: string; channelTitle: string; thumbnail: string; publishedAt: string }[]) {
  if (!videos.length) return
  const itemListElement = videos.slice(0, 6).map((v, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'VideoObject',
      name: v.title,
      description: v.title,
      thumbnailUrl: v.thumbnail,
      uploadDate: v.publishedAt,
      embedUrl: `https://www.youtube-nocookie.com/embed/${v.videoId}`,
      contentUrl: `https://www.youtube.com/watch?v=${v.videoId}`,
    },
  }))
  useHead({
    script: [{
      type: 'application/ld+json',
      innerHTML: JSON.stringify({ '@context': 'https://schema.org', '@type': 'ItemList', itemListElement }),
    }],
  })
}
```

Export it from the composable return object.

- [ ] **Step 2: SSR fetch in `[id].vue`**

Below the existing `useAsyncData('facility-...')` block (around line 332) add a parallel SSR fetch:

```ts
const { data: youtubeSsrResponse } = await useAsyncData(
  `facility-youtube-${category.value}-${id.value}`,
  () => $fetch<{ success: boolean; data: { videos: YoutubeVideo[] } }>(
    `/api/facilities/${category.value}/${id.value}/youtube?ssr=1`
  ),
  { lazy: true, default: () => ({ success: true, data: { videos: [] as YoutubeVideo[] } }) }
)
```

Import `YoutubeVideo` at the top.

- [ ] **Step 3: Emit schema inside `watchEffect`**

Inside the existing `watchEffect` (around lines 367–379) that calls `setFacilityDetailMeta` and `setFacilitySchema`, also call:

```ts
const ssrVideos = youtubeSsrResponse.value?.data?.videos ?? []
if (ssrVideos.length >= 2) {
  setVideoListSchema(ssrVideos)
}
```

And destructure `setVideoListSchema` from the existing `useStructuredData()` call.

- [ ] **Step 4: Smoke test**

Start both dev servers (`npm run dev` in backend + frontend). Trigger the detail page once to populate cache, reload the page, view source: a `<script type="application/ld+json">` containing `"@type":"ItemList"` with `VideoObject` entries should be present in the SSR HTML.

- [ ] **Step 5: Run frontend tests**

```bash
cd frontend && npm run test
```

Expected: green. Some existing tests that mock `useAsyncData` may need to accept an extra call — only modify them if they fail. Do not change unrelated tests.

- [ ] **Step 6: Commit**

```bash
git add frontend/composables/useStructuredData.ts frontend/pages/[category]/[id].vue
git commit -m "feat(youtube): emit VideoObject ItemList JSON-LD when cache hit"
```

---

## Phase 7 — Final verification + PR

### Task 19: Full test + lint pass

- [ ] **Step 1: Backend**

```bash
cd backend && nvm use 20
npm run lint
npm run test
npm run build
```

Expected: all green; tsc reports no errors.

- [ ] **Step 2: Frontend**

```bash
cd frontend && nvm use 20
npm run lint
npm run test
npm run build
```

Expected: all green; Nuxt build succeeds.

- [ ] **Step 3: Commit any incidental fixes**

```bash
git add -A
git commit -m "chore: lint/build fixes for youtube section" || echo "nothing to commit"
```

---

### Task 20: Push branch + open PR

- [ ] **Step 1: Push**

```bash
git push -u origin feat/facility-youtube-section
```

- [ ] **Step 2: Open PR with `gh`**

```bash
gh pr create \
  --base develop \
  --head feat/facility-youtube-section \
  --title "feat(youtube): 시설 상세 페이지 관련 YouTube 영상 섹션" \
  --body "$(cat <<'EOF'
## 변경 사항
- `/[category]/[id]` 시설 상세 페이지 하단에 관련 YouTube 영상 6개 카드 추가
- 시설명+지역+카테고리 라벨 기반 검색, 캐시 30일 TTL, 일일 quota 90회 가드
- 사이트 내 모달 임베드 (youtube-nocookie.com), 클릭 시 재생
- 결과 < 2건이면 섹션 자동 숨김 (negative caching)
- 캐시 히트 시 SSR이 VideoObject ItemList JSON-LD 출력

## 스펙 & 플랜
- 스펙: \`docs/superpowers/specs/2026-05-15-facility-detail-youtube-design.md\`
- 플랜: \`docs/superpowers/plans/2026-05-15-facility-detail-youtube.md\`

## 환경
- 프로덕션에 \`YOUTUBE_API_KEY\` 환경변수 설정 필요
- GCP 콘솔에서 API 제한(YouTube Data API v3) + IP 화이트리스트 설정 권장

## 테스트
- backend: \`npm run test\` ✅
- frontend: \`npm run test\` ✅
- 로컬 dev에서 MSW로 카드/모달/스킴어/SSR JSON-LD 동작 확인
EOF
)"
```

- [ ] **Step 3: Wait for CI**

Watch `gh pr checks` or GitHub UI. If CI fails, fix on this branch (do not push to main).

---

## Spec Coverage Check

| Spec section | Covered by tasks |
|---|---|
| 1 적용 범위 & UX | T14, T16 (section render + page insertion) |
| 1 모달 임베드 | T13 |
| 1 결과 < 2건 숨김 | T14 (component v-if), T7 (negative caching) |
| 2 카테고리별 쿼리 빌더 | T4 |
| 2 결과 필터링 | T5 |
| 2 API 파라미터 | T6 |
| 3 환경변수 | T1 |
| 3 Prisma 모델 | T2 |
| 3 캐시 흐름 | T7 |
| 3 Quota guard | T3 |
| 3 라우트 | T8 |
| 3 in-flight 중복 방지 | T7 (test included) |
| 4 컴포넌트 구조 | T12, T13, T14 |
| 4 Composable | T11 |
| 4 Lazy CSR + IntersectionObserver | T14 |
| 4 모달 UX | T13 |
| 4 VideoObject schema (SSR on hit) | T17, T18 |
| 4 youtube-nocookie | T13 |
| 5 백엔드 4종 테스트 | T3, T5, T7, T8 |
| 5 프론트 4종 테스트 | T11, T12, T13, T14 |
| 5 MSW | T15 |
| 7 보안 / 운영 노트 | T1 (env), T20 (PR body) |

No spec section is left uncovered.
