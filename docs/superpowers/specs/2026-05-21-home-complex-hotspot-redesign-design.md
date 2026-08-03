# 메인 "오늘의 부동산 시장" — 단지 단위 핫스팟 재설계

- **Date**: 2026-05-21
- **Status**: Draft (awaiting user review)
- **Replaces**: 2026-05-20-real-estate-hotspot-design.md (시·군·구 단위 핫스팟)

## Context

### 문제
- 운영 환경(`ilsangkit.co.kr`)의 메인 "오늘의 부동산 시장" 섹션에서 **오피스텔 매매가 항상 빈 결과**로 표시됨.
- 검증: `GET /api/meta/hotspots?propertyType=offitel` → `sale: { rising: [], falling: [], active: [] }`. 아파트/빌라는 정상.
- 원인: 현재 핫스팟은 시·군·구 단위 평당가 변동/거래 급증을 산출하며 `SAMPLE_THRESHOLD={apt:30, villa:15, offitel:15}`로 "최근 7일 내 시·군·구별 거래 ≥ N건"을 요구. 오피스텔 매매는 자산 자체의 거래량이 적어 임계치를 충족하는 시·군·구가 사실상 없음.

### 재정의된 목표
사용자(운영자) 결정으로 섹션의 1차 목표를 **유입/SEO** — 메인 카드에서 콘텐츠 깊은 페이지로 클릭 유도 — 로 확정. 우리 사이트에서 콘텐츠 깊이/SEO 잠재가 가장 큰 페이지는 **단지 상세**(`/real-estate/[realEstateType]/[city]/[district]/[buildingName]`).

→ 시·군·구 단위 추상 메트릭(평당가 변동/거래 급증)을 버리고, **단지 단위 카드 → 단지 상세 직결** 구조로 전환.

### 비목표
- 사용자 행동(클릭/조회) 기반 "실시간 인기 단지" — 데이터 없음.
- 매물 증감/입주물량 — 데이터 없음.
- 전세/월세 카드 — 단지 상세 페이지가 매매·전세를 한 페이지에 보여주므로 메인에서는 매매에 SEO 신호 집중.

## 결정 사항 (브레인스토밍 합의)

1. 메인 카드 = **단지 단위**, 도착지 = **단지 상세 페이지**.
2. **3카드 구성**: 신고가 갱신 / 거래 활발 단지 / 평당가 TOP.
3. **자산 토글 유지**(apt/villa/offitel), **거래 유형 토글 제거 → 매매 전용**.
4. 신고가는 **평당가 기준**(절대 거래가 X — 평형 차이 흡수).
5. 임계치는 카드별 정의 참조 (기본값 채택).
6. 슬롯이 부족하면 **부족한 만큼만 노출** (빈 상태 메시지 X).

## 설계

### 섹션 레이아웃

```
┌─ 오늘의 부동산 시장 ───────────────────────────────┐
│ [아파트] [오피스텔] [빌라]      ← 자산 토글       │
│                                                    │
│ ┌─신고가 갱신──┐ ┌─거래 활발──┐ ┌─평당가 TOP──┐ │
│ │ 단지 0~5     │ │ 단지 0~5    │ │ 단지 0~5    │ │
│ └──────────────┘ └─────────────┘ └─────────────┘ │
└────────────────────────────────────────────────────┘
```

- 자산 토글 전환 시 섹션 unmount 안 함 (PR #298 패턴 유지).
- 각 카드는 0~5개 행. 슬롯 부족 시 그만큼만 노출.
- 행 클릭 → `/real-estate/{realEstateType}/{citySlug}/{districtSlug}/{buildingName}`로 이동 (buildingName URL 인코딩).
- 카드 전체가 비면 카드 자체를 숨김 (전체 3카드가 모두 빈 극단 케이스에서는 섹션 자체 숨김).

### 단지 키 정의

`(buildingName, bjdCode)` 조합을 단지 키로 사용. `buildingName`만으론 동명 단지 충돌 가능. 모든 SQL은 이 두 컬럼으로 GROUP BY.

`(city, district, buildingName)` 3개는 단지 상세 URL 생성용으로 동일 응답에 포함.

### 데이터 소스

대상 테이블 (자산별 매매 트랜잭션):
- `AptSaleTransaction`
- `OffitelSaleTransaction`
- `VillaSaleTransaction`

공통 윈도우 앵커: `MAX(STR_TO_DATE(...))` — 국토부 실거래가 30일 lag 회피용. 기존 `realEstateHotspotService.ts:82-87` 패턴 그대로.

### 카드 1: 신고가 갱신

**정의**: 최근 7일(앵커 기준) 거래 중, 해당 `(buildingName, bjdCode)`의 **직전 12개월 거래 최고 평당가를 갱신**한 거래.

**평당가 산식**: `dealAmount / (exclusiveArea / 3.3058)` — 기존 핫스팟 서비스와 동일.

**임계치**: 직전 12개월 거래 ≥ 3건 (신뢰도 확보). 3건 미만 단지는 후보에서 제외.

**정렬**: 갱신폭(`newPyeong / prevMaxPyeong - 1`) DESC.

**상한**: 5건.

**SQL 스케치**:
```sql
WITH anchor AS (
  SELECT MAX(STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d')) AS latest
  FROM AptSaleTransaction
),
recent AS (
  SELECT t.buildingName, t.bjdCode, t.city, t.district,
         STR_TO_DATE(...) AS dealDate,
         t.dealAmount, t.exclusiveArea,
         t.dealAmount / (t.exclusiveArea / 3.3058) AS pyeongPrice
  FROM AptSaleTransaction t, anchor a
  WHERE t.exclusiveArea > 0
    AND STR_TO_DATE(...) >= DATE_SUB(a.latest, INTERVAL 7 DAY)
    AND STR_TO_DATE(...) <= a.latest
),
prior AS (
  SELECT t.buildingName, t.bjdCode,
         MAX(t.dealAmount / (t.exclusiveArea / 3.3058)) AS prevMaxPyeong,
         COUNT(*) AS prevCount
  FROM AptSaleTransaction t, anchor a
  WHERE t.exclusiveArea > 0
    AND STR_TO_DATE(...) >= DATE_SUB(a.latest, INTERVAL 365 DAY)
    AND STR_TO_DATE(...) <  DATE_SUB(a.latest, INTERVAL 7 DAY)
  GROUP BY t.buildingName, t.bjdCode
  HAVING COUNT(*) >= 3
)
SELECT r.buildingName, r.bjdCode, r.city, r.district, r.dealDate,
       r.pyeongPrice AS newPyeong, p.prevMaxPyeong,
       (r.pyeongPrice / p.prevMaxPyeong - 1) * 100 AS changePct
FROM recent r
INNER JOIN prior p ON p.buildingName = r.buildingName AND p.bjdCode = r.bjdCode
WHERE r.pyeongPrice > p.prevMaxPyeong
ORDER BY changePct DESC
LIMIT 5;
```

같은 단지에서 7일 내 여러 거래가 신고가를 갱신하면 가장 최근 1건만 노출하도록 윈도우 함수 추가 (`ROW_NUMBER() OVER (PARTITION BY buildingName, bjdCode ORDER BY dealDate DESC)`).

**응답 항목**: buildingName, citySlug, city, district, districtSlug, dealDate, newPyeong, prevMaxPyeong, changePct.

### 카드 2: 거래 활발 단지

**정의**: 앵커(`MAX(dealDate)`)로부터 최근 30일 거래 기준, 같은 단지 `(buildingName, bjdCode)`에서 **거래가 가장 많은 단지** 상위 5건.

**왜 이 카드**: 실거래 데이터가 새벽 1회 sync + 신고일 30일 lag이라 "방금 거래" 류 카피는 거짓이 됨. 대신 "거래 활발"은 그 자체로 시그널 (수요 강세 / 신축 입주 / 가격 합의 빠른 단지) → 단지 상세 클릭 동기와 SEO 카피 모두 유효.

**임계치**: 단지 30일 거래 ≥ 2건. 1건짜리는 "활발"이라 부르기 어려움.

**다양성 제약**: 평당가 TOP과 동일하게 **시(city)별 최대 2단지**. 신축 입주 단지가 한 지역에서 거래량 폭증하는 케이스 방지.

**정렬**: 30일 거래 건수 DESC, 동률이면 최신 거래일 DESC.

**상한**: 5건.

**응답 항목**: buildingName, citySlug, city, district, districtSlug, txnCount(30일), latestDealDate, avgPyeongPrice.

**SQL 스케치**:
```sql
WITH anchor AS (
  SELECT MAX(STR_TO_DATE(...)) AS latest FROM AptSaleTransaction
),
recent AS (
  SELECT t.buildingName, t.bjdCode, t.city, t.district,
         COUNT(*) AS txnCount,
         MAX(STR_TO_DATE(...)) AS latestDealDate,
         AVG(t.dealAmount / (t.exclusiveArea / 3.3058)) AS avgPyeongPrice
  FROM AptSaleTransaction t, anchor a
  WHERE t.exclusiveArea > 0
    AND STR_TO_DATE(...) >= DATE_SUB(a.latest, INTERVAL 30 DAY)
  GROUP BY t.buildingName, t.bjdCode, t.city, t.district
  HAVING COUNT(*) >= 2
)
SELECT * FROM recent
ORDER BY txnCount DESC, latestDealDate DESC
LIMIT 30;  -- 애플리케이션 레이어 시별 캡 후 5건 컷
```

시별 캡(2)은 SQL 윈도우 함수로도 가능하지만 평당가 TOP과 동일하게 애플리케이션 레이어에서 처리(가독성).

### 카드 3: 평당가 TOP

**정의**: 최근 30일(앵커 기준) 거래에서 단지 평균 평당가 상위.

**임계치**: 같은 단지 최근 30일 거래 ≥ 2건.

**다양성 제약**: **시(city)별 최대 2단지**로 캡 — 서울이 5슬롯을 다 차지하는 것을 방지. 애플리케이션 레이어에서 정렬 후 city 카운트로 필터링.

**상한**: 5건.

**응답 항목**: buildingName, citySlug, city, district, districtSlug, avgPyeongPrice, txnCount (30일 거래수).

## API

### Endpoint
`GET /api/meta/complex-hotspots?propertyType=apt|villa|offitel`

기존 `GET /api/meta/hotspots`와는 별도 경로 — 기존 라우트는 제거되므로 충돌 없음.

### Response
```ts
type ComplexHotspots = {
  newHigh: NewHighRow[];      // 0~5
  active: ActiveRow[];        // 0~5
  topPyeong: TopPyeongRow[];  // 0~5
};

type ComplexRef = {
  buildingName: string;
  citySlug: string;
  city: string;
  district: string;
  districtSlug: string;
};

type NewHighRow = ComplexRef & {
  dealDate: string;          // ISO yyyy-mm-dd
  newPyeong: number;
  prevMaxPyeong: number;
  changePct: number;         // % (e.g., 12.5 = +12.5%)
};

type ActiveRow = ComplexRef & {
  txnCount: number;          // 30일 거래수
  latestDealDate: string;
  avgPyeongPrice: number;
};

type TopPyeongRow = ComplexRef & {
  avgPyeongPrice: number;
  txnCount: number;          // 30일 거래수
};
```

### 캐시
1시간 TTL, `propertyType` 키로 in-memory Map (기존 `_hotspotCache` 패턴 그대로).

### 직렬화
BigInt(dealAmount) / Decimal(price) → Number 변환 후 응답. `realEstateService.ts:serializeRow` 패턴 재사용 또는 동등 유틸.

## Frontend 변경

### 신규/수정 파일
- `frontend/components/home/HomeHotspotSignals.vue` — 데이터 모양 갈아엎음(3카드 신구조).
- `frontend/composables/useHomeHotspots.ts` (or 신규) — `/api/meta/complex-hotspots` 호출, 자산 토글 캐시.
- 기존 거래 유형 토글 UI 제거.

### Row 컴포넌트
3카드 모두 비슷한 행 구조 → `HotspotComplexRow.vue` 1개 컴포넌트로 통합. 카드별로 보여줄 메트릭만 props로 분기:
- 신고가: `메트릭1 = newPyeong`, `메트릭2 = changePct (+%)`
- 거래 활발: `메트릭1 = txnCount (N건)`, `메트릭2 = avgPyeongPrice`
- 평당가 TOP: `메트릭1 = avgPyeongPrice`, `메트릭2 = txnCount`

### 링크 생성
```ts
function complexHref(row: ComplexRef, propertyType: 'apt'|'villa'|'offitel') {
  return `/real-estate/${propertyType}/${row.citySlug}/${row.districtSlug}/${encodeURIComponent(row.buildingName)}`;
}
```

### SSR/캐시
- 메인 페이지가 Nitro 라우트 캐시 대상이면 자산별 응답이 첫 자산만 캐싱될 수 있음. 자산 토글은 클라이언트 사이드에서 별도 fetch — `useAsyncData` 키에 propertyType 포함.
- 메모리 메모리 [[project_nitro_route_cache]] 참조: 메인페이지 캐시 stale 이슈 — 변경 후 `.nuxt/cache/nitro/routes` 정리 검토.

### 빈 상태
- 카드의 행이 0개면 카드 자체 hide.
- 3카드가 모두 0개인 극단 케이스 → 섹션 hide (현재까지의 데이터로는 발생 가능성 낮음).
- 자산 토글의 라벨/네이밍 변경 없음.

## Backend 변경

### 신규 파일
- `backend/src/services/realEstateComplexHotspotService.ts`
  - `getComplexHotspots(propertyType)`: 3카드 병렬 산출 + 캐시.
  - 내부: `getNewHigh()`, `getActive()`, `getTopPyeong()` 3개 함수.
- `backend/src/routes/meta.ts`에 `/complex-hotspots` 라우트 추가.
- Zod 스키마: `ComplexHotspotQuerySchema` (`propertyType`만, 기존 `HotspotQuerySchema` 참조).

### 제거 파일/코드
- `backend/src/services/realEstateHotspotService.ts` 전체 삭제.
- `backend/src/routes/meta.ts`의 `/hotspots` 라우트 + 관련 import.
- 관련 타입 (`HotspotBundle`, `WolseHotspotBundle`, `PropertyHotspots` 등) — 신구조에 맞게 `ComplexHotspots` 타입군으로 대체.
- 기존 백엔드 테스트 (`__tests__/services/realEstateHotspotService.test.ts` 등)도 신구조 테스트로 대체.

### 새 타입 위치
`backend/src/types/homeDashboard.ts`에 `ComplexHotspots` 타입군 추가 (또는 기존 타입 갈아끼움).

## 테스트

### Backend
- `__tests__/services/realEstateComplexHotspotService.test.ts`
  - 신고가: 직전 12개월 < 3건 단지는 제외 / 갱신 못 한 거래는 제외 / 같은 단지 중복 노출 안 됨 / 정렬 순서.
  - 거래 활발: 30일 < 2건 단지 제외 / txnCount DESC 정렬 / 시별 캡 적용 / 동률은 latestDealDate DESC.
  - 평당가 TOP: 30일 < 2건 단지 제외 / 시별 캡 적용.
  - 캐시 TTL: 같은 propertyType 재호출 시 캐시 히트.
  - 응답 직렬화: BigInt/Decimal → Number.
- `__tests__/routes/meta.test.ts`에 `/complex-hotspots` 핸들러 케이스.

### Frontend
- `tests/components/home/HomeHotspotSignals.test.ts` 신구조로 재작성.
  - 카드 0행이면 카드 hide.
  - 자산 토글 전환 시 호출 propertyType 변경.
  - 링크 href 패턴.
- 기존 e2e (`tests/e2e/home-hotspot-signals.spec.ts`)는 신구조에 맞춰 갱신.
- `tests/pages/index.test.ts`의 mock 데이터를 새 응답 형태로 변경.

## 마이그레이션 / 배포

- 기존 `/api/meta/hotspots`는 메인 페이지 외 사용처가 없는 것으로 확인됨(브레인스토밍 시점). 그래도 PR 작성 시 grep 한 번 더 — `frontend/`에서 호출처 없으면 백엔드 라우트 함께 제거 OK.
- 단일 PR로 백엔드 + 프론트엔드 + 테스트 묶어서 진행 (스플릿하면 메인이 일시적으로 깨짐).
- 운영 배포 후 캐시(in-memory + Nitro 라우트 캐시) 1차 워밍업 확인.

## 리스크

1. **단지명 동음이의**: `(buildingName, bjdCode)` 키가 거의 항상 유일하지만, 신축 단지가 bjdCode를 재사용하는 극단 케이스 가능. 영향: 합쳐진 단지 데이터로 카드 노출. 대응: 단지 상세 페이지에서 어차피 buildingName + 지역으로 다시 필터링되므로 사용자 경험 차원에서는 큰 문제 아님. 모니터링 대상.
2. **신고가 카드의 표본 적은 자산**: 오피스텔/빌라는 12개월 ≥ 3건 단지 자체가 적을 수 있음. 신고가 카드가 0~2건만 노출될 가능성 있음. "부족한 만큼만" 정책으로 합의.
3. **평당가 TOP의 편중**: 시별 캡 2를 둬도 서울+경기로 4건 채워질 수 있음. 더 강한 다양성 필요 시 후속 PR에서 조정.
4. **30일 lag & sync 빈도**: 국토부 실거래가는 신고일 기준 + 새벽 1회 동기화. 카드 카피에 "방금/실시간" 같은 시간 강조 금지. 모든 카드는 "최근 30일"/"이번 주" 같은 윈도우 명시 표현 사용.

## 후속 작업 (out of scope)

- 청약 캘린더 카드 (별도 데이터 소스, 별도 섹션 가능성).
- 단지 상세 페이지의 "신고가 뱃지" 표시.
- 핫스팟 데이터 일일 스냅샷 저장 (분석/리포트용).
