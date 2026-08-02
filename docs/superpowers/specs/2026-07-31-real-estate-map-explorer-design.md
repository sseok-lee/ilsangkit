# `/real-estate` 지도 탐색 화면 설계

- 작성일: 2026-07-31
- 상태: 설계 승인됨, 구현 계획 대기
- 참고 대상: [zippoom.com/main/price](https://zippoom.com/main/price)

## 1. 배경과 목적

### 현재 `/real-estate`의 문제

부동산 최상위 허브가 데이터를 보여주지 않고 데이터를 **설명**하고 있다. 현재 구성은 다음과 같다.

1. `PageHero` — 제목 + 고정 스탯 3개
2. `부동산 유형별 실거래가` — 유형 카드 6종 + 토지 카드
3. `AdBanner`
4. `부동산 실거래가란?` — 정적 설명 2문단
5. `자주 묻는 질문` — 정적 FAQ 5개
6. `DataSourceSection`

실제 데이터는 유형 카드의 `최근 30일 N건` 카운트 하나뿐이다. 606만 거래행과 370,273개 건물 요약을 보유한 사이트의 부동산 허브가 가격을 한 개도 보여주지 않는다.

정적 FAQ 보일러플레이트는 GSC 색인 감소 진단에서 이미 근본 원인으로 지목됐고, 상세 페이지에서는 제거(#625)됐으나 허브에는 남아 있다.

### 목적

`/real-estate`를 **설명 페이지에서 데이터 페이지로 전환**한다. 지도 기반 탐색 경험을 제공하되, 이 페이지가 지고 있는 SEO 허브 기능(크롤 예산 배포)은 축소하지 않고 오히려 늘린다.

### 이번 범위에서 제외한 것

- **시세 변동 랭킹(변동률 높음/상승/하락 Top10)** — 평당가·전월대비 집계 파이프라인 신규 구축이 필요하다. 좌측 사이드바 하단에 자리만 비워두고 다음 사이클에서 붙인다.
- **`RealEstateBuildingSummary.latestDealYear/Month` 미래 날짜 이슈** — 아래 8장 참조. 별도 추적.

## 2. 참고 대상 분석 — zippoom `/main/price`

- URL 패밀리: `/main/price`(전국) + `/main/price/{시도}` 17개
- 레이아웃: 좌측 고정폭(~22%) 스크롤 사이드바 + 우측 전체화면 네이버 지도
- 좌측: 지역 칩 → 랭킹 3종 Top10(변동률 높음 / 상승 / 하락) → 각 "더보기"
- 우측 지도: 상단 필터바(유형 다중, 매매·전세·월세, 가격·면적·층수·평점, `매물만 보기` 토글), 원형 클러스터 마커, 건물별 가격 라벨, 지하철역, ★평점, 줌·레이어 컨트롤, 하단 브레드크럼

### 우리와의 결정적 차이

zippoom의 지도 마커는 **중개 매물**이다(`매물 54`, `월 38.5억`, `전 1억`). 우리 부동산 모델은 전부 `*Transaction`(국토교통부 실거래)뿐이라 매물 데이터가 없다. 따라서 같은 화면을 만들어도 마커의 의미가 "실거래가 발생한 건물"이 된다. 이는 zippoom 계열이 아니라 호갱노노·아실 계열의 제품이다. 이 차이를 인정하고 설계한다.

반대로 우리에게만 있는 자산도 있다 — 생활시설 좌표(병원 79,666 / 어린이집 54,881 / 약국 25,251 / 공원 17,021 / 주차장 13,709 / 학교 12,014 / 지하철역 1,094). 이번 범위에는 넣지 않으나 향후 차별화 여지로 기록해 둔다.

## 3. 데이터 현황 (2026-07-31 로컬 DB 실측)

### 건물 요약 — `RealEstateBuildingSummary` 370,273행, 좌표 보유 99.97%

| 유형 | 건수 | 좌표 보유 |
|---|---:|---:|
| villa-rent | 160,981 | 160,961 |
| villa-sale | 107,576 | 107,567 |
| apt-rent | 39,689 | 39,688 |
| apt-sale | 37,119 | 37,103 |
| offitel-rent | 15,912 | 15,907 |
| offitel-sale | 8,952 | 8,948 |
| store-sale / land-sale | 44 | 0 (제외) |

`latestPrice`는 전 행 NOT NULL. 매매는 거래금액, 전월세는 보증금(만원 단위)을 담는다.

### 평당가 계산 가능성

`AptSaleTransaction` 1,344,059행 전부 `exclusiveArea` 보유 → 평당가 100% 계산 가능.

평당가 = `dealAmount / (exclusiveArea / 3.3058)` (전용면적 기준)

### 지역 좌표 — `Region` 267행

`bjdCode`(5자리 시군구), `city`, `district`, `slug`, `lat`, `lng` 보유. 구·군 버블 좌표로 그대로 사용한다. **시/도 중심좌표 상수는 없어 신규로 17개 추가가 필요하다.**

### 기존 자산 — 재사용 가능

- **bbox 조회 규약이 이미 존재한다.** `swLat`/`swLng`/`neLat`/`neLng` + `facilityService.buildBoundsFilter()` + `schemas/facility.ts`의 Zod 검증(`KOREA_BOUNDS` 범위, 4개 동시 제공 강제). 시설·EV충전소가 사용 중이고 부동산에만 없다. 새로 발명하지 않고 이식한다.
- `useKakaoMap` — `initMap`, `addMarkers`, `clearMarkers`, `panTo`, `setCenter`, `getCenter`, `getBounds`, `coordToRegion`
- `FacilityMap.vue` — 이미 `{ center, sw, ne }` 형태로 bounds를 emit
- `realEstateHubSummaryService` — TTL 캐시 + in-flight 합치기 + 실패 시 짧은 TTL 패턴
- `/auction/ranking` — 랭킹 페이지 선례 (다음 사이클에서 참고)

## 4. 결정 사항

| 항목 | 결정 |
|---|---|
| 적용 대상 | `/real-estate` 전면 교체 |
| 레이아웃 | 좌측 사이드바 + 우측 전체화면 지도 (분할) |
| 지도 레이어 | 건물 마커(최근 실거래가 금액) + 줌 아웃 시 지역 평균 버블 |
| 필터 축 | 유형 단일 × 거래 단일, 기본 `아파트 매매` |
| 좌측 콘텐츠 | 줌 아웃 → 지역 목록(SSR) / 줌 인 → 건물 목록(클라이언트) |
| 지역 버블 지표 | 평균 **평당가** |
| 모바일 | 지도 전체화면 + 하단 바텀시트 |
| 광고 | 좌측 목록 중간 인피드 1개 추가 (기존 `AdBanner` 1개 유지, 총 2개) |
| 정적 FAQ | 제거 (FAQPage JSON-LD 포함) |

### 화면 구조와 스크롤

```
데스크톱 (lg+)                          모바일
┌──────────┬────────────────────┐      ┌────────────────────┐
│ 사이드바  │  지도               │      │  지도 (전체)        │
│ 22%      │  ┌───────────────┐ │      │                    │
│ (내부     │  │ 유형 · 거래    │ │      │  [유형·거래 칩]     │
│  스크롤)  │  └───────────────┘ │      │                    │
│          │                    │      ├────────────────────┤
│ [지역/   │      ● 마커         │      │ ═══ 핸들 ═══       │
│  건물    │                    │      │ 목록 (바텀시트)     │
│  목록]   │              [+/-] │      │  └ 확장 시 하단     │
│          │                    │      │    콘텐츠까지 연결   │
│ [인피드  │                    │      │                    │
│  광고]   │                    │      └────────────────────┘
└──────────┴────────────────────┘
        ↓ 스크롤
┌───────────────────────────────┐
│ 유형 카드 7개 · 축약 설명 ·     │
│ AdBanner · DataSourceSection   │
└───────────────────────────────┘
```

- 데스크톱: 분할 화면(사이드바 + 지도)은 **뷰포트 높이로 고정**하고, 좌측은 내부 스크롤을 갖는다. 페이지를 아래로 스크롤하면 하단 콘텐츠 영역이 이어진다.
- 모바일: 바텀시트를 최대로 확장하면 목록 아래로 하단 콘텐츠가 연결된다 (6.4 참조).
- 인피드 광고 위치: 좌측 목록 **5번째 항목 뒤**(초기값). 지역 모드(17개)·건물 모드(최대 200개) 양쪽에서 스크롤 경로상에 놓인다.

### 좌측을 "결합 방식"으로 정한 이유

지도는 SSR이 불가능하다. 따라서 전면 교체 후 좌측 사이드바가 이 페이지에서 크롤러가 읽을 수 있는 **유일한** 콘텐츠가 된다.

좌측을 뷰포트 종속 건물 목록으로만 두면 `/real-estate`의 SSR 콘텐츠가 사실상 0이 되어, 부동산 최상위 허브가 빈 페이지가 된다. 과거 `SSR 풀고갈 → noindex 색인 제외`, `지역 목록 SSR화` 건과 같은 실패 유형이다.

결합 방식은 이를 상태 분리로 해결한다. 초기 진입 = 전국 뷰 = 지역 버블 → 좌측은 시/도 목록을 SSR로 렌더한다(크롤러가 읽는 상태). 사용자가 줌 인하면 건물 목록으로 전환된다(크롤러는 도달하지 않지만, 그 역할은 기존 지역 페이지가 이미 수행 중).

사용자 입장의 규칙도 하나로 정리된다 — **좌측은 항상 지도의 현재 상태를 반영한다.**

### 지역 버블을 평당가로 정한 이유

평균 실거래가는 면적 구성에 좌우되어 지역 비교가 왜곡된다(강남 소형 vs 외곽 대형). 평당가는 면적 보정되어 지역 간 비교가 정확하다. 줌 전환 시 단위가 바뀌는 문제는 버블에 `평당` 단위를 명시해 해소한다.

## 5. 아키텍처

### 5.1 뷰포트 데이터 전략

**채택: 행정구역 집계 + 뷰포트 건물 조회 (2쿼리 전환)**

줌 임계값 기준으로 서버가 두 모드 중 하나로 응답한다. 집계 단위가 행정구역이라 좌측 목록·기존 `/real-estate/{type}/{city}/{district}` URL과 그대로 맞물린다.

**기각한 대안**

- *격자 사전집계 테이블 신설* — 신규 테이블 + 갱신 파이프라인이 붙고, 격자 경계가 행정구역과 어긋나 좌측 목록과 불일치한다. 사이트맵 건에서 `*Property` 테이블을 신설했다 닫은 것과 같은 실수가 된다.
- *전량 내려받고 클라이언트 클러스터링* — 전국 뷰에서 37,119개(아파트 매매) 마커를 통째로 전송한다. 사이트맵 동결 사고 때 `real-estate-buildings` 50.8MB 응답이 PM2 메모리를 500MB 넘겨 백엔드를 재시작시킨 것과 같은 실패 경로다.

### 5.2 줌 3단계

| 카카오맵 level | 좌측 | 지도 | 데이터 출처 |
|---|---|---|---|
| ≥ 11 (전국·광역) | 시/도 17개 목록 | 시/도 평균 버블 | 거래 테이블 집계 (캐시) |
| 8–10 | 구·군 목록 | 구·군 평균 버블 (최대 267) | 거래 테이블 집계 (캐시) + `Region.lat/lng` |
| ≤ 7 | 건물 목록 | 건물 마커 (최대 ~200) | `RealEstateBuildingSummary` bbox |

임계값은 초기값이며 실측 후 조정한다.

### 5.3 API 계약

```
GET /api/real-estate/:type/map
  ?level=&swLat=&swLng=&neLat=&neLng=&rentType=
```

- `:type` — 기존 `RealEstateType` 6종(`apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent`). 유형×거래 축이 여기 인코딩돼 있어 새 파라미터가 불필요하다.
- `rentType` — `*-rent`일 때만 `전세` / `월세`. 미지정 시 `전세` 기본.
- `swLat`/`swLng`/`neLat`/`neLng` — `schemas/facility.ts` Zod 규약 이식 (`KOREA_BOUNDS` 범위, 4개 동시 제공 강제)

응답:

```jsonc
{
  "success": true,
  "data": {
    "granularity": "city" | "district" | "building",
    "items": [ /* granularity별 shape */ ],
    "total": 1820,
    "truncated": true
  }
}
```

건물 모드는 `transactionCount DESC` 상위 200개(초기값)로 절단하고 `total`·`truncated`를 함께 반환한다. 절단 사실을 숨기지 않는 것은 사이트맵 상한 절단 건에서 얻은 규칙이다.

`items`의 shape는 `granularity`에 따라 다르다.

```jsonc
// granularity: "city" | "district"
{ "name": "서울", "slug": "seoul", "lat": 37.5, "lng": 127.0,
  "avgPricePerPyeong": 7732, "transactionCount": 12043, "href": "/real-estate/apt-sale/seoul" }

// granularity: "building"
{ "buildingName": "래미안블레스티지", "city": "서울", "district": "강남구", "dongName": "개포동",
  "lat": 37.48, "lng": 127.06, "latestPrice": 168340,
  "latestDealYear": 2026, "latestDealMonth": 3, "latestDealDay": 14,
  "transactionCount": 812, "href": "/real-estate/apt-sale/seoul/gangnam-gu/래미안블레스티지" }
```

금액 단위는 만원(기존 `latestPrice` 컨벤션)이며 표시 포맷은 프론트에서 처리한다.

라우트 핸들러는 `asyncHandler()`로 래핑하고 `validate()`로 Zod 검증한다. BigInt/Decimal은 `serializeRow()`로 Number 변환한다.

### 5.4 신규 인덱스

`RealEstateBuildingSummary`에 좌표 인덱스가 없다. bbox 조회를 위해 하나 추가한다.

```prisma
@@index([type, lat, lng])
```

기존 3개 인덱스(`[type, transactionCount]`, `[type, city, district, transactionCount]`, `[type, buildingName]`)는 지역 집계·정렬에 그대로 쓴다.

### 5.5 캐시 — 최대 리스크 지점

지역 집계는 평당가 계산에 `exclusiveArea`가 필요한데 `RealEstateBuildingSummary`에는 없다. 거래 테이블을 직접 집계해야 하고 아파트 매매만 134만 행이다. **사이트맵 5일 동결의 원인이 정확히 이 콜드 집계 쿼리(56초)였다.**

완화책: 지역 집계는 뷰포트와 무관하다. 줌 아웃 상태의 값은 고정이므로 `(type, rentType, 단계)` 조합 **약 18개 엔트리**만 캐시하면 전부 커버된다.

- `realEstateHubSummaryService`의 패턴을 따른다 — TTL 캐시 + in-flight 합치기 + 실패 시 짧은 TTL
- 배포마다 캐시가 증발하는 문제를 이미 겪었으므로 **부팅 후 백그라운드 워밍**을 함께 넣는다

### 5.6 컴포넌트 구조

```
pages/real-estate/index.vue              셸. SSR(시/도 목록·메타·JSON-LD) + <ClientOnly> 지도
└ RealEstateMapExplorer.vue              분할 레이아웃, 상태 소유
  ├ MapFilterBar.vue                     유형 단일 × 거래 단일
  ├ RealEstateMapCanvas.vue              카카오맵 + 마커/버블
  ├ MapSidebar.vue                       좌측 목록(지역/건물 모드) + 인피드 광고
  └ MapBottomSheet.vue                   모바일. MapSidebar 내용 재사용
composables/useRealEstateMap.ts          상태·조회 오케스트레이션
composables/useMapOverlays.ts            가격 라벨·버블 오버레이 렌더
```

**`useKakaoMap`은 수정하지 않는다.** `addMarkers`가 `FacilitySearchItem` 전용이라 확장하고 싶어지지만, 이 composable은 아래 5개 페이지가 이미 사용 중이다.

- `pages/[category]/[id].vue` (시설 상세)
- `pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (건물 상세)
- `pages/auction/item/[cltrMngNo].vue`
- `pages/subscription/[id].vue`
- `pages/subway/[slug].vue`

가격 라벨/버블은 별도 `useMapOverlays`로 분리하고 `map` 인스턴스만 주입받게 해서 회귀 표면을 0으로 둔다.

### 5.7 상태

| 구분 | 항목 |
|---|---|
| 필터 | `type`, `rentType` |
| 지도 | `level`, `bounds` |
| 파생 | `granularity` (level에서 계산) |
| 결과 | `items`, `total`, `truncated`, `pending` |
| 연동 | `hoveredId`, `selectedId` (목록 ↔ 마커 양방향) |

### 5.8 데이터 흐름

1. **SSR** — 시/도 평균 평당가 집계 → 좌측 목록 + 지도 초기 데이터
2. **지도 idle** → `bounds`/`level` emit → 디바운스 → API → `items` 갱신 → 좌측·마커 동시 반영
3. **필터 변경** → 즉시 재조회 + URL 쿼리 동기화

### 5.9 하이드레이션

URL 쿼리로 위치를 공유할 수 있게 하면(`?type=&level=&lat=&lng=`) SSR이 그 위치의 건물 목록을 렌더해야 할 것 같지만, 그러면 좌측이 SSR/클라이언트 두 경로를 갖게 된다.

**SSR은 URL 쿼리와 무관하게 항상 시/도 목록을 렌더한다.** 지도만 클라이언트에서 해당 위치로 이동시킨다. 지도가 idle된 뒤 좌측이 갱신되므로 이는 hydration mismatch가 아니라 정상적인 post-hydration 업데이트다.

대가는 공유 링크 진입 시 좌측이 한 프레임 동안 시/도 목록으로 보이는 것이다. 두 경로를 유지하는 비용보다 낫다고 판단한다.

브라우저 API 접근에는 `import.meta.client` 가드를 둔다. `watch`/`onMounted` 내부도 예외가 아니다.

### 5.10 렌더링 순서 (LCP)

지도가 히어로면 카카오 SDK 로드가 LCP를 끌고 간다. 좌측 SSR 목록이 먼저 그려지도록 두고, 지도는 스켈레톤 → `onNuxtReady` 이후 SDK 로드로 미룬다. LCP 요소가 SSR 텍스트가 되므로 지도를 넣고도 LCP는 안정적이다.

### 5.11 성능 주의

카카오 `CustomOverlay`는 DOM 노드라 가격 라벨 300개는 무겁다. 줌 레벨별 상한을 차등한다(건물 모드 ~200, 그 위는 버블이라 최대 267). 절단 시 `truncated`로 사용자에게 알린다.

## 6. SEO 처리

### 6.1 기존 자산 처분

| 현재 자산 | 처리 | 근거 |
|---|---|---|
| 유형 카드 7개 (내부링크) | **유지** — 지도 아래 콘텐츠 영역 | 370,273개 건물 요약으로 가는 크롤 경로. 제거 시 허브 기능 붕괴 |
| `ItemList` JSON-LD | 유지 | 위와 동일 |
| `Dataset` JSON-LD | 유지 | 출처·provenance 신호 |
| `Breadcrumb` JSON-LD | 유지 | |
| 정적 설명 2문단 | **축약 후 유지** | Dataset 설명의 본문 근거 |
| `DataSourceSection` | 유지 | 신뢰 디자인 원칙 |
| 정적 FAQ 5개 + `FAQPage` JSON-LD | **제거** | 순수 보일러플레이트. GSC 색인 감소 진단의 지목 대상. 상세는 이미 제거(#625) |
| `AdBanner` 1개 | 유지 + 좌측 인피드 1개 추가 (총 2개) | 광고 축소 금지 |

### 6.2 SSR 콘텐츠는 순증한다

좌측 SSR 시/도 목록 17개가 통째로 새 자산이다 — `/real-estate/{type}/{city}` 링크 17개 + **각 지역의 실제 평균 평당가**.

현재 이 페이지의 유일한 동적 데이터는 유형 카드의 `최근 30일 N건` 하나다. 개편 후에는 실데이터 17개가 SSR로 렌더된다. "설명 페이지 → 데이터 페이지"라는 목적이 SEO 지표로도 그대로 나타난다.

### 6.3 canonical

`?type=&level=&lat=&lng=` 조합은 canonical을 `/real-estate` 고정으로 흡수한다. 쿼리 URL은 사이트맵에 넣지 않는다. 쿼리 조합마다 색인되면 중복 문서가 양산된다 — 네이버 노출 붕괴 때 겪은 패턴이다.

### 6.4 모바일 하단 콘텐츠 도달 경로

지도 전체화면 + 바텀시트 구성에서는 유형 카드·설명이 화면 밖으로 밀린다. 바텀시트를 최대로 확장했을 때 목록 아래로 **유형 카드 → 설명 → 출처**가 이어지게 해서 모바일에서도 SSR 콘텐츠 전체에 도달 가능하게 한다.

## 7. 에러 처리 · 엣지 케이스

### 7.1 실패 모드

| 실패 | 처리 |
|---|---|
| 지역 집계 실패 | fail-open. 시/도 링크 17개는 상수에서 나오므로 항상 SSR 렌더, 평균가 자리만 `—`. `catch → null`로 빈 페이지를 만들지 않는다 |
| bbox 조회 실패 | 좌측은 직전 결과 유지, 지도만 마커 미갱신 + 재시도 안내. 화면을 비우지 않는다 |
| 카카오 SDK 로드 실패 | 지도 영역에 폴백 블록(지역 목록 링크). 좌측은 정상 동작 — 지도 실패가 페이지 전체를 죽이지 않는다 |
| 빈 뷰포트(바다·해외) | `EmptyState` + "지도를 이동해 보세요" |
| 좌표 없는 건물 99행 | 조회에서 제외 |

### 7.2 엣지 케이스

1. **한국 밖으로 드래그** — `KOREA_BOUNDS` Zod 검증에 걸려 422가 난다. 클라이언트에서 bbox를 `KOREA_BOUNDS`로 **클램프한 뒤** 요청한다.
2. **줌 경계 진동** — level이 임계값 근처(10↔11)를 오가면 granularity가 계속 바뀌어 좌측과 마커가 깜빡인다. 전환 임계값에 히스테리시스를 둔다(상승/하강 경계를 다르게).
3. **응답 순서 역전** — 빠른 드래그 시 나중 요청이 먼저 도착한다. 요청 시퀀스 번호로 stale 응답을 폐기한다.
4. **`*-rent`에서 `rentType` 미지정** — `전세` 기본값.

## 8. 테스트 전략

TDD로 진행한다. 태스크를 분리하고 테스트를 먼저 작성한다.

### 백엔드

- `level → granularity` 결정 로직 (히스테리시스 포함)
- bbox Zod 검증: 4개 동시 제공 강제, `KOREA_BOUNDS` 범위
- `serializeRow` — BigInt/Decimal → Number (누락 시 JSON 직렬화 실패)
- 캐시: TTL, in-flight 합치기, 실패 시 짧은 TTL
- `rentType` 분기
- `truncated` 플래그 정확성

### 프론트엔드

- `useRealEstateMap`: granularity 파생, 디바운스, stale 응답 폐기, bbox 클램프
- `MapSidebar`: 지역/건물 두 모드 렌더
- SSR 가드: `import.meta.client` 없이 `document`/`window` 접근이 없을 것
- 하이드레이션: 쿼리 유무와 무관하게 SSR 결과가 항상 시/도 목록

주의: 직접 `mount`하는 컴포넌트는 `ref`/`watch`/`computed`를 **명시 import** 한다. auto-import에 기대면 로컬은 통과하고 CI에서만 `ReferenceError`가 난다.

### 회귀

`useKakaoMap` 무변경이므로 5.6에 나열한 5개 페이지의 기존 테스트가 그대로 통과해야 한다. 이것이 "건드리지 않는다"는 결정의 검증이다.

### 배포 전 필수 게이트

**지역 집계 쿼리의 콜드 실행 시간을 실측하고 기록한다.** 사이트맵 5일 동결의 원인이 "예산 안에서 도는 줄 알았던 콜드 집계 56초"였다. 캐시가 빈 상태(배포 직후)의 실측치가 SSR 예산을 넘으면 워밍 전략을 다시 짠다. 추정치로 넘어가지 않는다.

## 9. 별도 추적 — 요약 테이블 미래 날짜

로컬 DB 기준 `RealEstateBuildingSummary` 370,273행 중 **82,959행(22%)의 `latestDealYear`/`latestDealMonth`가 미래 날짜**(> 2026-07)다. 거래 테이블의 최신 거래는 2026-03이다.

갱신 SQL(`realEstateSummaryService.ts:84`)의 `ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC`는 정상이므로, 로컬 스냅샷의 불일치(요약 갱신 04-18, 거래 sync 03-22)일 가능성이 높다.

다만 **사이트맵 `lastmod`가 이 컬럼을 사용하므로 운영 DB에서 확인이 필요하다.** 미래 lastmod는 크롤러 신뢰도에 영향을 준다. 이 화면의 건물 마커도 "최근 실거래가 + 시점"을 같은 값에서 읽는다.

이번 설계와 분리해 별도로 추적한다.

## 10. 후속 사이클 (이번 범위 밖)

- **시세 변동 랭킹 3종** — 평당가·전월대비 집계 파이프라인 + 좌측 사이드바 하단 섹션. `/auction/ranking` 패턴 참고.
- **생활시설 오버레이** — 병원·어린이집·학교·공원·지하철역을 부동산 지도에 겹치는 토글. 경쟁사에 없는 우리만의 자산.
- **지역별 URL 패밀리** — zippoom의 `/main/price/{시도}`에 대응하는 SSR 랭킹 페이지.
