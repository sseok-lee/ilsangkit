# 부동산 핫스팟 디스커버리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인페이지 "오늘의 부동산 시장" 섹션을 전국 평균 매트릭스에서 시·군·구 단위 핫스팟(상승/하락/거래 급증) 디스커버리 카드로 교체한다.

**Architecture:** 백엔드는 신규 `getPropertyHotspots(propertyType)` 서비스 + 1시간 LRU 캐시 + 신규 `/api/meta/hotspots` 엔드포인트. 기존 `getRealEstateTrends()`는 롤아웃 안정성을 위해 유지(별도 PR에서 제거). 프론트엔드는 신규 `HomeHotspotSignals.vue` 가 SSR로 apt를 렌더하고 토글 시 클라이언트 lazy fetch한다. 월세는 평당가 시그널 제외, 거래 급증 1카드만.

**Tech Stack:** Backend — TypeScript ESM, Express 5, Prisma + raw SQL (CTE), Vitest. Frontend — Nuxt 3 SSR, Vue 3 Composition API, Pinia, TailwindCSS, Vitest + @vue/test-utils, Playwright.

**Spec:** `docs/superpowers/specs/2026-05-20-real-estate-hotspot-design.md`

**Mockup reference:** `/tmp/ilsangkit-hotspot-mockup.html` (브라우저 검증된 시각 디자인)

---

## File Structure

### Backend (신규/수정)
- **신규** `backend/src/services/realEstateHotspotService.ts` — sale/jeonse/wolse 슬라이스 쿼리 + 캐싱
- **신규** `backend/__tests__/services/realEstateHotspotService.test.ts` — 단위 테스트
- **수정** `backend/src/schemas/realEstate.ts` — `RealEstatePropertyType` Zod 추가
- **수정** `backend/src/types/homeDashboard.ts` — `HotspotRegion`, `HotspotBundle`, `WolseHotspotBundle`, `PropertyHotspots`, `RealEstateHotspots` 타입 추가
- **수정** `backend/src/services/metaService.ts` — `getHomeDashboard()` 에 `realEstateHotspots.apt` 포함
- **수정** `backend/src/routes/meta.ts` — `GET /api/meta/hotspots` 엔드포인트 추가

### Frontend (신규/수정)
- **신규** `frontend/components/home/hotspot/HotspotRow.vue` — 한 행 (지역명 + 평당가 + 거래량 + 변동률)
- **신규** `frontend/components/home/hotspot/HotspotCard.vue` — 한 시그널 카드 (rising/falling/active variant)
- **신규** `frontend/components/home/hotspot/TxnTypeMiniTabs.vue` — 매매/전세/월세 미니탭
- **신규** `frontend/components/home/HomeHotspotSignals.vue` — orchestrator (PropertyToggle + MobileSignalTabs + CardGrid)
- **신규** `frontend/composables/useRealEstateHotspots.ts` — 데이터 fetch + lazy 캐시
- **신규** `frontend/tests/components/home/hotspot/HotspotRow.test.ts`
- **신규** `frontend/tests/components/home/hotspot/HotspotCard.test.ts`
- **신규** `frontend/tests/components/home/HomeHotspotSignals.test.ts`
- **수정** `frontend/composables/useHomeDashboard.ts` — `realEstateHotspots` 필드 추가
- **수정** `frontend/pages/index.vue` — `HomeMarketStats` → `HomeHotspotSignals` 교체
- **신규** `frontend/tests/e2e/home-hotspot.spec.ts` — Playwright E2E

### 기존 유지 (이 plan에서 건드리지 않음, 별도 PR로 제거)
- `frontend/components/home/HomeMarketStats.vue` — 미사용이 되지만 제거하지 않음
- `backend/src/services/metaService.ts` 의 `getRealEstateTrends()` — 유지

---

## Phase A: 백엔드 기반 타입

### Task 1: `RealEstatePropertyType` Zod 스키마 추가

**Files:**
- Modify: `backend/src/schemas/realEstate.ts`
- Test: `backend/__tests__/schemas/realEstate.test.ts` (없으면 신규)

- [ ] **Step 1: 테스트 파일 확인 후 작성/수정**

확인: `ls backend/__tests__/schemas/realEstate.test.ts`. 없으면 신규 생성.

```ts
// backend/__tests__/schemas/realEstate.test.ts
import { describe, it, expect } from 'vitest';
import { RealEstatePropertyTypeSchema } from '../../src/schemas/realEstate.js';

describe('RealEstatePropertyTypeSchema', () => {
  it('accepts apt, villa, offitel', () => {
    expect(RealEstatePropertyTypeSchema.parse('apt')).toBe('apt');
    expect(RealEstatePropertyTypeSchema.parse('villa')).toBe('villa');
    expect(RealEstatePropertyTypeSchema.parse('offitel')).toBe('offitel');
  });

  it('rejects invalid values', () => {
    expect(() => RealEstatePropertyTypeSchema.parse('house')).toThrow();
    expect(() => RealEstatePropertyTypeSchema.parse('apt-sale')).toThrow();
    expect(() => RealEstatePropertyTypeSchema.parse('')).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/schemas/realEstate.test.ts
```

기대: FAIL with "RealEstatePropertyTypeSchema is not exported".

- [ ] **Step 3: 스키마 추가**

`backend/src/schemas/realEstate.ts` 의 `RealEstateTypeSchema` 정의 바로 아래에 추가:

```ts
// 건물 유형 (sale/rent 거래 차원 제외)
export const RealEstatePropertyTypeSchema = z.enum([
  'apt',
  'villa',
  'offitel',
]);

export type RealEstatePropertyType = z.infer<typeof RealEstatePropertyTypeSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/schemas/realEstate.test.ts
```

기대: PASS (2 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/schemas/realEstate.ts __tests__/schemas/realEstate.test.ts
git commit -m "feat(backend): add RealEstatePropertyType zod schema"
```

---

### Task 2: 핫스팟 응답 타입 정의

**Files:**
- Modify: `backend/src/types/homeDashboard.ts`

- [ ] **Step 1: 타입 추가**

`backend/src/types/homeDashboard.ts` 파일 마지막에 추가:

```ts
import type { RealEstatePropertyType } from '../schemas/realEstate.js';

/** 한 지역(시·군·구) 핫스팟 정보 */
export interface HotspotRegion {
  citySlug: string;        // 'seoul'
  city: string;            // '서울특별시'
  districtSlug: string;    // 'gangnam-gu'
  district: string;        // '강남구'
  pricePerPyeong: number | null;   // 평당가(만원). 월세는 null
  txnCount: number;                // 최근 7일 거래건수
  changePct: number | null;        // 전주 대비 평당가 변동률(%). 월세는 null
  volumeChangePct: number | null;  // 거래량 변동률(%)
}

/** 매매/전세 슬라이스의 3시그널 묶음 */
export interface HotspotBundle {
  rising: HotspotRegion[];   // 평당가 상승 TOP. changePct desc, max 5
  falling: HotspotRegion[];  // 평당가 하락 TOP. changePct asc, max 5
  active: HotspotRegion[];   // 거래 급증 TOP. volumeChangePct desc, max 5
}

/** 월세 슬라이스 — 거래 급증만 */
export interface WolseHotspotBundle {
  active: HotspotRegion[];   // pricePerPyeong/changePct는 null로 채워짐
}

/** 건물 유형별 핫스팟: 매매/전세/월세 */
export interface PropertyHotspots {
  sale: HotspotBundle;
  jeonse: HotspotBundle;
  wolse: WolseHotspotBundle;
}

/** 메인 SSR은 apt만 채움. 나머지 건물유형은 클라이언트 lazy fetch */
export type RealEstateHotspots = Partial<Record<RealEstatePropertyType, PropertyHotspots>>;
```

같은 파일 `HomeDashboardResponse` 타입에 필드 추가:

```ts
// 기존 HomeDashboardResponse type 안에 추가
realEstateHotspots: RealEstateHotspots;  // apt만 채워짐
```

- [ ] **Step 2: 타입 컴파일 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx tsc --noEmit
```

기대: 0 errors (타입만 추가했고 사용처 없음. metaService에서 새 필드 미반환은 다음 Task에서).

이 단계에서 컴파일 에러가 나면, `HomeDashboardResponse`를 반환하는 `getHomeDashboard()` 가 새 필수 필드를 채워야 한다. 임시로 `realEstateHotspots?: ...` 로 optional 처리 후 다음 task에서 required로 변경.

→ optional로 둔다면 위 코드에서 `realEstateHotspots?: RealEstateHotspots;` 로 수정.

- [ ] **Step 3: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/types/homeDashboard.ts
git commit -m "feat(backend): add real estate hotspot response types"
```

---

## Phase B: 백엔드 핫스팟 서비스

### Task 3: sale/jeonse 슬라이스 쿼리 (단일 함수, 한 테이블 대상)

**Files:**
- Create: `backend/src/services/realEstateHotspotService.ts`
- Create: `backend/__tests__/services/realEstateHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 작성 — 정렬 + 임계값 + null 처리**

```ts
// backend/__tests__/services/realEstateHotspotService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockQueryRaw } = vi.hoisted(() => ({
  mockQueryRaw: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRaw: mockQueryRaw },
  default: { $queryRaw: mockQueryRaw },
}));

import { getPricedSliceHotspots } from '../../src/services/realEstateHotspotService.js';

beforeEach(() => {
  mockQueryRaw.mockReset();
});

describe('getPricedSliceHotspots (sale/jeonse 슬라이스)', () => {
  it('rising은 changePct DESC, falling은 ASC, active는 volumeChangePct DESC 정렬', async () => {
    // 동일한 raw row 셋을 반환. 함수가 자체적으로 분기 정렬해야 함.
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 100n, changePct: 5, volumeChangePct: 30 },
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'mapo-gu', district: '마포구',
        pricePerPyeong: 5000, txnCount: 60n, changePct: -3, volumeChangePct: 10 },
      { citySlug: 'busan', city: '부산광역시', districtSlug: 'haeundae-gu', district: '해운대구',
        pricePerPyeong: 4000, txnCount: 80n, changePct: 2, volumeChangePct: 50 },
    ]);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising.map((r) => r.district)).toEqual(['강남구', '해운대구']);
    expect(bundle.falling.map((r) => r.district)).toEqual(['마포구']);
    expect(bundle.active.map((r) => r.district)).toEqual(['해운대구', '강남구', '마포구']);
  });

  it('changePct가 null인 행은 rising/falling에서 제외, active에는 영향 없음', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 100n, changePct: null, volumeChangePct: 30 },
    ]);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toEqual([]);
    expect(bundle.falling).toEqual([]);
    expect(bundle.active).toHaveLength(1);
  });

  it('각 시그널 최대 5개로 자름', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      citySlug: `city-${i}`,
      city: `시-${i}`,
      districtSlug: `dist-${i}`,
      district: `구-${i}`,
      pricePerPyeong: 5000 + i,
      txnCount: 100n,
      changePct: i + 1,
      volumeChangePct: i + 1,
    }));
    mockQueryRaw.mockResolvedValue(rows);

    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });

    expect(bundle.rising).toHaveLength(5);
    expect(bundle.active).toHaveLength(5);
  });

  it('BigInt txnCount는 number로 변환됨', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        pricePerPyeong: 8000, txnCount: 12345n, changePct: 5, volumeChangePct: 30 },
    ]);
    const bundle = await getPricedSliceHotspots('AptSaleTransaction', { sampleThreshold: 30 });
    expect(bundle.rising[0].txnCount).toBe(12345);
    expect(typeof bundle.rising[0].txnCount).toBe('number');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/realEstateHotspotService.test.ts
```

기대: FAIL — 모듈 없음.

- [ ] **Step 3: 서비스 파일 작성 — sale/jeonse 단일 함수**

```ts
// backend/src/services/realEstateHotspotService.ts
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type {
  HotspotRegion, HotspotBundle, WolseHotspotBundle, PropertyHotspots,
} from '../types/homeDashboard.js';
import type { RealEstatePropertyType } from '../schemas/realEstate.js';
import { CITY_SLUG_TO_FULL, CITY_SLUG_TO_SHORT } from './cityMapping.js';

const MAX_PER_SIGNAL = 5;

const SAMPLE_THRESHOLD: Record<RealEstatePropertyType, number> = {
  apt: 30,
  villa: 15,
  offitel: 15,
};

type RawPricedRow = {
  citySlug: string;
  city: string;
  districtSlug: string;
  district: string;
  pricePerPyeong: number | null;
  txnCount: bigint | number;
  changePct: number | null;
  volumeChangePct: number | null;
};

function normalizeRow(r: RawPricedRow): HotspotRegion {
  return {
    citySlug: r.citySlug,
    city: r.city,
    districtSlug: r.districtSlug,
    district: r.district,
    pricePerPyeong: r.pricePerPyeong,
    txnCount: Number(r.txnCount),
    changePct: r.changePct,
    volumeChangePct: r.volumeChangePct,
  };
}

type PricedSliceTable =
  | 'AptSaleTransaction' | 'VillaSaleTransaction' | 'OffitelSaleTransaction'
  | 'AptRentTransaction' | 'VillaRentTransaction' | 'OffitelRentTransaction';

interface PricedSliceOptions {
  sampleThreshold: number;
  rentTypeFilter?: '전세' | '월세';  // sale 테이블은 미설정. rent 테이블 전세/월세 분기용.
}

/**
 * 매매/전세 슬라이스: 시·군·구 단위 평당가 + 변동률 + 거래량 변동률 산출 후 3시그널 묶음 반환.
 * 월세는 getWolseHotspots()를 사용 (가격 산정 안 함).
 */
export async function getPricedSliceHotspots(
  table: PricedSliceTable,
  opts: PricedSliceOptions,
): Promise<HotspotBundle> {
  const { sampleThreshold, rentTypeFilter } = opts;

  // Region 테이블의 citySlug/districtSlug 매핑은 메인 쿼리에서 JOIN으로 가져온다.
  // 한국 부동산은 city 형태가 (서울특별시, 서울) 혼재이므로 Region.city 와 매칭.
  const rentTypeClause = rentTypeFilter
    ? Prisma.sql`AND t.rentType = ${rentTypeFilter}`
    : Prisma.empty;

  const priceExpr = table.includes('Sale')
    ? Prisma.sql`t.dealAmount`
    : Prisma.sql`t.deposit`;

  const tableRaw = Prisma.raw(table);

  const rows = await prisma.$queryRaw<RawPricedRow[]>`
    WITH recent AS (
      SELECT t.city, t.district,
             AVG(${priceExpr} / (t.exclusiveArea / 3.3058)) AS pricePerPyeong,
             COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.exclusiveArea IS NOT NULL AND t.exclusiveArea > 0
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
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
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        ${rentTypeClause}
      GROUP BY t.city, t.district
    )
    SELECT
      reg.citySlug AS citySlug,
      r.city AS city,
      reg.districtSlug AS districtSlug,
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

  const all = rows.map(normalizeRow);

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

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/realEstateHotspotService.test.ts
```

기대: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/services/realEstateHotspotService.ts __tests__/services/realEstateHotspotService.test.ts
git commit -m "feat(backend): add getPricedSliceHotspots for sale/jeonse slices"
```

---

### Task 4: wolse 슬라이스 함수 추가

**Files:**
- Modify: `backend/src/services/realEstateHotspotService.ts`
- Modify: `backend/__tests__/services/realEstateHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

기존 테스트 파일 끝에 추가:

```ts
import { getWolseHotspots } from '../../src/services/realEstateHotspotService.js';

describe('getWolseHotspots', () => {
  it('pricePerPyeong과 changePct는 null로 채워짐', async () => {
    mockQueryRaw.mockResolvedValue([
      { citySlug: 'seoul', city: '서울특별시', districtSlug: 'gangnam-gu', district: '강남구',
        txnCount: 150n, volumeChangePct: 40 },
    ]);

    const bundle = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 30 });

    expect(bundle.active).toHaveLength(1);
    expect(bundle.active[0].pricePerPyeong).toBeNull();
    expect(bundle.active[0].changePct).toBeNull();
    expect(bundle.active[0].volumeChangePct).toBe(40);
    expect(bundle.active[0].txnCount).toBe(150);
  });

  it('volumeChangePct DESC 정렬 + 최대 5개', async () => {
    const rows = Array.from({ length: 8 }, (_, i) => ({
      citySlug: `c-${i}`, city: `시-${i}`, districtSlug: `d-${i}`, district: `구-${i}`,
      txnCount: 100n, volumeChangePct: 10 - i,
    }));
    mockQueryRaw.mockResolvedValue(rows);

    const bundle = await getWolseHotspots('AptRentTransaction', { sampleThreshold: 30 });

    expect(bundle.active).toHaveLength(5);
    expect(bundle.active.map((r) => r.volumeChangePct)).toEqual([10, 9, 8, 7, 6]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/realEstateHotspotService.test.ts
```

기대: FAIL — `getWolseHotspots` 미정의.

- [ ] **Step 3: 함수 추가**

`backend/src/services/realEstateHotspotService.ts` 끝에 추가:

```ts
type WolseTable = 'AptRentTransaction' | 'VillaRentTransaction' | 'OffitelRentTransaction';

type RawWolseRow = {
  citySlug: string;
  city: string;
  districtSlug: string;
  district: string;
  txnCount: bigint | number;
  volumeChangePct: number | null;
};

/**
 * 월세 슬라이스: 평당가 산정 안 함 — 거래 급증(volumeChangePct DESC)만 반환.
 * pricePerPyeong / changePct 는 모든 행에서 null.
 */
export async function getWolseHotspots(
  table: WolseTable,
  opts: { sampleThreshold: number },
): Promise<WolseHotspotBundle> {
  const { sampleThreshold } = opts;
  const tableRaw = Prisma.raw(table);

  const rows = await prisma.$queryRaw<RawWolseRow[]>`
    WITH recent AS (
      SELECT t.city, t.district, COUNT(*) AS txnCount
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY t.city, t.district
      HAVING COUNT(*) >= ${sampleThreshold}
    ),
    prior AS (
      SELECT t.city, t.district, COUNT(*) AS prevTxnCount
      FROM ${tableRaw} t
      WHERE t.rentType = '월세'
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
        AND STR_TO_DATE(CONCAT(t.dealYear,'-',LPAD(t.dealMonth,2,'0'),'-',LPAD(COALESCE(t.dealDay,1),2,'0')),'%Y-%m-%d')
            <  DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY t.city, t.district
    )
    SELECT
      reg.citySlug AS citySlug,
      r.city AS city,
      reg.districtSlug AS districtSlug,
      r.district AS district,
      r.txnCount AS txnCount,
      CASE WHEN p.prevTxnCount > 0
           THEN (CAST(r.txnCount AS DECIMAL) - p.prevTxnCount) / p.prevTxnCount * 100
           ELSE NULL END AS volumeChangePct
    FROM recent r
    LEFT JOIN prior p ON p.city = r.city AND p.district = r.district
    INNER JOIN Region reg ON reg.city = r.city AND reg.district = r.district
  `;

  const active: HotspotRegion[] = rows
    .filter((r) => r.volumeChangePct !== null && r.volumeChangePct > 0)
    .map((r) => ({
      citySlug: r.citySlug,
      city: r.city,
      districtSlug: r.districtSlug,
      district: r.district,
      pricePerPyeong: null,
      txnCount: Number(r.txnCount),
      changePct: null,
      volumeChangePct: r.volumeChangePct,
    }))
    .sort((a, b) => (b.volumeChangePct as number) - (a.volumeChangePct as number))
    .slice(0, MAX_PER_SIGNAL);

  return { active };
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/realEstateHotspotService.test.ts
```

기대: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/services/realEstateHotspotService.ts __tests__/services/realEstateHotspotService.test.ts
git commit -m "feat(backend): add getWolseHotspots (volume-only slice)"
```

---

### Task 5: 건물유형별 핫스팟 aggregator + 1시간 LRU 캐시

**Files:**
- Modify: `backend/src/services/realEstateHotspotService.ts`
- Modify: `backend/__tests__/services/realEstateHotspotService.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

기존 테스트 파일 끝에 추가:

```ts
import { getPropertyHotspots, _hotspotCache } from '../../src/services/realEstateHotspotService.js';

describe('getPropertyHotspots (aggregator)', () => {
  beforeEach(() => {
    _hotspotCache.clear();
  });

  it('apt 호출 시 3개 슬라이스(sale/jeonse/wolse) 모두 채워짐', async () => {
    // 매번 빈 결과 반환 — 형태만 검증
    mockQueryRaw.mockResolvedValue([]);

    const result = await getPropertyHotspots('apt');

    expect(result.sale).toBeDefined();
    expect(result.sale.rising).toEqual([]);
    expect(result.jeonse).toBeDefined();
    expect(result.wolse).toBeDefined();
    expect(result.wolse.active).toEqual([]);
    // sale + jeonse + wolse = 3 raw 쿼리 호출
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);
  });

  it('동일 propertyType 두 번째 호출은 캐시 사용 (DB 호출 X)', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getPropertyHotspots('apt');
    expect(mockQueryRaw).toHaveBeenCalledTimes(3);

    await getPropertyHotspots('apt');
    expect(mockQueryRaw).toHaveBeenCalledTimes(3); // 추가 호출 없음
  });

  it('다른 propertyType은 별도 캐시 키', async () => {
    mockQueryRaw.mockResolvedValue([]);
    await getPropertyHotspots('apt');
    await getPropertyHotspots('villa');
    expect(mockQueryRaw).toHaveBeenCalledTimes(6); // 3 + 3
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/realEstateHotspotService.test.ts
```

기대: FAIL — `getPropertyHotspots` / `_hotspotCache` 미정의.

- [ ] **Step 3: aggregator + 캐시 추가**

`backend/src/services/realEstateHotspotService.ts` 끝에 추가:

```ts
const CACHE_TTL_MS = 60 * 60 * 1000;  // 1시간

const PRICED_TABLES: Record<RealEstatePropertyType, { sale: PricedSliceTable; rent: PricedSliceTable }> = {
  apt:     { sale: 'AptSaleTransaction',     rent: 'AptRentTransaction' },
  villa:   { sale: 'VillaSaleTransaction',   rent: 'VillaRentTransaction' },
  offitel: { sale: 'OffitelSaleTransaction', rent: 'OffitelRentTransaction' },
};

// 테스트에서 reset 가능하도록 export
export const _hotspotCache = new Map<RealEstatePropertyType, { data: PropertyHotspots; expiry: number }>();

export async function getPropertyHotspots(propertyType: RealEstatePropertyType): Promise<PropertyHotspots> {
  const cached = _hotspotCache.get(propertyType);
  if (cached && Date.now() < cached.expiry) {
    return cached.data;
  }

  const threshold = SAMPLE_THRESHOLD[propertyType];
  const { sale, rent } = PRICED_TABLES[propertyType];

  const [saleBundle, jeonseBundle, wolseBundle] = await Promise.all([
    getPricedSliceHotspots(sale, { sampleThreshold: threshold }),
    getPricedSliceHotspots(rent, { sampleThreshold: threshold, rentTypeFilter: '전세' }),
    getWolseHotspots(rent as WolseTable, { sampleThreshold: threshold }),
  ]);

  const data: PropertyHotspots = { sale: saleBundle, jeonse: jeonseBundle, wolse: wolseBundle };
  _hotspotCache.set(propertyType, { data, expiry: Date.now() + CACHE_TTL_MS });
  return data;
}
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/realEstateHotspotService.test.ts
```

기대: PASS (9 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/services/realEstateHotspotService.ts __tests__/services/realEstateHotspotService.test.ts
git commit -m "feat(backend): add getPropertyHotspots aggregator with 1h LRU cache"
```

---

## Phase C: 백엔드 API 엔드포인트

### Task 6: `GET /api/meta/hotspots?propertyType=` 엔드포인트

**Files:**
- Modify: `backend/src/routes/meta.ts`
- Create: `backend/__tests__/routes/meta-hotspots.test.ts`

- [ ] **Step 1: 실패 테스트 작성 (supertest 패턴 — 기존 라우트 테스트 참고)**

기존 라우트 테스트를 1개 확인하여 동일 패턴 사용:

```bash
ls backend/__tests__/routes/ 2>/dev/null
```

테스트 파일 생성:

```ts
// backend/__tests__/routes/meta-hotspots.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';

const { mockGetPropertyHotspots } = vi.hoisted(() => ({
  mockGetPropertyHotspots: vi.fn(),
}));

vi.mock('../../src/services/realEstateHotspotService.js', () => ({
  getPropertyHotspots: mockGetPropertyHotspots,
}));

// 다른 metaService 함수들은 사용 안 하지만 라우트가 import하므로 stub
vi.mock('../../src/services/metaService.js', () => ({
  getCategories: vi.fn(),
  getStats: vi.fn(),
  getRegionByDistrictName: vi.fn(),
  getRegionByBjdCode: vi.fn(),
  getRegions: vi.fn(),
  getHomeDashboard: vi.fn(),
}));

vi.mock('../../src/services/facilityService.js', () => ({
  getStatsByCity: vi.fn(),
  getStatsByDistrict: vi.fn(),
  getSyncStatus: vi.fn(),
  SHORT_TO_SLUG: {},
}));

vi.mock('../../src/lib/prisma.js', () => ({ prisma: {}, default: {} }));

import metaRouter from '../../src/routes/meta.js';

const app = express();
app.use('/api/meta', metaRouter);

beforeEach(() => {
  mockGetPropertyHotspots.mockReset();
});

describe('GET /api/meta/hotspots', () => {
  it('valid propertyType returns 200 with PropertyHotspots payload', async () => {
    mockGetPropertyHotspots.mockResolvedValue({
      sale: { rising: [], falling: [], active: [] },
      jeonse: { rising: [], falling: [], active: [] },
      wolse: { active: [] },
    });
    const res = await request(app).get('/api/meta/hotspots?propertyType=apt');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.sale).toBeDefined();
    expect(res.body.data.wolse).toBeDefined();
    expect(mockGetPropertyHotspots).toHaveBeenCalledWith('apt');
  });

  it('invalid propertyType returns 422', async () => {
    const res = await request(app).get('/api/meta/hotspots?propertyType=house');
    expect(res.status).toBe(422);
  });

  it('missing propertyType returns 422', async () => {
    const res = await request(app).get('/api/meta/hotspots');
    expect(res.status).toBe(422);
  });

  it('sets Cache-Control max-age=3600', async () => {
    mockGetPropertyHotspots.mockResolvedValue({
      sale: { rising: [], falling: [], active: [] },
      jeonse: { rising: [], falling: [], active: [] },
      wolse: { active: [] },
    });
    const res = await request(app).get('/api/meta/hotspots?propertyType=offitel');
    expect(res.headers['cache-control']).toContain('max-age=3600');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/routes/meta-hotspots.test.ts
```

기대: FAIL — 라우트 미존재(404).

- [ ] **Step 3: 라우트 추가**

`backend/src/routes/meta.ts` 의 import 섹션에 추가:

```ts
import { RealEstatePropertyTypeSchema } from '../schemas/realEstate.js';
import { getPropertyHotspots } from '../services/realEstateHotspotService.js';
```

`/home-dashboard` 라우트 바로 아래에 추가:

```ts
const HotspotQuerySchema = z.object({
  propertyType: RealEstatePropertyTypeSchema,
});

// GET /api/meta/hotspots?propertyType=apt|villa|offitel
router.get('/hotspots', validate(HotspotQuerySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  const { propertyType } = req.query as unknown as { propertyType: 'apt' | 'villa' | 'offitel' };
  const data = await getPropertyHotspots(propertyType);
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ success: true, data });
}));
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/routes/meta-hotspots.test.ts
```

기대: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/routes/meta.ts __tests__/routes/meta-hotspots.test.ts
git commit -m "feat(backend): add GET /api/meta/hotspots endpoint"
```

---

### Task 7: `getHomeDashboard()` 응답에 `realEstateHotspots.apt` 포함

**Files:**
- Modify: `backend/src/services/metaService.ts`
- Modify: `backend/__tests__/services/homeDashboard.test.ts`

- [ ] **Step 1: 실패 테스트 추가**

`backend/__tests__/services/homeDashboard.test.ts` 의 기존 describe block 안에 새 it 추가:

```ts
// 파일 상단 import 섹션에 추가 (vi.mock 블록 안에 함께)
vi.mock('../../src/services/realEstateHotspotService.js', () => ({
  getPropertyHotspots: vi.fn().mockResolvedValue({
    sale:   { rising: [{ districtSlug: 'gangnam-gu', district: '강남구' }], falling: [], active: [] },
    jeonse: { rising: [], falling: [], active: [] },
    wolse:  { active: [] },
  }),
}));

// 기존 describe 블록 안에 추가
it('includes realEstateHotspots.apt populated by getPropertyHotspots', async () => {
  // ... 기존 setup ...
  const result = await getHomeDashboard();
  expect(result.realEstateHotspots).toBeDefined();
  expect(result.realEstateHotspots.apt).toBeDefined();
  expect(result.realEstateHotspots.apt.sale.rising).toHaveLength(1);
  expect(result.realEstateHotspots.apt.sale.rising[0].district).toBe('강남구');
});
```

(기존 테스트 내 다른 setup이 필요할 수 있음 — 실패 시 다른 it 블록의 setup 참고)

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/homeDashboard.test.ts -t "realEstateHotspots"
```

기대: FAIL — `realEstateHotspots` 필드 없음.

- [ ] **Step 3: `getHomeDashboard` 수정**

`backend/src/services/metaService.ts` 의 `getHomeDashboard` 함수에서:
- 파일 상단에 import 추가: `import { getPropertyHotspots } from './realEstateHotspotService.js';`
- `Promise.all([...])` 배열에 `getPropertyHotspots('apt')` 추가
- 결과 반환 객체에 `realEstateHotspots: { apt: aptHotspots }` 추가

수정 예시 (실제 코드는 `getHomeDashboard()` 본문 내):

```ts
const [
  // ... 기존 호출들 ...
  realEstateTrends,
  trendingBuildings,
  subscriptionSummary,
  aptHotspots,  // 추가
] = await Promise.all([
  // ... 기존 ...
  getRealEstateTrends(),
  getTrendingBuildings(),
  getSubscriptionSummary(),
  getPropertyHotspots('apt'),  // 추가
]);

return {
  // ... 기존 필드들 ...
  realEstateTrends,
  trendingBuildings,
  subscriptionSummary,
  realEstateHotspots: { apt: aptHotspots },  // 추가
};
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npx vitest run __tests__/services/homeDashboard.test.ts
```

기대: PASS (기존 + 신규 모두).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && git add src/services/metaService.ts __tests__/services/homeDashboard.test.ts
git commit -m "feat(backend): include realEstateHotspots.apt in home-dashboard response"
```

---

## Phase D: 프론트엔드 타입 + 데이터

### Task 8: 프론트엔드 핫스팟 타입 정의

**Files:**
- Modify: `frontend/composables/useHomeDashboard.ts`

- [ ] **Step 1: 타입 추가**

`frontend/composables/useHomeDashboard.ts` 파일 상단(기존 export interface들 사이)에 추가:

```ts
export interface HotspotRegion {
  citySlug: string;
  city: string;
  districtSlug: string;
  district: string;
  pricePerPyeong: number | null;
  txnCount: number;
  changePct: number | null;
  volumeChangePct: number | null;
}

export interface HotspotBundle {
  rising: HotspotRegion[];
  falling: HotspotRegion[];
  active: HotspotRegion[];
}

export interface WolseHotspotBundle {
  active: HotspotRegion[];
}

export interface PropertyHotspots {
  sale: HotspotBundle;
  jeonse: HotspotBundle;
  wolse: WolseHotspotBundle;
}

export type RealEstateHotspots = Partial<{
  apt: PropertyHotspots;
  villa: PropertyHotspots;
  offitel: PropertyHotspots;
}>;
```

기존 `HomeDashboard` interface에 필드 추가:

```ts
export interface HomeDashboard {
  // ... 기존 필드들 ...
  realEstateHotspots: RealEstateHotspots;  // apt만 채워짐
}
```

- [ ] **Step 2: 타입 컴파일 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vue-tsc --noEmit
```

기대: 0 errors (사용처 미수정이어도 추가 필드는 옵셔널이 아니라 break-the-build 가능 — 그럴 경우 `realEstateHotspots?: RealEstateHotspots` optional로 변경).

- [ ] **Step 3: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add composables/useHomeDashboard.ts
git commit -m "feat(frontend): add real estate hotspot types to home dashboard composable"
```

---

### Task 9: lazy fetch composable

**Files:**
- Create: `frontend/composables/useRealEstateHotspots.ts`
- Create: `frontend/tests/composables/useRealEstateHotspots.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/composables/useRealEstateHotspots.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRealEstateHotspots } from '~/composables/useRealEstateHotspots';
import type { PropertyHotspots, RealEstateHotspots } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();
vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));

const sampleBundle = (): PropertyHotspots => ({
  sale:   { rising: [], falling: [], active: [] },
  jeonse: { rising: [], falling: [], active: [] },
  wolse:  { active: [] },
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('useRealEstateHotspots', () => {
  it('initial state seeds from SSR data', () => {
    const initial: RealEstateHotspots = { apt: sampleBundle() };
    const { data } = useRealEstateHotspots(initial);
    expect(data.value.apt).toBeDefined();
    expect(data.value.villa).toBeUndefined();
  });

  it('loadProperty fetches and caches on first call', async () => {
    fetchMock.mockResolvedValue({ success: true, data: sampleBundle() });
    const { data, loadProperty } = useRealEstateHotspots({ apt: sampleBundle() });

    await loadProperty('villa');
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:8000/api/meta/hotspots', { query: { propertyType: 'villa' } });
    expect(data.value.villa).toBeDefined();
  });

  it('loadProperty returns cached on second call (no fetch)', async () => {
    fetchMock.mockResolvedValue({ success: true, data: sampleBundle() });
    const { loadProperty } = useRealEstateHotspots({ apt: sampleBundle() });

    await loadProperty('villa');
    await loadProperty('villa');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/composables/useRealEstateHotspots.test.ts
```

기대: FAIL — composable 미정의.

- [ ] **Step 3: composable 작성**

```ts
// frontend/composables/useRealEstateHotspots.ts
import { ref } from 'vue';
import type { RealEstateHotspots, PropertyHotspots } from './useHomeDashboard';

type ApiEnvelope = { success: boolean; data: PropertyHotspots };
type PropertyType = 'apt' | 'villa' | 'offitel';

export function useRealEstateHotspots(initial: RealEstateHotspots) {
  const data = ref<RealEstateHotspots>({ ...initial });

  async function loadProperty(propertyType: PropertyType): Promise<void> {
    if (data.value[propertyType]) return;
    const config = useRuntimeConfig();
    const res = await $fetch<ApiEnvelope>(
      `${config.public.apiBase}/api/meta/hotspots`,
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

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/composables/useRealEstateHotspots.test.ts
```

기대: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add composables/useRealEstateHotspots.ts tests/composables/useRealEstateHotspots.test.ts
git commit -m "feat(frontend): add useRealEstateHotspots lazy fetch composable"
```

---

## Phase E: 프론트엔드 컴포넌트 (atomic units)

### Task 10: `HotspotRow.vue` — 한 행 컴포넌트

**Files:**
- Create: `frontend/components/home/hotspot/HotspotRow.vue`
- Create: `frontend/tests/components/home/hotspot/HotspotRow.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/home/hotspot/HotspotRow.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotRow from '~/components/home/hotspot/HotspotRow.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';

const baseRegion = (): HotspotRegion => ({
  citySlug: 'seoul', city: '서울특별시',
  districtSlug: 'gangnam-gu', district: '강남구',
  pricePerPyeong: 8420, txnCount: 312,
  changePct: 4.2, volumeChangePct: 22,
});

describe('HotspotRow', () => {
  it('renders city + district + price + txnCount', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'rising', href: '/x' },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    expect(wrapper.text()).toContain('서울 강남구');
    expect(wrapper.text()).toContain('8,420');
    expect(wrapper.text()).toContain('312');
  });

  it('rising signal shows changePct in red with + sign', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'rising', href: '/x' },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    const html = wrapper.html();
    expect(html).toMatch(/text-red-500/);
    expect(wrapper.text()).toContain('+4.2%');
  });

  it('falling signal shows changePct in blue with − sign', () => {
    const region = { ...baseRegion(), changePct: -2.4 };
    const wrapper = mount(HotspotRow, {
      props: { region, rank: 1, signal: 'falling', href: '/x' },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    expect(wrapper.html()).toMatch(/text-blue-500/);
    expect(wrapper.text()).toContain('−2.4%');
  });

  it('active signal shows volumeChangePct in violet with + sign', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'active', href: '/x' },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    expect(wrapper.html()).toMatch(/text-violet-600/);
    expect(wrapper.text()).toContain('+22%');
  });

  it('월세 행 (pricePerPyeong null) 은 평당가 슬롯 미표시', () => {
    const region = { ...baseRegion(), pricePerPyeong: null, changePct: null };
    const wrapper = mount(HotspotRow, {
      props: { region, rank: 1, signal: 'active', href: '/x' },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    expect(wrapper.text()).not.toMatch(/평당/);
    expect(wrapper.text()).toContain('312');
  });

  it('href prop is applied to link', () => {
    const wrapper = mount(HotspotRow, {
      props: { region: baseRegion(), rank: 1, signal: 'rising',
        href: '/real-estate/apt-sale?city=seoul&district=gangnam-gu' },
      global: { stubs: { HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] } } },
    });
    expect(wrapper.find('a').attributes('href')).toBe('/real-estate/apt-sale?city=seoul&district=gangnam-gu');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/hotspot/HotspotRow.test.ts
```

기대: FAIL — 컴포넌트 없음.

- [ ] **Step 3: 컴포넌트 작성**

```vue
<!-- frontend/components/home/hotspot/HotspotRow.vue -->
<template>
  <HardLink :to="href" :class="rowClass">
    <span class="w-5 text-[12px] font-bold text-slate-400">{{ rank }}</span>
    <div class="flex-1 min-w-0">
      <div class="text-sm font-bold text-slate-900 truncate">{{ cityShort }} {{ region.district }}</div>
      <div class="text-[11px] text-slate-500">
        <template v-if="region.pricePerPyeong !== null">평당 {{ formatPyeong(region.pricePerPyeong) }} · </template>
        {{ region.txnCount.toLocaleString('ko-KR') }}건
      </div>
    </div>
    <span :class="['text-sm font-bold', changeColorClass]">{{ changeLabel }}</span>
  </HardLink>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';

type Signal = 'rising' | 'falling' | 'active';

const props = defineProps<{
  region: HotspotRegion;
  rank: number;
  signal: Signal;
  href: string;
}>();

const SIGNAL_HOVER: Record<Signal, string> = {
  rising:  'hover:bg-red-50/40',
  falling: 'hover:bg-blue-50/40',
  active:  'hover:bg-violet-50/40',
};

const SIGNAL_COLOR: Record<Signal, string> = {
  rising:  'text-red-500',
  falling: 'text-blue-500',
  active:  'text-violet-600',
};

const rowClass = computed(() =>
  `flex items-center gap-3 px-3 py-2.5 rounded-lg transition ${SIGNAL_HOVER[props.signal]}`,
);

const changeColorClass = computed(() => SIGNAL_COLOR[props.signal]);

const cityShort = computed(() => props.region.city.replace(/특별시|광역시|특별자치시|특별자치도|도$/u, ''));

const changeLabel = computed(() => {
  const value = props.signal === 'active' ? props.region.volumeChangePct : props.region.changePct;
  if (value === null) return '—';
  const sign = value > 0 ? '+' : (value < 0 ? '−' : '');
  const abs = Math.abs(value);
  return `${sign}${abs.toFixed(1)}%`;
});

function formatPyeong(value: number): string {
  return `${Math.round(value).toLocaleString('ko-KR')}만`;
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/hotspot/HotspotRow.test.ts
```

기대: PASS (6 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add components/home/hotspot/HotspotRow.vue tests/components/home/hotspot/HotspotRow.test.ts
git commit -m "feat(frontend): add HotspotRow component"
```

---

### Task 11: `TxnTypeMiniTabs.vue` — 매매/전세/월세 미니 탭

**Files:**
- Create: `frontend/components/home/hotspot/TxnTypeMiniTabs.vue`
- Create: `frontend/tests/components/home/hotspot/TxnTypeMiniTabs.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/home/hotspot/TxnTypeMiniTabs.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import TxnTypeMiniTabs from '~/components/home/hotspot/TxnTypeMiniTabs.vue';

describe('TxnTypeMiniTabs', () => {
  it('renders 3 tabs: 매매/전세/월세', () => {
    const wrapper = mount(TxnTypeMiniTabs, { props: { modelValue: 'sale' } });
    expect(wrapper.text()).toContain('매매');
    expect(wrapper.text()).toContain('전세');
    expect(wrapper.text()).toContain('월세');
  });

  it('active tab gets distinct styling', () => {
    const wrapper = mount(TxnTypeMiniTabs, { props: { modelValue: 'jeonse' } });
    const buttons = wrapper.findAll('button');
    const jeonseBtn = buttons.find((b) => b.text().includes('전세'))!;
    expect(jeonseBtn.classes()).toContain('bg-slate-900');
  });

  it('clicking emits update:modelValue with new key', async () => {
    const wrapper = mount(TxnTypeMiniTabs, { props: { modelValue: 'sale' } });
    const wolseBtn = wrapper.findAll('button').find((b) => b.text().includes('월세'))!;
    await wolseBtn.trigger('click');
    expect(wrapper.emitted('update:modelValue')).toEqual([['wolse']]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/hotspot/TxnTypeMiniTabs.test.ts
```

기대: FAIL.

- [ ] **Step 3: 컴포넌트 작성**

```vue
<!-- frontend/components/home/hotspot/TxnTypeMiniTabs.vue -->
<template>
  <div class="flex items-center gap-1 text-[11px] font-bold">
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      :class="[
        'px-2 py-0.5 rounded-full transition',
        modelValue === opt.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100',
      ]"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type TxnKey = 'sale' | 'jeonse' | 'wolse';

defineProps<{ modelValue: TxnKey }>();
defineEmits<{ (e: 'update:modelValue', value: TxnKey): void }>();

const OPTIONS: { value: TxnKey; label: string }[] = [
  { value: 'sale', label: '매매' },
  { value: 'jeonse', label: '전세' },
  { value: 'wolse', label: '월세' },
];
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/hotspot/TxnTypeMiniTabs.test.ts
```

기대: PASS (3 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add components/home/hotspot/TxnTypeMiniTabs.vue tests/components/home/hotspot/TxnTypeMiniTabs.test.ts
git commit -m "feat(frontend): add TxnTypeMiniTabs component"
```

---

### Task 12: `HotspotCard.vue` — 한 시그널 카드 (3 variant: rising/falling/active)

**Files:**
- Create: `frontend/components/home/hotspot/HotspotCard.vue`
- Create: `frontend/tests/components/home/hotspot/HotspotCard.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/home/hotspot/HotspotCard.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import HotspotCard from '~/components/home/hotspot/HotspotCard.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';

const mockRegions = (count: number): HotspotRegion[] =>
  Array.from({ length: count }, (_, i) => ({
    citySlug: 'seoul', city: '서울특별시',
    districtSlug: `dist-${i}`, district: `구${i}`,
    pricePerPyeong: 5000 + i * 100, txnCount: 100 + i,
    changePct: 2 + i * 0.1, volumeChangePct: 10 + i,
  }));

const stubs = {
  HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  HotspotRow: {
    template: '<li class="row"><slot /></li>',
    props: ['region', 'rank', 'signal', 'href'],
  },
};

describe('HotspotCard', () => {
  it('rising variant renders title + icon + rows', () => {
    const wrapper = mount(HotspotCard, {
      props: { signal: 'rising', regions: mockRegions(3), propertyType: 'apt', txnType: 'sale' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('평당가 상승');
    expect(wrapper.findAll('.row')).toHaveLength(3);
  });

  it('renders empty state when regions is []', () => {
    const wrapper = mount(HotspotCard, {
      props: { signal: 'rising', regions: [], propertyType: 'apt', txnType: 'sale' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('유의미한 변동이 없어요');
  });

  it('active variant for wolse shows special caption', () => {
    const wrapper = mount(HotspotCard, {
      props: { signal: 'active', regions: mockRegions(2), propertyType: 'apt', txnType: 'wolse' },
      global: { stubs },
    });
    expect(wrapper.text()).toContain('월세는 거래량 시그널만 제공해요');
  });

  it('computes correct href per row using RealEstateType slug', () => {
    const wrapper = mount(HotspotCard, {
      props: {
        signal: 'rising',
        regions: [{
          citySlug: 'seoul', city: '서울특별시',
          districtSlug: 'gangnam-gu', district: '강남구',
          pricePerPyeong: 5000, txnCount: 100,
          changePct: 5, volumeChangePct: 10,
        }],
        propertyType: 'apt',
        txnType: 'sale',
      },
      global: { stubs },
    });
    const row = wrapper.findComponent({ name: 'HotspotRow' });
    expect(row.props('href')).toBe('/real-estate/apt-sale?city=seoul&district=gangnam-gu');
  });

  it('jeonse appends rentType=전세 to href', () => {
    const wrapper = mount(HotspotCard, {
      props: {
        signal: 'rising',
        regions: [{
          citySlug: 'seoul', city: '서울특별시',
          districtSlug: 'gangnam-gu', district: '강남구',
          pricePerPyeong: 3000, txnCount: 100,
          changePct: 5, volumeChangePct: 10,
        }],
        propertyType: 'offitel',
        txnType: 'jeonse',
      },
      global: { stubs },
    });
    const row = wrapper.findComponent({ name: 'HotspotRow' });
    expect(row.props('href')).toBe('/real-estate/offitel-rent?city=seoul&district=gangnam-gu&rentType=%EC%A0%84%EC%84%B8');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/hotspot/HotspotCard.test.ts
```

기대: FAIL.

- [ ] **Step 3: 컴포넌트 작성**

```vue
<!-- frontend/components/home/hotspot/HotspotCard.vue -->
<template>
  <div class="bg-white p-5">
    <div class="flex items-center gap-2 mb-4">
      <span :class="['w-7 h-7 rounded-full inline-flex items-center justify-center', iconBg]">
        <span :class="['material-symbols-outlined text-[18px]', iconColor]">{{ iconName }}</span>
      </span>
      <strong class="text-sm font-bold text-slate-900">{{ title }}</strong>
      <span class="ml-auto text-[11px] text-slate-400">{{ caption }}</span>
    </div>
    <p v-if="isWolse && signal === 'active'" class="text-[11px] text-slate-500 mb-3">
      월세는 거래량 시그널만 제공해요
    </p>
    <ol v-if="regions.length > 0" class="divide-y divide-slate-100">
      <li v-for="(region, idx) in regions" :key="`${region.citySlug}-${region.districtSlug}`">
        <HotspotRow
          :region="region"
          :rank="idx + 1"
          :signal="signal"
          :href="buildHref(region)"
        />
      </li>
    </ol>
    <p v-else class="text-sm text-slate-500 py-4 text-center">이번 주는 유의미한 변동이 없어요</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import HotspotRow from './HotspotRow.vue';
import type { HotspotRegion } from '~/composables/useHomeDashboard';
import { toApiSlug } from '~/types/realEstate';
import type { RealEstatePropertyType } from '~/types/realEstate';

type Signal = 'rising' | 'falling' | 'active';
type TxnKey = 'sale' | 'jeonse' | 'wolse';

const props = defineProps<{
  signal: Signal;
  regions: HotspotRegion[];
  propertyType: RealEstatePropertyType;
  txnType: TxnKey;
}>();

const SIGNAL_META: Record<Signal, { title: string; icon: string; iconBg: string; iconColor: string; caption: string }> = {
  rising:  { title: '평당가 상승 TOP', icon: 'local_fire_department', iconBg: 'bg-red-50', iconColor: 'text-red-500', caption: 'vs 전주' },
  falling: { title: '평당가 하락 TOP', icon: 'trending_down', iconBg: 'bg-blue-50', iconColor: 'text-blue-500', caption: 'vs 전주' },
  active:  { title: '거래 급증 지역', icon: 'bolt', iconBg: 'bg-violet-50', iconColor: 'text-violet-600', caption: '거래량 변동' },
};

const title = computed(() => SIGNAL_META[props.signal].title);
const iconName = computed(() => SIGNAL_META[props.signal].icon);
const iconBg = computed(() => SIGNAL_META[props.signal].iconBg);
const iconColor = computed(() => SIGNAL_META[props.signal].iconColor);
const caption = computed(() => SIGNAL_META[props.signal].caption);
const isWolse = computed(() => props.txnType === 'wolse');

function buildHref(region: HotspotRegion): string {
  const mode: 'sale' | 'rent' = props.txnType === 'sale' ? 'sale' : 'rent';
  const slug = toApiSlug(props.propertyType, mode);
  const params = new URLSearchParams();
  params.set('city', region.citySlug);
  params.set('district', region.districtSlug);
  if (props.txnType === 'jeonse') params.set('rentType', '전세');
  if (props.txnType === 'wolse') params.set('rentType', '월세');
  return `/real-estate/${slug}?${params.toString()}`;
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/hotspot/HotspotCard.test.ts
```

기대: PASS (5 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add components/home/hotspot/HotspotCard.vue tests/components/home/hotspot/HotspotCard.test.ts
git commit -m "feat(frontend): add HotspotCard component (rising/falling/active variants)"
```

---

### Task 13: `HomeHotspotSignals.vue` — orchestrator

**Files:**
- Create: `frontend/components/home/HomeHotspotSignals.vue`
- Create: `frontend/tests/components/home/HomeHotspotSignals.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```ts
// frontend/tests/components/home/HomeHotspotSignals.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue';
import type { RealEstateHotspots, PropertyHotspots, HotspotRegion } from '~/composables/useHomeDashboard';

const fetchMock = vi.fn();
vi.stubGlobal('$fetch', fetchMock);
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }));

const sampleRegion = (district: string): HotspotRegion => ({
  citySlug: 'seoul', city: '서울특별시',
  districtSlug: `${district}-slug`, district,
  pricePerPyeong: 5000, txnCount: 100,
  changePct: 3, volumeChangePct: 20,
});

const fullBundle = (): PropertyHotspots => ({
  sale:   { rising: [sampleRegion('강남구'), sampleRegion('성동구')], falling: [sampleRegion('도봉구')], active: [sampleRegion('송파구')] },
  jeonse: { rising: [], falling: [], active: [] },
  wolse:  { active: [sampleRegion('영등포구')] },
});

beforeEach(() => {
  fetchMock.mockReset();
});

describe('HomeHotspotSignals', () => {
  it('renders nothing if hotspots is empty (apt undefined)', () => {
    const wrapper = mount(HomeHotspotSignals, { props: { hotspots: {} as RealEstateHotspots } });
    expect(wrapper.html()).toBe('<!--v-if-->');
  });

  it('default state: apt + sale → renders 3 signal cards', () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    expect(wrapper.text()).toContain('평당가 상승');
    expect(wrapper.text()).toContain('평당가 하락');
    expect(wrapper.text()).toContain('거래 급증');
    expect(wrapper.text()).toContain('강남구');
  });

  it('property toggle to villa triggers fetch', async () => {
    fetchMock.mockResolvedValue({ success: true, data: fullBundle() });
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    const villaBtn = wrapper.findAll('button').find((b) => b.text().includes('빌라'))!;
    await villaBtn.trigger('click');
    await flushPromises();
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/meta/hotspots',
      { query: { propertyType: 'villa' } },
    );
  });

  it('wolse tab hides rising/falling cards, shows only active', async () => {
    const wrapper = mount(HomeHotspotSignals, {
      props: { hotspots: { apt: fullBundle() } },
    });
    // 카드 안의 TxnTypeMiniTabs 의 월세 버튼 클릭
    const wolseBtns = wrapper.findAll('button').filter((b) => b.text().trim() === '월세');
    expect(wolseBtns.length).toBeGreaterThan(0);
    await wolseBtns[0].trigger('click');

    expect(wrapper.text()).not.toContain('평당가 상승');
    expect(wrapper.text()).not.toContain('평당가 하락');
    expect(wrapper.text()).toContain('거래 급증');
    expect(wrapper.text()).toContain('영등포구');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/HomeHotspotSignals.test.ts
```

기대: FAIL.

- [ ] **Step 3: 컴포넌트 작성**

```vue
<!-- frontend/components/home/HomeHotspotSignals.vue -->
<template>
  <section
    v-if="currentBundle"
    class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6"
  >
    <div class="bg-white rounded-3xl border border-line shadow-card overflow-hidden">
      <!-- 헤더 -->
      <div class="px-6 pt-6 pb-4 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]">trending_up</span>
            오늘의 부동산 시장
          </h2>
          <p class="text-sm text-slate-500 mt-1">최근 7일 실거래 · 전주 대비 변동이 가장 큰 지역</p>
        </div>
        <HardLink to="/real-estate" class="inline-flex items-center text-sm text-primary font-bold hover:underline whitespace-nowrap">
          전체 보기 →
        </HardLink>
      </div>

      <!-- 건물유형 토글 + 거래 미니탭 -->
      <div class="px-6 pb-4 flex items-center gap-3 flex-wrap">
        <div class="inline-flex bg-slate-100 rounded-full p-1 text-sm font-bold">
          <button
            v-for="opt in PROPERTY_OPTIONS"
            :key="opt.value"
            :class="[
              'px-4 py-1.5 rounded-full transition',
              propertyType === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700',
            ]"
            @click="onPropertyChange(opt.value)"
          >{{ opt.label }}</button>
        </div>
        <TxnTypeMiniTabs v-model="txnType" />
        <span class="ml-auto text-[11px] text-slate-400">자치구 단위 · 표본 30건 이상</span>
      </div>

      <!-- 모바일 시그널 탭 (lg: 이상에서 hidden) -->
      <div v-if="txnType !== 'wolse'" class="px-6 pb-2 lg:hidden">
        <div class="flex gap-1 text-[12px] font-bold border-b border-slate-100">
          <button
            v-for="opt in SIGNAL_OPTIONS"
            :key="opt.value"
            :class="[
              'px-2 py-2 border-b-2',
              mobileSignal === opt.value ? `${opt.borderClass} text-slate-900` : 'border-transparent text-slate-500',
            ]"
            @click="mobileSignal = opt.value"
          >{{ opt.label }}</button>
        </div>
      </div>

      <!-- 시그널 카드 그리드 -->
      <div :class="['grid gap-px bg-slate-100 border-t border-slate-100', cardGridCols]">
        <div
          v-if="txnType !== 'wolse'"
          :class="['lg:block', mobileSignal === 'rising' ? '' : 'hidden']"
        >
          <HotspotCard
            signal="rising"
            :regions="currentBundle.rising ?? []"
            :property-type="propertyType"
            :txn-type="txnType"
          />
        </div>
        <div
          v-if="txnType !== 'wolse'"
          :class="['lg:block', mobileSignal === 'falling' ? '' : 'hidden']"
        >
          <HotspotCard
            signal="falling"
            :regions="currentBundle.falling ?? []"
            :property-type="propertyType"
            :txn-type="txnType"
          />
        </div>
        <div :class="['lg:block', mobileSignal === 'active' || txnType === 'wolse' ? '' : 'hidden']">
          <HotspotCard
            signal="active"
            :regions="currentBundle.active ?? []"
            :property-type="propertyType"
            :txn-type="txnType"
          />
        </div>
      </div>

      <!-- 푸터 -->
      <div class="px-6 py-3 bg-slate-50/60 border-t border-slate-100 text-[11px] text-slate-500 flex items-center gap-2">
        <span class="material-symbols-outlined text-[14px] text-slate-400">info</span>
        국토교통부 실거래가 · 최근 7일 vs 직전 7일 · 표본 30건 미만 지역 제외
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import HardLink from '~/components/common/HardLink.vue';
import HotspotCard from './hotspot/HotspotCard.vue';
import TxnTypeMiniTabs from './hotspot/TxnTypeMiniTabs.vue';
import type { RealEstateHotspots } from '~/composables/useHomeDashboard';
import { useRealEstateHotspots } from '~/composables/useRealEstateHotspots';
import type { RealEstatePropertyType } from '~/types/realEstate';

type TxnKey = 'sale' | 'jeonse' | 'wolse';
type Signal = 'rising' | 'falling' | 'active';

const props = defineProps<{ hotspots: RealEstateHotspots }>();

const PROPERTY_OPTIONS: { value: RealEstatePropertyType; label: string }[] = [
  { value: 'apt', label: '아파트' },
  { value: 'offitel', label: '오피스텔' },
  { value: 'villa', label: '빌라' },
];

const SIGNAL_OPTIONS: { value: Signal; label: string; borderClass: string }[] = [
  { value: 'active',  label: '거래 급증', borderClass: 'border-violet-500' },
  { value: 'rising',  label: '상승',      borderClass: 'border-red-500' },
  { value: 'falling', label: '하락',      borderClass: 'border-blue-500' },
];

const propertyType = ref<RealEstatePropertyType>('apt');
const txnType = ref<TxnKey>('sale');
const mobileSignal = ref<Signal>('active');

const { data, loadProperty } = useRealEstateHotspots(props.hotspots);

async function onPropertyChange(next: RealEstatePropertyType): Promise<void> {
  propertyType.value = next;
  if (!import.meta.client) return;
  try {
    await loadProperty(next);
  } catch {
    // 토스트는 별도 컴포저블이 있다면 사용. 1차는 silent fail (이전 데이터 유지)
  }
}

const currentBundle = computed(() => {
  const property = data.value[propertyType.value];
  if (!property) return null;
  return txnType.value === 'wolse'
    ? { rising: [], falling: [], active: property.wolse.active }
    : property[txnType.value];
});

const cardGridCols = computed(() => (txnType.value === 'wolse' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'));
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vitest run tests/components/home/HomeHotspotSignals.test.ts
```

기대: PASS (4 tests).

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add components/home/HomeHotspotSignals.vue tests/components/home/HomeHotspotSignals.test.ts
git commit -m "feat(frontend): add HomeHotspotSignals orchestrator component"
```

---

## Phase F: 메인페이지 통합

### Task 14: `pages/index.vue` 에서 `HomeMarketStats` → `HomeHotspotSignals` 교체

**Files:**
- Modify: `frontend/pages/index.vue`

- [ ] **Step 1: 현재 import + 사용처 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && grep -n "HomeMarketStats" pages/index.vue
```

기대 출력 (확인용):
```
90:    <HomeMarketStats :trends="trends" />
241:import HomeMarketStats from '~/components/home/HomeMarketStats.vue'
```

- [ ] **Step 2: import 교체**

`frontend/pages/index.vue` 의 import 줄(`241` 근처)을 다음으로 교체:

```ts
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue'
```

- [ ] **Step 3: template 교체**

`<HomeMarketStats :trends="trends" />` 줄(`90` 근처)을 다음으로 교체:

```vue
<HomeHotspotSignals :hotspots="hotspots" />
```

- [ ] **Step 4: `hotspots` 데이터 추출**

같은 파일의 `useHomeDashboard()` 사용처 근처에서, 기존에 `trends`를 추출하던 패턴을 따라 `hotspots`를 추가로 추출. 예:

```ts
const trends = computed(() => dashboard.value?.data?.realEstateTrends ?? []);
const hotspots = computed(() => dashboard.value?.data?.realEstateHotspots ?? {});
```

(`trends`는 추후 별도 PR에서 `HomeMarketStats` 제거와 함께 정리)

- [ ] **Step 5: 빌드 + 로컬 확인 + 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npx vue-tsc --noEmit && npm run test
```

기대: 0 type errors, 모든 테스트 통과.

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npm run dev
```

새 터미널에서 `http://localhost:3000` 확인 — 메인페이지에 핫스팟 카드 3장이 보여야 함. 정상 확인 후 dev 서버 종료.

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add pages/index.vue
git commit -m "feat(frontend): swap HomeMarketStats with HomeHotspotSignals on main page"
```

---

## Phase G: 부동산 페이지 쿼리 파라미터 프리셀렉트 (조건부)

### Task 15: `/real-estate/[realEstateType]/index.vue` 가 `?city=&district=&rentType=` 파라미터 지원하는지 확인 + 미지원 시 추가

**Files:**
- Modify (조건부): `frontend/pages/real-estate/[realEstateType]/index.vue`

- [ ] **Step 1: 현재 지원 여부 확인**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && grep -n "useRoute\|route.query\|city.*query\|district.*query\|rentType.*query" pages/real-estate/\[realEstateType\]/index.vue
```

- **이미 지원 중**이면 (route.query에서 city/district/rentType을 읽어 검색에 사용): Step 5(커밋)만 수행하고 다음 task로 진행.
- **미지원**이면 Step 2로 진행.

- [ ] **Step 2: 실패 케이스 수동 검증**

핫스팟 카드의 강남구 행 클릭 → 도착한 페이지 URL `/real-estate/apt-sale?city=seoul&district=gangnam-gu` 에서 검색 결과가 강남구로 필터되지 않음 확인.

- [ ] **Step 3: `useRoute()` 으로 쿼리 읽어 `handleSearch()` 자동 호출**

`pages/real-estate/[realEstateType]/index.vue` 의 `onMounted` 또는 setup 단에 추가:

```ts
import { useRoute } from 'vue-router';
import { CITY_SLUG_TO_SHORT } from '~/constants/cityMapping'; // 정확한 경로는 코드 확인 후 조정

const route = useRoute();
onMounted(() => {
  const citySlug = route.query.city as string | undefined;
  const districtSlug = route.query.district as string | undefined;
  const rentType = route.query.rentType as string | undefined;
  if (citySlug || districtSlug) {
    const city = citySlug ? CITY_SLUG_TO_SHORT[citySlug] ?? '' : '';
    const district = districtSlug ?? '';  // districtSlug → 한글 변환은 별도 매핑 필요 시 조정
    handleSearch({ city, district, buildingName: '' });
  }
  // rentType은 검색 결과 필터에서 표시 (현 페이지 라우트가 rent 슬러그일 때만 의미)
});
```

(`CITY_SLUG_TO_SHORT` / district slug → 한글 변환은 frontend 코드에 어떻게 존재하는지 확인 후 정확한 import 경로 사용. `composables/useRegion` 같은 헬퍼가 있으면 우선 사용.)

- [ ] **Step 4: 수동 검증**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npm run dev
```

브라우저에서 `http://localhost:3000/real-estate/apt-sale?city=seoul&district=gangnam-gu` 직접 접속 → 강남구 단지가 자동 검색되어 표시되는지 확인.

- [ ] **Step 5: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add pages/real-estate/\[realEstateType\]/index.vue
git commit -m "feat(frontend): support city/district/rentType query params on real-estate type page"
```

(Step 1에서 이미 지원이면 이 커밋은 생략하고 다음 task로.)

---

## Phase H: E2E 테스트

### Task 16: Playwright E2E — 메인페이지 핫스팟 + 행 클릭 이동

**Files:**
- Create: `frontend/tests/e2e/home-hotspot.spec.ts`

- [ ] **Step 1: E2E 테스트 작성**

```ts
// frontend/tests/e2e/home-hotspot.spec.ts
import { test, expect } from '@playwright/test';

test.describe('메인페이지 부동산 핫스팟', () => {
  test('데스크톱: 시그널 카드 3장 동시 렌더', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await expect(page.getByText('오늘의 부동산 시장')).toBeVisible();
    await expect(page.getByText('평당가 상승 TOP')).toBeVisible();
    await expect(page.getByText('평당가 하락 TOP')).toBeVisible();
    await expect(page.getByText('거래 급증 지역')).toBeVisible();
  });

  test('모바일: 시그널 탭 1장만 표시, 탭 전환 작동', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    // 기본 = 거래 급증
    await expect(page.getByText('거래 급증 지역')).toBeVisible();
    // 상승 탭 클릭
    await page.getByRole('button', { name: '상승' }).click();
    await expect(page.getByText('평당가 상승 TOP')).toBeVisible();
  });

  test('행 클릭 시 부동산 페이지로 이동 + 쿼리 파라미터 포함', async ({ page }) => {
    await page.goto('/');
    const firstRow = page.locator('a[href*="/real-estate/apt-sale?city="]').first();
    await expect(firstRow).toBeVisible();
    const href = await firstRow.getAttribute('href');
    expect(href).toMatch(/\/real-estate\/apt-sale\?city=\w+&district=[\w-]+/);
  });

  test('월세 탭 선택 시 평당가 카드 hidden, 거래 급증 1장만', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.getByRole('button', { name: '월세' }).first().click();
    await expect(page.getByText('월세는 거래량 시그널만 제공해요')).toBeVisible();
    await expect(page.getByText('평당가 상승 TOP')).not.toBeVisible();
  });
});
```

- [ ] **Step 2: 실행**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npm run test:e2e -- home-hotspot
```

기대: PASS (4 tests). 실패 시 데이터 미존재(개발 DB) 가능 — 그 경우 실행 환경 확인 또는 `data-testid` 기반으로 변경.

- [ ] **Step 3: 커밋**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && git add tests/e2e/home-hotspot.spec.ts
git commit -m "test(frontend): add e2e for home hotspot signals"
```

---

## Phase I: 최종 검증 + PR

### Task 17: 전체 테스트 통과 + PR 생성

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && nvm use 20 && npm run test
```

기대: 0 failures. 기존 `getRealEstateTrends` 테스트도 깨지지 않아야 함.

- [ ] **Step 2: 프론트엔드 전체 테스트**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/frontend && nvm use 20 && npm run test
```

기대: 0 failures. 기존 `HomeMarketStats.test.ts`는 컴포넌트가 메인페이지에서 빠졌지만 컴포넌트 자체는 남아있어 통과해야 함.

- [ ] **Step 3: 백엔드/프론트엔드 lint**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npm run lint
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npm run lint
```

기대: 0 errors.

- [ ] **Step 4: 브랜치 push + PR 생성**

```bash
cd /Users/leemyeongseok/projects/ilsangkit && git push -u origin HEAD
gh pr create --title "feat: 메인페이지 부동산 핫스팟 디스커버리 (변형 1, 옵션 B)" --body "$(cat <<'EOF'
## Summary
메인페이지 "오늘의 부동산 시장" 섹션을 전국 평균 매트릭스에서 시·군·구 단위 핫스팟(평당가 상승/하락 + 거래 급증) 디스커버리 카드로 교체.

Spec: docs/superpowers/specs/2026-05-20-real-estate-hotspot-design.md
Plan: docs/superpowers/plans/2026-05-20-real-estate-hotspot.md

## 주요 변경
- 신규 백엔드 서비스 `getPropertyHotspots(propertyType)` + 1시간 LRU 캐시
- 신규 `GET /api/meta/hotspots?propertyType=` 엔드포인트
- `/api/meta/home-dashboard` 응답에 `realEstateHotspots.apt` 추가
- 신규 `HomeHotspotSignals.vue` 컴포넌트로 `HomeMarketStats` 교체
- 월세는 거래 급증 1카드만 (평당가 산식 미적용)
- `/real-estate/[realEstateType]` 페이지 city/district/rentType 쿼리 파라미터 지원 (조건부)

## 롤아웃
- 기존 `HomeMarketStats.vue` / `getRealEstateTrends()` 는 안정성 위해 유지. 1주 모니터링 후 별도 PR로 제거.

## 검증
- [x] 백엔드 vitest 통과
- [x] 프론트엔드 vitest 통과
- [x] Playwright E2E 통과
- [x] lint 통과

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## 자가 검증 체크리스트 (구현자가 실행)

PR 머지 전 확인:
- [ ] Spec 12절 미해결 항목 중 "realEstateType 페이지 쿼리 파라미터 지원"이 본 PR에 포함됐는지 (Task 15)
- [ ] `getRealEstateTrends()` 미삭제 (롤아웃 안정성)
- [ ] 빌라/오피스텔 임계값(15건) 실데이터 분포 점검 — 너무 좁으면 별도 이슈로 트래킹
- [ ] 인덱스 마이그레이션 필요한지 점검: `EXPLAIN` 으로 hotspot 쿼리 plan 확인. `(city, district, dealYear, dealMonth, dealDay)` 복합 인덱스 없으면 마이그레이션 추가 task 생성
- [ ] 메인페이지 첫 화면(LCP) 회귀 없는지 — Lighthouse 측정
