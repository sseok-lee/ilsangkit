# 데이터 출처 표기 표준화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데이터 출처 표기를 단일 도메인 인지 컴포넌트 `DataSourceSection`으로 통일하고, 출처를 항상 노출하며(조건부 숨김 제거), 출처가 없던 지역·청약 하위 페이지에 표기를 추가한다.

**Architecture:** 순수 함수 `resolveDataSource(domain, category?)`가 도메인→`DataSourceInfo` 매핑을 담당(유닛 테스트 대상). 단일 컴포넌트 `DataSourceSection.vue`가 그 결과를 항상 렌더하고 `최근 동기화`는 상세 페이지에서만 표시. 기존 `DataSourceCard.vue`는 삭제하고 19개 호출처를 마이그레이션한다.

**Tech Stack:** Nuxt 3 (SSR) · Vue 3 `<script setup>` · TypeScript · Vitest + @vue/test-utils · TailwindCSS

**Spec:** `docs/superpowers/specs/2026-06-02-data-source-attribution-standardization-design.md`

**작업 디렉터리:** 모든 명령은 `frontend/`에서 실행. 커밋 전 `nvm use 20` 확인(메모리: Node 20 필수, lock 파일 재생성 금지).

---

## File Structure

| 파일 | 책임 | 상태 |
|---|---|---|
| `frontend/utils/dataSource.ts` | 레지스트리 + `resolveDataSource` 순수 함수 + `DataSourceDomain` 타입 | 수정 |
| `frontend/components/common/DataSourceSection.vue` | 도메인 인지 출처 표시(full/compact) | 신설 |
| `frontend/components/common/DataSourceCard.vue` | (구) 순수 표시용 | **삭제** |
| `frontend/utils/dataSource.test.ts` | resolver 유닛 테스트 | 신설 |
| `frontend/tests/components/common/DataSourceSection.test.ts` | 컴포넌트 테스트 | 신설 |
| `frontend/tests/components/common/DataSourceCard.test.ts` | (구) 컴포넌트 테스트 | **삭제** |
| 마이그레이션 호출처 19곳 | `DataSourceCard` → `DataSourceSection` | 수정 |
| `frontend/tests/pages/real-estate/*.test.ts` (3) | 스텁 키 rename | 수정 |

---

## Task 1: `resolveDataSource` 순수 함수 + 유닛 테스트

**Files:**
- Modify: `frontend/utils/dataSource.ts` (끝에 추가)
- Test: `frontend/utils/dataSource.test.ts` (신설)

- [ ] **Step 1: 실패하는 테스트 작성**

Create `frontend/utils/dataSource.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  resolveDataSource,
  FACILITY_DATA_SOURCE,
  REAL_ESTATE_DATA_SOURCE,
  SUBSCRIPTION_DATA_SOURCE,
  PUBLIC_RENTAL_DATA_SOURCE,
} from './dataSource'

describe('resolveDataSource', () => {
  it('facility 도메인 + category로 해당 시설 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'facility', category: 'pharmacy' }))
      .toBe(FACILITY_DATA_SOURCE.pharmacy)
  })

  it('facility 도메인인데 category가 없으면 null을 반환한다', () => {
    expect(resolveDataSource({ domain: 'facility' })).toBeNull()
  })

  it('facility 도메인 + 알 수 없는 category면 null을 반환한다', () => {
    // @ts-expect-error 의도적으로 잘못된 category
    expect(resolveDataSource({ domain: 'facility', category: 'nope' })).toBeNull()
  })

  it('real-estate 도메인은 부동산 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'real-estate' })).toBe(REAL_ESTATE_DATA_SOURCE)
  })

  it('subscription 도메인은 청약 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'subscription' })).toBe(SUBSCRIPTION_DATA_SOURCE)
  })

  it('public-rental 도메인은 공공임대 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'public-rental' })).toBe(PUBLIC_RENTAL_DATA_SOURCE)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run utils/dataSource.test.ts`
Expected: FAIL — `resolveDataSource is not a function` (export 없음)

- [ ] **Step 3: 최소 구현 추가**

`frontend/utils/dataSource.ts` 맨 끝(파일 마지막 `}` 다음)에 추가:

```ts

export type DataSourceDomain = 'facility' | 'real-estate' | 'subscription' | 'public-rental'

export function resolveDataSource(input: {
  domain: DataSourceDomain
  category?: FacilityCategory
}): DataSourceInfo | null {
  switch (input.domain) {
    case 'facility':
      return input.category ? (FACILITY_DATA_SOURCE[input.category] ?? null) : null
    case 'real-estate':
      return REAL_ESTATE_DATA_SOURCE
    case 'subscription':
      return SUBSCRIPTION_DATA_SOURCE
    case 'public-rental':
      return PUBLIC_RENTAL_DATA_SOURCE
    default:
      return null
  }
}
```

> `FacilityCategory`는 파일 상단 `import type { FacilityCategory } from '~/types/facility'`로 이미 임포트되어 있음.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run utils/dataSource.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add utils/dataSource.ts utils/dataSource.test.ts
git commit -m "feat(frontend): add resolveDataSource resolver for data source attribution"
```

---

## Task 2: `DataSourceSection` 컴포넌트 + 컴포넌트 테스트

**Files:**
- Create: `frontend/components/common/DataSourceSection.vue`
- Test: `frontend/tests/components/common/DataSourceSection.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

Create `frontend/tests/components/common/DataSourceSection.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const NuxtLinkStub = { props: ['to'], template: '<a :href="to"><slot /></a>' }

function mountSection(props: Record<string, unknown>) {
  return mount(DataSourceSection, {
    props,
    global: { stubs: { NuxtLink: NuxtLinkStub } },
  })
}

describe('DataSourceSection', () => {
  it('헤더 라벨이 "데이터 출처"이다', () => {
    const wrapper = mountSection({ domain: 'facility', category: 'hospital' })
    expect(wrapper.text()).toContain('데이터 출처')
    expect(wrapper.text()).not.toContain('데이터 정보')
  })

  it('동기화일 없이도 제공기관·데이터셋을 항상 렌더한다', () => {
    const wrapper = mountSection({ domain: 'facility', category: 'hospital' })
    expect(wrapper.text()).toContain('건강보험심사평가원')
    expect(wrapper.text()).toContain('건강보험심사평가원 병원 정보')
  })

  it('lastSyncDate가 전달되면 "최근 동기화" 행을 표시한다', () => {
    const wrapper = mountSection({ domain: 'real-estate', lastSyncDate: '2026-05-28' })
    expect(wrapper.text()).toContain('최근 동기화')
    expect(wrapper.text()).toContain('2026-05-28')
  })

  it('데이터 기준일(dataDate) 행은 더 이상 렌더하지 않는다', () => {
    const wrapper = mountSection({ domain: 'facility', category: 'hospital', lastSyncDate: '2026-05-28' })
    expect(wrapper.text()).not.toContain('데이터 기준일')
  })

  it('알 수 없는 도메인/카테고리면 아무것도 렌더하지 않는다', () => {
    const wrapper = mountSection({ domain: 'facility' })
    expect(wrapper.text()).toBe('')
  })

  it('compact 모드는 한 줄 안내와 /about 링크를 렌더한다', () => {
    const wrapper = mountSection({ domain: 'facility', compact: true })
    expect(wrapper.text()).toContain('데이터 출처')
    expect(wrapper.text()).toContain('공공데이터포털')
    expect(wrapper.get('a').attributes('href')).toBe('/about')
  })

  it('kogl 유형이 있으면 "공공누리 제N유형" 문구를 포함한다 (real-estate는 미기입이라 미표시)', () => {
    const wrapper = mountSection({ domain: 'real-estate' })
    expect(wrapper.text()).not.toContain('공공누리 제')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/components/common/DataSourceSection.test.ts`
Expected: FAIL — 컴포넌트 파일 없음

- [ ] **Step 3: 컴포넌트 구현**

Create `frontend/components/common/DataSourceSection.vue`:

```vue
<template>
  <!-- compact: 다중 카테고리 허브용 한 줄 안내 -->
  <div
    v-if="compact"
    class="bg-white rounded-xl shadow-sm border border-slate-200 px-[18px] py-3.5 flex items-center gap-2.5 text-sm text-slate-500"
  >
    <span class="material-symbols-outlined text-slate-500 text-[18px] shrink-0">description</span>
    <span>
      <span class="text-slate-700 font-semibold">데이터 출처:</span>
      공공데이터포털 (행정안전부·보건복지부 등)
    </span>
    <NuxtLink to="/about" class="text-primary hover:underline font-medium ml-auto whitespace-nowrap">
      자세히 보기 →
    </NuxtLink>
  </div>

  <!-- full card -->
  <div v-else-if="source" class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
    <div class="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
      <span class="material-symbols-outlined text-slate-500 text-[20px]">description</span>
      <h2 class="text-slate-800 text-display-2">데이터 출처</h2>
    </div>
    <div class="p-5 flex flex-col gap-3">
      <div v-if="lastSyncDate" class="flex items-center justify-between">
        <span class="text-sm text-slate-500">최근 동기화</span>
        <span class="text-sm font-medium text-slate-800">{{ lastSyncDate }}</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-slate-500">제공기관</span>
        <span class="text-sm font-medium text-slate-800">{{ source.provider }}</span>
      </div>
      <div class="flex items-center justify-between gap-3">
        <span class="text-sm text-slate-500 shrink-0">데이터셋</span>
        <a
          :href="source.url"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm font-medium text-primary hover:underline text-right break-keep"
        >
          {{ source.datasetName }}
        </a>
      </div>
      <div class="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
        <span class="material-symbols-outlined text-[14px] mt-px">info</span>
        <span>
          {{ source.datasetName }} 기준 정보입니다<span v-if="source.kogl"> · 공공누리 제{{ source.kogl }}유형</span>
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { resolveDataSource, type DataSourceDomain } from '~/utils/dataSource'
import type { FacilityCategory } from '~/types/facility'

const props = defineProps<{
  domain: DataSourceDomain
  category?: FacilityCategory
  lastSyncDate?: string | null
  compact?: boolean
}>()

const source = computed(() => resolveDataSource({ domain: props.domain, category: props.category }))
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/components/common/DataSourceSection.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add components/common/DataSourceSection.vue tests/components/common/DataSourceSection.test.ts
git commit -m "feat(frontend): add DataSourceSection component (always-on attribution + compact mode)"
```

---

## Task 3: 시설 상세 체인 마이그레이션 (DetailContextLinks + [id].vue)

**Files:**
- Modify: `frontend/components/facility/detail/DetailContextLinks.vue:82-95,116-118`
- Modify: `frontend/pages/[category]/[id].vue:200-201,710-715`

- [ ] **Step 1: `DetailContextLinks.vue` 템플릿 교체**

`frontend/components/facility/detail/DetailContextLinks.vue:81-87`의 `<!-- Data Info -->` 블록을 다음으로 교체:

```vue
    <!-- Data Info -->
    <DataSourceSection domain="facility" :category="category" :last-sync-date="lastSyncDate" />
```

- [ ] **Step 2: `DetailContextLinks.vue` script 교체**

`:93` import 교체:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```
(기존 `import DataSourceCard from '~/components/common/DataSourceCard.vue'` 삭제)

`:95` `import type { DataSourceInfo } from '~/utils/dataSource'` **삭제**.

`defineProps`(`:109-119`)에서 `dataSource`, `dataDate` 제거 — 최종 형태:
```ts
defineProps<{
  category: FacilityCategory
  regionLink: RegionLink | null
  relatedCategories: FacilityCategory[]
  categoryMeta: { label: string; icon?: string }
  categoryTips: string[]
  categoryFaqItems: FaqItem[]
  lastSyncDate: string | null
}>()
```

- [ ] **Step 3: `[category]/[id].vue` 부모 prop 정리**

`pages/[category]/[id].vue:193-202`의 `<DetailContextLinks>`에서 `:data-source="dataSource"`(`:200`)와 `:data-date="dataDate"`(`:201`) 두 줄을 **삭제**. `:category`, `:last-sync-date` 등 나머지는 유지.

`:710-715`의 `dataDate` computed 블록 **삭제**:
```ts
// 삭제 대상
const dataDate = computed(() => {
  if (!facility.value?.details) return null
  const raw = (facility.value.details as { dataDate?: string | null }).dataDate
  if (!raw) return null
  return formatDataDate(raw)
})
```

- [ ] **Step 4: 미사용 심볼 정리**

Run: `grep -n "formatDataDate\|dataSource\b" pages/\[category\]/\[id\].vue`
- `formatDataDate`가 다른 곳에서 안 쓰이면 해당 함수 정의(`:690-707` 부근)도 삭제.
- `dataSource` computed(`:717-720`)가 `useStructuredData`/schema 등 다른 곳에서 쓰이면 **유지**, 안 쓰이면 삭제. (lint가 미사용을 잡아줌)

- [ ] **Step 5: 시설 상세 테스트 + lint**

Run: `npx vitest run tests/components/facility && npm run lint`
Expected: PASS, lint 에러 없음(미사용 import/변수 0)

- [ ] **Step 6: 커밋**

```bash
git add components/facility/detail/DetailContextLinks.vue pages/\[category\]/\[id\].vue
git commit -m "refactor(frontend): migrate facility detail to DataSourceSection, drop dataDate"
```

---

## Task 4: 시설 목록/단독 페이지 마이그레이션 (category list · trash · subway)

**Files:**
- Modify: `frontend/pages/[category]/index.vue:280,296,312`
- Modify: `frontend/pages/trash/[id].vue:179-182,194,198`
- Modify: `frontend/pages/subway/index.vue:177,199,340`
- Modify: `frontend/pages/subway/[slug].vue:211,325,403`

- [ ] **Step 1: `[category]/index.vue` 교체**

템플릿 `:280` `<DataSourceCard :source="categoryDataSource" />` →
```vue
<DataSourceSection domain="facility" :category="categoryParam" />
```
(상위에 `v-if="categoryDataSource"` 래퍼가 있으면 `v-if` 제거 — 컴포넌트가 내부에서 null 가드함)

import `:296` `import { FACILITY_DATA_SOURCE } from '~/utils/dataSource'` 줄에 `DataSourceSection` import 추가:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```
`categoryDataSource` computed(`:312`)과 `FACILITY_DATA_SOURCE` import이 다른 곳에서 안 쓰이면 삭제(lint 확인).

- [ ] **Step 2: `trash/[id].vue` 교체**

템플릿 `:179-182` →
```vue
      <!-- 데이터 출처 -->
      <DataSourceSection domain="facility" category="trash" />
```
import `:194` `DataSourceCard` → `DataSourceSection`:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```
`:198` `import { FACILITY_DATA_SOURCE } from '~/utils/dataSource'`가 다른 곳에서 안 쓰이면 삭제(lint 확인).

- [ ] **Step 3: `subway/index.vue` 교체**

템플릿 `:177` `<DataSourceCard :source="categoryDataSource" />` →
```vue
<DataSourceSection domain="facility" category="subway" />
```
import `:199` → `DataSourceSection`. `categoryDataSource` computed(`:340`)·`FACILITY_DATA_SOURCE` import 미사용이면 삭제(lint).

- [ ] **Step 4: `subway/[slug].vue` 교체**

템플릿 `:211` `<DataSourceCard :source="categoryDataSource" />` →
```vue
<DataSourceSection domain="facility" category="subway" />
```
import `:325` → `DataSourceSection`. `categoryDataSource`(`:403`)·`FACILITY_DATA_SOURCE` 미사용이면 삭제(lint).

- [ ] **Step 5: 테스트 + lint**

Run: `npx vitest run tests/pages/subway tests/pages/category 2>/dev/null; npm run lint`
Expected: lint PASS(미사용 0). (대응 테스트가 없으면 vitest는 해당 경로만 스킵 — lint 통과가 핵심 게이트)

- [ ] **Step 6: 커밋**

```bash
git add pages/\[category\]/index.vue pages/trash/\[id\].vue pages/subway/index.vue pages/subway/\[slug\].vue
git commit -m "refactor(frontend): migrate facility list/trash/subway to DataSourceSection"
```

---

## Task 5: 부동산 페이지 마이그레이션 (5곳, v-if 제거) + 테스트 스텁 rename

**Files:**
- Modify: `frontend/pages/real-estate/index.vue:59,68`
- Modify: `frontend/pages/real-estate/[realEstateType]/index.vue:160,177`
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/index.vue:30,42`
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue:105,125`
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:393-397,460`
- Modify: `frontend/tests/pages/real-estate/realEstateHub.test.ts:44`
- Modify: `frontend/tests/pages/real-estate/realEstatePropertyType.test.ts:111`
- Modify: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts:122`

- [ ] **Step 1: 단순 4곳 교체 (목록/허브)**

아래 4개 파일에서 `<DataSourceCard :source="REAL_ESTATE_DATA_SOURCE" />` → `<DataSourceSection domain="real-estate" />`, import 줄의 `DataSourceCard`를 `DataSourceSection`으로 교체하고 `REAL_ESTATE_DATA_SOURCE` import이 미사용이면 삭제(다수 페이지가 schema용으로 `sources: [REAL_ESTATE_DATA_SOURCE]`에서 계속 사용하므로 보통 유지):

- `real-estate/index.vue:59` (import `:68`)
- `real-estate/[realEstateType]/index.vue:160` (import `:177`)
- `real-estate/[realEstateType]/[city]/index.vue:30` (import `:42`)
- `real-estate/[realEstateType]/[city]/[district]/index.vue:105` (import `:125`)

각 파일 import 교체 형태:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 2: `[buildingName].vue` — v-if 제거 (핵심 버그 수정)**

`:393-397` 블록을 다음으로 교체 (**`v-if="lastSyncDate"` 제거**):
```vue
      <!-- 데이터 출처 -->
      <DataSourceSection domain="real-estate" :last-sync-date="lastSyncDate" />
```
import `:460` `DataSourceCard` → `DataSourceSection`. `REAL_ESTATE_DATA_SOURCE`가 schema에서 쓰이면 유지, 아니면 삭제(lint).

- [ ] **Step 3: 부동산 페이지 테스트 스텁 rename**

3개 테스트 파일의 컴포넌트 스텁 키 `DataSourceCard` → `DataSourceSection`:
- `tests/pages/real-estate/realEstateHub.test.ts:44` `DataSourceCard: { template: '<div />' },` → `DataSourceSection: { template: '<div />' },`
- `tests/pages/real-estate/realEstatePropertyType.test.ts:111` 동일 교체
- `tests/pages/real-estate/realEstateBuildingDetail.test.ts:122` 동일 교체

- [ ] **Step 4: 부동산 테스트 + lint**

Run: `npx vitest run tests/pages/real-estate && npm run lint`
Expected: PASS, lint 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add pages/real-estate tests/pages/real-estate
git commit -m "refactor(frontend): migrate real-estate to DataSourceSection, always render source (fix v-if hide)"
```

---

## Task 6: 청약·공공임대 마이그레이션 + sale/rent 하위 추가

**Files:**
- Modify: `frontend/pages/subscription/index.vue:144,168`
- Modify: `frontend/pages/subscription/[id].vue:407,444`
- Modify: `frontend/pages/public-rental/index.vue:15,26`
- Modify: `frontend/components/subscription/PublicRentalDetailView.vue:57,77`
- Modify: `frontend/pages/subscription/sale/[type].vue:33` (신규 추가)
- Modify: `frontend/pages/subscription/rent/[type].vue:38` (신규 추가)

- [ ] **Step 1: 기존 4곳 교체**

- `subscription/index.vue:144` `<DataSourceCard :source="SUBSCRIPTION_DATA_SOURCE" />` → `<DataSourceSection domain="subscription" />`; import `:168` → `DataSourceSection`, `SUBSCRIPTION_DATA_SOURCE` 미사용이면 삭제.
- `subscription/[id].vue:407` 동일 교체; import `:444` → `DataSourceSection`, `SUBSCRIPTION_DATA_SOURCE` 미사용이면 삭제.
- `public-rental/index.vue:15` `<DataSourceCard :source="PUBLIC_RENTAL_DATA_SOURCE" />` → `<DataSourceSection domain="public-rental" />`; import `:26` → `DataSourceSection`, `PUBLIC_RENTAL_DATA_SOURCE` 미사용이면 삭제.
- `PublicRentalDetailView.vue:57` `<DataSourceCard :source="PUBLIC_RENTAL_DATA_SOURCE" :last-sync-date="lastSyncDate" />` → `<DataSourceSection domain="public-rental" :last-sync-date="lastSyncDate" />`; import `:77` → `DataSourceSection`, `PUBLIC_RENTAL_DATA_SOURCE` 미사용이면 삭제.

- [ ] **Step 2: `subscription/sale/[type].vue` 신규 추가**

`:33` `</main>` 바로 앞 줄에 추가:
```vue
      <!-- 데이터 출처 -->
      <DataSourceSection domain="subscription" />
```
`<script setup>` 블록(`:37` 이후)에 import 추가:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 3: `subscription/rent/[type].vue` 신규 추가**

`:38` `</main>` 바로 앞 줄에 추가:
```vue
      <!-- 데이터 출처 -->
      <DataSourceSection domain="subscription" />
```
`<script setup>` 블록(`:42` 이후)에 import 추가:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 4: 테스트 + lint**

Run: `npx vitest run tests/pages/subscription tests/components/subscription 2>/dev/null; npm run lint`
Expected: lint PASS

- [ ] **Step 5: 커밋**

```bash
git add pages/subscription pages/public-rental components/subscription/PublicRentalDetailView.vue
git commit -m "refactor(frontend): migrate subscription/public-rental to DataSourceSection, add source to sale/rent"
```

---

## Task 7: 지역 페이지군 출처 추가 (full card + compact 허브)

**Files:**
- Modify: `frontend/pages/[city]/[district]/[category].vue:78,82` (full card 추가)
- Modify: `frontend/pages/[city]/index.vue:64,75` (compact 추가)
- Modify: `frontend/pages/[city]/[district]/index.vue:47,58` (compact 추가)

- [ ] **Step 1: `[district]/[category].vue` — 단일 카테고리 full card 추가**

`:72-78`의 `<RegionRelatedCategories ... />` 다음, `:79`의 `</div>` 바로 앞에 추가:
```vue

    <!-- 데이터 출처 -->
    <DataSourceSection domain="facility" :category="(category as FacilityCategory)" />
```
> `category`는 `computed(() => route.params.category as string)` (`:106`). 런타임에 잘못된 값이면 컴포넌트가 null 가드로 미렌더되므로 안전.

`<script setup>`(`:82` 이후) import 추가:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import type { FacilityCategory } from '~/types/facility'
```
> `FacilityCategory`가 이미 임포트되어 있으면 중복 추가하지 말 것(`grep -n "FacilityCategory" pages/\[city\]/\[district\]/\[category\].vue`로 확인).

- [ ] **Step 2: `[city]/index.vue` — compact 허브 노트 추가**

`:64`의 `<RegionRealEstateCta :area-name="cityName" />` 다음, `:65`의 `</div>` 바로 앞에 추가:
```vue

        <!-- 데이터 출처 -->
        <DataSourceSection domain="facility" compact class="mt-2" />
```
`<script setup>`(`:75` 이후) import 추가:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 3: `[city]/[district]/index.vue` — compact 허브 노트 추가**

`:47`의 `<RegionRealEstateCta :area-name="districtName" />` 다음, `:48`의 `</div>` 바로 앞에 추가:
```vue

        <!-- 데이터 출처 -->
        <DataSourceSection domain="facility" compact class="mt-2" />
```
`<script setup>`(`:58` 이후) import 추가:
```ts
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 4: 테스트 + lint**

Run: `npx vitest run tests/pages 2>/dev/null; npm run lint`
Expected: lint PASS

- [ ] **Step 5: 커밋**

```bash
git add pages/\[city\]
git commit -m "feat(frontend): add data source attribution to region pages (full card + compact hub)"
```

---

## Task 8: 구 DataSourceCard 삭제 + 전체 검증

**Files:**
- Delete: `frontend/components/common/DataSourceCard.vue`
- Delete: `frontend/tests/components/common/DataSourceCard.test.ts`

- [ ] **Step 1: 잔존 참조 0 확인**

Run: `grep -rn "DataSourceCard" --include="*.vue" --include="*.ts" pages components composables tests`
Expected: **출력 없음** (0건). 남아 있으면 해당 파일을 `DataSourceSection`으로 마저 교체.

- [ ] **Step 2: 파일 삭제**

```bash
git rm components/common/DataSourceCard.vue tests/components/common/DataSourceCard.test.ts
```

- [ ] **Step 3: 전체 테스트**

Run: `npm run test`
Expected: 전체 PASS (신규 `resolveDataSource` 6 + `DataSourceSection` 7 포함, 기존 테스트 회귀 없음)

- [ ] **Step 4: lint + 타입체크(빌드)**

Run: `npm run lint && npm run build`
Expected: lint 에러 0, 빌드 성공(타입 에러 0 — 특히 `[district]/[category].vue`의 `category as FacilityCategory` 캐스트, DetailContextLinks prop 변경 반영 확인)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "refactor(frontend): remove legacy DataSourceCard after migration to DataSourceSection"
```

---

## Self-Review 결과 (스펙 대조)

- **§4-1 resolver + 컴포넌트 통합** → Task 1, 2 ✓
- **§4-2 항상 노출 / dataDate 제거 / 라벨 통일 / 동기화 상세만** → Task 2(컴포넌트) + Task 3(상세 동기화) ✓
- **§4-3 compact 허브** → Task 2(구현) + Task 7(허브 적용) ✓
- **§4-4 마이그레이션 맵 19곳** → Task 3(2) · 4(4) · 5(5) · 6(6) · 7(3 신규) = 14 기존 + 5 신규 ✓
- **§4-5 삭제/정리(DataSourceCard, dataDate computed)** → Task 3 · 8 ✓
- **§5 테스트(resolver 유닛 / 컴포넌트 / 기존 갱신)** → Task 1 · 2 · 5(스텁) · 8(전체) ✓
- **§6 후속 TODO(KOGL·about.vue·검색/가이드)** → 범위 밖, 미포함(의도) ✓

**타입 일관성:** `DataSourceDomain`(Task1) = 컴포넌트 prop(Task2) = 마이그레이션 바인딩(Task3-7) 일치. `resolveDataSource({domain, category})` 시그니처 전 태스크 동일. DetailContextLinks prop에서 `dataSource`/`dataDate` 제거(Task3)와 부모 [id].vue 정리(Task3) 동기화 확인.

**미사용 심볼 정책:** 각 마이그레이션 태스크는 `npm run lint`로 미사용 import/computed를 게이트. 레지스트리 상수(`REAL_ESTATE_DATA_SOURCE` 등)는 schema 빌더에서 계속 쓰이는 경우가 많아 "미사용이면 삭제" 조건부로 처리.
