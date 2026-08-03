# 통합 검색 복원 + `/search` 리디자인 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 헤더/홈 검색을 어디서든 통합 `/search`로 되돌리고, `/search`가 부동산+생활시설을 유형별 그룹 프리뷰(부동산 먼저)로 보여주도록 재구성한다.

**Architecture:** PR#617의 컨텍스추얼 스코프를 손으로 부분 되돌림. 백엔드 변경 0 — `/search`가 기존 두 API(`useRealEstate().searchAll` + `useFacilitySearch().searchGrouped`)를 **클라이언트 병렬 fetch**해서 병합·렌더. 카드는 기존 `ComplexCard`/`FacilityCard` 재사용, 그룹/도메인 래퍼 2개만 신설.

**Tech Stack:** Nuxt 3 (Vue 3 SSR) · Pinia · Tailwind · Vitest(happy-dom) · @vue/test-utils

**Spec:** `docs/superpowers/specs/2026-07-24-unified-search-redesign-design.md`
**Mockup (승인):** https://claude.ai/code/artifact/e4c22afe-138d-44cd-9015-fd50232c4f34

## Global Constraints

- **Node 20** 필수 (`nvm use 20`). 패키지 추가 금지(신규 의존성 0). lock 삭제/재생성 금지.
- 모든 변경은 **PR 경유 → `develop`** (main 직접 금지). CI 통과 후 머지.
- **TDD**: 각 태스크 테스트 먼저. 커밋 전 `npm run test` (frontend), 기존 실패도 즉시 수정.
- Backend는 **ESM** — 로컬 import에 `.js` 확장자 (이 플랜은 backend 미변경).
- SSR 가드: 브라우저 API는 `import.meta.client`. 데이터 영역은 `v-if="isMounted"` 유지.
- **유지 계약**: `/search` `robots=noindex, follow` · 4-segment `complexCardUrl`(`toRealEstateUrl`) · `/search?category=X → /{category}` 301 · 기존 `AdBanner` 슬롯 · 결과 클라이언트 렌더.
- 실행 디렉터리: 프론트 명령은 `cd frontend`.

## Setup (실행 시작 시 1회)

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git fetch origin
git checkout -b feat/unified-search-restructure origin/develop
nvm use 20
```

## File Structure

**Modify**
- `frontend/components/common/HeaderSearch.vue` — submit 통합, scope 제거
- `frontend/pages/index.vue` — 홈 히어로 submit 통합, scope 핀 제거
- `frontend/pages/search.vue` — 통합 병렬 fetch + 2도메인 그룹 렌더 (핵심)
- 관련 테스트 4종 (아래 각 태스크)

**Create**
- `frontend/components/search/SearchDomainSection.vue` — 도메인 헤더 + 그룹 슬롯
- `frontend/components/search/SearchResultGroup.vue` — 유형 그룹 헤더(아이콘/라벨/건수/더보기) + 카드 슬롯
- 신규 컴포넌트/페이지 테스트

**Unchanged (확인만)**
- `frontend/components/search/SearchAutocomplete.vue` — scope 미전달 시 이미 통합(수정 없음)
- `frontend/utils/searchScope.ts` — SearchAutocomplete가 여전히 참조(제거 안 함)
- `backend/**` — 변경 없음 (undefined scope = 통합 suggest)
- `frontend/pages/[category]/index.vue` — 시설 키워드 검색·로깅 그대로 유지 (아래 "Deviations" 참조)

## Deviations from Spec

- **Spec C2(카테고리 페이지 로깅 제거) 보류.** 근거: 로깅 3사이트가 `categorySearchLog.test.ts`의 소스텍스트 단언으로 고정돼 있고, `[category]/index.vue`는 SSR `useAsyncData` 로 mount 검증이 까다로운 load-bearing 파일. 제거 시 위험 대비 이득(경미한 키워드 중복 카운트 방지) 낮음. → 카테고리 페이지 로깅은 **그대로 유지**, `/search` 로깅만 통합(C1). 드릴다운 중복 카운트는 경미한 노이즈로 수용. 완전 단일화는 후속 PR.

---

## Task 1: 헤더·홈 검색을 통합 `/search`로

**Files:**
- Modify: `frontend/components/common/HeaderSearch.vue`
- Modify: `frontend/pages/index.vue:62` (scope 핀), `frontend/pages/index.vue:484-489` (handleSearch)
- Test: `frontend/tests/components/common/HeaderSearch.test.ts` (기존), `frontend/tests/utils/searchScope.test.ts` (기존, 회귀 확인)

**Interfaces:**
- Consumes: `navigateTo` (Nuxt auto-import), `SearchAutocomplete` (scope prop 선택적)
- Produces: 헤더/홈 submit → 항상 `/search?keyword={q}`. `searchScope.ts` 함수는 그대로 존재(SearchAutocomplete 참조).

- [ ] **Step 1: HeaderSearch 테스트를 통합 목적지로 갱신 (실패 확인)**

`frontend/tests/components/common/HeaderSearch.test.ts` 를 열어 `buildSearchDestination`/`/{category}?keyword=`/scope 관련 단언이 있으면 아래로 교체(없으면 이 케이스를 추가). 파일 상단 mock에 `navigateTo` 스텁이 없으면 추가한다.

```ts
// 추가/교체할 핵심 케이스 (파일의 기존 mount 헬퍼·mock 패턴을 따를 것)
it('시설 카테고리 페이지에서도 submit은 통합 /search로 간다', async () => {
  const navSpy = vi.fn()
  vi.stubGlobal('navigateTo', navSpy)
  // useRoute를 시설 카테고리(/toilet)로 스텁
  vi.stubGlobal('useRoute', () => ({ path: '/toilet', params: { category: 'toilet' }, query: {} }))
  const wrapper = mount(HeaderSearch, { global: { stubs: { SearchAutocomplete: true } } })
  const input = wrapper.find('input[aria-label="통합 검색"]')
  await input.setValue('강남')
  await input.trigger('keydown', { key: 'Enter' })
  expect(navSpy).toHaveBeenCalledWith('/search?keyword=%EA%B0%95%EB%82%A8')
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/common/HeaderSearch.test.ts`
Expected: FAIL (현재는 `/toilet?keyword=...` 로 감)

- [ ] **Step 3: HeaderSearch.vue 통합 구현**

`frontend/components/common/HeaderSearch.vue` `<script setup>` 에서 scope 로직 제거:

```ts
// import 교체: searchScope 의존 제거
// (삭제) import { resolveSearchScope, buildSearchDestination, scopePlaceholder } from '~/utils/searchScope'

// (삭제) const route = useRoute()
// (삭제) const scope = computed(() => resolveSearchScope(route))
// (삭제) const placeholder = computed(() => scopePlaceholder(scope.value))
const placeholder = '장소·단지명·시설명 검색'

function submit() {
  const q = keyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  overlayOpen.value = false
  navigateTo('/search?keyword=' + encodeURIComponent(q))
}
```

템플릿에서 두 곳의 `:scope="scope"` 바인딩과 두 input `aria-label="통합 검색"` 은 유지, `:placeholder="placeholder"` 유지(이제 문자열). `<SearchAutocomplete>` 의 `:scope="scope"` **제거**(2곳, line 21·52):

```html
<!-- before: <SearchAutocomplete ref="acDesktopRef" :open="focused" :model-value="keyword" :scope="scope" @close="focused = false" /> -->
<SearchAutocomplete ref="acDesktopRef" :open="focused" :model-value="keyword" @close="focused = false" />
<!-- 모바일도 동일하게 :scope 제거 -->
```

`computed` import가 다른 곳에서 안 쓰이면 vue import에서 제거(`ref, watch, nextTick`만 남김 — 확인 후).

- [ ] **Step 4: 홈 히어로 통합 구현 (`pages/index.vue`)**

`frontend/pages/index.vue` line 484-489 `handleSearch` 교체 + line 62 scope 핀 제거 + 사용 안 하는 import 정리:

```ts
function handleSearch() {
  const q = searchKeyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  navigateTo('/search?keyword=' + encodeURIComponent(q))
}
```

```html
<!-- line 62: :scope="{ kind: 'realestate' }" 제거 -->
<SearchAutocomplete ref="heroAcRef" :open="heroFocused" :model-value="searchKeyword" @close="heroFocused = false" />
```

line 285 `import { resolveSearchScope, buildSearchDestination } from '~/utils/searchScope'` 제거(둘 다 미사용 됨 — grep로 확인).

- [ ] **Step 5: 테스트 통과 + 회귀 확인**

Run: `cd frontend && npx vitest run tests/components/common/HeaderSearch.test.ts tests/utils/searchScope.test.ts tests/components/common/AppHeaderSearch.test.ts tests/components/common/HeaderSearchAutocomplete.test.ts`
Expected: PASS (searchScope.test.ts는 함수 미변경이라 그대로 green; Header 계열 green). 실패 시 각 파일의 scope 기대값을 통합 목적지로 갱신.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/common/HeaderSearch.vue frontend/pages/index.vue frontend/tests/components/common/HeaderSearch.test.ts
git commit -m "feat(search): 헤더·홈 검색을 통합 /search 진입점으로 복원 (스코프 제거)"
```

---

## Task 2: `/search` 데이터층 — 시설+부동산 병렬 fetch·병합

**Files:**
- Modify: `frontend/pages/search.vue` (script) — `useFacilitySearch` 재도입, `performSearch` 병렬화, `facilityGrouped`/정렬 computed
- Test: `frontend/tests/pages/search.test.ts` (기존 단언 교체)

**Interfaces:**
- Consumes: `useFacilitySearch().searchGrouped(params)` → `groupedResults: GroupedCategory[]`([{category,label,count,items:Facility[]}]), `groupedTotalCount: number`. `useRealEstate().searchAll(keyword,city,district)` → `{categories:[{type,count,items}], ...}`(런타임 `type` 필드 authoritative).
- Produces: `facilityGroups` (건수 desc 정렬된 `GroupedCategory[]`), `realEstateGroups`(apt→villa→offitel 고정), `facilityTotalCount`, `realEstateTotalCount`, `combinedTotalCount`.

- [ ] **Step 1: 데이터층 테스트 갱신 (실패 확인)**

`frontend/tests/pages/search.test.ts` 에서 "부동산 전용" 단언을 통합 단언으로 교체. mock에 `useFacilitySearch` 추가, `searchGrouped` 스파이 도입. aria-label 셀렉터 `부동산 검색`→`통합 검색`.

```ts
// 상단 mock 추가
const searchGroupedMock = vi.fn().mockResolvedValue(undefined)
const groupedResultsRef = ref<any[]>([])
const groupedTotalRef = ref(0)
vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({
    searchGrouped: searchGroupedMock,
    groupedResults: groupedResultsRef,
    groupedTotalCount: groupedTotalRef,
    recovery: ref(null),
  }),
}))

// 교체 케이스
it('마운트 시 키워드가 있으면 부동산·시설 검색을 모두 호출한다', async () => {
  // useRoute를 keyword 있는 상태로 스텁 (파일 상단 useRoute mock을 query:{keyword:'강남'}로)
  const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
  await flushPromises()
  expect(searchAllMock).toHaveBeenCalled()
  expect(searchGroupedMock).toHaveBeenCalled()  // 시설 병렬 fetch 복원
  expect(wrapper.exists()).toBe(true)
})

it('통합 검색 입력이 렌더된다', () => {
  const wrapper = mount(SearchPage, { global: { stubs: globalStubs } })
  expect(wrapper.find('input[aria-label="통합 검색"]').exists()).toBe(true)
})
```

기존 `'생활시설 3-탭...부동산 전용'` 케이스와 `[role="tablist"]` 없음 단언은 삭제(통합에선 탭 대신 도메인 섹션). `input[aria-label="부동산 검색"]` 참조를 `통합 검색`으로 모두 교체.

- [ ] **Step 2: 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/search.test.ts`
Expected: FAIL (`searchGroupedMock` 미호출 / `통합 검색` input 없음)

- [ ] **Step 3: search.vue script — 시설 fetch 재도입 + 병렬 performSearch**

`frontend/pages/search.vue` `<script setup>` 수정:

```ts
// import 추가
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import type { GroupedCategory } from '~/types/facility'

// 컴포저블 확보 (기존 useRealEstate 라인 근처)
const { searchGrouped: searchFacilitiesGrouped, groupedResults, groupedTotalCount } = useFacilitySearch()

// line 272 주석/상태 교체: 시설 재도입
// (삭제) 부동산 전용 검색 상태 주석

// 시설 그룹 (건수 desc). GroupedCategory = {category,label,count,items:Facility[]}
const facilityGroups = computed<GroupedCategory[]>(() =>
  [...groupedResults.value].filter(g => g.count > 0).sort((a, b) => b.count - a.count),
)
const facilityTotalCount = computed(() => groupedTotalCount.value)

// 부동산 그룹: 기존 realEstateGrouped 재사용하되 apt→villa→offitel 고정 정렬
const RE_ORDER: Record<string, number> = { apt: 0, villa: 1, offitel: 2 }
const realEstateGroups = computed(() =>
  [...realEstateGrouped.value].sort((a, b) => (RE_ORDER[a.propertyType] ?? 9) - (RE_ORDER[b.propertyType] ?? 9)),
)

const combinedTotalCount = computed(() => facilityTotalCount.value + realEstateTotalCount.value)
```

`performSearch` 를 병렬화 (유형 필터 드릴다운은 기존 분기 유지):

```ts
async function performSearch() {
  loading.value = true
  try {
    if (selectedRealEstateType.value) {
      await searchRealEstatePaged(selectedRealEstateType.value, reCurrentPage.value)
      return
    }
    const kw = searchKeyword.value || undefined
    const city = selectedCity.value || undefined
    const district = selectedDistrict.value || undefined
    await Promise.all([
      searchRealEstate(kw, city, district)
        .then(r => { realEstateResults.value = ((r?.categories as unknown) as RealEstateResultCategory[] | undefined)?.filter(c => c.count > 0) || [] })
        .catch(() => { realEstateResults.value = [] }),
      // 시설은 키워드가 있을 때만 (grouped는 전국 팬아웃이라 빈 키워드 방지)
      kw
        ? searchFacilitiesGrouped({ keyword: kw, city, district, limit: 20 }).catch(() => undefined)
        : Promise.resolve(),
    ])
  } finally {
    loading.value = false
  }
}
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/search.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/search.vue frontend/tests/pages/search.test.ts
git commit -m "feat(search): /search 시설 grouped 병렬 fetch 재도입 (통합 데이터층)"
```

---

## Task 3: 그룹/도메인 래퍼 컴포넌트

**Files:**
- Create: `frontend/components/search/SearchResultGroup.vue`
- Create: `frontend/components/search/SearchDomainSection.vue`
- Test: `frontend/tests/components/search/SearchResultGroup.test.ts`, `frontend/tests/components/search/SearchDomainSection.test.ts`

**Interfaces:**
- Produces:
  - `SearchResultGroup` props: `{ label: string; count: number; countUnit?: string; moreHref: string; iconImg?: string; catColor?: string }`, default slot = 카드들. 헤더(아이콘 타일 + 라벨 + `count countUnit` + `더보기 →` 링크) + `<div class="grid ...">` 슬롯.
  - `SearchDomainSection` props: `{ title: string; count: number; countLabel?: string }`, default slot = 그룹들. 도메인 헤더(h2 + 구분선 + 건수) + 슬롯.

- [ ] **Step 1: SearchResultGroup 테스트 (실패 확인)**

`frontend/tests/components/search/SearchResultGroup.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

describe('SearchResultGroup', () => {
  it('라벨·건수·더보기 링크를 렌더한다', () => {
    const w = mount(SearchResultGroup, {
      props: { label: '화장실', count: 12, countUnit: '곳', moreHref: '/toilet?keyword=강남' },
      slots: { default: '<div class="card">c</div>' },
      global: { stubs },
    })
    expect(w.text()).toContain('화장실')
    expect(w.text()).toContain('12')
    const more = w.find('a[href="/toilet?keyword=강남"]')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('더보기')
    expect(w.find('.card').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/search/SearchResultGroup.test.ts`
Expected: FAIL ("Cannot find module SearchResultGroup.vue")

- [ ] **Step 3: SearchResultGroup.vue 구현**

목업 그룹 헤더 스펙 그대로. 아이콘 타일: `iconImg`(webp) 우선, 없으면 `catColor` 틴트 원. 카드 그리드 1/2/3열.

```vue
<template>
  <div class="mb-6 last:mb-0">
    <div class="flex items-center justify-between mb-3">
      <div class="flex items-center gap-2.5 min-w-0">
        <span
          v-if="iconImg"
          class="w-[30px] h-[30px] rounded-lg bg-slate-50 flex items-center justify-center shrink-0"
        >
          <img :src="`/icons/category/${iconImg}.webp?v2`" :alt="label" class="w-[19px] h-[19px]" width="19" height="19" />
        </span>
        <span
          v-else
          class="w-[30px] h-[30px] rounded-lg flex items-center justify-center shrink-0"
          :style="catColor ? { backgroundColor: `color-mix(in srgb, ${catColor} 12%, white)`, color: catColor } : undefined"
        >
          <CategoryIcon v-if="catCategory" :category-id="catCategory" size="sm" />
        </span>
        <span class="text-base font-bold text-strong tracking-tight truncate">{{ label }}</span>
        <span class="text-[13px] font-semibold text-faint tabular-nums shrink-0">{{ count.toLocaleString('ko-KR') }}{{ countUnit }}</span>
      </div>
      <NuxtLink :to="moreHref" class="shrink-0 inline-flex items-center gap-0.5 text-[13px] font-bold text-primary px-2 py-1.5 rounded-lg hover:bg-primary-50 transition-colors">
        더보기
        <span class="material-symbols-outlined text-[15px]">chevron_right</span>
      </NuxtLink>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import CategoryIcon from '~/components/common/CategoryIcon.vue'
withDefaults(defineProps<{
  label: string
  count: number
  moreHref: string
  countUnit?: string
  iconImg?: string
  catColor?: string
  catCategory?: string
}>(), { countUnit: '곳' })
</script>
```

- [ ] **Step 4: SearchDomainSection 테스트 (실패 확인)**

`frontend/tests/components/search/SearchDomainSection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchDomainSection from '~/components/search/SearchDomainSection.vue'

describe('SearchDomainSection', () => {
  it('제목·건수 라벨·슬롯을 렌더한다', () => {
    const w = mount(SearchDomainSection, {
      props: { title: '부동산', count: 13, countLabel: '실거래가' },
      slots: { default: '<div class="g">그룹</div>' },
    })
    expect(w.find('h2').text()).toBe('부동산')
    expect(w.text()).toContain('13')
    expect(w.find('.g').exists()).toBe(true)
  })
})
```

- [ ] **Step 5: 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/search/SearchDomainSection.test.ts`
Expected: FAIL

- [ ] **Step 6: SearchDomainSection.vue 구현**

```vue
<template>
  <section class="mt-8 first:mt-0">
    <div class="flex items-baseline gap-3 pb-3 mb-5 border-b border-line">
      <h2 class="text-xl md:text-2xl font-bold text-strong tracking-tight">{{ title }}</h2>
      <span class="text-[13px] font-semibold text-faint tabular-nums">
        <template v-if="countLabel">{{ countLabel }} · </template>{{ count.toLocaleString('ko-KR') }}건
      </span>
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; count: number; countLabel?: string }>()
</script>
```

- [ ] **Step 7: 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/components/search/SearchResultGroup.test.ts tests/components/search/SearchDomainSection.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add frontend/components/search/SearchResultGroup.vue frontend/components/search/SearchDomainSection.vue frontend/tests/components/search/SearchResultGroup.test.ts frontend/tests/components/search/SearchDomainSection.test.ts
git commit -m "feat(search): 그룹/도메인 래퍼 컴포넌트 추가"
```

---

## Task 4: `/search` 표시층 — 2도메인 그룹 렌더 + 히어로/빈상태

**Files:**
- Modify: `frontend/pages/search.vue` (template + 매핑 헬퍼)
- Test: `frontend/tests/pages/search.test.ts` (렌더 단언 추가), `frontend/tests/pages/searchComplexCardUrl.test.ts` (회귀 green 유지)

**Interfaces:**
- Consumes: Task 2의 `facilityGroups`/`realEstateGroups`, Task 3의 `SearchDomainSection`/`SearchResultGroup`, 기존 `FacilityCard`/`ComplexCard`.
- Produces: `reItemToComplex(item)` 매핑(프리뷰 아이템 → `ComplexInfo` 유사체), `facilityMoreHref(cat)`, `reMoreHref(propertyType)`.

- [ ] **Step 1: 렌더 테스트 추가 (실패 확인)**

`frontend/tests/pages/search.test.ts` — keyword 있는 useRoute mock + 결과 있는 mock으로 도메인 섹션 렌더 검증. `groupedResultsRef`/`groupedTotalRef` 를 채우고 `searchAllMock` 이 부동산 그룹 반환하도록 설정.

```ts
it('결과가 있으면 부동산·생활시설 도메인 섹션을 렌더한다 (부동산 먼저)', async () => {
  // useRoute mock: query { keyword: '강남' }
  groupedResultsRef.value = [{ category: 'toilet', label: '화장실', count: 12, items: [] }]
  groupedTotalRef.value = 12
  searchAllMock.mockResolvedValue({ categories: [{ type: 'apt-sale', count: 3, items: [] }] })
  const wrapper = mount(SearchPage, { global: { stubs: { ...globalStubs, SearchDomainSection: { template: '<section><h2>{{ title }}</h2><slot/></section>', props: ['title','count','countLabel'] }, SearchResultGroup: { template: '<div><slot/></div>', props: ['label','count','moreHref','iconImg','catColor','countUnit','catCategory'] } } } })
  await flushPromises()
  const h2s = wrapper.findAll('h2').map(h => h.text())
  expect(h2s).toContain('부동산')
  expect(h2s).toContain('생활시설')
  expect(h2s.indexOf('부동산')).toBeLessThan(h2s.indexOf('생활시설')) // 부동산 먼저
})
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/search.test.ts`
Expected: FAIL (도메인 섹션 미렌더)

- [ ] **Step 3: search.vue 매핑 헬퍼 추가**

```ts
import { CATEGORY_META } from '~/types/facility'
import type { ComplexInfo } from '~/types/realEstate'

// RE 프리뷰 아이템 → ComplexCard 소비용 매핑
function reItemToComplex(item: any): ComplexInfo {
  return {
    buildingName: item.buildingName,
    city: item.city || '',
    district: item.district || '',
    dongName: item.dongName || '',
    lastDealYear: item.dealYear ?? null,
    lastDealMonth: item.dealMonth ?? null,
    buildYear: item.buildYear ?? null,
    transactionCount: item.transactionCount ?? 0,
  } as ComplexInfo
}

function facilityMoreHref(category: string): string {
  const kw = encodeURIComponent(searchKeyword.value.trim())
  const city = selectedCity.value ? `&city=${encodeURIComponent(selectedCity.value)}` : ''
  return `/${category}?keyword=${kw}${city}`
}

function reMoreHref(propertyType: string): string {
  // 부동산 더보기 = 인페이지 드릴다운(기존 selectRealEstateType) — 링크가 아닌 클릭 핸들러 사용.
  // SearchResultGroup은 링크(moreHref)를 요구하므로, 인페이지 유지 위해 '#'로 두고 @click 캡처.
  return '#'
}
const facilityCatColor: Record<string, string> = {} // CATEGORY_META에서 색 사용 시 채움; 미사용 시 iconImg 우선
```

주: 부동산 더보기는 인페이지 드릴다운을 유지하므로, RE `SearchResultGroup` 사용 시 `moreHref="#"` + `@click.prevent`로 `selectRealEstateType(propertyType)` 호출. (SearchResultGroup 더보기 링크에 클릭 핸들러가 전파되도록 부모에서 `@click`을 잡는다.)

- [ ] **Step 4: search.vue 템플릿 — 그룹 뷰를 2도메인 섹션으로 교체**

기존 "부동산 그룹 뷰"(line 185-207)와 "결과 타입 chip bar"(line 82-121)를 **제거**하고, `selectedRealEstateType` 미선택 시 아래 통합 뷰를 렌더. 유형 선택 시 인페이지 페이지드 뷰(line 143-183)는 **유지**. (히어로/지역필터/로딩/빈상태 골격은 유지)

```html
<!-- selectedRealEstateType 미선택 & 결과 있음: 통합 도메인 뷰 -->
<template v-if="!selectedRealEstateType">
  <!-- 부동산 먼저 -->
  <SearchDomainSection v-if="realEstateGroups.length" title="부동산" :count="realEstateTotalCount" count-label="실거래가">
    <SearchResultGroup
      v-for="g in realEstateGroups"
      :key="g.propertyType"
      :label="g.label"
      :count="g.totalCount"
      count-unit="곳"
      :icon-img="g.iconImg"
      :more-href="'#'"
      @click.prevent="selectRealEstateType(g.propertyType)"
    >
      <ComplexCard
        v-for="(it, i) in g.items.slice(0, 3)"
        :key="`${it.buildingName}-${i}`"
        :complex="reItemToComplex(it)"
        :property-type="g.propertyType"
        tab="sale"
      />
    </SearchResultGroup>
  </SearchDomainSection>

  <!-- 생활시설 -->
  <SearchDomainSection v-if="facilityGroups.length" title="생활시설" :count="facilityTotalCount" :count-label="`${facilityGroups.length}개 카테고리`">
    <SearchResultGroup
      v-for="g in facilityGroups"
      :key="g.category"
      :label="g.label"
      :count="g.count"
      count-unit="곳"
      :cat-category="g.category"
      :more-href="facilityMoreHref(g.category)"
    >
      <FacilityCard v-for="item in g.items.slice(0, 3)" :key="item.id" :facility="item" />
    </SearchResultGroup>
  </SearchDomainSection>

  <AdBanner v-if="realEstateGroups.length || facilityGroups.length" class="my-4" />
</template>
```

`import`에 `SearchDomainSection`, `SearchResultGroup`, `ComplexCard`, `FacilityCard` 추가. (FacilityCard/ComplexCard는 auto-import일 수 있으나 명시 import 권장 — vitest auto-import 함정 메모리 §.)

- [ ] **Step 5: 히어로 통합 문구 + 빈 상태 (B6·B5)**

```ts
const heroTitle = computed(() => searchKeyword.value ? `'${searchKeyword.value}' 검색 결과` : '통합 검색')
const heroDescription = computed(() => searchKeyword.value
  ? '생활시설과 부동산 실거래가를 한 번에 찾았어요.'
  : '장소·단지명·시설명으로 생활시설과 부동산을 함께 검색하세요.')
const heroStats = computed(() => {
  if (!searchKeyword.value) return []
  return [
    { label: '생활시설', value: facilityTotalCount.value > 0 ? `${facilityTotalCount.value.toLocaleString('ko-KR')}곳` : '—' },
    { label: '부동산', value: realEstateTotalCount.value > 0 ? `${realEstateTotalCount.value.toLocaleString('ko-KR')}건` : '—' },
  ]
})
```

PageHero `eyebrow="부동산 검색"` → `eyebrow="통합 검색"`. input `aria-label="부동산 검색"` → `"통합 검색"`, `placeholder="단지명·지역으로 검색하세요"` → `"장소·단지명·시설명 검색"`.

빈 상태(EmptyState): 두 도메인 모두 0일 때만 표시로 조건 변경:

```html
<EmptyState
  v-if="!selectedRealEstateType && realEstateGroups.length === 0 && facilityGroups.length === 0"
  :title="searchKeyword ? '검색 결과가 없어요' : UI_MESSAGES.emptySearch"
  description="장소·단지명·시설명으로 검색해보세요"
>
  <NuxtLink to="/real-estate" class="btn-primary inline-flex items-center gap-1.5 text-sm">부동산 실거래가 보기</NuxtLink>
</EmptyState>
```

- [ ] **Step 6: 실행 → 통과 + URL 회귀 확인**

Run: `cd frontend && npx vitest run tests/pages/search.test.ts tests/pages/searchComplexCardUrl.test.ts`
Expected: PASS (complexCardUrl 4-segment 회귀 green 유지 — `complexCardUrl` 함수·페이지드 뷰 미변경)

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/search.vue frontend/tests/pages/search.test.ts
git commit -m "feat(search): /search 2도메인 그룹 프리뷰 렌더 (부동산 먼저 → 생활시설)"
```

---

## Task 5: 로깅 통합 (C1)

**Files:**
- Modify: `frontend/pages/search.vue` (watch(loading) 로깅 블록)
- Test: `frontend/tests/pages/searchLog.test.ts`

**Interfaces:**
- Consumes: `logSearch({keyword, resultCount, city, district, category})`, `combinedTotalCount`.
- Produces: `/search` 로깅 resultCount = 시설+부동산 합, category='unified'.

- [ ] **Step 1: searchLog 테스트 갱신 (실패 확인)**

`frontend/tests/pages/searchLog.test.ts` — `useFacilitySearch` mock 추가(시설 count 포함), aria-label `통합 검색`, 기대 resultCount = 시설+부동산 합, category `unified`.

```ts
// useFacilitySearch mock 추가 (시설 5곳)
vi.mock('~/composables/useFacilitySearch', () => ({
  useFacilitySearch: () => ({
    searchGrouped: vi.fn().mockResolvedValue(undefined),
    groupedResults: ref([{ category: 'toilet', label: '화장실', count: 5, items: [] }]),
    groupedTotalCount: ref(5),
    recovery: ref(null),
  }),
}))

// 기대값 교체: resultCount = 부동산(4+3) + 시설(5) = 12, category 'unified'
expect(call.resultCount).toBe(12)
expect(call.category).toBe('unified')
// input 셀렉터: '부동산 검색' → '통합 검색'
```

- [ ] **Step 2: 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/searchLog.test.ts`
Expected: FAIL (resultCount 7 / category 'realestate')

- [ ] **Step 3: search.vue 로깅 블록 통합**

`watch(loading, ...)` 내부(line 595-614):

```ts
watch(loading, (now, prev) => {
  if (prev && !now && searchKeyword.value) {
    const resultCount = selectedRealEstateType.value ? reTotal.value : combinedTotalCount.value
    trackSearchResultsView({ keyword: searchKeyword.value, resultCount, category: 'unified' })
    logSearch({
      keyword: searchKeyword.value,
      resultCount,
      city: selectedCity.value || undefined,
      district: selectedDistrict.value || undefined,
      category: 'unified',
    })
    if (resultCount === 0) trackSearchNoResults({ keyword: searchKeyword.value })
  }
})
```

- [ ] **Step 4: 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/searchLog.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/search.vue frontend/tests/pages/searchLog.test.ts
git commit -m "feat(search): /search 로깅을 통합 resultCount(시설+부동산)로 단일화"
```

---

## Task 6: 전체 검증 + 정리 + PR

**Files:** 없음(검증) — 발견되는 실패만 수정

- [ ] **Step 1: search.vue 데드코드 정리**

`rePaginationRange`, `filteredRealEstateGrouped` (chip bar 제거로 미사용) 제거. `RealEstateResultCategory` 등 사용 타입은 유지. 미사용 import(예: 제거된 chip 관련) 정리.

- [ ] **Step 2: 전체 프론트 테스트**

Run: `cd frontend && npm run test`
Expected: PASS (실패 시: scope/aria-label/탭 관련 잔여 단언을 통합 기준으로 수정. 특히 `tests/pages/search.test.ts`·`searchLog.test.ts`·`HeaderSearch*`·`SearchAutocomplete*`)

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS (미사용 변수/import 오류 시 제거)

- [ ] **Step 4: 백엔드 회귀(무변경 확인)**

Run: `cd backend && npm run test`
Expected: PASS (백엔드 미변경 — suggest scope는 undefined=통합 기본)

- [ ] **Step 5: 라이브 사전 점검 (dev 렌더)**

`npm run dev`(frontend+backend) 후 브라우저에서 `/search?keyword=강남` 확인: 부동산 섹션 먼저, 생활시설 섹션, 유형별 대표 3개 + 더보기(시설→`/{cat}?keyword=`, 부동산→인페이지 페이지드), 헤더 검색 어디서든 `/search`. Vue 하이드레이션 경고 0. (브라우저 DOM이 ground-truth — Nitro 캐시로 curl stale 가능)

- [ ] **Step 6: PR 생성 (develop 대상)**

```bash
git push -u origin feat/unified-search-restructure
gh pr create --base develop --title "feat(search): 통합 검색 복원 + /search 리디자인" --body "스펙/플랜: docs/superpowers/{specs,plans}/2026-07-24-*. 헤더·홈 검색 통합 진입점 복원, /search 부동산+생활시설 유형별 그룹 프리뷰(부동산 먼저), 로깅 통합. 백엔드 무변경. noindex/4-segment URL/301/광고 슬롯 유지."
```

CI(lint+test+build) 통과 확인 후 머지.

---

## Self-Review (완료)

- **Spec 커버리지**: A1/A2(Task1) · A3(Task1, scope 미전달) · A4(유지, Task4 더보기 목적지) · B1(Task2) · B2/B3/B7(Task2·4) · B4(Task4, 부동산 인페이지/시설 링크) · B5/B6(Task4) · B8(자연 해소 — grouped 키워드 검색은 좌표 없음→FacilityCard 거리 미표시) · C1(Task5) · C2(보류, Deviations 명시) · D 계약(Global Constraints + Task4·6 확인). ✅
- **Placeholder 스캔**: 각 코드 스텝에 실제 코드/명령/기대값 기재. ✅
- **타입 일관성**: `groupedResults:GroupedCategory[]{category,label,count,items}` · RE 런타임 `{type,count,items}` (스테일 `RealEstateGroupedCategory.category` 대신 `type` 사용, 기존 `realEstateGrouped` 재사용) · `reItemToComplex`→`ComplexInfo`(ComplexCard 소비) · `combinedTotalCount = facilityTotalCount + realEstateTotalCount`. ✅
- **주의(실행자용)**: RE 더보기는 링크가 아니라 인페이지 드릴다운 — `SearchResultGroup`의 `더보기` 앵커에 부모 `@click.prevent="selectRealEstateType(...)"`가 걸리는지 렌더 확인(필요 시 `SearchResultGroup`에 `@more` emit 추가 고려). FacilityCard/ComplexCard는 명시 import(vitest auto-import 함정).
