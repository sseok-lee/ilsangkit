# 부동산 상세 "단지 정보" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 실거래 상세를 K-apt 단지와 연결해 헤더 요약·"단지 정보" 섹션·meta description·JSON-LD 에 단지 숫자를 보여 준다.

**Architecture:** 매칭은 백엔드 `getDetailOverview` 안에서 한다 — 개요는 이미 SSR 로 불리고 주소 후보 정리(#956)를 끝낸 `addresses` 를 갖고 있어 스펙 §4.2 의 주소 입력을 그대로 쓸 수 있다. 개요 응답에 `complex: ComplexInfo | null` 을 더하고, 매칭 실패·예외는 null 로 삼켜 개요를 깨뜨리지 않는다. 프런트는 순수 포맷 유틸 + 섹션 컴포넌트 + 페이지 연결 + 메타/스키마 입력 확장.

**Tech Stack:** Express 5 + Prisma raw SQL(MySQL 8), Nuxt 3 SSR + Vue 3, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-28-kapt-complex-info-section-design.md`

## Global Constraints

- 다른 단지 정보를 보여 주지 않는다: 후보가 2곳 이상이면 null.
- 연결되지 않은 상세는 화면·메타·스키마 모두 지금과 같다.
- 단지 정보 실패가 개요 실패·5xx·noindex 로 번지지 않는다.
- 운영 쿼리는 인덱스 조회만(넓은 GROUP BY·정렬 금지). 목표 p95 50ms.
- `active=false` 단지는 연결하지 않는다.
- ESM `.js` import, 한국어 커밋, Node 20.
- 광고 슬롯 개수·위치 변경 금지(순서 값만 맞춘다).

## Review Focus

1. 법정동이 "읍 리" 두 토큰(예: "오송읍 서평리")인 상세 — K-apt `eupmyeon`/`dongri` 둘 다 비교해야 연결된다 (Task 1 테스트).
2. 지번이 `가-240`·`BL`·빈 값 — 주소 매칭을 건너뛰고 이름 매칭만 (Task 1·2 테스트).
3. 같은 필지에 K-apt 단지 2곳(예: 수서1-1단지(임대)/수서) — 이름 매칭으로 넘기지 않고 null (Task 2 테스트).
4. 세대수 0·없음, 주차 없음 — 세대당 주차 생략, 0 은 "지하 없음" 등으로 표시 (Task 3 테스트).
5. 개요 안 단지 조회가 예외 — 개요는 그대로, `complex: null` (Task 2 테스트).

---

### Task 1: 매칭 순수 함수

**Files:**
- Create: `backend/src/services/kaptComplexMatcher.ts`
- Test: `backend/__tests__/services/kaptComplexMatcher.test.ts`

**Interfaces:**
- Produces:
  - `parseParcel(jibun: string | null | undefined): { isMountain: boolean; mainNo: number; subNo: number } | null` — `"649"`, `"649-1"`, `"산12-3"` 만 허용
  - `splitDongName(dongName: string): { eupmyeon: string | null; dongri: string }` — 공백 기준, 토큰 2개면 앞이 읍면
  - `dongMatches(local: { eupmyeon: string | null; dongri: string }, kapt: { eupmyeon: string | null; dongri: string | null }): boolean` — `(kapt.dongri ?? kapt.eupmyeon) === local.dongri` 그리고 local.eupmyeon 이 있으면 `kapt.eupmyeon === local.eupmyeon`
  - `normalizeComplexName(name: string): string` — 스펙 §4.2 정규화 그대로(Ⅰ~Ⅴ→1~5 포함)
  - `nameNumbers(name: string): string[]` — 괄호 제거·Ⅰ~Ⅴ 환산 후 `\d+` 열
  - `isNameMatch(local: { name: string; buildYear: number | null }, kapt: { name: string; useApprovalDate: string | null }): boolean`

- [ ] **Step 1: 실패 테스트** — `parseParcel`(`'649'→{false,649,0}`, `'산12-3'→{true,12,3}`, `'가-240'/'BL'/''/null→null`), `splitDongName('오송읍 서평리')→{eupmyeon:'오송읍',dongri:'서평리'}`, `dongMatches` 읍면 불일치 false, `isNameMatch` 스펙 §4.3 표 7행 그대로(연결 4 true, 크라운빌Ⅱ/해운대자이2단지/센텀리슈빌2단지 false), 연식 한쪽 null → false, 정규화 이름 2자 이하 포함 불허.
- [ ] **Step 2:** `npx vitest run __tests__/services/kaptComplexMatcher.test.ts` → FAIL(모듈 없음)
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** 같은 명령 → PASS
- [ ] **Step 5:** 커밋 `feat(kapt): 실거래 상세 ↔ K-apt 단지 매칭 규칙`

### Task 2: 개요 응답에 단지 정보 연결

**Files:**
- Modify: `backend/src/types/housingRedesign.ts` (`ComplexInfo` 추가, `DetailOverview.complex`)
- Modify: `frontend/types/housingRedesign.ts` (같은 타입 복제)
- Modify: `backend/src/services/kaptComplexMatcher.ts` (DB 조회 추가)
- Modify: `backend/src/services/realEstateDetailService.ts:295-370` (`getDetailOverview`)
- Test: `backend/__tests__/services/kaptComplexMatcher.test.ts`, `backend/__tests__/services/realEstateDetailOverview.test.ts`

**Interfaces:**
- Consumes: Task 1 함수들
- Produces:
```ts
export interface ComplexInfo {
  matchType: 'address' | 'name';
  kaptCode: string; name: string;
  householdCount: number | null; dongCount: number | null;
  topFloor: number | null; basementFloors: number | null;
  useApprovalDate: string | null;           // YYYY-MM-DD
  totalParking: number | null; groundParking: number | null; undergroundParking: number | null;
  heatingType: string | null; corridorType: string | null;
  builder: string | null; developer: string | null;
  managementType: string | null; saleType: string | null;
  elevatorCount: number | null; cctvCount: number | null; evChargerCount: number | null;
  areas: Array<{ exclusiveArea: number; householdCount: number }>; // 면적 오름차순
  sourceDate: string | null;                // KaptSourceFile basic.fileDate YYYY-MM-DD
}
// DetailOverview 에 추가:  complex: ComplexInfo | null;
export async function findKaptComplex(input: {
  sggCode: string;
  addresses: Array<{ dongName: string; jibun: string | null }>;
  buildingName: string;
  buildYear: number | null;
}): Promise<ComplexInfo | null>
```
- 조회 규칙(스펙 §4.2): `addresses` 각각을 주소 매칭(`KaptComplexParcel` sggCode·isMountain·mainNo·subNo ⨝ `KaptComplex` active, `dongMatches`) → 나온 kaptCode 집합이 1개면 address, 2개 이상이면 null(이름으로 안 넘어감), 0개면 이름 매칭: 같은 sggCode 필지 ⨝ active 단지 중 첫 주소의 `dongMatches` + `isNameMatch` 통과가 정확히 1곳.
- 승강기 = raw 의 `승강기(승객용)`·`승강기(화물용)`·`승강기(승객+화물)`·`승강기(장애인)`·`승강기(비상용)`·`승강기(기타)` 숫자 합(전부 비면 null). 전기차 = `전기차 충전시설 설치대수(지상)`+`(지하)` 합(둘 다 비면 null). `useApprovalDate` YYYYMMDD 8자리 숫자만 변환.
- `getDetailOverview`: 기존 `addresses`(sameRoad 반영 후)·`building.buildYear`·`identity.bjdCode` 로 `findKaptComplex` 를 호출, `try/catch` → 예외 시 `console.warn` 후 null. 다른 쿼리와 병렬로 둘 필요 없음(주소 확정 뒤라 순차).

- [ ] **Step 1: 실패 테스트** — `findKaptComplex`(prisma `$queryRaw` mock): 주소 1곳→address·필드 변환(개포경남 값: 678세대, `useApprovalDate '1984-03-08'`, 승강기 26, 전기차 9), 주소 2곳→null 이고 이름 조회 SQL 미호출, 주소 0곳+이름 1곳→name, 비활성 행 제외(SQL 에 `active = true`). 개요 테스트: `findKaptComplex` mock 반환값이 `overview.complex` 로 실린다, mock 이 throw 해도 개요는 성공·`complex === null`.
- [ ] **Step 2:** `npx vitest run __tests__/services/kaptComplexMatcher.test.ts __tests__/services/realEstateDetailOverview.test.ts` → FAIL
- [ ] **Step 3:** 구현(타입 양쪽 + 조회 + 개요 연결).
- [ ] **Step 4:** 같은 명령 + `npx tsc --noEmit -p backend` → PASS
- [ ] **Step 5:** 커밋 `feat(kapt): 상세 개요에 K-apt 단지 정보 연결`

### Task 3: 프런트 포맷 유틸

**Files:**
- Create: `frontend/utils/complexInfo.ts`
- Test: `frontend/tests/utils/complexInfo.test.ts`

**Interfaces:**
- Consumes: `ComplexInfo` (frontend/types/housingRedesign.ts)
- Produces:
  - `approvalYear(c: ComplexInfo): number | null`
  - `buildComplexFactsLine(c: ComplexInfo): string` — `"678세대 · 9개 동 · 최고 15층 · 1984년 사용승인"`, 없는 항목 생략
  - `buildComplexInfoRows(c: ComplexInfo, today: Date): Array<{ label: string; value: string }>` — 스펙 §6.2 표 9줄 순서·문구 그대로, 값 없는 줄 제외
  - `groupComplexAreas(areas: ComplexInfo['areas']): Array<{ label: string; householdCount: number; ratio: number }>` — 스펙 §6.2 묶음 규칙(시작값+5㎡, 8개 초과 시 10㎡), ratio = 최대 묶음 대비 0~1

- [ ] **Step 1: 실패 테스트** — 개포경남 값으로 facts line 정확 문자열; rows: `'세대수 · 동수'→'678세대 · 9개 동'`, `'층수'→'최고 15층 · 지하 없음'`(basement 0), basement 2 → `'최고 15층 · 지하 2층'`, `'사용승인'→'1984년 3월 (42년차)'`(today 2025-06-01 → 42), `'주차'→'747면 · 세대당 1.10대 (지상 747 · 지하 0)'`, 세대수 null → `'747면 · 지상 747 · 지하 0'` 형태로 세대당 생략, 시공=시행 → `'경남건설'`, 시공만 있으면 시공만, 전 필드 null 이면 빈 배열; 면적 묶음: 개포경남 11개 면적 → 라벨 `['85㎡','92~97㎡','123㎡','149~150㎡','166㎡','182~186㎡']` 와 세대수 `[3,195,192,60,48,180]`.
- [ ] **Step 2:** `cd frontend && npx vitest run tests/utils/complexInfo.test.ts` → FAIL
- [ ] **Step 3:** 구현. 연차 = `today.getFullYear() - 승인연도 + 1`. 숫자는 `toLocaleString('ko-KR')`.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 커밋 `feat(real-estate): 단지 정보 표시 포맷 유틸`

### Task 4: "단지 정보" 섹션 컴포넌트

**Files:**
- Create: `frontend/components/realEstate/ComplexInfoSection.vue`
- Test: `frontend/tests/components/realEstate/ComplexInfoSection.test.ts`

**Interfaces:**
- Consumes: Task 3 유틸, `SectionBlock`(기존, `variant="flat"`, `heading`, `subtext`)
- Produces: `<ComplexInfoSection :complex="ComplexInfo" />` — 루트 `SectionBlock id="complex-info"`, 부제 `K-apt 공동주택관리정보 · 2026.10.26. 기준`(sourceDate null 이면 `K-apt 공동주택관리정보`), 표(`<dl>` 또는 `<table>`), 면적 막대 목록(묶음 0개면 숨김), 출처 문구 `출처: 국토교통부 K-apt 공동주택관리정보시스템 · 관리비 공개 의무단지만 제공`.

- [ ] **Step 1: 실패 테스트** — 마운트(ref/computed 명시 import — vitest auto-import 함정) 후 제목·부제·9줄 라벨·막대 6개·출처 문구 존재, 값 없는 줄 미렌더, sourceDate null 부제.
- [ ] **Step 2:** `npx vitest run tests/components/realEstate/ComplexInfoSection.test.ts` → FAIL
- [ ] **Step 3:** 구현. 기존 섹션 스타일 토큰(`text-ink`, `text-faint`, `border-line`, `bg-primary`) 사용. 데스크톱은 표·막대 2열(`md:grid-cols-2`), 모바일 1열.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 커밋 `feat(real-estate): 상세 단지 정보 섹션 컴포넌트`

### Task 5: 메타 description · JSON-LD 확장

**Files:**
- Modify: `frontend/composables/useRealEstateDetailMeta.ts` (`DetailMetaInput`, `renderDescription`, `DESCRIPTION_LADDER`)
- Modify: `frontend/composables/useStructuredData.ts:387-450` (`BuildingPlaceOptions`, `setBuildingPlaceSchema`)
- Test: `frontend/tests/composables/useRealEstateDetailMeta.test.ts`, `frontend/tests/composables/useStructuredData.test.ts`

**Interfaces:**
- Produces:
  - `DetailMetaInput.complex?: { householdCount: number | null; useApprovalYear: number | null } | null`
  - `BuildingPlaceOptions.complex?: { householdCount: number | null; dongCount: number | null; topFloor: number | null; useApprovalDate: string | null; totalParking: number | null } | null`
- description: complex 가 있으면 사실 절 순서 `{세대수}세대, 전용 {범위}, {사용승인연도}년 사용승인.`; 사용승인연도가 있으면 `N년 준공` 대신 사용. 사다리 옵션에 `withHouseholds` 추가, 빼는 순서 사용승인연도 → 주변 시설 → 전용면적 → 세대수. complex 없으면 기존 출력과 바이트 단위 동일.
- JSON-LD: `@type === 'ApartmentComplex'` 일 때 `numberOfAccommodationUnits: householdCount`; 모든 유형 `additionalProperty` 에 PropertyValue `householdCount`·`dongCount`·`topFloor`·`useApprovalDate`·`totalParking`(값 있는 것만, value 는 문자열). 기존 `propertyType`·`buildYear` 유지.

- [ ] **Step 1: 실패 테스트** — description: complex 포함 시 `678세대` 포함·120자 이하, 긴 단지명으로 사다리 강제 시 세대수가 마지막까지 남음, complex 없음 → 기존 스냅샷/기대 문자열 불변(기존 테스트 전부 통과). 스키마: apt → `numberOfAccommodationUnits: 678`, offitel → 없음·additionalProperty 에 householdCount, complex null → 기존 출력 불변.
- [ ] **Step 2:** `npx vitest run tests/composables/useRealEstateDetailMeta.test.ts tests/composables/useRealEstateDetailMeta.uniqueness.test.ts tests/composables/useStructuredData.test.ts` → FAIL
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** → PASS
- [ ] **Step 5:** 커밋 `feat(seo): 상세 description·JSON-LD 에 K-apt 단지 숫자 반영`

### Task 6: 상세 페이지 연결

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- Test: 기존 상세 페이지 테스트(있으면 `frontend/tests/pages/**/buildingName*.test.ts`) + Task 3~5 테스트 재실행

**Interfaces:**
- Consumes: `detailOverview.value?.complex`, Task 3 `buildComplexFactsLine`, Task 4 컴포넌트, Task 5 입력
- 변경:
  - `overviewFactsLine`: complex 가 있으면 `buildComplexFactsLine(complex)` 만 쓰고, 템플릿에서 줄 끝에 `<a href="#complex-info">단지 정보 ›</a>`. 없으면 기존 로직 그대로.
  - 바로가기 nav: complex 있을 때 `거래 내역` 과 `위치` 사이에 `<a href="#complex-info">단지 정보</a>`.
  - 섹션: `<ComplexInfoSection v-if="detailOverview?.complex" :complex="detailOverview.complex" class="order-8 md:order-9" />` — 거래내역 뒤 광고(order-7/md:8)와 위치(order-9/md:11) 사이.
  - `buildRealEstateDetailMeta` 입력에 `complex: { householdCount, useApprovalYear: approvalYear(c) }`.
  - `setBuildingPlaceSchema` 입력에 `complex` 필드.

- [ ] **Step 1:** 페이지 테스트가 있으면 complex 있음/없음 두 경우(섹션·nav·facts 링크 존재/부재) 실패 테스트 추가. 없으면 Task 7 수동 검증으로 대체.
- [ ] **Step 2:** 실행 → FAIL
- [ ] **Step 3:** 구현.
- [ ] **Step 4:** `cd frontend && npx vitest run && npm run lint` → PASS
- [ ] **Step 5:** 커밋 `feat(real-estate): 상세 페이지에 단지 정보 헤더·섹션 연결`

### Task 7: 로컬 실데이터 검증 · PR

- [ ] 백엔드 `npx vitest run`, `npm run lint`, `npx tsc --noEmit`; 프런트 `npx vitest run`, `npm run lint` (dev 서버 실행 중엔 build 금지)
- [ ] 로컬 dev(3000/8000)로 세 상세의 SSR HTML 확인(curl): 개포경남아파트(apt-sale, 주소 매칭) — 섹션·"678세대" description·`numberOfAccommodationUnits`; 하버라인10단지(이름 매칭) — 섹션 존재; `(746-17)` 구로동 — 섹션·nav 없음, description 기존과 동일
- [ ] Aside 로 개포경남 모바일(390px)·데스크톱 스크린샷 확인
- [ ] PR → develop, CI 통과 후 머지. 운영 승격은 사용자 확인 후. 운영 배포 뒤 개요 API 응답 시간(읽기 전용, 순차) 측정
