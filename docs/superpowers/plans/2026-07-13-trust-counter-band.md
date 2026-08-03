# 목록·허브 카운터 밴드 (신뢰 디자인 격상 PR ⑧) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec §6-3을 구현한다 — 5개 목록·허브 표면의 PageHero 스탯 밴드를 "이 지역 N곳 · 전국 등록 N곳 · 데이터 갱신(융합)" 3칸으로 통일한다. "선언(월 1회 자동)→증명(실제 수치·날짜)"을 완결한다. **이 지역/데이터 갱신은 이미 있는 값**을 재라벨·재사용하고, **전국 등록만 신규 데이터**(전국 카운트)를 SSR fail-open으로 배선한다.

**Architecture:** 밴드는 공유 컴포넌트가 아니라 각 페이지의 `heroStats` computed가 `PageHero :stats`(→ `.od-hero-stats` 그리드)로 넘기는 배열이다. 전국 카운트는 신규 컴포저블 `useNationalStats`(GET /api/meta/stats, **server:true + 엄격 fail-open**)와, 부동산은 `useNationalComplexCount`(전국 `getComplexList(type).total`, VALID_NAME 정합)로 가져온다. 두 fetch 모두 실패=셀 부재이며 noindex·렌더를 절대 게이팅하지 않는다. 융합 '데이터 갱신' 셀(withSyncDate)은 **현행 그대로**(useSyncStatus server:false → SSR 라벨-only) 유지 — 과거 SSR 풀고갈→noindex 사고를 회피한 결정. 백엔드 변경 없음.

**Tech Stack:** Nuxt 3 + Vue 3(script setup) + Vitest. 백엔드 무변경.

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §6-3(+§8 데이터). 사용자 결정: **전국 카운트 fetch = server:true + fail-open**(크롤러 가시 증빙). 날짜 셀 = 3칸·날짜+주기 융합 유지(별도 SSR 셀 분리 금지).

## Global Constraints

- **Node 20 필수**: 모든 `npm`/`npx`/`vitest` 앞에 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **fail-open 불변식(전 표면 공통)**: 전국 카운트 fetch(`useNationalStats`·`useNationalComplexCount`)는 (1) 실패/timeout/부재 시 `null` 반환, (2) '전국 등록' 셀은 값이 `> 0`일 때만 push, (3) **`shouldNoindexSsr`·canonical·렌더를 절대 게이팅하지 않음**, (4) 밴드는 전국 셀 없이도 나머지 셀로 정상 렌더. 이 fetch는 상세페이지 fail-closed noindex 로직과 완전 분리.
- **날짜 셀 불변**: 융합 '데이터 갱신'/'업데이트' 셀(withSyncDate + useSyncStatus server:false)은 **현행 그대로 유지**. 날짜를 별도 SSR-계산 셀로 분리하지 말 것(과거 project_ssr_noindex_pool_exhaustion 사고 회피).
- **≤3 셀 규칙**: 각 표면 밴드는 최대 3칸. `PageHero`는 `--od-cols=Math.min(len,4)`로 4칸까지 렌더하나 5칸+는 어긋나므로 **정확히 ≤3**. 모바일 `.od-hero-stats .s:nth-child(3):last-child{grid-column:1/-1}`는 **정확히 3칸일 때만** 3번째를 전폭으로 만드므로 **융합/서술 셀을 항상 마지막(3번째)에 배치**.
- **No-duplicate 규칙**: 지역 스코프 값 == 전국 값(지역 필터 없음)이면 '이 지역'과 '전국 등록'을 둘 다 보이지 말 것 — '전국 등록' 하나만.
- **부동산 단위 정합**: 지역 RE는 '유효 단지'(VALID_NAME 필터 단지 수). 전국 셀도 반드시 VALID_NAME 정합 → **`getComplexList(type).total`(전국)** 사용. `getStats.realEstateBuildings`(무필터, 더 큼) 사용 금지.
- **SSR/SEO 불변**: 단일 h1·title·meta·canonical·noindex 게이트·사이트맵 불변. '이 지역' 셀은 이미 SSR인 페이지 상태에서 나오므로 SSR 노출 유지. 라벨·수치 외 구조 변경 없음.
- **광고·백엔드·package-lock 무변경.**
- **커밋**: conventional commit 한국어(`feat(trust): …`). PR은 develop 대상, 자체 머지 금지.

## 표면 매핑 (recon 확인, develop @ 1d8a4c31)

| # | 파일 | 성격 | 현재 heroStats | 목표 3칸 |
|---|---|---|---|---|
| S1 | `pages/[category]/index.vue` (L521-543) | 전국 시설 | 전체·데이터갱신·목록기준 | (미필터)전국 등록·데이터갱신·목록기준 / (필터)이 지역·전국 등록·데이터갱신 |
| S2 | `pages/[city]/[district]/[category].vue` (L256-276) | 지역 시설 | 시설 수·주변 지역·업데이트 | 이 지역·전국 등록·업데이트(주변 지역 드롭) |
| S3 | `pages/real-estate/[realEstateType]/index.vue` (L417-425) | 전국 RE | {label} 거래·보기방식·함께보기 | 전국 등록(=기존 totalComplexes 재라벨)·보기방식·함께보기 |
| S4 | `pages/real-estate/[realEstateType]/[city]/[district]/index.vue` (L254-259) | 지역 RE | 유효 단지·데이터 출처 | 이 지역·전국 등록·데이터 출처 |
| S5 | `pages/[city]/index.vue` (L8-13, :stats 없음) | 지역 허브 | (없음) | 이 지역·전국 등록·데이터 갱신 |

## 브랜치

Task 1 Step 1에서 생성:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop   # develop HEAD = 1d8a4c31
git checkout -b feat/trust-counter-band
```

---

### Task 1: `useNationalStats` 컴포저블 (전국 시설 카운트, server:true fail-open)

**Files:**
- Create: `frontend/composables/useNationalStats.ts`
- Test: `frontend/tests/composables/useNationalStats.test.ts`

**Interfaces:**
- Produces: `useNationalStats(): { stats: Readonly<Ref<StatsData | null>> }` — S1(필터)·S2·S5가 소비. `StatsData`는 백엔드 `getStats` 응답의 `data`(키: 시설 카테고리 15종 + `total` + `realEstate`/`realEstateBuildings` 등). 프론트 타입이 없으면 최소 인터페이스 `{ total?: number; [category: string]: number | ... }`로 정의.

**패턴 근거(확인됨):** 기존 `frontend/composables/useSyncStatus.ts`가 `useAsyncData('sync-status', fetch /api/meta/sync-status, { server:false })` + 봉투 `{success,data}` 언랩 + `readonly` 반환. 이를 **구조 복사**하되 (a) 키 `'national-stats'`, (b) 엔드포인트 `/api/meta/stats`, (c) **`server: true`**, (d) `AbortSignal.timeout`, (e) 에러/실패 시 `null`.

- [ ] **Step 1: 브랜치 생성** (위 "브랜치" 블록 실행)

- [ ] **Step 2: 실패 테스트 작성(RED)** — `useNationalStats.test.ts` (기존 `useSyncStatus.test.ts` mock 패턴 재사용):

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

// useAsyncData/useRuntimeConfig 등은 tests/setup.ts 전역 mock; $fetch는 케이스별 제어.
// (useSyncStatus.test.ts가 쓰는 정확한 mock 배선을 그대로 복사할 것)

describe('useNationalStats', () => {
  beforeEach(() => vi.clearAllMocks())

  it('성공 시 data(StatsData)를 반환한다', async () => {
    // $fetch mock → { success:true, data:{ total:1234567, toilet:1000 } }
    const { useNationalStats } = await import('~/composables/useNationalStats')
    const { stats } = useNationalStats()
    // useAsyncData 즉시 실행 mock 기준
    expect(stats.value?.total).toBe(1234567)
  })

  it('fetch 실패 시 null (fail-open)', async () => {
    // $fetch mock → reject
    const { useNationalStats } = await import('~/composables/useNationalStats')
    const { stats } = useNationalStats()
    expect(stats.value).toBeNull()
  })

  it('server:true로 SSR에서도 fetch한다 (useAsyncData 옵션 server=true)', () => {
    // useAsyncData mock의 3번째 인자 options.server === true 를 assert
  })
})
```
(정확한 mock 배선은 `useSyncStatus.test.ts`를 열어 동일 구조로 복사. `server:true` 검증은 useAsyncData mock에 전달된 options를 캡처해 assert.)

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/composables/useNationalStats.test.ts
```
Expected: FAIL — 컴포저블 미존재.

- [ ] **Step 3: 컴포저블 작성** — `useSyncStatus.ts`를 열어 구조를 그대로 미러링. 핵심 형태(실제 파일의 apiBase/봉투 언랩 방식에 맞출 것):

```ts
import { readonly } from 'vue'

export interface StatsData {
  total?: number
  [key: string]: number | Record<string, number> | undefined
}

export function useNationalStats() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase
  const { data } = useAsyncData<StatsData | null>('national-stats', async () => {
    try {
      const res = await $fetch<{ success: boolean; data: StatsData }>(
        `${apiBase}/api/meta/stats`,
        { signal: AbortSignal.timeout(8000) },
      )
      return res?.data ?? null
    } catch {
      return null   // fail-open: 실패=null, 절대 throw 안 함(SSR 렌더/noindex 미게이팅)
    }
  }, { server: true })   // 사용자 결정: SSR 노출(크롤러 가시 증빙)
  return { stats: readonly(data) }
}
```
(apiBase 접근·봉투 형태는 `useSyncStatus.ts`와 정확히 일치시킬 것. try/catch가 SSR에서 throw를 삼켜 렌더를 절대 막지 않는 게 핵심.)

- [ ] **Step 4: 테스트 통과(GREEN)**

```bash
npx vitest run tests/composables/useNationalStats.test.ts tests/composables/useSyncStatus.test.ts
```
Expected: 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add composables/useNationalStats.ts tests/composables/useNationalStats.test.ts
git commit -m "feat(trust): useNationalStats 컴포저블 신설 (전국 시설 카운트, server:true fail-open) (PR⑧)"
```

---

### Task 2: S2 지역×카테고리 밴드 (이 지역·전국 등록·업데이트)

**Files:**
- Create: `frontend/utils/heroBandStats.ts` (순수 빌더 — 단위 테스트용)
- Modify: `frontend/pages/[city]/[district]/[category].vue` (heroStats L256-276)
- Test: `frontend/tests/utils/heroBandStats.test.ts`

**Interfaces:**
- Consumes: `useNationalStats`(Task 1)
- Produces: `buildRegionCategoryStats(opts): Stat[]` (Task 3이 유사 빌더 참조)

**현재 코드(확인됨):**
```ts
const { syncStatus } = useSyncStatus()
const heroStats = computed(() => {
  const s: { label: string; value: string }[] = []
  const count = isTrash.value ? wasteTotal.value : (summary.value?.count ?? total.value ?? 0)
  if (count > 0) {
    s.push({ label: isTrash.value ? '배출 일정' : '시설 수', value: `${count.toLocaleString('ko-KR')}${isTrash.value ? '건' : '곳'}` })
  }
  if (!isTrash.value && summary.value?.nearbyDistricts?.length) {
    s.push({ label: '주변 지역', value: summary.value.nearbyDistricts.slice(0, 2).map(n => n.district).join(' · ') })
  }
  s.push({ label: '업데이트', value: withSyncDate(isTrash.value ? '매일 자동' : '월 1회 자동', syncStatus.value?.[category.value], isTrash.value ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS) })
  return s
})
```

- [ ] **Step 1: 순수 빌더 + 실패 테스트(RED)** — `utils/heroBandStats.ts`:

```ts
export interface Stat { label: string; value: string; color?: string }

/** 지역×카테고리 밴드: [이 지역] [전국 등록(옵션)] [업데이트(융합, 항상 마지막)] */
export function buildRegionCategoryStats(opts: {
  regionCount: number
  nationalCount: number | null
  unit: string           // '곳' | '건'
  syncCellValue: string  // withSyncDate(...) 결과
  syncLabel: string      // '업데이트'
}): Stat[] {
  const { regionCount, nationalCount, unit, syncCellValue, syncLabel } = opts
  const stats: Stat[] = []
  if (regionCount > 0) stats.push({ label: '이 지역', value: `${regionCount.toLocaleString('ko-KR')}${unit}` })
  if (typeof nationalCount === 'number' && nationalCount > 0) {
    stats.push({ label: '전국 등록', value: `${nationalCount.toLocaleString('ko-KR')}${unit}` })
  }
  stats.push({ label: syncLabel, value: syncCellValue })
  return stats
}
```

`tests/utils/heroBandStats.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { buildRegionCategoryStats } from '~/utils/heroBandStats'

describe('buildRegionCategoryStats', () => {
  const base = { regionCount: 120, nationalCount: 45000, unit: '곳', syncCellValue: '월 1회 자동 · 2026.06.19', syncLabel: '업데이트' }
  it('정확히 3칸: 이 지역·전국 등록·업데이트(마지막)', () => {
    const s = buildRegionCategoryStats(base)
    expect(s.map(x => x.label)).toEqual(['이 지역', '전국 등록', '업데이트'])
    expect(s[0].value).toBe('120곳')
    expect(s[1].value).toBe('45,000곳')
    expect(s[2].value).toBe('월 1회 자동 · 2026.06.19')
  })
  it('전국 카운트 null이면 전국 셀 생략 (fail-open, 2칸)', () => {
    const s = buildRegionCategoryStats({ ...base, nationalCount: null })
    expect(s.map(x => x.label)).toEqual(['이 지역', '업데이트'])
  })
  it('전국 카운트 0이면 생략', () => {
    expect(buildRegionCategoryStats({ ...base, nationalCount: 0 }).map(x => x.label)).toEqual(['이 지역', '업데이트'])
  })
  it('지역 카운트 0이면 이 지역 생략', () => {
    expect(buildRegionCategoryStats({ ...base, regionCount: 0 }).map(x => x.label)).toEqual(['전국 등록', '업데이트'])
  })
  it('업데이트 셀은 항상 마지막 (모바일 전폭 규칙)', () => {
    expect(buildRegionCategoryStats(base).at(-1)?.label).toBe('업데이트')
  })
})
```
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/utils/heroBandStats.test.ts
```
Expected: FAIL(빌더 미존재) → 작성 후 아래 GREEN.

- [ ] **Step 2: 빌더 GREEN 확인**

```bash
npx vitest run tests/utils/heroBandStats.test.ts
```
Expected: PASS.

- [ ] **Step 3: S2 페이지 배선** — `[city]/[district]/[category].vue`:
- `useNationalStats` import + `const { stats: nationalStats } = useNationalStats()` 추가.
- heroStats computed을 빌더 사용으로 교체(주변 지역 드롭):
```ts
const heroStats = computed(() => {
  const count = isTrash.value ? wasteTotal.value : (summary.value?.count ?? total.value ?? 0)
  const nat = nationalStats.value?.[category.value]
  return buildRegionCategoryStats({
    regionCount: count,
    nationalCount: typeof nat === 'number' ? nat : null,
    unit: isTrash.value ? '건' : '곳',
    syncCellValue: withSyncDate(isTrash.value ? '매일 자동' : '월 1회 자동', syncStatus.value?.[category.value], isTrash.value ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS),
    syncLabel: '업데이트',
  })
})
```
(`buildRegionCategoryStats`·`useNationalStats` import 추가. 명시 import — 저장소 vitest auto-import 없음.)

- [ ] **Step 4: 회귀 확인**

```bash
npx vitest run tests/pages/districtCategoryNoindex.test.ts tests/utils/heroBandStats.test.ts 2>&1 | tail -6
```
Expected: PASS(이 페이지는 util-level 테스트라 heroStats 문자열 미검증 — 회귀 없음).

- [ ] **Step 5: 커밋**

```bash
git add utils/heroBandStats.ts tests/utils/heroBandStats.test.ts "pages/[city]/[district]/[category].vue"
git commit -m "feat(trust): 지역×카테고리 밴드 3칸(이 지역·전국 등록·업데이트) + 순수 빌더 (PR⑧ S2)"
```

---

### Task 3: S1 전국 카테고리 밴드 (조건부 이 지역/전국 등록 + no-duplicate)

**Files:**
- Modify: `frontend/utils/heroBandStats.ts` (S1 빌더 추가)
- Modify: `frontend/pages/[category]/index.vue` (heroStats L521-543)
- Test: `frontend/tests/utils/heroBandStats.test.ts` (S1 케이스 추가)

**현재 코드(확인됨):** [전체(displayTotal) | 데이터 갱신(융합) | 목록 기준]. `displayTotal`은 미필터=전국, 클라이언트 `?city=` 필터 시 지역으로 좁아짐.

- [ ] **Step 1: S1 빌더 + 실패 테스트(RED)** — `heroBandStats.ts`에 추가:

```ts
/** 전국 카테고리 목록 밴드. isRegionScoped면 이 지역+전국 등록, 아니면 전국 등록 단독(no-duplicate). 융합/목록기준 셀은 마지막. */
export function buildCategoryListStats(opts: {
  isRegionScoped: boolean
  displayTotal: number       // 스코프 반영된 현재 총계
  nationalCount: number | null
  unit: string
  syncCellValue: string
  basisValue: string         // '목록 기준' 값
}): Stat[] {
  const { isRegionScoped, displayTotal, nationalCount, unit, syncCellValue, basisValue } = opts
  const stats: Stat[] = []
  if (isRegionScoped) {
    if (displayTotal > 0) stats.push({ label: '이 지역', value: `${displayTotal.toLocaleString('ko-KR')}${unit}` })
    if (typeof nationalCount === 'number' && nationalCount > 0) stats.push({ label: '전국 등록', value: `${nationalCount.toLocaleString('ko-KR')}${unit}` })
    stats.push({ label: '데이터 갱신', value: syncCellValue })   // 3칸 유지 위해 필터 시 목록기준 드롭
  } else {
    if (displayTotal > 0) stats.push({ label: '전국 등록', value: `${displayTotal.toLocaleString('ko-KR')}${unit}` })  // no-duplicate: 전국 하나만
    stats.push({ label: '데이터 갱신', value: syncCellValue })
    stats.push({ label: '목록 기준', value: basisValue })
  }
  return stats
}
```
테스트(추가):
```ts
import { buildCategoryListStats } from '~/utils/heroBandStats'
describe('buildCategoryListStats', () => {
  const base = { displayTotal: 45000, nationalCount: 45000, unit: '곳', syncCellValue: '월 1회 자동 · 2026.06.19', basisValue: '지역 선택 후 정렬' }
  it('미필터: 전국 등록 단독(중복 없음)·데이터 갱신·목록 기준', () => {
    const s = buildCategoryListStats({ ...base, isRegionScoped: false })
    expect(s.map(x => x.label)).toEqual(['전국 등록', '데이터 갱신', '목록 기준'])
    expect(s[0].value).toBe('45,000곳')
  })
  it('필터: 이 지역·전국 등록·데이터 갱신(목록 기준 드롭, ≤3)', () => {
    const s = buildCategoryListStats({ ...base, isRegionScoped: true, displayTotal: 120, nationalCount: 45000 })
    expect(s.map(x => x.label)).toEqual(['이 지역', '전국 등록', '데이터 갱신'])
    expect(s.length).toBeLessThanOrEqual(3)
  })
  it('필터인데 전국 null이면 이 지역·데이터 갱신(2칸, fail-open)', () => {
    const s = buildCategoryListStats({ ...base, isRegionScoped: true, displayTotal: 120, nationalCount: null })
    expect(s.map(x => x.label)).toEqual(['이 지역', '데이터 갱신'])
  })
})
```
```bash
npx vitest run tests/utils/heroBandStats.test.ts
```
Expected: FAIL(신규 빌더 없음) → 작성 후 GREEN.

- [ ] **Step 2: S1 페이지 배선** — `[category]/index.vue`:
- `useNationalStats`·`buildCategoryListStats` import + `const { stats: nationalStats } = useNationalStats()`.
- `isRegionScoped` computed 신설(현재 필터 상태로 — recon: `ssrConsumed && selectedCity`가 존재하면 그것, 없으면 `selectedCity`/필터 ref 유무로 판정. 페이지의 실제 필터 상태 ref를 사용):
```ts
const isRegionScoped = computed(() => !!selectedCity.value)   // 페이지 실제 필터 ref에 맞춤
```
- heroStats 교체:
```ts
const heroStats = computed(() => {
  const trash = categoryParam.value === 'trash'
  const totalCount = trash ? wasteTotal.value : displayTotal.value
  const nat = nationalStats.value?.[categoryParam.value]
  return buildCategoryListStats({
    isRegionScoped: isRegionScoped.value,
    displayTotal: totalCount,
    nationalCount: typeof nat === 'number' ? nat : null,
    unit: trash ? '건' : '곳',
    syncCellValue: withSyncDate(trash ? '매일 자동' : '월 1회 자동', syncStatus.value?.[categoryParam.value], trash ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS),
    basisValue: trash ? '시·군·구 / 동' : '지역 선택 후 정렬',
  })
})
```

- [ ] **Step 3: 테스트 통과(GREEN)**

```bash
npx vitest run tests/utils/heroBandStats.test.ts tests/pages/category.test.ts 2>&1 | tail -6
```
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add utils/heroBandStats.ts tests/utils/heroBandStats.test.ts "pages/[category]/index.vue"
git commit -m "feat(trust): 전국 카테고리 밴드 조건부(이 지역/전국 등록)·no-duplicate (PR⑧ S1)"
```

---

### Task 4: S3+S4 부동산 밴드 (전국 RE 재라벨 + 지역 RE 전국 등록)

**Files:**
- Create: `frontend/composables/useNationalComplexCount.ts` (전국 RE 단지 수, server:true fail-open)
- Modify: `frontend/pages/real-estate/[realEstateType]/index.vue` (S3, heroStats L417-425)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue` (S4, heroStats L254-259)
- Test: `frontend/tests/composables/useNationalComplexCount.test.ts` + 위 페이지 테스트 밴드 케이스

**Interfaces:**
- Produces: `useNationalComplexCount(apiSlug: Ref<string>|string): { total: Readonly<Ref<number|null>> }` — 전국 `getComplexList(type)` total. VALID_NAME 정합.

**현재 코드(확인됨):**
S3: `[{label} 거래 N건 | 보기 방식 | 함께 보기]` — totalComplexes는 이미 전국 VALID_NAME 단지 수(재라벨만, fetch 불필요).
S4: `[유효 단지 N곳 | 데이터 출처]` — totalComplexes는 지역 단지 수. 전국은 신규 fetch 필요.

- [ ] **Step 1: useNationalComplexCount + 실패 테스트(RED)** — `getComplexList` API 엔드포인트 확인(recon: `getComplexList(type)` → `.total`; 라우트는 realEstate 서비스; 프론트 기존 호출부는 `pages/real-estate/[realEstateType]/index.vue` L230-237 SSR fetch 참고). 컴포저블은 city/district 없이 type만으로 전국 total(page:1,limit:1)을 fail-open으로:

```ts
import { readonly, unref } from 'vue'
export function useNationalComplexCount(apiSlug: string) {
  const config = useRuntimeConfig(); const apiBase = config.public.apiBase
  const { data } = useAsyncData<number | null>(`national-complex-${apiSlug}`, async () => {
    try {
      // S3의 기존 SSR getComplexList 호출과 동일 엔드포인트/파라미터, city·district 없이, limit=1
      const res = await $fetch<{ success: boolean; data: { total: number } }>(
        `${apiBase}/api/real-estate/${apiSlug}/complexes`,   // ← S3 기존 호출 경로에 맞춰 정확히
        { query: { page: 1, limit: 1 }, signal: AbortSignal.timeout(8000) },
      )
      return res?.data?.total ?? null
    } catch { return null }
  }, { server: true })
  return { total: readonly(data) }
}
```
(엔드포인트·쿼리 파라미터는 S3 `index.vue`의 기존 `getComplexList` fetch를 열어 **정확히** 일치시킬 것. 이게 이 태스크의 핵심 확인 포인트.)

`tests/composables/useNationalComplexCount.test.ts`: 성공→total 반환, 실패→null(fail-open), server:true 옵션 확인(useSyncStatus.test 패턴).

```bash
npx vitest run tests/composables/useNationalComplexCount.test.ts
```
Expected: FAIL → 작성 후 GREEN.

- [ ] **Step 2: S3 재라벨** — `real-estate/[realEstateType]/index.vue` heroStats:
```ts
const heroStats = computed(() => {
  const stats: { label: string; value: string }[] = []
  if (totalComplexes.value > 0) {
    stats.push({ label: '전국 등록', value: `${totalComplexes.value.toLocaleString('ko-KR')}곳` })   // was '{label} 거래 N건'
  }
  stats.push({ label: '보기 방식', value: '매매 / 전월세' })
  stats.push({ label: '함께 보기', value: '지역 생활 인프라' })
  return stats
})
```
(전국 표면 → '이 지역' 없음. 단위 '건'→'곳'으로 단지 의미 명확화, 값은 기존 totalComplexes 그대로. fetch 없음.)

- [ ] **Step 3: S4 배선** — `real-estate/[realEstateType]/[city]/[district]/index.vue`:
- `useNationalComplexCount` import + `const { total: nationalComplexes } = useNationalComplexCount(apiSlug)` (apiSlug=현재 타입 슬러그).
- heroStats:
```ts
const heroStats = computed(() => {
  const items: { label: string; value: string }[] = []
  if (totalComplexes.value > 0) items.push({ label: '이 지역', value: `${totalComplexes.value.toLocaleString()}곳` })  // was '유효 단지'
  const nat = nationalComplexes.value
  if (typeof nat === 'number' && nat > 0) items.push({ label: '전국 등록', value: `${nat.toLocaleString('ko-KR')}곳` })
  items.push({ label: '데이터 출처', value: '국토교통부' })   // 3번째(마지막)
  return items
})
```
- **CRITICAL**: `nationalComplexes`는 `shouldNoindexSsr`(L331-336)에 절대 연결 금지. 실패=null=셀 부재만.

- [ ] **Step 4: 페이지 테스트 밴드 케이스 + GREEN** — `realEstatePropertyType.test.ts`(S3)·`realEstateDistrictHub.test.ts`(S4): 기존 PageHero div 스텁을 stats 노출형으로 교체:
```ts
PageHero: { props: ['stats'], template: '<div data-stub="hero"><span v-for="s in (stats||[])" :key="s.label" class="hero-stat" :data-label="s.label">{{ s.value }}</span></div>' }
```
그리고 assert: S3 '전국 등록' 셀 존재(totalComplexes>0), S4 '이 지역' + fail-open('전국 등록' 셀 부재 시에도 밴드 렌더·noindex 무영향). `useNationalComplexCount`는 vi.mock으로 total ref 제어.
```bash
npx vitest run tests/composables/useNationalComplexCount.test.ts tests/pages/real-estate/realEstatePropertyType.test.ts tests/pages/real-estate/realEstateDistrictHub.test.ts 2>&1 | tail -8
```
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add composables/useNationalComplexCount.ts tests/composables/useNationalComplexCount.test.ts "pages/real-estate/[realEstateType]/index.vue" "pages/real-estate/[realEstateType]/[city]/[district]/index.vue" tests/pages/real-estate/realEstatePropertyType.test.ts tests/pages/real-estate/realEstateDistrictHub.test.ts
git commit -m "feat(trust): 부동산 목록 밴드 — 전국 RE 재라벨 + 지역 RE 전국 등록(단지 정합) (PR⑧ S3·S4)"
```

---

### Task 5: S5 지역 허브 밴드 (신규 :stats)

**Files:**
- Modify: `frontend/pages/[city]/index.vue` (PageHero L8-13, districts-sum L270)
- Test: `frontend/tests/pages/cityHubCategoryLinks.test.ts` (밴드 케이스 추가; PageHero 스텁 교체)

**현재 상태(확인됨):** PageHero `:stats` 없음. `hubSyncStatus`(useSyncStatus, L186)·`reSyncedAt`(RE 6키 최신, L189-194) 이미 존재. 도시 시설 합 `districts[].facilityTotal` reduce가 L270에 JSON-LD용 인라인만 존재.

- [ ] **Step 1: 실패 테스트(RED)** — `cityHubCategoryLinks.test.ts`에 밴드 케이스 추가. PageHero 스텁을 stats 노출형으로 교체(위 Task 4 Step 4와 동일 템플릿). `useNationalStats` vi.mock으로 `{ stats: ref({ total: 4500000 }) }`, cityData districts 합 100 가정:
```ts
it('허브 밴드: 이 지역·전국 등록·데이터 갱신 3칸', async () => {
  const w = await mountHub(/* cityData districts facilityTotal 합 100, useNationalStats total 4500000 */)
  const cells = w.findAll('.hero-stat')
  const labels = cells.map(c => c.attributes('data-label'))
  expect(labels).toContain('이 지역')
  expect(labels).toContain('전국 등록')
  expect(labels).toContain('데이터 갱신')
})
it('허브 밴드 fail-open: 전국 stats null이면 전국 등록 셀만 부재', async () => {
  const w = await mountHub(/* useNationalStats total null */)
  expect(w.findAll('.hero-stat').map(c => c.attributes('data-label'))).not.toContain('전국 등록')
  expect(w.findAll('.hero-stat').length).toBeGreaterThan(0)   // 밴드는 렌더
})
```
```bash
npx vitest run tests/pages/cityHubCategoryLinks.test.ts
```
Expected: FAIL — 밴드 미존재.

- [ ] **Step 2: districts-sum을 top-level computed로 승격** — L270의 `data.districts.reduce(...)`를 top-level `cityFacilityTotal` computed로 올려 heroStats·JSON-LD 양쪽에서 재사용(cityData는 useAsyncData라 SSR-safe):
```ts
const cityFacilityTotal = computed(() =>
  (cityData.value?.districts ?? []).reduce((sum, d) => sum + (d.facilityTotal ?? 0), 0),
)
```
(기존 L270 인라인 계산을 이 computed 사용으로 교체 — JSON-LD 값 동일 보존.)

- [ ] **Step 3: heroStats 추가 + PageHero 배선** — `useNationalStats` import + `const { stats: nationalStats } = useNationalStats()`. `withSyncDate`/`RE_STALE_DAYS` import(`~/utils/syncFreshness`, 현재 미import이면 추가). heroStats:
```ts
const heroStats = computed(() => {
  const stats: { label: string; value: string }[] = []
  if (cityFacilityTotal.value > 0) stats.push({ label: '이 지역', value: `${cityFacilityTotal.value.toLocaleString('ko-KR')}곳` })
  const nat = nationalStats.value?.total
  if (typeof nat === 'number' && nat > 0) stats.push({ label: '전국 등록', value: `${nat.toLocaleString('ko-KR')}곳` })
  stats.push({ label: '데이터 갱신', value: withSyncDate('자동 갱신', reSyncedAt.value, RE_STALE_DAYS) })   // 중립 라벨(허브=시설 월1회+RE 매일 혼합)
  return stats
})
```
PageHero에 `:stats="heroStats"` 추가.
(라벨 '자동 갱신'은 허브 혼합 cadence 중립 표기 — 최종 리뷰/사용자 확인 대상으로 메모.)

- [ ] **Step 4: 테스트 통과(GREEN) + noindex 회귀**

```bash
npx vitest run tests/pages/cityHubCategoryLinks.test.ts 2>&1 | tail -8
```
Expected: PASS. 허브 noindex/링크 기존 케이스 유지.

- [ ] **Step 5: 커밋**

```bash
git add "pages/[city]/index.vue" tests/pages/cityHubCategoryLinks.test.ts
git commit -m "feat(trust): 지역 허브 카운터 밴드 신설(이 지역·전국 등록·데이터 갱신) (PR⑧ S5)"
```

---

### Task 6: 전체 검증 + PR 생성

**Files:** 없음

- [ ] **Step 1: 프론트 lint + 전체 테스트** (프론트만 변경 — 백엔드 무변경)

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```
Expected: lint 0 errors, 전체 PASS. SearchAutocomplete/localStorage flaky는 클린 재실행 확인.

- [ ] **Step 2: fail-open·SSR 스폿체크 (dev 가능 시)**
  - 5개 표면 밴드가 ≤3칸으로 렌더, 융합 '데이터 갱신/업데이트' 셀이 3번째(모바일 전폭).
  - 백엔드 죽였을 때(또는 getStats mock 실패) '전국 등록' 셀만 사라지고 밴드·페이지는 정상, **noindex 안 걸림**(핵심).
  - 미필터 전국 목록에서 '이 지역'과 '전국 등록' 중복 숫자 없음.
  - 지역 RE '이 지역'(유효 단지)과 '전국 등록' 단위 일치(둘 다 곳/단지).
  - 모바일 390px 가로 넘침 없음.

- [ ] **Step 3: 범위·lock 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git diff develop --stat -- '**/package-lock.json'   # 비어야 함
git diff develop --name-only | grep -E "backend/|schema.prisma" || echo "OK: 백엔드 무변경"
git status --porcelain=v1   # stray 커밋 금지
```
Expected: package-lock·백엔드 무변경. 변경은 프론트 컴포저블 2 + 유틸 1 + 페이지 5 + 테스트뿐.

- [ ] **Step 4: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-counter-band
gh pr create --base develop \
  --title "feat(trust): 목록·허브 카운터 밴드 (PR ⑧)" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) §6-3 카운터 밴드. 5개 목록·허브 표면의 PageHero 스탯을 "이 지역 N곳 · 전국 등록 N곳 · 데이터 갱신(융합)" 3칸으로 통일 — "선언(월 1회 자동)→증명(실수치·날짜)" 완결.

- 이 지역/데이터 갱신 = 기존 값 재라벨·재사용(신규 데이터 아님)
- 전국 등록 = 신규 `useNationalStats`(getStats, **server:true + 엄격 fail-open**) / 부동산은 `useNationalComplexCount`(전국 getComplexList, VALID_NAME 정합)
- 5표면: 전국·지역 시설목록, 전국·지역 부동산목록, 지역 허브(신규 밴드)

## 불변식
- fail-open: 전국 fetch 실패=셀만 부재, **noindex·렌더 절대 미게이팅**(과거 SSR 풀고갈→noindex 사고 분리). 융합 날짜 셀은 현행(useSyncStatus server:false, SSR 라벨-only) 유지
- ≤3칸(융합 셀 항상 마지막=모바일 전폭)·no-duplicate(이 지역==전국이면 전국 하나만)·RE 단위 정합(VALID_NAME)
- 백엔드·package-lock·광고 무변경. 사용자 결정: 전국 카운트 server:true(크롤러 가시 증빙)

## 테스트
- 순수 빌더(buildRegionCategoryStats/buildCategoryListStats) 단위 테스트(정확N·fail-open·no-duplicate), useNationalStats/useNationalComplexCount(server:true·null-on-error), 페이지 밴드 케이스(PageHero 스텁 stats 노출)
- frontend vitest 전체 PASS, lint 0

## 사용자 확인 대상(비차단)
- 허브 융합 셀 라벨 '자동 갱신'(시설 월1회+RE 매일 혼합 중립 표기)
EOF
)"
```
Expected: PR URL. CI green 확인 후 사용자 머지 판단.

---

## 플랜 메모

- **전국 카운트 server:true 결정**: 사용자 선택(크롤러 가시 증빙=§6-3 목표). getStats는 단일 5분 캐시+coalescing이라 부하 미미하나, **반드시 fail-open으로 noindex/렌더와 분리**(과거 project_ssr_noindex_pool_exhaustion 사고는 페이지별 상세 Prisma 쿼리였음 — 성격 다름). useNationalStats/useNationalComplexCount의 try/catch→null이 SSR throw를 삼켜 렌더를 막지 않는 게 핵심.
- **RE 단위 정합**: 지역 '유효 단지'=VALID_NAME 필터 단지 수. 전국도 `getComplexList(type).total`(VALID_NAME)로 맞춤 — `getStats.realEstateBuildings`(무필터, 더 큼)는 사용 금지(전국>지역합 역전 방지).
- **테스트 전략**: [category]/index·region×category는 full-mount 테스트가 없어 heroStats 로직을 **순수 빌더 util로 추출**해 exactly-N·fail-open·no-duplicate를 단위 테스트. full-mount 있는 표면(RE 2종·허브)은 PageHero 스텁을 stats 노출형으로 교체해 셀 assert.
- **날짜 셀 미변경**: 융합 withSyncDate 셀은 SSR 라벨-only(useSyncStatus server:false) 그대로 — 결정대로 별도 SSR 날짜 셀 분리 안 함.
- **백엔드 무변경**: 허브 '이 지역'은 client-sum(districts[].facilityTotal), 전국은 기존 getStats. areaService totalFacilities 노출은 이득 없어 스킵.
- **다음 (Phase 2 잔여):** PR ⑨ 히어로+헤더+GNB C안(§6-1·6-2) / PR ⑩ 로고 코발트(§6-6). §6-5 상세 스펙 스트립 미배치.
