# Phase 3 — 동기화 N+1 제거 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 5개 facility sync(toilet/childcare/market/sports/ev-charger)의 건당 `findUnique + upsert` N+1 패턴을 기존 `batchUpsertRaw` 단일 SQL로 교체. 사이클당 ~99만 쿼리 → ~9.9k(99% 절감), sync wall-time 10~40× 가속, SyncHistory 통계 정확성 유지.

**Architecture:** `batchUpsertRaw`(`baseSyncService.ts:190`)에 `exactStats` 옵션을 추가해 배치당 1 SELECT로 new/updated를 정확히 집계. 5개 sync 서비스가 각자 자기 모델의 row 형태로 변환 후 `batchUpsertRaw(modelName, rows, batchSize, syncHistoryId, { exactStats: true })`만 호출. 새 추상화·라이브러리·헬퍼 0.

**Tech Stack:** Prisma + MySQL 8 + raw `$executeRawUnsafe`(`INSERT ... ON DUPLICATE KEY UPDATE`) + Vitest integration test (실 MySQL 컨테이너).

**Spec 참조:** `docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md` 섹션 6.

**스코프 결정 (사용자 합의)**: spec 그대로 5개만. clothes/library/parking/park/school/subway도 동일 N+1 패턴이지만 본 PR 밖 (각 1k 안팎으로 절감 효과 작음). 추후 Phase 3-B 가능.

**PR 단위:** 단일 atomic PR. 6 commit (Task당 1).

---

## File Structure

| 파일 | 변경 종류 | 책임 |
|---|---|---|
| `backend/src/services/baseSyncService.ts` | Modify | `batchUpsertRaw`에 `BatchUpsertRawOptions { exactStats?, uniqueKey? }` 추가. exactStats true면 배치당 사전 SELECT로 정확 집계. 기존 호출자(부동산 sync) 동작 변경 0. |
| `backend/__tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts` | Create | Vitest integration test 2건 (실 MySQL): 정확 통계 모드 / 동일 값 재입력 케이스 |
| `backend/src/services/toiletSyncService.ts` | Modify | 건당 `findUnique + upsert` 패턴 제거 → 변환 + `batchUpsertRaw('Toilet', rows, 100, syncHistory.id, { exactStats: true })` |
| `backend/src/services/childcareSyncService.ts` | Modify | 동일 패턴 (모델명 `Childcare`) |
| `backend/src/services/marketSyncService.ts` | Modify | 동일 패턴 (모델명 `Market`) |
| `backend/src/services/sportsSyncService.ts` | Modify | 동일 패턴 (모델명 `Sports`) |
| `backend/src/services/evChargerSyncService.ts` | Modify | 동일 패턴 (모델명 `EvCharger`, sourceId는 이미 `statId-chgerId` 합성됨) — 가장 큰 변경이라 commit 마지막 |
| 기존 sync 서비스 vitest mock 파일들 | Modify (조건부) | `prisma.<model>.upsert` mock에 의존하는 테스트가 깨지면 `batchUpsertRaw` mock으로 갱신 |

**핵심 식별자 일관성:**
- 옵션: `BatchUpsertRawOptions { exactStats?: boolean; uniqueKey?: string }` (default uniqueKey: 'sourceId')
- 호출: `batchUpsertRaw(tableName, rows, batchSize, syncHistoryId, { exactStats: true, uniqueKey: 'sourceId' })`
- tableName = Prisma 모델명 (PascalCase, MySQL 테이블명과 동일)
- 모든 5개 sync에 동일 옵션 적용

---

## Task 1: `batchUpsertRaw`에 `exactStats` 옵션 추가 (TDD)

**Files:**
- Modify: `backend/src/services/baseSyncService.ts`
- Create: `backend/__tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts`

- [ ] **Step 1.1: 신규 vitest 테스트 파일 작성 (실패 케이스)**

`backend/__tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prisma } from '../../src/lib/prisma.js';
import { batchUpsertRaw } from '../../src/services/baseSyncService.js';

const TEST_PREFIX = 'PHASE3-EXACTSTATS-';

async function clean() {
  await prisma.toilet.deleteMany({ where: { sourceId: { startsWith: TEST_PREFIX } } });
}

function row(suffix: string, name = '테스트화장실') {
  return {
    id: `toilet-${TEST_PREFIX}${suffix}`,
    name,
    address: '테스트주소',
    roadAddress: '테스트도로명',
    lat: 37.5,
    lng: 127.0,
    city: '서울특별시',
    district: '중구',
    sourceId: `${TEST_PREFIX}${suffix}`,
    operatingHours: '24시간',
    maleToilets: 1, maleUrinals: 1, femaleToilets: 1,
    hasDisabledToilet: false,
    createdAt: new Date(), updatedAt: new Date(), syncedAt: new Date(),
  };
}

describe('batchUpsertRaw with exactStats', () => {
  beforeEach(clean);
  afterEach(clean);

  it('정확 통계 모드는 사전 SELECT로 new/updated를 구분한다', async () => {
    // arrange: 1건은 이미 존재
    await prisma.toilet.create({ data: row('1', '기존') });

    // act: 1건 update + 1건 new
    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      [row('1', '수정'), row('2', '신규')],
      100,
      undefined,
      { exactStats: true, uniqueKey: 'sourceId' }
    );

    // assert: 정확 집계
    expect(newCount).toBe(1);
    expect(updateCount).toBe(1);
  });

  it('동일 값 재입력도 updated로 정확 집계 (휴리스틱은 0/1 잘못 잡지만 exact는 1/0)', async () => {
    // arrange
    await prisma.toilet.create({ data: row('3', '동일') });

    // act: 같은 값으로 재입력 → MySQL ROW_COUNT는 0 (변경 없음)
    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      [row('3', '동일')],
      100,
      undefined,
      { exactStats: true, uniqueKey: 'sourceId' }
    );

    // assert: exact 모드는 사전 SELECT 기반이라 updated로 정확 집계
    expect(newCount).toBe(0);
    expect(updateCount).toBe(1);
  });

  it('exactStats 미지정 시 기존 휴리스틱 동작 유지 (비파괴)', async () => {
    const { newCount, updateCount } = await batchUpsertRaw(
      'Toilet',
      [row('4'), row('5')],
      100
    );

    // 휴리스틱: affectedRows - batchLength. 신규만 들어가니 affectedRows=2, updated=0, new=2
    expect(newCount).toBe(2);
    expect(updateCount).toBe(0);
  });
});
```

- [ ] **Step 1.2: 테스트가 실패하는지 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
npx vitest run __tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts
```

Expected: 1번째·2번째 케이스 FAIL (옵션이 아직 없어 exactStats가 무시됨 → 휴리스틱 동작으로 잘못 집계). 3번째는 PASS.

- [ ] **Step 1.3: `batchUpsertRaw` 시그니처 + 옵션 인터페이스 추가**

`backend/src/services/baseSyncService.ts`의 `batchUpsertRaw` 위(line 189 부근)에 인터페이스 추가:

```ts
export interface BatchUpsertRawOptions {
  /** 통계를 정확히 집계 (배치당 1 SELECT 추가). 기본 false — 휴리스틱 사용 */
  exactStats?: boolean;
  /** 정확 통계 시 unique key 컬럼명. 기본 'sourceId' */
  uniqueKey?: string;
}
```

기존 `batchUpsertRaw` 시그니처를 다음으로 교체 (4번째 파라미터까지 동일, 5번째 옵션 추가):

```ts
export async function batchUpsertRaw<T extends Record<string, unknown>>(
  tableName: string,
  items: T[],
  batchSize: number = SYNC.BATCH_SIZE,
  syncHistoryId?: number,
  options: BatchUpsertRawOptions = {}
): Promise<{ newCount: number; updateCount: number }> {
  const { exactStats = false, uniqueKey = 'sourceId' } = options;
  if (items.length === 0) return { newCount: 0, updateCount: 0 };
  // ... 기존 본문 유지 ...
```

- [ ] **Step 1.4: 배치 루프 안에서 exactStats 사전 SELECT + 정확 집계 분기 추가**

기존 배치 루프(line 210~292 부근)의 `try {` 블록 안, `const columns = Object.keys(batch[0]);` 위에 사전 SELECT 추가:

```ts
    try {
      // exactStats=true일 때 사전 SELECT로 기존 row 키 집합 확보 (배치당 1 쿼리)
      let preExistingKeys: Set<unknown> | null = null;
      if (exactStats) {
        const keys = batch.map((item) => item[uniqueKey]);
        const placeholders = keys.map(() => '?').join(', ');
        const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
          `SELECT \`${uniqueKey}\` FROM \`${tableName}\` WHERE \`${uniqueKey}\` IN (${placeholders})`,
          ...keys
        );
        preExistingKeys = new Set(rows.map((r) => r[uniqueKey]));
      }

      // 컬럼 목록은 배치 첫 항목 기준으로 결정
      const columns = Object.keys(batch[0]);
      // ... 기존 SQL 생성·실행 코드 그대로 ...
```

그리고 기존 통계 집계 부분(line 262~270 부근):

```ts
      // MySQL INSERT ... ON DUPLICATE KEY UPDATE 규칙:
      //   신규 삽입: affected rows += 1
      //   업데이트: affected rows += 2
      //   변경 없음: affected rows += 0
      // 따라서: updated = affectedRows - batchLength, new = batchLength - updated
      const updatedInBatch = Math.max(0, affectedRows - batch.length);
      const newInBatch = batch.length - updatedInBatch;
      newCount += newInBatch;
      updateCount += updatedInBatch;
```

를 다음으로 교체:

```ts
      // 통계 집계: exactStats면 사전 SELECT 결과로 정확 집계, 아니면 ROW_COUNT 휴리스틱
      let newInBatch: number;
      let updatedInBatch: number;
      if (preExistingKeys) {
        updatedInBatch = batch.filter((item) => preExistingKeys!.has(item[uniqueKey])).length;
        newInBatch = batch.length - updatedInBatch;
      } else {
        // 휴리스틱:
        //   신규 삽입: affected rows += 1
        //   업데이트: affected rows += 2
        //   변경 없음: affected rows += 0
        //   → updated = affectedRows - batchLength, new = batchLength - updated
        updatedInBatch = Math.max(0, affectedRows - batch.length);
        newInBatch = batch.length - updatedInBatch;
      }
      newCount += newInBatch;
      updateCount += updatedInBatch;
```

- [ ] **Step 1.5: 테스트 PASS 확인 (회귀 포함)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
npx vitest run __tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts
```

Expected: 모든 케이스(3건) PASS.

전체 backend vitest 회귀:

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
npx vitest run
```

Expected: 1186 tests (이전) + 3 신규 = 1189 PASS.

- [ ] **Step 1.6: lint**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
npm run lint
```

Expected: 0 error.

- [ ] **Step 1.7: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/baseSyncService.ts backend/__tests__/services/baseSyncService.batchUpsertRaw.exactStats.test.ts
git commit -m "feat(sync): batchUpsertRaw에 exactStats 옵션 추가

기존 ROW_COUNT 휴리스틱은 '동일 값 재입력' 케이스에서 newCount를 잘못 잡음
→ SyncHistory 통계 부정확. 정확 모드 추가:

- 배치당 1 SELECT로 기존 sourceId 집합 확보 (인덱스 사용, <5ms)
- 정확한 new/updated 분리

옵션 미지정 시 기존 동작 (휴리스틱) 그대로 — 부동산 sync 등 기존 호출자 비파괴.
Vitest integration test 3건 추가 (실 MySQL 컨테이너 사용, CI test-backend job 호환).

Spec: docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md 섹션 6.2"
```

---

## Task 2: `toiletSyncService` 리팩터

**Files:**
- Modify: `backend/src/services/toiletSyncService.ts`

- [ ] **Step 2.1: 현 코드 위치 + 모델 필드 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'batchUpsert\|prisma\.toilet\|findUnique' backend/src/services/toiletSyncService.ts | head -10
grep -A 50 'model Toilet ' backend/prisma/schema.prisma | head -60
```

기준:
- 현재 batchUpsert(콜백 방식) 호출 위치 (대략 line 49~139)
- Toilet 모델의 모든 필드 (id, name, address, roadAddress, lat, lng, city, district, sourceId, ... 30+ 필드)

- [ ] **Step 2.2: import 추가**

`backend/src/services/toiletSyncService.ts` 상단 import에서 `batchUpsert` 제거 또는 그대로 두고 `batchUpsertRaw` 추가:

```ts
import {
  type SyncStats,
  type SyncHistoryUpdateData,
  createSyncHistory,
  updateSyncHistory,
  createSyncStats,
  transformAndDedupe,
  batchUpsertRaw,  // ← 추가
} from './baseSyncService.js';
```

기존 `batchUpsert` import는 더 이상 사용하지 않으면 제거 (lint가 잡아줌).

- [ ] **Step 2.3: 본문 교체 — N+1 콜백을 raw rows 변환 + batchUpsertRaw로**

기존 (line 49~139 부근, 정확한 위치는 Read로 확인):

```ts
// DB Upsert (트랜잭션 래핑 + 진행 상황 추적)
console.info('Upserting to database...');
const { newCount, updateCount } = await batchUpsert(
  uniqueToilets,
  async (toilet) => {
    const existing = await prisma.toilet.findUnique({
      where: { sourceId: toilet.sourceId },
    });

    await prisma.toilet.upsert({
      where: { sourceId: toilet.sourceId },
      update: {
        name: toilet.name,
        address: toilet.address,
        // ... 30+ 필드 update ...
        syncedAt: new Date(),
      },
      create: {
        id: `toilet-${toilet.sourceId}`,
        name: toilet.name,
        // ... 30+ 필드 create ...
        sourceId: toilet.sourceId,
        // ... 나머지 ...
      },
    });

    return existing ? 'updated' : 'new';
  },
  100,
  syncHistory.id
);
```

→ 다음으로 교체:

```ts
// DB Upsert — batchUpsertRaw로 N+1 제거. exactStats=true로 통계 정확성 유지.
console.info('Upserting to database...');
const rowsForUpsert = uniqueToilets.map((t) => ({
  id: `toilet-${t.sourceId}`,
  name: t.name,
  address: t.address,
  roadAddress: t.roadAddress,
  lat: t.lat,
  lng: t.lng,
  city: t.city,
  district: t.district,
  sourceId: t.sourceId,
  operatingHours: t.operatingHours,
  maleToilets: t.maleToilets,
  maleUrinals: t.maleUrinals,
  femaleToilets: t.femaleToilets,
  hasDisabledToilet: t.hasDisabledToilet,
  openTime: t.openTime,
  managingOrg: t.managingOrg,
  phoneNumber: t.phoneNumber,
  installDate: t.installDate,
  ownershipType: t.ownershipType,
  sewageTreatment: t.sewageTreatment,
  hasEmergencyBell: t.hasEmergencyBell,
  emergencyBellLocation: t.emergencyBellLocation,
  hasCCTV: t.hasCCTV,
  hasDiaperChangingTable: t.hasDiaperChangingTable,
  diaperChangingLocation: t.diaperChangingLocation,
  maleDisabledToilets: t.maleDisabledToilets,
  maleDisabledUrinals: t.maleDisabledUrinals,
  maleChildToilets: t.maleChildToilets,
  maleChildUrinals: t.maleChildUrinals,
  femaleDisabledToilets: t.femaleDisabledToilets,
  femaleChildToilets: t.femaleChildToilets,
  remodelingDate: t.remodelingDate,
  facilityType: t.facilityType,
  legalBasis: t.legalBasis,
  govCode: t.govCode,
  dataDate: t.dataDate,
  createdAt: new Date(),  // SKIP_UPDATE_COLS에 포함 → update 시 보호됨
  updatedAt: new Date(),  // ON DUPLICATE 시 NOW()로 자동 갱신
  syncedAt: new Date(),
}));

const { newCount, updateCount } = await batchUpsertRaw(
  'Toilet',
  rowsForUpsert,
  100,
  syncHistory.id,
  { exactStats: true, uniqueKey: 'sourceId' }
);
```

**중요**: 컬럼 목록은 schema.prisma의 Toilet 모델과 정확히 일치해야 함. 누락 시 NULL 허용/거부에 따라 INSERT 실패 가능. Read로 모델 확인 후 위 변환에서 빠진 필드 추가.

- [ ] **Step 2.4: 잔존 prisma.toilet.upsert / findUnique 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'prisma\.toilet\.upsert\|prisma\.toilet\.findUnique\|batchUpsert\b' backend/src/services/toiletSyncService.ts
```

Expected: `(no output)` — 모두 제거됨. `batchUpsertRaw` 1건만 남아야 함.

- [ ] **Step 2.5: dev에서 dry-run으로 컬럼 매핑 검증 (선택, 권장)**

소량 sync로 실행하여 INSERT 실패 없는지 확인:

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
# 작은 CSV 또는 첫 100건만 처리하는 dry-run 옵션이 있으면 사용
# 없으면 단순 vitest 회귀로 충분
```

생략 가능. 다음 step의 vitest 회귀로 대체.

- [ ] **Step 2.6: lint + vitest**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
npm run lint
npx vitest run
```

Expected: lint 0 error. vitest PASS. toilet sync 관련 기존 test가 `prisma.toilet.upsert` mock에 의존했다면 갱신 필요 — 깨진 test 파일을 `prisma.$executeRawUnsafe` 또는 `batchUpsertRaw` mock으로 교체.

- [ ] **Step 2.7: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/toiletSyncService.ts
git commit -m "feat(sync): toiletSyncService N+1 제거 (batchUpsertRaw + exactStats)

건당 findUnique + upsert (2 쿼리/건) → batchUpsertRaw 단일 SQL.
3,000건 기준 ~6,000 쿼리 → ~60 쿼리 (100배 절감).
exactStats: true로 SyncHistory new/updated 통계 정확성 유지.

Spec: docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md 섹션 6"
```

---

## Task 3: `childcareSyncService` 리팩터

**Files:**
- Modify: `backend/src/services/childcareSyncService.ts`

Task 2와 **동일한 패턴**. 단, 컬럼 목록은 `Childcare` 모델 따라감. 

- [ ] **Step 3.1: 현 코드 + Childcare 모델 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'batchUpsert\|prisma\.childcare' backend/src/services/childcareSyncService.ts | head -10
grep -A 60 'model Childcare ' backend/prisma/schema.prisma | head -70
```

- [ ] **Step 3.2: import 갱신** (Task 2의 Step 2.2와 동일 패턴)

`import { ..., batchUpsertRaw }` 추가, 안 쓰는 `batchUpsert` 제거.

- [ ] **Step 3.3: 본문 교체** — Task 2 Step 2.3 패턴 그대로 적용. `t` → `c`(childcare) 같은 변수명만 다르고 구조 동일:

```ts
const rowsForUpsert = uniqueChildcares.map((c) => ({
  id: `childcare-${c.sourceId}`,
  name: c.name,
  // ... Childcare 모델 모든 필드 ...
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
}));

const { newCount, updateCount } = await batchUpsertRaw(
  'Childcare',
  rowsForUpsert,
  100,
  syncHistory.id,
  { exactStats: true, uniqueKey: 'sourceId' }
);
```

- [ ] **Step 3.4: 잔존 + lint + vitest**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'prisma\.childcare\.upsert\|prisma\.childcare\.findUnique\|batchUpsert\b' backend/src/services/childcareSyncService.ts
# Expected: 잔존 0
cd backend && npm run lint && npx vitest run
```

- [ ] **Step 3.5: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/childcareSyncService.ts
git commit -m "feat(sync): childcareSyncService N+1 제거 (batchUpsertRaw + exactStats)

toilet과 동일 패턴 — Childcare 모델로 변환 + batchUpsertRaw."
```

---

## Task 4: `marketSyncService` 리팩터

**Files:** `backend/src/services/marketSyncService.ts`

Task 3과 동일 절차. 모델 = `Market`. 컬럼 목록은 schema.prisma의 Market 모델 따라감.

- [ ] **Step 4.1**: 현 코드 + Market 모델 확인 (grep + 모델 dump)
- [ ] **Step 4.2**: import 갱신
- [ ] **Step 4.3**: 본문 교체 — `'Market'`, `rowsForUpsert = uniqueMarkets.map((m) => ({ id: \`market-${m.sourceId}\`, ... }))`
- [ ] **Step 4.4**: 잔존 + lint + vitest
- [ ] **Step 4.5**: Commit `feat(sync): marketSyncService N+1 제거 (batchUpsertRaw + exactStats)`

---

## Task 5: `sportsSyncService` 리팩터

**Files:** `backend/src/services/sportsSyncService.ts`

Task 4와 동일 절차. 모델 = `Sports`. 컬럼 목록은 schema.prisma의 Sports 모델 따라감.

- [ ] **Step 5.1**: 현 코드 + Sports 모델 확인
- [ ] **Step 5.2**: import 갱신
- [ ] **Step 5.3**: 본문 교체 — `'Sports'`, `rowsForUpsert = uniqueSports.map((s) => ({ id: \`sports-${s.sourceId}\`, ... }))`
- [ ] **Step 5.4**: 잔존 + lint + vitest
- [ ] **Step 5.5**: Commit `feat(sync): sportsSyncService N+1 제거 (batchUpsertRaw + exactStats)`

---

## Task 6: `evChargerSyncService` 리팩터 (마지막)

**Files:** `backend/src/services/evChargerSyncService.ts`

**가장 큰 변경** — 49만건이 대상이라 회귀 위험·이득 모두 최대. commit 마지막에 둬서 git bisect로 즉시 원인 식별 가능.

- [ ] **Step 6.1: 현 코드 + EvCharger 모델 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'batchUpsert\|prisma\.evCharger\|findUnique' backend/src/services/evChargerSyncService.ts | head -10
grep -A 50 'model EvCharger ' backend/prisma/schema.prisma | head -60
```

EvCharger 모델 주의점:
- `sourceId @unique` 값은 이미 `statId-chgerId` 합성 (transform 단계에서 처리됨, 확인됨)
- 컬럼 다수: id, name, address, roadAddress, lat, lng, city, district, bjdCode, sourceId, sourceUrl, viewCount, createdAt, updatedAt, syncedAt, statId, chgerId, chgerType, addrDetail, location, useTime, busiId, bnm, busiNm, busiCall, stat, statUpdDt, lastTsdt, ...

- [ ] **Step 6.2**: import 갱신
- [ ] **Step 6.3: 본문 교체** — `'EvCharger'`. 변수명은 `ev` 또는 `c`(charger). 

```ts
const rowsForUpsert = uniqueChargers.map((c) => ({
  id: `evcharger-${c.sourceId}`,  // 또는 기존 코드 컨벤션 따라감
  name: c.name,
  // ... EvCharger 모델 모든 필드 ...
  createdAt: new Date(),
  updatedAt: new Date(),
  syncedAt: new Date(),
}));

const { newCount, updateCount } = await batchUpsertRaw(
  'EvCharger',
  rowsForUpsert,
  100,
  syncHistory.id,
  { exactStats: true, uniqueKey: 'sourceId' }
);
```

**주의**: id prefix는 기존 코드의 컨벤션 따라가야 함 (Read로 기존 create 블록 확인 후 동일하게).

- [ ] **Step 6.4**: 잔존 + lint + vitest

```bash
cd /Users/leemyeongseok/projects/ilsangkit
grep -n 'prisma\.evCharger\.upsert\|prisma\.evCharger\.findUnique\|batchUpsert\b' backend/src/services/evChargerSyncService.ts
# Expected: 잔존 0
cd backend && npm run lint && npx vitest run
```

- [ ] **Step 6.5**: Commit

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/evChargerSyncService.ts
git commit -m "feat(sync): evChargerSyncService N+1 제거 (batchUpsertRaw + exactStats)

49만건 대상 — 사이클당 ~98만 쿼리 → ~9.8k 쿼리 (10~40× 가속 예상).
exactStats로 SyncHistory 통계 정확성 유지.
sourceId는 transformEvChargerRow에서 이미 'statId-chgerId' 합성됨 (변경 없음).

Phase 3 마지막 commit — 회귀 발생 시 git bisect로 즉시 원인 식별 가능."
```

---

## Task 7: 전체 회귀 + PR 생성

- [ ] **Step 7.1: backend + frontend lint + test 병렬**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
(cd backend && npm run lint && npx vitest run) &
(cd frontend && npm run lint && npx vitest run) &
wait
```

Expected: 둘 다 0 exit. backend ≈1189 tests, frontend 1054 tests PASS.

- [ ] **Step 7.2: Commit 그래프 확인 (6 commit)**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git log --oneline develop..HEAD
```

Expected (역순):
```
<sha> feat(sync): evChargerSyncService N+1 제거 (batchUpsertRaw + exactStats)
<sha> feat(sync): sportsSyncService N+1 제거 (batchUpsertRaw + exactStats)
<sha> feat(sync): marketSyncService N+1 제거 (batchUpsertRaw + exactStats)
<sha> feat(sync): childcareSyncService N+1 제거 (batchUpsertRaw + exactStats)
<sha> feat(sync): toiletSyncService N+1 제거 (batchUpsertRaw + exactStats)
<sha> feat(sync): batchUpsertRaw에 exactStats 옵션 추가
```

- [ ] **Step 7.3: Push + PR 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin HEAD
gh pr create --base develop --title "feat(sync): 5개 facility sync N+1 제거 (Phase 3)" --body "$(cat <<'EOF'
## 요약

5개 facility sync(toilet/childcare/market/sports/ev-charger)의 건당 \`findUnique + upsert\` N+1 패턴을 기존 \`batchUpsertRaw\` 단일 SQL로 교체. 사이클당 ~99만 쿼리 → ~9.9k(99% 절감), sync wall-time 10~40× 가속.

Spec: \`docs/superpowers/specs/2026-05-27-p0-perf-stability-design.md\` 섹션 6 (로컬)
Plan: \`docs/superpowers/plans/2026-05-28-phase3-sync-n-plus-one.md\` (로컬)

## 변경

| sync | 건수 | 현 쿼리 | 변경 후 |
|---|---:|---:|---:|
| ev-charger | ~490k | ~980k | ~9.8k |
| toilet | ~3k | ~6k | ~60 |
| childcare | ~1k | ~2k | ~20 |
| market | ~1k | ~2k | ~20 |
| sports | ~0.8k | ~1.6k | ~16 |

## 신규 옵션

- \`batchUpsertRaw\`에 \`exactStats: true\` 옵션 — 배치당 1 SELECT 추가로 new/updated 정확 집계 (기존 ROW_COUNT 휴리스틱은 '동일 값 재입력'에서 부정확).
- 기존 호출자(부동산 sync)는 옵션 미지정 → 동작 변경 없음 (비파괴).

## 변경하지 않은 것

- 부동산 sync (이미 batchUpsertRaw 사용 중)
- clothes/library/parking/park/school/subway sync (동일 N+1 패턴이지만 1k 안팎이라 본 PR scope 밖, 사용자 합의로 spec scope 유지)
- SyncHistory·SyncStatus 모델 (변경 없음)
- 좀비 인시던트 대응 (별 spec)
- 사용자 노출 코드 (sync는 백오피스 cron 작업)

## 로컬 검증

- backend lint 0 / vitest PASS (≈1189 tests, exactStats integration test 3건 신규)
- frontend lint 0 / vitest PASS (≈1054 tests)

## 측정 게이트 (머지 후)

| 시점 | 지표 | 임계 |
|---|---|---|
| 머지 직후 | toilet/childcare/market/sports sync wall-time | 10× 이상 단축 |
| ev-charger 1회 수동 | wall-time, MySQL CPU 피크 | 수십분→수분, CPU<50% |
| 1주 자동 sync 후 | SyncHistory.newRecords + updatedRecords + skippedRecords = totalRecords | 정확 일치 |
| 1주 | MySQL slow query log | 100ms 초과 쿼리 감소 |

## 롤백

\`git revert <merge-sha>\` 한 번으로 6 commit 모두 환원 → 다음 sync 사이클부터 원래 코드. **이미 DB에 들어간 데이터는 보존됨** (upsert는 멱등). commit별 git bisect로 회귀 원인 즉시 식별 가능.
EOF
)"
```

- [ ] **Step 7.4: CI 통과 대기**

```bash
gh pr checks <PR번호> --watch
```

성공 후 사용자 보고.

- [ ] **Step 7.5: 머지·배포는 사용자 결정**

CI 통과 + 사용자 승인 후 develop 머지 → develop→main PR → 머지 → deploy. Phase 1·2와 동일 절차. backend-only PR이라 prod 사용자 영향 0이지만 새 코드가 다음 sync 사이클(보통 야간/주간 cron)에 실행됨 — 머지 직후 첫 sync 결과 점검 권장.

---

## Self-Review 체크리스트 (실행자가 PR 올리기 전 마지막 점검)

- [ ] `batchUpsertRaw` `exactStats` 옵션이 기존 호출자(부동산 sync) 동작을 깨지 않는가
- [ ] Vitest integration test 3건 모두 PASS (실 MySQL 컨테이너 사용)
- [ ] 5개 sync 서비스 모두에서 `prisma.<model>.upsert` / `findUnique` / `batchUpsert\b` 잔존 0
- [ ] 각 sync의 변환된 row 필드가 schema.prisma 모델과 정확히 일치 (누락 시 NULL 위반)
- [ ] timestamp 컬럼(`createdAt`, `updatedAt`, `syncedAt`) 명시적 주입
- [ ] id prefix 컨벤션 (toilet-, childcare-, market-, sports-, evcharger-) 기존 코드와 동일
- [ ] backend·frontend lint + test 모두 PASS
- [ ] Commit 6개로 분해 (Task 1~6)
- [ ] PR description에 측정 게이트 + 롤백 절차 명시
