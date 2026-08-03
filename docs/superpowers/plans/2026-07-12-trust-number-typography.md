# 숫자 타이포 전역화 + 등락 토큰 (신뢰 디자인 격상 PR ⑦) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** spec §6-4를 구현한다 — (1) 숫자 표·스탯에 `tabular-nums`를 전역 적용하고 표의 숫자 컬럼을 우측 정렬로 통일, (2) 등락(상승/하락) 표기 전용 토큰 `--delta-up`(#DC2626)·`--delta-down`(#2563EB)을 신설해 현재 red/브랜드-primary로 표현된 등락 색을 이 토큰으로 분리한다. 전부 **표시(class/token) 변경**이며 값·데이터·포맷은 불변.

**Architecture:** 두 트랙. (A) 등락 토큰: `main.css` :root에 토큰 2개 + `tailwind.config.js` 색상 별칭 2개를 신설(기존 `--success`/`--danger` 이중 정의 패턴과 동일)하고, 등락이 실제로 나오는 곳(홈 핫스팟 3파일·부동산 상세 변동률·실거래 증감)만 red/primary → delta 토큰으로 교체. (B) tabular-nums: 표는 `<table>`에 `tabular-nums` 1개(상속되어 셀에 전파)+numeric 컬럼 `text-right`, 스탯 값 span엔 `tabular-nums`. 레퍼런스 모델은 이미 올바른 청약·공매 테이블.

**Tech Stack:** Nuxt 3 + Vue 3(script setup) + TailwindCSS(OD 토큰) + Vitest

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §6-4. 사용자 결정: **이 PR은 §6-4(숫자 타이포)만** — §6-3 카운터 밴드는 SSR 동기화-날짜 이슈(useSyncStatus `server:false`)로 별도 PR(다음)로 분리, 그때 "3칸·날짜+주기 융합 유지" 방식 채택 확정.

## Global Constraints

- **Node 20 필수**: 모든 `npm`/`npx`/`vitest` 앞에 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **표시 전용·SSR 불변**: 이 PR은 CSS 클래스/토큰만 추가·교체한다. SSR 렌더 텍스트는 **바이트 불변**(숫자 문자열·라벨 그대로), 단일 h1·title·meta·canonical·JSON-LD·noindex 전부 불변. `tabular-nums`/`text-right`는 비시맨틱 표시 속성.
- **금액·날짜 포맷 불변**: 값 문자열 생성은 §5-8 유틸(`formatKoreanPrice`·`formatManwonKorean`·`formatDeposit`·`formatDotDate`·`formatLandDealDate`) 소관 — **건드리지 말 것**. 이 PR은 그 출력에 표시 클래스만 얹는다.
- **등락 토큰 분리(혼용 금지)**: `--delta-up`(#DC2626)·`--delta-down`(#2563EB)은 semantic `--success`(#0FA968)·`--danger`(#E0443B)와 **값·이름 모두 분리**. 등락 지표만 delta 토큰으로 바꾸고, error/success 토큰 및 그 사용처(ErrorBoundary·에러박스·119 버튼·거래취소 배지 등)는 **절대 미변경**. 등락은 text·background 틴트·border **셋 다** 마이그레이션(부분 마이그레이션 금지).
- **등락 아닌 것 미변경**: HotspotCard/Row의 `active`(violet·거래 급증), `HomeTrendingBuildings` accent(카테고리 컬럼색), `RegionRealEstatePrices`(정적 시세), land `평당가` 단순 강조 등은 등락이 아니므로 delta 토큰 대상 아님.
- **라이트 전용**: 다크모드 없음(CLAUDE.md). CLS/광고 정책 불변(class-only, 예약 영역 변화 없음).
- **커밋**: conventional commit 한국어(`feat(trust): …`). PR은 develop 대상, 자체 머지 금지.

## 브랜치

Task 1 Step 1에서 생성:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop   # develop HEAD = ee14fcb0
git checkout -b feat/trust-number-typography
```

---

### Task 1: 등락 토큰 신설 + 홈 핫스팟·부동산 상세 변동률 마이그레이션

**Files:**
- Modify: `frontend/assets/css/main.css` (토큰 신설, `--danger` 다음 줄)
- Modify: `frontend/tailwind.config.js` (colors에 delta 별칭 2개)
- Modify: `frontend/components/home/hotspot/HotspotCard.vue` (L45-46 rising/falling)
- Modify: `frontend/components/home/hotspot/HotspotRow.vue` (L30-31 SIGNAL_HOVER, L36-37 SIGNAL_COLOR)
- Modify: `frontend/components/home/HomeHotspotSignals.vue` (L124-125 borderClass)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (changeRateColor computed, ~L901-906)
- Test: `frontend/tests/components/home/hotspot/HotspotRow.test.ts` (기존 어서션 갱신), `HotspotCard.test.ts`·`HomeHotspotSignals.test.ts` (색 어서션 추가), 신규 토큰 가드

**Interfaces:**
- Produces: Tailwind 유틸 `text-delta-up`/`text-delta-down`/`bg-delta-up/10`/`bg-delta-down/10`/`border-delta-up`/`border-delta-down` (Task 2가 TransactionTable 증감에 소비)
- Consumes: 없음

**패턴 근거(확인됨):** 저장소는 semantic 색을 `main.css` :root 토큰(`--success:#0FA968; --danger:#E0443B;`)과 `tailwind.config.js` colors 해시(`success:'#0FA968', error:'#E0443B'`)에 **이중 정의**한다. delta 토큰도 동일 패턴으로 둘 다 정의(주석으로 동기화 명시). Tailwind 색을 hex로 두면 `bg-delta-up/10` 같은 opacity 수식이 정상 동작(`var()` 별칭은 opacity가 깨지므로 hex 사용).

- [ ] **Step 1: 브랜치 생성** (위 "브랜치" 블록 실행)

- [ ] **Step 2: 실패 테스트 준비(RED)** — `HotspotRow.test.ts` 기존 어서션 2개를 delta로 갱신:

L31 부근 `expect(...).toMatch(/text-red-500/)` → `expect(...).toMatch(/text-delta-up/)`
L41 부근 `expect(...).toMatch(/text-primary-500/)` → `expect(...).toMatch(/text-delta-down/)`

그리고 `HotspotCard.test.ts`에 색 어서션 추가(기존 mount 패턴 재사용 — rising/falling variant가 delta 클래스를 갖는지):

```ts
it('상승 시그널은 delta-up 토큰 색을 쓴다', () => {
  const w = /* rising variant로 mount (기존 테스트의 mount 헬퍼/패턴) */ mountRising()
  expect(w.html()).toMatch(/text-delta-up/)
  expect(w.html()).not.toMatch(/text-red-500/)
})
it('하락 시그널은 delta-down 토큰 색을 쓴다', () => {
  const w = mountFalling()
  expect(w.html()).toMatch(/text-delta-down/)
  expect(w.html()).not.toMatch(/text-primary-500/)
})
```
(실제 mount 방식은 기존 `HotspotCard.test.ts`의 패턴을 그대로 복사. rising/falling을 결정하는 prop을 확인해 두 케이스를 만든다.)

신규 토큰 가드 `frontend/tests/assets/deltaTokens.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const css = readFileSync(resolve(here, '../../assets/css/main.css'), 'utf-8')
const tw = readFileSync(resolve(here, '../../tailwind.config.js'), 'utf-8')

describe('등락 토큰 (§6-4)', () => {
  it('main.css에 delta 토큰이 정의된다', () => {
    expect(css).toMatch(/--delta-up:\s*#DC2626/)
    expect(css).toMatch(/--delta-down:\s*#2563EB/)
  })
  it('tailwind에 delta 별칭이 있다', () => {
    expect(tw).toMatch(/delta-up/)
    expect(tw).toMatch(/delta-down/)
  })
  it('semantic success/danger와 값이 다르다 (분리)', () => {
    expect('#DC2626').not.toBe('#E0443B') // delta-up ≠ danger
    expect('#2563EB').not.toBe('#2450DC') // delta-down ≠ brand
  })
})
```
(Task 1 히어로 소스가드 교훈: `new URL(literal, import.meta.url)`는 Vite import-analysis가 가로채므로 `dirname(fileURLToPath)+resolve` 사용.)

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/components/home/hotspot/HotspotRow.test.ts tests/components/home/hotspot/HotspotCard.test.ts tests/assets/deltaTokens.test.ts
```
Expected: FAIL — delta 토큰/클래스 미존재.

- [ ] **Step 3: 토큰 정의** — `main.css` :root의 `--danger: #E0443B;` 줄 **다음**에:

```css
  /* 등락(상승/하락) 전용 — semantic success/danger와 분리(spec §6-4, 한국 금융 관례) */
  --delta-up: #DC2626;
  --delta-down: #2563EB;
```

`tailwind.config.js`의 `theme.extend.colors`에 (기존 `error`/`success` 해시 근처):

```js
      'delta-up': '#DC2626',
      'delta-down': '#2563EB',
```
(주석: `// main.css --delta-up/--delta-down와 동기화 유지`)

- [ ] **Step 4: 홈 핫스팟 마이그레이션** — red/primary → delta (text·bg·border 전부):

`HotspotCard.vue` L45-46:
- rising: `iconBg:'bg-red-50'` → `'bg-delta-up/10'`, `iconColor:'text-red-500'` → `'text-delta-up'`
- falling: `iconBg:'bg-primary-50'` → `'bg-delta-down/10'`, `iconColor:'text-primary-500'` → `'text-delta-down'`
- active(violet)는 **불변**

`HotspotRow.vue` L36-37 (SIGNAL_COLOR): rising `'text-red-500'`→`'text-delta-up'`, falling `'text-primary-500'`→`'text-delta-down'`. L30-31 (SIGNAL_HOVER): rising `'hover:bg-red-50/40'`→`'hover:bg-delta-up/[.06]'`, falling `'hover:bg-primary-50/40'`→`'hover:bg-delta-down/[.06]'`. active 불변.

`HomeHotspotSignals.vue` L124-125: rising `borderClass:'border-red-500'`→`'border-delta-up'`, falling `borderClass:'border-primary-500'`→`'border-delta-down'`.

- [ ] **Step 5: 부동산 상세 변동률 마이그레이션** — `[buildingName].vue` changeRateColor computed(~L901-906):

```ts
changeRate > 0 ? 'text-red-500' : ... < 0 ? 'text-primary-500' : 'text-slate-500'
```
→ `> 0` → `'text-delta-up'`, `< 0` → `'text-delta-down'`. **0/null 중립은 `text-slate-500` 유지**. ▲/▼ 기호 로직 불변.

- [ ] **Step 6: 테스트 통과(GREEN)**

```bash
npx vitest run tests/components/home/hotspot/HotspotRow.test.ts tests/components/home/hotspot/HotspotCard.test.ts tests/components/home/HomeHotspotSignals.test.ts tests/assets/deltaTokens.test.ts
```
Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add assets/css/main.css tailwind.config.js components/home/hotspot/HotspotCard.vue components/home/hotspot/HotspotRow.vue components/home/HomeHotspotSignals.vue "pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" tests/components/home/hotspot/HotspotRow.test.ts tests/components/home/hotspot/HotspotCard.test.ts tests/assets/deltaTokens.test.ts
git commit -m "feat(trust): 등락 전용 토큰(--delta-up/down) 신설 + 홈 핫스팟·부동산 변동률 색 분리 (PR⑦)"
```
(HomeHotspotSignals.test.ts를 Step 2에서 수정했다면 add에 포함.)

---

### Task 2: TransactionTable — 증감 delta 토큰화 + tabular-nums + 우측정렬

**Files:**
- Modify: `frontend/components/realEstate/TransactionTable.vue`
- Test: `frontend/tests/components/realEstate/TransactionTable.test.ts` (어서션 추가)

**Interfaces:**
- Consumes: Task 1의 `text-delta-up`/`text-delta-down` 유틸
- Produces: 없음

**현재 구조(확인됨):** 데스크톱 `<table class="w-full text-sm">`(≈L7)+모바일 카드(md:hidden). 금액 셀만 `tabular-nums`(L99/215 등), 나머지 numeric 셀(층 L94/210·전용면적 L97/213·평당가 L103·월세 L227)·헤더 `<th>`(L13/66/191)는 무 tabular·좌측정렬. 증감 색 삼항 4곳(보증금 L221·월세 L233 데스크톱 / 보증금 L293·월세 L328 모바일)이 `text-red-500`/`text-primary-500` 사용. 레퍼런스 모델: `pages/subscription/[id].vue`(numeric `<th>`=`text-right`, numeric `<td>`=`text-right font-display tabular-nums`), `components/auction/AuctionRankingTable.vue`.

- [ ] **Step 1: 실패 테스트 추가(RED)** — `TransactionTable.test.ts`에 (기존 mount 패턴 재사용):

```ts
it('숫자 컬럼은 tabular-nums로 렌더된다', () => {
  const w = /* 기존 mount */ mountTable()
  expect(w.find('table').classes()).toContain('tabular-nums')
})
it('증감률 색은 delta 토큰을 쓴다 (red/primary 아님)', () => {
  const w = mountTable(/* 보증금 상승 tx 포함 fixture */)
  expect(w.html()).toMatch(/text-delta-up|text-delta-down/)
  expect(w.html()).not.toMatch(/text-red-500|text-primary-500/)
})
```
(fixture는 기존 테스트가 쓰는 tx 배열 재사용. 증감이 나오려면 이전 거래 대비 변동이 있는 tx가 필요 — 기존 fixture에 없으면 최소 2건으로 구성.)

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/components/realEstate/TransactionTable.test.ts
```
Expected: FAIL — table에 tabular-nums 없음·delta 클래스 없음.

- [ ] **Step 2: tabular-nums 테이블 레벨 적용** — 데스크톱 `<table class="w-full text-sm">` 및 모바일에 테이블이 있으면 각 `<table>`에 `tabular-nums` 추가(상속되어 모든 셀 전파, 문자 컬럼엔 무해 — 숫자 글리프 간격만 영향).

- [ ] **Step 3: numeric 컬럼 우측 정렬** — 레퍼런스(subscription) 패턴대로: 숫자 컬럼(거래금액·평당가·층·전용면적·보증금·월세)의 `<th>`와 대응 `<td>`에 `text-right` 추가. **거래일·건물명·거래유형·계약유형은 좌측 유지**. 모바일 카드(md:hidden)는 이미 카드 레이아웃이라 정렬 대상 아님(금액 span은 그대로).

- [ ] **Step 4: 증감 색 delta 토큰화** — 4곳(L221·233·293·328)의 삼항: `'text-red-500'`→`'text-delta-up'`, `'text-primary-500'`→`'text-delta-down'`. 로직(>0/else) 현행 보존.

- [ ] **Step 5: 테스트 통과(GREEN)**

```bash
npx vitest run tests/components/realEstate/TransactionTable.test.ts
```
Expected: PASS. 기존 TransactionTable 테스트도 그대로 통과(클래스 추가는 텍스트·구조 불변).

- [ ] **Step 6: 커밋**

```bash
git add components/realEstate/TransactionTable.vue tests/components/realEstate/TransactionTable.test.ts
git commit -m "feat(trust): 실거래 테이블 tabular-nums·숫자 우측정렬 + 증감 delta 토큰화 (PR⑦)"
```

---

### Task 3: tabular-nums 나머지 표면 (토지·지역시세·시설현황)

**Files:**
- Modify: `frontend/pages/real-estate/land/[city]/[district]/[dong].vue` (분기별 추이 표 L115-134, 전체 거래 표 L163-190, 지목/거래사례 카드 L51-95, 용도지역 L151)
- Modify: `frontend/components/region/RegionRealEstatePrices.vue` (값 span L22·26·30·34)
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue` (childcare 표 L388·staff 표 L412 + FieldGrid 숫자 값)
- Modify: `frontend/assets/css/main.css` (`.od-stile .v`에 tabular-nums, L64-67)
- Modify(선택·DRY): `SourceStamp.vue`·`AppFooter.vue`·`pages/guide/index.vue`·`pages/article/index.vue`의 `[font-variant-numeric:tabular-nums]` → `tabular-nums`
- Test: `frontend/tests/pages/real-estate/landDongDetail.test.ts` (표 tabular-nums 어서션 추가)

**Interfaces:** 없음 (독립 표시 변경)

**현재 구조(확인됨):** land 두 표(`<table class="w-full text-sm border-collapse">` L115·L163)와 카드 값들은 무 tabular·좌측. RegionRealEstatePrices 값 span 4개 무 tabular(정렬은 flex justify-between이라 유지). DetailFacilityStatus 두 표(L388 childcare·L412 staff)는 이미 `text-right`지만 무 tabular; 인라인 값 span 다수. `.od-stile .v`(L64-67)는 tabular 미설정.

- [ ] **Step 1: 실패 테스트 추가(RED)** — `landDongDetail.test.ts`에 (기존 mount 패턴 재사용):

```ts
it('토지 거래 표는 tabular-nums로 렌더된다', () => {
  const w = /* 기존 mount */ mountDong()
  const tables = w.findAll('table')
  expect(tables.length).toBeGreaterThan(0)
  expect(tables.every(t => t.classes().includes('tabular-nums'))).toBe(true)
})
```
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/pages/real-estate/landDongDetail.test.ts
```
Expected: FAIL — 표에 tabular-nums 없음.

- [ ] **Step 2: land [dong] 표·카드** — 두 `<table>`(L115·L163)에 `tabular-nums`. numeric 컬럼(평균 평당가·거래 건수·면적·평당가) `<th>`+`<td>` `text-right`(분기·지목·거래일 좌측 유지). 지목/거래사례 카드 값 `<span>/<strong>`(L60·63·88·89·92)·용도지역 count(L151)에 `tabular-nums`. **금액/날짜 문자열 포맷은 미변경**.

- [ ] **Step 3: RegionRealEstatePrices** — 값 span 4개(L22·26·30·34)에 `tabular-nums` 추가. 정렬은 flex라 변경 불필요.

- [ ] **Step 4: DetailFacilityStatus + .od-stile** — 두 표(L388·L412)에 `tabular-nums`(상속). FieldGrid 기반 childcare 스탯(L359-372)의 숫자 값에 tabular(FieldGrid가 값 span을 렌더하면 그 클래스에). `main.css` `.od-stile .v`(L66)에 `font-variant-numeric: tabular-nums;` 추가(상세 현황 타일 전역화). 의료진 원-오프 리스트는 저우선(스킵 가능, 리포트에 명시).

- [ ] **Step 5: (선택) verbose 클래스 정규화** — `[font-variant-numeric:tabular-nums]` → `tabular-nums` 4곳(SourceStamp.vue·AppFooter.vue·guide/index·article/index). 순수 DRY, 출력 동일. 시간 압박 시 스킵 가능.

- [ ] **Step 6: 테스트 통과(GREEN) + 인접 회귀**

```bash
npx vitest run tests/pages/real-estate/landDongDetail.test.ts tests/components/subscription/RentalPriceStatsBox.test.ts tests/components/common/PageHero.test.ts
```
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add "pages/real-estate/land/[city]/[district]/[dong].vue" components/region/RegionRealEstatePrices.vue components/facility/detail/DetailFacilityStatus.vue assets/css/main.css tests/pages/real-estate/landDongDetail.test.ts
# Step 5를 했다면 해당 4파일도 add
git commit -m "feat(trust): 토지·지역시세·시설현황 표/스탯 tabular-nums 전역화 + 숫자 우측정렬 (PR⑦)"
```

---

### Task 4: 전체 검증 + PR 생성

**Files:** 없음

- [ ] **Step 1: 프론트 lint + 전체 테스트** (이 PR은 프론트만 변경 — 백엔드 스위트 불필요)

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | tail -5
```
Expected: lint 신규 오류 0(기존 warnings 무관), 전체 PASS. SearchAutocomplete/localStorage flaky 보이면 클린 재실행으로 확인.

- [ ] **Step 2: 시각 스폿체크 (dev 또는 육안)** — 가능하면 dev로 확인:
  - 홈 핫스팟 상승=빨강(#DC2626)/하락=파랑(#2563EB), 브랜드 링크색과 구분됨. active(보라) 유지.
  - 부동산 상세 변동률 배지·실거래 증감 색이 delta로. 0/중립은 회색.
  - 실거래·토지 표 숫자 우측정렬 + tabular 정렬. 문자 컬럼 좌측 유지.
  - 에러 박스·119 버튼 등 semantic red는 **불변**(등락과 색이 갈리는지 확인).
  - 모바일 390px 가로 넘침 없음.

- [ ] **Step 3: lock 무변경·범위 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git diff develop --stat -- '**/package-lock.json'   # 비어야 함
git diff develop --stat
git status --porcelain=v1   # stray(RESEARCH/·nuxt-config-eval.json·prod-home.jpeg) 커밋 금지
```
Expected: package-lock 무변경. semantic 토큰(`--success`/`--danger`)·그 사용처가 diff에 없음 확인. §5-8 포맷 유틸 미접촉 확인.

- [ ] **Step 4: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-number-typography
gh pr create --base develop \
  --title "feat(trust): 숫자 타이포 전역화 + 등락 토큰 (PR ⑦)" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) §6-4 숫자 타이포.

- tabular-nums 전역화: 실거래·토지 표, 지역시세, 시설현황 표/스탯에 tabular-nums + 숫자 컬럼 우측정렬(청약·공매 표 패턴 통일)
- 등락 토큰 신설: --delta-up(#DC2626 상승·빨강)·--delta-down(#2563EB 하락·파랑) — 한국 금융 관례. 홈 핫스팟·부동산 상세 변동률·실거래 증감을 red/브랜드-primary → delta 토큰으로 분리

## 불변식
- 표시(class/token)만 변경 — SSR 텍스트·h1·title·meta·JSON-LD 바이트 불변. 금액/날짜 포맷 유틸(§5-8) 미접촉
- 등락 토큰은 semantic success/danger와 값·이름 분리(혼용 금지). error/success 사용처(에러박스·119·거래취소 배지) 불변
- 라이트 전용·광고/CLS 정책 불변·package-lock 무변경

## 범위 (사용자 결정)
- 이 PR은 §6-4(숫자 타이포)만. §6-3 카운터 밴드는 다음 PR(동기화 날짜 SSR 이슈로 3칸·날짜+주기 융합 유지 방식)

## 테스트
- 등락: HotspotRow/HotspotCard/HomeHotspotSignals 색 어서션·토큰 가드, TransactionTable 증감 delta·tabular 어서션, land 표 tabular 어서션
- frontend vitest 전체 PASS, lint 0
EOF
)"
```
Expected: PR URL. CI green 확인 후 사용자 머지 판단.

---

## 플랜 메모

- **등락 토큰 이중 정의**: `main.css` 토큰 + `tailwind.config.js` hex는 저장소의 기존 `--success`/`--danger` ↔ tailwind `success`/`error` 이중 정의 패턴을 그대로 따른 것(주석으로 동기화 명시). Tailwind hex여야 `bg-delta-up/10` opacity 수식이 동작(`var()` 별칭은 opacity가 깨짐).
- **conflation 해소가 핵심**: 하락이 브랜드 primary(링크·버튼과 충돌), 상승이 error-red(에러 UI와 충돌)를 쓰던 것을 delta 전용으로 분리. text만이 아니라 bg 틴트·border까지 전부 교체해야 완결.
- **tabular-nums는 table 레벨 상속** 전략: `<table>`에 1개 클래스로 모든 셀 전파(font-variant-numeric은 상속 속성, 문자 셀 무해). 인라인 스탯은 값 span에 개별 적용.
- **테스트 현실**: 저장소 tests에 tabular-nums/text-right/delta 색 어서션이 0개(grep)라 회귀 위험 낮음 — 대표 어서션(핫스팟 색·표 tabular·증감 delta)만 락하고 나머지 class-only는 리뷰 diff+시각 스폿으로 검증.
- **다음 (Phase 2 잔여):** PR ⑧ 카운터 밴드(§6-3, **3칸·날짜+주기 융합 유지**=현행 SSR 안정, 이 지역/전국 등록 N곳 추가, getStats fail-open, RE 단지-단위 정합) / PR ⑨ 히어로+헤더+GNB C안(§6-1·6-2) / PR ⑩ 로고 코발트(§6-6). §6-5 상세 스펙 스트립은 미배치 — 카운터 밴드 PR과 함께 or 별도 결정 필요.
