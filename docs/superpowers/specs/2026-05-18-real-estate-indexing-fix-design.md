# 부동산 상세 페이지 색인률 개선 설계

작성일: 2026-05-18
대상: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

## 배경

2026-05-03 부동산 URL 4-segment 리팩터 후 15일 경과 시점에서 네이버 색인률을 점검한 결과, 다른 카테고리는 정상적으로 색인이 증가하는데(주간 +32K, +4.5K/일) 부동산 페이지만 색인이 지연되고 있다.

코드 점검에서 다음 두 가지 구조적 원인을 확인했다.

1. **`shouldNoindexRealEstateDetail`이 거래 < 10건 페이지를 모두 noindex 처리**
   (`frontend/utils/realEstateNoindex.ts:25`). 빌라·오피스텔은 단지당 거래량이 적어 다수가 자동 차단되고 있다. 사이트맵에는 올라가지만 HTML이 noindex라 네이버가 색인 거부함.
2. **noindex일 때 canonical link 자체를 출력하지 않음**
   (`[buildingName].vue:552`). 차단된 페이지가 받은 백링크 가치가 회수되지 않는다.

추가로 JSON-LD에 `image`, `offers` 같은 리치결과 필드가 빠져 있어 검색엔진이 페이지의 unique value를 인식하기 어렵다.

## 목표

- 거래량 적은 부동산 단지 페이지도 색인 가능한 상태로 만든다.
- 색인 가능 페이지에서 thin content 위험을 낮추기 위해 unique한 인근 단지 데이터를 함께 노출한다.
- noindex/색인 가능을 떠나 외부 백링크 가치가 누락되지 않게 한다.
- JSON-LD 리치결과 자격을 갖춰 검색엔진의 unique value 인식을 돕는다.

## 비목표

- 사이트맵 정책(`SITEMAP_FACILITY_CATEGORIES`, per-category limit) 변경.
- 시설 카테고리(toilet 등)의 noindex/canonical/JSON-LD 변경.
- 부동산 도메인 외 다른 SEO 개선(title 단축, og:image 비율 등은 별도 작업으로 분리).

## 설계

### 1. 인근 단지 섹션 cross-property 확장

#### UX

기존 단일 `nearbyComplexes` 섹션을 3개 propertyType 섹션으로 분리한다.

- 섹션 헤더: `🏢 아파트 실거래`, `🏠 빌라 실거래`, `🏬 오피스텔 실거래` (이미지 디자인 기준)
- 섹션당 최대 4개 카드, 총 최대 12개
- 같은 행정동(bjdCode 10자리 정확 매칭) 내의 다른 단지만
- **현재 페이지 탭(매매/전월세)에 일치하는 가격 데이터가 있는 단지만 노출** — 가격 빈 카드 방지
- rent 모드에서는 추가로 `selectedRentType` 토글(`all` / `jeonse` / `wolse`)에 반응:
  - `all`: 전세/월세 어느 쪽이라도 데이터 있는 단지 노출, 카드에 있는 가격(둘 다 있으면 둘 다) 표시
  - `jeonse`: 전세 데이터 있는 단지만, 전세가만 표시
  - `wolse`: 월세 데이터 있는 단지만, 월세가만(보증금/월세) 표시
- 자기 자신(buildingName) 제외
- 데이터가 0개인 섹션은 아예 렌더링하지 않음
- 모든 섹션이 0개여도 페이지는 그대로 색인 (인근 데이터가 없는 단지도 건물 정보 + 시세 차트 + 거래 내역이 콘텐츠로 존재)

카드 내용 (기존 `frontend/components/realEstate/ComplexCard.vue` 재사용. 현재는 단일 propertyType만 받으므로 propertyType prop 추가 또는 카드 내부에서 자동 결정하도록 확장 필요):
- 단지명 + propertyType 배지
- 주소 (city + district + dong/jibun)
- 가격: 매매 탭이면 `매매 ${매매가}`, 전월세 탭이면 `전세 ${전세가}` / `월세 ${보증금}/${월세}` 중 데이터 있는 것

링크는 `toRealEstateUrl({ type, city, district, buildingName })`로 4-segment URL 생성. 현재 페이지의 거래 모드(`tabPart`)를 카드 propertyType과 결합하여 sibling URL 생성 (예: 매매 탭에서 빌라 카드 클릭 → `villa-sale/...`).

#### Backend

새 엔드포인트: `GET /api/real-estate/nearby`

쿼리 파라미터:
- `bjdCode` (10자리, 필수)
- `mode` (`sale` | `rent`, 필수)
- `rentType` (`all` | `jeonse` | `wolse`, 선택, mode=rent일 때만 의미 있음, 기본 `all`)
- `excludeBuildingName` (현재 단지 제외용, 선택)
- `limitPerType` (기본 4)

응답:
```json
{
  "success": true,
  "data": {
    "apt": [{ "buildingName", "city", "district", "addressDetail", "latestPrice": { "type": "매매|전세|월세", "value1", "value2" } }],
    "villa": [...],
    "offitel": [...]
  }
}
```

서비스 레이어 (`realEstateService.ts`):
- `getNearbyByBjd(bjdCode, mode, opts: { rentType?, exclude?, limitPerType? })`
- mode가 `sale`이면 `apt-sale`, `villa-sale`, `offitel-sale` 3개 모델을 조회, 각각 같은 bjdCode 정확 매칭 + buildingName 그룹화 + 최신 거래 1건씩 가져와 limit
- mode가 `rent`이면 `apt-rent`, `villa-rent`, `offitel-rent`로 동일. 이때 `rentType`에 따라:
  - `all`(기본): 전세/월세 구분 없이 단지의 최신 거래 1건
  - `jeonse`: 전세 거래만 필터, 단지의 최신 전세 1건
  - `wolse`: 월세 거래만 필터, 단지의 최신 월세 1건
- BigInt/Decimal → Number 변환은 기존 `serializeRow()` 활용

SQL은 `$queryRaw` GROUP BY (ev-charger 패턴 참고). bjdCode prefix 매칭은 `LIKE '${bjdCode_prefix_8}%'` 또는 정확 매칭.

#### Frontend

`[buildingName].vue` 변경:
- 기존 `nearbyComplexes` ref와 `getComplexList` 호출 제거, 새 `nearbyByType: { apt: [], villa: [], offitel: [] }` ref 추가
- `watch([resolvedBjdCode, currentTab, selectedRentType])` 로 변경 감지하여 `/api/real-estate/nearby` 재호출
  - 호출 파라미터: `bjdCode=resolvedBjdCode, mode=currentTab(tabPart), rentType=selectedRentType(rent 모드일 때만), excludeBuildingName=buildingName`
- SSR 초기 로드도 `useAsyncData` 키에 `currentTab` 포함하여 캐시 분리 (rentType은 초기엔 `all`이므로 키에 포함 불필요. 클라이언트 토글은 별도 fetch)
- 템플릿: 기존 `인근 단지` 섹션을 propertyType별 3개 섹션으로 분리. 섹션 데이터 0개면 v-if로 섹션 숨김

### 2. noindex 정책 변경

`frontend/utils/realEstateNoindex.ts`:

```typescript
export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  if (INVALID_BUILDING_NAME.test(input.buildingName)) return true  // 지번 패턴: 유지
  if (!input.loaded) return false
  if (!input.hasBuildingInfo) return true  // buildingInfo 로드 실패: 유지
  // 거래 < 10건 조건 제거
  return false
}
```

`RealEstateNoindexInput`에서 `totalCount` 필드는 더 이상 사용되지 않으므로 제거한다. 호출부(`[buildingName].vue:487`)에서도 `totalCount` 인자 삭제.

기존 테스트(`tests/utils/realEstateNoindex.test.ts`가 있다면) 갱신 필요.

### 3. canonical 항상 출력

`[buildingName].vue:552`:

```typescript
// 변경 전
link: noindex.value ? [] : [{ rel: 'canonical', href: canonicalUrl }],

// 변경 후
link: [{ rel: 'canonical', href: canonicalUrl }],
```

noindex일 때도 canonical을 유지해 백링크 가치를 보존한다. 구글/네이버 모두 `noindex` + `canonical` 조합을 허용한다 (`noindex`가 우선).

`useHead` 팩토리 상단 주석(`noindex/canonical 정책` 부분)도 업데이트해 새 정책을 반영.

### 4. JSON-LD 보강

`frontend/composables/useStructuredData.ts`:

#### `setRealEstateListingSchema`에 추가

```typescript
schema.mainEntityOfPage = options.url  // 페이지 main entity 명시
if (options.image) schema.image = options.image
if (options.recentAvg) {
  schema.offers = {
    '@type': 'Offer',
    price: options.recentAvg,
    priceCurrency: 'KRW',
    availability: 'https://schema.org/InStock',
  }
}
if (options.latestDealDate) {
  schema.datePosted = options.latestDealDate  // 신선도 신호
}
```

`RealEstateListingOptions` 타입에 `image?: string`, `recentAvg?: number`, `latestDealDate?: string` 추가.

#### `setBuildingPlaceSchema`에 추가

```typescript
if (options.image) schema.image = options.image
```

`BuildingPlaceOptions`에 `image?: string` 추가.

#### 호출부 (`[buildingName].vue:1051`)

`setRealEstateListingSchema`에 다음 필드 전달:
- `image`: 현재 OG 이미지 URL과 동일 (`og-map` 또는 `og` 엔드포인트)
- `recentAvg`: `summary.value?.recentAvg`
- `latestDealDate`: `buildingInfo.value?.latestDealYear` + `latestDealMonth`로 `YYYY-MM-01` 형식

`setBuildingPlaceSchema`에도 같은 `image` 전달.

## 데이터 흐름

```
SSR: [buildingName].vue
  ├─ resolveBuildingContext() → bjdCode 확보
  ├─ Promise.allSettled([
  │    getTransactionStats,
  │    searchTransactions,
  │    getBuildingInfo,
  │    getAreaGroups,
  │    getNearbyByBjd(bjdCode, mode)   ← 새로 추가
  │  ])
  └─ useHead → meta + canonical(항상) + robots(noindex 조건 단순화)
              + JSON-LD (image, offers, mainEntityOfPage 포함)
```

## 영향 범위

| 파일 | 변경 |
|---|---|
| `backend/src/services/realEstateService.ts` | `getNearbyByBjd()` 추가 |
| `backend/src/routes/realEstate.ts` | `GET /nearby` 라우트 추가 |
| `backend/src/schemas/realEstate.ts` | nearby 쿼리 zod schema 추가 |
| `frontend/utils/realEstateNoindex.ts` | totalCount 조건 제거, 타입에서 필드 제거 |
| `frontend/pages/real-estate/[...]/[buildingName].vue` | 인근 섹션 3분할, canonical 항상 출력, JSON-LD에 image/offers 전달 |
| `frontend/composables/useStructuredData.ts` | RealEstateListing/BuildingPlace에 image/offers/mainEntityOfPage/datePosted 지원 |
| `frontend/components/real-estate/ComplexCard.vue` (기존 컴포넌트면 재사용, 없으면 신규) | 카드 컴포넌트 |
| 테스트: `tests/utils/realEstateNoindex.test.ts`, 백엔드 nearby 서비스 테스트 | 갱신/신규 |

## 테스트 계획

### 백엔드
- `getNearbyByBjd()` 단위 테스트: 같은 bjdCode prefix 매칭, mode별 모델 라우팅, exclude 동작, limit 동작
- `GET /api/real-estate/nearby` 라우트 통합 테스트: 422 (필수 파라미터 누락), 200 정상 응답 구조

### 프론트엔드
- `shouldNoindexRealEstateDetail`: 지번 패턴 → noindex, buildingInfo 없음 → noindex, 거래 0건 → 색인(false)
- `[buildingName].vue` SEO 메타 테스트:
  - noindex 페이지에도 canonical link 출력됨
  - JSON-LD에 `image`, `offers`, `mainEntityOfPage` 포함
- 인근 단지 섹션 렌더링 테스트:
  - propertyType별 섹션이 데이터 있을 때만 노출
  - 모든 섹션이 비어도 페이지 렌더링 정상
  - 자기 자신 제외

### E2E (Playwright)
- 부동산 상세 페이지에서 매매 탭 → 인근 단지 카드의 가격이 모두 매매가
- 전월세 탭으로 전환 → 카드 가격이 전세/월세로 전환
- 전월세 탭에서 `selectedRentType`을 `전세`로 토글 → 인근 카드가 전세 데이터 있는 단지로 필터되고 전세가만 표시
- 전월세 탭에서 `wolse`로 토글 → 월세 데이터 있는 단지로 필터되고 월세가(보증금/월세)만 표시

## 위험 및 완화

| 위험 | 가능성 | 완화책 |
|---|---|---|
| noindex 해제로 thin content 페이지가 다수 색인되어 사이트 전체 품질 점수 하락 | 중 | 인근 단지 섹션이 unique value를 제공해 thin content 위험을 낮춤. 1~2주 후 GSC/네이버 서치어드바이저에서 색인제외 사유 모니터링 |
| 6개 거래유형 URL의 soft duplicate 판정 | 중 | mode별로 표시되는 가격이 달라지고 canonical이 거래유형별로 분리되어 있어 차별화 신호는 있음. 추가로 description에 거래모드 + 거래수가 들어가 있어 unique |
| `getNearbyByBjd` 쿼리 비용 (3개 모델 × 행정동 그룹화) | 중 | bjdCode 인덱스 활용. 응답 캐시(10분 TTL) 또는 SSR 캐시 검토. 부하 측정 후 결정 |
| 인근 0개 페이지가 결국 thin content로 색인제외 | 낮 | 사용자 의사결정: "그대로 색인"으로 합의됨. 모니터링으로 비율 확인 후 필요 시 재검토 |
| JSON-LD에 잘못된 가격 필드(예: 전세 보증금을 매매가로 표기) | 낮 | offers.price는 `summary.recentAvg`(현재 탭 기준)만 사용. 단위는 항상 KRW |

## 롤아웃

1. 백엔드 PR: `/api/real-estate/nearby` + 테스트
2. 프론트엔드 PR (이 PR이 main 변경의 핵심):
   - noindex 정책 변경
   - canonical 항상 출력
   - JSON-LD 보강
   - 인근 단지 섹션 분할
3. 배포 후 즉시:
   - 네이버 서치어드바이저에서 부동산 sitemap 청크 재제출
   - 고가치 부동산 URL 50개 수동 수집 요청 (강남/서초/마포 주요 단지)
4. 1주 후 검증:
   - GSC: 부동산 URL 색인 상태 (색인됨 / 발견-미색인 / 크롤링됨-미색인 / noindex 차단)
   - 네이버 서치어드바이저: 색인제외 사유 카운트 (특히 "중복 페이지")
5. 2~4주 후:
   - 색인률 변화 측정, 색인제외 사유 분석
   - 필요 시 후속 작업(콘텐츠 추가 차별화, 인근 fallback 등) 검토

## 측정 지표

- **선행 지표 (1주):** 네이버 수집통계의 부동산 URL 크롤링 건수, 색인제외 사유 분포
- **핵심 지표 (2~4주):** 부동산 URL 색인 수 증가율, 사이트맵 등록 URL 대비 색인률(%)
- **후행 지표 (4주+):** 부동산 페이지 검색 노출 및 클릭 (GSC, 네이버 검색 노출 데이터)
