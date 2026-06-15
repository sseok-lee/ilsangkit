# 모바일 상세페이지 구조 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모바일(`< md`) 시설·부동산 상세페이지에서 핵심 정보를 최상단으로 끌어올리고, 맨 위 라이브 지도를 제거해 '위치' 섹션으로 옮기며, 하단 고정 바를 없앤다. 데스크톱(`md:` 이상)은 픽셀 동일하게 유지한다.

**Architecture:** 모바일 전용 "핵심 정보 헤더" 컴포넌트 2개(시설/부동산)를 신설하고, 각 페이지에서 `md:hidden`(모바일 헤더) / `hidden md:block`(기존 PageHero) 으로 분기한다. 정보 섹션은 기존 컴포넌트를 그대로 재사용한다. 부동산은 섹션 DOM 순서가 모바일/데스크톱이 달라지므로 Tailwind `order-*` / `md:order-*` 유틸리티로 모바일에서만 재배치한다(마크업 중복 없이 데스크톱 보존). 지도는 정적 썸네일이 아니라 기존 라이브 `FacilityMap`/`FacilityRoadview`를 그대로 쓴다.

**Tech Stack:** Nuxt 3 (SSR) · Vue 3 `<script setup>` · TailwindCSS · Vitest + @vue/test-utils (happy-dom) · Playwright(E2E)

**Spec:** `docs/superpowers/specs/2026-06-10-mobile-detail-restructure-design.md`

---

## 사전 컨텍스트 (구현자 필독)

- **테스트 실행**: `cd frontend` 후 `npx vitest run tests/<path>` (단일), `npm run test`(전체), `npm run lint`, `npm run build`. Node 20 필수 (`nvm use 20`). lock 파일 재생성 금지.
- **대상 파일**
  - 시설 페이지: `frontend/pages/[category]/[id].vue` (현재 904줄)
  - 부동산 페이지: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (현재 1309줄)
- **재사용 자산**
  - `frontend/components/facility/OperatingStatusBadge.vue` — props `status: 'open24h'|'openNow'|'closed'|'limited'`
  - `frontend/utils/facilityStatus.ts` — `getOperatingStatus(facility): OperatingStatus`
  - `frontend/components/common/PageHero.vue` — props `eyebrow,title,description,stats[]`
  - `frontend/components/common/SectionBlock.vue` — props `heading,subtext,size`; slots `heading,right,default`
  - `frontend/components/ads/AdBanner.vue` — props `sizing,adFormat,fixedHeight,only`
  - `frontend/components/map/FacilityMap.vue` (async), `frontend/components/facility/FacilityRoadview.vue`
- **기존 동작(보존)**: `isMapExpanded`(풀스크린 오버레이 Teleport), `handleShare`, `openNavigation(url)`, `kakaoMapUrl`/`naverMapUrl` computed, `copyAddress`(시설은 `DetailBasicInfo` 내부), 길찾기 카카오/네이버 드롭다운.

## 광고 배치 결정 (plan 검토 시 확정)

- 두 페이지 모두 **광고 6개를 "섹션 사이마다 1개씩" 유지**한다(개수·무겹침 보존). 정보 섹션 순서가 바뀌어도 광고는 각 섹션 경계에 하나씩 남는다.
- 시설: 현행 6개(헤더↓·기본정보↓·시설현황↓·로드뷰↓·주변↓·블로그↓)를 그대로 유지. 별도 이동 없음.
- 부동산: 현행 6개(Hero↓·위치↓·시세추이↓·거래내역↓·인근단지↓·주변생활↓)를 유지하되, 섹션이 `order-*`로 재배치되면 각 광고는 자기 **직전 섹션과 같은 order 그룹**에 묶어 함께 이동한다(아래 Task 7 참조). Hero 직후 광고(현 L103)가 "핵심 정보 아래 광고" 요구를 이미 충족한다.
- ⚠️ 이 광고 정책은 사용자 최종 확정 대상. 변경 시 어느 섹션 광고를 비울지 별도 결정.

---

## File Structure

| 파일 | 책임 | 작업 |
|------|------|------|
| `frontend/components/facility/detail/MobileDetailHeader.vue` | 시설 모바일 핵심 정보 헤더(제목+상태칩+stat칩+액션 pill) | Create |
| `frontend/components/realEstate/MobileRealEstateHeader.vue` | 부동산 모바일 핵심 정보 헤더(제목+eyebrow칩+stat칩+공유/길찾기 pill) | Create |
| `frontend/tests/components/facility/detail/MobileDetailHeader.test.ts` | 시설 헤더 단위 테스트 | Create |
| `frontend/tests/components/realEstate/MobileRealEstateHeader.test.ts` | 부동산 헤더 단위 테스트 | Create |
| `frontend/pages/[category]/[id].vue` | 시설 상세: 상단 지도 제거, 헤더 분기, 위치 섹션에 모바일 지도, 하단 바 제거 | Modify |
| `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` | 부동산 상세: 상단 지도 제거, 헤더 분기, 모바일 섹션 재배치(order), 하단 바 제거 | Modify |

---

## Task 1: 시설 모바일 헤더 컴포넌트 `MobileDetailHeader.vue`

**Files:**
- Create: `frontend/components/facility/detail/MobileDetailHeader.vue`
- Test: `frontend/tests/components/facility/detail/MobileDetailHeader.test.ts`

이 컴포넌트는 **프리젠테이셔널**이다. 데이터/로직은 props로 받고, 액션은 emit으로 부모(페이지)에 위임한다. 전화는 `tel:` 링크(JS 불필요). 길찾기 드롭다운만 내부 로컬 state로 관리.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// frontend/tests/components/facility/detail/MobileDetailHeader.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileDetailHeader from '~/components/facility/detail/MobileDetailHeader.vue'

const baseProps = {
  title: '행복약국',
  categoryLabel: '약국',
  status: 'openNow' as const,
  stats: [
    { label: '운영시간', value: '09:00~21:00' },
    { label: '전화', value: '02-123-4567' },
  ],
  phone: '02-123-4567',
  kakaoMapUrl: 'https://map.kakao.com/x',
  naverMapUrl: 'https://map.naver.com/x',
}

describe('MobileDetailHeader', () => {
  it('제목과 카테고리 eyebrow를 렌더한다', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    expect(w.find('h1').text()).toBe('행복약국')
    expect(w.text()).toContain('약국')
  })

  it('영업상태 배지를 렌더한다(openNow → 개방중)', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    expect(w.text()).toContain('개방중')
  })

  it('stats를 칩으로 렌더한다', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    expect(w.text()).toContain('09:00~21:00')
  })

  it('전화 pill은 tel: 링크다', () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    const tel = w.find('a[href="tel:02-123-4567"]')
    expect(tel.exists()).toBe(true)
  })

  it('phone이 없으면 전화 pill을 숨긴다', () => {
    const w = mount(MobileDetailHeader, { props: { ...baseProps, phone: null } })
    expect(w.find('a[href^="tel:"]').exists()).toBe(false)
  })

  it('공유 pill 클릭 시 share 이벤트를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    await w.get('[data-test="share-pill"]').trigger('click')
    expect(w.emitted('share')).toHaveLength(1)
  })

  it('주소복사 pill 클릭 시 copy 이벤트를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    await w.get('[data-test="copy-pill"]').trigger('click')
    expect(w.emitted('copy')).toHaveLength(1)
  })

  it('길찾기 → 카카오 클릭 시 directions("kakao")를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: baseProps })
    await w.get('[data-test="directions-pill"]').trigger('click')
    await w.get('[data-test="directions-kakao"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['kakao'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/MobileDetailHeader.test.ts`
Expected: FAIL — `Failed to resolve import '~/components/facility/detail/MobileDetailHeader.vue'`

- [ ] **Step 3: 컴포넌트 구현**

```vue
<!-- frontend/components/facility/detail/MobileDetailHeader.vue -->
<template>
  <section class="md:hidden bg-white border border-line rounded-xl shadow-card p-4">
    <span v-if="categoryLabel" class="inline-flex mb-2 px-2 py-1 bg-primary/10 text-primary rounded text-eyebrow">
      {{ categoryLabel }}
    </span>
    <div class="flex items-start gap-2 flex-wrap">
      <h1 class="text-display-2 text-slate-900 break-keep">{{ title }}</h1>
      <OperatingStatusBadge v-if="status" :status="status" class="mt-1 shrink-0" />
    </div>

    <!-- stat 칩 -->
    <div v-if="stats.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="stat in stats"
        :key="stat.label"
        class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
      >
        <span class="text-slate-400">{{ stat.label }}</span>
        <span class="font-semibold text-slate-800">{{ stat.value }}</span>
      </span>
    </div>

    <!-- 액션 pill -->
    <div class="mt-4 flex gap-2">
      <a
        v-if="phone"
        :href="`tel:${phone}`"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
      >
        <span class="material-symbols-outlined text-[18px]">call</span>전화
      </a>
      <button
        data-test="copy-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
        @click="$emit('copy')"
      >
        <span class="material-symbols-outlined text-[18px]">content_copy</span>복사
      </button>
      <button
        data-test="share-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
        aria-label="이 시설 공유하기"
        @click="$emit('share')"
      >
        <span class="material-symbols-outlined text-[18px]">share</span>공유
      </button>
      <div class="relative flex-[1.4]">
        <button
          data-test="directions-pill"
          class="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 active:scale-[0.98] transition"
          @click="showNav = !showNav"
        >
          <span class="material-symbols-outlined text-[18px]">directions</span>길찾기
        </button>
        <div v-if="showNav" class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
          <button data-test="directions-kakao" class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3" @click="emitDirections('kakao')">
            <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
          </button>
          <div class="h-px bg-slate-100"></div>
          <button data-test="directions-naver" class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3" @click="emitDirections('naver')">
            <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import OperatingStatusBadge from '~/components/facility/OperatingStatusBadge.vue'

type OperatingStatus = 'open24h' | 'openNow' | 'closed' | 'limited'
interface Stat { label: string; value: string }

defineProps<{
  title: string
  categoryLabel?: string
  status?: OperatingStatus | null
  stats?: Stat[]
  phone?: string | null
  kakaoMapUrl?: string
  naverMapUrl?: string
}>()

const emit = defineEmits<{
  (e: 'share'): void
  (e: 'copy'): void
  (e: 'directions', provider: 'kakao' | 'naver'): void
}>()

const showNav = ref(false)
function emitDirections(provider: 'kakao' | 'naver') {
  emit('directions', provider)
  showNav.value = false
}
</script>
```

> 참고: `defineProps`에 `stats` 기본값이 없어 `stats.length` 접근이 안전하도록, 사용처(페이지)에서 항상 배열을 전달한다. 방어적으로 템플릿은 `stats?.length`가 아니라 `stats.length`를 쓰되 부모가 빈 배열을 보장한다(Task 4/7에서 보장).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/facility/detail/MobileDetailHeader.test.ts`
Expected: PASS (8 passed)

- [ ] **Step 5: 커밋**

```bash
cd frontend && npx vitest run tests/components/facility/detail/MobileDetailHeader.test.ts
git add frontend/components/facility/detail/MobileDetailHeader.vue frontend/tests/components/facility/detail/MobileDetailHeader.test.ts
git commit -m "feat(facility): 모바일 상세 핵심 정보 헤더 컴포넌트 추가"
```

---

## Task 2: 부동산 모바일 헤더 컴포넌트 `MobileRealEstateHeader.vue`

**Files:**
- Create: `frontend/components/realEstate/MobileRealEstateHeader.vue`
- Test: `frontend/tests/components/realEstate/MobileRealEstateHeader.test.ts`

시설 헤더와 동일 구조이나 **전화/복사 pill이 없고 공유·길찾기만** 있다. 상태칩 대신 시세 추세 칩(선택)을 받는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```ts
// frontend/tests/components/realEstate/MobileRealEstateHeader.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileRealEstateHeader from '~/components/realEstate/MobileRealEstateHeader.vue'

const baseProps = {
  title: '래미안 대치팰리스',
  eyebrow: '아파트 매매',
  stats: [
    { label: '최근 거래가', value: '28.5억' },
    { label: '건축년도', value: '2015년' },
  ],
  kakaoMapUrl: 'https://map.kakao.com/x',
  naverMapUrl: 'https://map.naver.com/x',
}

describe('MobileRealEstateHeader', () => {
  it('제목과 eyebrow를 렌더한다', () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    expect(w.find('h1').text()).toBe('래미안 대치팰리스')
    expect(w.text()).toContain('아파트 매매')
  })

  it('stats를 칩으로 렌더한다', () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    expect(w.text()).toContain('28.5억')
  })

  it('전화/복사 pill이 없다', () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    expect(w.find('a[href^="tel:"]').exists()).toBe(false)
    expect(w.find('[data-test="copy-pill"]').exists()).toBe(false)
  })

  it('공유 pill 클릭 시 share를 emit한다', async () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    await w.get('[data-test="share-pill"]').trigger('click')
    expect(w.emitted('share')).toHaveLength(1)
  })

  it('길찾기 → 네이버 클릭 시 directions("naver")를 emit한다', async () => {
    const w = mount(MobileRealEstateHeader, { props: baseProps })
    await w.get('[data-test="directions-pill"]').trigger('click')
    await w.get('[data-test="directions-naver"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['naver'])
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/MobileRealEstateHeader.test.ts`
Expected: FAIL — import 해결 실패

- [ ] **Step 3: 컴포넌트 구현**

```vue
<!-- frontend/components/realEstate/MobileRealEstateHeader.vue -->
<template>
  <section class="md:hidden bg-white border border-line rounded-xl shadow-card p-4">
    <span v-if="eyebrow" class="inline-flex mb-2 px-2 py-1 bg-primary/10 text-primary rounded text-eyebrow">
      {{ eyebrow }}
    </span>
    <h1 class="text-display-2 text-slate-900 break-keep">{{ title }}</h1>

    <div v-if="stats.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="stat in stats"
        :key="stat.label"
        class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
      >
        <span class="text-slate-400">{{ stat.label }}</span>
        <span :class="['font-semibold', stat.color ?? 'text-slate-800']">{{ stat.value }}</span>
      </span>
    </div>

    <div class="mt-4 flex gap-2">
      <button
        data-test="share-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
        aria-label="이 건물 공유하기"
        @click="$emit('share')"
      >
        <span class="material-symbols-outlined text-[18px]">share</span>공유
      </button>
      <div class="relative flex-[2]">
        <button
          data-test="directions-pill"
          class="w-full flex items-center justify-center gap-1.5 rounded-xl bg-primary py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 active:scale-[0.98] transition"
          @click="showNav = !showNav"
        >
          <span class="material-symbols-outlined text-[18px]">directions</span>길찾기
        </button>
        <div v-if="showNav" class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
          <button data-test="directions-kakao" class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3" @click="emitDirections('kakao')">
            <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
          </button>
          <div class="h-px bg-slate-100"></div>
          <button data-test="directions-naver" class="w-full px-4 py-3 text-left text-sm font-medium text-slate-900 hover:bg-gray-50 flex items-center gap-3" @click="emitDirections('naver')">
            <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref } from 'vue'

interface Stat { label: string; value: string; color?: string }

defineProps<{
  title: string
  eyebrow?: string
  stats?: Stat[]
  kakaoMapUrl?: string
  naverMapUrl?: string
}>()

const emit = defineEmits<{
  (e: 'share'): void
  (e: 'directions', provider: 'kakao' | 'naver'): void
}>()

const showNav = ref(false)
function emitDirections(provider: 'kakao' | 'naver') {
  emit('directions', provider)
  showNav.value = false
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/MobileRealEstateHeader.test.ts`
Expected: PASS (5 passed)

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/realEstate/MobileRealEstateHeader.vue frontend/tests/components/realEstate/MobileRealEstateHeader.test.ts
git commit -m "feat(real-estate): 모바일 상세 핵심 정보 헤더 컴포넌트 추가"
```

---

## Task 3: 시설 페이지 — 상단 240px 모바일 지도 블록 제거

**Files:**
- Modify: `frontend/pages/[category]/[id].vue:30-61` (모바일 상단 지도 블록 삭제)

풀스크린 오버레이(`Teleport`, L63-106)는 **그대로 둔다** — Task 5에서 위치 섹션의 "지도 크게 보기" 버튼이 `isMapExpanded`를 다시 사용한다.

- [ ] **Step 1: 상단 지도 블록 삭제**

`frontend/pages/[category]/[id].vue`에서 아래 주석~닫는 div(현재 L30 `<!-- Mobile: Map at top -->` 부터 L61 `</div>`까지) 전체를 삭제한다. 바로 다음의 `<!-- Fullscreen Map Overlay (Mobile) -->` `<Teleport>` 블록은 남긴다.

삭제 대상(시작/끝 마커):
```html
        <!-- Mobile: Map at top -->
        <div class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200">
          ... (FacilityMap, 뒤로가기, 그라데이션, '지도 크게 보기' 버튼) ...
        </div>
```

- [ ] **Step 2: 빌드/타입 확인 (handleBack 잔존 참조 점검)**

`handleBack`은 위 블록에서만 쓰였으므로 미사용이 된다. `frontend/pages/[category]/[id].vue`의 `const handleBack = () => { ... }` 정의(현재 L813-819)도 삭제한다.

Run: `cd frontend && npm run lint`
Expected: PASS (no-unused-vars 에러 없음)

- [ ] **Step 3: 커밋**

```bash
git add frontend/pages/[category]/[id].vue
git commit -m "refactor(facility): 모바일 상단 240px 지도 블록 제거"
```

---

## Task 4: 시설 페이지 — 헤더 분기 + 하단 고정 바 제거

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (PageHero 분기, MobileDetailHeader 추가, 하단 CTA+스페이서 삭제)

- [ ] **Step 1: PageHero를 데스크톱 전용으로 + 모바일 헤더 추가**

현재 Hero 블록(L125-131):
```html
              <!-- Hero (H1) -->
              <PageHero
                :eyebrow="categoryMeta.label"
                :title="displayName"
                :description="facilityIntro || undefined"
                :stats="desktopHeroStats"
              />
```
을 아래로 교체:
```html
              <!-- Hero: 모바일 핵심 정보 헤더 / 데스크톱 PageHero -->
              <MobileDetailHeader
                :title="displayName"
                :category-label="categoryMeta.label"
                :status="operatingStatus"
                :stats="mobileHeaderStats"
                :phone="facilityPhone"
                :kakao-map-url="kakaoMapUrl"
                :naver-map-url="naverMapUrl"
                @share="handleShare"
                @copy="copyFacilityAddress"
                @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
              />
              <PageHero
                class="hidden md:block"
                :eyebrow="categoryMeta.label"
                :title="displayName"
                :description="facilityIntro || undefined"
                :stats="desktopHeroStats"
              />
```

- [ ] **Step 2: import + computed/함수 추가 (script setup)**

`frontend/pages/[category]/[id].vue` `<script setup>` 상단 import 그룹에 추가:
```ts
import MobileDetailHeader from '~/components/facility/detail/MobileDetailHeader.vue'
import { getOperatingStatus } from '~/utils/facilityStatus'
```

computed/함수 추가(기존 `desktopHeroStats` computed 아래 적당한 위치):
```ts
// 모바일 헤더용 영업상태 — 좌표/운영시간 기반 (facilityStatus 유틸 재사용)
const operatingStatus = computed(() => {
  if (!facility.value) return null
  return getOperatingStatus(facility.value as unknown as Record<string, any>)
})

// 모바일 헤더 칩: 데스크톱 stat을 그대로 재사용하되 최대 4개로 제한
const mobileHeaderStats = computed(() => desktopHeroStats.value.slice(0, 4))

// 모바일 헤더의 '주소복사' — DetailBasicInfo.copyAddress와 동일 로직
async function copyFacilityAddress() {
  if (!facility.value) return
  const address = facility.value.roadAddress || facility.value.address
  if (!address) return
  try {
    await navigator.clipboard.writeText(address)
    alert('주소가 복사되었습니다.')
  } catch (err) {
    console.error('주소 복사 실패:', err)
  }
}
```

> 검증: `getOperatingStatus`의 반환 타입이 `'open24h'|'openNow'|'closed'|'limited'`인지 `frontend/utils/facilityStatus.ts`에서 확인하고, `OperatingStatusBadge`/`MobileDetailHeader`의 `status` prop 타입과 일치시킨다. 시그니처가 다르면 헤더 prop 타입을 맞춘다.

- [ ] **Step 3: 하단 고정 바 + 스페이서 삭제**

현재 L266-300의 두 블록을 삭제한다:
```html
        <!-- Mobile: Sticky Bottom CTA -->
        <div class="md:hidden fixed bottom-0 ..."> ... </div>
        <!-- Bottom padding for mobile CTA -->
        <div class="md:hidden h-24"></div>
```
이로써 `showMobileNavDropdown` ref가 미사용이 되면 정의도 삭제한다(현재 L602 부근). `openNavigation`은 모바일 헤더에서 계속 사용하므로 유지.

- [ ] **Step 4: lint + 기존 페이지 테스트 + 빌드**

Run:
```bash
cd frontend && npm run lint && npm run build
```
Expected: PASS (미사용 변수 없음, 빌드 성공)

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/[category]/[id].vue
git commit -m "feat(facility): 모바일 핵심 정보 헤더 분기 + 하단 고정 바 제거"
```

---

## Task 5: 시설 페이지 — '위치·로드뷰' 섹션에 모바일 라이브 지도 추가

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (로드뷰 SectionBlock에 모바일 지도 + 확대 버튼)

현재 시설 모바일에는 인라인 지도 섹션이 없다(상단 지도는 Task 3에서 제거됨). 데스크톱은 사이드바 지도를 그대로 쓴다. 따라서 **모바일에서만** 위치 섹션에 라이브 지도를 넣는다.

- [ ] **Step 1: 로드뷰 SectionBlock 교체**

현재 L157-160:
```html
              <!-- Roadview -->
              <SectionBlock heading="로드뷰" subtext="시설 주변의 거리 뷰를 확인하세요.">
                <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
              </SectionBlock>
```
을 아래로 교체(모바일 지도 추가, 데스크톱은 로드뷰만 — 지도는 사이드바가 담당):
```html
              <!-- 위치·로드뷰 -->
              <SectionBlock heading="위치·로드뷰" subtext="지도와 로드뷰로 시설 주변을 확인하세요.">
                <!-- 모바일 전용 라이브 지도 (데스크톱은 사이드바 지도 사용) -->
                <div class="md:hidden relative h-[220px] w-full rounded-xl overflow-hidden border border-line mb-3">
                  <ClientOnly>
                    <FacilityMap
                      :center="{ lat: facility.lat, lng: facility.lng }"
                      :facilities="[facility]"
                      :level="3"
                      class="w-full h-full !min-h-0"
                    />
                  </ClientOnly>
                  <button
                    class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
                    @click="isMapExpanded = true"
                  >
                    <span class="material-symbols-outlined text-[16px]">open_in_full</span>
                    지도 크게 보기
                  </button>
                </div>
                <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
              </SectionBlock>
```

> `FacilityMap`은 이미 `defineAsyncComponent`로 import되어 있어 추가 import 불필요. `isMapExpanded`/풀스크린 오버레이는 Task 3에서 보존됨.
> 데스크톱 영향: heading 텍스트가 "로드뷰"→"위치·로드뷰"로 바뀐다(경미, 의미 개선). 모바일 지도 div는 `md:hidden`이라 데스크톱 미노출.

- [ ] **Step 2: 모바일 뷰포트 수동 확인**

Run: `cd frontend && npm run dev` 후 브라우저 모바일 폭(예: 390px)에서 `/pharmacy/<유효한 id>` 또는 `/toilet/<id>` 접속.
Expected:
- 상단에 240px 라이브 지도 **없음**, 대신 핵심 정보 헤더(칩+pill)가 최상단.
- '위치·로드뷰' 섹션에 라이브 지도 + '지도 크게 보기' → 풀스크린 오버레이 정상.
- 하단 고정 바 없음. 데스크톱 폭(≥768px)에서는 기존과 동일(사이드바 지도/버튼/PageHero).

- [ ] **Step 3: 커밋**

```bash
git add frontend/pages/[category]/[id].vue
git commit -m "feat(facility): 위치·로드뷰 섹션에 모바일 라이브 지도 추가"
```

---

## Task 6: 부동산 페이지 — 상단 지도 제거 + 헤더 분기 + 하단 바 제거

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

- [ ] **Step 1: 모바일 상단 지도 블록 삭제**

현재 L12-42의 `<!-- Mobile: Map at top -->` 블록 전체를 삭제한다. 풀스크린 오버레이 `Teleport`(L44-78)는 유지.

- [ ] **Step 2: PageHero 분기 + 모바일 헤더 추가**

현재 L94-100:
```html
      <!-- PageHero -->
      <PageHero
        :eyebrow="getDetailEyebrow(propertyMeta?.label ?? '', currentTab)"
        :title="buildingName"
        :description="fullAddress !== '-' ? fullAddress : undefined"
        :stats="heroStats"
      />
```
을 교체:
```html
      <!-- Hero: 모바일 헤더 / 데스크톱 PageHero -->
      <MobileRealEstateHeader
        :title="buildingName"
        :eyebrow="getDetailEyebrow(propertyMeta?.label ?? '', currentTab)"
        :stats="mobileHeaderStats"
        :kakao-map-url="kakaoMapUrl"
        :naver-map-url="naverMapUrl"
        @share="handleShare"
        @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
      />
      <PageHero
        class="hidden md:block"
        :eyebrow="getDetailEyebrow(propertyMeta?.label ?? '', currentTab)"
        :title="buildingName"
        :description="fullAddress !== '-' ? fullAddress : undefined"
        :stats="heroStats"
      />
```

- [ ] **Step 3: import + computed 추가**

`<script setup>` import 그룹에 추가:
```ts
import MobileRealEstateHeader from '~/components/realEstate/MobileRealEstateHeader.vue'
```
`heroStats` computed 아래에 추가:
```ts
// 모바일 헤더 칩 — heroStats를 그대로 재사용, '정보 없음' 항목은 제외하고 최대 4개
const mobileHeaderStats = computed(() =>
  heroStats.value.filter(s => s.value && s.value !== '정보 없음').slice(0, 4),
)
```

- [ ] **Step 4: 하단 고정 바 삭제**

현재 L402-433의 `<!-- Mobile: Sticky Bottom Action Bar -->` 블록 전체를 삭제한다. `showMobileNavDropdown`이 미사용이 되면 정의(L702)도 삭제. `handleClickOutside`는 `showNavDropdown`(데스크톱 드롭다운)에서 계속 쓰므로 유지하되, `showMobileNavDropdown` 참조 줄만 제거한다.

- [ ] **Step 5: lint + 빌드**

Run: `cd frontend && npm run lint && npm run build`
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
git commit -m "feat(real-estate): 모바일 핵심 정보 헤더 분기 + 상단 지도/하단 바 제거"
```

---

## Task 7: 부동산 페이지 — 모바일 섹션 재배치(order) + 위치 섹션 모바일 지도

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

`<main>`은 `flex flex-col`이므로 자식에 `order-*`(모바일 기본) + `md:order-*`(데스크톱 복원)을 부여해 **모바일에서만** 재배치한다. 광고는 직전 섹션과 같은 order 그룹에 묶어 함께 이동한다.

**데스크톱 순서(보존, md:order)** = 현재 DOM 순서:
breadcrumb(0) → Hero(1) → Ad(2) → 위치(3) → Ad(4) → 전월세비중(5) → 시세추이(6) → Ad(7) → 거래내역(8) → Ad(9) → 인근단지(10) → Ad(11) → 주변생활(12) → Ad(13) → Blog/Guide/Coupang/Data(14)

**모바일 목표 순서(order)** = 핵심정보 → 시세추이 → 거래내역 → 전월세비중 → 위치 → 인근단지 → 주변생활 → footer. 광고는 각 묶음 직후 유지:
breadcrumb(0) → Hero(1) → Ad(2) → 시세추이(3) → Ad(4) → 거래내역(5) → Ad(6) → 전월세비중(7) → 위치(8) → Ad(9) → 인근단지(10) → Ad(11) → 주변생활(12) → Ad(13) → footer(14)

- [ ] **Step 1: 각 `<main>` 직속 자식에 order 클래스 부여**

`<main class="... flex flex-col gap-3">`의 직속 자식들에 아래 클래스를 추가한다. (각 요소는 현재 DOM 순서대로 등장. `md:order-*`는 현재 순서를 그대로 복원하는 값.)

| 요소(현재 위치) | 추가 클래스 |
|---|---|
| Breadcrumb+Share div (L82) | `order-0 md:order-0` |
| Hero 묶음(모바일/데스크톱 헤더) | `order-1 md:order-1` |
| Ad: Hero 직후 (L103) | `order-2 md:order-2` |
| SectionBlock 위치·로드뷰 (L106) | `order-[8] md:order-3` |
| Ad: 위치 이후 (L156) | `order-[9] md:order-4` |
| SectionBlock 전·월세 비중 (L159) | `order-7 md:order-5` |
| SectionBlock 시세 추이 (L168) | `order-3 md:order-6` |
| Ad: 시세추이 이후 (L269) | `order-4 md:order-7` |
| SectionBlock 거래 내역 (L272) | `order-5 md:order-8` |
| Ad: 거래내역 이후 (L298) | `order-6 md:order-9` |
| 인근 단지 `<template>` 묶음 (L301) | ⚠️ `<template>`엔 클래스 불가 — 아래 Step 2 참조 |
| Ad: 인근단지 이후 (L370) | `order-[11] md:order-11` |
| SectionBlock 주변 생활시설 (L373) | `order-[12] md:order-12` |
| Ad: 주변생활 이후 (L382) | `order-[13] md:order-13` |
| Blog/RelatedGuides/Coupang/DataSource | 각각 `order-[14] md:order-14` |

> Tailwind `order-N`은 0~12까지 기본 제공. 13 이상은 임의값 `order-[13]` 형식을 쓴다. 위 표에서 두 자리 값은 임의값 표기를 사용한다.

- [ ] **Step 2: 인근 단지 `<template v-if>` 래퍼를 `<div>`로 변경**

현재 인근 단지 묶음은 `<template v-if="...">`(L301)로 감싸 클래스를 줄 수 없다. order를 주려면 실제 엘리먼트가 필요하므로 `<div>`로 교체한다:
```html
      <!-- "인근 단지" 블록 -->
      <div
        v-if="nearbyByType.apt.length > 0 || nearbyByType.offitel.length > 0 || nearbyByType.villa.length > 0"
        class="contents-none flex flex-col gap-3 order-[10] md:order-10"
      >
        ... (apt/offitel/villa SectionBlock 3개 그대로) ...
      </div>
```
> `flex flex-col gap-3`로 내부 3개 섹션 간격을 main의 gap과 동일하게 유지. 외곽 `<div>`가 main의 flex item이 되어 order 적용.

- [ ] **Step 3: 위치 섹션 — 모바일에서 지도 노출**

현재 위치 섹션의 지도는 `hidden md:block`(L140, 모바일은 상단 지도가 담당했기 때문)이다. 상단 지도를 제거했으므로 **모바일에서도 지도를 노출**한다. L139-148의 지도 div를 교체:
```html
          <!-- 지도: 모바일/데스크톱 모두 노출 (상단 지도 제거됨) -->
          <div class="rounded-xl border border-line overflow-hidden h-[220px] md:h-[300px]">
            <ClientOnly>
              <FacilityMap
                :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
                :facilities="buildingMarker"
                :level="3"
              />
            </ClientOnly>
          </div>
```
> grid가 `grid-cols-1 md:grid-cols-2`라 모바일은 지도/로드뷰가 세로로 쌓이고 데스크톱은 2열 유지.

- [ ] **Step 4: 모바일/데스크톱 순서 수동 검증**

Run: `cd frontend && npm run dev` → `/real-estate/apt-sale/<city>/<district>/<building>` 접속.
Expected:
- **모바일(390px)**: 핵심정보 헤더 → 광고 → 시세추이 → 광고 → 거래내역 → 광고 → (전세탭이면)전월세비중 → 위치(지도+로드뷰) → 광고 → 인근단지 → 광고 → 주변생활 → 광고 → 블로그/가이드. 상단 지도·하단 바 없음.
- **데스크톱(≥768px)**: 현재와 동일(Hero → 위치 → 전월세비중 → 시세추이 → 거래내역 → 인근단지 → 주변생활 …). 시각적 회귀 없음.

- [ ] **Step 5: lint + 빌드 + 커밋**

```bash
cd frontend && npm run lint && npm run build
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
git commit -m "feat(real-estate): 모바일 섹션 order 재배치 + 위치 섹션 모바일 지도"
```

---

## Task 8: 전체 검증

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: 전체 단위 테스트**

Run: `cd frontend && npm run test`
Expected: 전체 PASS. 기존 상세 관련 테스트(있다면)도 통과. 깨지는 기존 테스트가 있으면 원인 분석 후 수정(상단 지도/하단 바 셀렉터를 검사하던 테스트가 있으면 새 구조에 맞게 갱신).

- [ ] **Step 2: lint 전체**

Run: `cd frontend && npm run lint`
Expected: PASS (미사용 `handleBack`/`showMobileNavDropdown` 등 잔존 없음)

- [ ] **Step 3: 프로덕션 빌드**

Run: `cd frontend && npm run build`
Expected: SSR 빌드 성공.

- [ ] **Step 4: 반응형 회귀 수동 점검 (시설·부동산 각 1개)**

DevTools 디바이스 토글로 모바일(390px)·데스크톱(1280px) 양쪽에서:
- 모바일: 핵심 정보 헤더가 폴드 위 최상단, 상단 라이브 지도 없음, 위치 섹션 지도/로드뷰 정상, '지도 크게 보기' 풀스크린 정상, 하단 고정 바 없음, 공유/길찾기/전화/복사 동작.
- 데스크톱: 기존과 동일(PageHero, 사이드바 지도/버튼[시설], 섹션 순서[부동산]).

- [ ] **Step 5: (선택) E2E**

기존 Playwright 상세페이지 시나리오가 있으면 실행: `cd frontend && npm run test:e2e -- <detail spec>`. 상단 지도/하단 바 셀렉터 의존 시 갱신.

---

## Self-Review 메모

- **Spec coverage**: 핵심정보 헤더(T1·T2·T4·T6), 상단 지도 제거(T3·T6), 위치 섹션 라이브 지도(T5·T7-S3), 하단 바 제거(T4·T6), 부동산 섹션 재배치·전월세비중 이동(T7), 데스크톱 보존(분기/`md:order` 복원, T4·T6·T7), 라이브 지도 유지(정적 썸네일 미사용, T5·T7) — 모두 커버.
- **광고**: spec "개수 유지·위치만 조정" 준수. 시설은 현행 6개 유지(이동 없음 — 정보 섹션 순서 불변), 부동산은 6개를 order 그룹으로 함께 이동. ⚠️ plan 검토 시 사용자 최종 확인 필요.
- **타입 일관성**: `OperatingStatus`('open24h'|'openNow'|'closed'|'limited')를 `OperatingStatusBadge`·`MobileDetailHeader`·`getOperatingStatus`에서 동일하게 사용. Task 4-S2에서 `getOperatingStatus` 시그니처 확인 단계 포함.
- **미해결 가정**: `getOperatingStatus(facility)`가 모든 카테고리에서 합리적 상태를 반환한다고 가정. 일부 카테고리(예: 좌표만 있고 운영시간 없는 trash/clothes)에서 `status`가 `null`/부적절하면 헤더에서 배지를 숨기도록 `operatingStatus`가 `null` 반환 처리(이미 `v-if="status"`로 가드).
