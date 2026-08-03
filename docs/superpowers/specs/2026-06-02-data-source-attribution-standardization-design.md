# 데이터 출처 표기 표준화 (Data Source Attribution Standardization)

- **작성일:** 2026-06-02
- **출처 감사:** [2026-06-02-frontend-improvement-audit.md](./2026-06-02-frontend-improvement-audit.md) §① (최우선 항목)
- **상태:** 설계 승인 대기 → spec 검토 → 구현 계획(writing-plans)

---

## 1. 문제 (Problem)

데이터 출처를 표시하는 공유 컴포넌트 `DataSourceCard.vue`와 단일 레지스트리 `utils/dataSource.ts`는 이미 존재하지만, **호출 규칙이 페이지마다 달라** 사용자가 "카테고리마다 출처 섹션이 다르다"고 체감한다.

구체적 불일치:
1. **날짜 표기 제각각** — 시설 상세는 `데이터 기준일`+`최근 동기화` 둘 다, 시설 목록은 둘 다 없음, 쓰레기 상세는 기준일만.
2. **출처가 조건부로 사라짐** — `[buildingName].vue:393`의 `v-if="lastSyncDate"`는 동기화일이 없으면 출처 섹션 전체를 숨긴다(신뢰 요소가 데이터 유무에 종속).
3. **출처가 아예 없는 색인 페이지** — 지역 페이지군(`[city]/index`, `[city]/[district]/index`, `[city]/[district]/[category]`)과 청약 `sale/rent` 하위 목록에 출처 표기 0건. 푸터(`AppFooter.vue:65`)의 "데이터셋별 출처는 각 상세페이지 참조" 약속과 모순이며 공공누리 출처표시 의무·신뢰감을 해친다.
4. **라벨 용어 혼용** — 컴포넌트 헤더 "데이터 정보"(`DataSourceCard.vue:5`) vs 페이지 "데이터 출처".

## 2. 목표 (Goals)

- 출처 표기를 **단일 도메인 인지 컴포넌트** 하나로 수렴해 호출처를 한 줄로 통일.
- **제공기관·데이터셋은 모든 출처 페이지에서 무조건 노출**(조건부 숨김 제거).
- 날짜 표기를 `최근 동기화` 하나로 단순화하고, 그 값이 이미 있는 **상세 페이지에서만** 노출.
- 출처가 없던 페이지(지역 페이지군·청약 하위)에 표기 추가.
- 헤더 라벨을 **"데이터 출처"**로 통일.

## 3. 비목표 (Non-Goals)

- **KOGL(공공누리) 유형 값 채우기** — 별도 TODO. 각 제공처 약관 확인이 필요한 데이터 수집 작업. 컴포넌트는 값이 있으면 노출하는 현 동작만 유지.
- **목록·허브 페이지의 `최근 동기화` fetch** — 추가 네트워크 비용 대비 효용 낮음. 동기화일은 상세에만.
- **`about.vue` 출처 테이블 단일 소스화** — 전혀 다른 표 형태(18행 비교표). 후속 작업으로 분리.
- **검색(`search.vue`)·가이드 상세(`guide/[slug]`) 출처 추가** — 이번 범위 제외.

## 4. 설계 (Design)

### 4-1. 순수 리졸버 + 단일 컴포넌트

`DataSourceCard.vue`(순수 표시용)를 삭제하고 마크업을 도메인 인지 컴포넌트로 흡수한다. 테스트 가능성은 별도 표시 컴포넌트가 아니라 **순수 함수 `resolveDataSource`**로 확보한다(마운트 없이 매핑 검증).

```
frontend/utils/dataSource.ts
  + export type DataSourceDomain = 'facility' | 'real-estate' | 'subscription' | 'public-rental'
  + export function resolveDataSource(input: {
      domain: DataSourceDomain
      category?: FacilityCategory
    }): DataSourceInfo | null

frontend/components/common/DataSourceSection.vue   ← 신설 (구 DataSourceCard 마크업 흡수)
frontend/components/common/DataSourceCard.vue      ← 삭제
```

`resolveDataSource` 동작:
- `domain === 'facility'` → `FACILITY_DATA_SOURCE[category]` (category 누락/미지정 시 `null`)
- `domain === 'real-estate'` → `REAL_ESTATE_DATA_SOURCE`
- `domain === 'subscription'` → `SUBSCRIPTION_DATA_SOURCE`
- `domain === 'public-rental'` → `PUBLIC_RENTAL_DATA_SOURCE`

### 4-2. `DataSourceSection` 컴포넌트 API

```vue
<DataSourceSection
  :domain="DataSourceDomain"        <!-- 필수 -->
  :category="FacilityCategory"      <!-- domain==='facility'일 때 필수 -->
  :last-sync-date="string | null"   <!-- 상세 페이지에서만 전달 -->
  :compact="boolean"                <!-- 다중 카테고리 허브용, 기본 false -->
/>
```

Props 인터페이스:
```ts
defineProps<{
  domain: DataSourceDomain
  category?: FacilityCategory
  lastSyncDate?: string | null
  compact?: boolean
}>()
```

동작 규칙:
- 내부에서 `resolveDataSource({ domain, category })`로 `source` 계산.
- `source`가 `null`이면(예: 알 수 없는 category) 렌더하지 않음(안전 폴백).
- **`dataDate`(데이터 기준일) 행은 제거** — 컴포넌트에서 완전히 삭제.
- 제공기관 행·데이터셋 링크·하단 안내(`{datasetName} 기준 정보입니다`)는 **항상 렌더**.
- `lastSyncDate`가 전달되면 `최근 동기화` 행 추가, 없으면 생략(숨김이 아니라 행만 없음).
- KOGL: `source.kogl`이 있으면 하단 안내에 `· 공공누리 제N유형` 노출(현 동작 유지).
- 헤더 라벨 `데이터 정보` → **`데이터 출처`**.

### 4-3. 다중 카테고리 허브 — `compact` 모드

지역 허브(`[city]/index`, `[city]/[district]/index`)는 여러 시설 카테고리를 모으므로 단일 `DataSourceInfo`가 맞지 않는다. `compact` 모드는 제공기관 카드 대신 한 줄 안내를 렌더한다:

> 데이터 출처: 공공데이터포털 (행정안전부·보건복지부 등) — 자세히 보기 →  (`/about` 링크)

`compact` 모드는 `domain`/`category`와 무관하게 동작하며, 상세 출처는 각 카테고리 페이지로 위임(푸터 약속과 정합).

### 4-4. 마이그레이션 맵

기존 `DataSourceCard` 호출처(14곳) → `DataSourceSection` 전환 + 신규 추가:

| 페이지 / 컴포넌트 | 현재 | 변경 후 |
|---|---|---|
| `pages/[category]/index.vue:280` | `:source="categoryDataSource"` | `domain="facility" :category` |
| `components/facility/detail/DetailContextLinks.vue:82` | `v-if="dataSource"` + dataDate + lastSyncDate | `domain="facility" :category :last-sync-date` (v-if·dataDate 제거) — 부모로부터 받던 `dataSource: DataSourceInfo` prop을 `category: FacilityCategory`로 교체하고 `[id].vue:200`도 `:category` 전달로 변경 |
| `pages/[category]/[id].vue:710` | `dataDate` computed | **삭제**(미사용화) |
| `pages/trash/[id].vue:179` | `:source` + dataDate | `domain="facility" category="trash"` (dataDate 제거) |
| `pages/subway/index.vue:177`, `subway/[slug].vue:211` | `:source="categoryDataSource"` | `domain="facility" category="subway"` |
| `pages/real-estate/index.vue:59` | `:source="REAL_ESTATE_DATA_SOURCE"` | `domain="real-estate"` |
| `pages/real-estate/[realEstateType]/index.vue:160` | 〃 | `domain="real-estate"` |
| `pages/real-estate/[realEstateType]/[city]/index.vue:30` | 〃 | `domain="real-estate"` |
| `pages/real-estate/[realEstateType]/[city]/[district]/index.vue:105` | 〃 | `domain="real-estate"` |
| `pages/real-estate/.../[buildingName].vue:393` | **`v-if="lastSyncDate"`** + lastSyncDate | `domain="real-estate" :last-sync-date` (**v-if 제거**) |
| `pages/subscription/index.vue:144` | `:source="SUBSCRIPTION_DATA_SOURCE"` | `domain="subscription"` |
| `pages/subscription/[id].vue:407` | 〃 | `domain="subscription"` |
| `pages/public-rental/index.vue:15` | `:source="PUBLIC_RENTAL_DATA_SOURCE"` | `domain="public-rental"` |
| `components/subscription/PublicRentalDetailView.vue:57` | `:source` + lastSyncDate | `domain="public-rental" :last-sync-date` |
| **신규** `pages/[city]/[district]/[category].vue` | 없음 | `domain="facility" :category` (전체 카드) |
| **신규** `pages/[city]/index.vue` | 없음 | `compact` 노트 |
| **신규** `pages/[city]/[district]/index.vue` | 없음 | `compact` 노트 |
| **신규** `pages/subscription/sale/[type].vue` | 없음 | `domain="subscription"` |
| **신규** `pages/subscription/rent/[type].vue` | 없음 | `domain="subscription"` |

> 참고: `pages/index.vue`의 `FACILITY_DATA_SOURCE` import(`:249`)은 출처 카드가 아니라 구조화데이터(JSON-LD) 빌더용이므로 변경 대상 아님.

### 4-5. 삭제/정리 대상

- `frontend/components/common/DataSourceCard.vue` 삭제.
- `pages/[category]/[id].vue`의 `dataDate` computed(`:710-715`) 및 `formatDataDate` 사용처 정리(다른 용도 없으면 함께 제거).
- `trash/[id].vue`의 dataDate 전달 로직 제거.

## 5. 테스트 (Testing)

- **유닛** `utils/dataSource.test.ts` — `resolveDataSource`가 도메인×카테고리별로 올바른 `DataSourceInfo`를 반환, 미지정 category에서 `null`.
- **컴포넌트** `DataSourceSection.test.ts`:
  - lastSyncDate 없이도 제공기관·데이터셋 렌더(항상 노출).
  - lastSyncDate 전달 시 `최근 동기화` 행 추가.
  - `dataDate` 행이 더 이상 렌더되지 않음(회귀 가드).
  - `compact` 모드에서 한 줄 안내 + `/about` 링크 렌더.
  - 헤더 라벨이 "데이터 출처".
- **기존 테스트 갱신** — `DataSourceCard`를 참조하던 테스트(부동산 상세·쓰레기 상세 등)를 `DataSourceSection`으로 교체. `npm run test`(frontend) 그린 확인.

## 6. 후속 TODO (이 spec 밖)

- [ ] KOGL(공공누리) 유형 15개 값 채우기 — 각 제공처 약관 확인.
- [ ] `about.vue` 출처 테이블을 `dataSource.ts` 단일 소스로 통합.
- [ ] (선택) 검색·가이드 상세 출처 표기 재검토.

## 7. 영향받는 파일 요약

**신설:** `components/common/DataSourceSection.vue`, `utils/dataSource.test.ts`, `components/common/DataSourceSection.test.ts`
**수정:** `utils/dataSource.ts`(resolver 추가), 마이그레이션 맵의 19개 페이지/컴포넌트
**삭제:** `components/common/DataSourceCard.vue`
