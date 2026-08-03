# 메인 "오늘의 부동산 시장" — 단지 단위 핫스팟 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 "오늘의 부동산 시장" 섹션을 시·군·구 단위 매트릭스에서 **단지 단위 3카드(신고가 갱신 / 거래 활발 / 평당가 TOP)**로 전면 교체, 매매 전용·자산 토글 유지, 도착지를 단지 상세 페이지로 직결.

**Architecture:** 백엔드 `realEstateHotspotService.ts` 폐기 → `realEstateComplexHotspotService.ts` 신규 (3카드 × 3자산 SQL). API `/api/meta/hotspots` → `/api/meta/complex-hotspots`로 교체. SSR seed는 `getHomeDashboard()`에서 신규 서비스로 swap. 프론트 `HomeHotspotSignals.vue` + 관련 컴포넌트/composable/테스트 갈아엎음. 거래 토글(`TxnTypeMiniTabs.vue`) 제거.

**Tech Stack:** Express 5 + Prisma raw SQL + Vitest (backend), Nuxt 3 + Vue 3 + Vitest + Playwright (frontend). MySQL 8 raw query.

**Spec:** `docs/superpowers/specs/2026-05-21-home-complex-hotspot-redesign-design.md`

---

## File Structure

### Backend
- **Create**: `backend/src/services/realEstateComplexHotspotService.ts` — 3카드 산출 + 캐시
- **Create**: `backend/__tests__/services/realEstateComplexHotspotService.test.ts`
- **Modify**: `backend/src/types/homeDashboard.ts` — `ComplexHotspots` 타입군 추가, 기존 `HotspotRegion`/`HotspotBundle`/`WolseHotspotBundle`/`PropertyHotspots`/`RealEstateHotspots` 제거, `HomeDashboard.realEstateHotspots?` 타입 교체
- **Modify**: `backend/src/routes/meta.ts` — `/hotspots` 라우트 제거, `/complex-hotspots` 라우트 추가
- **Modify**: `backend/src/services/metaService.ts:685-715` — `getPropertyHotspots('apt')` → `getComplexHotspots('apt')` swap
- **Delete**: `backend/src/services/realEstateHotspotService.ts`
- **Delete**: `backend/__tests__/services/realEstateHotspotService.test.ts`

### Frontend
- **Create**: `frontend/components/home/hotspot/HotspotComplexCard.vue` — 카드 1종 (신고가/거래활발/평당가 TOP 공용)
- **Create**: `frontend/components/home/hotspot/HotspotComplexRow.vue` — 행 1종 (메트릭 2개 슬롯)
- **Create**: `frontend/composables/useComplexHotspots.ts` — `/api/meta/complex-hotspots` 호출 + 자산 캐시
- **Create**: `frontend/tests/components/home/hotspot/HotspotComplexCard.test.ts`
- **Create**: `frontend/tests/components/home/hotspot/HotspotComplexRow.test.ts`
- **Create**: `frontend/tests/composables/useComplexHotspots.test.ts`
- **Modify**: `frontend/components/home/HomeHotspotSignals.vue` — 거래 토글 제거, 3카드 신구조로 재작성
- **Modify**: `frontend/composables/useHomeDashboard.ts` — 타입 교체 (`RealEstateHotspots` → `ComplexHotspots`, `realEstateHotspots?: { apt?: ComplexHotspots }` 형태)
- **Modify**: `frontend/tests/components/home/HomeHotspotSignals.test.ts` — 신구조 테스트로 재작성
- **Modify**: `frontend/tests/e2e/home-hotspot.spec.ts` — 신구조에 맞춤
- **Modify**: `frontend/tests/pages/index.test.ts` — mock 데이터를 새 구조로
- **Delete**: `frontend/composables/useRealEstateHotspots.ts`
- **Delete**: `frontend/components/home/hotspot/HotspotCard.vue`
- **Delete**: `frontend/components/home/hotspot/HotspotRow.vue`
- **Delete**: `frontend/components/home/hotspot/TxnTypeMiniTabs.vue`
- **Delete**: `frontend/tests/composables/useRealEstateHotspots.test.ts`
- **Delete**: `frontend/tests/components/home/hotspot/HotspotCard.test.ts`
- **Delete**: `frontend/tests/components/home/hotspot/HotspotRow.test.ts`
- **Delete**: `frontend/tests/components/home/hotspot/TxnTypeMiniTabs.test.ts`

---

## Pre-flight

- [ ] **PRE-1: Node 20 보장**

Run: `nvm use 20 && node -v`
Expected: `v20.x.x`

(메모리 노트: Node 25는 lock 충돌 유발. Node 20 고정.)

- [ ] **PRE-2: 새 브랜치 분기**

Run: `git checkout -b feat/home-complex-hotspot`

---

## Backend

### Task 1: 백엔드 타입 정의

**Files:**
- Modify: `backend/src/types/homeDashboard.ts`

- [ ] **Step 1: 기존 핫스팟 타입 5종 제거 + 새 타입 추가**

`backend/src/types/homeDashboard.ts`에서 `HotspotRegion`, `HotspotBundle`, `WolseHotspotBundle`, `PropertyHotspots`, `RealEstateHotspots` 블록을 다음으로 교체:

```typescript
/** 한 단지 식별 + URL 생성용 공통 필드 */
export interface ComplexRef {
  buildingName: string;
  citySlug: string;        // 'seoul'
  city: string;            // '서울특별시'
  district: string;        // '강남구'
  districtSlug: string;    // 'gangnam-gu' or 'gangnam'
}

/** 카드 1: 신고가 갱신 (직전 12개월 최고 평당가 갱신) */
export interface NewHighRow extends ComplexRef {
  dealDate: string;        // ISO yyyy-mm-dd
  newPyeong: number;       // 만원/평
  prevMaxPyeong: number;   // 만원/평
  changePct: number;       // % (e.g., 12.5 = +12.5%)
}

/** 카드 2: 거래 활발 (30일 내 단지 거래 ≥ 2건 TOP) */
export interface ActiveRow extends ComplexRef {
  txnCount: number;        // 30일 거래수
  latestDealDate: string;  // ISO yyyy-mm-dd
  avgPyeongPrice: number;  // 만원/평
}

/** 카드 3: 평당가 TOP (30일 평균 평당가 상위, 시별 캡 2) */
export interface TopPyeongRow extends ComplexRef {
  avgPyeongPrice: number;  // 만원/평
  txnCount: number;        // 30일 거래수
}

/** 자산 1개분 3카드 묶음 */
export interface ComplexHotspots {
  newHigh: NewHighRow[];   // 0~5
  active: ActiveRow[];     // 0~5
  topPyeong: TopPyeongRow[]; // 0~5
}

/** SSR seed: apt만 채워짐 (오피스텔/빌라는 클라이언트 토글 시 lazy) */
export type ComplexHotspotsByProperty = Partial<Record<import('../schemas/realEstate.js').RealEstatePropertyType, ComplexHotspots>>;
```

기존 `HotspotRegion`, `HotspotBundle`, `WolseHotspotBundle`, `PropertyHotspots`, `RealEstateHotspots` 5개 export 블록을 삭제.

- [ ] **Step 2: `HomeDashboardResponse.realEstateHotspots` 타입 교체**

같은 파일 상단의 `HomeDashboardResponse` 타입에서:
```typescript
realEstateHotspots?: RealEstateHotspots;  // apt만 채워짐
```
를
```typescript
realEstateHotspots?: ComplexHotspotsByProperty;  // apt만 채워짐
```
로 교체.

- [ ] **Step 3: 컴파일 확인**

Run: `cd backend && nvm use 20 && npx tsc --noEmit 2>&1 | head -50`
Expected: 다른 곳에서 `HotspotRegion`/`HotspotBundle`/`PropertyHotspots`/`RealEstateHotspots`를 import하는 에러가 나옴 (이는 Task 2~5에서 모두 해소). 다른 종류의 에러가 없어야 함.

- [ ] **Step 4: Commit**

```bash
git add backend/src/types/homeDashboard.ts
git commit -m "refactor(backend): replace region hotspot types with complex hotspot types"
```

---

### Task 2: 백엔드 서비스 — 카드 1 (신고가 갱신) TDD

**Files:**
- Create: `backend/src/services/realEstateComplexHotspotService.ts`
- Create: `backend/__tests__/services/realEstateComplexHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`backend/__tests__/services/realEstateComplexHotspotService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({ mockQueryRaw: vi.fn() }));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getNewHigh } from '../../src/services/realEstateComplexHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getNewHigh — 신고가 갱신 카드', () => {
  it('changePct DESC 정렬, 최대 5건', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      buildingName: `단지${i}`,
      bjdCode: `1100000${i}`,
      city: '서울특별시',
      district: '강남구',
      districtSlug: 'gangnam-gu',
      dealDate: '2026-05-20',
      newPyeong: 7000 + i,
      prevMaxPyeong: 6000,
      changePct: 10 + i,
    }));
    mockQueryRaw.mockResolvedValueOnce(rows);

    const result = await getNewHigh('AptSaleTransaction');

    expect(result).toHaveLength(5);
    expect(result.map((r) => r.changePct)).toEqual([17, 16, 15, 14, 13]);
  });

  it('citySlug는 cityMapping에서 정식명 변환', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: '래미안', bjdCode: '1168000000', city: '서울특별시', district: '강남구',
        districtSlug: 'gangnam-gu', dealDate: '2026-05-20',
        newPyeong: 8000, prevMaxPyeong: 7000, changePct: 14.28 },
    ]);
    const result = await getNewHigh('AptSaleTransaction');
    expect(result[0].citySlug).toBe('seoul');
  });

  it('Decimal/BigInt 응답을 number로 정규화', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: '래미안', bjdCode: '1168000000', city: '서울특별시', district: '강남구',
        districtSlug: 'gangnam-gu', dealDate: '2026-05-20',
        newPyeong: '8000.5', prevMaxPyeong: '7000', changePct: '14.28' },
    ]);
    const result = await getNewHigh('AptSaleTransaction');
    expect(typeof result[0].newPyeong).toBe('number');
    expect(result[0].newPyeong).toBe(8000.5);
    expect(typeof result[0].changePct).toBe('number');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -20`
Expected: 모듈 못 찾음 FAIL.

- [ ] **Step 3: 최소 구현 — 서비스 + getNewHigh**

`backend/src/services/realEstateComplexHotspotService.ts`:

```typescript
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { FULL_TO_SLUG, SHORT_TO_SLUG } from './cityMapping.js';
import type {
  ComplexRef, NewHighRow, ActiveRow, TopPyeongRow, ComplexHotspots,
} from '../types/homeDashboard.js';
import type { RealEstatePropertyType } from '../schemas/realEstate.js';

const MAX_PER_CARD = 5;
const NEW_HIGH_PRIOR_MIN_TXN = 3;       // 직전 12개월 ≥ 3건
const ACTIVE_MIN_TXN = 2;                // 30일 ≥ 2건
const TOP_PYEONG_MIN_TXN = 2;            // 30일 ≥ 2건
const CITY_CAP = 2;                      // active/topPyeong 시별 캡

type SaleTable = 'AptSaleTransaction' | 'VillaSaleTransaction' | 'OffitelSaleTransaction';

function cityToSlug(city: string): string {
  return FULL_TO_SLUG[city] ?? SHORT_TO_SLUG[city] ?? '';
}

function toNumber(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  return typeof v === 'number' ? v : Number(v);
}

type RawNewHighRow = {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  districtSlug: string;
  dealDate: string | Date;
  newPyeong: number | string;
  prevMaxPyeong: number | string;
  changePct: number | string;
};

function toIsoDate(v: string | Date): string {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

/** 카드 1: 신고가 갱신 */
export async function getNewHigh(table: SaleTable): Promise<NewHighRow[]> {
  const tbl = Prisma.raw(table);
  const rows = await prisma.$queryRaw<RawNewHighRow[]>`
    WITH anchor AS (
      SELECT MAX(STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')) AS latest
      FROM ${tbl} t
    ),
    recent AS (
      SELECT t.buildingName, t.bjdCode, t.city, t.district,
             STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d') AS dealDate,
             t.dealAmount / (t.exclusiveArea / 3.3058) AS pyeongPrice
      FROM ${tbl} t, anchor a
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 7 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <= a.latest
    ),
    recent_top AS (
      SELECT buildingName, bjdCode, city, district,
             MAX(dealDate) AS dealDate,
             MAX(pyeongPrice) AS newPyeong
      FROM recent
      GROUP BY buildingName, bjdCode, city, district
    ),
    prior AS (
      SELECT t.buildingName, t.bjdCode,
             MAX(t.dealAmount / (t.exclusiveArea / 3.3058)) AS prevMaxPyeong,
             COUNT(*) AS prevCount
      FROM ${tbl} t, anchor a
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 365 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(a.latest, INTERVAL 7 DAY)
      GROUP BY t.buildingName, t.bjdCode
      HAVING COUNT(*) >= ${NEW_HIGH_PRIOR_MIN_TXN}
    )
    SELECT r.buildingName, r.bjdCode, r.city, r.district,
           reg.slug AS districtSlug,
           r.dealDate AS dealDate,
           r.newPyeong AS newPyeong,
           p.prevMaxPyeong AS prevMaxPyeong,
           (r.newPyeong / p.prevMaxPyeong - 1) * 100 AS changePct
    FROM recent_top r
    INNER JOIN prior p ON p.buildingName = r.buildingName AND p.bjdCode = r.bjdCode
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
    WHERE r.newPyeong > p.prevMaxPyeong
    ORDER BY changePct DESC
    LIMIT ${MAX_PER_CARD}
  `;

  return rows.map((r) => ({
    buildingName: r.buildingName,
    citySlug: cityToSlug(r.city),
    city: r.city,
    district: r.district,
    districtSlug: r.districtSlug,
    dealDate: toIsoDate(r.dealDate),
    newPyeong: toNumber(r.newPyeong),
    prevMaxPyeong: toNumber(r.prevMaxPyeong),
    changePct: toNumber(r.changePct),
  }));
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -20`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/realEstateComplexHotspotService.ts \
        backend/__tests__/services/realEstateComplexHotspotService.test.ts
git commit -m "feat(backend): add getNewHigh for complex-level hotspot card 1"
```

---

### Task 3: 백엔드 서비스 — 카드 2 (거래 활발) TDD

**Files:**
- Modify: `backend/src/services/realEstateComplexHotspotService.ts`
- Modify: `backend/__tests__/services/realEstateComplexHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

테스트 파일 하단에 추가:

```typescript
import { getActive } from '../../src/services/realEstateComplexHotspotService.js';

describe('getActive — 거래 활발 카드', () => {
  it('txnCount DESC, 동률은 latestDealDate DESC', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: 'A', bjdCode: '1', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
        txnCount: 10n, latestDealDate: '2026-05-10', avgPyeongPrice: 8000 },
      { buildingName: 'B', bjdCode: '2', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
        txnCount: 10n, latestDealDate: '2026-05-15', avgPyeongPrice: 9000 },
      { buildingName: 'C', bjdCode: '3', city: '부산광역시', district: '해운대구', districtSlug: 'haeundae-gu',
        txnCount: 15n, latestDealDate: '2026-05-08', avgPyeongPrice: 4000 },
    ]);

    const result = await getActive('AptSaleTransaction');

    expect(result.map((r) => r.buildingName)).toEqual(['C', 'B', 'A']);
  });

  it('시별 최대 2단지 캡', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: 'A', bjdCode: '1', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
        txnCount: 10n, latestDealDate: '2026-05-15', avgPyeongPrice: 8000 },
      { buildingName: 'B', bjdCode: '2', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
        txnCount: 9n, latestDealDate: '2026-05-14', avgPyeongPrice: 9000 },
      { buildingName: 'C', bjdCode: '3', city: '서울특별시', district: '송파구', districtSlug: 'songpa-gu',
        txnCount: 8n, latestDealDate: '2026-05-13', avgPyeongPrice: 7000 },
      { buildingName: 'D', bjdCode: '4', city: '부산광역시', district: '해운대구', districtSlug: 'haeundae-gu',
        txnCount: 7n, latestDealDate: '2026-05-12', avgPyeongPrice: 4000 },
    ]);

    const result = await getActive('AptSaleTransaction');

    const seoulCount = result.filter((r) => r.city === '서울특별시').length;
    expect(seoulCount).toBe(2);
    expect(result.map((r) => r.buildingName)).toEqual(['A', 'B', 'D']);
  });

  it('최대 5건', async () => {
    const rows = Array.from({ length: 20 }, (_, i) => ({
      buildingName: `건물${i}`, bjdCode: String(i),
      city: `시${i}`, district: `구${i}`, districtSlug: `dist-${i}`,
      txnCount: BigInt(20 - i), latestDealDate: '2026-05-20', avgPyeongPrice: 5000,
    }));
    mockQueryRaw.mockResolvedValueOnce(rows);
    const result = await getActive('AptSaleTransaction');
    expect(result).toHaveLength(5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -20`
Expected: `getActive` import 에러로 FAIL.

- [ ] **Step 3: getActive 구현 추가**

`backend/src/services/realEstateComplexHotspotService.ts` 하단에 추가:

```typescript
type RawActiveRow = {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  districtSlug: string;
  txnCount: bigint | number | string;
  latestDealDate: string | Date;
  avgPyeongPrice: number | string;
};

function applyCityCap<T extends { city: string }>(rows: T[], cap: number, limit: number): T[] {
  const counts = new Map<string, number>();
  const out: T[] = [];
  for (const r of rows) {
    const c = counts.get(r.city) ?? 0;
    if (c >= cap) continue;
    counts.set(r.city, c + 1);
    out.push(r);
    if (out.length >= limit) break;
  }
  return out;
}

/** 카드 2: 거래 활발 단지 */
export async function getActive(table: SaleTable): Promise<ActiveRow[]> {
  const tbl = Prisma.raw(table);
  const rows = await prisma.$queryRaw<RawActiveRow[]>`
    WITH anchor AS (
      SELECT MAX(STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')) AS latest
      FROM ${tbl} t
    ),
    g AS (
      SELECT t.buildingName, t.bjdCode, t.city, t.district,
             COUNT(*) AS txnCount,
             MAX(STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')) AS latestDealDate,
             AVG(t.dealAmount / (t.exclusiveArea / 3.3058)) AS avgPyeongPrice
      FROM ${tbl} t, anchor a
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 30 DAY)
      GROUP BY t.buildingName, t.bjdCode, t.city, t.district
      HAVING COUNT(*) >= ${ACTIVE_MIN_TXN}
    )
    SELECT g.buildingName, g.bjdCode, g.city, g.district,
           reg.slug AS districtSlug,
           g.txnCount AS txnCount,
           g.latestDealDate AS latestDealDate,
           g.avgPyeongPrice AS avgPyeongPrice
    FROM g
    INNER JOIN Region reg ON reg.city = g.city AND reg.district = g.district
    ORDER BY g.txnCount DESC, g.latestDealDate DESC
    LIMIT 30
  `;

  const normalized: ActiveRow[] = rows.map((r) => ({
    buildingName: r.buildingName,
    citySlug: cityToSlug(r.city),
    city: r.city,
    district: r.district,
    districtSlug: r.districtSlug,
    txnCount: Number(r.txnCount),
    latestDealDate: toIsoDate(r.latestDealDate),
    avgPyeongPrice: toNumber(r.avgPyeongPrice),
  }));

  return applyCityCap(normalized, CITY_CAP, MAX_PER_CARD);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -20`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/realEstateComplexHotspotService.ts \
        backend/__tests__/services/realEstateComplexHotspotService.test.ts
git commit -m "feat(backend): add getActive for complex-level hotspot card 2"
```

---

### Task 4: 백엔드 서비스 — 카드 3 (평당가 TOP) TDD

**Files:**
- Modify: `backend/src/services/realEstateComplexHotspotService.ts`
- Modify: `backend/__tests__/services/realEstateComplexHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

테스트 파일 하단에 추가:

```typescript
import { getTopPyeong } from '../../src/services/realEstateComplexHotspotService.js';

describe('getTopPyeong — 평당가 TOP 카드', () => {
  it('avgPyeongPrice DESC, 시별 캡 2', async () => {
    mockQueryRaw.mockResolvedValueOnce([
      { buildingName: 'A', bjdCode: '1', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
        avgPyeongPrice: 12000, txnCount: 5n },
      { buildingName: 'B', bjdCode: '2', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
        avgPyeongPrice: 11000, txnCount: 4n },
      { buildingName: 'C', bjdCode: '3', city: '서울특별시', district: '용산구', districtSlug: 'yongsan-gu',
        avgPyeongPrice: 10500, txnCount: 3n },
      { buildingName: 'D', bjdCode: '4', city: '경기도', district: '성남시 분당구', districtSlug: 'seongnam-bundang',
        avgPyeongPrice: 9000, txnCount: 6n },
      { buildingName: 'E', bjdCode: '5', city: '부산광역시', district: '해운대구', districtSlug: 'haeundae-gu',
        avgPyeongPrice: 8500, txnCount: 7n },
    ]);

    const result = await getTopPyeong('AptSaleTransaction');

    expect(result.map((r) => r.buildingName)).toEqual(['A', 'B', 'D', 'E']);
  });

  it('최대 5건', async () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      buildingName: `B${i}`, bjdCode: String(i),
      city: `시${i % 10}`, district: `구${i}`, districtSlug: `d-${i}`,
      avgPyeongPrice: 12000 - i, txnCount: 5n,
    }));
    mockQueryRaw.mockResolvedValueOnce(rows);
    const result = await getTopPyeong('AptSaleTransaction');
    expect(result.length).toBeLessThanOrEqual(5);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -10`
Expected: import 에러 FAIL.

- [ ] **Step 3: getTopPyeong 구현 추가**

`backend/src/services/realEstateComplexHotspotService.ts` 하단에 추가:

```typescript
type RawTopPyeongRow = {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  districtSlug: string;
  avgPyeongPrice: number | string;
  txnCount: bigint | number | string;
};

/** 카드 3: 평당가 TOP */
export async function getTopPyeong(table: SaleTable): Promise<TopPyeongRow[]> {
  const tbl = Prisma.raw(table);
  const rows = await prisma.$queryRaw<RawTopPyeongRow[]>`
    WITH anchor AS (
      SELECT MAX(STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')) AS latest
      FROM ${tbl} t
    ),
    g AS (
      SELECT t.buildingName, t.bjdCode, t.city, t.district,
             AVG(t.dealAmount / (t.exclusiveArea / 3.3058)) AS avgPyeongPrice,
             COUNT(*) AS txnCount
      FROM ${tbl} t, anchor a
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(a.latest, INTERVAL 30 DAY)
      GROUP BY t.buildingName, t.bjdCode, t.city, t.district
      HAVING COUNT(*) >= ${TOP_PYEONG_MIN_TXN}
    )
    SELECT g.buildingName, g.bjdCode, g.city, g.district,
           reg.slug AS districtSlug,
           g.avgPyeongPrice AS avgPyeongPrice,
           g.txnCount AS txnCount
    FROM g
    INNER JOIN Region reg ON reg.city = g.city AND reg.district = g.district
    ORDER BY g.avgPyeongPrice DESC
    LIMIT 30
  `;

  const normalized: TopPyeongRow[] = rows.map((r) => ({
    buildingName: r.buildingName,
    citySlug: cityToSlug(r.city),
    city: r.city,
    district: r.district,
    districtSlug: r.districtSlug,
    avgPyeongPrice: toNumber(r.avgPyeongPrice),
    txnCount: Number(r.txnCount),
  }));

  return applyCityCap(normalized, CITY_CAP, MAX_PER_CARD);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -10`
Expected: PASS (8 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/realEstateComplexHotspotService.ts \
        backend/__tests__/services/realEstateComplexHotspotService.test.ts
git commit -m "feat(backend): add getTopPyeong for complex-level hotspot card 3"
```

---

### Task 5: 백엔드 서비스 — `getComplexHotspots` 조립 + 캐시 TDD

**Files:**
- Modify: `backend/src/services/realEstateComplexHotspotService.ts`
- Modify: `backend/__tests__/services/realEstateComplexHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

테스트 파일 하단에 추가:

```typescript
import { getComplexHotspots, _complexHotspotCache } from '../../src/services/realEstateComplexHotspotService.js';

describe('getComplexHotspots — 자산별 3카드 조립', () => {
  beforeEach(() => {
    _complexHotspotCache.clear();
  });

  it('apt 호출 시 AptSaleTransaction 테이블에 대해 3개 쿼리 실행 후 합쳐 반환', async () => {
    // 3개 카드 = 3번 queryRaw 호출
    mockQueryRaw
      .mockResolvedValueOnce([])   // newHigh
      .mockResolvedValueOnce([])   // active
      .mockResolvedValueOnce([]);  // topPyeong

    const result = await getComplexHotspots('apt');

    expect(result).toEqual({ newHigh: [], active: [], topPyeong: [] });
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('자산별 캐시: 같은 propertyType 재호출 시 쿼리 실행 안 됨', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await getComplexHotspots('offitel');
    await getComplexHotspots('offitel');

    expect(mockQueryRaw).toHaveBeenCalledTimes(3);  // 두번째 호출은 캐시 히트
  });

  it('자산별 캐시는 독립: villa 호출은 apt 캐시와 무관', async () => {
    mockQueryRaw
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([])  // apt
      .mockResolvedValueOnce([]).mockResolvedValueOnce([]).mockResolvedValueOnce([]); // villa

    await getComplexHotspots('apt');
    await getComplexHotspots('villa');

    expect(mockQueryRaw).toHaveBeenCalledTimes(6);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -10`
Expected: import 에러 FAIL.

- [ ] **Step 3: `getComplexHotspots` + 캐시 구현**

`backend/src/services/realEstateComplexHotspotService.ts` 하단에 추가:

```typescript
const SALE_TABLES: Record<RealEstatePropertyType, SaleTable> = {
  apt: 'AptSaleTransaction',
  villa: 'VillaSaleTransaction',
  offitel: 'OffitelSaleTransaction',
};

const CACHE_TTL_MS = 60 * 60 * 1000;

export const _complexHotspotCache = new Map<RealEstatePropertyType, { data: ComplexHotspots; expiry: number }>();

export async function getComplexHotspots(propertyType: RealEstatePropertyType): Promise<ComplexHotspots> {
  const cached = _complexHotspotCache.get(propertyType);
  if (cached && Date.now() < cached.expiry) return cached.data;

  const table = SALE_TABLES[propertyType];
  const [newHigh, active, topPyeong] = await Promise.all([
    getNewHigh(table),
    getActive(table),
    getTopPyeong(table),
  ]);

  const data: ComplexHotspots = { newHigh, active, topPyeong };
  _complexHotspotCache.set(propertyType, { data, expiry: Date.now() + CACHE_TTL_MS });
  return data;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateComplexHotspotService.test.ts 2>&1 | tail -10`
Expected: PASS (11 tests total).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/realEstateComplexHotspotService.ts \
        backend/__tests__/services/realEstateComplexHotspotService.test.ts
git commit -m "feat(backend): add getComplexHotspots assembler with per-asset cache"
```

---

### Task 6: 백엔드 라우트 교체 — `/api/meta/complex-hotspots`

**Files:**
- Modify: `backend/src/routes/meta.ts`

- [ ] **Step 1: 신규 라우트 추가 + 기존 라우트 제거**

`backend/src/routes/meta.ts:13` 변경:
```typescript
import { getPropertyHotspots } from '../services/realEstateHotspotService.js';
```
를
```typescript
import { getComplexHotspots } from '../services/realEstateComplexHotspotService.js';
```
로 교체.

같은 파일 `meta.ts:15-17` 변경:
```typescript
const HotspotQuerySchema = z.object({
  propertyType: RealEstatePropertyTypeSchema,
});
```
를 (이름 유지, 재사용):
```typescript
const ComplexHotspotQuerySchema = z.object({
  propertyType: RealEstatePropertyTypeSchema,
});
```
로 교체.

`meta.ts:61-67`의 `/hotspots` 라우트 블록 전체를 다음으로 교체:

```typescript
// GET /api/meta/complex-hotspots?propertyType=apt|villa|offitel
router.get('/complex-hotspots', validate(ComplexHotspotQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { propertyType } = req.query as unknown as { propertyType: 'apt' | 'villa' | 'offitel' };
  const data = await getComplexHotspots(propertyType);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data });
}));
```

- [ ] **Step 2: 빌드 확인**

Run: `cd backend && nvm use 20 && npx tsc --noEmit 2>&1 | head -20`
Expected: `realEstateHotspotService.ts` 미참조 에러 외엔 통과. 만약 `metaService.ts`가 아직 옛 import를 쓰고 있다면 그 에러는 Task 7에서 해소.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/meta.ts
git commit -m "feat(backend): swap /api/meta/hotspots route to /complex-hotspots"
```

---

### Task 7: `metaService.getHomeDashboard` SSR seed swap

**Files:**
- Modify: `backend/src/services/metaService.ts`

- [ ] **Step 1: import 교체**

`backend/src/services/metaService.ts:3` 변경:
```typescript
import { getPropertyHotspots } from './realEstateHotspotService.js';
```
를
```typescript
import { getComplexHotspots } from './realEstateComplexHotspotService.js';
```
로 교체.

- [ ] **Step 2: `getHomeDashboard` 본문 swap**

같은 파일 `metaService.ts:690-697` Promise.all 배열 중:
```typescript
    getPropertyHotspots('apt'),
```
를
```typescript
    getComplexHotspots('apt'),
```
로 교체.

또한 `metaService.ts:710`:
```typescript
    realEstateHotspots: { apt: aptHotspots },
```
는 그대로 둠 (변수명/구조 동일).

- [ ] **Step 3: 빌드 확인**

Run: `cd backend && npx tsc --noEmit 2>&1 | head -20`
Expected: 통과 (또는 옛 파일이 아직 남아 있어 'unused' 류는 무시).

- [ ] **Step 4: 기존 home-dashboard 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts 2>&1 | tail -20`
Expected: 기존 테스트가 `getPropertyHotspots`를 mock 하고 있을 가능성 — 실패하면 다음 Step 5에서 수정.

- [ ] **Step 5: home-dashboard 테스트 import 갱신 (필요 시)**

`backend/__tests__/services/homeDashboard.test.ts`에서 `getPropertyHotspots` mock을 `getComplexHotspots` mock으로 교체. mock이 반환하는 데이터 구조도 `ComplexHotspots` (`{ newHigh, active, topPyeong }`)로 변경. 정확한 라인은 파일 내용에 따라.

Run: `cd backend && npx vitest run __tests__/services/homeDashboard.test.ts 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/services/metaService.ts backend/__tests__/services/homeDashboard.test.ts
git commit -m "feat(backend): use complex hotspots in home-dashboard SSR seed"
```

---

### Task 8: 옛 서비스/테스트 삭제

**Files:**
- Delete: `backend/src/services/realEstateHotspotService.ts`
- Delete: `backend/__tests__/services/realEstateHotspotService.test.ts`

- [ ] **Step 1: 파일 삭제**

Run:
```bash
rm backend/src/services/realEstateHotspotService.ts
rm backend/__tests__/services/realEstateHotspotService.test.ts
```

- [ ] **Step 2: 백엔드 전체 타입 + 테스트 검증**

Run: `cd backend && nvm use 20 && npx tsc --noEmit 2>&1 | head -20`
Expected: 통과.

Run: `cd backend && npx vitest run 2>&1 | tail -20`
Expected: 모든 테스트 PASS.

- [ ] **Step 3: Commit**

```bash
git add -A backend/src/services/realEstateHotspotService.ts \
           backend/__tests__/services/realEstateHotspotService.test.ts
git commit -m "chore(backend): remove legacy region hotspot service"
```

---

## Frontend

### Task 9: 프론트엔드 타입 교체

**Files:**
- Modify: `frontend/composables/useHomeDashboard.ts`

- [ ] **Step 1: 타입 블록 교체**

`frontend/composables/useHomeDashboard.ts:30~60`(대략)의 `HotspotRegion`, `HotspotBundle`, `WolseHotspotBundle`, `PropertyHotspots`, `RealEstateHotspots` 5개 export를 다음으로 교체:

```typescript
export interface ComplexRef {
  buildingName: string;
  citySlug: string;
  city: string;
  district: string;
  districtSlug: string;
}

export interface NewHighRow extends ComplexRef {
  dealDate: string;
  newPyeong: number;
  prevMaxPyeong: number;
  changePct: number;
}

export interface ActiveRow extends ComplexRef {
  txnCount: number;
  latestDealDate: string;
  avgPyeongPrice: number;
}

export interface TopPyeongRow extends ComplexRef {
  avgPyeongPrice: number;
  txnCount: number;
}

export interface ComplexHotspots {
  newHigh: NewHighRow[];
  active: ActiveRow[];
  topPyeong: TopPyeongRow[];
}

export type ComplexHotspotsByProperty = Partial<Record<RealEstatePropertyType, ComplexHotspots>>;
```

같은 파일의 `HomeDashboard.realEstateHotspots?` 타입을 `ComplexHotspotsByProperty`로 변경:
```typescript
  realEstateHotspots?: ComplexHotspotsByProperty;
```

- [ ] **Step 2: 빌드 확인**

Run: `cd frontend && nvm use 20 && npx vue-tsc --noEmit 2>&1 | tail -30`
Expected: 옛 타입을 import하는 곳들에서 에러 (다음 태스크들에서 해소).

- [ ] **Step 3: Commit**

```bash
git add frontend/composables/useHomeDashboard.ts
git commit -m "refactor(frontend): replace hotspot types with complex hotspot types"
```

---

### Task 10: 프론트엔드 composable — `useComplexHotspots`

**Files:**
- Create: `frontend/composables/useComplexHotspots.ts`
- Create: `frontend/tests/composables/useComplexHotspots.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`frontend/tests/composables/useComplexHotspots.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useComplexHotspots } from '~/composables/useComplexHotspots';
import type { ComplexHotspots, ComplexHotspotsByProperty } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));
});

const sample: ComplexHotspots = { newHigh: [], active: [], topPyeong: [] };

describe('useComplexHotspots', () => {
  it('이미 캐시된 propertyType은 fetch 안 함', async () => {
    const initial: ComplexHotspotsByProperty = { apt: sample };
    const { loadProperty } = useComplexHotspots(initial);
    await loadProperty('apt');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('미캐시 propertyType은 /api/meta/complex-hotspots 호출', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: sample });
    const { loadProperty, data } = useComplexHotspots({});
    await loadProperty('offitel');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/meta/complex-hotspots',
      { query: { propertyType: 'offitel' } },
    );
    expect(data.value.offitel).toEqual(sample);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useComplexHotspots.test.ts 2>&1 | tail -10`
Expected: 모듈 못 찾음 FAIL.

- [ ] **Step 3: composable 구현**

`frontend/composables/useComplexHotspots.ts`:

```typescript
import { ref } from 'vue';
import type { ComplexHotspots, ComplexHotspotsByProperty } from './useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

type ApiEnvelope = { success: boolean; data: ComplexHotspots };

export function useComplexHotspots(initial: ComplexHotspotsByProperty) {
  const data = ref<ComplexHotspotsByProperty>({ ...initial });

  async function loadProperty(propertyType: RealEstatePropertyType): Promise<void> {
    if (data.value[propertyType]) return;
    const config = useRuntimeConfig();
    const res = await $fetch<ApiEnvelope>(
      `${config.public.apiBase}/api/meta/complex-hotspots`,
      { query: { propertyType } },
    );
    if (res.success) {
      data.value = { ...data.value, [propertyType]: res.data };
    }
  }

  return { data, loadProperty };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useComplexHotspots.test.ts 2>&1 | tail -10`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/composables/useComplexHotspots.ts \
        frontend/tests/composables/useComplexHotspots.test.ts
git commit -m "feat(frontend): add useComplexHotspots composable"
```

---

### Task 11: 행 컴포넌트 — `HotspotComplexRow.vue`

**Files:**
- Create: `frontend/components/home/hotspot/HotspotComplexRow.vue`
- Create: `frontend/tests/components/home/hotspot/HotspotComplexRow.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`frontend/tests/components/home/hotspot/HotspotComplexRow.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotComplexRow from '~/components/home/hotspot/HotspotComplexRow.vue';

const baseRow = {
  buildingName: '래미안대치팰리스',
  citySlug: 'seoul',
  city: '서울특별시',
  district: '강남구',
  districtSlug: 'gangnam-gu',
};

describe('HotspotComplexRow', () => {
  it('단지명을 렌더링', () => {
    const wrapper = mount(HotspotComplexRow, {
      props: {
        row: baseRow,
        propertyType: 'apt' as const,
        metric1Label: '평당가',
        metric1Value: '8,000만원',
        metric2Label: '+12.5%',
        metric2Class: 'text-red-500',
      },
    });
    expect(wrapper.text()).toContain('래미안대치팰리스');
  });

  it('href에 단지 상세 경로 (URL 인코딩)', () => {
    const wrapper = mount(HotspotComplexRow, {
      props: {
        row: { ...baseRow, buildingName: '래미안 대치 팰리스' },
        propertyType: 'apt' as const,
        metric1Label: '평당가',
        metric1Value: '8,000만원',
        metric2Label: '+12.5%',
      },
    });
    const link = wrapper.find('a');
    expect(link.attributes('href')).toBe(
      '/real-estate/apt/seoul/gangnam-gu/' + encodeURIComponent('래미안 대치 팰리스'),
    );
  });

  it('지역 라벨은 "강남구" 형태로 표시', () => {
    const wrapper = mount(HotspotComplexRow, {
      props: {
        row: baseRow,
        propertyType: 'apt' as const,
        metric1Label: '평당가',
        metric1Value: '8,000만원',
        metric2Label: '+12.5%',
      },
    });
    expect(wrapper.text()).toContain('강남구');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/home/hotspot/HotspotComplexRow.test.ts 2>&1 | tail -10`
Expected: 모듈 못 찾음 FAIL.

- [ ] **Step 3: 컴포넌트 구현**

`frontend/components/home/hotspot/HotspotComplexRow.vue`:

```vue
<template>
  <NuxtLink :to="href" class="flex items-center justify-between gap-3 py-2 px-3 hover:bg-slate-50 rounded-lg transition">
    <div class="min-w-0">
      <div class="text-sm font-bold text-slate-900 truncate">{{ row.buildingName }}</div>
      <div class="text-[11px] text-slate-500 truncate">{{ row.district }}</div>
    </div>
    <div class="text-right whitespace-nowrap">
      <div class="text-sm font-bold text-slate-900">{{ metric1Value }}</div>
      <div :class="['text-[11px] font-bold', metric2Class ?? 'text-slate-500']">{{ metric2Label }}</div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ComplexRef } from '~/composables/useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

const props = defineProps<{
  row: ComplexRef;
  propertyType: RealEstatePropertyType;
  metric1Label: string;   // (reserved — 추후 a11y용)
  metric1Value: string;
  metric2Label: string;
  metric2Class?: string;
}>();

const href = computed(() => {
  return `/real-estate/${props.propertyType}/${props.row.citySlug}/${props.row.districtSlug}/${encodeURIComponent(props.row.buildingName)}`;
});
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/home/hotspot/HotspotComplexRow.test.ts 2>&1 | tail -10`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/home/hotspot/HotspotComplexRow.vue \
        frontend/tests/components/home/hotspot/HotspotComplexRow.test.ts
git commit -m "feat(frontend): add HotspotComplexRow component"
```

---

### Task 12: 카드 컴포넌트 — `HotspotComplexCard.vue`

**Files:**
- Create: `frontend/components/home/hotspot/HotspotComplexCard.vue`
- Create: `frontend/tests/components/home/hotspot/HotspotComplexCard.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

`frontend/tests/components/home/hotspot/HotspotComplexCard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotComplexCard from '~/components/home/hotspot/HotspotComplexCard.vue';
import type { NewHighRow, ActiveRow, TopPyeongRow } from '~/composables/useHomeDashboard';

const newHigh: NewHighRow = {
  buildingName: 'A', citySlug: 'seoul', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
  dealDate: '2026-05-18', newPyeong: 8000, prevMaxPyeong: 7000, changePct: 14.28,
};

const active: ActiveRow = {
  buildingName: 'B', citySlug: 'seoul', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
  txnCount: 12, latestDealDate: '2026-05-19', avgPyeongPrice: 9000,
};

const top: TopPyeongRow = {
  buildingName: 'C', citySlug: 'seoul', city: '서울특별시', district: '용산구', districtSlug: 'yongsan-gu',
  avgPyeongPrice: 12000, txnCount: 5,
};

describe('HotspotComplexCard', () => {
  it('rows 0개면 빈 슬롯 표시 안 함 (h-full로 자리만)', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'newHigh', rows: [], propertyType: 'apt' as const },
    });
    expect(wrapper.findAll('a').length).toBe(0);
  });

  it('newHigh variant — changePct를 +X% 형식으로 표시', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'newHigh', rows: [newHigh], propertyType: 'apt' as const },
    });
    expect(wrapper.text()).toContain('+14.3%');
  });

  it('active variant — txnCount를 N건 형식으로 표시', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'active', rows: [active], propertyType: 'apt' as const },
    });
    expect(wrapper.text()).toContain('12건');
  });

  it('topPyeong variant — 평당가를 만원 단위로 표시', () => {
    const wrapper = mount(HotspotComplexCard, {
      props: { variant: 'topPyeong', rows: [top], propertyType: 'apt' as const },
    });
    expect(wrapper.text()).toContain('12,000');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/home/hotspot/HotspotComplexCard.test.ts 2>&1 | tail -10`
Expected: 모듈 못 찾음 FAIL.

- [ ] **Step 3: 컴포넌트 구현**

`frontend/components/home/hotspot/HotspotComplexCard.vue`:

```vue
<template>
  <div class="bg-white p-4">
    <div class="flex items-center gap-2 mb-3">
      <span class="material-symbols-outlined text-[18px]" :class="iconColor">{{ icon }}</span>
      <h3 class="text-sm font-bold text-slate-900">{{ title }}</h3>
    </div>
    <ul class="space-y-1">
      <li v-for="(row, i) in rows" :key="row.buildingName + row.districtSlug + i">
        <HotspotComplexRow
          :row="row"
          :property-type="propertyType"
          :metric1-label="metric1Label"
          :metric1-value="formatMetric1(row)"
          :metric2-label="formatMetric2(row)"
          :metric2-class="metric2Class"
        />
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HotspotComplexRow from './HotspotComplexRow.vue';
import type { NewHighRow, ActiveRow, TopPyeongRow } from '~/composables/useHomeDashboard';
import type { RealEstatePropertyType } from '~/types/realEstate';

type Variant = 'newHigh' | 'active' | 'topPyeong';
type AnyRow = NewHighRow | ActiveRow | TopPyeongRow;

const props = defineProps<{
  variant: Variant;
  rows: AnyRow[];
  propertyType: RealEstatePropertyType;
}>();

const VARIANT_META: Record<Variant, { title: string; icon: string; iconColor: string; metric1Label: string; metric2Class?: string }> = {
  newHigh:   { title: '신고가 갱신', icon: 'trending_up',   iconColor: 'text-red-500',    metric1Label: '신고 평당가', metric2Class: 'text-red-500' },
  active:    { title: '거래 활발',   icon: 'local_fire_department', iconColor: 'text-orange-500', metric1Label: '30일 거래' },
  topPyeong: { title: '평당가 TOP',  icon: 'diamond',       iconColor: 'text-violet-500', metric1Label: '평균 평당가' },
};

const title = computed(() => VARIANT_META[props.variant].title);
const icon = computed(() => VARIANT_META[props.variant].icon);
const iconColor = computed(() => VARIANT_META[props.variant].iconColor);
const metric1Label = computed(() => VARIANT_META[props.variant].metric1Label);
const metric2Class = computed(() => VARIANT_META[props.variant].metric2Class);

function nf(n: number): string {
  return new Intl.NumberFormat('ko-KR').format(Math.round(n));
}

function formatMetric1(row: AnyRow): string {
  if (props.variant === 'newHigh') return `${nf((row as NewHighRow).newPyeong)}만원`;
  if (props.variant === 'active')  return `${(row as ActiveRow).txnCount}건`;
  return `${nf((row as TopPyeongRow).avgPyeongPrice)}만원`;
}

function formatMetric2(row: AnyRow): string {
  if (props.variant === 'newHigh') {
    const c = (row as NewHighRow).changePct;
    return `${c >= 0 ? '+' : ''}${c.toFixed(1)}%`;
  }
  if (props.variant === 'active') return `${nf((row as ActiveRow).avgPyeongPrice)}만원`;
  return `${(row as TopPyeongRow).txnCount}건`;
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/home/hotspot/HotspotComplexCard.test.ts 2>&1 | tail -10`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/home/hotspot/HotspotComplexCard.vue \
        frontend/tests/components/home/hotspot/HotspotComplexCard.test.ts
git commit -m "feat(frontend): add HotspotComplexCard with three variants"
```

---

### Task 13: `HomeHotspotSignals.vue` 재작성 + 테스트

**Files:**
- Modify: `frontend/components/home/HomeHotspotSignals.vue`
- Modify: `frontend/tests/components/home/HomeHotspotSignals.test.ts`

- [ ] **Step 1: 테스트 재작성 (실패하는 새 테스트)**

`frontend/tests/components/home/HomeHotspotSignals.test.ts`를 전부 다음으로 교체:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue';
import type { ComplexHotspots, ComplexHotspotsByProperty } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('$fetch', fetchMock);
  vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));
});

function sample(): ComplexHotspots {
  return {
    newHigh: [{
      buildingName: '래미안', citySlug: 'seoul', city: '서울특별시', district: '강남구', districtSlug: 'gangnam-gu',
      dealDate: '2026-05-18', newPyeong: 8000, prevMaxPyeong: 7000, changePct: 14.28,
    }],
    active: [{
      buildingName: '자이', citySlug: 'seoul', city: '서울특별시', district: '서초구', districtSlug: 'seocho-gu',
      txnCount: 12, latestDealDate: '2026-05-19', avgPyeongPrice: 9000,
    }],
    topPyeong: [{
      buildingName: '한남', citySlug: 'seoul', city: '서울특별시', district: '용산구', districtSlug: 'yongsan-gu',
      avgPyeongPrice: 12000, txnCount: 5,
    }],
  };
}

describe('HomeHotspotSignals (complex hotspots)', () => {
  it('seed 데이터 없으면 섹션 자체 hide', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: {} as ComplexHotspotsByProperty },
    });
    expect(wrapper.text()).not.toContain('오늘의 부동산 시장');
  });

  it('apt seed로 3카드 모두 렌더', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    expect(wrapper.text()).toContain('신고가 갱신');
    expect(wrapper.text()).toContain('거래 활발');
    expect(wrapper.text()).toContain('평당가 TOP');
    expect(wrapper.text()).toContain('래미안');
    expect(wrapper.text()).toContain('자이');
    expect(wrapper.text()).toContain('한남');
  });

  it('자산 토글 클릭 시 미캐시 propertyType에 대해 /api/meta/complex-hotspots 호출', async () => {
    fetchMock.mockResolvedValueOnce({ success: true, data: sample() });
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    const offitelBtn = wrapper.findAll('button').find((b) => b.text().includes('오피스텔'))!;
    await offitelBtn.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/meta/complex-hotspots',
      { query: { propertyType: 'offitel' } },
    );
  });

  it('자산 토글 전환 시 섹션 unmount 안 됨 (loading 중에도 헤딩 유지)', async () => {
    let resolveFetch!: (v: unknown) => void;
    fetchMock.mockReturnValueOnce(new Promise((r) => { resolveFetch = r; }));
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    const offitelBtn = wrapper.findAll('button').find((b) => b.text().includes('오피스텔'))!;
    await offitelBtn.trigger('click');
    expect(wrapper.text()).toContain('오늘의 부동산 시장');  // 헤딩 유지
    resolveFetch({ success: true, data: sample() });
  });

  it('거래 토글(매매/전세) UI 없음', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: sample() } },
    });
    expect(wrapper.text()).not.toContain('전세');
    expect(wrapper.text()).not.toContain('월세');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && npx vitest run tests/components/home/HomeHotspotSignals.test.ts 2>&1 | tail -20`
Expected: FAIL (기존 컴포넌트가 새 props/구조와 안 맞음).

- [ ] **Step 3: `HomeHotspotSignals.vue` 재작성**

`frontend/components/home/HomeHotspotSignals.vue`를 전부 다음으로 교체:

```vue
<template>
  <section
    v-if="hasSeedData"
    class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6"
  >
    <div class="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
      <div class="px-6 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
            오늘의 부동산 시장
          </h2>
          <p class="text-sm text-slate-500 mt-1">신고가 갱신 · 거래 활발 · 평당가 TOP 단지 (매매)</p>
        </div>
        <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">
          전체 보기 →
        </HardLink>
      </div>

      <div class="px-6 pb-4 flex items-center gap-3 flex-wrap">
        <div class="inline-flex bg-slate-100 rounded-full p-1 text-sm font-bold">
          <button
            v-for="opt in PROPERTY_OPTIONS"
            :key="opt.value"
            :class="[
              'px-4 py-1.5 rounded-full transition inline-flex items-center gap-1.5',
              propertyType === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ]"
            @click="onPropertyChange(opt.value)"
          >
            <span
              v-if="isLoadingProperty && propertyType === opt.value"
              class="inline-block w-3 h-3 border-2 border-slate-300 border-t-primary rounded-full animate-spin"
              aria-label="불러오는 중"
            />
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="grid gap-px bg-slate-100 border-t border-slate-100 grid-cols-1 md:grid-cols-3">
        <HotspotComplexCard variant="newHigh"   :rows="currentData.newHigh"   :property-type="propertyType" />
        <HotspotComplexCard variant="active"    :rows="currentData.active"    :property-type="propertyType" />
        <HotspotComplexCard variant="topPyeong" :rows="currentData.topPyeong" :property-type="propertyType" />
      </div>

      <div class="px-6 py-3 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
        <span class="material-symbols-outlined text-[14px] text-slate-400">info</span>
        국토교통부 실거래가 · 최근 30일 (신고가 카드는 직전 12개월 기준 갱신)
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import HotspotComplexCard from './hotspot/HotspotComplexCard.vue';
import type { ComplexHotspots, ComplexHotspotsByProperty } from '~/composables/useHomeDashboard';
import { useComplexHotspots } from '~/composables/useComplexHotspots';
import type { RealEstatePropertyType } from '~/types/realEstate';

const props = defineProps<{ hotspots: ComplexHotspotsByProperty }>();

const PROPERTY_OPTIONS: { value: RealEstatePropertyType; label: string }[] = [
  { value: 'apt', label: '아파트' },
  { value: 'offitel', label: '오피스텔' },
  { value: 'villa', label: '빌라' },
];

const propertyType = ref<RealEstatePropertyType>('apt');
const isLoadingProperty = ref(false);

const { data, loadProperty } = useComplexHotspots(props.hotspots);

const hasSeedData = computed(() => Object.keys(data.value).length > 0);

const EMPTY: ComplexHotspots = { newHigh: [], active: [], topPyeong: [] };
const currentData = computed<ComplexHotspots>(() => data.value[propertyType.value] ?? EMPTY);

async function onPropertyChange(next: RealEstatePropertyType): Promise<void> {
  propertyType.value = next;
  if (data.value[next]) return;
  isLoadingProperty.value = true;
  try {
    await loadProperty(next);
  } catch {
    // silent fail
  } finally {
    isLoadingProperty.value = false;
  }
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/home/HomeHotspotSignals.test.ts 2>&1 | tail -20`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/components/home/HomeHotspotSignals.vue \
        frontend/tests/components/home/HomeHotspotSignals.test.ts
git commit -m "feat(frontend): rebuild HomeHotspotSignals with complex 3-card layout"
```

---

### Task 14: 페이지 + E2E 테스트 mock 데이터 갱신

**Files:**
- Modify: `frontend/tests/pages/index.test.ts`
- Modify: `frontend/tests/e2e/home-hotspot.spec.ts`

- [ ] **Step 1: 페이지 테스트 mock 데이터 새 구조로**

`frontend/tests/pages/index.test.ts`에서 `realEstateHotspots`를 사용하는 mock 데이터를 다음 형태로 변경:

```typescript
realEstateHotspots: {
  apt: {
    newHigh: [],
    active: [],
    topPyeong: [],
  },
},
```

(기존 `{ sale, jeonse, wolse }` 구조였다면 통째로 교체.)

Run: `cd frontend && npx vitest run tests/pages/index.test.ts 2>&1 | tail -20`
Expected: PASS.

- [ ] **Step 2: e2e 파일 이름 + 내용 갱신**

`frontend/tests/e2e/home-hotspot.spec.ts`에서:
- 모든 `/api/meta/hotspots` 경로를 `/api/meta/complex-hotspots`로 교체 (replace_all)
- mock 응답 body를 `{ newHigh: [...], active: [...], topPyeong: [...] }` 구조로 갱신
- assertion에서 "거래 급증", "상승", "하락" 같은 옛 라벨을 "신고가 갱신", "거래 활발", "평당가 TOP"로 교체

E2E 안의 helper 함수도 함께 갱신. 정확한 구조는 파일을 열어보고 작성.

- [ ] **Step 3: 유닛 테스트 전체 확인**

Run: `cd frontend && nvm use 20 && npm run test 2>&1 | tail -20`
Expected: 모두 PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/tests/pages/index.test.ts frontend/tests/e2e/home-hotspot.spec.ts
git commit -m "test(frontend): update home-hotspot mocks for complex hotspot shape"
```

---

### Task 15: 옛 프론트엔드 파일 삭제

**Files:**
- Delete: `frontend/composables/useRealEstateHotspots.ts`
- Delete: `frontend/tests/composables/useRealEstateHotspots.test.ts`
- Delete: `frontend/components/home/hotspot/HotspotCard.vue`
- Delete: `frontend/components/home/hotspot/HotspotRow.vue`
- Delete: `frontend/components/home/hotspot/TxnTypeMiniTabs.vue`
- Delete: `frontend/tests/components/home/hotspot/HotspotCard.test.ts`
- Delete: `frontend/tests/components/home/hotspot/HotspotRow.test.ts`
- Delete: `frontend/tests/components/home/hotspot/TxnTypeMiniTabs.test.ts`

- [ ] **Step 1: 잔여 import grep**

Run: `cd frontend && grep -rn "useRealEstateHotspots\|TxnTypeMiniTabs\|hotspot/HotspotCard\|hotspot/HotspotRow" --include='*.ts' --include='*.vue' 2>&1 | head -20`
Expected: 출력 없어야 함. 만약 있으면 해당 사용처를 먼저 정리.

- [ ] **Step 2: 파일 삭제**

Run:
```bash
rm frontend/composables/useRealEstateHotspots.ts
rm frontend/tests/composables/useRealEstateHotspots.test.ts
rm frontend/components/home/hotspot/HotspotCard.vue
rm frontend/components/home/hotspot/HotspotRow.vue
rm frontend/components/home/hotspot/TxnTypeMiniTabs.vue
rm frontend/tests/components/home/hotspot/HotspotCard.test.ts
rm frontend/tests/components/home/hotspot/HotspotRow.test.ts
rm frontend/tests/components/home/hotspot/TxnTypeMiniTabs.test.ts
```

- [ ] **Step 3: 타입체크 + 테스트**

Run: `cd frontend && nvm use 20 && npx vue-tsc --noEmit 2>&1 | tail -10`
Expected: 통과.

Run: `cd frontend && npm run test 2>&1 | tail -10`
Expected: PASS 모두.

- [ ] **Step 4: Commit**

```bash
git add -A frontend/composables/useRealEstateHotspots.ts \
           frontend/tests/composables/useRealEstateHotspots.test.ts \
           frontend/components/home/hotspot/HotspotCard.vue \
           frontend/components/home/hotspot/HotspotRow.vue \
           frontend/components/home/hotspot/TxnTypeMiniTabs.vue \
           frontend/tests/components/home/hotspot/HotspotCard.test.ts \
           frontend/tests/components/home/hotspot/HotspotRow.test.ts \
           frontend/tests/components/home/hotspot/TxnTypeMiniTabs.test.ts
git commit -m "chore(frontend): remove legacy region hotspot UI components"
```

---

## Task 16: 통합 검증 + dev 실측

**Files:** (없음 — 실측만)

- [ ] **Step 1: Nitro 캐시 정리** (project memory: nitro 라우트 캐시 stale 이슈)

Run:
```bash
rm -rf frontend/.nuxt/cache/nitro/routes
rm -rf frontend/.nuxt frontend/.output
```

- [ ] **Step 2: MySQL up + 백엔드 dev 시작**

Run (별도 터미널):
```bash
docker compose up -d
cd backend && nvm use 20 && npm run dev
```
Expected: `Server listening on http://localhost:8000`

- [ ] **Step 3: API 직접 호출 확인 (3자산 모두 데이터 있는지)**

Run:
```bash
curl -s "http://localhost:8000/api/meta/complex-hotspots?propertyType=apt" | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print('apt newHigh:', len(d['newHigh']), 'active:', len(d['active']), 'topPyeong:', len(d['topPyeong']))"
curl -s "http://localhost:8000/api/meta/complex-hotspots?propertyType=offitel" | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print('offitel newHigh:', len(d['newHigh']), 'active:', len(d['active']), 'topPyeong:', len(d['topPyeong']))"
curl -s "http://localhost:8000/api/meta/complex-hotspots?propertyType=villa" | python3 -c "import sys, json; d=json.load(sys.stdin)['data']; print('villa newHigh:', len(d['newHigh']), 'active:', len(d['active']), 'topPyeong:', len(d['topPyeong']))"
```
Expected: 각 카드 0~5건. **오피스텔에서도 최소 한 카드 이상은 채워져야** 정상 (active/topPyeong은 거의 확실히 채워짐).

만약 모든 자산의 모든 카드가 0이면 → DB 데이터 부족 또는 SQL 버그. 디버깅 필요.

- [ ] **Step 4: 프론트엔드 dev**

Run (별도 터미널):
```bash
cd frontend && nvm use 20 && npm run dev
```
Expected: `http://localhost:3000` 접속 가능.

- [ ] **Step 5: 메인 페이지 브라우저 확인**

Open: `http://localhost:3000/`

확인 사항:
- "오늘의 부동산 시장" 섹션이 보임
- 자산 토글 3개(아파트/오피스텔/빌라) 표시
- 거래 토글(매매/전세/월세) UI 없음
- 3카드(신고가 갱신 / 거래 활발 / 평당가 TOP) 표시
- 오피스텔 토글 클릭 시 데이터 채워짐
- 단지명 클릭 시 단지 상세 페이지로 이동

- [ ] **Step 6: 단지 상세 페이지 도달 확인**

메인에서 카드 행을 하나 클릭 → URL이 `/real-estate/apt/seoul/gangnam-gu/<단지명>` 형태이고 단지 상세가 정상 렌더되는지 확인.

- [ ] **Step 7: 전체 테스트 최종**

Run:
```bash
cd backend && nvm use 20 && npm run test 2>&1 | tail -5
cd ../frontend && nvm use 20 && npm run test 2>&1 | tail -5
```
Expected: 양쪽 모두 PASS.

- [ ] **Step 8: PR 생성**

Run:
```bash
git push origin feat/home-complex-hotspot
gh pr create --base develop --head feat/home-complex-hotspot \
  --title "feat: 메인 핫스팟 — 단지 단위 3카드로 재설계 (신고가/거래활발/평당가TOP)" \
  --body "## 요약
- 기존 시·군·구 단위 핫스팟(평당가 상승/하락/거래 급증) 제거
- 단지 단위 3카드: 신고가 갱신 / 거래 활발 / 평당가 TOP
- 도착지 = 단지 상세 페이지 (long-tail SEO)
- 매매 전용, 자산 토글(아파트/오피스텔/빌라) 유지
- 운영의 오피스텔 매매 빈 결과 문제 해소 (시·군·구 임계치 → 단지 단위 임계치)

## 스펙
docs/superpowers/specs/2026-05-21-home-complex-hotspot-redesign-design.md

## 변경 API
- 제거: GET /api/meta/hotspots
- 추가: GET /api/meta/complex-hotspots?propertyType=apt|villa|offitel
"
```

---

## Self-Review

스펙 ↔ 플랜 매핑 (전부 커버 확인):

| 스펙 항목 | 태스크 |
|---|---|
| 카드 1 (신고가 갱신, 평당가 기준, 직전 12개월 ≥ 3건, 5건 상한) | Task 2 |
| 카드 2 (거래 활발, 30일 ≥ 2건, 시별 캡 2, 5건 상한) | Task 3 |
| 카드 3 (평당가 TOP, 30일 ≥ 2건, 시별 캡 2, 5건 상한) | Task 4 |
| `getComplexHotspots` 조립 + 1h 캐시 + 자산별 독립 | Task 5 |
| `/api/meta/complex-hotspots` 신설 + 옛 라우트 제거 | Task 6 |
| `metaService.getHomeDashboard` SSR seed swap | Task 7 |
| 옛 backend 서비스/테스트 삭제 | Task 8 |
| ComplexRef/카드별 타입 (백엔드+프론트) | Task 1, 9 |
| `useComplexHotspots` composable | Task 10 |
| `HotspotComplexRow.vue` (URL 인코딩 포함) | Task 11 |
| `HotspotComplexCard.vue` (3 variant) | Task 12 |
| `HomeHotspotSignals.vue` 재작성 (거래 토글 제거, 자산 unmount 안 함, 부족한 만큼 노출) | Task 13 |
| index 페이지 mock + e2e | Task 14 |
| 옛 프론트엔드 컴포넌트/composable 삭제 | Task 15 |
| Nitro 캐시 정리 + 운영급 dev 검증 | Task 16 |

---

**Plan complete and saved to `docs/superpowers/plans/2026-05-21-home-complex-hotspot-redesign.md`. Two execution options:**

1. **Subagent-Driven (recommended)** — 태스크당 fresh subagent dispatch, 사이사이 리뷰, 빠른 반복
2. **Inline Execution** — 이 세션에서 executing-plans 스킬로 일괄 진행, 체크포인트에서 리뷰

**어느 쪽으로 진행할까요?**
