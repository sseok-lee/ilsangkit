# 신뢰 디자인 격상 PR ⑪ — 상세 헤더 팩트 보강 (§6-5 재정의) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세 헤더에 이미 존재하는 카테고리별 "핵심 팩트 칩"을 보강한다 — 새 스트립을 만들지 않고(중복 UI 방지), 팩트가 얇은 카테고리(약국·와이파이·옷수거함·체육시설)를 채우고 부동산 '건축년도' 칩에 '(N년차)'를 병기한다.

**Architecture:** §6-5의 원래 의도("H1 아래 핵심 팩트 1줄")는 이미 배포된 칩 메커니즘(`categoryHeroStats.ts buildHeroStats` → `MobileDetailHeader`/`PageHero` 칩 줄, 부동산은 페이지 `heroStats` computed)이 수행 중이다. 따라서 새 파이프 스트립을 얹으면 정보가 중복된다. 사용자 결정(2026-07-13): **기존 칩 보강**. 되돌린 스펙그리드(git `a03be1a7:frontend/utils/facilitySpecGroups.ts`)의 검증된 필드 매핑을 참조해 칩 팩트를 보강한다.

**Tech Stack:** Nuxt 3 SSR · Vue 3 script-setup · TypeScript · Vitest(happy-dom)

## Global Constraints

- **Node 20 필수.** `source ~/.nvm/nvm.sh && nvm use 20` 후 작업. `package-lock.json` 재생성 금지(`npm install`만).
- **백엔드 무변경.** 모든 필드는 기존 상세 응답(`details{}`) / `BuildingInfo`에 이미 존재하는 것만 사용. 새 API/스키마 금지.
- **새 스트립·새 컴포넌트 금지 (중복 UI 방지).** 오직 기존 칩 소스(`categoryHeroStats.ts` + 부동산 페이지 `heroStats` computed)만 보강. 헤더 컴포넌트(`MobileDetailHeader.vue`/`PageHero.vue`) 구조·단일 h1 불변.
- **degrade-safe (거짓 팩트 금지):** 값 없으면 칩 생략(`if (d?.x)` 가드 유지). 부동산은 `EMPTY_FIELD_TEXT` 필터가 이미 빈 칩 제거. **없는 데이터를 지어내지 말 것.**
- **부동산 '총세대수'는 데이터 없음** (K-apt 단지모델 미연동, 스키마에 세대수 컬럼 없음) → **시도하지 말 것.** 부동산 보강은 '건축년도 (N년차)'만.
- **칩 개수 상한 유지:** 모바일 `mobileHeaderStats`는 `slice(0, 4)`. 보강 후에도 카테고리당 팩트가 4개를 넘지 않게(순서: 핵심 먼저). 데스크톱 `od-hero-stats`도 동일 소스.
- **`buildHeroStats` 순수성 유지:** 시간 의존 값('오늘 영업시간')은 `[id].vue`에서 계산해 `details`에 `_`-prefix 키로 주입(기존 `_isOpen24Hours` 주입 선례와 동일). `categoryHeroStats.ts`는 `new Date()` 를 도입하지 않는다.
- **SSR 텍스트 유지:** 칩은 SSR 렌더(크롤러 가시) — 보강 팩트도 SSR에 나오게(주입값은 computed라 SSR 값 존재). '오늘' 판정은 기존 요일 computed(예 `pharmacyWeeklyHours`)의 `isToday` 로직 재사용(KST 기준 현행 유지, 신규 midnight 가드 추가 금지).
- **날짜/시간 의존 테스트는 fake timers 필수**(stale/오늘 판정 시한폭탄 방지 — 기존 메모리 교훈).
- **명시 import**(vitest auto-import 함정). flaky=SearchAutocomplete/localStorage 무시.

## File Structure

- **Modify** `frontend/utils/formatters.ts` — 순수 `buildYearLabel(buildYear, currentYear)` 추가(Task 1).
- **Modify** `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` — `heroStats`의 '건축년도' 칩에 년차 병기(Task 1).
- **Modify** `frontend/utils/categoryHeroStats.ts` — pharmacy(Task 2) · wifi/sports/clothes(Task 3) 빌더 보강.
- **Modify** `frontend/pages/[category]/[id].vue` — pharmacy `_todayHours` 주입(Task 2).
- **Modify tests** — `frontend/tests/utils/*` (formatters, categoryHeroStats), `frontend/tests/pages/*` (RE building detail, facility detail) 신규 케이스.

**참고(변경 안 함):** `MobileDetailHeader.vue`, `PageHero.vue`, `facilityService.ts`/`categoryRegistry.ts`(백엔드), 되돌린 `facilitySpecGroups.ts`(재도입 안 함 — 필드 매핑 참조용).

---

## Task 1: 부동산 '건축년도' 칩에 '(N년차)' 병기

**Files:**
- Create util: `frontend/utils/formatters.ts` (기존 파일에 함수 추가)
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue:847-866` (`heroStats` computed)
- Test: `frontend/tests/utils/formatters.test.ts` (없으면 생성), `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`

**Interfaces:**
- Produces: `buildYearLabel(buildYear: number | null | undefined, currentYear: number): string | null`

**현재 코드** (`buildingName].vue:856`):
```ts
{ label: '건축년도', value: buildingInfo.value?.buildYear ? `${buildingInfo.value.buildYear}년` : PLACEHOLDER },
```

- [ ] **Step 1: 실패 테스트 작성** — `frontend/tests/utils/formatters.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildYearLabel } from '~/utils/formatters'

describe('buildYearLabel', () => {
  it('연차를 병기한다', () => {
    expect(buildYearLabel(2018, 2026)).toBe('2018년 (8년차)')
  })
  it('당해 준공(연차 0 이하)은 연도만', () => {
    expect(buildYearLabel(2026, 2026)).toBe('2026년')
    expect(buildYearLabel(2027, 2026)).toBe('2027년') // 미래 데이터 방어
  })
  it('buildYear 없으면 null', () => {
    expect(buildYearLabel(null, 2026)).toBeNull()
    expect(buildYearLabel(undefined, 2026)).toBeNull()
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/formatters.test.ts -t buildYearLabel`
Expected: FAIL (함수 미존재).

- [ ] **Step 3: 유틸 구현** — `frontend/utils/formatters.ts`에 추가

```ts
/** 준공연도 + 경과 연차. currentYear는 호출측에서 getCurrentYear() 주입(테스트 결정성). 연차 1 이상일 때만 병기. */
export function buildYearLabel(buildYear: number | null | undefined, currentYear: number): string | null {
  if (typeof buildYear !== 'number' || Number.isNaN(buildYear)) return null
  const age = currentYear - buildYear
  return age >= 1 ? `${buildYear}년 (${age}년차)` : `${buildYear}년`
}
```

- [ ] **Step 4: heroStats에서 사용** — `buildingName].vue`. import에 `buildYearLabel`(from `~/utils/formatters`)·`getCurrentYear`(from `~/utils/seoConstants`) 추가 후 라인 856 교체:

```ts
{ label: '건축년도', value: buildYearLabel(buildingInfo.value?.buildYear, getCurrentYear()) ?? PLACEHOLDER },
```
> `getCurrentYear()`는 `seoConstants.ts:43`에 이미 존재. 다른 heroStats 항목·순서·모바일 필터 불변.

- [ ] **Step 5: 페이지 테스트 보강** — `realEstateBuildingDetail.test.ts`에 heroStats '건축년도' 칩이 buildYear fixture로 '(N년차)' 포함 렌더되는지 케이스 추가(현재 연도 의존 → `getCurrentYear()` 결과로 기대값 계산하거나 fixture buildYear를 `getCurrentYear()-8`로 설정). 단일 h1 가드 불변 확인.

- [ ] **Step 6: 통과 확인 + 커밋**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/formatters.test.ts tests/pages/real-estate/realEstateBuildingDetail.test.ts`
Expected: PASS.
```bash
git add frontend/utils/formatters.ts "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue" frontend/tests/utils/formatters.test.ts frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts
git commit -m "feat(real-estate): 상세 헤더 건축년도 칩에 '(N년차)' 병기"
```

---

## Task 2: 약국 칩 보강 — 약사수 + 오늘 영업시간

**Files:**
- Modify: `frontend/utils/categoryHeroStats.ts:15` (pharmacy 빌더)
- Modify: `frontend/pages/[category]/[id].vue` (pharmacy `_todayHours` 주입 — `detailsWithMeta` 구성부, 기존 `_isOpen24Hours` 주입과 동일 위치)
- Test: `frontend/tests/utils/categoryHeroStats.test.ts`, `frontend/tests/pages/detail.test.ts`

**Interfaces:**
- Consumes: `d.pharmacistCnt`(number, 약사수) — pharmacy `detailFields`에 존재. `d._todayHours`(string|null) — [id].vue가 주입.
- Produces: 보강된 pharmacy 칩. 순서: 약사 → 오늘 → 전화.

**현재 코드** (`categoryHeroStats.ts:15`):
```ts
pharmacy: (_d, phone) => (phone ? [{ label: '전화', value: phone }] : []),
```

**주입 선례** (`categoryHeroStats.ts:88-101` toilet가 `d?._isOpen24Hours`를 읽고, [id].vue가 `isOpen24Hours` computed를 details에 주입하는 패턴). 동일하게 pharmacy `_todayHours`를 주입한다.

- [ ] **Step 1: 실패 테스트 작성 (순수 빌더)** — `categoryHeroStats.test.ts`

```ts
import { describe, it, expect } from 'vitest'
import { buildHeroStats } from '~/utils/categoryHeroStats'

describe('pharmacy 칩 보강', () => {
  it('약사수·오늘 영업시간·전화 순으로 렌더한다', () => {
    const stats = buildHeroStats('pharmacy', { pharmacistCnt: 2, _todayHours: '09:00~18:00' }, '02-123-4567')
    expect(stats).toEqual([
      { label: '약사', value: '2명' },
      { label: '오늘', value: '09:00~18:00' },
      { label: '전화', value: '02-123-4567' },
    ])
  })
  it('데이터 없으면 해당 칩 생략(전화만)', () => {
    expect(buildHeroStats('pharmacy', {}, '02-1')).toEqual([{ label: '전화', value: '02-1' }])
  })
  it('오늘 휴무(_todayHours null)면 오늘 칩 생략', () => {
    const stats = buildHeroStats('pharmacy', { pharmacistCnt: 1, _todayHours: null }, '')
    expect(stats).toEqual([{ label: '약사', value: '1명' }])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/categoryHeroStats.test.ts -t "pharmacy"`
Expected: FAIL.

- [ ] **Step 3: pharmacy 빌더 보강** — `categoryHeroStats.ts:15` 교체

```ts
  pharmacy: (d, phone) => {
    const items: HeroStat[] = []
    if (d?.pharmacistCnt) items.push({ label: '약사', value: `${d.pharmacistCnt}명` })
    if (d?._todayHours) items.push({ label: '오늘', value: d._todayHours })
    if (phone) items.push({ label: '전화', value: phone })
    return items
  },
```

- [ ] **Step 4: `_todayHours` 주입** — `[id].vue`. 기존 `pharmacyWeeklyHours` computed(요일별 rows, `isToday`·`closed`·`time` 보유)에서 오늘 행 시간을 뽑아 pharmacy일 때 `detailsWithMeta`에 주입(기존 `_isOpen24Hours` 주입 지점과 동일). 예:

```ts
// pharmacyWeeklyHours(기존)에서 오늘 영업시간 문자열 도출 (휴무/부재 → null)
const pharmacyTodayHours = computed<string | null>(() => {
  if (category.value !== 'pharmacy') return null
  const today = pharmacyWeeklyHours.value.find(r => r.isToday)
  return today && !today.closed ? today.time : null
})
// detailsWithMeta 구성부(기존 _isOpen24Hours 주입과 같은 객체)에 추가:
//   _todayHours: pharmacyTodayHours.value,
```
> 구현자는 `[id].vue`에서 `detailsWithMeta`(또는 buildHeroStats에 넘기는 details 객체) 구성 위치와 `pharmacyWeeklyHours`의 실제 row 필드명(`isToday`/`closed`/`time`)을 확인해 정확히 배선할 것. `pharmacyWeeklyHours`가 이미 KST '오늘'을 판정하므로 신규 날짜 로직을 만들지 말 것.

- [ ] **Step 5: [id].vue 주입 테스트** — `detail.test.ts`에 pharmacy 상세 마운트 시 헤더 칩에 '약사'/'오늘' 노출 케이스 추가. '오늘' 판정 의존이므로 **fake timers로 요일 고정**(예 월요일) 후 fixture `dutyTime1s/c`로 검증. 단일 h1·광고 슬롯 불변.

- [ ] **Step 6: 통과 확인 + 커밋**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/categoryHeroStats.test.ts tests/pages/detail.test.ts`
Expected: PASS.
```bash
git add frontend/utils/categoryHeroStats.ts "frontend/pages/[category]/[id].vue" frontend/tests/utils/categoryHeroStats.test.ts frontend/tests/pages/detail.test.ts
git commit -m "feat(facility): 약국 헤더 칩 보강(약사수·오늘 영업시간)"
```

---

## Task 3: 얇은 카테고리 칩 보강 — wifi · sports · clothes

**Files:**
- Modify: `frontend/utils/categoryHeroStats.ts` (wifi:103, sports:75, clothes:123)
- Test: `frontend/tests/utils/categoryHeroStats.test.ts`

**Interfaces (전부 기존 `details` 필드, degrade-safe):**
- wifi: `d.installLocation`(설치장소) — `wifi.detailFields`에 존재
- sports: `d.faciGbNm`(시설구분)·`d.ftypeNm`(유형)·`d.faciGfa`(시설면적 ㎡)
- clothes: `d.detailLocation`(상세위치) — `clothes.detailFields`에 존재

- [ ] **Step 1: 실패 테스트 작성** — `categoryHeroStats.test.ts`

```ts
describe('얇은 카테고리 칩 보강', () => {
  it('wifi: SSID + 설치장소', () => {
    expect(buildHeroStats('wifi', { ssid: '3층', installLocation: '시청 로비' }, '')).toEqual([
      { label: 'SSID', value: '3층' },
      { label: '설치장소', value: '시청 로비' },
    ])
  })
  it('wifi: 설치장소 없으면 SSID만', () => {
    expect(buildHeroStats('wifi', { ssid: 'A' }, '')).toEqual([{ label: 'SSID', value: 'A' }])
  })
  it('sports: 전화 있어도 시설구분·유형·면적을 보여준다(전화 fallback 제거)', () => {
    const stats = buildHeroStats('sports', { faciGbNm: '공공', ftypeNm: '체육관', faciGfa: 1200 }, '02-1')
    expect(stats).toEqual([
      { label: '시설구분', value: '공공' },
      { label: '유형', value: '체육관' },
      { label: '면적', value: '1,200㎡' },
    ])
  })
  it('sports: 정보 전무하면 전화 fallback', () => {
    expect(buildHeroStats('sports', {}, '02-1')).toEqual([{ label: '전화', value: '02-1' }])
  })
  it('clothes: 상세위치 있으면 표시, 없으면 전화 fallback', () => {
    expect(buildHeroStats('clothes', { detailLocation: '정문 앞' }, '02-1')).toEqual([{ label: '위치', value: '정문 앞' }])
    expect(buildHeroStats('clothes', {}, '02-1')).toEqual([{ label: '전화', value: '02-1' }])
  })
})
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/categoryHeroStats.test.ts -t "얇은 카테고리"`
Expected: FAIL.

- [ ] **Step 3: 빌더 3종 보강**

wifi (`:103-107`):
```ts
  wifi: (d) => {
    const items: HeroStat[] = []
    if (d?.ssid) items.push({ label: 'SSID', value: d.ssid })
    if (d?.installLocation) items.push({ label: '설치장소', value: d.installLocation })
    return items
  },
```
sports (`:75-86`) — 면적 포함, 정보 있으면 전화보다 우선:
```ts
  sports: (d, phone) => {
    const items: HeroStat[] = []
    if (d?.faciGbNm) items.push({ label: '시설구분', value: d.faciGbNm })
    if (d?.ftypeNm) items.push({ label: '유형', value: d.ftypeNm })
    if (d?.faciGfa != null) items.push({ label: '면적', value: `${Number(d.faciGfa).toLocaleString()}㎡` })
    if (items.length === 0 && phone) items.push({ label: '전화', value: phone })
    return items
  },
```
clothes (`:123`):
```ts
  clothes: (d, phone) => {
    if (d?.detailLocation) return [{ label: '위치', value: d.detailLocation }]
    return phone ? [{ label: '전화', value: phone }] : []
  },
```

- [ ] **Step 4: 통과 확인 + 커밋**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/utils/categoryHeroStats.test.ts`
Expected: PASS (전체 파일 green — 기존 카테고리 케이스 회귀 없음).
```bash
git add frontend/utils/categoryHeroStats.ts frontend/tests/utils/categoryHeroStats.test.ts
git commit -m "feat(facility): 얇은 카테고리(wifi·sports·clothes) 헤더 칩 팩트 보강"
```

---

## Task 4: 전체 검증 + PR

**Files:** 없음(검증·PR)

- [ ] **Step 1: 전체 lint + vitest**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && node -v \
  && npm run lint 2>&1 | tail -3 \
  && npx vitest run 2>&1 | tail -8
```
Expected: lint 0 errors, 전체 green(기존 flaky만). 실패 시 수정 후 재실행.

- [ ] **Step 2: whole-branch 리뷰 (opus)** — `scripts/review-package $(git merge-base develop HEAD) HEAD` 후 최상위 모델 리뷰. 렌즈:
  - 새 스트립/컴포넌트 없음(칩 소스만 보강)·헤더 구조·단일 h1 불변
  - degrade-safe(값 없으면 칩 생략·부동산 EMPTY_FIELD 필터 유지)·거짓 팩트 없음
  - 부동산 총세대수 미시도(데이터 없음)
  - `buildHeroStats` 순수성 유지(`new Date()` 미도입)·오늘 판정은 [id].vue 주입(`_todayHours`)·KST 기존 로직 재사용
  - 칩 ≤4·SSR 텍스트 보존·시간 의존 테스트 fake timers

- [ ] **Step 3: Minor fix wave** — Critical/Important 일괄 수정 후 재검증. Minor는 ledger 기록.

- [ ] **Step 4: PR 오픈 → develop**

```bash
git push -u origin feat/trust-detail-fact-enrichment
gh pr create --base develop --title "신뢰 디자인 격상 PR ⑪ — 상세 헤더 팩트 보강 (§6-5 재정의)" --body "..."
```
CI green 실측 후 사용자 머지 확인.

**승격 후 라이브 검증(main 승격 시):** 약국 상세 헤더 칩(약사수·오늘 영업시간)·부동산 '(N년차)' SSR 노출·단일 h1·모바일 390px 넘침 없음.

---

## Self-Review (작성자 체크)

- **§6-5 재정의 근거:** 헤더 칩이 이미 "핵심 팩트 1줄" 역할 수행(recon 확인) → 새 스트립은 중복. 사용자 결정=칩 보강. ✅
- **데이터 가용성:** 부동산 세대수 없음→미시도. pharmacistCnt/installLocation/detailLocation/faciGbNm 등은 각 `detailFields`에 존재(recon 확인). ✅
- **순수성/시간의존:** `buildHeroStats` 순수 유지, '오늘'은 `_todayHours` 주입(기존 `_isOpen24Hours` 선례). fake timers 테스트. ✅
- **플레이스홀더 스캔:** 각 스텝 실제 코드/테스트/명령 포함. [id].vue 주입은 실제 `detailsWithMeta`/`pharmacyWeeklyHours` 위치를 구현자가 확인(파일별 상이)하도록 위임. ✅
