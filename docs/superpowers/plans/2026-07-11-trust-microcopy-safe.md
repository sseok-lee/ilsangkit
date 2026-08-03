# 마이크로카피 안전 정제 (신뢰 디자인 격상 PR ⑤) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 마이크로카피 §5-8 중 **SEO 중립·저위험 항목만** 적용한다 — 빈값 문구 통일, 본문 날짜 점포맷 통일(SourceStamp와 일치), 표 2자리 연도, 안전한 금액 dedup. 어미 전면 통일·금액 계열 통합 같은 SEO 위험 항목은 제외.

**Architecture:** 전부 프론트엔드 표시 텍스트 정제. 기존 유틸(`formatDotDate`·`formatKoreanPrice`)을 단일 소스로 재사용하고, 신규는 상수 1개(`EMPTY_FIELD_TEXT`)·유틸 1개(`formatDotDateShort`)만. 이미 구현된 degrade(섹션 접기)·표 셀 '-'·hide-when-empty 방식은 손대지 않는다.

**Tech Stack:** Nuxt 3 + Vue 3 (script setup), TailwindCSS, Vitest

**Spec:** `docs/superpowers/specs/2026-07-10-trust-design-elevation-design.md` §5-8 (항목1 어미·항목5 생성문체는 **범위 외** — 후속)

## Global Constraints

- **Node 20 필수**: 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`. `package-lock.json` 삭제·재생성 금지.
- **SEO/SSR 불변**: URL·단일 h1·title/meta·canonical·noindex·구조화데이터(schema.org Date)·섹션 순서·광고 슬롯 불변. **표시 텍스트 정제만** — 색인된 문자열의 의미(어미·단위·형식)를 바꾸지 않는다.
- **날짜 절대 불변(메타/스키마 — dash 유지)**: `composables/useStructuredData.ts` datePublished/dateModified(`formatKstDate`, schema ISO), `pages/subscription/[id].vue` slice(0,10)(SEO/OG description), `buildingName.vue`의 `${year}-${month}-01`(schema). **이 3곳은 절대 건드리지 않는다.**
- **degrade·예외 유지**: 이미 구현된 섹션 접기 degrade(hasFacilityStatus/hasGridContent/parkHasFacilities/카테고리 게이트), 표 셀 '-'(DetailFacilityStatus 400-402·700), EvChargerDetail/DetailNearby의 hide-when-empty 방식은 **손대지 않는다**(스펙 §5-8 항목1 "표 셀·라벨 제외" + degrade는 완료).
- **금액 의미 변경 금지**: byte-identical dedup + 동일 로직 함수 통합만. formatKoreanPrice로의 delegation이 `'만'↔'만원'`·`'5억'↔'5억원'`·nbsp·round로 **텍스트를 바꾸면 제외**.
- **커밋**: conventional commit 한국어 (`feat(trust): ...`). PR은 develop 대상, 자체 머지 금지.
- **flaky 주의**: SearchAutocomplete/localStorage 테스트가 병렬 실행서 간헐 실패 — 클린 재실행으로 확인, 이 PR과 무관.

## 브랜치

Task 1 Step 1에서 생성:
```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull origin develop
git checkout -b feat/trust-microcopy-safe
```

---

### Task 1: 빈값 문구 통일 (`정보 없음 · 현장 확인 필요`)

**Files:**
- Create: `frontend/utils/emptyField.ts` — `EMPTY_FIELD_TEXT` 상수
- Modify: `frontend/components/facility/detail/DetailBasicInfo.vue`(빈값 span 41곳), `frontend/components/facility/detail/DetailFacilityStatus.vue`(39곳), `frontend/components/facility/detail/FieldGrid.vue`(1곳)
- Test: `frontend/tests/components/facility/detail/FieldGrid.test.ts` (기존, 케이스 추가)

**Interfaces:**
- Consumes: 없음
- Produces: `EMPTY_FIELD_TEXT = '정보 없음 · 현장 확인 필요'` (`~/utils/emptyField`)

**기지 사실(recon):** 빈 필드는 이미 100% `<span v-else class="text-sm|text-xs text-slate-400">정보 없음</span>` 인라인 리터럴로 통일됨(공란/'-'/미제공 혼재 없음). 총 81곳. 표 셀 '-'·EvCharger/Nearby hide 방식은 **제외**(현행 유지).

- [ ] **Step 1: 브랜치 생성** (위 블록)

- [ ] **Step 2: 상수 생성** — `frontend/utils/emptyField.ts`:

```ts
/** 시설 상세 빈 필드 표시 문구 (스펙 §5-8 항목4) — 드리프트 방지 단일 소스 */
export const EMPTY_FIELD_TEXT = '정보 없음 · 현장 확인 필요'
```

- [ ] **Step 3: 실패 테스트 추가(RED)** — `FieldGrid.test.ts`에 (기존 mount 패턴 재사용):

```ts
it('빈 값은 "정보 없음 · 현장 확인 필요" 전체 문구로 렌더한다', () => {
  const w = mount(FieldGrid, { props: { label: '운영시간', value: null, alwaysShow: true } }) // 기존 테스트의 실제 props 형태에 맞출 것
  expect(w.text()).toContain('정보 없음 · 현장 확인 필요')
})
```

```bash
cd frontend && npx vitest run tests/components/facility/detail/FieldGrid.test.ts
```
Expected: FAIL — 아직 '정보 없음'만

- [ ] **Step 4: 3개 파일 텍스트 교체** — 세 파일에서 빈값 span의 `정보 없음` 리터럴을 `EMPTY_FIELD_TEXT`로. 각 파일 script에 `import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'` 추가. 방법:
  - FieldGrid.vue: `<p v-else class="...">{{ EMPTY_FIELD_TEXT }}</p>` (단일 앵커)
  - DetailBasicInfo.vue·DetailFacilityStatus.vue: `>정보 없음<` → `>{{ EMPTY_FIELD_TEXT }}<` 일괄 (sed로 안전 치환 후 검토: `grep -c '정보 없음' ...`로 잔존 0 확인). **표 셀 '-'(DetailFacilityStatus 400-402·700)는 치환 대상 아님** — '정보 없음' 문자열이 아니므로 자동 제외되나 최종 확인.

- [ ] **Step 5: 테스트 통과 + 잔존 확인**

```bash
npx vitest run tests/components/facility/detail/ && grep -rn ">정보 없음<\|>정보 없음 <" components/facility/detail/ | grep -v "현장 확인" | wc -l   # 0이어야 함
```
Expected: 전체 PASS, 미치환 '정보 없음' 0. (기존 `toContain('정보 없음')` 테스트는 substring이라 그대로 통과.)

- [ ] **Step 6: 커밋**

```bash
git add utils/emptyField.ts components/facility/detail/DetailBasicInfo.vue components/facility/detail/DetailFacilityStatus.vue components/facility/detail/FieldGrid.vue tests/components/facility/detail/FieldGrid.test.ts
git commit -m "feat(trust): 시설 상세 빈 필드 문구를 '정보 없음 · 현장 확인 필요'로 통일 (단일 상수)"
```

**주의(승격 후 확인):** 문구가 5자→13자로 길어져 text-xs 2열 grid(관리기관/설치일 등)에서 줄바꿈 가능 → main 승격 후 모바일 390px 오버플로 스캔.

---

### Task 2: DataSourceSection 본문 날짜 대시→점

**Files:**
- Modify: `frontend/pages/[category]/[id].vue`(약 648, lastSyncDate computed), `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`(약 776), `frontend/pages/trash/[id].vue`(약 338), `frontend/pages/subway/[slug].vue`(약 216 인라인), `frontend/pages/subscription/[id].vue`(약 390 인라인)

**Interfaces:**
- Consumes: 기존 `formatDotDate`(`~/utils/syncFreshness`)
- Produces: 없음

**기지 사실(recon):** DataSourceSection의 '최근 동기화' 행이 본문 컨텍스트인데 5개 호출처가 전부 `formatKstDate`(대시 YYYY-MM-DD)를 먹여, 같은 페이지 SourceStamp(점 YYYY.MM.DD)와 **가시 불일치**. prop 계약(`lastSyncDate` preformat 문자열)은 유지하고 호출처 유틸만 교체.

- [ ] **Step 1: 5개 호출처 교체** — 각 파일에서 DataSourceSection에 넘기는 `lastSyncDate` 산출을 `formatKstDate(...)` → `formatDotDate(...)`로. import를 `~/utils/formatters`→`~/utils/syncFreshness`로(또는 syncFreshness import 추가). **주의**:
  - subscription/[id].vue: **541·563행 slice(0,10)은 SEO/OG description이라 절대 불변** — 390행 `lastSyncDate` 인라인만 교체.
  - buildingName.vue: 1236행 `${year}-${month}-01`(schema)·useStructuredData datePublished 불변 — 776행 lastSyncDate만.
  - 각 파일에서 `formatKstDate`가 이 용도로만 쓰이면 import 정리, 다른 용도(구조화데이터 등)로도 쓰이면 유지.

- [ ] **Step 2: 검증** — 각 상세 페이지에서 DataSourceSection '최근 동기화'가 점포맷(YYYY.MM.DD)으로 SourceStamp와 일치. 구조화데이터·메타 날짜는 여전히 대시.

```bash
npx vitest run 2>&1 | tail -4   # 회귀 0 (flaky 제외)
grep -rn "formatKstDate" pages/subscription/[id].vue   # 541·563은 남아야(SEO), 390은 formatDotDate로
```
Expected: 전체 PASS. DataSourceSection 렌더 테스트가 있으면 점포맷 확인.

- [ ] **Step 3: 커밋**

```bash
git add 'pages/[category]/[id].vue' 'pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue' 'pages/trash/[id].vue' 'pages/subway/[slug].vue' 'pages/subscription/[id].vue'
git commit -m "fix(trust): 데이터 출처 본문 날짜 대시→점 통일 (SourceStamp와 일치, 메타·스키마 날짜는 불변)"
```

---

### Task 3: 표 2자리 연도 + SubscriptionCard 날짜 패딩

**Files:**
- Modify: `frontend/utils/syncFreshness.ts` — `formatDotDateShort` 추가
- Modify: `frontend/components/realEstate/TransactionTable.vue`(약 400-404 formatDate), `frontend/pages/real-estate/land/[city]/[district]/[dong].vue`(약 84 카드·183 표), `frontend/components/subscription/SubscriptionCard.vue`(약 106-109 formatDate)
- Test: `frontend/tests/utils/syncFreshness.test.ts`(케이스 추가), `frontend/tests/components/realEstate/TransactionTable.test.ts`(기대값 갱신)

**Interfaces:**
- Consumes: 기존 `formatDotDate`
- Produces: `formatDotDateShort(iso?: string | null): string | null` — `YY.MM.DD` (`~/utils/syncFreshness`)

**기지 사실(recon):** 표 규칙은 `YY.MM.DD`인데 TransactionTable·land 표가 풀연도(`YYYY.MM.DD`) 사용 = 표 불일치. SubscriptionCard는 본문인데 미패딩(`2026.7.5`).

- [ ] **Step 1: 실패 테스트(RED)** — `syncFreshness.test.ts`에 `formatDotDateShort` 케이스(`'2026-06-19...'`→`'26.06.19'`, null→null, 무효→null). `TransactionTable.test.ts`에서 거래일 기대값을 `YY.MM.DD`로 갱신.

- [ ] **Step 2: formatDotDateShort 구현** — `syncFreshness.ts`:

```ts
/** ISO/날짜 → KST 'YY.MM.DD' (표 컨텍스트, 스펙 §5-8 항목3). 무효 입력 null. */
export function formatDotDateShort(iso?: string | null): string | null {
  const full = formatDotDate(iso)      // 'YYYY.MM.DD'
  return full ? full.slice(2) : null   // 'YY.MM.DD'
}
```

- [ ] **Step 3: 적용**
  - TransactionTable.vue formatDate(약 403): `${tx.dealYear}.${month}.${day}` → `${String(tx.dealYear).slice(2)}.${month}.${day}`(dealYear는 숫자 필드라 인라인 slice가 formatDotDateShort보다 간단·정확). 
  - land/[dong].vue 84·183: `{{ tx.dealYear }}.` → `{{ String(tx.dealYear).slice(2) }}.` (특히 183행 `<td>` 표).
  - SubscriptionCard.vue formatDate(약 106-109): `getMonth()+1`·`getDate()`에 `String(...).padStart(2,'0')` 적용 → `YYYY.MM.DD`(본문 규칙, 카드는 표 아닌 본문이라 풀연도 유지·패딩만).

- [ ] **Step 4: 테스트 통과 + 전체**

```bash
npx vitest run tests/utils/syncFreshness.test.ts tests/components/realEstate/TransactionTable.test.ts && npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS

- [ ] **Step 5: 커밋**

```bash
git add utils/syncFreshness.ts components/realEstate/TransactionTable.vue 'pages/real-estate/land/[city]/[district]/[dong].vue' components/subscription/SubscriptionCard.vue tests/utils/syncFreshness.test.ts tests/components/realEstate/TransactionTable.test.ts
git commit -m "fix(trust): 거래 표 연도 2자리(YY.MM.DD) + 청약 카드 날짜 제로패딩 (표/본문 날짜 규칙 정합)"
```

---

### Task 4: 금액 안전 dedup (텍스트 변화 0)

**Files:**
- Modify: `frontend/pages/search.vue`(약 617-623 formatRealEstatePrice)
- Modify: `frontend/pages/[city]/index.vue`(약 184-192 formatPrice), `frontend/pages/[city]/[district]/index.vue`(약 164-172 formatPrice)
- Test: `frontend/tests/utils/` 에 formatKoreanPrice 스냅샷 테스트(있으면 확장, 없으면 신규)

**Interfaces:**
- Consumes: 기존 `formatKoreanPrice`(`~/utils/formatters`)
- Produces: 없음 (내부 dedup)

**기지 사실(recon):** (1) search.vue formatRealEstatePrice는 formatKoreanPrice에서 Math.round만 뺀 형태 + 입력이 실거래 dealAmount **정수** → round no-op → **byte-identical 치환**(SEO 무영향). (2) 지역 허브 [city]/[district] 두 formatPrice는 **문자 단위 동일 중복** 함수 — 동일 로직 공용 유틸로 통합(텍스트 변화 0). **제외**: formatKoreanPrice로의 delegation이 round를 개입시켜 소수 평균 텍스트를 바꾸면 안 됨 — 지역 허브는 **현재 로직(무round) 그대로** 공용화만.

- [ ] **Step 1: search.vue byte-identical dedup** — `formatRealEstatePrice` 함수 삭제 + `import { formatKoreanPrice } from '~/utils/formatters'` + 호출부를 `formatKoreanPrice`로. (dealAmount 정수라 출력 동일 — 실제 값 몇 개로 육안/테스트 대조.)

- [ ] **Step 2: 지역 허브 중복 함수 통합** — [city]/index.vue와 [district]/index.vue의 **문자 단위 동일** `formatPrice`(fallback '데이터 없음' 포함)를 공용 로컬 유틸로 추출(예: `frontend/utils/regionPrice.ts`에 `formatRegionAvgPrice(amount: number | null): string`로 **현재 로직 그대로 이관** — round 추가 금지, '데이터 없음' fallback 유지). 두 페이지가 import해 사용. **출력 byte-identical**(순수 dedup).

- [ ] **Step 3: 검증** — formatKoreanPrice 스냅샷 테스트(0·정수·억경계·억+만) + 지역 허브 유틸 테스트(정수·소수·null→'데이터 없음'). search.vue·지역 허브 출력이 통합 전과 동일함을 확인.

```bash
npx vitest run 2>&1 | tail -4
```
Expected: 전체 PASS, 표시 텍스트 불변.

- [ ] **Step 4: 커밋**

```bash
git add pages/search.vue 'pages/[city]/index.vue' 'pages/[city]/[district]/index.vue' utils/regionPrice.ts tests/utils/
git commit -m "refactor(trust): 금액 포맷 안전 dedup (search formatKoreanPrice 위임 + 지역허브 중복 함수 통합, 텍스트 불변)"
```

---

### Task 5: 전체 검증 + PR 생성

**Files:** 없음

- [ ] **Step 1: lint + 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npm run lint 2>&1 | tail -3
npx vitest run 2>&1 | tail -4   # flaky(SearchAutocomplete) 보이면 클린 재실행 확인
git -C .. diff develop --stat -- '**/package-lock.json'   # 결과 없음
```
Expected: lint 신규 0, 전체 PASS.

- [ ] **Step 2: 불변식 스폿체크(dev 서버 가능 시)** — 시설 상세 빈 필드 '정보 없음 · 현장 확인 필요', DataSourceSection 날짜 점포맷(SourceStamp 일치)·구조화데이터 날짜 대시 유지, 거래 표 2자리 연도, 청약 카드 날짜 패딩, 지역 허브·검색 금액 표시 불변. 모바일 390px 오버플로(긴 빈값 문구) 스캔.

- [ ] **Step 3: 푸시 + PR 생성**

```bash
git push -u origin feat/trust-microcopy-safe
gh pr create --base develop \
  --title "feat(trust): 마이크로카피 안전 정제 — 빈값·날짜·금액 (PR ⑤)" \
  --body "$(cat <<'EOF'
## 요약
신뢰 디자인 격상(spec 2026-07-10, 로컬) Phase 1 PR ⑤ — §5-8 마이크로카피 중 **SEO 중립·저위험 항목만**.

- 빈 필드 문구 '정보 없음' → '정보 없음 · 현장 확인 필요' (EMPTY_FIELD_TEXT 단일 상수, 시설 상세 81곳)
- 데이터 출처 본문 날짜 대시→점 (DataSourceSection 5곳, SourceStamp와 페이지 내 일치)
- 거래 표 연도 2자리(YY.MM.DD) + 청약 카드 날짜 제로패딩
- 금액 포맷 안전 dedup (search byte-identical + 지역허브 중복 함수 통합, 텍스트 변화 0)

## 불변식
- URL·h1·title/meta·canonical·noindex·섹션순서·광고 슬롯 불변, 표시 텍스트 정제만
- **메타/스키마 날짜 절대 불변**(dash 유지): useStructuredData datePublished/dateModified, subscription slice(0,10) OG desc, buildingName year-month-01
- 금액 의미 변경 금지(byte-identical·동일 로직 통합만), 이미 구현된 degrade·표 셀 '-'·hide-when-empty 방식 유지
- Node 20, package-lock 무변경

## 범위 외 (조사 판단 — 후속)
- 어미 해요체 전면 통일 + 생성기 프롬프트: 콘텐츠 보이스 결정·FAQ/메타 JSON-LD 200곳 SEO 위험
- 금액 계열 전면 통합('만'↔'만원'·'5억'↔'5억원'·nbsp): 색인 텍스트 의미 변경
- formatDeposit 소수 반올림: 별건 버그픽스

## 테스트
- 신규: EMPTY_FIELD_TEXT·formatDotDateShort·formatKoreanPrice 스냅샷·지역허브 유틸 + 표 날짜 기대값 갱신
- frontend vitest 전체 PASS, lint 0
EOF
)"
```
Expected: PR URL. CI green 확인 후 사용자 머지 판단.

---

## 플랜 메모

- **범위 축소 근거**: 마이크로카피 5개 렌즈 조사가 "전면 적용 비현실적·SEO 위험"으로 판단 → SEO 중립 항목(빈값·본문/표 날짜·byte-identical 금액 dedup)만. 어미 통일·금액 계열 통합·formatDeposit 반올림은 명시적 제외.
- **task 독립성**: 4개 정제 태스크는 서로 다른 파일군이라 순차 커밋으로 충돌 없음. 각 태스크가 독립 리뷰 게이트.
- **후속 트랙**: (선택) 생성기 프롬프트 어미/상투 규칙(backend, 향후 콘텐츠), formatDeposit 반올림 버그픽스 → **PR ⑥~⑧** Phase 2(숫자 타이포+카운터 밴드 / 히어로+헤더+GNB C안 / 로고 코발트).
