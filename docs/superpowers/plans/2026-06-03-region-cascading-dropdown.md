# 지역 필터 통일 (RegionCascadingDropdown) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 청약·공공임대 목록의 자유텍스트 "지역 (상세)"를 공유 `RegionCascadingDropdown`(시/도→구/군 cascading)으로 교체해 오타·매칭 실패를 제거한다.

**Architecture:** `useRegions`를 감싸 시/도(`citiesWithDistricts`)→구/군(`getDistrictsByCity`) cascading을 캡슐화한 leaf 컴포넌트를 신설. city 값 형식이 소비처마다 달라(청약=축약명, 공공임대=slug) `cityValueMode` prop으로 분기. 백엔드 계약(청약 `region` 문자열 contains / 공공임대 `city`+`district` 분리)은 불변.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-03-region-cascading-dropdown-design.md`

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). `frontend/`. 브랜치 `feat/region-cascading-dropdown`. 커밋 **명시 경로만**(절대 `git add -A` 금지).

## 확인된 사실

- `useRegions()` 반환: `loadRegions()`, `citiesWithDistricts`(ref of `{ slug, name(축약명), districts: { name }[] }[]`), `getDistrictsByCity(citySlug)`(`{ name }[]`).
- `CITY_SLUG_MAP[slug]`=축약명("서울"), `citiesWithDistricts[].name`=축약명.
- **청약** `SubscriptionListView.vue`: `selectedRegion`(축약명) + `regionDetail`(자유텍스트). `region = [selectedRegion, regionDetail].filter(Boolean).join(' ') || undefined`(`loadSubscriptions` 내). `watch([currentStatus, selectedRegion, regionDetail], …)`. 백엔드 `where.regionName = { contains: region }`, regionName="서울 강남구".
- **공공임대** `PublicRentalListView.vue`: `currentCity`(**slug**, `CITY_OPTIONS`의 `opt.slug`) + `districtDetail`(자유텍스트, 300ms 디바운스). `getList({ city: currentCity || undefined, district: districtDetail.trim() || undefined })`. `watch([currentCity, () => props.rentalTypeCode], …)` + 별도 `watch(districtDetail, debounce)`.
- `tests/setup.ts`에 useRegions mock 없음 → 컴포넌트 테스트가 `vi.mock('~/composables/useRegions', …)`로 직접 mock.
- 두 목록 모두 구/군은 "강남구" 형태 문자열을 기대(청약 contains, 공공임대 district 필터) — `getDistrictsByCity().name`("강남구")와 일치.

---

## Task 1: RegionCascadingDropdown 컴포넌트 + 단위 테스트

**Files:**
- Create: `frontend/components/common/RegionCascadingDropdown.vue`
- Test: `frontend/tests/components/common/RegionCascadingDropdown.test.ts`

- [ ] **Step 1: 실패 테스트 작성** — `frontend/tests/components/common/RegionCascadingDropdown.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const mocks = vi.hoisted(() => ({
  cities: [
    { slug: 'seoul', name: '서울', districts: [{ name: '강남구' }, { name: '서초구' }] },
    { slug: 'busan', name: '부산', districts: [{ name: '해운대구' }] },
  ],
}))

vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    loadRegions: vi.fn().mockResolvedValue([]),
    citiesWithDistricts: { value: mocks.cities },
    getDistrictsByCity: (slug: string) =>
      mocks.cities.find((c) => c.slug === slug)?.districts ?? [],
  }),
}))

import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'

function mountIt(props: Record<string, unknown> = {}) {
  return mount(RegionCascadingDropdown, { props: { city: '', district: '', ...props } })
}

describe('RegionCascadingDropdown', () => {
  it('시/도 옵션을 렌더한다', () => {
    const text = mountIt().text()
    expect(text).toContain('서울')
    expect(text).toContain('부산')
  })

  it('시/도 미선택 시 구/군 select는 disabled', () => {
    const districtSelect = mountIt({ city: '' }).findAll('select')[1]
    expect(districtSelect.attributes('disabled')).toBeDefined()
  })

  it('시/도(축약명) 선택 시 해당 구/군만 렌더', () => {
    const text = mountIt({ city: '서울' }).text()
    expect(text).toContain('강남구')
    expect(text).toContain('서초구')
    expect(text).not.toContain('해운대구')
  })

  it('시/도 변경 시 update:city emit + 구/군 리셋(update:district "")', async () => {
    const w = mountIt({ city: '', district: '' })
    await w.findAll('select')[0].setValue('서울')
    expect(w.emitted('update:city')?.[0]).toEqual(['서울'])
    expect(w.emitted('update:district')?.[0]).toEqual([''])
  })

  it('구/군 선택 시 update:district emit', async () => {
    const w = mountIt({ city: '서울', district: '' })
    await w.findAll('select')[1].setValue('강남구')
    expect(w.emitted('update:district')?.[0]).toEqual(['강남구'])
  })

  it('slug 모드: 시/도 값이 slug여도 구/군이 채워진다', () => {
    const text = mountIt({ city: 'seoul', cityValueMode: 'slug' }).text()
    expect(text).toContain('강남구')
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/common/RegionCascadingDropdown.test.ts`
Expected: FAIL(컴포넌트 없음).

- [ ] **Step 3: 컴포넌트 구현** — `frontend/components/common/RegionCascadingDropdown.vue`
```vue
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1.5">지역</label>
      <div class="relative">
        <select
          :value="city"
          aria-label="시/도 선택"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
          @change="onCityChange"
        >
          <option value="">전국</option>
          <option v-for="c in cityOptions" :key="c.slug" :value="c.value">{{ c.name }}</option>
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
      </div>
    </div>
    <div>
      <label class="block text-xs font-medium text-slate-600 mb-1.5">구/군</label>
      <div class="relative">
        <select
          :value="district"
          :disabled="!city"
          aria-label="구/군 선택"
          class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          @change="onDistrictChange"
        >
          <option value="">전체</option>
          <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
        </select>
        <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRegions } from '~/composables/useRegions'

const props = withDefaults(
  defineProps<{ city: string; district: string; cityValueMode?: 'short' | 'slug' }>(),
  { cityValueMode: 'short' },
)
const emit = defineEmits<{ 'update:city': [string]; 'update:district': [string] }>()

const { loadRegions, citiesWithDistricts, getDistrictsByCity } = useRegions()

onMounted(() => {
  void loadRegions()
})

const cityOptions = computed(() =>
  citiesWithDistricts.value.map((c) => ({
    slug: c.slug,
    name: c.name,
    value: props.cityValueMode === 'slug' ? c.slug : c.name,
  })),
)

const selectedSlug = computed(() => {
  if (!props.city) return ''
  const found = citiesWithDistricts.value.find(
    (c) => (props.cityValueMode === 'slug' ? c.slug : c.name) === props.city,
  )
  return found?.slug ?? ''
})

const districtOptions = computed(() =>
  selectedSlug.value ? getDistrictsByCity(selectedSlug.value).map((d) => d.name) : [],
)

function onCityChange(e: Event) {
  emit('update:city', (e.target as HTMLSelectElement).value)
  emit('update:district', '')
}
function onDistrictChange(e: Event) {
  emit('update:district', (e.target as HTMLSelectElement).value)
}
</script>
```
(주: 테스트 mock의 `citiesWithDistricts`는 `{ value: [...] }` 형태로 `.value` 접근을 만족. 실제 useRegions는 ref라 동일하게 동작. mock 메커니즘이 프로젝트 Vitest 설정과 충돌하면 setup.ts 패턴에 맞춰 조정하되 단언 핵심은 유지.)

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/common/RegionCascadingDropdown.test.ts`
Expected: 전체 PASS.

- [ ] **Step 5: lint + 커밋**
Run: `cd frontend && npx eslint components/common/RegionCascadingDropdown.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/common/RegionCascadingDropdown.vue frontend/tests/components/common/RegionCascadingDropdown.test.ts
git commit -m "feat(frontend): RegionCascadingDropdown 공유 컴포넌트 + 테스트"
```

---

## Task 2: 청약·공공임대 목록에 적용

**Files:**
- Modify: `frontend/components/subscription/SubscriptionListView.vue`
- Modify: `frontend/components/subscription/PublicRentalListView.vue`
- Test: 위 두 컴포넌트의 기존 테스트(있으면 갱신)

### 2A. SubscriptionListView

- [ ] **Step 1: 템플릿 교체** — 지역 필터 그리드 블록(현 시/도 `<select>` + "지역 (상세)" `<input>`을 감싼 `<div class="grid grid-cols-1 md:grid-cols-2 gap-3">…</div>`)을 아래로 교체:
```vue
      <RegionCascadingDropdown
        v-model:city="selectedRegion"
        v-model:district="selectedDistrict"
      />
```
(바깥 `<SectionBlock heading="상태와 지역" …>`와 상태 칩 등 나머지는 그대로.)

- [ ] **Step 2: script 수정**
  - import 추가: `import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'`
  - `const regionDetail = ref('')` → `const selectedDistrict = ref('')`
  - `watch([currentStatus, selectedRegion, regionDetail], …)` → `watch([currentStatus, selectedRegion, selectedDistrict], …)`
  - region 조립 `const region = [selectedRegion.value, regionDetail.value].filter(Boolean).join(' ') || undefined` → `const region = [selectedRegion.value, selectedDistrict.value].filter(Boolean).join(' ') || undefined`
  - `regionDetail`을 참조하는 다른 곳(필터 초기화 등)이 있으면 `selectedDistrict`로 치환. `grep -n "regionDetail" components/subscription/SubscriptionListView.vue`로 0건 확인.

### 2B. PublicRentalListView

- [ ] **Step 3: 템플릿 교체** — 지역 필터 그리드 블록(`currentCity` select + `districtDetail` input을 감싼 `<div class="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3">…</div>`)을 교체. **공공임대는 city가 slug라 `city-value-mode="slug"`**:
```vue
      <RegionCascadingDropdown
        v-model:city="currentCity"
        v-model:district="selectedDistrict"
        city-value-mode="slug"
        class="mb-3"
      />
```

- [ ] **Step 4: script 수정**
  - import 추가: `import RegionCascadingDropdown from '~/components/common/RegionCascadingDropdown.vue'`
  - `const districtDetail = ref<string>('')` → `const selectedDistrict = ref<string>('')`
  - `getList({ … district: districtDetail.value.trim() || undefined })` → `district: selectedDistrict.value || undefined`
  - 디바운스 제거: `watch(districtDetail, …)` 블록(`detailTimer`/`setTimeout` 포함) 삭제. 대신 `selectedDistrict`를 즉시 재조회 watch에 추가 → 기존 `watch([currentCity, () => props.rentalTypeCode], …)`를 `watch([currentCity, selectedDistrict, () => props.rentalTypeCode], …)`로 변경.
  - `CITY_OPTIONS` import가 더 이상 안 쓰이면 제거(`grep -n "CITY_OPTIONS" …`로 확인 후 미사용 시 import 제거).
  - `grep -n "districtDetail\|detailTimer" components/subscription/PublicRentalListView.vue`로 잔존 0건 확인.

- [ ] **Step 5: 관련 테스트 실행/갱신**
Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalListView.test.ts`
기존 테스트가 자유텍스트 input(placeholder "예: 강남구") 또는 `districtDetail`를 단언하면 갱신(드롭다운 select 기준). region/필터 파라미터 형식은 동일 유지. SubscriptionListView 관련 테스트가 있으면 함께 실행.

- [ ] **Step 6: lint + 커밋**
Run: `cd frontend && npx eslint components/subscription/SubscriptionListView.vue components/subscription/PublicRentalListView.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/subscription/SubscriptionListView.vue frontend/components/subscription/PublicRentalListView.vue
# 갱신된 테스트가 있으면 해당 경로도 add
git commit -m "refactor(frontend): 청약·공공임대 목록 지역 자유텍스트 → cascading 드롭다운"
```

---

## Task 3: 전체 검증 + PR

- [ ] **Step 1: 전체 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test 2>&1 | tail -12`
Expected: 전체 PASS. 예상 외 실패는 변경 문자열/구조 단언 여부 확인 후 갱신.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -6`
Expected: 0 errors.

- [ ] **Step 3: build**
Run: `cd frontend && npm run build 2>&1 | tail -8`
Expected: exit 0. (주의: 사용자 `nuxt dev` 실행 중이면 `.nuxt` 덮어써져 dev 깨질 수 있음 — 사용자에게 알릴 것.)

- [ ] **Step 4: SSR/동작 수동 확인(선택)**
가능하면 dev에서 `/subscription`·`/public-rental` 지역 필터가 시/도→구/군 cascading으로 뜨고, 구/군 선택 시 목록이 필터링되는지 확인.

- [ ] **Step 5: PR**
```bash
git push -u origin feat/region-cascading-dropdown
gh pr create --base develop --title "지역 필터 통일 ⑤: 청약·공공임대 cascading 드롭다운" --body "audit ⑤ 지역 필터 3종 통일. 공유 RegionCascadingDropdown(시/도→구/군) 신설, 청약·공공임대 목록의 자유텍스트 '지역 (상세)' → 드롭다운 교체(오타·매칭 실패 제거). 백엔드 계약 불변(청약 region 문자열 contains / 공공임대 city+district). subway/[category]는 범위 외."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** 컴포넌트=T1. 청약 적용=T2A. 공공임대 적용=T2B(slug 모드·디바운스 제거 반영). 테스트=T1 단위 + T2 회귀. 검증=T3. spec 항목 매핑 완료.
- **Placeholder scan:** 모든 코드 단계 실제 코드. "grep으로 잔존 확인" 지시는 줄 드리프트/미사용 정리용(정당). 테스트 mock 조정 여지 명시(placeholder 아님).
- **Type consistency:** 컴포넌트 props `{ city, district, cityValueMode }` + emits `update:city`/`update:district` — T2 두 소비처 `v-model:city`/`v-model:district`(+ 공공임대 `city-value-mode="slug"`)와 일치. 청약 city=축약명(기본 short), 공공임대 city=slug(slug 모드) — `selectedSlug`가 모드별로 slug 해석. 구/군 값="강남구"(name) → 청약 contains / 공공임대 district 모두 정합.
- **위험:** 공공임대 디바운스 제거(자유텍스트→select는 즉시 선택이라 과호출 없음). `CITY_OPTIONS`/`regionDetail`/`districtDetail` 미사용 잔존 제거로 lint 경고 방지.
- **비범위:** subway/[category] 이전, 백엔드 변경.
