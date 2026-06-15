# 상세페이지 섹션 재배치 — Foundation (공용 헤더) 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설/부동산이 각각 쓰던 두 모바일 헤더를 단일 `components/common/MobileDetailHeader.vue`로 통합하고(공유·전화·복사·길찾기 superset + `copyable`/`hideDirections` prop), 두 페이지를 이 컴포넌트로 마이그레이션한다. 이후 토지·공매·청약·공공임대가 이 공용 헤더를 재사용할 수 있게 된다.

**Architecture:** 기존 `facility/detail/MobileDetailHeader.vue`(eyebrow+status+phone+copy+share+directions)와 `realEstate/MobileRealEstateHeader.vue`(eyebrow+share+directions)는 95% 동일하다. 둘의 합집합을 `components/common/MobileDetailHeader.vue`로 만들고, 옵션 pill(전화/복사)과 길찾기 숨김을 prop으로 분기한다. 두 페이지 모두 **명시적 import**(`pathPrefix: false`)라 import 경로만 바꾸면 되며, 자동 import 이름 충돌 위험이 없다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom, TailwindCSS.

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` (§3.1 단일 h1, §3.4 headline-first, §5 헤더 패턴)

**전제:** 작업 브랜치 `docs/detail-section-ordering-design`(또는 별도 feat 브랜치)에서 진행. 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`).

---

### Task 1: 공용 `MobileDetailHeader` 컴포넌트 생성

**Files:**
- Create: `frontend/components/common/MobileDetailHeader.vue`
- Test: `frontend/tests/components/common/MobileDetailHeader.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/components/common/MobileDetailHeader.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'

const base = { title: '테스트 대상' }

describe('common/MobileDetailHeader', () => {
  it('title을 literal h1로 렌더한다 (단일 h1 불변식)', () => {
    const w = mount(MobileDetailHeader, { props: base })
    const h1s = w.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toBe('테스트 대상')
  })

  it('eyebrow가 있으면 배지를, 없으면 숨긴다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, eyebrow: '아파트 · 매매' } })
    expect(w.text()).toContain('아파트 · 매매')
    const w2 = mount(MobileDetailHeader, { props: base })
    expect(w2.find('[data-test="eyebrow"]').exists()).toBe(false)
  })

  it('phone이 있으면 tel: 전화 pill을, 없으면 숨긴다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, phone: '02-123-4567' } })
    const call = w.find('[data-test="call-pill"]')
    expect(call.exists()).toBe(true)
    expect(call.attributes('href')).toBe('tel:02-123-4567')
    expect(mount(MobileDetailHeader, { props: base }).find('[data-test="call-pill"]').exists()).toBe(false)
  })

  it('copyable=true일 때만 복사 pill을 노출하고 클릭 시 copy를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: { ...base, copyable: true } })
    const copy = w.find('[data-test="copy-pill"]')
    expect(copy.exists()).toBe(true)
    await copy.trigger('click')
    expect(w.emitted('copy')).toHaveLength(1)
    expect(mount(MobileDetailHeader, { props: base }).find('[data-test="copy-pill"]').exists()).toBe(false)
  })

  it('공유 pill 클릭 시 share를 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: base })
    await w.find('[data-test="share-pill"]').trigger('click')
    expect(w.emitted('share')).toHaveLength(1)
  })

  it('hideDirections=false(기본)면 길찾기 pill을 노출, true면 숨긴다', () => {
    expect(mount(MobileDetailHeader, { props: base }).find('[data-test="directions-pill"]').exists()).toBe(true)
    const hidden = mount(MobileDetailHeader, { props: { ...base, hideDirections: true } })
    expect(hidden.find('[data-test="directions-pill"]').exists()).toBe(false)
  })

  it('길찾기 메뉴에서 제공자 선택 시 directions를 provider와 함께 emit한다', async () => {
    const w = mount(MobileDetailHeader, { props: base })
    await w.find('[data-test="directions-pill"]').trigger('click')
    await w.find('[data-test="directions-kakao"]').trigger('click')
    expect(w.emitted('directions')?.[0]).toEqual(['kakao'])
  })

  it('stats를 칩으로 렌더하고 color 클래스를 적용한다', () => {
    const w = mount(MobileDetailHeader, { props: { ...base, stats: [{ label: '최근거래', value: '9.8억', color: 'text-primary' }] } })
    expect(w.text()).toContain('최근거래')
    expect(w.text()).toContain('9.8억')
    expect(w.find('.text-primary').exists()).toBe(true)
  })

  it('최소 props(title만)로도 크래시 없이 렌더한다', () => {
    expect(() => mount(MobileDetailHeader, { props: base })).not.toThrow()
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/components/common/MobileDetailHeader.test.ts`
Expected: FAIL — `Failed to resolve import '~/components/common/MobileDetailHeader.vue'`

- [ ] **Step 3: 컴포넌트 구현**

`frontend/components/common/MobileDetailHeader.vue`:

```vue
<!-- frontend/components/common/MobileDetailHeader.vue
     시설·부동산·토지·공매·청약·공공임대 상세의 공용 모바일 핵심정보 헤더.
     literal <h1> 1개 소유(단일 h1 불변식). 데스크톱은 PageHero(title-tag="div")가 대체. -->
<template>
  <section class="md:hidden bg-white border border-line rounded-xl shadow-card p-4">
    <span
      v-if="eyebrow"
      data-test="eyebrow"
      class="inline-flex items-center mb-2 px-2.5 py-1 rounded-full text-eyebrow"
      :style="{ color: 'var(--cat, var(--brand))', background: 'color-mix(in srgb, var(--cat, var(--brand)) 10%, white)' }"
    >
      {{ eyebrow }}
    </span>
    <div class="flex items-start gap-2 flex-wrap">
      <h1 class="text-display-1 text-strong break-keep">{{ title }}</h1>
      <OperatingStatusBadge v-if="status" :status="status" class="mt-1 shrink-0" />
    </div>

    <!-- stat 칩 -->
    <div v-if="stats?.length" class="mt-3 flex flex-wrap gap-1.5">
      <span
        v-for="stat in stats"
        :key="stat.label"
        class="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700"
      >
        <span class="text-slate-400">{{ stat.label }}</span>
        <span :class="['font-semibold', stat.color ?? 'text-slate-800']">{{ stat.value }}</span>
      </span>
    </div>

    <!-- 액션 pill -->
    <div class="mt-4 flex gap-2">
      <a
        v-if="phone"
        :href="`tel:${phone}`"
        data-test="call-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
      >
        <span class="material-symbols-outlined text-[18px]">call</span>전화
      </a>
      <button
        v-if="copyable"
        data-test="copy-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
        @click="$emit('copy')"
      >
        <span class="material-symbols-outlined text-[18px]">content_copy</span>복사
      </button>
      <button
        data-test="share-pill"
        class="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-900 active:scale-[0.98] transition"
        aria-label="공유하기"
        @click="$emit('share')"
      >
        <span class="material-symbols-outlined text-[18px]">share</span>공유
      </button>
      <div v-if="!hideDirections" class="relative flex-[1.4]">
        <button
          data-test="directions-pill"
          :aria-expanded="showNav"
          aria-haspopup="menu"
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
interface Stat { label: string; value: string; color?: string }

// kakaoMapUrl/naverMapUrl: 길찾기 URL은 부모가 directions emit을 받아 처리. 선언만 유지(속성 fall-through 방지).
withDefaults(defineProps<{
  title: string
  eyebrow?: string
  status?: OperatingStatus | null
  stats?: Stat[]
  phone?: string | null
  copyable?: boolean
  hideDirections?: boolean
  kakaoMapUrl?: string
  naverMapUrl?: string
}>(), {
  copyable: false,
  hideDirections: false,
})

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

> **참고:** real-estate eyebrow가 기존 `bg-primary/10 text-primary`에서 `--cat`(미설정 시 `--brand`로 폴백) 틴트로 통일된다 — OD 코발트 브랜드 색과 동일 계열이므로 의도된 통일이다.

- [ ] **Step 4: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/components/common/MobileDetailHeader.test.ts`
Expected: PASS (9 tests)

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/common/MobileDetailHeader.vue frontend/tests/components/common/MobileDetailHeader.test.ts
git commit -m "feat(common): 상세 공용 MobileDetailHeader (copyable/hideDirections superset)"
```

---

### Task 2: 시설 상세를 공용 헤더로 마이그레이션

**Files:**
- Modify: `frontend/pages/[category]/[id].vue:288` (import 경로), `:93-104` (props에 `copyable` 추가)
- Test: `frontend/tests/pages/detail.test.ts` (기존 h1 가드 재사용)

- [ ] **Step 1: import 경로 교체**

`frontend/pages/[category]/[id].vue:288` 을 아래로 변경:

```ts
// 변경 전
import MobileDetailHeader from '~/components/facility/detail/MobileDetailHeader.vue'
// 변경 후
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
```

- [ ] **Step 2: 템플릿 props 조정 (`category-label` → `eyebrow`, `copyable` 추가)**

`frontend/pages/[category]/[id].vue:93-104` 의 `<MobileDetailHeader>` 사용부를 아래로 변경(공용 헤더는 `eyebrow` prop을 쓴다):

```vue
<MobileDetailHeader
  :title="displayName"
  :eyebrow="categoryMeta.label"
  :status="operatingStatus"
  :stats="mobileHeaderStats"
  :phone="facilityPhone"
  copyable
  :kakao-map-url="kakaoMapUrl"
  :naver-map-url="naverMapUrl"
  @share="handleShare"
  @copy="copyFacilityAddress"
  @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
/>
```

- [ ] **Step 3: 시설 상세 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detail.test.ts`
Expected: PASS — h1 count===1, 헤더 렌더 가드 유지 (eyebrow=카테고리 라벨 노출)

- [ ] **Step 4: 커밋**

```bash
git add frontend/pages/\[category\]/\[id\].vue
git commit -m "refactor(facility): 상세 헤더를 공용 MobileDetailHeader로 교체"
```

---

### Task 3: 부동산 단지 상세를 공용 헤더로 마이그레이션

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:438` (import), 헤더 사용부 (`<MobileRealEstateHeader>` → `<MobileDetailHeader>`)
- Test: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`

- [ ] **Step 1: import 교체**

`:438` 변경:

```ts
// 변경 전
import MobileRealEstateHeader from '~/components/realEstate/MobileRealEstateHeader.vue'
// 변경 후
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
```

- [ ] **Step 2: 템플릿 태그 교체**

`<MobileRealEstateHeader ... />` 사용부의 태그명을 `<MobileDetailHeader ... />`로 변경. props(`title`/`eyebrow`/`stats`/`kakao-map-url`/`naver-map-url`)와 이벤트(`@share`/`@directions`)는 그대로 호환되므로 변경 불필요. (real-estate는 `copyable`/`phone` 미전달 → 복사·전화 pill 자동 숨김, `hideDirections` 미전달 → 길찾기 노출.)

- [ ] **Step 3: 부동산 상세 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts`
Expected: PASS — h1 count===1, 헤더 제목/배지 렌더 유지

- [ ] **Step 4: 커밋**

```bash
git add frontend/pages/real-estate/\[realEstateType\]/\[city\]/\[district\]/\[buildingName\].vue
git commit -m "refactor(real-estate): 단지상세 헤더를 공용 MobileDetailHeader로 교체"
```

---

### Task 4: 구 헤더 컴포넌트 제거 + 잔존 참조 검증

> **실행 순서 주의:** 이 Task는 **모든 per-page 헤더 마이그레이션 이후 맨 마지막**에 실행한다. 특히 `pages/subway/[slug].vue`도 구 `facility/detail/MobileDetailHeader`를 import하므로(plan 02 Task 1에서 공용 헤더로 교체), 그 전에 이 삭제를 실행하면 지하철 상세가 깨진다. Step 1의 grep가 잔존 참조를 잡아주지만, 순서상 plan 01~07의 헤더 교체 Task를 먼저 끝낼 것.

**Files:**
- Delete: `frontend/components/facility/detail/MobileDetailHeader.vue`, `frontend/components/realEstate/MobileRealEstateHeader.vue`
- Delete: `frontend/tests/components/facility/detail/MobileDetailHeader.test.ts`, `frontend/tests/components/realEstate/MobileRealEstateHeader.test.ts` (공용 테스트가 대체)

- [ ] **Step 1: 잔존 참조 확인 (없어야 함)**

Run:
```bash
cd frontend && grep -rn "components/facility/detail/MobileDetailHeader\|components/realEstate/MobileRealEstateHeader" --include=*.vue --include=*.ts .
```
Expected: 결과 없음 (Task 2·3에서 모두 교체됨). 결과가 있으면 해당 파일을 공용 헤더 import로 교체 후 재실행.

- [ ] **Step 2: 구 컴포넌트·테스트 삭제**

```bash
cd frontend
git rm components/facility/detail/MobileDetailHeader.vue components/realEstate/MobileRealEstateHeader.vue
git rm tests/components/facility/detail/MobileDetailHeader.test.ts tests/components/realEstate/MobileRealEstateHeader.test.ts
```

- [ ] **Step 3: 전체 프론트 테스트 + 빌드 검증**

Run: `cd frontend && npx vitest run && npm run build`
Expected: 전체 테스트 PASS, 빌드 성공 (삭제된 컴포넌트 참조로 인한 resolve 에러 없음)

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "chore: 구 MobileDetailHeader/MobileRealEstateHeader 제거 (공용 헤더로 통합)"
```

---

## Self-Review

- **Spec coverage:** §3.1 단일 h1(공용 헤더 literal h1 1개 — Task1 Step1 첫 테스트), §5 헤더 패턴(eyebrow→h1→칩→CTA, CTA 공유항상/전화조건/길찾기조건/복사조건), 결정2의 `hideDirections`(land용)·공용화 — 모두 Task 1~4로 커버.
- **후속 의존:** land/auction/subscription/public-rental 플랜은 이 공용 헤더(`~/components/common/MobileDetailHeader.vue`)를 import해 사용한다. 본 Foundation을 먼저 머지/적용해야 한다.
- **Type 일관성:** prop명 `copyable`/`hideDirections`/`eyebrow`/`status`/`stats`/`phone`은 Task1 정의 = Task2/3 사용과 일치. emit `share`/`copy`/`directions(provider)` 일관.
- **범위 밖:** 페이지별 섹션 순서 재배치는 각 per-page 플랜(01~07)에서. 본 플랜은 헤더 통합만.
