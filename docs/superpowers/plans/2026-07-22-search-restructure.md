# 검색 재구성(컨텍스추얼 스코프 + 부동산 전용 /search) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **행 번호 주의:** 이 플랜의 모든 `NNN행` 표기는 작성 시점 스냅샷이며 드리프트할 수 있다. 각 태스크는 **파일 내용(함수명/문자열)으로 위치를 찾아** 수정하라. 행 번호는 참고용.

**Goal:** 헤더 통합 검색을 "현재 위치(컨텍스트)"에 따라 스코프가 바뀌는 모델로 재편한다 — 시설 카테고리 안이면 그 카테고리 목록을 키워드로 검색(`/{category}?keyword=`), 그 외(홈·부동산·지역)면 부동산 검색(`/search?keyword=`). `/search`는 **부동산 전용** 결과 페이지로 전환(시설 병렬 호출·3-탭 제거)한다. 시설 카테고리 페이지에 헤더발(發) 키워드 검색을 복원하고, 자동완성을 스코프 인지형으로 만들며, 검색 로깅을 부동산·시설 양쪽으로 확대해 로그 편향을 해소한다.

**Architecture:** 신규 순수 함수 `frontend/utils/searchScope.ts`의 `resolveSearchScope(route)`가 라우트 path/params/query만으로 `{ kind:'facility', category, citySlug? } | { kind:'realestate' }`를 계산한다(DB·Vue 비의존, 단위 테스트 가능). 헤더(`HeaderSearch.vue`)와 홈 히어로(`pages/index.vue`)가 이 스코프로 제출 목적지·placeholder·자동완성 scope를 구동한다. `/search`(`pages/search.vue`)는 부동산 `searchAll()`만 호출하는 전용 페이지가 된다. 시설 카테고리 페이지는 `buildListFetch(category, citySlug, page, keyword?)`(확장) + `route.query.keyword`로 SSR/재조회에 키워드를 반영하고, keyword 존재 시 `noindex`로 분기한다. 자동완성은 `GET /api/search/suggest?q=&scope=realestate|facility:{category}`로 백엔드 `searchSuggestService`가 3종 추천을 scope로 필터한다.

**Tech Stack:** Frontend Nuxt 3 (SSR) + Vue 3 + TypeScript + TailwindCSS, Vitest + @vue/test-utils (happy-dom). Backend Express 5 + TypeScript(ESM) + Zod + Prisma, Vitest.

## Global Constraints

- **범위 = 검색 모델(A)만.** 홈 레이아웃 재구성(B, `feat/home-realestate-market-redesign`)·공매(auction) 검색·지하철 검색은 범위 밖. 스코프 판별에서 auction/subway/그 외는 realestate 기본으로 떨어진다.
- **부동산 검색 백엔드 신규 없음** — 기존 `GET /api/real-estate/search`(`searchAll`) 그대로 사용.
- **시설 카테고리 페이지에 인-페이지 키워드 인풋을 신설하지 않는다** — 키워드 진입로는 헤더 검색뿐(D4). 직전 리팩터(#616, region-filter-chips)가 제거한 인풋을 되살리지 않는다.
- **`?city=`만 있는 시설 목록은 기존대로 색인 유지, `?keyword=`가 붙으면 noindex** — keyword 유무로 robots 분기. page2+ noindex 기존 정책과 공존.
- `/search`: `noindex, follow` + canonical 미출력 유지. `/search?category=X → /X` 301 유지.
- 스코프 판별 실패/불가 → **realestate 기본(fail-safe)**.
- Node 20(`nvm use 20`). **package-lock 재생성 금지**(기존 lock 유지, `npm install`만). 모든 변경 **PR 경유(develop)**, CI green 후 머지. **main 직접 커밋 금지**.
- **TDD**: 실패 테스트 먼저 → 실패 확인 → 최소 구현 → 통과 확인 → 커밋. 커밋 prefix `feat:`/`refactor:`.
- **직접 mount 하는 컴포넌트/유틸은 `ref`/`computed`/`watch`를 `vue`에서 명시 import**(자동 import 의존 시 CI만 `ReferenceError` — 알려진 함정). `useRoute`/`navigateTo`/`$fetch`는 Nuxt 전역(`tests/setup.ts` 스텁)이라 명시 import 대상 아님(AppHeader.vue와 동일 패턴).
- **페이지 mount 테스트가 이 레포에서 불안정**할 수 있다(vue-router 직접 import + composable mock 다수). 그런 경우 **순수 헬퍼(`searchScope`·`buildListFetch`·noindex 판정)의 단위 테스트를 주 검증**으로 삼고, 컴포넌트 라우팅/템플릿 변경은 소스텍스트·얕은(shallow) 검증 또는 배포 후 라이브 검증으로 대체한다(직전 검색 리팩터에서 확인된 패턴).

프론트 테스트 실행:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run <path>
```
백엔드 테스트 실행:
```bash
cd backend && npm run test        # 전체
# 또는 단일: cd backend && npx vitest run __tests__/<path>
```

---

## File Structure

**생성**
- `frontend/utils/searchScope.ts` — `resolveSearchScope(route)`(순수) + `buildSearchDestination(scope, keyword)` + `scopeSuggestParam(scope)` + `scopePlaceholder(scope)` + 타입 `SearchScope`. Vue/DB 비의존, SSR-safe.
- `frontend/utils/facilityListRobots.ts` — `shouldNoindexFacilityList({ page, keyword })` 순수 함수(page2+ 또는 keyword 존재 시 noindex). (Task 4에서 시설 목록 noindex 분기를 테스트 가능하게 추출.)
- `frontend/tests/utils/searchScope.test.ts`
- `frontend/tests/utils/facilityListRobots.test.ts`

**수정 (frontend)**
- `frontend/components/common/HeaderSearch.vue` — 현재 라우트로 스코프 계산(reactive) → placeholder·submit 목적지·자동완성 scope 구동.
- `frontend/pages/index.vue` — 홈 히어로 `handleSearch`를 `buildSearchDestination`으로 통일(홈=realestate, 동작 불변) + 히어로 자동완성에 scope 전달.
- `frontend/components/search/SearchAutocomplete.vue` — `scope` prop 추가; freeText(goKeyword/free select) 목적지를 `buildSearchDestination`으로; `suggest(q, scope)` 전달.
- `frontend/composables/useSearchSuggest.ts` — `suggest(q, scope?)` 시그니처 + `/api/search/suggest`에 `scope` 파라미터.
- `frontend/pages/search.vue` — **부동산 전용화**: `searchGrouped()` 병렬 제거, 3-탭·시설 섹션·partial-empty 문구 제거, 부동산 결과만; 히어로/placeholder 부동산 문구; logSearch resultCount 부동산 기준. noindex·301·지역 셀렉트 유지.
- `frontend/utils/regionChips.ts` — `buildListFetch(category, citySlug, page, keyword?)`로 확장(keyword를 검색 API/waste-schedules에 전달).
- `frontend/pages/[category]/index.vue` — `route.query.keyword`를 SSR(useAsyncData)·재조회(performSearch/loadWasteSchedules)에 반영; keyword 시 noindex; 결과 헤더 "'{keyword}' 검색 결과 · {카테고리}" + 검색 해제(×) 링크; keyword 검색도 logSearch 호출.

**수정 (backend)**
- `backend/src/schemas/search.ts` — `SuggestQuerySchema`에 `scope` 필드 추가.
- `backend/src/services/search/searchSuggestService.ts` — `suggest(q, scope?)` scope 분기(realestate=지역+단지명·카테고리억제 / facility=그 카테고리+지역·단지명억제).
- `backend/src/routes/search.ts` — `/suggest` 핸들러가 `scope`를 서비스로 전달.

**테스트 수정(회귀)**
- `frontend/tests/components/common/HeaderSearch.test.ts` — realestate 컨텍스트 유지 + facility 컨텍스트 케이스 추가.
- `frontend/tests/pages/search.test.ts`, `frontend/tests/pages/searchLog.test.ts` — 부동산 전용화에 맞춰 갱신(resultCount 부동산 기준, 시설 탭 부재).
- `backend/__tests__/services/search/searchSuggestService.test.ts` — scope 분기 케이스 추가.
- `backend/__tests__/schemas/search.test.ts` — scope 스키마 케이스(존재 시).

---

## Task 1: `searchScope.ts` 순수 함수 + 단위 테스트 (Foundation)

**Files:**
- Create: `frontend/utils/searchScope.ts`
- Test: `frontend/tests/utils/searchScope.test.ts`

**Interfaces / Produces:**
- `type SearchScope = { kind:'facility'; category: FacilityCategory; citySlug?: string } | { kind:'realestate' }`
- `resolveSearchScope(route): SearchScope` — 입력은 `{ path?, params?, query? }` 형태의 route-like(순수).
- `buildSearchDestination(scope, keyword): string`
- `scopeSuggestParam(scope): string` → `'realestate'` | `'facility:{category}'`
- `scopePlaceholder(scope): string`

**Consumes:** `~/types/facility`의 `FACILITY_CATEGORIES`(16개, subway 포함)·`CATEGORY_META`·`FacilityCategory`.

**핵심 subtlety (반드시 반영):**
- 시설 스코프 인정 카테고리는 **15개**(`FACILITY_CATEGORIES`에서 `subway` 제외). subway·auction·그 외는 realestate 기본(스펙 §8).
- 시설 컨텍스트 3라우트의 파라미터명은 실측 확인됨: `/[category]/index.vue`→`params.category`, `/[category]/[id].vue`→`params.category`, `/[city]/[district]/[category].vue`→`params.city`+`params.district`+`params.category`. 따라서 **`params.category`가 1차 신호**.
- `trash` 상세는 전용 라우트 `/trash/[id].vue`(params=`{id}`, `category` 없음)라 params만으론 못 잡는다 → **path 첫 세그먼트를 2차 fallback**으로 사용(`/trash/123`→`trash`). 단 `/[city]/[district]/[category]`의 첫 세그먼트는 city slug이므로 params 분기가 먼저 이겨야 한다(도시 slug와 카테고리 slug는 충돌 없음 — romanized city vs 영문 category).
- citySlug: 지역 시설목록은 `params.city`, `/[category]?city=`는 `query.city`. 둘 다 slug → `params.city ?? query.city`.

- [ ] **Step 1: 실패 테스트 작성**

`frontend/tests/utils/searchScope.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import {
  resolveSearchScope,
  buildSearchDestination,
  scopeSuggestParam,
  scopePlaceholder,
} from '~/utils/searchScope'

describe('resolveSearchScope', () => {
  it('/[category] index → facility(그 카테고리)', () => {
    const s = resolveSearchScope({ path: '/toilet', params: { category: 'toilet' }, query: {} })
    expect(s).toEqual({ kind: 'facility', category: 'toilet', citySlug: undefined })
  })
  it('/[category]/[id] 상세 → facility(그 카테고리)', () => {
    const s = resolveSearchScope({ path: '/toilet/123', params: { category: 'toilet', id: '123' }, query: {} })
    expect(s.kind).toBe('facility')
    if (s.kind === 'facility') expect(s.category).toBe('toilet')
  })
  it('/[city]/[district]/[category] → facility + 컨텍스트 citySlug(params.city)', () => {
    const s = resolveSearchScope({ path: '/seoul/gangnam/toilet', params: { city: 'seoul', district: 'gangnam', category: 'toilet' }, query: {} })
    expect(s).toEqual({ kind: 'facility', category: 'toilet', citySlug: 'seoul' })
  })
  it('/[category]?city=seoul → facility + query.city 를 citySlug 로', () => {
    const s = resolveSearchScope({ path: '/toilet', params: { category: 'toilet' }, query: { city: 'seoul' } })
    expect(s).toEqual({ kind: 'facility', category: 'toilet', citySlug: 'seoul' })
  })
  it('/trash/[id] 전용 라우트(category 파라미터 없음) → path fallback 으로 facility(trash)', () => {
    const s = resolveSearchScope({ path: '/trash/6693', params: { id: '6693' }, query: {} })
    expect(s.kind).toBe('facility')
    if (s.kind === 'facility') expect(s.category).toBe('trash')
  })
  it('subway 는 시설 스코프에서 제외 → realestate (스펙 §8)', () => {
    expect(resolveSearchScope({ path: '/subway/1-2', params: { slug: '1-2' }, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/subway', params: { category: 'subway' }, query: {} })).toEqual({ kind: 'realestate' })
  })
  it('홈/가이드/부동산/검색 → realestate 기본', () => {
    expect(resolveSearchScope({ path: '/', params: {}, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/guide', params: {}, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/real-estate/apt-sale', params: { realEstateType: 'apt-sale' }, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/search', params: {}, query: { keyword: 'x' } })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/seoul/gangnam', params: { city: 'seoul', district: 'gangnam' }, query: {} })).toEqual({ kind: 'realestate' })
  })
})

describe('buildSearchDestination', () => {
  it('facility → /{category}?keyword= (citySlug 있으면 &city= 부가)', () => {
    expect(buildSearchDestination({ kind: 'facility', category: 'toilet' }, '강남')).toBe('/toilet?keyword=' + encodeURIComponent('강남'))
    expect(buildSearchDestination({ kind: 'facility', category: 'toilet', citySlug: 'seoul' }, '역삼')).toBe('/toilet?keyword=' + encodeURIComponent('역삼') + '&city=seoul')
  })
  it('realestate → /search?keyword=', () => {
    expect(buildSearchDestination({ kind: 'realestate' }, '래미안')).toBe('/search?keyword=' + encodeURIComponent('래미안'))
  })
  it('keyword 는 trim 후 인코딩', () => {
    expect(buildSearchDestination({ kind: 'realestate' }, '  강남 래미안  ')).toBe('/search?keyword=' + encodeURIComponent('강남 래미안'))
  })
})

describe('scopeSuggestParam', () => {
  it('facility → facility:{category}, realestate → realestate', () => {
    expect(scopeSuggestParam({ kind: 'facility', category: 'toilet' })).toBe('facility:toilet')
    expect(scopeSuggestParam({ kind: 'realestate' })).toBe('realestate')
  })
})

describe('scopePlaceholder', () => {
  it('facility 는 카테고리 shortLabel, realestate 는 부동산 문구', () => {
    expect(scopePlaceholder({ kind: 'facility', category: 'toilet' })).toContain('화장실')
    expect(scopePlaceholder({ kind: 'realestate' })).toBe('아파트·단지·지역 검색')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/utils/searchScope.test.ts`
Expected: FAIL — `Cannot find module '~/utils/searchScope'`.

- [ ] **Step 3: 구현**

`frontend/utils/searchScope.ts`:
```ts
import { CATEGORY_META, FACILITY_CATEGORIES, type FacilityCategory } from '~/types/facility'

export type SearchScope =
  | { kind: 'facility'; category: FacilityCategory; citySlug?: string }
  | { kind: 'realestate' }

// 시설 스코프로 인정하는 카테고리(15). subway 는 역(station) 그룹 단위라
// 컨텍스추얼 키워드 검색 대상이 아니다(스펙 §8) → realestate 기본으로 떨어뜨린다.
const FACILITY_SCOPE_CATEGORIES: ReadonlySet<string> = new Set(
  FACILITY_CATEGORIES.filter((c) => c !== 'subway'),
)

interface RouteLike {
  path?: string
  params?: Record<string, unknown>
  query?: Record<string, unknown>
}

function contextCitySlug(route: RouteLike): string | undefined {
  const p = route?.params?.city
  if (typeof p === 'string' && p) return p
  const q = route?.query?.city
  if (typeof q === 'string' && q) return q
  return undefined
}

/**
 * 라우트 컨텍스트로 검색 스코프를 판별하는 순수 함수(라우터/DB/Vue 비의존).
 * 1) params.category 가 15개 시설 카테고리 중 하나 → facility (/[category], /[category]/[id], /[city]/[district]/[category])
 * 2) path 첫 세그먼트가 시설 카테고리 → facility (/trash/[id] 처럼 category 파라미터가 없는 전용 상세 라우트 보정)
 * 3) 그 외 → realestate (fail-safe)
 */
export function resolveSearchScope(route: RouteLike): SearchScope {
  const paramCategory = route?.params?.category
  if (typeof paramCategory === 'string' && FACILITY_SCOPE_CATEGORIES.has(paramCategory)) {
    return { kind: 'facility', category: paramCategory as FacilityCategory, citySlug: contextCitySlug(route) }
  }
  const firstSeg = (typeof route?.path === 'string' ? route.path : '').split('/').filter(Boolean)[0]
  if (firstSeg && FACILITY_SCOPE_CATEGORIES.has(firstSeg)) {
    return { kind: 'facility', category: firstSeg as FacilityCategory, citySlug: contextCitySlug(route) }
  }
  return { kind: 'realestate' }
}

/** 헤더/히어로 제출 목적지 URL. */
export function buildSearchDestination(scope: SearchScope, keyword: string): string {
  const q = encodeURIComponent(keyword.trim())
  if (scope.kind === 'facility') {
    const city = scope.citySlug ? `&city=${encodeURIComponent(scope.citySlug)}` : ''
    return `/${scope.category}?keyword=${q}${city}`
  }
  return `/search?keyword=${q}`
}

/** 자동완성 API 의 scope 파라미터 문자열. */
export function scopeSuggestParam(scope: SearchScope): string {
  return scope.kind === 'facility' ? `facility:${scope.category}` : 'realestate'
}

/** 검색 인풋 placeholder. */
export function scopePlaceholder(scope: SearchScope): string {
  if (scope.kind === 'facility') {
    return `${CATEGORY_META[scope.category]?.shortLabel ?? scope.category} 이름·지역 검색`
  }
  return '아파트·단지·지역 검색'
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/utils/searchScope.test.ts`
Expected: PASS(전 케이스).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/utils/searchScope.ts frontend/tests/utils/searchScope.test.ts
git commit -m "feat(search): add pure resolveSearchScope + destination/suggest/placeholder helpers"
```

---

## Task 2: 헤더/홈 검색 스코프 라우팅

**Files:**
- Modify: `frontend/components/common/HeaderSearch.vue`
- Modify: `frontend/pages/index.vue`
- Test: `frontend/tests/components/common/HeaderSearch.test.ts` (수정)

**Interfaces:**
- Consumes: `resolveSearchScope`·`buildSearchDestination`·`scopeSuggestParam`·`scopePlaceholder`(Task 1). `useRoute`(Nuxt 전역).
- Produces: HeaderSearch가 `SearchAutocomplete`에 `scope` prop(=현재 `SearchScope`)을 전달(Task 5에서 소비). 홈 히어로도 동일.
- 배경(현재 코드):
  - `HeaderSearch.vue` `submit()`(함수 검색)이 `navigateTo('/search?keyword=' + encodeURIComponent(q))` 고정. placeholder는 desktop/mobile 두 input 모두 `"지역·단지명·시설 검색"` 하드코딩. `useRoute` 미사용. import는 `{ ref, watch, nextTick } from 'vue'`.
  - `pages/index.vue` `handleSearch()`가 `navigateTo(\`/search?keyword=${encodeURIComponent(q)}\`)`. 히어로 자동완성 ref는 `heroAcRef`.

- [ ] **Step 1: 헤더 실패/회귀 테스트 갱신**

`frontend/tests/components/common/HeaderSearch.test.ts` — 기존 realestate 케이스는 유지(전역 `useRoute` 스텁 path='/' → realestate → `/search`)하고 facility 컨텍스트 케이스를 추가:
```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import HeaderSearch from '~/components/common/HeaderSearch.vue'

vi.stubGlobal('navigateTo', vi.fn())

// setup.ts 전역 useRoute(path '/') 를 케이스별로 덮어쓸 수 있게 헬퍼
function setRoute(route: Record<string, unknown>) {
  vi.stubGlobal('useRoute', () => route)
}

describe('HeaderSearch 스코프 라우팅', () => {
  beforeEach(() => {
    vi.mocked(navigateTo).mockClear()
    setRoute({ path: '/', params: {}, query: {} }) // 홈=realestate 기본
  })
  afterEach(() => {
    // 전역 useRoute 를 setup.ts 기본으로 되돌림(다른 파일 오염 방지)
    setRoute({ path: '/', params: {}, query: {} })
  })

  it('realestate 컨텍스트(홈): 엔터 시 /search?keyword= 로 이동', async () => {
    const wrapper = mount(HeaderSearch)
    const input = wrapper.find('input')
    await input.setValue('강남 래미안')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('강남 래미안'))
  })

  it('facility 컨텍스트(/toilet): 엔터 시 /{category}?keyword= 로 이동', async () => {
    setRoute({ path: '/toilet', params: { category: 'toilet' }, query: {} })
    const wrapper = mount(HeaderSearch)
    const input = wrapper.find('input')
    await input.setValue('역삼')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/toilet?keyword=' + encodeURIComponent('역삼'))
  })

  it('지역 시설목록 컨텍스트(/seoul/gangnam/toilet): city 컨텍스트 유지', async () => {
    setRoute({ path: '/seoul/gangnam/toilet', params: { city: 'seoul', district: 'gangnam', category: 'toilet' }, query: {} })
    const wrapper = mount(HeaderSearch)
    const input = wrapper.find('input')
    await input.setValue('공원')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/toilet?keyword=' + encodeURIComponent('공원') + '&city=seoul')
  })

  it('빈 입력은 라우팅하지 않음', async () => {
    const wrapper = mount(HeaderSearch)
    await wrapper.find('input').trigger('keydown.enter')
    expect(navigateTo).not.toHaveBeenCalled()
  })

  it('mobile variant: 오버레이 열기 → 엔터 시 스코프 목적지로 이동', async () => {
    const wrapper = mount(HeaderSearch, { props: { variant: 'mobile' } })
    expect(wrapper.find('input').exists()).toBe(false)
    await wrapper.find('button[aria-label="검색 열기"]').trigger('click')
    const input = wrapper.find('input')
    await input.setValue('서울 화장실')
    await input.trigger('keydown.enter')
    expect(navigateTo).toHaveBeenCalledWith('/search?keyword=' + encodeURIComponent('서울 화장실'))
  })
})
```
> 주의: `setup.ts`가 `useRoute`를 전역으로 정의하므로 `vi.stubGlobal('useRoute', ...)`로 케이스별 덮어쓰기가 가능하다. 이 테스트가 페이지가 아닌 **컴포넌트 단위**라 안정적이다(직전 리팩터에서 검증된 패턴). 만약 `SearchAutocomplete` 자식 mount가 다른 전역 mock에서 터지면 `global: { stubs: { SearchAutocomplete: true } }`로 스텁 처리해 헤더 submit 경로만 검증하라.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/components/common/HeaderSearch.test.ts`
Expected: FAIL — facility 케이스가 여전히 `/search?keyword=...`로 감(현재 submit 하드코딩).

- [ ] **Step 3: HeaderSearch.vue 스코프화**

스크립트 수정:
1. import 확장: `import { ref, computed, watch, nextTick } from 'vue'` (computed 추가) + 스코프 헬퍼:
```ts
import { resolveSearchScope, buildSearchDestination, scopePlaceholder } from '~/utils/searchScope'
```
2. reactive 스코프/placeholder 계산(`const { trackSearch } = useAnalytics()` 근처):
```ts
const route = useRoute()               // Nuxt 전역(auto-import), AppHeader.vue 와 동일 패턴
const scope = computed(() => resolveSearchScope(route))
const placeholder = computed(() => scopePlaceholder(scope.value))
```
3. `submit()`을 스코프 기반으로:
```ts
function submit() {
  const q = keyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  overlayOpen.value = false
  navigateTo(buildSearchDestination(scope.value, q))
}
```

템플릿 수정:
4. desktop/mobile 두 `<input>`의 `placeholder="지역·단지명·시설 검색"`을 `:placeholder="placeholder"`로 교체.
5. 두 `<SearchAutocomplete>`에 `:scope="scope"` 바인딩 추가(Task 5에서 prop 소비; 지금 추가해도 미사용 prop 경고 없음):
```html
<SearchAutocomplete ref="acDesktopRef" :open="focused" :model-value="keyword" :scope="scope" @close="focused = false" />
...
<SearchAutocomplete ref="acMobileRef" :open="overlayOpen" :model-value="keyword" :scope="scope" @close="overlayOpen = false" />
```
> `SearchAutocomplete`가 아직 `scope` prop을 선언하기 전이라도 Vue는 fallthrough attr로 받아 무해하다. Task 5에서 정식 prop이 된다.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/components/common/HeaderSearch.test.ts`
Expected: PASS(realestate·facility·지역 city·mobile 케이스).

- [ ] **Step 5: 홈 히어로 handleSearch 통일**

`pages/index.vue` — `handleSearch`를 스코프 헬퍼로(홈=realestate라 목적지 `/search?keyword=`로 동일, 회귀 없음):
1. import 추가(기존 vue import 라인 옆): `import { resolveSearchScope, buildSearchDestination } from '~/utils/searchScope'`
2. 함수 교체:
```ts
function handleSearch() {
  const q = searchKeyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  navigateTo(buildSearchDestination(resolveSearchScope(useRoute()), q))
}
```
> 홈 히어로 자동완성(`heroAcRef` = `SearchAutocomplete`)에도 `:scope="resolveSearchScope(useRoute())"`를 넘겨도 되지만 홈은 항상 realestate이므로 **`:scope="{ kind: 'realestate' }"` 고정**으로 충분하다(단순·SSR-safe). 템플릿의 히어로 `<SearchAutocomplete ... ref="heroAcRef">`에 `:scope="{ kind: 'realestate' }"` 추가.

- [ ] **Step 6: 홈 렌더/기존 테스트 회귀 확인**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/pages/index.test.ts tests/pages/indexHeroAutocomplete.test.ts tests/components/common/AppHeaderSearch.test.ts
```
Expected: PASS(홈 검색 목적지 불변이므로 기존 assert 유지). 실패 시 해당 테스트의 목적지 기대값이 `/search?keyword=`인지 확인(그대로여야 함).

- [ ] **Step 7: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/common/HeaderSearch.vue frontend/pages/index.vue frontend/tests/components/common/HeaderSearch.test.ts
git commit -m "feat(search): route header/home search by contextual scope"
```

---

## Task 3: `/search` 부동산 전용화

**Files:**
- Modify: `frontend/pages/search.vue`
- Test: `frontend/tests/pages/search.test.ts`, `frontend/tests/pages/searchLog.test.ts` (수정)

**Interfaces:**
- Consumes: `useRealEstate().searchAll`(부동산). `useFacilitySearch`는 카테고리 flat 뷰(선택 시)에만 남기거나 제거(아래 판단).
- 배경(현재 코드): `performSearch()`가 `Promise.all([searchGrouped(...), searchRealEstate(...)])`로 시설+부동산 병렬. 상단 3-탭(`searchTab: 'all'|'facility'|'realEstate'`) + 시설 grouped/flat 뷰 + partial-empty 문구(`groupedResults.length === 0 !== realEstateResults.length === 0`). `noindex, follow`·canonical 미출력(`useHead` 806–812행). `/search?category=X → /X` 301(793–799행 top-level + onMounted fallback). logSearch resultCount = `total + groupedTotalCount + realEstate`(884–904행 watch).

**설계 방침(스펙 §5-2):** `/search`는 **부동산 검색 결과만** 낸다. 시설 병렬 호출·3-탭·시설 섹션·partial-empty 시설 문구·시설 회복(SearchRecovery의 시설 chip)을 제거한다. 히어로 키워드 인풋·지역 시/도·구/군 셀렉트는 **유지**(부동산 재조회용). `noindex`·301은 유지. 0건은 부동산 유도 문구.

- [ ] **Step 1: 로깅 테스트를 부동산 기준으로 갱신(실패 유도)**

`frontend/tests/pages/searchLog.test.ts` 수정 — `/search`가 부동산 전용이므로 resultCount는 부동산 결과 기준. `useRealEstate.searchAll` mock이 카테고리 합계를 반환하도록 하고 기대값을 그 합계로:
```ts
// 상단 useRealEstate mock 을 결과 있는 형태로 교체
vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    searchAll: vi.fn().mockResolvedValue({
      categories: [
        { type: 'apt-sale', count: 4, items: [] },
        { type: 'villa-sale', count: 3, items: [] },
      ],
    }),
    getComplexList: vi.fn().mockResolvedValue({ items: [], page: 1, totalPages: 0, total: 0 }),
  }),
}))
```
그리고 `resultCount` 기대값을 부동산 합계(예: 7)로 바꾼다:
```ts
// resultCount = 부동산 categories count 합 (시설 병렬 제거)
expect(call.resultCount).toBe(7)
```
> 정확한 합계는 mock 값에 맞춘다. 시설(`total`/`groupedTotalCount`)은 더 이상 resultCount에 포함되지 않는다.

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/pages/searchLog.test.ts`
Expected: FAIL — 현재 resultCount가 `total+grouped+re`(예: 8)라 부동산 기준(7)과 불일치.

- [ ] **Step 3: performSearch 부동산 전용화(스크립트)**

`pages/search.vue`:
1. `performSearch()`에서 시설 병렬 제거 — 부동산만:
```ts
async function performSearch() {
  if (selectedRealEstateType.value) {
    await searchRealEstatePaged(selectedRealEstateType.value, reCurrentPage.value)
    return
  }
  const reResult = await searchRealEstate(
    searchKeyword.value || undefined,
    selectedCity.value || undefined,
    selectedDistrict.value || undefined,
  ).catch(() => null)
  realEstateResults.value = ((reResult?.categories as unknown) as RealEstateResultCategory[] | undefined)?.filter(c => c.count > 0) || []
}
```
2. `useFacilitySearch`에서 남길 것 최소화: `search`/`searchGrouped`/`groupedResults`/`groupedTotalCount`/`recovery`/`facilities`/`total`/`selectedCategory` 등 **시설 전용 상태·호출 제거**. (부동산 유형 페이징 `getComplexList` 경로와 지역 셀렉트는 유지.) `useFacilitySearch` import가 완전 미사용이면 제거.
3. logSearch(watch loading) resultCount를 부동산 기준으로:
```ts
const reTotalCount = computed(() => realEstateResults.value.reduce((s, r) => s + r.count, 0))
// watch(loading, ...) 내부
logSearch({
  keyword: searchKeyword.value,
  resultCount: selectedRealEstateType.value ? reTotal.value : reTotalCount.value,
  city: selectedCity.value || undefined,
  district: selectedDistrict.value || undefined,
  category: 'realestate',   // 부동산 검색 태그(스펙 §5-5: 부동산은 realestate 태그로 통일)
})
```

- [ ] **Step 4: 템플릿 정리(3-탭·시설 섹션 제거)**

`pages/search.vue` 템플릿:
1. **3-탭 블록 제거** — `role="tablist"`의 전체/부동산/생활시설 버튼 묶음(`<div ... role="tablist" aria-label="검색 결과 필터"> … </div>`) 삭제. `searchTab` 관련 `v-if`/조건도 함께 정리.
2. **시설 grouped/flat 뷰 제거** — `facilityGroupedBySection` 렌더 블록, 시설 flat 뷰(`selectedCategory`) 블록, `AdBanner v-if="facilities.length>0"`(부동산 결과 뒤 AdBanner는 유지하고 싶으면 부동산 블록으로 이동), 시설 chip bar(`sortedGroupedResults` 루프) 삭제.
3. **partial-empty 시설 문구 제거** — `"…생활시설 결과는 없어요…"` / `"…부동산 결과는 없어요…"` info 블록 삭제.
4. **부동산 결과 뷰 유지** — 부동산 그룹 요약 카드 + 유형 선택 페이징 뷰(`selectedRealEstateType`)는 그대로 두되 `searchTab !== 'facility'` 등의 탭 가드는 제거(항상 부동산).
5. **빈 상태(0건)** — 부동산 유도 문구로 단순화(시설 chip 목록 `['toilet','hospital','parking','pharmacy']` NuxtLink 제거, `SearchRecovery`는 부동산 회복이 아니면 제거). 예:
```html
<EmptyState v-if="realEstateResults.length === 0 && !selectedRealEstateType" :title="UI_MESSAGES.emptySearch" description="아파트·빌라·오피스텔 단지명이나 지역으로 검색해보세요">
  <NuxtLink to="/real-estate" class="btn-primary inline-flex items-center gap-1.5 text-sm">
    <span class="material-symbols-outlined text-[16px]">apartment</span>
    부동산 실거래가 보기
  </NuxtLink>
</EmptyState>
```
6. **히어로/문구 부동산화** — `heroDescription`·`heroStats`·입력 `placeholder`("장소·단지명·시설명을 검색하세요" → "단지명·지역으로 검색하세요")·`heroStats`의 생활시설 항목 제거. `eyebrow="통합 검색"`은 "부동산 검색" 등으로.
7. **유지**: 지역 시/도·구/군 셀렉트(`SectionBlock heading="지역"`), `noindex, follow` useHead, canonical 미출력, `/search?category=X → /X` 301(top-level + onMounted). 히어로 키워드 인풋(부동산 재조회).

- [ ] **Step 5: search.test.ts 회귀 갱신**

`frontend/tests/pages/search.test.ts` — "지역 필터 드롭다운"(selects ≥2) 테스트는 **유지**(셀렉트 존치). 시설 관련 가정이 있으면 제거. 부동산 전용 가드 테스트 추가(가능하면):
```ts
it('생활시설 3-탭이 렌더되지 않는다(부동산 전용)', () => {
  const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
  expect(wrapper.text()).not.toContain('생활시설')
})
```
> 이 텍스트 가드가 다른 mock 문제로 불안정하면 **소스텍스트 grep 확인**(아래)으로 대체하고 라이브 검증에 위임한다:
> `grep -n "role=\"tablist\"\|생활시설\|searchGrouped" frontend/pages/search.vue` → 0이어야 한다.

- [ ] **Step 6: 통과 확인 + 린트**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/pages/searchLog.test.ts tests/pages/search.test.ts && npm run lint
```
Expected: PASS. 미사용 import/변수 lint 오류 없도록 시설 전용 심볼(`CATEGORY_GROUPS`, `facilityGroupedBySection`, `searchTab`, `SearchRecovery` 등) 제거 확인.

- [ ] **Step 7: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/search.vue frontend/tests/pages/search.test.ts frontend/tests/pages/searchLog.test.ts
git commit -m "refactor(search): make /search real-estate only (drop facility parallel + 3 tabs)"
```

---

## Task 4: 시설 카테고리 페이지 `?keyword=` 처리

**Files:**
- Modify: `frontend/utils/regionChips.ts` (`buildListFetch` 확장)
- Create: `frontend/utils/facilityListRobots.ts` + test
- Modify: `frontend/pages/[category]/index.vue`
- Test: `frontend/tests/utils/regionChips.test.ts` (확장), `frontend/tests/utils/facilityListRobots.test.ts` (신규)

**Interfaces:**
- `buildListFetch(category, citySlug, page, keyword?)` — keyword를 시설 검색 API body / waste-schedules params에 전달. 백엔드 `POST /api/facilities/search`는 이미 `keyword` 지원, `/api/waste-schedules`도 `keyword` 지원(`getSchedules`가 이미 전달).
- `shouldNoindexFacilityList({ page, keyword })` — page≥2 또는 keyword 존재 시 true.
- 배경(현재): `buildListFetch`(regionChips.ts) 시그니처 `(category, citySlug, page)`. `[category]/index.vue`의 `useAsyncData`가 이를 사용. `isNoindex = pageQueryParam >= 2`. `performSearch`/`loadWasteSchedules`는 `cityName`만 사용(keyword 없음). RegionChips `href-for`는 `?city=`.

- [ ] **Step 1: buildListFetch keyword 확장 실패 테스트**

`frontend/tests/utils/regionChips.test.ts`에 추가:
```ts
import { buildListFetch } from '~/utils/regionChips'

describe('buildListFetch keyword', () => {
  it('시설: keyword 를 검색 API body 에 넣는다', () => {
    const { url, options } = buildListFetch('toilet', 'seoul', 1, '역삼')
    expect(url).toBe('/api/facilities/search')
    expect(options.body).toMatchObject({ category: 'toilet', city: '서울', keyword: '역삼' })
  })
  it('시설: keyword 없으면 body 에 keyword 키가 없다', () => {
    const { options } = buildListFetch('toilet', '', 1)
    expect(options.body).not.toHaveProperty('keyword')
  })
  it('trash: keyword 를 waste-schedules params 에 넣는다', () => {
    const { url, options } = buildListFetch('trash', 'seoul', 1, '삼성동')
    expect(url).toBe('/api/waste-schedules')
    expect(options.params).toMatchObject({ city: '서울', keyword: '삼성동' })
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/utils/regionChips.test.ts`
Expected: FAIL — 4번째 인자 무시되어 keyword 미포함.

- [ ] **Step 3: buildListFetch 확장 구현**

`frontend/utils/regionChips.ts` — 시그니처와 본문을 keyword 지원으로:
```ts
export function buildListFetch(category: string, citySlug: string | undefined, page: number, keyword?: string): ListFetchRequest {
  const cityKorean = resolveCityParam(citySlug)
  const kw = keyword?.trim()
  if (category === 'trash') {
    return {
      url: '/api/waste-schedules',
      options: { params: { page, limit: 20, ...(cityKorean ? { city: cityKorean } : {}), ...(kw ? { keyword: kw } : {}) } },
    }
  }
  return {
    url: '/api/facilities/search',
    options: { method: 'POST', body: { category, page, limit: 20, ...(cityKorean ? { city: cityKorean } : {}), ...(kw ? { keyword: kw } : {}) } },
  }
}
```
> `keyword`는 선택 인자라 기존 3-인자 호출부(직전 리팩터의 `buildListFetch(category, citySlug, page)`)와 하위 호환.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/utils/regionChips.test.ts`
Expected: PASS.

- [ ] **Step 5: facilityListRobots 순수 함수 실패 테스트 + 구현**

`frontend/tests/utils/facilityListRobots.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'

describe('shouldNoindexFacilityList', () => {
  it('기본(page1, keyword 없음) → 색인 허용(false)', () => {
    expect(shouldNoindexFacilityList({ page: 1 })).toBe(false)
  })
  it('?city= 만(page1) → 색인 허용(false)', () => {
    expect(shouldNoindexFacilityList({ page: 1, keyword: '' })).toBe(false)
  })
  it('keyword 존재 → noindex(true)', () => {
    expect(shouldNoindexFacilityList({ page: 1, keyword: '역삼' })).toBe(true)
  })
  it('page2+ → noindex(true)', () => {
    expect(shouldNoindexFacilityList({ page: 2 })).toBe(true)
  })
})
```
`frontend/utils/facilityListRobots.ts`:
```ts
/** 시설 목록 페이지 noindex 판정: page2+ 또는 키워드 검색 상태면 noindex. `?city=`만은 색인 유지. */
export function shouldNoindexFacilityList(input: { page: number; keyword?: string }): boolean {
  return input.page >= 2 || !!input.keyword?.trim()
}
```
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/utils/facilityListRobots.test.ts` → PASS.

- [ ] **Step 6: `[category]/index.vue` — SSR/재조회에 keyword 반영 + noindex + 결과 헤더**

`pages/[category]/index.vue` 스크립트:
1. import 확장: `import { resolveCityParam, buildListFetch } from '~/utils/regionChips'` 유지 + `import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'`.
2. keyword 파생 computed 추가(`queryCitySlug` 근처):
```ts
const queryKeyword = computed(() => ((route.query.keyword as string) || '').trim())
```
3. `useAsyncData` 로더에 keyword 전달(키에도 포함해 keyword별 캐시 분리):
```ts
const initialKeyword = ((route.query.keyword as string) || '').trim()
const { data: ssrData } = await useAsyncData(
  `cat-list-${categoryParam.value}-${queryCitySlug.value || 'all'}-k${initialKeyword || 'none'}-p${initialPage}`,
  () => {
    const { url, options } = buildListFetch(categoryParam.value, queryCitySlug.value, initialPage, initialKeyword || undefined)
    return $fetch<any>(url, options)
  },
)
```
4. `performSearch()`에 keyword 반영:
```ts
async function performSearch() {
  if (categoryParam.value === 'trash') return
  ssrConsumed.value = true
  const params: Record<string, unknown> = { page: currentPage.value, limit: 20, category: categoryParam.value }
  if (cityName.value) params.city = cityName.value
  if (queryKeyword.value) params.keyword = queryKeyword.value
  if (categoryParam.value === 'hospital' && selectedDepartments.value.length > 0) {
    params.departments = selectedDepartments.value
  }
  search(params)
}
```
5. `loadWasteSchedules()`에 keyword 반영(getSchedules는 이미 keyword 인자 지원):
```ts
const result = await getSchedules({
  city: cityName.value || undefined,
  district: undefined,
  keyword: queryKeyword.value || undefined,
  page: wasteCurrentPage.value,
  limit: 20,
})
```
6. noindex 분기 교체 — 기존 `isNoindex = pageQueryParam >= 2`를 헬퍼로:
```ts
const isNoindex = computed(() => shouldNoindexFacilityList({ page: pageQueryParam.value, keyword: queryKeyword.value }))
```
   `useHead(computed(() => { if (isNoindex.value) return { meta:[{ name:'robots', content: PAGINATION_ROBOTS_CONTENT }] }; return { link:[canonical] } }))`는 그대로 두면 keyword 시에도 robots noindex가 켜진다. (canonical은 keyword 없을 때만 출력 — 현 구조 유지.)
7. keyword 변경 감시 재조회 watch 추가(기존 `watch(() => route.query.city, ...)` 옆):
```ts
watch(() => route.query.keyword, () => {
  resetPage()
  if (categoryParam.value === 'trash') { wasteCurrentPage.value = 1; loadWasteSchedules() }
  else performSearch()
})
```

템플릿(결과 헤더 + 해제 링크):
8. `PageHero` 아래(또는 결과 `SectionBlock` 상단)에 keyword 활성 배지 + 해제(×) 링크 추가:
```html
<div v-if="queryKeyword" class="flex items-center gap-2 text-sm">
  <span class="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">
    ‘{{ queryKeyword }}’ 검색 결과 · {{ catLabel }}
  </span>
  <NuxtLink :to="queryCitySlug ? `/${categoryParam}?city=${queryCitySlug}` : `/${categoryParam}`" class="text-slate-500 hover:text-primary inline-flex items-center gap-0.5">
    <span class="material-symbols-outlined text-[16px]">close</span>검색 해제
  </NuxtLink>
</div>
```
9. RegionChips `href-for`는 keyword를 **떨어뜨린다**(지역 전환 시 키워드 유지하지 않음 — 스펙상 명시 없음, 단순화). 현 `?city=`만 유지. (원하면 keyword 유지 옵션은 후속.)

- [ ] **Step 7: keyword SSR 반영 검증(가능 시) / 대체 검증**

가능하면 순수 헬퍼 경계로 이미 검증됨(`buildListFetch` keyword + `shouldNoindexFacilityList`). 페이지 mount 단위 테스트(직전 리팩터 `tests/pages/category-region-chips.test.ts` 패턴)를 확장해 `?keyword=` SSR body 반영을 확인하려면:
```ts
it('?keyword=역삼 이면 검색 API body 에 keyword 를 넣는다', async () => {
  vi.stubGlobal('useRoute', () => ({ params: { category: 'toilet' }, query: { keyword: '역삼' } }))
  mount(CategoryPage, { global: { stubs: { NuxtLink: true, RegionChips: true } } })
  await flushPromises()
  const call = fetchSpy.mock.calls.find((c) => String(c[0]).includes('/api/facilities/search'))
  expect((call![1] as { body: { keyword?: string } }).body.keyword).toBe('역삼')
})
```
> 이 페이지 mount 가 다른 mock에서 불안정하면 생략하고 **`buildListFetch` 단위 테스트(Step 1–4)를 주 검증**으로 삼는다(경계가 이미 순수 함수라 충분). noindex는 `shouldNoindexFacilityList` 단위 테스트로 커버.

- [ ] **Step 8: 통과 확인 + 린트**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/utils/regionChips.test.ts tests/utils/facilityListRobots.test.ts tests/pages/category-region-chips.test.ts && npm run lint
```
Expected: PASS.

- [ ] **Step 9: 라이브 확인 메모(배포 후)**

배포 후 `curl -s 'https://ilsangkit.co.kr/toilet?keyword=역삼&_cb=1'`에서 (a) 결과가 키워드로 필터되고 (b) `<meta name="robots" content="noindex...">` 존재, `curl -s 'https://ilsangkit.co.kr/toilet?city=seoul&_cb=1'`은 robots noindex **없음**(색인 유지) 확인.

- [ ] **Step 10: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/utils/regionChips.ts frontend/utils/facilityListRobots.ts frontend/pages/[category]/index.vue frontend/tests/utils/regionChips.test.ts frontend/tests/utils/facilityListRobots.test.ts
git commit -m "feat(facility-list): support header keyword search via ?keyword= with noindex"
```

---

## Task 5: 자동완성 스코프화 (프론트 + 백엔드)

**Files:**
- Modify (backend): `backend/src/schemas/search.ts`, `backend/src/services/search/searchSuggestService.ts`, `backend/src/routes/search.ts`
- Modify (frontend): `frontend/composables/useSearchSuggest.ts`, `frontend/components/search/SearchAutocomplete.vue`
- Test: `backend/__tests__/services/search/searchSuggestService.test.ts` (확장), `backend/__tests__/schemas/search.test.ts` (확장, 존재 시), `frontend/tests/components/common/HeaderSearchAutocomplete.test.ts` 또는 신규 프론트 suggest 파라미터 테스트

**Interfaces:**
- API: `GET /api/search/suggest?q=&scope=realestate|facility:{category}`.
- 백엔드 `suggest(q, scope?)`: scope 분기.
  - `realestate`: 지역 + 건물명(단지명) 추천, **카테고리 추천 억제**.
  - `facility:{category}`: 그 카테고리(파서/시노님 카테고리) + 지역 추천, **건물명(단지명) 억제**.
  - scope 없음(하위호환): 현행 3종 혼합 유지.
- 프론트 `useSearchSuggest.suggest(q, scope?)` → API scope 전달. `SearchAutocomplete`가 `scope` prop을 받아 suggest 호출 + freeText 목적지(`buildSearchDestination`)에 사용.
- 배경(현재): `SuggestQuerySchema = { q }`. `suggest(q)`가 region+category+building 혼합. route `/suggest`가 `q`만 전달. `SearchAutocomplete.goKeyword`/`select`의 freeText 경로가 `navigateTo('/search?keyword='+...)` 고정.

> **설계 결정(스펙 §5-4 해석):** scope는 **기존 3종 추천의 필터**로 구현한다. facility scope에서 "그 카테고리 시설명"은 개별 시설 테이블 name 조회를 새로 붙이지 않고(범위·성능), **카테고리+지역 추천을 남기고 단지명을 억제**하는 것으로 충족한다(부동산 단지명 억제가 핵심 행위). realestate scope는 **단지명+지역을 남기고 카테고리를 억제**한다. 개별 시설명 자동완성은 후속(Self-Review 갭 메모).

### 5A. 백엔드

- [ ] **Step 1: 스키마 scope 실패 테스트(존재 시) 또는 서비스 테스트 우선**

`backend/__tests__/services/search/searchSuggestService.test.ts`에 scope 케이스 추가:
```ts
it('scope=realestate → 카테고리 추천 억제, 건물명 유지', async () => {
  mockGroupBy.mockResolvedValue([
    { buildingName: '화장품타워', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 5 },
  ])
  const res = await suggest('화장', 'realestate')
  expect(res.items.some(i => i.type === 'category')).toBe(false)
  expect(res.items.some(i => i.type === 'building')).toBe(true)
})

it('scope=facility:toilet → 단지명(building) 억제, 카테고리/지역 유지', async () => {
  mockGroupBy.mockResolvedValue([
    { buildingName: '화장품타워', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 5 },
  ])
  const res = await suggest('화장', 'facility:toilet')
  expect(res.items.some(i => i.type === 'building')).toBe(false)
  expect(res.items.some(i => i.type === 'category')).toBe(true)
})

it('scope 없음 → 현행 혼합(회귀)', async () => {
  mockGroupBy.mockResolvedValue([
    { buildingName: '강남효성', type: 'apt-sale', city: '서울', district: '강남구', bjdCode: '1168010100', transactionCount: 5 },
  ])
  const res = await suggest('강남')
  const types = res.items.map(i => i.type)
  expect(types).toContain('region')
  expect(types).toContain('building')
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchSuggestService.test.ts`
Expected: FAIL — `suggest(q, scope)` 2번째 인자 미지원(카테고리/건물명 억제 안 됨).

- [ ] **Step 3: 서비스 scope 분기 구현**

`backend/src/services/search/searchSuggestService.ts` — `suggest` 시그니처와 분기:
```ts
export type SuggestScope = 'realestate' | `facility:${string}` | undefined

export async function suggest(q: string, scope?: SuggestScope): Promise<SuggestResponse> {
  const query = (q ?? '').trim();
  if (!query) return { items: [] };

  const suppressCategory = scope === 'realestate';
  const suppressBuilding = typeof scope === 'string' && scope.startsWith('facility:');

  const items: SuggestItem[] = [];

  // 1) 지역: (항상)
  const index = await getRegionIndex();
  const regionHits: SuggestItem[] = [];
  for (const [name, hit] of index.districtNames) {
    if (name.startsWith(query)) {
      regionHits.push({ type: 'region', label: hit.district, sublabel: hit.city, city: hit.city, district: hit.district });
      if (regionHits.length >= SECTION_LIMIT) break;
    }
  }
  items.push(...dedupeRegions(regionHits));

  // 2) 카테고리: realestate scope 면 억제
  if (!suppressCategory) {
    const parsed = await parseSearchQueryCached(query);
    if (parsed.categoryToken) {
      const label = parsed.districtToken ? `${parsed.districtToken} ${categoryKo(parsed.categoryToken)}` : categoryKo(parsed.categoryToken);
      items.push({ type: 'category', label, sublabel: '생활시설', category: parsed.categoryToken, city: parsed.cityToken ?? undefined, district: parsed.districtToken ?? undefined });
    } else {
      for (const [word, cat] of CATEGORY_SYNONYM_MAP) {
        if (word.startsWith(query)) { items.push({ type: 'category', label: categoryKo(cat), sublabel: '생활시설', category: cat }); break; }
      }
    }
  }

  // 3) 건물명(단지명): facility scope 면 억제
  if (!suppressBuilding) {
    const parsedForName = await parseSearchQueryCached(query);
    const nameForBuilding = parsedForName.freeText || query;
    if (nameForBuilding.length >= 2) {
      const rows = await prisma.realEstateBuildingSummary.findMany({
        where: { buildingName: { startsWith: nameForBuilding } },
        orderBy: { transactionCount: 'desc' },
        take: SECTION_LIMIT,
        select: { buildingName: true, type: true, city: true, district: true, bjdCode: true, transactionCount: true },
      });
      for (const r of rows) {
        items.push({ type: 'building', label: r.buildingName, sublabel: `${r.district} · 거래 ${r.transactionCount}건`, buildingName: r.buildingName, bjdCode: r.bjdCode, city: r.city, district: r.district, reType: r.type });
      }
    }
  }

  return { items };
}
```
> 참고: 기존 코드는 `parseSearchQueryCached`를 한 번만 부른다. 위처럼 두 블록에서 부르면 캐시(`parseSearchQueryCached`)라 중복 비용 미미. 원하면 상단에서 한 번 파싱해 두 블록이 공유하도록 리팩터.

- [ ] **Step 4: 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/search/searchSuggestService.test.ts`
Expected: PASS(scope 3케이스 + 기존 케이스).

- [ ] **Step 5: 스키마 + 라우트 scope 배선**

`backend/src/schemas/search.ts` — `SuggestQuerySchema`에 scope:
```ts
export const SuggestQuerySchema = z.object({
  q: z.string().max(50).default(''),
  scope: z.string().max(40).optional(),   // 'realestate' | 'facility:{category}'
});
```
`backend/src/routes/search.ts` — `/suggest` 핸들러가 scope 전달:
```ts
router.get('/suggest', searchRateLimiter, validate(SuggestQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { q, scope } = req.query as unknown as { q: string; scope?: string };
    const result = await suggest(q, scope as import('../services/search/searchSuggestService.js').SuggestScope);
    res.json({ success: true, data: result });
  }));
```
(스키마 테스트가 있으면 `backend/__tests__/schemas/search.test.ts`에 scope optional 통과 케이스 추가.)

- [ ] **Step 6: 백엔드 통과 확인**

Run: `cd backend && npm run test`
Expected: PASS(search 관련 전 스위트).

- [ ] **Step 7: 커밋(백엔드)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/schemas/search.ts backend/src/services/search/searchSuggestService.ts backend/src/routes/search.ts backend/__tests__/services/search/searchSuggestService.test.ts backend/__tests__/schemas/search.test.ts
git commit -m "feat(search-suggest): scope-aware suggestions (realestate vs facility)"
```

### 5B. 프론트

- [ ] **Step 8: useSearchSuggest scope 전달 실패 테스트**

`frontend/tests`에 suggest 파라미터 캡처 테스트(신규 `tests/composables/useSearchSuggest.scope.test.ts` 또는 기존 autocomplete 테스트 확장):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useSearchSuggest } from '~/composables/useSearchSuggest'

const fetchSpy = vi.fn(async () => ({ success: true, data: { items: [] } }))
beforeEach(() => { fetchSpy.mockClear(); vi.stubGlobal('$fetch', fetchSpy) })

describe('useSearchSuggest scope', () => {
  it('suggest(q, scope) 는 /api/search/suggest 에 scope 파라미터를 넣는다', async () => {
    const { suggest } = useSearchSuggest()
    suggest('강남', 'facility:toilet')
    await new Promise(r => setTimeout(r, 250))  // debounce(200ms) 통과
    const call = fetchSpy.mock.calls.find(c => String(c[0]).includes('/api/search/suggest'))
    expect((call![1] as { params: { scope?: string } }).params.scope).toBe('facility:toilet')
  })
})
```

- [ ] **Step 9: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/composables/useSearchSuggest.scope.test.ts`
Expected: FAIL — scope 파라미터 미전달.

- [ ] **Step 10: useSearchSuggest.suggest(q, scope?) 구현**

`frontend/composables/useSearchSuggest.ts`:
```ts
function suggest(q: string, scope?: string) {
  if (debounceTimer) clearTimeout(debounceTimer)
  const query = q.trim()
  if (!query) { items.value = []; return }
  debounceTimer = setTimeout(async () => {
    try {
      const res = await $fetch<{ success: boolean; data: { items: SuggestItem[] } }>('/api/search/suggest', {
        params: { q: query, ...(scope ? { scope } : {}) },
      })
      items.value = res?.data?.items ?? []
    } catch { items.value = [] }
  }, 200)
}
```

- [ ] **Step 11: SearchAutocomplete scope prop + freeText 목적지**

`frontend/components/search/SearchAutocomplete.vue`:
1. props에 scope 추가:
```ts
import type { SearchScope } from '~/utils/searchScope'
import { buildSearchDestination, scopeSuggestParam } from '~/utils/searchScope'
const props = defineProps<{ open: boolean; modelValue: string; scope?: SearchScope }>()
```
2. `suggest` 호출부(watch modelValue, setQuery)를 scope 포함으로:
```ts
const suggestScopeParam = computed(() => (props.scope ? scopeSuggestParam(props.scope) : undefined))
// watch(modelValue): suggest(v, suggestScopeParam.value)
// setQuery(raw): suggest(raw, suggestScopeParam.value)
```
   (`computed`를 vue import에 추가.)
3. freeText 목적지 — `goKeyword`와 `select`의 else(자유 텍스트) 경로를 scope 기반으로:
```ts
function keywordDestination(kw: string): string {
  return props.scope ? buildSearchDestination(props.scope, kw) : ('/search?keyword=' + encodeURIComponent(kw.trim()))
}
function goKeyword(kw: string) {
  const k = kw.trim(); if (!k) return
  addRecent(k); emit('close'); navigateTo(keywordDestination(k))
}
// select(it) 의 마지막 else 도 navigateTo(keywordDestination(it.label))
```
> region/category/building 선택 라우팅(§2)은 그대로 유지 — facility scope라도 구체 항목(지역페이지·카테고리페이지·부동산 상세)은 원래 목적지로.

- [ ] **Step 12: 통과 확인 + 린트**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/composables/useSearchSuggest.scope.test.ts tests/components/common/HeaderSearchAutocomplete.test.ts tests/pages/indexHeroAutocomplete.test.ts && npm run lint
```
Expected: PASS(기존 autocomplete 테스트 회귀 없음 — scope 미지정 시 하위호환).

- [ ] **Step 13: 커밋(프론트)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/composables/useSearchSuggest.ts frontend/components/search/SearchAutocomplete.vue frontend/tests/composables/useSearchSuggest.scope.test.ts
git commit -m "feat(search-suggest): pass scope from header/home autocomplete to API + freeText routing"
```

---

## Task 6: 검색 로깅 편향 해소(시설 카테고리 검색 로깅 확대)

**Files:**
- Modify: `frontend/pages/[category]/index.vue` (keyword 검색 시 logSearch 호출)
- Test: `frontend/tests/pages/category-region-chips.test.ts` 확장 또는 신규 `frontend/tests/pages/categorySearchLog.test.ts`

**Interfaces:**
- `useSearchSuggest().logSearch({ keyword, resultCount, category, city, district })` — 기존 함수 재사용(`POST /api/search/log`). SearchLog의 `category`/`city`/`district`/`resultCount` 필드 사용.
- 배경(현재): logSearch 호출처는 `pages/search.vue` **한 곳**뿐(부동산 전용화 후에도 유지). 시설 카테고리 검색은 미로깅 → 로그 편향. `/search`는 Task 3에서 `category:'realestate'` 태그로 로깅.
- **의존:** Task 4(카테고리 keyword 검색 플로우) 위에 올라간다.

- [ ] **Step 1: 실패 테스트**

`frontend/tests/pages/categorySearchLog.test.ts`(신규) — `?keyword=`가 있을 때 검색 완료(loading true→false) 시 logSearch 호출을 검증. `[category]/index.vue`가 mock 의존이 크므로, category-region-chips.test.ts와 동일한 stub 셋업을 재사용:
```ts
// useSearchSuggest.logSearch mock 을 캡처하도록 스텁하고, useRoute query.keyword 설정 후
// loading 전이를 유도해 logSearch 가 keyword/category='toilet'/resultCount 로 호출됨을 확인.
expect(logSearchMock).toHaveBeenCalledWith(expect.objectContaining({ keyword: '역삼', category: 'toilet' }))
```
> 이 페이지 mount 가 불안정하면, 대신 **로깅 payload 빌더를 순수 함수로 추출**해 단위 테스트한다: `buildFacilitySearchLog({ keyword, resultCount, cityName, category })` → `{ keyword, resultCount, category, city }` 를 `frontend/utils/searchScope.ts`(또는 신규 `frontend/utils/searchLog.ts`)에 두고 테스트. 페이지는 그 빌더 결과를 `logSearch`에 넘긴다. (경계가 순수 함수면 검증이 견고하다 — 권장 경로.)

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/pages/categorySearchLog.test.ts`
Expected: FAIL — 시설 카테고리 검색에서 logSearch 미호출.

- [ ] **Step 3: 구현 — 카테고리 페이지 keyword 검색 로깅**

`pages/[category]/index.vue`:
1. import: `import { useSearchSuggest } from '~/composables/useSearchSuggest'` + `const { logSearch } = useSearchSuggest()`.
2. 검색 완료 시 로깅 — `loading` false 전이 + keyword 있을 때(trash는 `wasteTotal`, 그 외 `displayTotal`):
```ts
watch(loading, (now, prev) => {
  if (prev && !now && queryKeyword.value && categoryParam.value !== 'trash') {
    logSearch({
      keyword: queryKeyword.value,
      resultCount: displayTotal.value || 0,
      category: categoryParam.value,
      city: cityName.value || undefined,
    })
  }
})
```
   (trash는 `loading`이 아닌 `wasteLoading` 기반이므로, 필요 시 `loadWasteSchedules` 완료 지점에서 `if (queryKeyword.value) logSearch({ keyword: queryKeyword.value, resultCount: wasteTotal.value, category: 'trash', city: cityName.value || undefined })` 호출.)
> 순수 빌더 경로를 택했다면: `logSearch(buildFacilitySearchLog({ keyword: queryKeyword.value, resultCount: displayTotal.value, cityName: cityName.value, category: categoryParam.value }))`.

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npx vitest run tests/pages/categorySearchLog.test.ts`
Expected: PASS.

- [ ] **Step 5: 전체 프론트/백엔드 회귀 + 린트**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 >/dev/null && npm run lint && npm run test
cd ../backend && npm run test && npm run lint
```
Expected: 전체 PASS.

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/[category]/index.vue frontend/tests/pages/categorySearchLog.test.ts frontend/utils/searchLog.ts 2>/dev/null
git commit -m "feat(search-log): log facility category keyword searches (debias search log)"
```

---

## 실행 마무리

- [ ] 브랜치를 develop 대상 PR로 올리고 CI(Test: backend lint+test / frontend prepare+lint+test+build) green 확인 후 머지. main 승격은 별도 develop→main PR.
- [ ] 배포 후 라이브 검증:
  - 헤더: `/toilet`에서 검색 → `/toilet?keyword=…`(placeholder "화장실 이름·지역 검색"), 홈/`/real-estate/*`/`/search`에서 검색 → `/search?keyword=…`(placeholder "아파트·단지·지역 검색").
  - `/search` 부동산 전용(생활시설 탭·시설 결과 없음), `noindex` 유지.
  - `/toilet?keyword=역삼` = robots noindex 有, `/toilet?city=seoul` = robots noindex 無.
  - 자동완성: `/toilet`에서 입력 시 단지명 미노출·카테고리/지역 노출, 홈에서 입력 시 단지명 노출·카테고리 억제.
  - 로그: 부동산·시설 카테고리 검색이 `POST /api/search/log`에 각각 category='realestate' / category='{cat}'로 적재.

---

## Self-Review (스펙 커버리지)

- **§3 D1**(부동산 우선+카테고리 컨텍스추얼): Task 1 스코프 모델 + Task 2 헤더 배선.
- **§3 D2 / §5-2**(/search 부동산 전용, 3-탭·시설 병렬 제거): Task 3. noindex·301 유지 명시(Task 3 Step 4-7).
- **§3 D3 / §4 표 / §5-1**(헤더 스코프: 시설 카테고리=그 카테고리 / 그 외=부동산, placeholder·목적지 분기): Task 1(순수 함수) + Task 2(HeaderSearch+홈). 지역 시설목록 `&city=` 유지, `/[category]/[id]` 상세 포함(path fallback으로 `/trash/[id]`까지), subway 제외(§8) 전부 Task 1 테스트로 커버.
- **§3 D4 / §5-3**(시설 컨텍스추얼 결과=카테고리 페이지 `?keyword=`, 인-페이지 인풋 신설 금지): Task 4. `buildListFetch` keyword 확장 + RegionChips(`?city=`) 결합 + 결과 헤더/해제 링크.
- **§3 D5 / §5-4**(자동완성 스코프): Task 5(프론트+백엔드). realestate=지역+단지명·카테고리 억제 / facility=카테고리+지역·단지명 억제. freeText 목적지 `buildSearchDestination`.
- **§3 D6 / §5-5**(로깅 편향 해소): Task 3(/search=realestate 태그) + Task 6(시설 카테고리 검색 로깅). SearchLog category/city/district/resultCount 필드 사용.
- **§3 D7 / §8**(범위=검색만, 홈 레이아웃·auction·subway 범위 밖): Global Constraints + Task 1 subway/auction realestate 기본.
- **§6 robots**(/search noindex 유지; 시설 `?keyword=`→noindex, `?city=`만→색인 유지; page2+ 기존 정책 통일): Task 3(/search) + Task 4(`shouldNoindexFacilityList` 순수 함수 + `[category]` 배선).
- **§7 엣지**(스코프 실패→realestate fail-safe; 시설 0건 회복=RegionChips 상시; /search 0건 부동산 유도; IME 유지): Task 1(fail-safe) + Task 4(빈 상태 유지) + Task 3(부동산 0건 문구) + Task 5(SearchAutocomplete 기존 IME setQuery 로직 불변).
- **§10 테스트**: 각 태스크 TDD. 순수 헬퍼(searchScope·buildListFetch·facilityListRobots)가 주 검증, 컴포넌트/페이지 라우팅은 컴포넌트 단위 테스트(HeaderSearch) + 소스텍스트/라이브 대체(불안정 시).

**갭 메모 / 열린 질문**
1. **자동완성 "그 카테고리 시설명"의 해석**: 개별 시설 테이블 name 조회를 새로 붙이지 않고 "카테고리+지역 추천 유지 + 단지명 억제"로 충족(§5-4의 핵심은 단지명 억제). 실제 시설명 자동완성이 필요하면 후속 태스크(시설 model name startsWith 조회 추가). — **결정 확인 필요 여부: 사용자에게 문의 권장.**
2. **`category='realestate'` 로깅 태그**: SearchLog.category는 `max(20)` 문자열이라 `'realestate'`(10자) 안전. 부동산 검색을 category=null이 아닌 태그로 통일(스펙 §5-5 "구현 시 확정" → 태그 채택).
3. **RegionChips 클릭 시 keyword 유지 여부**: 현재 계획은 지역 전환 시 keyword를 떨어뜨린다(단순화). 유지가 바람직하면 Task 4 Step 9에서 `href-for`에 keyword 부가.
4. **`/search` 지역 셀렉트 존치**: 스펙 §5-2대로 유지(부동산 재조회). 직전 리팩터(#616)가 시설 목록의 셀렉트를 칩으로 바꾼 것과 달리 `/search`는 범위 밖이라 셀렉트 유지 — 일관성 관점에서 후속 칩화 여지 있음(범위 밖).
5. **페이지 mount 테스트 불안정성**: `[category]/index.vue`·`search.vue` mount 테스트가 vue-router/composable mock으로 깨질 수 있음 → 순수 헬퍼 단위 테스트를 주 검증으로, 라우팅/템플릿은 소스텍스트·라이브로 대체(Global Constraints·각 태스크 대체 스텝에 명시).
