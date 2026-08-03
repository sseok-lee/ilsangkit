# EmptyState 공유 컴포넌트 (⑤A PR1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 동일한 "원형 아이콘 + 제목 + 설명 + 액션" 빈 상태를 쓰는 페이지들을 공유 `EmptyState` 컴포넌트로 추출(출력 동일).

**Architecture:** `EmptyState.vue`는 아이콘 원형 + 제목 + 설명을 렌더하고, 액션 영역은 free-form 기본 슬롯으로 둔다(호출부가 기존 CTA 마크업을 그대로 슬롯에 전달 → 픽셀 동일). 캐노니컬 모양을 쓰는 `[category]/index`·`subway/index`·`search.vue`에만 적용. 다른 모양(bg-slate-50 박스: SubscriptionListView/PublicRentalListView)은 후속.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-shared-ux-components-design.md` (PR1)

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). `frontend/`. 브랜치 `feat/empty-state-component`. 커밋 명시 경로만(절대 `git add -A` 금지).

## 캐노니컬 빈 상태(보존 대상 — 출력 동일)
세 곳이 동일 구조:
```html
<div class="py-12 text-center">
  <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
    <span class="material-symbols-outlined text-[32px] text-slate-500">{icon}</span>
  </div>
  <p class="text-slate-700 font-semibold text-lg">{title}</p>
  <p class="text-slate-500 text-sm mt-1 mb-6">{description}</p>
  <div class="flex ...">{CTA들}</div>
</div>
```
- `pages/[category]/index.vue:194-` (icon=categoryMeta.icon||search_off; CTA: 필터 초기화 + 홈)
- `pages/subway/index.vue:100-` (icon=subway; CTA: 필터 초기화 + 홈)
- `pages/search.vue` flat-view empty(`:337-361`, icon=search_off, CTA: 검색 초기화 + 홈) + grouped-view empty(`:367-392`, search_off, 카테고리 칩들 + 홈)

---

## Task 1: EmptyState 컴포넌트 + 단위 테스트

**Files:**
- Create: `frontend/components/common/EmptyState.vue`
- Test: `frontend/tests/components/common/EmptyState.test.ts`

- [ ] **Step 1: 실패 테스트** — `frontend/tests/components/common/EmptyState.test.ts`
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '~/components/common/EmptyState.vue'

describe('EmptyState', () => {
  it('title과 기본 아이콘(search_off)을 렌더한다', () => {
    const w = mount(EmptyState, { props: { title: '검색 결과가 없습니다' } })
    expect(w.text()).toContain('검색 결과가 없습니다')
    expect(w.find('.material-symbols-outlined').text()).toBe('search_off')
  })
  it('icon prop을 반영한다', () => {
    const w = mount(EmptyState, { props: { title: 'x', icon: 'subway' } })
    expect(w.find('.material-symbols-outlined').text()).toBe('subway')
  })
  it('description이 있으면 렌더, 없으면 미렌더', () => {
    const withDesc = mount(EmptyState, { props: { title: 'x', description: '다른 검색어를 시도해보세요' } })
    expect(withDesc.text()).toContain('다른 검색어를 시도해보세요')
    const without = mount(EmptyState, { props: { title: 'x' } })
    expect(without.findAll('p').length).toBe(1) // 제목만
  })
  it('기본 슬롯(액션)을 렌더한다', () => {
    const w = mount(EmptyState, { props: { title: 'x' }, slots: { default: '<a class="cta">홈으로</a>' } })
    expect(w.find('a.cta').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/common/EmptyState.test.ts` → FAIL.

- [ ] **Step 3: 컴포넌트** — `frontend/components/common/EmptyState.vue`
```vue
<template>
  <div class="py-12 text-center">
    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
      <span class="material-symbols-outlined text-[32px] text-slate-500">{{ icon }}</span>
    </div>
    <p class="text-slate-700 font-semibold text-lg">{{ title }}</p>
    <p v-if="description" class="text-slate-500 text-sm mt-1 mb-6">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
}>(), {
  icon: 'search_off',
})
</script>
```
(주: 액션 영역은 free-form 슬롯 — 호출부가 기존 `<div class="flex ...">CTA</div>`를 그대로 슬롯에 넣어 출력 동일. description 없을 때 `mb-6` 사라지는 건 캐노니컬 적용처가 모두 description+액션을 가지므로 무영향.)

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/common/EmptyState.test.ts` → PASS(4).

- [ ] **Step 5: lint + 커밋**
Run: `cd frontend && npx eslint components/common/EmptyState.vue` → 0 errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/common/EmptyState.vue frontend/tests/components/common/EmptyState.test.ts
git commit -m "feat(frontend): EmptyState 공유 컴포넌트 + 단위 테스트"
```

---

## Task 2: [category]/index + subway/index 적용 (output-preserving)

**Files:**
- Modify: `frontend/pages/[category]/index.vue` (빈 상태 `:193-`)
- Modify: `frontend/pages/subway/index.vue` (빈 상태 `:100-`)

- [ ] **Step 1: [category]/index 교체**
먼저 파일을 읽어 빈 상태 블록 정확히 확인. `<div v-if="displayFacilities.length === 0" class="py-12 text-center"> ... </div>`의 **바깥 wrapper와 아이콘/제목/설명을 EmptyState로 교체하고, 기존 CTA `<div class="flex items-center justify-center gap-3">...</div>`는 슬롯으로 그대로 이동**:
```vue
            <EmptyState
              v-if="displayFacilities.length === 0"
              :icon="categoryMeta?.icon || 'search_off'"
              title="검색 결과가 없습니다"
              description="다른 지역이나 검색어를 시도해보세요"
            >
              <div class="flex items-center justify-center gap-3">
                <button
                  v-if="selectedCity || selectedDistrict || filterKeyword"
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  @click="selectedCity = ''; selectedDistrict = ''; filterKeyword = ''; performSearch()"
                >
                  <span class="material-symbols-outlined text-[16px]">refresh</span>
                  필터 초기화
                </button>
                <NuxtLink to="/" class="btn-primary inline-flex items-center gap-1.5 text-sm">
                  <span class="material-symbols-outlined text-[16px]">home</span>
                  홈으로 돌아가기
                </NuxtLink>
              </div>
            </EmptyState>
```
import 추가(`<script setup>` 상단):
```ts
import EmptyState from '~/components/common/EmptyState.vue'
```
(기존 CTA 버튼 마크업/핸들러는 그대로 — `@click` 인라인 표현식, 조건 동일.)

- [ ] **Step 2: subway/index 교체**
`<div v-else class="py-12 text-center"> ... </div>` 빈 상태를 동일 방식으로 EmptyState로 교체(icon="subway", CTA: 필터 초기화(@click="resetFilters", 조건 `selectedCitySlug || selectedDistrict || keyword`) + 홈). import 추가.
```vue
          <EmptyState v-else icon="subway" title="검색 결과가 없습니다" description="다른 지역이나 검색어를 시도해보세요">
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="selectedCitySlug || selectedDistrict || keyword"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="resetFilters"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                필터 초기화
              </button>
              <NuxtLink to="/" class="btn-primary inline-flex items-center gap-1.5 text-sm">
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </EmptyState>
```
(`v-else`가 걸린 컨텍스트 유지. 정확한 위치/조건은 파일 확인 후 맞출 것.)

- [ ] **Step 3: 회귀 + lint**
Run: `cd frontend && npx vitest run tests/pages` → 관련 페이지 테스트 통과(빈 상태 텍스트 "검색 결과가 없습니다" 단언이 있으면 그대로 통과 — 텍스트 보존).
Run: `cd frontend && npx eslint pages/\[category\]/index.vue pages/subway/index.vue` → 0 new errors.

- [ ] **Step 4: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/\[category\]/index.vue frontend/pages/subway/index.vue
git commit -m "refactor(frontend): [category]/subway 빈 상태를 EmptyState로 교체(output-preserving)"
```

---

## Task 3: search.vue 적용 (2개 빈 상태)

**Files:**
- Modify: `frontend/pages/search.vue` (flat-view empty `:337-361`, grouped-view empty `:367-392`)

- [ ] **Step 1: 파일 읽고 두 빈 상태 확인**
먼저 `pages/search.vue`의 두 빈 상태 블록을 읽어 정확한 마크업/CTA 확인.

- [ ] **Step 2: flat-view empty 교체**
`<div v-if="facilities.length === 0" class="py-16 text-center"> ... </div>`(또는 해당 조건)을 EmptyState로 교체. **주의: 기존 wrapper가 `py-16`이면 EmptyState는 `py-12`라 미세 차이** — 출력 정확 보존을 위해 EmptyState에 패딩을 강제할 수 없으니, search의 wrapper 패딩이 `py-16`이면 EmptyState 적용 시 `py-12`로 바뀜(미세 시각 변경). search의 두 빈 상태가 `py-16`인지 `py-12`인지 확인:
  - `py-12`면 그대로 EmptyState 교체(동일).
  - `py-16`이면 EmptyState를 감싸지 말고, 이 항목은 **교체하지 말고 보고**(NEEDS_CONTEXT) — 또는 EmptyState에 `padding` 미세 차이를 수용할지 컨트롤러에 확인. (캐노니컬은 py-12.)
icon=search_off, title/description은 기존 텍스트 그대로, CTA(검색 초기화/홈, grouped는 칩들+홈)는 슬롯으로 이동.

- [ ] **Step 3: grouped-view empty 교체**
동일 방식. 칩 목록 `<div class="flex flex-wrap ...">...</div>` + 홈 링크를 슬롯에 그대로.

- [ ] **Step 4: 회귀 + lint**
Run: `cd frontend && npx vitest run tests/pages/search.test.ts` → PASS(빈 상태 텍스트 보존).
Run: `cd frontend && npx eslint pages/search.vue` → 0 new errors.
import 추가 확인.

- [ ] **Step 5: 커밋**
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/search.vue
git commit -m "refactor(frontend): search 빈 상태를 EmptyState로 교체"
```

---

## Task 4: 회귀 검증 + PR

- [ ] **Step 1: 관련 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/common/EmptyState.test.ts tests/pages`
Expected: PASS.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5` → 0 errors.

- [ ] **Step 3: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 4: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.

- [ ] **Step 5: PR**
```bash
git push -u origin feat/empty-state-component
gh pr create --base develop --title "공유 컴포넌트 ⑤A PR1: EmptyState 추출 + 빈 상태 통일" --body "audit ⑤A. EmptyState 공유 컴포넌트 추출 후 [category]/index·subway/index·search 빈 상태를 교체(output-preserving, 캐노니컬 원형아이콘 모양). bg-slate-50 박스형(SubscriptionListView/PublicRentalListView)은 시각 정규화라 후속."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** PR1 P1-1(EmptyState)=T1 / P1-2(적용)=T2·T3. 검증=T4. 적용 범위는 캐노니컬-모양 3페이지로 한정(spec의 "output-preserving 우선" 준수). bg-slate-50 박스형은 비범위로 명시.
- **Placeholder scan:** 코드 단계 실제 코드. T3의 py-16/py-12 확인 분기 및 "파일 읽고 확인"은 정확성 위한 지시(플레이스홀더 아님).
- **Type consistency:** `EmptyState` props(icon?/title/description?) + free-form slot — T1 정의, T2·T3 사용 일관.
- **위험 관리:** free-form 슬롯으로 CTA를 그대로 이동 → 출력 동일. py-16 불일치 가능성은 T3에서 확인/에스컬레이션. 로컬 시각 검증 불가하나 output-preserving이라 위험 낮음.
- **Out of scope:** LoadingSkeleton(PR2), RegionCascadingDropdown(후속), bg-slate-50 박스형 빈 상태(후속 정규화), 단순 `<p>` 빈 상태.
