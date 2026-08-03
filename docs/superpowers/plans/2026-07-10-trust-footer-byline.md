# 운영 실체 + 트러스트 라인 + 바이라인 (신뢰 디자인 격상 PR ②) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 운영 주체·연락처·정정 채널을 전 페이지에 가시화(푸터 운영 블록 + 트러스트 라인 + 출처 카드 수정 요청)하고, 콘텐츠 56건의 무기명 인상을 팀 바이라인으로 제거한다. PR ① 트리아지 후속(useSyncStatus 컴포저블, STALE_DAYS 상수)도 함께 처리.

**Architecture:** `useSyncStatus` 컴포저블(stable key 'sync-status', 전체 max 파생)로 PR ①의 fetch 3중복을 통합하고 푸터의 "데이터 최종 동기화"까지 공급한다. 신규 표면은 AppFooter 운영 블록, TrustLine 컴포넌트(layouts/default.vue, 홈 제외), DataSourceSection 수정 요청 링크, guide/article 바이라인. 백엔드 변경 없음(publishedAt·sync-status 모두 기존 API 보유).

**Tech Stack:** Nuxt 3 + Vue 3 (script setup), TailwindCSS(OD 토큰), Vitest + @vue/test-utils

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §5-3, §5-4, §5-5 + PR ① 최종 리뷰 트리아지(fetch 중복·stable key·RE_STALE_DAYS)

## Global Constraints

- **Node 20 필수**: 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **SEO/SSR 불변**: URL·단일 h1·title/meta 로직·canonical·noindex·섹션 순서·광고 슬롯 불변. SSR 텍스트는 추가만.
- **허위 신호 금지**: "✓ 공공데이터 원문 대조 검수" 문구는 어드민 검토·발행 플로우가 실재하는 guide/article에만. "데이터 최종 동기화"는 sync-status 실데이터 전체 max + stale 가드(2일 초과 시 행 숨김).
- **확정 문구(스펙 §4·§5-3)**: 운영 주체 = `일상킷 팀`, 이메일 = `contact@ilsangkit.co.kr`, SLA = `확인 후 3~5일 내 반영`, 저자 = `일상킷 데이터팀`, 면책 = `본 서비스의 정보는 공공데이터포털(data.go.kr)·국토교통부 실거래가 공개시스템 자료를 가공한 참고용 정보입니다.`
- **직접 mount되는 컴포넌트(AppFooter·TrustLine·DataSourceSection·RegionRealEstatePrices)는 vue API·유틸·컴포저블 명시 import** (auto-import는 CI vitest ReferenceError).
- **커밋**: conventional commit 한국어 (`feat(trust): ...`). PR은 develop 대상, 자체 머지 금지.
- `/api/meta/sync-status` 봉투 `{ success, data }` — `.data` 언랩. ISO 문자열은 사전순=시간순.
- 홈(`/`)은 기존 확장판 트러스트 박스 유지 — TrustLine은 홈에서 렌더 금지(중복 방지).

---

### Task 1: STALE_DAYS 상수 + `formatDotDateTime` + `useSyncStatus` 컴포저블

**Files:**
- Modify: `frontend/utils/syncFreshness.ts` (26줄 — 상단에 상수, 하단에 함수 추가)
- Create: `frontend/composables/useSyncStatus.ts`
- Test: `frontend/tests/utils/syncFreshness.test.ts` (케이스 추가), `frontend/tests/composables/useSyncStatus.test.ts` (신규)

**Interfaces:**
- Consumes: 기존 `formatKstDate`, `useApiBase()`, `useAsyncData`(tests/setup.ts 전역 mock 존재)
- Produces (이후 태스크가 사용):
  - `RE_STALE_DAYS = 2`, `TRASH_STALE_DAYS = 3`, `FACILITY_STALE_DAYS = 62` (`~/utils/syncFreshness`)
  - `formatDotDateTime(iso?: string | null): string | null` — KST `YYYY.MM.DD HH:mm`
  - `useSyncStatus(): { syncStatus: Readonly<Ref<Record<string, string|null> | null>>, latestOverall: ComputedRef<string | null> }` — key `'sync-status'` 고정, `{ server: false }`

- [ ] **Step 1: 브랜치 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b feat/trust-footer-byline
```

- [ ] **Step 2: 실패하는 테스트 추가** — `frontend/tests/utils/syncFreshness.test.ts`의 describe 안에 append:

```ts
  it('formatDotDateTime: ISO를 KST YYYY.MM.DD HH:mm로 변환한다', () => {
    expect(formatDotDateTime('2026-07-10T03:00:00.000Z')).toBe('2026.07.10 12:00')
  })

  it('formatDotDateTime: null·무효 입력은 null', () => {
    expect(formatDotDateTime(null)).toBeNull()
    expect(formatDotDateTime('nope')).toBeNull()
  })

  it('STALE_DAYS 상수는 도메인 규칙(RE 2·trash 3·시설 62)을 노출한다', () => {
    expect(RE_STALE_DAYS).toBe(2)
    expect(TRASH_STALE_DAYS).toBe(3)
    expect(FACILITY_STALE_DAYS).toBe(62)
  })
```
파일 상단 import에 `formatDotDateTime, RE_STALE_DAYS, TRASH_STALE_DAYS, FACILITY_STALE_DAYS` 추가.

- [ ] **Step 3: 신규 컴포저블 테스트 작성** — `frontend/tests/composables/useSyncStatus.test.ts`

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import { ref } from 'vue'
import { useSyncStatus } from '~/composables/useSyncStatus'

describe('useSyncStatus', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubNuxt(fixture: Record<string, string | null> | null) {
    const captured: { key?: string; opts?: Record<string, unknown> } = {}
    vi.stubGlobal('useApiBase', () => 'http://test-api')
    vi.stubGlobal('useAsyncData', (key: string, _handler: unknown, opts: Record<string, unknown>) => {
      captured.key = key
      captured.opts = opts
      return { data: ref(fixture) }
    })
    return captured
  }

  it('stable key "sync-status" + server:false로 useAsyncData를 호출한다', () => {
    const captured = stubNuxt(null)
    useSyncStatus()
    expect(captured.key).toBe('sync-status')
    expect(captured.opts).toMatchObject({ server: false })
  })

  it('latestOverall: 전체 값 중 최신 ISO를 반환한다 (null 무시)', () => {
    stubNuxt({ pharmacy: '2026-06-19T00:00:00.000Z', aptSale: '2026-07-10T06:00:00.000Z', trash: null })
    const { latestOverall } = useSyncStatus()
    expect(latestOverall.value).toBe('2026-07-10T06:00:00.000Z')
  })

  it('latestOverall: 데이터 없으면 null', () => {
    stubNuxt(null)
    const { latestOverall } = useSyncStatus()
    expect(latestOverall.value).toBeNull()
  })
})
```

- [ ] **Step 4: 테스트 실패 확인**

```bash
cd frontend && npx vitest run tests/utils/syncFreshness.test.ts tests/composables/useSyncStatus.test.ts
```
Expected: FAIL — `formatDotDateTime`/상수/`~/composables/useSyncStatus` 미존재

- [ ] **Step 5: 구현** — `frontend/utils/syncFreshness.ts`에 추가 (import 아래):

```ts
/** 도메인별 동기화 신선도 한계(일) — 초과 시 날짜 표기 숨김 (스펙 §5-1) */
export const RE_STALE_DAYS = 2       // 부동산·청약 (daily sync)
export const TRASH_STALE_DAYS = 3    // 쓰레기 배출 일정 (daily sync)
export const FACILITY_STALE_DAYS = 62 // 시설 (월 1회 sync)
```

파일 하단에 추가:

```ts
/** ISO → KST 'YYYY.MM.DD HH:mm'. 무효 입력은 null. */
export function formatDotDateTime(iso?: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  // en-CA: 'YYYY-MM-DD, HH:mm'
  return fmt.format(t).replace(/-/g, '.').replace(',', '')
}
```

신규 `frontend/composables/useSyncStatus.ts`:

```ts
import { computed, readonly } from 'vue'

/**
 * 카테고리별 최근 동기화 시각 (/api/meta/sync-status) 공용 컴포저블.
 * stable key 하나로 페이지당 1회만 fetch (Nuxt useAsyncData 키 dedupe).
 * SSR 미실행(server:false) — SSR/hydration은 null(라벨만) → 클라이언트에서 반응형 갱신.
 */
export function useSyncStatus() {
  const apiBase = useApiBase()
  const { data } = useAsyncData<Record<string, string | null> | null>(
    'sync-status',
    async () => {
      const res = await $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal: AbortSignal.timeout(8000) },
      )
      return res.data ?? null
    },
    { server: false },
  )

  /** 전 카테고리 통틀어 가장 최근 동기화 ISO (사전순=시간순, null 무시) */
  const latestOverall = computed<string | null>(() => {
    const s = data.value
    if (!s) return null
    const dates = Object.values(s).filter((v): v is string => !!v)
    return dates.length ? [...dates].sort().at(-1) ?? null : null
  })

  return { syncStatus: readonly(data), latestOverall }
}
```

- [ ] **Step 6: 테스트 통과 확인**

```bash
npx vitest run tests/utils/syncFreshness.test.ts tests/composables/useSyncStatus.test.ts
```
Expected: PASS (기존 6 + 신규 3 + 컴포저블 3)

- [ ] **Step 7: 커밋**

```bash
git add utils/syncFreshness.ts composables/useSyncStatus.ts tests/utils/syncFreshness.test.ts tests/composables/useSyncStatus.test.ts
git commit -m "feat(trust): useSyncStatus 컴포저블 + STALE_DAYS 상수 + formatDotDateTime"
```

---

### Task 2: PR ① fetch 3중복을 useSyncStatus로 교체 + stale-days 상수 치환

**Files:**
- Modify: `frontend/pages/[category]/index.vue` — L520-531 fetch 블록 교체 + L544 소비처 + trash?3:62 상수화
- Modify: `frontend/pages/[city]/[district]/[category].vue` — L255-265 교체 + L280 소비처 + 상수화
- Modify: `frontend/pages/[city]/index.vue` — L195-206 교체 (reSyncedAt L209-214는 유지, 소스만 변경)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — L257·L273 `:stale-days="2"` → `RE_STALE_DAYS`
- Modify: `frontend/components/region/RegionRealEstatePrices.vue` — L44 `:stale-days="2"` → `RE_STALE_DAYS`

**Interfaces:**
- Consumes: Task 1의 `useSyncStatus()`, `RE_STALE_DAYS`/`TRASH_STALE_DAYS`/`FACILITY_STALE_DAYS`
- Produces: 없음 (동작 동일, 구조만 통합 — 기존 테스트가 전부 그대로 PASS해야 함)

- [ ] **Step 1: 전국 페이지 교체** — `[category]/index.vue`

L520-531의 `syncApiBase` 선언 + `useAsyncData` 블록 전체를 삭제하고 교체:
```ts
const { syncStatus } = useSyncStatus()
```
(`useSyncStatus`는 composables auto-import — 페이지 컨텍스트라 명시 import 불필요. 기존 `import { withSyncDate } from '~/utils/syncFreshness'`를 확장: `import { withSyncDate, TRASH_STALE_DAYS, FACILITY_STALE_DAYS } from '~/utils/syncFreshness'`)

L544 소비처 교체:
```ts
value: withSyncDate(
  categoryParam.value === 'trash' ? '매일 자동' : '월 1회 자동',
  syncStatus.value?.[categoryParam.value],
  categoryParam.value === 'trash' ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS,
),
```

- [ ] **Step 2: 지역 페이지 교체** — `[city]/[district]/[category].vue`

L255-265 블록 삭제 → `const { syncStatus } = useSyncStatus()`. import 확장 동일. L280 소비처:
```ts
value: withSyncDate(
  isTrash.value ? '매일 자동' : '월 1회 자동',
  syncStatus.value?.[category.value],
  isTrash.value ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS,
),
```

- [ ] **Step 3: 허브 페이지 교체** — `[city]/index.vue`

L195-206의 `hubSyncApiBase` + `useAsyncData` 블록 삭제 → `const { syncStatus: hubSyncStatus } = useSyncStatus()`. `reSyncedAt` computed(L209-214)의 `hubSyncStatus.value` 참조는 이름 그대로 동작(기존 변수명이 `hubSyncStatus`였음 — data ref 이름만 확인해 맞출 것).

- [ ] **Step 4: stale-days 상수 치환**

`[buildingName].vue` L257·L273: `:stale-days="2"` → `:stale-days="RE_STALE_DAYS"`, script에 `import { RE_STALE_DAYS } from '~/utils/syncFreshness'` 추가.
`RegionRealEstatePrices.vue` L44: 동일 치환 + **명시 import**(직접 mount 컴포넌트): `import { RE_STALE_DAYS } from '~/utils/syncFreshness'`.

- [ ] **Step 5: 전체 테스트 (회귀 없음이 이 태스크의 스펙)**

```bash
npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS — 특히 RegionRealEstatePrices 5/5, HomeHotspotSignals, DetailBasicInfoSourceStamp 기존 그대로.

- [ ] **Step 6: 커밋**

```bash
git add 'pages/[category]/index.vue' 'pages/[city]/[district]/[category].vue' 'pages/[city]/index.vue' 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue' components/region/RegionRealEstatePrices.vue
git commit -m "refactor(trust): sync-status fetch 3곳을 useSyncStatus로 통합 + STALE_DAYS 상수화"
```

---

### Task 3: 푸터 운영 실체 블록 + Contact 앵커

**Files:**
- Modify: `frontend/components/common/AppFooter.vue` — 브랜드 컬럼(L7-14)에 운영 블록, 하단 바 KOGL 문단(L51-65)에 면책 1줄
- Modify: `frontend/pages/contact.vue` — "데이터 오류 및 수정 요청" 카드(L44 부근 wrapper div)에 `id="data-fix"` 추가
- Test: `frontend/tests/components/AppFooter.test.ts` (기존 파일에 describe 추가)

**Interfaces:**
- Consumes: Task 1의 `useSyncStatus().latestOverall`, `formatDotDateTime`, `isSyncStale`, `RE_STALE_DAYS`
- Produces: Contact 앵커 `/contact#data-fix` (Task 5도 링크)

- [ ] **Step 1: 실패하는 테스트 추가** — `AppFooter.test.ts` 하단에 append (기존 mount 헬퍼 재사용):

```ts
describe('AppFooter — 운영 실체 블록', () => {
  it('운영 주체·문의 이메일·수정 요청 링크를 렌더한다', () => {
    const w = mountFooter() // 파일 상단의 기존 mount 헬퍼/패턴 재사용
    expect(w.text()).toContain('일상킷 팀')
    const mailto = w.find('a[href="mailto:contact@ilsangkit.co.kr"]')
    expect(mailto.exists()).toBe(true)
    expect(w.text()).toContain('정보 수정 요청')
    expect(w.text()).toContain('확인 후 3~5일 내 반영')
  })

  it('면책 문구를 렌더한다', () => {
    const w = mountFooter()
    expect(w.text()).toContain('가공한 참고용 정보입니다')
  })

  it('동기화 데이터가 없으면 "데이터 최종 동기화" 행을 렌더하지 않는다', () => {
    const w = mountFooter() // 전역 useAsyncData mock은 null 데이터
    expect(w.text()).not.toContain('데이터 최종 동기화')
  })
})
```
(기존 파일의 mount가 헬퍼 없이 인라인이면 동일 인라인 패턴으로 3회 mount. 기존 테스트의 global stubs 구성을 그대로 따른다.)

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/components/AppFooter.test.ts
```
Expected: 신규 describe FAIL, 기존 테스트 PASS 유지

- [ ] **Step 3: AppFooter.vue 수정**

script setup에 (명시 import — 직접 mount 컴포넌트):
```ts
import { computed } from 'vue'
import { useSyncStatus } from '~/composables/useSyncStatus'
import { formatDotDateTime, isSyncStale, RE_STALE_DAYS } from '~/utils/syncFreshness'

const { latestOverall } = useSyncStatus()
// 전체 max는 daily sync(부동산)가 지배하므로 stale 기준 2일 — 파이프라인이 죽으면 행 자체를 숨긴다
const latestSyncLabel = computed(() => {
  const iso = latestOverall.value
  if (!iso || isSyncStale(iso, RE_STALE_DAYS)) return null
  return formatDotDateTime(iso)
})
```
(기존 script의 `computed` import 여부 확인 — 있으면 중복 금지.)

브랜드 컬럼(L7-14) 태그라인 아래에 추가:
```html
<div class="mt-3 space-y-1 text-xs text-faint">
  <p>
    운영 <span class="font-semibold text-muted">일상킷 팀</span> · 문의
    <a href="mailto:contact@ilsangkit.co.kr" class="text-primary hover:underline">contact@ilsangkit.co.kr</a>
  </p>
  <p>
    <HardLink to="/contact#data-fix" class="font-semibold text-primary hover:underline">정보 수정 요청</HardLink>
    — 확인 후 3~5일 내 반영
  </p>
  <p v-if="latestSyncLabel">
    데이터 최종 동기화 <span class="[font-variant-numeric:tabular-nums]">{{ latestSyncLabel }}</span>
  </p>
</div>
```

하단 바 KOGL 문단(L51-65)의 기존 문장 앞에 면책 1줄 추가 (같은 `<p>` 안, 문장 선행):
```
본 서비스의 정보는 공공데이터포털(data.go.kr)·국토교통부 실거래가 공개시스템 자료를 가공한 참고용 정보입니다.
```
(기존 data.go.kr/rt.molit.go.kr 링크 문장은 그대로 유지 — 링크 중복이 어색하면 면책 문장은 링크 없는 평문으로.)

- [ ] **Step 4: contact.vue 앵커 추가**

"데이터 오류 및 수정 요청" 카드의 wrapper `<div class="bg-slate-50 rounded-lg p-4">`(L44 부근)에 `id="data-fix"` 추가. `scroll-mt-20` 클래스도 함께(고정 헤더에 가리지 않게).

- [ ] **Step 5: 테스트 통과 + 전체 확인**

```bash
npx vitest run tests/components/AppFooter.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add components/common/AppFooter.vue pages/contact.vue tests/components/AppFooter.test.ts
git commit -m "feat(trust): 푸터 운영 실체 블록(팀명·이메일·수정요청·최종동기화) + 면책 + contact 앵커"
```

---

### Task 4: 전 페이지 트러스트 라인 (홈 제외)

**Files:**
- Create: `frontend/components/common/TrustLine.vue`
- Modify: `frontend/layouts/default.vue` — `</main>`(L9)과 `<AppFooter />`(L12) 사이에 삽입
- Test: `frontend/tests/components/common/TrustLine.test.ts` (신규)

**Interfaces:**
- Consumes: 없음 (정적 컴포넌트)
- Produces: `<TrustLine />` — 홈 확장판 박스(pages/index.vue L257-278)의 1줄 축약판

- [ ] **Step 1: 실패하는 테스트 작성** — `tests/components/common/TrustLine.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TrustLine from '~/components/common/TrustLine.vue'

describe('TrustLine', () => {
  it('공공데이터 기반 문구와 전체 출처 링크를 렌더한다', () => {
    const w = mount(TrustLine)
    expect(w.text()).toContain('공공데이터 기반 서비스')
    expect(w.text()).toContain('공공누리(KOGL)')
    expect(w.text()).toContain('전체 출처 보기')
    expect(w.html()).toContain('/about#data-sources')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/components/common/TrustLine.test.ts
```
Expected: FAIL — 컴포넌트 없음

- [ ] **Step 3: 구현** — `frontend/components/common/TrustLine.vue`

```vue
<template>
  <div class="w-full max-w-4xl mx-auto px-4 pb-5">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary-100 bg-primary-50 px-4 py-2.5 text-xs text-muted">
      <span class="font-extrabold text-primary" aria-hidden="true">✓</span>
      <span>공공데이터 기반 서비스 — 행정안전부 · 국토교통부 · 보건복지부 등 공식 API/CSV를 공공누리(KOGL) 조건에 따라 사용합니다</span>
      <HardLink to="/about#data-sources" class="ml-auto whitespace-nowrap font-bold text-primary hover:underline">
        전체 출처 보기 →
      </HardLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'
</script>
```
(직접 mount 컴포넌트 — HardLink 명시 import. HardLink의 실제 경로가 다르면 AppFooter.vue의 import/사용 방식을 그대로 따른다.)

- [ ] **Step 4: default.vue 삽입** — `frontend/layouts/default.vue`

```html
    </main>
    <TrustLine v-if="route.path !== '/'" />
    <AppFooter />
```
script setup에 `const route = useRoute()` (레이아웃은 직접 mount 안 되므로 auto-import 허용, 기존 script 유무 확인 후 추가).

- [ ] **Step 5: 테스트 통과 + 전체 확인**

```bash
npx vitest run tests/components/common/TrustLine.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add components/common/TrustLine.vue layouts/default.vue tests/components/common/TrustLine.test.ts
git commit -m "feat(trust): 전 페이지 트러스트 라인 (홈 확장판 유지, 그 외 1줄 축약판)"
```

---

### Task 5: 데이터 출처 카드 강화 — 수정 요청 링크

**Files:**
- Modify: `frontend/components/common/DataSourceSection.vue` — full 카드(비-compact 분기)에만 추가
- Test: `frontend/tests/components/common/DataSourceSection.test.ts` (기존 파일에 케이스 추가)

**Interfaces:**
- Consumes: Task 3의 `/contact#data-fix` 앵커
- Produces: 없음

- [ ] **Step 1: 실패하는 테스트 추가** — 기존 `DataSourceSection.test.ts`에 append (파일의 기존 mount 패턴·NuxtLinkStub 재사용):

```ts
describe('DataSourceSection — 수정 요청 링크', () => {
  it('full 카드에 수정 요청 링크와 SLA를 렌더한다', () => {
    const w = mount(DataSourceSection, {
      props: { domain: 'facility', category: 'pharmacy' },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(w.text()).toContain('정보가 실제와 다른가요?')
    expect(w.text()).toContain('수정 요청')
    expect(w.text()).toContain('3~5일 내 반영')
    expect(w.html()).toContain('/contact#data-fix')
  })

  it('compact 모드에는 수정 요청 링크가 없다', () => {
    const w = mount(DataSourceSection, {
      props: { domain: 'facility', compact: true },
      global: { stubs: { NuxtLink: NuxtLinkStub } },
    })
    expect(w.text()).not.toContain('수정 요청')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run tests/components/common/DataSourceSection.test.ts
```
Expected: 신규 2 FAIL, 기존 PASS 유지

- [ ] **Step 3: 구현** — full 카드 분기의 마지막(KOGL 표기 뒤)에 추가:

```html
<p class="mt-3 text-xs text-faint">
  정보가 실제와 다른가요?
  <NuxtLink to="/contact#data-fix" class="font-semibold text-primary hover:underline">수정 요청 →</NuxtLink>
  확인 후 3~5일 내 반영
</p>
```
(이 파일이 링크에 NuxtLink를 쓰는지 HardLink를 쓰는지 기존 코드 관례를 따른다 — 테스트 stub과 일치시킬 것.)

- [ ] **Step 4: 테스트 통과 + 전체 확인**

```bash
npx vitest run tests/components/common/DataSourceSection.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add components/common/DataSourceSection.vue tests/components/common/DataSourceSection.test.ts
git commit -m "feat(trust): 데이터 출처 카드에 수정 요청 링크 + SLA (정정 채널을 데이터 옆으로)"
```

---

### Task 6: 콘텐츠 바이라인 — 상세·목록 카드·구조화 데이터 정합

**Files:**
- Modify: `frontend/utils/seoConstants.ts` — `CONTENT_AUTHOR` 상수 추가
- Modify: `frontend/pages/guide/[slug].vue` — 바이라인(L36-39)·발행일(L40, createdAt→publishedAt) 교체
- Modify: `frontend/pages/article/[slug].vue` — 바이라인(L37-39) 교체
- Modify: `frontend/composables/useStructuredData.ts` — `setArticleSchema` author(L599) 정합
- Modify: `frontend/pages/guide/index.vue`, `frontend/pages/article/index.vue` — 목록 카드에 바이라인 줄
- Test: `frontend/tests/composables/` 에 setArticleSchema author 검증(기존 useStructuredData 테스트 파일 있으면 확장, 없으면 skip하고 아래 Step 5의 grep 검증으로 대체)

**Interfaces:**
- Consumes: 기존 API 응답의 `publishedAt`(guide/article 모두 서비스가 createdAt 폴백 포함 반환 — backend 변경 불필요), `formatDotDate`(Task 1 이전부터 존재)
- Produces: `CONTENT_AUTHOR = '일상킷 데이터팀'` (`~/utils/seoConstants`)

- [ ] **Step 1: 상수 추가** — `frontend/utils/seoConstants.ts`에:

```ts
/** 콘텐츠 바이라인 저자 — UI·구조화 데이터 공용 단일 소스 (스펙 §5-5) */
export const CONTENT_AUTHOR = '일상킷 데이터팀'
```

- [ ] **Step 2: 상세 바이라인 교체** — guide/[slug].vue L36-39와 article/[slug].vue L37-39의 "일상킷 편집팀" 하드코딩을 교체하고 검수 마커 추가. 두 파일 모두 동일 패턴 (기존 flex 행 L35 유지, 조회수 span은 건드리지 않음):

```html
<span class="inline-flex items-center gap-1">
  <span class="material-symbols-outlined text-[16px]" aria-hidden="true">edit_note</span>
  {{ CONTENT_AUTHOR }}
</span>
<span class="inline-flex items-center gap-1 font-semibold text-success">
  <span aria-hidden="true">✓</span> 공공데이터 원문 대조 검수
</span>
```
script에 `import { CONTENT_AUTHOR } from '~/utils/seoConstants'` (파일이 seoConstants에서 이미 import 중이면 항목만 추가).

guide/[slug].vue L40 발행일 정합 (article은 이미 publishedAt 우선이므로 손대지 않음):
```html
<time :datetime="guide.publishedAt">{{ formatDate(guide.publishedAt) }}</time>
```
(guideService가 `publishedAt ?? createdAt`을 이미 서버에서 폴백하므로 null 걱정 없음.)

- [ ] **Step 3: 구조화 데이터 정합** — `useStructuredData.ts` L599의 `setArticleSchema` author를:

```ts
author: { '@type': 'Organization', name: CONTENT_AUTHOR, url: SITE_URL },
```
로 교체 + 상단 import에 `CONTENT_AUTHOR` 추가. publisher(L600-605)는 SITE_NAME 유지 (발행처=일상킷, 저자=데이터팀 — UI 바이라인과 schema 일치).

- [ ] **Step 4: 목록 카드 바이라인** — guide/index.vue와 article/index.vue의 카드 루프에서 summary 요소 바로 아래에 추가 (각 파일의 카드 마크업 클래스 관례에 맞춰):

```html
<p class="mt-2 text-[11px] text-faint">
  {{ CONTENT_AUTHOR }} · <span class="[font-variant-numeric:tabular-nums]">{{ formatDotDate(item.publishedAt) }}</span>
</p>
```
(`item`은 각 파일의 실제 루프 변수명 사용. `publishedAt`이 응답에 없으면 그 파일의 날짜 필드(createdAt)를 쓰되, 서비스가 폴백 포함 publishedAt을 반환하므로 원칙적으로 존재. `formatDotDate` 명시 import. 홈 카드(pages/index.vue)는 이번 범위에서 제외 — home-dashboard 페이로드 확장이 필요해 별도 판단.)

- [ ] **Step 5: 검증** — 구조화 데이터 author 정합 확인:

```bash
grep -rn "일상킷 편집팀" pages/ components/ composables/ | wc -l   # 0이어야 함
grep -n "CONTENT_AUTHOR" composables/useStructuredData.ts pages/guide/ pages/article/ -r
npx vitest run 2>&1 | tail -4
```
Expected: "일상킷 편집팀" 잔존 0, 전체 테스트 PASS. `tests/composables/`에 useStructuredData 테스트 파일이 존재하면 author 어서션(`name: '일상킷 데이터팀'`)을 추가하고 함께 PASS 확인.

- [ ] **Step 6: 커밋**

```bash
git add utils/seoConstants.ts 'pages/guide/[slug].vue' 'pages/article/[slug].vue' pages/guide/index.vue pages/article/index.vue composables/useStructuredData.ts tests/
git commit -m "feat(trust): 콘텐츠 바이라인 '일상킷 데이터팀' 단일 소스화 (UI·schema 정합 + 검수 마커 + publishedAt 통일)"
```

---

### Task 7: 전체 검증 + PR 생성

**Files:** 없음 (검증·PR)

- [ ] **Step 1: lint + 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -4
npx vitest run 2>&1 | tail -4
```
Expected: lint 신규 오류 0, 전체 PASS. `git diff develop --stat -- '**/package-lock.json'` 결과 없음 확인.

- [ ] **Step 2: 불변식 스폿체크 (dev 서버 가능 시)**

- 아무 상세 페이지: 푸터에 운영 블록·면책, 푸터 위 트러스트 라인, 출처 카드에 수정 요청 링크
- 홈: 트러스트 라인 **없음**(확장판 박스만), 기존 레이아웃 불변
- 가이드 상세: 바이라인 "일상킷 데이터팀 · ✓ 검수", 페이지 소스에서 Article schema author name 확인
- 모바일 390px 가로 넘침 없음 (트러스트 라인 flex-wrap 확인)

- [ ] **Step 3: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-footer-byline
gh pr create --base develop \
  --title "feat(trust): 운영 실체 가시화 — 푸터 블록·트러스트 라인·바이라인·수정요청 채널" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) Phase 1 PR ②.
"개인 사이트 인상"의 최대 원인이던 운영 실체 부재·무기명 콘텐츠를 해소.

- 푸터 운영 블록: 일상킷 팀 · contact@ 메일 · 정보 수정 요청(→/contact#data-fix, 3~5일 SLA) · 데이터 최종 동기화(전체 max, 2일 stale 가드) + 면책 1줄
- 전 페이지 트러스트 라인(홈은 기존 확장판 유지) — /about#data-sources 딥링크
- 데이터 출처 카드에 수정 요청 링크(정정 채널을 데이터 옆으로)
- 콘텐츠 바이라인: '일상킷 데이터팀' 단일 상수 — UI·Article schema author 정합, ✓ 원문 대조 검수 마커, guide 상세 publishedAt 표시 정합, 목록 카드 바이라인
- PR ① 트리아지 후속: sync-status fetch 3곳 → useSyncStatus 컴포저블(stable key 'sync-status') + RE/TRASH/FACILITY_STALE_DAYS 상수화

## 불변식
- URL·h1·title/meta·광고 슬롯 불변, SSR 텍스트 추가만, 백엔드 무변경
- 검수 문구는 어드민 검토·발행 플로우가 실재하는 guide/article에만 (허위 신호 금지)

## 테스트
- 신규: syncFreshness +3 · useSyncStatus 3 · AppFooter +3 · TrustLine 1 · DataSourceSection +2
- 전체 frontend vitest PASS, lint 0 errors
EOF
)"
```
Expected: PR URL 출력. CI green 확인 후 사용자 머지 판단 (자체 머지 금지).

---

## 플랜 메모

- **§5-4 데이터셋 딥링크는 기충족**: DataSourceSection의 데이터셋 행이 이미 `resolveDataSource().url`(data.go.kr/rt.molit.go.kr)로 외부 딥링크함 — 스펙 §5-4의 두 요건 중 링크는 완료 상태라 Task 5는 수정 요청 채널만 추가한다.
- **범위 제외 기록**: 홈 카드(pages/index.vue 생활가이드·오늘의이슈) 바이라인은 home-dashboard 페이로드에 publishedAt 확장이 필요해 제외 — PR ③ 또는 별도 판단. 조회수 임계 비노출·마이크로카피 어미 통일은 스펙대로 PR ③·④ 스코프.
- **트러스트 라인 홈 제외 로직**: `route.path !== '/'` — 홈만 확장판 박스(index.vue L257-278 기존 유지).
- 시설 상세([id].vue Promise.allSettled 병렬 fetch)와 부동산 상세([buildingName].vue)의 sync-status는 youtube와 묶인 별도 패턴이라 이번 추출 범위 밖 (기능 동일, 강제 통합은 리스크만 추가).
- 후속 플랜: PR ③ 결함 스윕 8건 → PR ④ 광고 계약+마이크로카피 → PR ⑤~⑦ Phase 2.
