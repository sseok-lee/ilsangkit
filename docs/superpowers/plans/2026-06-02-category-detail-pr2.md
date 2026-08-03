# 카테고리 상세 일관성 PR2 Implementation Plan (output-preserving)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** heroStats switch를 registry로 추출하고, childcare 시설현황을 "항상 표시 + 정보없음"으로 통일하며, FieldGrid·TagBadges 프리미티브를 **output-preserving**(픽셀 불변)으로 추출한다.

**Architecture:** 위험한 시각 리스타일은 하지 않는다. (1) `desktopHeroStats` switch → 카테고리 registry 맵(출력 동일+미등록 dev 경고), (2) childcare FieldGrid를 항상-표시로 전환(빈 값 "정보 없음"), (3) `FieldGrid`/`TagBadges` 프리미티브를 variant 기반으로 추출해 기존 호출부를 동일 출력으로 교체. 카드 모양을 한 개로 "통일"하는 시각 변경은 시각 검증 가능 시 후속 PR.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-category-detail-consistency-design.md` (PR2). 단, 본 PR은 사용자 결정에 따라 **카드 스타일은 output-preserving 추출만**(시각 통일은 후속).

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). 작업 디렉터리 `frontend/`. 브랜치 `feat/category-detail-pr2`(컨트롤러 생성). 커밋 스테이징은 **명시 경로만**(절대 `git add -A` 금지). ⚠️ 로컬 시설 데이터 부재로 시각 curl 검증은 불가 — 단위테스트/빌드/CI로 검증, output-preserving이라 시각 회귀 위험 낮음.

---

## File Structure

- `utils/categoryHeroStats.ts` — (신규) 카테고리별 heroStats registry
- `pages/[category]/[id].vue` — (수정) desktopHeroStats가 registry 사용
- `components/facility/detail/TagBadges.vue` — (신규) 칩 목록 프리미티브(variant)
- `components/facility/detail/FieldGrid.vue` — (신규) 수치 그리드 프리미티브(variant + 항상표시 옵션)
- `components/facility/detail/DetailFacilityStatus.vue` — (수정) 칩/그리드 호출부를 프리미티브로 교체(output-preserving) + childcare 항상표시
- 테스트: 각 task

---

## Task 1: heroStats registry 추출

**Files:**
- Create: `frontend/utils/categoryHeroStats.ts`
- Modify: `frontend/pages/[category]/[id].vue` (`desktopHeroStats` computed `:517-602`)
- Test: `frontend/tests/utils/categoryHeroStats.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/utils/categoryHeroStats.test.ts`
```ts
import { describe, it, expect, vi } from 'vitest'
import { buildHeroStats } from '~/utils/categoryHeroStats'

describe('buildHeroStats', () => {
  it('hospital: 종별/의사/주차 stat을 만든다', () => {
    const items = buildHeroStats('hospital', { clCdNm: '종합병원', drTotCnt: 10, parkQty: 5 }, '')
    expect(items).toContainEqual({ label: '종별', value: '종합병원' })
    expect(items).toContainEqual({ label: '의사', value: '10명' })
    expect(items).toContainEqual({ label: '주차', value: '5대' })
  })
  it('parking: 주차면수/요금/구분', () => {
    const items = buildHeroStats('parking', { capacity: 100, feeType: '유료', lotType: '노상' }, '')
    expect(items).toContainEqual({ label: '주차면수', value: '100면' })
    expect(items).toContainEqual({ label: '요금', value: '유료' })
  })
  it('pharmacy: 전화 fallback', () => {
    const items = buildHeroStats('pharmacy', {}, '02-123-4567')
    expect(items).toContainEqual({ label: '전화', value: '02-123-4567' })
  })
  it('미등록 카테고리: 전화 default + dev 경고', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const items = buildHeroStats('unknown-cat' as any, {}, '031-000-0000')
    expect(items).toContainEqual({ label: '전화', value: '031-000-0000' })
    warn.mockRestore()
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/utils/categoryHeroStats.test.ts` → FAIL(유틸 없음).

- [ ] **Step 3: registry 작성** — `frontend/utils/categoryHeroStats.ts`

먼저 `pages/[category]/[id].vue`의 `desktopHeroStats` computed(`:517-602`) 전체를 읽어 **모든 카테고리 case의 정확한 로직을 그대로 옮긴다**. 반환 단위는 `{ label: string; value: string }`. registry 구조:
```ts
import type { FacilityCategory } from '~/types/facility'

export interface HeroStat { label: string; value: string }
type StatBuilder = (d: any, phone: string) => HeroStat[]

// 각 빌더는 [id].vue desktopHeroStats의 기존 case 로직을 그대로 옮긴 것.
const REGISTRY: Partial<Record<FacilityCategory, StatBuilder>> = {
  hospital: (d) => {
    const items: HeroStat[] = []
    if (d?.clCdNm) items.push({ label: '종별', value: d.clCdNm })
    if (d?.drTotCnt) items.push({ label: '의사', value: `${d.drTotCnt}명` })
    if (d?.parkQty != null) items.push({ label: '주차', value: d.parkQty > 0 ? `${d.parkQty}대` : '불가' })
    return items
  },
  pharmacy: (_d, phone) => (phone ? [{ label: '전화', value: phone }] : []),
  parking: (d) => {
    const items: HeroStat[] = []
    if (d?.capacity) items.push({ label: '주차면수', value: `${d.capacity}면` })
    if (d?.feeType) items.push({ label: '요금', value: d.feeType })
    if (d?.lotType) items.push({ label: '구분', value: d.lotType })
    return items
  },
  library: (d) => {
    const items: HeroStat[] = []
    if (d?.seatCount) items.push({ label: '좌석', value: `${d.seatCount.toLocaleString()}석` })
    if (d?.bookCount) items.push({ label: '장서', value: `${d.bookCount.toLocaleString()}권` })
    return items
  },
  childcare: (d) => {
    const items: HeroStat[] = []
    if (d?.crcapat) items.push({ label: '정원', value: `${d.crcapat}명` })
    if (d?.crchcnt != null) items.push({ label: '현원', value: `${d.crchcnt}명` })
    return items
  },
  market: (d) => {
    const items: HeroStat[] = []
    if (d?.marketType) items.push({ label: '시장유형', value: d.marketType })
    if (d?.storeCount != null) items.push({ label: '점포수', value: `${d.storeCount}개` })
    return items
  },
  school: (d) => {
    const items: HeroStat[] = []
    if (d?.schoolLevel) items.push({ label: '학교급', value: d.schoolLevel })
    if (d?.foundationType) items.push({ label: '설립형태', value: d.foundationType })
    if (d?.coeducationType) items.push({ label: '남녀공학', value: d.coeducationType })
    return items
  },
  // ⬇️ 아래 4개(aed, park, sports, toilet, wifi, ev-charger)는 [id].vue의 기존 case 로직을
  //    그대로 옮겨 채운다(읽고 1:1 전사). 누락 금지 — 기존 switch의 모든 케이스 포함.
}

/**
 * 카테고리 hero stat 산출. 미등록 카테고리는 전화 default + dev 경고.
 */
export function buildHeroStats(category: FacilityCategory, details: any, phone: string): HeroStat[] {
  const builder = REGISTRY[category]
  if (!builder) {
    if (import.meta.dev) {
      // eslint-disable-next-line no-console
      console.warn(`[heroStats] 미등록 카테고리 '${category}' — 전화 default로 폴백. categoryHeroStats.ts에 등록 필요.`)
    }
    return phone ? [{ label: '전화', value: phone }] : []
  }
  return builder(details, phone)
}
```
**중요:** 위 예시에 없는 `aed`/`park`/`sports`/`toilet`/`wifi`/`ev-charger` case는 `[id].vue`의 기존 `desktopHeroStats`(`:537-595`)에서 **로직을 그대로 전사**해 REGISTRY에 추가할 것. 기존 switch의 모든 카테고리가 동일 출력을 내야 한다. toilet은 다단(openTime 24/상시·CCTV·기저귀대 등) 로직이므로 빠짐없이 옮길 것.

- [ ] **Step 4: [id].vue가 registry 사용**
`desktopHeroStats` computed 본문(switch 전체)을 아래로 교체:
```ts
import { buildHeroStats } from '~/utils/categoryHeroStats'
// ...
const desktopHeroStats = computed(() => {
  const cat = facility.value?.category
  if (!cat) return []
  return buildHeroStats(cat, details.value, facilityPhone.value)
})
```
(기존 `desktopHeroStats`가 참조하던 로컬 변수 `facilityPhone`/`details`는 그대로 전달. 반환 형태 `{label,value}[]` 동일.)

- [ ] **Step 5: 통과 확인**
Run: `cd frontend && npx vitest run tests/utils/categoryHeroStats.test.ts` → PASS(4).
Run(회귀): `cd frontend && npx vitest run tests/pages/detail.test.ts` → PASS(heroStats 렌더 회귀 없음).

- [ ] **Step 6: lint + 커밋**
Run: `cd frontend && npx eslint utils/categoryHeroStats.ts pages/\[category\]/\[id\].vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/utils/categoryHeroStats.ts frontend/pages/\[category\]/\[id\].vue frontend/tests/utils/categoryHeroStats.test.ts
git commit -m "refactor(frontend): heroStats를 카테고리 registry로 추출 + 미등록 경고"
```

---

## Task 2: TagBadges 프리미티브 추출 (output-preserving)

**Files:**
- Create: `frontend/components/facility/detail/TagBadges.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue` (hospital/market/school/childcare 칩 호출부)
- Test: `frontend/tests/components/facility/detail/TagBadges.test.ts` (신규)

기존 칩 스타일(보존 대상):
- hospital(`:547-556`): `rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-medium text-teal-700 border border-teal-200`, gap-1.5, suffix `ml-1 text-teal-500`
- market(`:340-342`): `inline-block bg-gray-100 text-gray-700 rounded-full px-2.5 py-0.5 text-xs`, gap-1
- school(`:323-325`): `rounded-full px-3 py-1 text-xs font-medium bg-sky-100 text-sky-800`, gap-2
- childcare(`:450-454`): per-item `colorClass`, gap-2, `px-2.5 py-1 rounded-full text-xs font-medium`, suffix `font-semibold`

- [ ] **Step 1: 실패 테스트** — `frontend/tests/components/facility/detail/TagBadges.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TagBadges from '~/components/facility/detail/TagBadges.vue'

describe('TagBadges', () => {
  it('items를 칩으로 렌더한다', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '내과' }, { label: '외과' }], variant: 'teal' } })
    expect(w.findAll('span.inline-flex, span.inline-block').length).toBeGreaterThanOrEqual(2)
    expect(w.text()).toContain('내과')
    expect(w.text()).toContain('외과')
  })
  it('teal variant는 teal 클래스', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '내과' }], variant: 'teal' } })
    expect(w.html()).toContain('bg-teal-50')
  })
  it('suffix를 렌더한다', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '내과', suffix: '(3명)' }], variant: 'teal' } })
    expect(w.text()).toContain('(3명)')
  })
  it('per-item colorClass를 적용한다(childcare)', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '경력', suffix: '5명', colorClass: 'bg-indigo-100 text-indigo-700' }], variant: 'custom' } })
    expect(w.html()).toContain('bg-indigo-100')
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/TagBadges.test.ts` → FAIL.

- [ ] **Step 3: 컴포넌트** — `frontend/components/facility/detail/TagBadges.vue`
```vue
<template>
  <div class="flex flex-wrap" :class="gapClass">
    <span
      v-for="(item, i) in items"
      :key="`${item.label}-${i}`"
      class="inline-flex items-center rounded-full text-xs"
      :class="[paddingClass, item.colorClass ?? variantClass]"
    >
      {{ item.label }}<span v-if="item.suffix" :class="suffixClass">{{ item.suffix }}</span>
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface TagBadgeItem { label: string; suffix?: string; colorClass?: string }

const props = withDefaults(defineProps<{
  items: TagBadgeItem[]
  variant?: 'teal' | 'gray' | 'sky' | 'custom'
}>(), { variant: 'gray' })

const variantClass = computed(() => ({
  teal: 'bg-teal-50 text-teal-700 border border-teal-200 font-medium',
  gray: 'bg-gray-100 text-gray-700',
  sky: 'bg-sky-100 text-sky-800 font-medium',
  custom: '',
}[props.variant]))

const paddingClass = computed(() => (props.variant === 'sky' ? 'px-3 py-1' : 'px-2.5 py-0.5'))
const gapClass = computed(() => (props.variant === 'gray' ? 'gap-1' : 'gap-1.5'))
const suffixClass = computed(() => (props.variant === 'teal' ? 'ml-1 text-teal-500' : 'ml-1 font-semibold'))
</script>
```
(주: 본 프리미티브는 기존 4개 호출부를 "충분히 동일하게" 재현한다. 픽셀 완전 일치가 목표지만, 미세 차이(예: childcare py-1 vs 0.5)가 생기면 호출부에 맞춰 `paddingClass` 등을 조정하거나 호출부에서 `colorClass`로 패딩까지 넘기지 말고 variant를 늘려 정확히 맞출 것. 출력 회귀를 피하는 게 우선.)

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/TagBadges.test.ts` → PASS.

- [ ] **Step 5: 호출부 교체(output-preserving)**
`DetailFacilityStatus.vue`에서 4개 칩 블록을 `TagBadges`로 교체. 데이터를 `{label, suffix?, colorClass?}[]`로 매핑하는 computed를 script에 추가(또는 인라인 map). 예:
- hospital departments → `<TagBadges variant="teal" :items="hospitalDeptBadges" />` where `hospitalDeptBadges = details.departments.map(d => ({ label: d.dgsbjtCdNm, suffix: d.dgsbjtPrSdrCnt ? \`(${d.dgsbjtPrSdrCnt}명)\` : undefined }))`
- market product → `<TagBadges variant="gray" :items="marketProductTags.map(t => ({ label: t }))" />`
- school departments → `<TagBadges variant="sky" :items="schoolDepartments.map(d => ({ label: d }))" />`
- childcare career → `<TagBadges variant="custom" :items="childcareCareerItems.map(it => ({ label: it.label, suffix: \`${it.cnt}명\`, colorClass: it.colorClass }))" />`

각 교체 후 렌더 출력이 기존과 동일한지(클래스/텍스트) 육안 비교. 미세 불일치는 프리미티브/매핑으로 정확히 맞춤.

- [ ] **Step 6: 회귀 + lint + 커밋**
Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailFacilityStatus.test.ts` → PASS 유지(칩 내용 가시성 계약).
Run: `cd frontend && npx eslint components/facility/detail/TagBadges.vue components/facility/detail/DetailFacilityStatus.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/facility/detail/TagBadges.vue frontend/components/facility/detail/DetailFacilityStatus.vue frontend/tests/components/facility/detail/TagBadges.test.ts
git commit -m "refactor(frontend): TagBadges 프리미티브 추출 + 칩 호출부 교체(output-preserving)"
```

---

## Task 3: FieldGrid 프리미티브 + childcare 정보없음 통일

**Files:**
- Create: `frontend/components/facility/detail/FieldGrid.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue` (childcare/school 수치 그리드)
- Test: `frontend/tests/components/facility/detail/FieldGrid.test.ts` (신규) + `DetailFacilityStatus.test.ts`(childcare 항상표시)

기존 그리드 스타일(보존):
- childcare(`:368-396`): `grid grid-cols-2 gap-3`, 셀 `bg-slate-50 rounded-lg p-3 text-center`, `<p class="text-xs text-gray-600 mb-1">label</p><p class="text-lg font-bold text-slate-900">value<span text-xs>unit</span></p>`. **현재 7필드 모두 `v-if`로 숨김 → 항상표시로 전환 대상.**
- school(`:314-319`): `grid grid-cols-3 sm:grid-cols-4 gap-2`, 셀 `flex flex-col items-center justify-center rounded-lg py-2.5 px-2`. (school은 현재도 존재 행만 렌더 — 항상표시 전환 대상 아님, output-preserving 교체만.)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/components/facility/detail/FieldGrid.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FieldGrid from '~/components/facility/detail/FieldGrid.vue'

describe('FieldGrid', () => {
  it('값 있는 셀을 렌더한다', () => {
    const w = mount(FieldGrid, { props: { variant: 'prominent', cols: 2, items: [{ label: '정원', value: 50, unit: '명' }] } })
    expect(w.text()).toContain('정원')
    expect(w.text()).toContain('50')
    expect(w.text()).toContain('명')
  })
  it('alwaysShow=true면 빈 값도 "정보 없음"으로 렌더한다', () => {
    const w = mount(FieldGrid, { props: { variant: 'prominent', cols: 2, alwaysShow: true, items: [{ label: 'CCTV', value: null, unit: '대' }] } })
    expect(w.text()).toContain('CCTV')
    expect(w.text()).toContain('정보 없음')
  })
  it('alwaysShow=false면 빈 값 셀은 숨긴다', () => {
    const w = mount(FieldGrid, { props: { variant: 'prominent', cols: 2, items: [{ label: 'CCTV', value: null, unit: '대' }] } })
    expect(w.text()).not.toContain('CCTV')
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/FieldGrid.test.ts` → FAIL.

- [ ] **Step 3: 컴포넌트** — `frontend/components/facility/detail/FieldGrid.vue`
```vue
<template>
  <div class="grid gap-3" :class="colsClass">
    <template v-for="(item, i) in items" :key="`${item.label}-${i}`">
      <div
        v-if="alwaysShow || hasValue(item.value)"
        class="bg-slate-50 rounded-lg text-center"
        :class="variant === 'prominent' ? 'p-3' : 'py-2.5 px-2 flex flex-col items-center justify-center'"
      >
        <p class="text-xs text-gray-600" :class="variant === 'prominent' ? 'mb-1' : ''">{{ item.label }}</p>
        <p v-if="hasValue(item.value)" class="font-bold text-slate-900" :class="variant === 'prominent' ? 'text-lg' : 'text-sm'">
          {{ item.value }}<span v-if="item.unit" class="text-xs font-normal text-gray-600">{{ item.unit }}</span>
        </p>
        <p v-else class="text-sm text-slate-400">정보 없음</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface FieldGridItem { label: string; value: string | number | null | undefined; unit?: string }

const props = withDefaults(defineProps<{
  items: FieldGridItem[]
  cols?: 2 | 3
  variant?: 'prominent' | 'compact'
  alwaysShow?: boolean
}>(), { cols: 2, variant: 'prominent', alwaysShow: false })

const colsClass = computed(() => (props.cols === 3 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'))
function hasValue(v: unknown): boolean { return v !== null && v !== undefined && v !== '' }
</script>
```
(주: childcare는 `variant="prominent"`, school은 `variant="compact" cols={3}`로 기존 모양 재현. school의 `isTotal`(indigo, col-span-full) 특수 케이스가 있으면 FieldGrid로 깔끔히 안 들어오므로, **school enrollment 그리드는 이번 PR에서 교체하지 말고 childcare만 FieldGrid로 교체**(school은 후속 시각 통일 PR). childcare 그리드만 안전하게 교체 + 항상표시.)

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/facility/detail/FieldGrid.test.ts` → PASS(3).

- [ ] **Step 5: childcare 그리드 교체 + 항상표시**
`DetailFacilityStatus.vue` childcare 정원·시설현황 그리드(`:368-396`, 7개 `v-if` 셀)를 `FieldGrid`로 교체. 7필드를 alwaysShow로:
```vue
            <FieldGrid
              :cols="2"
              variant="prominent"
              :always-show="true"
              :items="[
                { label: '정원', value: details?.crcapat, unit: '명' },
                { label: '현원', value: details?.crchcnt, unit: '명' },
                { label: '보육실', value: details?.nrtrroomcnt, unit: '개' },
                { label: 'CCTV', value: details?.cctvinstlcnt, unit: '대' },
                { label: '놀이터', value: details?.plgrdco, unit: '개' },
                { label: '교직원', value: details?.chcrtescnt, unit: '명' },
                { label: '보육실 면적', value: details?.nrtrroomsize, unit: '㎡' },
              ]"
            />
```
(기존 그리드를 감싸던 `v-if`/SectionBlock 컨텍스트는 유지. 7필드가 항상 셀로 표시되고 빈 값은 "정보 없음".)

- [ ] **Step 6: childcare 항상표시 테스트 추가** — `DetailFacilityStatus.test.ts`
childcare 픽셀 필드 일부를 비워도 셀이 "정보 없음"으로 렌더되는지 테스트 추가(기존 헬퍼/픽스처 사용). 예:
```ts
it('childcare: 빈 시설현황 필드도 "정보 없음"으로 항상 표시', () => {
  const wrapper = /* childcare facility, crcapat=50, 나머지 null */
  expect(wrapper.text()).toContain('정원')
  expect(wrapper.text()).toContain('CCTV')
  expect(wrapper.text()).toContain('정보 없음')
})
```

- [ ] **Step 7: 통과 + lint + 커밋**
Run: `cd frontend && npx vitest run tests/components/facility/detail/` → PASS.
Run: `cd frontend && npx eslint components/facility/detail/FieldGrid.vue components/facility/detail/DetailFacilityStatus.vue`
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/facility/detail/FieldGrid.vue frontend/components/facility/detail/DetailFacilityStatus.vue frontend/tests/components/facility/detail/FieldGrid.test.ts frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts
git commit -m "feat(frontend): FieldGrid 프리미티브 + childcare 시설현황 항상표시(정보없음) 통일"
```

---

## Task 4: 회귀 검증 + PR

- [ ] **Step 1: detail + utils 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/facility/detail tests/utils/categoryHeroStats.test.ts tests/pages/detail.test.ts`
Expected: PASS.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5` → 0 errors.

- [ ] **Step 3: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 4: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.

- [ ] **Step 5: 시각 확인 (가능 시)**
로컬에 시설 데이터가 있으면(`npm run db:seed` 후) hospital/childcare/market/school 상세를 열어 칩·그리드·heroStats가 기존과 동일한지(픽셀 불변) 육안 확인. 데이터 없으면 이 단계는 스킵하고 PR 본문에 "시각 확인 필요" 명시.

- [ ] **Step 6: PR**
```bash
git push -u origin feat/category-detail-pr2
gh pr create --base develop --title "카테고리 상세 일관성 PR2: heroStats registry + childcare 정보없음 + FieldGrid/TagBadges 추출" --body "audit ④ PR2(output-preserving). heroStats switch→registry(+미등록 경고), childcare 시설현황 항상표시(정보없음), FieldGrid/TagBadges 프리미티브 추출(픽셀 불변). 카드 스타일 시각 통일은 시각 검증 가능 시 후속."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** P2-1(FieldGrid/TagBadges 추출)=T2·T3(output-preserving; 시각 통일은 후속 명시) / P2-2(정보없음 항상표시)=T3 childcare(clothes·parking·library는 이미 준수) / P2-3(heroStats registry)=T1. 검증=T4.
- **Placeholder scan:** T1의 "aed/park/sports/toilet/wifi/ev-charger case를 기존 [id].vue에서 전사" 및 T2/T3의 "호출부 매핑/픽셀 일치 조정", T3 Step6 테스트의 "기존 헬퍼 사용"은 기존 코드 의존 지시(구현자가 파일 읽고 1:1 전사) — 정당. 나머지 코드 단계는 실제 코드 포함.
- **Type consistency:** `buildHeroStats(category, details, phone): HeroStat{label,value}[]` T1. `TagBadgeItem{label,suffix?,colorClass?}`+variant T2. `FieldGridItem{label,value,unit?}`+cols/variant/alwaysShow T3. 모두 일관.
- **위험 관리:** 카드 스타일은 output-preserving(픽셀 불변)이라 시각 회귀 위험 최소. school enrollment 그리드(isTotal 특수)는 교체 제외(후속). childcare만 항상표시 behavior 변경 — 단위테스트로 검증.
- **Out of scope:** 카드 스타일 시각 통일(후속), school 그리드 FieldGrid화(후속), library 운영시간.
