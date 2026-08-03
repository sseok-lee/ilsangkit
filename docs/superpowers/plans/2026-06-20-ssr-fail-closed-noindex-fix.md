# SSR fail-closed noindex 회귀 수정 (Approach A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산/지역 SSR 페이지가 일시적 백엔드 fetch 실패를 영구 `noindex`로 굳히지 않도록(fail-open) 고치고, 실패 시 soft 503 + no-store로 응답해 크롤러가 재방문하게 한다.

**Architecture:** 순수 판정 헬퍼 `shouldNoindexSsr({positiveNoindex, fetchFailed, confirmedEmpty})`를 신설해 "일시 실패면 절대 noindex 안 함" 규칙을 한 곳에 모은다. `getBuildingInfo`의 `catch{return null}`를 "404→null / 그 외→throw"로 바꿔 일시 장애와 진짜 없는 건물을 구분한다. 영향 4개 페이지(부동산 건물상세, 지역허브 2종, 부동산 지역목록)가 이 헬퍼와 `useAsyncData`의 `error`로 fetch 실패를 판별하고, 실패 시 `markDegradedResponse()`로 503+no-store를 낸다.

**Tech Stack:** Nuxt 3 (SSR) + Vue 3 + TypeScript, Vitest(+@vue/test-utils, happy-dom), ofetch(`$fetch`).

## Global Constraints

- **노출 정책**: `noindex`를 출력하는 페이지는 `rel=canonical`을 출력하지 않는다 (`.omc/notes/noindex-canonical-policy.md`). 기존 코드가 `canonical: isNoindex ? false : undefined`로 이미 연동 — 그대로 유지.
- **SWR 캐시 우회**: degraded 응답은 반드시 `cache-control: no-store`. routeRules `'/real-estate/**': { swr: 300 }`, 도시 허브 `'/seoul/**' 등: { swr: 1800 }` 때문에 no-store 없으면 503이 캐시된다.
- **`noindex`는 적극 증거에만**: 지번 패턴(`INVALID_BUILDING_NAME`) 또는 백엔드 404 확정. 일시 실패엔 절대 금지.
- **테스트 필수** (`feedback_test_verification`): 커밋 전 `cd frontend && npm run test` 전체 green. 기존 실패도 즉시 수정.
- **PR 기반** (`feedback_pr_workflow`): develop 브랜치 작업, main 직접 커밋 금지.
- **ESM/별칭**: frontend는 `~/` 별칭(`~/utils/...`, `~/composables/...`). 테스트도 동일.

---

## File Structure

**신규**
- `frontend/utils/ssrIndexability.ts` — 순수 noindex 판정 헬퍼(`shouldNoindexSsr`). 단일 책임: "fetch 실패/빈값/적극증거 → noindex 여부".
- `frontend/utils/ssrIndexability.test.ts` — 위 단위 테스트.
- `frontend/composables/useDegradedResponse.ts` — `markDegradedResponse()`: SSR 이벤트에 503 + no-store 세팅(클라이언트 no-op).
- `frontend/tests/composables/useDegradedResponse.test.ts` — 위 단위 테스트.

**수정**
- `frontend/composables/useRealEstate.ts` — `getBuildingInfo` catch 분리.
- `frontend/tests/composables/useRealEstate.test.ts` — getBuildingInfo 테스트 추가.
- `frontend/utils/realEstateNoindex.ts` — `fetchFailed` 인자, `shouldNoindexSsr`에 위임.
- `frontend/tests/utils/realEstateNoindex.test.ts` — fetchFailed 케이스 추가.
- `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — SSR 로더가 `infoFetchFailed` 추적, noindex에 전달, degraded 응답.
- `frontend/pages/[city]/index.vue` — `.catch(()=>null)` 제거, `error`로 fetchFailed 판별.
- `frontend/pages/[city]/[district]/index.vue` — 동일.
- `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue` — `useAsyncData` `error`로 fetchFailed 판별.
- `frontend/tests/pages/districtHubNoindex.test.ts` — fetch 실패 시 noindex 미발화 케이스 추가.

**불변**: `frontend/utils/areaNoindex.ts`(이미 fail-open), `frontend/utils/realEstateBuildingName.ts`, 백엔드(404/500 이미 구분).

---

## Task 1: 순수 판정 헬퍼 `shouldNoindexSsr`

**Files:**
- Create: `frontend/utils/ssrIndexability.ts`
- Test: `frontend/utils/ssrIndexability.test.ts`

**Interfaces:**
- Produces: `shouldNoindexSsr(input: { positiveNoindex?: boolean; fetchFailed: boolean; confirmedEmpty: boolean }): boolean`

- [ ] **Step 1: 실패 테스트 작성**

Create `frontend/utils/ssrIndexability.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'

describe('shouldNoindexSsr', () => {
  it('positiveNoindex(지번 등 적극증거)면 fetchFailed/confirmedEmpty 무관하게 noindex', () => {
    expect(shouldNoindexSsr({ positiveNoindex: true, fetchFailed: true, confirmedEmpty: false })).toBe(true)
    expect(shouldNoindexSsr({ positiveNoindex: true, fetchFailed: false, confirmedEmpty: false })).toBe(true)
  })

  it('일시 실패(fetchFailed)면 절대 noindex 안 함 (회귀 핵심)', () => {
    expect(shouldNoindexSsr({ fetchFailed: true, confirmedEmpty: true })).toBe(false)
    expect(shouldNoindexSsr({ fetchFailed: true, confirmedEmpty: false })).toBe(false)
  })

  it('진짜 빈값(confirmedEmpty)이고 실패 아니면 noindex', () => {
    expect(shouldNoindexSsr({ fetchFailed: false, confirmedEmpty: true })).toBe(true)
  })

  it('전부 아니면 색인(false)', () => {
    expect(shouldNoindexSsr({ fetchFailed: false, confirmedEmpty: false })).toBe(false)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run utils/ssrIndexability.test.ts`
Expected: FAIL — `Failed to resolve import "~/utils/ssrIndexability"` (모듈 없음).

- [ ] **Step 3: 최소 구현 작성**

Create `frontend/utils/ssrIndexability.ts`:

```ts
/**
 * SSR 페이지의 noindex 출력 여부 판정 (순수 함수).
 *
 * 원칙: 일시적 fetch 실패(fetchFailed)는 절대 noindex로 굳히지 않는다(fail-open).
 * noindex는 (1) 적극 증거(positiveNoindex: 지번 패턴 등) 또는
 * (2) fetch 성공 + 진짜 빈값(confirmedEmpty)일 때만.
 */
export interface SsrIndexabilityInput {
  /** 지번 패턴 등, fetch와 무관한 색인부적합 확정 증거. true면 무조건 noindex. */
  positiveNoindex?: boolean
  /** SSR fetch가 일시 실패(reject/5xx/timeout/network)했는가. true면 절대 noindex 안 함. */
  fetchFailed: boolean
  /** fetch 성공 + 엔티티가 진짜 비어있음(백엔드 404/빈 결과 확정). */
  confirmedEmpty: boolean
}

export function shouldNoindexSsr(input: SsrIndexabilityInput): boolean {
  if (input.positiveNoindex) return true
  if (input.fetchFailed) return false
  return input.confirmedEmpty
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run utils/ssrIndexability.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/ssrIndexability.ts frontend/utils/ssrIndexability.test.ts
git commit -m "feat(seo): SSR noindex 판정 순수 헬퍼 shouldNoindexSsr (fail-open)"
```

---

## Task 2: degraded 응답 헬퍼 `markDegradedResponse`

**Files:**
- Create: `frontend/composables/useDegradedResponse.ts`
- Test: `frontend/tests/composables/useDegradedResponse.test.ts`

**Interfaces:**
- Consumes: Nuxt 자동 import `useRequestEvent()`, `setResponseStatus()`, `setResponseHeader()`.
- Produces: `markDegradedResponse(statusCode?: number): void` (기본 503).

- [ ] **Step 1: 실패 테스트 작성**

Create `frontend/tests/composables/useDegradedResponse.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const setResponseStatus = vi.fn()
const setResponseHeader = vi.fn()
let mockEvent: unknown = { __isEvent: true }

vi.stubGlobal('useRequestEvent', () => mockEvent)
vi.stubGlobal('setResponseStatus', setResponseStatus)
vi.stubGlobal('setResponseHeader', setResponseHeader)

import { markDegradedResponse } from '~/composables/useDegradedResponse'

describe('markDegradedResponse', () => {
  beforeEach(() => {
    setResponseStatus.mockClear()
    setResponseHeader.mockClear()
    mockEvent = { __isEvent: true }
  })

  it('SSR 이벤트가 있으면 503 + cache-control:no-store 설정', () => {
    markDegradedResponse()
    expect(setResponseStatus).toHaveBeenCalledWith(mockEvent, 503)
    expect(setResponseHeader).toHaveBeenCalledWith(mockEvent, 'cache-control', 'no-store')
  })

  it('statusCode 인자를 따른다', () => {
    markDegradedResponse(502)
    expect(setResponseStatus).toHaveBeenCalledWith(mockEvent, 502)
  })

  it('이벤트가 없으면(클라이언트) no-op', () => {
    mockEvent = undefined
    markDegradedResponse()
    expect(setResponseStatus).not.toHaveBeenCalled()
    expect(setResponseHeader).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useDegradedResponse.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 최소 구현 작성**

Create `frontend/composables/useDegradedResponse.ts`:

```ts
/**
 * SSR 응답을 "일시 degraded"로 표시한다.
 * - HTTP 503 + cache-control:no-store → 크롤러는 기존 색인 유지+재방문, Nitro SWR 캐시 우회.
 * - 본문은 그대로 렌더(throw 안 함)되어 실사용자는 클라이언트 refetch로 정상 표시.
 * - 클라이언트(SSR 이벤트 없음)에서는 no-op.
 *
 * useRequestEvent/setResponseStatus/setResponseHeader 는 Nuxt 자동 import.
 */
export function markDegradedResponse(statusCode = 503): void {
  const event = useRequestEvent()
  if (!event) return
  setResponseStatus(event, statusCode)
  setResponseHeader(event, 'cache-control', 'no-store')
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useDegradedResponse.test.ts`
Expected: PASS (3 passed).

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useDegradedResponse.ts frontend/tests/composables/useDegradedResponse.test.ts
git commit -m "feat(seo): SSR degraded 응답 헬퍼 markDegradedResponse (503+no-store)"
```

---

## Task 3: `getBuildingInfo` catch 분리 (404 vs 일시 장애)

**Files:**
- Modify: `frontend/composables/useRealEstate.ts:95-110`
- Test: `frontend/tests/composables/useRealEstate.test.ts` (describe 블록 추가)

**Interfaces:**
- Produces: `getBuildingInfo(type, bjdCode, buildingName): Promise<BuildingInfo | null>` — 404면 `null`, 그 외 에러는 throw.

- [ ] **Step 1: 실패 테스트 작성**

`frontend/tests/composables/useRealEstate.test.ts` 끝에 describe 추가:

```ts
describe('useRealEstate.getBuildingInfo — 실패 구분', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('정상 응답이면 data 반환', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { buildingName: '래미안', bjdCode: '1' } })
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '래미안')).resolves.toEqual({ buildingName: '래미안', bjdCode: '1' })
  })

  it('404(없는 건물)면 null 반환', async () => {
    mockFetch.mockRejectedValue({ statusCode: 404 })
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '없는건물')).resolves.toBeNull()
  })

  it('500(서버 장애)면 throw (일시 장애)', async () => {
    mockFetch.mockRejectedValue({ statusCode: 500 })
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '래미안')).rejects.toBeTruthy()
  })

  it('status 없는 에러(timeout/network)면 throw', async () => {
    mockFetch.mockRejectedValue(new Error('aborted'))
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '래미안')).rejects.toBeTruthy()
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useRealEstate.test.ts`
Expected: FAIL — "404면 null", "500이면 throw", "timeout이면 throw" 케이스 실패(현재는 모든 에러가 null 반환).

- [ ] **Step 3: 구현 — catch 분리**

`frontend/composables/useRealEstate.ts:102-109`의 `try/catch`를 교체:

```ts
    try {
      const res = await $fetch<{ success: boolean; data: BuildingInfo }>(
        `${apiBase}/api/real-estate/${type}/building-info?${query.toString()}`
      )
      return res.data
    } catch (err) {
      const status = (err as { statusCode?: number; status?: number }).statusCode
        ?? (err as { status?: number }).status
      // 진짜 없는 건물(404)만 null. 5xx/timeout/network(status 없음 포함)는 일시 장애로 전파.
      if (status === 404) return null
      throw err
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useRealEstate.test.ts`
Expected: PASS (기존 getNearby + 신규 getBuildingInfo 4건).

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useRealEstate.ts frontend/tests/composables/useRealEstate.test.ts
git commit -m "fix(seo): getBuildingInfo 404→null/그외→throw 분리 (일시 장애 noindex 방지 기반)"
```

---

## Task 4: `realEstateNoindex`에 `fetchFailed` 반영

**Files:**
- Modify: `frontend/utils/realEstateNoindex.ts`
- Test: `frontend/tests/utils/realEstateNoindex.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: `shouldNoindexSsr` (Task 1), `INVALID_BUILDING_NAME` (기존).
- Produces: `shouldNoindexRealEstateDetail(input: { buildingName: string; loaded: boolean; hasBuildingInfo: boolean; fetchFailed?: boolean }): boolean`

- [ ] **Step 1: 실패 테스트 추가**

`frontend/tests/utils/realEstateNoindex.test.ts`의 describe 안에 추가:

```ts
  it('일시 fetch 실패면 정상 건물명이어도 noindex 금지 (회귀 핵심)', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: true,
      hasBuildingInfo: false,
      fetchFailed: true,
    })).toBe(false)
  })

  it('fetchFailed=true 라도 지번 패턴이면 noindex(적극 증거 우선)', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '123-45',
      loaded: true,
      hasBuildingInfo: false,
      fetchFailed: true,
    })).toBe(true)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/utils/realEstateNoindex.test.ts`
Expected: FAIL — "일시 fetch 실패면 noindex 금지"가 현재 코드에선 true 반환(실패).

- [ ] **Step 3: 구현 — fetchFailed 위임**

`frontend/utils/realEstateNoindex.ts` 전체 교체:

```ts
/**
 * 부동산 상세 페이지 noindex 판단 유틸.
 *
 * noindex 출력 조건(둘 중 하나):
 * 1. buildingName이 지번 패턴(INVALID_BUILDING_NAME) → 적극 증거 → noindex
 * 2. 로드 완료 + buildingInfo 없음(백엔드 404 확정) → noindex
 *
 * 단, SSR fetch가 일시 실패(fetchFailed)한 경우는 절대 noindex하지 않는다(fail-open).
 * 과거에는 총 거래 < 10건도 noindex했으나 색인률 회복을 위해 2026-05 폐지.
 */
import { INVALID_BUILDING_NAME } from './realEstateBuildingName'
import { shouldNoindexSsr } from './ssrIndexability'

export interface RealEstateNoindexInput {
  buildingName: string
  loaded: boolean
  hasBuildingInfo: boolean
  /** SSR building-info fetch가 일시 실패했는가. true면 noindex 금지. */
  fetchFailed?: boolean
}

export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  return shouldNoindexSsr({
    positiveNoindex: INVALID_BUILDING_NAME.test(input.buildingName),
    fetchFailed: input.fetchFailed ?? false,
    confirmedEmpty: input.loaded && !input.hasBuildingInfo,
  })
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/realEstateNoindex.test.ts`
Expected: PASS (기존 4건 + 신규 2건 = 6).

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/realEstateNoindex.ts frontend/tests/utils/realEstateNoindex.test.ts
git commit -m "fix(seo): 부동산 상세 noindex에 fetchFailed fail-open 반영"
```

---

## Task 5: 부동산 건물상세 페이지 wiring

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
  - `512` 근처 ref 선언부, `524-530` noindex computed, `943-971` resolveBuildingContext, `975-1024` SSR 로더, `1027-1043` watch.

**Interfaces:**
- Consumes: `markDegradedResponse` (Task 2), `shouldNoindexRealEstateDetail`(fetchFailed 인자, Task 4), `getBuildingInfo`(404→null/throw, Task 3).

- [ ] **Step 1: `fetchFailed` ref 선언 추가**

`buildingInfo` ref 선언 직후(`512` 부근)에 추가:

```ts
const buildingInfo = ref<BuildingInfo | null>(null)
const fetchFailed = ref(false)   // ← 추가: SSR building-info 일시 실패 여부
```

- [ ] **Step 2: noindex computed에 fetchFailed 전달**

`524-530`의 computed 교체:

```ts
const noindex = computed(() =>
  shouldNoindexRealEstateDetail({
    buildingName: buildingName.value,
    loaded: !statsLoading.value && !txLoading.value,
    hasBuildingInfo: buildingInfo.value !== null,
    fetchFailed: fetchFailed.value,
  }),
)
```

- [ ] **Step 3: `markDegradedResponse` import 확보**

파일 상단 import 블록에 (다른 composable import과 같은 스타일로) 추가. 이미 `useApiBase` 등을 `await import`로 받는 패턴이 있으나, 순수 함수이므로 정적 import로 충분:

```ts
import { markDegradedResponse } from '~/composables/useDegradedResponse'
```

- [ ] **Step 4: resolveBuildingContext — 일시 장애 전파**

`943-971`의 두 `try/catch`를 제거해 일시 장애가 상위로 전파되게 한다(getComplexList는 빈 결과 시 throw 안 하고, getBuildingInfo는 Task 3로 404→null·그외 throw):

```ts
async function resolveBuildingContext(): Promise<{ bjdCode: string; building: BuildingInfo | null }> {
  if (resolvedBjdCode.value) {
    return { bjdCode: resolvedBjdCode.value, building: buildingInfo.value }
  }

  // getComplexList: HTTP 에러(일시 장애)면 throw되어 상위 로더가 잡는다. 빈 목록은 정상 통과.
  const listResult = await getComplexList(apiSlug.value, cityName, districtName, buildingName.value, 1, 1)
  const candidate = listResult.items[0]
  if (candidate?.bjdCode) {
    return { bjdCode: candidate.bjdCode, building: null }
  }

  // fallback: getBuildingInfo는 404→null(없는 건물), 일시 장애→throw.
  const fallbackBuilding = await getBuildingInfo(apiSlug.value, '', buildingName.value)
  if (fallbackBuilding?.bjdCode) {
    return { bjdCode: fallbackBuilding.bjdCode, building: fallbackBuilding }
  }

  return { bjdCode: '', building: null }
}
```

- [ ] **Step 5: SSR 로더 — infoFetchFailed 추적**

`975-1024`의 `useAsyncData` 콜백을 수정: `resolveBuildingContext()`를 try/catch로 감싸고, `infoResult` 거절도 합산해 반환에 `infoFetchFailed` 추가.

콜백 도입부(`977-978`) 교체:

```ts
  async () => {
    let infoFetchFailed = false
    let bjdCode = ''
    let primedBuilding: BuildingInfo | null = null
    try {
      const ctx = await resolveBuildingContext()
      bjdCode = ctx.bjdCode
      primedBuilding = ctx.building
    } catch {
      infoFetchFailed = true   // bjdCode 해석 단계의 일시 장애
    }
```

`992`의 `resolvedBuildingInfo` 직후에 추가:

```ts
    const resolvedBuildingInfo = infoResult.status === 'fulfilled' ? infoResult.value : null
    if (infoResult.status === 'rejected') infoFetchFailed = true   // ← 추가
```

`return` 객체(`1015-1022`)에 필드 추가:

```ts
    return {
      bjdCode,
      statsResponse: statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS_RESPONSE,
      transactions: txResult.status === 'fulfilled' ? txResult.value : EMPTY_TRANSACTIONS,
      buildingInfo: resolvedBuildingInfo,
      areaGroups: areaResult.status === 'fulfilled' ? areaResult.value : [],
      facilitySummary: facilitySummarySSR,
      infoFetchFailed,   // ← 추가
    }
```

- [ ] **Step 6: 로더 직후 degraded 응답 + watch 반영**

`useAsyncData` await 직후(`1024` 다음, `const ssrLoading` 위)에 추가:

```ts
if (import.meta.server && ssrData.value?.infoFetchFailed) {
  fetchFailed.value = true
  markDegradedResponse()
}
```

그리고 `watch(ssrData, ...)`(`1027`) 본문에서 `statsLoading/txLoading=false` 부근에 추가:

```ts
  statsLoading.value = false
  txLoading.value = false
  fetchFailed.value = data.infoFetchFailed ?? false   // ← 추가
```

- [ ] **Step 7: 단위 회귀는 Task 4가 보증 — 빌드/타입 확인**

이 페이지의 SSR 분기는 무거운 통합 환경이 필요해 단위 테스트 대신 (a) Task 4의 `shouldNoindexRealEstateDetail(fetchFailed)` 단위 테스트가 noindex 로직을 보증하고, (b) 타입체크로 wiring 정합을 확인한다.

Run: `cd frontend && npx nuxi typecheck 2>&1 | tail -20`
Expected: 이 파일 관련 타입 에러 없음. (`infoFetchFailed` 미정의/`fetchFailed` 미선언 등 없을 것.)

> typecheck 스크립트가 없으면 `npx vue-tsc --noEmit -p tsconfig.json 2>&1 | grep buildingName | head` 로 대체. 둘 다 불가하면 `npm run build` 로 SSR 번들 빌드가 통과하는지 확인.

- [ ] **Step 8: 커밋**

```bash
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
git commit -m "fix(seo): 부동산 상세 SSR 일시 실패시 noindex 대신 503(fail-open) — infoFetchFailed 추적"
```

---

## Task 6: 지역 허브 2종 wiring (fetch 실패 → noindex 금지 + 503)

**Files:**
- Modify: `frontend/pages/[city]/index.vue:137-141, 199-222`
- Modify: `frontend/pages/[city]/[district]/index.vue:110-115, 189-212`
- Test: `frontend/tests/pages/districtHubNoindex.test.ts` (케이스 추가)

**Interfaces:**
- Consumes: `shouldNoindexSsr` (Task 1), `markDegradedResponse` (Task 2).

- [ ] **Step 1: 실패 테스트 추가 (district 허브)**

`frontend/tests/pages/districtHubNoindex.test.ts`의 describe 안에 케이스 추가. 기존 테스트는 `useAsyncData` 스텁의 `error: ref(null)`를 쓰므로, 실패 케이스는 `error`를 채운다:

```ts
  it('fetch 실패(error 있음)면 데이터가 null이어도 noindex가 없어야 한다 (fail-open)', async () => {
    vi.stubGlobal('useAsyncData', (_k: string, _h: () => Promise<unknown>) => {
      const data = ref<any>(null)
      const error = ref<any>(new Error('boom'))
      return Object.assign(Promise.resolve({ data, pending: ref(false), error, refresh: vi.fn() }), {
        data, pending: ref(false), error, refresh: vi.fn(),
      })
    })
    const useHeadSpy = vi.fn()
    ;(globalThis as any).useHead = useHeadSpy
    vi.resetModules()
    const { default: DistrictHub } = await import('~/pages/[city]/[district]/index.vue')
    mount(
      defineComponent({ render() { return h(Suspense, null, { default: () => h(DistrictHub) }) } }),
      { global: { stubs } },
    )
    await flushPromises()
    const allCalls = useHeadSpy.mock.calls.map((c: any[]) => {
      const arg = c[0]; return typeof arg === 'function' ? arg() : arg
    })
    const hasNoindex = allCalls.some((h: any) =>
      (h?.meta ?? []).some((m: any) => m?.name === 'robots' && m?.content?.includes('noindex')))
    expect(hasNoindex).toBe(false)
    ;(globalThis as any).useHead = vi.fn()
  })
```

또한 테스트 상단 글로벌 스텁에 `markDegradedResponse`/`useRequestEvent`를 no-op으로 추가(컴포넌트가 호출해도 안전하게):

```ts
;(globalThis as any).useRequestEvent = () => undefined
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/districtHubNoindex.test.ts`
Expected: FAIL — 현재 `isNoindex = areaData===null` 이라 error 무관하게 noindex 발화(실패).

- [ ] **Step 3: 구현 — `/[city]/[district]/index.vue`**

`110-115` useAsyncData에서 `.catch(()=>null)` 제거하고 `error` 캡처:

```ts
const { data: response, pending, error } = await useAsyncData(
  `area-${city.value}-${district.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}/${encodeURIComponent(district.value)}`),
)
const fetchFailed = computed(() => !!error.value)
```

`191`의 isNoindex 교체:

```ts
const isNoindex = computed(() => shouldNoindexSsr({
  fetchFailed: fetchFailed.value,
  confirmedEmpty: !fetchFailed.value && areaData.value === null,
}))
```

파일 상단 import에 추가하고, 로더 직후 degraded 호출:

```ts
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
```
```ts
// useAsyncData await 직후
if (import.meta.server && error.value) markDegradedResponse()
```

- [ ] **Step 4: 구현 — `/[city]/index.vue`**

`137-141` 교체(`.catch` 제거 + error 캡처):

```ts
const { data: response, pending, error } = await useAsyncData(
  `city-area-${city.value}`,
  () => $fetch<any>(`/api/area/${encodeURIComponent(city.value)}`),
)
const fetchFailed = computed(() => !!error.value)
```

`201`의 isNoindex 교체:

```ts
const isNoindex = computed(() => shouldNoindexSsr({
  fetchFailed: fetchFailed.value,
  confirmedEmpty: !fetchFailed.value && cityData.value === null,
}))
```

import + degraded 호출 추가(district와 동일):

```ts
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
```
```ts
if (import.meta.server && error.value) markDegradedResponse()
```

- [ ] **Step 5: 테스트 통과 확인 (기존 2건 + 신규 1건)**

Run: `cd frontend && npx vitest run tests/pages/districtHubNoindex.test.ts`
Expected: PASS — null+error → noindex 없음; null(error 없음) → noindex 있음(기존); 데이터 있음 → noindex 없음(기존).

- [ ] **Step 6: 커밋**

```bash
git add "frontend/pages/[city]/index.vue" "frontend/pages/[city]/[district]/index.vue" frontend/tests/pages/districtHubNoindex.test.ts
git commit -m "fix(seo): 지역 허브 2종 fetch 실패시 noindex 금지 + 503(fail-open)"
```

---

## Task 7: 부동산 지역목록 wiring (fetch 실패 vs 진짜 0건 구분)

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue:194-204, 302-319`

**Interfaces:**
- Consumes: `shouldNoindexSsr` (Task 1), `markDegradedResponse` (Task 2).
- 주의: 진짜 0건 구역(`total===0` & 실패 아님)은 **계속 noindex**(thin content 정책 유지). fetch 실패만 fail-open.

- [ ] **Step 1: 실패 재현 단위 테스트 작성**

이 페이지의 noindex는 `totalComplexes`와 `error` 조합이라, 페이지 마운트 테스트 대신 동일 판정식을 검증한다. `frontend/tests/utils/ssrIndexability.test.ts`에 "지역목록 의미" 케이스 추가:

```ts
describe('shouldNoindexSsr — 지역목록 의미 매핑', () => {
  it('fetch 실패면 total 0이어도 noindex 금지', () => {
    expect(shouldNoindexSsr({ fetchFailed: true, confirmedEmpty: true })).toBe(false)
  })
  it('성공 + 진짜 0건이면 noindex 유지(thin)', () => {
    expect(shouldNoindexSsr({ fetchFailed: false, confirmedEmpty: true })).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트 실행(이미 Task1 구현으로 통과)**

Run: `cd frontend && npx vitest run utils/ssrIndexability.test.ts`
Expected: PASS — 판정식이 의도대로임을 고정(지역목록 wiring의 계약).

- [ ] **Step 3: 구현 — error 캡처 + isNoindex 교체**

`194`의 useAsyncData에서 `error` 캡처:

```ts
const { data: ssrData, error } = await useAsyncData(
  `re-region-${realEstateType.value}-${citySlug.value}-${districtSlug.value}`,
  () => getComplexList(realEstateType.value as never, cityName.value, districtName.value, undefined, 1, 24),
)
const fetchFailed = computed(() => !!error.value)
```

`304-319`의 watch 안 `const isNoindex = totalComplexes.value === 0` 를 교체:

```ts
    const isNoindex = shouldNoindexSsr({
      fetchFailed: fetchFailed.value,
      confirmedEmpty: !fetchFailed.value && totalComplexes.value === 0,
    })
```

파일 상단 import + 로더 직후 degraded 추가:

```ts
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
```
```ts
// useAsyncData await + ssrData 반영 직후
if (import.meta.server && error.value) markDegradedResponse()
```

- [ ] **Step 4: 빌드/타입 확인**

Run: `cd frontend && npx vitest run utils/ssrIndexability.test.ts && echo OK`
Expected: PASS. (페이지 wiring은 §검증의 라이브 curl로 최종 확인.)

- [ ] **Step 5: 커밋**

```bash
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue" frontend/utils/ssrIndexability.test.ts
git commit -m "fix(seo): 부동산 지역목록 fetch 실패 fail-open(진짜 0건 noindex는 유지)"
```

---

## Task 8: 전체 검증 + 롤아웃/회복 런북

**Files:** 코드 변경 없음. 전체 테스트/린트 + 배포 후 운영 검증·회복 절차.

- [ ] **Step 1: 프론트 전체 테스트 + 린트**

Run: `cd frontend && npm run test && npm run lint`
Expected: 전체 PASS, lint 0 error. 실패 시 해당 Task로 돌아가 수정.

- [ ] **Step 2: 백엔드 영향 없음 확인 (회귀 가드)**

Run: `cd backend && npm run test`
Expected: PASS (백엔드 무변경이므로 그대로 통과해야 함).

- [ ] **Step 3: PR 생성 (develop)**

```bash
git push origin HEAD
gh pr create --base develop --title "fix(seo): SSR 일시 실패시 noindex 대신 503(fail-open) — 부동산/지역 4페이지" \
  --body "spec: docs/superpowers/specs/2026-06-20-ssr-fail-closed-noindex-fix-design.md (로컬). 네이버 meta robots 색인제외 회귀 수정. Approach B(백엔드 pool_timeout/슬로우쿼리)는 별도 PR."
```
Expected: CI(test+lint+build) green 후 머지.

- [ ] **Step 4: 배포 후 라이브 검증 (`feedback_verify_ground_truth`)**

main 승격·배포 후, CSV 영향 URL 샘플을 Yeti UA로 확인:

```bash
UA="Mozilla/5.0 (compatible; Yeti/1.1; +http://naver.me/spd)"
# 정상 건물 → index,follow + canonical 존재(noindex 0)
curl -s -A "$UA" "https://ilsangkit.co.kr/real-estate/offitel-sale/incheon/jung/%EC%98%81%EC%A2%85%20%EB%93%80%ED%81%B4%EB%9E%98%EC%8A%A4%20%EC%9A%B4%EC%84%9C%EC%97%AD" \
  | grep -oE '<meta name="robots"[^>]*>|<link rel="canonical"[^>]*>'
```
Expected: `index, follow ...` + canonical 존재, `noindex` 미출현.

- [ ] **Step 5: 캐시 퍼지**

배포로 코드가 바뀌어도 Nitro route cache + nginx proxy_cache에 과거 `200+noindex` HTML이 남을 수 있다. 서버에서 퍼지:

```bash
# 서버 SSH 후 — 경로는 운영 기준(project_nitro_route_cache / project_home_autoads_hydration 참조)
# Nitro route cache
rm -rf /home/project2/frontend/.output/server/.../cache/* 2>/dev/null || true
# nginx proxy_cache
rm -rf /var/cache/nginx/ilsangkit/* && nginx -s reload
```
> 정확한 경로/명령은 기존 배포 캐시 퍼지 절차를 따른다. 퍼지 후 Step 4를 재확인.

- [ ] **Step 6: 사이트맵 재제출 + 수집요청**

- GSC: 사이트맵 재제출 + 상위 영향 URL `URL 검사 → 색인 생성 요청`.
- 네이버 서치어드바이저: 사이트맵 재제출 + `요청 → 웹 페이지 수집`으로 상위 URL 재크롤 유도.

- [ ] **Step 7: 모니터링 (1~2주, 성공 판정)**

- 네이버 SC "meta robots 색인 제외" 일별 추이 **하락/평탄화** 확인(즉시 0 아님).
- (B PR 배포 시) 백엔드 PM2 `Timed out fetching a new connection` 빈도 급감.
- 성공 1차 신호: Step 4 샘플에서 **신규 noindex 오탐 0건**.

---

## Self-Review 결과

- **Spec 커버리지**: §4.1 ssrIndexability→Task1, §4.2 markDegradedResponse→Task2, §4.3 getBuildingInfo→Task3, §4.4 realEstateNoindex→Task4, §4.5 건물상세→Task5, §4.6 지역허브→Task6, §4.7 지역목록→Task7, §5 테스트→각 Task, §6 회복→Task8. **누락 없음.**
- **타입 일관성**: `shouldNoindexSsr` 시그니처(Task1)와 호출부(Task4·6·7) 일치. `fetchFailed?`(Task4 옵셔널)로 기존 호출 호환. `markDegradedResponse(statusCode?)`(Task2)와 호출부 일치. `infoFetchFailed` 필드(Task5)는 동일 파일 내 생성·소비.
- **알려진 한계**: 건물상세(Task5)·지역목록(Task7) 페이지 wiring은 무거운 SSR 통합이라 순수 헬퍼 단위 테스트 + 라이브 curl(Task8 Step4)로 검증. 회귀 핵심 로직(noindex 판정)은 Task1·4로 TDD 보증됨.
