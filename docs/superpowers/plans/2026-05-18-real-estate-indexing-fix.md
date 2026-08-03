# 부동산 상세 페이지 색인률 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 부동산 단지 상세 페이지의 noindex 정책 완화 + 인근 단지 cross-property 섹션 + JSON-LD/canonical 보강으로 네이버 색인률을 회복한다.

**Architecture:** 백엔드에 `GET /api/real-estate/nearby` 신규 엔드포인트 추가(같은 bjdCode 행정동 내 3개 propertyType의 단지를 mode/rentType 필터로 조회). 프론트엔드는 noindex 임계값 제거 + canonical 항상 출력 + JSON-LD에 image/offers/mainEntityOfPage 추가. `[buildingName].vue`의 기존 단일 `인근 단지` 섹션을 아파트/빌라/오피스텔 3섹션으로 분할.

**Tech Stack:** Backend: Express 5 + Prisma + Zod (vitest). Frontend: Nuxt 3 + Vue 3 + `useHead`/`useAsyncData` (vitest + Playwright).

**Reference spec:** `docs/superpowers/specs/2026-05-18-real-estate-indexing-fix-design.md`

**Branching:** 모든 작업은 한 feature branch `feat/real-estate-indexing-fix` 위에서 수행. 백엔드 Phase 1 완료 시점에 PR 1, 프론트엔드 Phase 2~4 완료 시점에 PR 2를 만든다. CI 통과 후 머지.

---

## Phase 1: 백엔드 — Nearby 엔드포인트

### Task 1: Nearby 쿼리 zod schema 추가

**Files:**
- Modify: `backend/src/schemas/realEstate.ts`
- Test: `backend/__tests__/schemas/realEstate.test.ts`

- [ ] **Step 1: 실패하는 테스트 추가**

`backend/__tests__/schemas/realEstate.test.ts` 끝에 추가:

```typescript
import { NearbyQuerySchema } from '../../src/schemas/realEstate.js';

describe('NearbyQuerySchema', () => {
  it('필수 필드(bjdCode, mode)가 빠지면 실패한다', () => {
    expect(NearbyQuerySchema.safeParse({}).success).toBe(false);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900' }).success).toBe(false);
    expect(NearbyQuerySchema.safeParse({ mode: 'sale' }).success).toBe(false);
  });

  it('mode는 sale 또는 rent여야 한다', () => {
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'invalid' }).success).toBe(false);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'sale' }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent' }).success).toBe(true);
  });

  it('rentType은 all|jeonse|wolse만 허용하고 기본은 all', () => {
    const parsed = NearbyQuerySchema.parse({ bjdCode: '1111017900', mode: 'rent' });
    expect(parsed.rentType).toBe('all');
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent', rentType: 'jeonse' }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent', rentType: 'wolse' }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'rent', rentType: 'foo' }).success).toBe(false);
  });

  it('limitPerType은 양수, 기본 4', () => {
    const parsed = NearbyQuerySchema.parse({ bjdCode: '1111017900', mode: 'sale' });
    expect(parsed.limitPerType).toBe(4);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'sale', limitPerType: 10 }).success).toBe(true);
    expect(NearbyQuerySchema.safeParse({ bjdCode: '1111017900', mode: 'sale', limitPerType: 0 }).success).toBe(false);
  });

  it('excludeBuildingName은 선택', () => {
    const parsed = NearbyQuerySchema.parse({ bjdCode: '1111017900', mode: 'sale', excludeBuildingName: '래미안' });
    expect(parsed.excludeBuildingName).toBe('래미안');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/schemas/realEstate.test.ts -t "NearbyQuerySchema"`
Expected: FAIL — `NearbyQuerySchema is not exported`

- [ ] **Step 3: 스키마 구현**

`backend/src/schemas/realEstate.ts` 끝에 추가:

```typescript
// 인근 단지 조회 스키마 — /api/real-estate/nearby
export const NearbyQuerySchema = z.object({
  bjdCode: z.string().length(10),
  mode: z.enum(['sale', 'rent']),
  rentType: z.enum(['all', 'jeonse', 'wolse']).default('all'),
  excludeBuildingName: z.string().max(100).optional(),
  limitPerType: z.coerce.number().int().positive().max(20).default(4),
});

export type NearbyQuery = z.infer<typeof NearbyQuerySchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/schemas/realEstate.test.ts -t "NearbyQuerySchema"`
Expected: PASS (모든 케이스)

- [ ] **Step 5: 커밋**

```bash
git add backend/src/schemas/realEstate.ts backend/__tests__/schemas/realEstate.test.ts
git commit -m "feat(real-estate): NearbyQuerySchema 추가"
```

---

### Task 2: `getNearbyByBjd` 서비스 함수 추가

`realEstateBuildingSummary` 테이블을 활용해 같은 bjdCode의 propertyType별 단지 최신 거래를 가져온다. rentType 필터가 있을 때는 raw query로 transaction 테이블을 GROUP BY 한다.

**Files:**
- Modify: `backend/src/services/realEstateService.ts`
- Test: `backend/__tests__/services/realEstateNearby.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/services/realEstateNearby.test.ts` 신규 생성:

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import prisma from '../../src/lib/prisma.js';
import { getNearbyByBjd } from '../../src/services/realEstateService.js';

const TEST_BJD = '1144012700'; // 마포구 한강로동(임의)

async function seedSummary(rows: Array<{ buildingName: string; type: string; latestPrice: number; transactionCount?: number }>) {
  for (const r of rows) {
    await prisma.realEstateBuildingSummary.create({
      data: {
        type: r.type,
        buildingName: r.buildingName,
        bjdCode: TEST_BJD,
        city: '서울특별시',
        district: '마포구',
        dongName: '한강로동',
        transactionCount: r.transactionCount ?? 1,
        latestPrice: r.latestPrice,
        latestDealYear: 2026,
        latestDealMonth: 4,
      },
    });
  }
}

describe('getNearbyByBjd', () => {
  beforeAll(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
  });
  afterAll(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
  });
  beforeEach(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
  });

  it('mode=sale일 때 apt-sale/villa-sale/offitel-sale 3개 키 반환', async () => {
    await seedSummary([
      { buildingName: 'A아파트', type: 'apt-sale', latestPrice: 1_500_000_000 },
      { buildingName: 'B빌라', type: 'villa-sale', latestPrice: 300_000_000 },
      { buildingName: 'C오피스텔', type: 'offitel-sale', latestPrice: 400_000_000 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'sale', {});
    expect(Object.keys(result)).toEqual(['apt', 'villa', 'offitel']);
    expect(result.apt[0].buildingName).toBe('A아파트');
    expect(result.villa[0].buildingName).toBe('B빌라');
    expect(result.offitel[0].buildingName).toBe('C오피스텔');
  });

  it('mode=rent + rentType=all일 때 rent 카테고리 반환', async () => {
    await seedSummary([
      { buildingName: 'A아파트', type: 'apt-rent', latestPrice: 500_000_000 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'rent', { rentType: 'all' });
    expect(result.apt[0].buildingName).toBe('A아파트');
  });

  it('excludeBuildingName으로 자기 자신 제외', async () => {
    await seedSummary([
      { buildingName: '래미안', type: 'apt-sale', latestPrice: 1_000_000_000 },
      { buildingName: '힐스테이트', type: 'apt-sale', latestPrice: 1_200_000_000 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'sale', { excludeBuildingName: '래미안' });
    expect(result.apt.map(c => c.buildingName)).not.toContain('래미안');
    expect(result.apt.map(c => c.buildingName)).toContain('힐스테이트');
  });

  it('limitPerType으로 카테고리별 결과 수 제한', async () => {
    await seedSummary([
      { buildingName: 'A', type: 'apt-sale', latestPrice: 1, transactionCount: 5 },
      { buildingName: 'B', type: 'apt-sale', latestPrice: 1, transactionCount: 4 },
      { buildingName: 'C', type: 'apt-sale', latestPrice: 1, transactionCount: 3 },
    ]);
    const result = await getNearbyByBjd(TEST_BJD, 'sale', { limitPerType: 2 });
    expect(result.apt).toHaveLength(2);
  });

  it('다른 bjdCode 단지는 제외', async () => {
    await seedSummary([
      { buildingName: 'In', type: 'apt-sale', latestPrice: 1 },
    ]);
    await prisma.realEstateBuildingSummary.create({
      data: {
        type: 'apt-sale', buildingName: 'Out', bjdCode: '9999999999',
        city: 'x', district: 'y', dongName: 'z',
        transactionCount: 1, latestPrice: 1, latestDealYear: 2026, latestDealMonth: 1,
      },
    });
    try {
      const result = await getNearbyByBjd(TEST_BJD, 'sale', {});
      expect(result.apt.map(c => c.buildingName)).toEqual(['In']);
    } finally {
      await prisma.realEstateBuildingSummary.deleteMany({ where: { buildingName: 'Out' } });
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateNearby.test.ts`
Expected: FAIL — `getNearbyByBjd is not exported`

- [ ] **Step 3: 서비스 함수 구현**

`backend/src/services/realEstateService.ts`의 `getComplexList` 정의 다음에 추가:

```typescript
// ─────────────────────────────────────────────
// getNearbyByBjd
// ─────────────────────────────────────────────

export type NearbyMode = 'sale' | 'rent';
export type NearbyRentType = 'all' | 'jeonse' | 'wolse';
export type NearbyPropertyKey = 'apt' | 'villa' | 'offitel';

export interface NearbyComplex {
  buildingName: string;
  bjdCode: string;
  city: string;
  district: string;
  dongName: string;
  buildYear: number | null;
  transactionCount: number;
  latestPrice: number | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  lat: number | null;
  lng: number | null;
}

export type NearbyResult = Record<NearbyPropertyKey, NearbyComplex[]>;

interface NearbyOptions {
  rentType?: NearbyRentType;
  excludeBuildingName?: string;
  limitPerType?: number;
}

const PROPERTY_KEYS: NearbyPropertyKey[] = ['apt', 'villa', 'offitel'];

function summaryRowToNearbyComplex(row: {
  buildingName: string; bjdCode: string; city: string; district: string; dongName: string;
  buildYear: number | null; transactionCount: number;
  latestPrice: import('@prisma/client/runtime/library').Decimal | number | null;
  latestDealYear: number | null; latestDealMonth: number | null;
  lat: import('@prisma/client/runtime/library').Decimal | number | null;
  lng: import('@prisma/client/runtime/library').Decimal | number | null;
}): NearbyComplex {
  return {
    buildingName: row.buildingName,
    bjdCode: row.bjdCode,
    city: row.city,
    district: row.district,
    dongName: row.dongName,
    buildYear: row.buildYear,
    transactionCount: row.transactionCount,
    latestPrice: row.latestPrice != null ? Number(row.latestPrice) : null,
    latestDealYear: row.latestDealYear,
    latestDealMonth: row.latestDealMonth,
    lat: row.lat != null ? Number(row.lat) : null,
    lng: row.lng != null ? Number(row.lng) : null,
  };
}

/**
 * 같은 bjdCode 내의 아파트/빌라/오피스텔 단지를 최신 거래 기준으로 가져온다.
 * mode=sale → apt-sale/villa-sale/offitel-sale summary 사용.
 * mode=rent + rentType=all → apt-rent/villa-rent/offitel-rent summary 사용.
 * mode=rent + rentType=jeonse|wolse → transaction 테이블 GROUP BY로 필터.
 */
export async function getNearbyByBjd(
  bjdCode: string,
  mode: NearbyMode,
  opts: NearbyOptions
): Promise<NearbyResult> {
  const rentType: NearbyRentType = opts.rentType ?? 'all';
  const excludeBuildingName = opts.excludeBuildingName ?? null;
  const limitPerType = opts.limitPerType ?? 4;

  const result: NearbyResult = { apt: [], villa: [], offitel: [] };

  const useFilteredRent = mode === 'rent' && rentType !== 'all';

  if (!useFilteredRent) {
    // summary 테이블 활용 — mode + propertyType 조합으로 type 컬럼 매칭
    const suffix = mode === 'sale' ? 'sale' : 'rent';
    const types = PROPERTY_KEYS.map((p) => `${p}-${suffix}`);

    for (let i = 0; i < PROPERTY_KEYS.length; i++) {
      const key = PROPERTY_KEYS[i];
      const where: Record<string, unknown> = { type: types[i], bjdCode };
      if (excludeBuildingName) where.buildingName = { not: excludeBuildingName };

      const rows = await prisma.realEstateBuildingSummary.findMany({
        where,
        orderBy: [
          { latestDealYear: 'desc' },
          { latestDealMonth: 'desc' },
          { transactionCount: 'desc' },
        ],
        take: limitPerType,
      });
      result[key] = rows.map(summaryRowToNearbyComplex);
    }
    return result;
  }

  // rentType 필터(jeonse|wolse) — transaction 테이블 GROUP BY
  // 전세/월세 구분은 rentType 컬럼(전세/월세 한글값)으로 한다.
  const rentTypeKor = rentType === 'jeonse' ? '전세' : '월세';
  const tableByKey: Record<NearbyPropertyKey, string> = {
    apt: 'AptRentTransaction',
    villa: 'VillaRentTransaction',
    offitel: 'OffitelRentTransaction',
  };

  for (const key of PROPERTY_KEYS) {
    const tableName = tableByKey[key];
    const excludeClause = excludeBuildingName
      ? prisma.$queryRawUnsafe.bind(prisma) // see below — use Prisma.sql template instead
      : null;
    // GROUP BY buildingName: 단지별 최신 거래 1건
    // 안전한 파라미터 바인딩을 위해 $queryRaw 태그드 템플릿 사용
    const rows = await prisma.$queryRaw<Array<{
      buildingName: string; bjdCode: string; city: string; district: string; dongName: string;
      buildYear: number | null; transactionCount: bigint;
      latestPrice: number | null;
      latestDealYear: number | null; latestDealMonth: number | null;
      lat: number | null; lng: number | null;
    }>>`
      SELECT
        t.buildingName,
        t.bjdCode,
        ANY_VALUE(t.city) AS city,
        ANY_VALUE(t.district) AS district,
        ANY_VALUE(t.dongName) AS dongName,
        ANY_VALUE(t.buildYear) AS buildYear,
        COUNT(*) AS transactionCount,
        SUBSTRING_INDEX(GROUP_CONCAT(t.deposit ORDER BY t.dealYear DESC, t.dealMonth DESC, t.dealDay DESC), ',', 1) AS latestPrice,
        MAX(t.dealYear) AS latestDealYear,
        MAX(t.dealMonth) AS latestDealMonth,
        ANY_VALUE(t.lat) AS lat,
        ANY_VALUE(t.lng) AS lng
      FROM \`${Prisma.raw(tableName)}\` t
      WHERE t.bjdCode = ${bjdCode}
        AND t.rentType = ${rentTypeKor}
        ${excludeBuildingName ? Prisma.sql`AND t.buildingName != ${excludeBuildingName}` : Prisma.empty}
      GROUP BY t.buildingName, t.bjdCode
      ORDER BY latestDealYear DESC, latestDealMonth DESC, transactionCount DESC
      LIMIT ${limitPerType}
    `;
    result[key] = rows.map((r) => summaryRowToNearbyComplex({
      buildingName: r.buildingName,
      bjdCode: r.bjdCode,
      city: r.city,
      district: r.district,
      dongName: r.dongName,
      buildYear: r.buildYear,
      transactionCount: Number(r.transactionCount),
      latestPrice: r.latestPrice,
      latestDealYear: r.latestDealYear,
      latestDealMonth: r.latestDealMonth,
      lat: r.lat,
      lng: r.lng,
    }));
  }
  return result;
}
```

파일 상단에 `import { Prisma } from '@prisma/client';`가 없다면 추가한다.

> **주의:** 위 raw SQL은 lat/lng 컬럼명, dongName 컬럼명, deposit 컬럼명이 실제 transaction 테이블에 존재한다고 가정한다. 실제 prisma schema의 `AptRentTransaction`/`VillaRentTransaction`/`OffitelRentTransaction` 필드를 `backend/prisma/schema.prisma`에서 확인하고, 컬럼명이 다르면 보정한다. 특히 `lat/lng`가 일부 테이블에만 있을 수 있으니 없는 경우 `NULL AS lat, NULL AS lng`로 대체.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateNearby.test.ts`
Expected: PASS (5개 케이스 모두)

만약 raw SQL 컬럼명 에러가 발생하면, schema.prisma를 확인하고 SQL을 수정한다. all 케이스가 우선 통과하면 다음 작업으로 진행 가능.

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/realEstateService.ts backend/__tests__/services/realEstateNearby.test.ts
git commit -m "feat(real-estate): getNearbyByBjd 서비스 추가"
```

---

### Task 3: `GET /api/real-estate/nearby` 라우트 추가

**Files:**
- Modify: `backend/src/routes/realEstate.ts`
- Test: `backend/__tests__/routes/realEstateNearby.test.ts` (신규)

- [ ] **Step 1: 라우트 테스트 작성**

`backend/__tests__/routes/realEstateNearby.test.ts` 신규 생성:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import prisma from '../../src/lib/prisma.js';

const TEST_BJD = '1144012799';

describe('GET /api/real-estate/nearby', () => {
  beforeAll(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
    await prisma.realEstateBuildingSummary.createMany({
      data: [
        { type: 'apt-sale', buildingName: 'A아파트', bjdCode: TEST_BJD, city: '서울특별시', district: '마포구', dongName: '한강로동', transactionCount: 5, latestPrice: 1_500_000_000, latestDealYear: 2026, latestDealMonth: 4 },
        { type: 'villa-sale', buildingName: 'B빌라', bjdCode: TEST_BJD, city: '서울특별시', district: '마포구', dongName: '한강로동', transactionCount: 2, latestPrice: 300_000_000, latestDealYear: 2026, latestDealMonth: 3 },
      ],
    });
  });
  afterAll(async () => {
    await prisma.realEstateBuildingSummary.deleteMany({ where: { bjdCode: TEST_BJD } });
  });

  it('bjdCode/mode가 없으면 422', async () => {
    const res = await request(app).get('/api/real-estate/nearby');
    expect(res.status).toBe(422);
  });

  it('정상 응답 — 3개 키(apt/villa/offitel) 포함', async () => {
    const res = await request(app)
      .get('/api/real-estate/nearby')
      .query({ bjdCode: TEST_BJD, mode: 'sale' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Object.keys(res.body.data).sort()).toEqual(['apt', 'offitel', 'villa']);
    expect(res.body.data.apt[0].buildingName).toBe('A아파트');
    expect(res.body.data.villa[0].buildingName).toBe('B빌라');
    expect(res.body.data.offitel).toEqual([]);
  });

  it('excludeBuildingName 적용', async () => {
    const res = await request(app)
      .get('/api/real-estate/nearby')
      .query({ bjdCode: TEST_BJD, mode: 'sale', excludeBuildingName: 'A아파트' });
    expect(res.status).toBe(200);
    expect(res.body.data.apt).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/routes/realEstateNearby.test.ts`
Expected: FAIL — 404 또는 라우트 미존재

- [ ] **Step 3: 라우트 구현**

`backend/src/routes/realEstate.ts`에서:

1. import 라인에 추가:
```typescript
import { getNearbyByBjd } from '../services/realEstateService.js';
import { NearbyQuerySchema } from '../schemas/realEstate.js';
```

2. `router.get('/search', ...)` 위에 (다른 `/:type` 라우트와 충돌하지 않게 prefix 라우트 영역에) 추가:

```typescript
// GET /api/real-estate/nearby - 같은 행정동 내 인근 단지 (cross-property)
router.get(
  '/nearby',
  validate(NearbyQuerySchema, 'query'),
  asyncHandler(async (_req: Request, res: Response) => {
    const { bjdCode, mode, rentType, excludeBuildingName, limitPerType } =
      res.locals.validated.query as z.infer<typeof NearbyQuerySchema>;
    const data = await getNearbyByBjd(bjdCode, mode, {
      rentType, excludeBuildingName, limitPerType,
    });
    res.json({ success: true, data });
  })
);
```

`/nearby`는 `/:type/...` 라우트와 충돌하지 않지만 명확성을 위해 `/price-analysis` 라우트 바로 다음, `/search` 위에 배치한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/routes/realEstateNearby.test.ts`
Expected: PASS (3개 케이스)

- [ ] **Step 5: 전체 백엔드 테스트 회귀 확인**

Run: `cd backend && npm run test`
Expected: 모든 테스트 통과

- [ ] **Step 6: 커밋**

```bash
git add backend/src/routes/realEstate.ts backend/__tests__/routes/realEstateNearby.test.ts
git commit -m "feat(real-estate): GET /api/real-estate/nearby 라우트 추가"
```

---

## Phase 2: 프론트엔드 — noindex 정책 + canonical

### Task 4: `shouldNoindexRealEstateDetail`에서 거래 < 10건 조건 제거

**Files:**
- Modify: `frontend/utils/realEstateNoindex.ts`
- Test: `frontend/tests/utils/realEstateNoindex.test.ts` (신규)

- [ ] **Step 1: 테스트 작성**

`frontend/tests/utils/realEstateNoindex.test.ts` 신규:

```typescript
import { describe, it, expect } from 'vitest';
import { shouldNoindexRealEstateDetail } from '~/utils/realEstateNoindex';

describe('shouldNoindexRealEstateDetail', () => {
  it('지번 패턴 buildingName은 noindex', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '123-45',
      loaded: true,
      hasBuildingInfo: true,
    })).toBe(true);
  });

  it('로드 전엔 false(임시) — 첫 paint에서 차단되지 않게', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: false,
      hasBuildingInfo: false,
    })).toBe(false);
  });

  it('로드 완료 후 buildingInfo 없으면 noindex', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: true,
      hasBuildingInfo: false,
    })).toBe(true);
  });

  it('거래 0건이어도 buildingInfo가 있으면 색인(false)', () => {
    expect(shouldNoindexRealEstateDetail({
      buildingName: '래미안',
      loaded: true,
      hasBuildingInfo: true,
    })).toBe(false);
  });
});
```

- [ ] **Step 2: 테스트 실행 → 일부 실패**

Run: `cd frontend && npx vitest run tests/utils/realEstateNoindex.test.ts`
Expected: 마지막 "거래 0건" 케이스가 기존 코드에서는 totalCount 인자 누락 영향으로 동작이 다를 수 있다. 어쨌든 새 인터페이스에 맞추기 위해 다음 스텝으로 진행.

(실제로는 totalCount 필드 자체를 인터페이스에서 제거하므로 입력 객체 시그니처가 바뀐다. 위 테스트는 새 시그니처 기준이라 현재 코드와는 TypeScript 컴파일 단계에서 실패한다.)

- [ ] **Step 3: 구현 변경**

`frontend/utils/realEstateNoindex.ts` 전체를 다음으로 교체:

```typescript
/**
 * 부동산 상세 페이지 noindex 판단 유틸.
 *
 * 두 조건 중 하나라도 참이면 `<meta name="robots" content="noindex, follow">`를 출력해
 * 색인 부적합 URL이 검색엔진에 색인되지 않도록 한다.
 *
 * 1. `buildingName`이 지번 패턴 → 즉시 noindex (SSR 첫 바이트부터 차단)
 * 2. 데이터 로드 완료 && `buildingInfo` 없음 → 존재하지 않는 건물
 *
 * 과거에는 총 거래 < 10건도 noindex했으나, 색인률 회복을 위해 2026-05 폐지.
 * thin content 위험은 인근 단지 cross-property 섹션이 unique value를 제공해 완화한다.
 */

import { INVALID_BUILDING_NAME } from './realEstateBuildingName'

export interface RealEstateNoindexInput {
  buildingName: string
  loaded: boolean
  hasBuildingInfo: boolean
}

export function shouldNoindexRealEstateDetail(input: RealEstateNoindexInput): boolean {
  if (INVALID_BUILDING_NAME.test(input.buildingName)) return true
  if (!input.loaded) return false
  if (!input.hasBuildingInfo) return true
  return false
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/realEstateNoindex.test.ts`
Expected: 4개 케이스 모두 PASS

- [ ] **Step 5: 호출부 수정**

`frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` line ~487:

```vue
// 변경 전
const noindex = computed(() =>
  shouldNoindexRealEstateDetail({
    buildingName: buildingName.value,
    loaded: !statsLoading.value && !txLoading.value,
    hasBuildingInfo: buildingInfo.value !== null,
    totalCount: summary.value?.totalCount,
  }),
)

// 변경 후
const noindex = computed(() =>
  shouldNoindexRealEstateDetail({
    buildingName: buildingName.value,
    loaded: !statsLoading.value && !txLoading.value,
    hasBuildingInfo: buildingInfo.value !== null,
  }),
)
```

- [ ] **Step 6: 타입체크 통과 확인**

Run: `cd frontend && npm run lint`
Expected: 통과 (없으면 type 에러 없음)

- [ ] **Step 7: 커밋**

```bash
git add frontend/utils/realEstateNoindex.ts frontend/tests/utils/realEstateNoindex.test.ts frontend/pages/real-estate
git commit -m "feat(real-estate): noindex에서 거래 < 10건 조건 제거"
```

---

### Task 5: canonical을 noindex일 때도 항상 출력

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- Test: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts` (기존 테스트 갱신/추가)

- [ ] **Step 1: 테스트 추가**

`frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`에 다음 describe 블록 추가(파일 끝):

```typescript
describe('SEO meta: canonical 정책', () => {
  it('noindex 페이지에도 canonical link가 출력된다', async () => {
    // useHead가 호출된 인자를 캡처할 수 있는 mock setup이 필요
    // (기존 테스트에 useHead mock 패턴이 있다면 그것을 재사용)
    // 시나리오: buildingInfo가 null로 noindex가 true인 상태
    // 기대: link 배열에 rel=canonical 엔트리가 존재

    const { mockUseHead, mountPage } = await import('./helpers/buildingDetailHarness') // 신규 헬퍼
    await mountPage({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'mapo-gu', buildingName: '래미안' },
      buildingInfoResponse: null, // noindex 트리거
    })
    const headCalls = mockUseHead.mock.calls.flat().map((arg: unknown) => typeof arg === 'function' ? (arg as () => unknown)() : arg)
    const linksWithCanonical = headCalls.flatMap((h: any) => h?.link ?? []).filter((l: any) => l?.rel === 'canonical')
    expect(linksWithCanonical.length).toBeGreaterThan(0)
  })
})
```

> **주의:** 기존 테스트 파일의 모킹 패턴(`useHead`, `useAsyncData`, `$fetch`)을 확인 후 동일 패턴으로 작성. 헬퍼가 없으면 인라인으로 spy 구성. 헬퍼 파일 생성이 부담이면 인라인 test로 대체 가능.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts -t "noindex 페이지에도 canonical"`
Expected: FAIL — canonical link가 비어 있음

- [ ] **Step 3: 구현 변경**

`[buildingName].vue` line ~545~553 부근의 useHead return을 다음과 같이:

```vue
  // noindex/canonical 정책 2026-05: noindex 여부와 무관하게 canonical은 항상 출력해
  // 백링크 가치가 noindex 페이지에서 새지 않도록 한다. 구글/네이버 모두 noindex+canonical 조합 허용.
  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    link: [{ rel: 'canonical', href: canonicalUrl }],
  }
```

기존 `link: noindex.value ? [] : [{ rel: 'canonical', href: canonicalUrl }]`를 위처럼 무조건 canonical 출력으로 변경.

또한 useHead 팩토리 상단의 noindex/canonical 정책 관련 주석(있다면)도 위 의도에 맞게 갱신.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts -t "noindex 페이지에도 canonical"`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/pages/real-estate frontend/tests/pages/real-estate
git commit -m "feat(real-estate): noindex 페이지에도 canonical 항상 출력"
```

---

## Phase 3: 프론트엔드 — JSON-LD 보강

### Task 6: `setRealEstateListingSchema` / `setBuildingPlaceSchema`에 image/offers/mainEntityOfPage/datePosted 지원

**Files:**
- Modify: `frontend/composables/useStructuredData.ts`
- Test: `frontend/tests/composables/useStructuredData.test.ts` (신규 또는 기존 갱신)

- [ ] **Step 1: 테스트 작성**

`frontend/tests/composables/useStructuredData.test.ts` 신규 생성 (없는 경우):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

// useHead mock — 마지막에 전달된 script 인자를 캡처
const headSpy = vi.fn()
;(globalThis as any).useHead = headSpy

import { useStructuredData } from '~/composables/useStructuredData'

function lastJsonLd(key: string): Record<string, unknown> {
  // useHead가 함수형(reactive) getter로 등록될 수 있으므로 한 번 실행해서 결과를 얻음
  const calls = headSpy.mock.calls
  for (let i = calls.length - 1; i >= 0; i--) {
    const arg = typeof calls[i][0] === 'function' ? calls[i][0]() : calls[i][0]
    const script = (arg?.script ?? []) as Array<{ key?: string; innerHTML?: string }>
    const hit = script.find((s) => s.key === key)
    if (hit?.innerHTML) return JSON.parse(hit.innerHTML)
  }
  throw new Error(`no ${key} script captured`)
}

describe('setRealEstateListingSchema', () => {
  beforeEach(() => headSpy.mockClear())

  it('image 옵션 전달 시 schema.image 출력', () => {
    const { setRealEstateListingSchema } = useStructuredData()
    setRealEstateListingSchema({
      name: '래미안',
      address: '서울 마포구 한강로 1',
      city: '서울특별시',
      district: '마포구',
      propertyType: '아파트',
      url: 'https://ilsangkit.co.kr/real-estate/apt-sale/seoul/mapo-gu/래미안',
      image: 'https://ilsangkit.co.kr/og?title=래미안',
    })
    const schema = lastJsonLd('jsonld-realestate-listing')
    expect(schema.image).toBe('https://ilsangkit.co.kr/og?title=래미안')
    expect(schema.mainEntityOfPage).toBe('https://ilsangkit.co.kr/real-estate/apt-sale/seoul/mapo-gu/래미안')
  })

  it('recentAvg 전달 시 offers(price, priceCurrency, availability) 출력', () => {
    const { setRealEstateListingSchema } = useStructuredData()
    setRealEstateListingSchema({
      name: '래미안', address: '서울 마포구', city: '서울특별시', district: '마포구',
      propertyType: '아파트', url: 'https://ilsangkit.co.kr/x',
      recentAvg: 1_500_000_000,
    })
    const schema = lastJsonLd('jsonld-realestate-listing')
    expect(schema.offers).toEqual({
      '@type': 'Offer',
      price: 1_500_000_000,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
    })
  })

  it('latestDealDate 전달 시 datePosted 출력', () => {
    const { setRealEstateListingSchema } = useStructuredData()
    setRealEstateListingSchema({
      name: '래미안', address: '서울 마포구', city: '서울특별시', district: '마포구',
      propertyType: '아파트', url: 'https://ilsangkit.co.kr/x',
      latestDealDate: '2026-04-01',
    })
    const schema = lastJsonLd('jsonld-realestate-listing')
    expect(schema.datePosted).toBe('2026-04-01')
  })

  it('mainEntityOfPage는 항상 url과 동일하게 출력', () => {
    const { setRealEstateListingSchema } = useStructuredData()
    setRealEstateListingSchema({
      name: '래미안', address: '서울 마포구', city: '서울특별시', district: '마포구',
      propertyType: '아파트', url: 'https://ilsangkit.co.kr/x',
    })
    const schema = lastJsonLd('jsonld-realestate-listing')
    expect(schema.mainEntityOfPage).toBe('https://ilsangkit.co.kr/x')
  })
})

describe('setBuildingPlaceSchema', () => {
  beforeEach(() => headSpy.mockClear())

  it('image 옵션 전달 시 schema.image 출력', () => {
    const { setBuildingPlaceSchema } = useStructuredData()
    setBuildingPlaceSchema({
      name: '래미안', address: '서울 마포구',
      propertyType: '아파트', propertySlug: 'apt',
      image: 'https://ilsangkit.co.kr/og?title=래미안',
    })
    const schema = lastJsonLd('jsonld-building')
    expect(schema.image).toBe('https://ilsangkit.co.kr/og?title=래미안')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useStructuredData.test.ts`
Expected: FAIL — 새 필드 미반영

- [ ] **Step 3: 구현 변경**

`frontend/composables/useStructuredData.ts`:

(1) `RealEstateListingOptions` 타입(line ~403)에 필드 추가:

```typescript
type RealEstateListingOptions = {
  name: string
  address: string
  city: string
  district: string
  propertyType: string
  url: string
  buildYear?: number | null
  totalCount?: number
  lat?: number | null
  lng?: number | null
  image?: string
  recentAvg?: number
  latestDealDate?: string
}
```

(2) `setRealEstateListingSchema` 내부의 schema 객체 빌드 (line ~422~447) 다음 필드 출력 추가 (schema 생성 직후 geo 처리 부분 근처에):

```typescript
  schema.mainEntityOfPage = options.url
  if (options.image) schema.image = options.image
  if (options.recentAvg != null) {
    schema.offers = {
      '@type': 'Offer',
      price: options.recentAvg,
      priceCurrency: 'KRW',
      availability: 'https://schema.org/InStock',
    }
  }
  if (options.latestDealDate) {
    schema.datePosted = options.latestDealDate
  }
```

(3) `BuildingPlaceOptions` 타입(line ~329)에 `image?: string` 추가.

(4) `setBuildingPlaceSchema` 내부의 schema 객체 빌드 (line ~352) 다음에 추가:

```typescript
      if (options.image) schema.image = options.image
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useStructuredData.test.ts`
Expected: PASS (모든 케이스)

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useStructuredData.ts frontend/tests/composables/useStructuredData.test.ts
git commit -m "feat(seo): RealEstateListing/Building JSON-LD에 image·offers·mainEntityOfPage·datePosted 추가"
```

---

### Task 7: `[buildingName].vue`에서 새 JSON-LD 필드 전달

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`

- [ ] **Step 1: 호출부 변경**

line ~1040~1067의 `setBuildingPlaceSchema`와 `setRealEstateListingSchema` 호출에 다음 필드를 함께 전달:

`setBuildingPlaceSchema` 콜백 안에서 ogImage를 계산할 수 있도록 컴포넌트 상단 `useHead` 팩토리에서 만든 ogImage 식을 재사용하거나, 동일 식을 helper로 추출한다.

설계상 helper로 추출:

```vue
// useHead 팩토리 위쪽 적당한 위치에 추가
function buildOgImage(info: BuildingInfo | null): string {
  if (!info) return DEFAULT_OG_IMAGE
  const hasCoords = !!(info.lat && info.lng)
  if (hasCoords) {
    return `${SITE_URL}/og-map?lat=${info.lat}&lng=${info.lng}&label=${encodeURIComponent(buildingName.value)}&category=${propertyTypeParam}&title=${encodeURIComponent(buildingName.value)}&city=${encodeURIComponent(info.city || '')}&district=${encodeURIComponent(info.district || '')}`
  }
  return `${SITE_URL}/og?category=${propertyTypeParam}&title=${encodeURIComponent(buildingName.value)}&city=${encodeURIComponent(info.city || '')}&district=${encodeURIComponent(info.district || '')}`
}
```

그 뒤 `useHead` 팩토리 내 `const ogImage = ...` 부분을 `const ogImage = buildOgImage(buildingInfo.value)`로 교체.

`setBuildingPlaceSchema` 호출 (line ~1040):

```vue
setBuildingPlaceSchema(() => ({
  name: buildingName.value,
  address: fullAddress.value !== '-' ? fullAddress.value : `${cityName} ${districtName}`,
  city: buildingInfo.value?.city || cityName,
  district: buildingInfo.value?.district || districtName,
  lat: buildingInfo.value?.lat ?? null,
  lng: buildingInfo.value?.lng ?? null,
  buildYear: buildingInfo.value?.buildYear,
  propertyType: propertyMeta.value?.label || '',
  propertySlug: propertyTypePart as 'apt' | 'villa' | 'offitel',
  image: buildOgImage(buildingInfo.value),
}))
```

`setRealEstateListingSchema` 호출 (line ~1051):

```vue
setRealEstateListingSchema(() => {
  const info = buildingInfo.value
  const latestDealDate = info?.latestDealYear && info?.latestDealMonth
    ? `${info.latestDealYear}-${String(info.latestDealMonth).padStart(2, '0')}-01`
    : undefined
  return {
    name: buildingName.value,
    address: fullAddress.value !== '-' ? fullAddress.value : `${cityName} ${districtName}`,
    city: info?.city || cityName,
    district: info?.district || districtName,
    propertyType: propertyMeta.value?.label || '',
    url: `${SITE_URL}${toRealEstateUrl({
      type: realEstateType,
      city: cityName,
      district: districtName,
      buildingName: buildingName.value,
    })}`,
    buildYear: info?.buildYear,
    totalCount: summary.value?.totalCount,
    lat: info?.lat ?? null,
    lng: info?.lng ?? null,
    image: buildOgImage(info),
    recentAvg: summary.value?.recentAvg ?? undefined,
    latestDealDate,
  }
})
```

- [ ] **Step 2: 수동 확인**

Run: `cd frontend && npm run dev` (백엔드도 실행 중이어야 함)

브라우저에서 부동산 상세 페이지 열고 view-source로 `<script type="application/ld+json">` 두 개 (jsonld-building, jsonld-realestate-listing) 확인:
- 둘 다 `"image"` 필드 포함
- listing 쪽에 `"offers"`, `"mainEntityOfPage"`, `"datePosted"` 포함 (데이터 있을 때)

- [ ] **Step 3: 커밋**

```bash
git add frontend/pages/real-estate
git commit -m "feat(seo): 부동산 상세 JSON-LD에 image/offers/datePosted 전달"
```

---

## Phase 4: 프론트엔드 — 인근 단지 cross-property 섹션

### Task 8: `useRealEstate` 컴포저블에 `getNearby` 추가

**Files:**
- Modify: `frontend/composables/useRealEstate.ts`
- Test: 기존 useRealEstate 테스트가 있으면 갱신, 없으면 다음 task에서 통합 커버

- [ ] **Step 1: 타입 추가**

`frontend/types/realEstate.ts`에 추가 (적당한 위치):

```typescript
export interface NearbyComplexItem {
  buildingName: string
  bjdCode: string
  city: string
  district: string
  dongName: string
  buildYear: number | null
  transactionCount: number
  latestPrice: number | null
  latestDealYear: number | null
  latestDealMonth: number | null
  lat: number | null
  lng: number | null
}

export interface NearbyResponse {
  apt: NearbyComplexItem[]
  villa: NearbyComplexItem[]
  offitel: NearbyComplexItem[]
}
```

- [ ] **Step 2: composable 메서드 추가**

`frontend/composables/useRealEstate.ts`의 `useRealEstate()` 반환 객체에 다음 함수를 추가:

```typescript
async function getNearby(
  bjdCode: string,
  mode: 'sale' | 'rent',
  opts: {
    rentType?: 'all' | 'jeonse' | 'wolse'
    excludeBuildingName?: string
    limitPerType?: number
  } = {}
): Promise<NearbyResponse> {
  const config = useRuntimeConfig()
  const query: Record<string, string | number> = { bjdCode, mode }
  if (mode === 'rent') query.rentType = opts.rentType ?? 'all'
  if (opts.excludeBuildingName) query.excludeBuildingName = opts.excludeBuildingName
  if (opts.limitPerType) query.limitPerType = opts.limitPerType
  const res = await $fetch<{ success: boolean; data: NearbyResponse }>(
    '/api/real-estate/nearby',
    { baseURL: config.public.apiBase as string, query }
  )
  return res.data
}
```

그리고 return 객체에 `getNearby` 추가.

- [ ] **Step 3: 커밋**

```bash
git add frontend/composables/useRealEstate.ts frontend/types/realEstate.ts
git commit -m "feat(real-estate): useRealEstate.getNearby 추가"
```

---

### Task 9: `NearbyComplexCard.vue` 컴포넌트 생성

기존 `ComplexCard.vue`는 거래수/건축년도 중심 카드라 이미지 디자인과 다르다. 가격 중심 카드 신규 생성.

**Files:**
- Create: `frontend/components/realEstate/NearbyComplexCard.vue`
- Test: `frontend/tests/components/realEstate/NearbyComplexCard.test.ts`

**카드 라벨 규칙 (구현 단순화 결정):** 백엔드 응답에 가격 유형 정보를 추가하지 않고, mode + rentType prop만으로 라벨을 결정한다.

- mode=sale → "매매 ${가격}"
- mode=rent + rentType=jeonse → "전세 ${가격}"
- mode=rent + rentType=wolse → "월세 ${가격}"
- mode=rent + rentType=all → "전월세 ${가격}"

(보증금/월세 분리 표시는 향후 작업.)

- [ ] **Step 1: 테스트 작성**

`frontend/tests/components/realEstate/NearbyComplexCard.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import NearbyComplexCard from '~/components/realEstate/NearbyComplexCard.vue'
import type { NearbyComplexItem } from '~/types/realEstate'

const baseItem: NearbyComplexItem = {
  buildingName: '래미안', bjdCode: '1144012700', city: '서울특별시', district: '마포구', dongName: '한강로동',
  buildYear: 2018, transactionCount: 3,
  latestPrice: 1_500_000_000, latestDealYear: 2026, latestDealMonth: 4,
  lat: 37.55, lng: 126.96,
}

describe('NearbyComplexCard', () => {
  it('단지명과 주소를 표시한다', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toContain('래미안')
    expect(wrapper.text()).toContain('한강로동')
  })

  it('mode=sale → "매매" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'sale', rentType: 'all' } })
    expect(wrapper.text()).toMatch(/매매/)
  })

  it('mode=rent + rentType=jeonse → "전세" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'rent', rentType: 'jeonse' } })
    expect(wrapper.text()).toMatch(/전세/)
  })

  it('mode=rent + rentType=wolse → "월세" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'rent', rentType: 'wolse' } })
    expect(wrapper.text()).toMatch(/월세/)
  })

  it('mode=rent + rentType=all → "전월세" 라벨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'apt', mode: 'rent', rentType: 'all' } })
    expect(wrapper.text()).toMatch(/전월세/)
  })

  it('링크 URL이 propertyType+mode 조합으로 생성됨', () => {
    const wrapper = mount(NearbyComplexCard, { props: { item: baseItem, propertyType: 'villa', mode: 'sale', rentType: 'all' } })
    const link = wrapper.find('a')
    expect(link.attributes('href')).toContain('/real-estate/villa-sale/')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/NearbyComplexCard.test.ts`
Expected: FAIL — 컴포넌트 없음

- [ ] **Step 3: 컴포넌트 구현**

`frontend/components/realEstate/NearbyComplexCard.vue`:

```vue
<template>
  <HardLink
    :to="linkUrl"
    class="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition border border-slate-200 hover:border-primary/30"
  >
    <div class="flex items-start gap-2 mb-2">
      <h3 class="text-slate-900 text-[15px] font-bold truncate flex-1 min-w-0">{{ item.buildingName }}</h3>
      <span :class="['shrink-0 text-[11px] font-bold rounded-md px-2 py-0.5', badgeClass]">{{ propertyLabel }}</span>
    </div>
    <p class="text-slate-500 text-xs truncate">{{ item.city }} {{ item.district }} {{ item.dongName }}</p>
    <p class="mt-2 text-[13px] font-bold rounded-md inline-flex items-center gap-1 px-2 py-1" :class="priceBadgeClass">
      <span>{{ priceLabel }}</span>
      <span>{{ priceText }}</span>
    </p>
  </HardLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import type { NearbyComplexItem, RealEstatePropertyType } from '~/types/realEstate'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'

interface Props {
  item: NearbyComplexItem
  propertyType: RealEstatePropertyType // 'apt' | 'villa' | 'offitel'
  mode: 'sale' | 'rent'
  rentType: 'all' | 'jeonse' | 'wolse'
}
const props = defineProps<Props>()

const propertyLabel = computed(() =>
  props.propertyType === 'apt' ? '아파트'
    : props.propertyType === 'villa' ? '빌라'
    : '오피스텔'
)

const badgeClass = computed(() => {
  if (props.propertyType === 'apt') return 'bg-blue-50 text-blue-700'
  if (props.propertyType === 'villa') return 'bg-emerald-50 text-emerald-700'
  return 'bg-amber-50 text-amber-700'
})

const priceLabel = computed(() => {
  if (props.mode === 'sale') return '매매'
  if (props.rentType === 'jeonse') return '전세'
  if (props.rentType === 'wolse') return '월세'
  return '전월세'
})

const priceBadgeClass = computed(() =>
  props.mode === 'sale' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
)

const priceText = computed(() => {
  const v = props.item.latestPrice
  if (v == null) return '-'
  if (v >= 100_000_000) {
    const eok = Math.floor(v / 100_000_000)
    const man = Math.floor((v % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}` : `${eok}억`
  }
  return `${Math.floor(v / 10_000).toLocaleString()}만`
})

const linkUrl = computed(() => {
  const type: RealEstateUrlType = `${props.propertyType}-${props.mode}` as RealEstateUrlType
  return toRealEstateUrl({
    type,
    city: props.item.city,
    district: props.item.district,
    buildingName: props.item.buildingName,
  })
})
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/NearbyComplexCard.test.ts`
Expected: PASS (6개 케이스)

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/realEstate/NearbyComplexCard.vue frontend/tests/components/realEstate/NearbyComplexCard.test.ts
git commit -m "feat(real-estate): NearbyComplexCard 컴포넌트 추가"
```

---

### Task 10: `[buildingName].vue`에서 인근 단지 섹션을 3분할 + watcher 연결

**Files:**
- Modify: `frontend/pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue`
- Test: `frontend/tests/pages/real-estate/realEstateBuildingDetail.test.ts`

- [ ] **Step 1: 테스트 추가**

기존 `realEstateBuildingDetail.test.ts`의 `$fetch` mock(globalThis.$fetch 또는 tests/setup.ts에서 stub됨) 패턴을 따른다. 다음 describe를 추가:

```typescript
describe('인근 단지 cross-property 섹션', () => {
  // 페이지 마운트 시 $fetch 호출 인자를 캡처할 수 있도록
  // tests/setup.ts에서 등록된 글로벌 $fetch mock을 활용.
  // (기존 테스트가 vi.spyOn(globalThis, '$fetch') 패턴을 쓰면 그것을 재사용)

  it('mode=sale 페이지: /api/real-estate/nearby 호출이 mode=sale, rentType 없이', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, '$fetch')
    await mountBuildingDetail({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'mapo-gu', buildingName: '래미안' },
      buildingInfo: { bjdCode: '1144012700', city: '서울특별시', district: '마포구', /* ...최소 필드 */ },
    })
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/real-estate/nearby'))
    expect(call).toBeTruthy()
    const opts = call?.[1] as { query?: Record<string, string> }
    expect(opts?.query?.mode).toBe('sale')
    expect(opts?.query?.rentType).toBeUndefined()
    expect(opts?.query?.excludeBuildingName).toBe('래미안')
  })

  it('rent 모드 + selectedRentType=jeonse 토글: nearby 재호출 시 rentType=jeonse', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, '$fetch')
    const wrapper = await mountBuildingDetail({
      params: { realEstateType: 'apt-rent', city: 'seoul', district: 'mapo-gu', buildingName: '래미안' },
      buildingInfo: { bjdCode: '1144012700', city: '서울특별시', district: '마포구' },
    })
    fetchSpy.mockClear()
    // selectedRentType은 컴포넌트 내부 ref이므로 RentTypeToggle 컴포넌트의 click을 시뮬레이트하거나
    // 직접 setData로 변경
    await wrapper.findComponent({ name: 'RentTypeToggle' }).vm.$emit('update:modelValue', 'jeonse')
    await flushPromises()
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/real-estate/nearby'))
    expect((call?.[1] as { query: Record<string, string> }).query.rentType).toBe('jeonse')
  })

  it('rent 모드 + selectedRentType=wolse: rentType=wolse 로 호출', async () => {
    const fetchSpy = vi.spyOn(globalThis as any, '$fetch')
    const wrapper = await mountBuildingDetail({
      params: { realEstateType: 'apt-rent', city: 'seoul', district: 'mapo-gu', buildingName: '래미안' },
      buildingInfo: { bjdCode: '1144012700', city: '서울특별시', district: '마포구' },
    })
    fetchSpy.mockClear()
    await wrapper.findComponent({ name: 'RentTypeToggle' }).vm.$emit('update:modelValue', 'wolse')
    await flushPromises()
    const call = fetchSpy.mock.calls.find(([url]) => String(url).includes('/api/real-estate/nearby'))
    expect((call?.[1] as { query: Record<string, string> }).query.rentType).toBe('wolse')
  })

  it('apt/villa/offitel 섹션 중 데이터 있는 것만 DOM에 렌더링', async () => {
    // $fetch mock의 /nearby 응답을 villa만 채워서 반환하도록 설정
    const fetchMock = vi.spyOn(globalThis as any, '$fetch').mockImplementation((url: any) => {
      if (String(url).includes('/api/real-estate/nearby')) {
        return Promise.resolve({
          success: true,
          data: {
            apt: [],
            villa: [{ buildingName: 'B빌라', bjdCode: '1144012700', city: '서울특별시', district: '마포구', dongName: '한강로동', buildYear: 2018, transactionCount: 1, latestPrice: 300_000_000, latestDealYear: 2026, latestDealMonth: 4, lat: null, lng: null }],
            offitel: [],
          },
        })
      }
      return Promise.resolve({ success: true, data: {} })
    })
    const wrapper = await mountBuildingDetail({
      params: { realEstateType: 'apt-sale', city: 'seoul', district: 'mapo-gu', buildingName: '래미안' },
      buildingInfo: { bjdCode: '1144012700', city: '서울특별시', district: '마포구' },
    })
    await flushPromises()
    const html = wrapper.html()
    expect(html).toContain('같은 동 빌라 실거래')
    expect(html).not.toContain('같은 동 아파트 실거래')
    expect(html).not.toContain('같은 동 오피스텔 실거래')
    fetchMock.mockRestore()
  })
})
```

> `mountBuildingDetail`은 이 파일 기존 헬퍼가 있으면 그대로, 없으면 페이지를 mount 하는 inline setup (route mock, useAsyncData stub 포함). 기존 테스트의 mounting boilerplate를 참고해서 조정한다. `flushPromises`는 `@vue/test-utils`에서 import.

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts -t "인근 단지 cross-property"`
Expected: FAIL

- [ ] **Step 3: 페이지 변경 — composable 호출**

`[buildingName].vue` script 영역에 추가:

```vue
import type { NearbyResponse } from '~/types/realEstate'
// 이미 import 한 useRealEstate에서 getNearby 추가로 받기
const { searchTransactions, getTransactionStats, getBuildingInfo, getAreaGroups, getComplexList, getApartmentPriceAnalysis, getNearby } = useRealEstate()

const nearbyByType = ref<NearbyResponse>({ apt: [], villa: [], offitel: [] })

async function loadNearby() {
  const bjd = resolvedBjdCode.value
  if (!bjd) {
    nearbyByType.value = { apt: [], villa: [], offitel: [] }
    return
  }
  const mode = currentTab.value
  const rentType = mode === 'rent'
    ? (selectedRentType.value === 'jeonse' ? 'jeonse'
       : selectedRentType.value === 'wolse' ? 'wolse'
       : 'all') as 'all' | 'jeonse' | 'wolse'
    : undefined
  try {
    nearbyByType.value = await getNearby(bjd, mode, {
      rentType,
      excludeBuildingName: buildingName.value,
      limitPerType: 4,
    })
  } catch (err) {
    console.error('Failed to load nearby:', err)
    nearbyByType.value = { apt: [], villa: [], offitel: [] }
  }
}

// 기존 nearbyComplexes 관련 watchEffect/ref 제거 (line ~1093~1112 부근)
// 그 자리에 새 watcher:
watch(
  () => [resolvedBjdCode.value, currentTab.value, selectedRentType.value] as const,
  () => { loadNearby() },
  { immediate: true }
)
```

- [ ] **Step 4: 페이지 변경 — 템플릿**

기존 `<!-- "인근 단지" 블록 -->` (line ~291~306)을 다음으로 교체:

```vue
<!-- "인근 단지" 블록 — cross-property 3섹션 -->
<template v-if="nearbyByType.apt.length > 0 || nearbyByType.villa.length > 0 || nearbyByType.offitel.length > 0">
  <SectionBlock
    v-if="nearbyByType.apt.length > 0"
    :heading="`🏢 같은 동 아파트 실거래`"
    subtext="같은 행정동 내 다른 아파트 단지를 함께 확인하세요."
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <NearbyComplexCard
        v-for="item in nearbyByType.apt"
        :key="`apt-${item.buildingName}-${item.bjdCode}`"
        :item="item"
        property-type="apt"
        :mode="currentTab"
        :rent-type="selectedRentType"
      />
    </div>
  </SectionBlock>

  <SectionBlock
    v-if="nearbyByType.villa.length > 0"
    :heading="`🏠 같은 동 빌라 실거래`"
    subtext="같은 행정동 내 빌라 단지의 실거래를 비교해 보세요."
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <NearbyComplexCard
        v-for="item in nearbyByType.villa"
        :key="`villa-${item.buildingName}-${item.bjdCode}`"
        :item="item"
        property-type="villa"
        :mode="currentTab"
        :rent-type="selectedRentType"
      />
    </div>
  </SectionBlock>

  <SectionBlock
    v-if="nearbyByType.offitel.length > 0"
    :heading="`🏬 같은 동 오피스텔 실거래`"
    subtext="같은 행정동 내 오피스텔 단지의 실거래를 함께 확인하세요."
  >
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <NearbyComplexCard
        v-for="item in nearbyByType.offitel"
        :key="`offitel-${item.buildingName}-${item.bjdCode}`"
        :item="item"
        property-type="offitel"
        :mode="currentTab"
        :rent-type="selectedRentType"
      />
    </div>
  </SectionBlock>
</template>
```

script 영역 import 추가:
```vue
import NearbyComplexCard from '~/components/realEstate/NearbyComplexCard.vue'
```

기존 `ComplexCard import`, `nearbyComplexes ref`, `watchEffect` 블록은 제거. (`PROPERTY_GUIDE_CATEGORIES` 등 다른 기능과 섞여 있으면 ref/watch만 제거하고 import는 유지.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/realEstateBuildingDetail.test.ts`
Expected: PASS (인근 섹션 케이스 + 기존 케이스 모두)

- [ ] **Step 6: 수동 확인 (dev 서버)**

Run: `cd backend && npm run dev` (별도 터미널), `cd frontend && npm run dev`

브라우저에서:
1. 부동산 매매 페이지 열기 → 인근 단지 섹션이 propertyType별로 나뉘어 있고 각 카드에 매매가 라벨
2. 전월세 페이지로 전환 → 카드 라벨이 "전월세"
3. 전세 토글 → 카드 라벨이 "전세"로 변하고 데이터 새로 로드
4. 월세 토글 → 카드 라벨이 "월세"

- [ ] **Step 7: 커밋**

```bash
git add frontend/pages/real-estate frontend/tests/pages/real-estate
git commit -m "feat(real-estate): 인근 단지 cross-property 3섹션 + rentType 토글 연동"
```

---

## Phase 5: E2E + 회귀 검증

### Task 11: Playwright E2E 시나리오 추가

**Files:**
- Create: `frontend/tests-e2e/real-estate-nearby.spec.ts` (기존 e2e 디렉토리 명에 맞춤 — `frontend/playwright.config.ts` 확인 후 경로 조정)

- [ ] **Step 1: 기존 e2e 패턴 확인**

Run: `find frontend -name "*.spec.ts" -path "*e2e*" -o -name "*.spec.ts" -path "*playwright*" | head`

기존 E2E 파일 한 개 열어서 베이스 URL, fixture 패턴 확인.

- [ ] **Step 2: 시나리오 작성**

위치는 기존 e2e와 같은 폴더에. 예시 (경로는 확인 후 조정):

```typescript
import { test, expect } from '@playwright/test'

const BUILDING_PATH = '/real-estate/apt-sale/seoul/mapo-gu/래미안' // 실제 존재하는 단지로 교체

test.describe('부동산 상세 — 인근 단지 cross-property', () => {
  test('매매 페이지 → 카드 가격 라벨이 "매매"', async ({ page }) => {
    await page.goto(BUILDING_PATH)
    await page.waitForSelector('text=같은 동')
    const badges = page.locator('text=매매').filter({ hasNotText: '매매가' })
    await expect(badges.first()).toBeVisible()
  })

  test('전월세 페이지로 이동 → 카드 라벨이 "전월세"', async ({ page }) => {
    await page.goto(BUILDING_PATH.replace('apt-sale', 'apt-rent'))
    await page.waitForSelector('text=같은 동')
    await expect(page.locator('text=전월세').first()).toBeVisible()
  })

  test('전세 토글 → 카드 라벨이 "전세"', async ({ page }) => {
    await page.goto(BUILDING_PATH.replace('apt-sale', 'apt-rent'))
    await page.getByRole('button', { name: '전세' }).click()
    await expect(page.locator('text=전세').first()).toBeVisible()
  })

  test('월세 토글 → 카드 라벨이 "월세"', async ({ page }) => {
    await page.goto(BUILDING_PATH.replace('apt-sale', 'apt-rent'))
    await page.getByRole('button', { name: '월세' }).click()
    await expect(page.locator('text=월세').first()).toBeVisible()
  })
})
```

> **주의:** 단지 이름과 도시/구 슬러그는 실제 DB에 존재하는 값으로 교체 필요. 로컬 dev 실행 또는 `npm run dev` 후 직접 한 URL 확인 후 값을 채워넣는다.

- [ ] **Step 3: E2E 실행**

Run: `cd frontend && npm run test:e2e -- real-estate-nearby`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add frontend/tests-e2e/real-estate-nearby.spec.ts
git commit -m "test(e2e): 부동산 인근 단지 cross-property 시나리오"
```

---

### Task 12: 전체 회귀 + lint + PR 준비

- [ ] **Step 1: 백엔드 + 프론트엔드 전체 테스트**

Run (parallel):
- `cd backend && npm run lint && npm run test`
- `cd frontend && npm run lint && npm run test`

Expected: 양쪽 다 통과

- [ ] **Step 2: 빌드 확인**

Run (parallel):
- `cd backend && npm run build`
- `cd frontend && npm run build`

Expected: 빌드 성공

- [ ] **Step 3: 브랜치 푸시 + PR 생성**

```bash
git push -u origin feat/real-estate-indexing-fix
gh pr create --title "feat(real-estate): 색인률 개선 — noindex 완화 + cross-property 인근 단지 + JSON-LD 보강" \
  --body "$(cat <<'EOF'
## 개요

부동산 상세 페이지의 네이버 색인률이 다른 카테고리 대비 낮은 문제를 진단하여 다음 4가지 개선을 수행:

1. **noindex 정책 완화** — 거래 < 10건 조건 제거. 지번 패턴/buildingInfo 없음 가드는 유지.
2. **canonical 항상 출력** — noindex 여부와 무관하게 canonical link 유지. 백링크 가치 회수.
3. **JSON-LD 보강** — RealEstateListing/Building 스키마에 image, offers, mainEntityOfPage, datePosted 추가.
4. **인근 단지 cross-property 섹션** — 같은 행정동의 아파트/빌라/오피스텔 단지를 propertyType별 3섹션으로 노출. 페이지 탭(매매/전월세) + selectedRentType 토글에 반응.

설계 문서: \`docs/superpowers/specs/2026-05-18-real-estate-indexing-fix-design.md\`
실행 plan: \`docs/superpowers/plans/2026-05-18-real-estate-indexing-fix.md\`

## 검증

- 백엔드 vitest 통과
- 프론트엔드 vitest 통과
- Playwright e2e 통과
- 로컬 dev에서 매매/전월세/전세/월세 토글에 따라 카드 라벨/데이터 변화 확인

## 배포 후 액션

- 네이버 서치어드바이저에서 부동산 sitemap 청크 재제출
- 고가치 부동산 URL 50개 수동 수집 요청
EOF
)"
```

- [ ] **Step 4: CI 통과 확인 후 머지**

Run: `gh pr checks --watch`
모두 ✓ 확인 후:
```bash
gh pr merge --squash --delete-branch
```

---

## Self-Review 체크리스트 (실행 전 확인용)

- [ ] **Spec 커버리지:** 4가지 설계 변경(noindex, canonical, JSON-LD, 인근 섹션) 각각 대응되는 task 존재. ✓
- [ ] **백엔드 Test:** schema, service, route 3계층 모두 테스트. ✓
- [ ] **프론트엔드 Test:** noindex util, JSON-LD composable, NearbyComplexCard, 페이지 통합 모두 테스트. ✓
- [ ] **E2E:** mode + rentType 토글 시나리오 포함. ✓
- [ ] **타입 일관성:** `NearbyComplexItem`, `NearbyResponse`가 백엔드 응답 구조와 일치. `mode`/`rentType` enum이 backend/frontend 양쪽 동일. ✓
- [ ] **롤백 가능성:** PR 단위가 커서 한 번에 머지되므로 문제 발생 시 PR revert. 각 task는 atomic commit이라 부분 rollback도 가능.

## 위험과 완화 (실행 중 발생 가능)

- **raw SQL 컬럼명 불일치:** Task 2의 raw SQL에서 컬럼명(deposit, lat, lng 등)이 실제 schema와 다를 수 있음. schema.prisma 확인 후 수정. `latestPrice` 산출 로직도 매물 유형별로 다를 수 있음(전세는 deposit, 월세는 deposit+monthlyRent 동시).
- **summary 테이블에 rent의 jeonse/wolse 구분 없음:** rentType=all 케이스는 summary 사용 가능하지만 jeonse/wolse는 raw query 의존. 만약 성능 이슈 시 summary 테이블에 rentType 별 컬럼 추가 마이그레이션 고려(후속 작업).
- **`/nearby` 라우트 충돌:** `/:type/...` 라우트와 같은 prefix를 사용하지만 Express 5는 path-to-regexp 기준 명시적 path 우선. `/nearby`를 `/:type` 라우트들보다 위에 배치하면 안전.
- **SSR 캐시 키:** `loadNearby`가 client-side watcher로만 호출되므로 SSR에서는 인근 섹션이 비어 있다가 hydration 후 채워짐. SEO 측 콘텐츠는 SSR에서 채우는 게 이상적이므로, 시간이 되면 `useAsyncData`로 SSR 통합. 다만 첫 cut에서는 client-side로도 충분(검색엔진은 JS 실행함, 단 첫 paint에 콘텐츠 없어도 페이지가 색인됨에는 영향 없음).
