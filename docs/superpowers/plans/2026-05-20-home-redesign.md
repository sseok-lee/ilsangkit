# 메인 페이지 리디자인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 페이지 상단을 일 단위 sync되는 부동산·청약 데이터의 라이브 통계 중심으로 재편한다.

**Architecture:** 백엔드는 단일 endpoint `GET /api/meta/home-dashboard`가 4개의 작은 service 함수(`getNewlyListedToday`, `getRealEstateTrends`, `getTrendingBuildings`, `getSubscriptionSummary`)를 `Promise.all` 병렬 호출해 결과를 합성한다. 1시간 in-memory 캐시. 프론트는 `useHomeDashboard` 컴포저블 1회 SSR fetch 후 prop drilling으로 표현 컴포넌트(`HomeMarketStats`, `HomeTrendingBuildings`, `HomeSubscriptionSection`)에 주입한다.

**Tech Stack:** Backend: Express 5 + TypeScript ESM + Prisma + Vitest. Frontend: Nuxt 3 + Vue 3 + TailwindCSS + Vitest.

**Spec:** [`docs/superpowers/specs/2026-05-20-home-redesign-design.md`](../specs/2026-05-20-home-redesign-design.md)
**Mockup:** [`docs/superpowers/specs/2026-05-20-home-redesign-mockup.html`](../specs/2026-05-20-home-redesign-mockup.html)

---

## File Structure

### Backend

| 파일 | 책임 |
|------|------|
| `backend/src/services/metaService.ts` (수정) | `getHomeDashboard()` + 4개 헬퍼 (`getNewlyListedToday`, `getRealEstateTrends`, `getTrendingBuildings`, `getSubscriptionSummary`) + 캐시 |
| `backend/src/types/homeDashboard.ts` (신규) | 응답 타입 정의 |
| `backend/src/routes/meta.ts` (수정) | `GET /api/meta/home-dashboard` 라우트 추가 |
| `backend/__tests__/services/homeDashboard.test.ts` (신규) | 4개 헬퍼 + 컴포지트 + 캐시 테스트 |
| `backend/__tests__/routes/metaHomeDashboard.test.ts` (신규) | 라우트 통합 테스트 |

### Frontend

| 파일 | 책임 |
|------|------|
| `frontend/composables/useHomeDashboard.ts` (신규) | `/api/meta/home-dashboard` SSR fetch + 타입 export |
| `frontend/components/home/HomeMarketStats.vue` (신규) | 통계 3카드 표현 컴포넌트 |
| `frontend/components/home/HomeTrendingBuildings.vue` (신규) | 인기 단지 3컬럼 표현 컴포넌트 |
| `frontend/components/subscription/HomeSubscriptionSection.vue` (수정) | 요약 + D-3 임박 + 누락 메타 라인 추가 |
| `frontend/pages/index.vue` (수정) | 기존 "오늘 확인할 정보" 3카드 + "부동산 실거래가" 3카드 제거, 새 컴포넌트 wire-up, 광고 위치 재정렬, 라이브 뱃지 |
| `frontend/utils/priceFormat.ts` (신규) | `formatPrice(manwon)`, `formatChange(pct)` 유틸 |
| `frontend/tests/components/home/HomeMarketStats.test.ts` (신규) | 정상/null/0건 |
| `frontend/tests/components/home/HomeTrendingBuildings.test.ts` (신규) | 3컬럼/부족건수/0건 |
| `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts` (수정/신규) | 임박/요약/누락 메타 |
| `frontend/tests/utils/priceFormat.test.ts` (신규) | 포맷 유틸 단위 |

### 분할 PR

1. **PR #1** — 백엔드 endpoint + 테스트 (Task 1-7)
2. **PR #2** — 프론트 유틸 + composable + HomeMarketStats (Task 8-11)
3. **PR #3** — HomeTrendingBuildings (Task 12-13)
4. **PR #4** — HomeSubscriptionSection 강화 (Task 14-15)
5. **PR #5** — index.vue 재편 + 기존 카드 제거 + 광고 재정렬 + 라이브 뱃지 (Task 16-18)

---

## Task 1: 응답 타입 정의

**Files:**
- Create: `backend/src/types/homeDashboard.ts`

- [ ] **Step 1: 타입 파일 생성**

```ts
// backend/src/types/homeDashboard.ts
export type TrendingBuildingItem = {
  buildingName: string;
  city: string;       // 정식명 ('서울특별시')
  district: string;
  txnCount: number;
  avgPrice: number | null;       // sale: dealAmount 평균(만원). jeonse: deposit 평균(만원). wolse: deposit 평균(만원)
  avgMonthlyRent: number | null; // wolse에만 채워짐 (monthlyRent 평균, 만원)
};

export type RealEstateTrend = {
  key: 'apt-sale' | 'apt-rent-jeonse' | 'offitel-sale';
  label: string;
  avgPrice: number | null;
  txnCount: number;
  prevAvgPrice: number | null;
  changePct: number | null;
};

export type SubscriptionImminent = {
  id: number;
  houseName: string;
  regionName: string;
  endDate: string; // ISO yyyy-mm-dd
};

export type HomeDashboardResponse = {
  // 기존 stats superset
  total: number;
  buildingCount: number;
  realEstateBuildings: { apt: number; villa: number; offitel: number };
  subscriptionActiveCount: number;

  // 신규
  newlyListedToday: number;
  realEstateTrends: RealEstateTrend[];
  trendingBuildings: {
    sale: TrendingBuildingItem[];
    jeonse: TrendingBuildingItem[];
    wolse: TrendingBuildingItem[];
  };
  subscriptionSummary: {
    closingThisWeek: number;
    upcomingNextWeek: number;
    avgSupplyPrice: number | null;
    imminent: SubscriptionImminent[];
  };
};
```

- [ ] **Step 2: 커밋**

```bash
git add backend/src/types/homeDashboard.ts
git commit -m "feat(types): add HomeDashboardResponse types"
```

---

## Task 2: `getNewlyListedToday` 서비스 헬퍼 + 테스트

**Files:**
- Create: `backend/__tests__/services/homeDashboard.test.ts`
- Modify: `backend/src/services/metaService.ts` (append)

- [ ] **Step 1: 실패 테스트 작성**

```ts
// backend/__tests__/services/homeDashboard.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockAptSaleCount, mockAptRentCount, mockVillaSaleCount, mockVillaRentCount, mockOffitelSaleCount, mockOffitelRentCount } = vi.hoisted(() => ({
  mockAptSaleCount: vi.fn(),
  mockAptRentCount: vi.fn(),
  mockVillaSaleCount: vi.fn(),
  mockVillaRentCount: vi.fn(),
  mockOffitelSaleCount: vi.fn(),
  mockOffitelRentCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    aptSaleTransaction: { count: mockAptSaleCount },
    aptRentTransaction: { count: mockAptRentCount },
    villaSaleTransaction: { count: mockVillaSaleCount },
    villaRentTransaction: { count: mockVillaRentCount },
    offitelSaleTransaction: { count: mockOffitelSaleCount },
    offitelRentTransaction: { count: mockOffitelRentCount },
  },
}));

import { getNewlyListedToday } from '../../src/services/metaService.js';

describe('getNewlyListedToday', () => {
  beforeEach(() => {
    mockAptSaleCount.mockReset();
    mockAptRentCount.mockReset();
    mockVillaSaleCount.mockReset();
    mockVillaRentCount.mockReset();
    mockOffitelSaleCount.mockReset();
    mockOffitelRentCount.mockReset();
  });

  it('returns sum of 6 transaction tables filtered by createdAt >= today 00:00 KST', async () => {
    mockAptSaleCount.mockResolvedValue(100);
    mockAptRentCount.mockResolvedValue(50);
    mockVillaSaleCount.mockResolvedValue(20);
    mockVillaRentCount.mockResolvedValue(10);
    mockOffitelSaleCount.mockResolvedValue(5);
    mockOffitelRentCount.mockResolvedValue(3);

    const result = await getNewlyListedToday();

    expect(result).toBe(188);
    // 호출 시 createdAt gte 가 모두 같은 값(=오늘 00:00 KST)인지 검증
    const calls = [mockAptSaleCount, mockAptRentCount, mockVillaSaleCount, mockVillaRentCount, mockOffitelSaleCount, mockOffitelRentCount];
    const firstGte = calls[0].mock.calls[0][0].where.createdAt.gte;
    expect(firstGte).toBeInstanceOf(Date);
    for (const c of calls) {
      expect(c.mock.calls[0][0].where.createdAt.gte).toEqual(firstGte);
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts`
Expected: FAIL with `getNewlyListedToday is not a function`

- [ ] **Step 3: `getNewlyListedToday` 구현 (metaService.ts append)**

```ts
// backend/src/services/metaService.ts 끝에 추가

/**
 * 오늘 00:00 KST 이후 createdAt 인 실거래 row 수 합산.
 * "오늘 새로 등록된 거래" 라이브 뱃지에 사용.
 */
export async function getNewlyListedToday(): Promise<number> {
  const todayKstStart = startOfTodayKst();
  const [a, b, c, d, e, f] = await Promise.all([
    prisma.aptSaleTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.aptRentTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.villaSaleTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.villaRentTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.offitelSaleTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
    prisma.offitelRentTransaction.count({ where: { createdAt: { gte: todayKstStart } } }),
  ]);
  return a + b + c + d + e + f;
}

/** KST(UTC+9) 기준 오늘 00:00 의 UTC Date 객체. */
export function startOfTodayKst(): Date {
  const now = new Date();
  // 현재 UTC 시각 + 9h = KST 시각. KST 자정으로 절단 후 -9h = 다시 UTC.
  const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  kstNow.setUTCHours(0, 0, 0, 0);
  return new Date(kstNow.getTime() - 9 * 60 * 60 * 1000);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/metaService.ts backend/__tests__/services/homeDashboard.test.ts
git commit -m "feat(meta): add getNewlyListedToday helper"
```

---

## Task 3: `getRealEstateTrends` 헬퍼 + 테스트

**Files:**
- Modify: `backend/__tests__/services/homeDashboard.test.ts` (append)
- Modify: `backend/src/services/metaService.ts` (append)

- [ ] **Step 1: 실패 테스트 작성 (위 파일에 append)**

```ts
// homeDashboard.test.ts 의 vi.hoisted({...}) 에 다음 mock 추가:
//   mockAptSaleAggregate, mockAptRentAggregate, mockOffitelSaleAggregate (3개)
// 그리고 vi.mock('../../src/lib/prisma.js') 의 prisma 객체에 `aggregate: mockXxxAggregate` 키 추가.

import { getRealEstateTrends } from '../../src/services/metaService.js';

describe('getRealEstateTrends', () => {
  beforeEach(() => {
    mockAptSaleAggregate.mockReset();
    mockAptRentAggregate.mockReset();
    mockOffitelSaleAggregate.mockReset();
  });

  it('returns 3 slots: apt-sale, apt-rent-jeonse, offitel-sale with avg / count / changePct', async () => {
    // apt-sale: 최근 7일 avg=54000 만원, count=2481 / 직전 7일 avg=52800
    mockAptSaleAggregate.mockResolvedValueOnce({ _avg: { dealAmount: 54000n }, _count: { _all: 2481 } });
    mockAptSaleAggregate.mockResolvedValueOnce({ _avg: { dealAmount: 52800n }, _count: { _all: 2300 } });
    // apt-rent-jeonse
    mockAptRentAggregate.mockResolvedValueOnce({ _avg: { deposit: 31000n }, _count: { _all: 1742 } });
    mockAptRentAggregate.mockResolvedValueOnce({ _avg: { deposit: 31250n }, _count: { _all: 1800 } });
    // offitel-sale (prev 0건 → changePct null)
    mockOffitelSaleAggregate.mockResolvedValueOnce({ _avg: { dealAmount: 22000n }, _count: { _all: 318 } });
    mockOffitelSaleAggregate.mockResolvedValueOnce({ _avg: { dealAmount: null }, _count: { _all: 0 } });

    const trends = await getRealEstateTrends();

    expect(trends).toHaveLength(3);
    const [aptSale, jeonse, offitelSale] = trends;

    expect(aptSale).toMatchObject({ key: 'apt-sale', avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800 });
    expect(aptSale.changePct).toBeCloseTo(((54000 - 52800) / 52800) * 100, 3);

    expect(jeonse).toMatchObject({ key: 'apt-rent-jeonse', avgPrice: 31000 });
    expect(jeonse.changePct).toBeLessThan(0);

    expect(offitelSale).toMatchObject({ key: 'offitel-sale', avgPrice: 22000, prevAvgPrice: null, changePct: null });
  });

  it('returns null avgPrice and changePct when current period has 0 rows', async () => {
    mockAptSaleAggregate.mockResolvedValue({ _avg: { dealAmount: null }, _count: { _all: 0 } });
    mockAptRentAggregate.mockResolvedValue({ _avg: { deposit: null }, _count: { _all: 0 } });
    mockOffitelSaleAggregate.mockResolvedValue({ _avg: { dealAmount: null }, _count: { _all: 0 } });

    const trends = await getRealEstateTrends();
    for (const t of trends) {
      expect(t.avgPrice).toBeNull();
      expect(t.changePct).toBeNull();
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts`
Expected: FAIL with `getRealEstateTrends is not a function`

- [ ] **Step 3: `getRealEstateTrends` 구현 (metaService.ts append)**

```ts
import type { RealEstateTrend } from '../types/homeDashboard.js';

/** 거래일(dealYear/dealMonth/dealDay) 기준 N일 전 ~ M일 전 범위의 평균/카운트 (Sale). */
async function aggregateSaleRange(daysFrom: number, daysTo: number) {
  // dealYear/Month/Day → "YYYY-MM-DD" 비교용
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  // Prisma 는 (year, month, day) 복합 비교가 어려워 raw SQL 사용
  const rows = await prisma.$queryRaw<[{ avg: number | null; cnt: bigint }]>`
    SELECT AVG(dealAmount) AS avg, COUNT(*) AS cnt
    FROM AptSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}`;
  const row = rows[0];
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: Number(row?.cnt ?? 0) };
}

async function aggregateRentJeonseRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[{ avg: number | null; cnt: bigint }]>`
    SELECT AVG(deposit) AS avg, COUNT(*) AS cnt
    FROM AptRentTransaction
    WHERE rentType = '전세'
      AND STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}`;
  const row = rows[0];
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: Number(row?.cnt ?? 0) };
}

async function aggregateOffitelSaleRange(daysFrom: number, daysTo: number) {
  const from = ymdNDaysAgo(daysFrom);
  const to = ymdNDaysAgo(daysTo);
  const rows = await prisma.$queryRaw<[{ avg: number | null; cnt: bigint }]>`
    SELECT AVG(dealAmount) AS avg, COUNT(*) AS cnt
    FROM OffitelSaleTransaction
    WHERE STR_TO_DATE(CONCAT(dealYear, '-', LPAD(dealMonth,2,'0'), '-', LPAD(COALESCE(dealDay,1),2,'0')), '%Y-%m-%d')
          BETWEEN ${from} AND ${to}`;
  const row = rows[0];
  return { avg: row?.avg === null || row?.avg === undefined ? null : Number(row.avg), count: Number(row?.cnt ?? 0) };
}

function ymdNDaysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

function calcChangePct(cur: number | null, prev: number | null): number | null {
  if (cur === null || prev === null || prev === 0) return null;
  return ((cur - prev) / prev) * 100;
}

export async function getRealEstateTrends(): Promise<RealEstateTrend[]> {
  const [aptCurr, aptPrev, jeonseCurr, jeonsePrev, offCurr, offPrev] = await Promise.all([
    aggregateSaleRange(7, 0),
    aggregateSaleRange(14, 8),
    aggregateRentJeonseRange(7, 0),
    aggregateRentJeonseRange(14, 8),
    aggregateOffitelSaleRange(7, 0),
    aggregateOffitelSaleRange(14, 8),
  ]);

  return [
    {
      key: 'apt-sale',
      label: '아파트 매매',
      avgPrice: aptCurr.avg,
      txnCount: aptCurr.count,
      prevAvgPrice: aptPrev.avg,
      changePct: calcChangePct(aptCurr.avg, aptPrev.avg),
    },
    {
      key: 'apt-rent-jeonse',
      label: '아파트 전세',
      avgPrice: jeonseCurr.avg,
      txnCount: jeonseCurr.count,
      prevAvgPrice: jeonsePrev.avg,
      changePct: calcChangePct(jeonseCurr.avg, jeonsePrev.avg),
    },
    {
      key: 'offitel-sale',
      label: '오피스텔 매매',
      avgPrice: offCurr.avg,
      txnCount: offCurr.count,
      prevAvgPrice: offPrev.avg,
      changePct: calcChangePct(offCurr.avg, offPrev.avg),
    },
  ];
}
```

**Note:** raw SQL 사용이라 위 테스트는 `aggregate` mock이 아닌 `$queryRaw` mock으로 수정 필요. Step 1 테스트를 다음으로 변경:

```ts
// hoisted에 mockQueryRaw 추가
const { mockQueryRaw, ... } = vi.hoisted(() => ({ mockQueryRaw: vi.fn(), ... }));
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { ..., $queryRaw: mockQueryRaw },
}));

// 테스트 내부에서 queryRaw 호출 순서대로 mock:
mockQueryRaw
  .mockResolvedValueOnce([{ avg: 54000, cnt: 2481n }])  // aptCurr
  .mockResolvedValueOnce([{ avg: 52800, cnt: 2300n }])  // aptPrev
  .mockResolvedValueOnce([{ avg: 31000, cnt: 1742n }])  // jeonseCurr
  .mockResolvedValueOnce([{ avg: 31250, cnt: 1800n }])  // jeonsePrev
  .mockResolvedValueOnce([{ avg: 22000, cnt: 318n }])   // offCurr
  .mockResolvedValueOnce([{ avg: null, cnt: 0n }]);     // offPrev
```

Step 1 테스트 코드의 `mockAptSaleAggregate` 등은 `mockQueryRaw.mockResolvedValueOnce(...)`로 교체하세요.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts`
Expected: PASS (모든 케이스)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/metaService.ts backend/__tests__/services/homeDashboard.test.ts
git commit -m "feat(meta): add getRealEstateTrends 7day rolling stats"
```

---

## Task 4: `getTrendingBuildings` 헬퍼 + 테스트

**Files:**
- Modify: `backend/__tests__/services/homeDashboard.test.ts` (append)
- Modify: `backend/src/services/metaService.ts` (append)

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { getTrendingBuildings } from '../../src/services/metaService.js';

describe('getTrendingBuildings', () => {
  it('returns 3 lists (sale/jeonse/wolse) sorted by txnCount desc, capped at 5', async () => {
    mockQueryRaw
      // sale
      .mockResolvedValueOnce([
        { buildingName: '헬리오시티', city: '서울특별시', district: '송파구', txnCount: 17n, avgPrice: 184000 },
        { buildingName: '은마아파트', city: '서울특별시', district: '강남구', txnCount: 14n, avgPrice: 267000 },
      ])
      // jeonse
      .mockResolvedValueOnce([
        { buildingName: '파크리오', city: '서울특별시', district: '송파구', txnCount: 22n, avgPrice: 84000 },
      ])
      // wolse
      .mockResolvedValueOnce([
        { buildingName: '아크로리버파크', city: '서울특별시', district: '서초구', txnCount: 9n, avgPrice: 20000, avgMonthlyRent: 120 },
      ]);

    const result = await getTrendingBuildings();

    expect(result.sale[0]).toMatchObject({ buildingName: '헬리오시티', txnCount: 17, avgPrice: 184000, avgMonthlyRent: null });
    expect(result.jeonse[0]).toMatchObject({ buildingName: '파크리오', txnCount: 22, avgPrice: 84000, avgMonthlyRent: null });
    expect(result.wolse[0]).toMatchObject({ buildingName: '아크로리버파크', avgPrice: 20000, avgMonthlyRent: 120 });
  });

  it('returns empty arrays when no data', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const result = await getTrendingBuildings();
    expect(result.sale).toEqual([]);
    expect(result.jeonse).toEqual([]);
    expect(result.wolse).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts -t getTrendingBuildings`
Expected: FAIL

- [ ] **Step 3: `getTrendingBuildings` 구현**

```ts
import type { TrendingBuildingItem } from '../types/homeDashboard.js';

export async function getTrendingBuildings(): Promise<{ sale: TrendingBuildingItem[]; jeonse: TrendingBuildingItem[]; wolse: TrendingBuildingItem[] }> {
  const from = ymdNDaysAgo(7);
  const to = ymdNDaysAgo(0);

  const [sale, jeonse, wolse] = await Promise.all([
    prisma.$queryRaw<Array<{ buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null }>>`
      SELECT buildingName, city, district, COUNT(*) AS txnCount, AVG(dealAmount) AS avgPrice
      FROM AptSaleTransaction
      WHERE STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
      GROUP BY buildingName, city, district
      ORDER BY txnCount DESC
      LIMIT 5`,
    prisma.$queryRaw<Array<{ buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null }>>`
      SELECT buildingName, city, district, COUNT(*) AS txnCount, AVG(deposit) AS avgPrice
      FROM AptRentTransaction
      WHERE rentType = '전세'
        AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
      GROUP BY buildingName, city, district
      ORDER BY txnCount DESC
      LIMIT 5`,
    prisma.$queryRaw<Array<{ buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null; avgMonthlyRent: number | null }>>`
      SELECT buildingName, city, district, COUNT(*) AS txnCount, AVG(deposit) AS avgPrice, AVG(monthlyRent) AS avgMonthlyRent
      FROM AptRentTransaction
      WHERE rentType = '월세'
        AND STR_TO_DATE(CONCAT(dealYear,'-',LPAD(dealMonth,2,'0'),'-',LPAD(COALESCE(dealDay,1),2,'0')),'%Y-%m-%d') BETWEEN ${from} AND ${to}
      GROUP BY buildingName, city, district
      ORDER BY txnCount DESC
      LIMIT 5`,
  ]);

  const toItem = (r: { buildingName: string; city: string; district: string; txnCount: bigint; avgPrice: number | null; avgMonthlyRent?: number | null }): TrendingBuildingItem => ({
    buildingName: r.buildingName,
    city: r.city,
    district: r.district,
    txnCount: Number(r.txnCount),
    avgPrice: r.avgPrice === null || r.avgPrice === undefined ? null : Number(r.avgPrice),
    avgMonthlyRent: r.avgMonthlyRent === null || r.avgMonthlyRent === undefined ? null : Number(r.avgMonthlyRent),
  });

  return {
    sale: sale.map((r) => ({ ...toItem(r), avgMonthlyRent: null })),
    jeonse: jeonse.map((r) => ({ ...toItem(r), avgMonthlyRent: null })),
    wolse: wolse.map(toItem),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add -A backend/
git commit -m "feat(meta): add getTrendingBuildings 3-list (sale/jeonse/wolse)"
```

---

## Task 5: `getSubscriptionSummary` 헬퍼 + 테스트

**Files:**
- Modify: `backend/__tests__/services/homeDashboard.test.ts` (append)
- Modify: `backend/src/services/metaService.ts` (append)

- [ ] **Step 1: 실패 테스트 작성**

```ts
const { mockSubscriptionCount, mockSubscriptionAggregate, mockSubscriptionFindMany, ...rest } = vi.hoisted(() => ({
  mockSubscriptionCount: vi.fn(),
  mockSubscriptionAggregate: vi.fn(),
  mockSubscriptionFindMany: vi.fn(),
  ...
}));
// vi.mock prisma 객체에 subscription: { count, aggregate, findMany } 추가

import { getSubscriptionSummary } from '../../src/services/metaService.js';

describe('getSubscriptionSummary', () => {
  beforeEach(() => {
    mockSubscriptionCount.mockReset();
    mockSubscriptionAggregate.mockReset();
    mockSubscriptionFindMany.mockReset();
  });

  it('returns closingThisWeek + upcomingNextWeek counts and imminent list (D-3)', async () => {
    mockSubscriptionCount.mockResolvedValueOnce(8);  // closingThisWeek
    mockSubscriptionCount.mockResolvedValueOnce(12); // upcomingNextWeek
    mockSubscriptionAggregate.mockResolvedValue({ _avg: { supplyPrice: 68000 } });
    mockSubscriptionFindMany.mockResolvedValue([
      { id: 1, houseName: '래미안 강동 팰리스', regionName: '서울 강동구', receptionEndDate: new Date('2026-05-21') },
      { id: 2, houseName: '힐스테이트 광교', regionName: '경기 수원시', receptionEndDate: new Date('2026-05-22') },
    ]);

    const result = await getSubscriptionSummary();

    expect(result.closingThisWeek).toBe(8);
    expect(result.upcomingNextWeek).toBe(12);
    expect(result.avgSupplyPrice).toBe(68000);
    expect(result.imminent).toHaveLength(2);
    expect(result.imminent[0]).toMatchObject({ id: 1, houseName: '래미안 강동 팰리스', regionName: '서울 강동구', endDate: '2026-05-21' });
  });

  it('avgSupplyPrice null when aggregate returns null', async () => {
    mockSubscriptionCount.mockResolvedValue(0);
    mockSubscriptionAggregate.mockResolvedValue({ _avg: { supplyPrice: null } });
    mockSubscriptionFindMany.mockResolvedValue([]);

    const result = await getSubscriptionSummary();
    expect(result.avgSupplyPrice).toBeNull();
    expect(result.imminent).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts -t getSubscriptionSummary`
Expected: FAIL

- [ ] **Step 3: `getSubscriptionSummary` 구현**

먼저 Subscription 모델 필드명 확인이 필요합니다. `prisma/schema.prisma` 의 `Subscription` 모델에서 `supplyPrice` (또는 분양가에 해당하는 필드명) 확인.

`backend/prisma/schema.prisma` 의 Subscription 모델에서 실제 필드명을 확인하여 아래 코드의 `supplyPrice`, `regionName` 등을 해당 필드명으로 교체하세요. (예: `housingSupplyAmount`, `region` 등 — 모델 정의에 따름)

```ts
export async function getSubscriptionSummary() {
  const now = new Date();
  const inDays = (n: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + n);
    return d;
  };

  const [closingThisWeek, upcomingNextWeek, agg, imminentRows] = await Promise.all([
    prisma.subscription.count({
      where: { receptionEndDate: { gte: now, lte: inDays(7) } },
    }),
    prisma.subscription.count({
      where: { receptionStartDate: { gte: inDays(1), lte: inDays(14) } },
    }),
    prisma.subscription.aggregate({
      _avg: { supplyPrice: true },  // ← 실제 필드명 확인
      where: {
        OR: [
          dateBasedStatusFilter('ongoing'),
          dateBasedStatusFilter('upcoming'),
        ],
      },
    }),
    prisma.subscription.findMany({
      where: { receptionEndDate: { gte: now, lte: inDays(3) } },
      select: { id: true, houseName: true, regionName: true, receptionEndDate: true },
      orderBy: { receptionEndDate: 'asc' },
      take: 5,
    }),
  ]);

  return {
    closingThisWeek,
    upcomingNextWeek,
    avgSupplyPrice: (agg._avg as { supplyPrice: number | null }).supplyPrice ?? null,
    imminent: imminentRows.map((r: { id: number; houseName: string; regionName: string; receptionEndDate: Date }) => ({
      id: r.id,
      houseName: r.houseName,
      regionName: r.regionName,
      endDate: r.receptionEndDate.toISOString().slice(0, 10),
    })),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts -t getSubscriptionSummary`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add -A backend/
git commit -m "feat(meta): add getSubscriptionSummary for home dashboard"
```

---

## Task 6: `getHomeDashboard` 컴포지트 + 캐시 + 테스트

**Files:**
- Modify: `backend/__tests__/services/homeDashboard.test.ts` (append)
- Modify: `backend/src/services/metaService.ts` (append)

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { getHomeDashboard, clearHomeDashboardCache } from '../../src/services/metaService.js';

describe('getHomeDashboard', () => {
  beforeEach(() => {
    clearHomeDashboardCache();
    // 모든 mock 리셋
  });

  it('returns composite payload from all helpers', async () => {
    // 기존 stats 호출 mock + 4개 헬퍼 mock 모두 채우기 (위 테스트들과 동일 setup)
    // ...
    const result = await getHomeDashboard();
    expect(result).toHaveProperty('total');
    expect(result).toHaveProperty('newlyListedToday');
    expect(result.realEstateTrends).toHaveLength(3);
    expect(result.trendingBuildings).toHaveProperty('sale');
    expect(result.trendingBuildings).toHaveProperty('jeonse');
    expect(result.trendingBuildings).toHaveProperty('wolse');
    expect(result.subscriptionSummary).toHaveProperty('closingThisWeek');
  });

  it('caches result for 1 hour', async () => {
    // 첫 호출
    await getHomeDashboard();
    const firstCallCount = mockQueryRaw.mock.calls.length;
    // 두 번째 호출 — 캐시 hit
    await getHomeDashboard();
    expect(mockQueryRaw.mock.calls.length).toBe(firstCallCount); // 증가 X
  });

  it('clearHomeDashboardCache forces re-fetch', async () => {
    await getHomeDashboard();
    const before = mockQueryRaw.mock.calls.length;
    clearHomeDashboardCache();
    await getHomeDashboard();
    expect(mockQueryRaw.mock.calls.length).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts -t getHomeDashboard`
Expected: FAIL

- [ ] **Step 3: `getHomeDashboard` 구현**

```ts
import type { HomeDashboardResponse } from '../types/homeDashboard.js';

let homeDashboardCache: { data: HomeDashboardResponse; expiry: number } | null = null;
const HOME_DASHBOARD_CACHE_TTL = 60 * 60 * 1000; // 1시간

export function clearHomeDashboardCache(): void {
  homeDashboardCache = null;
}

export async function getHomeDashboard(): Promise<HomeDashboardResponse> {
  if (homeDashboardCache && Date.now() < homeDashboardCache.expiry) {
    return homeDashboardCache.data;
  }

  const [statsResult, newlyListedToday, realEstateTrends, trendingBuildings, subscriptionSummary] = await Promise.all([
    getStats(),
    getNewlyListedToday(),
    getRealEstateTrends(),
    getTrendingBuildings(),
    getSubscriptionSummary(),
  ]);

  const stats = statsResult.data as {
    total: number;
    buildingCount: number;
    realEstateBuildings: { apt: number; villa: number; offitel: number };
    subscriptionActiveCount: number;
  };

  const payload: HomeDashboardResponse = {
    total: stats.total,
    buildingCount: stats.buildingCount,
    realEstateBuildings: stats.realEstateBuildings,
    subscriptionActiveCount: stats.subscriptionActiveCount,
    newlyListedToday,
    realEstateTrends,
    trendingBuildings,
    subscriptionSummary,
  };

  homeDashboardCache = { data: payload, expiry: Date.now() + HOME_DASHBOARD_CACHE_TTL };
  return payload;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts`
Expected: ALL PASS

- [ ] **Step 5: 커밋**

```bash
git add -A backend/
git commit -m "feat(meta): add getHomeDashboard composite with 1h cache"
```

---

## Task 7: `GET /api/meta/home-dashboard` 라우트 + 통합 테스트

**Files:**
- Create: `backend/__tests__/routes/metaHomeDashboard.test.ts`
- Modify: `backend/src/routes/meta.ts`

- [ ] **Step 1: 실패 통합 테스트 작성**

```ts
// backend/__tests__/routes/metaHomeDashboard.test.ts
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/metaService.js', () => ({
  getHomeDashboard: vi.fn().mockResolvedValue({
    total: 100000,
    buildingCount: 30000,
    realEstateBuildings: { apt: 20000, villa: 8000, offitel: 2000 },
    subscriptionActiveCount: 42,
    newlyListedToday: 1284,
    realEstateTrends: [],
    trendingBuildings: { sale: [], jeonse: [], wolse: [] },
    subscriptionSummary: { closingThisWeek: 0, upcomingNextWeek: 0, avgSupplyPrice: null, imminent: [] },
  }),
  // 다른 import 도 stub
  getCategories: vi.fn(),
  getStats: vi.fn(),
  getRegionByDistrictName: vi.fn(),
  getRegionByBjdCode: vi.fn(),
  getRegions: vi.fn(),
}));

// 다른 services mock (facilityService 등) 도 필요. 기존 app.test.ts 참고.

import app from '../../src/app.js';

describe('GET /api/meta/home-dashboard', () => {
  it('returns 200 with success envelope and dashboard payload', async () => {
    const res = await request(app).get('/api/meta/home-dashboard');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('newlyListedToday', 1284);
    expect(res.body.data).toHaveProperty('realEstateTrends');
    expect(res.body.data).toHaveProperty('trendingBuildings.sale');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/routes/metaHomeDashboard.test.ts`
Expected: FAIL (404 또는 라우트 없음)

- [ ] **Step 3: 라우트 추가**

`backend/src/routes/meta.ts` 의 import 와 라우트에 추가:

```ts
// import 부분
import { getCategories, getStats, getRegionByDistrictName, getRegionByBjdCode, getRegions, getHomeDashboard } from '../services/metaService.js';

// 기존 GET /stats 라우트 바로 아래에 삽입:

// GET /api/meta/home-dashboard - 홈 페이지 통합 대시보드 (1시간 캐시)
router.get('/home-dashboard', asyncHandler(async (_req: Request, res: Response) => {
  const data = await getHomeDashboard();
  res.json({ success: true, data });
}));
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/routes/metaHomeDashboard.test.ts`
Expected: PASS

- [ ] **Step 5: 전체 백엔드 테스트 회귀 확인**

Run: `cd backend && npm run test`
Expected: ALL PASS (기존 테스트도 안 깨졌는지)

- [ ] **Step 6: 커밋 + PR #1**

```bash
git add -A backend/
git commit -m "feat(api): add GET /api/meta/home-dashboard endpoint"
git push -u origin HEAD
gh pr create --title "feat(meta): home dashboard endpoint" --body "spec: docs/superpowers/specs/2026-05-20-home-redesign-design.md"
```

**Wait for CI to pass and merge before continuing to Task 8.**

---

## Task 8: 프론트 포맷 유틸 + 테스트

**Files:**
- Create: `frontend/utils/priceFormat.ts`
- Create: `frontend/tests/utils/priceFormat.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/utils/priceFormat.test.ts
import { describe, it, expect } from 'vitest';
import { formatPrice, formatChange } from '~/utils/priceFormat';

describe('formatPrice', () => {
  it('formats >= 10000만원 (1억) as 억 with 1 decimal', () => {
    expect(formatPrice(54000)).toBe('5.4억');
    expect(formatPrice(100000)).toBe('10억');
    expect(formatPrice(184000)).toBe('18.4억');
  });
  it('formats < 10000만원 as N,NNN만', () => {
    expect(formatPrice(8500)).toBe('8,500만');
    expect(formatPrice(120)).toBe('120만');
  });
  it('null/0 returns "—"', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(0)).toBe('—');
  });
});

describe('formatChange', () => {
  it('positive returns + sign with 1 decimal', () => {
    expect(formatChange(2.3)).toBe('+2.3%');
  });
  it('negative returns - sign', () => {
    expect(formatChange(-0.8)).toBe('-0.8%');
  });
  it('null returns "—"', () => {
    expect(formatChange(null)).toBe('—');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/utils/priceFormat.test.ts`
Expected: FAIL

- [ ] **Step 3: 유틸 구현**

```ts
// frontend/utils/priceFormat.ts
/** manwon 단위 금액 → '5.4억' / '8,500만' / '—'. */
export function formatPrice(manwon: number | null): string {
  if (manwon === null || manwon === 0) return '—';
  if (manwon >= 10000) {
    const eok = manwon / 10000;
    const rounded = Math.round(eok * 10) / 10;
    return rounded % 1 === 0 ? `${rounded}억` : `${rounded.toFixed(1)}억`;
  }
  return `${Math.round(manwon).toLocaleString('ko-KR')}만`;
}

/** 변동률(%) → '+2.3%' / '-0.8%' / '—'. */
export function formatChange(pct: number | null): string {
  if (pct === null) return '—';
  const rounded = Math.round(pct * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/priceFormat.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/priceFormat.ts frontend/tests/utils/priceFormat.test.ts
git commit -m "feat(frontend): add formatPrice/formatChange utils"
```

---

## Task 9: `useHomeDashboard` 컴포저블

**Files:**
- Create: `frontend/composables/useHomeDashboard.ts`

- [ ] **Step 1: 컴포저블 작성**

```ts
// frontend/composables/useHomeDashboard.ts
export interface TrendingBuildingItem {
  buildingName: string;
  city: string;
  district: string;
  txnCount: number;
  avgPrice: number | null;
  avgMonthlyRent: number | null;
}

export interface RealEstateTrend {
  key: 'apt-sale' | 'apt-rent-jeonse' | 'offitel-sale';
  label: string;
  avgPrice: number | null;
  txnCount: number;
  prevAvgPrice: number | null;
  changePct: number | null;
}

export interface SubscriptionImminent {
  id: number;
  houseName: string;
  regionName: string;
  endDate: string;
}

export interface HomeDashboard {
  total: number;
  buildingCount: number;
  realEstateBuildings: { apt: number; villa: number; offitel: number };
  subscriptionActiveCount: number;
  newlyListedToday: number;
  realEstateTrends: RealEstateTrend[];
  trendingBuildings: { sale: TrendingBuildingItem[]; jeonse: TrendingBuildingItem[]; wolse: TrendingBuildingItem[] };
  subscriptionSummary: {
    closingThisWeek: number;
    upcomingNextWeek: number;
    avgSupplyPrice: number | null;
    imminent: SubscriptionImminent[];
  };
}

interface ApiEnvelope {
  success: boolean;
  data: HomeDashboard;
}

export async function useHomeDashboard() {
  const config = useRuntimeConfig();
  return await useAsyncData('home-dashboard', () =>
    $fetch<ApiEnvelope>(`${config.public.apiBase}/api/meta/home-dashboard`).catch(() => null),
  );
}
```

- [ ] **Step 2: 커밋**

```bash
git add frontend/composables/useHomeDashboard.ts
git commit -m "feat(frontend): add useHomeDashboard composable"
```

---

## Task 10: `HomeMarketStats.vue` 컴포넌트 + 테스트

**Files:**
- Create: `frontend/components/home/HomeMarketStats.vue`
- Create: `frontend/tests/components/home/HomeMarketStats.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/home/HomeMarketStats.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeMarketStats from '~/components/home/HomeMarketStats.vue';

const fullTrends = [
  { key: 'apt-sale', label: '아파트 매매', avgPrice: 54000, txnCount: 2481, prevAvgPrice: 52800, changePct: 2.27 },
  { key: 'apt-rent-jeonse', label: '아파트 전세', avgPrice: 31000, txnCount: 1742, prevAvgPrice: 31250, changePct: -0.8 },
  { key: 'offitel-sale', label: '오피스텔 매매', avgPrice: 22000, txnCount: 318, prevAvgPrice: null, changePct: null },
];

describe('HomeMarketStats', () => {
  it('renders 3 cards with avg/count/change', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    expect(wrapper.text()).toContain('아파트 매매');
    expect(wrapper.text()).toContain('5.4억');
    expect(wrapper.text()).toContain('2,481건');
    expect(wrapper.text()).toContain('+2.3%');
  });
  it('renders — when changePct is null', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: fullTrends } });
    const offitelCard = wrapper.findAll('[data-key="offitel-sale"]')[0];
    expect(offitelCard.text()).toContain('—');
  });
  it('renders nothing when trends empty', () => {
    const wrapper = mount(HomeMarketStats, { props: { trends: [] } });
    expect(wrapper.find('section').exists()).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/home/HomeMarketStats.test.ts`
Expected: FAIL

- [ ] **Step 3: 컴포넌트 구현**

```vue
<!-- frontend/components/home/HomeMarketStats.vue -->
<template>
  <section v-if="trends.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
          오늘의 부동산 시장
        </h2>
        <p class="text-sm text-slate-500 mt-1">최근 7일 거래일 기준 평균과 전주 대비 변동입니다.</p>
      </div>
      <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">전체 보기 →</HardLink>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <div
        v-for="t in trends"
        :key="t.key"
        :data-key="t.key"
        class="flex flex-col gap-3 p-5 border border-line rounded-2xl shadow-card bg-white"
      >
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[22px]">{{ iconFor(t.key) }}</span>
            <span class="font-bold text-slate-900">{{ t.label }}</span>
          </div>
          <span class="text-[11px] text-slate-400">최근 7일</span>
        </div>
        <div class="flex items-baseline gap-2">
          <strong class="text-2xl font-black tracking-tight text-slate-900">{{ formatPrice(t.avgPrice) }}</strong>
          <span class="text-xs text-slate-400">평균</span>
        </div>
        <div class="flex items-center justify-between border-t border-slate-100 pt-3">
          <div>
            <div class="text-[11px] text-slate-400">거래량</div>
            <div class="text-sm font-bold text-slate-900">{{ t.txnCount.toLocaleString('ko-KR') }}건</div>
          </div>
          <div class="text-right">
            <div class="text-[11px] text-slate-400">전주 대비</div>
            <div
              class="text-sm font-bold flex items-center justify-end gap-0.5"
              :class="changeColor(t.changePct)"
            >
              <span v-if="t.changePct !== null && t.changePct > 0" class="material-symbols-outlined text-[14px]">arrow_drop_up</span>
              <span v-else-if="t.changePct !== null && t.changePct < 0" class="material-symbols-outlined text-[14px]">arrow_drop_down</span>
              {{ formatChange(t.changePct) }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue';
import { formatPrice, formatChange } from '~/utils/priceFormat';
import type { RealEstateTrend } from '~/composables/useHomeDashboard';

defineProps<{ trends: RealEstateTrend[] }>();

function iconFor(key: RealEstateTrend['key']): string {
  if (key === 'apt-sale') return 'apartment';
  if (key === 'apt-rent-jeonse') return 'domain';
  return 'corporate_fare';
}

function changeColor(pct: number | null): string {
  if (pct === null) return 'text-slate-400';
  if (pct > 0) return 'text-red-500';
  if (pct < 0) return 'text-blue-500';
  return 'text-slate-400';
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/home/HomeMarketStats.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/home/HomeMarketStats.vue frontend/tests/components/home/HomeMarketStats.test.ts
git commit -m "feat(home): add HomeMarketStats component"
```

---

## Task 11: PR #2 푸시

- [ ] **Step 1: 푸시 + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(home): market stats foundation" --body "useHomeDashboard composable + HomeMarketStats. spec: 2026-05-20-home-redesign-design.md"
```

**Wait for CI to pass and merge before continuing to Task 12.**

---

## Task 12: `HomeTrendingBuildings.vue` 컴포넌트

**Files:**
- Create: `frontend/components/home/HomeTrendingBuildings.vue`
- Create: `frontend/tests/components/home/HomeTrendingBuildings.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HomeTrendingBuildings from '~/components/home/HomeTrendingBuildings.vue';

const buildings = {
  sale: [
    { buildingName: '헬리오시티', city: '서울특별시', district: '송파구', txnCount: 17, avgPrice: 184000, avgMonthlyRent: null },
    { buildingName: '은마아파트', city: '서울특별시', district: '강남구', txnCount: 14, avgPrice: 267000, avgMonthlyRent: null },
  ],
  jeonse: [
    { buildingName: '파크리오', city: '서울특별시', district: '송파구', txnCount: 22, avgPrice: 84000, avgMonthlyRent: null },
  ],
  wolse: [
    { buildingName: '아크로리버파크', city: '서울특별시', district: '서초구', txnCount: 9, avgPrice: 20000, avgMonthlyRent: 120 },
  ],
};

describe('HomeTrendingBuildings', () => {
  it('renders 3 columns with their respective TOP lists', () => {
    const wrapper = mount(HomeTrendingBuildings, { props: { buildings } });
    expect(wrapper.text()).toContain('매매 TOP');
    expect(wrapper.text()).toContain('전세 TOP');
    expect(wrapper.text()).toContain('월세 TOP');
    expect(wrapper.text()).toContain('헬리오시티');
    expect(wrapper.text()).toContain('파크리오');
    expect(wrapper.text()).toContain('아크로리버파크');
  });
  it('formats wolse as deposit/monthlyRent', () => {
    const wrapper = mount(HomeTrendingBuildings, { props: { buildings } });
    expect(wrapper.text()).toContain('2억/120');
  });
  it('renders nothing when all 3 lists empty', () => {
    const wrapper = mount(HomeTrendingBuildings, { props: { buildings: { sale: [], jeonse: [], wolse: [] } } });
    expect(wrapper.find('section').exists()).toBe(false);
  });
  it('renders empty-column message when one list is empty', () => {
    const wrapper = mount(HomeTrendingBuildings, {
      props: { buildings: { sale: buildings.sale, jeonse: [], wolse: buildings.wolse } },
    });
    expect(wrapper.text()).toContain('이번 주 거래 없음');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/home/HomeTrendingBuildings.test.ts`
Expected: FAIL

- [ ] **Step 3: 컴포넌트 구현**

```vue
<!-- frontend/components/home/HomeTrendingBuildings.vue -->
<template>
  <section v-if="hasAny" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]">local_fire_department</span>
          이번 주 인기 단지
        </h2>
        <p class="text-sm text-slate-500 mt-1">최근 7일 매매·전세·월세 거래가 가장 많은 단지입니다.</p>
      </div>
      <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">전체 보기 →</HardLink>
    </div>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
      <TrendingColumn label="매매 TOP" accent="primary" :items="buildings.sale" :type="'sale'" />
      <TrendingColumn label="전세 TOP" accent="emerald" :items="buildings.jeonse" :type="'jeonse'" />
      <TrendingColumn label="월세 TOP" accent="amber" :items="buildings.wolse" :type="'wolse'" />
    </div>
    <p class="text-[11px] text-slate-400 mt-2">월세는 보증금/월세(만원) 평균으로 표기합니다.</p>
  </section>
</template>

<script setup lang="ts">
import { computed, h, defineComponent } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import { formatPrice } from '~/utils/priceFormat';
import type { TrendingBuildingItem } from '~/composables/useHomeDashboard';

const props = defineProps<{
  buildings: { sale: TrendingBuildingItem[]; jeonse: TrendingBuildingItem[]; wolse: TrendingBuildingItem[] };
}>();

const hasAny = computed(() => props.buildings.sale.length + props.buildings.jeonse.length + props.buildings.wolse.length > 0);

const TrendingColumn = defineComponent({
  props: {
    label: { type: String, required: true },
    accent: { type: String, required: true },
    items: { type: Array as () => TrendingBuildingItem[], required: true },
    type: { type: String, required: true },
  },
  setup(p) {
    const accentBar: Record<string, string> = { primary: 'bg-primary', emerald: 'bg-emerald-500', amber: 'bg-amber-500' };
    const accentText: Record<string, string> = { primary: 'text-primary', emerald: 'text-emerald-600', amber: 'text-amber-600' };
    const accentHover: Record<string, string> = { primary: 'hover:bg-primary/5', emerald: 'hover:bg-emerald-50/50', amber: 'hover:bg-amber-50/50' };

    return () =>
      h('div', { class: 'bg-white border border-line rounded-2xl shadow-card overflow-hidden flex flex-col' }, [
        h('div', { class: 'px-4 md:px-5 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/50' }, [
          h('div', { class: 'flex items-center gap-2' }, [
            h('span', { class: `inline-flex w-1.5 h-4 ${accentBar[p.accent]} rounded-full` }),
            h('strong', { class: 'text-sm font-bold text-slate-900' }, p.label),
          ]),
          h('span', { class: 'text-[11px] text-slate-400' }, '최근 7일'),
        ]),
        p.items.length === 0
          ? h('div', { class: 'px-4 py-6 text-center text-xs text-slate-400' }, '이번 주 거래 없음')
          : h('ol', { class: 'divide-y divide-slate-100 flex-1' },
              p.items.map((b, i) =>
                h('li', null, [
                  h('a', {
                    href: buildingUrl(p.type, b),
                    class: `flex items-center gap-3 px-4 md:px-5 py-3 ${accentHover[p.accent]} transition-colors`,
                  }, [
                    h('span', { class: `w-5 text-center font-black text-sm ${i < 2 ? accentText[p.accent] : 'text-slate-400'}` }, String(i + 1)),
                    h('div', { class: 'flex-1 min-w-0' }, [
                      h('div', { class: 'font-bold text-slate-900 text-sm truncate' }, b.buildingName),
                      h('div', { class: 'text-[11px] text-slate-500 mt-0.5 truncate' }, `${shortCity(b.city)} ${b.district}`),
                    ]),
                    h('div', { class: 'text-right shrink-0' }, [
                      h('div', { class: 'text-xs font-bold text-slate-900' }, `${b.txnCount}건`),
                      h('div', { class: 'text-[10px] text-slate-400' }, priceLabel(p.type, b)),
                    ]),
                  ]),
                ]),
              ),
            ),
      ]);

    function buildingUrl(type: string, b: TrendingBuildingItem): string {
      const subPath = type === 'sale' ? 'apt-sale' : 'apt-rent';
      return `/real-estate/${subPath}/${encodeURIComponent(b.buildingName)}`;
    }

    function priceLabel(type: string, b: TrendingBuildingItem): string {
      if (type === 'wolse') {
        const dep = b.avgPrice !== null ? formatPrice(b.avgPrice) : '—';
        const rent = b.avgMonthlyRent !== null ? `${Math.round(b.avgMonthlyRent).toLocaleString('ko-KR')}` : '—';
        return `${dep}/${rent}`;
      }
      return formatPrice(b.avgPrice);
    }

    function shortCity(city: string): string {
      const map: Record<string, string> = { 서울특별시: '서울', 부산광역시: '부산', 대구광역시: '대구', 인천광역시: '인천', 광주광역시: '광주', 대전광역시: '대전', 울산광역시: '울산', 세종특별자치시: '세종', 경기도: '경기', 강원특별자치도: '강원', 충청북도: '충북', 충청남도: '충남', 전북특별자치도: '전북', 전라남도: '전남', 경상북도: '경북', 경상남도: '경남', 제주특별자치도: '제주' };
      return map[city] ?? city;
    }
  },
});
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/home/HomeTrendingBuildings.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/home/HomeTrendingBuildings.vue frontend/tests/components/home/HomeTrendingBuildings.test.ts
git commit -m "feat(home): add HomeTrendingBuildings 3-column component"
```

---

## Task 13: PR #3 푸시

- [ ] **Step 1: 푸시 + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(home): trending buildings 3-column" --body "spec: 2026-05-20-home-redesign-design.md"
```

**Wait for CI to pass and merge before continuing to Task 14.**

---

## Task 14: `HomeSubscriptionSection.vue` 강화

**Files:**
- Modify: `frontend/components/subscription/HomeSubscriptionSection.vue`
- Create: `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';

vi.mock('~/composables/useHomeSubscriptions', () => ({
  useHomeSubscriptions: () => ({
    ongoing: { value: [
      { id: 1, houseName: '래미안 강동 팰리스', regionName: '서울 강동구', receptionStartDate: null, receptionEndDate: '2026-05-21', status: 'ongoing', totalSupplyCount: 540 },
    ]},
    upcoming: { value: [
      { id: 2, houseName: '디에이치 방배', regionName: '서울 서초구', receptionStartDate: '2026-05-25', receptionEndDate: null, status: 'upcoming', totalSupplyCount: 1221 },
    ]},
    hasAny: { value: true },
  }),
}));

import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue';

const summary = {
  closingThisWeek: 12,
  upcomingNextWeek: 18,
  avgSupplyPrice: 68000,
  imminent: [
    { id: 1, houseName: '래미안 강동 팰리스', regionName: '서울 강동구', endDate: '2026-05-21' },
    { id: 3, houseName: '힐스테이트 광교', regionName: '경기 수원시', endDate: '2026-05-22' },
  ],
};

describe('HomeSubscriptionSection enhanced', () => {
  it('renders summary line', () => {
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } });
    expect(wrapper.text()).toContain('이번 주 마감');
    expect(wrapper.text()).toContain('12건');
    expect(wrapper.text()).toContain('다음 주 예정');
    expect(wrapper.text()).toContain('18건');
    expect(wrapper.text()).toContain('6.8억');
  });
  it('renders imminent (D-3) highlight', () => {
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } });
    expect(wrapper.text()).toContain('마감 임박');
    expect(wrapper.text()).toContain('래미안 강동 팰리스');
  });
  it('renders meta line with totals and shown counts', () => {
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } });
    expect(wrapper.text()).toMatch(/접수중\s+12건\s+중\s+1건/);
    expect(wrapper.text()).toMatch(/예정\s+18건\s+중\s+1건/);
  });
  it('hides imminent block when imminent empty', () => {
    const wrapper = mount(HomeSubscriptionSection, {
      props: { summary: { ...summary, imminent: [] } },
    });
    expect(wrapper.text()).not.toContain('마감 임박');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/HomeSubscriptionSection.test.ts`
Expected: FAIL (요약/임박/메타 미렌더)

- [ ] **Step 3: 컴포넌트 강화**

`frontend/components/subscription/HomeSubscriptionSection.vue` 를 다음으로 교체:

```vue
<template>
  <section v-if="hasAny" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">calendar_month</span>
          청약 한눈에
        </h2>
        <p class="text-sm text-slate-500 mt-1">지금 신청 가능한 공고와 다가오는 일정을 확인하세요.</p>
      </div>
      <HardLink to="/subscription" class="inline-flex items-center min-h-[44px] text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 보기 →
      </HardLink>
    </div>

    <!-- 요약 1줄 -->
    <div v-if="summary" class="bg-white border border-line rounded-2xl shadow-card px-5 py-4 mb-3 flex flex-wrap items-center gap-x-6 gap-y-2">
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        <span class="text-xs text-slate-500">이번 주 마감</span>
        <strong class="text-sm font-bold text-slate-900">{{ summary.closingThisWeek }}건</strong>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-2 h-2 rounded-full bg-blue-500"></span>
        <span class="text-xs text-slate-500">다음 주 예정</span>
        <strong class="text-sm font-bold text-slate-900">{{ summary.upcomingNextWeek }}건</strong>
      </div>
      <div v-if="summary.avgSupplyPrice !== null" class="flex items-center gap-2">
        <span class="text-xs text-slate-500">평균 분양가</span>
        <strong class="text-sm font-bold text-slate-900">{{ formatPrice(summary.avgSupplyPrice) }}</strong>
      </div>
    </div>

    <!-- 임박 (D-3) -->
    <div v-if="summary && summary.imminent.length > 0" class="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-3 flex items-center gap-3">
      <span class="material-symbols-outlined text-red-500">notifications_active</span>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-bold text-red-700 mb-0.5">마감 임박 (D-3 이내)</div>
        <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm">
          <template v-for="(item, idx) in summary.imminent" :key="item.id">
            <span v-if="idx > 0" class="text-slate-300">·</span>
            <HardLink :to="`/subscription/${item.id}`" class="font-bold text-slate-900 hover:underline">
              {{ item.houseName }}
              <span class="text-red-600 ml-1">{{ ddayLabel(item.endDate) }}</span>
            </HardLink>
          </template>
        </div>
      </div>
    </div>

    <!-- 카드 그리드 -->
    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <HardLink
        v-for="item in ongoing"
        :key="`ongoing-${item.id}`"
        :to="`/subscription/${item.id}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-green-300 transition-shadow"
      >
        <StatusBadge variant="green" class="self-start">접수중</StatusBadge>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.houseName }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ formatMeta(item, 'ongoing') }}</p>
      </HardLink>
      <HardLink
        v-for="item in upcoming"
        :key="`upcoming-${item.id}`"
        :to="`/subscription/${item.id}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-blue-300 transition-shadow"
      >
        <StatusBadge variant="blue" class="self-start">접수예정</StatusBadge>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.houseName }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ formatMeta(item, 'upcoming') }}</p>
      </HardLink>
    </div>

    <!-- 누락 메타 라인 -->
    <p v-if="summary" class="text-[11px] text-slate-400 mt-3 text-right">
      접수중 {{ summary.closingThisWeek }}건 중 {{ ongoing.length }}건 · 예정 {{ summary.upcomingNextWeek }}건 중 {{ upcoming.length }}건 표시
      <HardLink to="/subscription" class="ml-1 text-primary font-bold hover:underline">전체 보기 →</HardLink>
    </p>
  </section>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue';
import StatusBadge from '~/components/common/StatusBadge.vue';
import type { HomeSubscriptionItem } from '~/composables/useHomeSubscriptions';
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions';
import { formatPrice } from '~/utils/priceFormat';

interface SubscriptionSummary {
  closingThisWeek: number;
  upcomingNextWeek: number;
  avgSupplyPrice: number | null;
  imminent: Array<{ id: number; houseName: string; regionName: string; endDate: string }>;
}

defineProps<{ summary: SubscriptionSummary | null }>();

const { ongoing, upcoming, hasAny } = useHomeSubscriptions();

const todayIso = useState<string>('home-today-iso', () => new Date().toISOString().split('T')[0]);

function formatMeta(item: HomeSubscriptionItem, mode: 'ongoing' | 'upcoming'): string {
  const parts: string[] = [];
  if (item.regionName) parts.push(item.regionName);

  const dday = computeDday(
    mode === 'ongoing' ? item.receptionEndDate : item.receptionStartDate,
    mode === 'ongoing' ? '마감' : '시작',
  );
  if (dday) parts.push(dday);

  if (item.totalSupplyCount != null) parts.push(`${item.totalSupplyCount.toLocaleString('ko-KR')}호`);
  return parts.join(' · ');
}

function computeDday(isoDate: string | null, label: '마감' | '시작'): string | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  if (Number.isNaN(target.getTime())) return null;
  const today = new Date(`${todayIso.value}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays < 0) return null;
  if (diffDays === 0) return `${label} 오늘`;
  return `${label} D-${diffDays}`;
}

function ddayLabel(endDate: string): string {
  const target = new Date(endDate);
  const today = new Date(`${todayIso.value}T00:00:00`);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays === 0) return 'D-Day';
  if (diffDays < 0) return '마감';
  return `D-${diffDays}`;
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/HomeSubscriptionSection.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/subscription/HomeSubscriptionSection.vue frontend/tests/components/subscription/HomeSubscriptionSection.test.ts
git commit -m "feat(subscription): enhance HomeSubscriptionSection with summary/imminent/meta"
```

---

## Task 15: PR #4 푸시

- [ ] **Step 1: 푸시 + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(subscription): home section summary + imminent + meta" --body "spec: 2026-05-20-home-redesign-design.md"
```

**Wait for CI to pass and merge before continuing to Task 16.**

---

## Task 16: `index.vue` 재편 — 기존 카드 제거 + 새 컴포넌트 wire-up

**Files:**
- Modify: `frontend/pages/index.vue`

- [ ] **Step 1: import + dashboard fetch 추가 (script 상단)**

`<script setup lang="ts">` 블록의 import 영역에 추가:

```ts
import HomeMarketStats from '~/components/home/HomeMarketStats.vue';
import HomeTrendingBuildings from '~/components/home/HomeTrendingBuildings.vue';
import { useHomeDashboard } from '~/composables/useHomeDashboard';
```

기존 `statsResponse` `useAsyncData` 다음에 추가:

```ts
const { data: dashboardResponse } = await useHomeDashboard();
const dashboard = computed(() => dashboardResponse.value?.data ?? null);
const trends = computed(() => dashboard.value?.realEstateTrends ?? []);
const trendingBuildings = computed(() => dashboard.value?.trendingBuildings ?? { sale: [], jeonse: [], wolse: [] });
const subscriptionSummary = computed(() => dashboard.value?.subscriptionSummary ?? null);
const newlyListedToday = computed(() => dashboard.value?.newlyListedToday ?? 0);
```

- [ ] **Step 2: hero에 라이브 뱃지 추가**

기존 "데이터 기준 배지" 의 wrapper div에 라이브 뱃지 추가. `<span class="text-primary font-semibold">공공데이터 기반</span>` 가 들어있는 div를 다음으로 교체:

```vue
<div class="flex items-center gap-2 text-xs flex-wrap">
  <span class="w-2 h-2 rounded-full bg-primary shrink-0"></span>
  <span class="text-primary font-semibold">공공데이터 기반</span>
  <span class="hidden md:inline text-slate-300">·</span>
  <span class="hidden md:inline text-slate-500">공공데이터포털 · 국토교통부</span>
  <span v-if="newlyListedToday > 0" class="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-bold">
    <span class="relative flex w-2 h-2">
      <span class="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
      <span class="relative inline-flex w-2 h-2 rounded-full bg-red-500"></span>
    </span>
    오늘 신규 등록 {{ newlyListedToday.toLocaleString('ko-KR') }}건
  </span>
</div>
```

- [ ] **Step 3: 기존 "오늘 확인할 정보" 섹션 제거 + 새 섹션 삽입**

기존 `<!-- "오늘 확인할 정보" 3카드 -->` 시작 `<section>` 부터 닫는 `</section>` 까지를 다음으로 교체:

```vue
<HomeMarketStats :trends="trends" />
<HomeTrendingBuildings :buildings="trendingBuildings" />
```

- [ ] **Step 4: 기존 "부동산 실거래가 3카드" 섹션 제거**

기존 `<!-- 부동산 실거래가 3카드 -->` 시작 `<section>` 부터 닫는 `</section>` 까지를 **완전히 삭제**. 새 통계 카드가 그 역할을 대체함.

- [ ] **Step 5: `HomeSubscriptionSection`에 summary prop 전달**

기존:
```vue
<HomeSubscriptionSection />
```
→ 다음으로 교체:
```vue
<HomeSubscriptionSection :summary="subscriptionSummary" />
```

- [ ] **Step 6: 광고 위치 재정렬**

스펙대로 3개 광고를 (1) HomeTrendingBuildings 뒤, (2) HomeSubscriptionSection 뒤, (3) 생활 가이드 뒤 — 만 유지. 다른 위치에 광고가 있다면 제거.

확인 순서 (최종 메인 구조):
```
Hero → HomeMarketStats → HomeTrendingBuildings → AdBanner → HomeSubscriptionSection → AdBanner → 빠른 시설 → 인기 지역 → 생활 가이드 → AdBanner → 데이터 출처
```

- [ ] **Step 7: 사용하지 않게 된 변수/로직 정리**

`todayCards`, `realEstateLinks`, `formatBuildingCount`, `buildingCountKor`, `facilityCountKor` 중 더 이상 템플릿에서 안 쓰는 것들을 삭제. (`buildingCountKor`, `facilityCountKor` 는 hero 통계 박스에서 계속 사용 — 유지)

특히 다음은 삭제:
- `todayCards` computed
- `realEstateLinks` computed
- 관련 import (필요시)

- [ ] **Step 8: 개발 서버에서 시각 확인**

Run (백그라운드):
```bash
cd backend && npm run dev
```
Run (백그라운드):
```bash
cd frontend && npm run dev
```

브라우저 `http://localhost:3000` 접속. 다음 항목 시각 체크:
- [ ] Hero 우측에 빨간 라이브 뱃지 ("오늘 신규 등록 N건")
- [ ] 통계 3카드 (아파트 매매 / 아파트 전세 / 오피스텔 매매) — 평균/거래량/변동률
- [ ] 인기 단지 3컬럼 (매매/전세/월세)
- [ ] 광고 1개 (TOP 단지 뒤)
- [ ] 청약 섹션: 요약 1줄 + D-3 임박 박스(있다면) + 카드 4+4 + 누락 메타
- [ ] 광고 1개 (청약 뒤)
- [ ] 빠른 시설 → 인기 지역 → 가이드 → 광고 1개 → 데이터 출처
- [ ] 모바일 (390px) 에서 3컬럼이 stack 되는지

서버 종료: `kill %1 %2`

- [ ] **Step 9: 커밋**

```bash
git add frontend/pages/index.vue
git commit -m "feat(home): rewire index.vue with new sections and live badge"
```

---

## Task 17: 전체 회귀 테스트

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd backend && npm run test
```
Expected: ALL PASS

- [ ] **Step 2: 프론트 전체 테스트**

```bash
cd frontend && npm run test
```
Expected: ALL PASS

- [ ] **Step 3: 프론트 빌드 검증**

```bash
cd frontend && npm run build
```
Expected: SUCCESS (오류/경고 없음)

- [ ] **Step 4: 백엔드 빌드 검증**

```bash
cd backend && npm run build
```
Expected: SUCCESS

만약 어느 하나라도 실패하면 fix 후 다시 commit. 절대 fail을 무시하고 PR 올리지 말 것.

---

## Task 18: PR #5 푸시

- [ ] **Step 1: 푸시 + PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(home): rewire index with new sections" --body "최종 메인 리디자인 wire-up.

spec: docs/superpowers/specs/2026-05-20-home-redesign-design.md
mockup: docs/superpowers/specs/2026-05-20-home-redesign-mockup.html

변경:
- Hero 라이브 뱃지
- HomeMarketStats, HomeTrendingBuildings wire-up
- 기존 '오늘 확인할 정보' 3카드 제거
- 기존 '부동산 실거래가' 3카드 제거
- HomeSubscriptionSection summary 연결
- 광고 3개 재정렬"
```

---

## Self-Review 체크리스트 (구현 시작 전)

- [ ] 모든 task 의 `Files:` 섹션이 실제 파일 경로와 일치하는가?
- [ ] 각 task 가 self-contained 한가? (다른 task의 결과 없이 이해 가능)
- [ ] 모든 test 가 실제 코드를 검증하는가? (placeholder/no-op 없음)
- [ ] BigInt → Number 변환이 모든 service 함수에서 일관되게 처리되는가?
- [ ] Subscription 모델의 실제 필드명 (`supplyPrice`, `regionName`, `houseName`) 을 schema.prisma 에서 사전 확인했는가? **Task 5 Step 3 시작 전 반드시 확인.**
- [ ] 5개 PR 분할이 합리적인가? — Task 1-7 (백엔드), 8-11 (유틸/composable/통계), 12-13 (TOP 단지), 14-15 (청약), 16-18 (wire-up)

---

## 알려진 위험 / 후속 작업

- **Subscription 모델 필드명**: 본 plan 은 `houseName`, `regionName`, `supplyPrice`, `receptionStartDate`, `receptionEndDate` 라는 필드명을 가정. 실제 prisma 스키마와 다르면 Task 5 에서 필드명 교체 필요.
- **TrendingBuildings URL 빌더**: `encodeURIComponent(buildingName)` 단순 처리. 기존 부동산 상세 URL 규칙이 다르면 (예: bjdCode 포함) Task 12 의 `buildingUrl()` 수정 필요.
- **성능**: home-dashboard endpoint 가 비캐시 상태에서 1초 초과시 daily snapshot 테이블 도입 고려 (스펙 §3 참조).
- **빌라/오피스텔 인기 단지**: 현재 아파트 한정. 향후 슬롯 확장 시 별도 plan.
