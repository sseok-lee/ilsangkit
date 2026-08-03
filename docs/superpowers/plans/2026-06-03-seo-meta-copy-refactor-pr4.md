# SEO 메타 리팩터 PR4 — 화면 카피·용어·메시지 통일 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 화면에 보이는 카피(빈상태/로딩/에러 메시지, 용어, 브레드크럼 라벨, 띄어쓰기)를 단일 규칙 아래 통일한다.

**Architecture:** 신규 `utils/uiMessages.ts`에 빈상태/로딩/에러 사전(마침표 없음)을 두고 흩어진 문자열을 상수 참조로 교체. 용어(`인근→주변`, `모집 공고→모집공고`), 띄어쓰기(붙임), 브레드크럼 표준 라벨, 푸터 태그라인(SITE_TAGLINE)을 정리.

**Tech Stack:** Nuxt 3, Vitest. 테스트: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run <path>`.

**Spec:** `docs/superpowers/specs/2026-06-03-seo-meta-copy-refactor-design.md` §3.2, §3.3, §3.4, §6.4

**선행:** PR1(SITE_TAGLINE 존재) 필요(Task 6 푸터).

---

## 파일 구조

- Create: `frontend/utils/uiMessages.ts`
- Modify (메시지): `search.vue`, `[category]/index.vue`, `subway/index.vue`, `components/facility/FacilityList.vue`, `components/subscription/SubscriptionListView.vue`·`PublicRentalListView.vue`·`PublicRentalNearbyComplexes.vue`, `guide/index.vue`, `public-rental/announcements/index.vue`, `components/region/RegionFacilitiesGrid.vue`·`RegionTrashSchedule.vue`, `components/realEstate/NearbyFacilities.vue`·`TransactionTable.vue`·`PriceTrendChart.vue`, `components/map/FacilityBottomSheet.vue`, 외 로딩/에러 사용처
- Modify (용어): `components/facility/detail/DetailNearby.vue`, `components/subscription/PublicRentalNearbyComplexes.vue`, `components/subscription/PublicRentalApplyGuide.vue`
- Modify (띄어쓰기): `전체 보기` 사용처(home 컴포넌트들·subscription·subway), heading `역 정보`·`생활시설 현황`
- Modify (브레드크럼): `subscription/*` `setBreadcrumbSchema` name 인자, real-estate 하위 페이지
- Modify (푸터/거래가): `components/common/AppFooter.vue`, `[buildingName].vue` 요약블록
- Test: `frontend/tests/utils/uiMessages.test.ts`

---

## Task 1: uiMessages.ts 사전 생성

**Files:**
- Create: `frontend/utils/uiMessages.ts`
- Test: `frontend/tests/utils/uiMessages.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/utils/uiMessages.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'

describe('UI_MESSAGES', () => {
  it('고정 메시지에 마침표가 없다', () => {
    Object.values(UI_MESSAGES).forEach(msg => {
      expect(msg.endsWith('.')).toBe(false)
    })
  })
  it('검색 빈상태 / 로딩 / 에러 표준 문구', () => {
    expect(UI_MESSAGES.emptySearch).toBe('검색 결과가 없습니다')
    expect(UI_MESSAGES.loading).toBe('불러오는 중…')
    expect(UI_MESSAGES.fetchError).toBe('데이터를 불러오는 중 오류가 발생했습니다')
    expect(UI_MESSAGES.notFound).toBe('요청한 정보를 찾을 수 없습니다')
  })
  it('emptyFiltered는 대상별 문구를 만든다', () => {
    expect(emptyFiltered('청약')).toBe('조건에 맞는 청약이 없습니다')
    expect(emptyFiltered('매물')).toBe('조건에 맞는 매물이 없습니다')
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/uiMessages.test.ts`
Expected: FAIL — 모듈 없음.

- [ ] **Step 3: 구현**

`frontend/utils/uiMessages.ts`:

```typescript
/** 화면 공통 메시지 사전 — 한 줄 상태문은 마침표 없음(spec §3.3). */
export const UI_MESSAGES = {
  emptySearch: '검색 결과가 없습니다',
  loading: '불러오는 중…',
  fetchError: '데이터를 불러오는 중 오류가 발생했습니다',
  notFound: '요청한 정보를 찾을 수 없습니다',
} as const

/** 필터 목록 빈상태: 조건에 맞는 {대상}이 없습니다 */
export function emptyFiltered(target: string): string {
  return `조건에 맞는 ${target}이 없습니다`
}
```

- [ ] **Step 4: 통과 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/uiMessages.test.ts`
Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/uiMessages.ts frontend/tests/utils/uiMessages.test.ts
git commit -m "feat(copy): add uiMessages dictionary (empty/loading/error, no period)"
```

---

## Task 2: 빈상태 메시지 통일

**Files (교체 대상, 조사 기준):**
- `search.vue:255,340,369`, `[category]/index.vue:183`, `subway/index.vue:89`, `components/facility/FacilityList.vue:26` → `UI_MESSAGES.emptySearch`
- `SubscriptionListView.vue:58`(`조건에 맞는 청약이 없습니다`) → `emptyFiltered('청약')`
- `PublicRentalListView.vue:31`(`조건에 맞는 매물이 없습니다`) → `emptyFiltered('매물')`
- `guide/index.vue:97` → `emptyFiltered('가이드')`
- `public-rental/announcements/index.vue:54`(`해당 조건의 모집공고가 없습니다.`) → `emptyFiltered('모집공고')`
- `RegionFacilitiesGrid.vue:29`(`해당 지역에 등록된 시설이 없습니다.`) / `NearbyFacilities.vue:8` / `FacilityBottomSheet.vue:41` → `UI_MESSAGES.emptySearch` 또는 `emptyFiltered('시설')` (문맥상 후자)
- `TransactionTable.vue:53` / `[buildingName].vue:284`(`거래 내역이 없습니다.`) → `emptyFiltered('거래 내역')` 또는 전용 문구 `거래 내역이 없습니다`(마침표 제거)

- [ ] **Step 1:** 각 파일에서 `~/utils/uiMessages` import 추가 후 위 매핑대로 문자열 교체(마침표 포함 변형은 마침표째 제거).
- [ ] **Step 2:** 영향 컴포넌트 테스트가 있으면 갱신.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run`
Expected: PASS(빈상태 문구 검증 테스트가 깨지면 신 문구로 갱신).
- [ ] **Step 3:** 커밋 `git commit -m "refactor(copy): unify empty-state messages via uiMessages"`

---

## Task 3: 로딩 / 에러 메시지 통일

**Files:** `로딩 중...`(`[category]/[id].vue:9`, `subway/[slug].vue:8`, `[buildingName].vue:7`) + `불러오는 중…`/`…` 변형(`guide/index.vue:45`, `guide/[slug].vue:7`, `RegionFacilitiesGrid.vue:12`, `announcements/index.vue:51`, `[pblancId].vue:4`, `[buildingName].vue:37`) → 전부 `UI_MESSAGES.loading`. 에러(`real-estate/[realEstateType]/index.vue:50`, `SubscriptionListView.vue:43`, `PublicRentalListView.vue:21`, `[city]/index.vue:91`, `[city]/[district]/index.vue:55`) → `UI_MESSAGES.fetchError`. 404 본문(`ErrorBoundary.vue:119`) → `UI_MESSAGES.notFound`.

- [ ] **Step 1:** 각 파일 import + 교체.
- [ ] **Step 2:** 전체 테스트.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run`
Expected: PASS.
- [ ] **Step 3:** 커밋 `git commit -m "refactor(copy): unify loading/error messages"`

---

## Task 4: 용어 통일 — 인근→주변, 모집 공고→모집공고

**Files:**
- `components/facility/detail/DetailNearby.vue:7,37` — 부제 `인근 시설입니다` → `주변 시설입니다` (제목은 이미 `주변 {label}`이므로 정합)
- `components/subscription/PublicRentalNearbyComplexes.vue:2` — `${regionLabel} 인근 공공임대 단지` → `${regionLabel} 주변 공공임대 단지`
- `[buildingName].vue:300` 주석/섹션 `인근 단지` → `주변 단지`
- `components/subscription/PublicRentalApplyGuide.vue:2` — `모집 공고` → `모집공고`

(카테고리 설명 본문의 `내 주변`은 유지 — spec §3.2.)

- [ ] **Step 1:** 위 4개 문자열 교체.
- [ ] **Step 2:** 관련 컴포넌트 테스트 있으면 갱신 + 전체 테스트.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run`
Expected: PASS.
- [ ] **Step 3:** 커밋 `git commit -m "refactor(copy): 인근→주변 (labels/headings), 모집 공고→모집공고"`

---

## Task 5: 띄어쓰기 통일 (붙임 우선) — CTA·제목

**Files:**
- CTA `전체 보기 →` → `전체보기 →`: `subscription/index.vue:45,72`, `components/home/HomeMarketStats.vue:11`, `HomeTrendingBuildings.vue:11`, `HomeHotspotSignals.vue:15`, `HomeSubscriptionSection.vue:12`, `subway/[slug].vue:396`
- 제목 복합명사 붙임: `역 정보`(`subway/[slug].vue:117`) → `역정보`, `생활시설 현황`(`RegionFacilityCategoryGrid.vue:5`, `[city]/[district]/index.vue:31`) → `생활시설현황`. (`기본정보`·`시설현황`은 이미 붙임 — 유지.)

- [ ] **Step 1:** 위 문자열 교체. (`더보기`는 이미 붙임 — 변경 없음.)
- [ ] **Step 2:** 전체 테스트.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run`
Expected: PASS.
- [ ] **Step 3:** 커밋 `git commit -m "refactor(copy): 띄어쓰기 붙임 통일 (전체보기, 역정보, 생활시설현황)"`

---

## Task 6: 브레드크럼 표준 라벨 + 관련네비 제목 + 푸터 태그라인 + 거래가

**Files & 변경:**
- `subscription/index.vue:235`, `sale/index.vue:66-68`, `rent/[type].vue:86-88` 등 — `setBreadcrumbSchema` 2단계 name을 **`청약 정보`로 통일**(이미 일부는 `청약 정보` 사용 — 나머지를 맞춤). `<Breadcrumb>` 컴포넌트 label도 동일.
- real-estate 하위 페이지(`[realEstateType]/index.vue:385` 등) breadcrumb `부동산` → `부동산 실거래가`로 통일.
- 관련네비 제목 2종 정리: `이 지역 다른 카테고리`/`같은 지역 시설`(`RegionRelatedCategories.vue:2`, `DetailContextLinks.vue:12,37`) → 교차 이동은 `관련 탐색`, 가이드/에디토리얼은 `관련 정보`. (subway/[category] 등 기존 `관련 탐색` 유지.)
- 푸터 태그라인 `AppFooter.vue:11-13`(`생활 속 필요한 공공시설 정보와<br>부동산 실거래가를 한 곳에서.`) → `SITE_TAGLINE` 참조: `{{ SITE_TAGLINE }}` (import 추가). (PR1의 `SITE_TAGLINE = '부동산 실거래가·청약·내 주변 생활정보'`)
- `[buildingName].vue:220,224`(`최고 거래가`/`최저 거래가`) vs `:843`(`최근 매매가`) → 요약블록 명사 `거래가`로 통일(`최근 거래가`).

- [ ] **Step 1:** 위 변경 적용. 푸터는 `import { SITE_TAGLINE } from '~/utils/seoConstants'` 추가.
- [ ] **Step 2:** breadcrumb 관련 테스트/스냅샷 있으면 갱신 + 전체 테스트.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run && npm run lint`
Expected: PASS.
- [ ] **Step 3:** 커밋 `git commit -m "refactor(copy): breadcrumb 라벨·관련네비 제목·푸터 태그라인·거래가 통일"`

---

## Task 7: PR4 최종 검증 + PR 생성

- [ ] **Step 1:** 전체 테스트 + 린트 + 타입체크.
Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run && npm run lint && npx nuxi typecheck`
- [ ] **Step 2:** 잔여 변형 스캔 — `grep -rn '인근\|로딩 중\.\.\.\|모집 공고\|전체 보기' frontend/pages frontend/components` 로 누락 없는지 확인(본문 `내 주변` 제외).
- [ ] **Step 3:** PR 생성 + CI 통과 후 머지(ground-truth 재확인).

```bash
gh pr create --base develop --title "refactor(copy) PR4: 화면 카피·용어·메시지 통일" --body "spec §3.2~3.4, §6.4"
```

---

## Self-Review 메모
- **Spec 커버리지**: §3.3(메시지 사전·마침표 없음) ✓ Task1~3 / §3.2(인근→주변, 생활 정보 유지) ✓ Task4 / §3.4(띄어쓰기 붙임) ✓ Task5 / §6.4(브레드크럼·관련네비·푸터·거래가) ✓ Task6.
- **잔여 변형 방지**: Task7 Step2의 grep 스캔으로 누락 검출.
- **주의**: 빈상태 문구를 바꾸면 기존 컴포넌트 테스트의 문자열 기대값이 깨질 수 있음 → 신 문구로 갱신(프로젝트 규약: 기존 실패 테스트 즉시 수정).
- **의존**: 푸터 태그라인(Task6)은 PR1의 `SITE_TAGLINE` 필요.
