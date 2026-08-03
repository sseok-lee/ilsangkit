# 토지 실거래가 — Plan 1: Core Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 국토교통부 토지 매매 실거래가를 수집하고, 동(법정동) 단위로 집계해 제공하는 백엔드 API를 만든다.

**Architecture:** 토지는 기존 건물 중심 부동산 모듈과 분리된 독립 모듈(`landService` + `routes/land.ts` + `scripts/syncLandSale.ts`). 수집은 기존 `syncRealEstateBase` 유틸을 재사용한다. 동 단위 집계는 `LandAreaSummary` 캐시 테이블에 저장하고, 품질 게이트(`isIndexable`)도 여기서 계산한다.

**Tech Stack:** Express 5 + TypeScript(ESM, `.js` import), Prisma + MySQL 8, Vitest, Zod.

**Spec:** `docs/superpowers/specs/2026-06-04-land-transaction-pages-design.md` (5.1, 5.2, 7.1, 7.2, 7.3절). 보강 데이터(공시지가·지가변동률·용도지역 해설), 인근 동 비교, 프론트엔드는 Plan 2/3에서 다룬다.

**Branch:** `feature/land-transaction-pages` (이미 생성됨, `develop` 기반).

---

## File Structure

| 파일 | 책임 | 신규/수정 |
|---|---|---|
| `backend/prisma/schema.prisma` | `LandSaleTransaction`, `LandAreaSummary` 모델 | 수정 |
| `backend/src/schemas/land.ts` | 토지 API Zod 스키마 | 신규 |
| `backend/src/scripts/syncLandSale.ts` | 토지 매매 API 수집 + 변환 + 집계 갱신 | 신규 |
| `backend/src/services/landService.ts` | 동 목록/상세/허브 조회 | 신규 |
| `backend/src/routes/land.ts` | 토지 API 라우트 | 신규 |
| `backend/src/app.ts` | 라우트 마운트 | 수정 |
| `backend/__tests__/schemas/land.test.ts` | 스키마 테스트 | 신규 |
| `backend/__tests__/scripts/syncLandSale.test.ts` | 변환/수집/집계 테스트 | 신규 |
| `backend/__tests__/services/landService.test.ts` | 서비스 테스트 | 신규 |
| `backend/__tests__/routes/land.test.ts` | 라우트 통합 테스트 | 신규 |

**중요 설계 결정 — 백엔드 `RealEstateTypeSchema`는 건드리지 않는다.** 기존 `/api/real-estate/:type/*` 라우트가 `getModel(type)`로 디스패치하는데, `land`에는 대응 모델이 없다. `land`를 그 enum에 넣으면 그 라우트들이 크래시한다. 토지는 전용 스키마(`schemas/land.ts`)와 전용 라우트(`/api/real-estate/land/*`)로 완전히 분리한다. 프론트엔드 타입에만 `land`를 추가한다(Plan 2).

---

## ✅ Task 0: API 응답 필드명 — 확정됨 (2026-06-04)

PublicDataReader(공식 MOLIT API 미러 라이브러리) 기준으로 `getRTMSDataSvcLandTrade` 응답 태그가 확정되었다. 아래 추정 표의 태그가 **전부 정확**함을 확인:

```
sggCd · sggNm · umdNm · jibun · jimok · landUse · dealArea · dealingGbn ·
dealYear · dealMonth · dealDay · dealAmount · cdealType · cdealDay ·
estateAgentSggNm · shareDealingType
```

**라이브 샘플로 값까지 확정**(2026-06-04, 강남구 11680/202504 실응답):
- `shareDealingType` 실제 값 = `지분` → transform `=== '지분'` 정확.
- `jibun`은 마스킹되어 옴(예: `6**`) — 그대로 저장.
- 빈 값(`cdealDay`/`cdealType`/`estateAgentSggNm`)은 공백 `" "` → `.trim() || null` 처리.
- `dealAmount`는 쉼표 포함(예: `8,709`) → `.replace(/,/g,'')` 처리.

> 참고: data.go.kr는 `curl` 기본 User-Agent를 WAF 차단하나 **Node `fetch`(undici)는 정상** — sync 코드/스모크는 개발 환경에서 그대로 실행 가능. curl 디버깅 시에만 `-A "Mozilla/5.0"` 필요. [[project_datagokr_waf_sandbox]]

<details><summary>원래 검증 절차(참고)</summary>

- [ ] **Step 1: 라이브 샘플 1건 호출**

`OPENAPI_SERVICE_KEY`(이미 발급됨)로 강남구(11680) 최근월 1건 조회:

```bash
curl -s "https://apis.data.go.kr/1613000/RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade?serviceKey=$OPENAPI_SERVICE_KEY&LAWD_CD=11680&DEAL_YMD=202604&numOfRows=3&pageNo=1"
```

- [ ] **Step 2: `<item>` 안의 실제 태그명을 기록**

아래 매핑표의 "추정 태그"를 실제 응답과 대조해 수정한다. 이 표가 이후 Task 3의 `RawLandSaleItem` 인터페이스와 `transformLandSaleItem`의 기준이 된다.

| DB 필드 | 의미 | 추정 태그 | 실제 태그(확인 후 기입) |
|---|---|---|---|
| bjdCode | 지역코드(5) | `sggCd` | |
| dongName | 법정동 | `umdNm` | |
| jibun | 지번 | `jibun` | |
| jimok | 지목 | `jimok` | |
| landUse | 용도지역 | `landUse` | |
| dealArea | 거래면적(㎡) | `dealArea` | |
| dealAmount | 거래금액(만원) | `dealAmount` | |
| shareDeal | 지분구분 | `shareDealingType` | |
| dealType | 거래유형 | `dealingGbn` | |
| dealYear/Month/Day | 계약일 | `dealYear`/`dealMonth`/`dealDay` | |
| cancelDealType | 해제여부 | `cdealType` | |
| cancelDealDay | 해제사유발생일 | `cdealDay` | |

> 응답이 비어있으면(`numOfRows`만큼 안 옴) 다른 최근월(`DEAL_YMD`)로 재시도. `shareDealingType` 값은 보통 `"지분"`/`"일반"` 또는 빈 문자열.

이 task는 코드 변경 없음 — 매핑 확정만. 확정된 태그를 Task 3에 반영한다.
</details>

---

## Task 1: Prisma 모델 — LandSaleTransaction + LandAreaSummary

**Files:**
- Modify: `backend/prisma/schema.prisma` (부동산 매매 모델 블록 끝, `OffitelSaleTransaction`(라인 ~1101) 다음에 추가)

- [ ] **Step 1: 토지 모델 2개 추가**

`schema.prisma`의 `model OffitelSaleTransaction { ... }` 닫는 `}` 바로 다음에 아래를 붙여넣는다:

```prisma
// ============================================
// 부동산 실거래가 - 토지 (매매)
// ============================================

model LandSaleTransaction {
  id             Int       @id @default(autoincrement())
  city           String    @db.VarChar(50)
  district       String    @db.VarChar(50)
  bjdCode        String    @db.VarChar(10)
  dongName       String    @db.VarChar(50)
  jibun          String?   @db.VarChar(20)
  jimok          String?   @db.VarChar(20)
  landUse        String?   @db.VarChar(50)
  dealArea       Decimal?  @db.Decimal(12, 2)
  shareDeal      Boolean   @default(false)
  dealAmount     BigInt
  dealType       String?   @db.VarChar(20)
  dealYear       Int
  dealMonth      Int
  dealDay        Int?
  cancelDealDay  String?   @db.VarChar(10)
  cancelDealType String?   @db.VarChar(20)
  sourceId       String    @unique @db.VarChar(120)
  createdAt      DateTime  @default(now())
  updatedAt      DateTime  @updatedAt
  syncedAt       DateTime  @default(now())

  @@index([bjdCode, dealYear, dealMonth])
  @@index([bjdCode, dongName, dealYear, dealMonth])
  @@index([city, district])
  @@index([jimok])
  @@index([landUse])
  @@index([dealYear, dealMonth])
  @@index([syncedAt])
}

model LandAreaSummary {
  id                Int       @id @default(autoincrement())
  bjdCode           String    @db.VarChar(10)
  dongName          String    @db.VarChar(50)
  city              String    @db.VarChar(50)
  district          String    @db.VarChar(50)
  transactionCount  Int       @default(0)
  recentCount       Int       @default(0)
  avgPricePerPyeong Decimal?  @db.Decimal(14, 2)
  latestDealDate    DateTime?
  jimokBreakdown    Json
  isIndexable       Boolean   @default(false)
  updatedAt         DateTime  @updatedAt

  @@unique([bjdCode, dongName])
  @@index([city, district, transactionCount])
  @@index([isIndexable])
}
```

- [ ] **Step 2: DB 반영 + 클라이언트 생성**

Node 20 환경에서 실행(메모리: 반드시 `nvm use 20`):

Run:
```bash
cd backend && nvm use 20 && npm run db:push && npm run db:generate
```
Expected: `db:push` 가 새 테이블 2개 생성 성공, `db:generate` 가 Prisma Client 재생성 성공(에러 없음).

- [ ] **Step 3: 타입 생성 확인**

Run:
```bash
cd backend && npx tsc --noEmit 2>&1 | grep -i "landSale\|landArea" || echo "OK: no land type errors"
```
Expected: `OK: no land type errors` (모델이 클라이언트에 반영됨).

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(land): add LandSaleTransaction and LandAreaSummary models"
```

---

## Task 2: Zod 스키마 — schemas/land.ts

**Files:**
- Create: `backend/src/schemas/land.ts`
- Test: `backend/__tests__/schemas/land.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/schemas/land.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  LandRegionListSchema,
  LandRegionDetailSchema,
} from '../../src/schemas/land.js';

describe('LandRegionListSchema', () => {
  it('기본값 page=1, limit=20 적용', () => {
    const r = LandRegionListSchema.parse({});
    expect(r.page).toBe(1);
    expect(r.limit).toBe(20);
  });

  it('city/district 필터와 페이지 coerce', () => {
    const r = LandRegionListSchema.parse({ city: '서울특별시', district: '강남구', page: '2', limit: '15' });
    expect(r.city).toBe('서울특별시');
    expect(r.district).toBe('강남구');
    expect(r.page).toBe(2);
    expect(r.limit).toBe(15);
  });
});

describe('LandRegionDetailSchema', () => {
  it('bjdCode + dongName 필수', () => {
    expect(() => LandRegionDetailSchema.parse({ dongName: '역삼동' })).toThrow();
    expect(() => LandRegionDetailSchema.parse({ bjdCode: '11680' })).toThrow();
  });

  it('정상 파싱 + months coerce', () => {
    const r = LandRegionDetailSchema.parse({ bjdCode: '11680', dongName: '역삼동', months: '12' });
    expect(r.bjdCode).toBe('11680');
    expect(r.dongName).toBe('역삼동');
    expect(r.months).toBe(12);
    expect(r.page).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/schemas/land.test.ts`
Expected: FAIL — `Cannot find module '../../src/schemas/land.js'`.

- [ ] **Step 3: 스키마 구현**

`backend/src/schemas/land.ts`:

```typescript
// 토지 실거래가 API Zod 스키마

import { z } from 'zod';

// GET /api/real-estate/land/regions — 동 목록
export const LandRegionListSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type LandRegionList = z.infer<typeof LandRegionListSchema>;

// GET /api/real-estate/land/region — 동 상세
export const LandRegionDetailSchema = z.object({
  bjdCode: z.string().min(1).max(10),
  dongName: z.string().min(1).max(50),
  months: z.coerce.number().int().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type LandRegionDetail = z.infer<typeof LandRegionDetailSchema>;
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/schemas/land.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/schemas/land.ts backend/__tests__/schemas/land.test.ts
git commit -m "feat(land): add Zod schemas for land region APIs"
```

---

## Task 3: 수집 변환 — transformLandSaleItem

**Files:**
- Create: `backend/src/scripts/syncLandSale.ts` (이 task에서는 변환 함수만)
- Test: `backend/__tests__/scripts/syncLandSale.test.ts`

> Task 0에서 확정한 실제 태그명으로 아래 `RawLandSaleItem`/transform/test를 맞춘다. 아래는 추정 태그 기준이므로, 실제와 다르면 동일 위치를 교체.

- [ ] **Step 1: 실패하는 변환 테스트 작성**

`backend/__tests__/scripts/syncLandSale.test.ts`:

```typescript
// 토지 매매 동기화 스크립트 테스트 (TDD)

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockUpsert, mockFindUnique, mockFindMany, mockTransaction } = vi.hoisted(() => ({
  mockUpsert: vi.fn(),
  mockFindUnique: vi.fn(),
  mockFindMany: vi.fn(),
  mockTransaction: vi.fn((fn) => fn()),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    landSaleTransaction: { upsert: mockUpsert, findUnique: mockFindUnique },
    region: { findMany: mockFindMany },
    $transaction: mockTransaction,
  },
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

import {
  transformLandSaleItem,
  syncLandSaleByLawd,
  type RawLandSaleItem,
} from '../../src/scripts/syncLandSale.js';

describe('transformLandSaleItem', () => {
  it('API 응답 item을 DB 필드로 변환', () => {
    const item: RawLandSaleItem = {
      sggCd: '11680',
      umdNm: '역삼동',
      jibun: '123-4',
      jimok: '대',
      landUse: '제2종일반주거지역',
      dealArea: '198.30',
      dealAmount: '1,500,000',
      shareDealingType: '일반',
      dealingGbn: '중개거래',
      dealYear: '2026',
      dealMonth: '3',
      dealDay: '15',
      cdealType: '',
      cdealDay: '',
      city: '서울특별시',
      district: '강남구',
    };

    const r = transformLandSaleItem(item);
    expect(r.bjdCode).toBe('11680');
    expect(r.dongName).toBe('역삼동');
    expect(r.jibun).toBe('123-4');
    expect(r.jimok).toBe('대');
    expect(r.landUse).toBe('제2종일반주거지역');
    expect(r.dealArea).toBe('198.30');
    expect(r.dealAmount).toBe(1500000n);
    expect(r.shareDeal).toBe(false);
    expect(r.dealType).toBe('중개거래');
    expect(r.dealYear).toBe(2026);
    expect(r.dealMonth).toBe(3);
    expect(r.dealDay).toBe(15);
    expect(r.cancelDealType).toBeNull();
    expect(r.city).toBe('서울특별시');
    expect(r.district).toBe('강남구');
  });

  it('지분거래 구분 → shareDeal true', () => {
    const item = makeItem({ shareDealingType: '지분' });
    expect(transformLandSaleItem(item).shareDeal).toBe(true);
  });

  it('선택 필드 없을 때 null 처리', () => {
    const item = makeItem({ jibun: '', jimok: '', landUse: '', dealDay: '', dealingGbn: '', dealArea: '' });
    const r = transformLandSaleItem(item);
    expect(r.jibun).toBeNull();
    expect(r.jimok).toBeNull();
    expect(r.landUse).toBeNull();
    expect(r.dealDay).toBeNull();
    expect(r.dealType).toBeNull();
    expect(r.dealArea).toBeNull();
  });

  it('sourceId 형식 검증 (category-bjdCode-dong-jibun-year-month-day-area-amount)', () => {
    const item = makeItem({});
    const r = transformLandSaleItem(item);
    expect(r.sourceId).toBe('landSale-11680-역삼동-123-4-2026-3-15-198.30-1500000');
  });
});

function makeItem(overrides: Partial<RawLandSaleItem>): RawLandSaleItem {
  return {
    sggCd: '11680', umdNm: '역삼동', jibun: '123-4', jimok: '대',
    landUse: '제2종일반주거지역', dealArea: '198.30', dealAmount: '1,500,000',
    shareDealingType: '일반', dealingGbn: '중개거래',
    dealYear: '2026', dealMonth: '3', dealDay: '15', cdealType: '', cdealDay: '',
    city: '서울특별시', district: '강남구',
    ...overrides,
  };
}
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/scripts/syncLandSale.test.ts`
Expected: FAIL — `Cannot find module '../../src/scripts/syncLandSale.js'`.

- [ ] **Step 3: 변환 함수 구현 (파일 생성)**

`backend/src/scripts/syncLandSale.ts`:

```typescript
#!/usr/bin/env tsx
// 토지 매매 실거래가 동기화 스크립트

import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import {
  fetchRealEstateData,
  generateSourceId,
  getAllLawdCodes,
} from '../services/syncRealEstateBase.js';
import { runSync, batchUpsert, transformAndDedupe } from '../services/baseSyncService.js';

const API_ENDPOINT = 'RTMSDataSvcLandTrade/getRTMSDataSvcLandTrade';
const CATEGORY = 'landSale';

export interface RawLandSaleItem extends Record<string, unknown> {
  sggCd: string;
  umdNm: string;
  jibun: string;
  jimok: string;
  landUse: string;
  dealArea: string;
  dealAmount: string;
  shareDealingType: string;
  dealingGbn: string;
  dealYear: string;
  dealMonth: string;
  dealDay: string;
  cdealType: string;
  cdealDay: string;
  city: string;
  district: string;
}

function parseIntOrNull(value: string): number | null {
  const t = String(value ?? '').trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return isNaN(n) ? null : n;
}

export function transformLandSaleItem(item: RawLandSaleItem) {
  const bjdCode = String(item.sggCd ?? '').trim();
  const dongName = String(item.umdNm ?? '').trim();
  const jibunStr = String(item.jibun ?? '').trim();
  const jimokStr = String(item.jimok ?? '').trim();
  const landUseStr = String(item.landUse ?? '').trim();
  const areaStr = String(item.dealArea ?? '').trim();
  const dayStr = String(item.dealDay ?? '').trim();
  const dealTypeStr = String(item.dealingGbn ?? '').trim();
  const dealYear = parseInt(String(item.dealYear ?? '').trim(), 10);
  const dealMonth = parseInt(String(item.dealMonth ?? '').trim(), 10);

  const dealAmountStr = String(item.dealAmount ?? '').replace(/,/g, '').trim();
  const dealAmountVal = BigInt(dealAmountStr || '0');

  const shareDeal = String(item.shareDealingType ?? '').trim() === '지분';

  const sourceId = generateSourceId(CATEGORY, {
    bjdCode: `${bjdCode}-${dongName}-${jibunStr}`,
    buildYear: '',
    dealYear: String(dealYear),
    dealMonth: String(dealMonth),
    dealDay: dayStr,
    floor: '',
    area: areaStr,
    dealAmount: dealAmountStr,
  }).replace('landSale--', 'landSale-'); // buildYear/floor 자리 비움 정리

  return {
    sourceId,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName,
    jibun: jibunStr || null,
    jimok: jimokStr || null,
    landUse: landUseStr || null,
    dealArea: areaStr || null,
    shareDeal,
    dealAmount: dealAmountVal,
    dealType: dealTypeStr || null,
    dealYear,
    dealMonth,
    dealDay: parseIntOrNull(dayStr),
    cancelDealDay: String(item.cdealDay ?? '').trim() || null,
    cancelDealType: String(item.cdealType ?? '').trim() || null,
  };
}
```

> **sourceId 주의:** `generateSourceId`는 고정 필드 순서(category-bjdCode-buildYear-dealYear-...)를 쓴다. 토지는 buildYear/floor가 없으므로 `bjdCode` 자리에 `{sggCd}-{dong}-{jibun}` 합성 키를 넣고 buildYear/floor는 빈 문자열로 둔다. 테스트의 기대 sourceId(`landSale-11680-역삼동-123-4-2026-3-15-198.30-1500000`)와 정확히 일치하도록 `generateSourceId` 출력 형식을 확인하라. 만약 빈 buildYear/floor 때문에 `--`가 생기면 위 `.replace`로 정리하거나, 더 단순하게 **직접 문자열 조합**으로 구현해도 된다:
> ```typescript
> const sourceId = ['landSale', bjdCode, dongName, jibunStr, dealYear, dealMonth, dayStr, areaStr, dealAmountStr].join('-');
> ```
> (테스트 기대값과 정확히 맞는 쪽을 선택. 권장: 위 직접 조합 — 명확함.)

- [ ] **Step 4: 변환 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/scripts/syncLandSale.test.ts -t transformLandSaleItem`
Expected: PASS (4 tests). 실패 시 sourceId 조합 로직을 테스트 기대값에 맞춘다.

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/syncLandSale.ts backend/__tests__/scripts/syncLandSale.test.ts
git commit -m "feat(land): add transformLandSaleItem with TDD"
```

---

## Task 4: 수집 실행 — syncLandSaleByLawd

**Files:**
- Modify: `backend/src/scripts/syncLandSale.ts` (수집 함수 + main 추가)
- Test: `backend/__tests__/scripts/syncLandSale.test.ts` (수집 describe 추가)

- [ ] **Step 1: 실패하는 수집 테스트 추가**

`syncLandSale.test.ts` 파일 끝에 추가:

```typescript
describe('syncLandSaleByLawd', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('API 응답에서 데이터를 가져와 upsert 수행', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header>
  <body>
    <totalCount>1</totalCount>
    <items>
      <item>
        <sggCd>11680</sggCd><umdNm>역삼동</umdNm><jibun>123-4</jibun>
        <jimok>대</jimok><landUse>제2종일반주거지역</landUse>
        <dealArea>198.30</dealArea><dealAmount>1,500,000</dealAmount>
        <shareDealingType>일반</shareDealingType><dealingGbn>중개거래</dealingGbn>
        <dealYear>2026</dealYear><dealMonth>3</dealMonth><dealDay>15</dealDay>
      </item>
    </items>
  </body>
</response>`;
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => xml });
    mockUpsert.mockResolvedValue({ id: 1 });
    const regionMap = new Map([['11680', { city: '서울특별시', district: '강남구' }]]);

    await syncLandSaleByLawd('11680', '202603', 'test-key', regionMap);

    expect(mockFetch).toHaveBeenCalledOnce();
    expect(mockUpsert).toHaveBeenCalledOnce();
  });

  it('빈 items이면 upsert 안함', async () => {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header>
<body><totalCount>0</totalCount><items/></body></response>`;
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => xml });
    const regionMap = new Map([['11680', { city: '서울특별시', district: '강남구' }]]);

    await syncLandSaleByLawd('11680', '202603', 'test-key', regionMap);

    expect(mockUpsert).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/scripts/syncLandSale.test.ts -t syncLandSaleByLawd`
Expected: FAIL — `syncLandSaleByLawd is not a function`.

- [ ] **Step 3: 수집 함수 + main 구현**

`syncLandSale.ts`의 `transformLandSaleItem` 아래에 추가:

```typescript
export async function syncLandSaleByLawd(
  lawdCd: string,
  dealYmd: string,
  serviceKey: string,
  regionMap: Map<string, { city: string; district: string }>
): Promise<void> {
  const items = await fetchRealEstateData(API_ENDPOINT, lawdCd, dealYmd, serviceKey);
  if (items.length === 0) return;

  const regionInfo = regionMap.get(lawdCd) ?? { city: '', district: '' };
  const enriched = items.map((item) => ({
    ...(item as Record<string, unknown>),
    city: regionInfo.city,
    district: regionInfo.district,
  })) as RawLandSaleItem[];

  const stats = { totalRecords: 0, newRecords: 0, updatedRecords: 0, skippedRecords: 0, errors: [] as string[] };
  const records = transformAndDedupe(enriched, transformLandSaleItem, (r) => r.sourceId, stats);
  if (records.length === 0) return;

  await batchUpsert(records, async (record) => {
    const existing = await prisma.landSaleTransaction.findUnique({
      where: { sourceId: record.sourceId },
      select: { id: true },
    });
    await prisma.landSaleTransaction.upsert({
      where: { sourceId: record.sourceId },
      create: { ...record, syncedAt: new Date() },
      update: { ...record, syncedAt: new Date() },
    });
    return existing ? 'updated' : 'new';
  });
}

async function main(): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY environment variable is not set');

  const args = process.argv.slice(2);
  const lawdIndex = args.indexOf('--lawd');
  const ymIndex = args.indexOf('--ym');
  const lawdCdArg = lawdIndex !== -1 ? args[lawdIndex + 1] : undefined;
  const dealYmdArg = ymIndex !== -1 ? args[ymIndex + 1] : undefined;

  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = new Map(regions.map((r) => [r.bjdCode, { city: r.city, district: r.district }]));

  await runSync(CATEGORY, async () => {
    const lawdCodes = lawdCdArg ? [lawdCdArg] : await getAllLawdCodes();
    const now = new Date();
    const ymList: string[] = [];
    if (dealYmdArg) {
      ymList.push(dealYmdArg);
    } else {
      for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        ymList.push(`${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`);
      }
    }
    console.info(`[landSale] 시작: ${lawdCodes.length}개 지역, ${ymList.length}개 월`);
    for (const lawdCd of lawdCodes) {
      for (const ym of ymList) {
        try {
          await syncLandSaleByLawd(lawdCd, ym, serviceKey, regionMap);
        } catch (error) {
          const msg = error instanceof Error ? error.message : 'Unknown error';
          console.error(`[landSale] ${lawdCd}/${ym} 실패: ${msg}`);
        }
      }
    }
  });

  // 집계 갱신 (Task 5에서 구현되는 refreshLandAreaSummary 호출)
  await refreshLandAreaSummary();

  console.info('\n=== landSale sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  installRuntimeGuard({ maxMinutes: 20, name: 'syncLandSale', prisma });
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
```

> `main`이 `refreshLandAreaSummary`를 호출하지만 함수는 Task 5에서 정의한다. 이 task에서는 `refreshLandAreaSummary`를 임시 빈 export로 먼저 추가해 컴파일을 통과시킨다:
> ```typescript
> export async function refreshLandAreaSummary(): Promise<void> { /* Task 5에서 구현 */ }
> ```
> (파일 상단 import 아래, transform 위에 둔다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/scripts/syncLandSale.test.ts`
Expected: PASS (전체 6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/syncLandSale.ts backend/__tests__/scripts/syncLandSale.test.ts
git commit -m "feat(land): add syncLandSaleByLawd fetch+upsert with TDD"
```

---

## Task 5: 집계 갱신 + 품질 게이트 — refreshLandAreaSummary

**Files:**
- Modify: `backend/src/scripts/syncLandSale.ts` (빈 `refreshLandAreaSummary`를 실제 구현으로 교체)
- Modify: `backend/__tests__/scripts/syncLandSale.test.ts` (집계 로직 순수 함수 테스트)

집계 핵심 로직(평당가 평균, recentCount, isIndexable)을 **순수 함수**로 분리해 DB 없이 테스트한다.

- [ ] **Step 1: 실패하는 집계 로직 테스트 추가**

`syncLandSale.test.ts` 끝에 추가:

```typescript
import { computeAreaSummary, type LandTxnForSummary } from '../../src/scripts/syncLandSale.js';

describe('computeAreaSummary', () => {
  const now = new Date('2026-06-01T00:00:00Z');

  it('평당가 평균 = 거래금액(만원) / (면적/3.305) 의 평균', () => {
    const txns: LandTxnForSummary[] = [
      { dealAmount: 1500000, dealArea: 198.3, dealYear: 2026, dealMonth: 3, jimok: '대' },
    ];
    const s = computeAreaSummary(txns, now);
    // 평당 = 1,500,000 / (198.3/3.305) = 1,500,000 / 60.0 ≈ 25000.x
    expect(s.avgPricePerPyeong).toBeGreaterThan(24000);
    expect(s.avgPricePerPyeong).toBeLessThan(26000);
    expect(s.transactionCount).toBe(1);
  });

  it('recentCount = 최근 12개월 거래 수', () => {
    const txns: LandTxnForSummary[] = [
      { dealAmount: 100, dealArea: 100, dealYear: 2026, dealMonth: 5, jimok: '대' }, // recent
      { dealAmount: 100, dealArea: 100, dealYear: 2024, dealMonth: 1, jimok: '전' }, // old
    ];
    const s = computeAreaSummary(txns, now);
    expect(s.transactionCount).toBe(2);
    expect(s.recentCount).toBe(1);
  });

  it('isIndexable: recentCount>=5 또는 transactionCount>=10', () => {
    const recent = (n: number) => Array.from({ length: n }, () => ({ dealAmount: 100, dealArea: 100, dealYear: 2026, dealMonth: 5, jimok: '대' }));
    expect(computeAreaSummary(recent(5), now).isIndexable).toBe(true);
    expect(computeAreaSummary(recent(4), now).isIndexable).toBe(false);
    const old = Array.from({ length: 10 }, () => ({ dealAmount: 100, dealArea: 100, dealYear: 2024, dealMonth: 1, jimok: '대' }));
    expect(computeAreaSummary(old, now).isIndexable).toBe(true); // total>=10
  });

  it('jimokBreakdown: 지목별 건수 집계', () => {
    const txns: LandTxnForSummary[] = [
      { dealAmount: 100, dealArea: 100, dealYear: 2026, dealMonth: 5, jimok: '대' },
      { dealAmount: 100, dealArea: 100, dealYear: 2026, dealMonth: 5, jimok: '대' },
      { dealAmount: 100, dealArea: 100, dealYear: 2026, dealMonth: 5, jimok: '전' },
    ];
    const s = computeAreaSummary(txns, now);
    expect(s.jimokBreakdown).toEqual({ '대': 2, '전': 1 });
  });

  it('면적 0/누락 거래는 평당가 계산에서 제외', () => {
    const txns: LandTxnForSummary[] = [
      { dealAmount: 1500000, dealArea: 198.3, dealYear: 2026, dealMonth: 3, jimok: '대' },
      { dealAmount: 100, dealArea: 0, dealYear: 2026, dealMonth: 3, jimok: '대' },
    ];
    const s = computeAreaSummary(txns, now);
    expect(s.transactionCount).toBe(2);
    expect(s.avgPricePerPyeong).toBeGreaterThan(24000); // 0면적 건 제외되어 첫 건만 반영
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/scripts/syncLandSale.test.ts -t computeAreaSummary`
Expected: FAIL — `computeAreaSummary is not a function`.

- [ ] **Step 3: 순수 함수 + DB 갱신 구현**

`syncLandSale.ts`의 임시 `refreshLandAreaSummary`를 아래로 교체(상수 + 순수 함수 + DB 갱신):

```typescript
const PYEONG_PER_SQM = 3.305;
const RECENT_MONTHS = 12;
const INDEX_RECENT_MIN = 5;
const INDEX_TOTAL_MIN = 10;

export interface LandTxnForSummary {
  dealAmount: number;
  dealArea: number;
  dealYear: number;
  dealMonth: number;
  jimok: string | null;
}

export interface AreaSummaryResult {
  transactionCount: number;
  recentCount: number;
  avgPricePerPyeong: number | null;
  jimokBreakdown: Record<string, number>;
  isIndexable: boolean;
}

export function computeAreaSummary(txns: LandTxnForSummary[], now: Date): AreaSummaryResult {
  const cutoff = new Date(now.getFullYear(), now.getMonth() - RECENT_MONTHS + 1, 1);
  let recentCount = 0;
  const pyeongPrices: number[] = [];
  const jimokBreakdown: Record<string, number> = {};

  for (const t of txns) {
    const txnDate = new Date(t.dealYear, t.dealMonth - 1, 1);
    if (txnDate >= cutoff) recentCount++;

    if (t.dealArea && t.dealArea > 0) {
      const pyeong = t.dealArea / PYEONG_PER_SQM;
      pyeongPrices.push(t.dealAmount / pyeong);
    }
    const key = t.jimok && t.jimok.trim() ? t.jimok.trim() : '기타';
    jimokBreakdown[key] = (jimokBreakdown[key] ?? 0) + 1;
  }

  const avgPricePerPyeong = pyeongPrices.length
    ? Math.round((pyeongPrices.reduce((a, b) => a + b, 0) / pyeongPrices.length) * 100) / 100
    : null;
  const transactionCount = txns.length;
  const isIndexable = recentCount >= INDEX_RECENT_MIN || transactionCount >= INDEX_TOTAL_MIN;

  return { transactionCount, recentCount, avgPricePerPyeong, jimokBreakdown, isIndexable };
}

export async function refreshLandAreaSummary(): Promise<void> {
  // (bjdCode, dongName) 그룹별로 거래를 모아 집계 후 upsert
  const groups = await prisma.landSaleTransaction.findMany({
    select: { bjdCode: true, dongName: true, city: true, district: true },
    distinct: ['bjdCode', 'dongName'],
  });
  const now = new Date();

  for (const g of groups) {
    const rows = await prisma.landSaleTransaction.findMany({
      where: { bjdCode: g.bjdCode, dongName: g.dongName, cancelDealDay: null },
      select: { dealAmount: true, dealArea: true, dealYear: true, dealMonth: true, dealDay: true, jimok: true },
    });
    const txns: LandTxnForSummary[] = rows.map((r) => ({
      dealAmount: Number(r.dealAmount),
      dealArea: r.dealArea ? Number(r.dealArea) : 0,
      dealYear: r.dealYear,
      dealMonth: r.dealMonth,
      jimok: r.jimok,
    }));
    const summary = computeAreaSummary(txns, now);

    // 최신 거래일 계산
    const latest = rows.reduce<Date | null>((acc, r) => {
      const d = new Date(r.dealYear, r.dealMonth - 1, r.dealDay ?? 1);
      return !acc || d > acc ? d : acc;
    }, null);

    await prisma.landAreaSummary.upsert({
      where: { bjdCode_dongName: { bjdCode: g.bjdCode, dongName: g.dongName } },
      create: {
        bjdCode: g.bjdCode, dongName: g.dongName, city: g.city, district: g.district,
        transactionCount: summary.transactionCount, recentCount: summary.recentCount,
        avgPricePerPyeong: summary.avgPricePerPyeong, latestDealDate: latest,
        jimokBreakdown: summary.jimokBreakdown, isIndexable: summary.isIndexable,
      },
      update: {
        city: g.city, district: g.district,
        transactionCount: summary.transactionCount, recentCount: summary.recentCount,
        avgPricePerPyeong: summary.avgPricePerPyeong, latestDealDate: latest,
        jimokBreakdown: summary.jimokBreakdown, isIndexable: summary.isIndexable,
      },
    });
  }
  console.info(`[landSale] LandAreaSummary 갱신: ${groups.length}개 동`);
}
```

> Task 4에서 넣은 임시 빈 `refreshLandAreaSummary`는 삭제하고 위 구현으로 대체한다(중복 정의 금지).

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/scripts/syncLandSale.test.ts`
Expected: PASS (전체 11 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/syncLandSale.ts backend/__tests__/scripts/syncLandSale.test.ts
git commit -m "feat(land): add LandAreaSummary aggregation + quality gate with TDD"
```

---

## Task 6: 서비스 — getRegionList

**Files:**
- Create: `backend/src/services/landService.ts`
- Test: `backend/__tests__/services/landService.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/services/landService.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockSummaryFindMany, mockSummaryCount } = vi.hoisted(() => ({
  mockSummaryFindMany: vi.fn(),
  mockSummaryCount: vi.fn(),
}));

vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    landAreaSummary: { findMany: mockSummaryFindMany, count: mockSummaryCount },
  },
}));

import { getRegionList } from '../../src/services/landService.js';

describe('getRegionList', () => {
  beforeEach(() => vi.clearAllMocks());

  it('동 목록을 transactionCount 내림차순으로 반환 + 페이지네이션', async () => {
    mockSummaryFindMany.mockResolvedValue([
      { bjdCode: '11680', dongName: '역삼동', city: '서울특별시', district: '강남구',
        transactionCount: 12, avgPricePerPyeong: '25000', latestDealDate: new Date('2026-03-15'), isIndexable: true },
    ]);
    mockSummaryCount.mockResolvedValue(1);

    const r = await getRegionList({ city: '서울특별시', district: '강남구', page: 1, limit: 20 });

    expect(r.total).toBe(1);
    expect(r.items[0].dongName).toBe('역삼동');
    expect(r.items[0].avgPricePerPyeong).toBe(25000); // Decimal → number
    expect(mockSummaryFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { city: '서울특별시', district: '강남구' },
        orderBy: { transactionCount: 'desc' },
        skip: 0,
        take: 20,
      })
    );
  });

  it('필터 없으면 where 빈 객체', async () => {
    mockSummaryFindMany.mockResolvedValue([]);
    mockSummaryCount.mockResolvedValue(0);
    await getRegionList({ page: 1, limit: 20 });
    expect(mockSummaryFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/landService.test.ts`
Expected: FAIL — `Cannot find module '../../src/services/landService.js'`.

- [ ] **Step 3: 서비스 구현 (파일 생성)**

`backend/src/services/landService.ts`:

```typescript
import { prisma } from '../lib/prisma.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeRow(row: any): any {
  const result = { ...row };
  for (const key of Object.keys(result)) {
    const v = result[key];
    if (typeof v === 'bigint') result[key] = Number(v);
    // Prisma Decimal → number
    else if (v && typeof v === 'object' && typeof v.toNumber === 'function') result[key] = v.toNumber();
  }
  return result;
}

export interface RegionListParams {
  city?: string;
  district?: string;
  page: number;
  limit: number;
}

export interface RegionListResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
}

export async function getRegionList(params: RegionListParams): Promise<RegionListResult> {
  const { city, district, page, limit } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};
  if (city) where.city = city;
  if (district) where.district = district;

  const skip = (page - 1) * limit;
  const [rows, total] = await Promise.all([
    prisma.landAreaSummary.findMany({
      where,
      orderBy: { transactionCount: 'desc' },
      skip,
      take: limit,
    }),
    prisma.landAreaSummary.count({ where }),
  ]);

  return {
    items: rows.map(serializeRow),
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/landService.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/landService.ts backend/__tests__/services/landService.test.ts
git commit -m "feat(land): add landService.getRegionList with TDD"
```

---

## Task 7: 서비스 — getRegionDetail (거래내역 + 평당가 시계열 + 분포)

**Files:**
- Modify: `backend/src/services/landService.ts`
- Modify: `backend/__tests__/services/landService.test.ts`

> 인근 동 비교와 보강 데이터(공시 배율/지가변동률)는 Plan 3에서 추가. 여기서는 거래내역·시계열·지목/용도지역 분포까지.

- [ ] **Step 1: 실패하는 테스트 추가**

`landService.test.ts`의 `vi.hoisted` 블록에 `landSaleTransaction` mock을 추가하고(아래) detail 테스트를 더한다.

`vi.hoisted` 교체:
```typescript
const { mockSummaryFindMany, mockSummaryCount, mockTxnFindMany, mockTxnCount } = vi.hoisted(() => ({
  mockSummaryFindMany: vi.fn(),
  mockSummaryCount: vi.fn(),
  mockTxnFindMany: vi.fn(),
  mockTxnCount: vi.fn(),
}));
```
`vi.mock` 교체:
```typescript
vi.mock('../../src/lib/prisma.js', () => ({
  prisma: {
    landAreaSummary: { findMany: mockSummaryFindMany, count: mockSummaryCount },
    landSaleTransaction: { findMany: mockTxnFindMany, count: mockTxnCount },
  },
}));
```
import 교체:
```typescript
import { getRegionList, getRegionDetail } from '../../src/services/landService.js';
```
파일 끝에 추가:
```typescript
describe('getRegionDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('거래내역 + 평당가 시계열 + 지목/용도지역 분포 반환', async () => {
    const rows = [
      { id: 1, jibun: '123-4', jimok: '대', landUse: '제2종일반주거지역', dealArea: 198.3,
        shareDeal: false, dealAmount: 1500000n, dealType: '중개거래', dealYear: 2026, dealMonth: 3, dealDay: 15 },
      { id: 2, jibun: '567', jimok: '전', landUse: '계획관리지역', dealArea: 330,
        shareDeal: false, dealAmount: 990000n, dealType: '직거래', dealYear: 2026, dealMonth: 1, dealDay: 5 },
    ];
    // 첫 호출: 페이지네이션용 거래내역, 둘째 호출: 통계용 전체 거래
    mockTxnFindMany.mockResolvedValueOnce(rows).mockResolvedValueOnce(rows);
    mockTxnCount.mockResolvedValue(2);

    const r = await getRegionDetail({ bjdCode: '11680', dongName: '역삼동', page: 1, limit: 20 });

    expect(r.total).toBe(2);
    expect(r.items[0].pricePerPyeong).toBeGreaterThan(0); // 평당가 비정규화
    expect(r.items[0].dealAmount).toBe(1500000); // BigInt → number
    expect(r.jimokDistribution).toEqual(expect.arrayContaining([
      { jimok: '대', count: 1 }, { jimok: '전', count: 1 },
    ]));
    expect(r.landUseDistribution).toEqual(expect.arrayContaining([
      { landUse: '제2종일반주거지역', count: 1 }, { landUse: '계획관리지역', count: 1 },
    ]));
    expect(r.priceTimeline.length).toBeGreaterThan(0);
    expect(r.priceTimeline[0]).toHaveProperty('year');
    expect(r.priceTimeline[0]).toHaveProperty('avgPricePerPyeong');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/landService.test.ts -t getRegionDetail`
Expected: FAIL — `getRegionDetail is not a function`.

- [ ] **Step 3: getRegionDetail 구현**

`landService.ts`에 추가:

```typescript
const PYEONG_PER_SQM = 3.305;

function pricePerPyeong(dealAmount: number, dealArea: number | null): number | null {
  if (!dealArea || dealArea <= 0) return null;
  return Math.round((dealAmount / (dealArea / PYEONG_PER_SQM)) * 100) / 100;
}

export interface RegionDetailParams {
  bjdCode: string;
  dongName: string;
  months?: number;
  page: number;
  limit: number;
}

export interface RegionDetailResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  total: number;
  page: number;
  totalPages: number;
  jimokDistribution: Array<{ jimok: string; count: number }>;
  landUseDistribution: Array<{ landUse: string; count: number }>;
  priceTimeline: Array<{ year: number; month: number; avgPricePerPyeong: number | null; count: number }>;
}

export async function getRegionDetail(params: RegionDetailParams): Promise<RegionDetailResult> {
  const { bjdCode, dongName, page, limit } = params;
  const where = { bjdCode, dongName, cancelDealDay: null };
  const skip = (page - 1) * limit;

  // 1) 페이지네이션 거래내역
  const [rows, total] = await Promise.all([
    prisma.landSaleTransaction.findMany({
      where,
      select: {
        id: true, jibun: true, jimok: true, landUse: true, dealArea: true, shareDeal: true,
        dealAmount: true, dealType: true, dealYear: true, dealMonth: true, dealDay: true,
      },
      orderBy: [{ dealYear: 'desc' }, { dealMonth: 'desc' }, { dealDay: 'desc' }],
      skip,
      take: limit,
    }),
    prisma.landSaleTransaction.count({ where }),
  ]);

  // 2) 통계용 전체 거래 (분포/시계열 — 동 단위라 건수 적음)
  const allRows = await prisma.landSaleTransaction.findMany({
    where,
    select: { jimok: true, landUse: true, dealArea: true, dealAmount: true, dealYear: true, dealMonth: true },
  });

  // 거래내역에 평당가 비정규화
  const items = rows.map((r) => {
    const s = serializeRow(r);
    s.pricePerPyeong = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    return s;
  });

  // 지목 분포
  const jimokMap = new Map<string, number>();
  const landUseMap = new Map<string, number>();
  const timelineMap = new Map<string, { year: number; month: number; prices: number[]; count: number }>();

  for (const r of allRows) {
    const jk = r.jimok?.trim() || '기타';
    jimokMap.set(jk, (jimokMap.get(jk) ?? 0) + 1);
    const lk = r.landUse?.trim() || '기타';
    landUseMap.set(lk, (landUseMap.get(lk) ?? 0) + 1);

    const key = `${r.dealYear}-${r.dealMonth}`;
    const entry = timelineMap.get(key) ?? { year: r.dealYear, month: r.dealMonth, prices: [], count: 0 };
    entry.count++;
    const ppp = pricePerPyeong(Number(r.dealAmount), r.dealArea ? Number(r.dealArea) : null);
    if (ppp !== null) entry.prices.push(ppp);
    timelineMap.set(key, entry);
  }

  const jimokDistribution = Array.from(jimokMap.entries())
    .map(([jimok, count]) => ({ jimok, count }))
    .sort((a, b) => b.count - a.count);
  const landUseDistribution = Array.from(landUseMap.entries())
    .map(([landUse, count]) => ({ landUse, count }))
    .sort((a, b) => b.count - a.count);
  const priceTimeline = Array.from(timelineMap.values())
    .map((e) => ({
      year: e.year,
      month: e.month,
      avgPricePerPyeong: e.prices.length ? Math.round((e.prices.reduce((a, b) => a + b, 0) / e.prices.length) * 100) / 100 : null,
      count: e.count,
    }))
    .sort((a, b) => (a.year - b.year) || (a.month - b.month));

  return {
    items,
    total,
    page,
    totalPages: total === 0 ? 0 : Math.ceil(total / limit),
    jimokDistribution,
    landUseDistribution,
    priceTimeline,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/landService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/landService.ts backend/__tests__/services/landService.test.ts
git commit -m "feat(land): add getRegionDetail (transactions + timeline + distributions)"
```

---

## Task 8: 서비스 — getHubSummary

**Files:**
- Modify: `backend/src/services/landService.ts`
- Modify: `backend/__tests__/services/landService.test.ts`

허브 페이지용: 시·도별 색인 가능 동 수 + 전체 거래 수 요약.

- [ ] **Step 1: 실패하는 테스트 추가**

`landService.test.ts` 끝에 추가(import에 `getHubSummary` 추가):

```typescript
// import 줄을 다음으로 교체:
// import { getRegionList, getRegionDetail, getHubSummary } from '../../src/services/landService.js';

describe('getHubSummary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('시·도별 색인가능 동 수와 거래 합계 집계', async () => {
    mockSummaryFindMany.mockResolvedValue([
      { city: '서울특별시', transactionCount: 12, isIndexable: true },
      { city: '서울특별시', transactionCount: 3, isIndexable: false },
      { city: '경기도', transactionCount: 20, isIndexable: true },
    ]);

    const r = await getHubSummary();

    const seoul = r.cities.find((c) => c.city === '서울특별시');
    expect(seoul?.indexableDongCount).toBe(1);
    expect(seoul?.totalTransactions).toBe(15);
    expect(r.totalTransactions).toBe(35);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/landService.test.ts -t getHubSummary`
Expected: FAIL — `getHubSummary is not a function`.

- [ ] **Step 3: 구현**

`landService.ts`에 추가:

```typescript
export interface HubSummaryResult {
  cities: Array<{ city: string; indexableDongCount: number; totalTransactions: number }>;
  totalTransactions: number;
}

export async function getHubSummary(): Promise<HubSummaryResult> {
  const rows = await prisma.landAreaSummary.findMany({
    select: { city: true, transactionCount: true, isIndexable: true },
  });

  const cityMap = new Map<string, { indexableDongCount: number; totalTransactions: number }>();
  let totalTransactions = 0;
  for (const r of rows) {
    const e = cityMap.get(r.city) ?? { indexableDongCount: 0, totalTransactions: 0 };
    if (r.isIndexable) e.indexableDongCount++;
    e.totalTransactions += r.transactionCount;
    totalTransactions += r.transactionCount;
    cityMap.set(r.city, e);
  }

  const cities = Array.from(cityMap.entries())
    .map(([city, v]) => ({ city, ...v }))
    .sort((a, b) => b.totalTransactions - a.totalTransactions);

  return { cities, totalTransactions };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/services/landService.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/landService.ts backend/__tests__/services/landService.test.ts
git commit -m "feat(land): add getHubSummary"
```

---

## Task 9: 라우트 + 마운트 — routes/land.ts

**Files:**
- Create: `backend/src/routes/land.ts`
- Modify: `backend/src/app.ts` (import + mount, **realEstate 라우트보다 먼저**)
- Test: `backend/__tests__/routes/land.test.ts`

- [ ] **Step 1: 실패하는 통합 테스트 작성**

`backend/__tests__/routes/land.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

const { mockGetRegionList, mockGetRegionDetail, mockGetHubSummary } = vi.hoisted(() => ({
  mockGetRegionList: vi.fn(),
  mockGetRegionDetail: vi.fn(),
  mockGetHubSummary: vi.fn(),
}));

vi.mock('../../src/services/landService.js', () => ({
  getRegionList: mockGetRegionList,
  getRegionDetail: mockGetRegionDetail,
  getHubSummary: mockGetHubSummary,
}));

import app from '../../src/app.js';

describe('GET /api/real-estate/land/regions', () => {
  beforeEach(() => vi.clearAllMocks());

  it('정상 응답 {success, data}', async () => {
    mockGetRegionList.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 });
    const res = await request(app).get('/api/real-estate/land/regions?city=서울특별시');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mockGetRegionList).toHaveBeenCalledWith(
      expect.objectContaining({ city: '서울특별시', page: 1, limit: 20 })
    );
  });
});

describe('GET /api/real-estate/land/region', () => {
  beforeEach(() => vi.clearAllMocks());

  it('bjdCode+dongName 정상 응답', async () => {
    mockGetRegionDetail.mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0, jimokDistribution: [], landUseDistribution: [], priceTimeline: [] });
    const res = await request(app).get('/api/real-estate/land/region?bjdCode=11680&dongName=역삼동');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('필수 파라미터 누락 시 422', async () => {
    const res = await request(app).get('/api/real-estate/land/region?bjdCode=11680');
    expect(res.status).toBe(422);
  });
});

describe('GET /api/real-estate/land/hub-summary', () => {
  beforeEach(() => vi.clearAllMocks());

  it('정상 응답', async () => {
    mockGetHubSummary.mockResolvedValue({ cities: [], totalTransactions: 0 });
    const res = await request(app).get('/api/real-estate/land/hub-summary');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/routes/land.test.ts`
Expected: FAIL (404 응답 또는 라우터 미존재 — `/api/real-estate/land/regions`가 아직 마운트 안 됨).

- [ ] **Step 3: 라우트 구현**

`backend/src/routes/land.ts`:

```typescript
// 토지 실거래가 API 라우트

import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { getRegionList, getRegionDetail, getHubSummary } from '../services/landService.js';
import { validate } from '../middlewares/validate.js';
import { asyncHandler } from '../lib/asyncHandler.js';
import { LandRegionListSchema, LandRegionDetailSchema } from '../schemas/land.js';

const router = Router();

// GET /api/real-estate/land/hub-summary
router.get(
  '/hub-summary',
  asyncHandler(async (_req: Request, res: Response) => {
    const data = await getHubSummary();
    res.json({ success: true, data });
  })
);

// GET /api/real-estate/land/regions — 동 목록
router.get(
  '/regions',
  validate(LandRegionListSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof LandRegionListSchema>;
    const data = await getRegionList(params);
    res.json({ success: true, data });
  })
);

// GET /api/real-estate/land/region — 동 상세
router.get(
  '/region',
  validate(LandRegionDetailSchema, 'query'),
  asyncHandler(async (req: Request, res: Response) => {
    const params = req.query as unknown as z.infer<typeof LandRegionDetailSchema>;
    const data = await getRegionDetail(params);
    res.json({ success: true, data });
  })
);

export default router;
```

- [ ] **Step 4: app.ts에 마운트 (realEstate보다 먼저)**

`backend/src/app.ts`에서 import 추가 (realEstate import 근처):
```typescript
import landRouter from './routes/land.js';
```
그리고 라우트 마운트 구역에서 **`app.use('/api/real-estate', realEstateRouter);` 줄 바로 위에** 추가:
```typescript
app.use('/api/real-estate/land', landRouter);
```

> 순서가 중요하다. `/api/real-estate/land`를 `/api/real-estate`(realEstateRouter, `/:type/*` 보유)보다 먼저 마운트해야 `land` prefix 요청이 land 라우터로 간다.

- [ ] **Step 5: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/routes/land.test.ts`
Expected: PASS (4 tests).

> `supertest`가 devDependency에 있는지 확인. 없으면 다른 라우트 테스트(`__tests__/routes/area.test.ts`)가 쓰는 방식을 따른다(이미 설치돼 있을 가능성 높음).

- [ ] **Step 6: 전체 백엔드 테스트 + 린트 (회귀 확인)**

Run:
```bash
cd backend && npm run test && npm run lint
```
Expected: 전체 PASS, lint 에러 0. (메모리: 기존 실패 테스트도 즉시 수정.)

- [ ] **Step 7: Commit**

```bash
git add backend/src/routes/land.ts backend/src/app.ts backend/__tests__/routes/land.test.ts
git commit -m "feat(land): add land API routes mounted at /api/real-estate/land"
```

---

## Task 10: 실데이터 스모크 테스트 (수동, 1회)

**Files:** 없음 (검증만)

> Node `fetch`는 개발 환경에서도 data.go.kr 호출이 정상이므로 이 task는 여기서 실행 가능하다(`tsx` 스크립트가 undici fetch 사용). curl로 수동 확인할 때만 `-A "Mozilla/5.0"`을 붙인다(curl 기본 UA는 WAF 차단).

- [ ] **Step 1: 단일 지역 수집 실행**

Run (Node 20, `.env`에 `OPENAPI_SERVICE_KEY` 있어야 함):
```bash
cd backend && nvm use 20 && npx tsx src/scripts/syncLandSale.ts --lawd 11680 --ym 202603
```
Expected: `[landSale] 시작...`, 배치 완료 로그, `LandAreaSummary 갱신: N개 동`, `=== landSale sync completed ===`. 에러 없이 종료.

- [ ] **Step 2: API 응답 확인 (dev 서버 실행 중)**

Run:
```bash
curl -s "http://localhost:8000/api/real-estate/land/regions?city=서울특별시&district=강남구" | head -c 500
curl -s "http://localhost:8000/api/real-estate/land/region?bjdCode=11680&dongName=역삼동" | head -c 800
```
Expected: `{"success":true,"data":{...}}` 형태. region 응답에 `items`, `jimokDistribution`, `landUseDistribution`, `priceTimeline` 포함.

- [ ] **Step 3: Task 0 매핑 검증**

응답의 `jimok`/`landUse`/`dealArea` 등이 비어있지 않은지 확인. 비어있으면 Task 0의 태그명이 틀린 것 — `RawLandSaleItem`/`transformLandSaleItem`의 해당 태그를 실제값으로 고치고 Task 3~5 재실행.

> 이 task는 커밋 없음(데이터/검증만). 매핑 수정이 필요했다면 해당 수정만 별도 커밋.

---

## Self-Review (작성자 체크 완료)

- **Spec 커버리지**: 5.1 LandSaleTransaction(Task1) · 5.2 LandAreaSummary+isIndexable(Task1,5) · 7.1 syncLandSale(Task3,4,5) · 7.2 getRegionList/getRegionDetail(Task6,7) · getHubSummary(Task8) · 7.3 routes+asyncHandler+validate(Task9). 평당가=거래금액/(면적/3.305)(Task5,7). 품질 게이트 최근1년5건OR누적10건(Task5). **Plan 1 범위 밖(의도적)**: 인근 동 비교·보강 데이터(Plan3), 프론트·사이트맵(Plan2).
- **플레이스홀더 스캔**: 없음. (Task4의 임시 빈 `refreshLandAreaSummary`는 Task5에서 실제 구현으로 교체하도록 명시.)
- **타입 일관성**: `getRegionList`/`getRegionDetail`/`getHubSummary` 시그니처가 Task6~9에서 일관. `transformLandSaleItem`/`computeAreaSummary`/`refreshLandAreaSummary` export가 테스트 import와 일치. 라우트가 호출하는 서비스명이 Task9 mock과 일치.
- **알려진 불확실성**: API XML 태그명(Task0에서 확정). sourceId 조합은 테스트 기대값에 맞춰 직접 조합 권장.
```
