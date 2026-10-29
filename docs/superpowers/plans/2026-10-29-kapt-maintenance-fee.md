# K-apt 관리비 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** K-apt 관리비 파일(올해 주간 + 전년도)을 수집하고, 부동산 상세에 "관리비" 섹션(B안)을 SSR 로 보여 준다.

**Architecture:** `syncKapt` 끝에 관리비 두 파일을 스트리밍 파싱해 `KaptMaintenanceFee`(단지×월, 45개 금액 컬럼)에 upsert 하고, 기준 월·시군구 ㎡당 공용관리비 중간값을 `KaptFeeSggMedian` 에 미리 계산한다. 상세 개요 응답에 `maintenanceFee`(화면용으로 계산이 끝난 요약)를 `complex` 옆에 붙이고, 프론트는 표시만 한다. 계산 규칙은 백엔드 순수 함수 하나(`summarizeMaintenanceFee`)에 모은다.

**Tech Stack:** Express 5 + TypeScript(ESM) · Prisma/MySQL 8 · ExcelJS 스트리밍 리더 · Nuxt 3 SSR · Vitest

**Spec:** `docs/superpowers/specs/2026-10-29-kapt-maintenance-fee-design.md`

## Global Constraints

- Node 20 (`source ~/.nvm/nvm.sh && nvm use 20`), backend 로컬 import 는 `.js` 확장자.
- 금액 표기: "44만 4,578원", "1만 9,078원", "1,626원", "1만원" — 축약(44.5만 등) 금지.
- 모든 금액은 세대 평균 = 단지 월 부과액 ÷ 세대수, 원 단위 반올림.
- 정상 범위: 세대 평균 월 합계(공용+개별+장충) **10,000 이상 2,000,000 이하**. 범위 밖 달은 모든 계산에서 뺀다.
- 기준 월: 단지 수가 가장 많은 달의 **95% 이상**인 가장 최근 달. 시군구 중간값은 **5단지 이상**일 때만.
- 출처 문구(그대로): "출처: 국토교통부 K-apt 공동주택관리정보시스템 · 단지 전체 부과액 ÷ 세대수(세대 평균, 평형별 실제 부과액과 다름)"
- 부제 형식: "K-apt 관리비 공개 · 2026년 8월 부과분" (보여 주는 달 기준).
- 광고 슬롯 개수·위치 변경 금지. meta description·JSON-LD 변경 없음.
- 관리비 조회 실패는 `maintenanceFee: null` 만 — 개요·단지 정보는 그대로.
- 새 테이블은 마이그레이션 파일로(운영은 코드 배포 전에 수동 적용). `git add` 는 경로 명시(`node_modules` 심링크 금지), `docs/` 는 `git add -f`.
- 커밋 메시지 한국어.

## Review Focus

1. **1월 초 올해 파일**: 1~2월에는 올해 주간 파일 행이 거의 없다 → 행 수 하한이 0 이어야 kapt 수집 전체가 실패하지 않는다 (Task 3 테스트 `minFeeRows`).
2. **기준 월은 있는데 이 단지 값이 범위 밖**: 이전 달로 대체하지 않고 섹션을 숨긴다 (Task 4 테스트 "기준 월 이상값이면 null").
3. **세대수 0/없음, 관리비부과면적 없음**: 전부 숨김 / ㎡ 비교만 숨김 (Task 4).
4. **지수 표기 금액 `3.7478826E8`, `2052690.0`, 빈 칸**: 숫자로 읽고 빈 칸은 null (Task 2).
5. **BIGINT 를 `$queryRaw` 로 읽으면 BigInt** → JSON 직렬화 실패. 로더에서 Number 로 바꾼다 (Task 5 테스트에서 BigInt 로 mock).

---

### Task 1: 테이블 · 마이그레이션

**Files:**
- Modify: `backend/prisma/schema.prisma` (KaptSourceFile 뒤)
- Create: `backend/prisma/migrations/202610290002_kapt_maintenance_fee/migration.sql`

**Interfaces:**
- Produces: 테이블 `KaptMaintenanceFee`, `KaptFeeSggMedian`; `KaptSourceFile.dataset` 에 `fee`, `fee-prev` 값 추가(주석만).

- [ ] **Step 1: `KaptMaintenanceFee` 모델 추가**
  - `id Int @id @default(autoincrement())`, `kaptCode VARCHAR(20)`, `yearMonth CHAR(6)`(YYYYMM), 금액 45개 `BigInt? @db.BigInt`(적립률만 `Decimal? @db.Decimal(10,3)`), `createdAt`, `updatedAt @updatedAt`, `syncedAt @default(now())`.
  - `@@unique([kaptCode, yearMonth])`, `@@index([yearMonth])`.
  - 시도·시군구·읍면·동리·단지명 5개 헤더는 `KaptComplex` 와 중복이라 저장하지 않는다(나머지 47개 = 단지코드·발생년월·금액 45개는 전부 저장).
  - 헤더 → 컬럼 이름(Task 2 의 `KAPT_FEE_COLUMNS` 와 같은 표):

| 헤더 | 컬럼 | 헤더 | 컬럼 |
|---|---|---|---|
| 공용관리비(합계) | commonTotal | 개별사용료계 | individualTotal |
| 일반관리비(합계) | generalTotal | 난방비(공용)/(전용) | heatingCommon / heatingPrivate |
| 인건비 | labor | 급탕비(공용)/(전용) | hotWaterCommon / hotWaterPrivate |
| 제사무비 | officeExpense | 가스사용료(공용)/(전용) | gasCommon / gasPrivate |
| 제세공과금 | taxes | 전기료(공용)/(전용) | electricityCommon / electricityPrivate |
| 피복비 | uniform | 수도료(공용)/(전용) | waterCommon / waterPrivate |
| 교육훈련비 | training | TV수신료 | tvFee |
| 차량유지비 | vehicle | 정화조오물수수료 | septicFee |
| 그밖의부대비용 | otherOverhead | 생활폐기물수수료 | wasteFee |
| 청소비 | cleaning | 입대의운영비 | councilFee |
| 경비비 | security | 건물보험료 | buildingInsurance |
| 소독비 | disinfection | 선관위운영비 | electionFee |
| 승강기유지비 | elevator | 기타 | etc |
| 지능형네트워크유지비 | network | 장충금 월부과액 | ltrCharge |
| 수선유지비(합계) | repairTotal | 장충금 월사용액 | ltrUsage |
| 수선비 | repair | 장충금 총적립금액 | ltrBalance |
| 시설유지비 | facilityMaintenance | 장충금 적립률 | ltrRate (Decimal) |
| 안전점검비 | safetyInspection | 잡수입 월수입금액 | miscIncome |
| 재해예방비 | disasterPrevention | 입주자기여수익 | residentIncome |
| 위탁관리수수료 | managementFee | 공동기여수익 | sharedIncome |

- [ ] **Step 2: `KaptFeeSggMedian` 모델 추가** — `sggCode CHAR(5)`, `yearMonth CHAR(6)`, `medianCommonPerM2 Int`(원/㎡, 반올림), `complexCount Int`, `syncedAt @default(now()) @updatedAt`, `@@id([sggCode, yearMonth])`. 전국 값은 `sggCode = '00000'` 행으로 둔다 — 기준 월은 이 행의 `MAX(yearMonth)` 로 읽는다.
- [ ] **Step 3: 마이그레이션 SQL 작성** — 기존 `202610280001_kapt_complex/migration.sql` 형식대로 두 `CREATE TABLE` 을 직접 쓴다(로컬 DB 는 db push 상태라 `migrate dev` 를 쓰지 않는다).
- [ ] **Step 4: 로컬 반영 확인** — `npx prisma db execute --file prisma/migrations/202610290002_kapt_maintenance_fee/migration.sql --schema prisma/schema.prisma && npx prisma generate && npm run build`. Expected: 오류 없음, `SHOW CREATE TABLE KaptMaintenanceFee` 의 컬럼이 스키마와 일치.
- [ ] **Step 5: Commit** — `feat(kapt): 관리비 테이블·시군구 중간값 테이블 마이그레이션`

### Task 2: 관리비 xlsx 스트리밍 파서

**Files:**
- Create: `backend/src/services/kaptFeeParser.ts`
- Test: `backend/__tests__/services/kaptFeeParser.test.ts`

**Interfaces:**
- Consumes: `cellToString` (`./kricSubwayFileDownloader.js`)
- Produces:
  - `export const KAPT_FEE_COLUMNS: ReadonlyArray<readonly [header: string, column: string]>` (Task 1 표 45개)
  - `export interface KaptFeeItem { kaptCode: string; yearMonth: string; [column: string]: string | number | null }` — 금액은 `number | null`, `ltrRate` 는 소수 3자리 문자열
  - `export function parseFeeAmount(value: string | undefined): number | null`
  - `export async function* readKaptFeeXlsx(buffer: Buffer, batchSize = 2000): AsyncGenerator<KaptFeeItem[]>`

- [ ] **Step 1: 실패 테스트**
  - `parseFeeAmount('3.7478826E8') === 374788260`, `('2052690.0') === 2052690`, `('') === null`, `('abc') === null`, `('0') === 0`.
  - ExcelJS 로 메모리에서 만든 xlsx(1행 안내문, 2행 헤더 52개, 3~5행 데이터, 빈 행 1개)를 `readKaptFeeXlsx(buf, 2)` 로 읽으면 배치 `[2, 1]`, 첫 행 `{ kaptCode: 'A10024564', yearMonth: '202601', commonTotal: 374788260, ltrRate: '2.191', … }`.
  - 발생년월이 `202601.0` 같은 숫자 문자열이어도 `'202601'`; 6자리 아님·단지코드 빈 행은 건너뛴다.
  - 헤더에서 `개별사용료계` 를 빼면 `/헤더 누락: 개별사용료계/` 로 throw.
- [ ] **Step 2: `npx vitest run __tests__/services/kaptFeeParser.test.ts`** → FAIL(모듈 없음)
- [ ] **Step 3: 구현** — `ExcelJS.stream.xlsx.WorkbookReader(Readable.from(buffer), { sharedStrings: 'cache', worksheets: 'emit', hyperlinks: 'ignore', styles: 'ignore' })`, 첫 워크시트만. 2행에서 헤더→열 번호 맵을 만들고 필수 헤더(`단지코드`, `발생년월(YYYYMM)`, `KAPT_FEE_COLUMNS` 의 헤더 전부) 검증. `kaptFileParsers.ts` 머리 주석처럼 파일 머리에 형식 설명.
- [ ] **Step 4: 테스트 PASS 확인 + 실파일 측정** — `npx tsx -e` 로 `docs/research/2026-10-28-kapt-match/kapt-fee-2025.xlsx` 를 읽어 행 수(≈255,000)·소요 시간·`process.memoryUsage().rss` 최대치를 기록(PR 본문에 적는다). RSS 가 1GB 를 넘으면 배치 크기를 줄이고 원인을 적는다.
- [ ] **Step 5: Commit** — `feat(kapt): 관리비 xlsx 스트리밍 파서`

### Task 3: 수집 — 자료실 글 찾기 · upsert · 시군구 중간값

**Files:**
- Modify: `backend/src/services/kaptFileSource.ts`, `backend/src/services/kaptSyncService.ts`, `backend/src/scripts/syncKapt.ts`(결과 출력만), `scripts/ops/sync-real-estate.sh`(kapt 예산)
- Create: `backend/src/services/kaptFeeStats.ts`
- Test: `backend/__tests__/services/kaptFileSource.test.ts`, `backend/__tests__/services/kaptSyncService.test.ts`, `backend/__tests__/services/kaptFeeStats.test.ts`

**Interfaces:**
- Consumes: `readKaptFeeXlsx`, `KaptFeeItem` (Task 2); `batchUpsertRaw`, `runSync`.
- Produces:
  - `kaptFileSource.ts`: `export async function fetchKaptBoardPosts(session, tab: string, fetchFn?): Promise<KaptPost[]>` (기존 `fetchLatestKaptPost` 는 이걸 쓰도록 바꾼다), `export function findFeePosts(posts: KaptPost[]): { current: KaptPost | null; previous: KaptPost | null }`.
  - `kaptFeeStats.ts`: `export const FEE_VALID_RANGE = { min: 10_000, max: 2_000_000 }`, `export function pickBaseMonth(counts: Array<{ yearMonth: string; complexes: number }>): string | null`, `export function median(values: number[]): number`, `export async function refreshFeeSggMedians(): Promise<{ baseMonth: string | null; sggCount: number }>`.
  - `KaptDatasetResult.dataset` 타입에 `'fee' | 'fee-prev'` 추가.

- [ ] **Step 1: 자료실 03 탭 제목 실측** — 로컬에서 `openKaptSession` → `fetchKaptBoardPosts(session, '03')` 를 한 번 실행해 주간·연도 글 제목을 확인하고, 그 제목 2개를 테스트 픽스처로 쓴다(예상: `…관리비정보(2026.10.26.)`, `…관리비정보(2025년)`).
- [ ] **Step 2: 실패 테스트 (`kaptFileSource.test.ts`)** — `findFeePosts`: 주간 글 여러 개 중 기준일 최신이 `current`; `previous` 는 `current.fileDate` 연도 −1 의 "(YYYY년)" 글(2018~2024 연도 글이 섞여 있어도 2025년 글); 주간 글이 없으면 둘 다 null.
- [ ] **Step 3: 실패 테스트 (`kaptFeeStats.test.ts`)**
  - `pickBaseMonth([{202607,20100},{202608,20083},{202609,11370}]) === '202608'`; 최대가 20,100 이므로 95% = 19,095 이상인 가장 최근 달. 빈 배열이면 null.
  - `median([3,1,2]) === 2`, `median([1,2,3,4]) === 2.5`.
  - `refreshFeeSggMedians` (prisma mock): 기준 월 행 중 세대 평균 범위 밖·세대수 0·면적 없음 단지는 빼고, 시군구별 5단지 이상만, 전국 `'00000'` 행 포함해 기존 행 전부 삭제 후 insert(하나의 `$transaction`). 단지의 시군구 = 그 단지 필지 `sggCode` 중 가장 작은 값.
- [ ] **Step 4: 실패 테스트 (`kaptSyncService.test.ts`)** — 기존 mock 에 `fetchKaptBoardPosts`, `findFeePosts`, `readKaptFeeXlsx`, `refreshFeeSggMedians` 추가.
  - 저장된 `fee` 기준일 ≥ 주간 글 기준일이면 두 관리비 파일 모두 받지 않고, 중간값은 테이블이 비어 있을 때만 다시 계산.
  - 주간 글이 새로우면 주간 파일 → 연도 파일 순서로 받는다. 연도 파일 파일명이 저장된 `fee-prev.fileName` 과 같으면 파싱하지 않는다(`status: 'unchanged'`).
  - 배치마다 `batchUpsertRaw('KaptMaintenanceFee', rows)`(유니크 키 `kaptCode+yearMonth` 의 ON DUPLICATE KEY UPDATE) 호출, 행에 `updatedAt`/`syncedAt` = 실행 시작 시각. 삭제 쿼리는 없다.
  - 행 수 하한 `minFeeRows('fee', '2026-10-26') === 120_000`, `minFeeRows('fee', '2027-02-02') === 0`, `minFeeRows('fee-prev', …) === 200_000`; 하한 미달이면 throw 하고 `kaptSourceFile.upsert` 를 하지 않는다(다음 실행이 다시 받는다).
  - basic·area·fee·fee-prev 중 하나라도 `updated` 면 `refreshFeeSggMedians` 1회 호출.
- [ ] **Step 5: 테스트 FAIL 확인** — `npx vitest run __tests__/services/kaptFileSource.test.ts __tests__/services/kaptFeeStats.test.ts __tests__/services/kaptSyncService.test.ts`
- [ ] **Step 6: 구현**
  - `minFeeRows(dataset, fileDate)`: `fee` = `15_000 × max(0, 월 − 2)`, `fee-prev` = `200_000`. (2026-10-26 실측: 올해 182,060행·8개 완결 월, 전년 255,000행)
  - `fee-prev` 의 `KaptSourceFile.fileDate` 는 그 실행의 주간 글 기준일, `postSeq` 는 연도 글 번호, `fileName` 은 다운로드 파일명.
  - 금액 컬럼은 `KAPT_FEE_COLUMNS` 에서 만든다(손으로 다시 나열하지 않는다).
  - 단계 로그 형식은 기존 `[kapt] …` 와 같게: `[kapt] 관리비(2026) 182,060행 (신규 n, 갱신 n)`, `[kapt] 시군구 관리비 중간값 기준월 202608 · 시군구 n곳`.
- [ ] **Step 7: 테스트 PASS 확인** (Step 5 명령)
- [ ] **Step 8: 로컬 실데이터 첫 수집 실측** — `REAL_ESTATE_WRITE_LOCK_DIR=$CLAUDE_JOB_DIR/tmp/locks npx tsx src/scripts/syncKapt.ts --force` 의 전체 시간과 관리비 단계 시간을 잰다. Expected: `KaptMaintenanceFee` ≈ 437,000행, `KaptFeeSggMedian` 의 `'00000'` 행 `yearMonth = '202608'`, 강남구(11680) 중간값 ≈ 1,527원/㎡·약 178단지.
- [ ] **Step 9: 운영 예산 조정** — `scripts/ops/sync-real-estate.sh` 의 kapt `run_backend_node_timed 15m` 를 `max(30m, Step 8 전체 시간 × 3)` 를 분 단위로 올린 값으로 바꾸고 주석에 실측값을 적는다.
- [ ] **Step 10: Commit** — `feat(kapt): 관리비 파일 수집과 시군구 ㎡당 공용관리비 중간값`

### Task 4: 관리비 요약 계산 (순수 함수)

**Files:**
- Create: `backend/src/services/kaptFeeSummary.ts`
- Modify: `backend/src/types/housingRedesign.ts`
- Test: `backend/__tests__/services/kaptFeeSummary.test.ts`

**Interfaces:**
- Consumes: `FEE_VALID_RANGE` (Task 3)
- Produces (types, frontend 에도 같은 모양으로 복사):

```ts
export interface FeePeriodAverage { from: string; to: string; amount: number; months: number } // from/to 'YYYY-MM'
export interface MaintenanceFeeItem { group: 'common' | 'individual' | 'longTermRepair'; label: string; amount: number }
export interface MaintenanceFeeSummary {
  month: string;              // 큰 숫자의 달 'YYYY-MM'
  total: number; common: number; individual: number; longTermRepair: number;
  summer: FeePeriodAverage | null;
  winter: FeePeriodAverage | null;
  yearly: FeePeriodAverage | null;
  monthly: Array<{ month: string; amount: number; partial: boolean }>; // 오래된 달 → 최근 달
  commonPerM2: { complex: number; sggMedian: number; sggComplexCount: number } | null;
  items: MaintenanceFeeItem[];
  office: { phone: string | null; address: string | null };
}
// DetailOverview 에 추가: maintenanceFee: MaintenanceFeeSummary | null;
```

  - `export interface FeeMonthRow { yearMonth: string; [column: string]: number | null | string }` (BigInt 는 로더가 Number 로 바꿔서 넘긴다)
  - `export function summarizeMaintenanceFee(input: { rows: FeeMonthRow[]; baseMonth: string; householdCount: number | null; managementArea: number | null; sggMedian: { median: number; complexCount: number } | null; office: { phone: string | null; address: string | null } }): MaintenanceFeeSummary | null`

- [ ] **Step 1: 실패 테스트** — 픽스처는 스펙 §4 개포래미안포레스트 실제 값(2,296세대, 관리비부과면적 244,894.45, 2025-09~2026-09 행; 리서치 `fee-compact*.tsv` 에서 `A10024564` 행을 뽑아 `__tests__/fixtures/kaptFeeGaepo.json` 으로 저장). 기준 월 `'202608'`, 중간값 `{ median: 1527, complexCount: 178 }`.
  - `total === 444578`, `common === 173395`, `individual === 252105`, `longTermRepair === 19078`, `month === '2026-08'`
  - `summer = { from: '2026-07', to: '2026-08', amount: 435664, months: 2 }`, `winter = { from: '2025-12', to: '2026-02', amount: 473096, months: 3 }`, `yearly = { from: '2025-09', to: '2026-08', amount: 414348, months: 12 }`
  - `monthly` 길이 13, 마지막 `{ month: '2026-09', amount: 377105, partial: true }`, 나머지 `partial: false`
  - `commonPerM2 = { complex: 1626, sggMedian: 1527, sggComplexCount: 178 }`
  - `items` 에 amount 0 인 항목 없음, 첫 그룹 `common` 첫 항목 label `'일반관리비'`; 개별 항목은 공용+전용을 합친 `'난방비'`, `'급탕비'`, `'가스사용료'`, `'전기료'`, `'수도료'` 와 `'TV수신료'`·`'정화조오물수수료'`·`'생활폐기물수수료'`·`'입대의운영비'`·`'건물보험료'`·`'선관위운영비'`·`'기타'`; 공용 항목은 `'일반관리비'`·`'청소비'`·`'경비비'`·`'소독비'`·`'승강기유지비'`·`'지능형네트워크유지비'`·`'수선유지비'`·`'위탁관리수수료'`; 장충은 `'장기수선충당금'` 1개.
  - 기준 월 행이 없고 7월 행이 있으면 `month === '2026-07'`, `commonPerM2 === null`; 기준 월부터 2개월 전까지 행이 없으면 null.
  - 기준 월 세대 평균이 9,999원 또는 2,000,001원이면 null(이전 달로 대체하지 않음).
  - 범위 밖인 달은 `monthly`·계절·연평균에서 빠진다: 7월이 범위 밖이면 `summer` 는 그 전 해 7·8월(있으면) 또는 null.
  - 12개월 중 9개월만 정상이면 `yearly === null`.
  - `householdCount` 가 0·null 이면 null. `managementArea` null 이면 `commonPerM2 === null`, 나머지는 그대로. `sggMedian` null 이면 `commonPerM2 === null`.
- [ ] **Step 2: FAIL 확인** — `npx vitest run __tests__/services/kaptFeeSummary.test.ts`
- [ ] **Step 3: 구현** — 세대 평균 = `Math.round(값 / 세대수)`; 큰 숫자 구성 3개는 각각 반올림하고 `total` 은 `common + individual + longTermRepair` 의 반올림 전 합을 반올림(테스트 값과 맞춘다). 계절·연평균은 각 달 세대 평균 합계(반올림 전)의 평균을 반올림. `monthly` = 기준 월로 끝나는 12개월 중 정상 달 + 기준 월 뒤 정상 달(`partial: true`). ㎡당 = `Math.round(공용 / 관리비부과면적)`.
- [ ] **Step 4: PASS 확인**
- [ ] **Step 5: Commit** — `feat(kapt): 관리비 요약 계산(세대 평균·계절·연평균·시군구 비교)`

### Task 5: 상세 개요 응답에 관리비 붙이기

**Files:**
- Create: `backend/src/services/kaptFeeLoader.ts`
- Modify: `backend/src/services/realEstateDetailService.ts` (`getDetailOverview` 반환에 `maintenanceFee`)
- Test: `backend/__tests__/services/kaptFeeLoader.test.ts`, 기존 상세 서비스 테스트(개요 반환 모양 assertion 이 있으면 `maintenanceFee` 추가)

**Interfaces:**
- Consumes: `summarizeMaintenanceFee` (Task 4), `ComplexInfo.kaptCode`
- Produces: `export async function loadMaintenanceFee(kaptCode: string): Promise<MaintenanceFeeSummary | null>`

- [ ] **Step 1: 실패 테스트** (prisma `$queryRaw` mock, 금액·세대수를 `BigInt` 로 반환)
  - 쿼리 4개를 `Promise.all` 로: ① `KaptFeeSggMedian WHERE sggCode = '00000'` 의 `MAX(yearMonth)` ② `KaptComplex` 의 `householdCount, managementArea, raw` (active) ③ 단지 필지 `MIN(sggCode)` 와 그 시군구의 기준 월 중간값 행(한 쿼리, 서브쿼리) ④ `KaptMaintenanceFee WHERE kaptCode = ? AND yearMonth >= ?`(기준 월 23개월 전). 기준 월은 ①이 끝나야 알 수 있으므로 ①을 먼저 하고 ②~④ 를 병렬로 해도 된다 — 테스트는 결과만 본다.
  - 결과가 JSON.stringify 가능(BigInt 없음).
  - `raw` 의 `'관리사무소 연락처'`, `'관리사무소 주소'` 를 `office` 로; 빈 문자열은 null.
  - 기준 월 없음(중간값 테이블 비어 있음) → null, 단지 없음 → null.
- [ ] **Step 2: FAIL 확인**
- [ ] **Step 3: 구현** — `loadMaintenanceFee` 작성. `getDetailOverview` 에서 `complex` 가 있으면 `findDetailMaintenanceFee(complex.kaptCode)`(try/catch, `console.warn('[realEstateDetail] K-apt 관리비 조회 실패', …)` 후 null)를 부르고 반환에 `maintenanceFee` 추가. `complex` 가 null 이면 `maintenanceFee: null`.
- [ ] **Step 4: PASS 확인 + 전체 백엔드 테스트** — `npm run test` (로컬에서 `*_test` DB 가 필요한 2개 스위트 실패는 환경 문제로 기존과 같음을 확인), `npm run lint`, `npm run build`.
- [ ] **Step 5: 로컬 응답 측정** — dev 서버에서 개포래미안포레스트 상세 개요 API 를 관리비 붙이기 전/후 각 5회 호출해 중간값 차이 ≤ 20ms 확인, `maintenanceFee.total === 444578`.
- [ ] **Step 6: Commit** — `feat(real-estate): 상세 개요에 K-apt 관리비 요약`

### Task 6: 프론트 "관리비" 섹션

**Files:**
- Modify: `frontend/types/housingRedesign.ts` (Task 4 타입 복사, `DetailOverview.maintenanceFee`)
- Create: `frontend/utils/maintenanceFee.ts`, `frontend/components/realEstate/MaintenanceFeeSection.vue`
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- Test: `frontend/tests/utils/maintenanceFee.test.ts`, `frontend/tests/components/realEstate/MaintenanceFeeSection.test.ts`
- Modify (있으면): MSW 상세 개요 핸들러·픽스처에 `maintenanceFee: null` 기본값

**Interfaces:**
- Consumes: `MaintenanceFeeSummary` (Task 4)
- Produces: `formatWon(n: number): string`, `formatFeeMonth('2026-08'): '2026년 8월'`, `formatFeePeriod({from,to}): '26.7~8월'`-형 라벨, `feeExtremes(monthly): { high: {month, amount}; low: {month, amount} } | null`(partial 제외, 2개월 미만이면 null)

- [ ] **Step 1: 실패 테스트 (utils)**
  - `formatWon(444578) === '44만 4,578원'`, `formatWon(19078) === '1만 9,078원'`, `formatWon(1626) === '1,626원'`, `formatWon(10000) === '1만원'`, `formatWon(1234567) === '123만 4,567원'`
  - `formatFeeMonth('2026-08') === '2026년 8월'`
  - `formatFeePeriod({ from: '2025-12', to: '2026-02' }) === '25.12~26.2'`, `({ from: '2026-07', to: '2026-08' }) === '26.7~8'`, `({ from: '2025-09', to: '2026-08' }) === '25.9~26.8'`
  - `feeExtremes` 가 partial 달을 무시하고 최고 1월 491,205·최저 5월 366,597 반환(스펙 월별 값)
- [ ] **Step 2: 실패 테스트 (component)** — 개포 요약 픽스처로 mount:
  - 제목 "관리비", 부제 "K-apt 관리비 공개 · 2026년 8월 부과분", "세대 평균 월 관리비", "44만 4,578원"
  - 범례에 "공용관리비 17만 3,395원", "개별사용료 25만 2,105원", "장기수선충당금 1만 9,078원"
  - 여름·겨울·연평균 칸 3개(값 null 인 칸은 렌더 안 됨 — `winter: null` 로 2칸 확인)
  - 월별 막대 13개, partial 막대에 흐림 클래스, 요약 줄 "가장 높은 달 1월 49만 1,205원 · 가장 낮은 달 5월 36만 6,597원"
  - ㎡당 비교 "1,626원" / "1,527원", "강남구" 대신 "같은 시군구 중간(178단지)" — 시군구 이름은 응답에 없으므로 이 문구로 고정; `commonPerM2: null` 이면 그 블록 없음
  - "항목별 내역 보기" 는 `<details>` — 닫힌 상태에서도 항목 텍스트가 HTML 에 있다
  - 관리사무소 전화는 `tel:` 링크(숫자·하이픈만 남긴 href); `office` 둘 다 null 이면 블록 없음
  - 출처 문구 Global Constraints 그대로
- [ ] **Step 3: FAIL 확인** — `cd frontend && npx vitest run tests/utils/maintenanceFee.test.ts tests/components/realEstate/MaintenanceFeeSection.test.ts`
- [ ] **Step 4: 구현** — `ComplexInfoSection.vue` 와 같은 `SectionBlock variant="flat"`·토큰 클래스(text-strong/muted/faint, bg-primary, bg-surface-2)·`ref`/`computed` 명시 import. 레이아웃은 `.superpowers/brainstorm/72882-1793230290/content/fee-placement.html` B안을 따른다(데스크톱 2열: 왼쪽 큰 숫자·구성·계절, 오른쪽 월별·㎡ 비교). 페이지:
  - `const maintenanceFee = computed(() => detailOverview.value?.maintenanceFee ?? null)`
  - 바로가기: `<a v-if="maintenanceFee" href="#maintenance-fee">관리비</a>` 를 "단지 정보" 링크 바로 뒤
  - 섹션: `<MaintenanceFeeSection v-if="maintenanceFee" id="maintenance-fee" class="order-8 md:order-9 scroll-mt-24" :fee="maintenanceFee" />` 를 `ComplexInfoSection` 바로 뒤(같은 order 라 DOM 순서대로 단지 정보 다음·위치 앞, 광고 블록 무변경)
- [ ] **Step 5: PASS 확인 + 전체** — `npm run test`, `npm run lint` (dev 서버 실행 중이면 build 하지 않는다; CI 가 build 확인)
- [ ] **Step 6: 브라우저 확인** — 로컬 dev(백엔드+프론트)에서 개포래미안포레스트 상세를 Aside 로 열어 모바일(390px)·데스크톱 스크린샷, 콘솔 오류 0, "관리비" 바로가기 이동 확인. 관리비 없는 단지(단지 정보만 있는 단지 1곳)와 단지 연결 없는 상세 1곳은 섹션·메뉴 없음 확인.
- [ ] **Step 7: Commit** — `feat(real-estate): 상세 관리비 섹션(B안)`

### Task 7: 마무리

- [ ] **Step 1:** 스펙 §8 빌더 재량 결정(테이블 구조=금액 45컬럼, 위치 5개 헤더 미저장, 행 수 하한식, 연도 파일 재수집 트리거, 시군구 = 필지 sggCode 최솟값, 적립률 화면 미표시)을 스펙 문서 끝 "구현 결정" 절에 기록, 단계 표기를 "승인 · 구현"으로.
- [ ] **Step 2:** 전체 테스트(백엔드·프론트) 재실행 후 push, develop 대상 PR 생성(본문: 실측 시간·메모리·응답 시간 차이·운영 적용 순서 = 백업 → 마이그레이션 → 코드 배포 → 수동 첫 수집).
- [ ] **Step 3:** CI 통과 확인 후 develop 머지. main 승격·운영 적용은 사용자 요청 시.
