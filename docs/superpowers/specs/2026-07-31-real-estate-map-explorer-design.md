# `/real-estate` 지도 탐색 화면 설계

- 작성일: 2026-07-31
- 개정: 2026-08-03 — **운영 DB 실측 반영**. 수치·인덱스 전략·거래 축·캐시 리스크가 모두 바뀌었다.
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

실제 데이터는 유형 카드의 `최근 30일 N건` 카운트 하나뿐이다. 수백만 거래행과 387,549개 건물 요약을 보유한 사이트의 부동산 허브가 가격을 한 개도 보여주지 않는다.

정적 FAQ 보일러플레이트는 GSC 색인 감소 진단에서 이미 근본 원인으로 지목됐고, 상세 페이지에서는 제거(#625)됐으나 허브에는 남아 있다.

### 목적

`/real-estate`를 **설명 페이지에서 데이터 페이지로 전환**한다. 지도 기반 탐색 경험을 제공하되, 이 페이지가 지고 있는 SEO 허브 기능(크롤 예산 배포)은 축소하지 않고 오히려 늘린다.

### 이번 범위에서 제외한 것

- **시세 변동 랭킹(변동률 높음/상승/하락 Top10)** — 평당가·전월대비 집계 파이프라인 신규 구축이 필요하다. 좌측 사이드바 하단에 자리만 비워두고 다음 사이클에서 붙인다.
- **생활시설 오버레이** — 10장 참조.

## 2. 참고 대상 분석 — zippoom `/main/price`

- URL 패밀리: `/main/price`(전국) + `/main/price/{시도}` 17개
- 레이아웃: 좌측 고정폭(~22%) 스크롤 사이드바 + 우측 전체화면 네이버 지도
- 좌측: 지역 칩 → 랭킹 3종 Top10(변동률 높음 / 상승 / 하락) → 각 "더보기"
- 우측 지도: 상단 필터바(유형 다중, 매매·전세·월세, 가격·면적·층수·평점, `매물만 보기` 토글), 원형 클러스터 마커, 건물별 가격 라벨, 지하철역, ★평점, 줌·레이어 컨트롤, 하단 브레드크럼

### 우리와의 결정적 차이

zippoom의 지도 마커는 **중개 매물**이다(`매물 54`, `월 38.5억`, `전 1억`). 우리 부동산 모델은 전부 `*Transaction`(국토교통부 실거래)뿐이라 매물 데이터가 없다. 따라서 같은 화면을 만들어도 마커의 의미가 "실거래가 발생한 건물"이 된다. 이는 zippoom 계열이 아니라 호갱노노·아실 계열의 제품이다. 이 차이를 인정하고 설계한다.

반대로 우리에게만 있는 자산도 있다 — 생활시설 좌표(병원 79,666 / 어린이집 54,881 / 약국 25,251 / 공원 17,021 / 주차장 13,709 / 학교 12,014 / 지하철역 1,094). 이번 범위에는 넣지 않으나 향후 차별화 여지로 기록해 둔다.

## 3. 데이터 현황 — 운영 DB 실측 (2026-08-03)

로컬 스냅샷은 거래 sync 2026-03-22 / summary 갱신 2026-04-07로 낡아 근거로 쓰지 않는다. 아래는 전부 운영 DB 측정값이다.

### 건물 요약 — `RealEstateBuildingSummary` 387,549행

| type | 행수 | 전세(`monthlyRent=0`) | 월세(`>0`) | NULL | 좌표 보유 |
|---|---:|---:|---:|---:|---:|
| villa-rent | 166,318 | 65,842 | 100,476 | 0 | 166,297 |
| villa-sale | 117,348 | — | — | 117,348 | 117,339 |
| apt-rent | 40,215 | 18,790 | 21,425 | 0 | 40,214 |
| apt-sale | 38,037 | — | — | 38,037 | 38,033 |
| offitel-rent | 16,245 | 4,865 | 11,380 | 0 | 16,243 |
| offitel-sale | 9,386 | — | — | 9,386 | 9,385 |

좌표 보유율 **99.99%**. `store-sale`/`land-sale`은 운영에 존재하지 않는다.

### `monthlyRent` 컬럼 — 판별식 주의

2026-08-03 배포로 추가됐고 **운영 전월세 3종에 이미 전부 채워져 있다**(NULL 0건, 최종 갱신 08-03 09:05~09:09). 별도 백필이 필요 없다.

판별식은 다음과 같다. **`IS NULL`이 아니다.**

| 값 | 의미 |
|---|---|
| `NULL` | 매매 타입 (스키마상 항상 NULL) |
| `0` | 전월세 타입의 **전세** |
| `> 0` | 전월세 타입의 **월세** |

거래 테이블에서도 전세는 `monthlyRent = 0`으로 저장되며 NULL은 0건이다. 전월세 타입에서 NULL이 보인다면 그건 전세가 아니라 **summary 미갱신**을 뜻한다.

### 거래 테이블 규모

| 테이블 | 행수 |
|---|---:|
| `AptRentTransaction` | 3,235,810 |
| `AptSaleTransaction` | 1,557,394 |
| `VillaRentTransaction` | 802,107 |

최신 거래 `202608`. 평당가 = `dealAmount / (exclusiveArea / 3.3058)` (전용면적 기준).

### 지역 좌표 — `Region` 267행

`bjdCode`(5자리 시군구), `city`, `district`, `slug`, `lat`, `lng` 보유. 구·군 버블 좌표로 그대로 사용한다. **시/도 중심좌표 상수는 없어 신규로 17개 추가가 필요하다.**

### 기존 자산 — 재사용 가능

- **bbox 조회 규약이 이미 존재한다.** `swLat`/`swLng`/`neLat`/`neLng` + `facilityService.buildBoundsFilter()` + `schemas/facility.ts`의 Zod 검증(`KOREA_BOUNDS` 범위, 4개 동시 제공 강제). 시설·EV충전소가 사용 중이고 부동산에만 없다.
- **`SCAN_CAP` + `exact` 플래그 컨벤션** — `constants/geo.ts`의 `NEARBY_SUMMARY.SCAN_CAP`과 `NearbyCountEntry.exact`. 스캔 상한에 걸리면 값이 하한임을 호출자에게 알린다. 이 컨벤션을 따른다.
- `useKakaoMap` — `initMap`, `addMarkers`, `clearMarkers`, `panTo`, `setCenter`, `getCenter`, `getBounds`, `coordToRegion`
- `FacilityMap.vue` — 이미 `{ center, sw, ne }` 형태로 bounds를 emit
- `countNearby()` / `GET /api/facilities/nearby-counts` — 10장(후속) 참조
- `/auction/ranking` — 랭킹 페이지 선례 (다음 사이클에서 참고)

## 4. 결정 사항

| 항목 | 결정 |
|---|---|
| 적용 대상 | `/real-estate` 전면 교체 |
| 레이아웃 | 좌측 사이드바 + 우측 전체화면 지도 (분할) |
| 지도 레이어 | 건물 마커(최근 실거래가 금액) + 줌 아웃 시 지역 평균 버블 |
| 필터 축 | 유형 단일(아파트·빌라·오피스텔) × **거래 2종(매매 / 전월세)**, 기본 `아파트 매매` |
| 좌측 콘텐츠 | 줌 아웃 → 지역 목록(SSR) / 줌 인 → 건물 목록(클라이언트) |
| 지역 버블 지표 | 평균 **평당가** |
| 모바일 | 지도 전체화면 + 하단 바텀시트 |
| 지도 상태 URL | **쿼리스트링이 아니라 해시(`#`)** |
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

- 데스크톱: 분할 화면은 **뷰포트 높이로 고정**하고 좌측은 내부 스크롤을 갖는다. 페이지를 아래로 스크롤하면 하단 콘텐츠 영역이 이어진다.
- 모바일: 바텀시트를 최대로 확장하면 목록 아래로 하단 콘텐츠가 연결된다 (6.4 참조).
- 인피드 광고 위치: 좌측 목록 **5번째 항목 뒤**(초기값). 지역 모드(17개)·건물 모드(최대 200개) 양쪽에서 스크롤 경로상에 놓인다.

### 거래 축을 2종으로 정한 이유 — 운영 실측 근거

`RealEstateBuildingSummary`는 `(type, buildingName, bjdCode)`당 **최신 거래 1건**만 보유한다. 따라서 전세/월세로 필터하면 "최신 거래가 마침 그 유형이었던 건물"만 남는다. 운영 실측 누락량은 다음과 같다.

| | 전체 건물 | 이력 보유 | 최신거래 기준 | 누락 |
|---|---:|---:|---:|---:|
| 아파트 **전세** | 40,215 | 33,925 | 18,790 | **15,135 (44.6%)** |
| 아파트 **월세** | 40,215 | 36,552 | 21,425 | **15,127 (41.4%)** |
| 오피스텔 **전세** | 16,245 | 11,172 | 4,865 | **6,307 (56.4%)** |
| 오피스텔 **월세** | 16,245 | 14,579 | 11,380 | **3,199 (21.9%)** |

사용자가 "아파트 전세"를 고르면 전세 거래가 실제로 있는 33,925개 건물 중 18,790개만 지도에 뜬다. 나머지 15,135개는 전세 거래가 있는데도 마지막 거래가 월세였다는 이유로 사라져, 지도상 "전세 없는 동네"로 보인다.

**2종 축은 누락이 0이다.** 전세/월세 구분은 필터가 아니라 **마커 라벨**이 담당한다 — `monthlyRent` 값으로 `전세 3억` / `월 1억·80`을 건물별로 정확히 표시한다.

3종 축을 되살리려면 summary가 건물당 전세 최신·월세 최신을 각각 보유하도록 스키마와 refresh를 고쳐야 하며, 기존 인근 단지 경로에도 영향이 간다. 이번 범위 밖이다.

### 좌측을 "결합 방식"으로 정한 이유

지도는 SSR이 불가능하다. 따라서 전면 교체 후 좌측 사이드바가 이 페이지에서 크롤러가 읽을 수 있는 **유일한** 콘텐츠가 된다.

좌측을 뷰포트 종속 건물 목록으로만 두면 `/real-estate`의 SSR 콘텐츠가 사실상 0이 되어, 부동산 최상위 허브가 빈 페이지가 된다. 과거 `SSR 풀고갈 → noindex 색인 제외`, `지역 목록 SSR화` 건과 같은 실패 유형이다.

결합 방식은 이를 상태 분리로 해결한다. 초기 진입 = 전국 뷰 = 지역 버블 → 좌측은 시/도 목록을 SSR로 렌더한다. 사용자가 줌 인하면 건물 목록으로 전환된다(크롤러는 도달하지 않지만, 그 역할은 기존 지역 페이지가 이미 수행 중).

사용자 입장의 규칙도 하나로 정리된다 — **좌측은 항상 지도의 현재 상태를 반영한다.**

### 지역 버블을 평당가로 정한 이유

평균 실거래가는 면적 구성에 좌우되어 지역 비교가 왜곡된다(강남 소형 vs 외곽 대형). 평당가는 면적 보정되어 지역 간 비교가 정확하다. 줌 전환 시 단위가 바뀌는 문제는 버블에 `평당` 단위를 명시해 해소한다.

## 5. 아키텍처

### 5.1 뷰포트 데이터 전략

**채택: 행정구역 집계 + 뷰포트 건물 조회 (2쿼리 전환)**

줌 임계값 기준으로 서버가 두 모드 중 하나로 응답한다. 집계 단위가 행정구역이라 좌측 목록·기존 `/real-estate/{type}/{city}/{district}` URL과 그대로 맞물린다.

**기각한 대안**

- *격자 사전집계 테이블 신설* — 신규 테이블 + 갱신 파이프라인이 붙고, 격자 경계가 행정구역과 어긋나 좌측 목록과 불일치한다. 사이트맵 건에서 `*Property` 테이블을 신설했다 닫은 것과 같은 실수가 된다.
- *전량 내려받고 클라이언트 클러스터링* — 전국 뷰에서 수만 개 마커를 통째로 전송한다. 사이트맵 동결 사고 때 `real-estate-buildings` 50.8MB 응답이 PM2 메모리를 500MB 넘겨 백엔드를 재시작시킨 것과 같은 실패 경로다.

### 5.2 줌 3단계

| 카카오맵 level | 좌측 | 지도 | 데이터 출처 |
|---|---|---|---|
| ≥ 11 (전국·광역) | 시/도 17개 목록 | 시/도 평균 버블 | 거래 테이블 집계 (캐시) |
| 8–10 | 구·군 목록 | 구·군 평균 버블 (최대 267) | 거래 테이블 집계 (캐시) + `Region.lat/lng` |
| ≤ 7 | 건물 목록 | 건물 마커 (최대 200) | `RealEstateBuildingSummary` bbox |

임계값은 초기값이며 실측 후 조정한다.

### 5.3 API 계약

```
GET /api/real-estate/:type/map?level=&swLat=&swLng=&neLat=&neLng=
```

- `:type` — 기존 `RealEstateType` 6종(`apt-sale`, `apt-rent`, `villa-sale`, `villa-rent`, `offitel-sale`, `offitel-rent`). 유형×거래 축이 여기 인코딩돼 있다.
- **`rentType` 파라미터는 두지 않는다** (4장 근거). `*-rent`는 전세·월세를 함께 반환한다.
- `swLat`/`swLng`/`neLat`/`neLng` — `schemas/facility.ts` Zod 규약 이식 (`KOREA_BOUNDS` 범위, 4개 동시 제공 강제)

응답:

```jsonc
{
  "success": true,
  "data": {
    "granularity": "city" | "district" | "building",
    "items": [ /* granularity별 shape */ ],
    "total": 1820,
    "exact": false   // false면 상한 절단으로 items가 total의 일부
  }
}
```

`exact` 플래그는 `NearbyCountEntry.exact` 컨벤션을 따른다.

`items`의 shape는 `granularity`에 따라 다르다.

```jsonc
// granularity: "city" | "district"
{ "name": "서울", "slug": "seoul", "lat": 37.5, "lng": 127.0,
  "avgPricePerPyeong": 7732, "transactionCount": 12043, "href": "/real-estate/apt-sale/seoul" }

// granularity: "building"
{ "buildingName": "래미안블레스티지", "city": "서울", "district": "강남구", "dongName": "개포동",
  "lat": 37.48, "lng": 127.06,
  "latestPrice": 168340,     // 매매=거래금액, 전월세=보증금 (만원)
  "monthlyRent": null,       // null=매매 / 0=전세 / >0=월세
  "latestDealYear": 2026, "latestDealMonth": 8, "latestDealDay": 14,
  "transactionCount": 812, "href": "/real-estate/apt-sale/seoul/gangnam-gu/래미안블레스티지" }
```

금액 단위는 만원(기존 `latestPrice` 컨벤션)이며 표시 포맷은 프론트에서 처리한다.

**`total`은 `items.length`로 계산하지 않는다.** 별도 `COUNT`로 구한다. 목록 API를 개수 용도로 재사용해 "반경 1km 병원 893곳을 6곳으로" 렌더하던 버그(2026-08)가 정확히 그 실수였다.

라우트 핸들러는 `asyncHandler()`로 래핑하고 `validate()`로 Zod 검증한다. BigInt/Decimal은 `serializeRow()`로 Number 변환한다.

### 5.4 bbox 인덱스 — 인덱스만 추가하면 효과가 없다

**운영 실측 (좌표 인덱스 없는 현재 상태, 서버 부하 0.19)**

| 케이스 | 시간 | 결과행 |
|---|---:|---:|
| apt-sale 강남(밀집) | 98 ms | 200 |
| villa-rent 강남(밀집) | 153 ms | 200 |
| apt-sale 강원산간(희소) | 81 ms | 0 |
| **villa-rent 강원산간(희소)** | **452 ms** | 2 |
| apt-sale 소형 뷰포트 | 66 ms | 12 |

최악은 **희소 뷰포트**다. 16만 행을 역방향 스캔해 2건을 찾는다. 이 452ms는 한가한 서버 기준이며, 8/03 사고에서 rent 경로가 야간 sync 부하에 170ms → 8.08초(약 47배)로 증폭된 전례를 감안하면 부하 시 20초대가 된다.

**핵심: `@@index([type, lat, lng])`를 추가해도 MySQL이 쓰지 않는다.**

로컬(villa-rent 160,981행, 운영 166,318행과 동급) 검증 결과:

| | 선택 인덱스 | 스캔 예상 행 | 시간 |
|---|---|---:|---:|
| 옵티마이저 자연 선택 | `type_transactionCount_idx` (Backward index scan) | 182,317 | **232 ms** |
| `FORCE INDEX(type,lat,lng)` | 좌표 인덱스 + filesort | 31,748 | **11 ms** |

옵티마이저가 filesort를 피하려고 `transactionCount` 역방향 스캔을 고르는데 실제로는 그쪽이 21배 비싸다. `ORDER BY transactionCount DESC LIMIT 200`이 있는 한 이 오판은 계속된다.

**따라서 인덱스와 인덱스 힌트를 함께 적용한다.**

```prisma
@@index([type, lat, lng])
```

```sql
-- Prisma findMany 로는 힌트를 걸 수 없으므로 이 쿼리는 $queryRaw 로 작성한다.
SELECT ... FROM RealEstateBuildingSummary FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)
WHERE type = ? AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?
ORDER BY transactionCount DESC LIMIT ?
```

운영 baseline이 로컬의 약 2배이므로 적용 후 20~25ms대가 예상된다. **배포 후 운영에서 재측정해 이 예상을 확인한다.**

인덱스는 6번째가 된다(기존 5개: `type_buildingName_bjdCode` unique, `type_transactionCount`, `type_city_district_transactionCount`, `type_buildingName`, `type_bjdCode_latestDealYear_latestDealMonth_transactionCount`). 쓰기 비용 증가는 summary refresh(일 1회 배치)에만 영향을 준다.

### 5.5 지역 집계 — sargable 날짜 조건이 전부다

**운영 실측 (2026-08-03, 부하 0.19)**

| 쿼리 | 시간 |
|---|---:|
| 시/도 평균 평당가 (sargable) | **529 ms** |
| 구/군 평균 평당가 (sargable) | **557 ms** |
| 시/도 — **비sargable** (`dealYear*100+dealMonth >= ?`) | **5,862 ms** |
| 시/도 전세 평균, `AptRentTransaction` 323만 행 (sargable) | **803 ms** |

같은 결과를 내는 두 쿼리가 **11배** 차이난다. 날짜 조건은 반드시 sargable 형태로 쓴다.

```sql
-- O: 인덱스 적중
WHERE (dealYear = 2026 AND dealMonth >= 6) OR dealYear > 2026
-- X: 5.9초. 컬럼에 연산이 걸려 인덱스를 못 쓴다
WHERE dealYear * 100 + dealMonth >= 202606
```

초판 스펙은 이 집계를 "이 설계의 최대 리스크"로 지목하고 사이트맵 동결 사고(콜드 56초)를 근거로 들었다. 실측 결과 **sargable만 지키면 0.5~0.8초**로 SSR 예산에 여유 있게 들어간다. 리스크는 크게 내려갔다.

캐시는 그대로 둔다 — 지역 집계는 뷰포트와 무관해 `(type, 단계)` 조합 **12개 엔트리**로 전부 커버된다(6 type × 시도/구군 2단계). `realEstateHubSummaryService`의 TTL + in-flight 합치기 패턴을 따르고, 배포 시 캐시 증발에 대비해 부팅 후 백그라운드 워밍을 넣는다. 다만 콜드가 0.5초대이므로 워밍 실패가 장애로 번지지는 않는다.

> **별건 기록**: `realEstateHubSummaryService`가 현재 비sargable 형태(`dealYear * 100 + dealMonth >= ?`)를 쓴다. 1시간 캐시에 가려져 있으나 캐시 미스마다 5.9초짜리 쿼리가 나간다. 이번 작업과 분리해 별도 수정 대상.

### 5.6 지도 상태는 해시에 담는다

`nuxt.config.ts`에 `'/real-estate/**': { swr: 300 }`이 있다. 지도 상태를 쿼리스트링(`?type=&level=&lat=&lng=`)에 담으면 lat/lng가 연속값이라 **Nitro swr 캐시 키가 무한히 갈라진다.**

2026-08-02에 정확히 이 계열의 사고가 있었다 — swr 캐시가 무제한 적재되어 35분간 heapUsed 70→293MB(증가분의 88%가 렌더된 SSR HTML), 프론트가 V8 heap limit에 도달해 하루 12~24회 SIGABRT 하드 크래시했다. `lruCache max: 500`으로 힙은 묶였지만, 고카디널리티 쿼리가 들어오면 유용한 엔트리를 전부 밀어낸다.

**지도 상태는 URL 해시(`#type=apt-sale&level=9&lat=..&lng=..`)에 담는다.** 해시는 서버로 전송되지 않아 캐시 키에 영향이 없고, 공유 링크는 그대로 동작하며, canonical 중복 걱정도 자동 해소된다(6.3).

### 5.7 컴포넌트 구조

```
pages/real-estate/index.vue              셸. SSR(시/도 목록·메타·JSON-LD) + <ClientOnly> 지도
└ RealEstateMapExplorer.vue              분할 레이아웃, 상태 소유
  ├ MapFilterBar.vue                     유형 단일 × 거래 2종
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

### 5.8 상태

| 구분 | 항목 |
|---|---|
| 필터 | `type` |
| 지도 | `level`, `bounds` |
| 파생 | `granularity` (level에서 계산) |
| 결과 | `items`, `total`, `exact`, `pending` |
| 연동 | `hoveredId`, `selectedId` (목록 ↔ 마커 양방향) |

### 5.9 데이터 흐름

1. **SSR** — 시/도 평균 평당가 집계 → 좌측 목록 + 지도 초기 데이터
2. **지도 idle** → `bounds`/`level` emit → 디바운스 → API → `items` 갱신 → 좌측·마커 동시 반영
3. **필터 변경** → 즉시 재조회 + URL 해시 동기화

### 5.10 하이드레이션

URL 해시로 위치를 공유할 수 있게 하면 SSR이 그 위치의 건물 목록을 렌더해야 할 것 같지만, 애초에 해시는 서버로 전송되지 않으므로 선택의 여지가 없다. 이는 오히려 설계를 단순하게 만든다.

**SSR은 항상 시/도 목록을 렌더한다.** 클라이언트가 마운트 후 해시를 읽어 지도를 해당 위치로 이동시키고, 지도가 idle된 뒤 좌측이 갱신된다. hydration mismatch가 아니라 정상적인 post-hydration 업데이트다.

대가는 공유 링크 진입 시 좌측이 한 프레임 동안 시/도 목록으로 보이는 것이다.

브라우저 API 접근에는 `import.meta.client` 가드를 둔다. `watch`/`onMounted` 내부도 예외가 아니다.

### 5.11 렌더링 순서 (LCP)

지도가 히어로면 카카오 SDK 로드가 LCP를 끌고 간다. 좌측 SSR 목록이 먼저 그려지도록 두고, 지도는 스켈레톤 → `onNuxtReady` 이후 SDK 로드로 미룬다. LCP 요소가 SSR 텍스트가 되므로 지도를 넣고도 LCP는 안정적이다.

### 5.12 성능 주의

카카오 `CustomOverlay`는 DOM 노드라 가격 라벨 300개는 무겁다. 줌 레벨별 상한을 차등한다(건물 모드 200, 그 위는 버블이라 최대 267). 절단 시 `exact: false`로 알린다.

## 6. SEO 처리

### 6.1 기존 자산 처분

| 현재 자산 | 처리 | 근거 |
|---|---|---|
| 유형 카드 7개 (내부링크) | **유지** — 지도 아래 콘텐츠 영역 | 387,549개 건물 요약으로 가는 크롤 경로. 제거 시 허브 기능 붕괴 |
| `ItemList` JSON-LD | 유지 | 위와 동일 |
| `Dataset` JSON-LD | 유지 | 출처·provenance 신호 |
| `Breadcrumb` JSON-LD | 유지 | |
| 정적 설명 2문단 | **축약 후 유지** | Dataset 설명의 본문 근거 |
| `DataSourceSection` | 유지 | 신뢰 디자인 원칙 |
| 정적 FAQ 5개 + `FAQPage` JSON-LD | **제거** | 순수 보일러플레이트. GSC 색인 감소 진단의 지목 대상. 상세는 이미 제거(#625) |
| `AdBanner` 1개 | 유지 + 좌측 인피드 1개 추가 (총 2개) | 광고 축소 금지 |

### 6.2 SSR 콘텐츠는 순증한다

좌측 SSR 시/도 목록 17개가 통째로 새 자산이다 — `/real-estate/{type}/{city}` 링크 17개 + **각 지역의 실제 평균 평당가**.

현재 이 페이지의 유일한 동적 데이터는 유형 카드의 `최근 30일 N건` 하나다. 개편 후에는 실데이터 17개가 SSR로 렌더된다.

### 6.3 canonical

지도 상태를 해시에 담으므로(5.6) 색인 단위가 갈라지지 않는다. canonical은 `/real-estate` 자기참조로 유지된다.

### 6.4 모바일 하단 콘텐츠 도달 경로

지도 전체화면 + 바텀시트 구성에서는 유형 카드·설명이 화면 밖으로 밀린다.

**하단 콘텐츠는 페이지 본문에 한 번만 렌더한다.** 바텀시트 안에 복제하면 모바일 DOM에 `<h2>` 2개·`AdBanner` 2개(총 3개)·유형 카드 2벌이 생겨, 중복 헤딩이 크롤러에 노출되고 광고 수가 의도(2개)를 넘는다.

모바일 사용자는 바텀시트를 접거나(핸들 탭) 페이지를 스크롤해 하단 콘텐츠에 도달한다. 시트는 축소 상태에서 화면 하단 38%만 차지하므로 그 위 영역으로 콘텐츠를 스크롤해 올릴 수 있다.

*(초판은 시트 확장 시 목록 아래로 하단 콘텐츠가 이어지게 하려 했으나, 구현 계획 pre-flight에서 본문 렌더와의 중복이 드러나 2026-08-03에 변경했다.)*

## 7. 에러 처리 · 엣지 케이스

### 7.1 실패 모드

| 실패 | 처리 |
|---|---|
| 지역 집계 실패 | fail-open. 시/도 링크 17개는 상수에서 나오므로 항상 SSR 렌더, 평균가 자리만 `—`. `catch → null`로 빈 페이지를 만들지 않는다 |
| bbox 조회 실패 | 좌측은 직전 결과 유지, 지도만 마커 미갱신 + 재시도 안내. 화면을 비우지 않는다 |
| 카카오 SDK 로드 실패 | 지도 영역에 폴백 블록(지역 목록 링크). 좌측은 정상 동작 |
| 빈 뷰포트(바다·해외) | `EmptyState` + "지도를 이동해 보세요" |
| 좌표 없는 건물 (약 40행) | 조회에서 제외 |

### 7.2 엣지 케이스

1. **한국 밖으로 드래그** — `KOREA_BOUNDS` Zod 검증에 걸려 422가 난다. 클라이언트에서 bbox를 `KOREA_BOUNDS`로 **클램프한 뒤** 요청한다.
2. **줌 경계 진동** — level이 임계값 근처(10↔11)를 오가면 granularity가 계속 바뀌어 좌측과 마커가 깜빡인다. 전환 임계값에 히스테리시스를 둔다(상승/하강 경계를 다르게).
3. **응답 순서 역전** — 빠른 드래그 시 나중 요청이 먼저 도착한다. 요청 시퀀스 번호로 stale 응답을 폐기한다.
4. **`monthlyRent` 판별** — `IS NULL`을 전세로 착각하지 않는다(3장). 전세는 `= 0`이다.

## 8. 테스트 전략

TDD로 진행한다. 태스크를 분리하고 테스트를 먼저 작성한다.

### 백엔드

- `level → granularity` 결정 로직 (히스테리시스 포함)
- bbox Zod 검증: 4개 동시 제공 강제, `KOREA_BOUNDS` 범위
- `serializeRow` — BigInt/Decimal → Number
- 마커 라벨 판별: `monthlyRent` null / 0 / >0 → 매매 / 전세 / 월세
- 캐시: TTL, in-flight 합치기, 실패 시 짧은 TTL
- `exact` 플래그 정확성, `total`이 `items.length`와 독립인지
- **날짜 조건이 sargable 형태인지** — 회귀 방지용으로 생성 SQL 문자열을 검사한다

### 프론트엔드

- `useRealEstateMap`: granularity 파생, 디바운스, stale 응답 폐기, bbox 클램프
- `MapSidebar`: 지역/건물 두 모드 렌더
- SSR 가드: `import.meta.client` 없이 `document`/`window` 접근이 없을 것
- 하이드레이션: SSR 결과가 항상 시/도 목록
- **해시 동기화** — 지도 상태가 쿼리스트링으로 새지 않을 것 (swr 캐시 오염 방지)

주의: 직접 `mount`하는 컴포넌트는 `ref`/`watch`/`computed`를 **명시 import** 한다. auto-import에 기대면 로컬은 통과하고 CI에서만 `ReferenceError`가 난다.

### 회귀

`useKakaoMap` 무변경이므로 5.7에 나열한 5개 페이지의 기존 테스트가 그대로 통과해야 한다.

### 배포 전후 측정

초판이 요구한 "콜드 집계 실측"은 **완료됐다**(5.5). 남은 측정은 다음 둘이다.

1. **인덱스 + 힌트 적용 후 운영 bbox 재측정** — 예상 20~25ms. 예상을 벗어나면 힌트 전략을 재검토한다.
2. **야간 sync 창(03:45~04:15 KST) 부하 중 재측정** — 8/03 사고에서 rent 경로가 47배 증폭됐다. 한가한 시간대 수치만으로 안전을 선언하지 않는다.

## 9. 초판에서 철회한 항목

초판 9장은 `RealEstateBuildingSummary.latestDealYear/Month`에 미래 날짜가 22%(82,959행) 있다고 기록하고 사이트맵 `lastmod` 영향 가능성을 제기했다.

**운영 확인 결과 미래 날짜 행은 6개 type 전부 0건이다.** 로컬 스냅샷(요약 갱신 04-07 vs 거래 sync 03-22)의 불일치 아티팩트였다. 초판의 추정은 철회한다. 갱신 SQL(`realEstateSummaryService.ts`)의 `ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC`는 정상 동작하고 있다.

## 10. 후속 사이클 (이번 범위 밖)

- **시세 변동 랭킹 3종** — 평당가·전월대비 집계 파이프라인 + 좌측 사이드바 하단 섹션. `/auction/ranking` 패턴 참고.
- **생활시설 오버레이** — 2026-08-03에 `countNearby()` + `GET /api/facilities/nearby-counts`가 신설됐다. 개수 전용 경로라 지도 오버레이 요약에 그대로 쓸 수 있다. `NearbyCountCategorySchema`가 `trash`(좌표 없는 일정 데이터)와 `ev-charger`(충전기 행 단위라 충전소 수가 아님)를 제외하는 이유도 이미 정리돼 있다.
- **지역별 URL 패밀리** — zippoom의 `/main/price/{시도}`에 대응하는 SSR 랭킹 페이지.
- **`realEstateHubSummaryService` 비sargable 쿼리 수정** — 5.5 별건 기록.
- **거래 축 3종 복원** — summary가 건물당 전세·월세 최신을 각각 보유하도록 스키마·refresh 변경이 선행돼야 한다.
