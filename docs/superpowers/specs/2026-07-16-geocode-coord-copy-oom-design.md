# 지오코딩 좌표 복사 OOM 지혈 — 설계

- 작성일: 2026-07-16
- 상태: 승인됨 (구현 대기)
- 범위: `backend/src/scripts/geocodeRealEstate.ts` 함수 3개
- 후속: 서버 OOM 보호(1단계), Property 정규화(2단계) — 본 스펙 범위 밖

## 요약

운영 사이트가 매일 새벽 OOM으로 죽고 있다. 원인은 야간 부동산 sync의 지오코딩
단계가 **좌표를 이미 가진 605만 행을 Node 힙에 전부 적재**하는 것이다. 실제로
고쳐야 할 행은 수천 건뿐이다. 구동 방향을 뒤집어 "좌표가 없는 쪽"에서 출발하도록
바꾼다.

## 문제

### 관측된 사실

운영 서버(`183.111.126.54`, Cafe24) `dmesg` 실측:

```
[Wed Jul 15 05:09:52 2026] Out of memory: Killed process 813981 (node) anon-rss:2,147,640kB
[Thu Jul 16 04:50:42 2026] nginx invoked oom-killer
[Thu Jul 16 04:50:42 2026] Free swap  = 0kB
[Thu Jul 16 04:50:42 2026] Out of memory: Killed process 781890 (mysqld)
[Thu Jul 16 04:55:55 2026] Out of memory: Killed process 845756 (node) anon-rss:2,078,296kB
```

- mysqld uptime 8.1시간 = 04:50 OOM 킬 시각과 일치. **DB가 죽고 재시작됐다.**
- pm2 재시작 카운트: backend 210회, frontend 1,647회.
- 서버 자원: RAM 2,979MB, 스왑 3,811MB(1,885MB 사용 중), 코어 6개.
- 운영 DB 총 7.56GB, 그중 부동산 거래 테이블 5.98GB.
- `innodb_buffer_pool_size` = 128MB, 히트율 98.889%, `slow_query_log` = OFF.

`sync-real-estate.yml`은 03:00 KST(cron `0 18 * * *` UTC)에 시작한다. 8종 sync
루프(~1h10m) 뒤 `geocodeRealEstate.js`가 45분 예산으로 돈다. OOM 발생 시각
04:50~04:55가 이 구간에 정확히 들어맞는다. OOM 로그의 `task_memcg`가
`user.slice/.../session-*.scope`인 것도 GitHub Actions의 SSH 세션에서 실행된
node임을 뒷받침한다.

### 근본 원인

`geocodeRealEstate.ts`의 세 함수가 모두 Prisma `distinct`에 의존한다.

```typescript
// copyCoordsWithinTable — 현재 코드
const seeds = await model.findMany({
  where: { lat: { not: null } },
  select: { bjdCode: true, buildingName: true, lat: true, lng: true },
  distinct: ['bjdCode', 'buildingName'],
});
```

**Prisma의 `distinct`는 MySQL에서 SQL로 내려가지 않고 앱 메모리에서 수행된다.**
실측으로 확인했다. 생성된 SQL에 `DISTINCT` 키워드가 없고, `select`에 지정하지
않은 `id` 컬럼이 딸려 나온다(인메모리 중복 제거의 표식):

```
SELECT `ilsangkit`.`OffitelSaleTransaction`.`id`,
       `ilsangkit`.`OffitelSaleTransaction`.`bjdCode`, ...
```

즉 `lat IS NOT NULL`인 행을 **전부** 가져와 JS 객체로 만든 뒤 자바스크립트에서
줄인다.

### 규모

로컬 실측 (OffitelSale, 9.8만 행): 피크 RSS 219MB, 행당 약 1.5KB.

좌표 유무 분포 (로컬):

| 테이블 | 메모리로 적재되는 행 | 실제 대상 |
|---|---:|---:|
| aptRent | 2,901,721 | 5 |
| aptSale | 1,343,578 | 481 |
| offitelRent | 748,843 | 134 |
| villaRent | 713,421 | 46 |
| villaSale | 245,106 | 37 |
| offitelSale | 98,368 | 73 |
| **합계** | **6,051,037** | **776** |

운영 실측: aptRent 좌표없음 7,686 / 좌표있음 **3,187,040**. aptSale 좌표없음 23 /
좌표있음 1,537,068.

`copyCoordsFromSibling`이 형제 테이블(매매↔전월세)에 대해 같은 적재를 한 번 더
하므로 실제 부하는 약 2배다.

행당 1.5KB × 319만 행 ≈ **4.8GB 요구**. 서버 RAM은 3GB. 스왑이 0이 될 때까지
밀어붙이다가 OOM killer가 그 시점 최대 RSS 프로세스인 **mysqld를 대신 죽인다**.
node가 죽은 시점의 2.07GB는 다 읽지 못하고 중간에 죽은 값이다.

### 왜 이 코드가 존재하는가

`copyCoordsWithinTable`/`copyCoordsFromSibling`은 **좌표가 거래 행마다 중복
저장되기 때문에** 존재한다. 같은 건물의 다른 행에서 좌표를 복사해 오는 것이
목적이다. 정규화된 property 테이블이 있었다면 좌표는 건물당 1행에만 있고 이
함수들은 개념 자체가 성립하지 않는다. 이 사실이 2단계(Property 정규화)의 근거지만,
본 스펙은 지혈만 다룬다.

## 설계

### 원칙

구동 방향을 뒤집는다. **"좌표를 가진 605만 행"이 아니라 "좌표가 없는 수천 건"에서
출발한다.** 결과는 동일하고 비용만 사라진다.

### 변경 1 — `copyCoordsWithinTable` / `copyCoordsFromSibling`

```
현재: findMany(lat ≠ null) → 319만 행 적재 → 앱에서 dedup → 건물별 updateMany
변경: $queryRaw SELECT DISTINCT bjdCode, buildingName FROM <대상테이블>
                WHERE lat IS NULL          → 좌표가 필요한 건물만 확보
      → 건물별 findFirst 로 seed 좌표 1건 조회
      → 건물별 updateMany (기존과 동일)
```

두 함수의 차이는 **seed를 어디서 읽는가**뿐이며, 이는 기존과 동일하다.

- `copyCoordsWithinTable`: 대상 테이블 자신에서 seed 조회
  (`model.findFirst({ where: { bjdCode, buildingName, lat: { not: null } } })`)
- `copyCoordsFromSibling`: `SIBLING_TABLE`이 가리키는 형제 테이블에서 seed 조회
  (`siblingModel.findFirst({ ... })`)

두 경우 모두 `SELECT DISTINCT`로 뽑는 **대상 건물 목록은 대상 테이블의
`lat IS NULL` 기준**이다. 형제 테이블을 전수 조회하지 않는다.

메모리: `O(전체 행)` → `O(좌표 필요 건물 수)`.

좌표가 필요한 행이 0건이면 소스 테이블을 **조회조차 하지 않고** 즉시 0을 반환한다.

### 변경 2 — `getUniqueBuildings`

`findMany({ where: { lat: null }, distinct: [...] })` → 위와 같은 **2단계 조회**.
현재도 치명적이지는 않으나(운영 7,686행) 같은 병이고, sync 직후에는 월
유입량(aptRent 기준 6~8만 건)만큼 부풀어 오른다.

`GEOCODE_RETRY_DAYS` 재시도 조건(`geocodedAt IS NULL OR geocodedAt < cutoff`)은
그대로 1단계 SQL의 `WHERE` 절로 옮긴다.

반환 타입 `UniqueBuilding[]`과 호출부(`processTable`)는 바뀌지 않는다.

### 의미 보존

Prisma `distinct`는 그룹의 첫 행을 남긴다. `findFirst`로 seed를 뽑는 것과 동일한
의미이며, 오히려 `lat`/`lng`가 **한 행에서 온 짝**임이 보장된다.

`MAX(lat)`/`MAX(lng)` 방식은 서로 다른 행의 값이 섞여 존재하지 않는 좌표를 만들 수
있으므로 채택하지 않는다. (`refreshSummary`가 현재 이 방식을 쓰고 있으나 별건으로
남긴다.)

`ROW_NUMBER() OVER (PARTITION BY ...)`로 그룹당 1행을 뽑는 방식도 검토했다.
**seed 측(`lat IS NOT NULL`, 290만 행)에는 기각**한다 — 로컬 실측에서 9분 넘게
완료되지 않았고, 그 쿼리 하나가 로컬 MySQL을 포화시켜 `SHOW PROCESSLIST`조차
응답하지 않게 만들었다(컨테이너 재시작으로 복구).

대상 측(`lat IS NULL`, 수천 행)이라면 윈도우 함수 비용 자체는 문제되지 않는다.
그럼에도 채택하지 않는 이유는 **뽑는 컬럼 수가 실행계획을 바꾸기** 때문이다.
로컬 EXPLAIN 실측:

```
SELECT DISTINCT bjdCode, buildingName ... WHERE lat IS NULL
  → type: index,  key: AptRentTransaction_bjdCode_buildingName_idx,  Extra: Using where
    (5초)

SELECT <주소 7컬럼> ... ROW_NUMBER() OVER (PARTITION BY bjdCode, buildingName) ...
  → type: ALL,    key: NULL,  Extra: Using where; Using filesort
    (844MB 풀스캔 + filesort)
```

키 2개만 뽑으면 인덱스를 순서대로 훑어 **정렬과 중복 제거를 공짜로** 얻는다.
주소 컬럼을 얹는 순간 그 인덱스가 쓸모없어져 풀스캔 + filesort로 떨어진다.

주의: `Extra`가 `Using index`가 아니라 `Using where`이므로 **커버링 인덱스는
아니다** — `lat`이 인덱스에 없어 행 조회가 뒤따른다. 그럼에도 인덱스 순서를
얻는 값어치가 커서 옵티마이저가 이 계획을 고르고, 실측 5초로 실용적이다.

대신 **2단계 조회**를 쓴다. ① `SELECT DISTINCT bjdCode, buildingName`으로 대상
건물만 확보(인덱스 스캔) → ② 건물별 `findFirst`로 주소 필드를 한 행에서 읽는다
(`(bjdCode, buildingName)` 인덱스 적중). 주소가 한 행에서 오므로 일관성이
보장되고, `MIN()`/`ANY_VALUE()`처럼 서로 다른 행의 `roadName`과 `jibun`이 섞일
위험이 없다. 건물별 조회가 수천 회 발생하지만 각각 인덱스 적중이고, 지오코딩
루프가 건물당 150ms를 쉬는 것에 비하면 무시할 수준이다.

### 건드리지 않는 것

- 카카오 API 호출 로직, `buildSearchQuery`, `cleanBuildingName`
- 재시도 정책(`GEOCODE_RETRY_DAYS`)
- `updateBuildingCoordinates`
- `SIBLING_TABLE` 매핑 구조 (2단계에서 소멸 예정)
- 지오코딩 동작·결과 자체

## 테스트

기존 `backend/__tests__/scripts/geocodeRealEstate.test.ts` (303줄)이 있다. 대부분은
순수 함수(`buildSearchQuery`·`cleanBuildingName`) 테스트로 영향이 없다.

1. **목 갱신**: `vi.mock('@prisma/client')`의 델리게이트에 `$queryRaw`(또는
   `$queryRawUnsafe`) 추가. 현재는 `findMany`/`updateMany`만 있다.
2. **회귀 증명 테스트 (필수)**: *좌표 없는 행이 0건이면 소스 테이블을 조회하지
   않는다*를 단언한다. 605만 행 적재가 되살아나면 이 테스트가 깨진다.
3. **동작 동치 테스트**: 대상 건물이 있을 때 기존과 동일한 `updateMany` 호출이
   발생하는지.

## 검증

- 백엔드 전체 `npx vitest run` 통과.
- 변경 전/후 피크 RSS 실측 비교 (OffitelSale 기준 219MB → 수 MB 예상).
  측정 방법은 `process.memoryUsage().rss`를 20ms 간격 샘플링.
- 배포 후 익일 새벽 `dmesg`에 OOM 부재 확인 + mysqld uptime 연속성 확인.

## 리스크

| 리스크 | 평가 |
|---|---|
| `lat IS NULL` 스캔이 인덱스 전체를 훑음 | `processTable`이 테이블당 3회 호출(`copyCoordsWithinTable`·`copyCoordsFromSibling`·`getUniqueBuildings`) → 6테이블 × 3회 = **18회 스캔**. 로컬 실측 5.8초/회지만 이는 **warm 캐시 값**이고, 운영은 버퍼풀 128MB에 인덱스 1,146MB + 데이터 844MB라 **실질적으로 더 느리다.** `Extra`가 `Using index`가 아니므로 각 스캔이 `lat` 확인을 위해 행 조회를 동반한다. **회귀는 아니다** — 구 코드도 동등하거나 더 큰 스캔을 했고 거기에 더해 전 행을 node로 실어 날랐다. `timeout 45m`가 상한이고, 초과 시 그날 지오코딩이 덜 되고 다음날 재개될 뿐이다 |
| `$queryRawUnsafe`의 테이블명 보간 | 테이블명은 코드 내 `RealEstateTable` 유니온 상수에서만 옴. 사용자 입력 경로 없음. 기존 `realEstateSummaryService`도 동일 패턴 |
| 대상 건물이 많을 때(첫 실행·대량 유입) 루프가 길어짐 | 기존에도 동일. `timeout 45m`로 캡됨 |

## 범위 밖 (후속 단계)

본 PR은 오늘 밤 OOM을 막는 것 하나만 한다. 아래는 별건이다.

- **1단계**: mysqld `OOMScoreAdjust=-500`, sync node `--max-old-space-size` 상한,
  `slow_query_log` 활성화
- **2단계**: Property/Transaction 정규화 (`RealEstateProperty` 도입).
  `copyCoords*`·`SIBLING_TABLE`의 소멸, 인덱스 축소(AptRent 인덱스 1,146MB >
  데이터 844MB), `refreshSummary` 전면 재빌드 제거
- **선행 과제**: 배포가 `prisma db push --accept-data-loss`로 스키마를 무인 반영함.
  정규화의 컬럼 드랍 단계가 사람 감시 없이 실행되므로 이 방식 자체를 먼저 다뤄야 함
- **버퍼풀 128MB**: RAM 3GB에 스왑까지 쓰는 상황이라 **지금 올리면 OOM이 악화된다.**
  DB를 줄인 뒤 재평가할 문제
