# 부동산 상세 주변 버스 정류장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산 상세 "주변 생활시설"의 지하철역 칸 옆에 반경 1km 버스 정류장(이름·거리, 같은 이름 합침, 전체 개수)을 보여 준다.

**Architecture:** 국토교통부 전국 버스정류장 CSV를 data.go.kr에서 받아 새 `BusStop` 테이블에 판 단위로 적재한다. 기존 `GET /api/transit/nearby`가 `busRadius`를 받으면 `busStops`를 함께 돌려준다. `NearbyFacilities.vue`는 같은 호출 결과로 지하철·버스 두 칸을 나란히 그린다. 수집은 cron 없이 사용자가 `syncBusStop.ts` 또는 `syncAll.ts bus-stop`으로 직접 실행한다.

**Tech Stack:** Express 5 + TypeScript(ESM) + Prisma(MySQL 8), Nuxt 3 SSR + Vue 3 + Tailwind, Vitest(+supertest, @vue/test-utils)

**Spec:** `docs/superpowers/specs/2026-10-30-bus-stop-nearby-design.md`

## Global Constraints

- Node 20(`nvm use 20`). package-lock 재생성 금지. 새 npm 의존성 추가 금지. CP949 디코딩과 CSV 파싱은 이미 쓰는 `iconv-lite`와 `csv-parse`를 쓴다(`subwayDataSource.ts`와 같다).
- Backend는 ESM: 로컬 import에 `.js` 확장자. 라우트는 `asyncHandler` + `validate(Schema, 'query')`.
- 정류장 개별 페이지·사이트맵 URL·링크를 만들지 않는다. 정류장 행은 링크가 아니다.
- 상세 페이지가 외부 API에 의존하지 않는다. 화면은 우리 DB만 읽는다.
- 버스 반경 1000m(쿼리 기본값), 쿼리 상한 2000m. 지하철 반경 2000m는 그대로.
- 목록 최대 5곳, 모바일 처음 3곳.
- 같은 이름 정류장은 한 줄로 합치고, 가장 가까운 거리를 보여 준다.
- 개수는 합친 이름 기준의 반경 안 **전체 개수**다. "이상" 표기를 쓰지 않는다.
- 출처 문구: `버스정류장: 국토교통부 · YYYY년 MM월 수집`. 날짜는 원본 정보수집일이다.
- 새 판 행 수가 직전 적재 행 수의 80% 미만이면 저장하지 않고 실패 처리한다.
- 원본 컬럼은 전부 저장한다(데이터 수집 최대화).
- 운영 배포 전 마이그레이션을 먼저 운영 DB에 적용한다. 배포는 스키마를 바꾸지 않는다.
- 커밋 메시지는 한국어 Conventional Commits(`feat(bus):` 등). 커밋 전 해당 패키지 `npx vitest run`.

## Review Focus

1. **좌표가 비었거나 한국 범위(lat 33~39, lng 124~131) 밖인 행.** 저장하지 않고 `skippedRecords`로 센다. 실제 파일에 11건이 있다. → Task 1 테스트
2. **같은 이름이 1km 안에 3곳 이상인 경우**(두 BIS 중복 + 길 건너 양방향). 한 줄, 가장 가까운 거리, 개수 1. → Task 4 테스트
3. **지하철 0곳 + 버스 있음, 지하철 있음 + 버스 0곳, 둘 다 0곳.** 남은 칸이 한 줄 전체를 쓰고, 둘 다 없으면 기존 빈 상태 문구를 보인다. → Task 5 테스트
4. **같은 판을 다시 실행.** 쓰기 0건, `skipped`로 끝난다. 새 판이 직전의 80% 미만이면 기존 행을 지우지 않는다. → Task 3 테스트
5. **`busRadius` 없이 `/api/transit/nearby`를 부르는 기존 호출자**(시설 상세 등). 응답 모양과 쿼리 수가 그대로다. → Task 4 테스트

---

## File Structure

| 파일 | 역할 |
|---|---|
| `backend/prisma/schema.prisma` | `BusStop` 모델 추가 |
| `backend/prisma/migrations/202610300002_bus_stop/migration.sql` | 테이블 생성 |
| `backend/src/services/busStopDataSource.ts` | CSV(CP949) 파싱·검증·변환. 순수 함수 |
| `backend/src/services/busStopFileDownloader.ts` | data.go.kr에서 최신 판 확인과 CSV 다운로드 |
| `backend/src/services/busStopSyncService.ts` | 판 비교, 80% 가드, upsert, 옛 판 삭제 |
| `backend/src/scripts/syncBusStop.ts` | 단독 실행 진입점(`--local <csv>` 지원) |
| `backend/src/scripts/syncAll.ts` | `bus-stop` 카테고리 |
| `backend/src/services/busStopService.ts` | 반경 검색과 이름 합치기 |
| `backend/src/routes/transit.ts` | `busRadius` 쿼리 → `busStops`·`busStopCount`·`busCollectedAt` |
| `frontend/components/common/nearby/NearbyPlaceRow.vue`, `NearbyPlaceSection.vue` | 링크 없는 행 |
| `frontend/components/realEstate/NearbyFacilities.vue` | 버스 칸, 배치, 출처 문구 |

---

### Task 1: CSV 파싱·변환 (`busStopDataSource.ts`)

**Files:**
- Create: `backend/src/services/busStopDataSource.ts`
- Test: `backend/__tests__/services/busStopDataSource.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export interface BusStopRecord {
    nodeId: string; name: string; lat: number; lng: number;
    mobileId: string | null; cityCode: string | null; cityName: string | null;
    adminName: string | null; collectedAt: string | null;
  }
  export function decodeBusStopCsv(buf: Buffer): string            // CP949 → string (BOM 제거)
  export function parseBusStopCsv(text: string): { records: BusStopRecord[]; skipped: number }
  ```
- 헤더: `정류장번호,정류장명,위도,경도,정보수집일,모바일단축번호,도시코드,도시명,관리도시명`. 헤더 이름으로 열을 찾는다. 순서에 의존하지 않는다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `decodeBusStopCsv`
    - 픽스처는 `iconv.encode(text, 'euc-kr')`로 만든 CP949 버퍼다.
    - 디코딩 결과가 `정류장번호`로 시작해야 한다.
  - `parseBusStopCsv` 정상 행
    - 입력: `ADB354000001,길안정류장,36.458658,128.891228,2025-10-31,540001,37040,경상북도 안동시,안동BIS`
    - 기대: `{ nodeId:'ADB354000001', name:'길안정류장', lat:36.458658, lng:128.891228, collectedAt:'2025-10-31', mobileId:'540001', cityCode:'37040', cityName:'경상북도 안동시', adminName:'안동BIS' }`
  - 버리는 행: 위도 빈값, 위도 `0`, 경도 `140.1`, 정류장명 빈값, nodeId 빈값.
    - `skipped === 5`, `records.length === 1`
  - 같은 `nodeId`가 두 번 나오면 첫 행만 남기고 `skipped`에 1을 더한다.
  - 정류장명 앞뒤 공백을 제거한다. 빈 선택 컬럼은 `null`로 둔다.

- [ ] **Step 2: 실패 확인**
  - Run: `cd backend && npx vitest run __tests__/services/busStopDataSource.test.ts`
  - Expected: FAIL (모듈 없음)

- [ ] **Step 3: 구현**
  - 디코딩은 `iconv.decode(buf, 'euc-kr')`다. UTF-8 BOM이 있으면 UTF-8로 읽는다.
  - 파싱은 `csv-parse`(`columns: true, trim: true, skip_empty_lines: true, relax_quotes: true`)다. `subwayDataSource.ts`와 같은 옵션을 쓴다. 20만 행이므로 동기 API(`csv-parse/sync`)도 무방하다.
  - 범위는 `KOREA_BOUNDS`(`backend/src/constants`)로 검사한다.

- [ ] **Step 4: 통과 확인** — 같은 명령, PASS

- [ ] **Step 5: 커밋** — `feat(bus): 버스정류장 CSV 파싱·검증`

---

### Task 2: 최신 판 확인과 다운로드 (`busStopFileDownloader.ts`)

**Files:**
- Create: `backend/src/services/busStopFileDownloader.ts`
- Test: `backend/__tests__/services/busStopFileDownloader.test.ts`
- Fixture: `backend/__tests__/fixtures/busStop/fileData.html`
  - 실제 페이지에서 `fn_fileDataDown(...)` 줄과 `<title>` 줄만 발췌한다.

**Interfaces:**
- Produces:
  ```ts
  export interface BusStopFileRef { detailPk: string; version: string }   // version 예 '20251031'
  export function scrapeLatestBusStopFile(html: string): BusStopFileRef | null
  export async function fetchLatestBusStopFileRef(): Promise<BusStopFileRef>
  export async function downloadBusStopCsv(ref: BusStopFileRef): Promise<Buffer>
  ```
- 상수
  - 페이지: `https://www.data.go.kr/data/15067528/fileData.do`
  - 1단계: `POST https://www.data.go.kr/tcs/dss/selectFileDataDownload.do`
    - 본문(form-urlencoded): `publicDataPk=15067528&publicDataDetailPk=<detailPk>&atchFileId=&fileDetailSn=1&publicDataTyCode=PR0051`
    - 응답 JSON 최상위 `atchFileId`를 쓴다.
  - 2단계: `GET https://www.data.go.kr/cmm/cmm/fileDownload.do?atchFileId=<id>&fileDetailSn=1`
  - 모든 요청에 브라우저 UA와 Referer(페이지 URL)를 붙인다. UA는 `hiraFileDownloader.ts`의 `BROWSER_UA`를 재사용한다.
  - 요청 제한시간은 `SYNC` 상수의 API timeout(30초)이다. 다운로드는 120초다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - `scrapeLatestBusStopFile(fixture)` → `{ detailPk: 'uddi:f74b9799-9db1-4754-a5d0-b66e2ae705f3', version: '20251031' }`
    - `version`은 `<title>`의 `_YYYYMMDD`에서 뽑는다.
  - 패턴이 없는 HTML이면 `null`
  - `downloadBusStopCsv`(전역 `fetch`를 `vi.fn`으로 대체)
    - 1단계 응답 `{ atchFileId: 'FILE_1' }` → 2단계 URL에 `atchFileId=FILE_1`이 들어간다.
    - 두 요청 모두 `Referer` 헤더가 있다.
  - 1단계 응답에 `atchFileId`가 없으면 `'atchFileId'`를 포함한 메시지로 throw한다.
  - 2단계 응답의 content-type이 `text/html`이면(WAF 차단 페이지) throw한다.

- [ ] **Step 2: 실패 확인**
  - Run: `cd backend && npx vitest run __tests__/services/busStopFileDownloader.test.ts`
  - Expected: FAIL

- [ ] **Step 3: 구현** — 위 시그니처와 상수대로

- [ ] **Step 4: 통과 확인**

- [ ] **Step 5: 커밋** — `feat(bus): data.go.kr 버스정류장 파일 다운로드`

---

### Task 3: 테이블·적재·실행 진입점

**Files:**
- Modify: `backend/prisma/schema.prisma` (`SubwayStation` 모델 아래)
- Create: `backend/prisma/migrations/202610300002_bus_stop/migration.sql`
- Create: `backend/src/services/busStopSyncService.ts`
- Create: `backend/src/scripts/syncBusStop.ts`
- Modify: `backend/package.json` scripts (`"sync:bus-stop": "tsx src/scripts/syncBusStop.ts"`)
- Modify: `backend/src/scripts/syncAll.ts`
  - `CATEGORIES`에 `'bus-stop'`을 추가한다(`'subway'` 뒤).
  - `case 'bus-stop'`를 추가한다.
- Test: `backend/__tests__/services/busStopSyncService.test.ts`

**Interfaces:**
- Consumes: Task 1 `parseBusStopCsv`, `decodeBusStopCsv`; Task 2 `fetchLatestBusStopFileRef`, `downloadBusStopCsv`
- Produces:
  ```prisma
  model BusStop {
    nodeId        String   @id @db.VarChar(30)
    name          String   @db.VarChar(100)
    lat           Decimal  @db.Decimal(10, 7)
    lng           Decimal  @db.Decimal(10, 7)
    mobileId      String?  @db.VarChar(10)
    cityCode      String?  @db.VarChar(5)
    cityName      String?  @db.VarChar(50)
    adminName     String?  @db.VarChar(50)
    collectedAt   String?  @db.VarChar(10)
    sourceVersion String   @db.VarChar(8)
    createdAt     DateTime @default(now())
    updatedAt     DateTime @updatedAt
    syncedAt      DateTime @default(now())
    @@index([lat])
    @@index([lng])
    @@index([sourceVersion])
  }
  ```
  ```ts
  export interface BusStopSyncInput { csv: Buffer; version: string }
  export async function syncBusStops(input: BusStopSyncInput): Promise<SyncStats & { outcome: 'loaded' | 'skipped' }>
  export async function syncLatestBusStops(opts?: { localCsv?: string; version?: string }): Promise<SyncStats & { outcome: 'loaded' | 'skipped' }>
  ```
- 동작
  - `runSync('bus-stop', …, { allowEmpty: true })`를 쓴다. 같은 판이라 건너뛰는 0건은 정상이다.
  - **같은 판이면 건너뛴다:** `prisma.busStop.findFirst({ select: { sourceVersion: true } })`가 `version`과 같으면 `outcome: 'skipped'`, 쓰기 0건.
  - **80% 가드:** `prevCount = prisma.busStop.count()`. `prevCount > 0`이고 `records.length < prevCount * 0.8`이면 throw한다. 메시지에 두 수를 넣는다. 쓰기와 삭제는 하지 않는다.
  - **적재:** `batchUpsertRaw('BusStop', rows, 500, undefined, { exactStats: true, uniqueKey: 'nodeId' })`
  - **옛 판 삭제:** upsert가 끝난 뒤에만 `deleteMany({ where: { sourceVersion: { not: version } } })`. 삭제 수는 로그로 남긴다.
  - `syncLatestBusStops`
    - `localCsv`가 있으면 그 파일을 읽는다. `version`이 없으면 파일 첫 행의 정보수집일(`YYYYMMDD`)을 쓴다.
    - 없으면 Task 2로 받는다.
  - `syncBusStop.ts`: `--local <path>`, `--version <YYYYMMDD>` 인자를 받는다. 결과 한 줄을 출력하고, 실패하면 exit 1.
  - `syncAll` `case 'bus-stop'`: `count = newRecords + updatedRecords`

- [ ] **Step 1: 스키마·마이그레이션 작성 후 검증**
  - `migration.sql`은 `CREATE TABLE \`BusStop\`` 하나와 인덱스 3개다. 기존 `202610300001_building_register/migration.sql` 형식을 따른다.
  - Run: `cd backend && npx prisma validate && npx prisma generate`
  - Expected: 둘 다 성공
  - Run: 로컬 DB에 SQL 직접 적용 — `docker compose exec -T mysql mysql -uilsangkit -pilsangkit123 ilsangkit < prisma/migrations/202610300002_bus_stop/migration.sql`
    - 로컬 DB는 마이그레이션 이력 없이 관리한다(K-apt 기록).
  - Expected: 오류 없음

- [ ] **Step 2: 실패하는 테스트 작성** (prisma와 `batchUpsertRaw` mock, `transit.test.ts`의 `vi.hoisted` 패턴)
  - 비어 있는 테이블 + 2행 CSV → `batchUpsertRaw`가 `'BusStop'`, `uniqueKey: 'nodeId'`로 1회 호출되고, `deleteMany`가 `{ sourceVersion: { not: '20251031' } }`로 호출되며, `outcome === 'loaded'`이다.
  - 저장된 판이 `'20251031'`이고 입력도 `'20251031'` → `batchUpsertRaw`와 `deleteMany`가 호출되지 않고 `outcome === 'skipped'`이다.
  - `count()`가 1000이고 새 판이 799행 → `'799'`와 `'1000'`을 포함한 메시지로 reject. `batchUpsertRaw`와 `deleteMany`는 호출되지 않는다.
  - `count()`가 1000이고 새 판이 800행 → 적재한다(경계값).
  - `batchUpsertRaw`가 reject → `deleteMany`는 호출되지 않는다.

- [ ] **Step 3: 실패 확인**
  - Run: `cd backend && npx vitest run __tests__/services/busStopSyncService.test.ts`
  - Expected: FAIL

- [ ] **Step 4: 서비스·스크립트·syncAll 구현**

- [ ] **Step 5: 통과 확인 + 로컬 실적재**
  - Run: 위 테스트 → PASS
  - Run: `cd backend && npx tsx src/scripts/syncBusStop.ts`
    - Expected: 약 227,054행(227,065 − 범위 밖 11)이 loaded된다.
  - 같은 명령을 다시 실행 → `skipped`, 쓰기 0건
  - Run: `cd backend && npx vitest run __tests__/scripts` (syncAll 관련 테스트가 있으면 함께) → PASS

- [ ] **Step 6: 커밋** — `feat(bus): BusStop 테이블·수집 스크립트·syncAll bus-stop`

---

### Task 4: 반경 검색·이름 합치기·API

**Files:**
- Create: `backend/src/services/busStopService.ts`
- Modify: `backend/src/routes/transit.ts`
- Test: `backend/__tests__/services/busStopService.test.ts`, `backend/__tests__/routes/transit.test.ts`(케이스 추가)

**Interfaces:**
- Produces:
  ```ts
  export interface NearbyBusStop { id: string; name: string; distance: number }   // id = 가장 가까운 nodeId, distance 반올림 m
  export interface NearbyBusStopsResult { items: NearbyBusStop[]; count: number; collectedAt: string | null }
  export async function findNearbyBusStops(lat: number, lng: number, radiusM: number, limit = 5): Promise<NearbyBusStopsResult>
  ```
  - API: `GET /api/transit/nearby?lat&lng&radius[&busRadius]`
    - `busRadius`: `z.coerce.number().min(100).max(2000).optional()`
    - `busRadius`가 있을 때만 `data.busStops`, `data.busStopCount`, `data.busCollectedAt`을 더한다.
- 동작
  - 사각형 prefilter + haversine은 `findNearbyStations`와 같은 방식이다.
    - `haversine`·`toRad`는 `subwayService.ts`에서 export해 재사용한다. 복사하지 않는다.
  - 반경 안 후보를 `name`(trim)으로 묶는다. 각 묶음은 최소 거리 행 하나다.
  - `count` = 묶음 수
  - `items` = 묶음을 거리순 정렬해 앞 `limit`개
  - `collectedAt` = 가장 가까운 행의 `collectedAt`
  - 지하철 조회와 버스 조회는 `Promise.all`로 병렬 실행한다.

- [ ] **Step 1: 실패하는 테스트 작성**
  - 서비스(prisma `busStop.findMany` mock, 기준점 37.4979, 127.0276)
    - 같은 이름 "개포고등학교" 3행(0m 근처, 약 40m, 약 130m) + "구룡마을입구" 1행(약 400m) + 1.5km 밖 1행
      - → `count === 2`
      - → `items[0].name === '개포고등학교'`이고 `items[0].distance`는 가장 가까운 값
      - → 1.5km 밖 행은 제외
    - 서로 다른 이름 7개 → `items.length === 5`, `count === 7`
    - 후보 0개 → `{ items: [], count: 0, collectedAt: null }`
  - 라우트
    - `busRadius=1000` → 응답에 `busStops`(배열), `busStopCount`(숫자), `busCollectedAt`이 있다.
    - `busRadius` 없음 → `data`의 키가 `['stations']`뿐이고 `busStop.findMany`가 호출되지 않는다(Review Focus 5).
    - `busRadius=3000` → 422

- [ ] **Step 2: 실패 확인**
  - Run: `cd backend && npx vitest run __tests__/services/busStopService.test.ts __tests__/routes/transit.test.ts`
  - Expected: FAIL

- [ ] **Step 3: 구현**

- [ ] **Step 4: 통과 확인 + 로컬 응답 확인**
  - Run: 위 테스트 → PASS
  - Run: `curl -s "http://localhost:8000/api/transit/nearby?lat=37.4885&lng=127.0657&radius=2000&busRadius=1000" | head -c 600`
    - 로컬 dev 서버와 Task 3 적재가 끝난 상태여야 한다.
    - Expected: `busStopCount` > 0, `busStops` 5개 이하, 같은 이름 없음
  - 조회 시간을 확인한다. 로컬에서 같은 요청 5회 평균, `busRadius`가 있을 때와 없을 때 차이 +20ms 이내(스펙 반목표).

- [ ] **Step 5: 커밋** — `feat(bus): transit nearby 에 버스정류장(이름 합치기·전체 개수)`

---

### Task 5: 화면 — 버스 칸, 링크 없는 행, 배치, 출처

**Files:**
- Modify: `frontend/components/common/nearby/NearbyPlaceRow.vue`
- Modify: `frontend/components/common/nearby/NearbyPlaceSection.vue`
- Modify: `frontend/components/realEstate/NearbyFacilities.vue`
- Test: `frontend/tests/components/realEstate/NearbyFacilities.test.ts`(케이스 추가·기존 "지하철역이 맨 위(전체 너비)" 케이스 수정), `frontend/tests/components/common/NearbyPlaceSection.test.ts`

**Interfaces:**
- Consumes: Task 4 응답 `data.busStops: {id,name,distance}[]`, `data.busStopCount: number`, `data.busCollectedAt: string | null`
- Produces
  - `NearbyPlaceRowData.url`을 **optional**로 바꾼다.
  - `NearbyPlaceRow`의 `to`도 optional로 바꾼다.
  - `to`가 비면 `<div>`로 그린다. 같은 레이아웃이고 hover 배경은 없다.
- 화면 규칙
  - transit 호출 query에 `busRadius: 1000`을 추가한다. 상수 `BUS_RADIUS_METERS = 1000`.
  - 섹션 `key: 'bus'`, `label: '버스 정류장'`
    - `countLabel: nearbyCountLabel(1000, busStopCount, true)` → "1km 안 N곳"
    - 행은 `busStops.slice(0, 5)`이고 `url` 없음, 배지 없음
  - 배치
    - 지하철과 버스가 둘 다 있으면 두 칸 각각 `md:col-span-1`, 지하철 → 버스 순서
    - 한쪽만 있으면 그 칸이 `md:col-span-2`
    - 그 뒤 시설 카테고리 순서는 그대로
  - 하단 출처: 버스 칸이 있을 때 기존 문구 뒤에 ` · 버스정류장: 국토교통부 · 2025년 10월 수집`을 붙인다. `busCollectedAt`의 `YYYY-MM`으로 만든다.

- [ ] **Step 1: 실패하는 테스트 작성** (`mockAsyncData`의 `transit`에 버스 필드 추가)
  - transit 호출 query에 `busRadius: 1000`이 들어간다.
  - 지하철 2곳 + 버스(count 23, 6곳 응답) → "버스 정류장" 섹션이 지하철 바로 뒤에 있다. 머리 개수 `1km 안 23곳`, 행 5개(DOM), 두 섹션 모두 `md:col-span-2` 클래스가 없다.
  - 버스 행 안에 `a` 요소가 없다. 지하철 행에는 여전히 `/subway/` 링크가 있다.
  - 지하철 0곳 + 버스 있음 → 버스 섹션이 `md:col-span-2`
  - 지하철 있음 + 버스 0곳 → 지하철 섹션이 `md:col-span-2`(기존 동작 유지)
  - 버스 `busCollectedAt: '2025-10-31'` → 하단에 `버스정류장: 국토교통부 · 2025년 10월 수집`. 버스가 0곳이면 이 문구가 없다.
  - 지하철·버스·시설 모두 0 → 기존 빈 상태 문구
  - `NearbyPlaceSection`: `url` 없는 행 → `a` 없이 이름·거리·도보가 렌더된다.

- [ ] **Step 2: 실패 확인**
  - Run: `cd frontend && npx vitest run tests/components/realEstate/NearbyFacilities.test.ts tests/components/common/NearbyPlaceSection.test.ts`
  - Expected: FAIL

- [ ] **Step 3: 구현**
  - `Section`에 `fullWidth: boolean`을 추가하고, `md:col-span-2` 결정을 `section.key === 'subway'`에서 `section.fullWidth`로 바꾼다.
  - 컴포넌트에서 `ref`/`computed`는 명시적으로 import한다(vitest auto-import 함정).

- [ ] **Step 4: 통과 확인 + 전체 테스트·린트**
  - Run: `cd frontend && npx vitest run && npm run lint`
  - Run: `cd backend && npx vitest run && npm run lint`
  - Expected: 전부 PASS, 린트 오류 0

- [ ] **Step 5: 로컬 화면 확인**
  - dev 서버(backend 8000, frontend 3000)로 아파트 상세 1곳을 연다. browse 스킬(Aside)을 쓰고, 375px·1440px 스크린샷을 남긴다.
  - 기대
    - 지하철·버스 두 칸이 나란히(데스크톱) 또는 위아래로(모바일) 놓인다.
    - 버스 행은 클릭되지 않는다.
    - 가로 넘침이 없다.
    - SSR HTML(`curl`)에 정류장 이름이 들어 있다.
  - 주의: dev 서버가 도는 중에 `npm run build`를 하지 않는다.

- [ ] **Step 6: 커밋** — `feat(bus): 부동산 상세 주변 버스 정류장 칸`

---

## 운영 반영 순서 (구현 후, 사용자 확인 하에)

1. PR → develop 머지 → CI green
2. 운영 DB 백업(mysqldump) → `202610300002_bus_stop` 적용(`prisma migrate deploy`) → `prisma migrate status`가 up to date
3. main 승격 → 배포
4. 운영에서 `syncBusStop.ts`를 사용자가 직접 실행한다(낮 시간 회피).
5. 라이브 상세 1곳에서 버스 칸과 응답 시간을 확인한다.
