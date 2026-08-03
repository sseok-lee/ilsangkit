# LoadingSkeleton 공유 컴포넌트 (⑤A PR2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드 그리드 로딩 스켈레톤을 공유 `LoadingSkeleton`으로 추출(출력 동일).

**Architecture:** `LoadingSkeleton.vue`는 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4`에 카드 N개를 렌더. `variant`로 두 모양 지원: `facility-card`(아바타+라인+칩 2개) / `card`(스택 라인 3개, `footer`면 버튼 바 추가). a11y `role=status` wrapper는 호출부 유지(현재 [category]/subway만 가짐).

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-shared-ux-components-design.md` (PR2)

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). `frontend/`. 브랜치 `feat/loading-skeleton`. 커밋 명시 경로만(절대 `git add -A` 금지).

## 현재 스켈레톤 (보존 대상 — 출력 동일)
모두 `grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4` + 카드 6개 `bg-white rounded-xl p-4 border border-line animate-pulse`:
- **facility-card** (byte-identical 2곳): `pages/[category]/index.vue`(`:166-180`, `<div role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">` 안), `pages/subway/index.vue`(`:75-90`, 동일 a11y wrapper 안). 카드 내부: `flex items-start gap-4` > 원형 `w-12 h-12 rounded-full bg-slate-200` + `flex-1 space-y-2.5`(h-4 w-3/4, h-3 w-full, `flex gap-2 mt-1`(h-5 w-14, h-5 w-20)).
- **card** (스택 라인): `PublicRentalListView`(`:36-44`, `space-y-3`: h-4 w-2/3, h-3 w-full, h-3 w-3/4), `SubscriptionListView`(`:70-79`, SectionBlock 안, 동일 + `h-8 w-24 mt-4` 버튼 바 1개 추가).

---

## Task 1: LoadingSkeleton 컴포넌트 + 단위 테스트

**Files:**
- Create: `frontend/components/common/LoadingSkeleton.vue`
- Test: `frontend/tests/components/common/LoadingSkeleton.test.ts`

- [ ] **Step 1: 실패 테스트** — `frontend/tests/components/common/LoadingSkeleton.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'

describe('LoadingSkeleton', () => {
  it('기본 count(6)개의 카드를 렌더한다', () => {
    const w = mount(LoadingSkeleton)
    expect(w.findAll('.animate-pulse')).toHaveLength(6)
  })
  it('count prop을 반영한다', () => {
    const w = mount(LoadingSkeleton, { props: { count: 3 } })
    expect(w.findAll('.animate-pulse')).toHaveLength(3)
  })
  it('facility-card variant는 아바타 원형을 렌더한다', () => {
    const w = mount(LoadingSkeleton, { props: { variant: 'facility-card' } })
    expect(w.find('.rounded-full').exists()).toBe(true)
  })
  it('card variant 기본은 아바타 없음', () => {
    const w = mount(LoadingSkeleton, { props: { variant: 'card' } })
    expect(w.find('.rounded-full').exists()).toBe(false)
  })
  it('footer=true면 버튼 바(h-8 w-24)를 추가한다', () => {
    const w = mount(LoadingSkeleton, { props: { variant: 'card', footer: true, count: 1 } })
    expect(w.find('.h-8.w-24').exists()).toBe(true)
  })
  it('카드 그리드 컨테이너 클래스를 가진다', () => {
    const w = mount(LoadingSkeleton)
    expect(w.find('.grid.grid-cols-1').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/common/LoadingSkeleton.test.ts` → FAIL.

- [ ] **Step 3: 컴포넌트** — `frontend/components/common/LoadingSkeleton.vue`
```vue
<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div v-for="i in count" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
      <div v-if="variant === 'facility-card'" class="flex items-start gap-4">
        <div class="shrink-0 w-12 h-12 rounded-full bg-slate-200"></div>
        <div class="flex-1 space-y-2.5">
          <div class="h-4 bg-slate-200 rounded w-3/4"></div>
          <div class="h-3 bg-slate-100 rounded w-full"></div>
          <div class="flex gap-2 mt-1">
            <div class="h-5 bg-slate-100 rounded-md w-14"></div>
            <div class="h-5 bg-slate-100 rounded-md w-20"></div>
          </div>
        </div>
      </div>
      <div v-else class="space-y-3">
        <div class="h-4 bg-slate-200 rounded w-2/3"></div>
        <div class="h-3 bg-slate-100 rounded w-full"></div>
        <div class="h-3 bg-slate-100 rounded w-3/4"></div>
        <div v-if="footer" class="h-8 bg-slate-200 rounded w-24 mt-4"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'facility-card' | 'card'
  count?: number
  footer?: boolean
}>(), {
  variant: 'card',
  count: 6,
  footer: false,
})
</script>
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/common/LoadingSkeleton.test.ts` → PASS(6).

- [ ] **Step 5: lint + 커밋**
Run: `cd frontend && npx eslint components/common/LoadingSkeleton.vue` → 0 errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/common/LoadingSkeleton.vue frontend/tests/components/common/LoadingSkeleton.test.ts
git commit -m "feat(frontend): LoadingSkeleton 공유 컴포넌트 + 단위 테스트"
```

---

## Task 2: facility-card 적용 ([category]/index + subway/index)

**Files:**
- Modify: `frontend/pages/[category]/index.vue` (스켈레톤 `:166-180`)
- Modify: `frontend/pages/subway/index.vue` (스켈레톤 `:75-90`)

- [ ] **Step 1: [category]/index 교체**
파일을 읽어 로딩 스켈레톤 블록 확인. **a11y wrapper `<div role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">`는 유지**하고, 그 안의 `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> ...6 cards... </div>`만 `<LoadingSkeleton variant="facility-card" />`로 교체:
```vue
          <div v-if="loading || initialLoading" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
            <LoadingSkeleton variant="facility-card" />
          </div>
```
import 추가:
```ts
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
```
(바깥 `v-if="loading || initialLoading"` 조건 유지.)

- [ ] **Step 2: subway/index 교체**
동일하게 a11y wrapper(`v-if="pending"`) 유지, 내부 grid를 `<LoadingSkeleton variant="facility-card" />`로 교체. import 추가.
```vue
        <div v-if="pending" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
          <LoadingSkeleton variant="facility-card" />
        </div>
```

- [ ] **Step 3: 회귀 + lint + 커밋**
Run: `cd frontend && npx vitest run tests/pages` → PASS.
Run: `cd frontend && npx eslint pages/\[category\]/index.vue pages/subway/index.vue` → 0 new errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/\[category\]/index.vue frontend/pages/subway/index.vue
git commit -m "refactor(frontend): [category]/subway 로딩 스켈레톤을 LoadingSkeleton으로 교체"
```

---

## Task 3: card 적용 (PublicRentalListView + SubscriptionListView)

**Files:**
- Modify: `frontend/components/subscription/PublicRentalListView.vue` (스켈레톤 `:36-44`)
- Modify: `frontend/components/subscription/SubscriptionListView.vue` (스켈레톤 `:70-79`)

- [ ] **Step 1: PublicRentalListView 교체**
`<div v-if="loading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"> ...6 cards(3 lines)... </div>`를 교체:
```vue
      <LoadingSkeleton v-if="loading" variant="card" />
```
import 추가:
```ts
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
```

- [ ] **Step 2: SubscriptionListView 교체**
SectionBlock 안의 스켈레톤 grid(`:70-79`, 카드에 `h-8 w-24 mt-4` 버튼 바 포함)를 `footer=true`로 교체:
```vue
    <SectionBlock v-if="pending" :heading="`${getStatusLabel(currentStatus) || '전체'} 청약`">
      <LoadingSkeleton variant="card" :footer="true" />
    </SectionBlock>
```
import 추가. (SectionBlock wrapper/heading 유지.)

- [ ] **Step 3: 회귀 + lint + 커밋**
Run: `cd frontend && npx vitest run tests/components/subscription` → PASS(로딩 상태 테스트 있으면 통과).
Run: `cd frontend && npx eslint components/subscription/PublicRentalListView.vue components/subscription/SubscriptionListView.vue` → 0 new errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/subscription/PublicRentalListView.vue frontend/components/subscription/SubscriptionListView.vue
git commit -m "refactor(frontend): 청약/공공임대 로딩 스켈레톤을 LoadingSkeleton으로 교체"
```

---

## Task 4: 회귀 검증 + PR

- [ ] **Step 1: 관련 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/common/LoadingSkeleton.test.ts tests/pages tests/components/subscription`
Expected: PASS.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5` → 0 errors.

- [ ] **Step 3: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 4: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.

- [ ] **Step 5: PR**
```bash
git push -u origin feat/loading-skeleton
gh pr create --base develop --title "공유 컴포넌트 ⑤A PR2: LoadingSkeleton 추출 + 스켈레톤 통일" --body "audit ⑤A PR2. LoadingSkeleton 공유 컴포넌트(variant: facility-card/card, footer) 추출 후 [category]/index·subway/index·PublicRentalListView·SubscriptionListView 카드 그리드 스켈레톤 교체(output-preserving). a11y role=status wrapper는 호출부 유지."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** PR2 P2-1(LoadingSkeleton)=T1 / P2-2(적용 4곳)=T2(facility-card)·T3(card). 검증=T4.
- **Placeholder scan:** 코드 단계 실제 코드. "파일 읽고 확인"은 정확성 지시.
- **Type consistency:** `LoadingSkeleton` props(variant 'facility-card'|'card' / count / footer) — T1 정의, T2(facility-card)·T3(card, footer) 사용 일관. 4곳 모두 동일 grid 클래스라 cols prop 불요.
- **위험 관리:** facility-card는 [category]/subway와 byte-identical, card(footer 분기)는 PublicRental(3라인)·Subscription(3라인+버튼) 정확 재현 → output-preserving. a11y wrapper는 호출부 유지(추가/제거 없음). 로컬 시각 검증 불가하나 위험 낮음.
- **Out of scope:** RegionCascadingDropdown, 차트 a11y, 헤더, 깔때기, 지도/정렬, bg-slate-50 박스형 빈 상태.
