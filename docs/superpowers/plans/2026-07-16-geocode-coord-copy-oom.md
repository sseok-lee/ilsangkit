# 지오코딩 좌표 복사 OOM 지혈 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 야간 부동산 지오코딩이 좌표를 이미 가진 605만 행을 Node 힙에 적재해 운영 mysqld를 OOM으로 죽이는 것을 멈춘다.

**Architecture:** `geocodeRealEstate.ts`의 세 함수가 Prisma `distinct`에 의존하는데, 이 옵션은 MySQL에서 SQL로 내려가지 않고 앱 메모리에서 수행된다. 구동 방향을 뒤집어 "좌표를 가진 605만 행"이 아니라 "좌표가 없는 수천 건"에서 출발한다. 대상 건물 목록은 `$queryRawUnsafe`의 `SELECT DISTINCT`(인덱스 순서 스캔, 실측 5초)로, 상세 필드와 seed 좌표는 건물별 `findFirst`(인덱스 적중)로 얻는다.

**Tech Stack:** TypeScript (ESM), Prisma 6.19, MySQL 8, Vitest

**스펙:** `docs/superpowers/specs/2026-07-16-geocode-coord-copy-oom-design.md`

## Global Constraints

- **Node 20 필수.** 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`.
- **`package-lock.json`을 삭제 후 재생성하지 말 것.** 이 작업은 새 의존성이 없다.
- **ESM:** 모든 로컬 import에 `.js` 확장자 필수.
- **PR 기반:** `develop`에서 분기, `develop`으로 PR. `main` 직접 커밋 금지.
- **동작 불변:** 카카오 API 호출 로직, `buildSearchQuery`, `cleanBuildingName`, `geocodeBuilding`, `updateBuildingCoordinates`, `markGeocodeAttempted`, `GEOCODE_RETRY_DAYS`(30), `SIBLING_TABLE` 매핑, `processTable`의 호출 순서 — 전부 그대로 둔다.
- **공개 시그니처 불변:** `getUniqueBuildings`/`copyCoordsWithinTable`/`copyCoordsFromSibling`의 파라미터와 반환 타입은 바뀌지 않는다.
- 테스트 실행: `cd backend && npx vitest run __tests__/scripts/geocodeRealEstate.test.ts`

---

### Task 1: SQL 테이블명 매핑 + 대상 건물 조회 헬퍼

`RealEstateTable`은 Prisma 델리게이트명(`aptSaleTransaction`)이고 SQL 테이블명은 `AptSaleTransaction`이다. raw SQL을 쓰려면 명시적 매핑이 필요하다. 기존 `realEstateService.ts`의 `TABLE_NAME_MAP`은 슬러그(`apt-sale`) 기준이라 재사용할 수 없다.

**Files:**
- Modify: `backend/src/scripts/geocodeRealEstate.ts` (`SIBLING_TABLE` 정의 뒤, 약 58행 이후)
- Test: `backend/__tests__/scripts/geocodeRealEstate.test.ts`

**Interfaces:**
- Consumes: 기존 `RealEstateTable` 유니온 타입, `REAL_ESTATE_TABLES` 배열
- Produces:
  - `SQL_TABLE_NAME: Record<RealEstateTable, string>`
  - `getBuildingsNeedingCoords(prisma: PrismaClient, table: RealEstateTable, retryCutoff?: Date): Promise<BuildingKey[]>`
  - `type BuildingKey = { bjdCode: string; buildingName: string }`

- [ ] **Step 1: 테스트 목에 `$queryRawUnsafe` 추가**

`__tests__/scripts/geocodeRealEstate.test.ts`의 목 정의를 수정한다. 현재 `mockFindMany`/`mockUpdateMany`만 있다.

14~15행을 다음으로 교체:

```typescript
// Mock PrismaClient
const mockFindMany = vi.fn();
const mockUpdateMany = vi.fn();
const mockFindFirst = vi.fn();
const mockQueryRawUnsafe = vi.fn();
```

17~30행의 `vi.mock('@prisma/client', ...)` 블록을 다음으로 교체:

```typescript
vi.mock('@prisma/client', () => {
  const model = () => ({
    findMany: mockFindMany,
    updateMany: mockUpdateMany,
    findFirst: mockFindFirst,
  });
  function PrismaClient() {
    return {
      aptSaleTransaction: model(),
      aptRentTransaction: model(),
      villaSaleTransaction: model(),
      villaRentTransaction: model(),
      offitelSaleTransaction: model(),
      offitelRentTransaction: model(),
      $queryRawUnsafe: mockQueryRawUnsafe,
      $disconnect: vi.fn(),
    };
  }
  return { PrismaClient };
});
```

208~218행의 `makePrisma()` 헬퍼를 다음으로 교체:

```typescript
function makePrisma() {
  const model = () => ({
    findMany: mockFindMany,
    updateMany: mockUpdateMany,
    findFirst: mockFindFirst,
  });
  return {
    aptSaleTransaction: model(),
    aptRentTransaction: model(),
    villaSaleTransaction: model(),
    villaRentTransaction: model(),
    offitelSaleTransaction: model(),
    offitelRentTransaction: model(),
    $queryRawUnsafe: mockQueryRawUnsafe,
    $disconnect: vi.fn(),
  } as unknown as import('@prisma/client').PrismaClient;
}
```

- [ ] **Step 2: 실패하는 테스트 작성**

`__tests__/scripts/geocodeRealEstate.test.ts`의 `describe('getUniqueBuildings', ...)` 블록 **앞**에 추가. import 목록(32~41행)에 `getBuildingsNeedingCoords`, `SQL_TABLE_NAME`을 추가한다.

```typescript
describe('SQL_TABLE_NAME', () => {
  it('6개 델리게이트명 전부에 SQL 테이블명이 매핑됨', () => {
    expect(SQL_TABLE_NAME.aptSaleTransaction).toBe('AptSaleTransaction');
    expect(SQL_TABLE_NAME.aptRentTransaction).toBe('AptRentTransaction');
    expect(SQL_TABLE_NAME.villaSaleTransaction).toBe('VillaSaleTransaction');
    expect(SQL_TABLE_NAME.villaRentTransaction).toBe('VillaRentTransaction');
    expect(SQL_TABLE_NAME.offitelSaleTransaction).toBe('OffitelSaleTransaction');
    expect(SQL_TABLE_NAME.offitelRentTransaction).toBe('OffitelRentTransaction');
  });
});

describe('getBuildingsNeedingCoords', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lat IS NULL 인 건물키를 SQL DISTINCT 로 조회한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '래미안아파트' },
    ]);

    const rows = await getBuildingsNeedingCoords(makePrisma(), 'aptSaleTransaction');

    expect(rows).toEqual([{ bjdCode: '1168010800', buildingName: '래미안아파트' }]);
    const sql = mockQueryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('SELECT DISTINCT');
    expect(sql).toContain('AptSaleTransaction');
    expect(sql).toContain('lat IS NULL');
  });

  it('retryCutoff 를 주면 geocodedAt 조건과 파라미터가 붙는다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const cutoff = new Date('2026-06-16T00:00:00Z');

    await getBuildingsNeedingCoords(makePrisma(), 'aptRentTransaction', cutoff);

    const [sql, param] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('geocodedAt IS NULL OR geocodedAt <');
    expect(param).toBe(cutoff);
  });

  it('retryCutoff 가 없으면 geocodedAt 조건이 없다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getBuildingsNeedingCoords(makePrisma(), 'aptRentTransaction');

    const [sql, ...params] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).not.toContain('geocodedAt');
    expect(params).toEqual([]);
  });

  it('절대로 findMany 를 쓰지 않는다 (605만 행 적재 회귀 방지)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getBuildingsNeedingCoords(makePrisma(), 'aptRentTransaction');

    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/scripts/geocodeRealEstate.test.ts
```

Expected: FAIL — `getBuildingsNeedingCoords is not a function` / `SQL_TABLE_NAME` undefined (import 실패)

- [ ] **Step 4: 최소 구현**

`backend/src/scripts/geocodeRealEstate.ts`의 `SIBLING_TABLE` 정의(58행) 뒤, `GEOCODE_RETRY_DAYS`(61행) 앞에 추가:

```typescript
/**
 * Prisma 델리게이트명 → 실제 SQL 테이블명.
 * raw SQL 에서 사용. schema.prisma 에 @@map 이 없어 모델명 = 테이블명이다.
 * realEstateService 의 TABLE_NAME_MAP 은 슬러그('apt-sale') 기준이라 재사용 불가.
 */
export const SQL_TABLE_NAME: Record<RealEstateTable, string> = {
  aptSaleTransaction: 'AptSaleTransaction',
  aptRentTransaction: 'AptRentTransaction',
  villaSaleTransaction: 'VillaSaleTransaction',
  villaRentTransaction: 'VillaRentTransaction',
  offitelSaleTransaction: 'OffitelSaleTransaction',
  offitelRentTransaction: 'OffitelRentTransaction',
};

export interface BuildingKey {
  bjdCode: string;
  buildingName: string;
}

/**
 * 좌표가 필요한 건물키만 조회.
 *
 * Prisma 의 `distinct` 는 MySQL 에서 SQL 로 내려가지 않고 앱 메모리에서 수행된다.
 * findMany 로 뽑으면 조건에 맞는 행을 전부 힙에 적재한 뒤 JS 로 줄이므로,
 * 290만 행짜리 테이블에서 수 GB 를 요구해 서버를 OOM 으로 몰았다(2026-07-16).
 * 반드시 SQL DISTINCT 로 유지할 것.
 *
 * 키 2개만 뽑으면 <table>_bjdCode_buildingName_idx 를 순서대로 훑어 정렬·중복
 * 제거가 공짜다(EXPLAIN type=index, 로컬 실측 5초). 주소 컬럼을 얹는 순간 그
 * 인덱스가 무용해져 풀스캔+filesort 로 떨어진다(EXPLAIN type=ALL, key=NULL).
 * 커버링 인덱스는 아니다 — lat 이 인덱스에 없어 행 조회가 뒤따른다.
 */
export async function getBuildingsNeedingCoords(
  prisma: PrismaClient,
  table: RealEstateTable,
  retryCutoff?: Date,
): Promise<BuildingKey[]> {
  const sqlTable = SQL_TABLE_NAME[table];
  if (retryCutoff) {
    return prisma.$queryRawUnsafe<BuildingKey[]>(
      `SELECT DISTINCT bjdCode, buildingName FROM \`${sqlTable}\`
       WHERE lat IS NULL AND (geocodedAt IS NULL OR geocodedAt < ?)`,
      retryCutoff,
    );
  }
  return prisma.$queryRawUnsafe<BuildingKey[]>(
    `SELECT DISTINCT bjdCode, buildingName FROM \`${sqlTable}\` WHERE lat IS NULL`,
  );
}
```

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run __tests__/scripts/geocodeRealEstate.test.ts
```

Expected: PASS — 신규 5개 포함 전부 통과. 기존 `getUniqueBuildings` 테스트 2개도 아직 통과해야 한다(이 태스크에서는 구현을 바꾸지 않았으므로).

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull
git checkout -b fix/geocode-coord-copy-oom
git add backend/src/scripts/geocodeRealEstate.ts backend/__tests__/scripts/geocodeRealEstate.test.ts
git -c commit.gpgsign=false commit -m "feat(geocode): 좌표 필요 건물키를 SQL DISTINCT 로 조회하는 헬퍼 추가

Prisma 의 distinct 는 MySQL 에서 SQL 로 내려가지 않고 앱 메모리에서 돈다.
후속 커밋에서 copyCoords*/getUniqueBuildings 가 이 헬퍼로 옮겨간다."
```

---

### Task 2: `copyCoordsWithinTable` / `copyCoordsFromSibling` 방향 반전

두 함수는 `lat IS NOT NULL` 인 행을 **전부** 적재한다(운영 aptRent 319만 행). 실제 대상은 수천 건이다. 이것이 OOM의 직접 원인이다.

**Files:**
- Modify: `backend/src/scripts/geocodeRealEstate.ts:256-318`
- Test: `backend/__tests__/scripts/geocodeRealEstate.test.ts`

**Interfaces:**
- Consumes: Task 1의 `getBuildingsNeedingCoords`, `BuildingKey`
- Produces: `copyCoordsWithinTable`/`copyCoordsFromSibling` — 시그니처 불변 `(prisma, table) => Promise<number>`

- [ ] **Step 1: 실패하는 테스트 작성**

import 목록에 `copyCoordsWithinTable`, `copyCoordsFromSibling`을 추가하고, `describe('updateBuildingCoordinates', ...)` 블록 뒤에 추가:

```typescript
describe('copyCoordsWithinTable', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('좌표 필요 행이 없으면 소스 테이블을 조회조차 하지 않는다 (OOM 회귀 방지)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    const copied = await copyCoordsWithinTable(makePrisma(), 'aptRentTransaction');

    expect(copied).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('대상 건물의 seed 좌표를 같은 테이블에서 찾아 복사한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '래미안아파트' },
    ]);
    mockFindFirst.mockResolvedValue({ lat: 37.498, lng: 127.0276 });
    mockUpdateMany.mockResolvedValue({ count: 3 });

    const copied = await copyCoordsWithinTable(makePrisma(), 'aptSaleTransaction');

    expect(copied).toBe(3);
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { bjdCode: '1168010800', buildingName: '래미안아파트', lat: { not: null } },
      select: { lat: true, lng: true },
    });
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: { bjdCode: '1168010800', buildingName: '래미안아파트', lat: null },
      data: { lat: 37.498, lng: 127.0276, geocodedAt: expect.any(Date) },
    });
  });

  it('seed 가 없는 건물은 건너뛰고 업데이트하지 않는다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '좌표없는빌라' },
    ]);
    mockFindFirst.mockResolvedValue(null);

    const copied = await copyCoordsWithinTable(makePrisma(), 'villaSaleTransaction');

    expect(copied).toBe(0);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it('절대로 findMany 를 쓰지 않는다 (319만 행 적재 회귀 방지)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '래미안아파트' },
    ]);
    mockFindFirst.mockResolvedValue({ lat: 37.498, lng: 127.0276 });
    mockUpdateMany.mockResolvedValue({ count: 1 });

    await copyCoordsWithinTable(makePrisma(), 'aptRentTransaction');

    expect(mockFindMany).not.toHaveBeenCalled();
  });
});

describe('copyCoordsFromSibling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('형제 테이블이 없으면 0 을 반환하고 아무것도 조회하지 않는다', async () => {
    const copied = await copyCoordsFromSibling(makePrisma(), 'landSaleTransaction' as never);

    expect(copied).toBe(0);
    expect(mockQueryRawUnsafe).not.toHaveBeenCalled();
  });

  it('좌표 필요 행이 없으면 형제 테이블을 조회조차 하지 않는다 (OOM 회귀 방지)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    const copied = await copyCoordsFromSibling(makePrisma(), 'aptRentTransaction');

    expect(copied).toBe(0);
    expect(mockFindMany).not.toHaveBeenCalled();
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('대상 건물 목록은 대상 테이블 기준, seed 는 형제 테이블에서 읽는다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '래미안아파트' },
    ]);
    mockFindFirst.mockResolvedValue({ lat: 37.498, lng: 127.0276 });
    mockUpdateMany.mockResolvedValue({ count: 2 });

    const copied = await copyCoordsFromSibling(makePrisma(), 'aptRentTransaction');

    expect(copied).toBe(2);
    // 대상 건물 조회 SQL 은 대상 테이블(AptRentTransaction) 기준
    expect(mockQueryRawUnsafe.mock.calls[0][0]).toContain('AptRentTransaction');
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { bjdCode: '1168010800', buildingName: '래미안아파트', lat: { not: null } },
      select: { lat: true, lng: true },
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/scripts/geocodeRealEstate.test.ts
```

Expected: FAIL — "좌표 필요 행이 없으면 소스 테이블을 조회조차 하지 않는다"가 `mockFindMany`가 호출되어 실패. 현재 구현이 `findMany`부터 부르기 때문.

- [ ] **Step 3: 최소 구현**

`geocodeRealEstate.ts:256-318`의 두 함수를 통째로 교체:

```typescript
/**
 * 대상 건물들의 좌표를 seedTable 에서 찾아 채운다.
 *
 * 구동 방향에 주의: 반드시 '좌표가 없는 건물'(수천 건)에서 출발한다.
 * '좌표가 있는 행'(수백만)에서 출발하면 힙이 터진다.
 */
async function copyCoordsFor(
  prisma: PrismaClient,
  table: RealEstateTable,
  seedTable: RealEstateTable,
  targets: BuildingKey[],
): Promise<number> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[table];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const seedModel = (prisma as any)[seedTable];

  let totalCopied = 0;
  for (const target of targets) {
    const seed = await seedModel.findFirst({
      where: { bjdCode: target.bjdCode, buildingName: target.buildingName, lat: { not: null } },
      select: { lat: true, lng: true },
    });
    if (!seed) continue;

    const res = await model.updateMany({
      where: { bjdCode: target.bjdCode, buildingName: target.buildingName, lat: null },
      data: { lat: seed.lat, lng: seed.lng, geocodedAt: new Date() },
    });
    totalCopied += res.count;
  }
  return totalCopied;
}

/**
 * 같은 테이블 내에서 이미 좌표가 있는 건물의 좌표를 복사해 null row 채우기
 * — 카카오 API 호출 없이 '알려진 건물' 해결
 */
export async function copyCoordsWithinTable(
  prisma: PrismaClient,
  table: RealEstateTable,
): Promise<number> {
  const targets = await getBuildingsNeedingCoords(prisma, table);
  if (targets.length === 0) return 0;
  return copyCoordsFor(prisma, table, table, targets);
}

/**
 * 쌍 테이블 (매매 ↔ 전월세) 에서 좌표 복사
 * 예: aptSale 에서 "래미안강남" 좌표 있으면 aptRent 의 같은 건물 null row에 채움
 */
export async function copyCoordsFromSibling(
  prisma: PrismaClient,
  table: RealEstateTable,
): Promise<number> {
  const sibling = SIBLING_TABLE[table];
  if (!sibling) return 0;

  const targets = await getBuildingsNeedingCoords(prisma, table);
  if (targets.length === 0) return 0;
  return copyCoordsFor(prisma, table, sibling, targets);
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run __tests__/scripts/geocodeRealEstate.test.ts
```

Expected: PASS — 신규 7개 포함 전부 통과.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/scripts/geocodeRealEstate.ts backend/__tests__/scripts/geocodeRealEstate.test.ts
git -c commit.gpgsign=false commit -m "fix(geocode): 좌표 복사의 구동 방향을 반전해 OOM 제거

copyCoordsWithinTable/FromSibling 이 lat IS NOT NULL 인 행을 전부 힙에
적재했다(운영 aptRent 319만 행). 실제 대상은 수천 건이다. 행당 1.5KB 로
4.8GB 를 요구해 RAM 3GB 서버의 스왑을 고갈시켰고, OOM killer 가 그 시점
최대 RSS 인 mysqld 를 죽였다(2026-07-15/16 새벽 연속 발생).

좌표가 없는 쪽에서 출발하도록 뒤집는다. 결과는 동일하다."
```

---

### Task 3: `getUniqueBuildings` 2단계 조회 전환

같은 병이다. 현재 운영 7,686행이라 치명적이진 않지만, sync 직후에는 월 유입량(aptRent 6~8만 건)만큼 부풀어 오른다.

**Files:**
- Modify: `backend/src/scripts/geocodeRealEstate.ts:197-222`
- Test: `backend/__tests__/scripts/geocodeRealEstate.test.ts:220-256` (기존 테스트 교체)

**Interfaces:**
- Consumes: Task 1의 `getBuildingsNeedingCoords`, `BuildingKey`
- Produces: `getUniqueBuildings` — 시그니처·반환 타입 불변 `(prisma, table) => Promise<UniqueBuilding[]>`

- [ ] **Step 1: 기존 테스트를 새 동작으로 교체**

`describe('getUniqueBuildings', ...)` 블록(220~256행)을 통째로 교체한다. 기존 테스트는 `distinct: ['buildingName','bjdCode']` 인자를 직접 단언하므로 반드시 없어져야 한다.

```typescript
describe('getUniqueBuildings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('대상 건물키를 SQL DISTINCT 로 뽑고 건물별 주소를 한 행에서 읽는다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '래미안아파트' },
      { bjdCode: '1168010900', buildingName: '현대아파트' },
    ]);
    mockFindFirst
      .mockResolvedValueOnce({ buildingName: '래미안아파트', bjdCode: '1168010800', city: '서울특별시', district: '강남구', dongName: '역삼동', roadName: '강남대로 123', jibun: '123-4' })
      .mockResolvedValueOnce({ buildingName: '현대아파트', bjdCode: '1168010900', city: '서울특별시', district: '강남구', dongName: '삼성동', roadName: null, jibun: null });

    const buildings = await getUniqueBuildings(makePrisma(), 'aptSaleTransaction');

    expect(buildings).toHaveLength(2);
    expect(buildings[0].buildingName).toBe('래미안아파트');
    expect(buildings[1].dongName).toBe('삼성동');
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { bjdCode: '1168010800', buildingName: '래미안아파트', lat: null },
      select: { buildingName: true, bjdCode: true, city: true, district: true, dongName: true, roadName: true, jibun: true },
    });
  });

  it('GEOCODE_RETRY_DAYS(30일) 컷오프를 SQL 파라미터로 넘긴다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);
    const before = Date.now();

    await getUniqueBuildings(makePrisma(), 'aptSaleTransaction');

    const [sql, cutoff] = mockQueryRawUnsafe.mock.calls[0];
    expect(sql).toContain('geocodedAt IS NULL OR geocodedAt <');
    const expected = before - 30 * 24 * 60 * 60 * 1000;
    expect(Math.abs((cutoff as Date).getTime() - expected)).toBeLessThan(5000);
  });

  it('결과가 없으면 빈 배열 반환', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    const buildings = await getUniqueBuildings(makePrisma(), 'aptSaleTransaction');

    expect(buildings).toEqual([]);
    expect(mockFindFirst).not.toHaveBeenCalled();
  });

  it('행이 사라진 건물은 결과에서 제외한다', async () => {
    mockQueryRawUnsafe.mockResolvedValue([
      { bjdCode: '1168010800', buildingName: '사라진건물' },
    ]);
    mockFindFirst.mockResolvedValue(null);

    const buildings = await getUniqueBuildings(makePrisma(), 'aptSaleTransaction');

    expect(buildings).toEqual([]);
  });

  it('절대로 findMany 를 쓰지 않는다 (인메모리 distinct 회귀 방지)', async () => {
    mockQueryRawUnsafe.mockResolvedValue([]);

    await getUniqueBuildings(makePrisma(), 'aptSaleTransaction');

    expect(mockFindMany).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
npx vitest run __tests__/scripts/geocodeRealEstate.test.ts
```

Expected: FAIL — 현재 구현이 `findMany`를 부르므로 "절대로 findMany 를 쓰지 않는다"와 "대상 건물키를 SQL DISTINCT 로 뽑고..."가 실패.

- [ ] **Step 3: 최소 구현**

`geocodeRealEstate.ts:197-222`의 `getUniqueBuildings`를 교체:

```typescript
/**
 * 좌표 보강 대상 건물 목록.
 *
 * 2단계 조회:
 *  1) SELECT DISTINCT bjdCode, buildingName — 인덱스 순서 스캔(실측 5초).
 *  2) 건물별 findFirst 로 주소 필드를 **한 행에서** 읽는다.
 *
 * 주소를 1)에 합치면 인덱스가 무용해져 풀스캔+filesort 가 되고(EXPLAIN
 * type=ALL), MIN()/ANY_VALUE() 로 뽑으면 서로 다른 행의 roadName 과 jibun 이
 * 섞여 존재하지 않는 주소가 만들어진다.
 */
export async function getUniqueBuildings(
  prisma: PrismaClient,
  table: RealEstateTable
): Promise<UniqueBuilding[]> {
  const retryCutoff = new Date(Date.now() - GEOCODE_RETRY_DAYS * 24 * 60 * 60 * 1000);
  const targets = await getBuildingsNeedingCoords(prisma, table, retryCutoff);
  if (targets.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const model = (prisma as any)[table];
  const buildings: UniqueBuilding[] = [];
  for (const target of targets) {
    const row = await model.findFirst({
      where: { bjdCode: target.bjdCode, buildingName: target.buildingName, lat: null },
      select: {
        buildingName: true,
        bjdCode: true,
        city: true,
        district: true,
        dongName: true,
        roadName: true,
        jibun: true,
      },
    });
    if (row) buildings.push(row as UniqueBuilding);
  }
  return buildings;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run __tests__/scripts/geocodeRealEstate.test.ts
```

Expected: PASS — 전부 통과.

- [ ] **Step 5: 백엔드 전체 테스트 + 린트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run
npm run lint
npm run build
```

Expected: 전부 통과. 기존 실패 테스트가 있으면 즉시 고친다.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/scripts/geocodeRealEstate.ts backend/__tests__/scripts/geocodeRealEstate.test.ts
git -c commit.gpgsign=false commit -m "fix(geocode): getUniqueBuildings 도 2단계 조회로 전환

같은 인메모리 distinct 문제. 운영 7,686행이라 아직 치명적이진 않으나
sync 직후엔 월 유입량(aptRent 6~8만)만큼 부풀어 오른다.

주소는 건물별 findFirst 로 한 행에서 읽어 roadName/jibun 이 서로 다른
행에서 섞이지 않게 한다."
```

---

### Task 4: 실측 검증 및 PR

코드가 맞다는 것과 메모리가 실제로 줄었다는 것은 다른 문제다. 스펙의 검증 항목을 실행한다.

**Files:**
- Create: (임시) `backend/verify-geocode-mem.ts` — 측정 후 삭제, 커밋하지 않음

> **주의:** 이 측정은 `copyCoordsWithinTable`을 실제로 호출하므로 **로컬 DB에 쓴다**
> (좌표 없는 행에 좌표를 채움). 로컬 개발 DB 전용이며 운영 DB에 절대 연결하지 말 것.
> `backend/.env`의 `DATABASE_URL`이 `localhost:3307`을 가리키는지 먼저 확인한다.

- [ ] **Step 1: 로컬 DB 기동 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
docker compose up -d
docker compose exec -T mysql mysql -uilsangkit -pilsangkit123 ilsangkit -e "SELECT COUNT(*) FROM OffitelSaleTransaction;"
```

Expected: 약 98,441행. (0이면 로컬 DB가 비어 있으니 이 태스크의 측정은 건너뛰고 Step 5로 간다.)

- [ ] **Step 2: 측정 스크립트 작성**

`backend/verify-geocode-mem.ts` (실행 후 삭제):

```typescript
import { PrismaClient } from '@prisma/client';
import { getBuildingsNeedingCoords, copyCoordsWithinTable } from './src/scripts/geocodeRealEstate.js';

const prisma = new PrismaClient();
let peak = 0;
const t = setInterval(() => { peak = Math.max(peak, process.memoryUsage().rss); }, 20);

const t0 = Date.now();
const targets = await getBuildingsNeedingCoords(prisma, 'offitelSaleTransaction');
const tDistinct = Date.now() - t0;

const t1 = Date.now();
const copied = await copyCoordsWithinTable(prisma, 'offitelSaleTransaction');
const tCopy = Date.now() - t1;

clearInterval(t);
console.log(`대상 건물: ${targets.length}건`);
console.log(`SELECT DISTINCT: ${tDistinct}ms`);
console.log(`copyCoordsWithinTable: ${tCopy}ms, ${copied}건 복사`);
console.log(`피크 RSS: ${Math.round(peak / 1048576)} MB   (변경 전 기준값: 219 MB)`);
await prisma.$disconnect();
```

- [ ] **Step 3: 측정 실행**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx tsx verify-geocode-mem.ts
```

Expected: 피크 RSS가 219MB보다 **현저히 낮아야 한다**(수십 MB 수준). `SELECT DISTINCT`는 수 초 이내.

**측정값이 219MB 근처면 멈추고 보고할 것** — 방향 반전이 실제로 적용되지 않았다는 뜻이다.

- [ ] **Step 4: 측정 스크립트 삭제**

```bash
rm backend/verify-geocode-mem.ts
```

- [ ] **Step 5: PR 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git push -u origin fix/geocode-coord-copy-oom
gh pr create --base develop --title "fix(geocode): 좌표 복사 OOM 지혈 — 인메모리 distinct 제거" --body "$(cat <<'EOF'
## 문제

운영 사이트가 매일 새벽 OOM으로 죽고 있다. `dmesg` 실측:

```
[Thu Jul 16 04:50:42 2026] Free swap  = 0kB
[Thu Jul 16 04:50:42 2026] Out of memory: Killed process 781890 (mysqld)
[Thu Jul 16 04:55:55 2026] Out of memory: Killed process 845756 (node) anon-rss:2,078,296kB
```

mysqld uptime 8.1시간이 OOM 킬 시각과 일치한다. pm2 재시작 backend 210회 / frontend 1,647회.

## 원인

`geocodeRealEstate.ts`의 세 함수가 Prisma `distinct`에 의존하는데, **이 옵션은 MySQL에서 SQL로 내려가지 않고 앱 메모리에서 수행된다.** 생성 SQL에 `DISTINCT`가 없고 `select`에 없는 `id`가 딸려 나오는 것으로 확인했다.

즉 `lat IS NOT NULL`인 행을 전부 힙에 적재한 뒤 JS로 줄인다.

| 테이블 | 적재되는 행 | 실제 대상 |
|---|---:|---:|
| aptRent | 2,901,721 | 5 |
| aptSale | 1,343,578 | 481 |
| (6개 합계) | **6,051,037** | **776** |

운영은 더 크다 — aptRent 좌표없음 7,686 / 좌표있음 **3,187,040**. 행당 1.5KB로 약 4.8GB를 요구한다. 서버 RAM은 3GB. 스왑이 0이 될 때까지 밀어붙이다가 OOM killer가 그 시점 최대 RSS인 mysqld를 죽인다.

## 변경

구동 방향을 뒤집었다. "좌표를 가진 605만 행"이 아니라 "좌표가 없는 수천 건"에서 출발한다. 결과는 동일하다.

- `getBuildingsNeedingCoords()` 신설 — `SELECT DISTINCT bjdCode, buildingName WHERE lat IS NULL` (인덱스 순서 스캔, 로컬 실측 5초. 주소 컬럼을 얹으면 풀스캔+filesort로 떨어져 2단계로 나눔)
- `copyCoordsWithinTable` / `copyCoordsFromSibling` — 대상 건물만 확보 후 건물별 `findFirst`로 seed 조회
- `getUniqueBuildings` — 2단계 조회. 주소는 한 행에서 읽어 `roadName`/`jibun`이 섞이지 않게 함

지오코딩 동작 자체(카카오 API, 검색 전략, 재시도 정책)는 건드리지 않았다.

## 테스트

`findMany`가 호출되면 깨지는 **회귀 증명 테스트**를 함수별로 넣었다. 605만 행 적재가 되살아나면 CI가 막는다.

## 범위 밖

- mysqld `OOMScoreAdjust`, sync node 힙 상한, `slow_query_log` 활성화(현재 OFF)
- Property/Transaction 정규화 — `copyCoords*`는 좌표가 거래 행마다 중복 저장되기 때문에 존재하는 함수다. 정규화하면 개념 자체가 사라진다
- 버퍼풀 128MB — RAM 3GB에 스왑까지 쓰는 상황이라 지금 올리면 OOM이 악화된다

스펙: `docs/superpowers/specs/2026-07-16-geocode-coord-copy-oom-design.md` (로컬)
EOF
)"
```

- [ ] **Step 6: CI 통과 확인**

```bash
gh pr checks --watch
```

Expected: 전부 green. 실패 시 수정 후 재푸시.

---

## 배포 후 검증 (머지·승격 이후)

이 플랜의 범위는 PR까지다. `develop` 머지 후 `main` 승격·배포가 끝나면 **익일 새벽에** 다음을 확인한다.

```bash
sshpass -p '<비번>' ssh root@183.111.126.54 \
  'dmesg -T | grep -i "out of memory" | tail -5; echo "--- mysqld uptime ---"; \
   systemctl show mysql --property=ActiveEnterTimestamp; pm2 list'
```

기대: 03:00~05:00 구간에 신규 OOM 없음. mysqld `ActiveEnterTimestamp`가 배포 시점 이후로 유지(새벽에 재시작되지 않음). pm2 재시작 카운트 증가 없음.
