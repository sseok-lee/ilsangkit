# 시설 상세 페이지 — 기본정보/시설현황 재배치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설 상세 페이지의 두 섹션(기본정보, 시설현황)을 "방문 의사결정 vs 시설 상세" 원칙으로 재배치한다. 중복 데이터 제거, 카테고리 메타데이터 일관 정리.

**Architecture:** `DetailBasicInfo.vue` 에 운영시간 표·카테고리 메타 그룹을 통합하고, `DetailFacilityStatus.vue` 에는 시설 규모/구성 데이터만 남긴다. 마크업 패턴(`flex justify-between`, `divide-y` 등)은 기존 그대로 사용 — 비주얼 변경 없이 데이터 위치만 이동. 페이지 레벨의 시간 계산 computed는 그대로 두고 props 흐름만 조정.

**Tech Stack:** Vue 3 SFC, Nuxt 3, TailwindCSS, Vitest + @vue/test-utils, ESLint.

**Spec:** `docs/superpowers/specs/2026-05-12-facility-detail-section-reorganize-design.md`

---

## File Structure

**Files modified throughout this plan:**

- `frontend/components/facility/detail/DetailBasicInfo.vue` — 책임: 방문 의사결정 정보(주소·시간·연락처·카테고리 메타). 모든 카테고리 메타 블록을 받는다.
- `frontend/components/facility/detail/DetailFacilityStatus.vue` — 책임: 시설 구성/규모 데이터만. 카테고리 메타는 모두 제거.
- `frontend/pages/[category]/[id].vue` — 페이지 컴포지션. `DetailBasicInfo` 에 `hospitalWeeklyHours`, `aedWeeklyHours` props 추가. 미사용 props 정리.
- `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts` — 이동된 항목에 대한 회귀 테스트 추가.

**Files newly created:**
- `frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts` — 시설현황에서 제거된 항목 확인 + 남은 항목 검증.

---

## Task 0: 준비 — 의존성 확인

**Files:**
- Read: `frontend/components/facility/detail/DetailBasicInfo.vue` (전체)
- Read: `frontend/components/facility/detail/DetailFacilityStatus.vue` (전체)
- Read: `frontend/pages/[category]/[id].vue` (props 흐름)

- [ ] **Step 1: Node 20 보장**

Run: `nvm use 20 && cd frontend && node -v`
Expected: `v20.x.x`

- [ ] **Step 2: 작업 시작 전 기존 테스트 베이스라인**

Run: `cd frontend && npm run test -- tests/components/facility/detail/`
Expected: 기존 `DetailBasicInfo.test.ts`, `DetailNearby.test.ts` 모두 PASS

- [ ] **Step 3: 작업 브랜치 생성**

Run: `git checkout -b refactor/facility-detail-section-reorganize`

---

## Task 1: 테스트 스캐폴드 — DetailFacilityStatus 테스트 파일 신설

**Files:**
- Create: `frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts`

- [ ] **Step 1: 테스트 파일 작성**

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailFacilityStatus from '~/components/facility/detail/DetailFacilityStatus.vue'
import type { FacilityDetail, FacilityCategory } from '~/types/facility'

function makeFacility(category: FacilityCategory, details: Record<string, unknown>): FacilityDetail {
  return {
    id: `${category}-1`,
    category,
    name: '테스트 시설',
    address: '서울특별시 강남구 강남대로 100',
    roadAddress: '서울특별시 강남구 강남대로 100',
    lat: 37.5,
    lng: 127.0,
    city: '서울',
    district: '강남구',
    bjdCode: null,
    details: details as FacilityDetail['details'],
    sourceId: 'src-1',
    sourceUrl: null,
    viewCount: 0,
    createdAt: '',
    updatedAt: '',
    syncedAt: '',
  }
}

const globalConfig = {
  stubs: {
    SectionBlock: { template: '<section data-testid="status-section"><slot /></section>' },
    EvChargerDetail: { template: '<div data-testid="ev-charger-detail" />' },
  },
}

describe('DetailFacilityStatus — 카테고리 메타데이터 제거 회귀', () => {
  it('school: 시설현황에 연락처/팩스/홈페이지/교육청 행이 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('school', {
          phoneNumber: '02-111-2222',
          faxNumber: '02-111-3333',
          homepageUrl: 'http://example.kr',
          sidoEduName: '서울시교육청',
          localEduName: '강남교육지원청',
          schoolLevel: '초등학교',
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('02-111-2222')
    expect(html).not.toContain('02-111-3333')
    expect(html).not.toContain('example.kr')
    expect(html).not.toContain('서울시교육청')
    expect(html).not.toContain('강남교육지원청')
  })

  it('park: 시설현황에 공원유형/지정일/관리기관/연락처 행이 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('park', {
          parkType: '근린공원',
          designatedDate: '20100101',
          managingOrg: '구청',
          phoneNumber: '02-222-3333',
          area: 1000,
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('근린공원')
    expect(html).not.toContain('02-222-3333')
    expect(html).not.toContain('구청')
    // 면적은 남는다
    expect(html).toContain('1,000')
  })

  it('pharmacy: pharmacistCnt 있으면 시설현황 노출', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('pharmacy', { pharmacistCnt: 3 }),
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('약사')
    expect(wrapper.text()).toContain('3')
  })

  it('hospital: 시설현황에 요일별 진료시간 표/홈페이지가 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('hospital', {
          trmtMonStart: '0900',
          trmtMonEnd: '1800',
          homepage: 'http://hospital.example',
          drTotCnt: 5,
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('요일별 진료시간')
    expect(html).not.toContain('hospital.example')
    // 의료진은 남는다
    expect(html).toContain('의료진')
  })

  it('aed: 시설현황에 요일별 이용시간 표/담당자 연락처가 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: {
        facility: makeFacility('aed', {
          monSttTme: '0900',
          monEndTme: '1800',
          clerkTel: '010-1111-2222',
          buildPlace: '1층 로비',
          mfg: 'CU',
        }),
      },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('요일별 이용시간')
    expect(html).not.toContain('010-1111-2222')
    // 설치위치/제조사는 남는다
    expect(html).toContain('1층 로비')
    expect(html).toContain('CU')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailFacilityStatus.test.ts`
Expected: 5개 케이스 모두 FAIL (현재는 시설현황에 이 항목들이 들어 있음)

- [ ] **Step 3: 커밋 — 테스트만**

```bash
git add frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts
git commit -m "test(facility-detail): add regression tests for FacilityStatus metadata removal"
```

---

## Task 2: toilet — 소유구분(ownershipType) 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` (toilet 블록에 ownershipType 행 추가)
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue` (ownershipType 행 제거)

- [ ] **Step 1: BasicInfo — toilet 메타 블록에 `소유구분` 추가**

`DetailBasicInfo.vue` 의 toilet 블록(현재 `시설유형/개방시간/관리기관/설치일` 4행 그리드) 끝에 추가:

```vue
<div class="flex items-center justify-between">
  <span class="text-sm text-gray-600">소유구분</span>
  <span v-if="details?.ownershipType" class="text-sm font-medium text-slate-900">{{ details?.ownershipType }}</span>
  <span v-else class="text-sm text-slate-400">정보 없음</span>
</div>
```

조건절도 업데이트: `v-if="facility.category === 'toilet' && (details?.facilityType || details?.openTime || details?.managingOrg || details?.installDate || details?.ownershipType)"`

- [ ] **Step 2: FacilityStatus — ownershipType 행 제거**

`DetailFacilityStatus.vue` 의 다음 블록 삭제:

```vue
<div v-if="details?.ownershipType" :class="[hasGridContent ? 'mt-5 border-t border-slate-100 pt-5' : '', 'flex flex-col gap-3']">
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">소유구분</span>
    <span class="text-sm font-medium text-slate-900">{{ details?.ownershipType }}</span>
  </div>
</div>
```

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npm run test -- tests/components/facility/detail/`
Expected: 기존 테스트 PASS (toilet 관련 회귀 없음)

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move toilet ownershipType to BasicInfo"
```

---

## Task 3: AED — 요일별 이용시간 표 + 담당자 연락처 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`
- Modify: `frontend/pages/[category]/[id].vue`

- [ ] **Step 1: 페이지 — `DetailBasicInfo` 에 `aedWeeklyHours` props 추가**

`frontend/pages/[category]/[id].vue` 의 `DetailBasicInfo` 사용처:

변경 전:
```vue
<DetailBasicInfo
  :facility="facility"
  :hospital-operating-hours="hospitalOperatingHours"
  :hospital-weekly-hours-count="hospitalWeeklyHours.length"
  :aed-operating-hours="aedOperatingHours"
  :aed-weekly-hours-count="aedWeeklyHours.length"
  :pharmacy-operating-hours="pharmacyOperatingHours"
/>
```

변경 후:
```vue
<DetailBasicInfo
  :facility="facility"
  :hospital-operating-hours="hospitalOperatingHours"
  :hospital-weekly-hours="hospitalWeeklyHours"
  :hospital-weekly-hours-count="hospitalWeeklyHours.length"
  :aed-operating-hours="aedOperatingHours"
  :aed-weekly-hours="aedWeeklyHours"
  :aed-weekly-hours-count="aedWeeklyHours.length"
  :pharmacy-operating-hours="pharmacyOperatingHours"
/>
```

- [ ] **Step 2: BasicInfo — props 시그니처 확장**

`DetailBasicInfo.vue` 의 `defineProps`:

```ts
const props = defineProps<{
  facility: FacilityDetail
  hospitalOperatingHours: Array<{ day: string; time: string }>
  hospitalWeeklyHours: Array<{ day: string; time: string; lunch: string; closed: boolean; isToday: boolean }>
  hospitalWeeklyHoursCount: number
  aedOperatingHours: Array<{ day: string; time: string }>
  aedWeeklyHours: Array<{ day: string; time: string; allDay: boolean; closed: boolean; isToday: boolean }>
  aedWeeklyHoursCount: number
  pharmacyOperatingHours: Array<{ day: string; time: string }>
}>()
```

- [ ] **Step 3: BasicInfo — AED 블록에 요일별 표·담당자 연락처 추가**

현재 AED 블록(119 신고 버튼 + 설치기관 + 단순 운영시간) 마지막 단순 운영시간(`aedOperatingHours` 사용 부분)을 다음으로 교체:

```vue
<!-- AED 요일별 이용시간 표 -->
<template v-if="aedWeeklyHours.length > 0">
  <div class="h-px bg-slate-100 w-full"></div>
  <div>
    <h3 class="text-sm font-bold text-slate-900 mb-3">요일별 이용시간</h3>
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="bg-slate-50">
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium w-12">요일</th>
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">이용시간</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="row in aedWeeklyHours" :key="row.day"
            :class="row.isToday ? 'bg-blue-50 font-semibold' : ''">
          <td class="py-1.5 px-2 text-xs font-medium" :class="row.isToday ? 'text-blue-700' : 'text-slate-600'">
            {{ row.day }}{{ row.isToday ? ' ★' : '' }}
          </td>
          <td class="py-1.5 px-2 text-xs" :class="row.allDay ? 'text-green-600 font-medium' : row.closed ? 'text-gray-400' : 'text-slate-800'">
            {{ row.time }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<!-- AED 담당자 연락처 -->
<template v-if="(details as any)?.clerkTel">
  <div class="h-px bg-slate-100 w-full"></div>
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">담당자 연락처</span>
    <a :href="`tel:${(details as any).clerkTel}`" class="text-sm font-medium text-primary hover:underline">{{ (details as any).clerkTel }}</a>
  </div>
</template>
```

기존 `aedOperatingHours.length > 0 && aedWeeklyHoursCount === 0` fallback 블록은 그대로 유지 (요일별 표 없을 때 단순 시간 노출).

- [ ] **Step 4: FacilityStatus — AED 요일별 표 + 담당자 연락처 제거**

`DetailFacilityStatus.vue` 에서 다음 두 블록 삭제:

```vue
<!-- AED Operating Hours -->
<div v-if="aedWeeklyHours.length > 0" class="mt-5 border-t border-slate-100 pt-5">
  <h3 class="text-sm font-bold text-slate-900 mb-3">요일별 이용시간</h3>
  <table ...>...</table>
</div>

<!-- AED Manager Contact -->
<div v-if="details?.clerkTel" class="mt-5 border-t border-slate-100 pt-5">
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">담당자 연락처</span>
    <a :href="`tel:${details.clerkTel}`" ...>{{ details.clerkTel }}</a>
  </div>
</div>
```

남길 블록: 설치위치/제조사/모델 행.

- [ ] **Step 5: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: AED 관련 신규 테스트 PASS, 기존 PASS

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue frontend/pages/[category]/[id].vue
git commit -m "refactor(facility-detail): move AED weekly hours table and clerkTel to BasicInfo"
```

---

## Task 4: Hospital — 요일별 진료시간 표 + 홈페이지 통합

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — Hospital 블록에 요일별 진료시간 표 추가**

현재 BasicInfo의 hospital 단순 운영시간(`hospitalOperatingHours.length > 0 && hospitalWeeklyHoursCount === 0`)을 fallback으로 유지하고, 위쪽에 요일별 표를 추가. hospital 메타(종별/설립구분/간호등급/홈페이지/개설일자) 블록 바로 다음:

```vue
<!-- Hospital 요일별 진료시간 표 -->
<template v-if="hospitalWeeklyHours.length > 0">
  <div class="h-px bg-slate-100 w-full"></div>
  <div>
    <h3 class="text-sm font-bold text-slate-900 mb-3">요일별 진료시간</h3>
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="bg-slate-50">
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium w-12">요일</th>
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">진료시간</th>
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">점심</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr v-for="row in hospitalWeeklyHours" :key="row.day"
            :class="row.isToday ? 'bg-blue-50 font-semibold' : ''">
          <td class="py-1.5 px-2 text-xs font-medium" :class="row.isToday ? 'text-blue-700' : 'text-slate-600'">
            {{ row.day }}{{ row.isToday ? ' ★' : '' }}
          </td>
          <td class="py-1.5 px-2 text-xs" :class="row.closed ? 'text-gray-400' : 'text-slate-800'">
            {{ row.time }}
          </td>
          <td class="py-1.5 px-2 text-xs text-gray-500">{{ row.lunch }}</td>
        </tr>
      </tbody>
    </table>
    <p v-if="(details as any)?.noTrmtSun" class="mt-2 text-xs text-gray-500">
      <span class="font-medium">일요일 안내:</span> {{ (details as any).noTrmtSun }}
    </p>
    <p v-if="(details as any)?.noTrmtHoli" class="text-xs text-gray-500">
      <span class="font-medium">공휴일 안내:</span> {{ (details as any).noTrmtHoli }}
    </p>
  </div>
</template>
```

- [ ] **Step 2: FacilityStatus — Hospital 요일별 표 + 홈페이지 제거**

`DetailFacilityStatus.vue` 에서 다음 두 블록 삭제:

```vue
<!-- Hospital Operating Hours Table -->
<div v-if="hospitalWeeklyHours.length > 0" ...>
  <h3 ...>요일별 진료시간</h3>
  <table>...</table>
</div>

<!-- Hospital Homepage -->
<div v-if="details?.homepage" class="mt-5 border-t border-slate-100 pt-5">
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">홈페이지</span>
    <a :href="..." ...>바로가기 →</a>
  </div>
</div>
```

남길 블록: 의료진 현황, 진료과목, 병상 정보, 주차정보.

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: hospital 관련 회귀 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move hospital weekly hours and homepage to BasicInfo"
```

---

## Task 5: Pharmacy — 약사 수 이동 + 시설현황 활성화

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — Pharmacy 블록에서 약사 수 행 제거**

`DetailBasicInfo.vue` 의 다음 블록 삭제:

```vue
<template v-if="details?.pharmacistCnt && details.pharmacistCnt > 0">
  <div class="h-px bg-slate-100 w-full"></div>
  <div class="flex items-center justify-between">
    <span class="text-sm text-gray-600">약사 수</span>
    <span class="text-sm font-bold text-slate-900">{{ details.pharmacistCnt }}명</span>
  </div>
</template>
```

(응급전화 행과 요일별 운영시간은 BasicInfo에 그대로 둔다)

- [ ] **Step 2: FacilityStatus — `hasFacilityStatus`에서 pharmacy 제외 해제**

변경 전:
```ts
const hasFacilityStatus = computed(() => {
  if (!props.facility?.details) return false
  const cat = props.facility.category
  if (['pharmacy', 'clothes', 'trash'].includes(cat)) return false
  return true
})
```

변경 후:
```ts
const hasFacilityStatus = computed(() => {
  if (!props.facility?.details) return false
  const cat = props.facility.category
  if (['clothes', 'trash'].includes(cat)) return false
  if (cat === 'pharmacy') {
    const d = props.facility.details as Record<string, unknown>
    return typeof d.pharmacistCnt === 'number' && d.pharmacistCnt > 0
  }
  return true
})
```

- [ ] **Step 3: FacilityStatus — pharmacy 섹션 마크업 추가**

`<template v-if="facility.category === 'pharmacy'">` 블록을 ev-charger 블록 근처에 신설:

```vue
<!-- Pharmacy Details -->
<template v-if="facility.category === 'pharmacy'">
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">약사 수</span>
      <span v-if="(details as any)?.pharmacistCnt" class="text-sm font-bold text-slate-900">{{ (details as any).pharmacistCnt }}명</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
  </div>
</template>
```

`hasGridContent` 도 pharmacy일 때 false 유지(이미 그러함).

- [ ] **Step 4: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: pharmacy 회귀 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move pharmacistCnt to FacilityStatus and enable for pharmacy"
```

---

## Task 6: Park — 메타데이터 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — Park 메타 블록 신설**

기존 categories(hospital, pharmacy 등) 다음 위치에 추가:

```vue
<!-- Park -->
<template v-if="facility.category === 'park' && ((details as any)?.parkType || (details as any)?.designatedDate || (details as any)?.managingOrg || (details as any)?.phoneNumber)">
  <div class="h-px bg-slate-100 w-full"></div>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">공원유형</span>
      <span v-if="(details as any)?.parkType" class="text-sm font-medium text-slate-900">{{ (details as any).parkType }}</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">지정일</span>
      <span v-if="(details as any)?.designatedDate" class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).designatedDate) }}</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">관리기관</span>
      <span v-if="(details as any)?.managingOrg" class="text-sm font-medium text-slate-900">{{ (details as any).managingOrg }}</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
  </div>
  <template v-if="(details as any)?.phoneNumber">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex gap-4 items-center">
      <div class="text-slate-500"><span class="material-symbols-outlined">call</span></div>
      <a :href="`tel:${(details as any).phoneNumber}`" class="text-primary text-base font-medium hover:underline">{{ (details as any).phoneNumber }}</a>
    </div>
  </template>
</template>
```

(단, 공통 phone 블록이 이미 `phoneNumber/phone/clerkTel` 통합 처리 — park 별도 연락처 행은 중복이 될 수 있다. 확인 결과: `facilityPhone` 이 `phoneNumber` 를 잡으므로 위 phone 블록 추가는 **제거**하고 카테고리 메타 그룹만 추가)

수정안:
```vue
<!-- Park -->
<template v-if="facility.category === 'park' && ((details as any)?.parkType || (details as any)?.designatedDate || (details as any)?.managingOrg)">
  <div class="h-px bg-slate-100 w-full"></div>
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">공원유형</span>
      <span v-if="(details as any)?.parkType" class="text-sm font-medium text-slate-900">{{ (details as any).parkType }}</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">지정일</span>
      <span v-if="(details as any)?.designatedDate" class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).designatedDate) }}</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">관리기관</span>
      <span v-if="(details as any)?.managingOrg" class="text-sm font-medium text-slate-900">{{ (details as any).managingOrg }}</span>
      <span v-else class="text-sm text-slate-400">정보 없음</span>
    </div>
  </div>
</template>
```

- [ ] **Step 2: BasicInfo — `formatKoreanDate` 가 이미 존재하는지 확인**

`DetailBasicInfo.vue` 의 `<script setup>` 에 `formatKoreanDate` 함수가 이미 있음 (hospital `estbDd` 용). 재사용 가능 — 추가 작업 없음.

- [ ] **Step 3: FacilityStatus — Park 메타 블록 제거**

`DetailFacilityStatus.vue` 의 Park `<template>` 에서 다음 부분을 삭제하고 면적·보유 시설만 남김:

삭제:
```vue
<div v-if="details?.parkType" class="grid grid-cols-2 gap-2">
  <div class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
    <span class="text-xs text-gray-600">공원유형</span>
    <span class="text-sm font-bold text-slate-900">{{ details.parkType }}</span>
  </div>
</div>
```
```vue
<div class="flex items-center justify-between">
  <span class="text-sm text-gray-600">지정일</span>
  <span v-if="details?.designatedDate" ...>{{ formatKoreanDate(details.designatedDate) }}</span>
  <span v-else ...>정보 없음</span>
</div>
<div class="flex items-center justify-between">
  <span class="text-sm text-gray-600">관리기관</span>
  <span v-if="details?.managingOrg" ...>{{ details.managingOrg }}</span>
  <span v-else ...>정보 없음</span>
</div>
<div class="flex items-center justify-between">
  <span class="text-sm text-gray-600">연락처</span>
  <a v-if="details?.phoneNumber" ...>{{ details.phoneNumber }}</a>
  <span v-else ...>정보 없음</span>
</div>
```

Park 블록 결과 골격:
```vue
<template v-if="facility.category === 'park'">
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">면적</span>
      <span v-if="details?.area != null" ...>{{ details.area.toLocaleString() }}㎡ ...</span>
      <span v-else ...>정보 없음</span>
    </div>
  </div>
  <div v-if="parkHasFacilities" class="mt-5 border-t border-slate-100 pt-5">
    <h3 ...>보유 시설</h3>
    ...
  </div>
</template>
```

`formatKoreanDate` 가 FacilityStatus에서 다른 곳에 쓰이는지 확인 (school `foundedDate`, childcare `crcnfmdt`). 다른 곳에서 쓰면 남기고, 안 쓰면 제거.

- [ ] **Step 4: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: park 회귀 테스트 PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move park metadata (type/date/org) to BasicInfo"
```

---

## Task 7: School — 메타데이터 대규모 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — School 메타 블록 신설**

`<script setup>` 끝부분에 helper 추가 (FacilityStatus의 `schoolHomepageUrl` 동일 로직):

```ts
const schoolHomepageUrl = computed(() => {
  const url = (details.value as any)?.homepageUrl || ''
  if (!url) return ''
  if (url.startsWith('http://') || url.startsWith('https://')) return url
  return `http://${url}`
})
```

template에 추가 (Hospital 블록 다음):

```vue
<!-- School -->
<template v-if="facility.category === 'school'">
  <template v-if="(details as any)?.schoolLevel || (details as any)?.foundationType || (details as any)?.coeducationType || (details as any)?.highSchoolType || (details as any)?.branchType || (details as any)?.operationStatus">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="grid grid-cols-2 gap-2">
      <div v-if="(details as any)?.schoolLevel" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">학교급</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).schoolLevel }}</span>
      </div>
      <div v-if="(details as any)?.foundationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">설립형태</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).foundationType }}</span>
      </div>
      <div v-if="(details as any)?.coeducationType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">남녀공학</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).coeducationType }}</span>
      </div>
      <div v-if="(details as any)?.highSchoolType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">고교유형</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).highSchoolType }}</span>
      </div>
      <div v-if="(details as any)?.branchType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">본/분교</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).branchType }}</span>
      </div>
      <div v-if="(details as any)?.operationStatus" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">운영상태</span>
        <span class="text-sm font-bold" :class="(details as any).operationStatus === '운영' ? 'text-green-600' : 'text-slate-900'">{{ (details as any).operationStatus }}</span>
      </div>
    </div>
  </template>
  <template v-if="(details as any)?.foundedDate || (details as any)?.faxNumber">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">설립일</span>
        <span v-if="(details as any)?.foundedDate" class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).foundedDate) }}</span>
        <span v-else class="text-sm text-slate-400">정보 없음</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">팩스</span>
        <span v-if="(details as any)?.faxNumber" class="text-sm font-medium text-slate-900">{{ (details as any).faxNumber }}</span>
        <span v-else class="text-sm text-slate-400">정보 없음</span>
      </div>
    </div>
  </template>
  <template v-if="(details as any)?.homepageUrl">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">홈페이지</span>
      <a :href="schoolHomepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ (details as any).homepageUrl }}</a>
    </div>
  </template>
  <template v-if="(details as any)?.sidoEduName || (details as any)?.localEduName">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">시도교육청</span>
        <span v-if="(details as any)?.sidoEduName" class="text-sm font-medium text-slate-900">{{ (details as any).sidoEduName }}</span>
        <span v-else class="text-sm text-slate-400">정보 없음</span>
      </div>
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-600">교육지원청</span>
        <span v-if="(details as any)?.localEduName" class="text-sm font-medium text-slate-900">{{ (details as any).localEduName }}</span>
        <span v-else class="text-sm text-slate-400">정보 없음</span>
      </div>
    </div>
  </template>
</template>
```

(연락처는 공통 phone 블록의 `phoneNumber` 매칭으로 자동 처리됨)

- [ ] **Step 2: FacilityStatus — School 메타 부분 제거**

`<template v-if="facility.category === 'school'">` 블록에서 다음 부분 모두 삭제:

- 카드 그리드(schoolLevel/foundationType/coeducationType/highSchoolType/branchType/operationStatus)
- 설립일 행, 연락처 행, 팩스 행
- 홈페이지 섹션 전체
- 관할 교육청 섹션 전체

남길 부분: **학급 현황** 섹션과 **계열 정보** 섹션만.

결과:
```vue
<template v-if="facility.category === 'school'">
  <div v-if="schoolEnrollmentRows.length > 0">
    <h3 class="text-sm font-bold text-slate-900 mb-3">학급 현황</h3>
    <div class="grid grid-cols-3 sm:grid-cols-4 gap-2">
      <div v-for="row in schoolEnrollmentRows" :key="row.label" ...>
        ...
      </div>
    </div>
  </div>
  <div v-if="schoolDepartments.length > 0" :class="schoolEnrollmentRows.length > 0 ? 'mt-5 border-t border-slate-100 pt-5' : ''">
    <h3 class="text-sm font-bold text-slate-900 mb-3">계열 정보</h3>
    <div class="flex flex-wrap gap-2">
      <span v-for="dept in schoolDepartments" :key="dept" ...>{{ dept }}</span>
    </div>
  </div>
</template>
```

`schoolHomepageUrl` computed는 FacilityStatus에서 더 이상 안 쓰면 제거.

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: school 회귀 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move school metadata (level/type/contact/edu) to BasicInfo"
```

---

## Task 8: Market — 메타데이터 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — Market 메타 블록 + 헬퍼 추가**

`<script setup>` 에 헬퍼 추가:

```ts
const marketOpeningCycleLabel = computed(() => {
  const cycle = (details.value as any)?.openingCycle || ''
  if (cycle === '매일') return '매일'
  if (/\d/.test(cycle)) {
    const days = cycle.split('+').map((s: string) => s.trim()).filter(Boolean)
    return `매월 ${days.join(', ')}`
  }
  return cycle
})
```

template (School 다음):

```vue
<!-- Market -->
<template v-if="facility.category === 'market'">
  <template v-if="(details as any)?.marketType || (details as any)?.openingCycle">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="grid grid-cols-2 gap-2">
      <div v-if="(details as any)?.marketType" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">시장유형</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).marketType }}</span>
      </div>
      <div v-if="(details as any)?.openingCycle" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">개설주기</span>
        <span class="text-sm font-bold text-slate-900">{{ marketOpeningCycleLabel }}</span>
      </div>
    </div>
  </template>
  <template v-if="(details as any)?.foundedYear != null">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">개설연도</span>
      <span class="text-sm font-medium text-slate-900">{{ (details as any).foundedYear }}년</span>
    </div>
  </template>
  <template v-if="(details as any)?.homepageUrl">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">홈페이지</span>
      <a :href="(details as any).homepageUrl" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ (details as any).homepageUrl }}</a>
    </div>
  </template>
</template>
```

- [ ] **Step 2: FacilityStatus — Market 메타 부분 제거**

`<template v-if="facility.category === 'market'">` 에서 다음을 삭제:

- 시장유형/개설주기 카드 그리드
- 개설연도 행
- 홈페이지 섹션 전체

남길 부분: **점포 수**, **주요 판매품목**, **편의시설** 섹션.

결과:
```vue
<template v-if="facility.category === 'market'">
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">점포 수</span>
      <span v-if="details?.storeCount != null" ...>{{ details.storeCount.toLocaleString() }}개</span>
      <span v-else ...>정보 없음</span>
    </div>
  </div>
  <div v-if="marketProductTags.length" class="mt-5 border-t border-slate-100 pt-5">
    <h3 ...>주요 판매품목</h3>
    ...
  </div>
  <div v-if="details?.hasPublicToilet != null || details?.hasParking != null" class="mt-5 border-t border-slate-100 pt-5">
    <h3 ...>편의시설</h3>
    ...
  </div>
</template>
```

`marketOpeningCycleLabel` computed는 FacilityStatus에서 더 이상 안 쓰면 제거.

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move market metadata (type/cycle/year/homepage) to BasicInfo"
```

---

## Task 9: Childcare — 메타데이터 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — Childcare 메타 블록 추가**

template (Market 다음):

```vue
<!-- Childcare -->
<template v-if="facility.category === 'childcare'">
  <template v-if="(details as any)?.crtypename || (details as any)?.crstatusname">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="grid grid-cols-2 gap-2">
      <div v-if="(details as any)?.crtypename" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">어린이집 유형</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).crtypename }}</span>
      </div>
      <div v-if="(details as any)?.crstatusname" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">운영 상태</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).crstatusname }}</span>
      </div>
    </div>
  </template>
  <template v-if="(details as any)?.crpausebegindt && (details as any)?.crpauseenddt">
    <div class="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
      휴지 기간: {{ (details as any).crpausebegindt }} ~ {{ (details as any).crpauseenddt }}
    </div>
  </template>
  <template v-if="(details as any)?.crcnfmdt || (details as any)?.crrepname || (details as any)?.crfaxno || (details as any)?.crcargbname || (details as any)?.crhome">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex flex-col gap-3">
      <div v-if="(details as any)?.crcnfmdt" class="flex items-center justify-between">
        <span class="text-sm text-gray-600">인가일</span>
        <span class="text-sm font-medium text-slate-900">{{ formatKoreanDate((details as any).crcnfmdt) }}</span>
      </div>
      <div v-if="(details as any)?.crrepname" class="flex items-center justify-between">
        <span class="text-sm text-gray-600">대표자</span>
        <span class="text-sm font-medium text-slate-900">{{ (details as any).crrepname }}</span>
      </div>
      <div v-if="(details as any)?.crfaxno" class="flex items-center justify-between">
        <span class="text-sm text-gray-600">팩스</span>
        <span class="text-sm font-medium text-slate-900">{{ (details as any).crfaxno }}</span>
      </div>
      <div v-if="(details as any)?.crcargbname" class="flex items-center justify-between">
        <span class="text-sm text-gray-600">통학차량</span>
        <span class="text-sm font-medium text-slate-900">{{ (details as any).crcargbname }}</span>
      </div>
      <div v-if="(details as any)?.crhome" class="flex items-center justify-between">
        <span class="text-sm text-gray-600">홈페이지</span>
        <a :href="(details as any).crhome" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline truncate max-w-[200px]">{{ (details as any).crhome }}</a>
      </div>
    </div>
  </template>
  <template v-if="(details as any)?.crspec">
    <div class="h-px bg-slate-100 w-full"></div>
    <div>
      <h3 class="text-sm font-bold text-slate-900 mb-2">특이사항</h3>
      <p class="text-sm text-gray-600 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">{{ (details as any).crspec }}</p>
    </div>
  </template>
  <template v-if="(details as any)?.datastdrdt">
    <div class="h-px bg-slate-100 w-full"></div>
    <p class="text-xs text-[#9ca3af]">데이터 기준일: {{ (details as any).datastdrdt }}</p>
  </template>
</template>
```

(childcare 연락처 `crtelno`는 공통 phone 블록의 `clerkTel` 미스매치 위험 있음 — 확인: `facilityPhone` 은 `phoneNumber || phone || clerkTel` 만 본다. **`crtelno` 도 잡도록 컴퓨티드 확장이 필요**)

페이지 [category]/[id].vue 의 `facilityPhone` computed:
```ts
const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll & { crtelno?: string }
  return d.phoneNumber || d.phone || d.clerkTel || d.crtelno || null
})
```

BasicInfo의 `facilityPhone` computed도 동일하게 확장:
```ts
const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll & { phone?: string; clerkTel?: string; crtelno?: string }
  return d.phoneNumber || d.phone || d.clerkTel || d.crtelno || null
})
```

- [ ] **Step 2: FacilityStatus — Childcare 메타 부분 제거**

`<template v-if="facility.category === 'childcare'">` 에서 다음 삭제:
- 어린이집 유형/운영상태 카드 그리드
- 휴지 기간 알림
- "기본 정보" 테이블(인가일/대표자/연락처/팩스/통학차량/홈페이지) 전체
- 특이사항 섹션
- 데이터 기준일 푸터

남길 부분: **정원·시설 현황**, **가용률 바**, **연령별 반·아동 현황**, **직원 현황**, **교사 경력 분포**.

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue frontend/pages/[category]/[id].vue
git commit -m "refactor(facility-detail): move childcare metadata (type/status/license/contact) to BasicInfo"
```

---

## Task 10: Sports — 메타데이터 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: BasicInfo — Sports 메타 블록 추가**

template (Childcare 다음):

```vue
<!-- Sports -->
<template v-if="facility.category === 'sports'">
  <template v-if="(details as any)?.ftypeNm || (details as any)?.faciGbNm || (details as any)?.nationYn === 'Y'">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="grid grid-cols-2 gap-2">
      <div v-if="(details as any)?.ftypeNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">시설유형</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).ftypeNm }}</span>
      </div>
      <div v-if="(details as any)?.faciGbNm" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">시설구분</span>
        <span class="text-sm font-bold text-slate-900">{{ (details as any).faciGbNm }}</span>
      </div>
      <div v-if="(details as any)?.nationYn === 'Y'" class="flex flex-col items-center justify-center rounded-lg py-2.5 px-2 bg-slate-50">
        <span class="text-xs text-gray-600">국가대표시설</span>
        <span class="text-sm font-bold text-slate-900">Y</span>
      </div>
    </div>
  </template>
  <template v-if="(details as any)?.fcobNm">
    <div class="h-px bg-slate-100 w-full"></div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">업종명</span>
      <span class="text-sm font-medium text-slate-900">{{ (details as any).fcobNm }}</span>
    </div>
  </template>
</template>
```

- [ ] **Step 2: FacilityStatus — Sports 메타 부분 제거**

`<template v-if="facility.category === 'sports'">` 에서 다음 삭제:
- 시설유형/시설구분/국가대표 카드 그리드
- 업종명 행

남길 부분: **시설면적**, **관람석수**.

결과:
```vue
<template v-if="facility.category === 'sports'">
  <div class="flex flex-col gap-3">
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">시설면적</span>
      <span v-if="details?.faciGfa" ...>{{ details.faciGfa }}㎡</span>
      <span v-else ...>정보 없음</span>
    </div>
    <div class="flex items-center justify-between">
      <span class="text-sm text-gray-600">관람석수</span>
      <span v-if="details?.standCptPsnCnt != null" ...>{{ details.standCptPsnCnt.toLocaleString() }}석</span>
      <span v-else ...>정보 없음</span>
    </div>
  </div>
</template>
```

- [ ] **Step 3: 테스트 실행**

Run: `cd frontend && npx vitest run tests/components/facility/detail/`
Expected: 모든 테스트 PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): move sports metadata (ftypeNm/faciGbNm/fcobNm) to BasicInfo"
```

---

## Task 11: 최종 정리 — props 정리, lint, 전체 테스트, 빌드

**Files:**
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue` (미사용 computed 정리)
- Modify: `frontend/pages/[category]/[id].vue` (미사용 props 흐름 정리)

- [ ] **Step 1: FacilityStatus — 미사용 computed 정리**

`DetailFacilityStatus.vue` 에서 다음 computed가 더 이상 template에서 참조되지 않으면 삭제:
- `aedWeeklyHours` (요일별 표가 BasicInfo로 이동됨) → 삭제
- `hospitalWeeklyHours` (마찬가지) → 삭제
- `schoolHomepageUrl` (homepage가 BasicInfo로 이동됨) → 삭제
- `marketOpeningCycleLabel` (BasicInfo로 이동됨) → 삭제

각 computed에 대해 grep으로 확인 후 삭제:

```bash
cd frontend && grep -n "aedWeeklyHours\|hospitalWeeklyHours\|schoolHomepageUrl\|marketOpeningCycleLabel" components/facility/detail/DetailFacilityStatus.vue
```

template에서 참조 없으면 `<script setup>` 에서 해당 const 삭제.

- [ ] **Step 2: 페이지 — props 흐름 검증**

`[category]/[id].vue` 에서 `DetailFacilityStatus` 에 전달하는 props는 `facility` 하나뿐(현재). 추가 정리 없음. `DetailBasicInfo` 의 새 props(`hospitalWeeklyHours`, `aedWeeklyHours`) 전달 확인.

- [ ] **Step 3: 전체 frontend 테스트**

Run: `cd frontend && npm run test`
Expected: 모든 테스트 PASS

- [ ] **Step 4: lint**

Run: `cd frontend && npm run lint`
Expected: 에러 없음. warning 발생 시 수정.

- [ ] **Step 5: 빌드 검증**

Run: `cd frontend && npm run build`
Expected: 빌드 성공. 타입 에러 없음.

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "refactor(facility-detail): drop unused computeds after section reorganize"
```

---

## Task 12: 시각 검수 — 카테고리별 페이지 수동 확인

**목적:** 마크업 회귀(레이아웃 깨짐, 빈 섹션, 중복 표시) 검출.

- [ ] **Step 1: 백엔드+프론트 dev 서버 기동**

Run (백엔드, 백그라운드):
```bash
cd backend && docker compose up -d && npm run dev
```

Run (프론트, 백그라운드):
```bash
cd frontend && npm run dev
```

- [ ] **Step 2: 카테고리별 페이지 점검 체크리스트**

각 카테고리에 대해 한 페이지씩 열어 확인:

| 카테고리 | URL 예시 | 확인 사항 |
|---|---|---|
| toilet | `/toilet/<id>` | 기본정보에 소유구분 표시, 시설현황에 칸수만 |
| wifi | `/wifi/<id>` | 변화 없음 (회귀 확인) |
| clothes | `/clothes/<id>` | 수거 품목 가이드 위치 유지 |
| parking | `/parking/<id>` | 변화 없음 (회귀 확인) |
| library | `/library/<id>` | 변화 없음 (회귀 확인) |
| aed | `/aed/<id>` | 기본정보에 요일별 표·담당자 연락처, 시설현황엔 설치위치/제조사/모델만 |
| hospital | `/hospital/<id>` | 기본정보에 요일별 진료시간 표·홈페이지, 시설현황엔 의료진/진료과목/병상/주차만 |
| pharmacy | `/pharmacy/<id>` | 시설현황 섹션이 보임(약사 수 있을 때), 기본정보에서 약사 수 사라짐 |
| park | `/park/<id>` | 기본정보에 공원유형·지정일·관리기관, 시설현황엔 면적·보유시설만 |
| school | `/school/<id>` | 기본정보에 학교급/설립형태/연락처/홈페이지/교육청, 시설현황엔 학급·계열만 |
| market | `/market/<id>` | 기본정보에 시장유형/개설주기/개설연도/홈페이지, 시설현황엔 점포수/판매품목/편의시설만 |
| childcare | `/childcare/<id>` | 기본정보에 어린이집 유형/대표자/연락처 등, 시설현황엔 정원·반별·직원만 |
| ev-charger | `/ev-charger/<id>` | 변화 없음 (회귀 확인) |
| sports | `/sports/<id>` | 기본정보에 시설유형/구분/업종명, 시설현황엔 시설면적·관람석수만 |

각 페이지에서:
- 빈 섹션이 생기지 않았는지 (예: pharmacy에서 시설현황이 약사 수 없으면 표시되지 않아야 함)
- 데이터가 양쪽 섹션에 동시에 나오지 않는지
- 레이아웃(구분선·간격)이 자연스러운지

- [ ] **Step 3: 모바일 뷰포트 검수**

DevTools 모바일 토글로 같은 페이지 2~3개 확인. 카드 그리드 깨짐 여부.

- [ ] **Step 4: 시각 검수 보고 + 최종 커밋**

만약 검수 중 마크업 미세 조정이 있다면:
```bash
git add frontend/components/facility/detail/
git commit -m "refactor(facility-detail): polish spacing after section reorganize"
```

- [ ] **Step 5: PR 생성**

```bash
git push -u origin refactor/facility-detail-section-reorganize
gh pr create --base develop --head refactor/facility-detail-section-reorganize \
  --title "refactor(facility): 기본정보/시설현황 데이터 재배치 (방문 의사결정 vs 시설 상세)" \
  --body "$(cat <<'EOF'
## Summary

시설 상세 페이지의 두 섹션을 명확한 원칙으로 재배치:

- **기본정보** = 방문 의사결정에 필요한 정보 (주소·시간·연락·운영기관·식별 메타)
- **시설현황** = 시설 구성·규모·설비 데이터

## Changes

- 병원/AED 요일별 운영시간 표를 시설현황 → 기본정보로 이동 (중복 제거)
- school, market, childcare, park, sports의 카테고리 메타데이터를 시설현황 → 기본정보로 이동
- pharmacy 시설현황 활성화 (약사 수만 있는 경우 정상 노출)
- toilet 소유구분, AED 담당자 연락처를 기본정보로 이동
- 미사용 computed 정리

Spec: `docs/superpowers/specs/2026-05-12-facility-detail-section-reorganize-design.md`
EOF
)"
```

---

## Self-Review

- 모든 spec matrix 행이 Task 2–10에 매핑됨 (wifi/clothes/parking/library는 변경 없음 — Task 12 검수에서만 확인)
- "정보 없음" placeholder는 데이터 부재 표시용 UI 문자열이며 plan placeholder가 아님
- Type 일관성: `hospitalWeeklyHours`/`aedWeeklyHours` props 타입을 Task 3, Task 4에서 동일하게 사용
- `formatKoreanDate` 는 BasicInfo에 이미 존재하며 park/school/childcare에서 재사용
- `facilityPhone` 의 `crtelno` 확장은 Task 9에서 BasicInfo와 페이지 모두에 반영
