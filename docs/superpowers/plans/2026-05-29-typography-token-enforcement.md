# 타이포그래피 토큰 강제(2차 PR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** display-2 토큰을 코드베이스 실제 스케일(18px·700)로 재정의하고, size/weight가 정확히 일치하는 섹션/서브 제목 ~23곳을 display 토큰으로 무손실 채택하며, `text-primary-600`을 `text-primary`로 dedup한다.

**Architecture:** 시각적 무손실이 핵심. display-2 토큰 재정의(1개 CSS 편집) → 정확 매칭 제목에만 토큰 클래스 적용(per-element class 스왑, 구조 변경 없음) → text-primary-600 순수 dedup. 안전망은 기존 vitest 스위트 green 유지 + grep 불변식 + Playwright 시각 스폿체크. eyebrow는 정확 매칭이 0이라 채택하지 않는다.

**Tech Stack:** Nuxt 3, Vue 3, TailwindCSS v3, Vitest, ESLint. Node 20 (`nvm use 20`).

**Branch:** `refactor/typography-token-enforcement` (develop 기반 신규 생성). 작업 디렉토리: `frontend/`.

**Spec:** `docs/superpowers/specs/2026-05-29-typography-token-enforcement-design.md` (로컬).

---

## File Structure

- **Modify (토큰):** `frontend/assets/css/main.css` — `.text-display-2` 정의 + 해당 @media 블록.
- **Modify (제목 채택):** display-2 13개 파일(16 elements) + display-3 5개 파일(7 elements). class 문자열만 스왑.
- **Modify (색 dedup):** `pages/contact.vue`, `pages/privacy.vue`, `pages/about.vue`, `components/common/AppFooter.vue`.
- 새 파일 없음. 구조/props/slot 변경 없음.

---

## 사전 준비 (공통)

- [ ] **브랜치 생성 (develop 기반)**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull --ff-only origin develop
git checkout -b refactor/typography-token-enforcement
node -v   # v20.x 확인, 아니면 nvm use 20
```

- [ ] **베이스라인 테스트 green 확인**

Run: `cd frontend && npm run test`
Expected: 기존 스위트 PASS (1차 PR 머지 후 기준선). 실패가 있으면 기록만 하고 진행.

---

## Task 1: display-2 토큰 재정의 (18px flat·700)

**Files:**
- Modify: `frontend/assets/css/main.css`

- [ ] **Step 1: `.text-display-2` 정의 + @media 블록 교체**

`frontend/assets/css/main.css`에서 아래 블록을 찾아 교체.

변경 전:
```css
  .text-display-2 {
    font-size: 1.25rem; /* 20px mobile */
    line-height: 1.25;
    font-weight: 700;
    letter-spacing: -0.015em;
  }
  @media (min-width: 768px) {
    .text-display-2 { font-size: 1.5rem; /* 24px desktop */ }
  }
```
변경 후:
```css
  .text-display-2 {
    font-size: 1.125rem; /* 18px flat — 코드베이스 실제 섹션 H2 스케일 */
    line-height: 1.3;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
```
(display-2 전용 `@media` 블록은 제거. display-1·display-3의 @media 블록은 건드리지 말 것.)

- [ ] **Step 2: 빌드로 CSS 컴파일 확인**

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: `Build complete!` (성공).

- [ ] **Step 3: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/assets/css/main.css
git commit -m "refactor(ui): display-2 토큰을 실제 18px 스케일로 재정의

20/24px를 코드베이스 지배 섹션 H2 스케일(18px flat·700)로 맞춤.
display-2는 마크업 미사용이라 부작용 없음. 다음 커밋에서 채택."
```

---

## Task 2: 섹션·서브 제목 토큰 채택 (무손실)

**Files (display-2, 16 elements / 13 files):**
- `pages/index.vue:111,134,156`, `pages/[city]/index.vue:30,54`, `pages/faq.vue:13,41`,
  `components/category/CategoryIntro.vue:3`, `components/common/DataSourceCard.vue:5`,
  `components/guide/RelatedGuides.vue:4`, `components/home/HomeHotspotSignals.vue:9`,
  `components/home/HomeMarketStats.vue:5`, `components/home/HomeTrendingBuildings.vue:5`,
  `components/region/DistrictSummaryCard.vue:9`, `components/region/RegionFacilityCategoryGrid.vue:3`,
  `components/region/RegionRealEstatePrices.vue:3`, `components/subscription/HomeSubscriptionSection.vue:5`

**Files (display-3, 7 elements / 5 files):**
- `components/region/RegionRealEstateCta.vue:3`, `pages/real-estate/[realEstateType]/[city]/index.vue:14`,
  `pages/real-estate/[realEstateType]/index.vue:127`, `pages/real-estate/index.vue:13,23,39`,
  `pages/subscription/index.vue:13`

**변환 규칙 (구조·기타 클래스 보존, 타이포 클래스만 스왑):**
- display-2 대상: 각 `<h2>` class에서 `text-lg font-bold` → `text-display-2`. 나머지 클래스(text-slate-900, flex, gap, mb-3 등) 그대로.
- display-3 대상: 각 heading class에서 `text-base md:text-lg font-bold` → `text-display-3`, 그리고 **`leading-tight` 제거**(토큰이 line-height 소유). 나머지 보존.

라인 번호는 Task 1 커밋 시점 기준 근사치 — 내용으로 찾을 것.

- [ ] **Step 1: display-2 16곳 스왑**

각 파일을 열어 위 목록의 `<h2>`에서 `text-lg font-bold`를 `text-display-2`로 교체. 예시:
```html
<!-- before (pages/index.vue:111) -->
<h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
<!-- after -->
<h2 class="text-display-2 text-slate-900 flex items-center gap-2">
```
DataSourceCard.vue·RelatedGuides.vue·DistrictSummaryCard.vue는 `text-slate-* text-lg font-bold` 순서일 수 있음 — 위치 무관하게 `text-lg font-bold` 두 토큰을 `text-display-2` 하나로 교체.

주의: 각 파일에 비-heading `text-lg font-bold`가 있을 수 있으므로 **목록의 heading 요소에만** 적용. 적용 후 확인:
Run: `grep -n "text-display-2" frontend/pages/index.vue` → 3건 등 기대.

- [ ] **Step 2: display-3 7곳 스왑 (+ leading-tight 제거)**

예시:
```html
<!-- before (pages/real-estate/index.vue:13) -->
<h2 class="text-base md:text-lg font-bold text-slate-900 leading-tight">부동산 유형별 실거래가</h2>
<!-- after -->
<h2 class="text-display-3 text-slate-900">부동산 유형별 실거래가</h2>
```
`RegionRealEstateCta.vue:3`·`subscription/index.vue:13`은 `leading-tight`가 없으니 `text-base md:text-lg font-bold` → `text-display-3`만.

- [ ] **Step 3: grep 불변식 — 채택 수 확인**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
echo "display-2: $(grep -rho 'text-display-2' --include='*.vue' pages components | wc -l | tr -d ' ')"   # 기대 16
echo "display-3: $(grep -rho 'text-display-3' --include='*.vue' pages components | wc -l | tr -d ' ')"   # 기대 12 (기존 5 + 신규 7)
```
Expected: display-2 ≥ 16, display-3 ≥ 12.

- [ ] **Step 4: 테스트 + lint**

Run: `cd frontend && npm run test && npm run lint`
Expected: PASS. 헤딩의 정확 클래스를 단언하던 테스트가 깨지면(예: `toContain('text-lg')`) 새 토큰(`text-display-2`/`-3`)으로 갱신.

- [ ] **Step 5: 빌드**

Run: `cd frontend && npm run build 2>&1 | tail -3`
Expected: 성공.

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add -A
git commit -m "refactor(ui): 섹션·서브 제목 23곳 display 토큰 채택 (무손실)

text-lg font-bold 섹션 H2 16곳 → .text-display-2,
text-base md:text-lg font-bold 서브 제목 7곳 → .text-display-3 (leading-tight 제거).
size/weight 정확 매칭만 채택, 형태 다른 제목은 보존. eyebrow는 정확 매칭 0이라 제외."
```

---

## Task 3: text-primary-600 → text-primary dedup

**Files:** `pages/contact.vue`, `pages/privacy.vue`, `pages/about.vue`, `components/common/AppFooter.vue`

- [ ] **Step 1: 코드모드 (완전 동일 색, 순수 dedup)**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
for f in pages/contact.vue pages/privacy.vue pages/about.vue components/common/AppFooter.vue; do
  sed -i '' -E 's/text-primary-600/text-primary/g' "$f"
done
grep -rn "text-primary-600" --include="*.vue" pages components | wc -l | tr -d ' '   # 기대 0
```
Expected: 0건. (`text-primary-600`=#2563eb=`text-primary` DEFAULT, 시각 무손실.)

- [ ] **Step 2: text-primary-500/700 보존 확인 (건드리지 않았는지)**

Run: `grep -rho "text-primary-500\|text-primary-700" --include="*.vue" frontend/pages frontend/components | sort | uniq -c`
Expected: 변경 전과 동일 개수(=의미색·hover색 보존). 0이 되면 안 됨.

- [ ] **Step 3: 테스트 + lint**

Run: `cd frontend && npm run test && npm run lint`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add -A
git commit -m "refactor(ui): text-primary-600 → text-primary dedup

완전 동일 색(#2563eb) 중복 클래스 정리, 4파일.
의미색 text-primary-500(하락 지표)·hover color text-primary-700은 보존."
```

---

## Task 4: 최종 검증 + 시각 스폿체크 + PR

- [ ] **Step 1: 전체 게이트**

Run: `cd frontend && npm run test && npm run lint && npm run build 2>&1 | tail -3`
Expected: test PASS, lint 0 errors, build 성공.

- [ ] **Step 2: 성공 기준 grep**

Run:
```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
echo "display-2 사용: $(grep -rho 'text-display-2' --include='*.vue' pages components | wc -l | tr -d ' ')"  # ≥16
echo "display-3 사용: $(grep -rho 'text-display-3' --include='*.vue' pages components | wc -l | tr -d ' ')"  # ≥12
echo "primary-600 잔존: $(grep -rho 'text-primary-600' --include='*.vue' pages components | wc -l | tr -d ' ')"  # 0
echo "primary-500 보존: $(grep -rho 'text-primary-500' --include='*.vue' pages components | wc -l | tr -d ' ')"  # >0
```

- [ ] **Step 3: 시각 스폿체크 (Playwright, dev 서버)**

`frontend`에서 `npm run dev`(백그라운드) + 백엔드 필요 시 기동. 다음 페이지 점검:
- 홈 `/` — 섹션 H2("빠른 생활시설 찾기" 등)가 18px·700로 렌더(=기존 text-lg와 동일).
- 부동산 `/real-estate` — display-3 채택된 H2들이 16/18px 유지.
- 시설 `/hospital`, 지역 `/seoul` — 위계·간격 회귀 없음.
- `getComputedStyle`로 채택 헤딩의 fontSize가 18px(display-2)/16~18px(display-3)인지 확인. 줄바꿈되는 제목 있으면 줄간격 육안 확인.

차이 발견 시 해당 커밋 수정.

- [ ] **Step 4: push & PR (base develop)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin refactor/typography-token-enforcement
gh pr create --base develop --head refactor/typography-token-enforcement \
  --title "refactor(ui): 타이포그래피 토큰 강제 2차 — display-2 재정의 + 무손실 채택" \
  --body "spec 요약 + grep 성공 기준 결과 + 시각 스폿체크 결과 첨부"
```
CI(Test 워크플로우) 통과 후 머지.

---

## Self-Review (작성자 점검)

**Spec 커버리지:**
- 섹션 1 display-2 재정의 → Task 1 ✓
- 섹션 2 제목 채택(display-2 16 / display-3 7 / eyebrow 0) → Task 2 ✓ (eyebrow는 정확 매칭 0 확인 후 제외 — spec의 "정확히 일치하지 않으면 0곳" 충족)
- 섹션 3 text-primary-600 dedup + 500/700 보존 → Task 3 ✓
- 섹션 4 검증(test/lint/build + grep + 시각 스폿체크) → Task 4 ✓
- display-1/display-3 재정의 금지, 카테고리색/AdBanner 불가침 → 어느 Task도 건드리지 않음 ✓
- 커밋 3개 + PR 1개 → Task 1/2/3 커밋 + Task 4 PR ✓

**Placeholder 스캔:** display-2 재정의는 완전한 before/after CSS 제공. 제목 채택은 정확한 file:line 목록 + 변환 규칙 + 구체 예시 제공(주관 영역 없음, 기계적 스왑). text-primary dedup은 결정론적 sed. 시각 스폿체크는 구체 페이지·검증 방법 명시.

**타입/이름 일관성:** 토큰 클래스명(`text-display-2`, `text-display-3`, `text-primary`), 색 값(#2563eb), 파일 경로를 전 Task에서 동일하게 사용. display-3 baseline 5 → 채택 후 12로 일관 표기.
