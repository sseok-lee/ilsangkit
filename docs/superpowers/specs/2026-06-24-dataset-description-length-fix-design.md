# Dataset `description` 길이 규격 위반 수정 설계

- 작성일: 2026-06-24
- 브랜치 베이스: `develop`
- 관련 선행 작업: `2026-06-22-detail-structured-data-completeness-design.md` (Dataset/provenance 도입)

## 배경 / 문제

Google Search Console에서 리치 결과 오류 수신:

> **'description' 입력란의 문자열 길이가 잘못되었습니다.** (항목 이름: 국토교통부 실거래가 공개시스템)

- 영향 항목 3건(최초 감지 2026-05-05), 모두 `real-estate/villa-sale/...` 건물 상세.
- 원인: 상세 페이지가 내보내는 **Dataset JSON-LD의 `description` 필드**가 Google Dataset 규격(**50~5000자**)의 하한 미만.

### 근본 원인 (코드 확인)

```
페이지: setDetailProvenance({ description: "<짧은 템플릿>" })
  → useStructuredData.ts:857  setDatasetSchema({ description: opts.description })
    → useStructuredData.ts:791  '@type':'Dataset', description   ← GSC가 잡은 필드
```

예) 빌라 "산장" → `"산장 실거래가·시세 (국토교통부 공개 데이터 기반)"` = **28자** → 규격 미달.

### 범위 (GSC의 3건은 빙산의 일각)

`setDetailProvenance` 호출부가 **9개 페이지 타입**에 존재하며 전부 동일한 "짧은 이름 + 짧은 boilerplate" 패턴이라, 이름만 짧으면 어디서든 50자 미만이 됨:

| 페이지 | 현재 provenance description | 짧을 때 |
|---|---|---|
| real-estate 건물 `[buildingName].vue:1220` | `{건물명} 실거래가·시세 (국토교통부…)` | 28~40자 ❌ |
| 토지 `land/.../[dong].vue:422` | `{시}{구}{동} 토지 실거래가·지목·용도지역 (…)` | ~50자 경계 |
| 시설(15종) `[category]/[id].vue:460` | `{이름} {카테고리} 위치·운영정보 (공공데이터…)` | ~25자 ❌ |
| 지하철 `subway/[slug].vue:592` | `{역명} 지하철역 정보 (국토교통부…)` | ~33자 ❌ |
| 청약 `subscription/[id].vue:782` | `{공고명} 청약 일정·정보 (한국부동산원…)` | 짧으면 ❌ |
| 쓰레기 `trash/[id].vue:345` | `{시} {구} 생활폐기물 배출일정 (환경부…)` | 짧으면 ❌ |
| 공공임대 공고 `public-rental/announcements/[pblancId].vue:297` | `{공고명} 공공임대 공고 (LH·SH…)` | 짧으면 ❌ |
| 공매 `auction/item/[cltrMngNo].vue:144` | `{주소} 온비드 공매 정보 (한국자산관리공사…)` | 짧으면 ❌ |
| 공공임대 상세 `public-rental/[type]/[id].vue:174` | `{단지명} 공급 정보 (LH·SH…)` | 짧으면 ❌ |

`wifi`는 `noindex`라 `setDetailProvenance`가 조기 return(Dataset 미출력) → 이 오류와 무관.

## 경쟁 레퍼런스 검증 (ayo.pe.kr)

ayo는 상세 페이지에 **Dataset 스키마를 쓰지 않고** WebPage + Organization만 사용, 풍부한 설명을 `WebPage.description`에 둔다(토지 81자 / 청약 133자 — 실제 값까지 포함). 시사점:

1. ilsangkit은 상세에 WebPage가 없고(홈=WebSite, real-estate 타입 인덱스 1곳만 WebPage) 도메인 스키마 + **Dataset(provenance)** 구조 — 이는 GEO/AI 인용성을 위해 의도적으로 도입한 것(선행 spec).
2. **ayo가 WebPage에 넣는 수준의 풍부한 설명을, ilsangkit은 이미 `<meta name="description">`/`og:description`으로 내보내고 있다** (`buildFacilityDescription`, `buildRealEstateDetailMeta`, `buildSubwayDescription`, `subscriptionSeoDescription` 등).
3. 깨진 것은 그 좋은 설명이 아니라, **Dataset 노드가 따로 들고 있던 짧고 빈약한 별개 description** 하나뿐.
4. GSC 오류 해결에 WebPage 노드 신규 추가는 불필요(구글은 meta description을 직접 읽음). → **WebPage 추가는 본 작업 범위 밖.**

## 결정한 방식: C — 기존 meta description 재사용 + 중앙 50자 floor

페이지가 이미 계산하는 풍부한 meta description을 Dataset description으로 **재사용**(단일 소스, 중복/drift 없음). 재사용할 풍부한 설명이 없는 페이지(공매·쓰레기)만 골격 템플릿을 새로 작성. 그리고 어떤 경우에도 50자 미만이 되지 않도록 `setDetailProvenance`에 중앙 안전망을 둔다.

### 좋은 description 골격 (ayo 검증)

`[지역/대상] [데이터 종류] + [핵심 필드/값] + [출처] + [갱신]`

## 변경 사항

### 1. 중앙 안전망 — 순수 함수 + `setDetailProvenance` 적용

**신설 순수 함수** (`utils/dataSource.ts`, `DataSource` 타입·`resolveDataSource`와 동거):

```ts
/** Google Dataset description 최소 길이(50자) 보장. 미만이면 데이터셋 컨텍스트를 덧붙인다. */
export function ensureDatasetDescription(base: string, src: DataSource): string {
  const trimmed = (base ?? '').trim()
  if (trimmed.length >= 50) return trimmed
  const tail = `${src.datasetName} 기반으로 일상킷이 전국 지역·항목별로 정리해 최신 기준으로 제공하는 공식 공개 데이터입니다.`
  return `${trimmed} ${tail}`.trim().slice(0, 5000)
}
```

- base는 호출부에서 항상 비어있지 않으므로 `base(≥~20) + tail(≥~40)` ≥ 50 보장. 빈 문자열이어도 tail 단독으로 ≥50.
- 상한 5000자 `slice`로 안전.

**적용** (`composables/useStructuredData.ts:857`):
```ts
// before
description: opts.description,
// after
description: ensureDatasetDescription(opts.description, src),
```
호출부 9개는 이 변경만으로도 규격을 통과(품질은 아래 2번에서 향상).

### 2. 페이지별 description 배선 (품질 향상 — 풍부한 글을 Dataset에 전달)

**그룹 A — 기존 풍부한 description을 그대로 스왑 (in-scope, 1줄 교체)**

| 페이지 | provenance description 교체 |
|---|---|
| 토지 `[dong].vue:422` | `pageDescription.value` |
| 공공임대 공고 `[pblancId].vue:297` | `annDescription` (const, 244에 정의) |
| 공공임대 상세 `[type]/[id].vue:174` | `seoDescription.value` (computed, 111) |
| 지하철 `[slug].vue:592` | `buildSubwayDescription(station.value)` (import 존재, 297) |
| 청약 `[id].vue:782` | `subscriptionSeoDescription.value` (선언 순서 확인; 필요 시 위로 이동) |
| 시설 `[category]/[id].vue:460` | `buildFacilityDescription(facility.value)` (`useFacilityMeta`에서 import, export 확인됨:95) |

**그룹 B — 공유 computed로 끌어올림 (meta description이 `useHead` 콜백에 갇힘)**

`real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`:
```ts
// 신규: 단일 소스 computed (현재 useHead 콜백 안의 buildRealEstateDetailMeta(...) 호출을 끌어올림)
const detailMeta = computed(() => buildRealEstateDetailMeta({
  buildingName: buildingName.value,
  region: { city: buildingInfo.value?.city || cityName,
            district: buildingInfo.value?.district || districtName,
            dong: buildingInfo.value?.dongName ?? null },
  propertyType: propertyTypeParam,
  transactionMode: currentTab.value,
  summary: ...,            // 기존 useHead 내부 로직 이전
  buildYear: ...,
  areaRange: ...,
  facilitySummary: facilitySummary.value,
}))
```
- `useHead`: `description`/`og:description`/`twitter:description`/`og:title`/`title` 모두 `detailMeta.value.*` 사용.
- `watchEffect`의 `setDetailProvenance`: `description: detailMeta.value.description`.
- 주의: 기존 useHead 콜백 내부의 `areaRange`/`recentDeal`/`totalCount` 계산 로직을 computed로 함께 이전(반응성 유지). 동작 동일성 회귀 주의.

**그룹 C — 재사용할 풍부한 설명이 없음 → 골격 템플릿 신규 작성 (in-scope 변수 사용)**

| 페이지 | 신규 description |
|---|---|
| 쓰레기 `trash/[id].vue:345` | `` `${data.value.city ?? ''} ${data.value.district ?? ''} 지역의 생활폐기물 배출일정 데이터입니다. 환경부 공공데이터 기반으로 일반·음식물·재활용·대형폐기물의 배출 요일·시간·방법을 제공합니다.`.trim() `` |
| 공매 `auction/item/[cltrMngNo].vue:144` | `` `${item.value.address ?? '공매 물건'} ${item.value.usage ? item.value.usage + ' ' : ''}물건의 온비드 공매 정보 데이터입니다. 한국자산관리공사 기반으로 감정가·최저입찰가·입찰일정 등 공매 정보를 제공합니다.` `` |

(두 골격 모두 50자 이상이지만, 중앙 floor가 최종 안전망으로 동시에 적용됨.)

## 테스트

신규 순수 함수 단위 테스트 — `frontend/tests/utils/dataSource.test.ts`:

- 짧은 입력(예: `"산장 실거래가·시세 (국토교통부 공개 데이터 기반)"`, 28자) → 결과 `length >= 50`
- 이미 50자 이상 입력 → **그대로 반환(불변)**
- 빈 문자열 입력 → 크래시 없음, 결과 `length >= 50`
- 비정상적으로 긴 입력 → 결과 `length <= 5000`

기존 회귀 방지:
- `cd frontend && npm run test` (vitest) — 전체 통과
- `cd frontend && npm run lint`
- 9개 페이지 SSR 렌더 시 Dataset `description` ≥ 50자임을 한 페이지(건물 상세)에서 수동 확인(빌드 후 HTML grep) — 선택.

## 범위 밖 (의도적 분리)

- 중복 title(`seo_duplicated_title`) 수정 — 별도 작업
- land 토지 동상세 404 — 별도 작업
- 상세 페이지 WebPage 스키마 신규 도입(ayo 형태) — 불필요, 별도 검토
- 개별 페이지 본문/제목 카피 개선

## 검증/배포 메모

- 머지 후에도 GSC 리포트는 크롤러가 해당 페이지를 **재크롤할 때까지 시차** 존재(정상). "수정 결과 확인"으로 재검증 요청 가능.
- PR 워크플로우 준수: `develop` 대상 PR, CI green 후 머지. 운영 반영은 main 승격 시.
