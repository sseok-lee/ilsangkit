# AdSense 무효 트래픽 대응 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실사용자가 아닌 컨텍스트(CI/봇/헤드리스/degraded 페이지)에서 광고가 발화되지 않게 단일 게이트로 차단하고, 모바일 광고 밀도/배치를 정비해 우발 클릭을 줄여 AdSense 광고 게재 제한 자동 재심사를 통과한다.

**Architecture:** `useAdsPolicy` 단일 게이트(`canLoadAdScript`=플러그인용 2요소 / `shouldServeAds`=AdBanner용 3요소)를 만들어 `adsense.client.ts`(스크립트 주입)와 `AdBanner.vue`(렌더/push)가 이 게이트만 본다. degraded/noindex 페이지는 기존 reactive 상태(`fetchFailed`/`noindex`)를 소스로 `suppressAds()`를 reactive하게 호출한다. CI/Lighthouse는 `NUXT_PUBLIC_ADS_ENABLED=false`로 실광고를 끈다. 모바일 상세 2종 광고를 6→4로 정비한다.

**Tech Stack:** Nuxt 3 (SSR) + Vue 3 + TypeScript, Vitest(happy-dom), Playwright, AdSense `ca-pub-2088264360250020`.

**Spec:** `docs/superpowers/specs/2026-06-21-adsense-invalid-traffic-remediation-design.md`

## Global Constraints

- **Node 20 고정**: 작업 전 `nvm use 20`. 패키지 변경 시 lock 재생성 금지(`rm package-lock.json` 금지), 기존 lock 유지한 채 `npm install`.
- **PR 워크플로우**: feature 브랜치 `fix/adsense-invalid-traffic`(develop 기준)에서 작업, main/develop 직접 커밋 금지, CI green 후 머지.
- **`adsEnabled`는 `nuxt.config.ts`에 리터럴 boolean `true`로만 선언** — `process.env` 읽기/문자열 금지(그래야 `NUXT_PUBLIC_ADS_ENABLED=false` 런타임 override가 boolean으로 강제됨).
- **프로덕션 빌드(`deploy.yml`)에는 `NUXT_PUBLIC_ADS_ENABLED`를 절대 주입하지 말 것** (주입 시 prod 광고 0).
- **MPA/HardLink 롤백 금지** (정책상 정상).
- **광고 개수는 사용자 승인값(상세 2종 6→4)만 적용**, 추가 축소/복원은 임의로 하지 말 것.
- **봇 게이팅은 보수적 + allowlist-wins** — 실모바일(NAVER inapp, SamsungBrowser, iPhone/Android Safari·Chrome)은 반드시 통과. 과탐=수익 손실.
- **Vitest auto-import 함정**: 직접 mount/테스트되는 코드는 `ref`/`computed`/`watch`/`watchEffect`를 vue에서 명시 import (auto-import 의존 시 CI ReferenceError).
- 작업 후 `cd frontend && npm run test`(vitest) + `npm run lint` 통과 확인.

---

### Task 1: `useAdsPolicy` 게이트 composable

**Files:**
- Create: `frontend/composables/useAdsPolicy.ts`
- Test: `frontend/tests/composables/useAdsPolicy.test.ts`

**Interfaces:**
- Produces:
  - `isBotSignature(userAgent: string, webdriver: boolean): boolean` — 순수 함수
  - `isLikelyBot(): boolean` — 클라이언트 전용(SSR/test에선 false)
  - `useAdsEnabled(): boolean` — `runtimeConfig.public.adsEnabled !== false`
  - `canLoadAdScript(): boolean` — 플러그인용(`adsEnabled && !isLikelyBot`)
  - `suppressAds(value: boolean): void` — `useState('ads:suppressed')` set
  - `useAdsPolicy(): { shouldServeAds: ComputedRef<boolean> }` — AdBanner용(3요소, reactive)

- [ ] **Step 1: setup.ts에 useState/adsEnabled mock 추가 (게이트가 테스트에서 동작하도록 선행)**

`frontend/tests/setup.ts`의 `mockRuntimeConfig.public`에 `adsEnabled: true`를 추가하고, 파일 하단(`beforeEach` 위)에 `useState` 전역 mock을 추가한다.

```ts
// mockRuntimeConfig.public 안 (gaId 아래에 추가)
    gaId: '',
    adsEnabled: true,
  },
}
```

```ts
// useRoute mock 아래(약 51행 이후) 추가 — useState 키별 공유 ref 스토어
const __useStateStore = new Map<string, ReturnType<typeof ref>>()
;(globalThis as any).useState = <T>(key: string, init?: () => T) => {
  if (!__useStateStore.has(key)) {
    __useStateStore.set(key, ref(init ? init() : (null as unknown as T)))
  }
  return __useStateStore.get(key)
}
;(globalThis as any).__resetUseState = () => __useStateStore.clear()
```

- [ ] **Step 2: 실패 테스트 작성**

```ts
// frontend/tests/composables/useAdsPolicy.test.ts
import { afterEach, describe, expect, it } from 'vitest'
import { isBotSignature, useAdsEnabled, useAdsPolicy, suppressAds } from '~/composables/useAdsPolicy'

const realConfig = (globalThis as any).useRuntimeConfig

afterEach(() => {
  ;(globalThis as any).useRuntimeConfig = realConfig
  ;(globalThis as any).__resetUseState?.()
})

describe('isBotSignature', () => {
  it('webdriver=true면 봇', () => {
    expect(isBotSignature('Mozilla/5.0 (Windows) Chrome/120', true)).toBe(true)
  })
  it('HeadlessChrome UA면 봇', () => {
    expect(isBotSignature('Mozilla/5.0 HeadlessChrome/146', false)).toBe(true)
  })
  it('신헤드리스(Headless 토큰)도 봇', () => {
    expect(isBotSignature('Mozilla/5.0 Chrome/146 Headless', false)).toBe(true)
  })
  it('Yeti/Amazonbot 등 크롤러는 봇', () => {
    expect(isBotSignature('compatible; Yeti/1.1', false)).toBe(true)
    expect(isBotSignature('compatible; Amazonbot/0.1', false)).toBe(true)
  })
  it('실 iPhone Safari는 봇 아님', () => {
    expect(isBotSignature('Mozilla/5.0 (iPhone; CPU iPhone OS 18_5) Safari/604.1', false)).toBe(false)
  })
  it('네이버 인앱은 webdriver여도 allowlist-wins로 통과', () => {
    expect(isBotSignature('Mozilla/5.0 ... NAVER(inapp; search; 2100; 12.21)', true)).toBe(false)
  })
  it('SamsungBrowser는 봇 아님', () => {
    expect(isBotSignature('Mozilla/5.0 (Linux; Android 10) SamsungBrowser/30.0 Chrome/143', false)).toBe(false)
  })
})

describe('useAdsEnabled', () => {
  it('기본(true)이면 enabled', () => {
    expect(useAdsEnabled()).toBe(true)
  })
  it('public.adsEnabled === false면 disabled', () => {
    ;(globalThis as any).useRuntimeConfig = () => ({ public: { adsEnabled: false } })
    expect(useAdsEnabled()).toBe(false)
  })
})

describe('useAdsPolicy.shouldServeAds', () => {
  it('기본은 true', () => {
    expect(useAdsPolicy().shouldServeAds.value).toBe(true)
  })
  it('suppressAds(true)면 false', () => {
    suppressAds(true)
    expect(useAdsPolicy().shouldServeAds.value).toBe(false)
  })
})
```

- [ ] **Step 3: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useAdsPolicy.test.ts`
Expected: FAIL — `Cannot find module '~/composables/useAdsPolicy'`

- [ ] **Step 4: composable 구현**

```ts
// frontend/composables/useAdsPolicy.ts
import { computed, type ComputedRef } from 'vue'

// 광고를 발화하면 안 되는 비인간/자동화 UA. 'Headless'는 구·신 헤드리스 모두 커버.
const BOT_UA = /Headless|playwright|puppeteer|lighthouse|bot|crawl|spider|slurp|bingbot|googlebot|yeti|yandex|amazonbot|bytespider|ahrefs|semrush/i
// 실모바일/인앱 — 봇 매칭보다 우선(allowlist-wins). 과탐=수익 손실 방지.
const HUMAN_UA = /NAVER\(inapp|SamsungBrowser|FBAN|FBAV|Instagram|KAKAOTALK|Line\//i

/** UA/webdriver만으로 봇 여부 판정하는 순수 함수. */
export function isBotSignature(userAgent: string, webdriver: boolean): boolean {
  if (!userAgent) return false
  if (HUMAN_UA.test(userAgent)) return false // allowlist-wins (네이버 인앱이 webdriver여도 통과)
  if (webdriver) return true                  // Playwright/Selenium (단, Lighthouse는 CDP라 못 잡음)
  return BOT_UA.test(userAgent)
}

/** 클라이언트에서만 평가. SSR/단위테스트(import.meta.client falsy)에선 false로 클라이언트에 위임. */
export function isLikelyBot(): boolean {
  if (!import.meta.client) return false
  const nav = navigator as Navigator & { webdriver?: boolean }
  return isBotSignature(nav.userAgent || '', nav.webdriver === true)
}

/** 리터럴 boolean(nuxt.config) 전제. 명시적 false만 비활성. */
export function useAdsEnabled(): boolean {
  return useRuntimeConfig().public.adsEnabled !== false
}

/** 플러그인(스크립트 주입)용 — per-page suppression은 보지 않음(전역·1회). */
export function canLoadAdScript(): boolean {
  return useAdsEnabled() && !isLikelyBot()
}

/** degraded/noindex 페이지가 광고를 억제하도록 set (reactive 소스에서 호출). */
export function suppressAds(value: boolean): void {
  useState<boolean>('ads:suppressed', () => false).value = value
}

/** AdBanner용 — 3요소 전부. shouldServeAds는 suppression을 추적하는 reactive. */
export function useAdsPolicy(): { shouldServeAds: ComputedRef<boolean> } {
  const adsEnabled = useAdsEnabled()
  const suppressed = useState<boolean>('ads:suppressed', () => false)
  const shouldServeAds = computed(() => adsEnabled && !isLikelyBot() && !suppressed.value)
  return { shouldServeAds }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useAdsPolicy.test.ts`
Expected: PASS (전체)

- [ ] **Step 6: 커밋**

```bash
git add frontend/composables/useAdsPolicy.ts frontend/tests/composables/useAdsPolicy.test.ts frontend/tests/setup.ts
git commit -m "feat(ads): 광고 발화 단일 게이트 useAdsPolicy 추가 (adsEnabled/봇/suppression)"
```

---

### Task 2: `nuxt.config.ts`에 `adsEnabled` 리터럴 boolean 추가

**Files:**
- Modify: `frontend/nuxt.config.ts:182-188` (`runtimeConfig.public`)

**Interfaces:**
- Consumes: 없음
- Produces: `runtimeConfig.public.adsEnabled: boolean` (기본 true)

- [ ] **Step 1: public 블록에 adsEnabled 추가**

`runtimeConfig.public`의 `disableMsw` 아래에 추가:

```ts
      disableMsw: process.env.NUXT_PUBLIC_DISABLE_MSW === 'true',
      // ⚠️ 리터럴 boolean 필수 — NUXT_PUBLIC_ADS_ENABLED override가 boolean으로 강제 변환됨.
      // process.env 읽기/문자열 금지. CI/Lighthouse에서만 NUXT_PUBLIC_ADS_ENABLED=false.
      adsEnabled: true
```

- [ ] **Step 2: 런타임 override 동작을 단위로 보증 (useAdsEnabled 테스트는 Task 1에 이미 있음)**

Run: `cd frontend && npx vitest run tests/composables/useAdsPolicy.test.ts -t useAdsEnabled`
Expected: PASS (`public.adsEnabled===false`일 때 disabled)

- [ ] **Step 3: 빌드가 깨지지 않는지 확인**

Run: `cd frontend && npx nuxt prepare`
Expected: 에러 없이 완료

- [ ] **Step 4: 커밋**

```bash
git add frontend/nuxt.config.ts
git commit -m "feat(ads): runtimeConfig.public.adsEnabled 리터럴 boolean 추가"
```

---

### Task 3: `adsense.client.ts`에 게이트 적용 (스크립트 주입 차단)

**Files:**
- Modify: `frontend/plugins/adsense.client.ts`

**Interfaces:**
- Consumes: `canLoadAdScript()` (Task 1)

- [ ] **Step 1: 실패 테스트 작성(소스 구조 보증 — 기존 AdBanner.test.ts 패턴 차용)**

```ts
// frontend/tests/plugins/adsensePlugin.test.ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const src = () => readFileSync(resolve(root, 'plugins/adsense.client.ts'), 'utf8')

describe('adsense.client plugin', () => {
  it('canLoadAdScript() 게이트로 스크립트 주입을 차단한다', () => {
    expect(src()).toContain('canLoadAdScript')
    expect(src()).toMatch(/if\s*\(\s*!canLoadAdScript\(\)\s*\)\s*return/)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/plugins/adsensePlugin.test.ts`
Expected: FAIL — `canLoadAdScript` 미포함

- [ ] **Step 3: 플러그인 수정**

```ts
// frontend/plugins/adsense.client.ts (상단 import 추가 + onNuxtReady 내부 가드)
import { canLoadAdScript } from '~/composables/useAdsPolicy'

const ADSENSE_SRC =
  'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2088264360250020'

export default defineNuxtPlugin(() => {
  onNuxtReady(() => {
    // CI(adsEnabled=false)·봇/헤드리스(Playwright 등)면 광고 스크립트 자체를 주입하지 않는다.
    if (!canLoadAdScript()) return
    // HMR/재실행 대비 중복 주입 가드
    if (document.querySelector(`script[src="${ADSENSE_SRC}"]`)) return
    const s = document.createElement('script')
    s.src = ADSENSE_SRC
    s.async = true
    s.crossOrigin = 'anonymous'
    document.head.appendChild(s)
  })
})
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/plugins/adsensePlugin.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/plugins/adsense.client.ts frontend/tests/plugins/adsensePlugin.test.ts
git commit -m "feat(ads): adsbygoogle 스크립트 주입을 canLoadAdScript 게이트로 차단"
```

---

### Task 4: `AdBanner.vue`에 게이트 적용 (렌더/push) + 기존 테스트 갱신

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue` (script: import/gate, template: shouldShow는 기존 그대로 사용)
- Modify: `frontend/tests/components/ads/AdBanner.test.ts:42` (단언 갱신) + 신규 suppression 테스트

**Interfaces:**
- Consumes: `useAdsPolicy()` → `shouldServeAds` (Task 1); `useDeferredAdSenseRequest(container, canRequest)` (기존, `canRequest` push 시점 재평가)

- [ ] **Step 1: 기존 깨지는 단언 갱신 + suppression 테스트 추가**

`AdBanner.test.ts:42`를 교체:

```ts
// 기존: expect(source()).toContain('useDeferredAdSenseRequest(container)')
expect(source()).toContain('useDeferredAdSenseRequest(container, () => shouldServeAds.value)')
```

`afterEach`에 useState 리셋 추가(약 30-34행 afterEach 내부):

```ts
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    delete (window as unknown as { adsbygoogle?: unknown }).adsbygoogle
    ;(globalThis as any).__resetUseState?.()
  })
```

`describe` 블록 끝에 신규 테스트 추가:

```ts
  it('ads:suppressed=true면 광고를 렌더하지 않는다', async () => {
    ;(globalThis as any).useState('ads:suppressed', () => false).value = true
    const wrapper = mount(AdBanner, { global: { stubs: { ClientOnly: clientOnlyStub } } })
    await flushAdMount()
    expect(wrapper.find('ins.adsbygoogle').exists()).toBe(false)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts`
Expected: FAIL — `useDeferredAdSenseRequest(container, ...)` 단언 불일치 + suppression 테스트 실패

- [ ] **Step 3: AdBanner.vue 수정**

`<script setup>` 상단 import 추가:

```ts
import { useAdsPolicy } from '~/composables/useAdsPolicy'
```

`const route = useRoute()` 부근에 게이트 도입:

```ts
const { shouldServeAds } = useAdsPolicy()
```

`shouldShow` computed를 게이트와 합친다 (기존 `const shouldShow = computed(() => !props.only || matches.value)` 교체):

```ts
const shouldShow = computed(() => shouldServeAds.value && (!props.only || matches.value))
```

`useDeferredAdSenseRequest(container)` 호출에 canRequest 주입 (기존 `const { scheduleAdRequest } = useDeferredAdSenseRequest(container)`):

```ts
const { scheduleAdRequest } = useDeferredAdSenseRequest(container, () => shouldServeAds.value)
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts`
Expected: PASS (기존 + suppression)

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/ads/AdBanner.vue frontend/tests/components/ads/AdBanner.test.ts
git commit -m "feat(ads): AdBanner 렌더/push를 shouldServeAds 게이트로 가드"
```

---

### Task 5: degraded/noindex 페이지에서 reactive suppression 배선

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (`fetchFailed`/`noindex` 부근)
- Modify: `frontend/pages/[city]/index.vue` (`isNoindex` 정의 이후)
- Modify: `frontend/pages/[city]/[district]/index.vue` (`isNoindex` 정의 이후)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue` (`fetchFailed` 정의 이후)
- Test: `frontend/tests/pages/adsSuppression.test.ts` (소스 구조 보증)

**Interfaces:**
- Consumes: `suppressAds(boolean)` (Task 1); 각 페이지 기존 reactive: `fetchFailed`, `noindex`/`isNoindex`, `totalComplexes`

- [ ] **Step 1: 실패 테스트(소스 구조) 작성**

```ts
// frontend/tests/pages/adsSuppression.test.ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

const pages: [string, RegExp][] = [
  ['pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*noindex\.value\s*\)/],
  ['pages/[city]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*isNoindex\.value\s*\)/],
  ['pages/[city]/[district]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*isNoindex\.value\s*\)/],
  ['pages/real-estate/[realEstateType]/[city]/[district]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*totalComplexes\.value === 0\s*\)/],
]

describe('degraded/noindex 페이지는 reactive로 광고를 억제한다', () => {
  it.each(pages)('%s', (p, re) => {
    const src = read(p)
    expect(src).toContain("import { suppressAds } from '~/composables/useAdsPolicy'")
    expect(src).toContain('watchEffect(')
    expect(src).toMatch(re)
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/adsSuppression.test.ts`
Expected: FAIL — suppressAds/watchEffect 미포함

- [ ] **Step 3: 각 페이지 배선**

각 페이지 `<script setup>` import 영역에 추가(이미 `watchEffect`가 vue에서 import 안 돼 있으면 명시 import):

```ts
import { watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'
```

`[buildingName].vue` — `noindex` computed(L526) 정의 이후:

```ts
// degraded(503) 또는 noindex(빈 건물) 페이지에선 광고 발화를 억제한다 (SSR·클라 네비 모두).
watchEffect(() => suppressAds(fetchFailed.value || noindex.value))
```

`[city]/index.vue` — `isNoindex` computed(L204) 정의 이후:

```ts
watchEffect(() => suppressAds(fetchFailed.value || isNoindex.value))
```

`[city]/[district]/index.vue` — `isNoindex` computed(L194) 정의 이후:

```ts
watchEffect(() => suppressAds(fetchFailed.value || isNoindex.value))
```

`real-estate/.../[district]/index.vue` — `fetchFailed` computed(L208) 정의 이후 (이 페이지는 top-level isNoindex가 없어 confirmedEmpty를 직접 사용):

```ts
watchEffect(() => suppressAds(fetchFailed.value || totalComplexes.value === 0))
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/adsSuppression.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" "frontend/pages/[city]/index.vue" "frontend/pages/[city]/[district]/index.vue" "frontend/pages/real-estate/[realEstateType]/[city]/[district]/index.vue" frontend/tests/pages/adsSuppression.test.ts
git commit -m "feat(ads): degraded/noindex 페이지에서 reactive로 광고 억제 (suppressAds)"
```

---

### Task 6: 시설 상세 광고 밀도/배치 정비 (모바일 6→4)

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (AdBanner L117/123/138/166/178/196/263)
- Test: `frontend/tests/pages/detailAdDensity.test.ts`

**Interfaces:** 없음 (템플릿 변경)

- [ ] **Step 1: 실패 테스트(광고 개수/배치) 작성**

```ts
// frontend/tests/pages/detailAdDensity.test.ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')
const count = (s: string, re: RegExp) => (s.match(re) || []).length

describe('시설 상세 광고 밀도', () => {
  const src = () => read('pages/[category]/[id].vue')
  it('AdBanner는 5개(모바일 4 + 데스크톱 사이드바 1)', () => {
    expect(count(src(), /<AdBanner/g)).toBe(5)
  })
  it('로드뷰 직후 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: ROADVIEW ↔ NEARBY 사이')
  })
  it('주변시설 바로 아래 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: 주변 시설 바로 아래')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/detailAdDensity.test.ts -t "시설"`
Expected: FAIL — 현재 7개 + 제거 안 된 주석

- [ ] **Step 3: 페이지 수정**

`pages/[category]/[id].vue`에서:

(a) **제거** — 로드뷰 직후 블록(주석 + 태그):
```html
              <!-- Ad: ROADVIEW ↔ NEARBY 사이 -->
              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```
(b) **제거** — 주변시설 바로 아래 블록:
```html
              <!-- Ad: 주변 시설 바로 아래 -->
              <AdBanner />
```
(c) **변환** — 상태↔기본정보(L123): `<AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />` → `<AdBanner variant="compact-mobile" />`
(d) **변환** — 기본정보↔지도(L138): 동일하게 `<AdBanner variant="compact-mobile" />`
(e) **변환** — NEARBY 이후(L196): `<AdBanner />` → `<AdBanner variant="compact-mobile" />`
(f) **유지** — HERO 아래(L117, 사각형), 데스크톱 사이드바(L263).

결과: 모바일 = HERO 사각형 1 + compact 3 = 4, 데스크톱 사이드바 1. 총 `<AdBanner` 5개.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detailAdDensity.test.ts -t "시설"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add "frontend/pages/[category]/[id].vue" frontend/tests/pages/detailAdDensity.test.ts
git commit -m "fix(ads): 시설 상세 모바일 광고 6→4 + 로드뷰/카드 인접 광고 제거(오탭 방지)"
```

---

### Task 7: 부동산 상세 광고 밀도/배치 정비 (6→4)

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (AdBanner L84/144/258/287/362/375)
- Test: `frontend/tests/pages/detailAdDensity.test.ts` (Task 6 파일에 추가)

- [ ] **Step 1: 실패 테스트 추가**

Task 6의 `detailAdDensity.test.ts`에 describe 추가:

```ts
describe('부동산 상세 광고 밀도', () => {
  const src = () => read('pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
  it('AdBanner는 4개', () => {
    expect(count(src(), /<AdBanner/g)).toBe(4)
  })
  it('로드뷰 이후 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: 로드뷰 이후')
  })
  it('인근 단지 이후 광고는 제거됐다', () => {
    expect(src()).not.toContain('Ad: 인근 단지 이후')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/detailAdDensity.test.ts -t "부동산"`
Expected: FAIL — 현재 6개

- [ ] **Step 3: 페이지 수정**

`[buildingName].vue`에서 **제거**:
```html
      <!-- Ad: 로드뷰 이후 (데스크톱은 위치(md:order-7)와 거래내역(md:order-9) 사이) -->
      <AdBanner class="order-10 md:order-8" variant="compact-mobile" />
```
```html
      <!-- Ad: 인근 단지 이후 -->
      <AdBanner class="order-12 md:order-12" variant="compact-mobile" />
```
**유지**: L84(Hero 직후), L258(시세↔위치), L287(거래내역 이후), L375(주변 생활시설 이후). 총 `<AdBanner` 4개.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/detailAdDensity.test.ts`
Expected: PASS (시설+부동산 전체)

- [ ] **Step 5: 커밋**

```bash
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" frontend/tests/pages/detailAdDensity.test.ts
git commit -m "fix(ads): 부동산 상세 광고 6→4 + 로드뷰/스택 인접 광고 제거(오탭 방지)"
```

---

### Task 8: CI/Lighthouse 실광고 차단 (env 주입)

**Files:**
- Modify: `lighthouserc.js:31` (`startServerCommand`)
- Modify: `.github/workflows/lighthouse.yml` (Build frontend 스텝 env + Run Lighthouse 스텝 env)
- Modify: `frontend/playwright.config.ts:57-62` (`webServer.command`)

**Interfaces:** 없음 (런타임/빌드 env)

- [ ] **Step 1: lighthouserc.js preview 서버에 env 주입**

`lighthouserc.js`의 `startServerCommand`:
```js
// 기존: startServerCommand: 'PORT=4173 npm run preview',
startServerCommand: 'NUXT_PUBLIC_ADS_ENABLED=false PORT=4173 npm run preview',
```

- [ ] **Step 2: lighthouse.yml 빌드/실행 스텝에 env 주입**

`Build frontend for production` 스텝 `env:`에 추가:
```yaml
          NUXT_PUBLIC_GA_ID: G-XXXXXXXXXX
          NUXT_PUBLIC_ADS_ENABLED: 'false'
```
`Run Lighthouse CI` 스텝 `env:`에도 추가:
```yaml
          SAMPLE_REGION_URL: ${{ env.SAMPLE_REGION_URL }}
          NUXT_PUBLIC_ADS_ENABLED: 'false'
```

- [ ] **Step 3: playwright webServer에 env 주입(로컬 E2E 하드닝)**

`frontend/playwright.config.ts`의 `webServer.command`:
```ts
    // 기존: command: 'npm run dev',
    command: 'NUXT_PUBLIC_ADS_ENABLED=false npm run dev',
```

- [ ] **Step 4: 변경 검증(설정 grep)**

Run: `grep -n "NUXT_PUBLIC_ADS_ENABLED" lighthouserc.js .github/workflows/lighthouse.yml frontend/playwright.config.ts`
Expected: 4곳 매칭(lighthouserc 1, workflow 2, playwright 1)

- [ ] **Step 5: 커밋**

```bash
git add lighthouserc.js .github/workflows/lighthouse.yml frontend/playwright.config.ts
git commit -m "fix(ads): CI/Lighthouse/preview에서 NUXT_PUBLIC_ADS_ENABLED=false로 실광고 차단"
```

---

### Task 9: (Phase 2) AdBanner SPA 라우트 재요청 스로틀

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue` (`watch(() => route.path)`)
- Test: `frontend/tests/components/ads/AdBanner.test.ts` (소스 구조 단언 추가)

**Interfaces:** 없음

- [ ] **Step 1: 실패 테스트(소스 구조) 추가**

`AdBanner.test.ts`에 추가:
```ts
  it('라우트 변경 재요청에 rapid-nav 스로틀 가드가 있다', () => {
    expect(source()).toContain('MIN_NAV_INTERVAL_MS')
    expect(source()).toMatch(/route\.path[\s\S]*MIN_NAV_INTERVAL_MS/)
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts -t "스로틀"`
Expected: FAIL

- [ ] **Step 3: AdBanner.vue 라우트 watch 스로틀 추가**

`STATUS_TIMEOUT_MS` 상수 근처에 추가:
```ts
// 짧은 간격 연속 네비게이션(봇/빠른 클릭) 시 광고 재요청을 억제 — 인위적 임프레션 방지.
const MIN_NAV_INTERVAL_MS = 1500
let lastNavAt = 0
```

`watch(() => route.path, ...)`를 교체:
```ts
watch(() => route.path, async () => {
  if (!shouldShow.value) return
  const now = (typeof performance !== 'undefined' ? performance.now() : Date.now())
  if (now - lastNavAt < MIN_NAV_INTERVAL_MS) return // rapid-nav 가드
  lastNavAt = now
  adKey.value++
  await nextTick()
  refresh()
})
```

- [ ] **Step 4: 테스트 통과 확인 (전체 AdBanner)**

Run: `cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/ads/AdBanner.vue frontend/tests/components/ads/AdBanner.test.ts
git commit -m "fix(ads): SPA 라우트 재요청에 rapid-nav 스로틀 추가 (인위적 임프레션 방지)"
```

---

### Task 10: (Phase 2, 서버) nginx 악성 스캐너 차단 — 문서/배포 절차

> 코드 리포 외(Cafe24 서버 `/etc/nginx/sites-available/ilsangkit`). TDD 불가 — 변경/검증 절차만 기록.

**Files:**
- Modify(서버): `/etc/nginx/sites-available/ilsangkit`
- Create: `docs/ops/nginx-scanner-block.md` (적용/검증 절차 기록)

- [ ] **Step 1: server 블록에 스캐너 차단 location 추가(서버에서 편집)**

```nginx
# 취약점 스캐너 차단(.env/.git 등) — 광고 무관 정크 트래픽 제거
location ~* (^|/)(\.env|\.git|\.aws|\.ssh|wp-login|xmlrpc\.php|\.yml|\.yaml|\.lock)(/|$) {
    return 444;
}
```

- [ ] **Step 2: 문법 검사 + reload(서버)**

```bash
nginx -t && systemctl reload nginx
```
Expected: `syntax is ok` / `test is successful`

- [ ] **Step 3: 차단 검증(서버 또는 외부)**

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://ilsangkit.co.kr/.env
```
Expected: 비정상 응답(444→연결 종료/empty) 또는 403

- [ ] **Step 4: 절차 문서화 + 커밋**

`docs/ops/nginx-scanner-block.md`에 위 변경/검증 절차를 기록(단, `docs/`는 gitignore이므로 로컬 보관 — 서버 변경 자체는 운영 기록으로 남김).

---

### Task 11: (Phase 3) 배포 후 검증 & 회복 모니터링 체크리스트

> 비-TDD 운영 태스크. Phase 1 머지·배포 후 수행.

- [ ] **Step 1: 배포 후 스모크 — 실사용자 광고 정상 발화 확인**

실모바일(또는 실모바일 UA) 브라우저로 라이브 상세 페이지 접속 → `ins.adsbygoogle`에 `data-ad-status="filled"`(또는 정상 요청) 확인. **광고가 0이면 즉시 롤백 검토**(M1 오변환 의심).

- [ ] **Step 2: 봇/CI 광고 0 확인**

`navigator.webdriver`/헤드리스 UA로는 광고 미발화 확인. Lighthouse CI 실행 후 AdSense 실시간 지표에 CI발 노출이 안 잡히는지 관찰.

- [ ] **Step 3: nginx 로그 점검**

```bash
# (서버) 헤드리스/봇이 광고 페이지를 더 이상 비정상 비율로 치지 않는지, 신규 스캐너 여부
sshpass -p '***' ssh root@183.111.126.54 "awk -F'\"' '{print \$6}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -25"
```

- [ ] **Step 4: AdSense 정책센터 추적**

공식 이의신청 불필요 — 자동 재심사. CTR이 1%대 초반 이하로 정상화되고 광고 게재 제한이 해제되는지 수일~수 주 추적. 기준선(정상 CTR/노출) 재설정.

---

## Self-Review

**1. Spec coverage:**
- §4.1 단일 게이트 → Task 1 ✅ / §4.2 1.1 CI 차단 → Task 2·8 ✅ / 1.2 봇 게이팅 → Task 3·4 ✅ / 1.3 reactive degraded → Task 5 ✅ / 1.4 밀도·배치 6→4 → Task 6·7 ✅ / §4.3 2.1 스로틀 → Task 9 ✅ / 2.2 nginx → Task 10 ✅ / Phase 3 → Task 11 ✅. 2.3(슬롯 분리)은 spec에서 선택/후속으로 명시 → 본 플랜 제외(의도적).
- 인과 비중(§2.8): 클릭품질(Task 6·7)을 먼저 배치하지 않았으나 동일 PR 묶음이라 효과 동시 — 단, 실행 시 Task 6·7을 우선 리뷰 권장.

**2. Placeholder scan:** TBD/TODO/"적절히" 없음. 모든 코드 스텝에 실제 코드 포함. ✅

**3. Type consistency:** `shouldServeAds`(ComputedRef<boolean>)·`canLoadAdScript`·`suppressAds`·`isBotSignature` 시그니처가 Task 1 정의와 Task 3·4·5 사용에서 일치. `useDeferredAdSenseRequest(container, () => shouldServeAds.value)`는 기존 `canRequest: () => boolean` 시그니처와 일치(re-eval). degraded 변수명(`fetchFailed`/`noindex`/`isNoindex`/`totalComplexes`)은 실제 페이지 확인값과 일치. ✅

**주의(실행자):** Task 1의 setup.ts 변경(useState/adsEnabled mock)이 선행되지 않으면 Task 4의 AdBanner 테스트가 useState 미정의로 깨진다. Task 순서 준수.

---

## Execution Handoff

플랜 저장 위치: `docs/superpowers/plans/2026-06-21-adsense-invalid-traffic-remediation.md`
