# 정적 페이지 4종 최신화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** about/contact/privacy/terms 4개 정적 페이지를 정식 카테고리 15종으로 정확히 맞추고, 공용 헤더 컴포넌트 기반 정돈형 디자인으로 리프레시한다.

**Architecture:** 4개 페이지의 중복 헤더 마크업을 `StaticPageHeader.vue` 단일 컴포넌트로 추출(title/lead/updatedAt props). 각 페이지는 본문 섹션만 보유하며, 콘텐츠는 정식 15종 시설 세트(무인민원발급기 제거, 신규 6종 추가)로 통일. 법적 2페이지는 시행일 본문 유지 + 업데이트 배지.

**Tech Stack:** Nuxt 3 + Vue 3 SFC, TailwindCSS, Vitest + @vue/test-utils (happy-dom).

**참조 스펙:** `docs/superpowers/specs/2026-06-01-static-pages-refresh-design.md`

---

## File Structure

- **Create:** `frontend/components/common/StaticPageHeader.vue` — 페이지 상단 헤더(제목 + 리드 + 업데이트 배지)만 담당하는 표현 컴포넌트.
- **Create:** `frontend/tests/components/common/StaticPageHeader.test.ts` — 헤더 컴포넌트 단위 테스트.
- **Modify:** `frontend/pages/about.vue` — 제공정보 15종, 데이터 출처 표 완성, 헤더 적용.
- **Modify:** `frontend/pages/terms.vue` — 제2조 21항목, 헤더 + 배지.
- **Modify:** `frontend/pages/privacy.vue` — 헤더 + 배지.
- **Modify:** `frontend/pages/contact.vue` — 헤더 적용.
- **Create:** `frontend/tests/pages/about.test.ts`, `terms.test.ts`, `privacy.test.ts`, `contact.test.ts` — 페이지 콘텐츠 단언 테스트.

## 정식 카테고리 세트 (모든 페이지 공유)

CATEGORY_META 라벨 기준 (검증: `frontend/types/facility.ts`):

| slug | 라벨 |
|---|---|
| toilet | 공공화장실 |
| trash | 쓰레기 배출정보 |
| wifi | 무료와이파이 |
| clothes | 의류수거함 |
| parking | 공영주차장 |
| aed | 자동심장충격기 |
| library | 공공도서관 |
| hospital | 병원 |
| pharmacy | 약국 |
| park | 공원 |
| school | 학교 |
| market | 전통시장 |
| childcare | 어린이집 |
| ev-charger | 전기차 충전소 |
| sports | 체육시설 |

부동산 6종: 아파트 매매·전월세, 빌라 매매·전월세, 오피스텔 매매·전월세.
**제거:** 무인민원발급기 (모든 페이지). **제외:** subway(지하철역) — `ALL_CATEGORIES` 미포함이므로 나열하지 않음.

---

## Task 1: StaticPageHeader 공용 컴포넌트

**Files:**
- Create: `frontend/components/common/StaticPageHeader.vue`
- Test: `frontend/tests/components/common/StaticPageHeader.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/components/common/StaticPageHeader.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

describe('StaticPageHeader', () => {
  it('renders the title in an h1', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: '일상킷 소개' } })
    const h1 = wrapper.find('h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toBe('일상킷 소개')
  })

  it('renders the lead paragraph when lead prop is given', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T', lead: '한줄 소개입니다.' } })
    expect(wrapper.text()).toContain('한줄 소개입니다.')
  })

  it('does NOT render the update badge when updatedAt is absent', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T' } })
    expect(wrapper.text()).not.toContain('마지막 업데이트')
  })

  it('renders the update badge when updatedAt is given', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T', updatedAt: '2026.06.01' } })
    expect(wrapper.text()).toContain('마지막 업데이트 2026.06.01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/common/StaticPageHeader.test.ts`
Expected: FAIL — cannot resolve `~/components/common/StaticPageHeader.vue` (file does not exist).

- [ ] **Step 3: Write minimal implementation**

```vue
<!-- frontend/components/common/StaticPageHeader.vue -->
<template>
  <header class="mb-5 md:mb-6">
    <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
      {{ title }}
    </h1>
    <p v-if="lead" class="mt-2 text-slate-500 text-sm md:text-base">
      {{ lead }}
    </p>
    <p v-if="updatedAt" class="mt-3">
      <span class="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
        <span aria-hidden="true">📅</span>
        마지막 업데이트 {{ updatedAt }}
      </span>
    </p>
  </header>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  lead?: string
  updatedAt?: string
}>()
</script>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/common/StaticPageHeader.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/common/StaticPageHeader.vue frontend/tests/components/common/StaticPageHeader.test.ts
git commit -m "feat(frontend): add StaticPageHeader component for static pages"
```

---

## Task 2: about.vue — 제공정보 15종 + 데이터 출처 표 완성

**Files:**
- Modify: `frontend/pages/about.vue`
- Test: `frontend/tests/pages/about.test.ts`

데이터 출처 표 최종 행 (검증 출처: 각 sync 스크립트/서비스의 API 상수):

| 데이터명 | 제공기관 | 출처 URL |
|---|---|---|
| 전국공중화장실표준데이터 | 행정안전부 | https://www.data.go.kr/data/15012892/standard.do |
| 행정안전부_생활쓰레기배출정보 조회서비스 | 행정안전부 | https://www.data.go.kr/data/15155080/openapi.do |
| 전국무료와이파이표준데이터 | 행정안전부 | https://www.data.go.kr/data/15013116/standard.do |
| 전국의류수거함표준데이터 | 행정안전부 | https://www.data.go.kr/data/15139214/standard.do |
| 전국공영주차장표준데이터 | 행정안전부 | https://www.data.go.kr/data/15012896/standard.do |
| 자동심장충격기(AED) 설치장소 | 보건복지부 | https://www.data.go.kr/data/15000652/openapi.do |
| 전국공공도서관표준데이터 | 행정안전부 | https://www.data.go.kr/data/15013109/standard.do |
| 건강보험심사평가원_병원정보서비스 | 건강보험심사평가원 | https://www.data.go.kr/data/15001698/openapi.do |
| 건강보험심사평가원_약국정보서비스 | 건강보험심사평가원 | https://www.data.go.kr/data/15000576/openapi.do |
| 전국도시공원정보표준데이터 | 행정안전부 | https://www.data.go.kr/data/15012890/standard.do |
| 전국전통시장표준데이터 | 행정안전부 | https://www.data.go.kr/data/15052837/standard.do |
| 어린이집 정보 | 보건복지부 | https://www.data.go.kr/data/15012913/openapi.do |
| 한국환경공단_전기자동차 충전소 정보 | 환경부(한국환경공단) | https://www.data.go.kr/data/15076352/openapi.do |
| 전국 공공체육시설 정보 | 문화체육관광부 | https://www.data.go.kr/data/15113959/fileData.do |
| 학교기본정보 (NEIS) | 교육부 | https://www.data.go.kr/data/15119844/openapi.do |
| 아파트매매 실거래 자료 | 국토교통부 | https://www.data.go.kr/data/15057511/openapi.do |
| 아파트 전월세 실거래 자료 | 국토교통부 | https://www.data.go.kr/data/15058017/openapi.do |
| 연립다세대 매매/전월세 실거래 자료 | 국토교통부 | https://www.data.go.kr/data/15058038/openapi.do |
| 오피스텔 매매/전월세 실거래 자료 | 국토교통부 | https://www.data.go.kr/data/15058452/openapi.do |

> **무인민원발급기(15154774) 행은 삭제.** 위 표의 신규 8행(병원·약국·공원·전통시장·어린이집·전기차충전소·체육시설·학교) 중 dataset ID가 코드에 명시되지 않은 항목은 Step 1.5에서 data.go.kr 실페이지로 확인 후 확정한다.

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/pages/about.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import AboutPage from '~/pages/about.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn(), setHomeMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

const FACILITY_LABELS = [
  '공공화장실', '쓰레기', '무료와이파이', '의류수거함', '공영주차장',
  '자동심장충격기', '공공도서관', '병원', '약국',
  '공원', '학교', '전통시장', '어린이집', '전기차 충전소', '체육시설',
]

describe('About Page', () => {
  it('renders the page title via StaticPageHeader', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.find('h1').text()).toContain('일상킷 소개')
  })

  it('lists all 15 facility categories', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    for (const label of FACILITY_LABELS) {
      expect(text, `expected about page to mention "${label}"`).toContain(label)
    }
  })

  it('does NOT mention the removed 무인민원발급기 category', async () => {
    const wrapper = await mountSuspended(AboutPage)
    expect(wrapper.text()).not.toContain('무인민원')
  })

  it('data-source section includes hospital, pharmacy and new categories', async () => {
    const wrapper = await mountSuspended(AboutPage)
    const text = wrapper.text()
    expect(text).toContain('병원정보서비스')
    expect(text).toContain('약국정보서비스')
    expect(text).toContain('도시공원')
    expect(text).toContain('전통시장')
    expect(text).toContain('체육시설')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/pages/about.test.ts`
Expected: FAIL — `무인민원` still present, new labels (공원/학교/전통시장/어린이집/전기차 충전소/체육시설) absent, data-source names absent.

- [ ] **Step 1.5: Verify new dataset URLs/agencies (real action)**

For each of the 8 new/added rows, open the data.go.kr URL listed in the table above in a browser (or `WebFetch`) and confirm the official 데이터명 and 제공기관. If a dataset ID/URL differs, correct that row in the table and in the `about.vue` edit below. Do not leave an unresolved link.
Confidence note for the implementer: hospital(15001698) and pharmacy(15000576) IDs are confirmed in `backend/src/scripts/syncHospital.ts:349` and `syncPharmacy.ts:337`. The other 6 IDs are best-known and MUST be confirmed here.

- [ ] **Step 3: Edit about.vue — replace 제공 정보 list**

Replace the entire `<section>` containing `제공 정보` (currently the 13-item `<ul>`) with a grouped list of the 15 facilities + real estate. New section body:

```html
<section>
  <h2 class="text-lg font-semibold text-slate-900 mb-3">
    제공 정보
  </h2>
  <p class="mb-4">
    일상킷은 부동산 실거래가와 전국 생활시설 15종의 정보를 카테고리별로 제공합니다.
  </p>
  <ul class="list-disc pl-5 space-y-2">
    <li><strong class="text-slate-900">공공화장실</strong> — 전국 공공화장실의 위치, 운영 시간, 장애인 시설 여부 등을 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">쓰레기 배출정보</strong> — 지역별 생활쓰레기 배출 요일, 시간, 방법을 안내합니다.</li>
    <li><strong class="text-slate-900">무료와이파이</strong> — 공공 무료 와이파이 설치 장소와 이용 정보를 제공합니다.</li>
    <li><strong class="text-slate-900">의류수거함</strong> — 주변 의류수거함의 위치를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">공영주차장</strong> — 전국 공영주차장의 위치, 요금, 운영 시간 등을 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">자동심장충격기(AED)</strong> — 주변 자동심장충격기(AED) 설치 위치를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">공공도서관</strong> — 전국 공공도서관의 위치와 운영 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">병원</strong> — 전국 병원의 위치, 진료과목, 운영 시간 등을 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">약국</strong> — 전국 약국의 위치와 운영 시간을 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">공원</strong> — 전국 도시공원의 위치와 종류, 면적 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">학교</strong> — 전국 학교의 위치와 기본 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">전통시장</strong> — 전국 전통시장의 위치와 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">어린이집</strong> — 전국 어린이집의 위치와 운영 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">전기차 충전소</strong> — 전국 전기차 충전소의 위치와 충전기 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">체육시설</strong> — 전국 공공체육시설의 위치와 종목 정보를 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">아파트 실거래가</strong> — 전국 아파트 매매·전월세 실거래가를 지역별, 단지별로 조회할 수 있습니다.</li>
    <li><strong class="text-slate-900">빌라 실거래가</strong> — 전국 연립다세대(빌라) 매매·전월세 실거래가를 지역별로 확인할 수 있습니다.</li>
    <li><strong class="text-slate-900">오피스텔 실거래가</strong> — 전국 오피스텔 매매·전월세 실거래가를 지역별, 건물별로 조회할 수 있습니다.</li>
  </ul>
</section>
```

- [ ] **Step 4: Edit about.vue — fix data-source table rows**

In the `<section id="data-sources">` table `<tbody>`: (a) delete the `<tr>` row for `행정안전부_무인민원발급기정보 조회서비스`, (b) add the 8 new `<tr>` rows. Each row matches this shape (example for 병원):

```html
<tr>
  <td class="py-2 pr-4">건강보험심사평가원_병원정보서비스</td>
  <td class="py-2 pr-4">건강보험심사평가원</td>
  <td class="py-2">
    <a href="https://www.data.go.kr/data/15001698/openapi.do" target="_blank" rel="noopener noreferrer" class="text-primary hover:text-primary">공공데이터포털</a>
  </td>
</tr>
```

Add rows (데이터명 / 제공기관 / URL) for: 병원(위 예시), 약국(15000576), 공원(도시공원, 행정안전부), 전통시장(행정안전부), 어린이집(보건복지부), 전기차 충전소(환경부(한국환경공단)), 체육시설(문화체육관광부), 학교기본정보(교육부) — URL은 Step 1.5에서 확정한 값 사용. 부동산 4행은 기존 유지.

- [ ] **Step 5: Edit about.vue — apply StaticPageHeader**

Replace the top `<h1 class="text-2xl md:text-3xl font-bold text-slate-900 mb-5 md:mb-6">일상킷 소개</h1>` with:

```html
<StaticPageHeader
  title="일상킷 소개"
  lead="부동산 실거래가와 내 주변 생활시설을 한곳에서."
/>
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/pages/about.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add frontend/pages/about.vue frontend/tests/pages/about.test.ts
git commit -m "feat(frontend): update about page to 15 facility categories and complete data-source table"
```

---

## Task 3: terms.vue — 제2조 21항목

**Files:**
- Modify: `frontend/pages/terms.vue`
- Test: `frontend/tests/pages/terms.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/pages/terms.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import TermsPage from '~/pages/terms.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(component) }) } }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

describe('Terms Page', () => {
  it('lists the new facility categories in 제2조', async () => {
    const wrapper = await mountSuspended(TermsPage)
    const text = wrapper.text()
    for (const label of ['공원', '학교', '전통시장', '어린이집', '전기차 충전소', '체육시설']) {
      expect(text, `expected terms 제2조 to include "${label}"`).toContain(label)
    }
  })

  it('does NOT mention 무인민원발급기', async () => {
    const wrapper = await mountSuspended(TermsPage)
    expect(wrapper.text()).not.toContain('무인민원')
  })

  it('keeps the original effective date 2026년 3월 14일', async () => {
    const wrapper = await mountSuspended(TermsPage)
    expect(wrapper.text()).toContain('2026년 3월 14일')
  })

  it('shows the last-updated badge 2026.06.01', async () => {
    const wrapper = await mountSuspended(TermsPage)
    expect(wrapper.text()).toContain('마지막 업데이트 2026.06.01')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/pages/terms.test.ts`
Expected: FAIL — new labels absent, `무인민원` present, badge absent.

- [ ] **Step 3: Edit terms.vue — replace 제2조 `<ul>`**

Replace the `<ul>` inside 제2조 (서비스의 내용) with the full 21-item list (부동산 6 + 시설 15, 무인민원 제거):

```html
<ul class="list-disc pl-5 mt-2 space-y-1">
  <li>아파트 매매 실거래가 조회</li>
  <li>아파트 전월세 실거래가 조회</li>
  <li>빌라(연립다세대) 매매 실거래가 조회</li>
  <li>빌라(연립다세대) 전월세 실거래가 조회</li>
  <li>오피스텔 매매 실거래가 조회</li>
  <li>오피스텔 전월세 실거래가 조회</li>
  <li>공공화장실 위치 및 운영 정보</li>
  <li>생활쓰레기 배출 일정 및 방법</li>
  <li>무료 와이파이 위치 정보</li>
  <li>의류수거함 위치 정보</li>
  <li>공영주차장 위치 및 운영 정보</li>
  <li>자동심장충격기(AED) 설치 위치 정보</li>
  <li>공공도서관 위치 및 운영 정보</li>
  <li>병원 위치 및 진료 정보</li>
  <li>약국 위치 및 운영 정보</li>
  <li>공원 위치 및 정보</li>
  <li>학교 위치 및 기본 정보</li>
  <li>전통시장 위치 및 정보</li>
  <li>어린이집 위치 및 운영 정보</li>
  <li>전기차 충전소 위치 및 충전기 정보</li>
  <li>체육시설 위치 및 종목 정보</li>
</ul>
```

- [ ] **Step 4: Edit terms.vue — apply StaticPageHeader with badge**

Replace the top `<h1 ...>이용약관</h1>` with:

```html
<StaticPageHeader
  title="이용약관"
  lead="일상킷 서비스 이용 조건과 절차를 규정합니다."
  updated-at="2026.06.01"
/>
```

Leave 부칙 `이 약관은 2026년 3월 14일부터 시행합니다.` unchanged.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/pages/terms.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add frontend/pages/terms.vue frontend/tests/pages/terms.test.ts
git commit -m "feat(frontend): update terms 제2조 to 21 services and add update badge"
```

---

## Task 4: privacy.vue — 헤더 + 배지

**Files:**
- Modify: `frontend/pages/privacy.vue`
- Test: `frontend/tests/pages/privacy.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/pages/privacy.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import PrivacyPage from '~/pages/privacy.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(component) }) } }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

describe('Privacy Page', () => {
  it('renders the title via StaticPageHeader', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    expect(wrapper.find('h1').text()).toContain('개인정보처리방침')
  })

  it('shows the last-updated badge 2026.06.01', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    expect(wrapper.text()).toContain('마지막 업데이트 2026.06.01')
  })

  it('keeps the original effective date 2026년 3월 14일', async () => {
    const wrapper = await mountSuspended(PrivacyPage)
    expect(wrapper.text()).toContain('2026년 3월 14일')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/pages/privacy.test.ts`
Expected: FAIL — badge absent (h1 text may already pass, badge assertion fails).

- [ ] **Step 3: Edit privacy.vue — apply StaticPageHeader with badge**

Replace the top `<h1 ...>개인정보처리방침</h1>` with:

```html
<StaticPageHeader
  title="개인정보처리방침"
  lead="일상킷이 개인정보를 어떻게 처리하는지 안내합니다."
  updated-at="2026.06.01"
/>
```

Leave 제9조의 `2026년 3월 14일부터 적용됩니다` unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/pages/privacy.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/privacy.vue frontend/tests/pages/privacy.test.ts
git commit -m "feat(frontend): refresh privacy page header with update badge"
```

---

## Task 5: contact.vue — 헤더 적용

**Files:**
- Modify: `frontend/pages/contact.vue`
- Test: `frontend/tests/pages/contact.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/pages/contact.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import ContactPage from '~/pages/contact.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(component) }) } }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' } } } },
  )
  await flushPromises()
  return wrapper
}

describe('Contact Page', () => {
  it('renders the title via StaticPageHeader', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.find('h1').text()).toContain('문의하기')
  })

  it('renders the contact email', async () => {
    const wrapper = await mountSuspended(ContactPage)
    expect(wrapper.text()).toContain('contact@ilsangkit.co.kr')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/pages/contact.test.ts`
Expected: FAIL — `StaticPageHeader` not yet used so `h1` resolves to existing `<h1>` (this test passes for h1) BUT the test file imports the component to register it; the real failure is the page still uses a raw `<h1>`. Note: if both assertions pass before the edit, still proceed to Step 3 to apply the consistent header. (Adjust: the h1 assertion holds either way; the edit standardizes markup.)

> Implementer note: contact.vue has no content change — this task only standardizes the header for visual consistency. If both assertions already pass, treat Step 3 as a refactor and verify the test still passes after.

- [ ] **Step 3: Edit contact.vue — apply StaticPageHeader**

Replace the top `<h1 ...>문의하기</h1>` with:

```html
<StaticPageHeader
  title="문의하기"
  lead="문의·데이터 오류 신고·제휴 제안을 받습니다."
/>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/pages/contact.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/contact.vue frontend/tests/pages/contact.test.ts
git commit -m "feat(frontend): standardize contact page header via StaticPageHeader"
```

---

## Task 6: 전체 검증 (test + lint)

**Files:** none (verification only)

- [ ] **Step 1: Run the full frontend test suite**

Run: `cd frontend && npm run test`
Expected: PASS — all existing + 5 new test files green. If any existing test breaks (e.g. a footer/nav test that counted facility labels), fix it in line with the new 15-category set and re-run.

- [ ] **Step 2: Run lint**

Run: `cd frontend && npm run lint`
Expected: no errors. Fix any reported issues (e.g. attribute ordering) and re-run.

- [ ] **Step 3: Final grep guard — no stray 무인민원**

Run: `grep -rn "무인민원" frontend/pages frontend/components || echo "clean"`
Expected: `clean`.

- [ ] **Step 4: Commit any fixups**

```bash
git add -A
git commit -m "test(frontend): verify static pages refresh — full suite + lint green"
```

---

## Self-Review notes (author)

- Spec §2 정식 세트 → Tasks 2/3 모두 동일 15종 라벨 사용 (CATEGORY_META 기준). ✓
- Spec §3.1 데이터 출처 표 완성(병원·약국·신규6, 무인민원 삭제) → Task 2 Step 4 + Step 1.5 검증. ✓
- Spec §3.2 terms 제2조 21항목 + 시행일 유지 → Task 3. ✓
- Spec §3.3/§3.4 privacy/contact 디자인 → Task 4/5. ✓
- Spec §4 StaticPageHeader(props title/lead/updatedAt) → Task 1, prop명 `updated-at`(kebab) 일관 사용. ✓
- Spec §5 테스트(무인민원 부재, 배지, 출처표) → 각 Task 테스트 + Task 6 grep guard. ✓
- 미확정값(신규 6 dataset URL/agency)은 placeholder가 아니라 Step 1.5의 실검증 액션 + 코드 확인된 기본값으로 처리. ✓
