# [청약 subscription] 상세페이지 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 청약 상세(`pages/subscription/[id].vue`)를 공통 우선순위 사다리(T0 헤더 → T1 1차 고유콘텐츠 → … → T6 출처)에 맞춘다. 구체적으로:
1. 공용 `MobileDetailHeader`(md:hidden) 신규 도입 — eyebrow=`heroEyebrow`(분양·마감), stats=`heroStats`(총공급/입주/분양가), 공유 + 길찾기 CTA. 이게 모바일의 정식 `<h1>`.
2. 현재 모바일 폴드를 통째로 차지하는 `PageHero`를 `title-tag="div"` + `hidden md:block`으로 강등(literal `<h1>`이 아니게). **이걸 안 하면 모바일 헤더 h1 + PageHero h1 = 이중 h1** → 단일 h1 불변식 위반.
3. `order-N`/`md:order-N` 부여. **T1 = 청약 일정 + 면적별 공급정보**(두 표를 헤더 직후 인접 배치).
4. **광고②(현재 일정 직후)를 면적별 공급정보 표 직후로 한 칸 이동** — T1의 두 핵심 표를 광고로 끊지 않기 위함(spec §3.2 규칙 ③).

**Architecture:** `<main>`이 단일 `flex flex-col gap-3` 컬럼이므로 직접 자식에 `order-N`을 주면 그대로 렌더 순서가 분기된다(좌/우 2컬럼 grid 아님 → order 스케일 충돌 없음). 청약은 좌표가 있어도 위치 섹션이 이미 본문 후반(T2/T3 경계)에 있어 사다리 충돌이 없다. 모바일 순서 == 데스크톱 순서지만, spec §4.6이 "+order 클래스"를 명시하므로 형제 페이지(land/auction/public-rental) 플랜과 일관되게 `order-N md:order-N` 동일 값을 부여한다(N은 1~12, JIT 안전). 광고 4개는 개수·"단 사이 끼임" 위치를 유지하고 광고②만 두 표 뒤로 한 칸 내린다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom(Suspense + flushPromises 패턴), TailwindCSS.

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` — §2 사다리, §3.1 단일 h1, §3.2 광고 cadence(규칙 ③), §3.3 order 컨벤션, §4.6 청약, §5 타임라인/표 headline-first.

**선행:** Foundation 플랜(`2026-06-15-detail-ordering-00-foundation.md`)의 공용 헤더 `~/components/common/MobileDetailHeader.vue`(props: title·eyebrow·status·stats·phone·copyable·hideDirections·kakaoMapUrl·naverMapUrl / emits: share·copy·directions)가 **먼저 머지/적용되어 있어야 한다.** 본 플랜은 그 컴포넌트를 import만 한다.

**전제:** 작업 브랜치에서 진행(`feat/detail-ordering-subscription` 권장). 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`).

---

## 현재 마크업 인벤토리 (근거: 실제 파일 라인)

`<main class="… flex flex-col gap-3">`(L47)의 직접 자식 순서:

| # | 라인 | 섹션 | 사다리 |
|---|---|---|---|
| 1 | L49 | `Breadcrumb`(`hidden md:block`) | (chrome) |
| 2 | L52-57 | `PageHero`(eyebrow=heroEyebrow, stats=heroStats) — **현재 title-tag 미지정 = h1** | T0(데스크톱) |
| 3 | L60 | `AdBanner` ① (PageHero 직후) | 광고① |
| 4 | L63-65 | `SectionBlock` "청약 일정" → `SubscriptionScheduleTimeline` | **T1a** |
| 5 | L68 | `AdBanner` ② (일정 이후) — **이동 대상** | 광고② |
| 6 | L71-113 | `SectionBlock` "면적별 공급정보" 표 (v-if unitTypes) | **T1b** |
| 7 | L116-143 | `SectionBlock` "면적별 경쟁률" (v-if) | T3 |
| 8 | L146-173 | `SectionBlock` "당첨 가점 분석" (v-if) | T3 |
| 9 | L176 | `AdBanner` ③ (가점·경쟁률 이후) | 광고③ |
| 10 | L179-209 | `SectionBlock` "면적별 특별공급 내역" (v-if) | T3 |
| 11 | L212-231 | `SectionBlock` "특별공급 신청현황" (v-if) | T3 |
| 12 | L234 | `RentalPriceStatsBox` (v-if 임대주택) | T3 |
| 13 | L237-273 | `SectionBlock` "위치와 로드뷰" **데스크톱**(`hidden md:block`, v-if hasCoords) | T2 |
| 14 | L276-298 | `SectionBlock` "위치·로드뷰" **모바일**(`md:hidden`, v-if hasCoords) | T2 |
| 15 | L301-304 | 좌표 없음 fallback (v-if !hasCoords) | T2 |
| 16 | L307-342 | `SectionBlock` "기본정보" | T3 |
| 17 | L345-366 | 외부 링크 버튼(홈페이지/공고) | T3 |
| 18 | L369 | `RelatedGuides` | T4 |
| 19 | L372 | `AdBanner` ④ (본문 마무리) | 광고④ |
| 20 | L375 | `DataSourceSection domain="subscription"` | T6 |

**AdBanner는 정확히 4개**(L60·L68·L176·L372). **추가·삭제 금지.** 본 플랜은 광고②(L68)만 #6(공급정보 표) 뒤로 한 칸 이동하고 나머지는 위치 불변.

**참고:** 청약은 FAQ(T5) 섹션이 현재 없다. FAQ **신설은 spec §7에서 범위 밖**(별도 후속 작업). 본 플랜은 FAQ를 추가하지 않는다(Self-Review의 후속 주석 참조).

### 목표 order 매핑 (재배치 후)

`<main>` 직접 자식에 부여할 `order-N md:order-N`(모바일=데스크톱 동일 값):

| order | 섹션 | 비고 |
|---|---|---|
| (order-1 md:order-1) | `MobileDetailHeader` (md:hidden, 신규) | T0 모바일 |
| (order-1 md:order-1) | `PageHero` (hidden md:block, title-tag="div") | T0 데스크톱 (상호배타라 order 동일해도 충돌 없음) |
| Breadcrumb | `order-1 md:order-1`은 chrome — Breadcrumb은 그대로 둠(hidden md:block, 시각상 헤더 위) → **order 미부여**(소스 최상단 유지) |
| order-2 | AdBanner ① | 광고① = 헤더 직후 |
| order-3 | 청약 일정 (T1a) | |
| order-4 | 면적별 공급정보 (T1b) | **두 표 인접 — 사이에 광고 없음** |
| order-5 | AdBanner ② | **일정→공급정보 직후로 이동** |
| order-6 | 경쟁률 / 가점 (T3) | 두 섹션 공유 가능, 소스 순서 유지 |
| order-7 | AdBanner ③ | |
| order-8 | 특별공급 내역 / 신청현황 / 전월세시세 (T3) | |
| order-9 | 위치 데스크톱 / 위치 모바일 / 좌표 fallback (T2) | |
| order-10 | 기본정보 / 외부링크 (T3) | |
| order-11 | RelatedGuides (T4) | |
| order-12 | AdBanner ④ + DataSourceSection (T6) | 끝단 공유, 소스 순서 = 광고④→출처 |

> **단순화 결정:** 청약은 모바일 순서 == 데스크톱 순서다. 따라서 `order-N`과 `md:order-N`을 **항상 같은 값**으로 준다. 이는 "소스 순서만 바꿔도 충분"하지만(규칙 ③), 형제 플랜과 패턴 일관성 + 후속 변경 시 명시성을 위해 order 클래스를 부여한다. **모든 N은 1~12 범위(JIT 안전, 13+ 없음).**

---

## Task 1: 모바일 공용 헤더 도입 + PageHero h1 강등 (단일 h1 불변식)

가장 위험한 변경(이중 h1 회귀)을 먼저, 회귀 가드 테스트와 함께 처리한다.

**Files:**
- Create: `frontend/tests/pages/subscription/subscriptionDetail.test.ts` (신규 — 청약 상세 h1/렌더 가드)
- Modify: `frontend/pages/subscription/[id].vue:52-57` (PageHero → title-tag="div"+hidden md:block), `:50-57` 직전에 `MobileDetailHeader` 삽입, `:412` 부근 import 추가

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/pages/subscription/subscriptionDetail.test.ts` 생성:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import SubscriptionDetail from '~/pages/subscription/[id].vue'

// useRoute → id
vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { id: '123' } }),
  useRouter: () => ({ push: vi.fn(), back: vi.fn() }),
}))

// 컴포저블 목 (h1/순서 가드만 필요 — 사이드이펙트 차단)
vi.mock('~/composables/useSubscription', () => ({
  useSubscription: () => ({ getSubscriptionDetail: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setEventSchema: vi.fn() }),
}))
vi.mock('~/composables/useAnalytics', () => ({
  useAnalytics: () => ({ trackSubscriptionView: vi.fn() }),
}))
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('createError', vi.fn((o: any) => Object.assign(new Error(o?.statusMessage || 'e'), o)))

const mockSubscription = {
  id: 123,
  houseName: '래미안 원베일리',
  houseType: '아파트',
  status: 'closed',
  rentType: '분양주택',
  sourceType: 'APT',
  regionName: '서울 서초구',
  supplyLocation: '서울 서초구 반포동',
  totalSupplyCount: 2990,
  moveInMonth: '202608',
  lat: 37.5,
  lng: 127.0,
  inquiryTel: '02-123-4567',
  homepage: null,
  pblancUrl: null,
  receptionStartDate: null,
  receptionEndDate: null,
  winnerDate: null,
  constructorName: null,
  developerName: null,
  houseDetailType: null,
}

const mockUnitTypes = [
  { id: 1, houseType: '084.9421A', supplyArea: '112.5', generalCount: 100, specialCount: 50, topAmount: 120000 },
]

function mockUseAsyncDataWith(data: any) {
  const result = { data: ref(data), status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }
  ;(globalThis as any).useAsyncData = vi.fn(() => Object.assign(Promise.resolve(result), result))
}

const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  Teleport: true,
  FacilityMap: { template: '<div data-testid="facility-map">Map</div>' },
  FacilityRoadview: { template: '<div data-testid="roadview">Roadview</div>' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
  SubscriptionScheduleTimeline: { template: '<div data-testid="schedule">Schedule</div>', props: ['subscription'] },
  RentalPriceStatsBox: { template: '<div />', props: ['subscriptionId', 'regionName'] },
  RelatedGuides: { template: '<div data-testid="related-guides" />', props: ['categories', 'limit'] },
  DataSourceSection: { template: '<div data-testid="data-source" />', props: ['domain'] },
  AdBanner: { template: '<div data-testid="ad-banner" />' },
  SectionBlock: { template: '<section><h2 v-if="heading">{{ heading }}</h2><slot name="right" /><slot /></section>', props: ['heading', 'subtext'] },
  // 공용 헤더: 실제처럼 literal h1 1개 + eyebrow 노출 (단일 h1 가드 의미 유지)
  MobileDetailHeader: {
    template: '<section class="md:hidden"><span v-if="eyebrow">{{ eyebrow }}</span><h1>{{ title }}</h1></section>',
    props: ['title', 'eyebrow', 'status', 'stats', 'phone', 'copyable', 'hideDirections', 'kakaoMapUrl', 'naverMapUrl'],
  },
  // PageHero: title-tag로 제목 태그 결정(상세는 div 강등 → h1 아님)
  PageHero: {
    template: '<section class="hidden md:block"><component :is="titleTag || \'h1\'">{{ title }}</component></section>',
    props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'],
  },
}

async function mountSuspended() {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(SubscriptionDetail) })
      },
    }),
    { global: { stubs } },
  )
  await flushPromises()
  return wrapper
}

describe('subscription/[id].vue 섹션 재배치', () => {
  beforeEach(() => {
    mockUseAsyncDataWith({ ...mockSubscription, unitTypes: mockUnitTypes, competitions: [], scores: [], specialStatuses: [] })
  })

  it('literal h1은 정확히 1개이고 청약 단지명이다 (단일 h1 불변식)', async () => {
    const wrapper = await mountSuspended()
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('래미안 원베일리')
  })

  it('모바일 헤더가 eyebrow(분양 · 마감)를 노출한다', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.text()).toContain('분양 · 마감')
  })

  it('청약 일정과 면적별 공급정보 섹션이 모두 렌더된다', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.find('[data-testid="schedule"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('면적별 공급정보')
  })

  it('AdBanner는 정확히 4개다 (추가·삭제 금지)', async () => {
    const wrapper = await mountSuspended()
    expect(wrapper.findAll('[data-testid="ad-banner"]').length).toBe(4)
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/subscription/subscriptionDetail.test.ts`

Expected: FAIL — 첫 테스트(`literal h1은 정확히 1개`)가 `expected 2 to be 1`. 현재 PageHero가 `title-tag` 미지정이라 h1을 렌더하고, 모바일 헤더는 아직 없다(혹은 도입 후엔 두 h1). 또한 `분양 · 마감` 미존재로 둘째 테스트도 FAIL.

> 참고: 도입 전 상태에서는 PageHero h1 1개만 있어 첫 테스트가 우연히 통과할 수도 있으나, 둘째 테스트(`MobileDetailHeader` eyebrow)는 컴포넌트가 없으므로 확실히 FAIL한다. 본 Task의 RED는 "모바일 헤더 부재"로 보장된다.

- [ ] **Step 3: import 추가 + 헤더 도입 + PageHero 강등 구현**

(a) `frontend/pages/subscription/[id].vue` import 블록(L406-412 부근)에 공용 헤더 import 추가. `PageHero` import(L410) 바로 아래에 삽입:

변경 전 (L410-412):
```ts
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```
변경 후:
```ts
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

(b) 템플릿 L49-57(Breadcrumb + PageHero)을 아래로 교체. **Breadcrumb은 그대로(hidden md:block), 모바일 헤더를 신규 추가, PageHero에 `title-tag="div"` + `hidden md:block` + 길찾기/공유 이벤트 연결.**

변경 전 (L48-57):
```vue
        <!-- Breadcrumb -->
        <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

        <!-- PageHero (상태·임대구분은 eyebrow "분양 · 마감"으로 표시) -->
        <PageHero
          :eyebrow="heroEyebrow"
          :title="subscription.houseName"
          :description="subscription.supplyLocation || subscription.regionName"
          :stats="heroStats"
        />
```
변경 후:
```vue
        <!-- Breadcrumb (데스크톱만 — chrome, order 미부여로 소스 최상단 유지) -->
        <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

        <!-- T0 모바일 헤더 (literal h1 소유) -->
        <MobileDetailHeader
          class="order-1 md:order-1"
          :title="subscription.houseName"
          :eyebrow="heroEyebrow"
          :stats="heroStats"
          :kakao-map-url="kakaoMapUrl"
          :naver-map-url="naverMapUrl"
          @share="handleShare"
          @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
        />

        <!-- T0 데스크톱 헤더 (title-tag="div"로 강등 → literal h1 아님) -->
        <PageHero
          class="hidden md:block order-1 md:order-1"
          title-tag="div"
          :eyebrow="heroEyebrow"
          :title="subscription.houseName"
          :description="subscription.supplyLocation || subscription.regionName"
          :stats="heroStats"
        />
```

> `MobileDetailHeader`는 좌표가 없을 때 `kakaoMapUrl`/`naverMapUrl`이 빈 문자열이 되며, 그 경우에도 길찾기 pill 자체는 노출되되 emit 시 빈 URL로 `window.open`이 호출된다. 청약은 대부분 좌표가 있고, 좌표 없을 때의 동작은 기존 PageHero에 길찾기 CTA가 아예 없던 것과 차이는 있으나 회귀가 아니다(신규 도입). 좌표 없을 때 길찾기를 숨기려면 후속에서 `:hide-directions="!hasCoords"`를 추가할 수 있다(본 플랜 범위 밖, Self-Review 후속 주석 참조).

(c) `<script setup>`에 `handleShare` 함수가 없으면 추가. `openNavigation`은 L461에 이미 존재. `handleShare`는 청약 페이지에 현재 없으므로 신규 추가 — `openNavigation` 정의(L461-464) 바로 위에 삽입:

변경 전 (L461-464):
```ts
function openNavigation(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  showNavDropdown.value = false
}
```
변경 후:
```ts
function handleShare() {
  if (!subscription.value) return
  const url = `${SITE_URL}/subscription/${id}`
  if (import.meta.client && navigator.share) {
    navigator.share({ title: subscription.value.houseName, url }).catch(() => {})
  } else if (import.meta.client && navigator.clipboard) {
    navigator.clipboard.writeText(url).catch(() => {})
  }
}

function openNavigation(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer')
  showNavDropdown.value = false
}
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/subscription/subscriptionDetail.test.ts`

Expected: PASS (4 tests) — h1 정확히 1개(모바일 헤더, '래미안 원베일리'), eyebrow '분양 · 마감' 노출, schedule+공급정보 렌더, AdBanner 4개.

- [ ] **Step 5: 커밋**

```bash
cd frontend
git add pages/subscription/\[id\].vue tests/pages/subscription/subscriptionDetail.test.ts
git commit -m "feat(subscription): 모바일 공용 헤더 도입 + PageHero h1 강등 (단일 h1)"
```

---

## Task 2: 광고② 이동 + order 클래스 부여 (T1 두 표 인접)

광고②(현재 일정 직후)를 면적별 공급정보 표 직후로 한 칸 내리고, `<main>` 직접 자식에 `order-N md:order-N`을 부여한다.

**Files:**
- Modify: `frontend/pages/subscription/[id].vue:60-113`(광고②·일정·공급정보 순서), `:116-375`(나머지 섹션 order 클래스)
- Test: `frontend/tests/pages/subscription/subscriptionDetail.test.ts` (Task 1 파일 확장)

- [ ] **Step 1: 실패하는 테스트 추가**

`subscriptionDetail.test.ts`의 `describe('subscription/[id].vue 섹션 재배치', …)` 블록 끝(마지막 `it` 뒤)에 아래 테스트들을 추가:

```ts
  it('청약 일정과 면적별 공급정보 사이에 광고가 없다 (T1 두 표 안 끊음)', async () => {
    const wrapper = await mountSuspended()
    const order = wrapper.findAll('[data-testid="schedule"], [data-testid="ad-banner"]')
    // schedule 직후의 첫 sibling-ad가 공급정보보다 뒤(order 값)에 오는지 order 클래스로 검증
    const scheduleEl = wrapper.find('[data-testid="schedule"]').element.closest('section, div')
    expect(scheduleEl?.className || '').toMatch(/order-3/)
  })

  it('일정(order-3) → 공급정보(order-4) → 광고②(order-5) 순서 클래스를 갖는다', async () => {
    const wrapper = await mountSuspended()
    const html = wrapper.html()
    expect(html).toMatch(/order-3/)
    expect(html).toMatch(/order-4/)
    expect(html).toMatch(/order-5/)
  })

  it('T0 헤더(order-1)와 첫 광고(order-2) 클래스가 존재한다', async () => {
    const wrapper = await mountSuspended()
    const html = wrapper.html()
    expect(html).toMatch(/order-1/)
    expect(html).toMatch(/order-2/)
  })

  it('DataSourceSection이 끝단(order-12)에 렌더된다', async () => {
    const wrapper = await mountSuspended()
    const ds = wrapper.find('[data-testid="data-source"]')
    expect(ds.exists()).toBe(true)
  })

  it('렌더 중 콘솔 에러가 없다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountSuspended()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
```

> 첫 테스트의 `closest('section, div')`는 SectionBlock stub의 `<section>`을 잡는다. SectionBlock 자식에 order 클래스가 붙어야 매칭된다(아래 구현에서 `class="order-3 …"`를 SectionBlock에 직접 부여).

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/subscription/subscriptionDetail.test.ts`

Expected: FAIL — 신규 테스트들이 `order-3`/`order-4`/`order-5` 클래스를 찾지 못해 실패(`Expected … to match /order-3/`). 기존 4개 테스트는 계속 PASS.

- [ ] **Step 3: 광고② 이동 + order 부여 구현**

(a) **광고② 이동 + 일정/공급정보 order.** 변경 전 (L62-113):
```vue
        <!-- "청약 일정" 블록 -->
        <SectionBlock heading="청약 일정" subtext="놓치면 안 되는 일정을 가장 먼저 확인하세요.">
          <SubscriptionScheduleTimeline :subscription="subscription" />
        </SectionBlock>

        <!-- Ad: 일정 이후 -->
        <AdBanner />

        <!-- "면적별 공급정보" 블록 -->
        <SectionBlock v-if="unitTypes && unitTypes.length > 0" heading="면적별 공급정보" subtext="주택형별 공급 규모와 분양가를 비교합니다.">
```
변경 후:
```vue
        <!-- T1a "청약 일정" 블록 -->
        <SectionBlock class="order-3 md:order-3" heading="청약 일정" subtext="놓치면 안 되는 일정을 가장 먼저 확인하세요.">
          <SubscriptionScheduleTimeline :subscription="subscription" />
        </SectionBlock>

        <!-- T1b "면적별 공급정보" 블록 (일정과 인접 — 사이에 광고 없음) -->
        <SectionBlock v-if="unitTypes && unitTypes.length > 0" class="order-4 md:order-4" heading="면적별 공급정보" subtext="주택형별 공급 규모와 분양가를 비교합니다.">
```
즉, 기존 L67-68의 `<!-- Ad: 일정 이후 --> <AdBanner />`를 여기서 **삭제**하고, "면적별 공급정보" SectionBlock에 `class="order-4 md:order-4"`를 추가한다. (공급정보 SectionBlock 내부 표 마크업 L72-112는 변경 없음.)

(b) **광고② 재삽입 (공급정보 표 직후).** 공급정보 SectionBlock 닫는 `</SectionBlock>`(L113) 바로 뒤에 광고②를 삽입.

변경 전 (L113-116):
```vue
        </SectionBlock>

        <!-- "면적별 경쟁률" 블록 -->
        <SectionBlock v-if="competitions.length > 0" heading="면적별 경쟁률" subtext="1·2순위 접수자수와 공급세대수 기준 경쟁률입니다.">
```
변경 후:
```vue
        </SectionBlock>

        <!-- Ad: T1(일정+공급정보) 두 표 직후로 한 칸 이동 -->
        <AdBanner class="order-5 md:order-5" />

        <!-- T3 "면적별 경쟁률" 블록 -->
        <SectionBlock v-if="competitions.length > 0" class="order-6 md:order-6" heading="면적별 경쟁률" subtext="1·2순위 접수자수와 공급세대수 기준 경쟁률입니다.">
```

(c) **광고① order.** 변경 전 (L59-60):
```vue
        <!-- Ad: PageHero 직후 -->
        <AdBanner />
```
변경 후:
```vue
        <!-- 광고① : 헤더 직후 (최고 가시성) -->
        <AdBanner class="order-2 md:order-2" />
```

(d) **나머지 섹션 order 부여.** 각 직접 자식 SectionBlock/요소에 아래 클래스를 추가(헤딩·v-if·내부 마크업 불변, `class="…"`만 보강).

- "당첨 가점 분석" SectionBlock(L146): `class="order-6 md:order-6"` 추가 (경쟁률과 같은 T3 단 — 소스 순서 유지).
  변경 전: `<SectionBlock v-if="validScores.length > 0" heading="당첨 가점 분석" …>`
  변경 후: `<SectionBlock v-if="validScores.length > 0" class="order-6 md:order-6" heading="당첨 가점 분석" …>`
- 광고③(L176): `<AdBanner class="order-7 md:order-7" />`
  변경 전: `<AdBanner />` (가점·경쟁률 이후 1회 주석 아래)
  변경 후: `<AdBanner class="order-7 md:order-7" />`
- "면적별 특별공급 내역" SectionBlock(L179): `class="order-8 md:order-8"` 추가.
  변경 전: `<SectionBlock v-if="hasSpecialSupply" heading="면적별 특별공급 내역" …>`
  변경 후: `<SectionBlock v-if="hasSpecialSupply" class="order-8 md:order-8" heading="면적별 특별공급 내역" …>`
- "특별공급 신청현황" SectionBlock(L212): `class="order-8 md:order-8"` 추가.
  변경 전: `<SectionBlock v-if="specialStatuses.length > 0" heading="특별공급 신청현황" …>`
  변경 후: `<SectionBlock v-if="specialStatuses.length > 0" class="order-8 md:order-8" heading="특별공급 신청현황" …>`
- `RentalPriceStatsBox`(L234): `class="order-8 md:order-8"` 추가.
  변경 전: `<RentalPriceStatsBox v-if="subscription?.rentType === '임대주택'" :subscription-id="subscription.id" :region-name="subscription.regionName" />`
  변경 후: `<RentalPriceStatsBox v-if="subscription?.rentType === '임대주택'" class="order-8 md:order-8" :subscription-id="subscription.id" :region-name="subscription.regionName" />`
- "위치와 로드뷰" 데스크톱 SectionBlock(L237): `class="hidden md:block order-9 md:order-9"` (기존 `hidden md:block` 유지하며 order 병합).
  변경 전: `<SectionBlock v-if="hasCoords" heading="위치와 로드뷰" subtext="…" class="hidden md:block">`
  변경 후: `<SectionBlock v-if="hasCoords" heading="위치와 로드뷰" subtext="…" class="hidden md:block order-9 md:order-9">`
- "위치·로드뷰" 모바일 SectionBlock(L276): `class="md:hidden order-9 md:order-9"`.
  변경 전: `<SectionBlock v-if="hasCoords" heading="위치·로드뷰" subtext="…" class="md:hidden">`
  변경 후: `<SectionBlock v-if="hasCoords" heading="위치·로드뷰" subtext="…" class="md:hidden order-9 md:order-9">`
- 좌표 없음 fallback div(L301): `class="… order-9 md:order-9"` 추가.
  변경 전: `<div v-if="!hasCoords" class="rounded-xl border border-line bg-background-light p-6 text-center">`
  변경 후: `<div v-if="!hasCoords" class="rounded-xl border border-line bg-background-light p-6 text-center order-9 md:order-9">`
- "기본정보" SectionBlock(L307): `class="order-10 md:order-10"` 추가.
  변경 전: `<SectionBlock heading="기본정보" subtext="시공사·시행사·문의처 등 청약 개요를 모았습니다.">`
  변경 후: `<SectionBlock class="order-10 md:order-10" heading="기본정보" subtext="시공사·시행사·문의처 등 청약 개요를 모았습니다.">`
- 외부 링크 버튼 wrapper div(L345): `class="flex flex-col md:flex-row gap-4 order-10 md:order-10"`.
  변경 전: `<div class="flex flex-col md:flex-row gap-4">`
  변경 후: `<div class="flex flex-col md:flex-row gap-4 order-10 md:order-10">`
- `RelatedGuides`(L369): `class="order-11 md:order-11"` 추가.
  변경 전: `<RelatedGuides :categories="['subscription', 'apt-sale', 'apt-rent']" :limit="3" />`
  변경 후: `<RelatedGuides class="order-11 md:order-11" :categories="['subscription', 'apt-sale', 'apt-rent']" :limit="3" />`
- 광고④(L372): `<AdBanner class="order-12 md:order-12" />`
  변경 전: `<AdBanner />` ("본문 마무리" 주석 아래)
  변경 후: `<AdBanner class="order-12 md:order-12" />`
- `DataSourceSection`(L375): **멀티루트 컴포넌트는 class fall-through 불가** → wrapper div로 감싸 order 부여.
  변경 전:
  ```vue
        <!-- 데이터 정보 -->
        <DataSourceSection domain="subscription" />
  ```
  변경 후:
  ```vue
        <!-- 데이터 정보 (멀티루트 → wrapper에 order) -->
        <div class="order-12 md:order-12">
          <DataSourceSection domain="subscription" />
        </div>
  ```

> **order-12 공유군 순서:** 광고④(order-12) → DataSourceSection wrapper(order-12)는 같은 order 값이므로 **DOM 소스 순서**가 곧 렌더 순서다. 소스에서 광고④가 출처보다 위에 오므로 "광고④ → 출처" 순서가 보장된다(spec §3.3 끝단 공유 규칙).

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/subscription/subscriptionDetail.test.ts`

Expected: PASS (9 tests) — order-1~5 클래스 존재, 일정과 공급정보 사이 광고 없음, AdBanner 여전히 4개, DataSourceSection 렌더, 콘솔 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd frontend
git add pages/subscription/\[id\].vue tests/pages/subscription/subscriptionDetail.test.ts
git commit -m "feat(subscription): order 재배치 + 광고②를 T1 두 표 직후로 이동"
```

---

## Task 3: 전체 검증 (회귀 + 빌드 + Nitro 캐시)

**Files:**
- (검증만, 코드 변경 없음 — 실패 시 해당 Task로 복귀)

- [ ] **Step 1: 청약 + 관련 테스트 회귀 확인**

Run: `cd frontend && npx vitest run tests/pages/subscription/ tests/pages/subscriptionRentType.test.ts tests/pages/subscription-meta.test.ts tests/components/subscription/`

Expected: 전부 PASS. 청약 관련 기존 테스트(메타/허브/타임라인)가 본 변경으로 깨지지 않았음을 확인.

- [ ] **Step 2: 전체 프론트 테스트**

Run: `cd frontend && npx vitest run`

Expected: 전체 PASS. (단일 h1 가드를 가진 다른 상세 페이지 테스트들과 충돌 없음.)

- [ ] **Step 3: 빌드 검증**

Run: `cd frontend && npm run build`

Expected: 빌드 성공. `~/components/common/MobileDetailHeader.vue`(Foundation 산출물) resolve 정상, order-N JIT 클래스 컴파일 정상.

- [ ] **Step 4: (선택) Nitro 캐시 삭제 후 dev 스모크**

청약 상세는 SSR 캐시 대상이 아닐 수 있으나, 재배치 검증 시 stale 가능성을 배제하기 위해 캐시를 비우고 dev에서 모바일/데스크톱을 눈으로 확인:

```bash
cd frontend
rm -rf .nuxt/cache/nitro/routes
npm run dev
```
브라우저에서 `/subscription/<실제 id>` 접속 → (a) 모바일 폭(≤768px): MobileDetailHeader(h1=단지명) + eyebrow 배지, 청약 일정 바로 아래 면적별 공급정보 표, 그 다음 광고. (b) 데스크톱 폭: PageHero(div 제목) 노출, 모바일 헤더 숨김. DevTools에서 `document.querySelectorAll('h1').length === 1` 확인.

- [ ] **Step 5: 커밋 (검증 산출물 없으면 생략)**

검증 단계는 코드 변경이 없으므로 커밋 불필요. Task 1·2 커밋으로 충분.

---

## Self-Review

### spec §4.6(청약) 커버 여부
- ✅ **＋모바일 헤더 신규 도입** — Task 1 Step 3 (b): `MobileDetailHeader` (md:hidden), eyebrow=`heroEyebrow`(분양·마감), stats=`heroStats`(총공급/입주/분양가), 공유+길찾기 CTA.
- ✅ **PageHero에 `title-tag="div"`+`hidden md:block`** — Task 1 Step 3 (b): 이중 h1 방지. Task 1 Step 1 첫 테스트가 `h1 count === 1` 가드.
- ✅ **＋order 클래스** — Task 2 Step 3: `order-1`~`order-12 md:order-N` (모두 1~12 JIT 안전, 13+ 없음).
- ✅ **광고②를 일정 직후 → 공급정보 표 직후로 한 칸 이동** — Task 2 Step 3 (a)(b): 일정(order-3)+공급정보(order-4) 인접, 광고②(order-5)는 두 표 뒤. spec §3.2 규칙 ③ 충족.
- ✅ **위치는 이미 본문 후반(T2) → 사다리 충돌 없음** — 위치 데/모/fallback 모두 order-9로 후반 배치. 데스크톱 위치 섹션의 `hidden md:block`·모바일의 `md:hidden`은 v-if hasCoords와 함께 유지(카카오맵 이중 초기화 — 데스크톱/모바일이 CSS로만 분기되지만 기존 구조 그대로이므로 회귀 아님).

### 광고 불변식
- ✅ AdBanner는 변경 전후 모두 **정확히 4개**(L60·L68·L176·L372 → order-2·order-5·order-7·order-12). 광고②만 위치 이동, 추가·삭제 없음. Task 1·2 테스트 `findAll('[data-testid="ad-banner"]').length === 4`로 가드.

### 단일 h1 불변식
- ✅ 모바일 헤더 literal `<h1>` 1개(md:hidden) + PageHero `title-tag="div"`(hidden md:block) → 어느 뷰포트든 literal h1 1개. Task 1 첫 테스트로 검증.

### 플레이스홀더 스캔
- "적절히/TODO/위와 유사" 표현 없음. 모든 마크업 변경은 실제 before→after 코드 블록으로 제시. order 부여는 섹션별로 정확한 before/after 라인 명시.

### 타입/prop 일관성
- `MobileDetailHeader` prop명(`title`/`eyebrow`/`stats`/`kakao-map-url`/`naver-map-url`)·emit(`share`/`directions`)은 Foundation 플랜 Task 1 정의와 일치. `heroEyebrow`/`heroStats`/`kakaoMapUrl`/`naverMapUrl`/`openNavigation`은 청약 페이지에 이미 존재(L476/L482/L451/L456/L461). `handleShare`만 신규(Task 1 Step 3 (c)). `PageHero`의 `titleTag` prop은 컴포넌트에 존재(`components/common/PageHero.vue:63`, 기본 'h1').

### 후속 작업 주석 (범위 밖)
- **FAQ(T5) 신설**: 청약은 현재 FAQ 섹션이 없다. spec §7에 따라 도메인 공통 FAQ 신설 + FAQPage JSON-LD 발행(`composables/useStructuredData.ts`의 `setFAQSchema` + `utils/dynamicFAQ.ts`)은 **별도 후속 작업**이며 본 재배치 플랜 범위 밖이다.
- **좌표 없을 때 길찾기 숨김**: `MobileDetailHeader`에 `:hide-directions="!hasCoords"`를 주면 좌표 없는 청약에서 길찾기 pill을 숨길 수 있다(기존 PageHero에는 길찾기 CTA가 없었음). 회귀가 아니라 신규 동작이라 본 플랜에서는 항상 노출로 두되, 디자인 확인 후 후속에서 조정 가능.
- **모바일 지도 높이**: 청약 모바일 지도/로드뷰는 이미 220px(L278·L295)로 `utils/mapMedia.ts` 통일 기준에 부합 — 추가 작업 불필요.
