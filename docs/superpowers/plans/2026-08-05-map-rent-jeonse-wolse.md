# 지도 전월세 전세·월세 병기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 지도 전월세 탭에서 건물마다 전세·월세 최근가를 함께 보여주고, 마커를 누르면 값과 상세 링크가 펼쳐지게 한다.

**Architecture:** `RealEstateBuildingSummary` 에 nullable 컬럼 5개를 더하고, 기존 INSERT 를 건드리지 않은 채 city 배치마다 경량 UPDATE 패스를 하나 붙여 채운다. 지도 조회 SELECT 에 그 컬럼을 실어 보내고, 사이드바는 두 줄로 렌더하며, 마커 라벨은 한 줄을 유지하되 선택된 하나만 펼침 카드가 된다.

**Tech Stack:** Express 5 + TypeScript(ESM) + Prisma/MySQL 8 (backend), Nuxt 3 + Vue 3 `<script setup>` + TailwindCSS (frontend), Vitest.

## Global Constraints

- **Node 20 필수.** 모든 npm/npx 명령 앞에 `export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"` 를 붙인다. Node 25 로 프론트 테스트를 돌리면 실제와 무관한 실패가 27건 난다.
- **테스트는 반드시 `backend/` 또는 `frontend/` 안에서 실행한다.** 저장소 루트에서 vitest 를 돌리면 두 패키지를 함께 잡아 432개 파일을 수집한다.
- **backend 는 ESM** — 모든 로컬 import 에 `.js` 확장자를 붙인다. 예: `import { prisma } from '../lib/prisma.js';`
- **`package-lock.json` 을 삭제하거나 재생성하지 않는다.**
- **`composables/useKakaoMap.ts` 를 수정하지 않는다.** 시설 상세·건물 상세·공매·청약·지하철 5개 페이지가 의존한다.
- **기존 컬럼 `latestPrice` · `monthlyRent` · `latestDealYear` · `latestDealMonth` · `latestDealDay` 를 수정하지 않는다.** 사이트맵·인근 단지·건물 목록·검색 자동완성이 읽는다.
- **`fetchBuildings` 의 `WHERE` · `ORDER BY` · `FORCE INDEX` 를 수정하지 않는다.** `FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)` 가 빠지면 희소 뷰포트에서 21배 느려진다.
- **매매 타입 3종은 `apt-sale` · `villa-sale` · `offitel-sale`** 이고 `realEstateSummaryService.ts` 의 `SALE_TYPES` 상수가 이미 이 집합을 담고 있다.
- **전월세 판별식은 `rentType` 컬럼의 문자열 `'전세'` / `'월세'`** 다 (거래 테이블 기준). 요약 테이블의 `monthlyRent` 판별식(`null`=매매 / `0`=전세 / `>0`=월세)과 혼동하지 않는다.
- **거래 일자는 화면에 표시하지 않는다.** `jeonseDealKey` · `wolseDealKey` 는 저장만 한다.
- **탭 6종을 유지한다.** 3종으로 합치지 않는다.

---

## File Structure

| 파일 | 책임 | 태스크 |
|---|---|---|
| `backend/prisma/schema.prisma` | 컬럼 5개 추가 | 1 |
| `backend/src/services/realEstateSummaryService.ts` | UPDATE 패스 추가 | 1 |
| `backend/__tests__/services/realEstateSummaryService.test.ts` | 위 검증 | 1 |
| `backend/src/services/realEstateMapService.ts` | SELECT·타입에 컬럼 추가 | 2 |
| `backend/__tests__/services/realEstateMapBuildings.test.ts` | 위 검증 | 2 |
| `frontend/types/realEstateMap.ts` | `MapBuildingItem` 필드 추가 | 3 |
| `frontend/composables/useMapOverlays.ts` | 포맷터 추가 + 펼침 렌더 | 3, 5 |
| `frontend/tests/composables/useMapOverlays.test.ts` | 위 검증 | 3, 5 |
| `frontend/components/realEstate/map/MapSidebar.vue` | 두 줄 렌더 | 4 |
| `frontend/tests/components/realEstate/map/MapSidebar.test.ts` | 위 검증 | 4 |
| `frontend/components/realEstate/map/RealEstateMapCanvas.vue` | `type`·`selectedKey` 전달 | 6 |
| `frontend/components/realEstate/map/RealEstateMapExplorer.vue` | 선택 토글 배선 | 6 |
| `frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts` | 위 검증 | 6 |

---

## Task 1: 스키마 + 요약 UPDATE 패스

전월세 요약 행이 전세·월세 최신값을 각각 갖게 한다. 이 태스크가 이 기능의 유일한 실질 위험 구간이다 — `refreshSummary` 는 2026-04-18 에 단일 INSERT 가 버퍼풀을 10분 점유해 사이트를 무한로딩시킨 이력이 있다. 그래서 **기존 INSERT 를 한 글자도 바꾸지 않고** 별도 UPDATE 를 뒤에 붙인다.

**Files:**
- Modify: `backend/prisma/schema.prisma` (model `RealEstateBuildingSummary`)
- Modify: `backend/src/services/realEstateSummaryService.ts`
- Test: `backend/__tests__/services/realEstateSummaryService.test.ts`

**Interfaces:**
- Consumes: 기존 `refreshSummary(type: string): Promise<number>`, `SALE_TYPES: Set<string>`, `TABLE_NAME_MAP`
- Produces: 요약 테이블 컬럼 `jeonseDeposit`, `jeonseDealKey`, `wolseDeposit`, `wolseMonthlyRent`, `wolseDealKey` (모두 `Int?`). Task 2 가 이 이름 그대로 SELECT 한다.

- [ ] **Step 1: 스키마에 컬럼 5개 추가**

`backend/prisma/schema.prisma` 의 `model RealEstateBuildingSummary` 안, 기존 `monthlyRent Int?` 선언 **바로 아래**에 넣는다.

```prisma
  /// 최신 전세 보증금(만원). 매매 타입과 전세 거래가 없는 건물은 NULL.
  ///
  /// latestPrice/monthlyRent 는 rentType 을 가리지 않은 "가장 최근 거래 1건" 이라
  /// 그 거래가 월세였으면 같은 건물의 전세 시세가 어디에도 남지 않았다.
  /// 운영 실측(강남구 2026): 전월세 건물 23,774개 중 12,237개(51%)가 두 종류를 모두
  /// 가지고 있는데 지도에는 하나만 보였다.
  jeonseDeposit    Int?
  /// 위 거래일 YYYYMMDD. 현재 화면에 쓰지 않는다 — 표시 전환이나 신선도 정책의 여지를 남긴다.
  jeonseDealKey    Int?
  /// 최신 월세 보증금(만원). 매매 타입과 월세 거래가 없는 건물은 NULL.
  wolseDeposit     Int?
  /// 위 거래의 월세액(만원).
  wolseMonthlyRent Int?
  /// 위 거래일 YYYYMMDD.
  wolseDealKey     Int?
```

인덱스는 추가하지 않는다 — 조회 조건이 아니라 표시값이다.

- [ ] **Step 2: Prisma Client 재생성**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npm run db:generate
```

Expected: `Generated Prisma Client` 출력.

- [ ] **Step 3: 실패하는 테스트를 쓴다**

`backend/__tests__/services/realEstateSummaryService.test.ts` 파일 **맨 끝**에 아래 `describe` 를 통째로 덧붙인다.

⚠️ 이 파일의 기존 `describe('refreshSummary (city-chunked)')` 블록 안에 넣지 말 것 — 새 `describe` 는 그 블록의 `beforeEach` 를 상속하지 않으므로 아래처럼 자체 `beforeEach` 를 갖는다.

```typescript
describe('refreshSummary — 전세/월세 분리 컬럼 UPDATE 패스', () => {
  beforeEach(() => {
    mockExecuteRawUnsafe.mockReset();
    mockQueryRawUnsafe.mockReset();
    mockTransaction.mockReset();
    setupTransactionPassthrough();
  });

  /** 트랜잭션 안에서 실행된 SQL 문자열만 순서대로 뽑는다. */
  function executedSql(): string[] {
    return mockExecuteRawUnsafe.mock.calls.map((c) => String(c[0]));
  }

  it('전월세 타입은 city 배치마다 DELETE, INSERT, UPDATE 순으로 3개를 실행한다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const sql = executedSql();
    // [0] 은 SET SESSION innodb_lock_wait_timeout
    expect(sql[1]).toContain('DELETE FROM RealEstateBuildingSummary');
    expect(sql[2]).toContain('INSERT INTO RealEstateBuildingSummary');
    expect(sql[3]).toContain('UPDATE RealEstateBuildingSummary');
  });

  it('매매 타입은 UPDATE 패스를 건너뛴다 — 매매 테이블에는 rentType 컬럼이 없다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-sale');

    expect(executedSql().some((s) => s.includes('UPDATE RealEstateBuildingSummary'))).toBe(false);
  });

  it('UPDATE 는 rentType 별 최신 1건을 골라 5개 컬럼을 채운다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const update = executedSql().find((s) => s.includes('UPDATE RealEstateBuildingSummary'))!;
    // rentType 축을 넣은 ROW_NUMBER 로 종류별 최신을 고른 뒤 rn=1 만 남긴다.
    expect(update).toContain('PARTITION BY buildingName, bjdCode, rentType');
    expect(update).toContain('rn = 1');
    for (const col of ['jeonseDeposit', 'jeonseDealKey', 'wolseDeposit', 'wolseMonthlyRent', 'wolseDealKey']) {
      expect(update).toContain(col);
    }
  });

  it('UPDATE 는 해당 type·city 로만 범위를 좁힌다 — 다른 시·도 행을 건드리면 배치 분할이 무의미해진다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }]);
    mockExecuteRawUnsafe.mockResolvedValue(1);

    await refreshSummary('apt-rent');

    const idx = executedSql().findIndex((s) => s.includes('UPDATE RealEstateBuildingSummary'));
    const params = mockExecuteRawUnsafe.mock.calls[idx].slice(1);
    expect(params).toContain('apt-rent');
    expect(params).toContain('서울');
  });

  it('UPDATE 가 실패해도 다음 city 로 계속한다 — 한 배치 실패가 전체를 멈추지 않는다', async () => {
    mockQueryRawUnsafe.mockResolvedValueOnce([{ city: '서울' }, { city: '경기' }]);
    mockExecuteRawUnsafe.mockImplementation(async (sql: string) => {
      if (String(sql).includes('UPDATE') && mockExecuteRawUnsafe.mock.calls.length <= 4) {
        throw new Error('lock wait timeout');
      }
      return 1;
    });

    await expect(refreshSummary('apt-rent')).resolves.toBeTypeOf('number');
    expect(mockQueryRawUnsafe).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 4: 테스트가 실패하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npx vitest run __tests__/services/realEstateSummaryService.test.ts
```

Expected: 새 `describe` 의 5개 중 최소 4개 FAIL (UPDATE 문이 아직 없으므로 `sql[3]` 이 `undefined`).

- [ ] **Step 5: UPDATE 패스를 구현한다**

`backend/src/services/realEstateSummaryService.ts` 를 수정한다.

먼저 파일 상단 상수 옆(`LOCK_WAIT_TIMEOUT_SEC` 선언 아래)에 SQL 빌더를 추가한다.

```typescript
/**
 * 전월세 요약 행의 전세/월세 분리 컬럼을 채우는 UPDATE.
 *
 * 왜 INSERT 에 통합하지 않는가: 통합하면 `SELECT *` 가 윈도우 두 겹을 통과해 넓은 행
 * 집합을 두 번 실체화한다. 로컬 운영 스냅샷 실측(경기 apt-rent 67,477행) —
 * 현행 INSERT 3.13s / 통합 8.87s(2.8배) / 이 경량 UPDATE 0.58s. 결과 건수는 셋 다 6,218 로 동일.
 * 배치당 증가분이 2.8배가 아니라 약 18% 로 줄고, 문장이 짧게 둘로 나뉘어 락 점유 시간도
 * 통합안보다 짧다. 2026-04-18 에 단일 INSERT 가 버퍼풀을 10분 점유해 사이트를
 * 무한로딩시킨 이력이 있는 함수라 기존 INSERT 는 그대로 둔다.
 *
 * rn=1 로 rentType 별 최신 1건을 고른 뒤 MAX(CASE ...) 로 건물당 한 행에 접는다.
 * 여기서 MAX 는 크기 비교가 아니라 그룹당 후보가 1개뿐인 상태에서의 접기 용도다.
 */
function buildRentSplitUpdate(table: string): string {
  return `UPDATE RealEstateBuildingSummary s
    JOIN (
      SELECT buildingName, bjdCode,
        MAX(CASE WHEN rentType = '전세' THEN deposit END)     AS jDeposit,
        MAX(CASE WHEN rentType = '전세' THEN dealKey END)     AS jDealKey,
        MAX(CASE WHEN rentType = '월세' THEN deposit END)     AS wDeposit,
        MAX(CASE WHEN rentType = '월세' THEN monthlyRent END) AS wMonthly,
        MAX(CASE WHEN rentType = '월세' THEN dealKey END)     AS wDealKey
      FROM (
        SELECT buildingName, bjdCode, rentType, deposit, monthlyRent,
          dealYear * 10000 + dealMonth * 100 + COALESCE(dealDay, 1) AS dealKey,
          ROW_NUMBER() OVER (
            PARTITION BY buildingName, bjdCode, rentType
            ORDER BY dealYear DESC, dealMonth DESC, dealDay DESC
          ) AS rn
        FROM ${table}
        WHERE city = ?
      ) ranked
      WHERE rn = 1
      GROUP BY buildingName, bjdCode
    ) t ON t.buildingName = s.buildingName AND t.bjdCode = s.bjdCode
    SET s.jeonseDeposit    = t.jDeposit,
        s.jeonseDealKey    = t.jDealKey,
        s.wolseDeposit     = t.wDeposit,
        s.wolseMonthlyRent = t.wMonthly,
        s.wolseDealKey     = t.wDealKey
    WHERE s.type = ? AND s.city = ?`;
}
```

그다음 `refreshSummary` 안, 기존 INSERT 의 `const n = await tx.$executeRawUnsafe(...)` 호출이 끝나고 `return Number(n) || 0;` 앞에 아래를 넣는다.

```typescript
          // 매매 테이블에는 rentType 컬럼 자체가 없다 — 전월세만 분리 컬럼을 채운다.
          if (!SALE_TYPES.has(type)) {
            await tx.$executeRawUnsafe(buildRentSplitUpdate(table), city, type, city);
          }
```

⚠️ 파라미터 순서가 `city, type, city` 다 — 서브쿼리의 `WHERE city = ?` 가 먼저이고, 바깥 `WHERE s.type = ? AND s.city = ?` 가 뒤다.

- [ ] **Step 6: 테스트가 통과하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npx vitest run __tests__/services/realEstateSummaryService.test.ts
```

Expected: 전부 PASS.

- [ ] **Step 7: 실제 DB 에 반영하고 한 타입을 돌려 값이 채워지는지 확인한다**

로컬 Docker MySQL(포트 3307)에 스키마를 밀고, 가장 작은 전월세 타입으로 실행한다.

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npm run db:push
npx tsx -e "import('./src/services/realEstateSummaryService.js').then(m => m.refreshSummary('offitel-rent')).then(n => console.log('rows', n))"
```

그다음 값이 실제로 들어갔는지 본다.

```bash
docker exec ilsangkit-mysql mysql --default-character-set=utf8mb4 -uilsangkit -pilsangkit123 ilsangkit -e "
SELECT COUNT(*) AS total,
       SUM(jeonseDeposit IS NOT NULL) AS has_j,
       SUM(wolseDeposit IS NOT NULL) AS has_w,
       SUM(jeonseDeposit IS NOT NULL AND wolseDeposit IS NOT NULL) AS has_both
FROM RealEstateBuildingSummary WHERE type='offitel-rent';"
```

Expected: `total` 이 0 보다 크고, `has_j` 와 `has_w` 둘 다 0 이 아니며, `has_both` 가 `total` 보다 작다(모든 건물이 두 종류를 다 갖지는 않는다).

매매 타입이 오염되지 않았는지도 본다.

```bash
docker exec ilsangkit-mysql mysql -uilsangkit -pilsangkit123 ilsangkit -e "
SELECT COUNT(*) AS dirty FROM RealEstateBuildingSummary
WHERE type LIKE '%-sale' AND (jeonseDeposit IS NOT NULL OR wolseDeposit IS NOT NULL);"
```

Expected: `dirty` = 0.

- [ ] **Step 8: 커밋**

```bash
git add backend/prisma/schema.prisma backend/src/services/realEstateSummaryService.ts backend/__tests__/services/realEstateSummaryService.test.ts
git commit -m "feat(summary): 전월세 요약에 전세·월세 최신값 분리 저장

기존 INSERT 는 그대로 두고 city 배치마다 경량 UPDATE 를 덧붙인다.
통합 시 2.8배(3.13s→8.87s)인데 분리하면 0.58s — 경기 apt-rent 실측."
```

---

## Task 2: 지도 조회에 컬럼 싣기

`fetchBuildings` 가 새 컬럼을 응답에 실어 보내게 한다.

**Files:**
- Modify: `backend/src/services/realEstateMapService.ts` (`MapBuildingItem` 인터페이스, `fetchBuildings` 의 목록 SELECT)
- Test: `backend/__tests__/services/realEstateMapBuildings.test.ts`

**Interfaces:**
- Consumes: Task 1 의 컬럼 이름 `jeonseDeposit`, `jeonseDealKey`, `wolseDeposit`, `wolseMonthlyRent`, `wolseDealKey`
- Produces: `MapBuildingItem` 에 같은 이름의 `number | null` 필드 5개. Task 3 의 프론트 타입이 이 이름을 그대로 쓴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`backend/__tests__/services/realEstateMapBuildings.test.ts` 의 `describe('fetchBuildings', ...)` 블록 **안**, 마지막 `it` 뒤에 덧붙인다.

```typescript
  it('전세/월세 분리 컬럼을 SELECT 에 싣는다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-rent', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    for (const col of ['jeonseDeposit', 'jeonseDealKey', 'wolseDeposit', 'wolseMonthlyRent', 'wolseDealKey']) {
      expect(listSql).toContain(col);
    }
  });

  it('분리 컬럼 값을 그대로 항목에 담는다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([{
      buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
      lat: 37.5, lng: 127.06, latestPrice: 75000n, monthlyRent: 340,
      latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 114,
      jeonseDeposit: 96000, jeonseDealKey: 20260712,
      wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
    }]);
    const r = await fetchBuildings('apt-rent', BOUNDS);
    expect(r.items[0].jeonseDeposit).toBe(96000);
    expect(r.items[0].wolseDeposit).toBe(75000);
    expect(r.items[0].wolseMonthlyRent).toBe(340);
  });

  it('매매는 분리 컬럼이 null 이다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([{
      buildingName: '도곡렉슬', city: '서울', district: '강남구', dongName: '도곡동',
      lat: 37.48, lng: 127.05, latestPrice: 245000n, monthlyRent: null,
      latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 83,
      jeonseDeposit: null, jeonseDealKey: null,
      wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
    }]);
    const r = await fetchBuildings('apt-sale', BOUNDS);
    expect(r.items[0].jeonseDeposit).toBeNull();
    expect(r.items[0].wolseMonthlyRent).toBeNull();
  });

  it('FORCE INDEX 와 WHERE 는 그대로다 — 컬럼 추가가 인덱스 경로를 바꾸면 안 된다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 1n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-rent', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    expect(listSql).toContain('FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)');
    expect(listSql).toContain('ORDER BY transactionCount DESC');
  });
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npx vitest run __tests__/services/realEstateMapBuildings.test.ts
```

Expected: 새 테스트 4개 중 3개 FAIL (`jeonseDeposit` 이 SQL 에도 결과에도 없음).

- [ ] **Step 3: 인터페이스에 필드를 더한다**

`backend/src/services/realEstateMapService.ts` 의 `MapBuildingItem` 에서 `transactionCount: number;` **바로 위**에 넣는다.

```typescript
  /** 최신 전세 보증금(만원). 매매 타입과 전세 거래 없는 건물은 null. */
  jeonseDeposit: number | null;
  /** 위 거래일 YYYYMMDD. 현재 화면에 쓰지 않는다. */
  jeonseDealKey: number | null;
  /** 최신 월세 보증금(만원). */
  wolseDeposit: number | null;
  /** 위 거래의 월세액(만원). */
  wolseMonthlyRent: number | null;
  /** 위 거래일 YYYYMMDD. */
  wolseDealKey: number | null;
```

- [ ] **Step 4: SELECT 에 컬럼을 더한다**

같은 파일의 목록 쿼리에서 `transactionCount` 로 끝나는 컬럼 목록을 아래처럼 바꾼다. **`WHERE` · `ORDER BY` · `LIMIT` · `FORCE INDEX` 는 손대지 않는다.**

```typescript
  const rows = await queryWithIndexHint<Record<string, unknown>>(
    (hint) => `SELECT buildingName, city, district, dongName, lat, lng,
            latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay,
            jeonseDeposit, jeonseDealKey, wolseDeposit, wolseMonthlyRent, wolseDealKey,
            transactionCount
     FROM RealEstateBuildingSummary${hint}
     WHERE ${where}
     ORDER BY transactionCount DESC
     LIMIT ${BUILDING_LIMIT}`,
    params,
  );
```

`serializeRow` 가 BigInt/Decimal 을 Number 로 바꾸고 나머지는 그대로 통과시키므로 매핑 코드는 수정하지 않는다.

- [ ] **Step 5: 테스트가 통과하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npx vitest run __tests__/services/realEstateMapBuildings.test.ts
```

Expected: 전부 PASS.

- [ ] **Step 6: 백엔드 전체 테스트를 돌린다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npm run test
```

Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add backend/src/services/realEstateMapService.ts backend/__tests__/services/realEstateMapBuildings.test.ts
git commit -m "feat(map): 지도 건물 응답에 전세·월세 분리 컬럼 추가"
```

---

## Task 3: 프론트 타입 + 전월세 포맷터

목록과 마커가 함께 쓸 포맷 함수를 만든다. 렌더는 Task 4·5 가 한다.

**Files:**
- Modify: `frontend/types/realEstateMap.ts` (`MapBuildingItem`)
- Modify: `frontend/composables/useMapOverlays.ts`
- Test: `frontend/tests/composables/useMapOverlays.test.ts`

**Interfaces:**
- Consumes: Task 2 의 필드 이름 5개
- Produces:
  - `formatJeonseLabel(item: MapBuildingItem): string | null` — 전세가 없으면 `null`
  - `formatWolseLabel(item: MapBuildingItem): string | null` — 월세가 없으면 `null`
  - Task 4(사이드바)와 Task 5(마커 펼침)가 둘 다 쓴다.

- [ ] **Step 1: 타입에 필드를 더한다**

`frontend/types/realEstateMap.ts` 의 `MapBuildingItem` 에서 `transactionCount: number` **바로 위**에 넣는다.

```typescript
  /** 최신 전세 보증금(만원). 매매 타입과 전세 거래 없는 건물은 null. */
  jeonseDeposit: number | null
  /** 위 거래일 YYYYMMDD. 현재 화면에 쓰지 않는다. */
  jeonseDealKey: number | null
  /** 최신 월세 보증금(만원). */
  wolseDeposit: number | null
  /** 위 거래의 월세액(만원). */
  wolseMonthlyRent: number | null
  /** 위 거래일 YYYYMMDD. */
  wolseDealKey: number | null
```

- [ ] **Step 2: 실패하는 테스트를 쓴다**

`frontend/tests/composables/useMapOverlays.test.ts` 의 최상단 import 를 아래로 바꾼다.

```typescript
import { formatJeonseLabel, formatPriceLabel, formatPyeongLabel, formatWolseLabel, useMapOverlays } from '~/composables/useMapOverlays'
```

같은 파일의 `building()` 헬퍼에 기본값을 더한다 — `transactionCount: 1,` 뒤, `...over,` 앞에 넣는다.

```typescript
    jeonseDeposit: null, jeonseDealKey: null,
    wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
```

그다음 `describe('formatPriceLabel', ...)` 블록 **바로 뒤**에 새 블록을 넣는다.

```typescript
describe('formatJeonseLabel / formatWolseLabel', () => {
  it('전세 보증금을 만원 단위로 보여준다', () => {
    expect(formatJeonseLabel(building({ jeonseDeposit: 96000 }))).toBe('9억 6,000만')
  })

  it('전세 거래가 없으면 null 이다 — 호출부가 "거래 없음" 을 그릴 수 있게 한다', () => {
    expect(formatJeonseLabel(building({ jeonseDeposit: null }))).toBeNull()
  })

  it('월세는 보증금과 월세액을 가운뎃점으로 가른다', () => {
    expect(formatWolseLabel(building({ wolseDeposit: 75000, wolseMonthlyRent: 340 }))).toBe('7억 5,000만 · 340만')
  })

  it('월세 보증금이 억으로 딱 떨어지면 만원 자리를 붙이지 않는다', () => {
    expect(formatWolseLabel(building({ wolseDeposit: 90000, wolseMonthlyRent: 100 }))).toBe('9억 · 100만')
  })

  it('월세 거래가 없으면 null 이다', () => {
    expect(formatWolseLabel(building({ wolseDeposit: null, wolseMonthlyRent: null }))).toBeNull()
  })

  it('보증금은 있는데 월세액이 없으면 null 이다 — 반쪽 값을 그리지 않는다', () => {
    expect(formatWolseLabel(building({ wolseDeposit: 75000, wolseMonthlyRent: null }))).toBeNull()
  })

  it('보증금 0원 월세도 그린다 — 0 을 "없음" 으로 쓰지 않는다', () => {
    expect(formatWolseLabel(building({ wolseDeposit: 0, wolseMonthlyRent: 50 }))).toBe('0만 · 50만')
  })
})
```

- [ ] **Step 3: 기존 건물 리터럴에 새 필드를 채운다**

새 필드는 `number | null` 이지 optional 이 아니다. 이미 있는 `MapBuildingItem` 리터럴이 전부 타입 오류가 난다. 저장소 전체를 확인한 결과 **정확히 세 곳**이다(다른 테스트의 `buildingName:` 은 상세 페이지용 별도 타입이라 무관하다).

`frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts:18` — `BUILDING_ITEMS` 의 `transactionCount: 812,` 뒤에 한 줄 더한다.

```typescript
    jeonseDeposit: null, jeonseDealKey: null, wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
```

`frontend/tests/components/realEstate/map/MapSidebar.test.ts:18` — `BUILDINGS` 에 같은 줄을 더한다. (Task 4 에서 이 상수를 통째로 교체하지만, 지금 고쳐 두어야 Task 3 시점에 타입 검사가 통과한다.)

`frontend/tests/components/realEstate/map/MapSidebar.test.ts:221` — `manyBuildings` 헬퍼의 `transactionCount: 200 - i,` 뒤에 같은 줄을 더한다.

`useMapOverlays.test.ts` 의 `building()` 헬퍼는 Step 2 에서 이미 채웠다.

- [ ] **Step 4: 테스트가 실패하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/composables/useMapOverlays.test.ts
```

Expected: FAIL — `formatJeonseLabel is not a function`.

- [ ] **Step 5: 포맷터를 구현한다**

`frontend/composables/useMapOverlays.ts` 의 `formatPriceLabel` 함수 **바로 뒤**에 넣는다.

```typescript
/**
 * 전세 라벨. 값이 없으면 null 을 준다 — 호출부가 "거래 없음" 을 그릴지 줄을 뺄지 정한다.
 *
 * formatPriceLabel 과 달리 접두어("전세")를 붙이지 않는다. 목록과 펼침 카드가 라벨을
 * 별도 요소로 그리기 때문이다 — 문자열에 넣으면 스타일을 나눠 줄 수 없다.
 */
export function formatJeonseLabel(item: MapBuildingItem): string | null {
  if (item.jeonseDeposit == null) return null
  return formatManwon(item.jeonseDeposit)
}

/**
 * 월세 라벨 — "보증금 · 월세액".
 *
 * 둘 중 하나라도 없으면 null 이다. 보증금만 그리면 전세로 읽히고, 월세액만 그리면
 * 보증금이 0인지 미상인지 알 수 없다. 0 은 유효한 값이라 `== null` 로만 판정한다.
 */
export function formatWolseLabel(item: MapBuildingItem): string | null {
  if (item.wolseDeposit == null || item.wolseMonthlyRent == null) return null
  return `${formatManwon(item.wolseDeposit)} · ${item.wolseMonthlyRent.toLocaleString('ko-KR')}만`
}
```

- [ ] **Step 6: 테스트가 통과하는 걸 확인한다**

세 파일을 함께 돌려 타입 오류가 남지 않았는지 본다.

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/composables/useMapOverlays.test.ts tests/components/realEstate/map/
```

Expected: 전부 PASS.

- [ ] **Step 7: 커밋**

```bash
git add frontend/types/realEstateMap.ts frontend/composables/useMapOverlays.ts frontend/tests/composables/useMapOverlays.test.ts frontend/tests/components/realEstate/map/MapSidebar.test.ts frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts
git commit -m "feat(map): 전세·월세 라벨 포맷터 추가"
```

---

## Task 4: 사이드바 두 줄 렌더

전월세 탭에서 건물 행이 전세·월세 두 줄이 된다. 매매 탭은 한 줄 그대로다.

**Files:**
- Modify: `frontend/components/realEstate/map/MapSidebar.vue`
- Test: `frontend/tests/components/realEstate/map/MapSidebar.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `formatJeonseLabel(item)`, `formatWolseLabel(item)`
- Produces: 없음 (렌더 전용)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`frontend/tests/components/realEstate/map/MapSidebar.test.ts` 의 `BUILDINGS` 상수를 아래로 교체한다(기존 항목에 새 필드가 없으면 타입 오류가 난다).

```typescript
const BUILDINGS: MapItem[] = [
  {
    buildingName: '래미안블레스티지', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
    jeonseDeposit: null, jeonseDealKey: null,
    wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  },
]

const RENT_BUILDINGS: MapItem[] = [
  {
    buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
    lat: 37.5, lng: 127.06, latestPrice: 75000, monthlyRent: 340,
    latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 114,
    jeonseDeposit: 96000, jeonseDealKey: 20260712,
    wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
  },
  {
    buildingName: '신동아', city: '서울', district: '강남구', dongName: '수서동',
    lat: 37.49, lng: 127.1, latestPrice: 60000, monthlyRent: 0,
    latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 20, transactionCount: 11,
    jeonseDeposit: 60000, jeonseDealKey: 20260720,
    wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  },
]
```

같은 파일 맨 끝에 새 `describe` 를 덧붙인다.

```typescript
describe('MapSidebar — 전월세 두 줄 병기', () => {
  function mountRent(over = {}) {
    return mount(MapSidebar, {
      props: {
        items: RENT_BUILDINGS, granularity: 'building', total: 2, exact: true,
        pending: false, type: 'apt-rent', ...over,
      },
    })
  }

  it('전세와 월세를 각각 보여준다', () => {
    const t = mountRent().text()
    expect(t).toContain('9억 6,000만')
    expect(t).toContain('7억 5,000만 · 340만')
  })

  it('전세/월세 라벨을 붙여 어느 쪽인지 알린다', () => {
    const t = mountRent().text()
    expect(t).toContain('전세')
    expect(t).toContain('월세')
  })

  it('해당 종류 거래가 없으면 "거래 없음" 이다 — 값이 없는 건지 안 보이는 건지 구분돼야 한다', () => {
    expect(mountRent().text()).toContain('거래 없음')
  })

  it('매매 탭은 한 줄 그대로다 — 전세/월세 라벨이 없다', () => {
    const w = mount(MapSidebar, {
      props: {
        items: BUILDINGS, granularity: 'building', total: 1, exact: true,
        pending: false, type: 'apt-sale',
      },
    })
    expect(w.text()).toContain('16억 8,340만')
    expect(w.text()).not.toContain('거래 없음')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: 새 `describe` 의 3개 FAIL ("9억 6,000만" 이 없음 — 현재는 `formatPriceLabel` 결과 하나만 그린다).

- [ ] **Step 3: Row 타입과 빌더를 고친다**

`frontend/components/realEstate/map/MapSidebar.vue` 의 `<script setup>` 에서 import 를 바꾼다.

```typescript
import { formatJeonseLabel, formatPriceLabel, formatPyeongLabel, formatWolseLabel } from '~/composables/useMapOverlays'
```

`Row` 인터페이스의 `price: string` **바로 아래**에 두 필드를 더한다.

```typescript
  /** 전월세 전용. null 이면 매매이거나 지역 행이라 한 줄로 그린다. */
  jeonse: string | null
  wolse: string | null
  /** 전월세 행인지. jeonse/wolse 가 둘 다 null 이어도 "거래 없음" 을 그려야 하므로 별도 플래그가 필요하다. */
  isRent: boolean
```

건물 행을 만드는 `props.granularity === 'building'` 분기의 `return { ... }` 를 아래로 바꾼다.

```typescript
  if (props.granularity === 'building') {
    // 전월세 타입에서만 두 줄로 나눈다. 매매는 보여줄 두 번째 값이 없다.
    const isRent = props.type.endsWith('-rent')
    return props.items.map((i) => {
      const b = i as MapBuildingItem
      return {
        key: itemKey(i),
        title: b.buildingName,
        subtitle: `${b.city} ${b.district} ${b.dongName}`,
        price: formatPriceLabel(b),
        jeonse: isRent ? formatJeonseLabel(b) : null,
        wolse: isRent ? formatWolseLabel(b) : null,
        isRent,
        // 건물 상세는 4-segment URL. 슬러그 변환·NFC 정규화·encodeURIComponent 가
        // 전부 이 유틸에 들어 있으므로 직접 문자열을 조립하지 않는다.
        href: toRealEstateUrl({
          type: props.type as RealEstateUrlType,
          city: b.city,
          district: b.district,
          buildingName: b.buildingName,
        }),
        item: i,
      }
    })
  }
```

지역 행을 만드는 나머지 두 분기(`toRealEstateListUrl` 을 쓰는 것과 `href: null` 인 동 분기)의 `return` 객체에도 각각 아래 세 줄을 더한다. 지역 행은 전월세 개념이 없다.

```typescript
        jeonse: null,
        wolse: null,
        isRent: false,
```

`SIDO_CHIPS` 폴백 항목을 만드는 곳의 `return` 객체에도 같은 세 줄을 더한다.

- [ ] **Step 4: 템플릿을 고친다**

같은 파일의 템플릿에는 가격을 그리는 `<span class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>` 가 **세 군데**(NuxtLink / `<a>` / `<button>`) 있다. 셋 다 아래로 교체한다.

```html
            <span v-if="row.isRent" class="text-right whitespace-nowrap leading-tight">
              <span class="block text-sm font-semibold text-primary">
                <span class="text-[11px] font-medium text-slate-500 mr-1">전세</span>{{ row.jeonse ?? '거래 없음' }}
              </span>
              <span class="block text-xs text-slate-700">
                <span class="text-[11px] font-medium text-slate-500 mr-1">월세</span>{{ row.wolse ?? '거래 없음' }}
              </span>
            </span>
            <span v-else class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
```

- [ ] **Step 5: 테스트가 통과하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/components/realEstate/map/MapSidebar.test.ts
```

Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/realEstate/map/MapSidebar.vue frontend/tests/components/realEstate/map/MapSidebar.test.ts
git commit -m "feat(map): 사이드바 전월세 행에 전세·월세 병기"
```

---

## Task 5: 마커 펼침 + 상세 링크

마커 라벨은 한 줄을 유지하고, 선택된 하나만 펼침 카드가 된다. 매매·전월세 모두 상세 보기 링크가 붙는다.

**Files:**
- Modify: `frontend/composables/useMapOverlays.ts`
- Test: `frontend/tests/composables/useMapOverlays.test.ts`

**Interfaces:**
- Consumes: Task 3 의 `formatJeonseLabel`, `formatWolseLabel`; `toRealEstateUrl` (`~/utils/realEstateUrl`); `itemKey` (`~/composables/useRealEstateMap`)
- Produces: `renderOverlays(map, items, handlers, opts?)` — 네 번째 인자 `opts?: { type?: string; selectedKey?: string | null }`. Task 6 이 이걸 넘긴다.

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`frontend/tests/composables/useMapOverlays.test.ts` 의 `describe('useMapOverlays', ...)` 블록 **안**, 기존 `describe('겹침 회피', ...)` 뒤에 새 블록을 넣는다.

```typescript
  describe('선택 시 펼침', () => {
    /** 마커 하나의 DOM 요소를 꺼낸다. */
    function contentOf(i: number): HTMLElement {
      return created[i].opts.content as HTMLElement
    }

    it('선택하지 않으면 라벨은 한 줄이다 — 두 줄이면 겹쳐서 접히는 마커가 늘어난다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [building({
        buildingName: '은마', latestPrice: 75000, monthlyRent: 340,
        jeonseDeposit: 96000, wolseDeposit: 75000, wolseMonthlyRent: 340,
      })], {}, { type: 'apt-rent', selectedKey: null })
      expect(contentOf(0).className).toContain('map-price-label')
      expect(contentOf(0).querySelector('a')).toBeNull()
    })

    it('선택된 항목은 전세·월세와 상세 링크를 펼친다', () => {
      const { renderOverlays } = useMapOverlays()
      const item = building({
        buildingName: '은마', city: '서울', district: '강남구',
        latestPrice: 75000, monthlyRent: 340,
        jeonseDeposit: 96000, wolseDeposit: 75000, wolseMonthlyRent: 340,
      })
      renderOverlays(fakeMap, [item], {}, { type: 'apt-rent', selectedKey: '은마|강남구' })
      const el = contentOf(0)
      expect(el.className).toContain('map-popup')
      expect(el.textContent).toContain('9억 6,000만')
      expect(el.textContent).toContain('7억 5,000만 · 340만')
      expect(el.querySelector('a')?.getAttribute('href')).toBe('/real-estate/apt-rent/seoul/gangnam/%EC%9D%80%EB%A7%88')
    })

    it('매매도 펼쳐진다 — 값은 한 줄이고 상세 링크가 붙는다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [building({
        buildingName: '도곡렉슬', city: '서울', district: '강남구',
        latestPrice: 245000, monthlyRent: null,
      })], {}, { type: 'apt-sale', selectedKey: '도곡렉슬|강남구' })
      const el = contentOf(0)
      expect(el.className).toContain('map-popup')
      expect(el.textContent).toContain('24억 5,000만')
      expect(el.querySelector('a')).not.toBeNull()
    })

    it('거래가 없는 종류는 "거래 없음" 으로 그린다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [building({
        buildingName: '신동아', city: '서울', district: '강남구',
        latestPrice: 60000, monthlyRent: 0,
        jeonseDeposit: 60000, wolseDeposit: null, wolseMonthlyRent: null,
      })], {}, { type: 'apt-rent', selectedKey: '신동아|강남구' })
      expect(contentOf(0).textContent).toContain('거래 없음')
    })

    it('선택된 항목을 맨 앞에 그린다 — 사용자가 방금 지목한 라벨이 점으로 접히면 안 된다', () => {
      const projMap = {
        id: 'proj-map',
        getProjection: () => ({
          containerPointFromCoords: (ll: { lat: number; lng: number }) => ({ x: ll.lng, y: ll.lat }),
        }),
      }
      const { renderOverlays } = useMapOverlays()
      // 셋이 같은 지점 — 순서상 뒤엣것은 점이 된다. B 를 선택하면 B 가 살아남아야 한다.
      renderOverlays(projMap, [
        building({ buildingName: 'A', city: '서울', district: '강남구', latestPrice: 50000, monthlyRent: null, lat: 100, lng: 100 }),
        building({ buildingName: 'B', city: '서울', district: '강남구', latestPrice: 60000, monthlyRent: null, lat: 100, lng: 100 }),
        building({ buildingName: 'C', city: '서울', district: '강남구', latestPrice: 70000, monthlyRent: null, lat: 100, lng: 100 }),
      ], {}, { type: 'apt-sale', selectedKey: 'B|강남구' })
      expect(contentOf(0).className).toContain('map-popup')
      expect(contentOf(0).textContent).toContain('6억')
    })

    it('opts 를 안 넘기면 기존 동작 그대로다 — 지역 오버레이 호출부가 깨지지 않는다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [regionItem({ avgPricePerPyeong: 7732 })])
      expect(contentOf(0).className).toContain('map-region-bubble')
    })
  })
```

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/composables/useMapOverlays.test.ts
```

Expected: 새 블록의 5개 FAIL (`map-popup` 클래스가 없음).

- [ ] **Step 3: 펼침 렌더를 구현한다**

`frontend/composables/useMapOverlays.ts` 상단 import 에 유틸을 더한다.

```typescript
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
```

선택 키를 만드는 함수는 **새로 만들지 않고 기존 것을 가져다 쓴다.** 같은 import 문에 추가한다.

```typescript
import { itemKey } from '~/composables/useRealEstateMap'
```

⚠️ 키 만드는 로직을 여기에 다시 구현하지 말 것. Task 6 이 `itemKey(item)` 으로 키를 **세팅**하고 이 파일이 그 키를 **대조**한다 — 두 벌이 되면 한쪽만 바뀌었을 때 선택이 조용히 동작을 멈춘다. `useRealEstateMap` 은 `useMapOverlays` 를 import 하지 않으므로 순환 참조가 아니다(확인 완료).

```typescript
/**
 * 선택된 마커의 펼침 카드. 건물명 + 값 + 상세 링크.
 *
 * 지도 마커 클릭은 지금까지 사실상 아무 일도 하지 않았다 — onSelect 는 지역 단계에서만
 * setLevel 로 파고들고 building 분기가 없어서 지도가 그 건물로 가운데 정렬되는 게 전부였다.
 *
 * 링크는 SSR HTML 에 실리지 않는다(이 렌더러 자체가 클라이언트 전용이다). 크롤러용이 아니라
 * 사용자 동선용이며, 내부 링크 역할은 사이드바 행이 계속 담당한다.
 */
function buildPopup(item: MapBuildingItem, type: string, isRent: boolean): HTMLElement {
  const el = document.createElement('div')
  el.className = 'map-popup'

  const name = document.createElement('b')
  name.textContent = item.buildingName
  el.appendChild(name)

  const addLine = (label: string, value: string, muted: boolean): void => {
    const line = document.createElement('span')
    line.className = muted ? 'map-popup-line map-popup-line--sub' : 'map-popup-line'
    const tag = document.createElement('i')
    tag.textContent = label
    line.appendChild(tag)
    line.appendChild(document.createTextNode(value))
    el.appendChild(line)
  }

  if (isRent) {
    addLine('전세', formatJeonseLabel(item) ?? '거래 없음', false)
    addLine('월세', formatWolseLabel(item) ?? '거래 없음', true)
  } else {
    addLine('매매', formatPriceLabel(item), false)
  }

  const link = document.createElement('a')
  link.className = 'map-popup-link'
  link.textContent = '상세 보기 →'
  // 슬러그 변환·NFC 정규화·encodeURIComponent 가 전부 이 유틸에 있다. 직접 조립하지 않는다.
  link.href = toRealEstateUrl({
    type: type as RealEstateUrlType,
    city: item.city,
    district: item.district,
    buildingName: item.buildingName,
  })
  el.appendChild(link)

  return el
}
```

그다음 `renderOverlays` 의 시그니처와 본문을 고친다. 함수 선언을 아래로 바꾼다.

```typescript
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderOverlays(
    map: any,
    items: MapItem[],
    handlers: OverlayHandlers = {},
    opts: { type?: string; selectedKey?: string | null } = {},
  ): void {
```

`clearOverlays()` 호출 뒤, `const kakao = ...` 앞에 렌더 순서를 정하는 코드를 넣는다.

```typescript
    // 선택된 항목을 맨 앞으로 옮긴다. 겹침 판정이 items 순서를 우선순위로 쓰므로
    // (아래 루프 주석 참고) 이렇게 해야 사용자가 방금 지목한 라벨이 점으로 접히지 않는다.
    const selectedKey = opts.selectedKey ?? null
    const ordered = selectedKey == null
      ? items
      : [
          ...items.filter((i) => isBuildingItem(i) && itemKey(i) === selectedKey),
          ...items.filter((i) => !(isBuildingItem(i) && itemKey(i) === selectedKey)),
        ]
    const isRent = (opts.type ?? '').endsWith('-rent')
```

루프의 `for (const item of items)` 를 `for (const item of ordered)` 로 바꾼다.

루프 안, `const building = isBuildingItem(item)` 뒤에 선택 여부를 계산하고, 겹침 판정과 요소 생성을 분기한다. `let collapsed = false` 선언 **바로 위**에 넣는다.

```typescript
      const selected = building && itemKey(item) === selectedKey
```

`let collapsed = false` 로 시작하는 겹침 블록의 조건을 `if (projection)` 에서 `if (projection && !selected)` 로 바꾼다. 선택된 항목은 겹쳐도 접지 않는다.

요소를 만드는 부분을 아래로 교체한다.

```typescript
      const el = selected
        ? buildPopup(item as MapBuildingItem, opts.type ?? '', isRent)
        : (() => {
            const d = document.createElement('div')
            d.className = collapsed
              ? 'map-price-dot'
              : building
                ? 'map-price-label'
                : 'map-region-bubble'
            // 점에도 값을 남긴다 — 호버 시 툴팁으로 뜨고, 스크린리더도 읽는다.
            if (collapsed) d.title = text
            else d.textContent = text
            return d
          })()
```

`handlers.onClick` 을 붙이는 부분은 그대로 둔다 — 펼침 카드를 다시 눌러야 접히기 때문이다. 다만 카드 안 링크를 눌렀을 때 접힘 토글이 함께 돌지 않도록, `onClick` 등록 코드를 아래로 바꾼다.

```typescript
      if (handlers.onClick) {
        el.addEventListener('click', (ev) => {
          // 펼침 카드의 상세 링크는 이동이 목적이다 — 토글까지 돌면 이동 직전에 카드가 접힌다.
          if ((ev.target as HTMLElement).closest('a')) return
          handlers.onClick!(item)
        })
      }
```

- [ ] **Step 4: 펼침 카드 스타일을 더한다**

`frontend/assets/css/main.css` 의 `.map-region-bubble` 관련 규칙들이 끝나는 지점, 같은 `@layer components` 블록 **안**에 넣는다. `.map-price-label` 선언은 238번째 줄 부근에 있다.

⚠️ 이 블록은 들여쓰기 2칸에 `@apply` 를 쓰는 컨벤션이다. 평범한 CSS 속성 나열로 쓰지 말 것 — 주변과 어긋나고 디자인 토큰(`line`, `ink`, `primary`)을 문자열로 다시 적게 된다.

```css
  /*
   * 선택된 마커의 펼침 카드. 기본 라벨(.map-price-label)이 알약 한 줄인 반면 이것은
   * 건물명·값·링크가 쌓이므로 사각 카드에 좌측 정렬이다.
   *
   * z-index 가 hover(3)보다 높다 — 펼친 카드는 이웃 라벨에 가려지면 안 된다.
   */
  .map-popup {
    @apply block cursor-pointer select-none whitespace-nowrap rounded-[10px]
           border border-line-2 bg-white px-[11px] pb-2 pt-[9px] text-left
           shadow-[0_3px_10px_rgba(21,33,59,0.16)];
    position: relative;
    z-index: 4;
    min-width: 130px;
  }

  .map-popup b {
    @apply mb-1 block text-[12.5px] font-semibold text-ink;
  }

  .map-popup-line {
    @apply block text-[12.5px] font-semibold leading-[1.45] text-primary;
  }

  /* 월세 줄. 전세를 주값으로 읽히게 하려고 한 급 낮춘다. */
  .map-popup-line--sub {
    @apply text-xs font-medium text-slate-700;
  }

  .map-popup-line i {
    @apply mr-1 text-[11px] font-medium not-italic text-faint;
  }

  .map-popup-link {
    @apply mt-1.5 block border-t border-line pt-1.5 text-[11.5px] font-semibold text-primary;
  }
```

- [ ] **Step 5: 테스트가 통과하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/composables/useMapOverlays.test.ts
```

Expected: 전부 PASS.

- [ ] **Step 6: 커밋**

```bash
git add frontend/composables/useMapOverlays.ts frontend/tests/composables/useMapOverlays.test.ts frontend/assets/css/main.css
git commit -m "feat(map): 마커 선택 시 값·상세 링크 펼침"
```

---

## Task 6: 선택 상태 배선

마커를 누르면 펼쳐지고, 다시 누르면 접히고, 다른 마커를 누르면 이전 것이 접히게 한다.

**Files:**
- Modify: `frontend/components/realEstate/map/RealEstateMapCanvas.vue`
- Modify: `frontend/components/realEstate/map/RealEstateMapExplorer.vue`
- Test: `frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts`

**Interfaces:**
- Consumes: Task 5 의 `renderOverlays(map, items, handlers, opts)` 4번째 인자; `itemKey` (`~/composables/useRealEstateMap`)
- Produces: 없음 (최종 배선)

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts` 파일 맨 끝에 덧붙인다.

⚠️ `global.stubs` 로 `RealEstateMapCanvas` 를 스텁하는 게 필수다. 이 파일의 기존 `mountExplorer` 헬퍼가 그렇게 하고 있다 — 스텁하지 않으면 진짜 캔버스가 마운트되어 카카오 SDK 를 찾다가 실패한다.

```typescript
describe('RealEstateMapExplorer — 마커 선택 토글', () => {
  const RENT_ITEM: MapItem = {
    buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
    lat: 37.5, lng: 127.06, latestPrice: 75000, monthlyRent: 340,
    latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 114,
    jeonseDeposit: 96000, jeonseDealKey: 20260712,
    wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
  }

  const CANVAS_STUB = { RealEstateMapCanvas: { template: '<div data-testid="canvas" />' } }

  function mountWithBuilding() {
    return mount(RealEstateMapExplorer, {
      props: {
        initialType: 'apt-rent',
        initialItems: [RENT_ITEM],
        initialGranularity: 'building',
      },
      global: { stubs: CANVAS_STUB },
    })
  }

  it('건물 선택 시 selectedKey 가 채워진다', async () => {
    const w = mountWithBuilding()
    await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', RENT_ITEM)
    await nextTick()
    expect(w.vm.selectedKey).toBe('은마|강남구')
  })

  it('같은 건물을 다시 고르면 접힌다', async () => {
    const w = mountWithBuilding()
    const sidebar = w.findComponent({ name: 'MapSidebar' })
    await sidebar.vm.$emit('select', RENT_ITEM)
    await nextTick()
    await sidebar.vm.$emit('select', RENT_ITEM)
    await nextTick()
    expect(w.vm.selectedKey).toBeNull()
  })

  it('지역 항목 선택은 selectedKey 를 건드리지 않는다 — 지역은 펼칠 값이 없다', async () => {
    const w = mount(RealEstateMapExplorer, {
      props: {
        initialType: 'apt-rent',
        initialItems: [{ name: '서울', district: null, dong: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 100 }],
        initialGranularity: 'city',
      },
      global: { stubs: CANVAS_STUB },
    })
    await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', w.props('initialItems')[0])
    await nextTick()
    expect(w.vm.selectedKey).toBeNull()
  })

  it('타입을 바꾸면 선택이 풀린다 — 다른 목록의 키가 남아 있으면 안 된다', async () => {
    const w = mountWithBuilding()
    await w.findComponent({ name: 'MapSidebar' }).vm.$emit('select', RENT_ITEM)
    await nextTick()
    await w.findComponent({ name: 'MapFilterBar' }).vm.$emit('update:type', 'apt-sale')
    await nextTick()
    expect(w.vm.selectedKey).toBeNull()
  })
})
```

⚠️ `w.vm.selectedKey` 를 읽으려면 `RealEstateMapExplorer.vue` 가 그것을 노출해야 한다. `<script setup>` 은 기본적으로 내부를 닫아 두므로 Step 3 에서 `defineExpose` 를 쓴다.

- [ ] **Step 2: 테스트가 실패하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/components/realEstate/map/RealEstateMapExplorer.test.ts
```

Expected: 새 `describe` 의 4개 FAIL (`w.vm.selectedKey` 가 `undefined`).

- [ ] **Step 3: Explorer 에 선택 상태를 넣는다**

`frontend/components/realEstate/map/RealEstateMapExplorer.vue` 의 `<script setup>` 에서 `const center = ref(...)` **바로 아래**에 넣는다.

```typescript
/**
 * 펼쳐진 건물 마커의 키. null 이면 전부 접힌 상태다.
 * 형식은 useRealEstateMap.itemKey 의 건물 분기와 같다 — `buildingName|district`.
 */
const selectedKey = ref<string | null>(null)
```

`onSelect` 함수를 아래로 바꾼다.

```typescript
function onSelect(item: MapItem): void {
  const { lat, lng } = item
  if (lat != null && lng != null && isWithinKoreaBounds(lat, lng)) {
    center.value = { lat, lng }
  }
  if (granularity.value === 'city') setLevel(9)
  else if (granularity.value === 'district') setLevel(7)
  else if (granularity.value === 'dong') setLevel(5)
  else {
    // 건물 단계에는 더 파고들 곳이 없다 — 대신 값과 상세 링크를 펼친다.
    // 같은 것을 다시 고르면 접는다.
    const key = itemKey(item)
    selectedKey.value = selectedKey.value === key ? null : key
  }
}
```

타입을 바꾸는 `onTypeChange` 함수 안, `setType(...)` 호출 뒤에 한 줄 더한다.

```typescript
  // 다른 목록으로 갈아타므로 이전 선택 키는 의미가 없다.
  selectedKey.value = null
```

`<script setup>` 맨 끝에 노출을 더한다.

```typescript
// 테스트가 선택 상태를 직접 확인할 수 있게 노출한다. script setup 은 기본적으로 닫혀 있다.
defineExpose({ selectedKey })
```

- [ ] **Step 4: 캔버스에 넘긴다**

`frontend/components/realEstate/map/RealEstateMapCanvas.vue` 의 `defineProps` 를 아래로 바꾼다.

```typescript
const props = defineProps<{
  items: MapItem[]
  center: { lat: number; lng: number }
  level: number
  type: string
  selectedKey: string | null
}>()
```

`renderOverlays` 호출이 **두 군데**(`onMounted` 안, `watch(() => props.items)` 안) 있다. 둘 다 네 번째 인자를 더한다.

```typescript
  renderOverlays(map.value, props.items, {
    onClick: (i) => emit('select', i),
    onHover: (i) => emit('hover', i),
  }, { type: props.type, selectedKey: props.selectedKey })
```

`watch` 안의 것은 콜백 인자 `items` 를 쓰므로 아래 형태다.

```typescript
watch(
  () => props.items,
  (items) => {
    if (import.meta.server || !map.value) return
    renderOverlays(map.value, items, {
      onClick: (i) => emit('select', i),
      onHover: (i) => emit('hover', i),
    }, { type: props.type, selectedKey: props.selectedKey })
  },
)
```

선택이 바뀌면 다시 그려야 하므로 watch 를 하나 더한다. 위 `watch(() => props.items, ...)` **바로 아래**에 넣는다.

```typescript
// 선택이 바뀌면 라벨↔펼침 카드가 달라지므로 다시 그린다. items 는 그대로라
// 위 watch 가 발화하지 않는다.
watch(
  () => props.selectedKey,
  () => {
    if (import.meta.server || !map.value) return
    renderOverlays(map.value, props.items, {
      onClick: (i) => emit('select', i),
      onHover: (i) => emit('hover', i),
    }, { type: props.type, selectedKey: props.selectedKey })
  },
)
```

- [ ] **Step 5: Explorer 템플릿에서 캔버스에 prop 을 넘긴다**

`RealEstateMapExplorer.vue` 의 `<RealEstateMapCanvas ... />` 에 두 속성을 더한다.

```html
          <RealEstateMapCanvas
            :items="items as MapItem[]"
            :center="center"
            :level="level"
            :type="type"
            :selected-key="selectedKey"
            @idle="onIdle"
            @select="onSelect"
            @hover="hoveredKey = $event ? itemKey($event) : null"
          />
```

- [ ] **Step 6: 테스트가 통과하는 걸 확인한다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npx vitest run tests/components/realEstate/map/
```

Expected: 전부 PASS.

- [ ] **Step 7: 프론트 전체 테스트와 린트를 돌린다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npm run test && npm run lint
```

Expected: 전부 PASS. (Node 20 에서 약 2,093건 통과. Node 25 면 무관한 27건이 실패한다.)

- [ ] **Step 8: 커밋**

```bash
git add frontend/components/realEstate/map/RealEstateMapCanvas.vue frontend/components/realEstate/map/RealEstateMapExplorer.vue frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts
git commit -m "feat(map): 마커 선택 토글 배선 — 건물 클릭 시 펼침"
```

---

## Task 7: 브라우저 실검증

단위 테스트로는 보이지 않는 것들을 실제 브라우저에서 확인한다. 이 프로젝트에서는 2,200건이 통과한 상태로도 페이지가 611px 스크롤된 이력이 있다.

**Files:**
- 코드 변경 없음. 발견된 결함이 있으면 해당 태스크 파일을 고친다.

**Interfaces:**
- Consumes: Task 1~6 전부
- Produces: 없음

- [ ] **Step 1: 로컬 데이터를 채운다**

Task 1 Step 7 에서 `offitel-rent` 만 채웠다. 지도에서 확인하려면 아파트도 필요하다.

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npx tsx -e "import('./src/services/realEstateSummaryService.js').then(m => m.refreshSummary('apt-rent')).then(n => console.log('rows', n))"
```

- [ ] **Step 2: 개발 서버를 띄운다**

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd backend && npm run dev
```

별도 셸에서:

```bash
export PATH="/Users/leemyeongseok/.nvm/versions/node/v20.19.5/bin:$PATH"
cd frontend && npm run dev
```

- [ ] **Step 3: 데스크톱에서 확인한다**

브라우저를 1440x900 으로 두고 `http://localhost:3000/real-estate/apt-rent#lat=37.4986&lng=127.0456&level=4` 를 연다.

확인할 것:
1. 좌측 목록의 건물 행이 두 줄이고, 전세·월세 라벨이 붙어 있다
2. 월세 거래가 없는 건물에 "거래 없음" 이 보인다
3. 마커 라벨은 한 줄이다
4. 마커를 누르면 펼침 카드가 뜨고 전세·월세·상세 보기가 있다
5. 같은 마커를 다시 누르면 접힌다
6. 다른 마커를 누르면 이전 것이 접힌다
7. 상세 보기를 누르면 그 건물 상세 페이지로 간다
8. **페이지가 세로로 스크롤되지 않는다** — 콘솔에서 `document.documentElement.scrollHeight - window.innerHeight` 가 0 이어야 한다

- [ ] **Step 4: 매매 탭을 확인한다**

`http://localhost:3000/real-estate/apt-sale#lat=37.4986&lng=127.0456&level=4`

확인할 것:
1. 목록 행이 한 줄이다 (전세/월세 라벨 없음)
2. 마커를 누르면 펼침 카드에 "매매" 한 줄과 상세 보기가 있다

- [ ] **Step 5: 모바일에서 확인한다**

브라우저를 390x844 로 바꾸고 같은 URL 을 연다.

확인할 것:
1. 바텀시트 목록이 두 줄로 보이고 잘리지 않는다
2. 시트를 펼쳤을 때(핸들 탭) 목록이 스크롤된다
3. 마커 펼침 카드가 화면 밖으로 나가지 않는다
4. **페이지가 스크롤되지 않는다**

- [ ] **Step 6: 발견한 것을 기록한다**

결함이 있으면 해당 태스크의 파일을 고치고 그 태스크의 테스트를 다시 돌린 뒤 커밋한다. 없으면 커밋 없이 넘어간다.

---

## Self-Review

**1. 스펙 커버리지**

| 스펙 항목 | 태스크 |
|---|---|
| §3 컬럼 5개 | 1 |
| §4 UPDATE 패스, 매매 스킵 | 1 |
| §5 SELECT·타입 | 2 |
| §6.1 목록 두 줄, "거래 없음", 매매 한 줄 | 3, 4 |
| §6.2 마커 한 줄 유지 | 5 (첫 테스트가 이걸 고정한다) |
| §6.3 펼침, 매매 공통, `toRealEstateUrl`, 선택 항목 우선 | 5, 6 |
| §7 영향 없음 (FORCE INDEX·WHERE 불변) | 2 (마지막 테스트) |
| §8 테스트 목록 | 1~6 각 태스크의 테스트 |

빠진 것 없음.

**2. 플레이스홀더 스캔**

"TBD"·"적절히"·"필요시" 없음. 모든 코드 단계에 실제 코드가 있다.

계획 작성 중 저장소에서 확인해 바로잡은 것 세 가지:
- `.map-price-label` 은 `frontend/assets/css/main.css:238` 의 `@layer components` 안에 있고 `@apply` 컨벤션을 쓴다 → Task 5 Step 4 를 그 형식으로 다시 썼다
- 새 필드가 `number | null`(optional 아님)이라 기존 `MapBuildingItem` 리터럴이 전부 깨진다. 전수 조사 결과 정확히 세 곳(`RealEstateMapExplorer.test.ts:18`, `MapSidebar.test.ts:18`, `MapSidebar.test.ts:221` 의 `manyBuildings`) → Task 3 에 Step 3 으로 넣었다
- `RealEstateMapExplorer.test.ts` 는 `global.stubs` 로 캔버스를 스텁한다. 안 하면 카카오 SDK 를 찾다 실패한다 → Task 6 테스트에 `CANVAS_STUB` 을 넣었다

**3. 타입 일관성**

- 컬럼 이름 5개가 Task 1(Prisma) → 2(백엔드 인터페이스·SQL) → 3(프론트 타입) 전부 동일: `jeonseDeposit`, `jeonseDealKey`, `wolseDeposit`, `wolseMonthlyRent`, `wolseDealKey`
- `formatJeonseLabel` / `formatWolseLabel` 이 Task 3 에서 정의되고 4·5 에서 같은 이름으로 쓰인다
- `renderOverlays` 4번째 인자 `{ type?, selectedKey? }` 가 Task 5 정의, Task 6 사용으로 일치
- 선택 키는 Task 5·6 이 **같은 함수** `itemKey` (`~/composables/useRealEstateMap`)를 쓴다. 초안에서는 Task 5 가 `buildingKey` 를 따로 정의했는데, 세팅 쪽과 대조 쪽이 두 벌이 되면 한쪽만 바뀌었을 때 선택이 조용히 멈춘다 — 순환 참조가 없음을 확인하고 재사용으로 바꿨다
