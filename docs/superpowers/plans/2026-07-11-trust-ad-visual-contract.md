# 광고 시각 계약 (신뢰 디자인 격상 PR ④) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 광고를 본문과 시각적으로 구분되게 만든다 — `AdBanner`에 "광고" 라벨 + 점선 테두리 + surface-2 배경을 추가하되, 슬롯 수·위치·collapse·CLS는 전부 불변으로 유지한다.

**Architecture:** 변경은 단일 컴포넌트 `frontend/components/ads/AdBanner.vue` 내부에서만 한다(template 1줄 + style 소규모). 32개 페이지의 `<AdBanner>` 인라인 배치는 손대지 않으므로 시각 처리가 전 페이지에 자동 전파되고 슬롯 수·위치·order는 불변이다. CoupangBanner는 이번 범위 밖(이미 파트너스 고지문 `<p>`가 광고 고지 역할).

**Tech Stack:** Nuxt 3 + Vue 3 (script setup), TailwindCSS(OD 토큰), Vitest

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §5-7 (광고 시각 계약). §5-8 마이크로카피는 **사용자 결정으로 이 PR에서 분리** — 별도 후속 PR.

## Global Constraints

- **Node 20 필수**: 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **광고 정책 불변 (사용자 정책 — feedback_adbanner_placement)**: AdBanner 슬롯 개수·위치·order·collapse 정책·고정 높이(fixed 280)를 절대 변경하지 않는다. 변경은 **라벨·테두리·배경 등 시각 처리 + CLS 보존용 min-height 조정**뿐. 페이지 파일(`pages/**/*.vue`) 편집 금지.
- **CLS 중립**: 라벨 strip(20px) + 테두리(2px) = 22px 만큼 min-height를 상향해 **광고 자체의 예약 영역을 원래 값 그대로 유지**한다(광고가 채워질 공간 불변 → shift 0).
- **슬롯 측정 폭 불변**: 세로 처리(라벨·세로 방향)만. **가로 padding 금지**(광고 측정 폭이 줄어 광고 크기가 바뀜). 1px 테두리의 좌우 2px 축소는 안정·무해로 허용.
- **collapse 편승**: 라벨·테두리·배경은 `.ad-banner`의 자식/속성이므로 기존 collapse 셀렉터(`display:none`)에 자동 편승한다 — collapse 로직은 건드리지 않는다(유령 라벨 방지).
- **SEO/SSR 불변**: `.ad-banner` div는 SSR 렌더되어 "광고" 텍스트가 SSR HTML에 노출되나 span 평문이라 h1·title·meta·canonical·noindex·섹션순서 불변식과 무관, thin-content 아님.
- **토큰 재사용**: `--surface-2`(#FBFCFE)·`--border`(#E6E9F0)·`--faint`는 `main.css`에 실재. 신규 토큰 금지.
- **커밋**: conventional commit 한국어 (`feat(trust): ...`). PR은 develop 대상, 자체 머지 금지.

## 브랜치

Task 1 Step 1에서 생성:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b feat/trust-ad-visual-contract
```

---

### Task 1: AdBanner "광고" 라벨 + 점선 테두리 + surface-2 배경 (CLS 중립)

**Files:**
- Modify: `frontend/components/ads/AdBanner.vue`
  - template: `.ad-banner` div 여는 태그(line 12 `>`) 직후, `<ClientOnly>`(line 13) 앞에 라벨 span
  - style: `.ad-banner` base 규칙 신설(현재 base 규칙 없음, 모디파이어만 존재) + `.ad-banner__label` 규칙 + 5개 min-height 값 +22px 상향
- Test: `frontend/tests/components/ads/AdBanner.test.ts` (기존, 케이스 추가)

**Interfaces:**
- Consumes: 없음 (기존 `shouldShow`, `effectiveAdFormat`, collapse 클래스)
- Produces: 없음

**현재 구조 (확인됨):**
- template line 2-25: `<div v-if="shouldShow" ... :class="['ad-banner', ...]">` → `<ClientOnly><ins class="adsbygoogle">`.
- style: `.ad-banner` **base 규칙 없음**. 모디파이어 min-height: `--auto` 100px(모바일 ≤767px 280px), `--horizontal` 90px, `--rectangle` 250px, `--compact-mobile` 150px. collapse: `--timed-out`·`:has(unfilled/unfill-optimized)` → `display:none; min-height:0 !important`.
- `sizing='fixed'` 경로(insStyle line 93-97): ins에 인라인 `height:${fixedHeight}px` 직접 부여(예 rectangle 280). 이 경로는 CSS min-height를 안 쓰고 ins 자체 높이로 예약 → 라벨은 chrome만 얹고 광고 높이 불변이라 **min-height 조정 대상 아님**(자동 CLS-safe).

- [ ] **Step 1: 브랜치 생성** (위 "브랜치" 블록 실행)

- [ ] **Step 2: 실패 테스트 추가(RED)** — `AdBanner.test.ts`에 (기존 mount 패턴 재사용):

```ts
it('"광고" 라벨을 .ad-banner 내부에 렌더한다', () => {
  const w = mountAdBanner() // 기존 테스트의 mount 헬퍼/패턴
  const banner = w.find('.ad-banner')
  expect(banner.exists()).toBe(true)
  const label = banner.find('.ad-banner__label')
  expect(label.exists()).toBe(true)
  expect(label.text()).toBe('광고')
})

it('라벨은 .ad-banner의 자식이라 collapse 시 부모와 함께 숨겨진다 (독립 최상위 요소가 아니다)', () => {
  const w = mountAdBanner()
  // 라벨이 .ad-banner 밖 형제로 새면 collapse(부모 display:none)를 안 타 유령 라벨이 됨
  expect(w.find('.ad-banner > .ad-banner__label').exists()).toBe(true)
})
```
(기존 테스트가 `shouldShow=true`가 되도록 shouldServeAds mock/환경을 이미 세팅했으면 그대로. mount 헬퍼가 없으면 기존 테스트의 인라인 mount 패턴을 그대로 복사.)

```bash
cd frontend && npx vitest run tests/components/ads/AdBanner.test.ts
```
Expected: FAIL — 라벨 미존재

- [ ] **Step 3: template 라벨 삽입** — `AdBanner.vue` line 12 `>` 직후, line 13 `<ClientOnly>` 앞:

```html
    <span class="ad-banner__label">광고</span>
```
(반드시 `.ad-banner` div의 첫 자식. `<ClientOnly>` 밖·`.ad-banner` 안.)

- [ ] **Step 4: style 규칙 추가·조정** — `<style>` 블록 상단(`.ad-banner--auto` 앞)에 base + 라벨 규칙 신설:

```css
.ad-banner {
  position: relative;
  border: 1px dashed var(--border);
  background: var(--surface-2);
}
.ad-banner__label {
  display: block;
  height: 20px;
  line-height: 20px;
  padding: 0 10px;           /* 가로 padding은 라벨에만 — ins 폭 측정에 무관(라벨은 ins 위 별도 블록) */
  font-size: 11px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--faint);
}
```

각 모디파이어 min-height를 **+22px**(라벨 20 + 테두리 2, border-box 기준 광고 예약 영역 보존):

```css
.ad-banner--auto { min-height: 122px; }        /* 100 → 122 */
@media (max-width: 767px) {
  .ad-banner--auto { min-height: 302px; }       /* 280 → 302 */
}
.ad-banner--horizontal { min-height: 112px; }   /* 90 → 112 */
.ad-banner--rectangle { min-height: 272px; }    /* 250 → 272 */
.ad-banner--compact-mobile { min-height: 170px; text-align: center; } /* 150 → 170 */
```
(collapse 규칙 268-285은 **변경 금지** — `.ad-banner`를 통째로 `display:none`하므로 base 테두리·배경·라벨 전부 편승해 사라진다.)

- [ ] **Step 5: min-height 회귀 가드 테스트 추가** — `AdBanner.test.ts`에 소스 값 락(리팩터로 실수 상향/하향 방지). 컴포넌트 SFC 소스를 읽어 min-height 값을 assert하거나, 렌더된 요소의 클래스 존재만 확인(값은 CSS라 jsdom에서 computed 안 나올 수 있음 — 소스 문자열 assert가 확실):

```ts
import { readFileSync } from 'node:fs'
it('min-height는 CLS 보존을 위해 라벨+테두리(22px)만큼 상향된 값을 유지한다', () => {
  const src = readFileSync(new URL('../../../components/ads/AdBanner.vue', import.meta.url), 'utf-8')
  expect(src).toContain('.ad-banner--auto { min-height: 122px;')
  expect(src).toContain('min-height: 302px;')   // 모바일 auto
  expect(src).toContain('.ad-banner--horizontal { min-height: 112px;')
  expect(src).toContain('.ad-banner--rectangle { min-height: 272px;')
  expect(src).toContain('.ad-banner--compact-mobile { min-height: 170px;')
})
```
(정확한 문자열은 Step 4에서 실제 작성한 포맷과 일치시킬 것. 목적은 값 회귀 가드.)

- [ ] **Step 6: 테스트 통과 + 슬롯 수 락 확인**

```bash
npx vitest run tests/components/ads/AdBanner.test.ts tests/components/ads/CoupangBanner.test.ts && npx vitest run tests/**/detailAdDensity* 2>&1 | tail -8
```
Expected: 전체 PASS. **detailAdDensity(시설 5 / 부동산 4)·CoupangBanner(2/page) 슬롯 수 테스트가 그대로 통과** — 라벨 추가는 소스 `<AdBanner` 개수·루트 classes·ins 셀렉터를 안 바꾸므로 불변. (해당 테스트 파일명이 다르면 `grep -rl "detailAdDensity\|AdBanner" tests/`로 확인.)

- [ ] **Step 7: 커밋**

```bash
git add components/ads/AdBanner.vue tests/components/ads/AdBanner.test.ts
git commit -m "feat(trust): 광고 배너에 '광고' 라벨 + 점선 테두리 + surface-2 배경 (본문과 시각 구분, CLS 중립)"
```

---

### Task 2: 전체 검증 + PR 생성

**Files:** 없음

- [ ] **Step 1: lint + 전체 테스트 (양쪽)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | tail -4
```
Expected: lint 신규 오류 0, 전체 PASS. 만약 SearchAutocomplete/localStorage 계열 flaky 실패가 보이면 **클린 재실행으로 확인**(이 저장소 알려진 flaky, 광고 변경과 무관). `git diff develop --stat -- '**/package-lock.json'` 결과 없음 확인.

- [ ] **Step 2: CLS·시각 스폿체크 (dev 서버 또는 e2e 가능 시)**

- e2e ad-cls 테스트가 있으면 실행(`grep -rl "ad-cls\|CLS" frontend/tests/e2e frontend/e2e 2>/dev/null`) — fixed 280 배너 포함 CLS < 0.15 유지 확인. 없으면 dev 서버에서 시설 상세·부동산 상세를 열어 육안 확인:
  - 광고 위 "광고" 라벨 + 점선 테두리 + 옅은 배경으로 본문과 구분됨
  - 광고 로드 전/후 레이아웃 점프 없음(min-height 예약 유지)
  - 미충전 슬롯은 여전히 collapse(빈 박스·유령 라벨 없음)
  - 모바일 390px에서 가로 넘침 없음, 광고 폭 정상

- [ ] **Step 3: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-ad-visual-contract
gh pr create --base develop \
  --title "feat(trust): 광고 시각 계약 — '광고' 라벨 + 경계 (PR ④)" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) Phase 1 PR ④ — §5-7 광고 시각 계약.
광고를 본문과 시각적으로 구분: AdBanner에 "광고" 라벨 + 점선 테두리 + surface-2 배경.

- 변경은 단일 컴포넌트 `AdBanner.vue` 내부만 (template 1줄 + style). 32개 페이지 자동 반영, 페이지 파일 미편집.
- CLS 중립: 라벨(20px)+테두리(2px)=22px 만큼 min-height 상향해 광고 예약 영역 보존.

## 불변식 (광고 정책 — feedback_adbanner_placement)
- 슬롯 개수·위치·order·collapse 정책·fixed 280 높이 전부 불변 (시각 처리 + CLS 보존 min-height만)
- 슬롯 측정 폭 불변(가로 padding 없음, 세로/테두리만), collapse 편승(유령 라벨 없음)
- SEO/SSR: "광고" 평문 span, h1/title/meta/섹션순서 무관. Node 20, package-lock 무변경.

## 근거
- NN/g: 신뢰 손상은 광고량이 아니라 "콘텐츠 위장·재배치". Stanford #9: 스폰서 콘텐츠 명확 구분.

## 테스트
- 신규: 라벨 렌더·라벨이 .ad-banner 자식(collapse 편승)·min-height 값 회귀 가드
- 슬롯 수 락(detailAdDensity 5/4, CoupangBanner 2/page) 그대로 통과, frontend vitest 전체 PASS, lint 0

## 범위 외 (사용자 결정)
- §5-8 마이크로카피(어미·금액·날짜·빈값)는 별도 PR로 분리 (전면 적용은 SEO 위험·비현실적)
- CoupangBanner 시각 정렬: 이미 파트너스 고지문이 광고 고지 역할 → 선택적 후속
EOF
)"
```
Expected: PR URL. CI green 확인 후 사용자 머지 판단.

---

## 플랜 메모

- **CoupangBanner 제외 근거**: 이미 파트너스 고지문 `<p>`(PR③ disclosure prop)가 광고 고지 역할을 하므로 "광고" 라벨이 중복. border-slate-200→토큰 정렬은 순수 시각 nicety라 선택적 후속. 사용자 "광고 시각 계약만·tight" 결정에 맞춰 AdBanner만.
- **fixed 높이 배너**: `sizing='fixed'`는 ins에 인라인 height를 직접 줘 광고 높이가 고정 → 라벨은 chrome만 얹고 광고 높이 불변(자동 CLS-safe). CSS min-height 상향 대상은 min 기반 4포맷(auto/horizontal/rectangle/compact-mobile)뿐.
- **후속 트랙**: PR ⑤ 마이크로카피 안전 항목(빈값 '정보 없음·현장 확인 필요' 통일 / 날짜 대시→점 SourceStamp 일치 / 표 2자리 연도 / 금액 만원-입력 dedup) — 어미 해요체 전면 통일은 SEO 위험이라 생성기 프롬프트 수정(향후 콘텐츠)으로 한정. → PR ⑥~⑧ Phase 2(숫자 타이포+카운터 밴드 / 히어로+헤더+GNB C안 / 로고 코발트).
