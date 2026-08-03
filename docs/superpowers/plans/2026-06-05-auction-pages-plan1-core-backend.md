# 공매(온비드) 페이지 — Plan 1: Core Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 온비드 부동산 공매 데이터를 일일 스냅샷+마감포착으로 누적하는 백엔드(모델·sync·서비스·라우트)를 구축한다.

**Architecture:** 토지 실거래가와 동일한 독립 모듈 패턴(`baseSyncService` runSync/batchUpsert/transformAndDedupe, `buildRegionFilter`, `serializeRow`). 활성 물건만 주는 API에서 마감 전이를 포착해 낙찰 결과를 freeze하고, 시군구×용도 집계(`AuctionAreaSummary`)를 SEO 자산으로 갱신한다.

**Tech Stack:** Express 5 + TypeScript(ESM, `.js` import) + Prisma + MySQL 8 + Zod + Vitest. 외부: 온비드 차세대 API(`OnbidRlstListSrvc/getRlstCltrList`, `OnbidRlstDetailSrvc/getRlstCltrDetail`).

**Spec:** `docs/superpowers/specs/2026-06-05-auction-public-sale-pages-design.md`
**Branch:** `feature/auction-pages` (develop 기반, 생성 완료)

**금액 단위 주의:** 온비드는 **원(₩)** 단위. 실거래가(만원)와 다르므로 BigInt 원 단위로 저장하고 표시 변환은 프론트(Plan 2)에서.

---

## 사전 조건 (Prerequisites)

- Node 20: `source ~/.nvm/nvm.sh && nvm use 20` (lock 재생성 금지)
- DB: `docker compose up -d` (MySQL 8, port 3307)
- **온비드 API 활용신청 (사용자 액션)**: data.go.kr에서 15157207(물건목록), 15157251(물건상세) 활용신청 → `OPENAPI_SERVICE_KEY`로 호출 가능해질 때까지 대기. 현재 키는 `resultCode 99 UNKNOWN_ERROR`(미인가). **Task 5(sync 라이브 실행)는 인가 완료 후 가능**하나, Task 0~4·6~10은 인가 없이도 구현/테스트 가능(mock 기반).

---

## File Structure

| 파일 | 책임 |
|---|---|
| `backend/prisma/schema.prisma` | `AuctionItem`, `AuctionAreaSummary` 모델 |
| `backend/src/services/auctionUsage.ts` | 온비드 용도/재산유형 → `usageGroup` 매핑 (순수함수) |
| `backend/src/services/onbidBase.ts` | 온비드 API fetch + XML 파싱 공통 유틸 |
| `backend/src/scripts/syncAuction.ts` | transform·집계·일일 sync·마감포착 |
| `backend/src/services/auctionService.ts` | 조회 서비스(items/detail/region/city/hub/ranking/sitemap) |
| `backend/src/schemas/auction.ts` | Zod 요청 스키마 |
| `backend/src/routes/auction.ts` | 라우트 핸들러 |
| `backend/src/app.ts` | `/api/auction` 마운트 |
| `.github/workflows/sync-real-estate.yml` | 일일 cron에 `syncAuction` 추가 |

---

## Task 0: 온비드 API 라이브 검증 (인가 후) — 응답 필드 확정

**목적:** 실제 응답 필드명을 확정해 이후 transform 코드를 맞춘다. 인가 전이면 이 Task는 "documented 필드명 사용"으로 진행하고 인가 후 재검증.

**Files:**
- Create(임시): `backend/scripts-tmp/probeOnbid.mjs` (검증용, 커밋 안 함)

- [ ] **Step 1: 라이브 probe 스크립트 작성·실행**

```js
// backend/scripts-tmp/probeOnbid.mjs  (Node 20, ESM)
import fs from 'fs';
const key = (fs.readFileSync('.env','utf8').match(/OPENAPI_SERVICE_KEY=(.+)/)||[])[1].trim();
const LIST = 'https://open.kamco.or.kr/services/OnbidRlstListSrvc/getRlstCltrList';
const DETAIL = 'https://open.kamco.or.kr/services/OnbidRlstDetailSrvc/getRlstCltrDetail';
async function get(url){ const r=await fetch(url,{signal:AbortSignal.timeout(25000)}); return r.text(); }
// 재산유형코드(prptDivCd) 후보 순회: 0001~0006 등. 실제 유효값 확인.
for (const cd of ['0001','0002','0003','0004','0005','0006']) {
  const t = await get(`${LIST}?serviceKey=${key}&prptDivCd=${cd}&pvctTrgtYn=N&numOfRows=2&pageNo=1`);
  console.log(`\n===== prptDivCd=${cd} =====\n`, t.slice(0, 2500));
}
```

Run: `cd backend && node scripts-tmp/probeOnbid.mjs`
Expected (인가 후): `<resultCode>00</resultCode>` 와 `<items><item>...</item></items>` 응답. 각 item의 실제 태그명 기록.

- [ ] **Step 2: 응답 필드 매핑표 기록**

probe 결과에서 다음 정보를 spec/plan 주석으로 기록(인가 전이면 documented 값 유지):
- 유효 `prptDivCd` 값 목록 + 라벨(재산유형)
- item 태그: 물건관리번호, 공매조건번호, 공고번호, 소재지, 용도, 재산종류, 처분방식, 감정가, 최저입찰가, 입찰시작/종료일시, 유찰수, 차수, 관리기관, 좌표(있으면)
- 상세 API(`getRlstCltrDetail`) 호출: `cltrMngNo`+`pbctCdtnNo`로 개찰결과(낙찰가/유찰) 필드명

- [ ] **Step 3: 임시 스크립트 삭제, 커밋 없음**

```bash
rm -rf backend/scripts-tmp
```

**주의:** 이하 Task들은 spec의 documented 필드명(`cltrMngNo`, `pbctCdtnNo`, `apslAssAmt`, `minBidPrc`, `bidBeginDtm`, `bidCloseDtm` 등)을 사용. Task 0에서 실제 태그명이 다르면 `onbidBase.ts`/`transformAuctionItem`의 매핑만 조정.

---

## Task 1: Prisma 모델

**Files:**
- Modify: `backend/prisma/schema.prisma` (모델 2개 추가, 파일 끝)

- [ ] **Step 1: `AuctionItem` + `AuctionAreaSummary` 추가**

```prisma
model AuctionItem {
  id            Int       @id @default(autoincrement())
  cltrMngNo     String    @unique @db.VarChar(50)
  pbctCdtnNo    String    @db.VarChar(50)
  plnmNo        String?   @db.VarChar(50)
  city          String    @db.VarChar(50)
  district      String    @db.VarChar(50)
  bjdCode       String    @db.VarChar(5)   // 5자리 시군구 코드 (Region.bjdCode VarChar(5)와 일치, land=sggCd 관례)
  dongName      String?   @db.VarChar(50)
  address       String    @db.VarChar(500)
  usage         String?   @db.VarChar(100)
  usageGroup    String    @db.VarChar(20)
  propertyType  String?   @db.VarChar(50)
  dpslMtdNm     String?   @db.VarChar(20)
  landArea      Decimal?  @db.Decimal(12, 2)
  bldArea       Decimal?  @db.Decimal(12, 2)
  apslAssAmt    BigInt?
  minBidPrc     BigInt?
  failCnt       Int       @default(0)
  bidRound      Int?
  bidBeginDtm   DateTime?
  bidCloseDtm   DateTime?
  orgNm         String?   @db.VarChar(100)
  pvctTrgtYn    Boolean   @default(false)
  status        String    @db.VarChar(20)
  isClosed      Boolean   @default(false)
  resultType    String?   @db.VarChar(20)
  winBidPrc     BigInt?
  bidRate       Decimal?  @db.Decimal(6, 2)
  resultDate    DateTime?
  lat           Decimal?  @db.Decimal(10, 7)
  lng           Decimal?  @db.Decimal(10, 7)
  sourceId      String    @unique @db.VarChar(200)
  firstSeenAt   DateTime  @default(now())
  lastSeenAt    DateTime  @default(now())
  syncedAt      DateTime  @default(now())
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([bjdCode, usageGroup, status])
  @@index([city, district])
  @@index([status, isClosed])
  @@index([bidCloseDtm])
  @@index([isClosed, lastSeenAt])
  @@index([resultDate])
}

model AuctionAreaSummary {
  id              Int       @id @default(autoincrement())
  bjdCode         String    @db.VarChar(5)   // 5자리 시군구 코드 (AuctionItem/Region과 일치)
  usageGroup      String    @db.VarChar(20)
  city            String    @db.VarChar(50)
  district        String    @db.VarChar(50)
  activeCount     Int       @default(0)
  closedCount     Int       @default(0)
  soldCount       Int       @default(0)
  avgBidRate      Decimal?  @db.Decimal(6, 2)
  avgApslAmt      BigInt?
  avgWinBidPrc    BigInt?
  failRate        Decimal?  @db.Decimal(5, 2)
  latestResultDate DateTime?
  isIndexable     Boolean   @default(false)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  @@unique([bjdCode, usageGroup])
  @@index([city, district])
  @@index([usageGroup, avgBidRate])
  @@index([isIndexable])
}
```

- [ ] **Step 2: DB 반영 + 클라이언트 생성**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run db:push && npm run db:generate`
Expected: `Your database is now in sync` + `Generated Prisma Client`.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(auction): add AuctionItem & AuctionAreaSummary models"
```

---

## Task 2: usageGroup 매핑 (순수함수, TDD)

**Files:**
- Create: `backend/src/services/auctionUsage.ts`
- Test: `backend/__tests__/services/auctionUsage.test.ts`

- [ ] **Step 1: 실패 테스트 작성**

```typescript
// backend/__tests__/services/auctionUsage.test.ts
import { describe, it, expect } from 'vitest';
import { toUsageGroup, USAGE_GROUPS } from '../../src/services/auctionUsage.js';

describe('toUsageGroup', () => {
  it('주거용 용도를 residential로 매핑', () => {
    expect(toUsageGroup('아파트')).toBe('residential');
    expect(toUsageGroup('다세대주택')).toBe('residential');
    expect(toUsageGroup('오피스텔')).toBe('residential');
  });
  it('토지 용도를 land로 매핑', () => {
    expect(toUsageGroup('대지')).toBe('land');
    expect(toUsageGroup('전')).toBe('land');
    expect(toUsageGroup('임야')).toBe('land');
  });
  it('상가/업무를 commercial로', () => {
    expect(toUsageGroup('근린생활시설')).toBe('commercial');
    expect(toUsageGroup('사무실')).toBe('commercial');
  });
  it('공장/창고를 industrial로', () => {
    expect(toUsageGroup('공장')).toBe('industrial');
    expect(toUsageGroup('창고')).toBe('industrial');
  });
  it('복합/기타', () => {
    expect(toUsageGroup('복합용건물')).toBe('complex');
    expect(toUsageGroup(null)).toBe('etc');
    expect(toUsageGroup('')).toBe('etc');
  });
  it('USAGE_GROUPS는 5개 정식 그룹 + etc', () => {
    expect(USAGE_GROUPS).toEqual(['residential', 'land', 'commercial', 'industrial', 'complex', 'etc']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run __tests__/services/auctionUsage.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현**

```typescript
// backend/src/services/auctionUsage.ts
export const USAGE_GROUPS = ['residential', 'land', 'commercial', 'industrial', 'complex', 'etc'] as const;
export type UsageGroup = (typeof USAGE_GROUPS)[number];

// 키워드 우선순위: complex → industrial → commercial → land → residential
const RULES: Array<{ group: UsageGroup; keywords: string[] }> = [
  { group: 'complex', keywords: ['복합'] },
  { group: 'industrial', keywords: ['공장', '창고', '산업'] },
  { group: 'commercial', keywords: ['근린', '상가', '사무', '점포', '업무', '판매'] },
  { group: 'land', keywords: ['대지', '전', '답', '임야', '잡종지', '과수원', '토지', '농지', '목장', '도로'] },
  { group: 'residential', keywords: ['아파트', '주택', '다세대', '연립', '빌라', '오피스텔', '주거', '다가구', '단독'] },
];

export function toUsageGroup(usage: string | null | undefined): UsageGroup {
  const u = (usage ?? '').trim();
  if (!u) return 'etc';
  for (const { group, keywords } of RULES) {
    if (keywords.some((k) => u.includes(k))) return group;
  }
  return 'etc';
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/services/auctionUsage.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/auctionUsage.ts backend/__tests__/services/auctionUsage.test.ts
git commit -m "feat(auction): usageGroup mapping"
```

---

## Task 3: transformAuctionItem (TDD)

원문 API item → DB 레코드. 소재지 파싱(city/district/bjdCode/dong)은 `regionMap`(Region 테이블 bjdCode→{city,district}) 사용. 온비드 item에 시군구코드가 있으면 그것을 bjdCode로, 없으면 주소 파싱.

**Files:**
- Modify: `backend/src/scripts/syncAuction.ts` (생성)
- Test: `backend/__tests__/scripts/syncAuction.transform.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
// backend/__tests__/scripts/syncAuction.transform.test.ts
import { describe, it, expect } from 'vitest';
import { transformAuctionItem, type RawAuctionItem } from '../../src/scripts/syncAuction.js';

const base: RawAuctionItem = {
  cltrMngNo: '6012880',
  pbctCdtnNo: '0001',
  plnmNo: '2026-0400-021484',
  cltrNm: '서울특별시 강남구 역삼동 123 ABC빌딩 101호',
  ctgrFullNm: '오피스텔',
  prptDivNm: '압류재산',
  dpslMtdNm: '매각',
  apslAssAmt: '300000000',
  minBidPrc: '210000000',
  pbctBegnDtm: '202601011100', // 과거(입찰 시작됨) → ongoing
  pbctClsDtm: '202612011600',  // 미래(아직 안 끝남)
  fbdrCnt: '2',
  pbctSno: '7',
  orgNm: '한국자산관리공사',
  ldCd: '1168010100',
  city: '서울특별시',
  district: '강남구',
};

describe('transformAuctionItem', () => {
  it('핵심 필드 매핑 + usageGroup + sourceId + 원단위 BigInt', () => {
    const r = transformAuctionItem(base)!;
    expect(r.cltrMngNo).toBe('6012880');
    expect(r.pbctCdtnNo).toBe('0001');
    expect(r.usageGroup).toBe('residential');
    expect(r.apslAssAmt).toBe(300000000n);
    expect(r.minBidPrc).toBe(210000000n);
    expect(r.failCnt).toBe(2);
    expect(r.bidRound).toBe(7);
    expect(r.sourceId).toBe('auction-6012880');
    expect(r.status).toBe('ongoing'); // 미래 마감일 → 진행/예정
    expect(r.bjdCode).toBe('11680'); // ldCd 앞 5자리(시군구)
  });
  it('입찰일시 파싱(YYYYMMDDhhmm → Date)', () => {
    const r = transformAuctionItem(base)!;
    expect(r.bidCloseDtm?.getUTCFullYear()).toBe(2026);
    expect(r.bidCloseDtm?.getUTCMonth()).toBe(11); // 12월
  });
  it('입찰 시작 전이면 scheduled(예정)', () => {
    const r = transformAuctionItem({ ...base, pbctBegnDtm: '202612011100', pbctClsDtm: '202612021600' })!;
    expect(r.status).toBe('scheduled');
  });
  it('입찰 종료 후면 closed', () => {
    const r = transformAuctionItem({ ...base, pbctBegnDtm: '202501011100', pbctClsDtm: '202502011600' })!;
    expect(r.status).toBe('closed');
  });
  it('빈 금액/누락 필드는 null', () => {
    const r = transformAuctionItem({ ...base, apslAssAmt: ' ', minBidPrc: '' })!;
    expect(r.apslAssAmt).toBeNull();
    expect(r.minBidPrc).toBeNull();
  });
  it('필수 식별자(cltrMngNo) 없으면 null 반환(스킵)', () => {
    expect(transformAuctionItem({ ...base, cltrMngNo: '' })).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/scripts/syncAuction.transform.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: 구현 (syncAuction.ts 상단부)**

```typescript
// backend/src/scripts/syncAuction.ts
#!/usr/bin/env tsx
// 온비드 부동산 공매 동기화 — 일일 스냅샷 + 마감포착 archive
import { fileURLToPath } from 'url';
import { resolve } from 'path';
import { prisma } from '../lib/prisma.js';
import { installRuntimeGuard } from './_runtimeGuard.js';
import { runSync, batchUpsert, transformAndDedupe } from '../services/baseSyncService.js';
import { fetchOnbidList, fetchOnbidDetail } from '../services/onbidBase.js';
import { toUsageGroup } from '../services/auctionUsage.js';

const CATEGORY = 'auction';
// 부동산 재산유형코드 (Task 0에서 유효값 확정 후 갱신)
const PRPT_DIV_CODES = ['0001', '0002', '0003', '0004', '0005', '0006'];

export interface RawAuctionItem extends Record<string, unknown> {
  cltrMngNo: string; pbctCdtnNo: string; plnmNo?: string;
  cltrNm: string; ctgrFullNm?: string; prptDivNm?: string; dpslMtdNm?: string;
  apslAssAmt?: string; minBidPrc?: string;
  pbctBegnDtm?: string; pbctClsDtm?: string;
  fbdrCnt?: string; pbctSno?: string; orgNm?: string;
  ldCd?: string; lat?: string; lng?: string;
  city?: string; district?: string;
}

function parseBigIntOrNull(v: unknown): bigint | null {
  const s = String(v ?? '').replace(/,/g, '').trim();
  if (!s || !/^\d+$/.test(s)) return null;
  return BigInt(s);
}
function parseIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}
// YYYYMMDDhhmm(또는 YYYYMMDD) → Date(UTC)
function parseDtm(v: unknown): Date | null {
  const s = String(v ?? '').replace(/[^0-9]/g, '').trim();
  if (s.length < 8) return null;
  const y = +s.slice(0, 4), mo = +s.slice(4, 6) - 1, d = +s.slice(6, 8);
  const h = s.length >= 12 ? +s.slice(8, 10) : 0, mi = s.length >= 12 ? +s.slice(10, 12) : 0;
  const dt = new Date(Date.UTC(y, mo, d, h, mi));
  return isNaN(dt.getTime()) ? null : dt;
}

export function transformAuctionItem(item: RawAuctionItem, now: Date = new Date()) {
  const cltrMngNo = String(item.cltrMngNo ?? '').trim();
  if (!cltrMngNo) return null;
  const address = String(item.cltrNm ?? '').trim();
  const usage = String(item.ctgrFullNm ?? '').trim() || null;
  // ⚠️ MAJOR #3: 'ldCd'는 가정한 필드명. Task 0 라이브 probe에서 실제 시군구코드 필드명 확정 필수.
  //   ldCd가 없거나 다른 이름이면 bjdCode=''가 되어 해당 물건이 모든 지역/집계 페이지에서 누락됨(SEO 자산 0).
  //   1순위: 시군구코드 필드 직접 사용. 2순위(없을 때): enrich 단계에서 city/district명↔regionMap 역매칭으로 bjdCode 채움.
  const ldCd = String(item.ldCd ?? '').trim();
  const bjdCode = ldCd ? ldCd.slice(0, 5) : '';
  const bidBeginDtm = parseDtm(item.pbctBegnDtm);
  const bidCloseDtm = parseDtm(item.pbctClsDtm);
  const status = bidCloseDtm && bidCloseDtm < now ? 'closed'
    : bidBeginDtm && bidBeginDtm > now ? 'scheduled' : 'ongoing';
  return {
    sourceId: `${CATEGORY}-${cltrMngNo}`,
    cltrMngNo,
    pbctCdtnNo: String(item.pbctCdtnNo ?? '').trim(),
    plnmNo: String(item.plnmNo ?? '').trim() || null,
    city: String(item.city ?? '').trim(),
    district: String(item.district ?? '').trim(),
    bjdCode,
    dongName: null as string | null, // 주소 파싱은 Task 0 결과 따라 보강(법정동)
    address,
    usage,
    usageGroup: toUsageGroup(usage),
    propertyType: String(item.prptDivNm ?? '').trim() || null,
    dpslMtdNm: String(item.dpslMtdNm ?? '').trim() || null,
    landArea: null as string | null,
    bldArea: null as string | null,
    apslAssAmt: parseBigIntOrNull(item.apslAssAmt),
    minBidPrc: parseBigIntOrNull(item.minBidPrc),
    failCnt: parseIntOrNull(item.fbdrCnt) ?? 0,
    bidRound: parseIntOrNull(item.pbctSno),
    bidBeginDtm,
    bidCloseDtm,
    orgNm: String(item.orgNm ?? '').trim() || null,
    pvctTrgtYn: (item as { pvctTrgtYn?: boolean }).pvctTrgtYn === true, // enriched에서 'Y'→true 주입됨
    status,
    lat: item.lat ? String(item.lat).trim() : null,
    lng: item.lng ? String(item.lng).trim() : null,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/scripts/syncAuction.transform.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/syncAuction.ts backend/__tests__/scripts/syncAuction.transform.test.ts
git commit -m "feat(auction): transformAuctionItem"
```

---

## Task 4: computeAuctionSummary (낙찰가율·품질게이트, TDD)

**Files:**
- Modify: `backend/src/scripts/syncAuction.ts`
- Test: `backend/__tests__/scripts/syncAuction.summary.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
// backend/__tests__/scripts/syncAuction.summary.test.ts
import { describe, it, expect } from 'vitest';
import { computeAuctionSummary, type ItemForSummary } from '../../src/scripts/syncAuction.js';

const mk = (o: Partial<ItemForSummary>): ItemForSummary => ({
  isClosed: false, resultType: null, apslAssAmt: 0, winBidPrc: null, resultDate: null, ...o,
});

describe('computeAuctionSummary', () => {
  it('진행중만 있으면 activeCount만, 낙찰가율 null', () => {
    const r = computeAuctionSummary([mk({}), mk({})]);
    expect(r.activeCount).toBe(2);
    expect(r.soldCount).toBe(0);
    expect(r.avgBidRate).toBeNull();
  });
  it('낙찰 3건 평균 낙찰가율 계산 + isIndexable', () => {
    const sold = [
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 800 }),
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 900 }),
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 1000 }),
    ];
    const r = computeAuctionSummary(sold);
    expect(r.soldCount).toBe(3);
    expect(r.closedCount).toBe(3);
    expect(r.avgBidRate).toBe(90); // (80+90+100)/3
    expect(r.isIndexable).toBe(true); // soldCount>=3
  });
  it('유찰은 failRate에 반영, 낙찰가율 계산서 제외', () => {
    const r = computeAuctionSummary([
      mk({ isClosed: true, resultType: 'failed', apslAssAmt: 1000 }),
      mk({ isClosed: true, resultType: 'sold', apslAssAmt: 1000, winBidPrc: 500 }),
    ]);
    expect(r.failRate).toBe(50);
    expect(r.avgBidRate).toBe(50);
  });
  it('soldCount<3이어도 closedCount>=5면 isIndexable', () => {
    const arr = Array.from({ length: 5 }, () => mk({ isClosed: true, resultType: 'failed', apslAssAmt: 1 }));
    expect(computeAuctionSummary(arr).isIndexable).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/scripts/syncAuction.summary.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 (syncAuction.ts에 추가)**

```typescript
// --- syncAuction.ts에 추가 ---
const INDEX_SOLD_MIN = 3;
const INDEX_CLOSED_MIN = 5;
const INDEX_ACTIVE_MIN = 3;

export interface ItemForSummary {
  isClosed: boolean;
  resultType: string | null;
  apslAssAmt: number;
  winBidPrc: number | null;
  resultDate: Date | null;
}
export interface AuctionSummaryResult {
  activeCount: number; closedCount: number; soldCount: number;
  avgBidRate: number | null; avgApslAmt: number | null; avgWinBidPrc: number | null;
  failRate: number | null; latestResultDate: Date | null; isIndexable: boolean;
}

export function computeAuctionSummary(items: ItemForSummary[]): AuctionSummaryResult {
  let activeCount = 0, closedCount = 0, soldCount = 0, failedCount = 0;
  const rates: number[] = []; const apsls: number[] = []; const wins: number[] = [];
  let latest: Date | null = null;
  for (const it of items) {
    if (it.isClosed) {
      closedCount++;
      if (it.resultType === 'sold') {
        soldCount++;
        if (it.apslAssAmt > 0 && it.winBidPrc != null && it.winBidPrc > 0) {
          rates.push((it.winBidPrc / it.apslAssAmt) * 100);
          wins.push(it.winBidPrc);
        }
        if (it.apslAssAmt > 0) apsls.push(it.apslAssAmt);
      } else if (it.resultType === 'failed') {
        failedCount++;
      }
      if (it.resultDate && (!latest || it.resultDate > latest)) latest = it.resultDate;
    } else {
      activeCount++;
    }
  }
  const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
  const round2 = (n: number | null) => (n == null ? null : Math.round(n * 100) / 100);
  const avgBidRate = round2(avg(rates));
  const failRate = closedCount > 0 ? round2((failedCount / closedCount) * 100) : null;
  const isIndexable = soldCount >= INDEX_SOLD_MIN || closedCount >= INDEX_CLOSED_MIN || activeCount >= INDEX_ACTIVE_MIN;
  return {
    activeCount, closedCount, soldCount, avgBidRate,
    avgApslAmt: avg(apsls) != null ? Math.round(avg(apsls)!) : null,
    avgWinBidPrc: avg(wins) != null ? Math.round(avg(wins)!) : null,
    failRate, latestResultDate: latest, isIndexable,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/scripts/syncAuction.summary.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add backend/src/scripts/syncAuction.ts backend/__tests__/scripts/syncAuction.summary.test.ts
git commit -m "feat(auction): computeAuctionSummary with quality gate"
```

---

## Task 5: 온비드 fetch 유틸 (onbidBase.ts, TDD)

**Files:**
- Create: `backend/src/services/onbidBase.ts`
- Test: `backend/__tests__/services/onbidBase.test.ts`

- [ ] **Step 1: 실패 테스트 (XML 파싱)**

```typescript
// backend/__tests__/services/onbidBase.test.ts
import { describe, it, expect } from 'vitest';
import { parseOnbidXml } from '../../src/services/onbidBase.js';

describe('parseOnbidXml', () => {
  it('정상 응답을 items 배열로 정규화', () => {
    const xml = `<?xml version="1.0"?><response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header><body><items><item><cltrMngNo>1</cltrMngNo></item><item><cltrMngNo>2</cltrMngNo></item></items><totalCount>2</totalCount></body></response>`;
    const r = parseOnbidXml(xml);
    expect(r.resultCode).toBe('00');
    expect(r.totalCount).toBe(2);
    expect(r.items).toHaveLength(2);
    expect(r.items[0].cltrMngNo).toBe('1');
  });
  it('단일 item도 배열로', () => {
    const xml = `<response><header><resultCode>00</resultCode><resultMsg>OK</resultMsg></header><body><items><item><cltrMngNo>1</cltrMngNo></item></items><totalCount>1</totalCount></body></response>`;
    expect(parseOnbidXml(xml).items).toHaveLength(1);
  });
  it('에러 응답(resultCode!=00) 감지', () => {
    const xml = `<result><resultCode>99</resultCode><resultMsg>UNKNOWN_ERROR</resultMsg></result>`;
    const r = parseOnbidXml(xml);
    expect(r.resultCode).toBe('99');
    expect(r.items).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/onbidBase.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```typescript
// backend/src/services/onbidBase.ts
import { XMLParser } from 'fast-xml-parser';

const LIST_URL = 'https://open.kamco.or.kr/services/OnbidRlstListSrvc/getRlstCltrList';
const DETAIL_URL = 'https://open.kamco.or.kr/services/OnbidRlstDetailSrvc/getRlstCltrDetail';
const TIMEOUT_MS = 30000;

export interface ParsedOnbid {
  resultCode: string;
  resultMsg: string;
  totalCount: number;
  items: Record<string, unknown>[];
}

export function parseOnbidXml(xml: string): ParsedOnbid {
  const parser = new XMLParser({ ignoreAttributes: true, parseTagValue: false, trimValues: true });
  const doc = parser.parse(xml) as Record<string, any>;
  const root = doc.response ?? doc.result ?? doc;
  const header = root.header ?? root;
  const body = root.body ?? root;
  const resultCode = String(header.resultCode ?? '');
  const resultMsg = String(header.resultMsg ?? '');
  let items: Record<string, unknown>[] = [];
  const rawItems = body?.items?.item;
  if (Array.isArray(rawItems)) items = rawItems;
  else if (rawItems && typeof rawItems === 'object') items = [rawItems];
  const totalCount = parseInt(String(body?.totalCount ?? items.length), 10) || 0;
  return { resultCode, resultMsg, totalCount, items };
}

async function fetchXml(url: string): Promise<string> {
  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  return res.text();
}

export async function fetchOnbidList(
  serviceKey: string, prptDivCd: string, pvctTrgtYn: string, pageNo: number, numOfRows = 100
): Promise<ParsedOnbid> {
  const qs = new URLSearchParams({ serviceKey, prptDivCd, pvctTrgtYn, pageNo: String(pageNo), numOfRows: String(numOfRows) });
  return parseOnbidXml(await fetchXml(`${LIST_URL}?${qs}`));
}

export async function fetchOnbidDetail(
  serviceKey: string, cltrMngNo: string, pbctCdtnNo: string
): Promise<ParsedOnbid> {
  const qs = new URLSearchParams({ serviceKey, cltrMngNo, pbctCdtnNo });
  return parseOnbidXml(await fetchXml(`${DETAIL_URL}?${qs}`));
}
```

- [ ] **Step 4: 통과 확인 + Commit**

Run: `npx vitest run __tests__/services/onbidBase.test.ts` → PASS (3).
```bash
git add backend/src/services/onbidBase.ts backend/__tests__/services/onbidBase.test.ts
git commit -m "feat(auction): onbid API fetch + XML parse util"
```

---

## Task 6: 마감 결과 매핑 + refreshAuctionSummary + sync main

**Files:**
- Modify: `backend/src/scripts/syncAuction.ts`
- Test: `backend/__tests__/scripts/syncAuction.result.test.ts`

- [ ] **Step 1: 실패 테스트 (개찰결과 매핑)**

```typescript
// backend/__tests__/scripts/syncAuction.result.test.ts
import { describe, it, expect } from 'vitest';
import { mapDetailResult } from '../../src/scripts/syncAuction.js';

describe('mapDetailResult', () => {
  it('낙찰 결과(낙찰가 있음) → sold + bidRate', () => {
    const r = mapDetailResult({ scsbidAmt: '850000000', pbctCltrStatNm: '낙찰' }, 1000000000n);
    expect(r.resultType).toBe('sold');
    expect(r.winBidPrc).toBe(850000000n);
    expect(r.bidRate).toBe(85); // 850/1000*100
    expect(r.isClosed).toBe(true);
  });
  it('유찰 → failed, 낙찰가 null', () => {
    const r = mapDetailResult({ pbctCltrStatNm: '유찰' }, 1000000000n);
    expect(r.resultType).toBe('failed');
    expect(r.winBidPrc).toBeNull();
    expect(r.bidRate).toBeNull();
  });
  it('취소/해제 → cancelled', () => {
    expect(mapDetailResult({ pbctCltrStatNm: '취소' }, null).resultType).toBe('cancelled');
  });
  it('결과 미상이면 closed 보존(resultType null)', () => {
    const r = mapDetailResult({}, null);
    expect(r.isClosed).toBe(true);
    expect(r.resultType).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/scripts/syncAuction.result.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현 (mapDetailResult + refreshAuctionSummary + syncAuctionSnapshot + main)**

```typescript
// --- syncAuction.ts에 추가 ---

export interface DetailResultRaw { scsbidAmt?: string; pbctCltrStatNm?: string; rsltDtm?: string; }
export interface MappedResult {
  isClosed: boolean; resultType: string | null; winBidPrc: bigint | null;
  bidRate: number | null; resultDate: Date | null; status: string;
}
export function mapDetailResult(d: DetailResultRaw, apslAssAmt: bigint | null): MappedResult {
  const stat = String(d.pbctCltrStatNm ?? '').trim();
  const win = parseBigIntOrNull(d.scsbidAmt);
  const resultDate = parseDtm(d.rsltDtm);
  if (win && win > 0n) {
    const bidRate = apslAssAmt && apslAssAmt > 0n
      ? Math.round((Number(win) / Number(apslAssAmt)) * 100 * 100) / 100 : null;
    return { isClosed: true, resultType: 'sold', winBidPrc: win, bidRate, resultDate, status: 'sold' };
  }
  if (/유찰/.test(stat)) return { isClosed: true, resultType: 'failed', winBidPrc: null, bidRate: null, resultDate, status: 'failed' };
  if (/취소|해제|중지/.test(stat)) return { isClosed: true, resultType: 'cancelled', winBidPrc: null, bidRate: null, resultDate, status: 'cancelled' };
  return { isClosed: true, resultType: null, winBidPrc: null, bidRate: null, resultDate, status: 'closed' };
}

export async function refreshAuctionSummary(): Promise<void> {
  const groups = await prisma.auctionItem.findMany({
    select: { bjdCode: true, usageGroup: true, city: true, district: true },
    distinct: ['bjdCode', 'usageGroup'],
    where: { bjdCode: { not: '' } },
  });
  for (const g of groups) {
    const rows = await prisma.auctionItem.findMany({
      where: { bjdCode: g.bjdCode, usageGroup: g.usageGroup },
      select: { isClosed: true, resultType: true, apslAssAmt: true, winBidPrc: true, resultDate: true },
    });
    const summary = computeAuctionSummary(rows.map((r) => ({
      isClosed: r.isClosed, resultType: r.resultType,
      apslAssAmt: r.apslAssAmt ? Number(r.apslAssAmt) : 0,
      winBidPrc: r.winBidPrc ? Number(r.winBidPrc) : null,
      resultDate: r.resultDate,
    })));
    await prisma.auctionAreaSummary.upsert({
      where: { bjdCode_usageGroup: { bjdCode: g.bjdCode, usageGroup: g.usageGroup } },
      create: { bjdCode: g.bjdCode, usageGroup: g.usageGroup, city: g.city, district: g.district,
        ...toSummaryData(summary) },
      update: { city: g.city, district: g.district, ...toSummaryData(summary) },
    });
  }
  console.info(`[auction] AreaSummary 갱신: ${groups.length}개 (시군구×용도)`);
}
function toSummaryData(s: ReturnType<typeof computeAuctionSummary>) {
  return {
    activeCount: s.activeCount, closedCount: s.closedCount, soldCount: s.soldCount,
    avgBidRate: s.avgBidRate, avgApslAmt: s.avgApslAmt != null ? BigInt(s.avgApslAmt) : null,
    avgWinBidPrc: s.avgWinBidPrc != null ? BigInt(s.avgWinBidPrc) : null,
    failRate: s.failRate, latestResultDate: s.latestResultDate, isIndexable: s.isIndexable,
  };
}

// 반환: clean=true면 전 재산유형×수의여부 스냅샷이 에러 없이 완료됨(마감포착 안전).
async function syncAuctionSnapshot(serviceKey: string, runStart: Date,
  regionMap: Map<string, { city: string; district: string }>, stats: any): Promise<boolean> {
  let clean = true;
  for (const prptDivCd of PRPT_DIV_CODES) {
    for (const pvctTrgtYn of ['N', 'Y']) {
      let pageNo = 1;
      for (;;) {
        let res;
        try {
          res = await fetchOnbidList(serviceKey, prptDivCd, pvctTrgtYn, pageNo, 100);
        } catch (e) {
          console.error(`[auction] 목록 호출 실패 ${prptDivCd}/${pvctTrgtYn}/p${pageNo}: ${e instanceof Error ? e.message : e}`);
          clean = false; break; // 이 조합 중단 — 부분 실패 표시
        }
        if (res.resultCode !== '00') { // API 오류 → 부분 실패(빈 결과와 구분)
          if (res.resultCode !== '03' /* NODATA가 아닌 진짜 오류 */) clean = false;
          break;
        }
        if (res.items.length === 0) break; // 정상 종료
        const enriched = res.items.map((it) => {
          const ldCd = String((it as any).ldCd ?? '').slice(0, 5);
          const region = regionMap.get(ldCd) ?? { city: '', district: '' };
          return { ...it, city: region.city, district: region.district, pvctTrgtYn: pvctTrgtYn === 'Y' };
        }) as RawAuctionItem[];
        const records = transformAndDedupe(enriched, (it) => transformAuctionItem(it, runStart), (r) => r.sourceId, stats);
        await batchUpsert(records, async (record) => {
          const existing = await prisma.auctionItem.findUnique({ where: { cltrMngNo: record.cltrMngNo }, select: { id: true, isClosed: true } });
          if (existing?.isClosed) return 'updated'; // 마감 물건은 active로 되돌리지 않음
          // ⚠️ landArea/bldArea/dongName/pvctTrgtYn은 절대 drop하지 말 것(MAJOR #2 회귀 방지).
          //   lat/lng만 string→number 변환 위해 분리, 나머지는 ...rest로 전부 전달.
          //   Decimal? 컬럼(landArea/bldArea)은 land와 동일하게 string|null 그대로 Prisma에 전달 가능(syncLandSale.ts:131,213 선례).
          const { lat, lng, ...rest } = record;
          const data = { ...rest, lat: lat ? Number(lat) : null, lng: lng ? Number(lng) : null };
          await prisma.auctionItem.upsert({
            where: { cltrMngNo: record.cltrMngNo },
            create: { ...data, firstSeenAt: runStart, lastSeenAt: runStart, syncedAt: new Date() },
            update: { ...data, lastSeenAt: runStart, syncedAt: new Date() },
          });
          return existing ? 'updated' : 'new';
        });
        if (res.items.length < 100) break;
        pageNo++;
      }
    }
  }
  return clean;
}

async function captureClosedItems(serviceKey: string, runStart: Date): Promise<void> {
  // 이번 런에서 안 보인(=목록서 사라진) 미마감 물건 = 마감 후보
  const candidates = await prisma.auctionItem.findMany({
    where: { isClosed: false, lastSeenAt: { lt: runStart } },
    select: { cltrMngNo: true, pbctCdtnNo: true, apslAssAmt: true },
    take: 2000,
  });
  let closed = 0;
  for (const c of candidates) {
    try {
      const res = await fetchOnbidDetail(serviceKey, c.cltrMngNo, c.pbctCdtnNo);
      const d = (res.items[0] ?? {}) as any;
      const mapped = mapDetailResult(d, c.apslAssAmt);
      await prisma.auctionItem.update({
        where: { cltrMngNo: c.cltrMngNo },
        data: { isClosed: mapped.isClosed, resultType: mapped.resultType, winBidPrc: mapped.winBidPrc,
          bidRate: mapped.bidRate, resultDate: mapped.resultDate ?? runStart, status: mapped.status, syncedAt: new Date() },
      });
      closed++;
    } catch (e) {
      console.error(`[auction] 마감포착 실패 ${c.cltrMngNo}: ${e instanceof Error ? e.message : e}`);
    }
  }
  console.info(`[auction] 마감 포착: ${closed}/${candidates.length}`);
}

async function main(): Promise<void> {
  const serviceKey = process.env.OPENAPI_SERVICE_KEY ?? '';
  if (!serviceKey) throw new Error('OPENAPI_SERVICE_KEY is not set');
  const regions = await prisma.region.findMany({ select: { bjdCode: true, city: true, district: true } });
  const regionMap = new Map(regions.map((r) => [r.bjdCode.slice(0, 5), { city: r.city, district: r.district }]));
  await runSync(CATEGORY, async (stats) => {
    const runStart = new Date();
    const clean = await syncAuctionSnapshot(serviceKey, runStart, regionMap, stats);
    // GAP 방지: 스냅샷이 부분 실패하면 "사라진 물건"을 신뢰할 수 없으므로 마감포착 건너뜀
    // (살아있는 물건을 오인 마감 처리하는 사고 방지). 다음 정상 런에서 포착됨.
    if (clean) await captureClosedItems(serviceKey, runStart);
    else console.warn('[auction] 스냅샷 부분 실패 → 마감포착 스킵(다음 런에서 재시도)');
    await refreshAuctionSummary();
  });
  console.info('\n=== auction sync completed ===');
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  const guardMinutes = Number(process.env.SYNC_GUARD_MINUTES) || 20;
  installRuntimeGuard({ maxMinutes: guardMinutes, name: 'syncAuction', prisma });
  main().catch((e) => { console.error('Fatal error:', e); process.exit(1); });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run __tests__/scripts/syncAuction.result.test.ts`
Expected: PASS (4).

- [ ] **Step 5: 빌드 확인 (타입)**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run build 2>&1 | tail -20`
Expected: 컴파일 에러 없음. (region.bjdCode가 5자리 초과 시 slice 일관성 확인)

- [ ] **Step 6: Commit**

```bash
git add backend/src/scripts/syncAuction.ts backend/__tests__/scripts/syncAuction.result.test.ts
git commit -m "feat(auction): close-capture, refreshAuctionSummary, sync main"
```

---

## Task 7: 조회 서비스 auctionService.ts (TDD)

geocoding은 기존 `geocodeRealEstate` 패턴을 sync 후속으로 두되, v1은 sync 시 API 좌표(있으면) 사용 + 좌표 없으면 지도 생략(프론트). 별도 geocode Task는 후속(§Future).

**Files:**
- Create: `backend/src/services/auctionService.ts`
- Test: `backend/__tests__/services/auctionService.test.ts`

- [ ] **Step 1: 실패 테스트 (prisma mock)**

```typescript
// backend/__tests__/services/auctionService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    auctionItem: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
    auctionAreaSummary: { findMany: vi.fn() },
  },
}));
vi.mock('../../src/lib/prisma.js', () => ({ prisma: mockPrisma, default: mockPrisma }));

import { getItems, getItemDetail, getRanking } from '../../src/services/auctionService.js';

beforeEach(() => { vi.clearAllMocks(); });

describe('getItems', () => {
  it('필터+페이징, BigInt 직렬화', async () => {
    mockPrisma.auctionItem.count.mockResolvedValue(1);
    mockPrisma.auctionItem.findMany.mockResolvedValue([
      { id: 1, cltrMngNo: 'A', apslAssAmt: 300000000n, minBidPrc: 210000000n, usageGroup: 'residential' },
    ]);
    const r = await getItems({ usage: 'residential', page: 1, limit: 20 });
    expect(r.total).toBe(1);
    expect(r.items[0].apslAssAmt).toBe(300000000); // Number
    expect(mockPrisma.auctionItem.findMany).toHaveBeenCalled();
  });
});

describe('getItemDetail', () => {
  it('cltrMngNo로 단건 + 직렬화', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue({ id: 1, cltrMngNo: 'A', winBidPrc: 850000000n, bidRate: { toNumber: () => 85 } });
    mockPrisma.auctionItem.findMany.mockResolvedValue([]); // 같은 시군구 다른 물건
    const r = await getItemDetail('A');
    expect(r?.item.cltrMngNo).toBe('A');
    expect(r?.item.winBidPrc).toBe(850000000);
    expect(r?.item.bidRate).toBe(85);
  });
  it('없으면 null', async () => {
    mockPrisma.auctionItem.findUnique.mockResolvedValue(null);
    expect(await getItemDetail('X')).toBeNull();
  });
});

describe('getRanking', () => {
  it('isIndexable 집계만 낙찰가율 정렬', async () => {
    mockPrisma.auctionAreaSummary.findMany.mockResolvedValue([
      { bjdCode: '11680', usageGroup: 'residential', city: '서울특별시', district: '강남구', avgBidRate: { toNumber: () => 82 }, soldCount: 10 },
    ]);
    const r = await getRanking({ usage: 'residential', order: 'high', limit: 20 });
    expect(r[0].avgBidRate).toBe(82);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/services/auctionService.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```typescript
// backend/src/services/auctionService.ts
import { prisma } from '../lib/prisma.js';
// ⚠️ buildRegionFilter는 src/services/cityMapping.ts에 있음 (landService.ts:2와 동일 — '../lib/' 아님!)
import { buildRegionFilter } from './cityMapping.js';

function serializeRow<T extends Record<string, any>>(row: T): any {
  const out: Record<string, any> = { ...row };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (typeof v === 'bigint') out[k] = Number(v);
    else if (v && typeof v === 'object' && typeof v.toNumber === 'function') out[k] = v.toNumber();
    else if (v instanceof Date) out[k] = v.toISOString();
  }
  return out;
}

export interface ItemsParams {
  city?: string; district?: string; usage?: string; status?: string;
  sort?: 'deadline' | 'apsl' | 'bidRate'; page: number; limit: number;
}
export async function getItems(p: ItemsParams) {
  const where: Record<string, any> = { ...buildRegionFilter(p.city, p.district) };
  if (p.usage) where.usageGroup = p.usage;
  if (p.status === 'ongoing') where.status = { in: ['ongoing', 'scheduled'] };
  else if (p.status === 'closed') where.isClosed = true;
  const orderBy = p.sort === 'apsl' ? { apslAssAmt: 'desc' as const }
    : p.sort === 'bidRate' ? { bidRate: 'desc' as const }
    : { bidCloseDtm: 'asc' as const };
  const [total, rows] = await Promise.all([
    prisma.auctionItem.count({ where }),
    prisma.auctionItem.findMany({ where, orderBy, skip: (p.page - 1) * p.limit, take: p.limit }),
  ]);
  return { items: rows.map(serializeRow), total, page: p.page, totalPages: Math.ceil(total / p.limit) };
}

export async function getItemDetail(cltrMngNo: string) {
  const item = await prisma.auctionItem.findUnique({ where: { cltrMngNo } });
  if (!item) return null;
  const nearby = await prisma.auctionItem.findMany({
    where: { bjdCode: item.bjdCode, usageGroup: item.usageGroup, cltrMngNo: { not: cltrMngNo }, isClosed: false },
    orderBy: { bidCloseDtm: 'asc' }, take: 6,
  });
  return { item: serializeRow(item), nearby: nearby.map(serializeRow) };
}

export interface RegionDetailParams { bjdCode: string; }
export async function getRegionDetail(p: RegionDetailParams) {
  const summaries = await prisma.auctionAreaSummary.findMany({ where: { bjdCode: p.bjdCode } });
  const active = await prisma.auctionItem.findMany({
    where: { bjdCode: p.bjdCode, isClosed: false }, orderBy: { bidCloseDtm: 'asc' }, take: 20,
  });
  const recentSold = await prisma.auctionItem.findMany({
    where: { bjdCode: p.bjdCode, resultType: 'sold' }, orderBy: { resultDate: 'desc' }, take: 10,
  });
  return {
    usageGroups: summaries.map(serializeRow),
    activeItems: active.map(serializeRow),
    recentSold: recentSold.map(serializeRow),
  };
}

export async function getCityDetail(city: string) {
  const where = buildRegionFilter(city);
  const summaries = await prisma.auctionAreaSummary.findMany({ where });
  // 시군구별 합산
  const byDistrict = new Map<string, any>();
  for (const s of summaries) {
    const cur = byDistrict.get(s.district) ?? { district: s.district, bjdCode: s.bjdCode, activeCount: 0, soldCount: 0, isIndexable: false };
    cur.activeCount += s.activeCount; cur.soldCount += s.soldCount; cur.isIndexable ||= s.isIndexable;
    byDistrict.set(s.district, cur);
  }
  return { districts: [...byDistrict.values()] };
}

// /regions: 시군구 단위 집계 목록(용도 합산). 허브 지역 리스트 + 시군구 페이지 bjdCode 해석에 사용.
export interface RegionListParams { city?: string; onlyIndexable?: boolean; }
export async function getRegionList(p: RegionListParams) {
  const where: Record<string, any> = { ...buildRegionFilter(p.city) };
  if (p.onlyIndexable) where.isIndexable = true;
  const summaries = await prisma.auctionAreaSummary.findMany({ where });
  const byDistrict = new Map<string, any>();
  for (const s of summaries) {
    const key = `${s.city}|${s.district}`;
    const cur = byDistrict.get(key) ?? { city: s.city, district: s.district, bjdCode: s.bjdCode, activeCount: 0, closedCount: 0, soldCount: 0, isIndexable: false };
    cur.activeCount += s.activeCount; cur.closedCount += s.closedCount; cur.soldCount += s.soldCount;
    cur.isIndexable ||= s.isIndexable;
    byDistrict.set(key, cur);
  }
  return { items: [...byDistrict.values()] };
}

export async function getHubSummary() {
  const summaries = await prisma.auctionAreaSummary.findMany();
  const totalActive = summaries.reduce((a, s) => a + s.activeCount, 0);
  const totalSold = summaries.reduce((a, s) => a + s.soldCount, 0);
  return { totalActive, totalSold, regionCount: new Set(summaries.map((s) => s.bjdCode)).size };
}

export interface RankingParams { usage?: string; order: 'high' | 'low'; limit: number; }
export async function getRanking(p: RankingParams) {
  const where: Record<string, any> = { isIndexable: true, soldCount: { gte: 3 }, avgBidRate: { not: null } };
  if (p.usage) where.usageGroup = p.usage;
  const rows = await prisma.auctionAreaSummary.findMany({
    where, orderBy: { avgBidRate: p.order === 'high' ? 'desc' : 'asc' }, take: p.limit,
  });
  return rows.map(serializeRow);
}

export async function getSitemapEntries() {
  const indexable = await prisma.auctionAreaSummary.findMany({
    where: { isIndexable: true }, select: { city: true, district: true, bjdCode: true, usageGroup: true },
  });
  const items = await prisma.auctionItem.findMany({
    where: { status: { in: ['ongoing', 'scheduled', 'sold', 'failed'] } }, select: { cltrMngNo: true }, take: 50000,
  });
  return { regions: indexable, items: items.map((i) => i.cltrMngNo) };
}
```

- [ ] **Step 4: 통과 확인 + Commit**

Run: `npx vitest run __tests__/services/auctionService.test.ts` → PASS.
```bash
git add backend/src/services/auctionService.ts backend/__tests__/services/auctionService.test.ts
git commit -m "feat(auction): query service"
```

---

## Task 8: Zod 스키마

**Files:**
- Create: `backend/src/schemas/auction.ts`

- [ ] **Step 1: 구현 (스키마는 컴파일·라우트테스트로 검증)**

```typescript
// backend/src/schemas/auction.ts
import { z } from 'zod';

export const AuctionItemsSchema = z.object({
  city: z.string().max(50).optional(),
  district: z.string().max(50).optional(),
  usage: z.enum(['residential', 'land', 'commercial', 'industrial', 'complex', 'etc']).optional(),
  status: z.enum(['ongoing', 'closed']).optional(),
  sort: z.enum(['deadline', 'apsl', 'bidRate']).default('deadline'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
export const AuctionRegionsSchema = z.object({
  city: z.string().max(50).optional(),
  onlyIndexable: z.coerce.boolean().optional(),
});
export const AuctionRegionSchema = z.object({ bjdCode: z.string().min(1).max(5) });
export const AuctionCitySchema = z.object({ city: z.string().min(1).max(50) });
export const AuctionItemDetailSchema = z.object({ cltrMngNo: z.string().min(1).max(50) });
export const AuctionRankingSchema = z.object({
  usage: z.enum(['residential', 'land', 'commercial', 'industrial', 'complex', 'etc']).optional(),
  order: z.enum(['high', 'low']).default('high'),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/schemas/auction.ts
git commit -m "feat(auction): zod request schemas"
```

---

## Task 9: 라우트 + 마운트 (통합 테스트)

**Files:**
- Create: `backend/src/routes/auction.ts`
- Modify: `backend/src/app.ts`
- Test: `backend/__tests__/routes/auction.test.ts`

- [ ] **Step 1: 실패 테스트 (supertest)**

```typescript
// backend/__tests__/routes/auction.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';

vi.mock('../../src/services/auctionService.js', () => ({
  getItems: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, totalPages: 0 }),
  getItemDetail: vi.fn().mockResolvedValue({ item: { cltrMngNo: 'A' }, nearby: [] }),
  getRegionList: vi.fn().mockResolvedValue({ items: [] }),
  getRegionDetail: vi.fn().mockResolvedValue({ usageGroups: [], activeItems: [], recentSold: [] }),
  getCityDetail: vi.fn().mockResolvedValue({ districts: [] }),
  getHubSummary: vi.fn().mockResolvedValue({ totalActive: 0, totalSold: 0, regionCount: 0 }),
  getRanking: vi.fn().mockResolvedValue([]),
  getSitemapEntries: vi.fn().mockResolvedValue({ regions: [], items: [] }),
}));

import app from '../../src/app.js';

describe('auction routes', () => {
  it('GET /api/auction/items 200', async () => {
    const res = await request(app).get('/api/auction/items?usage=residential');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
  it('GET /api/auction/item/:cltrMngNo 200', async () => {
    const res = await request(app).get('/api/auction/item/A');
    expect(res.status).toBe(200);
    expect(res.body.data.item.cltrMngNo).toBe('A');
  });
  it('GET /api/auction/items 잘못된 usage 422', async () => {
    const res = await request(app).get('/api/auction/items?usage=bogus');
    expect(res.status).toBe(422);
  });
  it('GET /api/auction/ranking 200', async () => {
    expect((await request(app).get('/api/auction/ranking')).status).toBe(200);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run __tests__/routes/auction.test.ts`
Expected: FAIL (route not mounted).

- [ ] **Step 3: 라우트 구현**

```typescript
// backend/src/routes/auction.ts
import { Router, type Request, type Response } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import { validate } from '../middlewares/validate.js';
import {
  AuctionItemsSchema, AuctionRegionsSchema, AuctionRegionSchema, AuctionCitySchema, AuctionItemDetailSchema, AuctionRankingSchema,
} from '../schemas/auction.js';
import {
  getItems, getItemDetail, getRegionList, getRegionDetail, getCityDetail, getHubSummary, getRanking, getSitemapEntries,
} from '../services/auctionService.js';

const router = Router();

router.get('/hub-summary', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getHubSummary() });
}));
router.get('/items', validate(AuctionItemsSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getItems(req.query as any) });
}));
router.get('/ranking', validate(AuctionRankingSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getRanking(req.query as any) });
}));
router.get('/regions', validate(AuctionRegionsSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getRegionList(req.query as any) });
}));
router.get('/region', validate(AuctionRegionSchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getRegionDetail(req.query as any) });
}));
router.get('/city', validate(AuctionCitySchema, 'query'), asyncHandler(async (req: Request, res: Response) => {
  res.json({ success: true, data: await getCityDetail((req.query as any).city) });
}));
router.get('/sitemap', asyncHandler(async (_req: Request, res: Response) => {
  res.json({ success: true, data: await getSitemapEntries() });
}));
// item/:cltrMngNo 는 마지막(정적 경로 우선)
router.get('/item/:cltrMngNo', validate(AuctionItemDetailSchema, 'params'), asyncHandler(async (req: Request, res: Response) => {
  const data = await getItemDetail(req.params.cltrMngNo);
  if (!data) { res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: '물건을 찾을 수 없습니다' } }); return; }
  res.json({ success: true, data });
}));

export default router;
```

- [ ] **Step 4: app.ts 마운트** (`/api/auction`은 다른 라우트와 prefix 충돌 없음 — 순서 무관, real-estate 근처에 추가)

```typescript
// app.ts — import 추가
import auctionRouter from './routes/auction.js';
// 라우트 마운트부 (real-estate 라우트들 인근)
app.use('/api/auction', auctionRouter);
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run __tests__/routes/auction.test.ts`
Expected: PASS (4). (`validate(Schema, 'params')`는 이미 지원됨 — `validate.ts:31-32`가 'params'를 `Object.defineProperty`로 처리하고 `area.ts:58` 등 프로덕션에서 사용 중. 별도 대체 불필요.)

- [ ] **Step 6: 전체 백엔드 테스트 + Commit**

Run: `cd backend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test 2>&1 | tail -15 && npm run lint 2>&1 | tail -5`
Expected: 전체 PASS, lint 0 errors.
```bash
git add backend/src/routes/auction.ts backend/src/app.ts backend/__tests__/routes/auction.test.ts
git commit -m "feat(auction): routes + mount"
```

---

## Task 10: CI 일일 cron 추가

**Files:**
- Modify: `.github/workflows/sync-real-estate.yml`

- [ ] **Step 1: sync 루프 + 좀비 allowlist에 syncAuction 추가**

루프(현재 `... syncOffitelRent syncLandSale`)에 `syncAuction` 추가:
```yaml
            for SCRIPT in syncAptSale syncAptRent syncVillaSale syncVillaRent syncOffitelSale syncOffitelRent syncLandSale syncAuction; do
```
`kill_sync_zombies` case 문에 추가 — ⚠️ 마지막 패턴 `*dist/scripts/syncRentalAnnouncement*)` **바로 위 줄**에 삽입(맨 끝에 붙이면 종료 `)`가 깨짐):
```yaml
                  *dist/scripts/syncAuction*|\
                  *dist/scripts/syncRentalAnnouncement*)
```
(즉 기존 `*dist/scripts/syncRentalAnnouncement*)` 줄 앞에 `syncAuction` 줄을 추가하고 `)`는 그대로 마지막 줄에 유지)

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/sync-real-estate.yml
git commit -m "ci(auction): add syncAuction to daily real-estate sync"
```

---

## Self-Review (작성자 체크 — 완료)

- **Spec 커버리지:** 모델(Task1)·usageGroup(2)·transform(3)·summary/품질게이트(4)·fetch(5)·마감포착/sync(6)·service(7)·schema(8)·routes(9)·cron(10) — spec §5~12 백엔드 항목 모두 매핑. 부가기능 데이터(랭킹=getRanking, 시세비교/인프라=프론트에서 기존 realEstate/facility API 조합 → Plan 2) 커버.
- **Placeholder:** 없음. Task 0만 "인가 후 실측"으로 명시(land Task0와 동일 성격), documented 필드명으로 코드 작성됨.
- **타입 일관성:** `usageGroup` 6값, `status`(ongoing/scheduled/closed/sold/failed/cancelled), `resultType`(sold/failed/cancelled/null), BigInt 원단위, `cltrMngNo` 자연키 — 전 Task 일관.
- **알려진 위험:** ①API 미인가(prereq) ②실제 응답 태그명(특히 시군구코드 필드 — Task0 확정, bjdCode='' 시 지역 페이지 0건) ③geocoding은 후속(좌표 없으면 프론트 지도 생략) ④부분 스냅샷 실패 시 마감포착 스킵(오인 마감 방지).
- **리뷰 반영(2026-06-05):** BLOCKER(cityMapping import 경로 `./` 수정) / MAJOR(sync closure가 landArea·bldArea·dongName drop하던 것 수정 / bjdCode VarChar(5)로 통일) / GAP(`/regions` 엔드포인트 추가, captureClosedItems 부분실패 가드) / validate('params') 지원 확인 완료.

---

## 후속 (Plan 1 범위 외)
- geocoding 배치(`geocodeAuction.ts`, 좌표 없는 물건 카카오 지오코딩) — 프론트 지도/로드뷰 품질 향상용
- 배포 후 인가 완료 시 첫 스냅샷 수동 실행: `SYNC_GUARD_MINUTES=120 node dist/scripts/syncAuction.js`
