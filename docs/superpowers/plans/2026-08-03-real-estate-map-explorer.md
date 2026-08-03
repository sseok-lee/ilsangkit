# `/real-estate` 지도 탐색 화면 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/real-estate` 허브를 정적 설명 페이지에서 지도 기반 데이터 탐색 화면으로 전면 교체한다 — 좌측 사이드바(줌 아웃=지역 SSR / 줌 인=건물 CSR) + 우측 전체화면 카카오맵.

**Architecture:** 백엔드는 단일 엔드포인트 `GET /api/real-estate/:type/map`이 줌 레벨에 따라 지역 집계 또는 bbox 건물 목록을 판별 응답한다. 지역 집계는 sargable 날짜 조건 + TTL 캐시, 건물 조회는 `FORCE INDEX` 힌트가 걸린 `$queryRaw`다. 프론트는 `useKakaoMap`을 수정하지 않고 `useMapOverlays`를 새로 만들어 회귀 표면을 0으로 둔다. 지도 상태는 쿼리스트링이 아니라 URL 해시에 담아 Nitro swr 캐시 키 분기를 막는다.

**Tech Stack:** Express 5 + TypeScript(ESM) + Prisma/MySQL 8 / Nuxt 3 SSR + Vue 3 + TailwindCSS / Vitest + happy-dom / 카카오맵 JS SDK

**설계 문서:** `docs/superpowers/specs/2026-07-31-real-estate-map-explorer-design.md`

## Global Constraints

- **Node 20 필수.** 작업 전 `nvm use 20`. 다른 버전에서 `npm install` 하면 lock이 틀어져 CI `npm ci`가 깨진다.
- **`package-lock.json` 삭제 후 재생성 금지.** 이 계획은 신규 의존성을 추가하지 않는다.
- **백엔드는 ESM** — 모든 로컬 import에 `.js` 확장자 필수 (`import { prisma } from '../lib/prisma.js'`).
- **모든 라우트 핸들러는 `asyncHandler()`로 래핑**하고 `validate(Schema, 'query')`로 Zod 검증한다.
- **에러는 클래스로 throw** (`NotFoundError`/`ValidationError`), 수동 `res.status().json()` 금지.
- **BigInt/Decimal은 반드시 Number로 변환**해 응답한다. 누락 시 JSON 직렬화가 터진다.
- **날짜 조건은 반드시 sargable 형태.** `dealYear * 100 + dealMonth >= ?`는 운영 실측 5,862ms, sargable 형태는 529ms — **11배**. 컬럼에 연산을 걸지 않는다.
- **SSR 가드** — `document`/`window` 접근은 `if (!import.meta.client) return`. `watch`/`onMounted` 내부도 예외 아님.
- **직접 `mount`하는 컴포넌트 테스트는 `ref`/`computed`/`watch`를 명시 import.** auto-import에 기대면 로컬은 통과하고 CI에서만 `ReferenceError`가 난다.
- **모든 변경은 PR 경유.** `main` 직접 푸시 금지. 브랜치는 `develop`에서 딴다.
- **커밋 전 `npm run test`와 `npm run lint` 통과 확인.** 기존 실패도 즉시 고친다.
- **스키마 변경은 `schema.prisma`만 수정.** 배포가 `prisma db push`라 마이그레이션 파일을 만들지 않는다.
- **활성 시/도는 16개** — `frontend/utils/regionChips.ts`의 `SIDO_CHIPS`가 정본. 레거시 `gwangju`/`jeonnam`은 제외되고 `jeonnamgwangju`가 포함된다. 새 시/도 상수를 만들지 않는다.
- **`monthlyRent` 판별식**: `NULL`=매매 / `0`=전세 / `>0`=월세. **`IS NULL`을 전세로 쓰지 않는다.**
- **광고 축소 금지** — 기존 `AdBanner` 1개는 유지하고 좌측 인피드 1개를 추가한다(총 2개).
- **`AnchorAdBanner` 재도입 금지** — 자동광고 오버레이와 겹쳐 제거된 이력이 있다.

## File Structure

**백엔드 (신규)**
- `backend/src/services/realEstateMapService.ts` — 지역 집계 + bbox 건물 조회 + 캐시. 이 기능의 데이터 접근 전부.
- `backend/src/lib/sargableDate.ts` — sargable 날짜 조건 빌더. 다른 서비스도 쓸 수 있게 `lib`에 둔다.
- `backend/src/schemas/realEstateMap.ts` — `MapQuerySchema`, granularity 결정 로직.

**백엔드 (수정)**
- `backend/prisma/schema.prisma` — `RealEstateBuildingSummary`에 `@@index([type, lat, lng])` 추가.
- `backend/src/services/realEstateService.ts` — `serializeRow`를 export (현재 private).
- `backend/src/routes/realEstate.ts` — `GET /:type/map` 라우트 추가.

**프론트엔드 (신규)**
- `frontend/composables/useRealEstateMap.ts` — 상태·조회 오케스트레이션.
- `frontend/composables/useMapOverlays.ts` — 가격 라벨·버블 오버레이 렌더.
- `frontend/types/realEstateMap.ts` — API 응답 타입.
- `frontend/components/realEstate/map/MapFilterBar.vue`
- `frontend/components/realEstate/map/MapSidebar.vue`
- `frontend/components/realEstate/map/RealEstateMapCanvas.vue`
- `frontend/components/realEstate/map/RealEstateMapExplorer.vue`
- `frontend/components/realEstate/map/MapBottomSheet.vue`

**프론트엔드 (수정)**
- `frontend/pages/real-estate/index.vue` — 전면 교체.

**건드리지 않는 것**
- `frontend/composables/useKakaoMap.ts` — 시설 상세·건물 상세·공매·청약·지하철 5개 페이지가 사용 중. 이 계획은 읽기만 한다.

---

### Task 1: sargable 날짜 조건 빌더

지역 집계 쿼리의 성능 전체가 여기 달려 있다. 먼저 만들고 테스트로 고정한다.

**Files:**
- Create: `backend/src/lib/sargableDate.ts`
- Test: `backend/__tests__/lib/sargableDate.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: `recentMonthsCondition(months: number, now: Date): { sql: string; params: number[] }` — `sql`은 `((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)` 형태이고 `params`는 `[cutoffYear, cutoffMonth, cutoffYear]` 3개다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// backend/__tests__/lib/sargableDate.test.ts
import { describe, it, expect } from 'vitest';
import { recentMonthsCondition } from '../../src/lib/sargableDate.js';

describe('recentMonthsCondition', () => {
  it('당월 포함 최근 3개월 → 2026-08 기준 cutoff 는 2026-06', () => {
    const r = recentMonthsCondition(3, new Date('2026-08-03T00:00:00Z'));
    expect(r.params).toEqual([2026, 6, 2026]);
  });

  it('연도 경계를 넘어가면 전년으로 롤백한다 — 2026-02 기준 cutoff 2025-12', () => {
    const r = recentMonthsCondition(3, new Date('2026-02-15T00:00:00Z'));
    expect(r.params).toEqual([2025, 12, 2025]);
  });

  it('12개월을 넘어가도 정확하다 — 2026-01 기준 13개월 cutoff 2025-01', () => {
    const r = recentMonthsCondition(13, new Date('2026-01-10T00:00:00Z'));
    expect(r.params).toEqual([2025, 1, 2025]);
  });

  it('컬럼에 연산을 걸지 않는다 (sargable 회귀 방지)', () => {
    const r = recentMonthsCondition(3, new Date('2026-08-03T00:00:00Z'));
    // dealYear * 100 + dealMonth 형태는 운영 실측 5,862ms — 절대 생성되면 안 된다
    expect(r.sql).not.toMatch(/dealYear\s*\*/);
    expect(r.sql).toBe('((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)');
  });

  it('months 가 1 미만이면 던진다', () => {
    expect(() => recentMonthsCondition(0, new Date())).toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run __tests__/lib/sargableDate.test.ts`
Expected: FAIL — `Failed to load ../../src/lib/sargableDate.js`

- [ ] **Step 3: 최소 구현**

```typescript
// backend/src/lib/sargableDate.ts

/**
 * 최근 N개월(당월 포함) 거래를 고르는 **sargable** WHERE 조건을 만든다.
 *
 * 왜 이 함수가 따로 있는가 —
 * `WHERE dealYear * 100 + dealMonth >= 202606` 은 컬럼에 연산이 걸려 인덱스를 못 탄다.
 * 운영 실측(2026-08-03, AptSaleTransaction 1,557,394행): 비sargable 5,862ms vs
 * sargable 529ms — 같은 결과에 11배 차이. 이 형태를 쓰는 곳이 이미 있으므로
 * (realEstateHubSummaryService) 새로 쓰는 코드는 반드시 이 함수를 경유한다.
 *
 * 반환하는 sql 은 파라미터 3개를 소비한다: [cutoffYear, cutoffMonth, cutoffYear]
 */
export function recentMonthsCondition(
  months: number,
  now: Date,
): { sql: string; params: number[] } {
  if (!Number.isInteger(months) || months < 1) {
    throw new Error(`months must be a positive integer, got ${months}`);
  }

  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1; // 1-12

  // 당월 포함이므로 months-1 만큼 뒤로 간다
  let cutoffYear = year;
  let cutoffMonth = month - (months - 1);
  while (cutoffMonth <= 0) {
    cutoffMonth += 12;
    cutoffYear -= 1;
  }

  return {
    sql: '((dealYear = ? AND dealMonth >= ?) OR dealYear > ?)',
    params: [cutoffYear, cutoffMonth, cutoffYear],
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/lib/sargableDate.test.ts`
Expected: PASS — 5 passed

- [ ] **Step 5: 커밋**

```bash
git add backend/src/lib/sargableDate.ts backend/__tests__/lib/sargableDate.test.ts
git commit -m "feat(real-estate): sargable 날짜 조건 빌더 — 비sargable 대비 11배"
```

---

### Task 2: 좌표 인덱스 추가 + `serializeRow` export

bbox 조회의 전제 조건 둘을 함께 처리한다. 인덱스는 힌트 없이는 효과가 없으므로 Task 3의 `FORCE INDEX`와 짝이다.

**Files:**
- Modify: `backend/prisma/schema.prisma` (`RealEstateBuildingSummary` 모델 `@@index` 블록)
- Modify: `backend/src/services/realEstateService.ts:147` (`serializeRow`에 `export` 추가)
- Test: `backend/__tests__/services/realEstateMapIndex.test.ts`

**Interfaces:**
- Consumes: 없음
- Produces: Prisma 인덱스명 `RealEstateBuildingSummary_type_lat_lng_idx` (Task 3의 `FORCE INDEX`가 이 이름을 문자열로 참조한다). `serializeRow(row: any): any` export.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// backend/__tests__/services/realEstateMapIndex.test.ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { serializeRow } from '../../src/services/realEstateService.js';

describe('RealEstateBuildingSummary 좌표 인덱스', () => {
  it('schema.prisma 에 @@index([type, lat, lng]) 가 있다', () => {
    const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf-8');
    const model = schema.match(/model RealEstateBuildingSummary \{[\s\S]*?\n\}/)?.[0] ?? '';
    expect(model).toContain('@@index([type, lat, lng])');
  });
});

describe('serializeRow', () => {
  it('export 되어 있고 BigInt 를 Number 로 바꾼다', () => {
    expect(serializeRow({ a: 10n, b: 'x' })).toEqual({ a: 10, b: 'x' });
  });

  it('null 과 undefined 를 보존한다', () => {
    expect(serializeRow({ a: null, b: undefined })).toEqual({ a: null, b: undefined });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateMapIndex.test.ts`
Expected: FAIL — `serializeRow is not exported` 및 `@@index([type, lat, lng])` 미포함

- [ ] **Step 3: 스키마와 export 수정**

`backend/prisma/schema.prisma`의 `RealEstateBuildingSummary` 모델에서, 기존 `@@index([type, bjdCode, latestDealYear, latestDealMonth, transactionCount])` 줄 **바로 아래**에 다음을 추가한다.

```prisma
  /// 지도 뷰포트(bbox) 조회 전용.
  ///
  /// ⚠️ 이 인덱스만 추가하면 효과가 없다. ORDER BY transactionCount DESC LIMIT N 이
  /// 붙으면 옵티마이저가 filesort 를 피하려고 type_transactionCount_idx 역방향 스캔을
  /// 고르는데, 실제로는 그쪽이 훨씬 비싸다.
  /// 실측(villa-rent 16만행, 희소 뷰포트): 자연 선택 232ms(스캔 182,317행) vs
  /// FORCE INDEX 11ms(스캔 31,748행) — 21배.
  /// 따라서 조회는 realEstateMapService 에서 FORCE INDEX 힌트를 건 $queryRaw 로 한다.
  @@index([type, lat, lng])
```

`backend/src/services/realEstateService.ts:147`의 함수 선언에 `export`를 붙인다.

```typescript
// 변경 전: function serializeRow(row: any): any {
// 변경 후:
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function serializeRow(row: any): any {
```

- [ ] **Step 4: 테스트 통과 + Prisma Client 재생성**

```bash
cd backend && npx prisma generate && npx vitest run __tests__/services/realEstateMapIndex.test.ts
```
Expected: PASS — 3 passed

- [ ] **Step 5: 로컬 DB에 인덱스 반영하고 실제로 붙었는지 확인**

```bash
cd backend && npm run db:push
docker exec ilsangkit-mysql mysql -uilsangkit -pilsangkit123 ilsangkit -N -B \
  -e "SHOW INDEX FROM RealEstateBuildingSummary WHERE Key_name LIKE '%lat_lng%';"
```
Expected: `RealEstateBuildingSummary_type_lat_lng_idx` 행이 3개(type, lat, lng) 출력된다. 아무것도 안 나오면 `db push`가 실패한 것이므로 다음 단계로 넘어가지 않는다.

- [ ] **Step 6: 커밋**

```bash
git add backend/prisma/schema.prisma backend/src/services/realEstateService.ts backend/__tests__/services/realEstateMapIndex.test.ts
git commit -m "feat(real-estate): bbox 좌표 인덱스 + serializeRow export"
```

---

### Task 3: bbox 건물 조회 서비스

**Files:**
- Create: `backend/src/services/realEstateMapService.ts`
- Test: `backend/__tests__/services/realEstateMapBuildings.test.ts`

**Interfaces:**
- Consumes: `getTableName(type)`·`serializeRow(row)` from `realEstateService.js`, `TABLE_NAME_MAP`
- Produces:
  - `BUILDING_LIMIT = 200`
  - `interface MapBuildingItem { buildingName; city; district; dongName; lat; lng; latestPrice; monthlyRent; latestDealYear; latestDealMonth; latestDealDay; transactionCount }`
  - `fetchBuildings(type: string, bounds: Bounds): Promise<{ items: MapBuildingItem[]; total: number; exact: boolean }>`
  - `interface Bounds { swLat: number; swLng: number; neLat: number; neLng: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// backend/__tests__/services/realEstateMapBuildings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRawUnsafe = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));

import { fetchBuildings, BUILDING_LIMIT } from '../../src/services/realEstateMapService.js';

const BOUNDS = { swLat: 37.46, swLng: 127.0, neLat: 37.54, neLng: 127.1 };

describe('fetchBuildings', () => {
  beforeEach(() => queryRawUnsafe.mockReset());

  it('FORCE INDEX 힌트를 건다 — 없으면 옵티마이저가 21배 느린 경로를 고른다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 5n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-sale', BOUNDS);
    const listSql = queryRawUnsafe.mock.calls[1][0] as string;
    expect(listSql).toContain('FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)');
  });

  it('total 을 items.length 가 아니라 별도 COUNT 로 구한다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1820n }])
      .mockResolvedValueOnce([{ buildingName: 'A', latestPrice: 100n, monthlyRent: null, transactionCount: 3, lat: 37.5, lng: 127.05 }]);
    const r = await fetchBuildings('apt-sale', BOUNDS);
    expect(r.total).toBe(1820);
    expect(r.items).toHaveLength(1);
  });

  it('total 이 상한을 넘으면 exact=false', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: BigInt(BUILDING_LIMIT + 1) }]).mockResolvedValueOnce([]);
    expect((await fetchBuildings('apt-sale', BOUNDS)).exact).toBe(false);
  });

  it('total 이 상한 이하면 exact=true', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 12n }]).mockResolvedValueOnce([]);
    expect((await fetchBuildings('apt-sale', BOUNDS)).exact).toBe(true);
  });

  it('BigInt 를 Number 로 직렬화한다', async () => {
    queryRawUnsafe
      .mockResolvedValueOnce([{ cnt: 1n }])
      .mockResolvedValueOnce([{ buildingName: 'A', latestPrice: 168340n, monthlyRent: 0, transactionCount: 3 }]);
    const r = await fetchBuildings('apt-rent', BOUNDS);
    expect(r.items[0].latestPrice).toBe(168340);
    expect(typeof r.items[0].latestPrice).toBe('number');
  });

  it('좌표가 NULL 인 행을 제외한다', async () => {
    queryRawUnsafe.mockResolvedValueOnce([{ cnt: 0n }]).mockResolvedValueOnce([]);
    await fetchBuildings('apt-sale', BOUNDS);
    expect(queryRawUnsafe.mock.calls[1][0]).toContain('lat IS NOT NULL');
  });

  it('알 수 없는 type 은 던진다', async () => {
    await expect(fetchBuildings('bogus', BOUNDS)).rejects.toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateMapBuildings.test.ts`
Expected: FAIL — `Failed to load ../../src/services/realEstateMapService.js`

- [ ] **Step 3: 최소 구현**

```typescript
// backend/src/services/realEstateMapService.ts
import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP, serializeRow } from './realEstateService.js';

/** 건물 마커 상한. 카카오 CustomOverlay 는 DOM 노드라 이 이상은 렌더가 무겁다. */
export const BUILDING_LIMIT = 200;

export interface Bounds {
  swLat: number;
  swLng: number;
  neLat: number;
  neLng: number;
}

export interface MapBuildingItem {
  buildingName: string;
  city: string;
  district: string;
  dongName: string;
  lat: number | null;
  lng: number | null;
  /** 매매=거래금액, 전월세=보증금 (만원) */
  latestPrice: number | null;
  /** null=매매 / 0=전세 / >0=월세 */
  monthlyRent: number | null;
  latestDealYear: number | null;
  latestDealMonth: number | null;
  latestDealDay: number | null;
  transactionCount: number;
}

function assertKnownType(type: string): void {
  if (!TABLE_NAME_MAP[type]) throw new Error(`Unknown real estate type: ${type}`);
}

/**
 * 뷰포트(bbox) 안의 건물을 거래량 순으로 가져온다.
 *
 * ⚠️ FORCE INDEX 가 핵심이다. 이 힌트가 없으면 MySQL 이 ORDER BY transactionCount DESC
 * 때문에 type_transactionCount_idx 역방향 스캔을 고르는데, 희소 뷰포트에서 16만 행을
 * 훑고 2건을 찾는다. 실측 232ms vs 11ms (21배). 운영 baseline 은 그 약 2배다.
 *
 * total 은 items.length 가 아니라 별도 COUNT 다. 목록을 개수 용도로 재사용하면
 * "반경 1km 병원 893곳을 6곳으로" 렌더하던 2026-08 버그가 재발한다.
 */
export async function fetchBuildings(
  type: string,
  bounds: Bounds,
): Promise<{ items: MapBuildingItem[]; total: number; exact: boolean }> {
  assertKnownType(type);

  const where = `type = ? AND lat IS NOT NULL AND lng IS NOT NULL
      AND lat BETWEEN ? AND ? AND lng BETWEEN ? AND ?`;
  const params = [type, bounds.swLat, bounds.neLat, bounds.swLng, bounds.neLng];

  const countRows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
    `SELECT COUNT(*) AS cnt FROM RealEstateBuildingSummary
     FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)
     WHERE ${where}`,
    ...params,
  );
  const total = Number(countRows[0]?.cnt ?? 0);

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
    `SELECT buildingName, city, district, dongName, lat, lng,
            latestPrice, monthlyRent, latestDealYear, latestDealMonth, latestDealDay,
            transactionCount
     FROM RealEstateBuildingSummary
     FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)
     WHERE ${where}
     ORDER BY transactionCount DESC
     LIMIT ${BUILDING_LIMIT}`,
    ...params,
  );

  const items = rows.map((r) => {
    const s = serializeRow(r) as Record<string, unknown>;
    return {
      ...s,
      lat: s.lat == null ? null : Number(s.lat),
      lng: s.lng == null ? null : Number(s.lng),
    } as MapBuildingItem;
  });

  return { items, total, exact: total <= BUILDING_LIMIT };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateMapBuildings.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: 로컬 DB로 실제 쿼리가 도는지 확인**

```bash
cd backend && cat > verify-tmp.ts <<'EOF'
import { fetchBuildings } from './src/services/realEstateMapService.js';
const r = await fetchBuildings('apt-sale', { swLat: 37.46, swLng: 127.0, neLat: 37.54, neLng: 127.1 });
console.log('total=', r.total, 'items=', r.items.length, 'exact=', r.exact);
console.log(r.items[0]);
process.exit(0);
EOF
npx tsx verify-tmp.ts; rm -f verify-tmp.ts
```
Expected: `total=` 0보다 큰 수, `items=` 1 이상, 첫 항목에 `latestPrice`가 number로 찍힌다. `Unknown column` 이나 `Key ... doesn't exist` 오류가 나면 Task 2의 `db push`가 안 된 것이다.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/realEstateMapService.ts backend/__tests__/services/realEstateMapBuildings.test.ts
git commit -m "feat(real-estate): 지도 bbox 건물 조회 — FORCE INDEX 힌트 필수"
```

---

### Task 4: 지역 집계 서비스 + TTL 캐시

**Files:**
- Modify: `backend/src/services/realEstateMapService.ts` (append)
- Test: `backend/__tests__/services/realEstateMapRegions.test.ts`

**Interfaces:**
- Consumes: `recentMonthsCondition` from `../lib/sargableDate.js`, `prisma`
- Produces:
  - `type RegionLevel = 'city' | 'district'`
  - `interface MapRegionItem { name: string; district: string | null; lat: number; lng: number; avgPricePerPyeong: number | null; transactionCount: number }`
  - `fetchRegions(type: string, level: RegionLevel): Promise<MapRegionItem[]>` — 캐시 경유
  - `__resetMapCacheForTest(): void`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// backend/__tests__/services/realEstateMapRegions.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRawUnsafe = vi.fn();
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
  default: { $queryRawUnsafe: (...a: unknown[]) => queryRawUnsafe(...a) },
}));

import { fetchRegions, __resetMapCacheForTest } from '../../src/services/realEstateMapService.js';

describe('fetchRegions', () => {
  beforeEach(() => {
    queryRawUnsafe.mockReset();
    __resetMapCacheForTest();
  });

  it('sargable 날짜 조건을 쓴다 — dealYear 에 연산을 걸지 않는다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city');
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).not.toMatch(/dealYear\s*\*/);
    expect(sql).toContain('(dealYear = ? AND dealMonth >= ?) OR dealYear > ?');
  });

  it('매매는 dealAmount 를 쓴다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city');
    expect(queryRawUnsafe.mock.calls[0][0]).toContain('dealAmount');
  });

  it('전월세는 deposit 을 쓰고 전세(monthlyRent=0)만 집계한다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-rent', 'city');
    const sql = queryRawUnsafe.mock.calls[0][0] as string;
    expect(sql).toContain('deposit');
    expect(sql).toContain('monthlyRent = 0');
  });

  it('같은 (type, level) 두 번째 호출은 캐시를 쓴다', async () => {
    queryRawUnsafe.mockResolvedValue([]);
    await fetchRegions('apt-sale', 'city');
    await fetchRegions('apt-sale', 'city');
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('동시 호출을 한 번의 쿼리로 합친다 (in-flight)', async () => {
    let resolve!: (v: unknown) => void;
    queryRawUnsafe.mockReturnValueOnce(new Promise((r) => { resolve = r; }));
    const p1 = fetchRegions('villa-sale', 'district');
    const p2 = fetchRegions('villa-sale', 'district');
    resolve([]);
    await Promise.all([p1, p2]);
    expect(queryRawUnsafe).toHaveBeenCalledTimes(1);
  });

  it('쿼리가 실패하면 빈 배열을 주고 캐시하지 않는다 (fail-open)', async () => {
    queryRawUnsafe.mockRejectedValueOnce(new Error('db down'));
    expect(await fetchRegions('apt-sale', 'city')).toEqual([]);
    queryRawUnsafe.mockResolvedValueOnce([]);
    await fetchRegions('apt-sale', 'city');
    expect(queryRawUnsafe).toHaveBeenCalledTimes(2);
  });

  it('BigInt/Decimal 을 Number 로 바꾼다', async () => {
    queryRawUnsafe.mockResolvedValue([
      { name: '서울', district: null, lat: '37.5513', lng: '126.9891', avgPricePerPyeong: 7732n, transactionCount: 12043n },
    ]);
    const r = await fetchRegions('apt-sale', 'city');
    expect(r[0]).toEqual({
      name: '서울', district: null, lat: 37.5513, lng: 126.9891,
      avgPricePerPyeong: 7732, transactionCount: 12043,
    });
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateMapRegions.test.ts`
Expected: FAIL — `fetchRegions is not a function`

- [ ] **Step 3: `realEstateMapService.ts` 하단에 추가**

```typescript
// ─────────────────────────────────────────────
// 지역 집계
// ─────────────────────────────────────────────

import { recentMonthsCondition } from '../lib/sargableDate.js';

export type RegionLevel = 'city' | 'district';

export interface MapRegionItem {
  /** level='city' 면 시/도명, 'district' 면 시/도명 (district 필드와 짝) */
  name: string;
  district: string | null;
  lat: number;
  lng: number;
  /** 평당가(만원). 해당 기간 거래가 없으면 null */
  avgPricePerPyeong: number | null;
  transactionCount: number;
}

/** 집계 대상 기간. 최근 3개월. */
const AGGREGATE_MONTHS = 3;
/** 1평 = 3.3058㎡ */
const PYEONG_M2 = 3.3058;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h

const regionCache = new Map<string, { value: MapRegionItem[]; expiresAt: number }>();
const regionInFlight = new Map<string, Promise<MapRegionItem[]>>();

export function __resetMapCacheForTest(): void {
  regionCache.clear();
  regionInFlight.clear();
}

async function buildRegions(type: string, level: RegionLevel): Promise<MapRegionItem[]> {
  assertKnownType(type);
  const table = TABLE_NAME_MAP[type];
  const isRent = type.endsWith('-rent');

  // 전월세는 보증금(deposit) 기준이고 **전세만** 집계한다. 월세 보증금과 전세 보증금은
  // 규모가 달라 섞으면 지역 평균이 무의미해진다. monthlyRent=0 이 전세다(NULL 아님).
  const priceCol = isRent ? 'deposit' : 'dealAmount';
  const rentFilter = isRent ? 'AND t.monthlyRent = 0' : '';

  const { sql: dateSql, params: dateParams } = recentMonthsCondition(AGGREGATE_MONTHS, new Date());

  // 좌표는 Region(구·군 267행)에서 가져온다. 시/도는 그 평균을 중심으로 쓴다.
  // 시/도 상수를 새로 만들지 않는 이유: 행정구역 개편(2026-07 전남광주통합)마다
  // 하드코딩 맵이 드리프트해 404 를 냈던 이력이 있다.
  const groupCols = level === 'city' ? 't.city' : 't.city, t.district';
  const selectName =
    level === 'city'
      ? 't.city AS name, NULL AS district'
      : 't.city AS name, t.district AS district';
  const joinCoord =
    level === 'city'
      ? `JOIN (SELECT city, AVG(lat) AS lat, AVG(lng) AS lng FROM Region GROUP BY city) r
           ON r.city = t.city`
      : `JOIN Region r ON r.city = t.city AND r.district = t.district`;

  const sql = `
    SELECT ${selectName},
           r.lat AS lat, r.lng AS lng,
           ROUND(AVG(t.${priceCol} / (t.exclusiveArea / ${PYEONG_M2}))) AS avgPricePerPyeong,
           COUNT(*) AS transactionCount
    FROM ${table} t
    ${joinCoord}
    WHERE t.exclusiveArea > 0 ${rentFilter} AND ${dateSql}
    GROUP BY ${groupCols}, r.lat, r.lng
  `;

  const rows = await prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(sql, ...dateParams);

  return rows.map((r) => ({
    name: String(r.name),
    district: r.district == null ? null : String(r.district),
    lat: Number(r.lat),
    lng: Number(r.lng),
    avgPricePerPyeong: r.avgPricePerPyeong == null ? null : Number(r.avgPricePerPyeong),
    transactionCount: Number(r.transactionCount ?? 0),
  }));
}

/**
 * 지역 단위 평균 평당가. 뷰포트와 무관하므로 (type, level) 조합 12개만 캐시하면 전부 커버된다.
 *
 * 실패 시 빈 배열을 주고 **캐시하지 않는다**. 호출부(SSR)는 지역 링크를 상수에서 만들고
 * 가격만 이 값으로 채우므로, 빈 배열이어도 페이지는 링크를 온전히 렌더한다(fail-open).
 */
export async function fetchRegions(type: string, level: RegionLevel): Promise<MapRegionItem[]> {
  const key = `${type}:${level}`;
  const hit = regionCache.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;

  const pending = regionInFlight.get(key);
  if (pending) return pending;

  const task = buildRegions(type, level)
    .then((value) => {
      regionCache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
      return value;
    })
    .catch((err) => {
      console.warn(`[realEstateMap] region aggregate failed (${key}):`, err);
      return [] as MapRegionItem[];
    })
    .finally(() => {
      regionInFlight.delete(key);
    });

  regionInFlight.set(key, task);
  return task;
}
```

**주의:** `import { recentMonthsCondition }` 은 파일 상단 import 블록으로 옮긴다. ESM은 import 호이스팅이 되지만 lint 규칙에 걸린다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/realEstateMapRegions.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 5: 로컬 DB로 실제 집계 + 소요시간 확인**

```bash
cd backend && cat > verify-tmp.ts <<'EOF'
import { fetchRegions } from './src/services/realEstateMapService.js';
console.time('city'); const c = await fetchRegions('apt-sale', 'city'); console.timeEnd('city');
console.log('시/도', c.length, '개'); console.log(c.slice(0, 3));
console.time('district'); const d = await fetchRegions('apt-sale', 'district'); console.timeEnd('district');
console.log('구/군', d.length, '개');
process.exit(0);
EOF
npx tsx verify-tmp.ts; rm -f verify-tmp.ts
```
Expected: 시/도 15~16개, 구/군 200개 이상. 각 쿼리 1초 미만. **3초를 넘으면 sargable 조건이 안 걸린 것이므로** 생성 SQL을 찍어 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/services/realEstateMapService.ts backend/__tests__/services/realEstateMapRegions.test.ts
git commit -m "feat(real-estate): 지역 평균 평당가 집계 + TTL 캐시"
```

---

### Task 5: granularity 결정 + Zod 스키마 + 라우트

**Files:**
- Create: `backend/src/schemas/realEstateMap.ts`
- Modify: `backend/src/routes/realEstate.ts`
- Test: `backend/__tests__/routes/realEstateMap.test.ts`

**Interfaces:**
- Consumes: `fetchRegions`, `fetchBuildings`, `Bounds` from `realEstateMapService.js`
- Produces:
  - `MapQuerySchema` (Zod) — `{ level: number; swLat; swLng; neLat; neLng }`
  - `resolveGranularity(level: number, prev?: Granularity): Granularity`
  - `type Granularity = 'city' | 'district' | 'building'`
  - `GET /api/real-estate/:type/map` → `{ success, data: { granularity, items, total, exact } }`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// backend/__tests__/routes/realEstateMap.test.ts
import { describe, it, expect } from 'vitest';
import { resolveGranularity, MapQuerySchema } from '../../src/schemas/realEstateMap.js';

describe('resolveGranularity', () => {
  it('level >= 11 은 city', () => {
    expect(resolveGranularity(11)).toBe('city');
    expect(resolveGranularity(14)).toBe('city');
  });

  it('level 8~10 은 district', () => {
    expect(resolveGranularity(8)).toBe('district');
    expect(resolveGranularity(10)).toBe('district');
  });

  it('level <= 7 은 building', () => {
    expect(resolveGranularity(7)).toBe('building');
    expect(resolveGranularity(1)).toBe('building');
  });

  it('히스테리시스: district 에서 level 11 로 올라가도 한 단계는 버틴다', () => {
    // 경계에서 진동하면 좌측/마커가 깜빡인다. 이미 district 면 12 이상에서만 city 로 간다.
    expect(resolveGranularity(11, 'district')).toBe('district');
    expect(resolveGranularity(12, 'district')).toBe('city');
  });

  it('히스테리시스: city 에서 level 10 으로 내려가도 한 단계는 버틴다', () => {
    expect(resolveGranularity(10, 'city')).toBe('city');
    expect(resolveGranularity(9, 'city')).toBe('district');
  });
});

describe('MapQuerySchema', () => {
  const valid = { level: '9', swLat: '37.4', swLng: '127.0', neLat: '37.6', neLng: '127.2' };

  it('정상 입력을 숫자로 파싱한다', () => {
    const r = MapQuerySchema.parse(valid);
    expect(r.level).toBe(9);
    expect(r.swLat).toBe(37.4);
  });

  it('bounds 를 하나라도 빠뜨리면 거부한다', () => {
    const { neLng, ...partial } = valid;
    expect(() => MapQuerySchema.parse(partial)).toThrow();
  });

  it('한국 영역 밖 좌표를 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, swLat: '20' })).toThrow();
    expect(() => MapQuerySchema.parse({ ...valid, neLng: '150' })).toThrow();
  });

  it('sw 가 ne 보다 크면 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, swLat: '38', neLat: '37' })).toThrow();
  });

  it('level 범위를 벗어나면 거부한다', () => {
    expect(() => MapQuerySchema.parse({ ...valid, level: '0' })).toThrow();
    expect(() => MapQuerySchema.parse({ ...valid, level: '20' })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd backend && npx vitest run __tests__/routes/realEstateMap.test.ts`
Expected: FAIL — `Failed to load ../../src/schemas/realEstateMap.js`

- [ ] **Step 3: 스키마 구현**

```typescript
// backend/src/schemas/realEstateMap.ts
import { z } from 'zod';
import { KOREA_BOUNDS } from '../constants/index.js';

export type Granularity = 'city' | 'district' | 'building';

/** 카카오맵 level 은 숫자가 클수록 축소된다. 1=20m, 14=전국. */
const CITY_MIN_LEVEL = 11;
const DISTRICT_MIN_LEVEL = 8;

/**
 * 줌 레벨 → 표시 단위.
 *
 * prev 를 넘기면 히스테리시스가 걸린다. 경계값(10↔11, 7↔8)에서 사용자가 미세하게
 * 줌하면 granularity 가 왕복하면서 좌측 목록과 마커가 깜빡이기 때문에, 이미 어떤
 * 단위에 있으면 경계를 한 단계 더 넘어야 전환한다.
 */
export function resolveGranularity(level: number, prev?: Granularity): Granularity {
  const base: Granularity =
    level >= CITY_MIN_LEVEL ? 'city' : level >= DISTRICT_MIN_LEVEL ? 'district' : 'building';

  if (!prev || prev === base) return base;

  // 확대 방향(level 감소)으로 내려갈 때: 경계 바로 위 한 칸은 이전 단위를 유지
  if (prev === 'city' && base === 'district' && level === DISTRICT_MIN_LEVEL + 2) return 'city';
  if (prev === 'district' && base === 'building' && level === DISTRICT_MIN_LEVEL - 1) return 'district';
  // 축소 방향(level 증가)으로 올라갈 때
  if (prev === 'district' && base === 'city' && level === CITY_MIN_LEVEL) return 'district';
  if (prev === 'building' && base === 'district' && level === DISTRICT_MIN_LEVEL) return 'building';

  return base;
}

const lat = z.coerce
  .number()
  .min(KOREA_BOUNDS.LAT_MIN, '한국 영역 외 좌표입니다')
  .max(KOREA_BOUNDS.LAT_MAX, '한국 영역 외 좌표입니다');
const lng = z.coerce
  .number()
  .min(KOREA_BOUNDS.LNG_MIN, '한국 영역 외 좌표입니다')
  .max(KOREA_BOUNDS.LNG_MAX, '한국 영역 외 좌표입니다');

export const MapQuerySchema = z
  .object({
    level: z.coerce.number().int().min(1).max(14),
    swLat: lat,
    swLng: lng,
    neLat: lat,
    neLng: lng,
  })
  .refine((d) => d.swLat <= d.neLat && d.swLng <= d.neLng, {
    message: 'sw 좌표는 ne 좌표보다 작거나 같아야 합니다',
  });

export type MapQueryInput = z.infer<typeof MapQuerySchema>;
```

- [ ] **Step 4: 라우트 추가**

`backend/src/routes/realEstate.ts`의 import 블록에 다음을 추가한다.

```typescript
import { fetchRegions, fetchBuildings } from '../services/realEstateMapService.js';
import { MapQuerySchema, resolveGranularity, type MapQueryInput } from '../schemas/realEstateMap.js';
```

그리고 기존 `'/:type/area-groups'` 라우트 **뒤에** 다음을 추가한다.

```typescript
// GET /api/real-estate/:type/map - 지도 뷰포트 조회
//
// granularity 는 줌 레벨이 정한다. 줌 아웃이면 지역 집계(캐시), 줌 인이면 bbox 건물 목록.
// rentType 파라미터는 두지 않는다 — summary 가 건물당 최신 거래 1건만 보유해
// 전세로 필터하면 실제 전세 건물의 40~56%가 사라진다(설계문서 4장). 전세/월세 구분은
// 응답의 monthlyRent 로 프론트가 라벨에서 처리한다.
router.get(
  '/:type/map',
  validate(TypeParamsSchema, 'params'),
  validate(MapQuerySchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const { type } = req.params as { type: string };
    const { level, swLat, swLng, neLat, neLng } = req.query as unknown as MapQueryInput;

    const granularity = resolveGranularity(level);

    if (granularity === 'building') {
      const { items, total, exact } = await fetchBuildings(type, { swLat, swLng, neLat, neLng });
      res.json({ success: true, data: { granularity, items, total, exact } });
      return;
    }

    const items = await fetchRegions(type, granularity);
    res.json({
      success: true,
      data: { granularity, items, total: items.length, exact: true },
    });
  }),
);
```

- [ ] **Step 5: 테스트 통과 + 라우트 수동 확인**

```bash
cd backend && npx vitest run __tests__/routes/realEstateMap.test.ts
```
Expected: PASS — 10 passed

개발 서버를 띄우고 실제 응답을 확인한다.

```bash
cd backend && npm run dev &
sleep 6
curl -s "http://localhost:8000/api/real-estate/apt-sale/map?level=13&swLat=33&swLng=124&neLat=39&neLng=132" | head -c 400
echo
curl -s "http://localhost:8000/api/real-estate/apt-sale/map?level=5&swLat=37.46&swLng=127.0&neLat=37.54&neLng=127.1" | head -c 400
```
Expected: 첫 응답은 `"granularity":"city"`와 시/도 항목들, 두 번째는 `"granularity":"building"`과 건물 항목들. 확인 후 `kill %1`.

- [ ] **Step 6: 커밋**

```bash
git add backend/src/schemas/realEstateMap.ts backend/src/routes/realEstate.ts backend/__tests__/routes/realEstateMap.test.ts
git commit -m "feat(real-estate): 지도 API 라우트 + granularity 히스테리시스"
```

---

### Task 6: 프론트 타입 + `useRealEstateMap` composable

**Files:**
- Create: `frontend/types/realEstateMap.ts`
- Create: `frontend/composables/useRealEstateMap.ts`
- Test: `frontend/tests/composables/useRealEstateMap.test.ts`

**Interfaces:**
- Consumes: `useApiBase()` from `~/composables/useApiBase`
- Produces:
  - `clampBounds(b: MapBounds): MapBounds`
  - `parseMapHash(hash: string): Partial<MapState>`
  - `buildMapHash(s: { type: string; level: number; lat: number; lng: number }): string`
  - `useRealEstateMap(initial)` → `{ type, level, granularity, items, total, exact, pending, hoveredKey, selectedKey, setType, onMapIdle }`
  - `itemKey(item): string`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// frontend/tests/composables/useRealEstateMap.test.ts
import { describe, it, expect } from 'vitest'
import { clampBounds, parseMapHash, buildMapHash, itemKey } from '~/composables/useRealEstateMap'

describe('clampBounds', () => {
  it('한국 영역 밖으로 나간 bbox 를 클램프한다', () => {
    // 지도를 일본까지 끌면 백엔드 Zod 가 422 를 낸다. 클라이언트가 미리 자른다.
    const r = clampBounds({ swLat: 20, swLng: 100, neLat: 45, neLng: 150 })
    expect(r).toEqual({ swLat: 33, swLng: 124, neLat: 39, neLng: 132 })
  })

  it('영역 안 좌표는 그대로 둔다', () => {
    const b = { swLat: 37.4, swLng: 127.0, neLat: 37.6, neLng: 127.2 }
    expect(clampBounds(b)).toEqual(b)
  })
})

describe('map hash', () => {
  it('해시를 파싱한다', () => {
    expect(parseMapHash('#type=villa-rent&level=9&lat=37.5&lng=127.03')).toEqual({
      type: 'villa-rent', level: 9, lat: 37.5, lng: 127.03,
    })
  })

  it('빈 해시는 빈 객체', () => {
    expect(parseMapHash('')).toEqual({})
    expect(parseMapHash('#')).toEqual({})
  })

  it('알 수 없는 type 은 무시한다', () => {
    expect(parseMapHash('#type=bogus&level=9').type).toBeUndefined()
  })

  it('해시를 만든다 — 쿼리스트링(?)이 아니라 해시(#)여야 한다', () => {
    // 쿼리로 새면 Nitro swr 캐시 키가 lat/lng 연속값마다 갈라져 힙을 먹는다(2026-08-02 사고)
    const h = buildMapHash({ type: 'apt-sale', level: 9, lat: 37.5, lng: 127.03 })
    expect(h.startsWith('#')).toBe(true)
    expect(h).not.toContain('?')
  })

  it('왕복이 보존된다', () => {
    const s = { type: 'apt-rent', level: 6, lat: 35.1536, lng: 129.0555 }
    expect(parseMapHash(buildMapHash(s))).toEqual(s)
  })
})

describe('itemKey', () => {
  it('지역 항목은 name+district 로 식별한다', () => {
    expect(itemKey({ name: '서울', district: '강남구' } as never)).toBe('서울|강남구')
  })

  it('건물 항목은 buildingName+district 로 식별한다', () => {
    expect(itemKey({ buildingName: 'A', district: '강남구' } as never)).toBe('A|강남구')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd frontend && npx vitest run tests/composables/useRealEstateMap.test.ts`
Expected: FAIL — `Failed to resolve import "~/composables/useRealEstateMap"`

- [ ] **Step 3: 타입 파일 작성**

```typescript
// frontend/types/realEstateMap.ts
import type { RealEstateType } from '~/types/realEstate'

export type Granularity = 'city' | 'district' | 'building'

export interface MapBounds {
  swLat: number
  swLng: number
  neLat: number
  neLng: number
}

export interface MapRegionItem {
  name: string
  district: string | null
  lat: number
  lng: number
  avgPricePerPyeong: number | null
  transactionCount: number
}

export interface MapBuildingItem {
  buildingName: string
  city: string
  district: string
  dongName: string
  lat: number | null
  lng: number | null
  /** 매매=거래금액, 전월세=보증금 (만원) */
  latestPrice: number | null
  /** null=매매 / 0=전세 / >0=월세 */
  monthlyRent: number | null
  latestDealYear: number | null
  latestDealMonth: number | null
  latestDealDay: number | null
  transactionCount: number
}

export type MapItem = MapRegionItem | MapBuildingItem

export interface MapResponse {
  success: boolean
  data: {
    granularity: Granularity
    items: MapItem[]
    total: number
    exact: boolean
  }
}

export const MAP_TYPES: RealEstateType[] = [
  'apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent',
]

/** 백엔드 KOREA_BOUNDS 와 동일해야 한다. 어긋나면 드래그 시 422 가 난다. */
export const KOREA_BOUNDS = { LAT_MIN: 33, LAT_MAX: 39, LNG_MIN: 124, LNG_MAX: 132 } as const

export function isBuildingItem(i: MapItem): i is MapBuildingItem {
  return 'buildingName' in i
}
```

- [ ] **Step 4: composable 작성**

```typescript
// frontend/composables/useRealEstateMap.ts
import { ref, computed, readonly } from 'vue'
import type { Ref } from 'vue'
import {
  KOREA_BOUNDS, MAP_TYPES, isBuildingItem,
  type Granularity, type MapBounds, type MapItem, type MapResponse,
} from '~/types/realEstateMap'

const DEBOUNCE_MS = 250

/** 지도를 한국 밖으로 끌면 백엔드 Zod 가 422 를 낸다. 요청 전에 잘라 보낸다. */
export function clampBounds(b: MapBounds): MapBounds {
  const c = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
  return {
    swLat: c(b.swLat, KOREA_BOUNDS.LAT_MIN, KOREA_BOUNDS.LAT_MAX),
    neLat: c(b.neLat, KOREA_BOUNDS.LAT_MIN, KOREA_BOUNDS.LAT_MAX),
    swLng: c(b.swLng, KOREA_BOUNDS.LNG_MIN, KOREA_BOUNDS.LNG_MAX),
    neLng: c(b.neLng, KOREA_BOUNDS.LNG_MIN, KOREA_BOUNDS.LNG_MAX),
  }
}

export interface MapHashState {
  type?: string
  level?: number
  lat?: number
  lng?: number
}

export function parseMapHash(hash: string): MapHashState {
  const raw = hash.replace(/^#/, '')
  if (!raw) return {}
  const p = new URLSearchParams(raw)
  const out: MapHashState = {}
  const t = p.get('type')
  if (t && (MAP_TYPES as string[]).includes(t)) out.type = t
  for (const k of ['level', 'lat', 'lng'] as const) {
    const v = p.get(k)
    if (v !== null && v !== '' && Number.isFinite(Number(v))) out[k] = Number(v)
  }
  return out
}

/**
 * 지도 상태는 **해시**에 담는다. 쿼리스트링에 담으면 lat/lng 가 연속값이라
 * Nitro swr('/real-estate/**': swr 300) 캐시 키가 무한히 갈라진다.
 * 2026-08-02 에 같은 계열로 프론트가 힙 한계에 도달해 하루 12~24회 SIGABRT 크래시했다.
 * 해시는 서버로 전송되지 않아 캐시 키에 영향이 없고 canonical 도 갈라지지 않는다.
 */
export function buildMapHash(s: { type: string; level: number; lat: number; lng: number }): string {
  return `#type=${s.type}&level=${s.level}&lat=${s.lat}&lng=${s.lng}`
}

export function itemKey(item: MapItem): string {
  return isBuildingItem(item)
    ? `${item.buildingName}|${item.district}`
    : `${item.name}|${item.district ?? ''}`
}

export function useRealEstateMap(initial: {
  type: string
  items: MapItem[]
  granularity: Granularity
}) {
  const apiBase = useApiBase()

  const type = ref(initial.type)
  const level = ref(13)
  const granularity = ref<Granularity>(initial.granularity)
  const items = ref<MapItem[]>(initial.items) as Ref<MapItem[]>
  const total = ref(initial.items.length)
  const exact = ref(true)
  const pending = ref(false)
  const hoveredKey = ref<string | null>(null)
  const selectedKey = ref<string | null>(null)

  // 빠르게 드래그하면 나중 요청이 먼저 도착한다. 시퀀스로 stale 응답을 버린다.
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null

  async function fetchNow(bounds: MapBounds, lvl: number): Promise<void> {
    const mySeq = ++seq
    pending.value = true
    const b = clampBounds(bounds)
    try {
      const res = await $fetch<MapResponse>(`${apiBase}/api/real-estate/${type.value}/map`, {
        params: {
          level: lvl,
          swLat: b.swLat, swLng: b.swLng, neLat: b.neLat, neLng: b.neLng,
          // 현재 표시 단위를 함께 보낸다. 서버는 무상태라 이걸 받아야 히스테리시스가 걸린다.
          // 없으면 경계(10↔11, 7↔8)에서 좌측 목록과 마커가 왕복하며 깜빡인다.
          prev: granularity.value,
        },
      })
      if (mySeq !== seq) return // stale
      items.value = res.data.items
      granularity.value = res.data.granularity
      total.value = res.data.total
      exact.value = res.data.exact
    } catch {
      // 화면을 비우지 않는다. 직전 결과를 유지한다.
      if (mySeq !== seq) return
    } finally {
      if (mySeq === seq) pending.value = false
    }
  }

  function onMapIdle(bounds: MapBounds, lvl: number): void {
    level.value = lvl
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => void fetchNow(bounds, lvl), DEBOUNCE_MS)
  }

  function setType(next: string, bounds: MapBounds): void {
    type.value = next
    if (timer) clearTimeout(timer)
    void fetchNow(bounds, level.value)
  }

  return {
    type: readonly(type),
    level: readonly(level),
    granularity: readonly(granularity),
    items: readonly(items),
    total: readonly(total),
    exact: readonly(exact),
    pending: readonly(pending),
    hoveredKey,
    selectedKey,
    isBuilding: computed(() => granularity.value === 'building'),
    setType,
    onMapIdle,
    fetchNow,
  }
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useRealEstateMap.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 6: 커밋**

```bash
git add frontend/types/realEstateMap.ts frontend/composables/useRealEstateMap.ts frontend/tests/composables/useRealEstateMap.test.ts
git commit -m "feat(real-estate): 지도 상태 composable — 해시 URL·bbox 클램프·stale 폐기"
```

---

### Task 7: `useMapOverlays` — 가격 라벨·버블 렌더

**Files:**
- Create: `frontend/composables/useMapOverlays.ts`
- Test: `frontend/tests/composables/useMapOverlays.test.ts`

**Interfaces:**
- Consumes: `MapItem`, `isBuildingItem` from `~/types/realEstateMap`
- Produces:
  - `formatPriceLabel(item: MapBuildingItem): string`
  - `formatPyeongLabel(item: MapRegionItem): string`
  - `useMapOverlays()` → `{ renderOverlays(map, items, handlers), clearOverlays() }`

**`useKakaoMap`은 수정하지 않는다.** `map` 인스턴스만 인자로 받는다.

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// frontend/tests/composables/useMapOverlays.test.ts
import { describe, it, expect } from 'vitest'
import { formatPriceLabel, formatPyeongLabel } from '~/composables/useMapOverlays'
import type { MapBuildingItem, MapRegionItem } from '~/types/realEstateMap'

function building(over: Partial<MapBuildingItem>): MapBuildingItem {
  return {
    buildingName: 'A', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: null, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 1,
    ...over,
  }
}

describe('formatPriceLabel', () => {
  it('매매(monthlyRent=null)는 금액만 보여준다', () => {
    expect(formatPriceLabel(building({ latestPrice: 168340, monthlyRent: null }))).toBe('16억 8,340')
  })

  it('전세는 monthlyRent=0 이다 — IS NULL 이 아니다', () => {
    expect(formatPriceLabel(building({ latestPrice: 30000, monthlyRent: 0 }))).toBe('전세 3억')
  })

  it('월세는 보증금·월세를 함께 보여준다', () => {
    expect(formatPriceLabel(building({ latestPrice: 10000, monthlyRent: 80 }))).toBe('월 1억·80')
  })

  it('억 단위가 딱 떨어지지 않으면 만원 자리를 붙인다', () => {
    expect(formatPriceLabel(building({ latestPrice: 45500, monthlyRent: null }))).toBe('4억 5,500')
  })

  it('1억 미만은 만원 단위로만 보여준다', () => {
    expect(formatPriceLabel(building({ latestPrice: 8500, monthlyRent: null }))).toBe('8,500')
  })

  it('가격이 없으면 대시', () => {
    expect(formatPriceLabel(building({ latestPrice: null }))).toBe('—')
  })
})

describe('formatPyeongLabel', () => {
  const region = (p: number | null): MapRegionItem => ({
    name: '서울', district: null, lat: 37.5, lng: 127, avgPricePerPyeong: p, transactionCount: 10,
  })

  it('평당가에 단위를 붙인다', () => {
    expect(formatPyeongLabel(region(7732))).toBe('7,732/평')
  })

  it('1억 이상이면 억 표기', () => {
    expect(formatPyeongLabel(region(16834))).toBe('1억 6,834/평')
  })

  it('데이터 없는 지역은 대시', () => {
    expect(formatPyeongLabel(region(null))).toBe('—')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd frontend && npx vitest run tests/composables/useMapOverlays.test.ts`
Expected: FAIL — `Failed to resolve import "~/composables/useMapOverlays"`

- [ ] **Step 3: 구현**

```typescript
// frontend/composables/useMapOverlays.ts
import { shallowRef } from 'vue'
import { isBuildingItem, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'

/** 만원 단위 금액을 "16억 8,340" / "8,500" 형태로 만든다. */
function formatManwon(manwon: number): string {
  const eok = Math.floor(manwon / 10000)
  const rest = manwon % 10000
  if (eok === 0) return rest.toLocaleString('ko-KR')
  if (rest === 0) return `${eok}억`
  return `${eok}억 ${rest.toLocaleString('ko-KR')}`
}

/**
 * 건물 마커 라벨.
 * monthlyRent 판별식: null=매매 / 0=전세 / >0=월세. IS NULL 을 전세로 쓰지 않는다 —
 * 전월세 타입에서 null 은 summary 미갱신을 뜻한다.
 */
export function formatPriceLabel(item: MapBuildingItem): string {
  if (item.latestPrice == null) return '—'
  const price = formatManwon(item.latestPrice)
  if (item.monthlyRent == null) return price
  if (item.monthlyRent === 0) return `전세 ${price}`
  return `월 ${price}·${item.monthlyRent.toLocaleString('ko-KR')}`
}

/** 지역 버블 라벨. 단위를 명시해 줌 전환 시 의미가 바뀌는 걸 알린다. */
export function formatPyeongLabel(item: MapRegionItem): string {
  if (item.avgPricePerPyeong == null) return '—'
  return `${formatManwon(item.avgPricePerPyeong)}/평`
}

interface OverlayHandlers {
  onClick?: (item: MapItem) => void
  onHover?: (item: MapItem | null) => void
}

/**
 * 가격 라벨·지역 버블 오버레이를 그린다.
 *
 * useKakaoMap 을 확장하지 않고 별도로 두는 이유: useKakaoMap 의 addMarkers 는
 * FacilitySearchItem 전용이고, 시설 상세·건물 상세·공매·청약·지하철 5개 페이지가
 * 이미 쓰고 있다. 확장하면 그 5개가 전부 회귀 표면이 된다.
 */
export function useMapOverlays() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const overlays = shallowRef<any[]>([])

  function clearOverlays(): void {
    for (const o of overlays.value) o.setMap(null)
    overlays.value = []
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function renderOverlays(map: any, items: MapItem[], handlers: OverlayHandlers = {}): void {
    if (!import.meta.client || !map) return
    clearOverlays()

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const kakao = (window as any).kakao
    if (!kakao?.maps) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const next: any[] = []
    for (const item of items) {
      if (item.lat == null || item.lng == null) continue
      const building = isBuildingItem(item)
      const el = document.createElement('div')
      el.className = building ? 'map-price-label' : 'map-region-bubble'
      el.textContent = building
        ? formatPriceLabel(item as MapBuildingItem)
        : formatPyeongLabel(item as MapRegionItem)

      if (handlers.onClick) el.addEventListener('click', () => handlers.onClick!(item))
      if (handlers.onHover) {
        el.addEventListener('mouseenter', () => handlers.onHover!(item))
        el.addEventListener('mouseleave', () => handlers.onHover!(null))
      }

      const overlay = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(item.lat, item.lng),
        content: el,
        yAnchor: 1,
        clickable: true,
      })
      overlay.setMap(map)
      next.push(overlay)
    }
    overlays.value = next
  }

  return { renderOverlays, clearOverlays }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useMapOverlays.test.ts`
Expected: PASS — 9 passed

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useMapOverlays.ts frontend/tests/composables/useMapOverlays.test.ts
git commit -m "feat(real-estate): 지도 오버레이 렌더 — useKakaoMap 무변경"
```

---

### Task 8: `MapFilterBar` + `MapSidebar`

**Files:**
- Create: `frontend/components/realEstate/map/MapFilterBar.vue`
- Create: `frontend/components/realEstate/map/MapSidebar.vue`
- Test: `frontend/tests/components/realEstate/map/MapSidebar.test.ts`

**Interfaces:**
- Consumes: `MapItem`, `isBuildingItem`, `MAP_TYPES`, `formatPriceLabel`, `formatPyeongLabel`, `itemKey`, `SIDO_CHIPS`
- Produces:
  - `MapFilterBar` props `{ type: string }`, emits `{ 'update:type': [string] }`
  - `MapSidebar` props `{ items: MapItem[]; granularity: Granularity; total: number; exact: boolean; pending: boolean; type: string }`, emits `{ hover: [string|null]; select: [MapItem] }`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// frontend/tests/components/realEstate/map/MapSidebar.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapSidebar from '~/components/realEstate/map/MapSidebar.vue'
import type { MapItem } from '~/types/realEstateMap'

const REGIONS: MapItem[] = [
  { name: '서울', district: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 12043 },
  { name: '세종', district: null, lat: 36.48, lng: 127.28, avgPricePerPyeong: null, transactionCount: 0 },
]

const BUILDINGS: MapItem[] = [
  {
    buildingName: '래미안블레스티지', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
  },
]

function mountSidebar(over = {}) {
  return mount(MapSidebar, {
    props: { items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false, type: 'apt-sale', ...over },
  })
}

describe('MapSidebar', () => {
  it('지역 모드에서 시/도 이름과 평당가를 렌더한다', () => {
    const w = mountSidebar()
    expect(w.text()).toContain('서울')
    expect(w.text()).toContain('7,732/평')
  })

  it('데이터 없는 시/도도 링크는 렌더한다 (fail-open)', () => {
    const w = mountSidebar()
    expect(w.text()).toContain('세종')
    expect(w.text()).toContain('—')
  })

  it('집계가 전부 실패해도 시/도 16개 링크를 상수에서 렌더한다', () => {
    // 이게 이 페이지의 유일한 SSR 콘텐츠다. 비면 부동산 허브가 빈 페이지가 된다.
    const w = mountSidebar({ items: [], total: 0 })
    const links = w.findAll('a')
    expect(links.length).toBeGreaterThanOrEqual(16)
    expect(w.text()).toContain('전남·광주')
  })

  it('건물 모드에서 건물명과 가격 라벨을 렌더한다', () => {
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1 })
    expect(w.text()).toContain('래미안블레스티지')
    expect(w.text()).toContain('16억 8,340')
  })

  it('절단되면 total 과 함께 알린다', () => {
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1820, exact: false })
    expect(w.text()).toContain('1,820')
  })

  it('항목 hover 시 키를 emit 한다', async () => {
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1 })
    await w.find('[data-testid="map-sidebar-item"]').trigger('mouseenter')
    expect(w.emitted('hover')?.[0]).toEqual(['래미안블레스티지|강남구'])
  })

  it('인피드 광고 자리를 5번째 항목 뒤에 둔다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...BUILDINGS[0], buildingName: `B${i}` }))
    const w = mountSidebar({ items: many, granularity: 'building', total: 8 })
    expect(w.find('[data-testid="map-sidebar-ad"]').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/map/MapSidebar.test.ts`
Expected: FAIL — `Failed to resolve import "~/components/realEstate/map/MapSidebar.vue"`

- [ ] **Step 3: `MapFilterBar.vue` 작성**

```vue
<template>
  <div class="flex flex-wrap gap-1.5 p-2 bg-white/95 backdrop-blur rounded-xl border border-line shadow-card">
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      type="button"
      class="px-3 py-1.5 min-h-[36px] rounded-lg text-sm font-medium transition-colors"
      :class="opt.value === props.type
        ? 'bg-primary text-white'
        : 'bg-background-light text-slate-700 hover:bg-slate-200'"
      :aria-pressed="opt.value === props.type"
      @click="emit('update:type', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
// 거래 축은 매매/전월세 2종이다. 전세/월세로 나누지 않는 이유는 설계문서 4장 참조 —
// summary 가 건물당 최신 1건만 보유해 전세 필터 시 아파트 44.6%·오피스텔 56.4%가 누락된다.
const OPTIONS = [
  { value: 'apt-sale', label: '아파트 매매' },
  { value: 'apt-rent', label: '아파트 전월세' },
  { value: 'villa-sale', label: '빌라 매매' },
  { value: 'villa-rent', label: '빌라 전월세' },
  { value: 'offitel-sale', label: '오피스텔 매매' },
  { value: 'offitel-rent', label: '오피스텔 전월세' },
] as const

const props = defineProps<{ type: string }>()
const emit = defineEmits<{ 'update:type': [string] }>()
</script>
```

- [ ] **Step 4: `MapSidebar.vue` 작성**

```vue
<template>
  <div class="flex flex-col h-full overflow-y-auto bg-white">
    <div class="px-4 py-3 border-b border-line sticky top-0 bg-white z-10">
      <p class="text-sm font-semibold text-slate-900">{{ heading }}</p>
      <p v-if="!props.exact" class="text-xs text-slate-600 mt-0.5">
        이 영역에 {{ props.total.toLocaleString('ko-KR') }}곳 — 거래량 상위만 표시합니다
      </p>
    </div>

    <ul class="flex-1">
      <template v-for="(row, idx) in rows" :key="row.key">
        <li
          data-testid="map-sidebar-item"
          class="border-b border-line-2"
          @mouseenter="emit('hover', row.key)"
          @mouseleave="emit('hover', null)"
        >
          <NuxtLink
            :to="row.href"
            class="flex items-center justify-between gap-3 px-4 py-3 hover:bg-background-light transition-colors"
            @click="emit('select', row.item)"
          >
            <span class="min-w-0">
              <span class="block text-sm font-medium text-slate-900 truncate">{{ row.title }}</span>
              <span v-if="row.subtitle" class="block text-xs text-slate-600 truncate">{{ row.subtitle }}</span>
            </span>
            <span class="text-sm font-semibold text-primary whitespace-nowrap">{{ row.price }}</span>
          </NuxtLink>
        </li>
        <li v-if="idx === AD_AFTER_INDEX" data-testid="map-sidebar-ad" class="border-b border-line-2 p-2">
          <AdBanner />
        </li>
      </template>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { isBuildingItem, type Granularity, type MapBuildingItem, type MapItem, type MapRegionItem } from '~/types/realEstateMap'
import { formatPriceLabel, formatPyeongLabel } from '~/composables/useMapOverlays'
import { itemKey } from '~/composables/useRealEstateMap'
import { SIDO_CHIPS } from '~/utils/regionChips'
import { toRealEstateUrl, toRealEstateListUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import AdBanner from '~/components/ads/AdBanner.vue'

const AD_AFTER_INDEX = 4 // 5번째 항목 뒤

const props = defineProps<{
  items: MapItem[]
  granularity: Granularity
  total: number
  exact: boolean
  pending: boolean
  type: string
}>()

const emit = defineEmits<{ hover: [string | null]; select: [MapItem] }>()

const heading = computed(() =>
  props.granularity === 'building' ? '이 지역 건물' : '지역별 평균 평당가',
)

interface Row {
  key: string
  title: string
  subtitle: string | null
  price: string
  href: string
  item: MapItem
}

/**
 * 지역 모드의 목록은 **항상 SIDO_CHIPS 16개를 기준**으로 만든다.
 * 집계(items)는 가격을 채우는 데만 쓴다. 집계가 통째로 실패해도 링크 16개가 남아야
 * 이 페이지가 빈 허브가 되지 않는다 — 지도가 SSR 불가라 좌측이 유일한 SSR 콘텐츠다.
 */
const rows = computed<Row[]>(() => {
  if (props.granularity === 'building') {
    return props.items.map((i) => {
      const b = i as MapBuildingItem
      return {
        key: itemKey(i),
        title: b.buildingName,
        subtitle: `${b.city} ${b.district} ${b.dongName}`,
        price: formatPriceLabel(b),
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

  if (props.granularity === 'district') {
    return props.items.map((i) => {
      const r = i as MapRegionItem
      return {
        key: itemKey(i),
        title: r.district ?? r.name,
        subtitle: r.name,
        price: formatPyeongLabel(r),
        href: toRealEstateListUrl({
          type: props.type as RealEstateUrlType,
          city: r.name,
          district: r.district ?? '',
        }),
        item: i,
      }
    })
  }

  const byName = new Map<string, MapRegionItem>()
  for (const i of props.items) {
    if (!isBuildingItem(i)) byName.set((i as MapRegionItem).name, i as MapRegionItem)
  }

  return SIDO_CHIPS.map((chip) => {
    const agg = byName.get(chip.label) ?? byName.get(chip.slug)
    const item: MapRegionItem = agg ?? {
      name: chip.label, district: null, lat: 0, lng: 0, avgPricePerPyeong: null, transactionCount: 0,
    }
    return {
      key: `${chip.label}|`,
      title: chip.label,
      subtitle: null,
      price: formatPyeongLabel(item),
      href: `/real-estate/${props.type}/${chip.slug}`,
      item,
    }
  })
})
</script>
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/map/MapSidebar.test.ts`
Expected: PASS — 7 passed

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/realEstate/map/ frontend/tests/components/realEstate/map/
git commit -m "feat(real-estate): 지도 필터바 + 사이드바 — 지역 링크는 상수 기반 fail-open"
```

---

### Task 9: `RealEstateMapCanvas` + `RealEstateMapExplorer` + `MapBottomSheet`

**Files:**
- Create: `frontend/components/realEstate/map/RealEstateMapCanvas.vue`
- Create: `frontend/components/realEstate/map/MapBottomSheet.vue`
- Create: `frontend/components/realEstate/map/RealEstateMapExplorer.vue`
- Test: `frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts`

**Interfaces:**
- Consumes: `useRealEstateMap`, `useMapOverlays`, `useKakaoMap`(읽기 전용), `MapSidebar`, `MapFilterBar`
- Produces: `RealEstateMapExplorer` props `{ initialType: string; initialItems: MapItem[]; initialGranularity: Granularity }`

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// frontend/tests/components/realEstate/map/RealEstateMapExplorer.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { MapItem } from '~/types/realEstateMap'

const ITEMS: MapItem[] = [
  { name: '서울', district: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 100 },
]

function mountExplorer() {
  return mount(RealEstateMapExplorer, {
    props: { initialType: 'apt-sale', initialItems: ITEMS, initialGranularity: 'city' },
    global: { stubs: { RealEstateMapCanvas: { template: '<div data-testid="canvas" />' } } },
  })
}

describe('RealEstateMapExplorer', () => {
  it('사이드바를 SSR 가능한 형태로 렌더한다 — 지도 없이도 목록이 나온다', () => {
    const w = mountExplorer()
    expect(w.text()).toContain('서울')
  })

  it('필터바를 렌더한다', () => {
    expect(mountExplorer().text()).toContain('아파트 매매')
  })

  it('거래 축이 2종이라 전세/월세 버튼이 없다', () => {
    const t = mountExplorer().text()
    expect(t).toContain('아파트 전월세')
    expect(t).not.toContain('아파트 전세')
    expect(t).not.toContain('아파트 월세')
  })

  it('지도 캔버스는 ClientOnly 안에 있다 — SSR 에서 kakao SDK 를 건드리지 않는다', () => {
    const w = mountExplorer()
    expect(w.html()).not.toContain('window.kakao')
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/map/RealEstateMapExplorer.test.ts`
Expected: FAIL — `Failed to resolve import ".../RealEstateMapExplorer.vue"`

- [ ] **Step 3: `RealEstateMapCanvas.vue` 작성**

```vue
<template>
  <div ref="container" class="w-full h-full bg-background-light" />
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
import { useMapOverlays } from '~/composables/useMapOverlays'
import type { MapBounds, MapItem } from '~/types/realEstateMap'

const props = defineProps<{
  items: MapItem[]
  center: { lat: number; lng: number }
  level: number
}>()

const emit = defineEmits<{
  idle: [MapBounds, number]
  select: [MapItem]
  hover: [MapItem | null]
}>()

const container = ref<HTMLElement | null>(null)
const { map, initMap, getBounds } = useKakaoMap()
const { renderOverlays, clearOverlays } = useMapOverlays()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let idleListener: any = null

function emitIdle(): void {
  if (!import.meta.client || !map.value) return
  const b = getBounds()
  if (!b) return
  emit('idle', { swLat: b.sw.lat, swLng: b.sw.lng, neLat: b.ne.lat, neLng: b.ne.lng }, map.value.getLevel())
}

onMounted(async () => {
  // SDK 로드를 onNuxtReady 이후로 미뤄 좌측 SSR 목록이 LCP 를 잡게 한다.
  if (!import.meta.client || !container.value) return
  await new Promise<void>((r) => onNuxtReady(() => r()))
  // initMap 은 (container, { center, level }) 객체 인자를 받는다 — 위치 인자가 아니다
  await initMap(container.value, { center: props.center, level: props.level })
  if (!map.value) return
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kakao = (window as any).kakao
  idleListener = kakao.maps.event.addListener(map.value, 'idle', emitIdle)
  renderOverlays(map.value, props.items, {
    onClick: (i) => emit('select', i),
    onHover: (i) => emit('hover', i),
  })
  emitIdle()
})

watch(
  () => props.items,
  (items) => {
    if (!import.meta.client || !map.value) return
    renderOverlays(map.value, items, {
      onClick: (i) => emit('select', i),
      onHover: (i) => emit('hover', i),
    })
  },
)

onBeforeUnmount(() => {
  if (!import.meta.client) return
  clearOverlays()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const kakao = (window as any).kakao
  if (idleListener && map.value && kakao?.maps) {
    kakao.maps.event.removeListener(map.value, 'idle', emitIdle)
  }
})
</script>
```

**확인된 시그니처** (`useKakaoMap.ts`, 이 계획은 이 파일을 수정하지 않는다):
- `initMap(container: HTMLElement, options: { center: { lat; lng }; level?: number }): Promise<void>` — 옵션 **객체**를 받는다. `level` 기본값은 15다.
- `getBounds(): { sw: { lat; lng }; ne: { lat; lng } } | null` — 지도가 아직 없으면 `null`. 위 코드의 `if (!b) return` 가드가 그래서 필요하다.

- [ ] **Step 4: `MapBottomSheet.vue` 작성**

```vue
<template>
  <div
    class="lg:hidden fixed inset-x-0 bottom-0 z-30 bg-white rounded-t-2xl shadow-[0_-4px_16px_rgba(0,0,0,0.12)] transition-[height] duration-200"
    :style="{ height: expanded ? '75vh' : '38vh' }"
  >
    <button
      type="button"
      class="w-full flex items-center justify-center py-2 min-h-[44px]"
      :aria-expanded="expanded"
      aria-label="목록 펼치기"
      @click="expanded = !expanded"
    >
      <span class="block w-10 h-1 rounded-full bg-slate-300" />
    </button>
    <!--
      목록만 담는다. 하단 콘텐츠(유형 카드·설명·출처·AdBanner)를 여기 복제하면
      페이지 본문 렌더와 겹쳐 모바일 DOM 에 h2 2개·AdBanner 2개가 생긴다.
      모바일 사용자는 시트를 접거나(핸들) 페이지를 스크롤해 하단 콘텐츠에 도달한다.
    -->
    <div class="h-[calc(100%-2.75rem)] overflow-y-auto">
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
const expanded = ref(false)
</script>
```

- [ ] **Step 5: `RealEstateMapExplorer.vue` 작성**

```vue
<template>
  <section class="relative">
    <div class="lg:flex lg:h-[calc(100vh-4rem)] lg:min-h-[560px]">
      <!-- 좌측: 이 페이지의 유일한 SSR 콘텐츠. ClientOnly 로 감싸지 않는다. -->
      <aside class="hidden lg:block lg:w-[22%] lg:min-w-[280px] lg:max-w-[360px] border-r border-line">
        <MapSidebar
          :items="items as MapItem[]"
          :granularity="granularity"
          :total="total"
          :exact="exact"
          :pending="pending"
          :type="type"
          @hover="hoveredKey = $event"
          @select="onSelect"
        />
      </aside>

      <div class="relative flex-1 h-[60vh] lg:h-auto">
        <div class="absolute top-2 left-2 right-2 z-20">
          <MapFilterBar :type="type" @update:type="onTypeChange" />
        </div>
        <ClientOnly>
          <RealEstateMapCanvas
            :items="items as MapItem[]"
            :center="center"
            :level="level"
            @idle="onIdle"
            @select="onSelect"
            @hover="hoveredKey = $event ? itemKey($event) : null"
          />
          <template #fallback>
            <div class="w-full h-full bg-background-light animate-pulse" />
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- 모바일: 지도 전체 + 하단 바텀시트 -->
    <MapBottomSheet>
      <MapSidebar
        :items="items as MapItem[]"
        :granularity="granularity"
        :total="total"
        :exact="exact"
        :pending="pending"
        :type="type"
        @hover="hoveredKey = $event"
        @select="onSelect"
      />
    </MapBottomSheet>
  </section>
</template>

<script setup lang="ts">
// onMounted 를 명시 import 한다 — 이 컴포넌트는 테스트에서 직접 mount 되므로
// auto-import 에 기대면 로컬은 통과하고 CI 에서만 ReferenceError 가 난다.
import { ref, onMounted } from 'vue'
import MapSidebar from './MapSidebar.vue'
import MapFilterBar from './MapFilterBar.vue'
import RealEstateMapCanvas from './RealEstateMapCanvas.vue'
import MapBottomSheet from './MapBottomSheet.vue'
import { useRealEstateMap, itemKey, buildMapHash, parseMapHash } from '~/composables/useRealEstateMap'
import type { Granularity, MapBounds, MapItem } from '~/types/realEstateMap'

const props = defineProps<{
  initialType: string
  initialItems: MapItem[]
  initialGranularity: Granularity
}>()

const center = ref({ lat: 36.5, lng: 127.8 })
const {
  type, level, granularity, items, total, exact, pending,
  hoveredKey, setType, onMapIdle,
} = useRealEstateMap({
  type: props.initialType,
  items: props.initialItems,
  granularity: props.initialGranularity,
})

let lastBounds: MapBounds = { swLat: 33, swLng: 124, neLat: 39, neLng: 132 }

// SSR 은 항상 시/도 목록을 렌더한다(하이드레이션 일치). 해시는 마운트 후에만 읽어
// 지도를 옮기고, 지도 idle 이 좌측을 갱신한다 — post-hydration 업데이트라 mismatch 가 아니다.
onMounted(() => {
  if (!import.meta.client) return
  const h = parseMapHash(window.location.hash)
  if (h.lat != null && h.lng != null) center.value = { lat: h.lat, lng: h.lng }
})

function syncHash(): void {
  if (!import.meta.client) return
  // 쿼리스트링이 아니라 해시다 — swr 캐시 키 분기 방지(설계문서 5.6)
  history.replaceState(null, '', buildMapHash({
    type: type.value, level: level.value, lat: center.value.lat, lng: center.value.lng,
  }))
}

function onIdle(bounds: MapBounds, lvl: number): void {
  lastBounds = bounds
  center.value = { lat: (bounds.swLat + bounds.neLat) / 2, lng: (bounds.swLng + bounds.neLng) / 2 }
  onMapIdle(bounds, lvl)
  syncHash()
}

function onTypeChange(next: string): void {
  setType(next, lastBounds)
  syncHash()
}

function onSelect(item: MapItem): void {
  if (item.lat != null && item.lng != null) center.value = { lat: item.lat, lng: item.lng }
}
</script>
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/realEstate/map/`
Expected: PASS — MapSidebar 7 + Explorer 4 = 11 passed

- [ ] **Step 7: 커밋**

```bash
git add frontend/components/realEstate/map/ frontend/tests/components/realEstate/map/
git commit -m "feat(real-estate): 분할 레이아웃 지도 화면 + 모바일 바텀시트"
```

---

### Task 10: `/real-estate` 페이지 교체 + SEO 정리

**Files:**
- Modify: `frontend/pages/real-estate/index.vue` (전면 교체)
- Test: `frontend/tests/pages/realEstateMapPage.test.ts`

**Interfaces:**
- Consumes: `RealEstateMapExplorer`, `fetchRegions` API
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: 실패하는 테스트 작성**

```typescript
// frontend/tests/pages/realEstateMapPage.test.ts
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../../pages/real-estate/index.vue', import.meta.url), 'utf-8')

describe('/real-estate 페이지', () => {
  it('지도 탐색 컴포넌트를 쓴다', () => {
    expect(src).toContain('RealEstateMapExplorer')
  })

  it('정적 FAQ 와 FAQPage 스키마를 제거했다', () => {
    // 보일러플레이트 FAQ 는 GSC 색인 감소 진단의 지목 대상이었다(상세는 #625 에서 제거됨)
    expect(src).not.toContain('setFAQSchema')
    expect(src).not.toContain('realEstateFAQs')
  })

  it('크롤 경로인 유형 카드와 ItemList 스키마는 유지한다', () => {
    expect(src).toContain('RealEstateCategoryCards')
    expect(src).toContain('setItemListSchema')
  })

  it('Dataset·Breadcrumb 스키마와 출처 섹션을 유지한다', () => {
    expect(src).toContain('setDatasetSchema')
    expect(src).toContain('setBreadcrumbSchema')
    expect(src).toContain('DataSourceSection')
  })

  it('기존 AdBanner 를 남긴다 (광고 축소 금지)', () => {
    expect(src).toContain('AdBanner')
  })

  it('SSR 집계 실패 시 fail-open — catch 가 빈 배열을 준다', () => {
    expect(src).toMatch(/catch\s*\{[\s\S]*?return \[\]/)
  })
})
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

Run: `cd frontend && npx vitest run tests/pages/realEstateMapPage.test.ts`
Expected: FAIL — `RealEstateMapExplorer` 미포함, `setFAQSchema` 존재

- [ ] **Step 3: 페이지 교체**

`frontend/pages/real-estate/index.vue` 전체를 다음으로 바꾼다.

```vue
<template>
  <div class="bg-background-light">
    <RealEstateMapExplorer
      :initial-type="INITIAL_TYPE"
      :initial-items="regions ?? []"
      initial-granularity="city"
    />

    <!-- 하단 콘텐츠는 여기 한 번만 렌더한다. 바텀시트에 복제하면 모바일 DOM 에
         h2 2개·AdBanner 2개가 생긴다. 모바일은 시트를 접거나 스크롤해 도달한다. -->
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 py-8 md:py-10 flex flex-col gap-3">
      <BelowFoldContent :hub-summaries="hubSummaries ?? undefined" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { h, defineComponent } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import RealEstateCategoryCards from '~/components/realEstate/RealEstateCategoryCards.vue'
import RealEstateMapExplorer from '~/components/realEstate/map/RealEstateMapExplorer.vue'
import type { RealEstateHubType } from '~/types/realEstate'
import type { MapRegionItem, MapResponse } from '~/types/realEstateMap'

const INITIAL_TYPE = 'apt-sale'
const apiBase = useApiBase()

interface HubSummaryResponse {
  success: boolean
  data: Record<RealEstateHubType, { last30dCount: number | null }>
  generatedAt: string
}

// 지도 아래로 이어지는 콘텐츠. 데스크톱 스크롤과 모바일 바텀시트 확장 양쪽에서 재사용한다.
const BelowFoldContent = defineComponent({
  props: { hubSummaries: { type: Object, default: undefined } },
  setup(p) {
    return () => [
      h(SectionBlock, { subtext: '조회할 주택 유형을 선택하세요.' }, {
        heading: () => h('h2', { class: 'text-display-3 text-slate-900' }, '부동산 유형별 실거래가'),
        default: () => h(RealEstateCategoryCards, { summaries: p.hubSummaries }),
      }),
      h(AdBanner),
      h(SectionBlock, {}, {
        heading: () => h('h2', { class: 'text-display-3 text-slate-900' }, '부동산 실거래가란?'),
        default: () => h('p', { class: 'text-base text-slate-600 leading-relaxed' },
          '실거래가는 실제 거래가 완료된 가격으로, 국토교통부에 신고된 공식 데이터입니다. 일상킷은 이를 매일 수집해 아파트·연립다세대(빌라)·오피스텔의 매매·전월세 실거래 내역을 제공합니다.'),
      }),
      h('section', {}, [h(DataSourceSection, { domain: 'real-estate' })]),
    ]
  },
})

// 지도는 SSR 불가라 이 집계가 이 페이지의 유일한 SSR 데이터다.
// 실패해도 [] 를 주면 MapSidebar 가 SIDO_CHIPS 16개 링크를 상수에서 렌더한다(fail-open).
const { data: regions } = await useAsyncData<MapRegionItem[]>(
  'real-estate-map-city',
  async () => {
    try {
      const res = await $fetch<MapResponse>(`${apiBase}/api/real-estate/${INITIAL_TYPE}/map`, {
        params: { level: 13, swLat: 33, swLng: 124, neLat: 39, neLng: 132 },
      })
      return res.data.items as MapRegionItem[]
    } catch {
      return []
    }
  },
  { default: () => [] },
)

const { data: hubSummaries } = await useAsyncData(
  'real-estate-hub-summary',
  async () => {
    try {
      const res = await $fetch<HubSummaryResponse>(`${apiBase}/api/real-estate/hub-summary`)
      return res.data
    } catch {
      return null
    }
  },
  { default: () => null },
)

const { setMeta } = useFacilityMeta()
setMeta({
  title: '부동산 실거래가 지도',
  description: '전국 아파트·빌라·오피스텔의 매매·전월세 실거래가를 지도에서 확인하세요. 지역별 평균 평당가와 건물별 최근 실거래가를 국토교통부 데이터로 제공합니다.',
  path: '/real-estate',
})

// 정적 FAQ 와 FAQPage 스키마는 제거했다 — 보일러플레이트가 GSC 색인 감소 진단의
// 지목 대상이었고 상세 페이지에서는 이미 제거(#625)됐다. 지역 평균 평당가 실데이터가 대체한다.
const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
])
setItemListSchema([
  { name: '아파트 매매', url: '/real-estate/apt-sale' },
  { name: '아파트 전월세', url: '/real-estate/apt-rent' },
  { name: '오피스텔 매매', url: '/real-estate/offitel-sale' },
  { name: '오피스텔 전월세', url: '/real-estate/offitel-rent' },
  { name: '빌라 매매', url: '/real-estate/villa-sale' },
  { name: '빌라 전월세', url: '/real-estate/villa-rent' },
  { name: '토지 실거래가', url: '/real-estate/land' },
])
setDatasetSchema({
  name: '전국 부동산 실거래가 데이터',
  description: '국토교통부 실거래가 공개시스템 기반 전국 아파트·빌라·오피스텔의 매매·전월세 거래 데이터입니다. 지역별 평균 평당가와 건물별 최근 실거래가를 지도로 제공합니다.',
  url: '/real-estate',
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: ['부동산', '실거래가', '아파트', '빌라', '오피스텔', '평당가', '지도', '국토교통부'],
})
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/realEstateMapPage.test.ts`
Expected: PASS — 6 passed

- [ ] **Step 5: 브라우저에서 실제 확인**

백엔드와 프론트를 각각 띄우고 `http://localhost:3000/real-estate`를 연다.

```bash
cd backend && npm run dev &
cd frontend && npm run dev &
sleep 12
curl -s http://localhost:3000/real-estate | grep -o "서울" | head -1
curl -s http://localhost:3000/real-estate | grep -c "FAQPage"
```
Expected: 첫 명령은 `서울` 출력(좌측 목록이 SSR 렌더됨), 두 번째는 `0`(FAQPage 스키마 제거됨).

브라우저에서 확인할 것 — 좌측 목록이 먼저 뜨고 지도가 뒤따르는지, 줌 인하면 좌측이 건물 목록으로 바뀌는지, 콘솔에 hydration 경고가 없는지. `kill %1 %2`로 정리한다.

- [ ] **Step 6: 커밋**

```bash
git add frontend/pages/real-estate/index.vue frontend/tests/pages/realEstateMapPage.test.ts
git commit -m "feat(real-estate): 허브를 지도 탐색 화면으로 교체 + 정적 FAQ 제거"
```

---

### Task 11: 전체 회귀 + 운영 측정 준비

**Files:**
- Test: 기존 테스트 전체 (신규 파일 없음)

**Interfaces:**
- Consumes: 앞선 모든 Task
- Produces: 없음

- [ ] **Step 1: 백엔드 전체 테스트**

```bash
cd backend && npm run test
```
Expected: 전부 PASS. 실패가 있으면 이 계획의 변경이 원인인지 먼저 확인한다 — `serializeRow` export와 `schema.prisma` 인덱스 추가가 유일한 기존 파일 변경이다.

- [ ] **Step 2: 프론트엔드 전체 테스트 — `useKakaoMap` 소비자 회귀 확인**

```bash
cd frontend && npm run test
```
Expected: 전부 PASS. 특히 아래 5개 페이지 관련 테스트가 그대로 통과해야 한다. 이게 "`useKakaoMap`을 건드리지 않는다"는 결정의 검증이다.

- `pages/[category]/[id].vue` (시설 상세)
- `pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue` (건물 상세)
- `pages/auction/item/[cltrMngNo].vue`
- `pages/subscription/[id].vue`
- `pages/subway/[slug].vue`

- [ ] **Step 3: `useKakaoMap` 이 실제로 안 바뀌었는지 확인**

```bash
git diff develop --stat -- frontend/composables/useKakaoMap.ts
```
Expected: 출력 없음. 출력이 있으면 회귀 표면 0 이라는 전제가 깨진 것이므로 되돌린다.

- [ ] **Step 4: lint**

```bash
cd backend && npm run lint && cd ../frontend && npm run lint
```
Expected: 에러 0

- [ ] **Step 5: 빌드 확인**

```bash
cd backend && npm run build && cd ../frontend && npm run build
```
Expected: 둘 다 성공

- [ ] **Step 6: PR 생성**

```bash
git push -u origin HEAD
gh pr create --base develop \
  --title "feat(real-estate): /real-estate 를 지도 탐색 화면으로 전면 교체" \
  --body "$(cat <<'EOF'
설계: docs/superpowers/specs/2026-07-31-real-estate-map-explorer-design.md
계획: docs/superpowers/plans/2026-08-03-real-estate-map-explorer.md

## 요약
부동산 허브를 정적 설명 페이지에서 지도 기반 데이터 화면으로 교체.
좌측 사이드바(줌 아웃=지역 SSR / 줌 인=건물 CSR) + 우측 전체화면 카카오맵.

## 성능 관련 주의점
- bbox 조회는 FORCE INDEX 힌트가 **필수**. 인덱스만 추가하면 옵티마이저가
  transactionCount 역방향 스캔을 골라 21배 느려진다(실측 232ms vs 11ms).
- 지역 집계 날짜 조건은 sargable 형태 필수. 비sargable 은 운영 실측 5,862ms
  vs sargable 529ms — 11배.
- 지도 상태는 해시(#)에 담는다. 쿼리로 새면 Nitro swr 캐시 키가 분기해
  2026-08-02 SIGABRT 사고 경로로 간다.

## SEO
- 정적 FAQ 5개 + FAQPage 스키마 제거
- 유형 카드·ItemList·Dataset·Breadcrumb·DataSourceSection 유지
- 좌측 시/도 16개 링크 + 실제 평균 평당가가 SSR 순증

## 배포 후 필수 측정
1. 인덱스+힌트 적용 후 운영 bbox 재측정 (예상 20~25ms)
2. 야간 sync 창(03:45~04:15 KST) 부하 중 재측정 — 8/03 에 rent 경로가 47배 증폭된 전례
EOF
)"
```

- [ ] **Step 7: 배포 후 측정 (머지 이후 별도 수행)**

운영 배포가 끝나면 아래를 실행해 예상치를 확인한다. 값이 예상을 크게 벗어나면 후속 이슈를 연다.

```sql
-- 1) bbox 최악 케이스 (희소 뷰포트). 적용 전 452ms → 예상 20~25ms
SELECT buildingName, latestPrice, lat, lng
FROM RealEstateBuildingSummary FORCE INDEX (RealEstateBuildingSummary_type_lat_lng_idx)
WHERE type='villa-rent' AND lat BETWEEN 37.60 AND 37.68 AND lng BETWEEN 128.40 AND 128.50
ORDER BY transactionCount DESC LIMIT 200;

-- 2) 인덱스가 실제로 붙었는지
SHOW INDEX FROM RealEstateBuildingSummary WHERE Key_name LIKE '%lat_lng%';
```

야간 sync 창(03:45~04:15 KST)에 같은 쿼리를 한 번 더 돌려, 부하 중 응답이 SSR 예산 안에 들어오는지 확인한다.

---

## 남은 판단 사항

구현 중 결정이 필요하면 사용자에게 확인한다.

- **전월세 지역 버블의 집계 범위** — Task 4는 `monthlyRent = 0`(전세)만으로 평균 평당 보증금을 낸다. 월세 보증금과 전세 보증금은 규모가 달라 섞으면 지역 평균이 무의미해지기 때문이다. 결과적으로 전월세 타입에서 **버블은 전세 기준, 마커는 전월세 혼합**이 된다. UI에 "전세 기준" 표기를 넣을지는 구현 중 사용자에게 확인한다.

## 검증된 외부 시그니처

계획이 호출하는 기존 코드다. 구현 중 다르면 계획이 아니라 호출부를 고친다 — 이 파일들은 수정 대상이 아니다.

| 심볼 | 위치 | 시그니처 |
|---|---|---|
| `initMap` | `composables/useKakaoMap.ts:165` | `(container: HTMLElement, options: { center: {lat,lng}; level?: number }) => Promise<void>` (level 기본 15) |
| `getBounds` | `composables/useKakaoMap.ts:296` | `() => { sw: {lat,lng}; ne: {lat,lng} } \| null` |
| `toRealEstateUrl` | `utils/realEstateUrl.ts:71` | `(parts: { type; city; district; buildingName }) => string` |
| `toRealEstateListUrl` | `utils/realEstateUrl.ts:78` | `(parts: { type; city; district }) => string` |
| `SIDO_CHIPS` | `utils/regionChips.ts:13` | `{ slug: string; label: string }[]` — 활성 광역 **16개** |
| `serializeRow` | `services/realEstateService.ts:147` | `(row: any) => any` — Task 2에서 export 추가 |
| `TABLE_NAME_MAP` | `services/realEstateService.ts:128` | `Record<RealEstateType, string>` |
| `KOREA_BOUNDS` | `constants/geo.ts:4` | `{ LAT_MIN: 33, LAT_MAX: 39, LNG_MIN: 124, LNG_MAX: 132 }` |
