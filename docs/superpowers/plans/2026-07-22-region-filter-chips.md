# 지역 셀렉트 → 시/도 링크 칩 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설·부동산 목록 페이지의 지역 셀렉트(클라이언트 필터·SEO 0)를 SSR·크롤 가능한 시/도 링크 칩으로 교체하고, 시설 `?city=` 페이지를 SSR-필터되게 고쳐 thin-dup을 해소한다.

**Architecture:** 신규 `RegionChips.vue`(정적 `shared/regionSlugs` 기반, API 없음)가 시/도 링크 칩을 SSR 렌더한다. 시설 목록은 `useAsyncData`가 `route.query.city`(slug)를 읽어 `CITY_SLUG_MAP`으로 한글명 변환 후 검색 API에 전달해 SSR에서 필터된 목록을 만든다(칩 착지 = `/{category}?city={slug}`). 부동산 목록의 칩은 이미 존재하는 지역 허브 라우트 `/real-estate/{type}/{citySlug}`로 링크한다.

**Tech Stack:** Nuxt 3 (SSR) + Vue 3 + TypeScript + TailwindCSS, Vitest + @vue/test-utils (happy-dom).

## Global Constraints

- 범위: 시설 목록(`pages/[category]/index.vue`) + 부동산 목록(`pages/real-estate/[realEstateType]/index.vue`)만. `/search`·경매·청약·`RegionCascadingDropdown`은 건드리지 않는다.
- 칩 깊이: **시/도만**(광역 16개). 구/군 셀렉트/칩 없음. 구/군 드릴다운은 착지 지역페이지가 담당.
- 칩 데이터 소스는 **정적**(`shared/regionSlugs`) — API/`useRegions` 의존 금지(SSR-safe).
- 시/도 칩 목록은 큐레이트 16개: 서울 부산 대구 인천 대전 울산 세종 경기 강원 충북 충남 전북 경북 경남 제주 + 전남광주통합특별시(라벨 "전남·광주"). **레거시 gwangju/jeonnam 제외**(둘 다 `CITY_SLUGS`/`REGIONS`에 아직 존재하므로 `Object.keys()` 사용 금지).
- 시설 `?city=` slug가 유효하지 않으면 city 없이 전국 렌더(**fail-open** — soft-404 금지).
- 키워드/건물명 인풋 제거(타이핑 검색은 헤더 통합검색이 담당). 시설의 "인기 지역"(구/군) NuxtLink는 **유지**.
- Node 20(`nvm use 20`). package-lock 재생성 금지. 모든 변경 PR 경유(develop), CI green 후 머지. main 직접 커밋 금지.
- TDD: 실패 테스트 먼저 → 최소 구현 → 통과 확인 → 커밋. 프론트 테스트: `cd frontend && npx vitest run <path>`.
- 직접 mount하는 컴포넌트/유틸은 `ref/computed/watch`를 명시 import(자동 import 의존 시 CI만 ReferenceError — 알려진 함정).

---

## File Structure

**생성**
- `frontend/utils/regionChips.ts` — 칩용 시/도 목록 상수(`SIDO_CHIPS`) + slug→한글 city명 변환(`resolveCityParam`). 순수·SSR-safe.
- `frontend/components/common/RegionChips.vue` — 시/도 링크 칩 렌더. `hrefFor` 주입.
- `frontend/tests/utils/regionChips.test.ts`
- `frontend/tests/components/common/RegionChips.test.ts`

**수정**
- `frontend/pages/[category]/index.vue` — useAsyncData SSR city 필터, 셀렉트+키워드 제거→`RegionChips`, city를 `route.query.city`에서 구동, 인기지역 링크 유지.
- `frontend/pages/real-estate/[realEstateType]/index.vue` — `RealEstateSearchFilter` 제거→`RegionChips`(착지 `/real-estate/{type}/{slug}`).

**삭제(사용처 0 확인 후)**
- `frontend/components/search/SearchFilters.vue`
- `frontend/components/trash/RegionSelector.vue`
- `frontend/components/realEstate/RealEstateSearchFilter.vue`(Task 3에서 부동산 목록의 유일 사용처 제거 후, grep 0이면 삭제)

---

## Task 1: 칩 데이터 + RegionChips 컴포넌트 (Foundation)

**Files:**
- Create: `frontend/utils/regionChips.ts`
- Create: `frontend/components/common/RegionChips.vue`
- Test: `frontend/tests/utils/regionChips.test.ts`, `frontend/tests/components/common/RegionChips.test.ts`

**Interfaces:**
- Produces:
  - `SIDO_CHIPS: { slug: string; label: string }[]` (길이 16)
  - `resolveCityParam(slug: string | undefined): string | undefined`
  - 컴포넌트 `RegionChips`, props `{ hrefFor: (slug: string) => string; activeSlug?: string; label?: string }`
- Consumes: `~/shared/regionSlugs`의 `CITY_SLUG_MAP`(slug→한글, 예: `seoul`→`서울`, `jeonnamgwangju`→`전남광주통합특별시`).

- [ ] **Step 1: regionChips 유틸 실패 테스트 작성**

`frontend/tests/utils/regionChips.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { SIDO_CHIPS, resolveCityParam } from '~/utils/regionChips'

describe('SIDO_CHIPS', () => {
  it('16개이며 레거시 광주/전남 slug를 제외하고 전남광주를 포함한다', () => {
    const slugs = SIDO_CHIPS.map((c) => c.slug)
    expect(SIDO_CHIPS).toHaveLength(16)
    expect(slugs).not.toContain('gwangju')
    expect(slugs).not.toContain('jeonnam')
    expect(slugs).toContain('jeonnamgwangju')
    expect(SIDO_CHIPS.find((c) => c.slug === 'jeonnamgwangju')?.label).toBe('전남·광주')
  })
})

describe('resolveCityParam', () => {
  it('slug를 한글 city명으로 변환한다', () => {
    expect(resolveCityParam('seoul')).toBe('서울')
    expect(resolveCityParam('jeonnamgwangju')).toBe('전남광주통합특별시')
  })
  it('잘못된 slug/빈값은 undefined(fail-open)', () => {
    expect(resolveCityParam('bogus')).toBeUndefined()
    expect(resolveCityParam('')).toBeUndefined()
    expect(resolveCityParam(undefined)).toBeUndefined()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/utils/regionChips.test.ts`
Expected: FAIL — `Cannot find module '~/utils/regionChips'`.

- [ ] **Step 3: regionChips 유틸 구현**

`frontend/utils/regionChips.ts`:
```ts
import { CITY_SLUG_MAP } from '~/shared/regionSlugs'

export interface SidoChip {
  slug: string
  label: string
}

/**
 * 목록 페이지 지역 칩용 시/도 목록(광역 16). 레거시 gwangju/jeonnam 은 제외하고
 * 전남광주통합특별시(jeonnamgwangju)를 포함한다. Object.keys(REGIONS)를 쓰면
 * 레거시 광주/전남이 섞이므로 명시적 상수로 둔다.
 */
export const SIDO_CHIPS: SidoChip[] = [
  { slug: 'seoul', label: '서울' },
  { slug: 'busan', label: '부산' },
  { slug: 'daegu', label: '대구' },
  { slug: 'incheon', label: '인천' },
  { slug: 'daejeon', label: '대전' },
  { slug: 'ulsan', label: '울산' },
  { slug: 'sejong', label: '세종' },
  { slug: 'gyeonggi', label: '경기' },
  { slug: 'gangwon', label: '강원' },
  { slug: 'chungbuk', label: '충북' },
  { slug: 'chungnam', label: '충남' },
  { slug: 'jeonbuk', label: '전북' },
  { slug: 'gyeongbuk', label: '경북' },
  { slug: 'gyeongnam', label: '경남' },
  { slug: 'jeju', label: '제주' },
  { slug: 'jeonnamgwangju', label: '전남·광주' },
]

/**
 * 지역 칩 slug → 시설 검색 API 용 한글 city명.
 * 매칭 실패(잘못된 slug/빈값)면 undefined 를 반환해 호출부가 city 없이 전국을 조회하도록 한다(fail-open).
 */
export function resolveCityParam(slug: string | undefined): string | undefined {
  if (!slug) return undefined
  return CITY_SLUG_MAP[slug] || undefined
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/regionChips.test.ts`
Expected: PASS (2 files 내 3 테스트).

- [ ] **Step 5: RegionChips 컴포넌트 실패 테스트 작성**

`frontend/tests/components/common/RegionChips.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionChips from '~/components/common/RegionChips.vue'

// 전역 NuxtLink stub 이 href 를 안 뿌릴 수 있으므로 로컬 stub 으로 to→href 매핑
const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountChips(props: Record<string, unknown> = {}) {
  return mount(RegionChips, {
    props: { hrefFor: (slug: string) => (slug ? `/toilet?city=${slug}` : '/toilet'), ...props },
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('RegionChips', () => {
  it('activeSlug 없으면 16개 칩을 렌더하고 hrefFor 를 적용한다', () => {
    const w = mountChips()
    const links = w.findAll('a')
    expect(links).toHaveLength(16)
    expect(links[0].attributes('href')).toBe('/toilet?city=seoul')
    const hrefs = links.map((a) => a.attributes('href'))
    expect(hrefs).toContain('/toilet?city=jeonnamgwangju')
    expect(hrefs).not.toContain('/toilet?city=gwangju')
    expect(w.text()).toContain('전남·광주')
  })

  it('activeSlug 가 있으면 맨 앞에 "전체" 리셋 칩을 두고 활성 칩에 aria-current 를 준다', () => {
    const w = mountChips({ activeSlug: 'seoul' })
    const links = w.findAll('a')
    expect(links).toHaveLength(17) // 전체 + 16
    expect(links[0].text()).toBe('전체')
    expect(links[0].attributes('href')).toBe('/toilet')
    const current = w.find('[aria-current="page"]')
    expect(current.exists()).toBe(true)
    expect(current.text()).toBe('서울')
  })
})
```

- [ ] **Step 6: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/common/RegionChips.test.ts`
Expected: FAIL — `Failed to resolve import "~/components/common/RegionChips.vue"`.

- [ ] **Step 7: RegionChips 컴포넌트 구현**

`frontend/components/common/RegionChips.vue`:
```vue
<template>
  <nav class="flex flex-wrap items-center gap-2" aria-label="지역 선택">
    <span v-if="label" class="text-xs text-slate-500 font-medium pr-1">{{ label }}</span>
    <NuxtLink
      v-if="activeSlug"
      :to="hrefFor('')"
      class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
    >전체</NuxtLink>
    <NuxtLink
      v-for="c in chips"
      :key="c.slug"
      :to="hrefFor(c.slug)"
      :aria-current="c.slug === activeSlug ? 'page' : undefined"
      class="px-3 py-1.5 border rounded-full text-sm transition-all"
      :class="c.slug === activeSlug
        ? 'bg-primary/5 border-primary text-primary font-medium'
        : 'bg-white border-line text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary'"
    >{{ c.label }}</NuxtLink>
  </nav>
</template>

<script setup lang="ts">
import { SIDO_CHIPS } from '~/utils/regionChips'

withDefaults(
  defineProps<{
    hrefFor: (slug: string) => string
    activeSlug?: string
    label?: string
  }>(),
  { activeSlug: '', label: '지역별 보기' },
)

const chips = SIDO_CHIPS
</script>
```

- [ ] **Step 8: 통과 확인**

Run: `cd frontend && npx vitest run tests/components/common/RegionChips.test.ts tests/utils/regionChips.test.ts`
Expected: PASS.

- [ ] **Step 9: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/utils/regionChips.ts frontend/components/common/RegionChips.vue frontend/tests/utils/regionChips.test.ts frontend/tests/components/common/RegionChips.test.ts
git commit -m "feat(region): add RegionChips component and SIDO_CHIPS data"
```

---

## Task 2: 시설 목록 — SSR city 필터 + 셀렉트→칩

**Files:**
- Modify: `frontend/pages/[category]/index.vue`
- Test: `frontend/tests/pages/category-region-chips.test.ts` (신규)

**Interfaces:**
- Consumes: `SIDO_CHIPS`, `resolveCityParam`, `RegionChips`(Task 1). `~/shared/regionSlugs`의 `CITY_SLUG_MAP`.
- 배경(현재 코드): `queryCitySlug`(326행) `= (route.query.city as string) || ''`. `useAsyncData`(347–367행)는 `{ category, page, limit }`만 fetch(city 미반영). `performSearch()`(639–656행)가 `selectedCity.value`를 API city 로 전달. 시/도·구/군 `<select>` + 키워드 인풋(28–73행). onMounted(778–791행)가 `?city=` 를 읽어 `selectedCity` 설정(클라 필터). "인기 지역" NuxtLink(240–250행, 유지).

- [ ] **Step 1: SSR city 필터 실패 테스트 작성**

`frontend/tests/pages/category-region-chips.test.ts` — SSR 데이터 로더가 `route.query.city` 를 한글 city 로 변환해 API body 에 넣는지 검증. `useAsyncData`/`$fetch` 는 `tests/setup.ts` 전역 mock 을 재정의해 호출 인자를 캡처한다.
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import CategoryPage from '~/pages/[category]/index.vue'

// $fetch 호출 인자 캡처
const fetchSpy = vi.fn(async () => ({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } }))

beforeEach(() => {
  fetchSpy.mockClear()
  vi.stubGlobal('$fetch', fetchSpy)
  // useAsyncData: 핸들러를 즉시 실행해 SSR 경로를 재현
  vi.stubGlobal('useAsyncData', (_key: string, handler: () => Promise<unknown>) => {
    const data = { value: null as unknown }
    handler().then((r) => { data.value = r })
    return { data }
  })
  vi.stubGlobal('useRoute', () => ({ params: { category: 'toilet' }, query: { city: 'seoul' } }))
})

describe('시설 목록 SSR city 필터', () => {
  it('?city=seoul 이면 검색 API body 에 city="서울" 을 넣는다', async () => {
    mount(CategoryPage, { global: { stubs: { NuxtLink: true, RegionChips: true } } })
    await flushPromises()
    const searchCall = fetchSpy.mock.calls.find((c) => String(c[0]).includes('/api/facilities/search'))
    expect(searchCall).toBeTruthy()
    expect((searchCall![1] as { body: { city?: string } }).body.city).toBe('서울')
  })
})
```
> 주의: 이 페이지는 mock 의존이 많다(`useRoute`/`useAsyncData`/`$fetch`/composable). 위 테스트가 페이지의 다른 setup(예: `useRegions`, `useSeoMeta`)에서 터지면, **SSR 데이터 로딩 로직을 순수 헬퍼로 추출**해 테스트하라: `buildListFetch(category, citySlug, page)` → `{ url, options }` 를 반환하는 순수 함수를 `frontend/utils/regionChips.ts` 에 추가하고 그것을 단위 테스트한 뒤 페이지에서 사용. (헬퍼 추출이 더 견고하면 그 경로를 택한다.)

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/category-region-chips.test.ts`
Expected: FAIL — body.city 가 `undefined`(현재 SSR 은 city 미반영).

- [ ] **Step 3: useAsyncData SSR city 반영 구현**

`pages/[category]/index.vue` — import 에 `resolveCityParam` 추가:
```ts
import { resolveCityParam } from '~/utils/regionChips'
```
useAsyncData 블록(347–367행 부근)을 다음으로 교체:
```ts
const isTrash = categoryParam.value === 'trash'
const initialPage = parsePositivePageQuery(route.query.page)
const ssrCitySlug = (route.query.city as string) || ''
const ssrCityName = resolveCityParam(ssrCitySlug) // 한글 city명 or undefined(fail-open)
const { data: ssrData } = await useAsyncData(
  `cat-list-${categoryParam.value}-${ssrCitySlug || 'all'}-p${initialPage}`,
  () => isTrash
    ? $fetch<any>('/api/waste-schedules', {
        params: { page: initialPage, limit: 20, ...(ssrCityName ? { city: ssrCityName } : {}) },
      })
    : $fetch<any>('/api/facilities/search', {
        method: 'POST',
        body: { category: categoryParam.value, page: initialPage, limit: 20, ...(ssrCityName ? { city: ssrCityName } : {}) },
      }),
)
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/category-region-chips.test.ts`
Expected: PASS (`body.city === '서울'`).

- [ ] **Step 5: 셀렉트+키워드 제거, RegionChips 삽입 (템플릿)**

`pages/[category]/index.vue` 템플릿에서 시/도·구/군 `<select>` + 키워드 인풋을 감싼 블록(29–73행의 `<div class="grid grid-cols-1 md:grid-cols-3 gap-3"> … </div>`)을 제거하고 그 자리에 삽입:
```html
<RegionChips
  v-if="categoryParam !== 'trash' || true"
  :href-for="(slug) => (slug ? `/${categoryParam}?city=${slug}` : `/${categoryParam}`)"
  :active-slug="queryCitySlug"
/>
```
> trash 도 백엔드가 city 필터를 지원하므로 포함한다(별도 `v-if` 불필요 — 위 `|| true` 는 가독성용 주석 대신 실제로는 조건 없이 항상 렌더). 실제로는 아래처럼 조건 없이 둔다:
```html
<RegionChips
  :href-for="(slug) => (slug ? `/${categoryParam}?city=${slug}` : `/${categoryParam}`)"
  :active-slug="queryCitySlug"
/>
```
"인기 지역" NuxtLink 블록(240–250행)은 **그대로 둔다**.

- [ ] **Step 6: 셀렉트 구동 상태/핸들러 제거 및 city 를 route.query 로 전환 (스크립트)**

`pages/[category]/index.vue` 스크립트 수정:
1. `performSearch()`(639–656행)에서 city/district 소스를 셀렉트 → `route.query` 로 전환:
```ts
async function performSearch() {
  if (categoryParam.value === 'trash') return
  ssrConsumed.value = true
  const cityName = resolveCityParam((route.query.city as string) || '')
  const params: Record<string, unknown> = { page: currentPage.value, limit: 20, category: categoryParam.value }
  if (cityName) params.city = cityName
  if (categoryParam.value === 'hospital' && selectedDepartments.value.length > 0) {
    params.departments = selectedDepartments.value
  }
  search(params)
}
```
2. 칩 클릭(=`?city=` 변경) 시 page1 로 리셋하고 재조회하도록 watch 추가(기존 `watch` import 사용):
```ts
watch(() => route.query.city, () => {
  currentPage.value = 1
  if (categoryParam.value === 'trash') { wasteCurrentPage.value = 1; loadWasteSchedules() }
  else performSearch()
})
```
3. `loadWasteSchedules()`(664–681행)의 `city`/`district` 소스도 `resolveCityParam(route.query.city)` / 없음으로 전환(구/군 필터 제거):
```ts
async function loadWasteSchedules() {
  ssrConsumed.value = true
  const cityName = resolveCityParam((route.query.city as string) || '')
  const result = await getSchedules({ city: cityName, district: undefined, keyword: undefined, page: wasteCurrentPage.value, limit: 20 })
  wasteSchedules.value = result.schedules
  wasteContact.value = result.contact || null
  wasteTotal.value = result.total
  wasteTotalPages.value = result.totalPages
}
```
4. 제거: `selectedCity`/`selectedDistrict`/`districtList`(337~340행 부근), `filterKeyword`, `handleCityChange`(700행)/`handleDistrictChange`(726행)/`handleFilterSearch`(및 `filterSearchTimer`), onMounted 의 `?city=` → `selectedCity` 설정 블록(788–791행), 그리고 이들만 쓰던 `cities`/`citiesWithDistricts`/`getDistricts`/`loadRegions`(`useRegions`) 참조. **`useRegions` 가 이 페이지에서 더는 안 쓰이면 import 제거.** `queryCitySlug`(326행)와 `canonicalPath`(610–623행)는 **유지**(칩 active + canonical 에 계속 필요).
   - 주의: `line 519 const initialCityName = CITY_SLUG_MAP[...]` 및 관련 미사용 참조가 셀렉트 제거로 dead 가 되면 함께 제거. `CITY_SLUG_MAP` import 가 안 쓰이면 제거.

- [ ] **Step 7: 칩 렌더/셀렉트 제거 회귀 테스트 추가**

`tests/pages/category-region-chips.test.ts` 에 추가:
```ts
it('셀렉트가 사라지고 RegionChips 가 렌더된다', async () => {
  vi.stubGlobal('useRoute', () => ({ params: { category: 'toilet' }, query: {} }))
  const w = mount(CategoryPage, { global: { stubs: { NuxtLink: true, RegionChips: { template: '<div data-test="region-chips" />' } } } })
  await flushPromises()
  expect(w.find('[data-test="region-chips"]').exists()).toBe(true)
  expect(w.find('select').exists()).toBe(false)
})
```
> 페이지 mount 가 다른 mock 문제로 불안정하면, 이 회귀는 **whole-branch 리뷰의 라이브 SSR 확인**으로 대체하고(아래 Step 9) 이 단위 테스트는 생략 가능. SSR city 필터(Step 1–4)는 반드시 자동 테스트로 유지.

- [ ] **Step 8: 전체 프론트 테스트 + 타입/린트**

Run:
```bash
cd frontend && npx vitest run tests/pages/category-region-chips.test.ts tests/components/common/RegionChips.test.ts tests/utils/regionChips.test.ts && npm run lint
```
Expected: PASS. (전체 회귀는 `npm run test` 로 확인 권장.)

- [ ] **Step 9: 라이브 SSR 확인 메모(리뷰용, 배포 후)**

배포 후 `curl -s 'https://ilsangkit.co.kr/toilet?city=seoul&_cb=1'` SSR HTML 에 **서울 소재 항목만** 포함되고 전국 목록이 아님을 확인(thin-dup 해소). page2+ `noindex` 유지 확인. (이 스텝은 배포 후 검증 항목 — 커밋 게이트 아님.)

- [ ] **Step 10: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/[category]/index.vue frontend/tests/pages/category-region-chips.test.ts
git commit -m "refactor(facility-list): SSR-filter by ?city= and replace region selects with RegionChips"
```

---

## Task 3: 부동산 목록 — 필터 셀렉트 → 칩

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/index.vue`
- Test: `frontend/tests/pages/real-estate-region-chips.test.ts` (신규)

**Interfaces:**
- Consumes: `RegionChips`(Task 1). 착지 라우트 `/real-estate/{realEstateType}/{citySlug}`(기존 지역 허브 페이지 `pages/real-estate/[realEstateType]/[city]/index.vue` — 구/군 목록 + 주요 단지, SSR).
- 배경(현재): `<RealEstateSearchFilter>`(17행) `@search="handleSearch"` → `handleSearch()`(300행) → `loadComplexes()`(313행) 클라이언트 재조회. "도시 허브" NuxtLink(129–138행)가 이미 `/real-estate/{type}/{citySlug}` 로 링크. page>1 noindex(260–269행).

- [ ] **Step 1: 칩 렌더 실패 테스트 작성**

`frontend/tests/pages/real-estate-region-chips.test.ts`:
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RealEstateListPage from '~/pages/real-estate/[realEstateType]/index.vue'

beforeEach(() => {
  vi.stubGlobal('useRoute', () => ({ params: { realEstateType: 'apt-sale' }, query: {} }))
  vi.stubGlobal('useAsyncData', () => ({ data: { value: { items: [], total: 0 } } }))
})

describe('부동산 목록 지역 칩', () => {
  it('RealEstateSearchFilter 셀렉트가 사라지고 RegionChips 가 렌더된다', async () => {
    const w = mount(RealEstateListPage, {
      global: { stubs: { NuxtLink: true, RegionChips: { template: '<div data-test="region-chips" />' }, RealEstateSearchFilter: true } },
    })
    await flushPromises()
    expect(w.find('[data-test="region-chips"]').exists()).toBe(true)
    expect(w.findComponent({ name: 'RealEstateSearchFilter' }).exists()).toBe(false)
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate-region-chips.test.ts`
Expected: FAIL — RegionChips 미렌더.

- [ ] **Step 3: 부동산 페이지 필터→칩 교체**

`pages/real-estate/[realEstateType]/index.vue`:
1. 템플릿의 `<RealEstateSearchFilter … @search="handleSearch" />`(17행)을 제거하고 삽입:
```html
<RegionChips :href-for="(slug) => `/real-estate/${realEstateType}/${slug}`" />
```
2. 스크립트에서 `RealEstateSearchFilter` import 제거, `RegionChips` import 추가(`import RegionChips from '~/components/common/RegionChips.vue'`). `handleSearch`(300행)와 그것이 부르던 셀렉트-구동 `loadComplexes` 필터 경로 제거(초기 SSR 목록 로딩 `useAsyncData`(230행)는 유지). 건물명 검색 기능 제거(헤더 통합검색 위임).
3. 기존 "도시 허브" NuxtLink 블록(129–138행)이 칩과 완전히 중복이면 제거해 칩으로 일원화. 다른 정보(주요 도시 요약 등)를 함께 담고 있으면 유지하고 칩만 필터 자리에 추가. (구현자가 129–138 실제 내용 확인 후 판단 — 순수 시/도 링크 목록이면 제거.)
4. `realEstateType`(라우트 파라미터)이 스크립트에 이미 있으면 재사용, 없으면 `const route = useRoute(); const realEstateType = route.params.realEstateType as string` 로 확보(템플릿 표현식용).

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate-region-chips.test.ts`
Expected: PASS.

- [ ] **Step 5: 칩 href 검증 테스트 추가**

같은 파일에 추가:
```ts
it('칩은 /real-estate/{type}/{slug} 로 링크한다', async () => {
  const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }
  const w = mount(RealEstateListPage, { global: { stubs: { NuxtLink: NuxtLinkStub, RealEstateSearchFilter: true } } })
  await flushPromises()
  const hrefs = w.findAll('a').map((a) => a.attributes('href'))
  expect(hrefs).toContain('/real-estate/apt-sale/seoul')
  expect(hrefs).toContain('/real-estate/apt-sale/jeonnamgwangju')
})
```

- [ ] **Step 6: 통과 확인 + 린트**

Run: `cd frontend && npx vitest run tests/pages/real-estate-region-chips.test.ts && npm run lint`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/real-estate/[realEstateType]/index.vue frontend/tests/pages/real-estate-region-chips.test.ts
git commit -m "refactor(real-estate-list): replace search filter with RegionChips linking to city hubs"
```

---

## Task 4: 데드 컴포넌트 삭제

**Files:**
- Delete: `frontend/components/search/SearchFilters.vue`, `frontend/components/trash/RegionSelector.vue`, (조건부) `frontend/components/realEstate/RealEstateSearchFilter.vue`

- [ ] **Step 1: 사용처 0 확인**

Run:
```bash
cd frontend && for f in SearchFilters RegionSelector RealEstateSearchFilter; do echo "== $f =="; grep -rn "$f" --include="*.vue" --include="*.ts" . | grep -v node_modules | grep -v "components/.*/$f.vue" | grep -v "tests/"; done
```
Expected: `SearchFilters`·`RegionSelector` 참조 0. `RealEstateSearchFilter` 는 Task 3 이후 참조 0(테스트 stub 제외). 참조가 남아 있으면 그 파일은 **삭제하지 말고** 남기고 이유를 리뷰에 기록.

- [ ] **Step 2: 삭제**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git rm frontend/components/search/SearchFilters.vue frontend/components/trash/RegionSelector.vue
# RealEstateSearchFilter 는 Step 1 에서 참조 0 확인된 경우에만:
git rm frontend/components/realEstate/RealEstateSearchFilter.vue
```
연관 테스트 파일이 있으면 함께 제거(예: `tests/components/**/RealEstateSearchFilter*.test.ts` — grep 로 확인 후).

- [ ] **Step 3: 빌드/타입/테스트 통과 확인**

Run: `cd frontend && npm run lint && npx nuxt prepare && npm run test`
Expected: 삭제로 인한 미해결 import·타입 오류 없음, 전체 테스트 PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git commit -m "chore(cleanup): remove dead region filter components"
```

---

## 실행 마무리

- [ ] 브랜치를 develop 대상 PR 로 올리고 CI(Test: lint+test+build) green 확인 후 머지. main 승격은 별도 develop→main PR.
- [ ] 배포 후 라이브 검증: `/toilet?city=seoul` SSR 필터(Task 2 Step 9), 부동산 칩 → `/real-estate/apt-sale/seoul` 200, jeonnamgwangju 칩 동작, 경기도 광주(`/gyeonggi/gwangju/...`) 불변.

---

## Self-Review (스펙 커버리지)

- 스펙 §3 D1(범위 시설+부동산): Task 2·3. `/search`·경매·청약 미변경(Global Constraints).
- D2(시/도만): `SIDO_CHIPS` 16개(Task 1). 구/군 셀렉트 제거(Task 2·3).
- D3(키워드 제거): Task 2 Step 5–6(키워드 인풋·handleFilterSearch 제거), Task 3(건물명 제거).
- D4(시설 칩=`?city=`+SSR 필터): Task 2 Step 3–4(SSR), Step 5(칩 착지).
- D5(부동산 칩=`/real-estate/{type}/{city}`): Task 3 Step 3·5.
- D6(인기 구/군 유지): Task 2 Step 5·6(240–250행 유지 명시).
- D7(IP 힌트 v1 제외): 계획에 IP 힌트 태스크 없음(의도적).
- D8(사이트맵 등재 후속): 범위 밖(계획에 없음).
- 스펙 §4-1(RegionChips props/정적/SSR-safe): Task 1. §4-2(데드 컴포넌트): Task 4.
- §5-2(fail-open): `resolveCityParam` undefined 처리(Task 1) + useAsyncData 조건부 city(Task 2 Step 3).
- §5-3(canonical/robots 유지): `canonicalPath`/`isNoindex` 미변경(Task 2 Step 6에서 유지 명시).
- §5-4(빈 결과 회복): 착지 페이지/칩으로 회복 — 별도 태스크 없이 칩 상시 노출로 충족(추가 UI 필요 시 Task 2 확장).
- §9 테스트: 각 태스크 TDD 스텝. SSR 필터는 Task 2 자동 테스트(+라이브 확인).
- §11 성공기준: 실행 마무리 체크리스트.

**갭 메모**: 스펙 §5-4의 "이 지역 결과 없음" 명시 문구는 별도 태스크로 빼지 않았다(현재 목록의 빈 상태 UI + 상시 칩으로 회복 경로 존재). 구현 중 빈 상태가 빈약하면 Task 2 Step 5 에 빈-상태 문구를 함께 넣는다.
