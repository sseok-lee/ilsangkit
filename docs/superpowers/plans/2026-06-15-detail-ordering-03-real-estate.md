# [부동산 단지] 상세 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산 단지 상세 페이지(`pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`)의 **데스크톱 섹션 순서를 고유 콘텐츠 우선(SEO)으로 통일**한다. 현재 데스크톱은 위치(`md:order-4`) → 비중(`md:order-6`) → 시세추이(`md:order-7`) → 거래내역(`md:order-9`) 순으로 지도가 고유 콘텐츠보다 위에 있다. 이를 spec §4.3 / 결정 1에 맞춰 **시세추이(`md:order-4`) → 전·월세비중(`md:order-5`) → 거래내역(`md:order-6`) → 위치(`md:order-7~8`로 강등)** 로 재배치한다. 모바일은 **전·월세 비중을 `order-8` → `order-5`**(시세추이 직후)로 끌어올린다. 광고 6개 + 쿠팡 1개의 개수·"단 사이 끼임" 위치는 인접 콘텐츠의 order 값을 동반 부여해 보존한다.

**Architecture:** 이 페이지는 단일 flex 컨테이너(`<main class="... flex flex-col gap-3">`, 48행) 안에서 모든 섹션이 `order-N md:order-N` 클래스로 뷰포트별 순서를 분기한다. 데스크톱 좌/우 2컬럼 grid가 아니라 단일 컬럼 flex이므로 한 order 스케일이 전체에 적용된다(spec §3.3). 따라서 **템플릿 구조·마크업은 그대로 두고 각 `SectionBlock`/`AdBanner`의 `order-N md:order-N` 클래스 값만 교체**한다. 끝단 그룹(인근단지/주변생활/블로그/가이드/쿠팡/출처)은 이미 `order-12 md:order-12`를 공유하며 DOM 소스 순서가 곧 렌더 순서이므로(spec §3.3) 변경하지 않는다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom, TailwindCSS(JIT: order-1~12만 안전). 명령은 모두 `cd frontend` 기준, Node 20 (`nvm use 20`).

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` (§2 사다리, §3.2 광고 cadence, §3.3 order 컨벤션, §4.3 부동산, §5 내부배치, §6 결정 1)

**선행:** Foundation 플랜(공용 헤더)을 먼저 적용한다 — `docs/superpowers/plans/2026-06-15-detail-ordering-00-foundation.md`. Foundation Task 3에서 이 페이지의 `<MobileRealEstateHeader>`가 `<MobileDetailHeader>`(`~/components/common/MobileDetailHeader.vue`)로 교체된다. 본 플랜의 마크업 인용은 Foundation 적용 **후** 상태를 기준으로 한다(헤더 태그명만 다르고 `class`/`order`는 동일하게 유지됨). Foundation이 아직 적용되지 않았다면 본 플랜의 헤더 관련 인용에서 `<MobileDetailHeader>`를 현재의 `<MobileRealEstateHeader>`로 읽어도 무방하다(헤더 order는 변경하지 않음).

---

## 변경 매핑 (전체 한눈에)

> 단일 flex 컨테이너 기준. **mobile = `order-N`, desktop = `md:order-N`.** 굵게 = 이번에 바뀌는 값.

| # | 섹션 (행번호) | 현재 mobile | 현재 desktop | → 목표 mobile | → 목표 desktop |
|---|---|---|---|---|---|
| 1 | Breadcrumb+공유 (50) | 1 | 1 | 1 | 1 |
| 2 | Hero (모바일헤더/PageHero) (63·73) | 2 | 2 | 2 | 2 |
| 3 | Ad① hero 직후 (83) | 3 | 3 | 3 | 3 |
| 4 | 위치·로드뷰 (86) | 9 | **4** | 9 | **7** |
| 5 | Ad② 위치 직후 (143) | 10 | **5** | 10 | **8** |
| 6 | 전·월세 비중 (rent) (146) | **8** | **6** | **5** | **5** |
| 7 | 시세 추이 (156) | 4 | **7** | 4 | **4** |
| 8 | Ad③ (257) | 5 | **8** | 5 | **5** ⚠ 충돌 |
| 9 | 거래 내역 (260) | 6 | **9** | 6 | **6** |
| 10 | Ad④ (286) | 7 | **10** | 7 | **6** ⚠ 충돌 |
| 11+ | 끝단 그룹 (291~393) | 12 | 12 | 12 | 12 |

⚠ **충돌 해소(중요):** 같은 컨테이너 안에서 정수 order 중복은 "DOM 소스 순서"로 tie-break 되므로, 충돌이 생기는 곳은 **소스에서 광고를 인접 콘텐츠 바로 뒤에 두는 현재 DOM 위치를 유지**하면 의도대로 끼인다. 본 플랜은 정수 충돌을 피하기 위해 **광고에 인접 콘텐츠와 같은 order를 주지 않고, 콘텐츠 바로 뒤 정수를 부여**하는 방식으로 1~10 범위 안에서 모두 유일하게 배치한다(아래 "확정 order 표" 참조). 이렇게 하면 tie-break 의존 없이 결정적이다.

### 확정 order 표 (구현 기준 — 모두 유일값, 1~10 + 12)

소스 DOM 순서는 **바꾸지 않는다**(현재 행 순서 유지). order 클래스 값만 아래로 교체.

| 섹션 (현재 행) | 현재 class | → 새 class |
|---|---|---|
| 위치·로드뷰 (86) | `order-9 md:order-4` | `order-9 md:order-7` |
| Ad② (143) | `order-10 md:order-5` | `order-10 md:order-8` |
| 전·월세 비중 (146·148) | `order-8 md:order-6` | `order-5 md:order-5` |
| 시세 추이 (156) | `order-4 md:order-7` | `order-4 md:order-4` |
| Ad③ (257) | `order-5 md:order-8` | `order-5 md:order-6` |
| 거래 내역 (260) | `order-6 md:order-9` | `order-6 md:order-9` |
| Ad④ (286) | `order-7 md:order-10` | `order-7 md:order-10` |

**결과 렌더 순서 검산:**
- **데스크톱(md):** 1 Breadcrumb · 2 Hero · 3 Ad① · **4 시세추이** · **5 전·월세비중** · **6 Ad③** · **7 위치** · **8 Ad②** · 9 거래내역 · 10 Ad④ · 12 끝단그룹. → 시세추이↑ · 비중 직후 · 거래내역 · 위치 강등(7) 충족. 광고 6개 전부 단 사이 유지(Ad① 헤더직후 / Ad③ 비중-위치 사이 / Ad② 위치-거래내역 사이 / Ad④ 거래내역 뒤 / Ad⑤·⑥은 끝단 order-12 그룹 내 소스순서).
- **모바일(base):** 1 · 2 · 3 Ad① · **4 시세추이** · **5 전·월세비중** · 5 Ad③(동률→소스순서로 비중 뒤) · 6 거래내역 · 7 Ad④ · 9 위치 · 10 Ad② · 12 끝단그룹. → 비중이 시세추이 직후(목표) 충족. 모바일에서 Ad③(`order-5`)과 비중(`order-5`)이 동률이지만 DOM 소스 순서상 비중(146행) → Ad③(257행)이라 비중이 먼저 렌더됨(현행 모바일과 동일한 tie-break, 회귀 아님).

> **모바일 Ad③ 동률 주의:** 모바일에서 비중과 Ad③이 둘 다 `order-5`가 되지만, 비중 블록의 소스 위치(146행)가 Ad③(257행)보다 앞이라 비중이 먼저 온다. 광고가 비중 앞으로 끼어들지 않는다. 데스크톱은 비중 `md:order-5` / Ad③ `md:order-6`로 유일값이라 충돌 없음.

---

## Task 1: 회귀 가드 테스트 확장 (h1 단일 + 핵심 섹션 order 클래스)

**Files:**
- Modify: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts` (기존 h1 가드 재사용 + order 가드 신규 추가; 현재 182~195행 뒤에 describe 블록 추가)

기존 테스트에는 이미 "h1 정확히 1개"(182행) 가드가 있다. 이를 그대로 통과시키면서, **재배치 후 데스크톱 핵심 섹션의 `md:order-*` 클래스가 목표 값인지** 검증하는 가드를 추가한다. SectionBlock은 현재 stub(`{ template: '<section><slot /> ...' }`)이라 stub 루트(`<section>`)에 fall-through된 class를 검사할 수 있다.

- [ ] **Step 1: 실패하는 order 가드 테스트 추가**

`frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts` 의 마지막 `it(...)` 블록(219~235행 `indexable 조건...`) **뒤, 닫는 `})` 앞**에 아래를 추가한다:

```ts
  // ---------------- 섹션 재배치 회귀 가드 (spec §4.3 / 결정 1) ----------------
  // 데스크톤 사다리: 시세추이(md:order-4) → 전·월세비중(md:order-5) → Ad③(md:order-6)
  //                 → 위치(md:order-7) → Ad②(md:order-8) → 거래내역(md:order-9) → Ad④(md:order-10).
  // 모바일: 전·월세비중(order-5)이 시세추이(order-4) 직후로 승격.
  // SectionBlock stub의 루트 <section>에 class가 fall-through되므로 heading 텍스트로 섹션을 식별해 검사한다.
  function sectionByHeading(wrapper: any, headingText: string) {
    return wrapper.findAll('section').find((s: any) => s.text().includes(headingText))
  }

  it('시세 추이 섹션이 데스크톱 md:order-4 + 모바일 order-4 를 가진다', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    // currentTab=sale(기본): 시세 추이 heading 은 getTrendSectionTitle('sale')
    const sec = sectionByHeading(wrapper, '시세')
    expect(sec, '시세 추이 섹션이 렌더되어야 한다').toBeTruthy()
    expect(sec.classes()).toContain('md:order-4')
    expect(sec.classes()).toContain('order-4')
  })

  it('거래 내역 섹션이 데스크톱 md:order-9 를 가진다 (위치보다 아래는 아님: 위치는 md:order-7)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    const sec = sectionByHeading(wrapper, '거래')
    expect(sec, '거래 내역 섹션이 렌더되어야 한다').toBeTruthy()
    expect(sec.classes()).toContain('md:order-9')
    expect(sec.classes()).toContain('order-6')
  })

  it('재배치 후에도 h1 은 정확히 1개여야 한다 (단일 h1 불변식 재확인)', async () => {
    const m = await import('~/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.findAll('h1').length).toBe(1)
  })
```

> **참고:** 기본 탭이 `apt-sale`이므로 currentTab='sale' → 전·월세 비중 섹션은 `v-if="currentTab === 'rent' && rentRatioTotal > 0"`로 **렌더되지 않는다.** 따라서 비중 섹션의 order는 rent 탭 전용이라 sale 기반 단위 테스트로 직접 검증할 수 없다 — 비중 검증은 Step 본문 인라인 검산 + 수동 스모크(Task 3)로 커버한다. 시세추이/거래내역은 탭 무관 상시 렌더이므로 가드 가능하다. 거래 내역 heading은 `getTxSectionTitle('sale')`로 "거래"를 포함한다(현재 `:heading="getTxSectionTitle(currentTab)"`, 260행).

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts`

Expected: 신규 3개 중 최소 2개 FAIL —
- `시세 추이 섹션이 데스크톱 md:order-4 ...`: AssertionError `expected [ ...'md:order-7' ] to contain 'md:order-4'` (현재 시세추이는 `md:order-7`).
- `거래 내역 섹션이 데스크톱 md:order-9 ...`: `md:order-9`는 현재도 맞아 PASS할 수 있으나 `order-6`은 현재도 맞음 → 이 테스트는 회귀 방지용으로 통과 가능. (시세추이 테스트가 핵심 FAIL.)
- h1 테스트는 PASS(기존 불변식).

> 핵심 실패는 "시세 추이 md:order-4" — 현재 `md:order-7`이라 반드시 FAIL해야 한다. FAIL이 안 나면 대상 파일이 이미 변경된 것이므로 Task 2 before/after를 재확인.

- [ ] **Step 3: 커밋 (실패 테스트)**

```bash
cd frontend
git add tests/pages/real-estate/realEstateBuildingDetail.test.ts
git commit -m "test(real-estate): 단지상세 데스크톱 섹션 order 재배치 회귀 가드 추가 (실패)"
```

---

## Task 2: 데스크톱 order 재배치 (시세추이↑ · 위치↓ · 비중 인접)

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
  - 위치·로드뷰 SectionBlock: `:86`
  - Ad② AdBanner: `:143`
  - 전·월세 비중 SectionBlock: `:148`
  - 시세 추이 SectionBlock: `:156`
  - Ad③ AdBanner: `:257`
  - (거래 내역 `:260` / Ad④ `:286` 은 값 변경 없음 — 검산용)
- Test: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`

> DOM 소스 순서는 절대 바꾸지 않는다. `order-*` 클래스 문자열만 교체한다. 광고 `AdBanner`/`CoupangBanner`는 추가·삭제하지 않는다(현 6 AdBanner + 1 CoupangBanner 유지).

- [ ] **Step 1: 위치·로드뷰 데스크톱 강등 (`md:order-4` → `md:order-7`)**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:86`

변경 전:
```vue
      <SectionBlock v-if="buildingInfo?.lat && buildingInfo?.lng" class="order-9 md:order-4" heading="위치와 로드뷰" subtext="지도와 로드뷰로 건물 주변을 바로 확인할 수 있습니다.">
```

변경 후:
```vue
      <SectionBlock v-if="buildingInfo?.lat && buildingInfo?.lng" class="order-9 md:order-7" heading="위치와 로드뷰" subtext="지도와 로드뷰로 건물 주변을 바로 확인할 수 있습니다.">
```

- [ ] **Step 2: Ad② 위치 동반 이동 (`md:order-5` → `md:order-8`)**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:143` (위치 섹션 직후 광고 — 데스크톱에서 위치-거래내역 사이에 끼이도록 위치 뒤 정수)

변경 전:
```vue
      <!-- Ad: 로드뷰 이후 -->
      <AdBanner class="order-10 md:order-5" />
```

변경 후:
```vue
      <!-- Ad: 로드뷰 이후 (데스크톱은 위치(md:order-7)와 거래내역(md:order-9) 사이) -->
      <AdBanner class="order-10 md:order-8" />
```

- [ ] **Step 3: 전·월세 비중 — 데스크톱·모바일 모두 시세추이 직후로 승격 (`order-8 md:order-6` → `order-5 md:order-5`)**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:146-148`

변경 전:
```vue
      <!-- "전·월세 거래 비중" 블록 (rent 전용) -->
      <SectionBlock
        v-if="currentTab === 'rent' && rentRatioTotal > 0"
        class="order-8 md:order-6"
        heading="전·월세 거래 비중"
        subtext="전체 거래의 전세·월세 구성입니다."
      >
```

변경 후:
```vue
      <!-- "전·월세 거래 비중" 블록 (rent 전용) — 시세추이(order-4) 직후로 승격 -->
      <SectionBlock
        v-if="currentTab === 'rent' && rentRatioTotal > 0"
        class="order-5 md:order-5"
        heading="전·월세 거래 비중"
        subtext="전체 거래의 전세·월세 구성입니다."
      >
```

- [ ] **Step 4: 시세 추이 데스크톱 상향 (`md:order-7` → `md:order-4`)**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:156`

변경 전:
```vue
      <!-- "시세 추이" 블록 -->
      <SectionBlock class="order-4 md:order-7" :heading="getTrendSectionTitle(currentTab)" subtext="매매·전월세 탭과 기간별 추이로 가격 흐름을 비교합니다.">
```

변경 후:
```vue
      <!-- "시세 추이" 블록 — T1 고유 콘텐츠: 데스크톱·모바일 모두 헤더 광고 직후 최상단(order-4) -->
      <SectionBlock class="order-4 md:order-4" :heading="getTrendSectionTitle(currentTab)" subtext="매매·전월세 탭과 기간별 추이로 가격 흐름을 비교합니다.">
```

- [ ] **Step 5: Ad③ 데스크톱 cadence 정렬 (`md:order-8` → `md:order-6`)**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:257` (시세추이↔거래내역 사이 광고 — 데스크톱에서 비중(md:order-5) 뒤·위치(md:order-7) 앞에 끼이도록)

변경 전:
```vue
      <!-- Ad: 시세 추이 ↔ 거래 내역 사이 -->
      <AdBanner class="order-5 md:order-8" />
```

변경 후:
```vue
      <!-- Ad: 시세 추이/비중 ↔ 위치 사이 (데스크톱 md:order-6, 모바일 order-5는 비중 뒤로 tie-break) -->
      <AdBanner class="order-5 md:order-6" />
```

- [ ] **Step 6: 거래 내역(`:260`) / Ad④(`:286`) 무변경 확인**

`:260` 은 `class="order-6 md:order-9"`, `:286` 은 `class="order-7 md:order-10"` 그대로 유지한다. 변경하지 않는다(목표 표와 일치). 끝단 그룹(`:291`~`:393`)의 `order-12 md:order-12`도 변경하지 않는다. grep으로 확인:

```bash
cd frontend && grep -n 'order-6 md:order-9\|order-7 md:order-10\|order-12 md:order-12' "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" | head
```
Expected: `order-6 md:order-9`(거래내역 1개), `order-7 md:order-10`(Ad④ 1개), `order-12 md:order-12`(끝단 그룹 다수) 그대로 존재.

- [ ] **Step 7: 테스트 실행 → 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts`

Expected: PASS (전체) — 특히
- `시세 추이 섹션이 데스크톱 md:order-4 + 모바일 order-4` PASS,
- `거래 내역 섹션이 데스크톱 md:order-9` PASS,
- `h1 정확히 1개` PASS (기존 + 신규 재확인),
- breadcrumb/canonical 등 기존 11개 PASS 유지.

- [ ] **Step 8: 광고 개수 불변 확인 (회귀 가드)**

```bash
cd frontend && grep -c '<AdBanner' "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
grep -c '<CoupangBanner' "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
```
Expected: `6` (AdBanner), `1` (CoupangBanner) — 재배치 전후 동일(추가·삭제 없음).

- [ ] **Step 9: 커밋**

```bash
cd frontend
git add "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" tests/pages/real-estate/realEstateBuildingDetail.test.ts
git commit -m "feat(real-estate): 단지상세 데스크톱 시세추이↑·위치↓ 재배치 + 모바일 전월세비중 승격 (spec §4.3)"
```

---

## Task 3: 수동 스모크 검증 (rent 탭 비중 위치 + 콘솔 에러 + 광고 cadence)

단위 테스트는 sale 탭만 커버하므로(비중 섹션은 rent 전용 `v-if`), rent 탭의 비중 위치와 양 뷰포트 렌더를 수동 확인한다.

**Files:** (변경 없음 — 검증만)

- [ ] **Step 1: Nitro route cache 삭제 후 dev 서버 기동**

spec §3.3 / §8: SSR 응답 s-maxage로 인해 `.nuxt/cache/nitro/routes`에 stale 파일이 남으면 재배치가 반영 안 됨.

```bash
cd frontend && rm -rf .nuxt/cache/nitro/routes && nvm use 20 && npm run dev
```

- [ ] **Step 2: rent 탭 데스크톱 순서 육안 확인**

브라우저에서 전월세 데이터가 있는 단지의 rent URL(예: `/real-estate/apt-rent/seoul/gangnam/<단지명>`) 열고 데스크톱 폭(≥768px)에서 위→아래 순서 확인:
- 헤더 → Ad① → **시세 추이** → **전·월세 거래 비중** → Ad③ → **위치와 로드뷰** → Ad② → 거래 내역 → Ad④ → 인근/주변/블로그/가이드/쿠팡/출처.

Expected: 시세추이가 위치보다 위, 비중이 시세추이 바로 아래, 위치가 거래내역보다 위(md:order-7 < 9). 광고 6개가 단 사이에 그대로.

- [ ] **Step 3: 모바일 폭(<768px) 순서 확인**

DevTools 모바일 뷰(예: 390px)에서:
- 헤더 → Ad① → **시세 추이** → **전·월세 거래 비중** → Ad③ → 거래 내역 → Ad④ → 위치 → Ad② → 끝단그룹.

Expected: 비중이 시세추이 직후(order-5). 광고가 비중 **앞으로** 끼어들지 않음(소스순서 tie-break).

- [ ] **Step 4: 콘솔 에러 0 + h1 1개 확인**

DevTools Console에 에러 없음. Console에서 `document.querySelectorAll('h1').length` 입력 → **1** 반환(데스크톱은 PageHero `title-tag="div"`로 강등, 모바일 헤더가 literal h1). hydration mismatch 경고 없음.

- [ ] **Step 5: 검증 메모 (커밋 불필요)**

스모크 결과(순서·콘솔·h1 count)를 PR 설명에 기록. 코드 변경 없음.

---

## Self-Review

**Spec §4.3 / 결정 1 커버 여부:**
- ✅ "위치를 `md:order-4` → `md:order-7~8`로 강등" — 위치 SectionBlock `md:order-4` → **`md:order-7`** (Task 2 Step 1). 인접 Ad②는 `md:order-8`로 동반 이동(Step 2)해 위치-거래내역 사이 끼임 유지.
- ✅ "시세추이를 `md:order-7` → `md:order-4`로 상향" — Task 2 Step 4.
- ✅ "거래내역 `md:order-9`" — 현행 유지(목표값과 일치, Step 6 검산). 위치(7)보다 아래·시세추이(4)/비중(5) 다음.
- ✅ "모바일: 전·월세 비중을 order-8 → order-5(시세추이 직후)" — Task 2 Step 3 (`order-8 md:order-6` → `order-5 md:order-5`).
- ✅ "끝단(인근/주변/블로그/가이드/쿠팡/출처) order-12 공유 유지, 소스 순서로 의도순 보장" — 변경 안 함(Step 6 검산). 현재 소스순서 인근(291)→주변(366)→블로그(379)→가이드(386)→쿠팡(389)→출처(393).
- ✅ "AdBanner 인접 콘텐츠 order 동반 부여로 단 사이 유지(6개+쿠팡1 불변)" — Ad②(md:order-8)·Ad③(md:order-6) 동반 이동, Ad①·④ 무변경. 개수 가드 Task 2 Step 8 (`grep -c` = 6, 1).
- ✅ "헤더는 Foundation에서 교체됨" — 본 플랜은 헤더 order(`order-2 md:order-2`) 무변경, 선행 명시.

**플레이스홀더 스캔:** "적절히/TODO/위와 유사" 없음. 모든 재배치는 실제 before→after 코드 블록(line-anchored) 제시. order 값은 "확정 order 표"에서 전부 유일값(1~10 + 12)으로 결정적.

**타입/prop 일관성:** 본 플랜은 `class` 문자열(order-N)만 교체 — props·emits·script 변경 없음. 헤더 props는 Foundation에서 이미 호환 검증됨(`title`/`eyebrow`/`stats`/`kakao-map-url`/`naver-map-url`/`@share`/`@directions`). SectionBlock/AdBanner/CoupangBanner는 class fall-through 단일 루트라 wrapper div 불필요(DataSourceSection만 멀티루트 wrapper div에 order, 393행 — 변경 안 함).

**JIT 안전성:** 사용 order 값 = {1,2,3,4,5,6,7,8,9,10,12} 전부 1~12 범위(spec §3.3). 13+ 없음.

**리스크/주의:**
- 모바일 Ad③(`order-5`)이 비중(`order-5`)과 동률 → 소스순서(비중 146행 < Ad③ 257행)로 비중 우선. 데스크톱은 비중 md:order-5 / Ad③ md:order-6 유일값이라 무충돌. 수동 스모크 Task 3 Step 3로 확인.
- 비중 섹션은 rent 탭 + `rentRatioTotal>0`에서만 렌더 → sale 단위 테스트로 직접 order 검증 불가, Task 3 수동 스모크로 보완(가드는 시세추이·거래내역으로 한정).
- Nitro route cache stale: Task 3 Step 1에서 `.nuxt/cache/nitro/routes` 삭제 필수.
- v-if 조건부 섹션(위치=좌표 없으면 빠짐, 비중=sale이면 빠짐) → 광고 연속 노출 가능하나 기존과 동일(spec §8, 회귀 아님).
