# 부동산 날짜 필터 sargable 전환 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산 집계 쿼리 20곳의 non-sargable 날짜 필터(`STR_TO_DATE(CONCAT(dealYear...))`)를 인덱스가 타는 복합 정수 조건 + 잔여필터로 바꿔 풀스캔을 제거한다.

**Architecture:** 공유 헬퍼 `dealDateRangeFilter(from, to, alias?)`가 `(dealYear,dealMonth)` 인덱스로 달 범위를 좁히는 복합 정수 조건 뒤에 기존 `STR_TO_DATE` 조건을 잔여필터로 붙여 결과 동등성을 보존한다. metaService 12곳은 상수 범위라 헬퍼를 그대로 끼우고, hotspot 8곳은 동적 `MAX(STR_TO_DATE)` anchor를 별도 쿼리로 분리한 뒤 slice에 같은 헬퍼를 재사용한다. 스키마·인덱스·sync 변경 없음.

**Tech Stack:** TypeScript (ESM), Prisma 6.19 (`Prisma.sql`/`Prisma.raw`/`Prisma.empty`), MySQL 8, Vitest

**스펙:** `docs/superpowers/specs/2026-07-20-realestate-date-filter-sargable-design.md`

## Global Constraints

- **Node 20 필수.** 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`.
- **`package-lock.json`을 삭제 후 재생성하지 말 것.** 새 의존성 0.
- **ESM:** 모든 로컬 import에 `.js` 확장자 필수.
- **PR 기반:** `develop`에서 분기, `develop`으로 PR. `main` 직접 커밋·자체 머지 금지.
- **스키마/인덱스/sync 변경 없음.** 코드만.
- **결과 동등성:** 반환 집계값이 수정 전과 동일해야 함. `STR_TO_DATE(...) BETWEEN from AND to` 잔여필터를 **절대 제거하지 말 것** — 정확한 일(day) 경계를 이것이 보존한다.
- **BigInt/Decimal 직렬화**·기존 반환 타입 불변.
- 테스트: `cd backend && npx vitest run`

## File Structure

- Create: `backend/src/services/realEstateDateFilter.ts` — 공유 헬퍼 `dealDateRangeFilter`
- Create: `backend/__tests__/services/realEstateDateFilter.test.ts` — 헬퍼 단위 테스트
- Modify: `backend/src/services/metaService.ts` — 12곳 치환 + import
- Modify: `backend/src/services/realEstateHotspotService.ts` — 8곳 anchor 분리 + import
- Modify: `backend/__tests__/services/realEstateHotspotService.test.ts` — anchor 분리로 늘어난 `$queryRaw` 호출에 맞춰 mock 시퀀스 갱신

---

### Task 1: 공유 헬퍼 `dealDateRangeFilter`

**Files:**
- Create: `backend/src/services/realEstateDateFilter.ts`
- Test: `backend/__tests__/services/realEstateDateFilter.test.ts`

**Interfaces:**
- Produces: `dealDateRangeFilter(from: string, to: string, alias?: string): Prisma.Sql`
  - `from`/`to`: `'YYYY-MM-DD'`. `alias`: 테이블 별칭(예: `'t'`), 없으면 컬럼 직접 참조.

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/services/realEstateDateFilter.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { dealDateRangeFilter } from '../../src/services/realEstateDateFilter.js';

// Prisma.sql 조각의 텍스트를 재구성 (values 는 ? 자리표시)
function sqlText(frag: Prisma.Sql): string {
  return frag.strings.join('?');
}

describe('dealDateRangeFilter', () => {
  it('같은 달: 정수 경계 + STR_TO_DATE 잔여를 모두 포함', () => {
    const frag = dealDateRangeFilter('2026-07-02', '2026-07-08');
    const text = sqlText(frag);
    expect(text).toContain('dealYear');
    expect(text).toContain('dealMonth');
    expect(text).toContain('STR_TO_DATE');
    // 바인딩: fy, fm, ty, tm, from, to (순서대로)
    expect(frag.values).toEqual([2026, 7, 2026, 7, '2026-07-02', '2026-07-08']);
  });

  it('월 경계: from=6월 to=7월 의 정수 경계', () => {
    const frag = dealDateRangeFilter('2026-06-28', '2026-07-04');
    expect(frag.values).toEqual([2026, 6, 2026, 7, '2026-06-28', '2026-07-04']);
  });

  it('연말 경계: from=2025-12 to=2026-01', () => {
    const frag = dealDateRangeFilter('2025-12-28', '2026-01-03');
    expect(frag.values).toEqual([2025, 12, 2026, 1, '2025-12-28', '2026-01-03']);
  });

  it('alias 있으면 t.dealYear 형태로 컬럼 참조', () => {
    const text = sqlText(dealDateRangeFilter('2026-07-02', '2026-07-08', 't'));
    expect(text).toContain('t.dealYear');
    expect(text).toContain('t.dealMonth');
    expect(text).toContain('t.dealDay');
  });

  it('alias 없으면 접두사 없는 컬럼', () => {
    const text = sqlText(dealDateRangeFilter('2026-07-02', '2026-07-08'));
    expect(text).toContain('dealYear');
    expect(text).not.toContain('t.dealYear');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/services/realEstateDateFilter.test.ts
```

Expected: FAIL — `dealDateRangeFilter` import 실패.

- [ ] **Step 3: 헬퍼 구현**

`backend/src/services/realEstateDateFilter.ts`:

```typescript
import { Prisma } from '@prisma/client';

/**
 * 부동산 거래의 날짜 범위 필터.
 *
 * WHERE 에 `STR_TO_DATE(CONCAT(dealYear,...)) BETWEEN from AND to` 만 쓰면 컬럼을
 * 함수로 감싸 (dealYear,dealMonth) 인덱스를 못 탄다(풀스캔). 그래서 앞에 인덱스가
 * 타는 복합 정수 조건으로 달 범위를 좁히고, STR_TO_DATE 는 잔여필터로 남겨 정확한
 * 일(day) 경계를 보존한다. 결과 집합은 STR_TO_DATE 단독과 비트 단위로 동일하다.
 *
 * @param from  'YYYY-MM-DD' (inclusive)
 * @param to    'YYYY-MM-DD' (inclusive)
 * @param alias 테이블 별칭(예 't'); 없으면 컬럼을 직접 참조
 */
export function dealDateRangeFilter(from: string, to: string, alias?: string): Prisma.Sql {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const p = alias ? `${alias}.` : '';
  const yCol = Prisma.raw(`${p}dealYear`);
  const mCol = Prisma.raw(`${p}dealMonth`);
  const dCol = Prisma.raw(`${p}dealDay`);
  return Prisma.sql`(${yCol} > ${fy} OR (${yCol} = ${fy} AND ${mCol} >= ${fm}))
    AND (${yCol} < ${ty} OR (${yCol} = ${ty} AND ${mCol} <= ${tm}))
    AND STR_TO_DATE(CONCAT(${yCol}, '-', LPAD(${mCol},2,'0'), '-', LPAD(COALESCE(${dCol},1),2,'0')), '%Y-%m-%d') BETWEEN ${from} AND ${to}`;
}
```

주의: `alias`는 코드 내 상수(`'t'`)에서만 온다. 사용자 입력 경로 없음 → `Prisma.raw` 안전.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run __tests__/services/realEstateDateFilter.test.ts
```

Expected: PASS — 5개 전부.

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull
git checkout -b fix/realestate-date-sargable
git add backend/src/services/realEstateDateFilter.ts backend/__tests__/services/realEstateDateFilter.test.ts
git -c commit.gpgsign=false commit -m "feat(realestate): 인덱스 타는 날짜범위 필터 헬퍼 추가

STR_TO_DATE(CONCAT(dealYear...)) 는 컬럼을 함수로 감싸 인덱스를 못 탄다.
복합 정수 조건으로 달 범위를 좁히고 STR_TO_DATE 를 잔여필터로 남긴다.
후속 커밋에서 metaService/hotspot 20곳이 이 헬퍼로 옮겨간다."
```

---

### Task 2: metaService.ts 12곳 치환

9개 aggregate 함수(`metaService.ts:261~373`) + `getTrendingBuildings`의 sale/jeonse/wolse 3개 CTE(`metaService.ts:505~`). 전부 상수 `from`/`to` 범위라 헬퍼를 그대로 끼운다. 전부 alias 없음(단일 테이블 / bucketed 서브쿼리).

**Files:**
- Modify: `backend/src/services/metaService.ts`

**Interfaces:**
- Consumes: `dealDateRangeFilter(from, to)` (Task 1)

- [ ] **Step 1: import 추가**

`metaService.ts` 상단 import 블록에 추가:

```typescript
import { dealDateRangeFilter } from './realEstateDateFilter.js';
```

- [ ] **Step 2: 9개 aggregate 함수 치환**

각 함수(`aggregateSaleRange`, `aggregateRentJeonseRange`, `aggregateRentWolseRange`, `aggregateVillaSaleRange`, `aggregateVillaRentJeonseRange`, `aggregateVillaRentWolseRange`, `aggregateOffitelSaleRange`, `aggregateOffitelRentJeonseRange`, `aggregateOffitelRentWolseRange`)에서 아래 블록을

```typescript
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
```

다음으로 교체(sale 계열 = WHERE 시작, rent 계열 = `WHERE rentType='전세'/'월세' AND` 유지):

sale 계열 3곳(`aggregateSaleRange`, `aggregateVillaSaleRange`, `aggregateOffitelSaleRange`):
```typescript
    WHERE ${dealDateRangeFilter(from, to)}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
```

rent 계열 6곳(`rentType = '전세'` 또는 `'월세'` 유지):
```typescript
    WHERE rentType = '전세'
      AND ${dealDateRangeFilter(from, to)}
      AND exclusiveArea IS NOT NULL AND exclusiveArea > 0`;
```
(월세 함수는 `rentType = '월세'`.)

각 함수의 `rentType` 리터럴은 원본 그대로 유지할 것(전세/월세 구분).

- [ ] **Step 3: getTrendingBuildings 3개 CTE 치환**

`getTrendingBuildings`(`metaService.ts:498~`)의 3개 `bucketed` 서브쿼리 WHERE에서

```typescript
        WHERE STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
```

를 다음으로 교체.

sale CTE(첫째, `FROM AptSaleTransaction`, rentType 없음):
```typescript
        WHERE ${dealDateRangeFilter(from, to)}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
```

jeonse CTE(둘째, `rentType = '전세'` 유지):
```typescript
        WHERE rentType = '전세'
          AND ${dealDateRangeFilter(from, to)}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
```

wolse CTE(셋째, `rentType = '월세'` 유지):
```typescript
        WHERE rentType = '월세'
          AND ${dealDateRangeFilter(from, to)}
          AND exclusiveArea IS NOT NULL AND exclusiveArea > 0
```

- [ ] **Step 4: 잔여 STR_TO_DATE 없음 확인 + 빌드**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
grep -c "STR_TO_DATE" src/services/metaService.ts
```
Expected: `0`. STR_TO_DATE는 전부 `dealDateRangeFilter` 헬퍼(별도 파일)로 이동했으므로 metaService.ts 본문에는 리터럴이 하나도 남지 않는다. `0`이 아니면 누락된 치환이 있다는 뜻 — `grep -n "STR_TO_DATE" src/services/metaService.ts`로 위치를 찾아 마저 치환. (참고: `COUNT(DISTINCT CASE WHEN type...)` 건물수 쿼리는 애초에 STR_TO_DATE가 없어 무관.)

```bash
source ~/.nvm/nvm.sh && nvm use 20
npx tsc --noEmit
npx vitest run
```
Expected: tsc 0 errors. 기존 테스트 전부 통과(기존 실패 flake `rentalPriceStats afterAll` 제외).

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/metaService.ts
git -c commit.gpgsign=false commit -m "perf(realestate): metaService 12곳 날짜필터 sargable 전환

9개 aggregate 함수 + getTrendingBuildings 3 CTE. STR_TO_DATE 풀스캔을
dealDateRangeFilter 로 교체해 dealYear_dealMonth_idx range 적중.
STR_TO_DATE 잔여필터 유지로 결과값 불변."
```

---

### Task 3: hotspot getPricedSliceHotspots anchor 분리 + slice 치환

`MAX(STR_TO_DATE(...))` anchor CTE를 별도 최신일 쿼리로 분리하고, 앱에서 날짜 경계를 계산해 recent/prior slice에 `dealDateRangeFilter(..., 't')`를 쓴다.

**Files:**
- Modify: `backend/src/services/realEstateHotspotService.ts` (`getPricedSliceHotspots`, `realEstateHotspotService.ts:84~168`)
- Test: `backend/__tests__/services/realEstateHotspotService.test.ts`

**Interfaces:**
- Consumes: `dealDateRangeFilter(from, to, 't')` (Task 1)
- 기존 시그니처 불변: `getPricedSliceHotspots(table, opts) => Promise<HotspotBundle>`

- [ ] **Step 1: 기존 테스트를 anchor 분리에 맞게 갱신 (실패 확인용)**

anchor 분리로 `$queryRaw` 호출이 **2회**(anchor 조회 + 본 쿼리)가 된다. 기존 `realEstateHotspotService.test.ts`의 `getPricedSliceHotspots` describe에서 `mockQueryRaw.mockResolvedValue([...])`(단일)를 순차 mock으로 바꾼다:

```typescript
    // 1) anchor 최신일 조회, 2) 본 slice 쿼리
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
        // ...기존 테스트가 쓰던 slice 결과 행 그대로...
      ]);
```

기존 테스트가 `mockResolvedValue`(모든 호출 동일값)를 썼다면, anchor 호출이 slice 결과 형태를 받아 깨진다 → 이 단계에서 순차로 교체해 새 계약을 못박는다. 그리고 anchor 빈 결과 시 빈 반환을 검증하는 케이스 추가:

```typescript
  it('거래가 없으면(anchor 빈 결과) 빈 번들 반환', async () => {
    mockQueryRaw.mockResolvedValueOnce([]); // anchor 0행
    const res = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 1 });
    expect(res.rising).toEqual([]);
    expect(res.falling).toEqual([]);
    expect(res.active).toEqual([]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1); // slice 쿼리는 실행 안 함
  });
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/services/realEstateHotspotService.test.ts
```
Expected: FAIL — 현재 구현은 anchor 조회 쿼리를 안 하므로 `toHaveBeenCalledTimes(1)`이 0 또는 슬라이스 1회로 불일치, 빈-anchor 케이스 미구현.

- [ ] **Step 3: getPricedSliceHotspots 재작성**

`realEstateHotspotService.ts`의 `getPricedSliceHotspots`(84~168행) 본문을 교체. import에 헬퍼 추가:

```typescript
import { dealDateRangeFilter } from './realEstateDateFilter.js';
```

함수 본문:

```typescript
export async function getPricedSliceHotspots(
  table: PricedSliceTable,
  opts: PricedSliceOptions,
): Promise<HotspotBundle> {
  const { sampleThreshold, rentTypeFilter } = opts;

  const rentTypeClause = rentTypeFilter
    ? Prisma.sql`AND t.rentType = ${rentTypeFilter}`
    : Prisma.empty;

  const priceExpr = table.includes('Sale')
    ? Prisma.sql`t.dealAmount`
    : Prisma.sql`t.deposit`;

  const tableRaw = Prisma.raw(table);

  // 국토부 실거래가는 30일 reporting lag이 있어 NOW() 기준 윈도우는 거의 비어있다.
  // 데이터의 최신 거래일(anchor)을 인덱스로 뽑아 "최근 7일 vs 직전 7일" 의미를 보존한다.
  // MAX(STR_TO_DATE(...)) 는 풀스캔이므로 ORDER BY ... LIMIT 1 (인덱스 후미 읽기)로 대체.
  const anchorRows = await prisma.$queryRaw<{ dealYear: number; dealMonth: number; dealDay: number | null }[]>`
    SELECT t.dealYear, t.dealMonth, t.dealDay
    FROM ${tableRaw} t
    WHERE 1=1 ${rentTypeClause}
    ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC
    LIMIT 1`;

  if (anchorRows.length === 0) {
    return { rising: [], falling: [], active: [] };
  }

  const a = anchorRows[0];
  const latest = new Date(Date.UTC(a.dealYear, a.dealMonth - 1, a.dealDay ?? 1));
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const minusDays = (n: number) => { const x = new Date(latest); x.setUTCDate(x.getUTCDate() - n); return ymd(x); };

  // recent: [latest-7, latest],  prior: [latest-14, latest-8] (= < latest-7)
  const recentFrom = minusDays(7), recentTo = minusDays(0);
  const priorFrom = minusDays(14), priorTo = minusDays(8);

  const rows = await prisma.$queryRaw<RawPricedRow[]>`
    WITH recent AS (
      SELECT t.city, t.district,
             AVG(${priceExpr} / (t.exclusiveArea / 3.3058)) AS pricePerPyeong,
             COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND ${dealDateRangeFilter(recentFrom, recentTo, 't')}
        ${rentTypeClause}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    ),
    prior AS (
      SELECT t.city, t.district,
             AVG(${priceExpr} / (t.exclusiveArea / 3.3058)) AS prevPrice,
             COUNT(*) AS prevTxnCount
      FROM ${tableRaw} t
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND ${dealDateRangeFilter(priorFrom, priorTo, 't')}
        ${rentTypeClause}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    )
    SELECT
      r.city AS city,
      reg.bjdCode AS bjdCode,
      reg.slug AS districtSlug,
      r.district AS district,
      r.pricePerPyeong AS pricePerPyeong,
      r.txnCount AS txnCount,
      CASE WHEN p.prevPrice IS NOT NULL AND p.prevTxnCount >= ${sampleThreshold}
           THEN (r.pricePerPyeong - p.prevPrice) / p.prevPrice * 100
           ELSE NULL END AS changePct,
      CASE WHEN p.prevTxnCount > 0
           THEN (CAST(r.txnCount AS DECIMAL) - p.prevTxnCount) / p.prevTxnCount * 100
           ELSE NULL END AS volumeChangePct
    FROM recent r
    LEFT JOIN prior p ON p.city = r.city AND p.district = r.district
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
  `;

  const all = normalizeAndGuard(rows);

  return {
    rising: all
      .filter((r) => r.changePct !== null && r.changePct > 0)
      .sort((a, b) => (b.changePct as number) - (a.changePct as number))
      .slice(0, MAX_PER_SIGNAL),
    falling: all
      .filter((r) => r.changePct !== null && r.changePct < 0)
      .sort((a, b) => (a.changePct as number) - (b.changePct as number))
      .slice(0, MAX_PER_SIGNAL),
    active: all
      .filter((r) => r.volumeChangePct !== null && r.volumeChangePct > 0)
      .sort((a, b) => (b.volumeChangePct as number) - (a.volumeChangePct as number))
      .slice(0, MAX_PER_SIGNAL),
  };
}
```

경계 근거: 원본 `recent`는 `STR_TO_DATE >= DATE_SUB(latest,7)`(상한 없음, 데이터 MAX=latest라 실질 `<= latest`) → `[latest-7, latest]`. 원본 `prior`는 `>= DATE_SUB(latest,14) AND < DATE_SUB(latest,7)` → 일 단위에서 `[latest-14, latest-8]`. `priorTo = minusDays(8)`가 `< latest-7`과 동등.

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run __tests__/services/realEstateHotspotService.test.ts
```
Expected: PASS — 갱신된 mock 시퀀스 + 빈-anchor 케이스 포함.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/realEstateHotspotService.ts backend/__tests__/services/realEstateHotspotService.test.ts
git -c commit.gpgsign=false commit -m "perf(realestate): hotspot priced 슬라이스 anchor 분리 + sargable

MAX(STR_TO_DATE) 풀스캔 anchor CTE 를 인덱스 타는 ORDER BY LIMIT 1 최신일
조회로 분리하고, recent/prior slice 를 dealDateRangeFilter 로 교체.
경계는 원본과 동일([latest-7,latest] / [latest-14,latest-8])."
```

---

### Task 4: hotspot getWolseHotspots anchor 분리 + slice 치환

`getPricedSliceHotspots`와 동일 패턴. `rentType='월세'` 고정, 평당가 없이 거래수만.

**Files:**
- Modify: `backend/src/services/realEstateHotspotService.ts` (`getWolseHotspots`, `realEstateHotspotService.ts:185~231`)
- Test: `backend/__tests__/services/realEstateHotspotService.test.ts`

**Interfaces:**
- Consumes: `dealDateRangeFilter(from, to, 't')` (Task 1)
- 기존 시그니처 불변: `getWolseHotspots(table, opts) => Promise<WolseHotspotBundle>`

- [ ] **Step 1: 기존 wolse 테스트 mock 순차화 + 빈-anchor 케이스**

`realEstateHotspotService.test.ts`의 `getWolseHotspots` describe에서 `$queryRaw` 호출이 2회가 되도록 갱신:

```typescript
    mockQueryRaw
      .mockResolvedValueOnce([{ dealYear: 2026, dealMonth: 2, dealDay: 26 }])
      .mockResolvedValueOnce([
        // ...기존 wolse slice 결과 행 그대로...
      ]);
```

빈-anchor 케이스:

```typescript
  it('거래가 없으면(anchor 빈 결과) 빈 active 반환', async () => {
    mockQueryRaw.mockResolvedValueOnce([]);
    const res = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 1 });
    expect(res.active).toEqual([]);
    expect(mockQueryRaw).toHaveBeenCalledTimes(1);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/services/realEstateHotspotService.test.ts
```
Expected: FAIL — 현재 wolse 구현은 anchor 조회 안 함.

- [ ] **Step 3: getWolseHotspots 재작성**

`getWolseHotspots`(185~231행) 본문의 anchor CTE + slice를 교체(SELECT 이후 반환 로직은 원본 유지):

```typescript
export async function getWolseHotspots(
  table: WolseTable,
  opts: { sampleThreshold: number },
): Promise<WolseHotspotBundle> {
  const { sampleThreshold } = opts;
  const tableRaw = Prisma.raw(table);

  // 최신 거래일 anchor (MAX(STR_TO_DATE) 풀스캔 대신 인덱스 후미 읽기)
  const anchorRows = await prisma.$queryRaw<{ dealYear: number; dealMonth: number; dealDay: number | null }[]>`
    SELECT t.dealYear, t.dealMonth, t.dealDay
    FROM ${tableRaw} t
    WHERE t.rentType = '월세'
    ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC
    LIMIT 1`;

  if (anchorRows.length === 0) {
    return { active: [] };
  }

  const a = anchorRows[0];
  const latest = new Date(Date.UTC(a.dealYear, a.dealMonth - 1, a.dealDay ?? 1));
  const ymd = (d: Date) => d.toISOString().slice(0, 10);
  const minusDays = (n: number) => { const x = new Date(latest); x.setUTCDate(x.getUTCDate() - n); return ymd(x); };

  const recentFrom = minusDays(7), recentTo = minusDays(0);
  const priorFrom = minusDays(14), priorTo = minusDays(8);

  const rows = await prisma.$queryRaw<RawWolseRow[]>`
    WITH recent AS (
      SELECT t.city, t.district, COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
        AND ${dealDateRangeFilter(recentFrom, recentTo, 't')}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    ),
    prior AS (
      SELECT t.city, t.district, COUNT(*) AS prevTxnCount
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
        AND ${dealDateRangeFilter(priorFrom, priorTo, 't')}
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    )
    SELECT
      r.city AS city,
      reg.bjdCode AS bjdCode,
      reg.slug AS districtSlug,
      r.district AS district,
      r.txnCount AS txnCount,
      CASE WHEN p.prevTxnCount > 0
           THEN (CAST(r.txnCount AS DECIMAL) - p.prevTxnCount) / p.prevTxnCount * 100
           ELSE NULL END AS volumeChangePct
    FROM recent r
    LEFT JOIN prior p ON p.city = r.city AND p.district = r.district
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
  `;
```

(이 `const rows` 이후의 `const active = rows.map(...)` 반환 로직은 원본 233행 이하 그대로 유지.)

- [ ] **Step 4: 테스트 통과 + 전체 스위트 + 빌드**

```bash
npx vitest run __tests__/services/realEstateHotspotService.test.ts
npx vitest run
npx tsc --noEmit
npm run lint
```
Expected: 대상 테스트 PASS, 전체 통과(rentalPriceStats afterAll flake 제외), tsc 0, lint 0 errors.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/realEstateHotspotService.ts backend/__tests__/services/realEstateHotspotService.test.ts
git -c commit.gpgsign=false commit -m "perf(realestate): hotspot 월세 슬라이스 anchor 분리 + sargable

getPricedSliceHotspots 와 동일 패턴. 남은 STR_TO_DATE anchor 풀스캔 제거."
```

---

### Task 5: 로컬 DB 결과 동등성 + EXPLAIN 검증

코드가 맞다는 것과 결과가 안 바뀌고 인덱스를 탄다는 것은 별개다. 모킹 테스트로는 SQL이 실행 안 되므로 로컬 실 DB로 확인한다.

**Files:** 없음(검증 전용, 커밋 없음)

- [ ] **Step 1: 로컬 DB 기동 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
docker compose up -d
docker compose exec -T mysql mysql -uilsangkit -pilsangkit123 ilsangkit -e "SELECT COUNT(*) FROM AptSaleTransaction;"
```
Expected: 100만 이상. (0이면 로컬 DB가 비어 동등성 대조 불가 → 그 사실을 보고하고 EXPLAIN만 수행.)

- [ ] **Step 2: 결과 동등성 대조 (sale + rent)**

로컬 데이터가 있는 날짜 범위를 먼저 확인한 뒤(예: `SELECT MAX(dealYear),MAX(dealMonth) FROM AptSaleTransaction`), 그 달의 7일 구간 `F`/`T`를 넣어 수정 전/후 쿼리를 대조:

```bash
docker compose exec -T mysql mysql -uilsangkit -pilsangkit123 ilsangkit -e "
SET SESSION MAX_EXECUTION_TIME=50000;
-- 수정 전(STR_TO_DATE 단독)
SELECT SUM(dealAmount) s0, COUNT(*) c0 FROM AptSaleTransaction
  WHERE STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN 'F' AND 'T'
    AND exclusiveArea IS NOT NULL AND exclusiveArea>0;
-- 수정 후(복합정수 + 잔여)
SELECT SUM(dealAmount) s1, COUNT(*) c1 FROM AptSaleTransaction
  WHERE (dealYear>YF OR (dealYear=YF AND dealMonth>=MF)) AND (dealYear<YT OR (dealYear=YT AND dealMonth<=MT))
    AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN 'F' AND 'T'
    AND exclusiveArea IS NOT NULL AND exclusiveArea>0;
"
```
(`F`/`T`=날짜, `YF`/`MF`/`YT`/`MT`=그 연·월 정수로 치환.) rent 전세로도 1회 반복(`AptRentTransaction`, `rentType='전세'`, `deposit`).

Expected: `s0==s1` **그리고** `c0==c1`. **다르면 STOP하고 보고** — 헬퍼 경계 로직 버그.

- [ ] **Step 3: EXPLAIN — 인덱스 range 확인**

```bash
docker compose exec -T mysql mysql -uilsangkit -pilsangkit123 ilsangkit -e "
EXPLAIN SELECT SUM(dealAmount),COUNT(*) FROM AptSaleTransaction
  WHERE (dealYear>YF OR (dealYear=YF AND dealMonth>=MF)) AND (dealYear<YT OR (dealYear=YT AND dealMonth<=MT))
    AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN 'F' AND 'T'\G" 2>&1 | grep -E "type:|key:|rows:"
```
Expected: `type: range`, `key: ..._dealYear_dealMonth_idx`. (현재 코드 대비 `type: index`/풀스캔에서 개선.)

- [ ] **Step 4: 검증 결과를 보고**

동등성 통과 여부 + EXPLAIN type/key + rows 감소폭을 요약. (PR은 finishing-a-development-branch에서 연다.)

---

## Self-Review

**1. Spec coverage:**
- 헬퍼 `dealDateRangeFilter` → Task 1 ✓
- metaService 12곳(9 aggregate + 3 trending) → Task 2 ✓
- hotspot 8곳(priced 4 + wolse 4) anchor 분리 → Task 3, 4 ✓
- 결과 동등성(로컬 DB) + EXPLAIN → Task 5 ✓
- 헬퍼 단위테스트(같은달/월경계/연말/alias) → Task 1 ✓
- hotspot 회귀(mock 시퀀스 갱신) → Task 3, 4 ✓
- 범위 밖(COUNT DISTINCT 건물수, 인덱스/스키마) → 손대지 않음, Task 2 Step 4에 명시 ✓

**2. Placeholder scan:** Task 5의 `F/T/YF/MF/YT/MT`는 플레이스홀더가 아니라 "로컬 데이터에서 확인 후 치환"을 명시한 파라미터(실 데이터 의존이라 고정 불가). 나머지 코드 블록은 전부 완전.

**3. Type consistency:** `dealDateRangeFilter(from: string, to: string, alias?: string): Prisma.Sql` — Task 1 정의, Task 2(alias 없음)·3·4(alias `'t'`) 사용 일치. anchor 행 타입 `{dealYear, dealMonth, dealDay}` Task 3·4 동일.
