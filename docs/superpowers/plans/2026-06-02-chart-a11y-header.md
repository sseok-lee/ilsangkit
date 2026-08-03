# 차트 a11y + 헤더 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** RentRatioBar에 role/aria-label + 0% 라벨 처리를 추가하고, faq 헤더를 StaticPageHeader로 통일한다.

**Architecture:** 두 개의 독립적 소수정. RentRatioBar는 막대 컨테이너에 `role="img"`+요약 `aria-label`, 0% 세그먼트 라벨 가드. faq는 raw h1+desc를 공유 `StaticPageHeader`로 교체.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-chart-a11y-header-design.md`

**전제:** Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`). `frontend/`. 브랜치 `feat/chart-a11y-header`. 커밋 명시 경로만(절대 `git add -A` 금지).

---

## Task 1: RentRatioBar 접근성 + 0% 처리

**Files:**
- Modify: `frontend/components/realEstate/RentRatioBar.vue`
- Test: `frontend/tests/components/realEstate/RentRatioBar.test.ts` (기존, 케이스 추가)

- [ ] **Step 1: 실패 테스트 추가** — `frontend/tests/components/realEstate/RentRatioBar.test.ts`
기존 2개 테스트 유지하고 아래 케이스 추가:
```ts
  it('role="img"와 비율·건수 요약 aria-label을 가진다', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 7, wolseCount: 3 } })
    const bar = w.find('[role="img"]')
    expect(bar.exists()).toBe(true)
    const label = bar.attributes('aria-label') ?? ''
    expect(label).toContain('전세 70%')
    expect(label).toContain('월세 30%')
    expect(label).toContain('전세 7건')
    expect(label).toContain('월세 3건')
  })
  it('한쪽이 0%면 그 세그먼트 라벨 텍스트를 렌더하지 않는다(0% 깨짐 방지)', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 0, wolseCount: 5 } })
    // 보이는 막대 텍스트에 "전세 0%"는 없어야 함
    expect(w.text()).not.toContain('전세 0%')
    expect(w.text()).toContain('월세 100%')
  })
```

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/components/realEstate/RentRatioBar.test.ts`
Expected: 신규 2 케이스 FAIL(role 없음 / "전세 0%"가 현재는 렌더됨).

- [ ] **Step 3: 컴포넌트 수정** — `frontend/components/realEstate/RentRatioBar.vue`
template + script 교체:
```vue
<template>
  <div v-if="total > 0" data-testid="rent-ratio">
    <div
      class="flex h-6 w-full overflow-hidden rounded-lg text-xs font-bold"
      role="img"
      :aria-label="ariaLabel"
    >
      <div class="flex items-center justify-center bg-primary text-white" :style="{ width: jeonsePct + '%' }">
        <span v-if="jeonsePct > 0">전세 {{ jeonsePct }}%</span>
      </div>
      <div class="flex items-center justify-center bg-primary-100 text-primary-700" :style="{ width: (100 - jeonsePct) + '%' }">
        <span v-if="100 - jeonsePct > 0">월세 {{ 100 - jeonsePct }}%</span>
      </div>
    </div>
    <p class="mt-1 text-xs text-slate-500">전체 거래 기준 전세 {{ jeonseCount }}건 · 월세 {{ wolseCount }}건</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { getJeonsePct } from '~/utils/realEstateDetailLabels'

const props = withDefaults(defineProps<{ jeonseCount?: number; wolseCount?: number }>(), {
  jeonseCount: 0,
  wolseCount: 0,
})

const total = computed(() => props.jeonseCount + props.wolseCount)
const jeonsePct = computed(() => getJeonsePct(props.jeonseCount, props.wolseCount))
const ariaLabel = computed(() =>
  `전세 ${jeonsePct.value}%, 월세 ${100 - jeonsePct.value}% (전세 ${props.jeonseCount}건, 월세 ${props.wolseCount}건)`,
)
</script>
```
(pct>0 세그먼트는 기존과 동일 출력. 0% 세그먼트는 width 0%라 시각적으로 사라지며 라벨 텍스트만 가드됨.)

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/components/realEstate/RentRatioBar.test.ts` → PASS(기존 2 + 신규 2 = 4).
(주: 기존 "전세 70%"/"월세 30%" 단언은 여전히 `w.text()`에 포함되어 통과 — 70/30은 둘 다 >0.)

- [ ] **Step 5: lint + 커밋**
Run: `cd frontend && npx eslint components/realEstate/RentRatioBar.vue` → 0 errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/realEstate/RentRatioBar.vue frontend/tests/components/realEstate/RentRatioBar.test.ts
git commit -m "fix(frontend): RentRatioBar role/aria-label + 0% 라벨 처리"
```

---

## Task 2: faq 헤더를 StaticPageHeader로 통일

**Files:**
- Modify: `frontend/pages/faq.vue` (헤더 `:4-7`, import 추가)
- Test: `frontend/tests/pages/faq.test.ts` (신규)

- [ ] **Step 1: 실패 테스트** — `frontend/tests/pages/faq.test.ts`
(privacy.test.ts 패턴 차용)
```ts
import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import FaqPage from '~/pages/faq.vue'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setFAQSchema: vi.fn() }),
}))

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({ render() { return h(Suspense, null, { default: () => h(component) }) } }),
    { global: { components: { StaticPageHeader }, stubs: { NuxtLink: { template: '<a><slot /></a>' }, AdBanner: true } } },
  )
  await flushPromises()
  return wrapper
}

describe('FAQ Page', () => {
  it('StaticPageHeader로 제목을 렌더한다', async () => {
    const wrapper = await mountSuspended(FaqPage)
    expect(wrapper.find('h1').text()).toContain('자주 묻는 질문')
  })
})
```
(주: faq.vue가 useStructuredData에서 실제로 쓰는 setter명(setBreadcrumbSchema/setFAQSchema 등)을 파일에서 확인해 mock에 모두 포함시킬 것 — 누락 시 `is not a function`으로 마운트 실패. 파일 읽고 destructure된 함수 전부 mock.)

- [ ] **Step 2: 실패 확인**
Run: `cd frontend && npx vitest run tests/pages/faq.test.ts`
Expected: 통과하거나(현재도 raw h1이 "자주 묻는 질문" 렌더) — 이 테스트는 회귀 가드 성격. 현재 raw h1으로도 통과할 수 있음. 그 경우 Step3 교체 후에도 통과(StaticPageHeader가 동일 h1 렌더)면 OK. 마운트가 mock 누락으로 실패하면 mock 보강.

- [ ] **Step 3: faq.vue 헤더 교체**
`pages/faq.vue`의 헤더(`:4-7`):
```html
      <h1 class="text-2xl md:text-3xl font-bold mb-2">자주 묻는 질문</h1>
      <p class="text-slate-500 text-sm mb-5">
        일상킷에서 제공하는 부동산 실거래가와 생활시설 정보에 대해 자주 묻는 질문을 모았습니다.
      </p>
```
를 교체:
```html
      <StaticPageHeader
        title="자주 묻는 질문"
        lead="일상킷에서 제공하는 부동산 실거래가와 생활시설 정보에 대해 자주 묻는 질문을 모았습니다."
      />
```
import 추가(스크립트 상단 import 영역):
```ts
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'
```

- [ ] **Step 4: 통과 확인**
Run: `cd frontend && npx vitest run tests/pages/faq.test.ts` → PASS.

- [ ] **Step 5: lint + 커밋**
Run: `cd frontend && npx eslint pages/faq.vue` → 0 new errors.
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/faq.vue frontend/tests/pages/faq.test.ts
git commit -m "refactor(frontend): faq 헤더를 StaticPageHeader로 통일"
```

---

## Task 3: 회귀 검증 + PR

- [ ] **Step 1: 관련 테스트**
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/realEstate/RentRatioBar.test.ts tests/pages/faq.test.ts`
Expected: PASS.

- [ ] **Step 2: lint**
Run: `cd frontend && npm run lint 2>&1 | tail -5` → 0 errors.

- [ ] **Step 3: 전체 테스트**
Run: `cd frontend && npm run test 2>&1 | tail -8` → 전체 PASS.

- [ ] **Step 4: SSR 빌드**
Run: `cd frontend && npm run build 2>&1 | tail -8` → exit 0.

- [ ] **Step 5: PR**
```bash
git push -u origin feat/chart-a11y-header
gh pr create --base develop --title "차트 a11y + 헤더 통일: RentRatioBar role/aria-label + faq StaticPageHeader" --body "audit ⑤ 일부. RentRatioBar에 role=img+aria-label 및 0% 세그먼트 라벨 가드, faq raw h1→StaticPageHeader 통일. PriceTrendChart는 이미 SSR 스켈레톤 보유로 변경 없음."
```
CI 통과 후 머지.

---

## Self-Review 결과

- **Spec coverage:** ①(RentRatioBar a11y+0%)=T1 / ②(faq 헤더)=T2. PriceTrendChart=변경없음(spec 명시). 검증=T3.
- **Placeholder scan:** 코드 단계 실제 코드. T2의 "useStructuredData setter명 파일에서 확인"은 정확성 지시(mock 완전성).
- **Type consistency:** `ariaLabel` computed(T1), `getJeonsePct` 기존 유틸. StaticPageHeader props(title/lead) 기존 컴포넌트와 일치.
- **위험:** RentRatioBar pct>0 세그먼트 출력 동일, 0%만 라벨 가드(시각적으로 이미 안 보이던 것). faq 헤더는 간격 미세 정규화. 둘 다 저위험·단위테스트.
- **Out of scope:** PageHero 타이포 통일, StaticPageHeader 📅 이모지(⑥).
