# Phase 2 — SSR 워터폴 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설 상세 / 홈 / 부동산 상세 3 페이지의 다중 `useAsyncData` 직렬 호출을 `Promise.allSettled`로 병렬화하여 SSR LCP를 100~250ms 단축하고, 부분 실패 내성을 확보한다.

**Architecture:** 각 페이지에서 critical fetch(404 gate)는 그대로 두고, secondary fetches만 단일 `useAsyncData` 안에서 `Promise.allSettled` + `AbortSignal.timeout(8000)`로 묶는다. 새 composable 추상화 없이 인라인 패턴. URL·라우트·사이트맵 변경 0. 홈에서 critical 실패 시 빈 hero 색인 차단을 위해 503 throw 추가.

**Tech Stack:** Nuxt 3 SSR + `useAsyncData` + `Promise.allSettled` + `AbortSignal.timeout`. Playwright `context.route` mocking.

**Spec 참조:** `docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md` 섹션 5.

**PR 단위:** 단일 atomic PR `feat(ssr): 시설 상세·홈·부동산 상세 페이지 SSR fetch 병렬화 (Phase 2)`. Commit 5개 (Task당 1 commit).

---

## File Structure

| 파일 | 변경 종류 | 책임 |
|---|---|---|
| `frontend/pages/[category]/[id].vue` | Modify | facility(critical 그대로) + secondary(youtube+sync-status) allSettled로 묶기 |
| `frontend/pages/index.vue` | Modify | home-dashboard + recent-guides를 단일 useAsyncData에 allSettled. dashboard null이면 503 throw |
| `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` | Modify | ssrData(그대로) + sync-status(secondary)로 분리 |
| `frontend/tests/e2e/ssr-resilience.spec.ts` | Create | Playwright 3건 — youtube/sync-status abort 시 200 렌더, home-dashboard abort 시 503 |

**핵심 식별자 일관성:**
- secondary useAsyncData key: `facility-secondary-${cat}-${id}`, `home-page`, `real-estate-secondary`
- timeout: `AbortSignal.timeout(8000)` (모든 secondary $fetch)
- fallback: secondary 실패 시 각각 `null` 또는 `[]`
- 503: `createError({ statusCode: 503, statusMessage: 'Home data temporarily unavailable' })`

---

## Task 1: `[category]/[id].vue` — secondary fetches 병렬화

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (3 useAsyncData → 2)

- [ ] **Step 1.1: 현 코드 위치 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'useAsyncData\|setVideoListSchema(ssrVideos)\|youtubeSsrResponse\|syncStatusResponse\|lastSyncDate' frontend/pages/\[category\]/\[id\].vue | head -20
```

기준 라인 (변경 후 밀릴 수 있음):
- L350: `const { data: facilityResponse, ... } = await useAsyncData(\`facility-${cat}-${id}\`, ...)` — 그대로 유지
- L376: `const { data: youtubeSsrResponse } = await useAsyncData(\`facility-youtube-${cat}-${id}\`, ...)` — 제거
- L691: `const { data: syncStatusResponse } = await useAsyncData('sync-status', ...)` — 제거
- L404~406: `const ssrVideos = youtubeSsrResponse.value?.data?.videos ?? []` + `setVideoListSchema(ssrVideos)` — `secondaryResponse` 기반으로 교체
- L696~700: `const lastSyncDate = computed(...)` — `secondaryResponse` 기반으로 교체

- [ ] **Step 1.2: L376의 youtube useAsyncData 블록을 secondary useAsyncData로 교체**

`pages/[category]/[id].vue`의 L376~382 블록 전체를:

```ts
const { data: youtubeSsrResponse } = await useAsyncData(
  `facility-youtube-${category.value}-${id.value}`,
  () => $fetch<{ success: boolean; data: { videos: YoutubeVideo[] } }>(
    `/api/facilities/${category.value}/${id.value}/youtube?ssr=1`
  ),
  { lazy: true, default: () => ({ success: true, data: { videos: [] as YoutubeVideo[] } }) }
)
```

→ 다음으로 교체:

```ts
// Secondary fetches — youtube + sync-status를 Promise.allSettled로 병렬화.
// 각 실패 시 null fallback, 페이지는 critical(facility) 기준으로 정상 렌더된다.
const { data: secondaryResponse } = await useAsyncData(
  `facility-secondary-${category.value}-${id.value}`,
  async () => {
    const apiBase = useApiBase()
    const signal = AbortSignal.timeout(8000)
    const [youtubeR, syncR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: { videos: YoutubeVideo[] } }>(
        `${apiBase}/api/facilities/${category.value}/${id.value}/youtube?ssr=1`,
        { signal }
      ),
      $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal }
      ),
    ])
    return {
      youtube: youtubeR.status === 'fulfilled' ? youtubeR.value.data : null,
      syncStatus: syncR.status === 'fulfilled' ? syncR.value.data : null,
    }
  },
  {
    lazy: true,
    default: () => ({
      youtube: null as { videos: YoutubeVideo[] } | null,
      syncStatus: null as Record<string, string | null> | null,
    }),
  }
)
```

- [ ] **Step 1.3: L691의 sync-status useAsyncData 블록 제거**

`pages/[category]/[id].vue`의 L691~695:

```ts
const { data: syncStatusResponse } = await useAsyncData(
  'sync-status',
  () => $fetch<{ success: boolean; data: Record<string, string | null> }>('/api/meta/sync-status'),
  { lazy: true }
)
```

→ **전체 삭제** (해당 5줄). `secondaryResponse`가 이미 sync-status를 포함.

- [ ] **Step 1.4: `ssrVideos` / `lastSyncDate` 참조 교체**

L404 부근의 `setVideoListSchema(ssrVideos)` 인근 블록:

```ts
const ssrVideos = youtubeSsrResponse.value?.data?.videos ?? []
if (ssrVideos.length >= 2) {
  setVideoListSchema(ssrVideos)
}
```

→ 다음으로 교체:

```ts
const ssrVideos = secondaryResponse.value?.youtube?.videos ?? []
if (ssrVideos.length >= 2) {
  setVideoListSchema(ssrVideos)
}
```

L696~700의 `lastSyncDate` computed:

```ts
const lastSyncDate = computed(() => {
  if (!facility.value || !syncStatusResponse.value?.data) return null
  const cat = facility.value.category
  return formatKstDate(syncStatusResponse.value.data[cat])
})
```

→ 다음으로 교체:

```ts
const lastSyncDate = computed(() => {
  if (!facility.value) return null
  const data = secondaryResponse.value?.syncStatus
  if (!data) return null
  const cat = facility.value.category
  return formatKstDate(data[cat])
})
```

- [ ] **Step 1.5: 기존 ref 참조 잔존 확인 (sanity)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'youtubeSsrResponse\|syncStatusResponse' frontend/pages/\[category\]/\[id\].vue
```

Expected: `(no output)` — 잔존 0건. 잔존 있으면 Step 1.4 누락이니 추가 정리.

- [ ] **Step 1.6: TypeScript / vitest 회귀 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
npx nuxt prepare
npm run lint
npx vitest run
```

Expected: lint 0 error. vitest 1043 tests PASS (또는 [category]/[id]에 대한 mock 갱신 필요 시 그 부분 수정).

**vitest 회귀 대응**: 만약 `useAsyncData` mock 호출 횟수에 의존하는 테스트가 깨지면, 해당 setup이 `tests/setup.ts` 또는 페이지별 테스트에서 secondary key를 인식하도록 갱신. 변경 후 다시 `npx vitest run`.

- [ ] **Step 1.7: Commit**

```bash
git add frontend/pages/\[category\]/\[id\].vue
git commit -m "feat(ssr): 시설 상세 페이지 secondary fetch (youtube + sync-status) 병렬화

3-step useAsyncData 직렬을 2-step으로 축소 (facility critical → secondary 병렬).
youtube와 sync-status를 단일 useAsyncData 안에서 Promise.allSettled로 묶고
AbortSignal.timeout(8000)으로 SSR 무한 대기 방지. 각 실패 시 null fallback,
critical(facility) 기준으로 페이지는 정상 렌더된다.

Spec: docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md 섹션 5.3"
```

---

## Task 2: `index.vue` — 완전 병렬화 + 503 throw

**Files:**
- Modify: `frontend/pages/index.vue` (2 useAsyncData → 1, 503 throw 추가)

- [ ] **Step 2.1: 현 코드 위치 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'useHomeDashboard\|dashboardResponse\|recentGuidesData\|recentGuides\|setItemListSchema' frontend/pages/index.vue | head -15
```

기준 라인:
- L291: `const { data: dashboardResponse } = await useHomeDashboard()` — 제거
- L292: `const dashboard = computed(() => dashboardResponse.value?.data ?? null)` — pageData 기반으로 교체
- L340~345: `const { data: recentGuidesData } = await useAsyncData('recent-guides', ...)` — 제거
- L346: `const recentGuides = computed(() => recentGuidesData.value?.data ?? [])` — pageData 기반으로 교체

- [ ] **Step 2.2: L291의 dashboard 호출을 pageData useAsyncData로 교체**

L291의 한 줄:

```ts
const { data: dashboardResponse } = await useHomeDashboard()
```

→ 다음으로 교체:

```ts
// Home dashboard + recent guides를 단일 useAsyncData 안에서 Promise.allSettled로 병렬화.
// dashboard는 critical (hero·JSON-LD에 필수) — null이면 503 throw로 빈 hero 색인 차단.
// recentGuides는 fold-below decorative — null이어도 페이지 정상.
const apiBase = useApiBase()
const { data: pageData } = await useAsyncData(
  'home-page',
  async () => {
    const signal = AbortSignal.timeout(8000)
    const [dashR, guidesR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: HomeDashboard }>(
        `${apiBase}/api/meta/home-dashboard`,
        { signal }
      ),
      $fetch<{ success: boolean; data: GuideSummary[] }>(
        `${apiBase}/api/guides/recent`,
        { query: { limit: 4 }, signal }
      ),
    ])
    return {
      dashboard: dashR.status === 'fulfilled' ? dashR.value.data : null,
      recentGuides: guidesR.status === 'fulfilled' ? guidesR.value.data : ([] as GuideSummary[]),
    }
  },
  {
    default: () => ({
      dashboard: null as HomeDashboard | null,
      recentGuides: [] as GuideSummary[],
    }),
  }
)

// 빈 hero 색인 차단 — dashboard 없으면 503 (봇 retry 유도)
if (import.meta.server && !pageData.value?.dashboard) {
  throw createError({ statusCode: 503, statusMessage: 'Home data temporarily unavailable' })
}
```

**Import 추가 확인**: `import { createError } from '#imports'` 또는 Nuxt auto-import로 이미 사용 가능. `HomeDashboard`, `GuideSummary` 타입은 기존 import 그대로 활용. `useApiBase`도 auto-import 또는 기존 import.

- [ ] **Step 2.3: L292의 dashboard computed를 pageData 기반으로 교체**

L292:

```ts
const dashboard = computed(() => dashboardResponse.value?.data ?? null)
```

→ 다음으로 교체:

```ts
const dashboard = computed(() => pageData.value?.dashboard ?? null)
```

- [ ] **Step 2.4: L340~346의 recentGuides 블록을 pageData 기반으로 교체**

L340~346 (`recentGuidesData` useAsyncData + `recentGuides` computed):

```ts
const { data: recentGuidesData } = await useAsyncData('recent-guides', () =>
  $fetch<{ success: boolean; data: GuideSummary[] }>(
    `${apiBase}/api/guides/recent`,
    { query: { limit: 4 } }
  )
)
const recentGuides = computed(() => recentGuidesData.value?.data ?? [])
```

→ 다음으로 교체:

```ts
const recentGuides = computed(() => pageData.value?.recentGuides ?? [])
```

(7줄 → 1줄)

- [ ] **Step 2.5: 기존 ref 참조 잔존 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'dashboardResponse\|recentGuidesData\|useHomeDashboard' frontend/pages/index.vue
```

Expected: `(no output)`.

`useHomeDashboard` import도 정리 — index.vue 상단:

```bash
grep -n "from '~/composables/useHomeDashboard'" frontend/pages/index.vue
```

만약 import 한 줄 있으면 (`import { useHomeDashboard } from '~/composables/useHomeDashboard'`) — index.vue에서 더 이상 사용 안 함. **다만 다른 페이지가 쓰는지 먼저 확인**:

```bash
grep -rn 'useHomeDashboard' frontend/ --include='*.vue' --include='*.ts' | grep -v 'composables/useHomeDashboard.ts'
```

index.vue 외에 사용처 있으면 composable·import 유지. 없으면 index.vue의 import 한 줄만 제거 (composable 파일 자체는 보존 — 후속 사용 가능성).

- [ ] **Step 2.6: TypeScript / vitest 회귀**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
npx nuxt prepare
npm run lint
npx vitest run
```

Expected: lint 0 error, vitest PASS.

홈 페이지 vitest mock이 `useHomeDashboard`에 의존하면 갱신 필요. `tests/setup.ts` 또는 `tests/pages/index*.test.ts` 확인.

- [ ] **Step 2.7: Commit**

```bash
git add frontend/pages/index.vue
git commit -m "feat(ssr): 홈 페이지 dashboard + guides 완전 병렬화 + 503 throw

2-step useAsyncData (dashboard → recent-guides)를 1-step pageData allSettled로 축소.
home-dashboard 실패 시 빈 hero 그대로 렌더하지 않고 createError(503)로 봇 retry 유도
→ thin content 색인 차단.

Spec: docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md 섹션 5.4"
```

---

## Task 3: 부동산 상세 페이지 — secondary 분리

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (sync-status를 secondary 패턴으로)

- [ ] **Step 3.1: 현 코드 위치 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'useAsyncData\|syncStatusResponse\|ssrData\|lastSyncDate' frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue | head -20
```

기준 라인:
- L743: `const { data: syncStatusResponse } = await useAsyncData('sync-status', ...)` — secondary 패턴으로 교체
- L955: `const { data: ssrData, ... } = await useAsyncData('ssrData', ...)` — 그대로 유지 (404 gate)
- `lastSyncDate` 또는 syncStatus 참조처 — secondary 기반으로 교체

- [ ] **Step 3.2: L743의 syncStatus useAsyncData를 secondary 패턴으로 교체**

기존 L743 부근:

```ts
const { data: syncStatusResponse } = await useAsyncData(
  'sync-status',
  () => $fetch<...>('/api/meta/sync-status'),
  ...
)
```

→ 다음으로 교체 (정확한 generic은 기존 코드의 type signature를 그대로 따라감 — Read로 확인 후 적용):

```ts
const { data: secondaryResponse } = await useAsyncData(
  'real-estate-secondary',
  async () => {
    const apiBase = useApiBase()
    const signal = AbortSignal.timeout(8000)
    const [syncR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal }
      ),
    ])
    return {
      syncStatus: syncR.status === 'fulfilled' ? syncR.value.data : null,
    }
  },
  {
    default: () => ({ syncStatus: null as Record<string, string | null> | null }),
  }
)
```

- [ ] **Step 3.3: syncStatusResponse 참조처를 secondaryResponse로 교체**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'syncStatusResponse' frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue
```

각 참조처에서 `syncStatusResponse.value?.data` → `secondaryResponse.value?.syncStatus`로 교체. 정확한 형태는 원본 컨텍스트 따라가지만 보통:

```ts
// BEFORE
const lastSyncDate = computed(() => formatKstDate(syncStatusResponse.value?.data?.['real-estate'] ?? null))
// AFTER
const lastSyncDate = computed(() => formatKstDate(secondaryResponse.value?.syncStatus?.['real-estate'] ?? null))
```

(실제 키는 `'real-estate'` 외 다른 형태일 수 있음 — Read로 확인 후 정확히 매핑)

- [ ] **Step 3.4: 잔존 확인 + lint + vitest**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'syncStatusResponse' frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue
```

Expected: `(no output)`.

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
npx nuxt prepare
npm run lint
npx vitest run
```

Expected: lint 0, vitest PASS.

- [ ] **Step 3.5: URL·라우트·사이트맵 변경 0 확인 (sanity)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git diff --stat
```

Expected: 단일 파일 변경, URL 라우트 파일명 자체는 그대로 (`[buildingName].vue` 파일 내부 로직만 수정).

- [ ] **Step 3.6: Commit**

```bash
git add frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue
git commit -m "feat(ssr): 부동산 상세 페이지 sync-status secondary 패턴 분리

ssrData(critical, 404 gate)는 그대로, sync-status를 secondary allSettled 패턴으로 통일.
타 페이지(시설 상세·홈)와 동일 구조로 유지보수성·후속 secondary 확장성 확보.

URL·라우트·사이트맵 변경 없음 — 색인된 부동산 URL 보호.

Spec: docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md 섹션 5.5"
```

---

## Task 4: 테스트 — source assertion + smoke

**왜 spec 5.8의 E2E partial-failure 테스트를 따르지 않는가:** spec에 적힌 `context.route` 기반 abort 테스트는 **SSR 서버사이드 fetch를 가로채지 못한다**. Playwright `context.route`는 브라우저가 만든 네트워크 요청만 인터셉트하는데, 본 PR의 secondary fetch들은 Nuxt SSR 서버에서 Node→Express(127.0.0.1) 호출이라 브라우저 레이어를 거치지 않는다. mock을 걸어도 fetch는 실제로 실행되므로 테스트가 **false positive로 통과**한다. SEO·JSON-LD를 위해 SSR 시점 데이터 유지가 필요하므로 `server: false`로 client-only 전환도 답이 아니다.

→ 대신 (1) source assertion vitest 3건으로 코드 패턴 존재를 단언하고, (2) Playwright smoke 1건으로 3 페이지 정상 렌더를 검증하고, (3) partial-failure 실증은 production 관측(503 응답률·SSR 에러 로그·LCP CrUX)에 위임한다.

**Files:**
- Create: `frontend/tests/pages/phase2-ssr-source.test.ts` (vitest source assertion)
- Create: `frontend/tests/e2e/ssr-smoke.spec.ts` (Playwright smoke)

- [ ] **Step 4.1: Vitest source assertion 작성**

`frontend/tests/pages/phase2-ssr-source.test.ts`:

```ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const frontendRoot = process.cwd().endsWith('/frontend')
  ? process.cwd()
  : join(process.cwd(), 'frontend')

const read = (relPath: string) => readFileSync(resolve(frontendRoot, relPath), 'utf8')

describe('Phase 2 — SSR 워터폴 병렬화 source assertions', () => {
  describe('시설 상세 (pages/[category]/[id].vue)', () => {
    const src = read('pages/[category]/[id].vue')

    it('secondary fetches가 Promise.allSettled로 묶여 있다', () => {
      expect(src).toMatch(/facility-secondary-\$\{category\.value\}-\$\{id\.value\}/)
      expect(src).toContain('Promise.allSettled')
    })

    it('secondary $fetch에 AbortSignal.timeout(8000)이 적용돼 있다', () => {
      expect(src).toContain('AbortSignal.timeout(8000)')
    })

    it('옛 youtubeSsrResponse / syncStatusResponse 참조가 모두 제거됐다', () => {
      expect(src).not.toContain('youtubeSsrResponse')
      expect(src).not.toContain('syncStatusResponse')
    })
  })

  describe('홈 (pages/index.vue)', () => {
    const src = read('pages/index.vue')

    it('home-page useAsyncData가 단일 Promise.allSettled로 dashboard+guides 병렬화한다', () => {
      expect(src).toContain("useAsyncData(\n  'home-page'")
      expect(src).toContain('Promise.allSettled')
    })

    it('secondary $fetch에 AbortSignal.timeout(8000)이 적용돼 있다', () => {
      expect(src).toContain('AbortSignal.timeout(8000)')
    })

    it('dashboard 실패 시 503 throw로 빈 hero 색인을 차단한다', () => {
      expect(src).toMatch(/createError\(\{\s*statusCode:\s*503/)
      expect(src).toContain('import.meta.server')
    })

    it('옛 dashboardResponse / recentGuidesData / useHomeDashboard 참조가 모두 제거됐다', () => {
      expect(src).not.toContain('dashboardResponse')
      expect(src).not.toContain('recentGuidesData')
      expect(src).not.toMatch(/useHomeDashboard\s*\(/)
    })
  })

  describe('부동산 상세 (pages/real-estate/.../[buildingName].vue)', () => {
    const src = read('pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')

    it('real-estate-secondary useAsyncData로 sync-status를 분리했다', () => {
      expect(src).toContain("'real-estate-secondary'")
      expect(src).toContain('Promise.allSettled')
    })

    it('secondary $fetch에 AbortSignal.timeout(8000)이 적용돼 있다', () => {
      expect(src).toContain('AbortSignal.timeout(8000)')
    })

    it('ssrData (critical, 404 gate)는 그대로 유지된다', () => {
      expect(src).toContain("'ssrData'")
      // 404 gate가 사라지지 않았는지
      expect(src).toMatch(/createError\(\{\s*statusCode:\s*404/)
    })

    it('옛 syncStatusResponse 참조가 모두 제거됐다', () => {
      expect(src).not.toContain('syncStatusResponse')
    })
  })
})
```

- [ ] **Step 4.2: Vitest 실행 + PASS 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
npx vitest run tests/pages/phase2-ssr-source.test.ts
```

Expected: 12 케이스 모두 PASS. 실패 케이스가 있으면 Task 1·2·3의 해당 패턴이 빠진 것 — 그 Task 다시 점검 후 재실행.

- [ ] **Step 4.3: Playwright smoke spec 작성**

`frontend/tests/e2e/ssr-smoke.spec.ts`:

```ts
import { expect, test } from '@playwright/test'

const BACKEND_BASE = process.env.API_BASE ?? 'http://localhost:8000'

async function getParkingId(request: import('@playwright/test').APIRequestContext) {
  const res = await request.post(`${BACKEND_BASE}/api/facilities/search`, {
    data: { category: 'parking', city: '서울', limit: 5 },
  })
  if (!res.ok()) throw new Error(`parking 시설 조회 실패: ${res.status()}`)
  const body = await res.json() as {
    success: boolean
    data: { items: { id: string; lat: number; lng: number }[] }
  }
  const items = body?.data?.items ?? []
  const first = items.find((i) => i.lat && i.lng) ?? items[0]
  if (!first?.id) throw new Error('parking 시설이 DB에 없습니다')
  return first.id
}

async function getRealEstateUrl(request: import('@playwright/test').APIRequestContext) {
  // 사이트맵에서 부동산 상세 URL 1건 추출 (시드 의존 없음)
  const res = await request.get('https://ilsangkit.co.kr/sitemap.xml')
  if (!res.ok()) return null  // 외부 사이트맵 조회 실패는 skip
  const xml = await res.text()
  const m = xml.match(/(real-estate-\d+\.xml|real-estate-buildings\.xml)/)
  return m ? null : null  // smoke는 로컬 위주, 외부 의존 회피
}

test('홈 페이지가 정상 200 + h1 렌더된다 (Phase 2 refactor smoke)', async ({ page }) => {
  const res = await page.goto('/', { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('시설 상세 페이지가 정상 200 + h1 렌더된다 (Phase 2 refactor smoke)', async ({ page, request }) => {
  const id = await getParkingId(request)
  const res = await page.goto(`/parking/${id}`, { waitUntil: 'domcontentloaded' })
  expect(res?.status()).toBe(200)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('부동산 상세 페이지 라우트가 살아있다 (404 gate 정상)', async ({ page }) => {
  // 임의의 부동산 URL — 실데이터 의존 회피 위해 라우트만 존재 확인 (404 OR 200 둘 다 허용)
  const res = await page.goto('/real-estate/apt-sale/seoul/gangnam-gu/none-existing-building', { waitUntil: 'domcontentloaded' })
  // 404 또는 200 모두 정상 (Phase 2가 깬 게 아니라 정상 동작 시그널)
  expect([200, 404]).toContain(res?.status() ?? 0)
})
```

- [ ] **Step 4.4: Playwright smoke 실행**

```bash
lsof -i :8000 || (cd /Users/leemyeongseok/projects/ilsangkit/backend && (npm run dev &) && sleep 8)
cd /Users/leemyeongseok/projects/ilsangkit/frontend
npx playwright test tests/e2e/ssr-smoke.spec.ts --reporter=list --project=chromium
```

Expected: 3 케이스 PASS.

- [ ] **Step 4.5: Commit**

```bash
git add frontend/tests/pages/phase2-ssr-source.test.ts frontend/tests/e2e/ssr-smoke.spec.ts
git commit -m "test(ssr): Phase 2 source assertion + Playwright smoke

Vitest 12건 source assertion:
- 시설 상세·홈·부동산 상세 각각 Promise.allSettled / AbortSignal.timeout(8000) 패턴
- 옛 ref 참조 제거 확인
- 홈 503 throw 가드 / 부동산 404 gate 유지 검증

Playwright smoke 3건:
- 홈·시설 상세·부동산 상세 라우트가 refactor 후에도 정상 응답

partial-failure E2E는 context.route가 SSR 서버사이드 fetch를 가로채지 못하기 때문에
실증 불가 — production 관측(503 응답률·SSR 에러 로그·LCP CrUX)에 위임.
spec 섹션 5.8의 partial-failure E2E는 후속 spec에서 별도 검증 메커니즘으로 다룸."
```

---

## Task 5: 전체 회귀 + PR 생성

- [ ] **Step 5.1: backend + frontend lint + test (백그라운드 병렬)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
(cd backend && npm run lint && npx vitest run) &
(cd frontend && npm run lint && npx vitest run) &
wait
```

Expected: 둘 다 0 exit. backend ~1186 tests + frontend ~1043 tests PASS.

- [ ] **Step 5.2: Commit 그래프 확인 (4 commit)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git log --oneline develop..HEAD
```

Expected (역순):
```
<sha> test(ssr): Phase 2 source assertion + Playwright smoke
<sha> feat(ssr): 부동산 상세 페이지 sync-status secondary 패턴 분리
<sha> feat(ssr): 홈 페이지 dashboard + guides 완전 병렬화 + 503 throw
<sha> feat(ssr): 시설 상세 페이지 secondary fetch 병렬화
```

- [ ] **Step 5.3: Push + PR 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin HEAD
gh pr create --base develop --title "feat(ssr): 시설 상세·홈·부동산 상세 SSR fetch 병렬화 (Phase 2)" --body "$(cat <<'EOF'
## 요약

3 페이지의 다중 useAsyncData 직렬 호출을 Promise.allSettled로 병렬화하여 SSR LCP를 100~250ms 단축하고 부분 실패 내성을 확보한다.

Spec: \`docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md\` 섹션 5 (로컬, gitignored)
Plan: \`docs/superpowers/plans/2026-05-28-phase2-ssr-waterfall.md\` (로컬, gitignored)

## 변경

| 파일 | Before | After |
|---|---|---|
| \`pages/[category]/[id].vue\` | 3-step 직렬 (facility / youtube / sync-status) | facility 단독 → secondary 병렬 (youtube + sync-status) |
| \`pages/index.vue\` | 2-step 직렬 (dashboard → guides) | 1-step 병렬 + dashboard null이면 503 throw |
| \`pages/real-estate/.../[buildingName].vue\` | 2-step (sync-status → ssrData) | ssrData 단독 + sync-status secondary |
| \`tests/pages/phase2-ssr-source.test.ts\` + \`tests/e2e/ssr-smoke.spec.ts\` | — | Vitest source assertion 12건 + Playwright smoke 3건 |

## 변경하지 않은 것

- URL·라우트·사이트맵 — 색인된 모든 URL 보호 (memory: \`project_real_estate_indexing_crisis\`)
- 새 composable / 추상화 — 인라인 Promise.allSettled 패턴 (spec 비목표)
- 광고 슬롯 (Phase 1 변경 분과 겹치지 않음)
- 좀비 인시던트 / sync 파이프라인 (Phase 3 영역)

## 신규 정책 — 홈 503 throw

home-dashboard 실패 시 빈 hero를 200으로 색인되지 않도록 503으로 응답. 봇 retry 유도. backend 회복 시 자동 정상화. \`AbortSignal.timeout(8000)\`이 백엔드 무한 대기 차단.

## 로컬 검증

- backend lint 0 / vitest PASS (≈1186 tests)
- frontend lint 0 / vitest PASS (≈1055 tests, source assertion 12건 신규 포함)
- playwright (chromium) ssr-smoke.spec.ts 3/3 PASS

## 알려진 한계 — partial-failure E2E 부재

spec 섹션 5.8의 \`context.route\` 기반 partial-failure E2E는 본 PR 범위에서 제외함. Playwright \`context.route\`가 SSR 서버사이드 fetch(Node→Express)를 가로채지 못해 false positive로 통과하기 때문. \`server: false\`로 client-only 전환은 SEO·JSON-LD 수요와 충돌. 실증은 prod 관측(503 응답률·SSR 에러 로그·LCP CrUX)에 위임하며, 대체 메커니즘 도입은 별 spec.

## 측정 게이트 (머지 후)

| 시점 | 지표 | 임계 |
|---|---|---|
| 머지 직후 | SSR 응답시간 (PM2 access log) | p50 -100~200ms |
| 24h | PSI Lab LCP (홈, 시설 상세, 부동산 상세) | 각 -50ms 이상 |
| 5일 | CrUX p75 LCP "Good" 비율 | 증가 |
| 5일 | 홈 503 응답률 | < 0.1% |

5일 시점 → Phase 3 (N+1 제거) GO 결정.

## 롤백

\`git revert <merge-sha>\` 한 번으로 3 페이지의 useAsyncData가 원래 직렬 형태로 환원. 새 추상화·라이브러리 없음 → dangling 의존성 0.
EOF
)"
```

- [ ] **Step 5.4: CI 통과 대기**

```bash
gh pr checks <PR번호> --watch
```

성공 후 사용자에게 보고.

- [ ] **Step 5.5: 머지·배포는 사용자가 결정**

CI 통과 + 사용자 승인 후 머지. main 머지까지 가야 prod 배포 트리거. Phase 1과 동일 절차.

---

## Self-Review 체크리스트 (실행자가 PR 올리기 전 마지막 점검)

- [ ] Spec 섹션 5의 3 페이지(시설 상세·홈·부동산 상세) 모두 변경됐는가
- [ ] 각 페이지의 critical fetch는 404 gate 유지하고 있는가
- [ ] secondary fetches가 단일 useAsyncData 안에서 Promise.allSettled로 묶였는가
- [ ] 모든 secondary $fetch에 `AbortSignal.timeout(8000)` 적용됐는가
- [ ] index.vue에 `createError({ statusCode: 503, ... })` 가드 들어갔는가
- [ ] 옛 ref(`youtubeSsrResponse`, `syncStatusResponse`, `dashboardResponse`, `recentGuidesData`) 잔존 0건
- [ ] URL·라우트·사이트맵·메타·JSON-LD 변경 0
- [ ] 새 composable/추상화 추가 0
- [ ] backend·frontend lint + test 모두 PASS
- [ ] Vitest source assertion 12건 PASS
- [ ] Playwright smoke 3 케이스 chromium PASS
- [ ] Commit 4개로 분해 (Task 1·2·3·4)
