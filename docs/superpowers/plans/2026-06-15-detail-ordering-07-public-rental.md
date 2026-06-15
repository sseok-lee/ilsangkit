# [공공임대 public-rental] 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Do not batch tasks — write the failing test, confirm it fails, implement, confirm it passes, then commit, one task at a time.

**Goal:** 공공임대 상세 뷰(`components/subscription/PublicRentalDetailView.vue`, 라우트 `pages/public-rental/[type]/[id].vue`)를 spec §4.7 우선순위 사다리에 맞춰 재배치한다. (1) 공용 `MobileDetailHeader`(`md:hidden`, stats=보증금/월세/전용/세대)를 신규 도입하고 기존 `PublicRentalDetailHeader`의 literal `<h1>`을 `div role="heading" aria-level="1"`로 강등해 **단일 h1** 불변식을 지킨다. (2) 직속 자식 wrapper에 `order-N`/`md:order-N`을 부여해 T1=가격카드+스펙그리드, T2=위치, 교육형(임대유형 가이드·자격·신청 가이드)=T3, 주변시설을 위치(T2)에서 분리해 인근단지와 함께 T4로 묶는다. (3) 광고②를 "위치 직후"에서 "교육형(T3) 콘텐츠 사이"로 이동한다(AdBanner **3개 불변**). (4) `setFAQSchema(PUBLIC_RENTAL_FAQ)`는 라우트 페이지에서 이미 발행 중이므로 그대로 유지한다.

**Architecture:** `PublicRentalDetailView.vue`는 라우트(`route.params`, `useStructuredData`)에 접근하지 않는 **순수 자식 컴포넌트**다. 헤더/공유/길찾기 wiring은 이 컴포넌트 내부에서 `rental` prop과 `window`만으로 처리한다(라우트 정보 불필요). 현재 단일 flex 컬럼(`<div class="flex flex-col gap-3">`) 안에 14개 직속 자식이 DOM 소스 순서대로 렌더된다. 모바일과 데스크톱의 목표 순서가 거의 동일하므로(공공임대는 부동산 단지처럼 좌/우 2컬럼 grid가 아니라 단일 컬럼) `order-N md:order-N`을 동일 값으로 부여하되, 미래 데스크톱 분기 여지를 위해 spec §3.3 컨벤션대로 둘 다 명시한다. `DataSourceSection`은 멀티루트 가능성이 있어 spec §3.3·④에 따라 **wrapper `<div>`에 order**를 둔다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom, TailwindCSS. 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`).

**선행:** Foundation 플랜(공용 헤더 `~/components/common/MobileDetailHeader.vue`) 먼저 적용 — 본 플랜은 그 컴포넌트를 import한다. (`docs/superpowers/plans/2026-06-15-detail-ordering-00-foundation.md`)

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` — §2 사다리, §3.1 단일 h1, §3.2 광고 cadence, §3.3 order, §3.4 headline-first, §4.7 공공임대, §5 내부배치, §8 리스크.

---

## 현재 마크업 (재배치 전, 기준선)

`components/subscription/PublicRentalDetailView.vue:1-59` 의 단일 flex 컬럼 직속 자식 순서:

| # | 줄 | 컴포넌트 | 현재 tier | 목표 tier |
|---|---|---|---|---|
| 1 | 3 | `PublicRentalDetailHeader` (literal h1 소유) | T0 | T0(데스크톱) |
| — | — | (없음) | — | **T0(모바일) 신규 MobileDetailHeader** |
| 2 | 5 | `PublicRentalPriceCard` | T1 | T1 |
| 3 | 7 | `PublicRentalSpecGrid` | T1 | T1 |
| 4 | 9 | `PublicRentalSiblings` | T1 영역 혼재 | **T4** (인근단지와 묶음) |
| 5 | 12 | `AdBanner` ① | 광고 | 광고①(T0/T1 직후) |
| 6 | 14-28 | `SectionBlock 위치` (지도 300px) | T2 | T2 |
| 7 | 30-35 | `SectionBlock 주변 생활시설` | T2에 혼재 | **T4** (인근단지와 묶음) |
| 8 | 38 | `AdBanner` ② | 광고(위치 직후) | **광고②(교육형 T3 사이로 이동)** |
| 9 | 40 | `PublicRentalRentalTypeGuide` | T3 | T3 |
| 10 | 42 | `PublicRentalEligibility` | T3 | T3 |
| 11 | 44 | `PublicRentalApplyGuide` | T3 | T3 |
| 12 | 46 | `PublicRentalFAQ` | T5 | T5 |
| 13 | 48-52 | `PublicRentalNearbyComplexes` | T4 | T4 |
| 14 | 55 | `AdBanner` ③ | 광고(본문 마무리) | 광고③(본문 마무리) |
| 15 | 57 | `DataSourceSection` | T6 | T6 |

**목표 렌더 순서(모바일=데스크톱):**
T0 모바일헤더 → T0 데스크톱헤더(div) → T1 가격카드 → T1 스펙그리드 → 광고① → T2 위치 → T3 임대유형가이드 → **광고②** → T3 자격 → T3 신청가이드 → T4 주변생활시설 → T4 인근단지 → T4 형제단지 → T5 FAQ → 광고③ → T6 출처.

> AdBanner는 정확히 **3개** 유지(추가·삭제 없음). 광고①은 T1 직후(고가시성), 광고②는 교육형 T3 콘텐츠 사이(위치 직후 → 한 칸 뒤로), 광고③은 본문 마무리(FAQ 뒤). spec §3.2 cadence 준수.

---

### Task 1: 데스크톱 헤더 h1 강등 (단일 h1 사전 준비)

모바일 공용 헤더가 literal `<h1>`을 소유하게 되므로, 기존 `PublicRentalDetailHeader`의 `<h1>`을 먼저 `div role="heading"`으로 강등하고 `hidden md:block`을 부여한다. 이 Task는 모바일 헤더 도입 전에 선행해 "이중 h1" 중간 상태를 만들지 않는다.

**Files:**
- Modify: `frontend/components/subscription/PublicRentalDetailHeader.vue:2` (`<header>` 루트에 `hidden md:block`), `:10-12` (`<h1>` → `<div role="heading" aria-level="1">`)
- Test: `frontend/tests/components/subscription/PublicRentalDetailView.test.ts` (기존 파일 확장)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/components/subscription/PublicRentalDetailView.test.ts` 의 `describe('PublicRentalDetailView', ...)` 블록 **맨 끝**(마지막 `it` 뒤, 닫는 `})` 앞)에 아래 테스트 3개를 추가한다.

```ts
  it('단일 h1 불변식: literal h1이 정확히 1개다 (모바일 헤더가 소유)', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('데스크톱 헤더는 h1이 아니라 role="heading" aria-level="1"로 강등된다', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const desktopHeading = wrapper.find('[role="heading"][aria-level="1"]')
    expect(desktopHeading.exists()).toBe(true)
    expect(desktopHeading.element.tagName).not.toBe('H1')
    expect(desktopHeading.text()).toContain('강남 매입임대 1단지')
  })
```

> 이 시점에는 모바일 공용 헤더가 아직 도입되지 않았으므로 첫 테스트(`h1 === 1`)는 기존 `PublicRentalDetailHeader`의 h1 1개로 우연히 통과할 수 있다. 핵심 실패 신호는 둘째 테스트(`role="heading"` 미존재)다. Task 2 완료 후 둘 다 안정적으로 통과한다.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: FAIL — `데스크톱 헤더는 h1이 아니라 role="heading"...` 케이스에서 `expect(desktopHeading.exists()).toBe(true)` → received `false` (아직 `<h1>`이라 `[role="heading"]` 셀렉터에 안 잡힘).

- [ ] **Step 3: `PublicRentalDetailHeader` 헤더 강등 구현**

`frontend/components/subscription/PublicRentalDetailHeader.vue:2` (루트 `<header>`):

```vue
<!-- before -->
  <header class="bg-white border border-line rounded-xl shadow-card p-4 md:p-5">
```
```vue
<!-- after -->
  <header class="hidden md:block bg-white border border-line rounded-xl shadow-card p-4 md:p-5">
```

`frontend/components/subscription/PublicRentalDetailHeader.vue:10-12` (제목):

```vue
<!-- before -->
    <h1 class="text-2xl md:text-3xl font-bold text-strong leading-tight break-keep">
      {{ displayName }}
    </h1>
```
```vue
<!-- after -->
    <div role="heading" aria-level="1" class="text-2xl md:text-3xl font-bold text-strong leading-tight break-keep">
      {{ displayName }}
    </div>
```

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: PASS — 둘째 테스트 통과(`role="heading"` 존재, tagName이 H1 아님). 첫째 테스트(`h1 === 1`)도 통과(이제 데스크톱 헤더에 h1 없음 → 현재 0개지만 모바일 헤더가 없는 중간 상태이므로 0개일 수 있다).

> **주의(중간 상태):** Step 4 시점에 모바일 헤더가 아직 없으면 literal h1이 **0개**가 되어 `h1 === 1` 테스트가 FAIL 할 수 있다. 그 경우 Step 3까지만 커밋하지 말고 **즉시 Task 2로 진행**해 모바일 헤더를 추가한 뒤 함께 통과시킨다(아래 Step 5 커밋은 Task 2 직전 합쳐서 수행해도 무방). 안전을 위해 Task 1 커밋은 Task 2 통과 후 한 번에 묶는다.

- [ ] **Step 5: 커밋 (Task 2 통과 후 묶어서 — 아래 Task 2 Step 5 참조)**

Task 1 단독 커밋은 단일 h1이 일시적으로 0개가 되므로 만들지 않는다. Task 2 Step 5에서 헤더 강등+모바일 헤더 도입을 한 커밋으로 묶는다.

---

### Task 2: 모바일 공용 `MobileDetailHeader` 도입 (T0)

`PublicRentalDetailView.vue`에 `md:hidden` 공용 헤더를 추가해 모바일 literal h1을 1개로 만든다. stats=보증금/월세/전용/세대, 공유 CTA, 길찾기(좌표 있을 때) 노출.

**Files:**
- Modify: `frontend/components/subscription/PublicRentalDetailView.vue:1-3` (템플릿 최상단에 헤더 추가), `:61-62` (`ref` import 추가), `:62-77` (import 블록에 공용 헤더 + 메타 헬퍼), `:79-113` (script에 stats/공유/길찾기 computed·함수 추가)
- Test: `frontend/tests/components/subscription/PublicRentalDetailView.test.ts` (Task 1에서 확장한 파일)

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/tests/components/subscription/PublicRentalDetailView.test.ts` 의 `describe` 블록 끝(Task 1 테스트 뒤)에 추가:

```ts
  it('모바일 공용 헤더가 보증금/월세/전용/세대 stat 칩을 노출한다', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    // stat 라벨
    expect(text).toContain('보증금')
    expect(text).toContain('월세')
    expect(text).toContain('전용')
    expect(text).toContain('세대')
    // stat 값 (보증금 1.2억, 세대 240)
    expect(text).toContain('1억 2,000만원')
    expect(text).toContain('240세대')
  })

  it('공유 pill 클릭이 크래시 없이 동작한다(navigator.share 폴백)', async () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const share = wrapper.find('[data-test="share-pill"]')
    expect(share.exists()).toBe(true)
    await expect(share.trigger('click')).resolves.not.toThrow()
  })
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: FAIL — `[data-test="share-pill"]` 미존재(`share.exists()` → `false`), stat 칩 `월세`/`전용` 라벨 미노출. (공용 헤더가 아직 마운트 안 됨.)

- [ ] **Step 3: import 블록 수정**

`frontend/components/subscription/PublicRentalDetailView.vue:62`:

```ts
// before
import { computed, defineAsyncComponent } from 'vue'
```
```ts
// after
import { computed, defineAsyncComponent, ref } from 'vue'
```

> `ref`를 명시 import한다 — 이 컴포넌트는 테스트에서 직접 `mount`되므로 auto-import에 의존하면 CI에서만 `ReferenceError: ref is not defined`가 난다(MEMORY: vitest auto-import 전역 함정, PR #431 사례). 단, 본 헤더는 `showNav`를 헤더 컴포넌트 내부에서 관리하므로 뷰 측 `ref` 사용은 없을 수도 있다. import는 무해하니 추가해 두되, lint `no-unused-vars`가 걸리면 본 Step에서 `ref` 추가를 생략한다(아래 Step 4에서 `ref` 미사용이면 import도 빼라).

`frontend/components/subscription/PublicRentalDetailView.vue:65-66` 근처(공용 컴포넌트 import 그룹)에 공용 헤더 import 추가. 기존 `import SectionBlock ...` 줄 바로 위에 삽입:

```ts
// after — SectionBlock import 위에 추가
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
```

`frontend/components/subscription/PublicRentalDetailView.vue:33` 의 meta 헬퍼 import를 stat 포맷용으로 확장한다. 현재 이 파일은 `utils/publicRentalMeta`를 import하지 않으므로 새 import 줄을 import 그룹 끝(`const FacilityMap = defineAsyncComponent...` 줄 위)에 추가:

```ts
// after — defineAsyncComponent(FacilityMap) 줄 위에 추가
import { fmtDeposit, fmtRent, fmtArea, fmtCount, isJeonseRental } from '~/utils/publicRentalMeta'
```

- [ ] **Step 4: script — stats + 공유/길찾기 computed·함수 추가**

`frontend/components/subscription/PublicRentalDetailView.vue` 의 `<script setup>` 안, 기존 `markerFacility` computed(`:96-112`) **뒤**(닫는 `</script>` 앞)에 아래를 추가한다.

```ts
const isJeonse = computed(() => isJeonseRental(props.rental.monthlyRent))

const displayName = computed(() =>
  props.rental.complexNameKor && props.rental.complexNameKor.trim()
    ? props.rental.complexNameKor
    : `${props.rental.city} ${props.rental.district} ${props.rental.rentalType}`,
)

// 모바일 헤더 stat 칩 (보증금 → 월세 → 전용 → 세대), '정보없음' 필터 후 최대 4개
const mobileHeaderStats = computed(() => {
  const NO = '정보없음'
  const raw = [
    { label: isJeonse.value ? '전세보증금' : '보증금', value: fmtDeposit(props.rental.depositAmount), color: 'text-primary' },
    { label: '월세', value: fmtRent(props.rental.monthlyRent, isJeonse.value) },
    { label: '전용', value: fmtArea(props.rental.exclusiveArea) },
    { label: '세대', value: fmtCount(props.rental.householdCount, '세대') },
  ]
  return raw.filter((s) => s.value !== NO && s.value !== '없음 (전세)' ? true : s.label !== '월세' ? s.value !== NO : true).slice(0, 4)
})

// 길찾기 URL (좌표 있을 때만)
const kakaoMapUrl = computed(() =>
  hasCoords.value
    ? `https://map.kakao.com/link/to/${encodeURIComponent(displayName.value)},${props.rental.lat},${props.rental.lng}`
    : '',
)
const naverMapUrl = computed(() =>
  hasCoords.value
    ? `https://map.naver.com/v5/directions/-/${props.rental.lng},${props.rental.lat},${encodeURIComponent(displayName.value)}/-/walk`
    : '',
)

function openNavigation(url: string) {
  if (!import.meta.client || !url) return
  window.open(url, '_blank')
}

async function handleShare() {
  if (!import.meta.client) return
  const shareData = {
    title: displayName.value,
    text: `${displayName.value} ${props.rental.rentalType} 공공임대`,
    url: window.location.href,
  }
  try {
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(window.location.href)
    }
  } catch {
    /* 사용자 취소/미지원 — 무시 */
  }
}
```

> `월세` 칩 필터: 전세임대는 `fmtRent`가 `'없음 (전세)'`를 반환하므로 의미 칩으로 노출(전세 매물에서 "월세: 없음 (전세)"는 정보 가치 있음). 위 필터는 월세 라벨은 항상 통과시키고 그 외 라벨만 `정보없음` 제거하는 단순 규칙이다. 칩이 4개 미만이어도 `MobileDetailHeader`는 `v-if="stats?.length"`로 안전.

> `ref`를 위 코드에서 실제로 쓰지 않는다면(showNav는 헤더 내부 소유) Step 3의 `ref` import는 제거한다. lint 확인: `npm run lint` 에서 `ref` no-unused-vars 경고 시 import에서 `, ref` 삭제.

- [ ] **Step 5: 템플릿 — 모바일 헤더를 데스크톱 헤더 위(최상단)에 추가**

`frontend/components/subscription/PublicRentalDetailView.vue:1-3`:

```vue
<!-- before -->
<template>
  <div class="flex flex-col gap-3">
    <PublicRentalDetailHeader :rental="rental" />
```
```vue
<!-- after -->
<template>
  <div class="flex flex-col gap-3">
    <MobileDetailHeader
      :title="displayName"
      :eyebrow="`${rental.rentalType}${rental.houseType ? ` · ${rental.houseType}` : ''}`"
      :stats="mobileHeaderStats"
      :hide-directions="!hasCoords"
      :kakao-map-url="kakaoMapUrl"
      :naver-map-url="naverMapUrl"
      @share="handleShare"
      @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
    />

    <PublicRentalDetailHeader :rental="rental" />
```

> 공용 헤더는 `md:hidden`(자체 보유), 데스크톱 헤더는 Task 1에서 `hidden md:block` 부여 → 두 헤더 상호 배타. 좌표 없으면 `hide-directions`로 길찾기 pill 숨김(공유만). `phone`/`copyable` 미전달 → 전화·복사 pill 자동 숨김.

- [ ] **Step 6: 테스트 실행 → 통과 확인 (Task 1 테스트 포함)**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: PASS — 전체(기존 7 + Task1 2 + Task2 2 = 11 tests). 특히 `findAll('h1')` 길이 1(모바일 헤더 literal h1 1개, 데스크톱은 div), stat 칩 `보증금/월세/전용/세대`·`1억 2,000만원`·`240세대` 노출, share-pill 클릭 무크래시.

- [ ] **Step 7: 커밋 (Task 1 + Task 2 묶음)**

```bash
cd frontend
git add components/subscription/PublicRentalDetailView.vue \
        components/subscription/PublicRentalDetailHeader.vue \
        tests/components/subscription/PublicRentalDetailView.test.ts
git commit -m "feat(public-rental): 모바일 공용 MobileDetailHeader 도입 + 데스크톱 h1 강등 (단일 h1)"
```

---

### Task 3: 콘텐츠 단 재배치 + order 클래스 부여 + 광고② 이동

직속 자식들에 `order-N md:order-N`을 부여하고, 주변생활시설을 위치(T2)에서 분리해 인근단지·형제단지와 함께 T4로 묶고, 광고②를 위치 직후 → 교육형(T3) 콘텐츠 사이로 이동한다(AdBanner 3개 불변). DOM 소스 순서도 목표 순서로 재배열해 order와 일치시킨다(가독성·SSR 안정).

**Files:**
- Modify: `frontend/components/subscription/PublicRentalDetailView.vue:1-58` (템플릿 본문 전체 재배열 + order 클래스)
- Test: `frontend/tests/components/subscription/PublicRentalDetailView.test.ts` (order/광고 개수 검증 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/tests/components/subscription/PublicRentalDetailView.test.ts` 의 `describe` 블록 끝에 추가. 테스트 상단 `stubs`에 `AdBanner` 스텁이 없으면 추가한다(현재 `stubs`는 ClientOnly/FacilityMap/NearbyFacilities만 보유 → AdBanner는 글로벌 stub 또는 실제 렌더). 광고 개수 카운트를 위해 `AdBanner` 스텁을 식별 가능한 마커로 등록:

```ts
// 파일 상단 stubs 객체에 AdBanner 추가 (기존 stubs 확장)
const stubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div class="stub-map" />' },
  NearbyFacilities: { template: '<div class="stub-nearby-facilities" />' },
  AdBanner: { template: '<div class="stub-ad" />' },
}
```

describe 블록 끝에 추가:

```ts
  it('AdBanner는 정확히 3개 유지된다 (재배치 후 개수 불변)', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    expect(wrapper.findAll('.stub-ad')).toHaveLength(3)
  })

  it('재배치: T1 가격카드(order-2)·위치(order-4)·FAQ(order-11)·출처(order-12) wrapper에 order 클래스가 있다', () => {
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const html = wrapper.html()
    // 대표 order 토큰이 존재 (전체 스케일 중 일부 샘플)
    expect(html).toContain('order-2')   // 가격카드 (T1)
    expect(html).toContain('md:order-2')
    expect(html).toContain('order-12')  // 데이터 출처 wrapper (T6)
    expect(html).toContain('md:order-12')
  })

  it('재배치 후에도 핵심 섹션이 모두 렌더된다 (콘솔 에러 없음)', () => {
    const errSpy = vi.spyOn(console, 'error')
    const wrapper = mount(PublicRentalDetailView, {
      props: { rental: baseRental, siblings: [], nearby: [] },
      global: { stubs },
    })
    const text = wrapper.text()
    expect(text).toContain('가격 정보')
    expect(text).toContain('단지 정보')
    expect(text).toContain('위치')
    expect(text).toContain('주변 생활시설')
    expect(text).toContain('매입임대 안내')
    expect(text).toContain('자주 묻는 질문')
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
  })
```

> 파일 상단 import에 `vi`가 없으면 추가: `import { describe, it, expect, vi } from 'vitest'`.

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: FAIL — `재배치: ... order-2` 케이스에서 `html` 에 `order-2` 미존재(아직 order 클래스 없음). (`AdBanner 3개`·`핵심 섹션` 테스트는 통과할 수 있음.)

- [ ] **Step 3: 템플릿 본문 재배열 + order 부여**

`frontend/components/subscription/PublicRentalDetailView.vue:4-58` (모바일/데스크톱 헤더 **이후**, 즉 Task 2에서 추가한 `<MobileDetailHeader/>` + `<PublicRentalDetailHeader :rental="rental" />` 다음부터 닫는 `</div>` 전까지)을 아래로 **통째 교체**한다.

```vue
<!-- before (현재 5~57행, 헤더 2종 이후 전체) -->
    <PublicRentalPriceCard :rental="rental" />

    <PublicRentalSpecGrid :rental="rental" />

    <PublicRentalSiblings :siblings="siblings" />

    <!-- Ad: 기본정보/형제단지 이후 (청약 패턴 1번) -->
    <AdBanner />

    <SectionBlock heading="위치" :subtext="locationSubtext">
      <div v-if="hasCoords" class="rounded-xl border border-line overflow-hidden h-[300px] md:h-[360px]">
        <ClientOnly>
          <FacilityMap
            :center="{ lat: rental.lat as number, lng: rental.lng as number }"
            :facilities="markerFacility"
            :level="3"
          />
        </ClientOnly>
      </div>
      <div v-else class="rounded-xl bg-background-light p-8 text-center">
        <p class="text-muted text-sm">이 단지는 좌표 정보가 등록되지 않아 지도를 표시할 수 없습니다.</p>
        <p class="mt-1 text-faint text-xs">{{ rental.complexName }}</p>
      </div>
    </SectionBlock>

    <SectionBlock heading="주변 생활시설" subtext="단지 반경 1km 이내의 학교·병원·약국·공원 등을 확인하세요.">
      <NearbyFacilities v-if="hasCoords" :lat="rental.lat as number" :lng="rental.lng as number" />
      <div v-else class="rounded-xl bg-background-light p-6 text-center text-muted text-sm">
        좌표 정보가 등록되어 있지 않아 주변 생활시설을 표시할 수 없습니다. 단지 주소를 참고하여 직접 확인해 주세요.
      </div>
    </SectionBlock>

    <!-- Ad: 위치/주변 시설 이후 (청약 패턴 2번) -->
    <AdBanner />

    <PublicRentalRentalTypeGuide :rental-type="rental.rentalType" />

    <PublicRentalEligibility />

    <PublicRentalApplyGuide />

    <PublicRentalFAQ />

    <PublicRentalNearbyComplexes
      :complexes="nearby"
      :city="rental.city"
      :district="rental.district"
    />

    <!-- Ad: 본문 마무리 (청약 패턴 3번) -->
    <AdBanner />

    <DataSourceSection domain="public-rental" :last-sync-date="lastSyncDate" />
  </div>
```

```vue
<!-- after -->
    <!-- T1: 가격 카드 + 스펙 그리드 (이 URL 고유 핵심 데이터) -->
    <PublicRentalPriceCard :rental="rental" class="order-2 md:order-2" />

    <PublicRentalSpecGrid :rental="rental" class="order-3 md:order-3" />

    <!-- Ad①: T1 직후 고가시성 (청약 패턴 1번) -->
    <AdBanner class="order-4 md:order-4" />

    <!-- T2: 위치·로드뷰 -->
    <SectionBlock heading="위치" :subtext="locationSubtext" class="order-5 md:order-5">
      <div v-if="hasCoords" class="rounded-xl border border-line overflow-hidden h-[300px] md:h-[360px]">
        <ClientOnly>
          <FacilityMap
            :center="{ lat: rental.lat as number, lng: rental.lng as number }"
            :facilities="markerFacility"
            :level="3"
          />
        </ClientOnly>
      </div>
      <div v-else class="rounded-xl bg-background-light p-8 text-center">
        <p class="text-muted text-sm">이 단지는 좌표 정보가 등록되지 않아 지도를 표시할 수 없습니다.</p>
        <p class="mt-1 text-faint text-xs">{{ rental.complexName }}</p>
      </div>
    </SectionBlock>

    <!-- T3: 교육형 콘텐츠 (공유 템플릿) — 임대유형 가이드 → 광고② → 자격 → 신청 -->
    <PublicRentalRentalTypeGuide :rental-type="rental.rentalType" class="order-6 md:order-6" />

    <!-- Ad②: 교육형 T3 콘텐츠 사이로 이동 (위치 직후 → 한 칸 뒤, 청약 패턴 2번) -->
    <AdBanner class="order-7 md:order-7" />

    <PublicRentalEligibility class="order-8 md:order-8" />

    <PublicRentalApplyGuide class="order-9 md:order-9" />

    <!-- T4: 관련·탐색 — 주변 생활시설 → 인근 단지 → 형제(같은 단지) -->
    <SectionBlock heading="주변 생활시설" subtext="단지 반경 1km 이내의 학교·병원·약국·공원 등을 확인하세요." class="order-10 md:order-10">
      <NearbyFacilities v-if="hasCoords" :lat="rental.lat as number" :lng="rental.lng as number" />
      <div v-else class="rounded-xl bg-background-light p-6 text-center text-muted text-sm">
        좌표 정보가 등록되어 있지 않아 주변 생활시설을 표시할 수 없습니다. 단지 주소를 참고하여 직접 확인해 주세요.
      </div>
    </SectionBlock>

    <PublicRentalNearbyComplexes
      :complexes="nearby"
      :city="rental.city"
      :district="rental.district"
      class="order-10 md:order-10"
    />

    <PublicRentalSiblings :siblings="siblings" class="order-10 md:order-10" />

    <!-- T5: FAQ (FAQPage JSON-LD는 라우트 페이지 setFAQSchema에서 발행) -->
    <PublicRentalFAQ class="order-11 md:order-11" />

    <!-- Ad③: 본문 마무리 (청약 패턴 3번) -->
    <AdBanner class="order-11 md:order-11" />

    <!-- T6: 데이터 출처 — 멀티루트 가능성 → wrapper div에 order (spec §3.3·④) -->
    <div class="order-12 md:order-12">
      <DataSourceSection domain="public-rental" :last-sync-date="lastSyncDate" />
    </div>
  </div>
```

> **order 매핑 정리:** 헤더 2종은 order 미부여(소스 순서상 가장 앞 + `md:hidden`/`hidden md:block`로 한쪽만 보임). 콘텐츠는 `order-2`부터 시작. 같은 order-10(T4 3개)·order-11(FAQ+광고③)·order-11/order-12 그룹은 **DOM 소스 순서가 곧 렌더 순서**(spec §3.3) → 소스에 주변생활시설 → 인근단지 → 형제 / FAQ → 광고③ 순으로 배치해 의도 순서 보장. order는 1~12 범위 준수(JIT 안전, spec §3.3). 광고② 위치 이동: 기존 "위치(주변시설) 직후"에서 "임대유형 가이드(T3 첫 콘텐츠) 직후"로 한 칸 이동 — 청약 패턴 2번 주석 유지, 개수 3개 불변.

> **광고③ order-11 공유 주의:** 광고③(`order-11`)이 FAQ(`order-11`)와 같은 값이고, 소스에서 FAQ가 광고③보다 위에 있으므로 FAQ→광고③ 순서가 보장된다. 출처는 order-12로 항상 마지막.

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: PASS — 전체(11 + 3 = 14 tests). `order-2`/`md:order-2`/`order-12`/`md:order-12` 토큰 존재, AdBanner 3개, 핵심 섹션 전부 렌더, 콘솔 에러 없음.

- [ ] **Step 5: 커밋**

```bash
cd frontend
git add components/subscription/PublicRentalDetailView.vue \
        tests/components/subscription/PublicRentalDetailView.test.ts
git commit -m "refactor(public-rental): 섹션 우선순위 재배치 (order, 교육형 T3 강등, 주변시설→T4, 광고② 이동)"
```

---

### Task 4: (선택) 모바일 지도 높이 220px 통일

spec §4.7·§7은 모바일 지도 높이 300→220 통일을 **권고이나 디자인 인상 변화라 적용 시 확인**으로 둔다. 적용하려면 `utils/mapMedia.ts`의 `DETAIL_MAP_MEDIA_HEIGHT`(`'h-[220px] md:h-[300px]'`)를 재사용한다. **기본은 미적용(주석 안내만)** — 본 Task는 사용자 확인 후에만 진행한다.

**Files:**
- Modify(선택): `frontend/components/subscription/PublicRentalDetailView.vue` 위치 지도 div의 `h-[300px] md:h-[360px]`

- [ ] **Step 1 (선택, 사용자 승인 시): mapMedia 상수 적용**

`frontend/components/subscription/PublicRentalDetailView.vue` 위치 섹션 지도 div:

```vue
<!-- before -->
      <div v-if="hasCoords" class="rounded-xl border border-line overflow-hidden h-[300px] md:h-[360px]">
```
```vue
<!-- after (승인 시) -->
      <div v-if="hasCoords" :class="['rounded-xl border border-line overflow-hidden', DETAIL_MAP_MEDIA_HEIGHT]">
```

그리고 script import에 추가:
```ts
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'
```

- [ ] **Step 2 (선택): 테스트 + 커밋**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: PASS (높이는 시각 변경이라 테스트 영향 없음).

```bash
cd frontend
git add components/subscription/PublicRentalDetailView.vue
git commit -m "style(public-rental): 모바일 지도 높이 220px 통일 (mapMedia 상수)"
```

> **기본 권장:** 사용자 디자인 확인 전에는 이 Task를 건너뛴다. 위 §4.7 "300px — 디자인 인상 변화라 적용 시 확인" 제약 준수.

---

### Task 5: 전체 검증 (h1 count, vitest, 빌드, 캐시)

**Files:**
- (변경 없음 — 검증 전용)

- [ ] **Step 1: 공공임대 상세 테스트 전체 통과**

Run: `cd frontend && npx vitest run tests/components/subscription/PublicRentalDetailView.test.ts`
Expected: PASS (14 tests, Task 4 미적용 기준).

- [ ] **Step 2: 인접 영향 테스트 통과 (헤더 강등 회귀 점검)**

Run: `cd frontend && npx vitest run tests/components/subscription/`
Expected: PASS — `PublicRentalCard`/`PublicRentalListView`/`RentalPriceStatsBox`/`SubscriptionScheduleTimeline` 등 인접 테스트 무영향. (헤더 변경은 상세 뷰 한정.)

- [ ] **Step 3: 전체 프론트 테스트 + 빌드**

Run: `cd frontend && npx vitest run && npm run build`
Expected: 전체 PASS + 빌드 성공. (공용 헤더 import resolve OK — Foundation 선행 전제.)

- [ ] **Step 4: 단일 h1 / 광고 개수 / Nitro 캐시 수동 점검 (dev 스모크)**

Nitro route cache가 stale일 수 있으므로(spec §3.3·§8) 캐시 삭제 후 dev 재시작:
```bash
cd frontend
rm -rf .nuxt/cache/nitro/routes
nvm use 20 && npm run dev
```
브라우저에서 `/public-rental/buy-lease/<유효 id>` 접속 후 DevTools 콘솔에서:
```js
document.querySelectorAll('h1').length   // 기대: 1
document.querySelectorAll('ins.adsbygoogle, [data-ad-slot]').length  // 기대: 3 (재배치 전과 동일)
```
- 모바일 뷰포트(≤767px): 공용 MobileDetailHeader 노출 + 데스크톱 헤더 숨김, h1 1개.
- 데스크톱 뷰포트(≥768px): PublicRentalDetailHeader(div role=heading) 노출 + 모바일 헤더 숨김, h1 1개.
- 광고 3개 위치: T1 직후 / 임대유형 가이드 직후 / FAQ 직후.

- [ ] **Step 5: (커밋 불요) 검증 결과 기록**

검증 통과 시 별도 커밋 없음. 실패 시 해당 Task로 돌아가 수정 후 재검증.

---

## Self-Review

**Spec §4.7(공공임대) 항목 커버:**
- ✅ T1 = 가격 카드 + 스펙 그리드 (order-2/order-3, T1 직후 광고①).
- ✅ 임대유형 가이드·자격·신청 가이드 = **T3로 강등** (order-6/8/9, 위치 T2 뒤).
- ✅ 주변시설을 위치(T2)에서 **분리**해 인근단지·형제와 함께 **T4**로 (order-10 그룹, 소스 순서 주변시설→인근단지→형제).
- ✅ 광고② = 위치 직후 → **교육형 콘텐츠 사이(임대유형 가이드 직후)로 이동** (order-7), AdBanner **3개 불변**(Task3 테스트로 카운트).
- ✅ ＋모바일 헤더 신규 도입(결정 2) + PageHero/데스크톱 헤더 `title-tag` 대신 `PublicRentalDetailHeader` h1을 `div role=heading aria-level=1`+`hidden md:block`로 강등(단일 h1 §3.1).
- ✅ 모바일 지도 220px 통일 = **선택 Task로 분리**(§4.7·§7 "적용 시 확인" 준수, 기본 미적용).
- ✅ `setFAQSchema(PUBLIC_RENTAL_FAQ)` = 라우트 페이지 `[id].vue:167`에서 이미 발행 중 → 본 플랜은 손대지 않음(유지). FAQ 섹션(T5)도 그대로 렌더.

**불변 규칙(§3) 점검:**
- §3.1 단일 h1: 모바일 헤더 literal h1 1개 + 데스크톱 div role=heading → `findAll('h1') === 1` 테스트로 가드.
- §3.2 광고 cadence: 광고① T1 직후(고가시성), 광고② T3 콘텐츠 사이, 광고③ FAQ 뒤 본문 마무리. 개수 3개 고정.
- §3.3 order 1~12: 최대 order-12, 13+ 없음. T4(order-10)·FAQ/광고③(order-11) 동일값 그룹은 DOM 소스 순서로 의도 순서 보장.
- §3.3·④ 멀티루트: `DataSourceSection`은 wrapper `<div class="order-12 md:order-12">`로 감쌈(class fall-through 회피).
- §3.4 headline-first: 가격카드·스펙그리드·헤더 stat 칩(보증금 headline color=text-primary)으로 대표 수치 우선. 섹션 내부 컴포넌트는 리라이트 없음(순서/order/헤더 추가만).

**플레이스홀더 스캔:** "TODO"/"적절히"/"위와 유사" 없음. 모든 재배치는 실제 before→after 마크업 코드 블록으로 제시(Task 1 헤더 강등, Task 2 헤더 추가, Task 3 전체 본문 교체). order 값은 명시 숫자(1~12).

**타입/prop 일관성:**
- `MobileDetailHeader` props 사용(`title`/`eyebrow`/`stats`/`hide-directions`/`kakao-map-url`/`naver-map-url`)·emits(`share`/`directions(provider)`)는 Foundation 플랜 정의와 일치. `phone`/`copyable` 미전달(공공임대는 단지 단위라 전화·복사 불요) → pill 자동 숨김.
- `stats` 항목 shape `{label,value,color?}` 일치. `fmtDeposit`/`fmtRent`/`fmtArea`/`fmtCount`/`isJeonseRental`는 `utils/publicRentalMeta`의 실제 export(검증 완료).
- `hasCoords`/`markerFacility`/`locationSubtext`는 기존 computed 재사용. `displayName`은 헤더용으로 신규 추가(데스크톱 헤더의 동일 로직과 일관 — 중복이지만 자식 컴포넌트 경계상 허용, 큰 리라이트 회피).

**리스크(§8 대응):**
- 단일 h1 회귀: Task 1·2를 한 커밋으로 묶어 "h1 0개" 중간 상태 미커밋. `findAll('h1')===1` 테스트 가드.
- 카카오맵 이중 초기화: 위치 섹션은 모바일/데스크톱 공용 단일 `FacilityMap`(분기 없음) → 더블 마운트 없음. (시설/지하철처럼 사이드바 중복 지도 패턴이 아니므로 v-if 분기 불요.)
- order-10/order-11 공유군: 소스 순서로 의도 순서 보장(주변시설→인근단지→형제 / FAQ→광고③).
- Nitro 캐시: Task 5 Step 4에서 `.nuxt/cache/nitro/routes` 삭제 후 dev 재시작 명시.
- `ref` auto-import 함정(MEMORY): Step 3에서 명시 import 안내(미사용 시 제거 단서 포함).
