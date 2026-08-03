# 부동산 상세 Hydration 500 에러 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산 상세 페이지가 client hydration 시점 throw로 error.vue를 표시하던 회귀를 차단한다. SSR HTML은 정상이고 사용자 브라우저에서만 500이 보이는 케이스.

**Architecture:** 두 갈래로 방어한다. (1) `[buildingName].vue`의 SSR await 호출들을 `.catch()` / `try/catch`로 감싸 SSR 측 throw 가능성을 줄인다. (2) 그래도 client hydration 시 throw하는 코드가 있을 수 있으므로 `frontend/plugins/swallow-page-errors.client.ts` plugin을 신설해 Vue `app.config.errorHandler` + `unhandledrejection` 리스너로 모든 hydration throw를 console로 흘리고 swallow한다. error.vue로 fallback되지 않게 한다.

**Tech Stack:** Nuxt 3, Vue 3 (`app.config.errorHandler`), useAsyncData/`$fetch` (ofetch), Vitest, @vue/test-utils

**Spec:** `docs/superpowers/specs/2026-05-26-real-estate-detail-hydration-error-design.md`

---

## File Structure

| 경로 | 책임 | 변경 종류 |
|---|---|---|
| `frontend/plugins/swallow-page-errors.client.ts` | Client-only Nuxt plugin. `vueApp.config.errorHandler` + `window.unhandledrejection`을 등록해 hydration throw를 swallow하고 console에 흘림 | **신규** |
| `frontend/tests/plugins/swallow-page-errors.test.ts` | 위 plugin의 단위 테스트 | **신규** |
| `frontend/components/realEstate/NearbyFacilities.vue` | 라인 130-138 / 150-159의 두 `useAsyncData` 콜백을 `.catch(() => null)`로 감싸 fetch reject를 throw 대신 null로 정리 | **수정** |
| `frontend/tests/components/realEstate/NearbyFacilities.test.ts` | 두 fetch reject 시나리오 케이스 추가 | **수정** |
| `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` | 라인 647-650 dynamic import `.catch()`, 라인 736 `useAsyncData('real-estate-sync-status')` 콜백 `.catch()`, 라인 948-996 `useAsyncData('re-detail-new-...')` 콜백 전체 `try/catch` 안전화 | **수정** |
| `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts` | helper 함수 reject 시 mount 성공 검증 케이스 추가 | **수정** |

분해 원칙: A-2 plugin이 가장 큰 단독 unit이라 먼저 만들고 (Task 1), 그 다음 좁은 컴포넌트(NearbyFacilities, Task 2), 마지막 페이지(buildingName, Task 3) 순으로 작업. 각 Task는 자체 테스트 + 커밋으로 종결.

---

## Task 1: A-2 글로벌 errorHandler plugin

**Files:**
- Create: `frontend/plugins/swallow-page-errors.client.ts`
- Create: `frontend/tests/plugins/swallow-page-errors.test.ts`

**Why:** Client hydration 시 발생하는 throw가 Nuxt의 default error handling을 트리거해 페이지를 error.vue로 전환한다. plugin이 errorHandler를 먼저 잡아 swallow하면 페이지가 살아남는다.

- [ ] **Step 1: failing test 작성**

```ts
// frontend/tests/plugins/swallow-page-errors.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

describe('swallow-page-errors.client', () => {
  beforeEach(() => {
    consoleErrorSpy.mockClear()
  })

  it('vueApp.config.errorHandler가 throw를 console.error로 흘리고 swallow한다', async () => {
    const mod = await import('~/plugins/swallow-page-errors.client')
    const plugin = mod.default

    const fakeErrorHandler = vi.fn()
    const nuxtApp = {
      vueApp: { config: { errorHandler: fakeErrorHandler } },
    } as unknown as Parameters<typeof plugin>[0]

    // Nuxt plugin은 함수
    await (plugin as (app: typeof nuxtApp) => void | Promise<void>)(nuxtApp)

    const installed = nuxtApp.vueApp.config.errorHandler
    expect(installed).not.toBe(fakeErrorHandler)
    expect(typeof installed).toBe('function')

    // 새 핸들러가 throw를 swallow하는지
    const err = new Error('hydration boom')
    installed!(err, null, 'render hook')
    expect(consoleErrorSpy).toHaveBeenCalledWith('[hydration swallowed]', { err, info: 'render hook' })
    // 원래 errorHandler에도 위임
    expect(fakeErrorHandler).toHaveBeenCalledWith(err, null, 'render hook')
  })

  it('원본 errorHandler가 없을 때도 throw 안 함', async () => {
    const mod = await import('~/plugins/swallow-page-errors.client')
    const plugin = mod.default

    const nuxtApp = {
      vueApp: { config: { errorHandler: undefined as undefined | ((...args: unknown[]) => unknown) } },
    } as unknown as Parameters<typeof plugin>[0]

    await (plugin as (app: typeof nuxtApp) => void | Promise<void>)(nuxtApp)
    const installed = nuxtApp.vueApp.config.errorHandler
    expect(() => installed!(new Error('x'), null, 'info')).not.toThrow()
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Run: `cd frontend && npx vitest run tests/plugins/swallow-page-errors.test.ts`
Expected: FAIL — `Cannot find module '~/plugins/swallow-page-errors.client'` (파일이 아직 없음)

- [ ] **Step 3: plugin 구현**

```ts
// frontend/plugins/swallow-page-errors.client.ts
/**
 * Client hydration 시 발생하는 Vue throw를 swallow해 error.vue 전환을 차단한다.
 *
 * 배경: 부동산 상세 페이지가 hydration 시 throw해 (정확한 위치는 단계 B에서 추적)
 * `@unhead/vue`의 onBeforeUnmount이 instance 없이 dispose 호출 → undefined.dispose() →
 * Nuxt가 error.vue로 fallback. SSR HTML은 정상으로 응답된 상태인데 사용자만 500을 본다.
 *
 * 이 plugin은 throw를 console.error로 흘리고 swallow한다. 단계 B에서 root cause가
 * 식별되어 핀포인트 fix 적용된 후 이 plugin은 제거 가능하다.
 */
export default defineNuxtPlugin((nuxtApp) => {
  const original = nuxtApp.vueApp.config.errorHandler
  nuxtApp.vueApp.config.errorHandler = (err, instance, info) => {
    // eslint-disable-next-line no-console
    console.error('[hydration swallowed]', { err, info })
    if (typeof original === 'function') original(err, instance, info)
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', (evt) => {
      // eslint-disable-next-line no-console
      console.error('[hydration promise reject]', evt.reason)
    })
  }
})
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

Run: `cd frontend && npx vitest run tests/plugins/swallow-page-errors.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add frontend/plugins/swallow-page-errors.client.ts frontend/tests/plugins/swallow-page-errors.test.ts
git commit -m "feat(real-estate): hydration throw swallow plugin

Client hydration 시 throw를 console.error로 흘리고 swallow해 부동산 상세
페이지가 error.vue로 fallback되는 회귀를 차단한다. SSR HTML은 정상으로
응답되니 사용자에게 정상 페이지가 보이게 된다.

Root cause(@unhead/vue dispose 에러의 primary throw)는 단계 B에서 추적.
이 plugin은 그 후 제거 가능."
```

---

## Task 2: NearbyFacilities throw safety

**Files:**
- Modify: `frontend/components/realEstate/NearbyFacilities.vue:130-159`
- Modify: `frontend/tests/components/realEstate/NearbyFacilities.test.ts`

**Why:** SSR 측에서 `$fetch` reject가 useAsyncData throw로 이어지면 hydration payload에 `_errors` 카운트가 증가한다. fetch에 `.catch(() => null)`을 붙이면 reject가 null로 흡수돼 SSR throw 가능성을 한 발 더 줄인다.

- [ ] **Step 1: 새 테스트 케이스 추가 (failing)**

```ts
// frontend/tests/components/realEstate/NearbyFacilities.test.ts
// 기존 imports 아래, 마지막 describe 안 또는 새 describe로 추가
import { mount } from '@vue/test-utils'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'

describe('NearbyFacilities — fetch failure resilience', () => {
  it('transit fetch가 reject돼도 mount 성공하고 빈 transit 카드', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/api/transit/nearby')) return Promise.reject(new Error('network'))
      // facilities/search 성공
      return Promise.resolve({ data: { items: [] } })
    }))

    const wrapper = mount(NearbyFacilities, {
      props: { lat: 37.5, lng: 127.0 },
    })
    await flushPromises()
    // mount는 throw 없이 끝나야 한다
    expect(wrapper.exists()).toBe(true)
    // 지하철역 카드 비어있음 텍스트
    expect(wrapper.text()).toContain('주변에 등록된 시설이 없습니다')
  })

  it('두 fetch 모두 reject돼도 throw 없이 mount', async () => {
    vi.stubGlobal('$fetch', vi.fn().mockRejectedValue(new Error('network')))
    const wrapper = mount(NearbyFacilities, {
      props: { lat: 37.5, lng: 127.0 },
    })
    await flushPromises()
    expect(wrapper.exists()).toBe(true)
  })
})
```

`flushPromises`는 `@vue/test-utils`에서 import 필요 — 파일 최상단 import에 추가:

```ts
import { flushPromises } from '@vue/test-utils'
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/NearbyFacilities.test.ts`
Expected: 새 케이스 2개 FAIL (fetch reject가 useAsyncData에서 throw로 전파)

- [ ] **Step 3: NearbyFacilities.vue 라인 130-159 수정**

```vue
<!-- frontend/components/realEstate/NearbyFacilities.vue 라인 130-159 -->
const { data: transitResponse, status: transitStatus } = await useAsyncData<{ data: { stations: Station[] } } | null>(
  `nearby-transit-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch<{ data: { stations: Station[] } }>(`${apiBase}/api/transit/nearby`, {
      query: { lat: props.lat, lng: props.lng, radius: NEARBY_RADIUS_METERS },
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[NearbyFacilities transit fetch failed]', e)
      return null
    })
  },
)
```

```vue
const { data: facilityResponse, status } = await useAsyncData(
  `nearby-facilities-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch(`${apiBase}/api/facilities/search`, {
      method: 'POST',
      body: { lat: props.lat, lng: props.lng, radius: NEARBY_RADIUS_METERS, limit: 100 },
    }).catch((e) => {
      // eslint-disable-next-line no-console
      console.error('[NearbyFacilities facilities fetch failed]', e)
      return null
    })
  },
)
```

- [ ] **Step 4: 테스트 실행 — PASS 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/NearbyFacilities.test.ts`
Expected: 11 tests PASS (기존 9 + 신규 2)

- [ ] **Step 5: 전체 컴포넌트 테스트 회귀 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate`
Expected: 모두 PASS

- [ ] **Step 6: Commit**

```bash
git add frontend/components/realEstate/NearbyFacilities.vue frontend/tests/components/realEstate/NearbyFacilities.test.ts
git commit -m "fix(real-estate): NearbyFacilities fetch reject를 null로 흡수

SSR 측 useAsyncData throw 가능성 차단. fetch reject 시 hydration payload의
_errors 카운트가 증가하지 않게 함. console.error로 로그만 남김."
```

---

## Task 3: [buildingName].vue SSR await 안전화

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:647-650, 736, 948-996`
- Modify: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`

**Why:** 페이지 setup의 dynamic import / useAsyncData callback이 SSR 또는 hydration에서 throw해 컴포넌트 인스턴스가 미완성 상태로 unmount되면 unhead beforeUnmount이 dispose throw. await 호출들에 catch를 붙여 SSR throw 가능성을 한 단계 더 줄임.

- [ ] **Step 1: 새 테스트 케이스 추가 (failing)**

`frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`의 `vi.mock('~/composables/useRealEstate', ...)` 위치를 찾아, 새 케이스를 같은 파일 끝에 추가:

```ts
// 기존 describe 블록 안 또는 새 describe로 추가
import { mountSuspended } from '@nuxt/test-utils/runtime'

describe('real-estate buildingName page — helper reject resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('useRealEstate helper가 reject돼도 page mount는 성공 (error.vue로 안 빠짐)', async () => {
    // useRealEstate mock을 동적으로 reject로 변경
    vi.doMock('~/composables/useRealEstate', () => ({
      useRealEstate: () => ({
        searchTransactions: vi.fn().mockRejectedValue(new Error('boom')),
        getTransactionStats: vi.fn().mockRejectedValue(new Error('boom')),
        getBuildingInfo: vi.fn().mockRejectedValue(new Error('boom')),
        getAreaGroups: vi.fn().mockRejectedValue(new Error('boom')),
        getComplexList: vi.fn().mockRejectedValue(new Error('boom')),
      }),
    }))

    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper).toBeDefined()
    // setBreadcrumbSchema이 호출됐다는 건 setup이 끝까지 갔다는 뜻
    expect(mockSetBreadcrumbSchema).toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실행 — FAIL 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts`
Expected: 새 케이스 FAIL — mount throw or setBreadcrumbSchema 미호출

- [ ] **Step 3: dynamic import에 catch 추가 (라인 647-650)**

```vue
<!-- 기존 -->
const { useRealEstate } = await import('~/composables/useRealEstate')
const { searchTransactions, getTransactionStats, getBuildingInfo, getAreaGroups, getComplexList, getApartmentPriceAnalysis, getNearby } = useRealEstate()
const { useApiBase } = await import('~/composables/useApiBase')
const apiBase = useApiBase()
```

```vue
<!-- 변경: catch로 import 실패도 graceful -->
const realEstateMod = await import('~/composables/useRealEstate').catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[building setup] useRealEstate import failed', e)
  return null
})
const { searchTransactions, getTransactionStats, getBuildingInfo, getAreaGroups, getComplexList, getApartmentPriceAnalysis, getNearby } = realEstateMod
  ? realEstateMod.useRealEstate()
  : {
      searchTransactions: () => Promise.resolve({ items: [], total: 0, page: 1, totalPages: 0 }),
      getTransactionStats: () => Promise.resolve({ monthly: [], summary: null }),
      getBuildingInfo: () => Promise.resolve(null),
      getAreaGroups: () => Promise.resolve([]),
      getComplexList: () => Promise.resolve({ items: [], total: 0, page: 1, totalPages: 0 }),
      getApartmentPriceAnalysis: () => Promise.resolve(null),
      getNearby: () => Promise.resolve({ apt: [], villa: [], offitel: [] }),
    }

const apiBaseMod = await import('~/composables/useApiBase').catch((e) => {
  // eslint-disable-next-line no-console
  console.error('[building setup] useApiBase import failed', e)
  return null
})
const apiBase = apiBaseMod ? apiBaseMod.useApiBase() : ''
```

- [ ] **Step 4: `useAsyncData('real-estate-sync-status')` 콜백 안전화 (라인 736 부근)**

`Read` 명령으로 라인 730-770 확인 후 `$fetch(...)` 호출에 `.catch(() => null)`을 붙인다. 예시 패턴:

```vue
<!-- 기존 -->
const { data: syncStatusResponse } = await useAsyncData('real-estate-sync-status', () =>
  $fetch(`${apiBase}/api/meta/sync-status`)
)
```

```vue
<!-- 변경 -->
const { data: syncStatusResponse } = await useAsyncData('real-estate-sync-status', () =>
  $fetch(`${apiBase}/api/meta/sync-status`).catch((e) => {
    // eslint-disable-next-line no-console
    console.error('[building setup] sync-status fetch failed', e)
    return null
  })
)
```

(실제 라인 내용은 파일을 읽어 정확한 변수명/url과 맞춰야 한다.)

- [ ] **Step 5: `useAsyncData('re-detail-new-...')` 콜백 try/catch wrap (라인 948-996)**

콜백 전체를 try/catch로 감싼다:

```vue
const { data: ssrData, error: ssrError, status: ssrStatus } = await useAsyncData(
  `re-detail-new-${realEstateType}-${citySlugParam}-${districtSlugParam}-${route.params.buildingName}`,
  async () => {
    try {
      const { bjdCode, building: primedBuilding } = await resolveBuildingContext()

      const [statsResult, txResult, infoResult, areaResult] = await Promise.allSettled([
        bjdCode
          ? getTransactionStats(apiSlug.value, bjdCode, buildingName.value, selectedMonths.value ?? undefined)
          : Promise.resolve(EMPTY_STATS_RESPONSE),
        searchTransactions(apiSlug.value, buildTransactionSearchParams(bjdCode, 1)),
        primedBuilding
          ? Promise.resolve(primedBuilding)
          : getBuildingInfo(apiSlug.value, bjdCode, buildingName.value),
        bjdCode
          ? getAreaGroups(apiSlug.value, bjdCode, buildingName.value)
          : Promise.resolve([]),
      ])
      const resolvedBuildingInfo = infoResult.status === 'fulfilled' ? infoResult.value : null
      let facilitySummarySSR: string | null = null
      if (resolvedBuildingInfo?.lat && resolvedBuildingInfo?.lng) {
        try {
          const facilityRes = await $fetch(`${apiBase}/api/facilities/search`, {
            method: 'POST',
            body: { lat: resolvedBuildingInfo.lat, lng: resolvedBuildingInfo.lng, radius: 1000 },
          })
          const facilityItems: any[] = (facilityRes as any)?.data?.items ?? (facilityRes as any)?.items ?? []
          const DISPLAY_CATS = ['school', 'childcare', 'park', 'sports', 'hospital', 'pharmacy'] as const
          const FACILITY_LABELS: Record<string, string> = {
            school: '학교', childcare: '어린이집', park: '공원', sports: '체육시설', hospital: '병원', pharmacy: '약국',
          }
          const parts = DISPLAY_CATS
            .map(cat => ({ cat, count: facilityItems.filter((i: any) => i.category === cat).length }))
            .filter(({ count }) => count > 0)
            .slice(0, 3)
            .map(({ cat, count }) => `${FACILITY_LABELS[cat]} ${count}곳`)
          if (parts.length > 0) facilitySummarySSR = parts.join(', ') + ' 등 생활시설'
        } catch {
          // best-effort — facility summary is optional SEO enhancement
        }
      }
      return {
        bjdCode,
        statsResponse: statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS_RESPONSE,
        transactions: txResult.status === 'fulfilled' ? txResult.value : EMPTY_TRANSACTIONS,
        buildingInfo: resolvedBuildingInfo,
        areaGroups: areaResult.status === 'fulfilled' ? areaResult.value : [],
        facilitySummary: facilitySummarySSR,
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[building SSR callback swallowed]', e)
      return {
        bjdCode: '',
        statsResponse: EMPTY_STATS_RESPONSE,
        transactions: EMPTY_TRANSACTIONS,
        buildingInfo: null,
        areaGroups: [],
        facilitySummary: null,
      }
    }
  },
)
```

- [ ] **Step 6: 테스트 실행 — PASS 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts`
Expected: 모든 케이스 PASS

- [ ] **Step 7: 전체 frontend 테스트 회귀 확인**

Run: `cd frontend && npx vitest run`
Expected: 모두 PASS (1040+ tests)

- [ ] **Step 8: Lint + Type check**

Run:
```bash
cd frontend && npm run lint 2>&1 | tail -5
npx vue-tsc --noEmit 2>&1 | grep -E "buildingName|NearbyFacilities|swallow-page-errors" | head -10
```
Expected:
- lint: 0 errors (기존 warning 그대로)
- TS: 신규 에러 없음 (이전 baseline과 동일)

- [ ] **Step 9: Commit**

```bash
git add frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts
git commit -m "fix(real-estate): buildingName SSR await 호출 안전화

- dynamic import (useRealEstate, useApiBase)에 .catch + fallback object
- useAsyncData(real-estate-sync-status) \$fetch에 .catch(() => null)
- useAsyncData(re-detail-new) 콜백 전체 try/catch wrap + EMPTY fallback

SSR throw 가능성을 한 단계 더 차단. Hydration throw는 별도 plugin
(swallow-page-errors.client.ts)이 잡음."
```

---

## Task 4: 로컬·운영 검증 + PR

**Files:** 변경 없음 (검증만)

- [ ] **Step 1: 로컬 dev 서버에서 부동산 상세 페이지 정상 표시 확인**

```bash
# dev 서버 reload 보장 (HMR으로 plugin 등록 안 될 수 있으니 재기동)
pm2 list 2>/dev/null | grep -q ilsangkit-frontend && pm2 restart ilsangkit-frontend || true
# (로컬 dev는 npm run dev이라 별도 재기동 필요 시 사용자 터미널)
```

브라우저 또는 Playwright로 `http://localhost:3000/real-estate/apt-sale/ulsan/nam/세양청구마을` 접속.

Expected:
- `<title>` 정상 (세양청구마을 …)
- "오류가 발생했습니다" 미표시
- console에 `[hydration swallowed]` 로그 가능 (그게 있어도 페이지는 정상)

- [ ] **Step 2: develop 브랜치에서 새 fix 브랜치 생성**

```bash
git checkout develop && git pull origin develop
git checkout -b fix/real-estate-detail-hydration-error
git rebase develop  # 위 3개 커밋이 모두 이 브랜치에 와있어야 함
```

(Task 1~3가 develop 위에 어떻게 쌓였는지에 따라 cherry-pick이나 rebase 필요할 수 있음. 단일 세션 작업이라면 새 branch에서 바로 작업했을 것)

- [ ] **Step 3: push + PR 생성**

```bash
git push -u origin fix/real-estate-detail-hydration-error
gh pr create --base develop --head fix/real-estate-detail-hydration-error \
  --title "fix(real-estate): 부동산 상세 hydration 500 차단" \
  --body "$(cat <<'EOF'
spec: docs/superpowers/specs/2026-05-26-real-estate-detail-hydration-error-design.md

## 문제
부동산 상세 페이지가 사용자 브라우저에서 항상 'error 500' 표시. SSR HTML/payload는 정상이지만 client hydration 시 throw → @unhead beforeUnmount이 instance 없이 dispose 호출 → error.vue fallback.

## 변경
- (A-2) `plugins/swallow-page-errors.client.ts` 신설: hydration throw swallow
- (A-1) NearbyFacilities 2개 \$fetch에 .catch
- (A-1) [buildingName].vue dynamic import + useAsyncData 콜백 안전화

## 검증
- 로컬 dev에서 부동산 상세 정상 표시 확인 (Playwright)
- frontend 전체 vitest PASS, lint 0 errors, 신규 TS 에러 없음

## 안 한 것 (별도 PR)
- Primary throw 정밀 추적 (단계 B): sourcemap 활성화 + debugger
EOF
)"
```

- [ ] **Step 4: CI 통과 + develop 머지**

```bash
# CI 상태 확인
gh pr checks $(gh pr list --head fix/real-estate-detail-hydration-error --json number --jq '.[0].number')
# auto-merge
gh pr merge $(gh pr list --head fix/real-estate-detail-hydration-error --json number --jq '.[0].number') --squash --delete-branch --auto
```

Expected: test-backend + test-frontend PASS → develop 자동 머지.

- [ ] **Step 5: develop → main release PR + 자동 배포**

```bash
gh pr create --base main --head develop \
  --title "release: 부동산 상세 hydration 500 차단" \
  --body "fix/real-estate-detail-hydration-error 운영 배포"
gh pr merge $(gh pr list --base main --head develop --json number --jq '.[0].number') --merge --auto
```

Deploy to Cafe24 워크플로우가 main push에서 자동 트리거되어 ~7분 후 운영 반영.

- [ ] **Step 6: 운영 검증**

```bash
# 배포 완료 확인
gh run list --workflow="Deploy to Cafe24" --limit 1
# 부동산 상세 정상 표시 확인 (Playwright 운영 URL)
```

Playwright 또는 브라우저로 `https://ilsangkit.co.kr/real-estate/apt-sale/ulsan/nam/세양청구마을` 접속해서 정상 페이지 + console error 패턴 확인.

Expected:
- 페이지 title이 매물명으로 정상
- "오류가 발생했습니다" 미표시
- console에 `[hydration swallowed]` 또는 `[hydration promise reject]` 로그가 보일 수 있음 (단계 B 진단용 trace)

---

## 자체 검증 (Self-Review)

스펙 대비 누락 없는지 마지막 점검.

| 스펙 요구사항 | 매핑된 Task |
|---|---|
| A-1: `[buildingName].vue` dynamic import `.catch()` | Task 3 Step 3 |
| A-1: `useAsyncData('real-estate-sync-status')` `.catch()` | Task 3 Step 4 |
| A-1: `useAsyncData('re-detail-new')` 콜백 try/catch | Task 3 Step 5 |
| A-1: `NearbyFacilities` 두 fetch `.catch()` | Task 2 Step 3 |
| A-2: `plugins/swallow-page-errors.client.ts` 신설 | Task 1 |
| A-2: `vueApp.config.errorHandler` 등록 | Task 1 Step 3 |
| A-2: `window.unhandledrejection` 리스너 | Task 1 Step 3 |
| 테스트: NearbyFacilities reject 케이스 2개 | Task 2 Step 1 |
| 테스트: [buildingName] helper reject 케이스 | Task 3 Step 1 |
| 테스트: plugin errorHandler 등록·swallow | Task 1 Step 1 |
| 검증: vitest run / lint / vue-tsc | Task 3 Step 7-8 |
| 검증: 로컬 Playwright | Task 4 Step 1 |
| 검증: 운영 Playwright | Task 4 Step 6 |
| Rollback: PR revert | (PR 본문 명시) |

모두 매핑됨. 단계 B는 명시적으로 별도 PR — 이번 plan에 포함 안 됨.

---

## 안전 가드 (실행 중 발생할 수 있는 상황)

- Task 1 Step 2에서 plugin 테스트가 처음부터 PASS면 → `~/plugins/` alias 매핑이 vitest config에 다르게 잡혀 있을 가능성. `vitest.config.ts`의 alias를 확인 후 import 경로 보정.
- Task 3 Step 5에서 `EMPTY_STATS_RESPONSE`, `EMPTY_TRANSACTIONS` 같은 상수가 미정의면 → 같은 파일 상단(라인 891-892)에 이미 정의됐다. import 누락 없는지 확인.
- Task 4 Step 1에서 로컬에 plugin이 안 잡히면 → `nuxt prepare` 또는 dev 서버 재기동. plugin은 file name이 `.client.ts`라 client-only 자동 인식.
- 운영 배포 후 부동산 상세가 여전히 500이면 → spec의 "안전 가드" 섹션 참고. 단계 B (primary throw 정밀 추적) 우선순위 격상.
