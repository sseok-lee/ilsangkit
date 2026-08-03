# 디자인 토큰 강제(Token Enforcement) 1차 PR — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프론트엔드의 색상·컴포넌트 디자인 토큰 drift를 제거한다 — raw `blue-*` → `primary` 토큰 치환, `.btn-primary`/`.card-base`/`.input-base` 유틸 채택, 미사용 Base* Vue 컴포넌트 삭제.

**Architecture:** 색상 치환은 결정론적 sed 코드모드(39파일, 픽셀 무손실)로 일괄 처리 후 grep 불변식으로 검증. 컴포넌트 클래스 채택은 "명백히 같은 의도인 것만" 적용하는 수동 패스(의도된 변형 보존). 죽은 컴포넌트는 참조 0 확인 후 삭제. 안전망은 기존 vitest 스위트 + grep 불변식(이 리팩터는 동작 변경이 아니라 클래스 문자열 교체이므로 red-green TDD가 아니라 "기존 테스트 green 유지 + grep 0건" 규율로 검증한다).

**Tech Stack:** Nuxt 3, Vue 3, TailwindCSS v3, Vitest, ESLint. Node 20 (`nvm use 20` 필수 — 메모리 참조).

**Branch:** `refactor/design-token-enforcement` (이미 생성됨). 작업 디렉토리: `frontend/`.

**Spec:** `docs/superpowers/specs/2026-05-29-design-token-enforcement-design.md` (로컬).

---

## File Structure

이 PR은 새 파일을 만들지 않는다. 변경/삭제만 한다.

- **Modify (색상):** 39개 `.vue` 파일 (pages/ + components/) — `blue-*` 사용처. Task 1에서 코드모드로 일괄.
- **Modify (테스트):** `tests/components/home/hotspot/HotspotRow.test.ts` — blue 클래스 단언 1건 업데이트.
- **Modify (컴포넌트 클래스):** `assets/css/main.css` (`.btn-primary` 정의 보정) + 버튼/카드/인풋 마크업 보유 파일들 (수동 패스).
- **Delete:** `components/common/BaseButton.vue`, `components/common/BaseCard.vue`, `components/common/SearchBar.vue`.

---

## 사전 준비 (모든 Task 공통)

- [ ] **Node 20 확인**

Run: `cd frontend && node -v`
Expected: `v20.x` (아니면 `nvm use 20`). 메모리: lock 파일 삭제·재생성 금지, `npm install`만.

- [ ] **현재 브랜치 확인**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `refactor/design-token-enforcement`

- [ ] **베이스라인 테스트 green 확인** (회귀 기준점)

Run: `cd frontend && npm run test`
Expected: 기존 스위트 PASS. 만약 기존 실패가 있으면 기록만 하고(이 PR과 무관) 진행.

---

## Task 1: 색상 토큰 치환 (blue-* → primary)

**Files:**
- Modify: 39개 `.vue` (아래 코드모드가 자동 선택)
- Modify: `tests/components/home/hotspot/HotspotRow.test.ts`

**매핑 규칙 (spec 섹션 1):**
- `blue-600` → `primary` (번호 없는 DEFAULT, 기존 `text-primary` 관례와 일치). 색 동일(#2563eb).
- 그 외 `blue-{50,100,200,300,400,500,700,800,900}` → `primary-{동일번호}`. `blue-500`만 #3b82f6→#3c83f6 (육안 불가), 나머지 동일.
- 모든 prefix 적용: `bg- text- border- ring- shadow- from- to- via- divide-`, 투명도(`/30`), 변형(`hover: focus: group-hover:` 등)은 접두사라 자동 포함.

- [ ] **Step 1: 코드모드 스크립트 작성 및 실행**

`blue-600`을 먼저 bare `primary`로 치환한 뒤, 남은 `blue-N`을 `primary-N`으로 치환한다(순서 중요).

Run:
```bash
cd frontend
files=$(grep -rl "blue-[0-9]" --include="*.vue" pages components)
for f in $files; do
  # Pass A: blue-600 → primary (bare DEFAULT). blue-600/30 → primary/30.
  sed -i '' -E 's/blue-600/primary/g' "$f"
  # Pass B: 나머지 blue-N → primary-N (첫 숫자만 매칭, 뒷자리 보존)
  sed -i '' -E 's/blue-([0-9])/primary-\1/g' "$f"
done
echo "치환 완료: $(echo "$files" | wc -l) 파일"
```

(macOS sed는 `-i ''` 필수. Linux면 `sed -i -E`.)

- [ ] **Step 2: grep 불변식 검증 — blue 0건**

Run: `grep -rn "blue-[0-9]" --include="*.vue" frontend/pages frontend/components`
Expected: **출력 없음(0건).** 1건이라도 남으면 해당 파일 수동 확인.

- [ ] **Step 3: 잘못된 이중 치환 없는지 점검**

Run: `grep -rn "primary-primary\|primary--\|primary-[0-9][0-9][0-9][0-9]" --include="*.vue" frontend/pages frontend/components`
Expected: 출력 없음. (이중 치환·자리수 오류 방지 안전장치)

- [ ] **Step 4: info 시맨틱 오탐 수동 점검**

Run: `git diff --stat`로 변경 파일 확인 후, `components/common/StatusBadge.vue`의 diff를 본다.

Run: `git diff frontend/components/common/StatusBadge.vue`
판단: 파랑이 "info/진행중" 같은 **시맨틱 상태색**으로 쓰였고 브랜드 primary와 의미가 분리돼야 한다면 그 1건은 `git checkout`으로 되돌리고 이 파일을 spec "리뷰 체크포인트"에 기록. 단순 액센트면 그대로 유지(대부분 이 경우).

- [ ] **Step 5: HotspotRow 테스트 단언 업데이트**

`tests/components/home/hotspot/HotspotRow.test.ts`에서 `blue-` 단언을 새 토큰으로 교체.

Run: `grep -n "blue-" frontend/tests/components/home/hotspot/HotspotRow.test.ts`
그 라인의 `blue-600`은 `primary`로, `blue-N`은 `primary-N`으로 수정(컴포넌트와 동일 매핑). 예: `expect(...).toContain('text-blue-700')` → `toContain('text-primary-700')`.

- [ ] **Step 6: 테스트 실행 — green 유지**

Run: `cd frontend && npm run test`
Expected: 전체 PASS. 다른 테스트가 추가로 blue를 단언하면(Step 사전조사상 없음) 동일 규칙으로 수정.

- [ ] **Step 7: lint**

Run: `cd frontend && npm run lint`
Expected: 통과(에러 0). 경고는 기존 수준 유지.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor(ui): blue-* → primary 토큰 치환

39개 .vue의 raw blue-* 클래스를 primary 토큰으로 일괄 치환.
색상 무손실(blue-600=#2563eb=primary, blue-500만 육안 불가 차이).
카테고리 색상(purple/green 등)은 대상 아님 → 자동 보존.
HotspotRow 테스트 클래스 단언 동기화."
```

---

## Task 2: 컴포넌트 유틸 클래스 채택 + .btn-primary 색 보정

**Files:**
- Modify: `assets/css/main.css:82` (`.btn-primary` 정의)
- Modify: 1차 버튼/보조 버튼/카드/일반 인풋 보유 `.vue` 파일 (수동, 아래 규칙)

**원칙 (spec 섹션 2):** drift 제거 ≠ 100% 채택. **토큰과 명백히 같은 의도인 것만** 교체. 형태(크기·모양)가 토큰과 다르면 그대로 둔다.

- [ ] **Step 1: `.btn-primary` 정의 보정**

`frontend/assets/css/main.css`의 `.btn-primary`를 현행 다수 버튼 색(#2563eb)에 맞춘다.

변경 전:
```css
  .btn-primary {
    @apply px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white font-medium rounded-lg transition-colors active:scale-[0.98];
  }
```
변경 후:
```css
  .btn-primary {
    @apply px-4 py-2 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors active:scale-[0.98];
  }
```
(`bg-primary`=#2563eb, `bg-primary-dark`=#1d4ed8. Task 1에서 buttons의 raw `bg-primary-600`/`bg-primary`로 이미 치환됐으므로 일치.)

- [ ] **Step 2: 1차 버튼 후보 식별**

Run:
```bash
cd frontend
grep -rn "bg-primary hover:bg-primary-dark\|bg-primary hover:bg-primary " --include="*.vue" pages components
```
이 출력 중 **`.btn-primary` 정의와 형태가 일치하는 것**(직사각형, `px-4 py-2` 계열, rounded-lg)만 대상. **제외:** 검색바 내부 버튼, 플로팅 CTA(`shadow-lg shadow-primary-500/30` 등 특수 그림자/크기), pill(`rounded-full`).

- [ ] **Step 3: 일치 버튼에 `.btn-primary` 적용**

각 일치 버튼의 인라인 유틸 묶음을 `class="btn-primary"`로 교체(추가 수식자가 있으면 `class="btn-primary w-full"`처럼 병기). **형태가 조금이라도 다르면 건너뛴다.** 교체할 게 없으면 이 스텝은 no-op으로 두고 기록.

- [ ] **Step 4: 카드 후보 식별 및 적용**

Run:
```bash
cd frontend
grep -rn "p-4 bg-white border border-slate-200 rounded-lg" --include="*.vue" pages components
```
`.card-base` 정의(`p-4 bg-white border border-slate-200 rounded-lg hover:shadow-md`)와 **정확히 일치**하는 카드만 `class="card-base"`로 교체. **보존:** `border-line`+`shadow-card`+`rounded-xl` 조합(홈·시설 카드 등 의도된 변형)은 손대지 않는다.

- [ ] **Step 5: 일반 인풋 후보 검토 및 적용**

대상 후보(검색 전용/삭제 대상 제외):
- 적용 검토: `components/realEstate/RealEstateSearchFilter.vue`, `components/subscription/SubscriptionListView.vue`, `components/subscription/PublicRentalListView.vue`, `pages/public-rental/announcements/index.vue`, `pages/subway/index.vue`
- **제외:** `pages/index.vue`(hero 특수), `pages/search.vue`(통합검색 특수), `pages/[category]/index.vue`(필터 특수 시 제외), `components/search/SearchInput.vue`(전용), `components/common/SearchBar.vue`(Task 3에서 삭제)

`.input-base` 정의: `w-full px-4 py-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent placeholder-slate-400`

각 후보의 `<input>`이 이 패턴과 **사실상 같은 일반 텍스트 인풋**이면 인라인 유틸을 `class="input-base"`로 교체. 모양(높이·아이콘 내장·특수 포커스)이 다르면 보존. 교체 0건이어도 무방.

- [ ] **Step 6: 빌드로 Tailwind 안전 확인**

Run: `cd frontend && npm run build`
Expected: 성공. (`.btn-primary` 등은 @apply라 content purge 영향 없음; primary는 config 등록돼 안전.)

- [ ] **Step 7: 테스트 + lint**

Run: `cd frontend && npm run test && npm run lint`
Expected: 전부 PASS. 카드/버튼 클래스 변경으로 깨지는 클래스 단언 테스트가 있으면 새 클래스로 수정.

- [ ] **Step 8: 커밋**

```bash
git add -A
git commit -m "refactor(ui): btn/card/input 유틸 클래스 채택 + .btn-primary 색 보정

.btn-primary 정의를 bg-primary(#2563eb)로 보정해 현행 버튼색과 일치.
명백히 토큰과 같은 의도인 버튼/카드/인풋만 유틸 클래스로 교체.
의도된 변형(border-line+shadow-card 카드, 검색 특수 인풋 등)은 보존."
```

---

## Task 3: 미사용 Base* 컴포넌트 삭제

**Files:**
- Delete: `components/common/BaseButton.vue`, `components/common/BaseCard.vue`, `components/common/SearchBar.vue`

- [ ] **Step 1: 참조 0 재확인 (삭제 전 안전 점검)**

Run:
```bash
cd frontend
grep -rn "BaseButton\|BaseCard\|SearchBar" --include="*.vue" --include="*.ts" pages components composables layouts plugins | grep -vE "common/(BaseButton|BaseCard|SearchBar)\.vue"
```
Expected: **출력 없음.** 1건이라도 있으면 삭제 중단하고 보고.

- [ ] **Step 2: 삭제**

Run:
```bash
cd frontend
git rm components/common/BaseButton.vue components/common/BaseCard.vue components/common/SearchBar.vue
```

- [ ] **Step 3: 잔여 import·빌드 검증**

Run: `cd frontend && npm run build`
Expected: 성공(없는 컴포넌트 import 에러 없음).

- [ ] **Step 4: 테스트**

Run: `cd frontend && npm run test`
Expected: PASS. (이들 컴포넌트 전용 테스트 없음 — 사전 확인됨.)

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "chore(ui): 미사용 Base* 컴포넌트 삭제

BaseButton/BaseCard/SearchBar.vue — 참조 0, 테스트 0.
표준을 CSS 유틸 클래스로 확정했으므로 중복 Vue 래퍼 제거."
```

---

## Task 4: 최종 검증 (시각 스폿체크) 및 PR

- [ ] **Step 1: 전체 게이트 재실행**

Run: `cd frontend && npm run test && npm run lint && npm run build`
Expected: 3개 모두 통과.

- [ ] **Step 2: grep 성공 기준 확인**

Run: `grep -rn "blue-[0-9]" --include="*.vue" frontend/pages frontend/components`
Expected: 0건(또는 Step 1.4에서 기록한 의도적 info 예외만).

Run: `grep -rn "btn-primary\|card-base\|input-base" --include="*.vue" frontend/pages frontend/components | wc -l`
Expected: > 0 (실제 채택 발생; 채택 0이면 Task 2 보존 판단이 과했는지 재검토).

- [ ] **Step 3: 시각 스폿체크 (핵심 3페이지)**

dev 서버 기동: `cd frontend && npm run dev` (백그라운드). 백엔드도 필요시 `cd backend && npm run dev`.
브라우저로 before/after 육안 확인:
- `/` (홈) — 히어로/통계박스/버튼 색
- `/hospital` (시설 리스트) — 카드/필터
- 임의 시설 상세 `/hospital/[id]` — CTA 버튼/배지

색상 무손실이라 차이 없어야 정상. 차이 발견 시 해당 커밋 수정.

- [ ] **Step 4: push & PR 생성**

```bash
cd frontend && cd ..
git push -u origin refactor/design-token-enforcement
```
GitHub에서 base `develop` 대상 PR 생성. 본문에 spec 요약 + grep 성공 기준 결과 첨부. CI(Test 워크플로우) 통과 후 머지.

---

## Self-Review (작성자 점검 결과)

**Spec 커버리지:**
- 섹션 1 색상 규칙 → Task 1 ✓
- 섹션 2 컴포넌트 클래스 + .btn-primary 보정 → Task 2 ✓
- 섹션 3 죽은 컴포넌트 삭제 → Task 3 ✓
- 섹션 4 검증(test/lint/build + 3페이지 스폿체크) → Task 1·2·3 각 검증 + Task 4 ✓
- 카테고리 색상/AdBanner 보존 → 코드모드가 blue-*만 대상이라 자동 보존, Task 1.4에서 명시 ✓
- 커밋 3개 + PR 1개 → Task 1/2/3 커밋 + Task 4 PR ✓

**Placeholder 스캔:** 색상 치환은 완전 결정론적 스크립트 제공. 컴포넌트 클래스 채택은 본질적으로 per-site 판단이라 "vague" 대신 **명시적 매칭 규칙 + 제외 목록 + grep 식별 명령 + 보존 기준**으로 구체화함(완전 자동화 불가 영역). 채택 0건 허용을 명시해 억지 채택 방지.

**타입/이름 일관성:** 토큰 이름(`primary`, `primary-N`, `primary-dark`), 유틸 클래스(`btn-primary`, `card-base`, `input-base`)를 전 Task에서 동일하게 사용. sed 매핑 규칙도 Task 1과 HotspotRow 테스트(Step 5)에서 동일.
