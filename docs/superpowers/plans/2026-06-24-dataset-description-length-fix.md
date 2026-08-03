# Dataset description 길이 규격 위반 수정 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 상세 페이지 Dataset JSON-LD의 `description`이 항상 Google 규격(50~5000자)을 만족하도록, 중앙 안전망 + 페이지별 풍부한 description 재사용으로 수정한다.

**Architecture:** `utils/dataSource.ts`에 순수 함수 `ensureDatasetDescription`을 추가하고 `setDetailProvenance`가 이를 통과시켜 모든 페이지의 Dataset description을 50자 이상으로 보장(중앙 안전망). 추가로 각 상세 페이지가 이미 계산하는 풍부한 meta description을 provenance에 재사용해 품질을 높인다. 재사용할 풍부한 설명이 없는 2개 페이지(공매·쓰레기)만 골격 템플릿을 새로 작성한다.

**Tech Stack:** Nuxt 3 (Vue 3 `<script setup>`), TypeScript, Vitest, `~` alias = `frontend/`.

## Global Constraints

- Google Dataset `description` 규격: **50자 이상, 5000자 이하** (미만/초과 시 리치결과 invalid).
- ESM: 로컬 import는 정확한 경로 사용. 프론트엔드는 `~` alias = `frontend/` 루트.
- 작업 디렉터리: 모든 명령은 `frontend/`에서 실행 (`cd frontend`).
- PR 워크플로우: `develop` 브랜치 기준, 커밋은 코드 파일만(`docs/`는 .gitignore).
- 동작 동일성: meta description / og / title 출력은 기존과 동일해야 함(리팩터 회귀 금지).
- `wifi`는 `noindex`로 `setDetailProvenance`가 조기 return → 변경 대상 아님.

---

### Task 1: `ensureDatasetDescription` 순수 함수 + 중앙 안전망 적용

이 한 태스크만으로 GSC 오류는 해소된다(나머지는 품질 향상).

**Files:**
- Modify: `frontend/utils/dataSource.ts` (함수 추가, `DataSourceInfo` 인터페이스는 동일 파일 1~26행에 존재)
- Modify: `frontend/composables/useStructuredData.ts:855-857` (`setDetailProvenance` 내부)
- Test: `frontend/tests/utils/dataSource.test.ts` (신규)

**Interfaces:**
- Produces: `export function ensureDatasetDescription(base: string, src: DataSourceInfo): string` — 항상 50자 이상 5000자 이하 문자열 반환.
- Consumes: 기존 `DataSourceInfo`(`{ datasetName: string; provider: string; url: string; kogl?: 1|2|3|4 }`), 기존 `resolveDataSource(...)` 반환값(`DataSourceInfo | null`).

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/utils/dataSource.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { ensureDatasetDescription } from '~/utils/dataSource';

const src = {
  datasetName: '국토교통부 실거래가 공개시스템',
  provider: '국토교통부',
  url: 'https://www.data.go.kr/data/15057511/openapi.do',
};

describe('ensureDatasetDescription', () => {
  it('50자 미만이면 데이터셋 컨텍스트를 덧붙여 50자 이상 보장하고 원문을 앞에 둔다', () => {
    const base = '산장 실거래가·시세 (국토교통부 공개 데이터 기반)'; // 28자
    const out = ensureDatasetDescription(base, src);
    expect(out.length).toBeGreaterThanOrEqual(50);
    expect(out.startsWith(base)).toBe(true);
  });

  it('이미 50자 이상이면 그대로 반환(불변)', () => {
    const base = '가'.repeat(60);
    expect(ensureDatasetDescription(base, src)).toBe(base);
  });

  it('빈 문자열도 크래시 없이 50자 이상 보장', () => {
    const out = ensureDatasetDescription('', src);
    expect(out.length).toBeGreaterThanOrEqual(50);
  });

  it('5000자를 초과하지 않는다', () => {
    const out = ensureDatasetDescription('가'.repeat(6000), src);
    expect(out.length).toBeLessThanOrEqual(5000);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/utils/dataSource.test.ts`
Expected: FAIL — `ensureDatasetDescription is not a function` / import 오류.

- [ ] **Step 3: 순수 함수 구현**

`frontend/utils/dataSource.ts` 파일 끝에 추가:
```ts
/**
 * Google Dataset structured data 의 description 규격(50~5000자)을 보장한다.
 * 50자 미만이면 데이터셋 컨텍스트 문장을 덧붙이고, 항상 5000자 이하로 자른다.
 */
export function ensureDatasetDescription(base: string, src: DataSourceInfo): string {
  const trimmed = (base ?? '').trim();
  const result = trimmed.length >= 50
    ? trimmed
    : `${trimmed} ${src.datasetName} 기반으로 일상킷이 전국 지역·항목별로 정리해 최신 기준으로 제공하는 공식 공개 데이터입니다.`.trim();
  return result.slice(0, 5000);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/dataSource.test.ts`
Expected: PASS (4 passed).

- [ ] **Step 5: 중앙 안전망 적용**

`frontend/composables/useStructuredData.ts` 상단의 dataSource import에 `ensureDatasetDescription` 추가. (현재 `resolveDataSource`를 `~/utils/dataSource`에서 import 중이므로 같은 import 구문에 이름 추가.)

그리고 `setDetailProvenance` 내부 `setDatasetSchema({ ... })` 호출의 description 라인을 교체:
```ts
// before (현재 857행 부근)
      description: opts.description,
// after
      description: ensureDatasetDescription(opts.description, src),
```

- [ ] **Step 6: 린트 + 전체 테스트**

Run: `cd frontend && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add frontend/utils/dataSource.ts frontend/composables/useStructuredData.ts frontend/tests/utils/dataSource.test.ts
git commit -m "fix(seo): Dataset description 50자 하한 보장 (중앙 안전망 + 순수함수)"
```

---

### Task 2: real-estate 건물 상세 — 풍부한 meta를 공유 computed로 끌어올려 재사용

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (useHead 콜백 546~629행, provenance 1216~1224행)

**Interfaces:**
- Consumes: `buildRealEstateDetailMeta(...)`(이미 import됨), `setDetailProvenance`(Task 1로 안전망 적용됨).
- Produces: 없음(페이지 내부 변경).

- [ ] **Step 1: `detailMeta` computed 신설**

`useHead(() => {` (현재 546행) **바로 위**에 다음 computed를 추가한다. (현재 useHead 콜백 내부의 areaRange/recentDeal/buildRealEstateDetailMeta 계산을 그대로 이전 — 모든 ref는 lazy 평가되므로 선언 순서 문제 없음.)
```ts
const detailMeta = computed(() => {
  const mode = currentTab.value;

  let areaRange: { min: number; max?: number } | null = null;
  const areaValues = areaGroups.value
    .map((g: AreaGroup) => Number(g.area))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  if (areaValues.length > 0) {
    const minA = Math.min(...areaValues);
    const maxA = Math.max(...areaValues);
    areaRange = maxA > minA ? { min: minA, max: maxA } : { min: minA };
  }

  let recentDeal: { amount: number; dealDate: string } | undefined;
  const firstTx = transactions.value.items[0];
  if (firstTx) {
    const amount = 'dealAmount' in firstTx ? firstTx.dealAmount : firstTx.deposit;
    if (amount) {
      recentDeal = { amount: Number(amount), dealDate: `${firstTx.dealYear}년 ${firstTx.dealMonth}월` };
    }
  }

  const totalCount = summary.value?.totalCount ?? 0;
  const buildYearVal = firstTx?.buildYear ?? buildingInfo.value?.buildYear ?? null;

  return buildRealEstateDetailMeta({
    buildingName: buildingName.value,
    region: {
      city: buildingInfo.value?.city || cityName,
      district: buildingInfo.value?.district || districtName,
      dong: buildingInfo.value?.dongName ?? null,
    },
    propertyType: propertyTypeParam,
    transactionMode: mode,
    summary: summary.value ? { totalCount, recentDeal } : null,
    buildYear: buildYearVal,
    areaRange,
    facilitySummary: facilitySummary.value,
  });
});
```

- [ ] **Step 2: useHead 콜백을 `detailMeta` 소비로 교체**

현재 useHead 콜백(546~629행) 안에서 areaRange/recentDeal/totalCount/buildYearVal 계산과 `const { title, description } = buildRealEstateDetailMeta({...})` 블록(549~589행)을 **삭제**하고, 그 자리를 다음 한 줄로 바꾼다:
```ts
  const { title, description } = detailMeta.value;
```
나머지(canonicalUrl, ogImage, ogImageWidth/Height, meta 배열, noindex 분기, return)는 그대로 둔다. `description`/`title` 참조 지점은 변경 없음.

- [ ] **Step 3: provenance가 같은 description 사용**

현재 provenance(1216~1224행)의 description 라인을 교체:
```ts
// before
    description: `${buildingName.value} 실거래가·시세 (국토교통부 공개 데이터 기반)`,
// after
    description: detailMeta.value.description,
```

- [ ] **Step 4: 린트 + 전체 테스트 (회귀 없음 확인)**

Run: `cd frontend && npm run lint && npm run test`
Expected: PASS. (meta description/og/title 출력은 기존과 동일해야 함.)

- [ ] **Step 5: 커밋**

```bash
git add "frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue"
git commit -m "fix(seo): 건물 상세 Dataset description을 풍부한 meta로 재사용"
```

---

### Task 3: 기존 풍부한 description을 그대로 재사용 (1줄 스왑 6개)

각 파일은 이미 풍부한 description 빌더/computed/const를 보유. provenance의 짧은 문자열만 교체한다.

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (import 299행, provenance 460행)
- Modify: `frontend/pages/subway/[slug].vue` (provenance 592행)
- Modify: `frontend/pages/subscription/[id].vue` (provenance 782행)
- Modify: `frontend/pages/real-estate/land/[city]/[district]/[dong].vue` (provenance 422행)
- Modify: `frontend/pages/public-rental/announcements/[pblancId].vue` (provenance 297행)
- Modify: `frontend/pages/public-rental/[type]/[id].vue` (provenance 174행)

**Interfaces:**
- Consumes: 각 페이지의 기존 심볼 — `buildFacilityDescription`(useFacilityMeta export), `buildSubwayDescription`(이미 import), `subscriptionSeoDescription`(549행 computed), `pageDescription`(land computed), `annDescription`(244행 const), `seoDescription`(public-rental detail 111행 computed).

- [ ] **Step 1: 시설 `[category]/[id].vue` — import 추가 + 스왑**

299행 import에 `buildFacilityDescription` 추가:
```ts
// before
import { buildFacilityIntro, getFacilityDisplayName } from '~/composables/useFacilityMeta'
// after
import { buildFacilityIntro, getFacilityDisplayName, buildFacilityDescription } from '~/composables/useFacilityMeta'
```
provenance description(460행) 교체:
```ts
// before
    description: `${facility.value.name} ${CATEGORY_META[facility.value.category]?.label ?? ''} 위치·운영정보 (공공데이터 기반)`,
// after
    description: buildFacilityDescription(facility.value),
```

- [ ] **Step 2: 지하철 `subway/[slug].vue` — 스왑 (592행)**

```ts
// before
  description: `${displayName.value} 지하철역 정보 (국토교통부 도시철도역사 표준데이터 기반)`,
// after
  description: buildSubwayDescription(station.value),
```

- [ ] **Step 3: 청약 `subscription/[id].vue` — 스왑 (782행)**

`subscriptionSeoDescription`은 549행에서 선언되어 이 블록(782행)보다 앞서므로 안전.
```ts
// before
    description: `${sub.houseName ?? '청약'} 청약 일정·정보 (한국부동산원 청약홈 기반)`,
// after
    description: subscriptionSeoDescription.value,
```

- [ ] **Step 4: 토지 `land/.../[dong].vue` — 스왑 (422행)**

```ts
// before
  description: `${cityName} ${districtName} ${dong} 토지 실거래가·지목·용도지역 (국토교통부 토지 실거래가 기반)`,
// after
  description: pageDescription.value,
```

- [ ] **Step 5: 공공임대 공고 `announcements/[pblancId].vue` — 스왑 (297행)**

```ts
// before
  description: `${ann.pblancNm} 공공임대 공고 (LH·SH 공공데이터 기반)`,
// after
  description: annDescription,
```

- [ ] **Step 6: 공공임대 상세 `public-rental/[type]/[id].vue` — 스왑 (174행)**

```ts
// before
  description: `${rental.value?.complexNameKor ?? '공공임대'} 공급 정보 (LH·SH 공공데이터 기반)`,
// after
  description: seoDescription.value,
```

- [ ] **Step 7: 린트 + 전체 테스트**

Run: `cd frontend && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 8: 커밋**

```bash
git add "frontend/pages/[category]/[id].vue" "frontend/pages/subway/[slug].vue" "frontend/pages/subscription/[id].vue" "frontend/pages/real-estate/land/[city]/[district]/[dong].vue" "frontend/pages/public-rental/announcements/[pblancId].vue" "frontend/pages/public-rental/[type]/[id].vue"
git commit -m "fix(seo): 6개 상세 Dataset description을 기존 풍부한 meta로 재사용"
```

---

### Task 4: 재사용할 풍부한 설명이 없는 2개 페이지 — 골격 템플릿 신규 작성

공매·쓰레기는 재사용 가능한 풍부한 meta description이 없으므로(공매는 useSeoMeta 빈약, 쓰레기 `heroDescription`은 지역 없는 고정 문구) 골격 `[대상]+[필드]+[출처]` 템플릿을 직접 작성한다. (중앙 안전망이 동시에 적용되어 어떤 경우에도 50자 보장.)

**Files:**
- Modify: `frontend/pages/auction/item/[cltrMngNo].vue` (provenance 144행)
- Modify: `frontend/pages/trash/[id].vue` (provenance 345행)

**Interfaces:**
- Consumes: 각 페이지 in-scope 변수 — `item.value.address`/`item.value.usage`, `data.value.city`/`data.value.district`.

- [ ] **Step 1: 공매 `auction/item/[cltrMngNo].vue` — 골격 템플릿 (144행)**

```ts
// before
  description: `${item.value.address ?? '공매 물건'} 온비드 공매 정보 (한국자산관리공사 기반)`,
// after
  description: `${item.value.address ?? '공매 물건'} ${item.value.usage ? item.value.usage + ' ' : ''}물건의 온비드 공매 정보 데이터입니다. 한국자산관리공사 기반으로 감정가·최저입찰가·입찰일정 등 공매 정보를 제공합니다.`,
```

- [ ] **Step 2: 쓰레기 `trash/[id].vue` — 골격 템플릿 (345행)**

```ts
// before
      description: `${data.value.city ?? ''} ${data.value.district ?? ''} 생활폐기물 배출일정 (환경부 공공데이터 기반)`.trim(),
// after
      description: `${data.value.city ?? ''} ${data.value.district ?? ''} 지역의 생활폐기물 배출일정 데이터입니다. 환경부 공공데이터 기반으로 일반·음식물·재활용·대형폐기물의 배출 요일·시간·방법을 제공합니다.`.trim(),
```

- [ ] **Step 3: 린트 + 전체 테스트**

Run: `cd frontend && npm run lint && npm run test`
Expected: PASS.

- [ ] **Step 4: 커밋**

```bash
git add "frontend/pages/auction/item/[cltrMngNo].vue" "frontend/pages/trash/[id].vue"
git commit -m "fix(seo): 공매·쓰레기 Dataset description 골격 템플릿 작성"
```

---

### Task 5: 최종 검증

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 전체 테스트 + 린트 통과 확인**

Run: `cd frontend && npm run lint && npm run test`
Expected: 전부 PASS.

- [ ] **Step 2: 빌드 회귀 없음 확인**

Run: `cd frontend && npm run build`
Expected: 성공.

- [ ] **Step 3: (선택) SSR Dataset description 길이 수동 확인**

dev 서버에서 건물 상세 1건 SSR HTML을 받아 `application/ld+json` 중 `"@type":"Dataset"`의 `description` 길이가 50자 이상인지 확인. 빌드/PR 환경에선 Task 1 단위테스트가 동일 보장을 함.

검증 메모: 머지 후에도 GSC 리포트는 크롤러 재크롤 전까지 시차가 있으므로, "수정 결과 확인"으로 재검증 요청.

---

## 검증 (Self-Review 결과)

- **Spec coverage:** 중앙 안전망(Task1) + 9개 페이지 배선(Task2 건물 / Task3 6개 스왑 / Task4 공매·쓰레기) + 테스트(Task1) + 최종검증(Task5) — spec의 모든 항목 매핑됨. WebPage 도입/중복 title/land 404는 spec에서 범위 밖으로 명시.
- **Placeholder scan:** 모든 코드 스텝에 실제 before/after 코드 포함. TBD/생략 없음.
- **Type consistency:** `ensureDatasetDescription(base: string, src: DataSourceInfo): string` — Task1 정의, Task1 Step5에서 동일 시그니처로 호출. `DataSourceInfo`는 dataSource.ts 기존 타입.
