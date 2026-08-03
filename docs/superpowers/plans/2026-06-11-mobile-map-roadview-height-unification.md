# 모바일 지도/로드뷰 높이 통일 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전 상세페이지(시설·지하철·부동산·청약·공매)에서 모바일 지도뷰와 로드뷰 높이를 220px 단일 표준으로 통일하고, 단일 상수로 중앙화해 재발을 막는다.

**Architecture:** (1) `FacilityRoadview`가 자기 높이를 하드코딩하던 것을 `h-full`로 바꿔 "높이는 부모가 결정"하게 만들고, (2) 모바일/데스크톱 표준 높이를 `utils/mapMedia.ts`의 단일 상수(`h-[220px] md:h-[300px]`)로 export해 모든 렌더 지점이 같은 값을 참조한다. 데스크톱(300px)은 이미 일치하므로 불변, 모바일만 220px로 수렴.

**Tech Stack:** Nuxt 3 / Vue 3 / TailwindCSS(JIT, arbitrary values) / Vitest(happy-dom) / @vue/test-utils

**작업 규칙:** Node 20 (`nvm use 20`). PR 기반, develop 대상, main 직접 커밋 금지. 모든 명령은 `frontend/`에서 실행.

**참고:** Tailwind `content` 글롭에 `./utils/**/*.{js,ts}` 가 이미 포함됨(`frontend/tailwind.config` 확인 완료) → 상수 파일의 `h-[220px]`/`md:h-[300px]` 클래스가 JIT로 정상 생성됨. config 변경 불필요.

**스펙:** `docs/superpowers/specs/2026-06-11-mobile-map-roadview-height-unification-design.md`

---

## File Structure

- **Create** `frontend/utils/mapMedia.ts` — 상세페이지 지도·로드뷰 공통 높이 상수 (단일 소스)
- **Create** `frontend/tests/utils/mapMedia.test.ts` — 상수 회귀 가드
- **Modify** `frontend/components/facility/FacilityRoadview.vue` — 하드코딩 높이 → `h-full`
- **Create** `frontend/tests/components/facility/FacilityRoadview.test.ts` — `h-full` 회귀 가드
- **Modify** `frontend/pages/[category]/[id].vue` — 모바일 로드뷰에 높이 래퍼 신설
- **Modify** `frontend/pages/subway/[slug].vue` — 모바일 로드뷰에 높이 래퍼 신설
- **Modify** `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — 로드뷰 래퍼 모바일 200→220
- **Modify** `frontend/pages/subscription/[id].vue` — 모바일 히어로 지도 240→220, 모바일 로드뷰 200→220
- **Modify** `frontend/components/auction/AuctionMap.vue` — 지도·로드뷰 모바일 200→220
- **Modify** `frontend/tests/components/auction/AuctionMap.test.ts` — 래퍼 높이 클래스 가드 추가

---

## Task 1: 공유 높이 상수

**Files:**
- Create: `frontend/utils/mapMedia.ts`
- Test: `frontend/tests/utils/mapMedia.test.ts`

- [ ] **Step 1: Write the failing test**

`frontend/tests/utils/mapMedia.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'

describe('DETAIL_MAP_MEDIA_HEIGHT — 상세페이지 지도·로드뷰 공통 높이', () => {
  it('모바일 220px / 데스크톱 300px 클래스를 반환', () => {
    expect(DETAIL_MAP_MEDIA_HEIGHT).toBe('h-[220px] md:h-[300px]')
  })

  it('모바일 220px 토큰을 포함 (회귀 가드)', () => {
    expect(DETAIL_MAP_MEDIA_HEIGHT).toContain('h-[220px]')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/utils/mapMedia.test.ts`
Expected: FAIL — `Failed to resolve import "~/utils/mapMedia"` (파일 없음)

- [ ] **Step 3: Write the constant**

`frontend/utils/mapMedia.ts`:

```ts
/** 상세페이지 지도·로드뷰 공통 높이 (모바일 220 / 데스크톱 300). 단일 소스 — 높이 조정은 여기만 수정. */
export const DETAIL_MAP_MEDIA_HEIGHT = 'h-[220px] md:h-[300px]'
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/utils/mapMedia.test.ts`
Expected: PASS (2 passed)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add utils/mapMedia.ts tests/utils/mapMedia.test.ts
git commit -m "feat(frontend): 상세페이지 지도/로드뷰 공통 높이 상수 추가"
```

---

## Task 2: FacilityRoadview를 부모 채움(h-full)으로

`FacilityRoadview`가 자기 높이(`h-[200px] md:h-[240px]`)를 강제하던 것을 제거해, 부모 래퍼 높이를 따르게 한다.

**Files:**
- Modify: `frontend/components/facility/FacilityRoadview.vue:3`
- Test: `frontend/tests/components/facility/FacilityRoadview.test.ts`

- [ ] **Step 1: Write the failing test**

`frontend/tests/components/facility/FacilityRoadview.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityRoadview from '~/components/facility/FacilityRoadview.vue'

// useKakaoMap.initRoadview 는 부르지 않도록 stub (watch 트리거 전 마크업만 검증)
vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({ initRoadview: vi.fn() }),
}))

const stubs = { ClientOnly: { template: '<div><slot /></div>' } }

describe('FacilityRoadview — 높이는 부모가 결정', () => {
  it('외곽 컨테이너는 h-full 이며 자기 높이를 강제하지 않는다', () => {
    const w = mount(FacilityRoadview, { props: { lat: 37.5, lng: 127.0 }, global: { stubs } })
    const outer = w.find('div.relative')
    expect(outer.classes()).toContain('h-full')
    expect(outer.classes()).not.toContain('h-[200px]')
    expect(outer.classes()).not.toContain('md:h-[240px]')
  })
})
```

> 참고: 파일 상단에 `import { vi } from 'vitest'` 가 필요하면 추가한다(이 프로젝트 vitest globals 설정에 따라 `vi`가 전역일 수 있음 — Step 2에서 실패 메시지로 확인).

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/facility/FacilityRoadview.test.ts`
Expected: FAIL — `expect(outer.classes()).toContain('h-full')` 실패 (현재는 `h-[200px] md:h-[240px]`).
만약 `vi is not defined` 에러면 테스트 상단에 `import { describe, it, expect, vi } from 'vitest'` 로 수정 후 재실행.

- [ ] **Step 3: Apply the change**

`frontend/components/facility/FacilityRoadview.vue` 3번째 줄:

```diff
-    <div class="relative w-full h-[200px] md:h-[240px] rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
+    <div class="relative w-full h-full rounded-xl border border-slate-200 overflow-hidden bg-slate-100">
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/facility/FacilityRoadview.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add components/facility/FacilityRoadview.vue tests/components/facility/FacilityRoadview.test.ts
git commit -m "refactor(frontend): FacilityRoadview 높이를 부모 결정(h-full)으로 전환"
```

---

## Task 3: 시설 상세 — 모바일 로드뷰 높이 래퍼 신설

Task 2로 `FacilityRoadview`가 `h-full`이 되었으므로, 높이 래퍼 없이 렌더되던 시설 상세 로드뷰는 0으로 무너진다. 모바일 표준 높이 래퍼로 감싼다. (래퍼는 **높이만** 부여 — `FacilityRoadview` 자체 `rounded-xl border-slate-200` 가 있어 이중 보더 방지.)

**Files:**
- Modify: `frontend/pages/[category]/[id].vue:157`

- [ ] **Step 1: Apply the change**

현재 (line 157):

```vue
                <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
```

변경 후 (모바일 전용 섹션이므로 모바일 높이만 의미 있음 → 220px):

```vue
                <div class="h-[220px]">
                  <FacilityRoadview :lat="facility.lat" :lng="facility.lng" />
                </div>
```

> 이 `SectionBlock`("위치·로드뷰")은 모바일 콘텐츠 플로우에 있고 데스크톱은 사이드바 지도를 쓴다. 로드뷰 래퍼는 모바일 높이(220px)만 부여하면 충분하다.

- [ ] **Step 2: Verify the edit landed**

Run: `cd frontend && grep -n 'h-\[220px\]' "pages/[category]/[id].vue"`
Expected: 모바일 지도 래퍼(line ~140)와 새 로드뷰 래퍼(line ~158) 두 곳에 `h-[220px]` 출현.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS (no new errors)

- [ ] **Step 4: Commit**

```bash
cd frontend && git add "pages/[category]/[id].vue"
git commit -m "fix(frontend): 시설 상세 모바일 로드뷰 높이 220px 통일"
```

---

## Task 4: 지하철 상세 — 모바일 로드뷰 높이 래퍼 신설

시설 상세와 동일 패턴(높이 래퍼 없이 렌더 → h-full 무너짐). 동일하게 220px 래퍼로 감싼다.

**Files:**
- Modify: `frontend/pages/subway/[slug].vue:156`

- [ ] **Step 1: Apply the change**

현재 (line 156):

```vue
                <FacilityRoadview :lat="station.lat" :lng="station.lng" />
```

변경 후:

```vue
                <div class="h-[220px]">
                  <FacilityRoadview :lat="station.lat" :lng="station.lng" />
                </div>
```

- [ ] **Step 2: Verify the edit landed**

Run: `cd frontend && grep -n 'h-\[220px\]' "pages/subway/[slug].vue"`
Expected: 모바일 지도 래퍼(line ~139)와 새 로드뷰 래퍼(line ~157) 두 곳에 `h-[220px]` 출현.

- [ ] **Step 3: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
cd frontend && git add "pages/subway/[slug].vue"
git commit -m "fix(frontend): 지하철 상세 모바일 로드뷰 높이 220px 통일"
```

---

## Task 5: 부동산 상세 — 지도·로드뷰 래퍼를 공통 상수로 바인딩

부동산은 지도/로드뷰가 `grid md:grid-cols-2`로 나란히. 지도는 `h-[220px] md:h-[300px]`, 로드뷰는 `h-[200px] md:h-[300px]`라 모바일 20px 어긋남. **두 래퍼 모두** `DETAIL_MAP_MEDIA_HEIGHT` 상수를 `:class`로 바인딩해, 같은 소스에서 높이가 나오도록 한다(향후 상수 변경 시 양쪽 동시 추종 → 재발 방지). Vue는 정적 `class`와 동적 `:class`를 병합하므로 나머지 스타일 클래스는 그대로 둔다. (`roadview-wrapper :deep()` 블록은 Task 2 이후 중복이지만 그대로 유지 — 무해.)

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:119,135` + script import

- [ ] **Step 1: Import the constant**

스크립트 `<script setup>` 영역에 import 추가(기존 import 근처, 예: `FacilityMap` defineAsyncComponent 선언 위/아래):

```ts
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'
```

- [ ] **Step 2: 지도 래퍼 바인딩 (line 119)**

현재:

```vue
          <div class="relative rounded-xl border border-line overflow-hidden h-[220px] md:h-[300px]">
```

변경 후 (높이 토큰을 상수 바인딩으로 이전):

```vue
          <div class="relative rounded-xl border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
```

- [ ] **Step 3: 로드뷰 래퍼 바인딩 (line 135)**

현재:

```vue
          <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
```

변경 후:

```vue
          <div class="roadview-wrapper rounded-xl border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
```

> 이제 지도·로드뷰가 단일 상수에서 모바일 220 / 데스크톱 300을 받아 완전 일치.

- [ ] **Step 4: Verify**

Run: `cd frontend && grep -n 'DETAIL_MAP_MEDIA_HEIGHT' "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"`
Expected: import 1곳 + 지도/로드뷰 래퍼 바인딩 2곳 = 총 3회 출현. 같은 파일에서 `h-\[200px\]` 가 지도/로드뷰 래퍼에 잔존하지 않음:
Run: `cd frontend && grep -n 'overflow-hidden h-\[' "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"`
Expected: 지도/로드뷰 래퍼에 인라인 `h-[...]` 잔존 없음.

- [ ] **Step 5: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
cd frontend && git add "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
git commit -m "fix(frontend): 부동산 상세 지도/로드뷰 높이를 공통 상수로 통일(모바일 220)"
```

---

## Task 6: 청약 상세 — 모바일 히어로 지도 240→220, 모바일 로드뷰 200→220

청약은 모바일 히어로 지도(`h-[240px]`)와 모바일 로드뷰(`h-[200px]`)가 40px 어긋남(최대 불일치). 둘 다 220px로 맞춘다. 데스크톱 사이드바(line 302/311, `h-[300px]`)는 이미 일치하므로 불변.

**Files:**
- Modify: `frontend/pages/subscription/[id].vue:5` (모바일 히어로 지도)
- Modify: `frontend/pages/subscription/[id].vue:319` (모바일 로드뷰)

- [ ] **Step 1: 모바일 히어로 지도 높이 변경**

현재 (line 5):

```vue
      <div v-if="hasCoords" class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200">
```

변경 후:

```vue
      <div v-if="hasCoords" class="md:hidden relative h-[220px] w-full overflow-hidden bg-gray-200">
```

- [ ] **Step 2: 모바일 로드뷰 높이 변경**

현재 (line 319):

```vue
          <div class="roadview-wrapper rounded-xl overflow-hidden h-[200px]">
```

변경 후:

```vue
          <div class="roadview-wrapper rounded-xl overflow-hidden h-[220px]">
```

- [ ] **Step 3: Verify edits landed**

Run: `cd frontend && grep -n 'h-\[240px\]\|h-\[200px\]' "pages/subscription/[id].vue"`
Expected: `h-[240px]`, `h-[200px]` 모두 **출현하지 않음**(다른 무관한 위치에 동일 토큰이 없는지 결과로 확인 — 있으면 위치 검토). `h-[220px]` 가 모바일 지도·로드뷰 두 곳에 존재하는지 추가 확인:
Run: `cd frontend && grep -n 'h-\[220px\]' "pages/subscription/[id].vue"`
Expected: 모바일 히어로 지도 + 모바일 로드뷰 두 곳.

- [ ] **Step 4: Lint**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
cd frontend && git add "pages/subscription/[id].vue"
git commit -m "fix(frontend): 청약 상세 모바일 지도/로드뷰 높이 220px 통일"
```

---

## Task 7: 공매 AuctionMap — 지도·로드뷰 모바일 200→220

공매는 지도/로드뷰가 모바일에서 서로 일치(200/200)하지만 표준값(220)과 다르다. 전 페이지 통일을 위해 220으로 올린다. 데스크톱 300은 유지.

**Files:**
- Modify: `frontend/components/auction/AuctionMap.vue:66,71`
- Test: `frontend/tests/components/auction/AuctionMap.test.ts`

- [ ] **Step 1: Write the failing test (래퍼 높이 가드 추가)**

`frontend/tests/components/auction/AuctionMap.test.ts` 의 `describe('AuctionMap', ...)` 블록 안에 아래 테스트를 추가:

```ts
  it('지도·로드뷰 래퍼는 모바일 220 / 데스크톱 300 높이로 통일', () => {
    const w = mountMap();
    const wrappers = w.findAll('.grid > div');
    expect(wrappers.length).toBe(2);
    wrappers.forEach((wrap) => {
      expect(wrap.classes()).toContain('h-[220px]');
      expect(wrap.classes()).toContain('md:h-[300px]');
      expect(wrap.classes()).not.toContain('h-[200px]');
    });
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/auction/AuctionMap.test.ts`
Expected: FAIL — 현재 래퍼는 `h-[200px] md:h-[300px]` 라 `toContain('h-[220px]')` 실패.

- [ ] **Step 3: Apply the change (공통 상수 바인딩)**

`frontend/components/auction/AuctionMap.vue` `<script setup>` 상단(기존 import 근처, 예: `FacilityRoadview` import 아래)에 추가:

```ts
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'
```

line 66 (지도 래퍼):

```diff
-      <div class="rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
+      <div class="rounded-xl border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
```

line 71 (로드뷰 래퍼):

```diff
-      <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[200px] md:h-[300px]">
+      <div class="roadview-wrapper rounded-xl border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
```

> Vue가 정적 `class` + 동적 `:class`를 병합 → 렌더 결과 클래스에 `h-[220px] md:h-[300px]` 포함. Step 1의 테스트(`toContain('h-[220px]')`)가 그대로 통과한다.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/auction/AuctionMap.test.ts`
Expected: PASS (기존 5개 + 신규 1개 = 6 passed)

- [ ] **Step 5: Commit**

```bash
cd frontend && git add components/auction/AuctionMap.vue tests/components/auction/AuctionMap.test.ts
git commit -m "fix(frontend): 공매 지도/로드뷰 모바일 높이 200→220 통일"
```

---

## Task 8: 전체 회귀 검증 + 수동 확인

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 프론트 테스트**

Run: `cd frontend && npm run test`
Expected: 전체 PASS (신규 mapMedia / FacilityRoadview / AuctionMap 테스트 포함, 기존 테스트 무회귀)

- [ ] **Step 2: 린트**

Run: `cd frontend && npm run lint`
Expected: PASS

- [ ] **Step 3: 잔존 불일치 토큰 스캔 (전 페이지)**

Run:
```bash
cd frontend && grep -rn 'h-\[200px\]\|h-\[240px\]' \
  "pages/[category]/[id].vue" "pages/subway/[slug].vue" \
  "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" \
  "pages/subscription/[id].vue" components/auction/AuctionMap.vue components/facility/FacilityRoadview.vue
```
Expected: 지도/로드뷰 래퍼에 `h-[200px]`/`h-[240px]` **잔존 없음**. (무관한 다른 UI 요소가 해당 토큰을 쓰면 결과에 나올 수 있으니 출현 라인이 지도/로드뷰가 아닌지 육안 확인.)

- [ ] **Step 4: 수동 모바일 검증 (dev 서버)**

Run: `cd frontend && npm run dev` 후 브라우저 모바일 뷰포트(375px)에서 각 상세 1건씩:
- 시설: `/toilet/<id>` — 지도 높이 == 로드뷰 높이(220px)
- 지하철: `/subway/<slug>` — 동일
- 부동산: `/real-estate/apt-sale/...` — 동일
- 청약: `/subscription/<id>` — 히어로 지도 == 로드뷰(220px)
- 공매: 공매 상세 — 지도 == 로드뷰(220px)

Expected: 5종 모두 지도뷰와 로드뷰 높이가 육안상 동일. 데스크톱(≥768px)은 기존과 픽셀 동일.

- [ ] **Step 5: PR 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit && git push -u origin <branch>
gh pr create --base develop --title "fix(frontend): 모바일 상세페이지 지도/로드뷰 높이 220px 통일" \
  --body "스펙: docs/superpowers/specs/2026-06-11-mobile-map-roadview-height-unification-design.md

- FacilityRoadview 높이를 부모 결정(h-full)으로 전환
- utils/mapMedia.ts 공통 높이 상수 도입
- 시설·지하철·부동산·청약·공매 모바일 지도=로드뷰 220px 통일 (데스크톱 불변)"
```

Expected: PR 생성, CI(Test 워크플로우) 트리거. CI green 확인 후 머지.

---

## Self-Review 결과

- **스펙 커버리지:** 변경 1(상수)=Task1, 변경 2(h-full)=Task2, 변경 3(5개 렌더 지점)=Task3~7, 보더/라운드 처리=Task3·4 노트, 테스트/검증=Task8. 데스크톱 불변·비범위 항목 준수. → 누락 없음.
- **플레이스홀더:** 없음. 모든 코드 스텝에 실제 diff/코드 포함.
- **타입/명명 일관성:** `DETAIL_MAP_MEDIA_HEIGHT` 상수명이 Task 1·5·7 일관. grid 매칭 페어(부동산·공매)는 `:class` 바인딩으로 단일 소스 추종 → 상수 변경 시 양쪽 동시 반영(재발 방지). 모바일 전용 단독 블록(시설·지하철 로드뷰, 청약 히어로/로드뷰)은 데스크톱 값(`md:h-[300px]`)이 무의미하므로 `h-[220px]` 리터럴 사용 — 이 220은 상수와 동일 모바일 표준값이며, 한 페이지 안에서 지도와 로드뷰가 같은 리터럴을 쓰므로 within-page 일치는 보장된다.
