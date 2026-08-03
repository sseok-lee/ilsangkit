# 광고 빈 슬롯 빠른 collapse + 애드블록 감지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 광고 미할당·차단 시 빈칸 노출을 최소화한다 — 타임아웃 단축 + 애드블록 감지로 슬롯을 빠르게/아예 접되, CLS와 fill률은 그대로 둔다.

**Architecture:** (1) `AdBanner.vue`의 status 타임아웃을 4000→1500ms로 줄여 status 미응답 슬롯을 빨리 접는다(늦은 fill은 기존 MutationObserver가 복구). (2) `adsense.client.ts`가 스크립트 로드 실패(애드블록)를 감지해 `ads:blocked` state + sessionStorage를 세팅. (3) `useAdsPolicy.shouldServeAds`가 `!blocked`를 반영 → 차단 시 슬롯 미렌더(세션 내 지속).

**Tech Stack:** Nuxt 3 + Vue 3 + TypeScript, Vitest(happy-dom).

## Global Constraints

- **Node 20 필수** — `nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **PR 워크플로우** — `develop`에서 브랜치 분기, main/develop 직접 커밋 금지, CI green 후 사용자 머지. 커밋 전 frontend `npm run test`·`npm run lint` 통과.
- **광고 개수·위치 불변** — 슬롯 수·배치·`AdBanner` props 변경 금지. 광고가 있을 땐 지금과 동일하게 렌더.
- **CLS 무증가** — 예약 `min-height` 유지(제거 금지). 레이아웃 밀림 없이.
- **fill률 무손해** — 광고 요청은 그대로 발송. 애드블록 판정은 **스크립트 로드 실패 시에만**(오탐 방지). 타임아웃 collapse 후 늦은 `filled`는 기존 observer가 복구(현행 로직 유지).
- **타임아웃 값** = `STATUS_TIMEOUT_MS = 1500`.
- **sessionStorage 키** = `'ads:blocked'`. sessionStorage 접근은 항상 try/catch(프라이빗 모드 대비).
- **테스트 셋업** — `frontend/tests/setup.ts`의 전역 `useState` mock(`__resetUseState`) 사용. `useRuntimeConfig` 전역 mock. `import.meta.client` 분기 유지.
- **작업 브랜치** — 예: `feat/ad-empty-slot-collapse` (develop 분기).

---

## File Structure

**수정**
- `frontend/components/ads/AdBanner.vue` — `STATUS_TIMEOUT_MS` 4000→1500 (Task 1)
- `frontend/composables/useAdsPolicy.ts` — `shouldServeAds`에 `!blocked` + `markAdsBlocked` export (Task 2)
- `frontend/plugins/adsense.client.ts` — 애드블록 감지(onerror + loaded 백업) + 세션 seed (Task 3)
- `frontend/tests/components/ads/AdBanner.test.ts` — 1500ms 타임아웃 테스트 추가 (Task 1)
- `frontend/tests/composables/useAdsPolicy.test.ts` — blocked 게이트 테스트 추가 (Task 2)
- `frontend/tests/plugins/adsensePlugin.test.ts` — 감지 로직 소스 검증 추가 (Task 3)

신규 파일 없음.

---

## Task 1: AdBanner status 타임아웃 4000 → 1500ms

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue:38`
- Test: `frontend/tests/components/ads/AdBanner.test.ts`

**Interfaces:**
- 시그니처/props 변경 없음. `STATUS_TIMEOUT_MS` 상수 값만 변경. 늦은 `filled` 복구(observer 유지)·`.ad-banner--timed-out` collapse 동작은 불변.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/components/ads/AdBanner.test.ts`에 아래 describe를 추가(기존 테스트는 수정하지 않음 — 기존 테스트는 5000/6000ms를 advance하므로 1500으로 바뀌어도 계속 통과). 기존 테스트가 쓰는 마운트 헬퍼/fake timers 셋업을 그대로 재사용한다(파일 상단의 `vi.useFakeTimers()` 및 마운트 방식 확인 후 동일 패턴 사용):

```ts
describe('status 타임아웃 = 1500ms', () => {
  it('1500ms 경과 시 timed-out collapse (status 미응답)', async () => {
    const wrapper = mountAdBanner() // 기존 테스트가 쓰는 마운트 방식과 동일하게
    // status 미설정 상태에서 1500ms 직전에는 collapse 아님
    vi.advanceTimersByTime(1400)
    await nextTick()
    expect(wrapper.classes()).not.toContain('ad-banner--timed-out')
    // 1500ms 도달 시 collapse
    vi.advanceTimersByTime(200)
    await nextTick()
    expect(wrapper.classes()).toContain('ad-banner--timed-out')
  })
})
```

> `mountAdBanner`/`nextTick` 등은 이 테스트 파일에 이미 있는 헬퍼·import를 그대로 쓴다(없으면 기존 timed-out 테스트가 쓰는 것과 동일하게 참조). 기존 timed-out 테스트가 status를 미설정으로 두는 방식(observer가 status를 못 잡게)을 그대로 따른다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/ads/AdBanner.test.ts -t "1500"`
Expected: FAIL — 1400ms에선 아직 timed-out 아님이어야 하는데, 현재 상수 4000이면 1600ms(1400+200)에도 collapse가 안 돼 두 번째 expect가 실패(또는 첫 expect는 통과, 두 번째에서 timed-out 미발생 실패).

- [ ] **Step 3: 상수 변경**

`frontend/components/ads/AdBanner.vue`의 38번째 줄 상수를 변경(주석도 갱신):

```ts
// SPA 네비게이션/애드블록 등으로 AdSense 가 data-ad-status 를 끝내 설정하지 않으면
// 빈 박스가 남는다. 이 시간 안에 status 가 안 잡히면 부모를 collapse 한다.
// 늦게 filled 되면 살아있는 MutationObserver 가 handleStatus 에서 복구한다(광고 무손실).
const STATUS_TIMEOUT_MS = 1500
```

- [ ] **Step 4: 테스트 통과 확인 (신규 + 기존 회귀)**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/components/ads/AdBanner.test.ts`
Expected: PASS — 신규 1500ms 테스트 + 기존 AdBanner 테스트 전부 green(기존은 5000/6000ms advance라 영향 없음).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/ads/AdBanner.vue frontend/tests/components/ads/AdBanner.test.ts
git commit -m "fix(ads): shorten empty-slot collapse timeout 4000→1500ms"
```

---

## Task 2: useAdsPolicy — 차단 게이트 + markAdsBlocked

**Files:**
- Modify: `frontend/composables/useAdsPolicy.ts`
- Test: `frontend/tests/composables/useAdsPolicy.test.ts`

**Interfaces:**
- Consumes: 전역 `useState`, `import.meta.client`, `sessionStorage`.
- Produces:
  - `useAdsPolicy().shouldServeAds` = `adsEnabled && !isLikelyBot() && !suppressed && **!blocked**` (blocked = `useState('ads:blocked')`).
  - `function markAdsBlocked(blocked: Ref<boolean>): void` — 넘겨받은 ref를 true로 + sessionStorage `'ads:blocked'='1'`(try/catch). **ref를 인자로 받아** async 콜백에서 `useState` 호출(문맥 소실) 없이 쓰게 한다.
- Task 3(plugin)이 `markAdsBlocked` + `useState('ads:blocked')`를 소비.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/composables/useAdsPolicy.test.ts`에 추가. 상단 import에 `markAdsBlocked` 추가하고, 상단에 `ref` import(vue) 추가:

```ts
// (상단 import 조정)
import { ref } from 'vue'
import { isBotSignature, useAdsEnabled, useAdsPolicy, suppressAds, markAdsBlocked } from '~/composables/useAdsPolicy'
```

```ts
describe('useAdsPolicy — 애드블록', () => {
  it('ads:blocked state가 true면 shouldServeAds=false', () => {
    ;(globalThis as any).useState('ads:blocked', () => false).value = true
    expect(useAdsPolicy().shouldServeAds.value).toBe(false)
  })
  it('markAdsBlocked는 ref를 true로 + sessionStorage 세팅', () => {
    const r = ref(false)
    markAdsBlocked(r)
    expect(r.value).toBe(true)
    expect(sessionStorage.getItem('ads:blocked')).toBe('1')
  })
})
```

> 기존 `afterEach`의 `__resetUseState()`가 state를 초기화한다. sessionStorage는 happy-dom 기본 제공이며, 필요 시 `afterEach`에 `sessionStorage.clear()`를 추가(다른 테스트 오염 방지).

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useAdsPolicy.test.ts -t "애드블록"`
Expected: FAIL — `markAdsBlocked` export 없음 / `shouldServeAds`가 blocked 미반영.

- [ ] **Step 3: 구현**

`frontend/composables/useAdsPolicy.ts` 수정. 상단 import에 `ref`용 타입 `Ref` 추가:

```ts
import { computed, type ComputedRef, type Ref } from 'vue'
```

`suppressAds` 아래에 `markAdsBlocked` 추가:

```ts
/** 애드블록(스크립트 로드 실패) 감지 시 호출. 넘겨받은 blocked ref 를 true 로 + 세션 저장.
 *  ref 를 인자로 받아 async 콜백(plugin onerror/timeout)에서 useState 문맥 없이 쓸 수 있게 한다. */
export function markAdsBlocked(blocked: Ref<boolean>): void {
  blocked.value = true
  if (import.meta.client) {
    try {
      sessionStorage.setItem('ads:blocked', '1')
    } catch {
      // 프라이빗 모드 등 sessionStorage 불가 — 무시(런타임 state 만으로 동작)
    }
  }
}
```

`useAdsPolicy`에 blocked 게이트 추가:

```ts
export function useAdsPolicy(): { shouldServeAds: ComputedRef<boolean> } {
  const adsEnabled = useAdsEnabled()
  const suppressed = useState<boolean>('ads:suppressed', () => false)
  const blocked = useState<boolean>('ads:blocked', () => false)
  const shouldServeAds = computed(
    () => adsEnabled && !isLikelyBot() && !suppressed.value && !blocked.value
  )
  return { shouldServeAds }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/composables/useAdsPolicy.test.ts`
Expected: PASS (신규 애드블록 2건 + 기존 isBotSignature/useAdsEnabled/suppress 테스트 green).

- [ ] **Step 5: Commit**

```bash
git add frontend/composables/useAdsPolicy.ts frontend/tests/composables/useAdsPolicy.test.ts
git commit -m "feat(ads): gate shouldServeAds on ad-block state (markAdsBlocked)"
```

---

## Task 3: adsense.client.ts — 애드블록 감지 + 세션 seed

**Files:**
- Modify: `frontend/plugins/adsense.client.ts`
- Test: `frontend/tests/plugins/adsensePlugin.test.ts`

**Interfaces:**
- Consumes: Task 2의 `markAdsBlocked` + `useState('ads:blocked')`, 기존 `canLoadAdScript`.
- Produces: 스크립트 로드 실패(onerror) 또는 로드 후 `adsbygoogle.loaded` 미설정 시 `ads:blocked` 세팅. 세션에 이미 차단 기록이 있으면 스크립트 주입 스킵 + blocked 즉시 세팅.

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/plugins/adsensePlugin.test.ts`는 소스-문자열 검증 방식이다(기존 스타일 유지). 추가:

```ts
  it('스크립트 로드 실패(onerror)를 애드블록으로 감지한다', () => {
    expect(src()).toContain('onerror')
    expect(src()).toContain('markAdsBlocked')
  })
  it('로드 후 adsbygoogle.loaded 미설정을 백업으로 감지한다', () => {
    expect(src()).toMatch(/adsbygoogle[\s\S]*loaded/)
  })
  it('세션에 차단 기록이 있으면 주입을 스킵한다', () => {
    expect(src()).toContain("sessionStorage")
    expect(src()).toContain("ads:blocked")
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/plugins/adsensePlugin.test.ts`
Expected: FAIL — 소스에 onerror/markAdsBlocked/loaded/sessionStorage/ads:blocked 미포함.

- [ ] **Step 3: 구현**

`frontend/plugins/adsense.client.ts` 전체를 아래로 교체:

```ts
import { canLoadAdScript, markAdsBlocked } from '~/composables/useAdsPolicy'

// AdSense adsbygoogle.js 를 hydration 완료 후(onNuxtReady)에 주입한다.
// (head 정적 async 는 Auto Ads 가 hydration 도중 DOM 주입 → mismatch/레이아웃 깨짐, 2026-06-09 실측)
const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'
// onerror 가 안 뜨는 블로커(빈 200 응답) 백업 — 이 시간 뒤 adsbygoogle.loaded 미설정이면 차단으로 간주.
// onerror 가 대개 먼저 발동하므로 백업용. 정상 로드는 이 시간 안에 loaded=true 가 된다(느린 회선 오탐 방지 위해 넉넉히).
const AD_BLOCK_CHECK_MS = 3000

export default defineNuxtPlugin(() => {
  // plugin setup(문맥 있음)에서 ref 를 캡처 → async 콜백에선 ref 만 사용.
  const blocked = useState<boolean>('ads:blocked', () => false)

  onNuxtReady(() => {
    // CI(adsEnabled=false)·봇/헤드리스면 스크립트 자체를 주입하지 않는다.
    if (!canLoadAdScript()) return

    // 이번 세션에서 이미 애드블록 확인됨 → 주입/슬롯 스킵(빈칸 없이 바로 미표시).
    try {
      if (sessionStorage.getItem('ads:blocked') === '1') {
        blocked.value = true
        return
      }
    } catch {
      // sessionStorage 불가 — 무시하고 정상 경로 진행
    }

    // HMR/재실행 대비 중복 주입 가드
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return

    const s = document.createElement('script')
    s.src = ADSENSE_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    // 애드블록/네트워크 실패 → 로드 실패. 이 경우에만 차단으로 판정(오탐 방지).
    s.onerror = () => markAdsBlocked(blocked)
    document.head.appendChild(s)

    // 백업: onerror 없이 조용히 막는 블로커(빈 200) — loaded 미설정이면 차단.
    window.setTimeout(() => {
      const w = window as Window & { adsbygoogle?: { loaded?: boolean } }
      if (!(w.adsbygoogle && w.adsbygoogle.loaded)) markAdsBlocked(blocked)
    }, AD_BLOCK_CHECK_MS)
  })
})
```

- [ ] **Step 4: 테스트 통과 + 게이트**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/plugins/adsensePlugin.test.ts && npm run lint && npm run test`
Expected: 신규 소스 검증 3건 + 기존 `canLoadAdScript` 검증 통과, lint 통과, 전체 프론트 vitest green.

- [ ] **Step 5: Commit**

```bash
git add frontend/plugins/adsense.client.ts frontend/tests/plugins/adsensePlugin.test.ts
git commit -m "feat(ads): detect ad blocker (script load fail) and suppress slots for the session"
```

---

## Self-Review (작성자 점검 완료)

**1. Spec 커버리지** — §3.1 타임아웃(Task 1), §3.2 애드블록 감지 onerror+loaded 백업+세션(Task 3), §3.3 shouldServeAds `!blocked`+세션 seed(Task 2 게이트 + Task 3 seed). 동작표/안전장치/광고개수불변 모두 반영.
**2. 플레이스홀더 스캔** — 없음. 프론트 테스트 헬퍼(`mountAdBanner` 등)는 "기존 파일 것 재사용" 지침(추상 지침이 아니라 실제 파일 관례 준수).
**3. 타입 일관성** — `markAdsBlocked(blocked: Ref<boolean>)` ↔ plugin의 `const blocked = useState<boolean>('ads:blocked')` 일치. `shouldServeAds` blocked 반영 ↔ AdBanner `shouldShow`가 이미 `shouldServeAds` 소비(추가 변경 불필요). sessionStorage 키 `'ads:blocked'` 3곳(markAdsBlocked·plugin seed·테스트) 일치.

**하이드레이션 노트(구현자 참고):** `blocked` 전환은 전부 `onNuxtReady`(hydration 이후)에서 일어나므로 SSR↔client 첫 렌더 불일치 경고가 없다. 세션 차단 사용자도 SSR HTML엔 슬롯이 있고 hydration 직후 제거된다(4s→onNuxtReady로 크게 단축, CLS는 빈 예약공간 회수라 수용 범위).

---

## Execution Handoff

완료 후 라이브 검증(선택): 실제 애드블록 확장으로 부동산 상세 진입 → 첫 페이지 빈칸 빠르게 사라짐 + 두 번째 페이지 슬롯 미표시 확인. 정상(비차단) 사용자는 광고 표시·CLS 무변화 확인.
