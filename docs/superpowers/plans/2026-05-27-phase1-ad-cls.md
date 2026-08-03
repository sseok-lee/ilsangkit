# Phase 1 — 광고 CLS 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 시설 상세 페이지 상위 4 광고 슬롯의 CLS를 제거해 시설 상세 CrUX p75 CLS < 0.10을 달성한다.

**Architecture:** `AdBanner.vue`에 비파괴 `sizing` prop을 추가, fixed 모드일 때 `<ins>`에 명시적 높이·`data-full-width-responsive="false"`를 강제한다. 호출부는 4곳만 prop을 추가하며 나머지 슬롯은 기존 동작 유지. 새 컴포넌트·composable·라이브러리 도입 없음.

**Tech Stack:** Nuxt 3 SSR + Vue 3, Vitest(happy-dom), Playwright, @vue/test-utils, AdSense client-side `<ins>` 슬롯.

**Spec 참조:** `docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md` 섹션 4.

**PR 단위:** 단일 atomic PR (`feat(ads): 상위 4 광고 슬롯 fixed-height로 CLS 제거`). Commit 4개로 분해 (Task당 1 commit).

---

## File Structure

| 파일 | 변경 종류 | 책임 |
|---|---|---|
| `frontend/components/ads/AdBanner.vue` | Modify | `sizing`/`fixedHeight` prop, `<ins>` 인라인 style, dev warn, `.ad-banner--auto` 모바일 min-height 보정 |
| `frontend/tests/components/ads/AdBanner.test.ts` | Modify (append) | Vitest 2건 추가 — sizing="fixed" 렌더, sizing 미지정 기본 동작 |
| `frontend/pages/[category]/[id].vue` | Modify (4 lines) | 상위 4 슬롯에 `sizing="fixed" ad-format="rectangle" :fixed-height="280"` |
| `frontend/tests/e2e/ad-cls.spec.ts` | Create | Playwright CLS 메트릭 측정 1건 |

**핵심 식별자 일관성 (모든 Task에서 동일):**
- prop 이름: `sizing`, `fixedHeight`
- 모드 값: `'fixed' | 'min'` (default `'min'`)
- 호출부 attr: `sizing="fixed"`, `ad-format="rectangle"`, `:fixed-height="280"` (kebab-case)
- E2E 임계: CLS < 0.05

---

## Task 1: AdBanner.vue에 sizing prop 추가 (TDD)

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue`
- Modify (append): `frontend/tests/components/ads/AdBanner.test.ts`

- [ ] **Step 1.1: 실패하는 Vitest 케이스 2건 추가**

`frontend/tests/components/ads/AdBanner.test.ts`의 `describe('AdBanner', () => { ... })` 블록 끝(닫는 `})` 직전)에 추가:

```ts
  it('sizing="fixed"일 때 ins에 명시 높이와 data-full-width-responsive=false가 적용된다', async () => {
    const wrapper = mount(AdBanner, {
      props: { sizing: 'fixed', adFormat: 'rectangle', fixedHeight: 280 },
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('style')).toContain('height:280px')
    expect(ins.attributes('data-full-width-responsive')).toBe('false')
    expect(ins.attributes('data-ad-format')).toBe('rectangle')
  })

  it('sizing 미지정 시 기존 동작(auto + full-width-responsive=true)을 유지한다', async () => {
    const wrapper = mount(AdBanner, {
      global: { stubs: { ClientOnly: clientOnlyStub } },
    })
    await flushAdMount()
    const ins = wrapper.get('ins.adsbygoogle')
    expect(ins.attributes('data-ad-format')).toBe('auto')
    expect(ins.attributes('data-full-width-responsive')).toBe('true')
    expect(ins.attributes('style') || '').not.toMatch(/height:\s*\d/)
  })
```

- [ ] **Step 1.2: 테스트가 실패하는지 확인**

```bash
cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts
```

Expected: 첫 번째 케이스 FAIL (`style`에 `height:280px` 없음, `data-full-width-responsive`는 여전히 `true`). 두 번째 케이스는 PASS (기존 동작).

- [ ] **Step 1.3: AdBanner.vue 스크립트 블록 변경**

`frontend/components/ads/AdBanner.vue`의 `<script setup lang="ts">` 안에서 `withDefaults` 호출과 그 직후를 다음으로 교체:

```ts
const props = withDefaults(defineProps<{
  adSlot?: string
  adFormat?: 'auto' | 'rectangle' | 'horizontal' | 'vertical'
  fullWidthResponsive?: 'true' | 'false'
  only?: 'mobile' | 'desktop'
  sizing?: 'fixed' | 'min'
  fixedHeight?: number
}>(), {
  adSlot: '1878068382',
  adFormat: 'auto',
  fullWidthResponsive: 'true',
  sizing: 'min',
})

// dev-only warn — sizing="fixed"에 명시 포맷/높이 필수
if (import.meta.dev && props.sizing === 'fixed') {
  if (props.adFormat === 'auto') {
    console.warn('[AdBanner] sizing="fixed"에는 명시 adFormat 필수 (auto 금지)')
  }
  if (!props.fixedHeight) {
    console.warn('[AdBanner] sizing="fixed"에는 fixedHeight 필수')
  }
}

const insStyle = computed(() =>
  props.sizing === 'fixed' && props.fixedHeight
    ? `display:inline-block; width:100%; height:${props.fixedHeight}px`
    : 'display: block; width: 100%'
)
const insFullWidthResponsive = computed(() =>
  props.sizing === 'fixed' ? 'false' : props.fullWidthResponsive
)
```

- [ ] **Step 1.4: AdBanner.vue 템플릿의 `<ins>` 변경**

`<ins ...>` 블록을 다음으로 교체 (`style`과 `data-full-width-responsive` 두 줄만 변경):

```vue
      <ins
        :key="adKey"
        class="adsbygoogle"
        :style="insStyle"
        :data-ad-client="AD_CLIENT"
        :data-ad-slot="adSlot"
        :data-ad-format="adFormat"
        :data-full-width-responsive="insFullWidthResponsive"
        :data-adtest="adTest"
      />
```

- [ ] **Step 1.5: 테스트가 통과하는지 확인 + 기존 회귀 없음 확인**

```bash
cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts
```

Expected: 모든 케이스 PASS (신규 2건 + 기존 케이스).

- [ ] **Step 1.6: lint 확인**

```bash
cd frontend && npm run lint
```

Expected: 0 error.

- [ ] **Step 1.7: Commit**

```bash
git add frontend/components/ads/AdBanner.vue frontend/tests/components/ads/AdBanner.test.ts
git commit -m "feat(ads): AdBanner에 sizing=\"fixed\" prop 추가

상위·in-content 광고 슬롯에 명시 높이를 강제할 수 있는 sizing prop을 추가.
sizing=\"fixed\"일 때 <ins>에 명시 height + data-full-width-responsive=false를 적용해
AdSense가 min-height보다 큰 광고를 채울 때 발생하는 CLS를 제거한다.

sizing 미지정 시 기존 동작 유지 (비파괴).

Spec: docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md 섹션 4"
```

---

## Task 2: 시설 상세 페이지 상위 4 슬롯 fixed 전환

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (4 lines: 134, 149, 155, 163)

- [ ] **Step 2.1: 4 호출부를 한 번에 교체**

`frontend/pages/[category]/[id].vue`에서 빈 `<AdBanner />` 4개를 순서대로 교체. **`:190`와 `:259` 슬롯은 절대 변경하지 않는다.**

각 변경(주석은 그대로 두고 컴포넌트 줄만 교체):

```diff
              <!-- Ad: HERO 아래 -->
-              <AdBanner />
+              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

```diff
              <!-- Ad: BASIC INFO ↔ FACILITY STATUS 사이 -->
-              <AdBanner />
+              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

```diff
              <!-- Ad: DETAILS ↔ MAP 사이 -->
-              <AdBanner />
+              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

```diff
              <!-- Ad: ROADVIEW ↔ NEARBY 사이 -->
-              <AdBanner />
+              <AdBanner sizing="fixed" ad-format="rectangle" :fixed-height="280" />
```

- [ ] **Step 2.2: 변경 슬롯이 정확히 4개인지 sanity check**

```bash
cd frontend && grep -c 'sizing="fixed"' pages/\[category\]/\[id\].vue
```

Expected: `4`

```bash
cd frontend && grep -c '<AdBanner />' pages/\[category\]/\[id\].vue
```

Expected: `2` (변경 안 한 `:190, :259` 두 개만 남아야 함)

- [ ] **Step 2.3: Nuxt prepare + lint**

```bash
cd frontend && npx nuxt prepare && npm run lint
```

Expected: 0 error.

- [ ] **Step 2.4: 전체 vitest 회귀 확인**

```bash
cd frontend && npm run test
```

Expected: 모든 테스트 PASS.

- [ ] **Step 2.5: Commit**

```bash
git add frontend/pages/\[category\]/\[id\].vue
git commit -m "feat(ads): 시설 상세 상위 4 광고 슬롯을 fixed 280px로 전환

pages/[category]/[id].vue:134, 149, 155, 163 (Hero 아래, BasicInfo 사이,
Details 사이, Roadview 사이) 4개 슬롯이 viewport 안에서 발생시키던 CLS를 제거.

Nearby 이후(:190)와 desktop sidebar(:259) 슬롯은 fold-below라 변경 없음."
```

---

## Task 3: `.ad-banner--auto` 모바일 min-height 280px 통일

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue` (style 블록)

- [ ] **Step 3.1: CSS 블록 변경**

`<style>` 안의 모바일 media query에서 250을 280으로:

```diff
 @media (max-width: 767px) {
   .ad-banner--auto {
-    min-height: 250px;
+    min-height: 280px;
   }
 }
```

데스크탑 `.ad-banner--auto { min-height: 100px }`는 그대로 둔다. `.ad-banner--rectangle`(min 250)도 그대로 — 본 Phase는 호출부에서 `sizing="fixed"`로 직접 높이를 박기 때문에 부모 min-height에 의존하지 않음.

- [ ] **Step 3.2: vitest 회귀 확인**

```bash
cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts
```

Expected: PASS.

- [ ] **Step 3.3: Commit**

```bash
git add frontend/components/ads/AdBanner.vue
git commit -m "style(ads): .ad-banner--auto 모바일 min-height를 280으로 통일

fixed 280px 슬롯과 동일한 높이로 맞춰, 'auto' 잔여 슬롯(:190, :259)이
모바일에서 채울 때의 점프 폭을 0으로 만든다."
```

---

## Task 4: Playwright E2E — CLS 메트릭 측정

**Files:**
- Create: `frontend/tests/e2e/ad-cls.spec.ts`

- [ ] **Step 4.1: 신규 E2E spec 파일 작성**

`frontend/tests/e2e/ad-cls.spec.ts` 생성:

```ts
import { expect, test } from '@playwright/test'

// API에서 실제 parking 시설 1건 ID를 얻어 deterministic 테스트.
// 시드 데이터에 의존하지 않고, 현재 DB에서 가장 첫 시설을 사용.
async function getParkingId(request: import('@playwright/test').APIRequestContext) {
  const res = await request.get('/api/facilities/parking?limit=1')
  if (!res.ok()) throw new Error(`parking 시설 조회 실패: ${res.status()}`)
  const body = await res.json() as { success: boolean; data: { items: { id: string }[] } }
  const first = body?.data?.items?.[0]
  if (!first?.id) throw new Error('parking 시설이 DB에 없습니다 (시드 또는 sync 필요)')
  return first.id
}

test('시설 상세 페이지의 누적 CLS가 0.05 미만이다', async ({ page, request }) => {
  const id = await getParkingId(request)
  await page.goto(`/parking/${id}`, { waitUntil: 'networkidle' })

  const cls = await page.evaluate(() => new Promise<number>((resolve) => {
    let total = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as unknown as Array<{ value: number; hadRecentInput: boolean }>) {
        if (!entry.hadRecentInput) total += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
    // 광고가 늦게 들어와 발생하는 shift까지 5초 관측
    setTimeout(() => resolve(total), 5000)
  }))

  expect(cls).toBeLessThan(0.05)
})

test('상위 4 광고 슬롯의 ins 높이가 280px로 고정되어 있다', async ({ page, request }) => {
  const id = await getParkingId(request)
  await page.goto(`/parking/${id}`, { waitUntil: 'networkidle' })

  const heights = await page.locator('ins.adsbygoogle').evaluateAll((els) =>
    els.map((el) => (el as HTMLElement).style.height).filter((h) => h)
  )
  // fixed 슬롯 4개는 인라인 height:280px를 가져야 함. 비fixed 슬롯은 인라인 height 없음.
  const fixed280 = heights.filter((h) => h === '280px')
  expect(fixed280.length).toBe(4)
})
```

- [ ] **Step 4.2: dev 서버가 떠 있는지 확인 (playwright는 webServer로 자동 기동, 미설정이면 수동)**

```bash
cd frontend && cat playwright.config.ts | grep -i 'webServer\|baseURL'
```

`webServer` 설정이 없거나 `npm run dev`가 별도 필요하면 백엔드(`cd backend && npm run dev`)와 프론트엔드(`cd frontend && npm run dev`)를 각각 백그라운드로 띄운다. `webServer`가 자동으로 띄우면 다음 step으로.

- [ ] **Step 4.3: E2E 실행**

```bash
cd frontend && npx playwright test tests/e2e/ad-cls.spec.ts --reporter=list
```

Expected: 2 케이스 PASS.

- [ ] **Step 4.4: Flaky 가능성 — 1회 retry 허용**

만약 CLS 케이스가 0.05를 살짝 넘으면(0.06~0.08):
1. `data-adtest="on"`이 dev에서 적용되어 일관된 크기의 테스트 광고가 들어오는지 AdBanner.vue:32 라인으로 확인
2. `setTimeout` 5000을 7000으로 늘려 재실행
3. 그래도 fail이면 결과를 그대로 보고 spec 임계 재검토 필요 — 본 plan의 GO/NO-GO 결정 포인트

- [ ] **Step 4.5: Commit**

```bash
git add frontend/tests/e2e/ad-cls.spec.ts
git commit -m "test(ads): Playwright로 시설 상세 페이지 CLS 회귀 방지

- 누적 CLS < 0.05 단언
- 상위 4 fixed 슬롯의 ins 높이가 280px인지 단언

API에서 parking 시설 1건을 동적 조회하여 시드 데이터 의존성 없음."
```

---

## Task 5: PR 준비

- [ ] **Step 5.1: 전체 회귀 한 번 더**

```bash
cd backend && npm run lint && npm run test
cd ../frontend && npm run lint && npm run test
```

Expected: 모두 PASS, lint 0 error.

- [ ] **Step 5.2: Commit 그래프 확인 (4 commit이어야 함)**

```bash
git log --oneline develop..HEAD
```

Expected (역순):
```
<sha> test(ads): Playwright로 시설 상세 페이지 CLS 회귀 방지
<sha> style(ads): .ad-banner--auto 모바일 min-height를 280으로 통일
<sha> feat(ads): 시설 상세 상위 4 광고 슬롯을 fixed 280px로 전환
<sha> feat(ads): AdBanner에 sizing="fixed" prop 추가
```

- [ ] **Step 5.3: Push + PR 생성**

```bash
git push -u origin HEAD
gh pr create --base develop --title "feat(ads): 상위 4 광고 슬롯 fixed-height로 CLS 제거 (Phase 1)" --body "$(cat <<'EOF'
## 요약

시설 상세 페이지(`pages/[category]/[id].vue`)의 상위 4 광고 슬롯에 `sizing="fixed" ad-format="rectangle" :fixed-height="280"`을 적용해 AdSense가 min-height보다 큰 광고를 채울 때 발생하던 CLS를 제거한다.

Spec: `docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md` 섹션 4 (로컬 spec, gitignored)

## 변경 범위

- `AdBanner.vue`: `sizing`/`fixedHeight` prop 추가 (비파괴, default `'min'`은 기존 동작)
- `pages/[category]/[id].vue:134, 149, 155, 163`: 상위 4 슬롯만 fixed 적용
- `.ad-banner--auto` 모바일 min-height 250 → 280 통일
- Vitest 2건 + Playwright 2건 신규

## 변경하지 않은 것

- 광고 슬롯 수·위치 (memory: `feedback_adbanner_placement`)
- `pages/[category]/[id].vue:190, :259` (fold-below 슬롯)
- `index.vue` 광고 3개 (후속 검토)
- 부동산 URL·라우트·사이트맵
- 새 컴포넌트/composable

## 측정 게이트 (머지 후)

| 시점 | 지표 | 임계 |
|---|---|---|
| 머지 직후 | PSI Lab CLS | 시설 상세 < 0.05 |
| 24h | AdSense 페이지 RPM | -5% 이내 |
| 7일 | CrUX p75 CLS (시설 상세) | < 0.10 (Phase 2 GO 조건) |

## 롤백

`git revert <merge-sha>` 또는 4 호출부에서 prop 제거. 단일 revert로 완전 환원.
EOF
)"
```

- [ ] **Step 5.4: CI 통과 대기**

GitHub Actions가 Test 워크플로우(backend + frontend lint·test·build)를 통과할 때까지 대기. 실패 시 CI 로그 확인 후 수정.

- [ ] **Step 5.5: 머지 (CI 통과 + 사용자 승인 후)**

CI 통과를 확인하고 사용자 승인 후 머지. **머지 직후 PSI Lab CLS 측정으로 측정 게이트를 시작한다.**

---

## Self-Review 체크리스트 (실행자가 PR 올리기 전 마지막 점검)

- [ ] Spec 4.2 변경 항목 4개(AdBanner prop / 호출부 / min-height / 테스트)가 각 Task에 대응되는가
- [ ] Spec 4.3 슬롯 분류 4개 줄(134, 149, 155, 163)이 모두 변경됐는가
- [ ] Spec 4.5 테스트 케이스(Vitest 2건 + Playwright 1건)가 모두 작성됐는가 — Playwright는 안전망 차원에서 2건으로 늘림
- [ ] `:190, :259` 슬롯은 절대 손대지 않았는가
- [ ] 새 추상화(별도 컴포넌트, 새 composable, 새 라이브러리) 추가 없는가
- [ ] AdSense `data-adtest` dev mode 자동 적용 로직(AdBanner.vue:32) 변경 없는가
- [ ] Commit 4개로 분해됐는가
- [ ] backend·frontend lint + test 모두 PASS인가
