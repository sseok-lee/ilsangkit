# 시설 상세페이지 재설계 — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `toilet`·`clothes` 상세페이지를 "레코드 완전전개(스펙 그리드) + 위치 길찾기(교통) + 슬롭 제거"의 새 구조로 전환하고, 나머지 13개 카테고리는 무손상 유지(vertical slice).

**Architecture:** 신규 프레젠테이션 컴포넌트(`DetailSpecGrid`, `DetailLocationGuide`) + 카테고리별 필드그룹 레지스트리(`facilitySpecGroups.ts`)를 추가하고, `pages/[category]/[id].vue`에서 `isRedesigned` 게이트로 두 카테고리만 새 사다리로 렌더한다. 슬롭(고정 팁/FAQ) 제거는 기존 생성기에 `staticFill` 옵트인 파라미터(기본값=현행 유지)로 도입해 비대상 카테고리에 영향이 없게 한다. 교통 섹션은 lat/lng만 필요한 `/api/transit/nearby`를 사용한다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup>` (TS), Vitest(happy-dom) + @vue/test-utils, TailwindCSS.

## Global Constraints

- **단일 h1.** 렌더된 한 화면당 h1 하나. 모바일 `MobileDetailHeader`가 literal h1, 데스크톱 `PageHero`는 `title-tag="div"`. 새 컴포넌트는 h1/h2를 만들지 않는다(섹션 제목은 `SectionBlock`의 `h3`).
- **광고 슬롯 1:1 보존.** `pages/[category]/[id].vue`의 AdBanner 5곳(line 117 `sizing="fixed" ad-format="rectangle" :fixed-height="280"`, line 123/138/191 `variant="compact-mobile"`, line 258 사이드바 무props)을 개수·위치 그대로 유지. 축소·이동 금지.
- **SSR-first + 가드.** 색인 대상 본문은 서버 렌더. 브라우저 API는 `import.meta.client` 가드.
- **vitest auto-import 함정.** 직접 mount되는 SFC는 `ref/computed/watch` 등 `vue` 코어 API를 **명시적으로 import**해야 한다(미import 시 CI에서만 `ReferenceError`). `useRuntimeConfig/useRoute` 등 Nuxt 전역은 `tests/setup.ts`가 제공하므로 import 불필요.
- **Tailwind order 함정.** flex order는 `order-1`~`order-12`만 사용(임의값 `order-[13+]` JIT 미생성).
- **`정보 없음` 계약(불변).** 빈 값 표기는 `<span class="text-sm text-slate-400">정보 없음</span>`. 라벨=`text-sm text-gray-600`, 값=`text-sm font-medium text-slate-900`.
- **슬롭 금지.** 비어 있으면 렌더하지 않는다(고정 보일러플레이트로 채우지 않는다). `flag`(불리언) 부재는 행 자체를 생략한다.
- **light-only / 코발트 `#2450DC`.** 그라데이션·글래스·네온 금지.
- **커밋 전 테스트.** 각 태스크 종료 시 `cd frontend && npx vitest run <해당 테스트 파일>` 통과 확인. 작업 브랜치 = `feat/facility-detail-redesign`(이미 존재, spec 커밋 `47ca985e` 위).

---

## File Structure

| 파일 | 역할 | 신규/수정 |
|------|------|-----------|
| `frontend/utils/facilitySpecGroups.ts` | 카테고리→필드그룹(`SpecGroup[]`) 빌더. `toilet`/`clothes` 정의 + 타입 | **신규** |
| `frontend/components/facility/detail/DetailSpecGrid.vue` | `SpecGroup[]`를 라벨-값 행 / 표로 렌더(`정보 없음`·flag 숨김) | **신규** |
| `frontend/components/facility/detail/DetailLocationGuide.vue` | 가는 법(지하철 거리) + 가까운 동종시설 대안 리스트 | **신규** |
| `frontend/composables/useTransitNearby.ts` | `/api/transit/nearby` 조회 composable | **신규** |
| `frontend/utils/dynamicTips.ts` | `staticFill` 옵트인 추가(기본=현행) | 수정 |
| `frontend/utils/dynamicFAQ.ts` | `staticFill` 옵트인 추가(기본=현행) | 수정 |
| `frontend/pages/[category]/[id].vue` | `isRedesigned` 게이트로 toilet/clothes 새 사다리 배선 | 수정 |
| `frontend/tests/...` | 위 신규/수정에 대한 vitest | **신규** |

각 신규 파일은 단일 책임. 페이지는 게이트 분기만 추가하고 비대상 카테고리 경로는 그대로 둔다.

---

## Task 1: 필드그룹 레지스트리 `facilitySpecGroups.ts` (toilet + clothes)

**Files:**
- Create: `frontend/utils/facilitySpecGroups.ts`
- Test: `frontend/tests/utils/facilitySpecGroups.test.ts`

**Interfaces:**
- Produces:
  - `interface SpecRow { label: string; value: string | number | null | undefined; unit?: string; kind?: 'value' | 'flag' }`
  - `interface SpecTable { columns: string[]; rows: Array<{ label: string; cells: Array<string | number | null> }> }`
  - `interface SpecGroup { heading?: string; render: 'kv' | 'table'; rows?: SpecRow[]; table?: SpecTable }`
  - `function buildSpecGroups(category: FacilityCategory, details: Record<string, unknown>): SpecGroup[]`
- Consumes: `FacilityCategory` from `~/types/facility`.

규칙: `kind:'value'` 행은 항상 포함(빈 값은 `DetailSpecGrid`가 `정보 없음` 표기). `kind:'flag'` 행은 값이 있을 때만 의미(없으면 컴포넌트가 행 생략). thin(`clothes`)은 값이 있는 행만 push(강제 `정보 없음` 없음).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/utils/facilitySpecGroups.test.ts
import { describe, it, expect } from 'vitest'
import { buildSpecGroups } from '~/utils/facilitySpecGroups'

describe('buildSpecGroups — toilet (rich)', () => {
  const details = {
    maleToilets: 25, maleUrinals: 47, femaleToilets: 128,
    maleDisabledToilets: 2, femaleDisabledToilets: 1,
    maleChildToilets: 2, maleChildUrinals: 2, femaleChildToilets: 4,
    hasCCTV: true, hasEmergencyBell: true, emergencyBellLocation: '남자화장실+여자화장실',
    hasDiaperChangingTable: true, diaperChangingLocation: '여자화장실', hasDisabledToilet: true,
    facilityType: '개방화장실', ownershipType: '민간', sewageTreatment: '수세식',
    installDate: '199701', remodelingDate: '', managingOrg: '현대백화점 천호지점',
    phoneNumber: '0222258761', operatingHours: '10:30~20:00',
  }
  const groups = buildSpecGroups('toilet', details)

  it('변기 현황 표 group을 만든다', () => {
    const table = groups.find(g => g.render === 'table')
    expect(table).toBeTruthy()
    expect(table!.table!.columns).toEqual(['구분', '남성', '여성'])
    const daebyeon = table!.table!.rows.find(r => r.label === '대변기')
    expect(daebyeon!.cells).toEqual([25, 128])
  })

  it('안전·편의 flag 행을 만든다 (있는 것만 value 채움)', () => {
    const g = groups.find(g => g.heading === '안전 · 편의')!
    const cctv = g.rows!.find(r => r.label === 'CCTV')!
    expect(cctv.kind).toBe('flag')
    expect(cctv.value).toBe('설치됨')
    const bell = g.rows!.find(r => r.label === '비상벨')!
    expect(bell.value).toContain('남자화장실+여자화장실')
  })

  it('운영·관리는 value 행(빈 값도 행 유지: 개보수 시기)', () => {
    const g = groups.find(g => g.heading === '운영 · 관리')!
    const remodel = g.rows!.find(r => r.label === '개보수 시기')!
    expect(remodel.kind).toBe('value')
    expect(remodel.value === '' || remodel.value == null).toBe(true)
  })
})

describe('buildSpecGroups — clothes (thin, 있는 만큼만)', () => {
  it('값 있는 행만 포함, 강제 정보없음 없음', () => {
    const groups = buildSpecGroups('clothes', {
      detailLocation: '가로등 옆', managementAgency: '서울특별시 서초구청',
      phoneNumber: '02-2155-6742', providerName: '서울특별시 서초구', dataDate: '2025-02-18',
    })
    const rows = groups.flatMap(g => g.rows ?? [])
    expect(rows.find(r => r.label === '설치 위치')!.value).toBe('가로등 옆')
    expect(rows.every(r => r.value !== null && r.value !== undefined && r.value !== '')).toBe(true)
  })

  it('필드 없으면 해당 행 자체가 없다', () => {
    const groups = buildSpecGroups('clothes', { detailLocation: '도로변' })
    const labels = groups.flatMap(g => g.rows ?? []).map(r => r.label)
    expect(labels).toContain('설치 위치')
    expect(labels).not.toContain('연락처')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/utils/facilitySpecGroups.test.ts`
Expected: FAIL — "Failed to resolve import '~/utils/facilitySpecGroups'".

- [ ] **Step 3: Write the implementation**

```ts
// frontend/utils/facilitySpecGroups.ts
import type { FacilityCategory } from '~/types/facility'

export interface SpecRow {
  label: string
  value: string | number | null | undefined
  unit?: string
  /** 'value' = 빈 값도 행 유지(컴포넌트가 '정보 없음'). 'flag' = 값 없으면 행 생략. */
  kind?: 'value' | 'flag'
}
export interface SpecTable {
  columns: string[]
  rows: Array<{ label: string; cells: Array<string | number | null> }>
}
export interface SpecGroup {
  heading?: string
  render: 'kv' | 'table'
  rows?: SpecRow[]
  table?: SpecTable
}

type D = Record<string, unknown>
const num = (v: unknown): number | null => (typeof v === 'number' && !Number.isNaN(v) ? v : null)
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null)
const formatPhone = (v: unknown): string | null => {
  const s = str(v)?.replace(/[^0-9]/g, '')
  if (!s) return null
  if (s.startsWith('02')) return s.length > 9 ? `${s.slice(0, 2)}-${s.slice(2, 6)}-${s.slice(6)}` : `${s.slice(0, 2)}-${s.slice(2, 5)}-${s.slice(5)}`
  return `${s.slice(0, 3)}-${s.slice(3, 7)}-${s.slice(7)}`
}
const formatYm = (v: unknown): string | null => {
  const s = str(v)
  if (!s) return null
  const m = s.match(/^(\d{4})(\d{2})$/)
  return m ? `${m[1]}년 ${Number(m[2])}월` : s
}

function toiletGroups(d: D): SpecGroup[] {
  const groups: SpecGroup[] = []

  const fixtureRows: SpecTable['rows'] = [
    { label: '대변기', cells: [num(d.maleToilets), num(d.femaleToilets)] },
    { label: '소변기', cells: [num(d.maleUrinals), null] },
    { label: '장애인용', cells: [num(d.maleDisabledToilets), num(d.femaleDisabledToilets)] },
    { label: '어린이 대변기', cells: [num(d.maleChildToilets), num(d.femaleChildToilets)] },
    { label: '어린이 소변기', cells: [num(d.maleChildUrinals), null] },
  ].filter(r => r.cells.some(c => c != null))
  if (fixtureRows.length) {
    groups.push({ heading: '변기 현황', render: 'table', table: { columns: ['구분', '남성', '여성'], rows: fixtureRows } })
  }

  const bellLoc = str(d.emergencyBellLocation)
  const diaperLoc = str(d.diaperChangingLocation)
  groups.push({
    heading: '안전 · 편의',
    render: 'kv',
    rows: [
      { label: 'CCTV', value: d.hasCCTV ? '설치됨' : null, kind: 'flag' },
      { label: '비상벨', value: d.hasEmergencyBell ? (bellLoc ? `설치 · ${bellLoc}` : '설치됨') : null, kind: 'flag' },
      { label: '기저귀 교환대', value: d.hasDiaperChangingTable ? (diaperLoc ? `있음 · ${diaperLoc}` : '있음') : null, kind: 'flag' },
      { label: '장애인 화장실', value: d.hasDisabledToilet ? '있음' : null, kind: 'flag' },
    ],
  })

  groups.push({
    heading: '운영 · 관리',
    render: 'kv',
    rows: [
      { label: '개방 형태', value: str(d.facilityType), kind: 'value' },
      { label: '소유 구분', value: str(d.ownershipType), kind: 'value' },
      { label: '정화 방식', value: str(d.sewageTreatment), kind: 'value' },
      { label: '운영시간', value: str(d.operatingHours), kind: 'value' },
      { label: '설치 시기', value: formatYm(d.installDate), kind: 'value' },
      { label: '개보수 시기', value: formatYm(d.remodelingDate), kind: 'value' },
      { label: '관리기관', value: str(d.managingOrg), kind: 'value' },
      { label: '연락처', value: formatPhone(d.phoneNumber), kind: 'value' },
    ],
  })

  return groups
}

function clothesGroups(d: D): SpecGroup[] {
  // thin: 값 있는 행만
  const rows: SpecRow[] = [
    { label: '설치 위치', value: str(d.detailLocation) },
    { label: '관리기관', value: str(d.managementAgency) },
    { label: '연락처', value: formatPhone(d.phoneNumber) },
    { label: '운영기관', value: str(d.providerName) },
    { label: '자료 기준일', value: str(d.dataDate) },
  ].filter(r => r.value != null)
  return rows.length ? [{ heading: '상세 정보', render: 'kv', rows }] : []
}

const REGISTRY: Partial<Record<FacilityCategory, (d: D) => SpecGroup[]>> = {
  toilet: toiletGroups,
  clothes: clothesGroups,
}

export function buildSpecGroups(category: FacilityCategory, details: Record<string, unknown>): SpecGroup[] {
  const builder = REGISTRY[category]
  return builder ? builder(details ?? {}) : []
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/utils/facilitySpecGroups.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/utils/facilitySpecGroups.ts frontend/tests/utils/facilitySpecGroups.test.ts
git commit -m "feat(facility-detail): add facilitySpecGroups registry (toilet/clothes)"
```

---

## Task 2: `DetailSpecGrid.vue` 컴포넌트

**Files:**
- Create: `frontend/components/facility/detail/DetailSpecGrid.vue`
- Test: `frontend/tests/components/facility/detail/DetailSpecGrid.test.ts`

**Interfaces:**
- Consumes: `SpecGroup` from `~/utils/facilitySpecGroups` (Task 1), `SectionBlock` (`size` prop, NOT `padding`).
- Produces: component with props `{ groups: SpecGroup[]; heading?: string }`. `heading` default `'상세 정보'`. Renders inside `<SectionBlock :heading="heading" size="default">`. 그룹 사이 divider `<div class="h-px bg-slate-100 w-full">`. `kind:'flag'` 행은 값 없으면 미렌더. `kind:'value'`(또는 미지정) 빈 값은 `정보 없음`. flag 값은 emerald, table null 셀은 `—`.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/components/facility/detail/DetailSpecGrid.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailSpecGrid from '~/components/facility/detail/DetailSpecGrid.vue'
import type { SpecGroup } from '~/utils/facilitySpecGroups'

const globalConfig = {
  stubs: { SectionBlock: { template: '<section data-testid="spec-section"><slot /></section>' } },
}

function mountGrid(groups: SpecGroup[]) {
  return mount(DetailSpecGrid, { props: { groups }, global: globalConfig })
}

describe('DetailSpecGrid', () => {
  it('table group: 셀 값을 렌더하고 null은 —', () => {
    const groups: SpecGroup[] = [{
      render: 'table',
      table: { columns: ['구분', '남성', '여성'], rows: [{ label: '소변기', cells: [47, null] }] },
    }]
    const html = mountGrid(groups).html()
    expect(html).toContain('47')
    expect(html).toContain('—')
  })

  it('value 행: 빈 값은 정보 없음', () => {
    const html = mountGrid([{ render: 'kv', rows: [{ label: '개보수 시기', value: '', kind: 'value' }] }]).html()
    expect(html).toContain('개보수 시기')
    expect(html).toContain('정보 없음')
  })

  it('flag 행: 값 없으면 행 자체가 없다', () => {
    const wrapper = mountGrid([{ render: 'kv', rows: [
      { label: 'CCTV', value: '설치됨', kind: 'flag' },
      { label: '비상벨', value: null, kind: 'flag' },
    ] }])
    const text = wrapper.text()
    expect(text).toContain('CCTV')
    expect(text).toContain('설치됨')
    expect(text).not.toContain('비상벨')
  })

  it('빈 groups면 아무 행도 없다', () => {
    const wrapper = mountGrid([])
    expect(wrapper.text()).not.toContain('정보 없음')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailSpecGrid.test.ts`
Expected: FAIL — cannot resolve `DetailSpecGrid.vue`.

- [ ] **Step 3: Write the implementation**

```vue
<!-- frontend/components/facility/detail/DetailSpecGrid.vue -->
<template>
  <SectionBlock :heading="heading" size="default">
    <div class="flex flex-col gap-3">
      <template v-for="(group, gi) in visibleGroups" :key="gi">
        <div v-if="gi > 0" class="h-px bg-slate-100 w-full"></div>
        <div>
          <p v-if="group.heading" class="text-xs font-bold text-gray-500 mb-2">{{ group.heading }}</p>

          <table v-if="group.render === 'table' && group.table" class="w-full text-sm">
            <thead>
              <tr>
                <th
                  v-for="(col, ci) in group.table.columns"
                  :key="ci"
                  class="py-1.5 text-xs font-medium text-gray-500"
                  :class="ci === 0 ? 'text-left' : 'text-center'"
                >{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in group.table.rows" :key="ri" class="border-t border-slate-100">
                <td class="py-2 text-gray-600">{{ row.label }}</td>
                <td v-for="(cell, ci) in row.cells" :key="ci" class="py-2 text-center font-bold text-slate-900">
                  {{ cell == null ? '—' : cell }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="flex flex-col gap-3">
            <template v-for="(row, ri) in group.rows" :key="ri">
              <div v-if="!(row.kind === 'flag' && !hasValue(row.value))" class="flex items-center justify-between">
                <span class="text-sm text-gray-600">{{ row.label }}</span>
                <span v-if="hasValue(row.value)" class="text-sm font-medium" :class="row.kind === 'flag' ? 'text-emerald-600' : 'text-slate-900'">
                  {{ row.value }}<span v-if="row.unit" class="text-xs font-normal text-gray-600">{{ row.unit }}</span>
                </span>
                <span v-else class="text-sm text-slate-400">정보 없음</span>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpecGroup } from '~/utils/facilitySpecGroups'

const props = withDefaults(defineProps<{ groups: SpecGroup[]; heading?: string }>(), {
  heading: '상세 정보',
})

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

// flag-only 그룹이 전부 비면 그룹 자체를 숨긴다(빈 헤더 방지)
const visibleGroups = computed(() =>
  props.groups.filter((g) => {
    if (g.render === 'table') return (g.table?.rows.length ?? 0) > 0
    return (g.rows ?? []).some((r) => r.kind !== 'flag' || hasValue(r.value))
  }),
)
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailSpecGrid.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/facility/detail/DetailSpecGrid.vue frontend/tests/components/facility/detail/DetailSpecGrid.test.ts
git commit -m "feat(facility-detail): add DetailSpecGrid (label-value rows + table, 정보없음/flag 계약)"
```

---

## Task 3: 슬롭 제거 — `staticFill` 옵트인 (tips + FAQ)

**Files:**
- Modify: `frontend/utils/dynamicTips.ts:118-124`
- Modify: `frontend/utils/dynamicFAQ.ts:314-321`
- Test: `frontend/tests/utils/dynamicSlopOptIn.test.ts`

**Interfaces:**
- Produces (변경된 시그니처):
  - `generateDynamicTips(facility: FacilityDetail, opts?: { staticFill?: boolean }): string[]`
  - `generateDynamicFAQ(facility: FacilityDetail, opts?: { staticFill?: boolean }): FAQItem[]`
  - `staticFill` 미지정/`true` = 현행(동적 + 정적 보충 최대 5). `false` = 동적만(`dynamic.slice(0,3)`), 정적 보충 없음.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/utils/dynamicSlopOptIn.test.ts
import { describe, it, expect } from 'vitest'
import { generateDynamicTips } from '~/utils/dynamicTips'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
import type { FacilityDetail, FacilityCategory } from '~/types/facility'

function makeFacility(category: FacilityCategory, details: Record<string, unknown>): FacilityDetail {
  return {
    id: `${category}-1`, category, name: '테스트', address: null, roadAddress: null,
    lat: 37.5, lng: 127, city: '서울', district: '강남구', bjdCode: null,
    details: details as FacilityDetail['details'], sourceId: 's', sourceUrl: null,
    viewCount: 0, createdAt: '', updatedAt: '', syncedAt: '',
  }
}

describe('staticFill 옵트인', () => {
  it('기본(미지정): 정적 보충으로 채운다(현행 유지)', () => {
    const tips = generateDynamicTips(makeFacility('toilet', {}))
    expect(tips.length).toBeGreaterThan(0) // 정적 fallback 존재
  })

  it('staticFill:false → 동적만(필드 없으면 0개)', () => {
    const tips = generateDynamicTips(makeFacility('toilet', {}), { staticFill: false })
    expect(tips).toEqual([])
    const faqs = generateDynamicFAQ(makeFacility('clothes', {}), { staticFill: false })
    expect(faqs).toEqual([])
  })

  it('staticFill:false → 동적은 그대로 살린다', () => {
    const faqs = generateDynamicFAQ(makeFacility('toilet', { openTime: '상시' }), { staticFill: false })
    expect(faqs.length).toBe(1)
    expect(faqs[0].question).toContain('24시간')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/utils/dynamicSlopOptIn.test.ts`
Expected: FAIL — `staticFill:false`인데도 정적 보충이 들어가 `toEqual([])`가 깨짐.

- [ ] **Step 3: Edit `dynamicTips.ts`**

`generateDynamicTips`의 시그니처와 말미(현재 118-124)를 교체:

```ts
// 함수 시그니처 (line 8 부근)
export function generateDynamicTips(
  facility: FacilityDetail,
  opts: { staticFill?: boolean } = {},
): string[] {
```
```ts
// 말미 (현재 118-124 교체)
  // 동적 팁 최대 3개 + (옵션) 정적 팁 보충하여 총 5개
  const dynamicSlice = dynamic.slice(0, 3)
  if (opts.staticFill === false) return dynamicSlice
  const staticTips = CATEGORY_TIPS[cat] ?? []
  const needed = 5 - dynamicSlice.length
  return [...dynamicSlice, ...staticTips.slice(0, needed)]
}
```

- [ ] **Step 4: Edit `dynamicFAQ.ts`**

```ts
// 함수 시그니처 (line 9 부근)
export function generateDynamicFAQ(
  facility: FacilityDetail,
  opts: { staticFill?: boolean } = {},
): FAQItem[] {
```
```ts
// 말미 (현재 314-321 교체)
  // 동적 FAQ 최대 3개 + (옵션) 정적 FAQ 보충하여 총 5개
  const dynamicSlice = dynamic.slice(0, 3)
  if (opts.staticFill === false) return dynamicSlice
  const staticFaqs = CATEGORY_FAQ[cat] ?? []
  const needed = 5 - dynamicSlice.length
  return [...dynamicSlice, ...staticFaqs.slice(0, needed)]
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/utils/dynamicSlopOptIn.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Regression — 기존 팁/FAQ 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/dynamicTips.test.ts tests/utils/dynamicFAQ.test.ts`
Expected: PASS (기본 동작 불변이므로 기존 테스트 영향 없음). 해당 파일이 없으면 이 스텝은 건너뛴다.

- [ ] **Step 7: Commit**

```bash
git add frontend/utils/dynamicTips.ts frontend/utils/dynamicFAQ.ts frontend/tests/utils/dynamicSlopOptIn.test.ts
git commit -m "feat(facility-detail): staticFill opt-in to drop slop fill (default unchanged)"
```

---

## Task 4: `useTransitNearby` composable

**Files:**
- Create: `frontend/composables/useTransitNearby.ts`
- Test: `frontend/tests/composables/useTransitNearby.test.ts`

**Interfaces:**
- Produces:
  - `interface NearbyStation { id: string; name: string; nameSlug: string; line: string; distance: number; type: 'subway' }`
  - `function fetchTransitNearby(apiBase: string, lat: number, lng: number, radius?: number): Promise<NearbyStation[]>`
- Consumes: `$fetch` (전역). 응답 shape `{ success: boolean; data: { stations: NearbyStation[] } }` (route `GET /api/transit/nearby`, 쿼리 `lat,lng,radius`). 실패 시 `[]`.

순수 fetch 헬퍼로 둔다(페이지에서 `useAsyncData`로 감싸 호출). 컴포저블 형태지만 reactivity 없이 테스트 가능.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/composables/useTransitNearby.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTransitNearby } from '~/composables/useTransitNearby'

describe('fetchTransitNearby', () => {
  beforeEach(() => { (globalThis.$fetch as any) = vi.fn() })

  it('정상 응답에서 stations 배열을 반환', async () => {
    (globalThis.$fetch as any).mockResolvedValue({
      success: true,
      data: { stations: [{ id: '1', name: '천호(풍납토성)', nameSlug: 'cheonho', line: '5호선', distance: 96, type: 'subway' }] },
    })
    const out = await fetchTransitNearby('http://x', 37.5391, 127.1244, 2000)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('천호(풍납토성)')
    expect((globalThis.$fetch as any)).toHaveBeenCalledWith(
      'http://x/api/transit/nearby',
      { query: { lat: 37.5391, lng: 127.1244, radius: 2000 } },
    )
  })

  it('실패 시 빈 배열', async () => {
    (globalThis.$fetch as any).mockRejectedValue(new Error('boom'))
    expect(await fetchTransitNearby('http://x', 37.5, 127)).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/composables/useTransitNearby.test.ts`
Expected: FAIL — cannot resolve module.

- [ ] **Step 3: Write the implementation**

```ts
// frontend/composables/useTransitNearby.ts
export interface NearbyStation {
  id: string
  name: string
  nameSlug: string
  line: string
  distance: number
  type: 'subway'
}

export async function fetchTransitNearby(
  apiBase: string,
  lat: number,
  lng: number,
  radius = 2000,
): Promise<NearbyStation[]> {
  try {
    const res = await $fetch<{ success: boolean; data: { stations: NearbyStation[] } }>(
      `${apiBase}/api/transit/nearby`,
      { query: { lat, lng, radius } },
    )
    return res?.data?.stations ?? []
  } catch {
    return []
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/composables/useTransitNearby.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/composables/useTransitNearby.ts frontend/tests/composables/useTransitNearby.test.ts
git commit -m "feat(facility-detail): add fetchTransitNearby helper (/api/transit/nearby)"
```

---

## Task 5: `DetailLocationGuide.vue` (가는 법 + 가까운 대안)

**Files:**
- Create: `frontend/components/facility/detail/DetailLocationGuide.vue`
- Test: `frontend/tests/components/facility/detail/DetailLocationGuide.test.ts`

**Interfaces:**
- Consumes: `NearbyStation` from `~/composables/useTransitNearby` (Task 4); `NuxtLink` (전역 stub).
- Produces: props
  - `stations: NearbyStation[]`
  - `alternatives: Array<{ id: string; category: string; name: string; roadAddress?: string | null; address?: string | null; distance?: number }>`
  - `alternativeLabel?: string` (기본 `'가까운 다른 시설'`)
  - 가장 가까운 역만 강조(첫 역). 도보 환산: 거리 < 800m면 "도보 N분" 병기(분 = round(distance/67)), 아니면 거리만. stations/alternatives 둘 다 비면 컴포넌트는 아무것도 렌더하지 않는다(`v-if`).

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/components/facility/detail/DetailLocationGuide.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailLocationGuide from '~/components/facility/detail/DetailLocationGuide.vue'

const base = {
  stations: [{ id: '1', name: '천호(풍납토성)', nameSlug: 'cheonho', line: '5호선', distance: 96, type: 'subway' as const }],
  alternatives: [{ id: 'a', category: 'toilet', name: '강동역 화장실', roadAddress: '서울 강동구', distance: 802 }],
}

describe('DetailLocationGuide', () => {
  it('가까운 역과 도보 환산을 표시', () => {
    const text = mount(DetailLocationGuide, { props: { ...base, alternativeLabel: '가까운 다른 화장실' } }).text()
    expect(text).toContain('천호(풍납토성)')
    expect(text).toContain('5호선')
    expect(text).toContain('도보') // 96m < 800 → 도보 N분
  })

  it('대안 리스트를 링크로 렌더', () => {
    const wrapper = mount(DetailLocationGuide, { props: { ...base } })
    const a = wrapper.find('a')
    expect(a.attributes('href')).toBe('/toilet/a')
    expect(wrapper.text()).toContain('강동역 화장실')
    expect(wrapper.text()).toContain('802m')
  })

  it('stations·alternatives 모두 비면 렌더 안 함', () => {
    const wrapper = mount(DetailLocationGuide, { props: { stations: [], alternatives: [] } })
    expect(wrapper.text().trim()).toBe('')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailLocationGuide.test.ts`
Expected: FAIL — cannot resolve component.

- [ ] **Step 3: Write the implementation**

```vue
<!-- frontend/components/facility/detail/DetailLocationGuide.vue -->
<template>
  <div v-if="stations.length || alternatives.length" class="flex flex-col gap-3">
    <div
      v-if="nearestStation"
      class="flex items-center gap-2 bg-slate-50 rounded-lg px-3 py-2.5 text-sm"
    >
      <span class="text-xs font-bold text-primary">{{ nearestStation.line }}</span>
      <span class="text-slate-700">{{ nearestStation.name }}역 · <b>{{ walkText(nearestStation.distance) }}</b></span>
    </div>

    <div v-if="alternatives.length">
      <p class="text-xs font-bold text-gray-500 mb-1">{{ alternativeLabel }}</p>
      <NuxtLink
        v-for="alt in alternatives"
        :key="alt.id"
        :to="`/${alt.category}/${alt.id}`"
        class="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm"
      >
        <span class="text-slate-900 font-medium truncate">{{ alt.name }}</span>
        <span v-if="alt.distance != null" class="text-gray-400 shrink-0 ml-2">{{ distText(alt.distance) }}</span>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NearbyStation } from '~/composables/useTransitNearby'

const props = withDefaults(defineProps<{
  stations: NearbyStation[]
  alternatives: Array<{ id: string; category: string; name: string; roadAddress?: string | null; address?: string | null; distance?: number }>
  alternativeLabel?: string
}>(), { alternativeLabel: '가까운 다른 시설' })

const nearestStation = computed(() => props.stations[0] ?? null)

function distText(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}
function walkText(m: number): string {
  if (m < 800) return `도보 ${Math.max(1, Math.round(m / 67))}분 (${distText(m)})`
  return distText(m)
}
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailLocationGuide.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/facility/detail/DetailLocationGuide.vue frontend/tests/components/facility/detail/DetailLocationGuide.test.ts
git commit -m "feat(facility-detail): add DetailLocationGuide (transit + nearby alternatives)"
```

---

## Task 6: 페이지 배선 — toilet/clothes 새 사다리 (`pages/[category]/[id].vue`)

**Files:**
- Modify: `frontend/pages/[category]/[id].vue`

**Interfaces:**
- Consumes: `buildSpecGroups`(Task 1), `DetailSpecGrid`(Task 2), `generateDynamicTips/FAQ` with `staticFill`(Task 3), `fetchTransitNearby`/`NearbyStation`(Task 4), `DetailLocationGuide`(Task 5).
- `DetailSpecGrid`/`DetailLocationGuide`는 Nuxt 자동 import(컴포넌트 디렉터리 규칙)되므로 `<template>`에서 바로 사용. `<script setup>`에서 `buildSpecGroups`, `fetchTransitNearby`는 명시 import.

게이트: `const REDESIGNED_CATEGORIES: FacilityCategory[] = ['toilet', 'clothes']`. `isRedesigned`가 true면 ① 필드 섹션을 `DetailSpecGrid`로 교체 ② 위치 섹션에 `DetailLocationGuide` 추가 ③ intro 산문 제거 ④ 팁/FAQ는 `staticFill:false` ⑤ FAQ 스키마도 동적만. false면 기존 경로 그대로(무손상).

> 이 태스크는 통합 작업이라 단위 TDD 대신 빌드·린트·실페이지 검증으로 게이트한다. 새 로직(스펙그리드/교통/슬롭) 자체는 Task 1–5에서 단위 검증됨.

- [ ] **Step 1: `<script setup>` — import + 게이트 + 교통 fetch 추가**

`useStructuredData` 구조분해 아래(line 299 부근)에 import 추가:
```ts
import { buildSpecGroups } from '~/utils/facilitySpecGroups'
import { fetchTransitNearby, type NearbyStation } from '~/composables/useTransitNearby'
```

`category` computed 아래에 게이트 추가:
```ts
const REDESIGNED_CATEGORIES: FacilityCategory[] = ['toilet', 'clothes']
const isRedesigned = computed(() => REDESIGNED_CATEGORIES.includes(category.value))
```

`details` computed(line 386) 아래에 스펙그리드 그룹 computed 추가:
```ts
const specGroups = computed(() =>
  facility.value ? buildSpecGroups(facility.value.category, (facility.value.details ?? {}) as Record<string, unknown>) : [],
)
```

`nearby` fetch(Fetch C) 아래에 교통 fetch 추가:
```ts
const { data: transitData } = await useAsyncData(
  `transit-${category.value}-${id.value}`,
  async (): Promise<{ stations: NearbyStation[] }> => {
    const f = facilityResponse.value?.data
    if (!isRedesigned.value || !f?.lat || !f?.lng) return { stations: [] }
    return { stations: await fetchTransitNearby(apiBase, f.lat, f.lng, 2000) }
  },
  { lazy: true, default: () => ({ stations: [] as NearbyStation[] }) },
)
```

- [ ] **Step 2: 팁/FAQ computed를 게이트 인지로 변경**

`categoryTips`(line 486)·`categoryFaqItems`(line 490)를 교체:
```ts
const categoryTips = computed(() =>
  facility.value ? generateDynamicTips(facility.value, { staticFill: !isRedesigned.value }) : [],
)
const categoryFaqItems = computed(() =>
  facility.value ? generateDynamicFAQ(facility.value, { staticFill: !isRedesigned.value }) : [],
)
```

`watchEffect` #1의 FAQ 스키마(line 405-407 부근)도 게이트 적용:
```ts
const faqItems = generateDynamicFAQ(facility.value, { staticFill: !isRedesigned.value })
if (faqItems.length > 0) {
  setFAQSchema(faqItems)
}
```

- [ ] **Step 3: `<template>` — intro 제거 + 필드 섹션 교체**

PageHero(line 112)의 description을 게이트:
```vue
:description="isRedesigned ? undefined : (facilityIntro || undefined)"
```

필드 섹션 — 기존 `DetailFacilityStatus`(line 119-120)와 `DetailBasicInfo`(line 125-135) 블록을 게이트로 감싼다. 새 스펙그리드를 그 자리에 추가하되, **광고 슬롯(line 123 `variant="compact-mobile"`)은 그대로 둔다**:

```vue
<!-- 신: 스펙 그리드 (toilet/clothes) -->
<DetailSpecGrid v-if="isRedesigned && facility" :groups="specGroups" />

<!-- 구: 비대상 카테고리 (기존 그대로) -->
<DetailFacilityStatus v-if="!isRedesigned" :facility="facility" />
<div v-if="!isRedesigned" class="...기존 광고 wrapper 클래스...">
  <AdBanner variant="compact-mobile" />
</div>
<DetailBasicInfo
  v-if="!isRedesigned"
  :facility="facility"
  :hospital-operating-hours="hospitalOperatingHours"
  :hospital-weekly-hours="hospitalWeeklyHours"
  :hospital-weekly-hours-count="hospitalWeeklyHours.length"
  :aed-operating-hours="aedOperatingHours"
  :aed-weekly-hours="aedWeeklyHours"
  :aed-weekly-hours-count="aedWeeklyHours.length"
  :pharmacy-weekly-hours="pharmacyWeeklyHours"
/>
```

> 주의: line 117 hero 광고, line 123 compact 광고, line 138 compact 광고는 게이트와 무관하게 항상 렌더되어야 한다(슬롯 1:1 보존). 위 예시의 "구 경로 내부 광고"는 비대상일 때만 쓰는 기존 슬롯이면 그대로, 공용 슬롯이면 게이트 밖으로 빼서 항상 렌더. 실제 라인 확인 후 슬롯 개수가 변하지 않게 배치한다.

- [ ] **Step 4: `<template>` — 위치 섹션에 `DetailLocationGuide` 추가**

`SectionBlock heading="위치·로드뷰"`(line 141-163) 내부, 로드뷰 `<div class="h-[220px]">` **아래**에 추가(redesigned만):
```vue
<DetailLocationGuide
  v-if="isRedesigned"
  class="mt-4"
  :stations="transitData?.stations ?? []"
  :alternatives="nearbyFiltered"
  :alternative-label="`가까운 다른 ${categoryMeta.label}`"
/>
```
redesigned일 때 heading을 "위치·길찾기"로 바꾸려면 `:heading="isRedesigned ? '위치·길찾기' : '위치·로드뷰'"`.

- [ ] **Step 5: 빌드 + 린트 검증**

Run: `cd frontend && npm run lint && npm run build`
Expected: 린트·타입·빌드 모두 통과(`DetailSpecGrid`/`DetailLocationGuide` 자동 import 해소, `NearbyStation` 타입 정합).

- [ ] **Step 6: 전체 프론트 테스트 회귀**

Run: `cd frontend && npm run test`
Expected: 전체 PASS. 기존 `DetailBasicInfo.test.ts`/`DetailContextLinks.test.ts` 등은 비대상 경로라 영향 없음. 깨지면 즉시 수정.

- [ ] **Step 7: 실페이지 수동 검증**

dev 서버(`cd backend && npm run dev` + `cd frontend && npm run dev`) 후 실데이터로 확인:
- toilet 상세 한 건(예: `현대백화점 천호지점`) → 헤더 직후 **스펙 그리드**(변기 표·안전/편의·운영/관리, 개보수=정보 없음), 위치 섹션에 **가는 법(천호역 도보 N분) + 가까운 화장실 대안**, intro 산문 없음, 고정 팁/FAQ 없음.
- clothes 상세 한 건 → 스펙 그리드 5행 이하(있는 것만), 슬롭 없음.
- 비대상(예: hospital) 한 건 → **기존과 동일**(회귀 없음), 광고 개수 동일.
- 모바일/데스크톱 둘 다 단일 h1 유지, 광고 슬롯 수 동일.

(실 id는 `docker exec ilsangkit-mysql mysql --default-character-set=utf8mb4 -u ilsangkit -pilsangkit123 ilsangkit -e "SELECT id FROM Toilet WHERE name='현대백화점 천호지점' LIMIT 1"` 로 조회 가능.)

- [ ] **Step 8: Commit**

```bash
git add frontend/pages/[category]/[id].vue
git commit -m "feat(facility-detail): wire toilet/clothes to new ladder (spec grid + location guide + slop removal)"
```

---

## Self-Review (작성자 점검 결과)

**Spec coverage:** 본 Phase 1은 spec §10 롤아웃 Phase 1(프레임워크 + exemplar toilet/clothes) 범위. 스펙 그리드(spec §4.2), 슬롭 제거(spec §5), 위치·길찾기 교통(spec §4.3), intro 삭제(spec §3·§5), FAQ 고유화(spec §4.7)를 포함. **의도적 이월(다음 플랜):** 지역 컨텍스트(area summary, spec §4.4)는 city/district→slug 해석 유틸 확인 필요라 Phase 1B로 분리. provenance 가시화(spec §4.8)는 기존 `DataSourceSection`+`setDetailProvenance`가 이미 충족(이번엔 신규 작업 없음, 회귀만 확인). 나머지 13개 카테고리 + area highlights 확장은 Phase 2.

**Placeholder scan:** Task 6 Step 3의 "기존 광고 wrapper 클래스"는 구현자가 현재 파일에서 1:1 확인해야 하는 지점 — 슬롯 보존 불변식을 깨지 않도록 라인 대조를 명시했다(추정 코드 삽입 금지). 그 외 모든 신규 파일은 완성 코드.

**Type consistency:** `SpecGroup`/`SpecRow`/`SpecTable`(Task 1) → `DetailSpecGrid`(Task 2)에서 동일 import. `NearbyStation`(Task 4) → `DetailLocationGuide`(Task 5)·페이지(Task 6) 동일. `buildSpecGroups`·`fetchTransitNearby`·`generateDynamicTips/FAQ(…, {staticFill})` 시그니처 일치.
