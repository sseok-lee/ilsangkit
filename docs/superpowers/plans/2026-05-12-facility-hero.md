# 시설 상세페이지 히어로 영역 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설 상세 페이지(`/[category]/[id]`) 히어로 카드에 운영상태 배지와 [길찾기·전화·공유] CTA 행을 추가하고, stats/소개문 로직을 카테고리 헬퍼 파일로 분리한다.

**Architecture:** 기존 공통 컴포넌트 `PageHero`에 선택적 `badge` 슬롯과 `actions` prop을 추가하고(다른 페이지의 호출부는 그대로 동작), 시설 상세 페이지가 새 헬퍼 `frontend/utils/facilityHeroMeta.ts`로부터 배지·CTA·stats 데이터를 받아 주입한다. 기존 `OperatingStatusBadge`·`getOperatingStatus`·`facilityPhone`·`kakaoMapUrl`을 그대로 재사용한다.

**Tech Stack:** Vue 3 / Nuxt 3 / TypeScript / Tailwind CSS / Vitest / happy-dom

---

## 사전 컨텍스트 (구현 전 필독)

### 재사용 자산
- `frontend/components/facility/OperatingStatusBadge.vue` — `status: open24h|openNow|closed|limited` 4-state 배지. **그대로 사용**한다. 스펙 시안의 녹/적/보라 컬러 배경은 도입하지 않음 (안티-AI슬롭, 정보 우선 원칙에 따라 기존 slate 톤 유지).
- `frontend/utils/facilityStatus.ts` `getOperatingStatus(facility)` — 운영상태 판정 로직.
- `frontend/pages/[category]/[id].vue:579` `facilityPhone` computed — 전화번호 추출 로직.
- `frontend/pages/[category]/[id].vue:586` `kakaoMapUrl`, `naverMapUrl` computed.

### 변경 후 유지
- 모바일 240px 상단 지도 블록(`[id].vue:31`–`61`).
- 데스크톱 sticky 사이드바 지도(`[id].vue:190`–`202`)와 그 아래 쿠팡 배너·사이드바 광고.

### 제거 대상 (Task 6에서 처리)
- 모바일 fixed 하단 CTA 블록(`[id].vue:246`–`276`)과 그 직후 `<!-- Bottom padding for mobile CTA -->` spacer(`[id].vue:278`–`279`).
- 데스크톱 사이드바 하단 CTA 박스(`[id].vue:204`–`232`).
- 위 두 곳의 dropdown 상태 ref `showNavDropdown`, `showMobileNavDropdown` 및 토글 핸들러. 카카오/네이버 dropdown 기능은 히어로 길찾기 버튼으로 이동.

### 깨지면 안 되는 PageHero 다른 사용처
`PageHero`는 청약·공공임대·검색 페이지 등에서도 쓰인다. 신규 props(`badge`, `actions`)는 모두 **optional + default empty**로 추가해 기존 호출부에 영향을 주지 않는다.

---

## 파일 구조

### 신규 파일
- `frontend/utils/facilityHeroMeta.ts` — 카테고리별 배지·액션·stats를 빌드하는 순수 함수 모음.
- `frontend/tests/utils/facilityHeroMeta.test.ts` — 헬퍼 단위 테스트.
- `frontend/tests/components/common/PageHero.test.ts` — PageHero 신규 props 테스트.

### 수정 파일
- `frontend/components/common/PageHero.vue` — `badge` 슬롯, `actions` prop, CTA 행 렌더링 추가.
- `frontend/pages/[category]/[id].vue` — 인라인 `facilityIntro` / `desktopHeroStats` 제거, 헬퍼 호출로 교체, `<PageHero>`에 `actions` prop + `badge` 슬롯 전달.

### 변경하지 않는 파일
- `OperatingStatusBadge.vue`, `facilityStatus.ts` (스타일·동작 모두 그대로 재사용).
- 본문 섹션(`DetailBasicInfo`, `DetailFacilityStatus`, `FacilityRoadview`, `DetailNearby`, `DetailContextLinks`).

---

## Pre-flight

- [ ] **Step 0-1: 작업 브랜치 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout -b feat/facility-hero-cta
nvm use 20
```

- [ ] **Step 0-2: 의존성 정합 확인**

```bash
cd frontend && npm ci
```

`package-lock.json`을 절대 삭제하지 말 것 (메모리 규칙). Node 20 환경 필수.

- [ ] **Step 0-3: 베이스라인 테스트 통과 확인**

```bash
cd frontend && npm run test
```

Expected: 기존 테스트 전수 PASS (실패가 있으면 본 작업 시작 전에 먼저 고친다 — 메모리 규칙).

---

## Task 1: PageHero에 `badge` 슬롯 추가

**Files:**
- Modify: `frontend/components/common/PageHero.vue`
- Create: `frontend/tests/components/common/PageHero.test.ts`

배지를 prop이 아닌 **슬롯**으로 받는다 — 시설 페이지는 `OperatingStatusBadge`를 주입하고, 다른 페이지는 자체 배지 컴포넌트를 자유롭게 넣을 수 있다.

- [ ] **Step 1-1: 실패 테스트 작성**

`frontend/tests/components/common/PageHero.test.ts`를 생성:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PageHero from '~/components/common/PageHero.vue'

describe('PageHero', () => {
  it('renders badge slot next to title when provided', () => {
    const wrapper = mount(PageHero, {
      props: { title: '온누리약국 종로점', eyebrow: '약국' },
      slots: { badge: '<span data-test="badge">영업중</span>' },
    })
    const badge = wrapper.find('[data-test="badge"]')
    expect(badge.exists()).toBe(true)
    // 배지는 H1 컨테이너 안에 있어야 한다(같은 줄 정렬용).
    expect(wrapper.find('h1').element.contains(badge.element)).toBe(true)
  })

  it('omits badge container when slot is empty', () => {
    const wrapper = mount(PageHero, {
      props: { title: '온누리약국 종로점' },
    })
    expect(wrapper.find('[data-test="badge-wrap"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 1-2: 테스트 실행 → 실패 확인**

```bash
cd frontend && npx vitest run tests/components/common/PageHero.test.ts
```

Expected: FAIL (`[data-test="badge"]` not found).

- [ ] **Step 1-3: 구현 — H1 안에 슬롯 추가**

`frontend/components/common/PageHero.vue`의 `<h1>` 라인을 다음과 같이 교체:

```vue
<h1 class="text-display-1 text-slate-900 mb-2 flex items-center gap-2 flex-wrap">
  <slot name="title">{{ title }}</slot>
  <span v-if="$slots.badge" data-test="badge-wrap" class="inline-flex">
    <slot name="badge" />
  </span>
</h1>
```

`flex items-center gap-2 flex-wrap`로 긴 제목 줄바꿈 시 배지가 자연스럽게 따라가도록 한다.

- [ ] **Step 1-4: 테스트 실행 → 통과 확인**

```bash
cd frontend && npx vitest run tests/components/common/PageHero.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 1-5: 다른 호출처 회귀 확인**

```bash
cd frontend && npm run test
```

Expected: 전체 PASS.

- [ ] **Step 1-6: 커밋**

```bash
git add frontend/components/common/PageHero.vue frontend/tests/components/common/PageHero.test.ts
git commit -m "feat(PageHero): add optional badge slot next to title"
```

---

## Task 2: PageHero에 `actions` prop과 CTA 행 + dropdown 메뉴 지원 추가

**Files:**
- Modify: `frontend/components/common/PageHero.vue`
- Modify: `frontend/tests/components/common/PageHero.test.ts`

각 액션은 세 가지 모드 중 하나:
- `href` 있음 → 링크로 직접 이동(전화 `tel:` 등)
- `menu` 있음 → 클릭 시 dropdown 열고 메뉴 항목 클릭 시 이동(길찾기: 카카오/네이버 선택)
- 둘 다 없음 → `action` 이벤트 emit(공유)

- [ ] **Step 2-1: 실패 테스트 추가**

`frontend/tests/components/common/PageHero.test.ts`에 다음 case 추가:

```ts
  it('renders action buttons in order with primary highlighted', () => {
    const wrapper = mount(PageHero, {
      props: {
        title: '온누리약국 종로점',
        actions: [
          { type: 'directions', label: '길찾기', primary: true, menu: [
            { label: '카카오맵으로 길찾기', href: 'https://map.kakao.com/x' },
            { label: '네이버맵으로 길찾기', href: 'https://map.naver.com/x' },
          ] },
          { type: 'phone', label: '전화', href: 'tel:0212345678' },
          { type: 'share', label: '공유' },
        ],
      },
    })
    const buttons = wrapper.findAll('[data-test="hero-action"]')
    expect(buttons).toHaveLength(3)
    expect(buttons[0].text()).toContain('길찾기')
    expect(buttons[0].classes()).toContain('bg-primary')
    expect(buttons[1].attributes('href')).toBe('tel:0212345678')
    expect(buttons[2].element.tagName).toBe('BUTTON')   // href·menu 모두 없으면 button
  })

  it('toggles menu dropdown when an action with menu is clicked', async () => {
    const wrapper = mount(PageHero, {
      props: {
        title: 'X',
        actions: [
          { type: 'directions', label: '길찾기', primary: true, menu: [
            { label: '카카오맵', href: 'https://k.example' },
            { label: '네이버맵', href: 'https://n.example' },
          ] },
        ],
      },
    })
    expect(wrapper.find('[data-test="hero-action-menu"]').exists()).toBe(false)
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    const menu = wrapper.find('[data-test="hero-action-menu"]')
    expect(menu.exists()).toBe(true)
    const items = menu.findAll('a')
    expect(items).toHaveLength(2)
    expect(items[0].attributes('href')).toBe('https://k.example')
    expect(items[0].text()).toContain('카카오맵')
  })

  it('emits share event when share action without href or menu is clicked', async () => {
    const wrapper = mount(PageHero, {
      props: {
        title: 'X',
        actions: [{ type: 'share', label: '공유' }],
      },
    })
    await wrapper.find('[data-test="hero-action"]').trigger('click')
    expect(wrapper.emitted('action')).toBeTruthy()
    expect(wrapper.emitted('action')![0]).toEqual([{ type: 'share' }])
  })

  it('does not render action row when actions is empty', () => {
    const wrapper = mount(PageHero, { props: { title: 'X' } })
    expect(wrapper.find('[data-test="hero-actions"]').exists()).toBe(false)
  })
```

- [ ] **Step 2-2: 실패 확인**

```bash
cd frontend && npx vitest run tests/components/common/PageHero.test.ts
```

Expected: FAIL (3 new tests fail).

- [ ] **Step 2-3: 구현 — props·타입·렌더링 추가**

`frontend/components/common/PageHero.vue`의 `<script setup>` 블록 교체:

```ts
<script setup lang="ts">
import { ref } from 'vue'

interface Stat {
  label: string
  value: string
  color?: string
}

export interface HeroActionMenuItem {
  label: string
  href: string
  iconSrc?: string
}

export interface HeroAction {
  type: 'directions' | 'phone' | 'share'
  label: string
  href?: string
  primary?: boolean
  menu?: HeroActionMenuItem[]
}

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  stats?: Stat[]
  actions?: HeroAction[]
}>(), {
  eyebrow: '',
  title: '',
  description: '',
  stats: () => [],
  actions: () => [],
})

const emit = defineEmits<{
  (e: 'action', payload: { type: HeroAction['type'] }): void
}>()

const openMenu = ref<HeroAction['type'] | null>(null)

function onActionClick(action: HeroAction, event: Event) {
  if (action.menu && action.menu.length > 0) {
    event.preventDefault()
    openMenu.value = openMenu.value === action.type ? null : action.type
    return
  }
  if (!action.href) {
    event.preventDefault()
    emit('action', { type: action.type })
  }
}

function closeMenu() {
  openMenu.value = null
}
</script>
```

그리고 stats 그리드 아래(`</div>` 직전)에 CTA 행 추가:

```vue
<div
  v-if="actions.length > 0"
  data-test="hero-actions"
  class="mt-4 flex gap-2"
>
  <div
    v-for="action in actions"
    :key="action.type"
    class="relative flex-1"
  >
    <component
      :is="action.href ? 'a' : 'button'"
      :href="action.href"
      :target="action.href && action.type === 'directions' ? '_blank' : undefined"
      :rel="action.href && action.type === 'directions' ? 'noopener noreferrer' : undefined"
      data-test="hero-action"
      class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors"
      :class="action.primary
        ? 'bg-primary text-white hover:bg-blue-600'
        : 'bg-white border border-line text-slate-700 hover:border-primary hover:text-primary'"
      @click="(e) => onActionClick(action, e)"
    >
      {{ action.label }}
    </component>
    <div
      v-if="action.menu && openMenu === action.type"
      data-test="hero-action-menu"
      class="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl border border-line bg-white shadow-lg overflow-hidden"
    >
      <a
        v-for="item in action.menu"
        :key="item.href"
        :href="item.href"
        target="_blank"
        rel="noopener noreferrer"
        class="flex items-center gap-2 px-3 py-2.5 text-sm font-medium text-slate-900 hover:bg-gray-50"
        @click="closeMenu"
      >
        <img v-if="item.iconSrc" :src="item.iconSrc" alt="" class="w-5 h-5 rounded" />
        {{ item.label }}
      </a>
    </div>
  </div>
</div>
```

- [ ] **Step 2-4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run tests/components/common/PageHero.test.ts
```

Expected: 6 tests PASS (Task 1의 2개 + 신규 4개).

- [ ] **Step 2-5: 다른 페이지 회귀 확인**

```bash
cd frontend && npm run test
```

Expected: 전체 PASS.

- [ ] **Step 2-6: 커밋**

```bash
git add frontend/components/common/PageHero.vue frontend/tests/components/common/PageHero.test.ts
git commit -m "feat(PageHero): add actions prop with CTA row rendering"
```

---

## Task 3: `facilityHeroMeta.ts` — `buildHeroBadge`

**Files:**
- Create: `frontend/utils/facilityHeroMeta.ts`
- Create: `frontend/tests/utils/facilityHeroMeta.test.ts`

운영상태가 의미 없는 카테고리(wifi/clothes/parking/ev-charger)에서는 배지를 생략한다.

- [ ] **Step 3-1: 실패 테스트 작성**

`frontend/tests/utils/facilityHeroMeta.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildHeroBadge } from '~/utils/facilityHeroMeta'

describe('buildHeroBadge', () => {
  it('returns null for categories without meaningful operating status', () => {
    expect(buildHeroBadge({ category: 'wifi', details: { operationStatus: '운영' } } as any)).toBeNull()
    expect(buildHeroBadge({ category: 'clothes', details: {} } as any)).toBeNull()
    expect(buildHeroBadge({ category: 'parking', details: { operatingHours: '24시간' } } as any)).toBeNull()
    expect(buildHeroBadge({ category: 'ev-charger', details: {} } as any)).toBeNull()
  })

  it('returns open24h for 24h pharmacy', () => {
    expect(buildHeroBadge({
      category: 'pharmacy',
      details: { operatingHours: '24시간' },
    } as any)).toBe('open24h')
  })

  it('returns null when status cannot be determined', () => {
    expect(buildHeroBadge({ category: 'pharmacy', details: {} } as any)).toBeNull()
  })

  it('delegates to getOperatingStatus for supported categories', () => {
    expect(buildHeroBadge({
      category: 'aed',
      details: { is24Hour: true },
    } as any)).toBe('open24h')
  })
})
```

- [ ] **Step 3-2: 실패 확인**

```bash
cd frontend && npx vitest run tests/utils/facilityHeroMeta.test.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3-3: `facilityHeroMeta.ts` 신규 생성**

`frontend/utils/facilityHeroMeta.ts`:

```ts
import { getOperatingStatus, type OperatingStatus } from '~/utils/facilityStatus'
import type { FacilityCategory, FacilityDetail } from '~/types/facility'

const BADGE_OMIT: FacilityCategory[] = ['wifi', 'clothes', 'parking', 'ev-charger']

export function buildHeroBadge(facility: FacilityDetail): OperatingStatus {
  if (BADGE_OMIT.includes(facility.category)) return null
  return getOperatingStatus(facility as unknown as Record<string, unknown>)
}
```

- [ ] **Step 3-4: 테스트 통과 확인**

```bash
cd frontend && npx vitest run tests/utils/facilityHeroMeta.test.ts
```

Expected: 4 tests PASS.

- [ ] **Step 3-5: 커밋**

```bash
git add frontend/utils/facilityHeroMeta.ts frontend/tests/utils/facilityHeroMeta.test.ts
git commit -m "feat(facilityHeroMeta): add buildHeroBadge with per-category gating"
```

---

## Task 4: `buildHeroActions` 추가

**Files:**
- Modify: `frontend/utils/facilityHeroMeta.ts`
- Modify: `frontend/tests/utils/facilityHeroMeta.test.ts`

길찾기는 카카오/네이버 dropdown 메뉴를 가진 액션, 공유는 emit 트리거, 전화는 `tel:` 링크. URL 빌드는 호출부(page.vue)에서 주입한다(테스트성·SSR 안전성).

- [ ] **Step 4-1: 실패 테스트 추가**

`frontend/tests/utils/facilityHeroMeta.test.ts`에 추가:

```ts
import { buildHeroActions } from '~/utils/facilityHeroMeta'

describe('buildHeroActions', () => {
  const ctx = {
    kakaoMapUrl: 'https://map.kakao.com/x',
    naverMapUrl: 'https://map.naver.com/x',
  }

  it('returns directions with menu (kakao + naver) and share by default', () => {
    const actions = buildHeroActions({ category: 'toilet', phone: null } as any, ctx)
    expect(actions.map(a => a.type)).toEqual(['directions', 'share'])
    expect(actions[0].primary).toBe(true)
    expect(actions[0].href).toBeUndefined()
    expect(actions[0].menu).toHaveLength(2)
    expect(actions[0].menu![0].href).toBe('https://map.kakao.com/x')
    expect(actions[0].menu![1].href).toBe('https://map.naver.com/x')
  })

  it('inserts phone action between directions and share when phone exists', () => {
    const actions = buildHeroActions(
      { category: 'pharmacy', phone: '02-1234-5678' } as any,
      ctx,
    )
    expect(actions.map(a => a.type)).toEqual(['directions', 'phone', 'share'])
    expect(actions[1].href).toBe('tel:02-1234-5678')
  })

  it('skips phone action when phone is empty string or null', () => {
    const noPhone = buildHeroActions({ category: 'toilet', phone: '' } as any, ctx)
    expect(noPhone.find(a => a.type === 'phone')).toBeUndefined()
    const nullPhone = buildHeroActions({ category: 'toilet', phone: null } as any, ctx)
    expect(nullPhone.find(a => a.type === 'phone')).toBeUndefined()
  })

  it('share action has no href and no menu (handled by emit)', () => {
    const actions = buildHeroActions({ category: 'toilet' } as any, ctx)
    const share = actions.find(a => a.type === 'share')
    expect(share?.href).toBeUndefined()
    expect(share?.menu).toBeUndefined()
  })
})
```

- [ ] **Step 4-2: 실패 확인**

```bash
cd frontend && npx vitest run tests/utils/facilityHeroMeta.test.ts
```

Expected: FAIL (buildHeroActions not exported).

- [ ] **Step 4-3: 구현 추가**

`frontend/utils/facilityHeroMeta.ts`에 append:

```ts
// PageHero가 export하는 타입과 동일한 형태를 로컬에 재선언.
// Vitest+Nuxt에서 SFC 타입 import 회피용. 컴파일 시 호환성은 page.vue에서 동시 import로 검증됨.
export interface HeroActionMenuItem {
  label: string
  href: string
  iconSrc?: string
}

export interface HeroAction {
  type: 'directions' | 'phone' | 'share'
  label: string
  href?: string
  primary?: boolean
  menu?: HeroActionMenuItem[]
}

export interface HeroActionContext {
  kakaoMapUrl: string
  naverMapUrl: string
}

function pickPhone(facility: FacilityDetail): string | null {
  const phone = (facility as unknown as { phone?: string | null }).phone
  if (!phone || !phone.trim()) return null
  return phone.trim()
}

export function buildHeroActions(
  facility: FacilityDetail,
  ctx: HeroActionContext,
): HeroAction[] {
  const actions: HeroAction[] = [
    {
      type: 'directions',
      label: '길찾기',
      primary: true,
      menu: [
        { label: '카카오맵으로 길찾기', href: ctx.kakaoMapUrl, iconSrc: '/images/icons/kakaomap.svg' },
        { label: '네이버맵으로 길찾기', href: ctx.naverMapUrl, iconSrc: '/images/icons/navermap.svg' },
      ],
    },
  ]
  const phone = pickPhone(facility)
  if (phone) {
    actions.push({ type: 'phone', label: '전화', href: `tel:${phone}` })
  }
  actions.push({ type: 'share', label: '공유' })
  return actions
}
```

- [ ] **Step 4-4: 통과 확인**

```bash
cd frontend && npx vitest run tests/utils/facilityHeroMeta.test.ts
```

Expected: 8 tests PASS (4 + 4 신규).

- [ ] **Step 4-5: 커밋**

```bash
git add frontend/utils/facilityHeroMeta.ts frontend/tests/utils/facilityHeroMeta.test.ts
git commit -m "feat(facilityHeroMeta): add buildHeroActions with conditional phone"
```

---

## Task 5: `buildHeroStats` — 카테고리별 라벨 매핑, 최대 3개

**Files:**
- Modify: `frontend/utils/facilityHeroMeta.ts`
- Modify: `frontend/tests/utils/facilityHeroMeta.test.ts`

현재 `[id].vue:454`–`540`의 인라인 `desktopHeroStats` 로직을 그대로 이관하되 **최대 3개로 cap**한다. 전화번호는 더 이상 stats가 아닌 CTA로 들어가므로 stats 후보에서 제외한다.

- [ ] **Step 5-1: 실패 테스트 추가**

```ts
import { buildHeroStats } from '~/utils/facilityHeroMeta'

describe('buildHeroStats', () => {
  it('caps at 3 entries', () => {
    const stats = buildHeroStats({
      category: 'school',
      details: {
        operatingHours: '09-15',
        schoolLevel: '초등',
        foundationType: '공립',
        coeducationType: '남녀공학',
      },
    } as any)
    expect(stats.length).toBeLessThanOrEqual(3)
  })

  it('omits empty values', () => {
    const stats = buildHeroStats({ category: 'aed', details: {} } as any)
    expect(stats).toEqual([])
  })

  it('produces parking stats: capacity, fee, lot type', () => {
    const stats = buildHeroStats({
      category: 'parking',
      details: { capacity: 142, feeType: '5분 400원', lotType: '공영' },
    } as any)
    const labels = stats.map(s => s.label)
    expect(labels).toContain('주차면수')
    expect(labels).toContain('요금')
  })

  it('produces pharmacy stats without phone (phone moves to CTA)', () => {
    const stats = buildHeroStats({
      category: 'pharmacy',
      details: { operatingHours: '09-22' },
      phone: '02-1234-5678',
    } as any)
    expect(stats.find(s => s.label === '전화')).toBeUndefined()
  })

  it('produces hospital stats: clCdNm, drTotCnt, parkQty', () => {
    const stats = buildHeroStats({
      category: 'hospital',
      details: { clCdNm: '종합병원', drTotCnt: 12, parkQty: 50 },
    } as any)
    expect(stats[0]).toEqual({ label: '종별', value: '종합병원' })
    expect(stats[1]).toEqual({ label: '의사', value: '12명' })
  })

  it('produces 24h stat for facilities marked open24h', () => {
    const stats = buildHeroStats({
      category: 'toilet',
      details: { is24Hour: true },
    } as any)
    expect(stats.find(s => s.label === '운영')).toEqual({ label: '운영', value: '24시간' })
  })
})
```

- [ ] **Step 5-2: 실패 확인**

```bash
cd frontend && npx vitest run tests/utils/facilityHeroMeta.test.ts
```

Expected: FAIL (buildHeroStats not exported).

- [ ] **Step 5-3: 구현 추가**

`frontend/utils/facilityHeroMeta.ts`에 append:

```ts
import { formatOperatingHours } from '~/utils/formatOperatingHours'

export interface HeroStat {
  label: string
  value: string
  color?: string
}

const MAX_STATS = 3

export function buildHeroStats(facility: FacilityDetail): HeroStat[] {
  const cat = facility.category
  const d = (facility as unknown as { details?: Record<string, any> }).details ?? {}
  const items: HeroStat[] = []

  const is24h = d.operatingHours === '24시간' || d.is24Hour === true
  const showOperatingTopline = !['hospital', 'pharmacy', 'aed', 'library', 'parking'].includes(cat)

  if (is24h) {
    items.push({ label: '운영', value: '24시간' })
  } else if (d.operatingHours && showOperatingTopline) {
    items.push({ label: '운영시간', value: formatOperatingHours(d.operatingHours).split('\n')[0] })
  }

  if (cat === 'hospital') {
    if (d.clCdNm) items.push({ label: '종별', value: d.clCdNm })
    if (d.drTotCnt) items.push({ label: '의사', value: `${d.drTotCnt}명` })
    if (d.parkQty != null) items.push({ label: '주차', value: d.parkQty > 0 ? `${d.parkQty}대` : '불가' })
  } else if (cat === 'parking') {
    if (d.capacity) items.push({ label: '주차면수', value: `${d.capacity}면` })
    if (d.feeType) items.push({ label: '요금', value: d.feeType })
    if (d.lotType) items.push({ label: '구분', value: d.lotType })
  } else if (cat === 'library') {
    if (d.seatCount) items.push({ label: '좌석', value: `${Number(d.seatCount).toLocaleString()}석` })
    if (d.bookCount) items.push({ label: '장서', value: `${Number(d.bookCount).toLocaleString()}권` })
  } else if (cat === 'aed') {
    const trim = (s: string) => s.replace(/^[-\s]+|[-\s]+$/g, '').trim()
    if (d.buildPlace) {
      const v = trim(d.buildPlace)
      if (v) items.push({ label: '설치위치', value: v })
    }
    if (d.org) {
      const v = trim(d.org)
      if (v) items.push({ label: '관리기관', value: v })
    }
  } else if (cat === 'childcare') {
    if (d.crcapat) items.push({ label: '정원', value: `${d.crcapat}명` })
    if (d.crchcnt != null) items.push({ label: '현원', value: `${d.crchcnt}명` })
  } else if (cat === 'park') {
    if (d.parkType) items.push({ label: '공원유형', value: d.parkType })
    if (d.area != null) items.push({ label: '면적', value: `${Number(d.area).toLocaleString()}㎡` })
  } else if (cat === 'market') {
    if (d.marketType) items.push({ label: '시장유형', value: d.marketType })
    if (d.storeCount != null) items.push({ label: '점포수', value: `${d.storeCount}개` })
  } else if (cat === 'school') {
    if (d.schoolLevel) items.push({ label: '학교급', value: d.schoolLevel })
    if (d.foundationType) items.push({ label: '설립형태', value: d.foundationType })
    if (d.coeducationType) items.push({ label: '남녀공학', value: d.coeducationType })
  } else if (cat === 'sports') {
    if (d.faciGbNm) items.push({ label: '시설구분', value: d.faciGbNm })
    if (d.faciTyNm) items.push({ label: '유형', value: d.faciTyNm })
  }

  return items.slice(0, MAX_STATS)
}
```

`pharmacy`는 stats 슬롯이 비는 게 정상(스펙 §6의 평일/토/일 3-슬롯 분해는 details 필드가 통일된 단일 `operatingHours`로 들어와 후속 데이터 정리 필요 — 이 PR에서는 다루지 않고 후속 작업으로 둔다). 전화 항목은 의도적으로 누락(CTA로 이동).

- [ ] **Step 5-4: 통과 확인**

```bash
cd frontend && npx vitest run tests/utils/facilityHeroMeta.test.ts
```

Expected: 14 tests PASS (8 + 6 신규).

- [ ] **Step 5-5: 커밋**

```bash
git add frontend/utils/facilityHeroMeta.ts frontend/tests/utils/facilityHeroMeta.test.ts
git commit -m "feat(facilityHeroMeta): add buildHeroStats capped at 3 per category"
```

---

## Task 6: 시설 상세 페이지 와이어링

**Files:**
- Modify: `frontend/pages/[category]/[id].vue`

- [ ] **Step 6-1: import 추가**

`frontend/pages/[category]/[id].vue:312` 근처에 다음 import 추가:

```ts
import { buildHeroBadge, buildHeroActions, buildHeroStats } from '~/utils/facilityHeroMeta'
import OperatingStatusBadge from '~/components/facility/OperatingStatusBadge.vue'
```

- [ ] **Step 6-2: 인라인 computed 교체**

라인 427–430의 `facilityIntro`를 다음으로 교체:

```ts
// h1 아래 표시할 주소 한 줄 (스펙: facilityIntro 자동생성 폐기, 주소만)
const heroDescription = computed(() => facility.value?.address ?? '')
```

라인 454부터의 `desktopHeroStats` 전체 블록(약 80줄, sports 카테고리 이후 `})` 까지)을 다음으로 교체:

```ts
const heroBadge = computed(() => (facility.value ? buildHeroBadge(facility.value) : null))
const heroStats = computed(() => (facility.value ? buildHeroStats(facility.value) : []))
const heroActions = computed(() =>
  facility.value
    ? buildHeroActions(facility.value, {
        kakaoMapUrl: kakaoMapUrl.value,
        naverMapUrl: naverMapUrl.value,
      })
    : [],
)
```

`facilityPhone`, `isOpen24Hours` 등이 이 인라인 stats에서만 쓰였다면 함께 제거. (Step 6-6 lint에서 검증)

- [ ] **Step 6-3: 템플릿 — `<PageHero>` 호출부 교체**

라인 125–131의 `<PageHero ... />` 블록을 다음으로 교체:

```vue
<PageHero
  :eyebrow="categoryMeta.label"
  :title="displayName"
  :description="heroDescription || undefined"
  :stats="heroStats"
  :actions="heroActions"
  @action="handleHeroAction"
>
  <template v-if="heroBadge" #badge>
    <OperatingStatusBadge :status="heroBadge" />
  </template>
</PageHero>
```

- [ ] **Step 6-4: `handleHeroAction` 메서드 추가**

스크립트 영역에 추가 (`handleShare` 근처):

```ts
function handleHeroAction(payload: { type: 'directions' | 'phone' | 'share' }) {
  if (payload.type === 'share') {
    handleShare()
  }
}
```

전화는 `href`로, 길찾기는 PageHero 내부 dropdown 메뉴 항목 클릭으로, 공유만 emit으로 처리된다.

- [ ] **Step 6-5: sticky 하단 CTA 블록 제거**

세 군데를 삭제한다.

**(a) 데스크톱 사이드바 하단 CTA 박스 — `[id].vue:203`–`232`** (현재 라인 기준; 위 변경으로 라인이 어긋나도 식별자 `<!-- Action Buttons (Desktop Sticky Bottom) -->` 로 찾을 수 있다):

```vue
<!-- Action Buttons (Desktop Sticky Bottom) -->
<div class="mt-3 p-4 bg-white border border-slate-200 flex gap-3 shadow-card rounded-xl">
  ...길찾기/공유 버튼 + dropdown...
</div>
```

→ 통째로 삭제. 직후 `<CoupangBanner class="mt-3" />`는 유지(클래스 `mt-3`만으로 위 여백 자연스럽게 흡수됨).

**(b) 모바일 fixed 하단 CTA — `[id].vue:245`–`276`** (식별자 `<!-- Mobile: Sticky Bottom CTA -->`):

```vue
<!-- Mobile: Sticky Bottom CTA -->
<div class="md:hidden fixed bottom-0 left-0 z-50 w-full ...">
  ...
</div>
```

→ 통째로 삭제.

**(c) 모바일 bottom padding spacer — `[id].vue:278`–`279`** (식별자 `<!-- Bottom padding for mobile CTA -->`):

```vue
<!-- Bottom padding for mobile CTA -->
<div class="md:hidden h-24"></div>
```

→ 통째로 삭제.

**(d) script 영역에서 unused refs/methods 제거**:

- `showNavDropdown` (ref)
- `showMobileNavDropdown` (ref)
- `openNavigation` 함수 (있다면)

`grep -n "showNavDropdown\|showMobileNavDropdown\|openNavigation" 'frontend/pages/[category]/[id].vue'`로 위치를 확인하고, 매칭이 모두 삭제된 sticky 블록에만 있는지 검증 후 ref 선언과 함수 정의도 삭제. 다른 곳에서 참조되면 그 사용처를 먼저 확인.

- [ ] **Step 6-6: lint + 타입 체크**

```bash
cd frontend && npm run lint
```

Expected: 0 errors. 미사용 import/변수가 있으면 제거.

```bash
cd frontend && npx nuxi typecheck
```

Expected: 0 errors. (이 명령이 프로젝트에 없으면 `npm run build` 로 대체 — `vue-tsc` 가 SFC 타입 체크 수행.)

- [ ] **Step 6-7: 회귀 테스트**

```bash
cd frontend && npm run test
```

Expected: 전체 PASS.

- [ ] **Step 6-8: 빌드 확인 (SSR 안전성)**

```bash
cd frontend && npm run build
```

Expected: SUCCESS. 모든 카테고리의 prerender 또는 SSR 단계에서 에러 없음.

- [ ] **Step 6-9: 커밋**

```bash
git add 'frontend/pages/[category]/[id].vue'
git commit -m "feat([category]/[id]): wire hero badge/actions/stats and remove sticky bottom CTAs"
```

---

## Task 7: 수동 시각 확인

**Files:** none

코드 변경 끝. 실제 동작 확인.

- [ ] **Step 7-1: Docker MySQL 가동 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit && docker compose ps
```

Expected: mysql 서비스 `running (healthy)`. 아니면 `docker compose up -d`.

- [ ] **Step 7-2: 백엔드 + 프론트엔드 dev 가동**

별도 터미널 2개:

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npm run dev
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npm run dev
```

- [ ] **Step 7-3: 6개 대표 페이지를 브라우저에서 확인**

다음 URL을 순서대로 열어 모바일/데스크톱 뷰포트에서 히어로를 점검 (실제 ID는 dev DB의 첫 항목이면 충분):

```
http://localhost:3000/pharmacy/<id>     — 배지·전화 CTA 노출 기대
http://localhost:3000/hospital/<id>     — 배지·전화 CTA, stats(종별/의사/주차)
http://localhost:3000/parking/<id>      — 배지 미노출, 전화 CTA(번호 있을 때)
http://localhost:3000/toilet/<id>       — 배지 24시간(해당 시), 전화 CTA 없음
http://localhost:3000/aed/<id>          — 운영시간 배지, 위치/관리기관 stats
http://localhost:3000/wifi/<id>         — 배지 미노출, stats 최대 3개
```

체크리스트:
- H1 옆 배지가 줄바꿈/오버랩 없이 자연스럽게 정렬되는지
- CTA 3개(또는 2개)가 모바일 320px 폭에서 1행에 들어가는지 — 길찾기는 primary 컬러
- stats 3개를 초과하지 않는지
- 주소가 H1 아래 회색 1줄로 표시되는지 (자동생성 인트로 사라짐)
- 모바일에서 240px 지도 → 카드 순서가 유지되는지
- 길찾기 클릭 시 카카오맵/네이버맵 dropdown이 열리고 각각 새 탭으로 이동하는지
- 모바일/데스크톱에서 sticky 하단 CTA가 **완전히 사라졌는지**(잔여 spacer 포함)
- 모바일에서 페이지 하단 spacer가 없어도 본문 마지막 광고/링크가 가려지지 않는지

- [ ] **Step 7-4: 발견된 회귀 또는 시각 깨짐을 수정**

회귀가 있으면 해당 Task로 돌아가 테스트를 추가하고 고친다. (이 단계는 0회 또는 N회 반복 가능)

- [ ] **Step 7-5: PR 생성 (메모리 규칙: main 직접 커밋 금지)**

```bash
git push -u origin feat/facility-hero-cta
gh pr create --fill --base main
```

PR 본문에 다음을 포함:
- 스펙 링크: `docs/superpowers/specs/2026-05-12-facility-hero-design.md`
- 6개 대표 URL 스크린샷 (모바일/데스크톱) — 전/후 비교
- 제거된 sticky CTA 블록과 새 히어로 CTA의 비교 스크린샷
- 변경하지 않은 영역(`OperatingStatusBadge`, 본문 섹션, 사이드바 지도)에 대한 명시적 언급

CI 통과 후 머지 (메모리 규칙).

---

## Self-Review 결과

**Spec coverage:**
- §2 전략 B → Task 3–5 (헬퍼 분리), Task 6 (와이어링) ✅
- §3 모바일/데스크톱 레이아웃 → 기존 구조 유지, Task 6에서 PageHero 슬롯만 교체 ✅
- §4 CTA 정책 (길찾기 dropdown / 전화 조건부 / 공유 항상) → Task 2 menu 지원 + Task 4 `buildHeroActions` ✅
- §4.1 sticky 하단 CTA 제거 → Task 6 Step 6-5 ✅
- §5 운영상태 배지 → Task 3 `buildHeroBadge` + Task 6 슬롯, **단 색상은 기존 OperatingStatusBadge slate 톤 사용**(스펙 시안의 컬러 배경 미적용 — 사전 컨텍스트에 명시) ⚠
- §6 Stats 정책(최대 3개, 카테고리별 라벨) → Task 5 ✅
- §7.1 PageHero 신규 props (badge 슬롯 + actions w/ menu) → Task 1·2 ✅
- §7.2 페이지 헬퍼 호출 → Task 6 ✅
- §7.3 모바일 지도 블록 → 변경 없음(현행 유지) ✅
- §8 스코프 제외 → trash 등 미수정 ✅
- §9 검증 기준 → Task 7 ✅
- §10 미해결 항목(약국 평일/토/일 분해, AED 카피, 데스크톱 폰트 토큰) → **이번 PR 범위 밖**으로 명시. pharmacy의 stats가 비는 점은 Task 5 노트에 후속 작업으로 기록.

**Placeholder scan:** 모든 단계에 실제 코드/명령 포함. TODO/TBD 없음.

**Type consistency:**
- `HeroAction.type` ∈ `'directions' | 'phone' | 'share'` — Task 2, 4, 6 모두 동일 ✅
- `OperatingStatus` 4-state — `facilityStatus.ts` 기존 정의 그대로 ✅
- `HeroStat` ↔ `Stat` — Task 5에서 `HeroStat` export 하지만 PageHero는 `Stat`을 기대. **두 인터페이스가 형태 동일**(label, value, color)하므로 호환되며 props 타입이 `Stat[]`이므로 컴파일 에러 없음 ✅
