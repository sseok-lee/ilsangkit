# SourceStamp 출처·기준일 캡슐 + 데이터 인접 적용 (신뢰 디자인 격상 PR ①) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 데이터 블록(차트·표·집계·목록 스트립)에 인접한 출처·기준일 캡션 컴포넌트 `SourceStamp`를 신설하고 5개 표면에 적용한다.

**Architecture:** 순수 유틸(`utils/syncFreshness.ts`: 날짜 포맷·stale 판정·라벨 병기) 위에 표시 컴포넌트(`components/common/SourceStamp.vue`)를 얹고, 각 페이지는 기존 `/api/meta/sync-status`(이미 존재)와 `resolveDataSource`(이미 존재)에서 데이터를 공급한다. 백엔드 변경 없음, 페이지 구조·섹션 순서 변경 없음 — 기존 `SectionBlock`의 `#right` 슬롯과 각주 위치에 삽입만 한다.

**Tech Stack:** Nuxt 3 + Vue 3 (script setup), TailwindCSS(OD 토큰), Vitest + @vue/test-utils

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §5-1, §5-2 (Phase 1 PR ①)

## Global Constraints

- **Node 20 필수**: 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **SEO/SSR 불변**: URL·단일 h1·title/meta 로직·canonical·noindex·사이트맵 변경 금지. SSR 텍스트는 추가만.
- **광고 불변**: AdBanner 슬롯 개수·위치·collapse 정책에 손대지 않는다.
- **허위 신호 금지**: 날짜는 `/api/meta/sync-status` 실데이터만 사용. stale 가드(부동산·청약 2일, 시설 62일, trash 3일) 필수 — 낡은 날짜는 표기 자체를 숨긴다.
- **날짜 표기**: 사용자 노출은 `YYYY.MM.DD` (스펙 §5-8).
- **테스트에서 직접 mount하는 컴포넌트는 vue API(`computed` 등)와 유틸을 명시 import** (Nuxt auto-import는 CI vitest에서 ReferenceError — 프로젝트 기지 함정).
- **커밋**: conventional commit 한국어 스타일 (`feat(trust): ...`). main 직접 커밋 금지, PR은 develop 대상.
- `/api/meta/sync-status` 응답 봉투: `{ success: boolean; data: Record<string, string | null> }` — 시설 키는 카테고리명(`pharmacy` 등), 부동산 키는 camelCase(`aptSale` 등). 반드시 `.data`로 언랩.

---

### Task 1: 브랜치 + `syncFreshness` 유틸 (날짜 포맷·stale 판정·라벨 병기)

**Files:**
- Create: `frontend/utils/syncFreshness.ts`
- Test: `frontend/tests/utils/syncFreshness.test.ts`

**Interfaces:**
- Consumes: `formatKstDate(iso: string | null | undefined): string | null` (기존 `frontend/utils/formatters.ts` — ISO→KST `YYYY-MM-DD`, 무효 입력 null)
- Produces (이후 모든 태스크가 사용):
  - `formatDotDate(iso?: string | null): string | null` — `YYYY.MM.DD`
  - `isSyncStale(iso: string | null | undefined, staleDays: number): boolean`
  - `withSyncDate(label: string, iso?: string | null, staleDays?: number): string` (기본 staleDays=62)

- [ ] **Step 1: 브랜치 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b feat/trust-source-stamp
```

- [ ] **Step 2: 실패하는 테스트 작성** — `frontend/tests/utils/syncFreshness.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { formatDotDate, isSyncStale, withSyncDate } from '~/utils/syncFreshness'

describe('syncFreshness', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T09:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('formatDotDate: ISO를 KST YYYY.MM.DD로 변환한다', () => {
    expect(formatDotDate('2026-06-19T00:00:00.000Z')).toBe('2026.06.19')
  })

  it('formatDotDate: null·무효 입력은 null을 반환한다', () => {
    expect(formatDotDate(null)).toBeNull()
    expect(formatDotDate(undefined)).toBeNull()
    expect(formatDotDate('not-a-date')).toBeNull()
  })

  it('isSyncStale: staleDays 이내면 false, 초과하면 true', () => {
    expect(isSyncStale('2026-07-09T00:00:00.000Z', 2)).toBe(false)
    expect(isSyncStale('2026-07-01T00:00:00.000Z', 2)).toBe(true)
  })

  it('isSyncStale: null·무효 입력은 항상 true (날짜 숨김)', () => {
    expect(isSyncStale(null, 62)).toBe(true)
    expect(isSyncStale(undefined, 62)).toBe(true)
    expect(isSyncStale('nope', 62)).toBe(true)
  })

  it('withSyncDate: 신선하면 라벨에 날짜를 병기한다', () => {
    expect(withSyncDate('월 1회 자동', '2026-06-19T00:00:00.000Z')).toBe('월 1회 자동 · 2026.06.19')
  })

  it('withSyncDate: stale이거나 날짜가 없으면 라벨만 반환한다', () => {
    expect(withSyncDate('월 1회 자동', '2020-01-01T00:00:00.000Z')).toBe('월 1회 자동')
    expect(withSyncDate('매일 자동', null, 3)).toBe('매일 자동')
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd frontend && npx vitest run tests/utils/syncFreshness.test.ts
```
Expected: FAIL — `Cannot find module '~/utils/syncFreshness'`

- [ ] **Step 4: 구현** — `frontend/utils/syncFreshness.ts`

```ts
import { formatKstDate } from './formatters'

/** ISO/날짜 문자열 → KST 'YYYY.MM.DD'. 무효 입력은 null. */
export function formatDotDate(iso?: string | null): string | null {
  const ymd = formatKstDate(iso)
  return ymd ? ymd.replace(/-/g, '.') : null
}

/**
 * 마지막 동기화가 staleDays를 초과해 오래됐으면 true — 날짜 표기를 숨겨야 한다.
 * 낡은 날짜의 상시 노출은 무표기보다 신뢰를 깎는다(스펙 §5-1 stale 가드).
 */
export function isSyncStale(iso: string | null | undefined, staleDays: number): boolean {
  if (!iso) return true
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t > staleDays * 86_400_000
}

/** 갱신 주기 선언 라벨에 실제 동기화 날짜를 병기. stale이면 라벨만. */
export function withSyncDate(label: string, iso?: string | null, staleDays = 62): string {
  if (isSyncStale(iso, staleDays)) return label
  const dot = formatDotDate(iso)
  return dot ? `${label} · ${dot}` : label
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run tests/utils/syncFreshness.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 6: 커밋**

```bash
git add tests/utils/syncFreshness.test.ts utils/syncFreshness.ts
git commit -m "feat(trust): 동기화 신선도 유틸 추가 (formatDotDate·isSyncStale·withSyncDate)"
```

---

### Task 2: `SourceStamp` 컴포넌트

**Files:**
- Create: `frontend/components/common/SourceStamp.vue`
- Test: `frontend/tests/components/common/SourceStamp.test.ts`

**Interfaces:**
- Consumes: Task 1의 `formatDotDate`, `isSyncStale`
- Produces (이후 태스크가 사용하는 props):
  - `provider: string` (필수) / `basis?: string | null` (접두어 없이 그대로 렌더) / `syncedAt?: string | null` (ISO) / `sourceUrl?: string | null` / `linkLabel?: string` (기본 `'원본 보기'`) / `variant?: 'capsule' | 'plain'` (기본 `'capsule'`, capsule은 md 미만에서 자동 plain) / `staleDays?: number` (기본 62)
  - 단일 루트 `<span>` — 호출부에서 `class`(mt-2 등) 전달 가능

- [ ] **Step 1: 실패하는 테스트 작성** — `frontend/tests/components/common/SourceStamp.test.ts`

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import SourceStamp from '~/components/common/SourceStamp.vue'

describe('SourceStamp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-10T09:00:00+09:00'))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('provider를 항상 렌더한다', () => {
    const w = mount(SourceStamp, { props: { provider: '국토교통부' } })
    expect(w.text()).toContain('국토교통부')
  })

  it('신선한 syncedAt이면 "YYYY.MM.DD 동기화"와 상태점을 렌더한다', () => {
    const w = mount(SourceStamp, {
      props: { provider: '국토교통부', syncedAt: '2026-07-10T00:00:00.000Z', staleDays: 2 },
    })
    expect(w.text()).toContain('2026.07.10 동기화')
    expect(w.find('.bg-success').exists()).toBe(true)
  })

  it('stale이면 날짜·상태점을 숨기고 provider는 유지한다', () => {
    const w = mount(SourceStamp, {
      props: { provider: '행정안전부', syncedAt: '2025-01-01T00:00:00.000Z', staleDays: 62 },
    })
    expect(w.text()).not.toContain('동기화')
    expect(w.find('.bg-success').exists()).toBe(false)
    expect(w.text()).toContain('행정안전부')
  })

  it('basis를 접두어 없이 그대로 렌더한다', () => {
    const w = mount(SourceStamp, { props: { provider: '국토교통부', basis: '전체 기간 누적' } })
    expect(w.text()).toContain('전체 기간 누적')
  })

  it('sourceUrl이 있으면 새 탭 링크를 렌더한다', () => {
    const w = mount(SourceStamp, {
      props: { provider: '국토교통부', sourceUrl: 'https://rt.molit.go.kr', linkLabel: '원본 보기' },
    })
    const a = w.find('a')
    expect(a.attributes('href')).toBe('https://rt.molit.go.kr')
    expect(a.attributes('target')).toBe('_blank')
    expect(a.attributes('rel')).toContain('noopener')
    expect(a.text()).toContain('원본 보기')
  })

  it('plain variant는 캡슐 클래스를 갖지 않는다', () => {
    const w = mount(SourceStamp, { props: { provider: 'x', variant: 'plain' } })
    expect(w.attributes('class')).not.toContain('md:border')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/components/common/SourceStamp.test.ts
```
Expected: FAIL — 컴포넌트 파일 없음

- [ ] **Step 3: 구현** — `frontend/components/common/SourceStamp.vue`

```vue
<template>
  <span
    class="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight text-faint md:text-xs"
    :class="capsule ? 'md:rounded-full md:border md:border-line md:bg-surface-light md:px-3 md:py-1' : ''"
  >
    <span v-if="showDate" class="size-1.5 shrink-0 rounded-full bg-success" aria-hidden="true"></span>
    <span class="font-bold text-muted">{{ provider }}</span>
    <template v-if="basis">
      <span aria-hidden="true">·</span>
      <span>{{ basis }}</span>
    </template>
    <template v-if="showDate">
      <span aria-hidden="true">·</span>
      <span class="[font-variant-numeric:tabular-nums]">{{ displayDate }} 동기화</span>
    </template>
    <template v-if="sourceUrl">
      <span aria-hidden="true">·</span>
      <a
        :href="sourceUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="font-semibold text-primary hover:underline"
      >{{ linkLabel }} ↗</a>
    </template>
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { formatDotDate, isSyncStale } from '~/utils/syncFreshness'

const props = withDefaults(defineProps<{
  /** 제공 기관명 */
  provider: string
  /** 산출 조건·기준 텍스트 (예: '기준 2026.06', '전체 기간 누적') — 접두어 없이 그대로 렌더 */
  basis?: string | null
  /** 마지막 동기화 시각 ISO — stale이면 날짜·상태점 자동 숨김 */
  syncedAt?: string | null
  sourceUrl?: string | null
  linkLabel?: string
  /** capsule: md 이상 알약형(미만 자동 plain) / plain: 항상 텍스트형 */
  variant?: 'capsule' | 'plain'
  /** 신선도 한계(일): 부동산·청약 2, trash 3, 시설 62 */
  staleDays?: number
}>(), {
  basis: null,
  syncedAt: null,
  sourceUrl: null,
  linkLabel: '원본 보기',
  variant: 'capsule',
  staleDays: 62,
})

const capsule = computed(() => props.variant === 'capsule')
const displayDate = computed(() => formatDotDate(props.syncedAt))
const showDate = computed(() => !!displayDate.value && !isSyncStale(props.syncedAt, props.staleDays))
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run tests/components/common/SourceStamp.test.ts
```
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add tests/components/common/SourceStamp.test.ts components/common/SourceStamp.vue
git commit -m "feat(trust): SourceStamp 출처·기준일 캡슐 컴포넌트 (stale 가드 포함)"
```

---

### Task 3: 부동산 건물 상세 적용 — 차트 각주 + 거래표 헤더

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
  - 시세 추이 SectionBlock (약 L155-253, `<PriceTrendChart ...>` 직후)
  - 거래 내역 SectionBlock (약 L259-282)
  - script: `rawSyncDate` computed(기존, 약 L754-758) 아래에 `txBasis` 추가

**Interfaces:**
- Consumes: `SourceStamp`(Task 2), 기존 `rawSyncDate: ComputedRef<string | null>`(미포맷 ISO), 기존 `buildingInfo.value.latestDealYear/latestDealMonth: number | null`
- Produces: `txBasis: ComputedRef<string | null>` (이 페이지 내부 전용)

- [ ] **Step 1: script에 txBasis computed 추가** (기존 `rawSyncDate` computed 바로 아래)

```ts
// 시세 추이 각주용 기준월 — 최신 거래월(dealYmd)이 없으면 표기 생략
const txBasis = computed(() => {
  const info = buildingInfo.value
  if (!info?.latestDealYear || !info?.latestDealMonth) return null
  return `기준 ${info.latestDealYear}.${String(info.latestDealMonth).padStart(2, '0')}`
})
```

- [ ] **Step 2: 시세 추이 섹션 — `<PriceTrendChart ... />` 바로 다음 줄에 각주 삽입**

```html
<SourceStamp
  class="mt-2"
  variant="plain"
  provider="국토교통부"
  :basis="txBasis"
  :synced-at="rawSyncDate"
  :stale-days="2"
/>
```

- [ ] **Step 3: 거래 내역 SectionBlock에 `#right` 슬롯 추가** (`<TransactionTable` 앞, SectionBlock 여는 태그 직후)

```html
<template #right>
  <SourceStamp
    provider="국토교통부"
    :synced-at="rawSyncDate"
    :stale-days="2"
    source-url="https://rt.molit.go.kr"
    link-label="원본 보기"
  />
</template>
```
(컴포넌트는 Nuxt 자동 등록 — 페이지에서 import 불필요. SectionBlock header는 `#right` 슬롯을 우측 정렬로 렌더함.)

- [ ] **Step 4: 관련 테스트 스위트 통과 확인**

```bash
npx vitest run tests/ --silent 2>&1 | tail -5
```
Expected: 전체 PASS (기존 실패 0 유지)

- [ ] **Step 5: 커밋**

```bash
git add 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue'
git commit -m "feat(trust): 부동산 상세 차트·거래표에 SourceStamp 적용"
```

---

### Task 4: 시설 상세 기본정보 적용

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` — 기존 `lastSyncDate` computed(약 L636-642) 아래 `rawSyncDate` 추가 + `<DetailBasicInfo>` 호출부에 prop 전달
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` — props에 `rawSyncDate` 추가 + SectionBlock `#right`에 SourceStamp
- Test: `frontend/tests/components/facility/detail/DetailBasicInfoSourceStamp.test.ts` (신규)

**Interfaces:**
- Consumes: `SourceStamp`(Task 2), 기존 `resolveDataSource({ domain: 'facility', category }): DataSourceInfo | null` (`~/utils/dataSource`, `DataSourceInfo = { datasetName; provider; url; kogl? }`), `[id].vue`의 기존 `secondaryResponse.value.syncStatus: Record<string, string | null> | null`
- Produces: `DetailBasicInfo`의 새 prop `rawSyncDate?: string | null`

- [ ] **Step 1: 실패하는 테스트 작성** — `frontend/tests/components/facility/detail/DetailBasicInfoSourceStamp.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailBasicInfo from '~/components/facility/detail/DetailBasicInfo.vue'
import type { FacilityDetail } from '~/types/facility'

const pharmacyFixture = {
  id: 'pharmacy-test',
  category: 'pharmacy',
  name: '테스트약국',
  address: '서울특별시 강남구 테스트로 1',
  lat: 37.5,
  lng: 127.0,
} as unknown as FacilityDetail

describe('DetailBasicInfo — SourceStamp', () => {
  it('제공기관과 동기화 날짜를 섹션 헤더에 렌더한다', () => {
    const w = mount(DetailBasicInfo, {
      props: { facility: pharmacyFixture, rawSyncDate: '2026-06-19T00:00:00.000Z' },
    })
    expect(w.text()).toContain('건강보험심사평가원')
    expect(w.text()).toContain('2026.06.19 동기화')
  })

  it('rawSyncDate가 없어도 제공기관은 렌더한다', () => {
    const w = mount(DetailBasicInfo, { props: { facility: pharmacyFixture } })
    expect(w.text()).toContain('건강보험심사평가원')
    expect(w.text()).not.toContain('동기화')
  })
})
```
주의: `DetailBasicInfo`의 기존 필수 props(병원/AED/약국 시간표 배열 등)가 있으면 mount가 타입/런타임 에러를 낸다 — 그 경우 해당 props를 빈 배열로 추가한다(파일 상단 `defineProps` 정의 확인). fixture는 pharmacy 분기(제공기관 = 건강보험심사평가원, `FACILITY_DATA_SOURCE.pharmacy`)를 사용.

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/components/facility/detail/DetailBasicInfoSourceStamp.test.ts
```
Expected: FAIL — `rawSyncDate` prop 없음 / SourceStamp 미렌더로 '건강보험심사평가원'·'동기화' 미포함

- [ ] **Step 3: DetailBasicInfo.vue 수정**

script setup에 (기존 import 옆에):
```ts
import { computed } from 'vue'
import { resolveDataSource } from '~/utils/dataSource'
import SourceStamp from '~/components/common/SourceStamp.vue'
```
(이 컴포넌트는 테스트에서 직접 mount되므로 명시 import — Global Constraints 참조. 기존에 `computed`를 이미 import하고 있으면 중복 추가하지 않는다.)

props 정의(약 L647-656)에 추가:
```ts
rawSyncDate?: string | null
```

computed 추가:
```ts
const dataSource = computed(() => resolveDataSource({ domain: 'facility', category: props.facility.category }))
```

템플릿 — `<SectionBlock heading="기본정보" subtext="...">` 여는 태그 바로 다음에:
```html
<template #right>
  <SourceStamp
    v-if="dataSource"
    :provider="dataSource.provider"
    :synced-at="rawSyncDate ?? null"
    :source-url="dataSource.url"
    link-label="데이터셋"
  />
</template>
```

- [ ] **Step 4: `[id].vue` 수정** — 기존 `lastSyncDate` computed 아래에:

```ts
// SourceStamp용 미포맷 ISO (lastSyncDate는 DataSourceSection용 포맷 문자열)
const rawSyncDate = computed<string | null>(() => {
  const data = secondaryResponse.value?.syncStatus
  if (!data) return null
  return data[category.value] ?? null
})
```
`<DetailBasicInfo` 호출부에 `:raw-sync-date="rawSyncDate"` 추가.
(이 페이지의 카테고리 ref 이름이 `category`가 아니면 — 기존 `lastSyncDate` computed가 쓰는 것과 동일한 ref를 사용한다.)

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run tests/components/facility/detail/DetailBasicInfoSourceStamp.test.ts && npx vitest run tests/ --silent 2>&1 | tail -5
```
Expected: 신규 2 tests PASS + 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add components/facility/detail/DetailBasicInfo.vue 'pages/[category]/[id].vue' tests/components/facility/detail/DetailBasicInfoSourceStamp.test.ts
git commit -m "feat(trust): 시설 상세 기본정보 헤더에 SourceStamp 적용"
```

---

### Task 5: 목록 스탯 스트립에 실제 동기화 날짜 병기 (전국 + 지역)

**Files:**
- Modify: `frontend/pages/[category]/index.vue` — heroStats computed(약 L520-535) + sync-status fetch 추가
- Modify: `frontend/pages/[city]/[district]/[category].vue` — heroStats computed(약 L254-266) + sync-status fetch 추가

**Interfaces:**
- Consumes: `withSyncDate`(Task 1), `GET {apiBase}/api/meta/sync-status` → `{ success, data: Record<string, string | null> }`
- Produces: 없음 (페이지 내부 변경)
- 참고 식별자: 전국 페이지 카테고리 ref는 `categoryParam`, 지역 페이지는 `category`(L114) + 기존 `apiBase = useApiBase()`(L166)

- [ ] **Step 1: 전국 페이지 수정** — `frontend/pages/[category]/index.vue`

script에 fetch 추가 (heroStats computed 위):
```ts
import { withSyncDate } from '~/utils/syncFreshness'

const syncApiBase = useApiBase()
const { data: syncStatusData } = useAsyncData<Record<string, string | null> | null>(
  `sync-status-${categoryParam.value}`,
  async () => {
    const res = await $fetch<{ success: boolean; data: Record<string, string | null> }>(
      `${syncApiBase}/api/meta/sync-status`,
      { signal: AbortSignal.timeout(8000) },
    )
    return res.data ?? null
  },
  { server: false },
)
```

heroStats의 '데이터 갱신' 항목 교체:
```ts
stats.push({
  label: '데이터 갱신',
  value: withSyncDate(
    categoryParam.value === 'trash' ? '매일 자동' : '월 1회 자동',
    syncStatusData.value?.[categoryParam.value],
    categoryParam.value === 'trash' ? 3 : 62,
  ),
})
```

- [ ] **Step 2: 지역 페이지 수정** — `frontend/pages/[city]/[district]/[category].vue`

script에 fetch 추가 (기존 `apiBase` 재사용):
```ts
import { withSyncDate } from '~/utils/syncFreshness'

const { data: syncStatusData } = useAsyncData<Record<string, string | null> | null>(
  `region-sync-status-${category.value}`,
  async () => {
    const res = await $fetch<{ success: boolean; data: Record<string, string | null> }>(
      `${apiBase}/api/meta/sync-status`,
      { signal: AbortSignal.timeout(8000) },
    )
    return res.data ?? null
  },
  { server: false },
)
```

heroStats의 '업데이트' 항목 교체:
```ts
s.push({
  label: '업데이트',
  value: withSyncDate(
    isTrash.value ? '매일 자동' : '월 1회 자동',
    syncStatusData.value?.[category.value],
    isTrash.value ? 3 : 62,
  ),
})
```

- [ ] **Step 3: 전체 테스트 + 수동 확인**

```bash
npx vitest run tests/ --silent 2>&1 | tail -5
```
Expected: 전체 PASS.
수동: `npm run dev` 후 `http://localhost:3000/pharmacy/` 스탯 스트립에 `월 1회 자동 · YYYY.MM.DD` 표시 확인 (백엔드 dev 서버 필요 — 없으면 라벨만 나오는 폴백 확인).

- [ ] **Step 4: 커밋**

```bash
git add 'pages/[category]/index.vue' 'pages/[city]/[district]/[category].vue'
git commit -m "feat(trust): 목록 스탯 스트립에 실제 동기화 날짜 병기 (선언→증명)"
```

---

### Task 6: 지역 허브 시세 현황 — 출처·산출조건 각주

**Files:**
- Modify: `frontend/components/region/RegionRealEstatePrices.vue` — prop `syncedAt` 추가 + 각주
- Modify: `frontend/pages/[city]/index.vue` — sync-status fetch + 부동산 6키 max computed + prop 전달
- Test: `frontend/tests/components/region/RegionRealEstatePrices.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Consumes: `SourceStamp`(Task 2), sync-status의 부동산 camelCase 키 6종
- Produces: `RegionRealEstatePrices`의 새 prop `syncedAt?: string | null`
- 산출조건 문구는 스펙 §5-2 확정값: **`전체 기간 누적`** (backend `areaService.aggregateRealEstate`가 날짜 조건 없는 all-time 집계임을 코드로 확인함 — 표기는 현행 쿼리를 정직하게 기술)

- [ ] **Step 1: 실패하는 테스트 추가** — `frontend/tests/components/region/RegionRealEstatePrices.test.ts` 하단에 append (기존 mount 픽스처의 props 구성을 재사용하되 `syncedAt`만 추가):

```ts
describe('RegionRealEstatePrices — SourceStamp 각주', () => {
  it('출처·산출조건(전체 기간 누적)을 렌더한다', () => {
    // 이 파일 상단의 기존 mount 헬퍼/픽스처와 동일한 props에 syncedAt만 추가해 mount
    const w = mount(RegionRealEstatePrices, {
      props: { cards: [], syncedAt: '2026-07-10T00:00:00.000Z' },
    })
    expect(w.text()).toContain('국토교통부')
    expect(w.text()).toContain('전체 기간 누적')
  })
})
```
(기존 파일의 필수 props가 `cards` 외에 더 있으면 기존 테스트의 픽스처 값을 그대로 복사해 사용한다.)

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/components/region/RegionRealEstatePrices.test.ts
```
Expected: 신규 describe FAIL (기존 테스트는 PASS 유지)

- [ ] **Step 3: RegionRealEstatePrices.vue 수정**

script setup:
```ts
import SourceStamp from '~/components/common/SourceStamp.vue'
```
props에 추가:
```ts
syncedAt?: string | null
```
템플릿 — 카드 그리드 닫는 태그 다음(섹션 마지막)에:
```html
<SourceStamp
  class="mt-3"
  variant="plain"
  provider="국토교통부"
  basis="전체 기간 누적"
  :synced-at="syncedAt ?? null"
  :stale-days="2"
/>
```

- [ ] **Step 4: `[city]/index.vue` 수정**

script에 추가:
```ts
const RE_SYNC_KEYS = ['aptSale', 'aptRent', 'villaSale', 'villaRent', 'offitelSale', 'offitelRent'] as const

const hubSyncApiBase = useApiBase()
const { data: hubSyncStatus } = useAsyncData<Record<string, string | null> | null>(
  'city-hub-sync-status',
  async () => {
    const res = await $fetch<{ success: boolean; data: Record<string, string | null> }>(
      `${hubSyncApiBase}/api/meta/sync-status`,
      { signal: AbortSignal.timeout(8000) },
    )
    return res.data ?? null
  },
  { server: false },
)

// 부동산 6개 테이블 중 가장 최근 동기화 시각 (ISO 문자열은 사전순 = 시간순)
const reSyncedAt = computed<string | null>(() => {
  const s = hubSyncStatus.value
  if (!s) return null
  const dates = RE_SYNC_KEYS.map(k => s[k]).filter((v): v is string => !!v)
  return dates.length ? [...dates].sort().at(-1) ?? null : null
})
```
`<RegionRealEstatePrices` 호출부(약 L22-25)에 `:synced-at="reSyncedAt"` 추가.

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run tests/components/region/RegionRealEstatePrices.test.ts && npx vitest run tests/ --silent 2>&1 | tail -5
```
Expected: PASS

- [ ] **Step 6: 커밋**

```bash
git add components/region/RegionRealEstatePrices.vue 'pages/[city]/index.vue' tests/components/region/RegionRealEstatePrices.test.ts
git commit -m "feat(trust): 지역 허브 시세 현황에 출처·전체기간누적 각주 (기간 없는 수치 해소)"
```

---

### Task 7: 홈 시장 각주를 SourceStamp 규격으로 통일

**Files:**
- Modify: `frontend/components/home/HomeHotspotSignals.vue` — 각주(L90-93) 교체
- Test: `frontend/tests/components/home/HomeHotspotSignals.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: `SourceStamp`(Task 2)
- Produces: 없음 — 문구·의미 불변, 마크업만 규격 통일

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 `HomeHotspotSignals.test.ts` 하단에 append (기존 mount 픽스처 재사용):

```ts
describe('HomeHotspotSignals — 각주 규격', () => {
  it('출처·산출조건 각주 텍스트를 유지한다', () => {
    // 파일 상단의 기존 hotspots 픽스처를 그대로 사용해 mount
    expect(wrapperText).toContain('국토교통부 실거래가')
    expect(wrapperText).toContain('최근 7일 vs 직전 7일')
  })
})
```
(기존 테스트가 이미 mount한 wrapper가 있으면 재사용, 없으면 동일 픽스처로 mount해 `wrapperText = w.text()` 구성. 이 테스트는 교체 후에도 각주 텍스트가 회귀하지 않음을 고정하는 것이 목적.)

- [ ] **Step 2: HomeHotspotSignals.vue 수정**

script setup에:
```ts
import SourceStamp from '~/components/common/SourceStamp.vue'
```
각주 블록(L90-93) 교체 — 기존:
```html
<div class="px-6 py-3 bg-background-light border-t border-line text-[11px] text-muted flex items-center gap-2">
  <span class="material-symbols-outlined text-[14px] text-faint">info</span>
  국토교통부 실거래가 · 최근 7일 vs 직전 7일 · 표본 30건 미만 지역 제외
</div>
```
신규:
```html
<div class="px-6 py-3 bg-background-light border-t border-line">
  <SourceStamp
    variant="plain"
    provider="국토교통부 실거래가"
    basis="최근 7일 vs 직전 7일 · 표본 30건 미만 지역 제외"
  />
</div>
```

- [ ] **Step 3: 테스트 통과 확인**

```bash
npx vitest run tests/components/home/HomeHotspotSignals.test.ts
```
Expected: PASS (기존 + 신규)

- [ ] **Step 4: 커밋**

```bash
git add components/home/HomeHotspotSignals.vue tests/components/home/HomeHotspotSignals.test.ts
git commit -m "refactor(trust): 홈 시장 각주를 SourceStamp 규격으로 통일"
```

---

### Task 8: 전체 검증 + PR 생성

**Files:** 없음 (검증·PR)

- [ ] **Step 1: lint + 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -5
npx vitest run 2>&1 | tail -5
```
Expected: lint 신규 오류 0, 테스트 전체 PASS. 실패 시 해당 태스크로 돌아가 수정 후 재실행.

- [ ] **Step 2: 불변식 스폿체크 (dev 서버)**

```bash
npm run dev
```
- `/pharmacy/` — h1 1개, title 불변, 스탯 스트립 날짜 병기 확인
- 부동산 건물 상세 1곳 — 차트 아래 각주 + 거래표 헤더 캡슐, 모바일 뷰포트(390px)에서 가로 넘침 없음
- 광고 슬롯 개수 변화 없음 확인

- [ ] **Step 3: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-source-stamp
gh pr create --base develop \
  --title "feat(trust): SourceStamp 출처·기준일 캡슐 + 데이터 인접 적용 5곳" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10) Phase 1 PR ①.
데이터를 판단하는 지점에 출처·기준일을 인접 표기하는 SourceStamp 컴포넌트 신설 + 5개 표면 적용.

- utils/syncFreshness: formatDotDate · isSyncStale(stale 가드) · withSyncDate
- components/common/SourceStamp.vue: capsule/plain 2 variant, stale 시 날짜 자동 숨김
- 적용: 부동산 상세(차트 각주+거래표 원본 링크) / 시설 상세 기본정보 / 목록 스탯 스트립(선언→실제 날짜) / 지역 허브(전체 기간 누적 명기) / 홈 각주 규격 통일

## 불변식
- URL·h1·title/meta·광고 슬롯 불변, SSR 텍스트 추가만
- 날짜는 /api/meta/sync-status 실데이터만, stale(부동산 2일·시설 62일) 시 표기 숨김

## 테스트
- 신규: syncFreshness 6 · SourceStamp 6 · DetailBasicInfo 2 · RegionRealEstatePrices 1 · HomeHotspotSignals 1
- 전체 frontend vitest PASS
EOF
)"
```
Expected: PR URL 출력. CI(`Test` 워크플로우) 통과 확인 후 사용자에게 머지 판단 요청 (자체 머지 금지).

---

## 플랜 메모

- **범위 이월 기록**: 스펙 §5-2의 "스탯 컴포넌트 산출조건 라벨 슬롯 필수화"의 구조 확장(PageHero `Stat.basis`)은 Phase 2 PR ⑤(카운터 밴드 개편)에서 함께 다룬다 — 이 PR에서는 최우선 갭(지역 허브 기간 미표기)을 Task 6 각주로 해소.
- **후속 플랜**: PR ② 푸터/트러스트라인/바이라인 → PR ③ 결함 스윕 → PR ④ 광고 계약+마이크로카피 → PR ⑤~⑦ Phase 2. 각각 별도 플랜 문서로 작성 예정.
- 백엔드 변경 없음 — `/api/meta/sync-status`·`resolveDataSource`·`FACILITY_DATA_SOURCE` 전부 기존 자산.
