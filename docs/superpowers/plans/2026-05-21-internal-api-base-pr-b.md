# PR-B: Server-side ssrFetch Migration Implementation Plan

**Goal:** 사이트맵 utils 8개 fetch 함수 + 5개 server route/middleware의 SSR fetch를 `ssrFetch`로 교체. 외부 `apiBase` 인자 의존성 제거.

**Architecture:** PR-A가 도입한 `ssrFetch`를 sitemap utils 안으로 흡수 → 호출부 변경 최소화. apiBase 인자 제거 → caller가 더 깨끗.

**Tech Stack:** Nuxt 3, Vitest, ofetch, TypeScript ESM

**Spec:** `docs/superpowers/specs/2026-05-21-internal-api-base-ssr-resilience-design.md`

---

## File Structure

**Modify:**
- `frontend/server/utils/sitemap.ts` — 8 fetch 함수에서 `apiBase` 인자 제거, manual retry 루프 제거 → `ssrFetch` 위임
- `frontend/server/routes/sitemap.xml.ts` — `fetchXxx(apiBase)` → `fetchXxx()`
- `frontend/server/routes/sitemap/[...].ts` — 동일
- `frontend/server/routes/sitemap/static.xml.ts` — raw `fetch(${apiBase}/...)` 호출 3건을 `ssrFetch`로
- `frontend/server/routes/rss.xml.ts` — `$fetch(${apiBase}/...)` 1건을 `ssrFetch`로
- `frontend/server/middleware/real-estate-redirect.ts` — `resolveBjdCode` 시그니처에서 apiBase 제거, `ssrFetch` 사용

**Tests to update:**
- `frontend/tests/server/sitemap.test.ts` — apiBase 인자 mock 변화 반영
- `frontend/tests/server/real-estate-redirect.test.ts` — 동일
- `frontend/tests/server/rss.test.ts` — 동일

**Out of scope:**
- `og.get.ts` — apiBase 미사용
- `og-map.get.ts` — 외부 Naver API 호출만, apiBase 무관

---

## Task 1: Migrate `sitemap.ts` 8 fetch 함수

**Pattern**: 각 함수에서 (1) `apiBase: string` 인자 제거 (2) manual retry 루프 제거 (3) `ssrFetch` 호출로 단순화

### 변환 예시 (`fetchRealEstateBuildings`):

```ts
// Before
export async function fetchRealEstateBuildings(apiBase: string): Promise<SitemapRealEstateBuilding[]> {
  const cacheKey = 'real-estate-buildings'
  const cached = getCached<SitemapRealEstateBuilding>(cacheKey)
  if (cached) return cached

  for (let attempt = 1; attempt <= 2; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 25_000)
    try {
      const res = await fetch(`${apiBase}/api/sitemap/real-estate-buildings`, { signal: controller.signal })
      clearTimeout(timer)
      if (!res.ok) { /* ... */ continue }
      const json = await res.json()
      // ...
    } catch (err) { /* ... */ }
  }
  return []
}

// After
export async function fetchRealEstateBuildings(): Promise<SitemapRealEstateBuilding[]> {
  const cacheKey = 'real-estate-buildings'
  const cached = getCached<SitemapRealEstateBuilding>(cacheKey)
  if (cached) return cached

  try {
    const json = await ssrFetch<{ data?: SitemapRealEstateBuilding[] }>(
      '/api/sitemap/real-estate-buildings',
      { timeoutMs: 25_000 },
    )
    const raw = json.data ?? []
    const data = raw.filter((item) => isValidBuildingName(item.buildingName))
    if (data.length > 0) setCache(cacheKey, data)
    return data
  } catch (err) {
    console.error('[sitemap] fetchRealEstateBuildings failed', err)
    return []
  }
}
```

**Steps:**
- [ ] Add `import { ssrFetch } from './ssrFetch'` to sitemap.ts top
- [ ] Convert each of 8 functions:
  - `fetchFacilityIds(category, apiBase, limit?)` → `fetchFacilityIds(category, limit?)`
  - `fetchWasteScheduleIds(apiBase)` → `fetchWasteScheduleIds()`
  - `fetchRealEstateBuildings(apiBase)` → `fetchRealEstateBuildings()`
  - `fetchRealEstateCityDistrictHubs(apiBase)` → `fetchRealEstateCityDistrictHubs()`
  - `fetchRegionCategories(apiBase)` → `fetchRegionCategories()`
  - `fetchSitemapPageCounts(apiBase)` → `fetchSitemapPageCounts()`
  - `fetchSubwaySlugs(apiBase, ...)` → `fetchSubwaySlugs(...)`
  - `fetchSubscriptionIds(apiBase)` → `fetchSubscriptionIds()`
- [ ] 각 함수: manual retry 루프 제거, `ssrFetch` 단일 호출로 단순화, 기존 cache/filter 로직 보존
- [ ] timeout 옵션: 기존 25s 사용했던 `fetchRealEstateBuildings`만 `{ timeoutMs: 25_000 }`. 나머지는 ssrFetch 기본 5s 사용.

## Task 2: Update sitemap routes

`frontend/server/routes/sitemap.xml.ts`:
- [ ] `const apiBase = config.public.apiBase as string` 라인 삭제
- [ ] `fetchSitemapPageCounts(apiBase)` → `fetchSitemapPageCounts()`
- [ ] `fetchRealEstateBuildings(apiBase)` → `fetchRealEstateBuildings()`
- [ ] `fetchSubscriptionIds(apiBase)` → `fetchSubscriptionIds()`
- [ ] `fetchFacilityIds(cat, apiBase, ...)` → `fetchFacilityIds(cat, ...)`
- [ ] `fetchWasteScheduleIds(apiBase)` → `fetchWasteScheduleIds()`
- [ ] `fetchSubwaySlugs(apiBase)` → `fetchSubwaySlugs()`

`frontend/server/routes/sitemap/[...].ts`:
- [ ] 동일 패턴 적용 (라인 104, 110, 140, 165, 189, 220, 223)

## Task 3: Migrate sitemap/static.xml.ts

3개 raw `fetch()` 호출을 `ssrFetch`로 교체:

```ts
// Before
const apiBase = process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:8000'
const countsRes = await fetch(`${apiBase}/api/sitemap/page-counts`)
const json = await countsRes.json()

// After
import { ssrFetch } from '~/server/utils/ssrFetch'
// ...
const json = await ssrFetch<...>('/api/sitemap/page-counts').catch(err => {
  console.error('[sitemap/static] Failed to fetch page-counts:', err)
  return null
})
```

대상:
- `/api/sitemap/page-counts` (line 58)
- `/api/guides?limit=100&page=${page}` (line 120)
- `/api/sitemap/region-categories` (line 140)

## Task 4: Migrate rss.xml.ts

```ts
// Before
const apiBase = (config.public.apiBase as string) || 'http://localhost:8000'
const guides = await $fetch<...>(`${apiBase}/api/guides?limit=50`)

// After
import { ssrFetch } from '~/server/utils/ssrFetch'
// ...
const guides = await ssrFetch<...>('/api/guides?limit=50')
```

## Task 5: Migrate real-estate-redirect.ts

```ts
// Before
async function resolveBjdCode(
  bjdCode: string,
  fetcher: (url: string) => Promise<unknown>,
  apiBase: string,
): Promise<...> {
  const res = await fetcher(`${apiBase}/api/meta/region-by-bjd?bjdCode=${encodeURIComponent(bjdCode)}`) as ...
  // ...
}
// caller:
const apiBase = (process.env.NUXT_PUBLIC_API_BASE ?? 'http://localhost:8000')
const lookup = await resolveBjdCode(bjdCode, (u) => $fetch(u), apiBase)

// After
import { ssrFetch } from '~/server/utils/ssrFetch'

async function resolveBjdCode(
  bjdCode: string,
  fetcher: (path: string) => Promise<unknown>,
): Promise<...> {
  const res = await fetcher(`/api/meta/region-by-bjd?bjdCode=${encodeURIComponent(bjdCode)}`) as ...
  // ...
}
// caller:
const lookup = await resolveBjdCode(bjdCode, (path) => ssrFetch(path))
```

## Task 6: Test updates

`frontend/tests/server/sitemap.test.ts`, `real-estate-redirect.test.ts`, `rss.test.ts`:
- [ ] 함수 시그니처 변경에 맞춰 mock 호출 인자 조정
- [ ] `ssrFetch` mock 추가 (기존 raw `fetch` mock 패턴 → `vi.mock('~/server/utils/ssrFetch', ...)` 패턴으로 교체)
- [ ] 기존 동작 검증은 그대로 유지 (cache, filter, retry-on-failure)

## Task 7: 검증

```bash
cd frontend
npx vitest run tests/server 2>&1 | tail -20
npm run test 2>&1 | tail -10
npm run lint 2>&1 | tail -5
npm run build 2>&1 | tail -10
```

전체 1017+ 테스트 PASS. lint 0 errors. build 성공.

## Task 8: 커밋 + push + PR

원자성 있게 5~7개 커밋으로 분할:
1. `refactor(server): drop apiBase param from sitemap.ts utils, use ssrFetch`
2. `refactor(server): update sitemap routes to call apiBase-free utils`
3. `refactor(server): migrate sitemap/static.xml.ts to ssrFetch`
4. `refactor(server): migrate rss.xml.ts to ssrFetch`
5. `refactor(server): migrate real-estate-redirect middleware to ssrFetch`
6. `test(server): update mocks for ssrFetch migration`

또는 의미상 한 PR이므로 한 큰 커밋도 무방.

PR 본문은 spec/PR-A와 일관되게: goal, 변경 파일, 테스트, 검증 명령, 의존(PR-A 머지됨), 후속(PR-C).
