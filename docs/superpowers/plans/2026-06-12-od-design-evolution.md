# OD 디자인 진화판 적용 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** OD 시안의 디자인 토큰(코발트 브랜드·중성색·radius·에디토리얼 타입)을 전역 적용하고, 시설 상세 페이지를 OD 룩과 일치시킨다.

**Architecture:** 2개 PR. PR1은 전역 토큰(tailwind.config.js + assets/css/main.css)만 바꿔 단독으로 시각 회귀를 검증한다. PR2는 시설 상세 컴포넌트들을 새 토큰 위에서 OD 룩으로 재스타일한다. 기능·SSR·데이터·광고 위치는 불변, 스타일 클래스만 교체.

**Tech Stack:** Nuxt 3, Vue 3, TailwindCSS, Pretendard + Public Sans, Material Symbols.

**검증 방식(설계 적응):** CSS/디자인 작업이므로 단위테스트가 아니라 ① `npm run dev` 실데이터 육안 확인 ② Playwright before/after 스크린샷(데스크톱+모바일) ③ `npm run lint`·`npm run test` green ④ 기능 무결성(길찾기·공유·복사·지도)으로 검증한다.

**Branch:** `feat/od-design-evolution` (이미 생성됨, develop에서 분기)

**Source of truth:** OD 프로젝트 `ilsangkit` — `css/app.css`, `facility-detail.html`. 토큰 정의는 본 플랜에 인라인 복제.

---

## File Structure

PR1 (전역 토큰):
- Modify: `frontend/tailwind.config.js` — colors(브랜드·중성·카테고리16+subway), borderRadius(2단계), boxShadow
- Modify: `frontend/assets/css/main.css` — `:root` CSS 변수 추가 + `@layer components` 타입 스케일 갱신

PR2 (파일럿 — 시설 상세):
- Modify: `frontend/components/common/PageHero.vue` — kicker/H1/intro/badges/hero-stats
- Modify: `frontend/components/common/SectionBlock.vue` — block 헤더(아이콘+제목) radius
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue` — field 2열 그리드 룩
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue` — stile 타일 + amenity chip
- Modify: `frontend/components/facility/detail/DetailNearby.vue` — fcard(원형 카테고리 아이콘) 카드
- Modify: `frontend/components/facility/detail/MobileDetailHeader.vue` — 칩/액션 pill 톤 정렬
- Modify: `frontend/assets/css/main.css` — 반복 패턴만 `@layer components` (`.hero-stats`, `.stile`, `.fcard`)
- (필요시) Modify: `frontend/pages/[category]/[id].vue` — 사이드바 액션/그리드 폭 미세조정

---

## PR1 — 전역 토큰 기반

### Task 1: tailwind.config.js 색상·radius·shadow 교체

**Files:**
- Modify: `frontend/tailwind.config.js`

- [ ] **Step 1: `theme.extend.colors`의 `primary` 스케일을 코발트로 교체**

`primary` 객체를 아래로 교체 (DEFAULT/dark + 600/700을 코발트 축으로 이동, tint는 50/100):

```js
primary: {
  DEFAULT: '#2450DC',   // brand (was #2563eb)
  dark:    '#1A3CB0',   // brand-strong (was #1d4ed8)
  press:   '#16358F',   // brand-press (신규)
  ink:     '#0F2C8C',   // 틴트 위 텍스트 (신규)
  50:  '#EBF0FE',       // brand-tint
  100: '#DCE6FD',       // brand-tint-2
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3c83f6',
  600: '#2450DC',
  700: '#1A3CB0',
  800: '#1e40af',
  900: '#1e3a8a',
},
```

- [ ] **Step 2: 중성색·surface 토큰을 OD 값으로 교체/추가**

`colors`에 아래를 추가/갱신 (기존 `background-light`·`line` 값 교체, 나머지 신규):

```js
'background-light': '#F7F8FA',   // paper (was #f9fafb)
'surface-light': '#FFFFFF',
'surface-2': '#FBFCFE',
ink:    '#15213B',
strong: '#0C1424',
muted:  '#56627A',
faint:  '#677087',
line:   '#E6E9F0',               // border (was #d8e0ea)
'line-2': '#D7DCE7',             // border-2
```

- [ ] **Step 3: 카테고리 16색을 OD 헥스로 정렬 + subway 추가**

`colors`의 카테고리 항목들을 아래로 교체(기존 toilet/trash/wifi/clothes 값 변경 포함) 후 누락 카테고리 추가:

```js
toilet: '#7C4DEC', trash: '#0FA968', wifi: '#E8920C', clothes: '#E2548E',
hospital: '#3B82F6', pharmacy: '#14B8A6', parking: '#0EA5E9', 'ev-charger': '#06B6D4',
subway: '#64748B', school: '#6366F1', childcare: '#EC6AA5', aed: '#E0443B',
library: '#D9820B', park: '#22A95B', market: '#F2730C', sports: '#8B5CF6',
```

(기존 `battery`·`kiosk`·`accent-purple`·`secondary`·semantic 색은 유지)

- [ ] **Step 4: borderRadius 2단계로 조정** ⚠️ 전역 영향

`borderRadius`를 아래로 교체 (lg 8→10px, xl/2xl 8→16px):

```js
borderRadius: {
  'DEFAULT': '0.625rem',  // 10px
  'sm': '0.625rem',       // 10px (r-sm)
  'lg': '0.625rem',       // 10px (r-sm)
  'xl': '1rem',           // 16px (r-md)
  '2xl': '1rem',          // 16px
  'full': '9999px',
},
```

- [ ] **Step 5: boxShadow에 elevation-2 추가**

```js
boxShadow: {
  'subtle': '0 2px 10px rgba(0, 0, 0, 0.03)',
  'card': '0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.05)',  // sh-1
  'card-2': '0 6px 24px rgba(15, 23, 42, 0.10), 0 2px 6px rgba(15, 23, 42, 0.06)', // sh-2
},
```

- [ ] **Step 6: dev 서버로 config 반영 확인**

Run: `cd frontend && npm run dev` (이미 떠 있으면 재시작 — tailwind config 변경은 재시작 필요)
Expected: 에러 없이 기동, 메인/목록 페이지에서 브랜드 색이 코발트로 바뀜.

- [ ] **Step 7: 커밋**

```bash
git add frontend/tailwind.config.js
git commit -m "feat(design): 디자인 토큰 코발트 브랜드+중성색+카테고리16+radius2단계 (OD 진화판)"
```

### Task 2: main.css CSS 변수 + 에디토리얼 타입 스케일

**Files:**
- Modify: `frontend/assets/css/main.css`

- [ ] **Step 1: `:root` CSS 변수 블록 추가** (`@tailwind utilities;` 다음 줄에)

```css
:root {
  --paper: #F7F8FA; --surface: #FFFFFF; --surface-2: #FBFCFE;
  --ink: #15213B; --strong: #0C1424; --muted: #56627A; --faint: #677087;
  --border: #E6E9F0; --border-2: #D7DCE7;
  --brand: #2450DC; --brand-strong: #1A3CB0; --brand-tint: #EBF0FE; --brand-ink: #0F2C8C;
  --sh-1: 0 1px 2px rgba(15,23,42,.04), 0 2px 8px rgba(15,23,42,.05);
  --sh-2: 0 6px 24px rgba(15,23,42,.10), 0 2px 6px rgba(15,23,42,.06);
  --r-sm: 10px; --r-md: 16px;
}
```

- [ ] **Step 2: `.text-display-1` 갱신 — hero H1 위계 강화**

기존 `.text-display-1` 블록(26→32px)을 아래로 교체:

```css
.text-display-1 {
  font-size: clamp(1.75rem, 4.5vw, 2.75rem); /* 28→44px */
  line-height: 1.08;
  font-weight: 800;
  letter-spacing: -0.03em;
}
```
(데스크톱 미디어쿼리 override는 제거 — clamp가 대체)

- [ ] **Step 3: `.text-display-2` 갱신 — 섹션 H2 키움**

```css
.text-display-2 {
  font-size: clamp(1.25rem, 2.4vw, 1.5rem); /* 20→24px */
  line-height: 1.15;
  font-weight: 800;
  letter-spacing: -0.02em;
}
```

- [ ] **Step 4: `.text-eyebrow`(kicker) 갱신 — 12px/.14em**

```css
.text-eyebrow {
  font-size: 0.75rem;     /* 12px */
  line-height: 1;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
```

- [ ] **Step 5: dev 육안 확인**

Run: `cd frontend && npm run dev`
Expected: 메인/상세 H1이 더 커지고 eyebrow 라벨 자간이 넓어짐. 레이아웃 깨짐 없음.

- [ ] **Step 6: 커밋**

```bash
git add frontend/assets/css/main.css
git commit -m "feat(design): 에디토리얼 타입 스케일 + CSS 변수 단일화 (OD 진화판)"
```

### Task 3: PR1 전역 시각 회귀 QA

**Files:** (없음 — 검증 전용)

- [ ] **Step 1: lint/test green 확인**

Run: `cd frontend && npm run lint && npm run test`
Expected: PASS (스타일 변경이라 로직 테스트 영향 없음. 실패 시 색/클래스 하드코딩 테스트 스냅샷 확인).

- [ ] **Step 2: 주요 페이지 before/after 스크린샷 (Playwright)**

대상: 메인 `/`, 시설 목록 `/toilet`, 부동산 목록 `/real-estate`, 시설 상세 `/toilet/<id>` (데스크톱 1280 + 모바일 390).
Expected: 브랜드 코발트 톤·둥근모서리·타이포 위계만 바뀌고 레이아웃/기능 회귀 없음.

- [ ] **Step 3: PR1 PR 생성**

```bash
git push -u origin feat/od-design-evolution
# develop ← feat/od-design-evolution PR 생성, CI green 후 머지 (사용자 워크플로우)
```

> 주: PR2는 PR1 머지 후 같은 브랜치(또는 후속 브랜치)에서 진행. 전역 토큰이 먼저 안정화돼야 파일럿 룩이 정확히 검증됨.

---

## PR2 — 파일럿: 시설 상세 OD 룩

> 공통 원칙: 기존 `v-if`/데이터 바인딩/이벤트/컴포넌트 import는 **유지**. class 속성과 마크업 래퍼만 교체. 새 색은 토큰 클래스(`text-strong`·`text-muted`·`border-line`·`bg-surface-2`·`shadow-card` 등) 사용.

### Task 4: 반복 패턴 @layer 컴포넌트 추가

**Files:**
- Modify: `frontend/assets/css/main.css` (`@layer components` 안)

- [ ] **Step 1: `.hero-stats`/`.stile`/`.fcard` 스타일 추가**

OD `facility-detail.html` `<style>`의 해당 규칙을 토큰 변수로 이식:

```css
@layer components {
  /* 4칸 통계 그리드 (PageHero) */
  .hero-stats { display: grid; grid-template-columns: repeat(4, 1fr);
    background: var(--surface); border: 1px solid var(--border); border-radius: var(--r-md); overflow: hidden; }
  .hero-stats .s { padding: 16px 18px; border-right: 1px solid var(--border); }
  .hero-stats .s:last-child { border-right: 0; }
  .hero-stats .k { font-size: 12px; color: var(--faint); font-weight: 600; }
  .hero-stats .v { font-family: 'Public Sans','Pretendard Variable',sans-serif; font-weight: 800;
    font-size: 17px; color: var(--strong); margin-top: 6px; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  @media (max-width: 560px) {
    .hero-stats { grid-template-columns: 1fr 1fr; }
    .hero-stats .s:nth-child(2) { border-right: 0; }
    .hero-stats .s:nth-child(1), .hero-stats .s:nth-child(2) { border-bottom: 1px solid var(--border); }
  }
  /* 현황 타일 (DetailFacilityStatus) */
  .stile { background: var(--surface-2); border: 1px solid var(--border); border-radius: var(--r-sm); padding: 15px 16px; }
  .stile .k { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--muted); font-weight: 600; }
  .stile .v { font-family: 'Public Sans',sans-serif; font-weight: 800; font-size: 18px; color: var(--strong);
    margin-top: 7px; letter-spacing: -.01em; font-variant-numeric: tabular-nums; }
  /* 주변 시설 카드 (DetailNearby) */
  .fcard { display: flex; align-items: flex-start; gap: 13px; background: var(--surface);
    border: 1px solid var(--border); border-radius: var(--r-md); padding: 14px; transition: border-color .18s, box-shadow .18s; }
  .fcard:hover { border-color: color-mix(in srgb, var(--brand) 28%, var(--border)); box-shadow: 0 4px 14px rgba(15,23,42,.06); }
  .fcard .fic { flex: none; width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
    background: color-mix(in srgb, var(--fcat, var(--brand)) 12%, white); color: var(--fcat, var(--brand)); }
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/assets/css/main.css
git commit -m "feat(design): 상세 반복 패턴 hero-stats/stile/fcard @layer 추가"
```

### Task 5: PageHero.vue — 에디토리얼 hero

**Files:**
- Modify: `frontend/components/common/PageHero.vue`

- [ ] **Step 1: eyebrow를 카테고리색 kicker로, stats를 hero-stats 그리드로 교체**

`stats` 렌더 블록을 `.hero-stats`(`.s/.k/.v`) 마크업으로 교체. eyebrow는 `text-eyebrow` 유지하되 색을 `text-primary`→카테고리 가변(`style="color:var(--cat)"`, 부모 `[id].vue`에서 `--cat` 주입)로. H1은 `text-display-1`(이미 강화됨) 유지. props 시그니처(`eyebrow/title/description/stats`)는 불변.

- [ ] **Step 2: dev 확인**

Run: `npm run dev` → `/toilet/<id>` 데스크톱
Expected: eyebrow가 보라(toilet색), H1 커짐, 통계가 4칸 테두리 그리드.

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/common/PageHero.vue
git commit -m "feat(design): PageHero 카테고리 kicker + hero-stats 그리드"
```

### Task 6: DetailFacilityStatus.vue — stile 타일 + amenity chip

**Files:**
- Modify: `frontend/components/facility/detail/DetailFacilityStatus.vue`

- [ ] **Step 1: toilet stall 행을 `.stile` 타일로, feature 카드를 amenity chip(pill)로 교체**

기존 `grid grid-cols-2` feature 카드(`bg-white border ... rounded-lg`)를 OD `.amen` pill로:
```html
<span class="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-surface-light border border-line text-sm font-semibold text-ink">
  <span class="material-symbols-outlined text-[17px]" style="color:var(--cat)">{{ getAmenityIcon(amenity) }}</span>{{ amenity }}
</span>
```
toilet 남/여/소변기 행은 `.stile`로. 나머지 카테고리(parking/library/...)의 `flex justify-between` 행들은 라벨 `text-faint`·값 `text-ink font-semibold`로 색만 토큰화(구조 유지). `border-slate-100`→`border-line`.

- [ ] **Step 2: dev 확인 (toilet + parking 둘 다)**

Run: `npm run dev` → `/toilet/<id>`, `/parking/<id>`
Expected: 화장실 현황이 타일+칩으로, 주차 요금표는 톤만 정제되고 구조 유지.

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/facility/detail/DetailFacilityStatus.vue
git commit -m "feat(design): 시설현황 stile 타일 + amenity chip"
```

### Task 7: DetailBasicInfo.vue — field 톤 정제

**Files:**
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`

- [ ] **Step 1: 색/구분선 토큰화 + 복사 버튼 pill**

전역 치환: `text-gray-600`/`text-gray-500`→`text-faint`, `text-slate-900`→`text-ink font-semibold`(값), `bg-slate-100`(구분선 `h-px`)→`bg-line`, `text-slate-400`(정보없음)→`text-faint`. 주소 복사 버튼을 OD `.copy` pill 룩으로:
```html
<button class="inline-flex items-center gap-1 text-xs text-primary bg-primary-50 px-2.5 py-1 rounded-full" @click="copyAddress">
  <span class="material-symbols-outlined text-[14px]">content_copy</span>복사
</button>
```
데이터/로직/`v-if` 불변.

- [ ] **Step 2: dev 확인**

Run: `npm run dev` → `/toilet/<id>`
Expected: 기본정보 라벨/값 위계 또렷, 복사 버튼이 틴트 pill.

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/facility/detail/DetailBasicInfo.vue
git commit -m "feat(design): 기본정보 토큰 톤 정제 + 복사 pill"
```

### Task 8: DetailNearby.vue — fcard 카드

**Files:**
- Modify: `frontend/components/facility/detail/DetailNearby.vue`

- [ ] **Step 1: 주변 시설 카드를 `.fcard`(원형 카테고리 아이콘 + 거리 강조)로 교체**

각 카테고리 그룹 컨테이너에 `style="--fcat:var(--c-<category>)"` 주입(카테고리색 변수 — Task1에서 `--c-*` 미정의 시 토큰 색 클래스로 대체). 카드 마크업을 OD `.fcard`/`.fic`/`.fbody`/`.frow`/`.fnm`/`.fd.is-close`/`.faddr`/`.fbadges` 구조로. 거리 1km 이내는 `is-close`(브랜드 강조). 클릭 링크·데이터 바인딩 유지.

> `--c-<category>` 변수가 없으면: Task 4 @layer에 `:root { --c-toilet:#7C4DEC; ... }` 16색 추가(앱.css와 동일) 후 사용.

- [ ] **Step 2: dev 확인**

Run: `npm run dev` → `/toilet/<id>` 주변 시설 섹션
Expected: 같은/교차 카테고리 카드가 원형 컬러 아이콘 + 거리 뱃지로 표시.

- [ ] **Step 3: 커밋**

```bash
git add frontend/components/facility/detail/DetailNearby.vue frontend/assets/css/main.css
git commit -m "feat(design): 주변 시설 fcard 카드 + 카테고리 색변수"
```

### Task 9: SectionBlock.vue + MobileDetailHeader.vue 정렬

**Files:**
- Modify: `frontend/components/common/SectionBlock.vue`
- Modify: `frontend/components/facility/detail/MobileDetailHeader.vue`

- [ ] **Step 1: SectionBlock 헤더에 카테고리 아이콘 슬롯 톤 + radius 확인**

`heading` `text-display-3`→`text-display-2` 위계 상향 검토(OD block h2는 더 큼). `rounded-xl`(이미 16px)·`border-line`·`shadow-card` 유지. subtext `text-slate-500`→`text-faint`.

- [ ] **Step 2: MobileDetailHeader 톤 정렬**

`bg-slate-100` 액션 pill 유지하되 텍스트 `text-slate-900`→`text-ink`, eyebrow는 `text-eyebrow`(갱신됨) 그대로. 칩 `bg-slate-100`→`bg-surface-2 border border-line` 검토. 기능/이벤트 불변.

- [ ] **Step 3: dev 확인 (모바일 390 + 데스크톱)**

Run: `npm run dev` → `/toilet/<id>`
Expected: 모바일 헤더·섹션 블록이 새 토큰과 일관.

- [ ] **Step 4: 커밋**

```bash
git add frontend/components/common/SectionBlock.vue frontend/components/facility/detail/MobileDetailHeader.vue
git commit -m "feat(design): SectionBlock/MobileDetailHeader 토큰 정렬"
```

### Task 10: PR2 통합 검증

**Files:** (없음)

- [ ] **Step 1: lint/test green**

Run: `cd frontend && npm run lint && npm run test`
Expected: PASS. (색/클래스 스냅샷 테스트 실패 시 새 토큰 반영해 갱신.)

- [ ] **Step 2: 다중 카테고리 육안 + 스크린샷**

대상: `/toilet/<id>`, `/parking/<id>`, `/hospital/<id>`, `/aed/<id>` (데스크톱+모바일).
Expected: OD `facility-detail.html`와 룩 일치, 카테고리별 색 정확, 기능(길찾기/공유/복사/지도/광고) 정상.

- [ ] **Step 3: 기능 무결성 수동 확인**

길찾기 드롭다운, 주소 복사, 공유, 지도 확대(모바일), 광고 슬롯 렌더 — 회귀 없음 확인.

- [ ] **Step 4: PR2 PR 생성 → CI green → 머지**

```bash
git push
# develop ← PR, CI green 후 머지
```

---

## Self-Review (작성자 점검)

- **스펙 커버리지:** 토큰(색/radius/shadow/타입) → Task 1–2 ✓. 파일럿 6개 컴포넌트 → Task 5–9 ✓. 반복 패턴 @layer → Task 4 ✓. 검증(dev+스크린샷+lint/test+기능) → Task 3,10 ✓. 확산(레이어3)은 스펙상 범위 밖 — 플랜 미포함(의도적).
- **플레이스홀더:** 토큰 값은 전부 실제 헥스로 명시. 컴포넌트 작업은 "OD 클래스→토큰 클래스" 구체 매핑 제공(전체 템플릿 복제는 생략 — 기존 v-if 다수 유지가 핵심이라 치환 규칙이 더 정확).
- **타입 일관성:** `--cat`/`--fcat` 변수명, 토큰 클래스(`text-ink/muted/faint`, `border-line`, `bg-surface-2`, `shadow-card/card-2`)를 PR 전체에서 동일 사용.
- **주의:** Task 8의 `--c-<category>` 16색 변수는 Task 4(@layer)에서 `:root`에 정의 후 사용 — 의존성 명시됨.
