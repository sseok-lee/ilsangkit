# 시설 상세 기본정보·시설현황 섹션 재정렬 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설 상세페이지(14개 카테고리 공용)에서 두 본문 섹션을 기본정보 → 시설현황 순서로 바꾸고, 확정된 필드 오배치(parking·ev-charger)를 교정하며, 기본정보 내부를 핵심→분류→기타(muted) 위계로 정돈한다.

**Architecture:** 순수 프론트엔드 표현 계층 변경. `frontend/pages/[category]/[id].vue`에서 두 컴포넌트 블록 순서를 교환하고(광고 배너는 구조적 구분자로 제자리 유지), `DetailBasicInfo.vue`/`DetailFacilityStatus.vue`/`EvChargerDetail.vue` 템플릿을 수정한다. 백엔드·스키마·동기화 무변경.

**Tech Stack:** Nuxt 3 (SSR) · Vue 3 `<script setup>` · TailwindCSS · Vitest + @vue/test-utils (happy-dom)

## Global Constraints

- **단일 h1 불변** — h1은 `MobileDetailHeader`(모바일)만 소유, 데스크톱 `PageHero`는 `title-tag="div"`. 섹션 헤딩은 `SectionBlock`의 `<h3>`. 이번 작업은 h1·헤딩 위계를 건드리지 않는다.
- **SSR-first / 크롤러 가시성** — 기본정보·시설현황은 SSR 렌더 유지. muted 처리는 **CSS 강등만**(작은 글씨·옅은 색), 텍스트는 SSR HTML에 남긴다. **콘텐츠를 `ClientOnly`로 감싸지 않는다.**
- **광고 슬롯 불변** — `[id].vue`의 `AdBanner` 3개(`fixed rectangle 280`, `compact-mobile` ×2) 개수·위치·variant를 1:1 보존.
- **JSON-LD 불변** — `<head>`의 Facility·Breadcrumb·FAQ·Dataset 발행 로직 무변경.
- **Tailwind order ≤ 12**, 모바일 지도 220px 불변, 멀티루트 class fall-through 주의.
- **Node 20** (`nvm use 20`) 후 작업. lock 파일 삭제·재생성 금지.
- 테스트 명령은 항상 `cd frontend` 후 실행.
- Vue `<script setup>` 함정: 템플릿/맵 콜백에서 top-level ref는 자동 언랩되므로 `x.value` 쓰지 말 것(`.value.value=undefined` 버그).

---

# Phase 1 — 구조 변경 (사용자 핵심 요청 + 확정 감사 수정)

Phase 1만으로 독립적으로 동작·배포 가능. 운영 검증 후 Phase 2 진행 권장.

## Task 1: 섹션 순서 스왑 (기본정보 → 시설현황)

**Files:**
- Modify: `frontend/pages/[category]/[id].vue:116-138`
- Test: `frontend/tests/pages/detail.test.ts:293-303`

**Interfaces:**
- Consumes: 기존 `DetailBasicInfo`·`DetailFacilityStatus` props(변경 없음).
- Produces: 본문 DOM 순서 = 헤더 → 광고 → **기본정보** → 광고 → **시설현황** → 광고 → 지도.

- [ ] **Step 1: 기존 순서 가드 테스트를 새 순서로 뒤집기 (실패하는 테스트 작성)**

`frontend/tests/pages/detail.test.ts`의 L293-303 블록을 아래로 교체한다:

```ts
  // ---------------- 기본정보 우선 (2026-06-30 재정렬) ----------------
  // 기본정보가 시설현황보다 DOM 상 먼저 와야 한다 (모바일=데스크톱 동일, order 미사용).
  it('기본정보가 시설현황보다 먼저 렌더된다', async () => {
    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })
    const html = wrapper.html()
    const basicIdx = html.indexOf('기본정보')
    const statusIdx = html.indexOf('시설현황')
    expect(basicIdx).toBeGreaterThan(-1)
    expect(statusIdx).toBeGreaterThan(-1)
    expect(basicIdx).toBeLessThan(statusIdx)
  })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts -t "기본정보가 시설현황보다 먼저"`
Expected: FAIL — `expected <basicIdx> to be less than <statusIdx>` (현재는 시설현황이 먼저라 basicIdx > statusIdx).

- [ ] **Step 3: `[id].vue`에서 두 블록 순서 교환**

`frontend/pages/[category]/[id].vue`의 L116-138을 아래로 교체한다(광고 3개는 그대로, 컴포넌트 두 개만 위치 교환 + 주석 갱신):

```vue
              <!-- Ad: HERO 아래 -->
              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />

              <!-- T1 BasicInfo (기본정보·운영시간) — 헤더 광고 직후 핵심 정보 우선 -->
              <DetailBasicInfo
                :facility="facility"
                :hospital-operating-hours="hospitalOperatingHours"
                :hospital-weekly-hours="hospitalWeeklyHours"
                :hospital-weekly-hours-count="hospitalWeeklyHours.length"
                :aed-operating-hours="aedOperatingHours"
                :aed-weekly-hours="aedWeeklyHours"
                :aed-weekly-hours-count="aedWeeklyHours.length"
                :pharmacy-weekly-hours="pharmacyWeeklyHours"
              />

              <!-- Ad: 기본정보 ↔ 시설현황 사이 -->
              <AdBanner variant="compact-mobile" />

              <!-- T2 FacilityStatus (시설현황) -->
              <DetailFacilityStatus :facility="facility" />

              <!-- Ad: 시설현황 ↔ MAP 사이 -->
              <AdBanner variant="compact-mobile" />
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts`
Expected: PASS (순서 테스트 통과 + 단일 h1·중복 없음·clothes 빈 시설현황 가드 등 기존 테스트 유지).

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/'[category]'/'[id]'.vue frontend/tests/pages/detail.test.ts
git commit -m "refactor(detail): 기본정보를 시설현황보다 먼저 렌더 (섹션 순서 스왑)"
```

---

## Task 2: parking 주차장 유형(lotType)을 시설현황 → 기본정보로 이동

**Files:**
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue:145-149` (제거)
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue:172-191` (추가)
- Test: `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`, `frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts`

**Interfaces:**
- Consumes: `details.lotType: string | undefined`, `details.parkingType: string | undefined`.
- Produces: parking 상세에서 주차장 유형(lotType)이 기본정보의 주차 구분(parkingType) 옆에 렌더되고, 시설현황 '시설 정보'에는 더 이상 없음.

- [ ] **Step 1: 실패하는 테스트 2개 작성**

`frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`의 `describe` 블록 안에 추가:

```ts
  it('parking: 주차장 유형(lotType)을 기본정보 주차 구분 옆에 표시', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('parking', { parkingType: '공영', lotType: '노외' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('주차장 유형')
    expect(wrapper.text()).toContain('노외')
  })
```

`frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts`의 `describe` 블록 안에 추가:

```ts
  it('parking: 시설현황에 주차장 유형(lotType) 행이 없다', () => {
    const wrapper = mount(DetailFacilityStatus, {
      props: { facility: makeFacility('parking', { lotType: '노외', capacity: 30 }) },
      global: globalConfig,
    })
    const html = wrapper.html()
    expect(html).not.toContain('주차장 유형')
    expect(html).toContain('30') // 주차면수는 그대로 시설현황에 남는다
  })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts tests/components/facility/detail/DetailFacilityStatus.test.ts -t "주차장 유형"`
Expected: FAIL — BasicInfo 쪽은 '주차장 유형' 미발견, FacilityStatus 쪽은 '주차장 유형'이 여전히 발견됨.

- [ ] **Step 3: `DetailFacilityStatus.vue`에서 주차장 유형 행 제거**

`frontend/components/facility/detail/DetailFacilityStatus.vue`의 L145-149 블록을 삭제한다:

```vue
            <div class="flex items-center justify-between">
              <span class="text-sm text-gray-600">주차장 유형</span>
              <span v-if="details?.lotType" class="text-sm font-medium text-slate-900">{{ details?.lotType }}</span>
              <span v-else class="text-sm text-slate-400">정보 없음</span>
            </div>
```

(바로 아래의 '주차면수'(capacity) 행부터가 '시설 정보' 첫 행이 된다.)

- [ ] **Step 4: `DetailBasicInfo.vue` parking 블록에 주차장 유형 행 추가**

`frontend/components/facility/detail/DetailBasicInfo.vue`의 L172-191 parking `<template>`을 아래로 교체한다(v-if 조건에 `lotType` 추가, 주차 구분 바로 다음에 주차장 유형 행 삽입):

```vue
      <!-- Parking -->
      <template v-if="facility.category === 'parking' && (details?.parkingType || details?.lotType || details?.operatingDays || details?.managingOrg)">
        <div class="h-px bg-slate-100 w-full"></div>
        <div class="flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">주차 구분</span>
            <span v-if="details?.parkingType" class="text-sm font-medium text-slate-900">{{ details?.parkingType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">주차장 유형</span>
            <span v-if="details?.lotType" class="text-sm font-medium text-slate-900">{{ details?.lotType }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">운영요일</span>
            <span v-if="details?.operatingDays" class="text-sm font-medium text-slate-900">{{ details?.operatingDays }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">관리기관</span>
            <span v-if="details?.managingOrg" class="text-sm font-medium text-slate-900">{{ details?.managingOrg }}</span>
            <span v-else class="text-sm text-slate-400">정보 없음</span>
          </div>
        </div>
      </template>
```

- [ ] **Step 5: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts tests/components/facility/detail/DetailFacilityStatus.test.ts`
Expected: PASS (신규 2개 포함 전체 통과).

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/components/facility/detail/DetailFacilityStatus.vue frontend/tests/components/facility/detail/DetailBasicInfo.test.ts frontend/tests/components/facility/detail/DetailFacilityStatus.test.ts
git commit -m "refactor(detail): parking 주차장 유형을 기본정보로 이동 (분류 일관성)"
```

---

## Task 3: ev-charger 운영시간·전화를 기본정보로 노출 + EvChargerDetail 중복 트림

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` (공통 운영시간 행 L26-45, `facilityPhone` computed L614-618)
- Modify: `frontend/pages/[category]/[id].vue` (`facilityPhone` computed L589-593)
- Modify: `frontend/components/facility/details/EvChargerDetail.vue:17-32` (useTime·busiCall `DetailRow` 제거)
- Test: `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`

**Interfaces:**
- Consumes: `details.useTime: string | undefined`, `details.busiCall: string | undefined`.
- Produces: ev-charger 기본정보 공통 행이 `useTime`(운영시간)·`busiCall`(전화)을 표시. `EvChargerDetail`에는 useTime·busiCall 중복 없음. `busiNm`·`year`는 `EvChargerDetail`에 유지.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`의 `describe` 블록 안에 추가:

```ts
  it('ev-charger: useTime을 운영시간으로, busiCall을 전화로 기본정보에 노출', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('ev-charger', { useTime: '24시간', busiCall: '1600-1234' }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('24시간')
    expect(wrapper.html()).toContain('tel:1600-1234')
  })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts -t "ev-charger"`
Expected: FAIL — useTime·busiCall이 기본정보 공통 행에서 읽히지 않아 미노출.

- [ ] **Step 3: `DetailBasicInfo.vue` 공통 운영시간 행이 `useTime`도 읽도록 보정**

`frontend/components/facility/detail/DetailBasicInfo.vue` `<script setup>`에 computed 추가(`isOpen24Hours` 정의 아래, L612 근처):

```ts
// ev-charger 등 operatingHours 미사용 카테고리 폴백 (useTime)
const operatingHoursText = computed(() => {
  const d = details.value as (FacilityDetailsAll & { useTime?: string }) | undefined
  const raw = d?.operatingHours || d?.useTime
  return raw ? formatOperatingHours(raw) : null
})
```

그리고 운영시간 행(L26-45)을 아래로 교체한다(구분선·행 조건과 표시값을 `operatingHoursText` 기준으로):

```vue
      <div v-if="(operatingHoursText || isOpen24Hours || facilityPhone) && !hideOperatingHours" class="h-px bg-slate-100 w-full"></div>

      <!-- Operating Hours (병원·AED는 시설현황 테이블이 있으면 여기서는 숨김) -->
      <div v-if="(operatingHoursText || isOpen24Hours) && !hideOperatingHours" class="flex gap-4 items-start">
        <div class="mt-0.5 text-slate-500">
          <span class="material-symbols-outlined">schedule</span>
        </div>
        <div class="flex flex-col gap-1">
          <div class="flex items-center gap-2 flex-wrap">
            <p class="text-slate-900 text-base font-medium whitespace-pre-line">{{ operatingHoursText || '24시간 운영' }}</p>
            <span v-if="isOpen24Hours" class="flex items-center gap-1 text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
              <span class="relative flex h-2 w-2">
                <span class="animate-pulse absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              운영중
            </span>
          </div>
        </div>
      </div>
```

- [ ] **Step 4: `DetailBasicInfo.vue` `facilityPhone`에 `busiCall` 폴백 추가**

L614-618의 `facilityPhone` computed를 아래로 교체:

```ts
const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll & { phone?: string; clerkTel?: string; crtelno?: string; busiCall?: string }
  return d.phoneNumber || d.phone || d.clerkTel || d.crtelno || d.busiCall || null
})
```

- [ ] **Step 5: `[id].vue` `facilityPhone`에도 `busiCall` 폴백 추가 (모바일 헤더 일관성)**

`frontend/pages/[category]/[id].vue` L589-593을 아래로 교체:

```ts
// 전 카테고리 통합 전화번호
const facilityPhone = computed(() => {
  if (!details.value) return null
  const d = details.value as FacilityDetailsAll & { crtelno?: string; busiCall?: string }
  return d.phoneNumber || d.phone || d.clerkTel || d.crtelno || d.busiCall || null
})
```

- [ ] **Step 6: `EvChargerDetail.vue`에서 useTime·busiCall 중복 제거**

`frontend/components/facility/details/EvChargerDetail.vue`의 L16-32에서 이용시간(useTime)·운영기관 연락처(busiCall) 두 `DetailRow`를 삭제하고 운영기관(busiNm)만 남긴다. L16-37을 아래로 교체:

```vue
    <!-- 충전소 기본 정보 (운영시간·연락처는 기본정보로 이동) -->
    <DetailRow
      v-if="details.busiNm"
      label="운영기관"
      :value="details.busiNm"
    />
    <DetailRow
      v-if="details.year"
      label="설치년도"
      :value="`${details.year}년`"
    />
```

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts tests/pages/detail.test.ts`
Expected: PASS (ev-charger 신규 테스트 + 기존 전부).

- [ ] **Step 8: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/pages/'[category]'/'[id]'.vue frontend/components/facility/details/EvChargerDetail.vue frontend/tests/components/facility/detail/DetailBasicInfo.test.ts
git commit -m "refactor(detail): ev-charger 운영시간·전화를 기본정보로 노출, EvChargerDetail 중복 트림"
```

- [ ] **Step 9: Phase 1 전체 검증 (lint·build·full test)**

Run: `cd frontend && npm run lint && npm run test && npm run build`
Expected: lint 0 error, vitest 전체 PASS, build 성공.

---

# Phase 2 — 기본정보 내부 muted 재정렬 (데클러터)

> Phase 1 운영 검증 후 진행 권장. 순수 시각/위계 정돈(데이터 이동 없음). 모든 텍스트는 SSR HTML에 유지(크롤러 가시성 불변), muted는 CSS 강등만.

## Task 4: 행정·식별 메타데이터를 각 기본정보 블록 하단 muted 그룹으로 정돈

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` (카테고리별 `<template v-if>` 블록)
- Test: `frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`

**Interfaces:**
- Consumes: 각 카테고리 `details` 필드(변경 없음).
- Produces: 각 카테고리 기본정보 블록이 [분류 행들] → [muted '기타 정보' 그룹] 순서. 기타 그룹의 모든 값은 여전히 DOM에 존재(검색봇 가시).

**muted '기타 정보' 패턴 (전 카테고리 공통 적용):** 각 카테고리 블록에서 아래 "기타" 필드들을 묶어, 블록 맨 끝에 다음 컨테이너로 감싼다. 라벨/값을 `text-xs text-slate-400`/`text-xs text-slate-500`로 강등한다.

```vue
        <div class="mt-1 pt-3 border-t border-slate-100">
          <p class="text-xs font-medium text-slate-400 mb-2">기타 정보</p>
          <div class="flex flex-col gap-2">
            <!-- 각 기타 행: -->
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">{{ 라벨 }}</span>
              <span class="text-xs text-slate-500">{{ 값 }}</span>
            </div>
          </div>
        </div>
```

**카테고리별 분류(상단 유지) vs 기타(하단 muted) 매핑** — "기타"로 강등할 필드만 명시. 나머지(핵심·분류)는 현 위치 유지:

| 카테고리 | 기타(muted, 하단) 필드 |
|---|---|
| toilet | 관리기관(managingOrg)·설치일(installDate)·소유구분(ownershipType) — 시설유형은 분류로 상단 유지 |
| wifi | 관리기관(managementAgency)·서비스 제공사(serviceProvider)·설치일(installDate) — 블록 전체가 기타 |
| clothes | 운영기관(providerName)·관리기관(managementAgency) — 상세 위치·수거품목 가이드는 유지 |
| park | 지정일(designatedDate)·관리기관(managingOrg) — 공원유형은 분류 유지 |
| parking | 관리기관(managingOrg) — 주차 구분·주차장 유형·운영요일은 유지 |
| library | 운영기관(operatingOrg) — 도서관유형·운영시간·홈페이지는 유지 |
| aed | 설치기관(org) — CTA·요일표·담당자연락처는 유지 |
| hospital | 설립구분(foundationCdNm)·개설일자(estbDd) — 종별·간호등급·홈페이지·진료시간표는 유지 |
| school | 설립일(foundedDate)·팩스(faxNumber)·시도교육청(sidoEduName)·교육지원청(localEduName) — 분류 그리드·홈페이지는 유지 |
| market | 개설연도(foundedYear) — 시장유형·개설주기·홈페이지는 유지 |
| childcare | 인가일(crcnfmdt)·대표자(crrepname)·팩스(crfaxno)·통학차량(crcargbname)·특이사항(crspec)·데이터기준일(datastdrdt)·휴지기간 — 유형·운영상태·홈페이지는 유지 |
| sports | 업종명(fcobNm) — 시설유형·시설구분·국가대표시설은 분류 유지 |

> pharmacy·ev-charger·trash는 기본정보 기타 필드가 없어 변경 없음.

- [ ] **Step 1: 대표 카테고리(childcare) 회귀 테스트 작성**

`frontend/tests/components/facility/detail/DetailBasicInfo.test.ts`에 추가(기타 값이 DOM에 남아 있는지 + '기타 정보' 라벨 존재):

```ts
  it('childcare: 행정 메타(대표자·팩스)는 muted "기타 정보" 그룹에 남아 SSR에 노출', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('childcare', {
          crtypename: '국공립', crrepname: '홍길동', crfaxno: '02-1-2', crcnfmdt: '20100101',
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('기타 정보')
    expect(wrapper.text()).toContain('국공립')   // 분류 유지
    expect(wrapper.text()).toContain('홍길동')   // 기타지만 DOM 유지(크롤러 가시)
    expect(wrapper.text()).toContain('02-1-2')
  })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/DetailBasicInfo.test.ts -t "기타 정보"`
Expected: FAIL — '기타 정보' 라벨 미존재.

- [ ] **Step 3: 카테고리별로 기타 필드를 muted 그룹으로 이동**

위 매핑표의 각 카테고리 `<template v-if>` 블록에서 "기타" 필드 행들을 블록 맨 끝으로 옮기고 Step 0 패턴 컨테이너로 감싼다. 기존 `formatKoreanDate(...)`·링크(`<a>`)·특수 박스(특이사항·휴지기간)는 포맷/마크업을 보존하되 컨테이너만 muted로 감싼다. 한 카테고리씩 적용하며 매핑표를 체크한다.

- [ ] **Step 4: 카테고리별 SSR 가시성 검증 테스트 추가(school 1건 더)**

```ts
  it('school: 교육청·팩스가 muted 그룹에 남아 SSR에 노출', () => {
    const wrapper = mount(DetailBasicInfo, {
      props: {
        facility: makeFacility('school', {
          schoolLevel: '초등학교', faxNumber: '02-9-9', sidoEduName: '서울시교육청',
        }),
        ...baseProps,
      },
      global: globalConfig,
    })
    expect(wrapper.text()).toContain('초등학교')      // 분류 유지
    expect(wrapper.text()).toContain('서울시교육청')   // 기타 DOM 유지
    expect(wrapper.text()).toContain('02-9-9')
  })
```

- [ ] **Step 5: 전체 테스트·lint·build 검증**

Run: `cd frontend && npm run lint && npm run test && npm run build`
Expected: lint 0, vitest 전체 PASS, build 성공.

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue frontend/tests/components/facility/detail/DetailBasicInfo.test.ts
git commit -m "refactor(detail): 기본정보 행정 메타를 하단 muted '기타 정보' 그룹으로 정돈"
```

---

## Task 5: 라이브 SSR 스모크 검증

**Files:** (검증 전용, 코드 변경 없음)

- [ ] **Step 1: 클린 빌드 환경 준비**

Run: `cd frontend && rm -rf .nuxt .output && npm run dev` (백그라운드). dev 서버 기동 후 진행.

- [ ] **Step 2: 대표 카테고리 SSR HTML 순서·가시성 확인**

각 URL을 `curl -s`로 받아 확인(SSR HTML 기준):
- toilet·hospital·childcare·clothes·ev-charger·parking 상세 1건씩.
- 확인 항목: ① `기본정보` `<h3>`가 `시설현황` `<h3>`보다 먼저 등장 ② muted '기타 정보' 텍스트가 HTML에 존재(크롤러 가시) ③ `<h1>` 정확히 1개 ④ `AdBanner` 슬롯 개수 동일 ⑤ parking에서 '주차장 유형'이 기본정보 영역에 ⑥ ev-charger에서 운영시간·전화가 기본정보 영역에, EvChargerDetail에는 중복 없음.

- [ ] **Step 3: 결과 기록**

확인 결과를 PR 설명에 요약(통과/이슈). 이슈 발견 시 해당 Task로 회귀.

---

## Self-Review (작성자 체크)

**Spec coverage:**
- 섹션 순서 스왑 → Task 1 ✓
- parking lotType 이동 → Task 2 ✓
- ev-charger 운영시간·전화 기본정보 노출 + 트림 → Task 3 ✓
- 기본정보 핵심→분류→기타(muted) 정돈 → Task 4 ✓
- 불변식(단일 h1·SSR·광고·JSON-LD) → Global Constraints + Task 5 검증 ✓
- 경계 9건 현행 유지 → 변경 없음(의도) ✓

**Placeholder scan:** 코드 블록 전부 실제 내용. "TODO/적절히" 없음. Task 4 Step 3은 매핑표로 카테고리별 대상 필드를 완전 명시.

**Type consistency:** `operatingHoursText`(Task 3 신규)·`facilityPhone`(busiCall 폴백)·`lotType`/`parkingType` 명칭이 Task 간 일치. `details` 캐스팅 패턴은 기존 코드와 동일.
