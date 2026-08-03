# 홈 "오늘의 부동산 시장" 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 홈 부동산 섹션을 "변동률·랭킹" 중심에서 "우리 동네 시세"(첫 방문=전국 뷰, 선택 후=우리 동네) 중심으로 재구성하고, "이번 주 인기 단지"를 제거한다.

**Architecture:** 신규 `localMarketService`가 지역 파라미터 유무로 두 모드(전국 뷰=시·도별 집계 / 우리 동네 뷰=시·군·구 표본 적응 집계)를 반환하는 엔드포인트를 제공. 프론트 `HomeLocalMarket.vue`가 두 모드를 렌더하고 `useLocalMarket` composable이 하이브리드 지역 선택·localStorage를 관리. 전국 거래 활발도(B)는 `getHomeDashboard`에 편승. 뜨는 동네(C)는 기존 컴포넌트 강등. 인기 단지는 완전 제거.

**Tech Stack:** Express 5 + TypeScript (ESM) + Prisma / MySQL 8, Nuxt 3 + Vue 3 + Pinia, Vitest

**스펙:** `docs/superpowers/specs/2026-07-20-home-realestate-market-redesign-design.md`

## Global Constraints

- **Node 20 필수.** 모든 npm/vitest 실행 전 `source ~/.nvm/nvm.sh && nvm use 20`.
- **`package-lock.json` 삭제 후 재생성 금지.** 새 의존성 0.
- **ESM:** 모든 백엔드 로컬 import에 `.js` 확장자 필수.
- **PR 기반:** `develop`에서 분기, `develop`으로 PR. `main` 직접 커밋·자체 머지 금지.
- **금액은 만원 단위 정수로 API 반환.** 억/만원 포맷은 프론트 `priceFormat.ts`
  (`formatPricePerPyeong`·`formatPriceManwon`·`formatChange`) **재사용**(새 유틸 금지).
- **평당가 = SUM(가격)/SUM(전용면적) × 3.3058**(`M2_PER_PYEONG`), `exclusiveArea>0`만.
- **날짜 필터는 sargable하게** — `dealDateRangeFilter`(PR #600) 재사용. `STR_TO_DATE`
  단독 금지.
- **라우트는 `asyncHandler` + `validate`(Zod).** 에러는 에러 클래스 throw.
- **City variant 매칭:** `buildRegionFilter()` 또는 `{ city: { in: cityVariants } }`.
- **BigInt/Decimal은 Number 직렬화**(`serializeRow` 패턴).
- **캐시 TTL 1시간.** 인메모리 LRU 상한 500.
- **선행:** PR #600(집계 sargable) 머지 후 착수. 이 플랜의 `getTrendingBuildings` 제거는
  그 PR의 3 CTE 최적화를 함께 지우나 무해.
- 백엔드 테스트: `cd backend && npx vitest run`. 프론트: `cd frontend && npx vitest run`.

## File Structure

**백엔드**
- Create: `backend/src/services/localMarketService.ts` — 전국 뷰 + 우리 동네 뷰 집계, 표본 적응, 캐시
- Create: `backend/src/routes/localMarket.ts` — `GET /api/real-estate/local-market` (또는 기존 realEstate 라우트에 추가)
- Create: `backend/src/schemas/localMarket.ts` — Zod 쿼리 스키마
- Modify: `backend/src/services/metaService.ts` — `rowToPricePerPyeong`/`RawSumRow`/`M2_PER_PYEONG` export(공유); `getTrendingBuildings`·`rowsToTrendingItems`·`emptyTrending`·trending 배선 제거; `getHomeDashboard`에 `marketPulse`(B) 추가
- Modify: `backend/src/types/homeDashboard.ts` — `TrendingBuildingItem`·`trendingBuildings` 제거; `MarketPulse` 추가
- Modify: `backend/src/server.ts`(또는 라우트 등록부) — 새 라우트 마운트

**프론트**
- Create: `frontend/composables/useLocalMarket.ts` — 지역 선택(하이브리드)·localStorage·API 호출
- Create: `frontend/components/home/HomeLocalMarket.vue` — 전국 뷰 + 우리 동네 뷰
- Create: `frontend/components/home/HomeMarketPulse.vue` — B 전국 거래 활발도
- Delete: `frontend/components/home/HomeTrendingBuildings.vue`
- Modify: `frontend/pages/index.vue` — A/B/C 배치, 인기 단지 제거
- Modify: `frontend/composables/useHomeDashboard.ts` — `TrendingBuildingItem`·`trendingBuildings` 제거, `MarketPulse` 추가
- Modify: `frontend/tests/setup.ts` — `HomeTrendingBuildings` stub 제거, 신규 컴포넌트 stub

---

### Task 1: 공유 유틸 export + 전국 뷰 집계 (`localMarketService`)

**Files:**
- Modify: `backend/src/services/metaService.ts` (`M2_PER_PYEONG:246`, `RawSumRow:248`, `rowToPricePerPyeong:250`)
- Create: `backend/src/services/localMarketService.ts`
- Test: `backend/__tests__/services/localMarketService.test.ts`

**Interfaces:**
- Consumes: `dealDateRangeFilter(from,to,alias?)` (realEstateDateFilter.js), `CITY_SLUG_TO_FULL`/`CITY_SLUG_TO_SHORT` (cityMapping.js), `TABLE_NAME_MAP` (realEstateService.js)
- Produces:
  - `export const M2_PER_PYEONG`, `export type RawSumRow`, `export function rowToPricePerPyeong` (metaService에서 export)
  - `getNationwideMarket(type: PropType, txn: TxnType): Promise<{ mode:'nationwide'; byCity: CityMarketRow[] }>`
  - `type CityMarketRow = { cityName: string; citySlug: string; pyeongPriceManwon: number | null; txnCount: number }`
  - `type PropType = 'apt'|'villa'|'offitel'`, `type TxnType = 'sale'|'jeonse'|'wolse'`

- [ ] **Step 1: metaService에서 공유 심볼 export**

`metaService.ts:246,248,250`의 3개 선언에 `export` 추가(값·로직 불변):
```typescript
export const M2_PER_PYEONG = 3.3058;
export type RawSumRow = { sumPrice: number | null; sumArea: number | null; cnt: bigint };
export function rowToPricePerPyeong(row: RawSumRow | undefined): { pricePerPyeong: number | null; count: number } {
```

- [ ] **Step 2: 실패 테스트 작성**

`backend/__tests__/services/localMarketService.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockQueryRaw = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw, $queryRawUnsafe: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getNationwideMarket } from '../../src/services/localMarketService.js';

describe('getNationwideMarket', () => {
  beforeEach(() => { mockQueryRaw.mockReset(); });

  it('시·도별 평당가 내림차순 + citySlug 매핑', async () => {
    mockQueryRaw.mockResolvedValue([
      { city: '경기', sumPrice: 100n, sumArea: 50, cnt: 16180n },
      { city: '서울', sumPrice: 200n, sumArea: 50, cnt: 4825n },
    ]);
    const res = await getNationwideMarket('apt', 'sale');
    expect(res.mode).toBe('nationwide');
    // 서울 평당(200/50*3.3058=13.2) > 경기(100/50*3.3058=6.6) → 서울 먼저
    expect(res.byCity[0].cityName).toBe('서울');
    expect(res.byCity[0].citySlug).toBe('seoul');
    expect(res.byCity[0].txnCount).toBe(4825);
    expect(res.byCity[0].pyeongPriceManwon).toBeGreaterThan(res.byCity[1].pyeongPriceManwon!);
  });

  it('city variant(서울/서울특별시) 중복을 한 행으로 합산', async () => {
    mockQueryRaw.mockResolvedValue([
      { city: '서울', sumPrice: 100n, sumArea: 50, cnt: 100n },
      { city: '서울특별시', sumPrice: 100n, sumArea: 50, cnt: 50n },
    ]);
    const res = await getNationwideMarket('apt', 'sale');
    const seoul = res.byCity.filter((r) => r.citySlug === 'seoul');
    expect(seoul).toHaveLength(1);
    expect(seoul[0].txnCount).toBe(150);
  });
});
```

- [ ] **Step 3: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run __tests__/services/localMarketService.test.ts
```
Expected: FAIL — `getNationwideMarket` 미정의.

- [ ] **Step 4: 구현**

`backend/src/services/localMarketService.ts` (전국 뷰 부분):
```typescript
import { prisma } from '../lib/prisma.js';
import { Prisma } from '@prisma/client';
import { M2_PER_PYEONG, type RawSumRow } from './metaService.js';
import { dealDateRangeFilter } from './realEstateDateFilter.js';
import { CITY_SLUG_TO_FULL } from './cityMapping.js';

export type PropType = 'apt' | 'villa' | 'offitel';
export type TxnType = 'sale' | 'jeonse' | 'wolse';

export interface CityMarketRow {
  cityName: string;
  citySlug: string;
  pyeongPriceManwon: number | null;
  txnCount: number;
}

// 시·도 정식명/축약명 → slug 역매핑 (variant 병합용)
const CITY_NAME_TO_SLUG: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [slug, full] of Object.entries(CITY_SLUG_TO_FULL)) {
    m[full] = slug;
    m[full.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '')] = slug; // 축약형
  }
  return m;
})();

// PropType×TxnType → 테이블/가격컬럼/rentType
function resolveTable(type: PropType, txn: TxnType): { table: string; priceCol: string; rentType: string | null } {
  const base = type === 'apt' ? 'Apt' : type === 'villa' ? 'Villa' : 'Offitel';
  if (txn === 'sale') return { table: `${base}SaleTransaction`, priceCol: 'dealAmount', rentType: null };
  const rentType = txn === 'jeonse' ? '전세' : '월세';
  const priceCol = txn === 'jeonse' ? 'deposit' : 'monthlyRent';
  return { table: `${base}RentTransaction`, priceCol, rentType };
}

// 데이터 최신일 anchor 기준 최근 N일 (신고 시차 대응). 간단화: 현재 월 기준 최근 30일.
function recentRange(days: number): { from: string; to: string } {
  const kstNow = new Date(Date.now() + 9 * 3600 * 1000);
  const to = kstNow.toISOString().slice(0, 10);
  const f = new Date(kstNow); f.setUTCDate(f.getUTCDate() - days);
  const from = f.toISOString().slice(0, 10);
  return { from, to };
}

export async function getNationwideMarket(type: PropType, txn: TxnType): Promise<{ mode: 'nationwide'; byCity: CityMarketRow[] }> {
  const { table, priceCol, rentType } = resolveTable(type, txn);
  const { from, to } = recentRange(30);
  const rentClause = rentType ? Prisma.sql`AND rentType = ${rentType}` : Prisma.empty;
  const priceExpr = Prisma.raw(priceCol);
  const tableRaw = Prisma.raw(table);

  const rows = await prisma.$queryRaw<Array<{ city: string } & RawSumRow>>`
    SELECT city, SUM(${priceExpr}) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM ${tableRaw}
    WHERE ${dealDateRangeFilter(from, to)} AND exclusiveArea > 0 ${rentClause}
    GROUP BY city`;

  // city variant 병합 (서울/서울특별시 → seoul)
  const bySlug = new Map<string, { sumPrice: number; sumArea: number; cnt: number; name: string }>();
  for (const r of rows) {
    const slug = CITY_NAME_TO_SLUG[r.city];
    if (!slug) continue;
    const acc = bySlug.get(slug) ?? { sumPrice: 0, sumArea: 0, cnt: 0, name: r.city.replace(/(특별시|광역시|특별자치시|특별자치도|도)$/, '') };
    acc.sumPrice += Number(r.sumPrice ?? 0);
    acc.sumArea += Number(r.sumArea ?? 0);
    acc.cnt += Number(r.cnt ?? 0);
    bySlug.set(slug, acc);
  }

  const byCity: CityMarketRow[] = [...bySlug.entries()].map(([citySlug, a]) => ({
    cityName: a.name,
    citySlug,
    pyeongPriceManwon: a.sumArea > 0 ? Math.round((a.sumPrice / a.sumArea) * M2_PER_PYEONG) : null,
    txnCount: a.cnt,
  }));
  byCity.sort((x, y) => (y.pyeongPriceManwon ?? 0) - (x.pyeongPriceManwon ?? 0));
  return { mode: 'nationwide', byCity };
}
```

주의: `CITY_SLUG_TO_FULL`의 실제 축약 규칙을 구현 시 `cityMapping.ts`에서 확인해 `CITY_NAME_TO_SLUG`가 DB의 `city` 값(예 '서울','서울특별시','경기','경기도')을 모두 커버하는지 검증. 커버 못하면 `CITY_SLUG_TO_SHORT`도 역매핑에 추가.

- [ ] **Step 5: 테스트 통과 확인**

```bash
npx vitest run __tests__/services/localMarketService.test.ts
npx tsc --noEmit
```
Expected: PASS, tsc 0.

- [ ] **Step 6: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git checkout develop && git pull
git checkout -b feat/home-realestate-market-redesign
git add backend/src/services/metaService.ts backend/src/services/localMarketService.ts backend/__tests__/services/localMarketService.test.ts
git -c commit.gpgsign=false commit -m "feat(home): 전국 뷰 시·도별 시세 집계 (localMarketService)"
```

---

### Task 2: 우리 동네 뷰 표본 적응 (`getLocalMarket`)

**Files:**
- Modify: `backend/src/services/localMarketService.ts`
- Test: `backend/__tests__/services/localMarketService.test.ts`

**Interfaces:**
- Consumes: Task 1의 `resolveTable`, `recentRange`, `rowToPricePerPyeong`, `dealDateRangeFilter`, `buildRegionFilter`/`CITY_SLUG_TO_FULL`
- Produces:
  - `getLocalMarket(opts: { citySlug: string; districtSlug: string; type: PropType; txn: TxnType }): Promise<LocalMarketResult>`
  - `type LocalMarketResult = { mode:'local'; resolved:{level:'district'|'city'; regionLabel:string; periodMonths:number; sampleCount:number}; fallback:'none'|'quarter'|'city'|'dealsOnly'; headline: Headline | null; byArea: AreaBand[]; recentDeals: Deal[] }`
  - `MIN_SAMPLE = 20`, `MIN_AREA_BAND = 5`
  - `type Headline = { pyeongPriceManwon:number|null; avgPriceManwon:number|null; deltaPct:number|null; txnCount:number }`
  - `type AreaBand = { band:string; avgPriceManwon:number; count:number }`
  - `type Deal = { buildingName:string; area:number; floor:number|null; priceManwon:number; dealDate:string }`

- [ ] **Step 1: 실패 테스트 작성**

`localMarketService.test.ts`에 추가:
```typescript
import { getLocalMarket, MIN_SAMPLE } from '../../src/services/localMarketService.js';

describe('getLocalMarket 표본 적응', () => {
  beforeEach(() => { mockQueryRaw.mockReset(); });

  it('시군구 1개월 표본 충분 → fallback none', async () => {
    // 1) 시군구 월 집계(충분), 2) 평형별, 3) 최근실거래, 4) 전월 평당가
    mockQueryRaw
      .mockResolvedValueOnce([{ sumPrice: 5000n, sumArea: 30, cnt: 193n }]) // 시군구 월
      .mockResolvedValueOnce([]) // byArea
      .mockResolvedValueOnce([]) // deals
      .mockResolvedValueOnce([{ sumPrice: 4900n, sumArea: 30, cnt: 200n }]); // 전월
    const res = await getLocalMarket({ citySlug: 'seoul', districtSlug: 'gangnam', type: 'apt', txn: 'sale' });
    expect(res.mode).toBe('local');
    expect(res.fallback).toBe('none');
    expect(res.resolved.sampleCount).toBe(193);
    expect(res.headline!.txnCount).toBe(193);
  });

  it('시군구 월 부족 → 분기 확대(quarter)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ sumPrice: 100n, sumArea: 30, cnt: 5n }]) // 시군구 월(부족, <20)
      .mockResolvedValueOnce([{ sumPrice: 3000n, sumArea: 90, cnt: 60n }]) // 시군구 분기(충분)
      .mockResolvedValueOnce([]) // byArea
      .mockResolvedValueOnce([]) // deals
      .mockResolvedValueOnce([{ sumPrice: 2900n, sumArea: 90, cnt: 55n }]); // 전분기
    const res = await getLocalMarket({ citySlug: 'gangwon', districtSlug: 'goseong', type: 'villa', txn: 'sale' });
    expect(res.fallback).toBe('quarter');
    expect(res.resolved.periodMonths).toBe(3);
  });

  it('시군구 분기도 부족 → 시도 폴백(city)', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ sumPrice: 10n, sumArea: 30, cnt: 2n }]) // 시군구 월(부족)
      .mockResolvedValueOnce([{ sumPrice: 30n, sumArea: 30, cnt: 8n }]) // 시군구 분기(부족)
      .mockResolvedValueOnce([{ sumPrice: 5000n, sumArea: 100, cnt: 300n }]) // 시도 월(충분)
      .mockResolvedValueOnce([]) // byArea
      .mockResolvedValueOnce([]) // deals
      .mockResolvedValueOnce([{ sumPrice: 4900n, sumArea: 100, cnt: 290n }]); // 시도 전월
    const res = await getLocalMarket({ citySlug: 'gangwon', districtSlug: 'goseong', type: 'offitel', txn: 'jeonse' });
    expect(res.fallback).toBe('city');
    expect(res.resolved.level).toBe('city');
  });

  it('전부 부족(표본 0) → dealsOnly, headline null', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([{ sumPrice: null, sumArea: null, cnt: 0n }]) // 시군구 월
      .mockResolvedValueOnce([{ sumPrice: null, sumArea: null, cnt: 0n }]) // 시군구 분기
      .mockResolvedValueOnce([{ sumPrice: null, sumArea: null, cnt: 0n }]) // 시도 월
      .mockResolvedValueOnce([]) // byArea
      .mockResolvedValueOnce([{ buildingName: 'X', area: 30, floor: 2, priceManwon: 10000, dealDate: '2026-07-01' }]); // deals
    const res = await getLocalMarket({ citySlug: 'jeju', districtSlug: 'jeju', type: 'villa', txn: 'wolse' });
    expect(res.fallback).toBe('dealsOnly');
    expect(res.headline).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
npx vitest run __tests__/services/localMarketService.test.ts
```
Expected: FAIL — `getLocalMarket` 미정의.

- [ ] **Step 3: 구현**

`localMarketService.ts`에 추가. 스펙 §"표본 적응 (계단)"의 4단계를 그대로 구현.

```typescript
export const MIN_SAMPLE = 20;
export const MIN_AREA_BAND = 5;

export interface Headline { pyeongPriceManwon: number | null; avgPriceManwon: number | null; deltaPct: number | null; txnCount: number; }
export interface AreaBand { band: string; avgPriceManwon: number; count: number; }
export interface Deal { buildingName: string; area: number; floor: number | null; priceManwon: number; dealDate: string; }
export interface LocalMarketResult {
  mode: 'local';
  resolved: { level: 'district' | 'city'; regionLabel: string; periodMonths: number; sampleCount: number };
  fallback: 'none' | 'quarter' | 'city' | 'dealsOnly';
  headline: Headline | null;
  byArea: AreaBand[];
  recentDeals: Deal[];
}

// 한 스코프(지역+기간)의 SUM/COUNT 집계 1행
async function aggScope(table: string, priceCol: string, rentType: string | null,
                        cityVariants: string[] | null, district: string | null,
                        from: string, to: string): Promise<RawSumRow> {
  const priceExpr = Prisma.raw(priceCol);
  const tableRaw = Prisma.raw(table);
  const rentClause = rentType ? Prisma.sql`AND rentType = ${rentType}` : Prisma.empty;
  const cityClause = cityVariants ? Prisma.sql`AND city IN (${Prisma.join(cityVariants)})` : Prisma.empty;
  const distClause = district ? Prisma.sql`AND district = ${district}` : Prisma.empty;
  const rows = await prisma.$queryRaw<[RawSumRow]>`
    SELECT SUM(${priceExpr}) AS sumPrice, SUM(exclusiveArea) AS sumArea, COUNT(*) AS cnt
    FROM ${tableRaw}
    WHERE ${dealDateRangeFilter(from, to)} AND exclusiveArea > 0 ${rentClause} ${cityClause} ${distClause}`;
  return rows[0];
}
```

전체 흐름(계단):
1. 시군구+월(30일) `aggScope` → cnt ≥ MIN_SAMPLE → `none`, level=district, periodMonths=1
2. 아니면 시군구+분기(90일) → cnt ≥ MIN_SAMPLE → `quarter`, periodMonths=3
3. 아니면 시도+월 → cnt ≥ MIN_SAMPLE → `city`, level=city, periodMonths=1
4. 아니면 → `dealsOnly`, headline=null

채택된 스코프에서:
- `headline`: `rowToPricePerPyeong`로 평당가, `avgPriceManwon = round(sumPrice/cnt)`, `deltaPct`는 직전 동일기간 대비 평당가((cur-prev)/prev*100), `txnCount=cnt`.
- `byArea`: 채택 스코프에서 평형 버킷별 `AVG(가격),COUNT(*)` 쿼리, `count ≥ MIN_AREA_BAND` 버킷만.
- `recentDeals`: 채택 스코프에서 `ORDER BY dealDate DESC LIMIT 5` (buildingName,area,floor,priceManwon,dealDate).
- `cityVariants`: `[CITY_SLUG_TO_FULL[citySlug], CITY_SLUG_TO_SHORT[citySlug]].filter(Boolean)`.
- `regionLabel`: level=district면 "축약시도 구명", city면 "축약시도".

(전체 구현 코드는 위 헬퍼 + 스펙 계단표를 따라 작성. `deltaPct` 전월/전분기 비교는 `recentRange` 를 2배 기간으로 잡아 직전 구간 `aggScope` 1회 추가.)

- [ ] **Step 4: 테스트 통과 확인**

```bash
npx vitest run __tests__/services/localMarketService.test.ts
npx tsc --noEmit
```
Expected: 전국 뷰 + 표본 적응 테스트 전부 PASS.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/localMarketService.ts backend/__tests__/services/localMarketService.test.ts
git -c commit.gpgsign=false commit -m "feat(home): 우리 동네 뷰 표본 적응 4단계 (getLocalMarket)"
```

---

### Task 3: 엔드포인트 라우트 + Zod 스키마 + 캐시

**Files:**
- Create: `backend/src/schemas/localMarket.ts`
- Modify: `backend/src/services/localMarketService.ts` (캐시 래퍼)
- Modify: `backend/src/routes/realEstate.ts` (라우트 추가) 또는 Create `backend/src/routes/localMarket.ts` + server 마운트
- Test: `backend/__tests__/services/localMarketService.test.ts` (캐시)

**Interfaces:**
- Consumes: Task 1·2의 `getNationwideMarket`, `getLocalMarket`, `PropType`, `TxnType`
- Produces: `GET /api/real-estate/local-market?type=&txn=&citySlug=&districtSlug=` → 스펙 응답 형태

- [ ] **Step 1: Zod 스키마 (실패 테스트 없이 스키마부터)**

`backend/src/schemas/localMarket.ts`:
```typescript
import { z } from 'zod';

export const LocalMarketQuerySchema = z.object({
  type: z.enum(['apt', 'villa', 'offitel']).default('apt'),
  txn: z.enum(['sale', 'jeonse', 'wolse']).default('sale'),
  citySlug: z.string().min(1).optional(),
  districtSlug: z.string().min(1).optional(),
});
export type LocalMarketQuery = z.infer<typeof LocalMarketQuerySchema>;
```

- [ ] **Step 2: 캐시 래퍼 테스트**

`localMarketService.test.ts`에 추가:
```typescript
import { getMarket, _clearMarketCache } from '../../src/services/localMarketService.js';

describe('getMarket 캐시', () => {
  beforeEach(() => { mockQueryRaw.mockReset(); _clearMarketCache(); });

  it('같은 키 2회 호출 시 DB는 1회만', async () => {
    mockQueryRaw.mockResolvedValue([{ city: '서울', sumPrice: 100n, sumArea: 50, cnt: 10n }]);
    await getMarket({ type: 'apt', txn: 'sale' });   // 전국(지역 없음)
    const callsAfter1 = mockQueryRaw.mock.calls.length;
    await getMarket({ type: 'apt', txn: 'sale' });
    expect(mockQueryRaw.mock.calls.length).toBe(callsAfter1); // 캐시 히트
  });

  it('지역 없으면 전국, 있으면 우리 동네 라우팅', async () => {
    mockQueryRaw.mockResolvedValue([{ city: '서울', sumPrice: 100n, sumArea: 50, cnt: 10n }]);
    const nation = await getMarket({ type: 'apt', txn: 'sale' });
    expect(nation.mode).toBe('nationwide');
  });
});
```

- [ ] **Step 3: 캐시 래퍼 구현**

`localMarketService.ts`에 `getMarket` + 인메모리 LRU(Map, TTL 1h, 상한 500) + `_clearMarketCache`(테스트용):
```typescript
type MarketResult = { mode: 'nationwide'; byCity: CityMarketRow[] } | LocalMarketResult;
const CACHE_TTL = 60 * 60 * 1000, CACHE_MAX = 500;
const cache = new Map<string, { data: MarketResult; exp: number }>();
export function _clearMarketCache() { cache.clear(); }

export async function getMarket(q: { type: PropType; txn: TxnType; citySlug?: string; districtSlug?: string }): Promise<MarketResult> {
  const key = `${q.type}|${q.txn}|${q.citySlug ?? ''}|${q.districtSlug ?? ''}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.data;
  const data = (q.citySlug && q.districtSlug)
    ? await getLocalMarket({ citySlug: q.citySlug, districtSlug: q.districtSlug, type: q.type, txn: q.txn })
    : await getNationwideMarket(q.type, q.txn);
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { data, exp: Date.now() + CACHE_TTL });
  return data;
}
```
(테스트에서 `Date.now` 사용 가능 — 이 서비스는 스크립트 아닌 런타임이라 제약 없음.)

- [ ] **Step 4: 라우트 추가**

`backend/src/routes/realEstate.ts`에 추가(기존 realEstate 라우트에 편입):
```typescript
import { getMarket } from '../services/localMarketService.js';
import { LocalMarketQuerySchema } from '../schemas/localMarket.js';

// GET /api/real-estate/local-market
router.get('/local-market', validate(LocalMarketQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { type, txn, citySlug, districtSlug } = req.query as unknown as import('../schemas/localMarket.js').LocalMarketQuery;
  const data = await getMarket({ type, txn, citySlug, districtSlug });
  res.set('Cache-Control', 's-maxage=3600');
  res.json(data);
}));
```
라우트 순서 주의: `/:type` 같은 동적 파라미터 라우트보다 **앞에** 등록(`/local-market`이 `:type`에 잡히지 않도록).

- [ ] **Step 5: 테스트 + 빌드**

```bash
npx vitest run __tests__/services/localMarketService.test.ts
npx vitest run
npx tsc --noEmit && npm run lint
```
Expected: 전부 통과(rentalPriceStats afterAll flake 제외), tsc·lint 0.

- [ ] **Step 6: 라이브 스모크(선택) + 커밋**

```bash
git add backend/src/schemas/localMarket.ts backend/src/services/localMarketService.ts backend/src/routes/realEstate.ts backend/__tests__/services/localMarketService.test.ts
git -c commit.gpgsign=false commit -m "feat(home): local-market 엔드포인트 + 캐시"
```

---

### Task 4: 전국 거래 활발도(B) — getHomeDashboard 편승

**Files:**
- Modify: `backend/src/types/homeDashboard.ts` (`MarketPulse` 추가)
- Modify: `backend/src/services/metaService.ts` (`getMarketPulse` + `getHomeDashboard` 편입)
- Test: `backend/__tests__/services/metaService*.test.ts` 또는 신규

**Interfaces:**
- Produces: `MarketPulse = { thisWeekCount: number; deltaPct: number | null }`; `getHomeDashboard` 응답에 `marketPulse: MarketPulse`

- [ ] **Step 1: 타입 추가**

`homeDashboard.ts`:
```typescript
export interface MarketPulse { thisWeekCount: number; deltaPct: number | null; }
```
`HomeDashboardResponse`에 `marketPulse: MarketPulse` 추가.

- [ ] **Step 2: 실패 테스트**

전국 아파트 매매 최근 7일 vs 직전 7일 거래량:
```typescript
it('marketPulse: 이번주 vs 전주 거래량 증감', async () => {
  // mock: 이번주 count=12483, 전주=11558 → delta ≈ +8%
  // getMarketPulse 단위 또는 getHomeDashboard 응답 marketPulse 필드 검증
});
```
(구현 구조에 맞춰 mock 시퀀스 작성. `AptSaleTransaction` 최근 7일/직전 7일 COUNT 2쿼리.)

- [ ] **Step 3: 구현**

`metaService.ts`에 `getMarketPulse()`:
```typescript
async function getMarketPulse(): Promise<MarketPulse> {
  const now = recentRangeYmd(); // 오늘/‑7/‑14 (기존 ymdNDaysAgo 재사용)
  const [thisWeek] = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*) c FROM AptSaleTransaction WHERE ${dealDateRangeFilter(ymdNDaysAgo(7), ymdNDaysAgo(0))}`;
  const [lastWeek] = await prisma.$queryRaw<[{ c: bigint }]>`
    SELECT COUNT(*) c FROM AptSaleTransaction WHERE ${dealDateRangeFilter(ymdNDaysAgo(14), ymdNDaysAgo(8))}`;
  const tw = Number(thisWeek.c), lw = Number(lastWeek.c);
  return { thisWeekCount: tw, deltaPct: lw > 0 ? Math.round(((tw - lw) / lw) * 1000) / 10 : null };
}
```
`getHomeDashboard`의 `Promise.allSettled` 배열에 추가, 응답 `marketPulse` 매핑(실패 시 `{ thisWeekCount: 0, deltaPct: null }`).

- [ ] **Step 4: 테스트 + 커밋**

```bash
npx vitest run && npx tsc --noEmit
git add backend/src/types/homeDashboard.ts backend/src/services/metaService.ts backend/__tests__/...
git -c commit.gpgsign=false commit -m "feat(home): 전국 거래 활발도(marketPulse) 대시보드 편입"
```

---

### Task 5: 인기 단지 제거 (백엔드)

**Files:**
- Modify: `backend/src/services/metaService.ts` (`getTrendingBuildings`, `rowsToTrendingItems`, `emptyTrending`, `TrendingTxnRow`, `getHomeDashboard`의 trending 배선)
- Modify: `backend/src/types/homeDashboard.ts` (`TrendingBuildingItem`, `trendingBuildings`)
- Test: 기존 테스트에서 trending 참조 제거

**Interfaces:** 없음(제거)

- [ ] **Step 1: 참조 전수 확인**

```bash
grep -rn "getTrendingBuildings\|trendingBuildings\|TrendingBuildingItem\|TrendingTxnRow\|rowsToTrendingItems\|emptyTrending" backend/src backend/__tests__
```

- [ ] **Step 2: 제거**

- `metaService.ts`: `getTrendingBuildings`, `rowsToTrendingItems`, `emptyTrending`, `TrendingTxnRow` 삭제. `getHomeDashboard`의 `Promise.allSettled`에서 `getTrendingBuildings()` 제거, 응답 `trendingBuildings` 필드 제거.
- `homeDashboard.ts`: `TrendingBuildingItem`, `HomeDashboardResponse.trendingBuildings` 삭제.
- 관련 테스트에서 trending 참조 제거.

- [ ] **Step 3: 검증**

```bash
grep -c "TrendingBuilding\|trendingBuildings" backend/src   # 0 기대
npx tsc --noEmit && npx vitest run
```
Expected: grep 0, tsc·테스트 통과.

- [ ] **Step 4: 커밋**

```bash
git add backend/src
git -c commit.gpgsign=false commit -m "refactor(home): 이번 주 인기 단지(getTrendingBuildings) 백엔드 제거"
```

---

### Task 6: 지역 선택 composable (`useLocalMarket`)

**Files:**
- Create: `frontend/composables/useLocalMarket.ts`
- Test: `frontend/tests/composables/useLocalMarket.test.ts`

**Interfaces:**
- Consumes: `$fetch` + `useRuntimeConfig().public.apiBase`, `localStorage`
- Produces: `useLocalMarket()` → `{ mode, data, region, type, txn, selectRegion(citySlug,districtSlug,label), clearRegion(), setType(), setTxn(), useMyLocation() }`
- 저장 키: `localStorage['ilsangkit:localMarketRegion']` = `{ citySlug, districtSlug, label }`

- [ ] **Step 1: 실패 테스트 (localStorage 복원·방어)**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readSavedRegion, REGION_KEY } from '../../composables/useLocalMarket';

describe('useLocalMarket localStorage', () => {
  beforeEach(() => { localStorage.clear(); });

  it('저장값 없으면 null(전국 뷰)', () => {
    expect(readSavedRegion()).toBeNull();
  });
  it('유효 저장값 복원', () => {
    localStorage.setItem(REGION_KEY, JSON.stringify({ citySlug: 'seoul', districtSlug: 'gangnam', label: '서울 강남구' }));
    expect(readSavedRegion()?.citySlug).toBe('seoul');
  });
  it('깨진 JSON은 null로 방어', () => {
    localStorage.setItem(REGION_KEY, '{broken');
    expect(readSavedRegion()).toBeNull();
  });
  it('필드 누락 저장값은 null로 방어', () => {
    localStorage.setItem(REGION_KEY, JSON.stringify({ citySlug: 'seoul' }));
    expect(readSavedRegion()).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend
source ~/.nvm/nvm.sh && nvm use 20
npx vitest run tests/composables/useLocalMarket.test.ts
```
Expected: FAIL — 미정의.

- [ ] **Step 3: 구현 (SSR 가드 필수)**

```typescript
export const REGION_KEY = 'ilsangkit:localMarketRegion';
export interface SavedRegion { citySlug: string; districtSlug: string; label: string; }

export function readSavedRegion(): SavedRegion | null {
  if (!import.meta.client) return null;
  try {
    const raw = localStorage.getItem(REGION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.citySlug === 'string' && typeof p.districtSlug === 'string' && typeof p.label === 'string') return p;
    return null;
  } catch { return null; }
}
```
`useLocalMarket()`: reactive `region`(초기 = SSR은 null=전국 뷰, 클라이언트 마운트 후 `readSavedRegion()` 복원), `type`/`txn` refs, `data`(useAsyncData/`$fetch`로 `/api/real-estate/local-market` 호출 — region 있으면 citySlug/districtSlug 붙임), `selectRegion`(저장+갱신), `clearRegion`(localStorage 삭제+전국 뷰), `useMyLocation`(navigator.geolocation → 역지오코딩은 범위 밖이므로 좌표→최근접 지역 매핑은 후속; 지금은 버튼만 두고 미구현이면 스펙대로 "옵션"으로 no-op + 안내). **SSR 가드: 모든 localStorage/navigator 접근에 `import.meta.client`.**

- [ ] **Step 4: 통과 확인 + 커밋**

```bash
npx vitest run tests/composables/useLocalMarket.test.ts
git add frontend/composables/useLocalMarket.ts frontend/tests/composables/useLocalMarket.test.ts
git -c commit.gpgsign=false commit -m "feat(home): 지역 선택 composable (하이브리드+localStorage)"
```

---

### Task 7: `HomeLocalMarket.vue` (A — 전국 뷰 + 우리 동네 뷰)

**Files:**
- Create: `frontend/components/home/HomeLocalMarket.vue`
- Test: `frontend/tests/components/home/HomeLocalMarket.test.ts`

**Interfaces:**
- Consumes: `useLocalMarket()`, `formatPricePerPyeong`/`formatPriceManwon`/`formatChange` (`~/utils/priceFormat`)
- Props: 없음(composable로 자체 상태) 또는 SSR 초기 데이터 prop

- [ ] **Step 1: 실패 테스트 (모드별 렌더)**

목업(`realestate-nationwide-view.html`, `realestate-home-mockup.html`)의 구조 기준. Nuxt auto-import는 명시 import(메모리: vitest auto-import 함정).
```typescript
import { mount } from '@vue/test-utils';
import { ref } from 'vue';
import HomeLocalMarket from '../../../components/home/HomeLocalMarket.vue';

// useLocalMarket 모킹: mode='nationwide' → 시·도 막대 렌더
it('전국 뷰: 시·도별 막대 + CTA', () => { /* byCity mock, '우리 동네 시세 보기' 존재, 시·도명 렌더 */ });
it('우리 동네 뷰 none: 평당가·평형별·최근실거래', () => { /* headline/byArea/recentDeals 렌더 */ });
it('우리 동네 뷰 city 폴백: "OO도 기준" 안내 배지', () => { /* fallback==="city" 안내 */ });
it('dealsOnly: headline 없이 실거래만', () => { /* headline null, deals만 */ });
```

- [ ] **Step 2~4: 구현·통과**

두 모드 `v-if="mode==='nationwide'"` / `else`. 전국 뷰 = 시·도 막대 리스트(막대 width = pyeongPrice/최대값) + CTA. 우리 동네 뷰 = 지역칩+탭+`headline`(formatPricePerPyeong)+`byArea`+`recentDeals`, `fallback` 배지. 금액 포맷은 `priceFormat` 재사용. 프로젝트 디자인 톤(코발트, rounded-2xl, border-line, shadow-card, text-strong/muted). SSR 가드 준수.

```bash
npx vitest run tests/components/home/HomeLocalMarket.test.ts && npm run lint
```

- [ ] **Step 5: 커밋** `feat(home): HomeLocalMarket 전국뷰+우리동네뷰`

---

### Task 8: `HomeMarketPulse.vue` (B — 전국 거래 활발도)

**Files:**
- Create: `frontend/components/home/HomeMarketPulse.vue`
- Test: `frontend/tests/components/home/HomeMarketPulse.test.ts`

**Interfaces:**
- Props: `pulse: { thisWeekCount: number; deltaPct: number | null }`
- Consumes: `formatChange` (`~/utils/priceFormat`)

- [ ] **Step 1: 실패 테스트**

```typescript
it('거래량+증감 렌더', () => { /* props pulse → "12,483건", "▲8%" 텍스트 */ });
it('deltaPct null이면 증감 숨김', () => { /* null → 화살표/퍼센트 없음 */ });
```

- [ ] **Step 2~4:** 코발트 그라데이션 띠. `thisWeekCount.toLocaleString()`, `formatChange(deltaPct)`. deltaPct 부호로 색(상승 빨강/하락 파랑, 한국 관례).

- [ ] **Step 5: 커밋** `feat(home): HomeMarketPulse 전국 거래 활발도`

---

### Task 9: index.vue 통합 + 인기 단지 제거 (프론트) + C 강등

**Files:**
- Modify: `frontend/pages/index.vue` (`:90-94`, import `:292-293`, computed `:395,423`)
- Delete: `frontend/components/home/HomeTrendingBuildings.vue`
- Modify: `frontend/composables/useHomeDashboard.ts` (`TrendingBuildingItem`, `trendingBuildings` 제거, `MarketPulse` 추가)
- Modify: `frontend/tests/setup.ts` (stub 정리)
- Modify: `frontend/tests/e2e/home-hotspot.spec.ts` (trendingBuildings 참조 제거)

**Interfaces:**
- Consumes: Task 7 `HomeLocalMarket`, Task 8 `HomeMarketPulse`, 기존 `HomeHotspotSignals`

- [ ] **Step 1: 배치 교체**

`index.vue`의 부동산 섹션(`:90-94`)을:
```vue
<!-- A: 우리 동네 시세 (전국뷰/우리동네뷰) -->
<HomeLocalMarket />
<!-- B: 전국 거래 활발도 -->
<HomeMarketPulse :pulse="dashboard?.marketPulse ?? { thisWeekCount: 0, deltaPct: null }" />
<!-- C: 뜨는 동네 (강등) -->
<HomeHotspotSignals :hotspots="hotspots" />
```
`HomeTrendingBuildings` import·렌더·computed(`trendingBuildings` `:395`, `:423`) 제거. 신규 컴포넌트 import 추가.

- [ ] **Step 2: 타입·stub·e2e 정리**

- `useHomeDashboard.ts`: `TrendingBuildingItem`·`trendingBuildings` 제거, `MarketPulse` 추가, `HomeDashboard`에 `marketPulse` 추가.
- `tests/setup.ts:108`: `HomeTrendingBuildings` stub 제거, `HomeLocalMarket`·`HomeMarketPulse` stub 추가.
- `tests/e2e/home-hotspot.spec.ts:33`: `trendingBuildings` 목 제거.

- [ ] **Step 3: 파일 삭제 + 검증**

```bash
git rm frontend/components/home/HomeTrendingBuildings.vue
cd frontend && source ~/.nvm/nvm.sh && nvm use 20
grep -rn "HomeTrendingBuildings\|trendingBuildings\|TrendingBuildingItem" components pages composables tests   # 0 기대
npx vitest run && npm run lint
```
Expected: grep 0, 프론트 테스트 통과, lint 0.

- [ ] **Step 4: 커밋** `feat(home): index 통합 + 인기 단지 제거 + 뜨는 동네 강등`

---

### Task 10: 로컬 라이브 검증

**Files:** 없음(검증 전용, 커밋 없음)

- [ ] **Step 1: 백엔드 dev + 엔드포인트 스모크**

```bash
cd backend && npm run dev &   # 또는 별도 셸
curl -s "http://localhost:8000/api/real-estate/local-market?type=apt&txn=sale" | head -c 400        # 전국 뷰
curl -s "http://localhost:8000/api/real-estate/local-market?type=apt&txn=sale&citySlug=seoul&districtSlug=gangnam" | head -c 500  # 우리 동네
```
Expected: 전국 뷰 `mode:nationwide` byCity 정렬; 강남 `mode:local` headline 평당가.

- [ ] **Step 2: 프론트 dev + 홈 육안**

```bash
cd frontend && npm run dev
```
브라우저에서 홈: 전국 뷰(시·도 막대) → 지역 선택 → 우리 동네 뷰 → 재로드 시 복원. 인기 단지 없음. 뜨는 동네 강등 위치. B 띠.

- [ ] **Step 3: 전체 스위트 + 결과 보고**

```bash
cd backend && npx vitest run; cd ../frontend && npx vitest run
```
전부 green 확인 후 보고. (PR은 finishing-a-development-branch에서.)

---

## Self-Review

**1. Spec coverage:**
- 전국 뷰(모드1) → Task 1 ✓ / 우리 동네 뷰 표본 적응(모드2) → Task 2 ✓ / 엔드포인트·캐시 → Task 3 ✓
- B 전국 거래 활발도 → Task 4, 8 ✓ / 인기 단지 제거 → Task 5(백), 9(프론트) ✓
- 지역 선택 하이브리드+localStorage → Task 6 ✓ / A 컴포넌트 두 모드 → Task 7 ✓
- C 강등 → Task 9 ✓ / 억 포맷(priceFormat 재사용) → Global + Task 7,8 ✓
- 검증 → Task 10 ✓

**2. Placeholder scan:** Task 2·7·8의 일부 구현은 "스펙 계단표/목업 구조를 따라 작성"으로 골격+참조 — 로직이 스펙에 완전 명세돼 있고 헬퍼(`aggScope`)는 완전 코드. Task 6 `useMyLocation`은 "옵션·no-op+안내"로 범위 명확. 그 외 완전.

**3. Type consistency:** `PropType`/`TxnType`(Task1) → 2·3 사용 일치. `LocalMarketResult`/`MarketPulse`/`CityMarketRow`/`SavedRegion` 정의처와 소비처 일치. `getMarket`(Task3) → 라우트·프론트 일치. `MIN_SAMPLE=20`·`MIN_AREA_BAND=5` 일관.
