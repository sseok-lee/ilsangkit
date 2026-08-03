# 부동산 날짜 필터 sargable 전환 — 설계

- 작성일: 2026-07-20
- 상태: 승인됨 (구현 대기)
- 범위: `backend/src/services/metaService.ts` (12곳), `backend/src/services/realEstateHotspotService.ts` (8곳)
- 접근: A안 — 쿼리만 재작성 (스키마·sync·백필·인덱스 변경 없음)

## 요약

부동산 집계 쿼리의 날짜 필터가 `STR_TO_DATE(CONCAT(dealYear,...))`로 컬럼을 함수로
감싸 **인덱스를 못 탄다**(non-sargable). 그 결과 매 쿼리가 수백만 행을 풀스캔하며,
프로덕션 slow_query_log에서 **최대 33초짜리 쿼리가 하루 130회** 관측된다. 이것이
① 상시 슬로우 쿼리, ② 매일 부동산 사이트맵 재생성 503 실패, ③ 주간 mysqld 메모리
급증의 공통 근본 원인이다.

인덱스 range로 달 범위를 먼저 좁히는 **복합 정수 조건**을 앞에 두고, 기존
`STR_TO_DATE` 조건은 **잔여 필터**로 남긴다. 결과값은 비트 단위로 동일하고,
실행 계획은 풀스캔에서 인덱스 range로 바뀐다. 스키마는 건드리지 않는다.

## 문제

### 관측된 사실

프로덕션(Cafe24) slow_query_log 4일치(2026-07-16~20, `long_query_time=2`):

- 슬로우 쿼리 **7,410건**. 상위가 전부 부동산 집계.
- 최다: `AVG(deposit),COUNT(*)` 1,394회 / max 29.82s
- 최장: `SUM(deposit),SUM(exclusiveArea)` max **33.30s**, `SUM(monthlyRent)` max 31.25s

부동산 사이트맵 재생성이 4일 연속 실패:
```
[generateSitemaps] 실패/거부 — 기존 sitemap 유지: child fetch failed sitemap/real-estate-2.xml: 503
```
사이트맵 SSR이 이 집계 쿼리를 호출하는데 10분 예산 안에 못 끝내거나 프론트가
503을 반환. (기존 파일은 유지되어 크롤러에 깨진 사이트맵은 안 나가나 lastmod가
지연됨.)

### 근본 원인

```sql
WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-',
      LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d') BETWEEN ${from} AND ${to}
```

날짜 필터가 `dealYear`/`dealMonth` **컬럼이 아니라 함수 결과**에 걸려 있다.
`dealYear_dealMonth_idx` 인덱스가 존재하는데도 옵티마이저가 못 쓴다. EXPLAIN 실측:

```
현재: type: index,  key: buildingName_bjdCode_dealYear_dealMonth_d_idx,  rows: 2,779,549
```

`rentType='전세'` 같은 추가 필터가 있으면 `rentType_idx`로 부분 축소하나
(39.9만 행) 여전히 그 전부에 `STR_TO_DATE`를 평가한다.

## 설계 (A안)

### 원칙

sargable하지 않은 함수 조건을 **제거하지 않고**, 그 앞에 인덱스가 탈 수 있는
복합 정수 조건을 **추가**한다. 인덱스가 달 단위로 범위를 좁힌 뒤, 기존
`STR_TO_DATE` 조건이 잔여 필터로서 정확한 일(day) 경계를 보존한다.

### 실측 근거

```
A안(복합 정수조건 + STR_TO_DATE 잔여), 로컬 sale:
  type: range,  key: dealYear_dealMonth_idx,  rows: 2,779,549 → 1

A안, 프로덕션 rent(전세):
  type: range,  key: dealYear_dealMonth_idx,  rows: 293,386,  Using MRR
```

로컬에서 옵티마이저가 `rentType_idx`를 고른 사례가 있으나(통계 차이), **프로덕션
실데이터에서는 rent 테이블도 `dealYear_dealMonth_idx` range를 선택**한다. 기존
인덱스로 충분하며 **인덱스 추가는 불필요**하다.

### 공유 헬퍼 — `dealDateRangeFilter(from, to)`

`Prisma.sql` 조각을 반환한다. `from`/`to`는 `YYYY-MM-DD` 문자열.

```typescript
// from/to 의 (year, month) 로 달 범위를 인덱스로 좁히고(sargable),
// STR_TO_DATE 는 잔여필터로 남겨 정확한 일(day) 경계를 보존한다.
// 결과 집합은 STR_TO_DATE 단독과 비트 단위로 동일하다.
function dealDateRangeFilter(from: string, to: string): Prisma.Sql {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  return Prisma.sql`
    (dealYear > ${fy} OR (dealYear = ${fy} AND dealMonth >= ${fm}))
    AND (dealYear < ${ty} OR (dealYear = ${ty} AND dealMonth <= ${tm}))
    AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-',
        LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d') BETWEEN ${from} AND ${to}`;
}
```

경계 정확성:
- 같은 달 (from=`2026-07-02`, to=`2026-07-08`): `dealYear=2026 AND dealMonth 7..7`로
  좁힌 뒤 STR_TO_DATE가 2~8일만 남김.
- 월 경계 (from=`2026-06-28`, to=`2026-07-04`): 6~7월로 좁힌 뒤 STR_TO_DATE가
  6/28~7/4만 남김.
- 연말 경계 (from=`2025-12-28`, to=`2026-01-03`): 첫 조건 `dealYear>2025 OR
  (dealYear=2025 AND dealMonth>=12)`, 둘째 `dealYear<2026 OR (dealYear=2026 AND
  dealMonth<=1)` → 2025-12 ∪ 2026-01로 좁힌 뒤 STR_TO_DATE가 정확 경계.

### metaService.ts (12곳)

전부 상수 `from`/`to`(= `ymdNDaysAgo(n)` 반환값) 범위라 헬퍼를 그대로 끼운다.

- 9개 aggregate 함수: `aggregateSaleRange`, `aggregateRentJeonseRange`,
  `aggregateRentWolseRange`, `aggregateVillaSaleRange`,
  `aggregateVillaRentJeonseRange`, `aggregateVillaRentWolseRange`,
  `aggregateOffitelSaleRange`, `aggregateOffitelRentJeonseRange`,
  `aggregateOffitelRentWolseRange` (metaService.ts:261~373)
- `getTrendingBuildings`의 sale/jeonse/wolse 3개 CTE 쿼리 (metaService.ts:498~)

각 쿼리에서 `WHERE ... STR_TO_DATE(...) BETWEEN ${from} AND ${to}` 부분을
`WHERE ... ${dealDateRangeFilter(from, to)}`로 치환. `rentType='전세'` 등 기존 다른
조건은 그대로 유지.

### realEstateHotspotService.ts (8곳)

동적 anchor라 2단계로 나눈다. `getPricedSliceHotspots`와 `getWolseHotspots` 각각:

1. **anchor 분리**: `WITH anchor AS (SELECT MAX(STR_TO_DATE(...)))` CTE를 제거하고,
   최신 거래일을 별도 쿼리로 구한다:
   ```sql
   SELECT dealYear, dealMonth, dealDay FROM <table>
   WHERE <rentTypeClause>
   ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC LIMIT 1
   ```
   `dealYear_dealMonth_idx`로 뒤에서 소수 행만 읽는다(현재 MAX(STR_TO_DATE) 풀스캔
   대비 개선). 앱에서 이 값으로 `latest` 날짜를 만들고 `-7일`/`-14일` 경계를 계산.
2. **slice 재작성**: `recent`/`prior` CTE의 `STR_TO_DATE(...) >= DATE_SUB(a.latest,
   INTERVAL N DAY)` 를 앱에서 계산한 상수 날짜 범위로 바꾸고 `dealDateRangeFilter`
   재사용. anchor CTE 조인(`, anchor a`)도 제거.

anchor 쿼리가 인덱스를 실제로 타는지는 구현 시 EXPLAIN으로 확인한다(안 타면
`ORDER BY` 대신 정수 MAX 등 대안 검토). 최악의 경우에도 anchor는 1회 조회라
recent/prior slice 최적화가 주된 이득이다.

### 결과 동등성

- metaService: `STR_TO_DATE(...) BETWEEN from AND to`가 그대로 잔여 필터로 남으므로
  반환 집계값은 수정 전과 **비트 단위로 동일**.
- hotspot: anchor를 2쿼리로 분리하면 anchor 조회와 slice 조회 사이에 데이터가
  바뀔 수 있으나(TOCTOU), 홈 대시보드 1시간 캐시 + 데이터는 야간 sync에만 변경되어
  실무상 영향 없음. slice의 날짜 경계 자체는 동일 계산.

## 테스트

기존 테스트는 `prisma.$queryRaw`를 **모킹**한다
(`__tests__/services/realEstateHotspotService.test.ts`의 `vi.mock('../../src/lib/prisma.js')`).
즉 SQL이 실제로 실행되지 않으므로, "수정 전후 같은 집계값" 같은 결과 동등성은
단위 테스트로 검증할 수 없다(어떤 SQL을 보내도 같은 mock 값 반환). 결과 동등성은
아래 "검증" 단계에서 로컬 DB 실행으로 확인한다. metaService 집계 함수 전용
테스트는 없다.

1. **헬퍼 단위 테스트** (`dealDateRangeFilter`): 같은 달 / 월 경계 / 연말 경계
   3케이스에 대해 반환된 `Prisma.Sql`의 텍스트와 바인딩 파라미터가 올바른 정수
   경계(fy/fm/ty/tm)와 STR_TO_DATE 잔여를 포함하는지. `Prisma.sql` 조각은
   `.strings`/`.values`로 검사 가능하므로 DB 없이 순수 단위 테스트.
2. **hotspot 회귀 테스트**: 기존 `realEstateHotspotService.test.ts`가 anchor 분리
   후에도 통과하는지. anchor를 별도 쿼리로 분리하면 `$queryRaw` 호출 횟수가 늘어나므로
   기존 mock 시퀀스(`mockResolvedValue` → `mockResolvedValueOnce` 순차)를 그에 맞게
   갱신한다.

## 검증

- **결과 동등성 (로컬 DB 실행)**: 수정 전 STR_TO_DATE 쿼리와 수정 후 쿼리를 로컬
  MySQL에 직접 실행해 **같은 집계값**을 반환하는지 대조. 최소 sale 1종 +
  rent(전세/월세) 1종. (모킹이 아닌 실제 SQL 실행이므로 검증 단계에 둠.)
- **EXPLAIN (로컬 DB)**: 수정된 각 쿼리 유형이 `type: range`, `key:
  ..._dealYear_dealMonth_idx`인지. hotspot anchor 조회 쿼리도 인덱스 적중 확인.
- 백엔드 전체 `npx vitest run` 통과, tsc·eslint 클린.
- 배포 후: slow_query_log에서 해당 집계 쿼리 소멸(또는 <2초), 부동산 사이트맵
  재생성 503 해소, 주간 mysqld 메모리 급증 완화(재측정).

## 범위 밖 (의도적)

- `metaService`의 `COUNT(DISTINCT CONCAT(buildingName,'|',bjdCode))` 건물 수 3종
  (metaService.ts:105~108): 날짜 필터가 아닌 별개 안티패턴. 정규화(2단계)에서
  property COUNT로 흡수될 것이라 지금 손대지 않음.
- 인덱스 추가·스키마 변경: 프로덕션 EXPLAIN으로 기존 인덱스 충분 확인.
- Property/Transaction 정규화: 이 20개 쿼리는 정규화가 오면 property 테이블 기준으로
  재작성되지만, A안은 스키마를 안 건드려 그때 깨끗하게 대체된다.

## 리스크

| 리스크 | 평가 |
|---|---|
| 옵티마이저가 인덱스를 안 고를 수 있음 | 프로덕션 EXPLAIN으로 rent 테이블 range 선택 확인. 최악의 경우 코드만 롤백 |
| hotspot anchor 쿼리가 인덱스 미적중 | 구현 시 EXPLAIN 확인, 대안(정수 MAX) 준비. anchor는 1회 조회라 영향 제한적 |
| hotspot 2쿼리 분리 TOCTOU | 1시간 캐시 + 야간 sync 전용 변경이라 무시 가능 |
| 결과값 변경 | metaService는 잔여 필터로 비트 동일 보장. 동등성 테스트로 못박음 |
