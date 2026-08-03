# 공매(온비드) 페이지 — Plan 2: Frontend & SEO Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ayo식 물건 리스트/상세 + 시군구 낙찰가율 집계 + 부가기능 5종을 갖춘 공매 프론트엔드를 구축하고 사이트(네비·카피·사이트맵)에 통합한다.

**Architecture:** 토지 프론트(types/composable/meta/pages + noindex SEO 게이트)와 동일 패턴. 지도+로드뷰는 기존 `useKakaoMap()`(이미 `initRoadview` 보유) 재사용. 시세비교·주변인프라는 기존 realEstate/facility API를 상세페이지에서 조합.

**Tech Stack:** Nuxt 3(SSR) + Vue 3 + Pinia + Tailwind + Vitest(happy-dom). `useApiBase()` + `$fetch<{success,data}>` 패턴.

**Spec:** `docs/superpowers/specs/2026-06-05-auction-public-sale-pages-design.md`
**Branch:** `feature/auction-pages` (Plan 1 이후 동일 브랜치)
**선행:** Plan 1 백엔드(`/api/auction/*`) 완료. 표시 단위 **원(₩)**.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `frontend/types/auction.ts` | 타입 + 표시 헬퍼(formatWon, formatWonKorean, formatBidRate, formatDiscount, statusLabel) |
| `frontend/composables/useAuction.ts` | `/api/auction/*` 호출 |
| `frontend/utils/auctionMeta.ts` | 메타/타이틀/FAQ |
| `frontend/components/auction/AuctionStatusBadge.vue` | 상태 뱃지 |
| `frontend/components/auction/AuctionCard.vue` | 리스트 카드(ayo식) |
| `frontend/components/auction/AuctionFilters.vue` | 지역/용도/상태 필터 |
| `frontend/components/auction/AuctionMap.vue` | 카카오 지도+로드뷰(useKakaoMap 재사용) |
| `frontend/components/auction/AuctionPriceCompare.vue` | 실거래가 시세비교(부가②) |
| `frontend/components/auction/AuctionNearbyFacilities.vue` | 주변 인프라(부가③) |
| `frontend/components/auction/AuctionBidHistory.vue` | 입찰 이력/회차 |
| `frontend/components/auction/AuctionRankingTable.vue` | 낙찰가율 랭킹(부가①) |
| `frontend/pages/auction/index.vue` | 허브(부가④ 마감임박/신규) |
| `frontend/pages/auction/list.vue` | 물건 리스트 |
| `frontend/pages/auction/ranking.vue` | 랭킹/통계 |
| `frontend/pages/auction/[city]/index.vue` | 시도 집계 |
| `frontend/pages/auction/[city]/[district]/index.vue` | 시군구 집계 |
| `frontend/pages/auction/item/[cltrMngNo].vue` | 물건 상세 |
| `frontend/types/facility.ts` | 네비 "공매" 드롭다운 |
| `frontend/public/icons/category/auction.webp` | 전용 아이콘 |
| 카피/사이트맵 파일들 | 공매 언급/사이트맵 엔트리 |

**citySlug 매핑:** 기존 `CITY_SLUG_MAP`/`CITY_SLUG_TO_FULL`(프론트 공용) 재사용. district slug는 토지 페이지에서 쓰는 `DISTRICT_SLUG_MAP` 동일 사용. bjdCode는 집계 API 응답에서 받아 상세/링크에 사용.

---

## Task 1: types/auction.ts (TDD)

**Files:**
- Create: `frontend/types/auction.ts`
- Test: `frontend/tests/types/auction.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
// frontend/tests/types/auction.test.ts
import { describe, it, expect } from 'vitest';
import { formatWon, formatWonKorean, formatBidRate, formatDiscount, statusLabel, AUCTION_SLUG } from '~/types/auction';

describe('auction helpers', () => {
  it('formatWon: 천단위 콤마', () => {
    expect(formatWon(210000000)).toBe('210,000,000');
    expect(formatWon(null)).toBe('-');
  });
  it('formatWonKorean: 억/만원 (원단위 입력)', () => {
    expect(formatWonKorean(210000000)).toBe('2억 1,000만원');
    expect(formatWonKorean(3000000)).toBe('300만원');
    expect(formatWonKorean(100000000)).toBe('1억원');
  });
  it('formatBidRate: % 표기', () => {
    expect(formatBidRate(82.5)).toBe('82.5%');
    expect(formatBidRate(null)).toBe('-');
  });
  it('formatDiscount: 감정가 대비 할인율(음수=할인)', () => {
    expect(formatDiscount(1000, 800)).toBe('-20%'); // 최저가가 감정가보다 20% 낮음
    expect(formatDiscount(null, 800)).toBe('-');
  });
  it('statusLabel: 상태 한글', () => {
    expect(statusLabel('ongoing')).toBe('진행중');
    expect(statusLabel('sold')).toBe('낙찰');
    expect(statusLabel('failed')).toBe('유찰');
  });
  it('AUCTION_SLUG', () => { expect(AUCTION_SLUG).toBe('auction'); });
});
```

- [ ] **Step 2: 실패 확인**

Run: `cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npx vitest run tests/types/auction.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```typescript
// frontend/types/auction.ts
export const AUCTION_SLUG = 'auction' as const;
export type UsageGroup = 'residential' | 'land' | 'commercial' | 'industrial' | 'complex' | 'etc';
export type AuctionStatus = 'ongoing' | 'scheduled' | 'closed' | 'sold' | 'failed' | 'cancelled';

export interface AuctionItem {
  id: number; cltrMngNo: string; pbctCdtnNo: string; plnmNo: string | null;
  city: string; district: string; bjdCode: string; dongName: string | null; address: string;
  usage: string | null; usageGroup: UsageGroup; propertyType: string | null; dpslMtdNm: string | null;
  landArea: number | null; bldArea: number | null;
  apslAssAmt: number | null; minBidPrc: number | null; failCnt: number; bidRound: number | null;
  bidBeginDtm: string | null; bidCloseDtm: string | null; orgNm: string | null; pvctTrgtYn: boolean;
  status: AuctionStatus; isClosed: boolean;
  resultType: string | null; winBidPrc: number | null; bidRate: number | null; resultDate: string | null;
  lat: number | null; lng: number | null;
}
export interface AuctionItemsResult { items: AuctionItem[]; total: number; page: number; totalPages: number; }
export interface AuctionItemDetailResult { item: AuctionItem; nearby: AuctionItem[]; }
export interface AuctionAreaSummary {
  bjdCode: string; usageGroup: UsageGroup; city: string; district: string;
  activeCount: number; closedCount: number; soldCount: number;
  avgBidRate: number | null; avgApslAmt: number | null; avgWinBidPrc: number | null;
  failRate: number | null; latestResultDate: string | null; isIndexable: boolean;
}
export interface AuctionRegionDetailResult {
  usageGroups: AuctionAreaSummary[]; activeItems: AuctionItem[]; recentSold: AuctionItem[];
}
export interface AuctionCityDetailResult {
  districts: Array<{ district: string; bjdCode: string; activeCount: number; soldCount: number; isIndexable: boolean }>;
}
export interface AuctionHubSummary { totalActive: number; totalSold: number; regionCount: number; }

export const USAGE_GROUP_LABEL: Record<UsageGroup, string> = {
  residential: '아파트·주거용', land: '토지', commercial: '상가·업무', industrial: '공장·창고', complex: '복합', etc: '기타',
};

export function formatWon(v: number | null | undefined): string {
  if (v == null) return '-';
  return Math.round(v).toLocaleString('ko-KR');
}
export function formatWonKorean(v: number | null | undefined): string {
  if (v == null) return '-';
  const won = Math.round(v);
  const man = Math.floor(won / 10000); // 만원 단위
  if (man >= 10000) {
    const eok = Math.floor(man / 10000); const rest = man % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString('ko-KR')}만원` : `${eok}억원`;
  }
  if (man >= 1) return `${man.toLocaleString('ko-KR')}만원`;
  return `${won.toLocaleString('ko-KR')}원`;
}
export function formatBidRate(v: number | null | undefined): string {
  return v == null ? '-' : `${v}%`;
}
export function formatDiscount(apslAssAmt: number | null | undefined, minBidPrc: number | null | undefined): string {
  if (apslAssAmt == null || minBidPrc == null || apslAssAmt <= 0) return '-';
  const pct = Math.round((minBidPrc / apslAssAmt - 1) * 100);
  return `${pct > 0 ? '+' : ''}${pct}%`;
}
export function formatAuctionDate(value: string | null | undefined): string {
  if (!value) return '-';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '-';
  const y = d.getUTCFullYear(), m = String(d.getUTCMonth() + 1).padStart(2, '0'), day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}.${m}.${day}`;
}
export function statusLabel(s: AuctionStatus | string): string {
  const map: Record<string, string> = { ongoing: '진행중', scheduled: '입찰예정', closed: '마감', sold: '낙찰', failed: '유찰', cancelled: '취소' };
  return map[s] ?? s;
}
export function isAuctionItemIndexable(item: Pick<AuctionItem, 'status'>): boolean {
  return item.status !== 'cancelled';
}
```

- [ ] **Step 4: 통과 확인 + Commit**

Run: `npx vitest run tests/types/auction.test.ts` → PASS (6).
```bash
git add frontend/types/auction.ts frontend/tests/types/auction.test.ts
git commit -m "feat(auction): frontend types + display helpers"
```

---

## Task 2: composables/useAuction.ts (TDD)

**Files:**
- Create: `frontend/composables/useAuction.ts`
- Test: `frontend/tests/composables/useAuction.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
// frontend/tests/composables/useAuction.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAuction } from '~/composables/useAuction';

beforeEach(() => { vi.clearAllMocks(); });

describe('useAuction', () => {
  it('getItems: 쿼리스트링 구성 + data 언랩', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { items: [], total: 0, page: 1, totalPages: 0 } });
    const { getItems } = useAuction();
    const r = await getItems({ usage: 'residential', page: 1, limit: 20 });
    expect(r.total).toBe(0);
    const url = (globalThis as any).$fetch.mock.calls[0][0];
    expect(url).toContain('/api/auction/items');
    expect(url).toContain('usage=residential');
  });
  it('getItemDetail: cltrMngNo 경로', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { item: { cltrMngNo: 'A' }, nearby: [] } });
    const { getItemDetail } = useAuction();
    const r = await getItemDetail('A');
    expect(r.item.cltrMngNo).toBe('A');
    expect((globalThis as any).$fetch.mock.calls[0][0]).toContain('/api/auction/item/A');
  });
  it('getRanking 호출', async () => {
    (globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: [] });
    await useAuction().getRanking({ order: 'high', limit: 20 });
    expect((globalThis as any).$fetch.mock.calls[0][0]).toContain('/api/auction/ranking');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run tests/composables/useAuction.test.ts`
Expected: FAIL.

- [ ] **Step 3: 구현**

```typescript
// frontend/composables/useAuction.ts
import type {
  AuctionItemsResult, AuctionItemDetailResult, AuctionRegionDetailResult,
  AuctionCityDetailResult, AuctionHubSummary, AuctionAreaSummary,
} from '~/types/auction'
import { useApiBase } from '~/composables/useApiBase'

export function useAuction() {
  const apiBase = useApiBase()
  const q = (obj: Record<string, unknown>) => {
    const p = new URLSearchParams()
    for (const [k, v] of Object.entries(obj)) if (v != null && v !== '') p.set(k, String(v))
    return p.toString()
  }
  async function getItems(params: { city?: string; district?: string; usage?: string; status?: string; sort?: string; page?: number; limit?: number }): Promise<AuctionItemsResult> {
    const res = await $fetch<{ success: boolean; data: AuctionItemsResult }>(`${apiBase}/api/auction/items?${q(params)}`)
    return res.data
  }
  async function getItemDetail(cltrMngNo: string): Promise<AuctionItemDetailResult> {
    const res = await $fetch<{ success: boolean; data: AuctionItemDetailResult }>(`${apiBase}/api/auction/item/${encodeURIComponent(cltrMngNo)}`)
    return res.data
  }
  async function getRegionDetail(bjdCode: string): Promise<AuctionRegionDetailResult> {
    const res = await $fetch<{ success: boolean; data: AuctionRegionDetailResult }>(`${apiBase}/api/auction/region?${q({ bjdCode })}`)
    return res.data
  }
  async function getCityDetail(city: string): Promise<AuctionCityDetailResult> {
    const res = await $fetch<{ success: boolean; data: AuctionCityDetailResult }>(`${apiBase}/api/auction/city?${q({ city })}`)
    return res.data
  }
  async function getHubSummary(): Promise<AuctionHubSummary> {
    const res = await $fetch<{ success: boolean; data: AuctionHubSummary }>(`${apiBase}/api/auction/hub-summary`)
    return res.data
  }
  async function getRanking(params: { usage?: string; order?: string; limit?: number }): Promise<AuctionAreaSummary[]> {
    const res = await $fetch<{ success: boolean; data: AuctionAreaSummary[] }>(`${apiBase}/api/auction/ranking?${q(params)}`)
    return res.data
  }
  return { getItems, getItemDetail, getRegionDetail, getCityDetail, getHubSummary, getRanking }
}
```

- [ ] **Step 4: 통과 + Commit**

Run: `npx vitest run tests/composables/useAuction.test.ts` → PASS (3).
```bash
git add frontend/composables/useAuction.ts frontend/tests/composables/useAuction.test.ts
git commit -m "feat(auction): useAuction composable"
```

---

## Task 3: utils/auctionMeta.ts

**Files:**
- Create: `frontend/utils/auctionMeta.ts`
- Test: `frontend/tests/utils/auctionMeta.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
// frontend/tests/utils/auctionMeta.test.ts
import { describe, it, expect } from 'vitest';
import { buildAuctionRegionTitle, buildAuctionItemTitle, AUCTION_META, AUCTION_FAQ } from '~/utils/auctionMeta';

describe('auctionMeta', () => {
  it('지역 타이틀', () => {
    expect(buildAuctionRegionTitle({ city: '서울', district: '강남구' })).toContain('강남구');
    expect(buildAuctionRegionTitle({})).toContain('전국');
  });
  it('물건 타이틀: 진행중=최저가, 마감=낙찰가', () => {
    expect(buildAuctionItemTitle({ address: '강남구 역삼동', usage: '오피스텔', minBidPrc: 210000000, status: 'ongoing' })).toContain('최저입찰가');
    expect(buildAuctionItemTitle({ address: '강남구 역삼동', usage: '오피스텔', winBidPrc: 250000000, status: 'sold' })).toContain('낙찰가');
  });
  it('META/FAQ 존재', () => {
    expect(AUCTION_META.label).toBe('공매');
    expect(AUCTION_FAQ.length).toBeGreaterThanOrEqual(4);
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3 구현**

```typescript
// frontend/utils/auctionMeta.ts
import { formatWonKorean } from '~/types/auction'

export const AUCTION_META = {
  label: '공매',
  icon: 'gavel',
  description: '온비드(한국자산관리공사) 부동산 공매 물건을 지역·용도별로 조회하세요. 감정가·최저입찰가·입찰일정과 지역별 낙찰가율 통계를 한눈에 확인할 수 있습니다.',
}

export function buildAuctionRegionTitle({ city, district }: { city?: string; district?: string } = {}): string {
  if (district) return `${district} 공매 물건·낙찰가율 | ${city ?? ''} | 일상킷`.replace(' |  |', ' |')
  if (city) return `${city} 공매 물건·낙찰가율 | 일상킷`
  return '전국 부동산 공매 물건·낙찰가율 | 일상킷'
}

export function buildAuctionRegionDescription({ city, district, avgBidRate, activeCount }: { city?: string; district?: string; avgBidRate?: number | null; activeCount?: number } = {}): string {
  const region = district ?? city ?? '전국'
  const ratePart = avgBidRate != null ? ` 평균 낙찰가율 ${avgBidRate}%,` : ''
  const activePart = activeCount != null ? ` 진행중 물건 ${activeCount}건을 포함한` : ''
  return `${region} 부동산 공매 정보입니다.${ratePart}${activePart} 감정가·최저입찰가·입찰일정과 용도별 낙찰가율 통계를 온비드 공식 데이터 기반으로 제공합니다.`
}

export function buildAuctionItemTitle({ address, usage, minBidPrc, winBidPrc, status }: { address: string; usage?: string | null; minBidPrc?: number | null; winBidPrc?: number | null; status?: string }): string {
  const u = usage ?? '부동산'
  if (status === 'sold' && winBidPrc != null) return `${address} ${u} 공매 - 낙찰가 ${formatWonKorean(winBidPrc)} | 일상킷`
  if (minBidPrc != null) return `${address} ${u} 공매 - 최저입찰가 ${formatWonKorean(minBidPrc)} | 일상킷`
  return `${address} ${u} 공매 물건 | 일상킷`
}
export function buildAuctionItemDescription({ address, usage, apslAssAmt, minBidPrc, status, winBidPrc }: { address: string; usage?: string | null; apslAssAmt?: number | null; minBidPrc?: number | null; status?: string; winBidPrc?: number | null }): string {
  const u = usage ?? '부동산'
  if (status === 'sold' && winBidPrc != null) return `${address} ${u} 공매 물건의 낙찰 결과입니다. 감정가 ${formatWonKorean(apslAssAmt)}, 낙찰가 ${formatWonKorean(winBidPrc)}. 온비드 공식 데이터 기반.`
  return `${address} ${u} 공매 물건 정보입니다. 감정가 ${formatWonKorean(apslAssAmt)}, 최저입찰가 ${formatWonKorean(minBidPrc)}. 입찰일정·위치·주변 시세를 확인하세요. 온비드 공식 데이터 기반.`
}

export const AUCTION_FAQ: Array<{ q: string; a: string }> = [
  { q: '공매와 경매는 어떻게 다른가요?', a: '경매는 법원이 채권자의 신청으로 진행하는 강제집행이고, 공매는 한국자산관리공사(온비드)가 세금 체납 압류재산·국유재산 등을 매각하는 절차입니다. 공매는 온비드에서 온라인으로 입찰하며 권리관계가 비교적 단순한 편입니다.' },
  { q: '낙찰가율이란 무엇인가요?', a: '낙찰가율은 감정가 대비 낙찰가의 비율(낙찰가÷감정가×100)입니다. 낙찰가율이 낮을수록 감정가보다 저렴하게 낙찰된 것으로, 지역·용도별 낙찰가율을 비교하면 시세 흐름을 파악할 수 있습니다.' },
  { q: '공매 입찰은 어떻게 참여하나요?', a: '온비드(www.onbid.co.kr) 회원가입 후 공동인증서로 로그인하여 온라인으로 입찰할 수 있습니다. 입찰보증금을 납부하고 입찰서를 제출하면 되며, 최고가 입찰자가 낙찰자가 됩니다.' },
  { q: '공매 데이터는 어디서 제공되나요?', a: '일상킷의 공매 정보는 한국자산관리공사 온비드의 공공데이터 공식 API를 기반으로 합니다. 진행중·예정 물건과 누적된 낙찰 결과를 함께 제공합니다.' },
  { q: '수의계약이란 무엇인가요?', a: '여러 차례 유찰된 공매 물건은 경쟁입찰 대신 수의계약(개별 협상 매각)으로 전환될 수 있습니다. 수의계약 가능 물건은 별도로 표시됩니다.' },
]
```

- [ ] **Step 4: 통과 + Commit**

Run: `npx vitest run tests/utils/auctionMeta.test.ts` → PASS (3).
```bash
git add frontend/utils/auctionMeta.ts frontend/tests/utils/auctionMeta.test.ts
git commit -m "feat(auction): meta titles + FAQ"
```

---

## Task 4: 표현 컴포넌트 (StatusBadge, Card, BidHistory) — TDD

**Files:**
- Create: `frontend/components/auction/AuctionStatusBadge.vue`, `AuctionCard.vue`, `AuctionBidHistory.vue`
- Test: `frontend/tests/components/auction/AuctionCard.test.ts`, `AuctionStatusBadge.test.ts`

- [ ] **Step 1: 실패 테스트**

```typescript
// frontend/tests/components/auction/AuctionStatusBadge.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue';

describe('AuctionStatusBadge', () => {
  it('상태 라벨 렌더', () => {
    expect(mount(AuctionStatusBadge, { props: { status: 'ongoing' } }).text()).toContain('진행중');
    expect(mount(AuctionStatusBadge, { props: { status: 'sold' } }).text()).toContain('낙찰');
  });
});
```

```typescript
// frontend/tests/components/auction/AuctionCard.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionCard from '~/components/auction/AuctionCard.vue';

const item = {
  cltrMngNo: '6012880', pbctCdtnNo: '1', address: '서울특별시 강남구 역삼동 123',
  usage: '오피스텔', usageGroup: 'residential', propertyType: '압류재산', district: '강남구',
  apslAssAmt: 300000000, minBidPrc: 210000000, failCnt: 2, bidRound: 7,
  bidBeginDtm: '2026-12-01T11:00:00.000Z', bidCloseDtm: '2026-12-01T16:00:00.000Z',
  status: 'ongoing', isClosed: false, winBidPrc: null, bidRate: null,
};

describe('AuctionCard', () => {
  it('소재지/감정가/상태/할인율 표시 + 상세 링크', () => {
    const w = mount(AuctionCard, { props: { item }, global: { stubs: { NuxtLink: { template: '<a :href="to"><slot/></a>', props: ['to'] }, AuctionStatusBadge: { template: '<span>진행중</span>' } } } });
    expect(w.text()).toContain('역삼동');
    expect(w.text()).toContain('300,000,000');
    expect(w.html()).toContain('/auction/item/6012880');
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3 구현**

```vue
<!-- frontend/components/auction/AuctionStatusBadge.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import { statusLabel, type AuctionStatus } from '~/types/auction'
const props = defineProps<{ status: AuctionStatus | string }>()
const label = computed(() => statusLabel(props.status))
const cls = computed(() => {
  switch (props.status) {
    case 'ongoing': return 'bg-primary-50 text-primary'
    case 'scheduled': return 'bg-amber-50 text-amber-700'
    case 'sold': return 'bg-emerald-50 text-emerald-700'
    case 'failed': return 'bg-slate-100 text-slate-600'
    case 'cancelled': return 'bg-rose-50 text-rose-700'
    default: return 'bg-slate-100 text-slate-600'
  }
})
</script>
<template>
  <span :class="['inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold', cls]">{{ label }}</span>
</template>
```

```vue
<!-- frontend/components/auction/AuctionCard.vue -->
<script setup lang="ts">
import { computed } from 'vue'
import type { AuctionItem } from '~/types/auction'
import { formatWon, formatDiscount, formatAuctionDate, USAGE_GROUP_LABEL } from '~/types/auction'
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue'
const props = defineProps<{ item: AuctionItem }>()
const to = computed(() => `/auction/item/${props.item.cltrMngNo}`)
const discount = computed(() => formatDiscount(props.item.apslAssAmt, props.item.minBidPrc))
const iconImg = computed(() => `/icons/category/auction.webp`)
</script>
<template>
  <NuxtLink :to="to" class="block bg-white rounded-xl border border-line p-4 shadow-card hover:border-primary/30 transition-[box-shadow,border-color]">
    <div class="flex items-center gap-2 mb-2">
      <AuctionStatusBadge :status="item.status" />
      <span v-if="item.propertyType" class="text-caption text-slate-500">{{ item.propertyType }}</span>
      <span v-if="item.failCnt > 0" class="text-caption text-rose-600">유찰 {{ item.failCnt }}회</span>
      <span v-if="item.bidRound" class="text-caption text-slate-400">{{ item.bidRound }}차</span>
    </div>
    <p class="text-sm font-semibold text-slate-900 truncate">{{ item.address }}</p>
    <p class="text-caption text-slate-500 mt-0.5">{{ item.usage ?? USAGE_GROUP_LABEL[item.usageGroup] }} · 📍{{ item.district }}</p>
    <div class="mt-3 flex items-end justify-between">
      <div>
        <p class="text-caption text-slate-400">감정가</p>
        <p class="text-sm font-bold text-slate-900">{{ formatWon(item.apslAssAmt) }}<span v-if="discount !== '-'" class="ml-1 text-xs text-emerald-600">{{ discount }}</span></p>
      </div>
      <p class="text-caption text-slate-500">{{ formatAuctionDate(item.bidCloseDtm) }} 마감</p>
    </div>
  </NuxtLink>
</template>
```

```vue
<!-- frontend/components/auction/AuctionBidHistory.vue -->
<script setup lang="ts">
import type { AuctionItem } from '~/types/auction'
import { formatWon, formatWonKorean, formatBidRate, statusLabel } from '~/types/auction'
defineProps<{ item: AuctionItem }>()
</script>
<template>
  <div class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-3">입찰 정보</h3>
    <dl class="grid grid-cols-2 gap-y-2 text-sm">
      <dt class="text-slate-500">감정가</dt><dd class="text-right font-medium">{{ formatWonKorean(item.apslAssAmt) }}</dd>
      <dt class="text-slate-500">최저입찰가</dt><dd class="text-right font-medium">{{ formatWonKorean(item.minBidPrc) }}</dd>
      <template v-if="item.isClosed && item.winBidPrc != null">
        <dt class="text-slate-500">낙찰가</dt><dd class="text-right font-bold text-emerald-700">{{ formatWonKorean(item.winBidPrc) }}</dd>
        <dt class="text-slate-500">낙찰가율</dt><dd class="text-right font-bold text-emerald-700">{{ formatBidRate(item.bidRate) }}</dd>
      </template>
      <dt class="text-slate-500">유찰 횟수</dt><dd class="text-right">{{ item.failCnt }}회 ({{ item.bidRound ?? '-' }}차)</dd>
      <dt class="text-slate-500">처분방식</dt><dd class="text-right">{{ item.dpslMtdNm ?? '-' }}</dd>
      <dt class="text-slate-500">상태</dt><dd class="text-right">{{ statusLabel(item.status) }}</dd>
    </dl>
  </div>
</template>
```

- [ ] **Step 4: 통과 + Commit**

Run: `npx vitest run tests/components/auction/` → PASS.
```bash
git add frontend/components/auction/AuctionStatusBadge.vue frontend/components/auction/AuctionCard.vue frontend/components/auction/AuctionBidHistory.vue frontend/tests/components/auction/
git commit -m "feat(auction): card, status badge, bid history components"
```

---

## Task 5: AuctionMap.vue (지도+로드뷰, useKakaoMap 재사용)

**Files:**
- Create: `frontend/components/auction/AuctionMap.vue`
- Test: `frontend/tests/components/auction/AuctionMap.test.ts`

`useKakaoMap()`은 이미 `initMap`, `addMarkers`, `initRoadview(container, lat, lng, onResult)` 제공. 좌표 없으면 컴포넌트 자체를 렌더하지 않음(부모 `v-if`).

- [ ] **Step 1: 실패 테스트 (SSR 가드/렌더)**

```typescript
// frontend/tests/components/auction/AuctionMap.test.ts
import { describe, it, expect, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionMap from '~/components/auction/AuctionMap.vue';

vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    initMap: vi.fn().mockResolvedValue(undefined),
    addMarkers: vi.fn(),
    setCenter: vi.fn(),
    initRoadview: vi.fn().mockImplementation((_c: any, _lat: number, _lng: number, cb: (a: boolean) => void) => cb(true)),
    isLoaded: { value: true },
  }),
}));

describe('AuctionMap', () => {
  it('좌표 있으면 지도/로드뷰 컨테이너 렌더', () => {
    const w = mount(AuctionMap, { props: { lat: 37.5, lng: 127.0, address: '강남구' } });
    expect(w.find('[data-testid="auction-map"]').exists()).toBe(true);
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3 구현**

```vue
<!-- frontend/components/auction/AuctionMap.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
const props = defineProps<{ lat: number; lng: number; address?: string }>()
const mapEl = ref<HTMLElement | null>(null)
const roadviewEl = ref<HTMLElement | null>(null)
const roadviewAvailable = ref(false)
const showRoadview = ref(false)
const { initMap, addMarkers, initRoadview } = useKakaoMap()

onMounted(async () => {
  if (!import.meta.client || !mapEl.value) return
  await initMap(mapEl.value, { center: { lat: props.lat, lng: props.lng }, level: 4 })
  // ⚠️ I1: addMarkers는 Facility 형태({lat,lng,id:string,name,category,...})를 받음. latitude/longitude 아님!
  addMarkers([{ id: 'auction', name: props.address ?? '위치', category: 'parking', address: null, roadAddress: null, lat: props.lat, lng: props.lng, city: '', district: '' } as any], {})
  if (roadviewEl.value) {
    await initRoadview(roadviewEl.value, props.lat, props.lng, (ok: boolean) => { roadviewAvailable.value = ok })
  }
})
</script>
<template>
  <div data-testid="auction-map" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-slate-900">위치</h3>
      <button v-if="roadviewAvailable" type="button" class="text-caption text-primary" @click="showRoadview = !showRoadview">
        {{ showRoadview ? '지도 보기' : '로드뷰 보기' }}
      </button>
    </div>
    <div v-show="!showRoadview" ref="mapEl" class="w-full h-64 rounded-lg overflow-hidden" />
    <div v-show="showRoadview" ref="roadviewEl" class="w-full h-64 rounded-lg overflow-hidden" />
    <p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
  </div>
</template>
```

- [ ] **Step 4: 통과 + Commit**

Run: `npx vitest run tests/components/auction/AuctionMap.test.ts` → PASS.
```bash
git add frontend/components/auction/AuctionMap.vue frontend/tests/components/auction/AuctionMap.test.ts
git commit -m "feat(auction): map + roadview component"
```

---

## Task 6: 부가 컴포넌트 (PriceCompare, NearbyFacilities, RankingTable, Filters)

기존 데이터 재사용: **PriceCompare**는 `useRealEstate`(같은 동 아파트/토지 평균) 또는 `useLand` 호출; **NearbyFacilities**는 `useFacilitySearch`(좌표 반경 검색)로 지하철/병원/학교; **RankingTable**은 `getRanking` 결과 테이블; **Filters**는 지역/용도/상태 select.

**Files:**
- Create: `frontend/components/auction/AuctionPriceCompare.vue`, `AuctionNearbyFacilities.vue`, `AuctionRankingTable.vue`, `AuctionFilters.vue`
- Test: `frontend/tests/components/auction/AuctionRankingTable.test.ts`, `AuctionFilters.test.ts`

- [ ] **Step 1: 실패 테스트 (RankingTable, Filters)**

```typescript
// frontend/tests/components/auction/AuctionRankingTable.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionRankingTable from '~/components/auction/AuctionRankingTable.vue';
const rows = [{ bjdCode: '11680', usageGroup: 'residential', city: '서울특별시', district: '강남구', avgBidRate: 82, soldCount: 10, activeCount: 5, isIndexable: true }];
describe('AuctionRankingTable', () => {
  it('낙찰가율/지역 렌더', () => {
    const w = mount(AuctionRankingTable, { props: { rows }, global: { stubs: { NuxtLink: { template: '<a><slot/></a>' } } } });
    expect(w.text()).toContain('강남구');
    expect(w.text()).toContain('82%');
  });
});
```

```typescript
// frontend/tests/components/auction/AuctionFilters.test.ts
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import AuctionFilters from '~/components/auction/AuctionFilters.vue';
describe('AuctionFilters', () => {
  it('용도 변경 시 update:usage emit', async () => {
    const w = mount(AuctionFilters, { props: { usage: '', status: '', city: '', district: '' } });
    const sel = w.find('select[data-testid="usage"]');
    await sel.setValue('land');
    expect(w.emitted('update:usage')?.[0]).toEqual(['land']);
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3 구현**

```vue
<!-- frontend/components/auction/AuctionRankingTable.vue -->
<script setup lang="ts">
import type { AuctionAreaSummary } from '~/types/auction'
import { formatBidRate, USAGE_GROUP_LABEL } from '~/types/auction'
defineProps<{ rows: AuctionAreaSummary[] }>()
</script>
<template>
  <table class="w-full text-sm">
    <thead><tr class="text-caption text-slate-500 border-b border-line">
      <th class="text-left py-2">지역</th><th class="text-left">용도</th><th class="text-right">낙찰가율</th><th class="text-right">낙찰</th>
    </tr></thead>
    <tbody>
      <tr v-for="(r, i) in rows" :key="i" class="border-b border-line/60">
        <td class="py-2">{{ r.district }}</td>
        <td>{{ USAGE_GROUP_LABEL[r.usageGroup] }}</td>
        <td class="text-right font-semibold">{{ formatBidRate(r.avgBidRate) }}</td>
        <td class="text-right text-slate-500">{{ r.soldCount }}건</td>
      </tr>
    </tbody>
  </table>
</template>
```

```vue
<!-- frontend/components/auction/AuctionFilters.vue -->
<script setup lang="ts">
import { USAGE_GROUP_LABEL } from '~/types/auction'
defineProps<{ usage: string; status: string; city: string; district: string }>()
defineEmits<{ 'update:usage': [string]; 'update:status': [string]; 'update:city': [string]; 'update:district': [string] }>()
const usageOptions = Object.entries(USAGE_GROUP_LABEL)
</script>
<template>
  <div class="flex flex-wrap gap-2">
    <select data-testid="usage" :value="usage" class="rounded-lg border border-line px-3 py-2 text-sm" @change="$emit('update:usage', ($event.target as HTMLSelectElement).value)">
      <option value="">전체 용도</option>
      <option v-for="[k, v] in usageOptions" :key="k" :value="k">{{ v }}</option>
    </select>
    <select data-testid="status" :value="status" class="rounded-lg border border-line px-3 py-2 text-sm" @change="$emit('update:status', ($event.target as HTMLSelectElement).value)">
      <option value="">전체 상태</option>
      <option value="ongoing">진행중·예정</option>
      <option value="closed">마감</option>
    </select>
  </div>
</template>
```

```vue
<!-- frontend/components/auction/AuctionPriceCompare.vue -->
<script setup lang="ts">
// 같은 동(또는 시군구) 실거래가 평균을 받아 감정가와 비교. 데이터는 부모가 주입.
import { computed } from 'vue'
import { formatWonKorean } from '~/types/auction'
const props = defineProps<{ apslAssAmt: number | null; marketAvg: number | null; marketLabel: string }>()
const diff = computed(() => {
  if (props.apslAssAmt == null || props.marketAvg == null || props.marketAvg <= 0) return null
  return Math.round((props.apslAssAmt / props.marketAvg - 1) * 100)
})
</script>
<template>
  <div v-if="marketAvg != null" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-2">실거래가 시세 비교</h3>
    <p class="text-sm text-slate-600">{{ marketLabel }} 평균 실거래가 <b>{{ formatWonKorean(marketAvg) }}</b></p>
    <p v-if="diff != null" class="text-sm mt-1">감정가는 시세 대비
      <b :class="diff <= 0 ? 'text-emerald-700' : 'text-rose-600'">{{ diff > 0 ? '+' : '' }}{{ diff }}%</b>
    </p>
  </div>
</template>
```

```vue
<!-- frontend/components/auction/AuctionNearbyFacilities.vue -->
<script setup lang="ts">
// 부모가 facility 검색 결과(지하철/병원/학교)를 주입.
defineProps<{ facilities: Array<{ category: string; name: string; distance?: number }> }>()
</script>
<template>
  <div v-if="facilities.length" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-2">주변 생활 인프라</h3>
    <ul class="space-y-1 text-sm">
      <li v-for="(f, i) in facilities" :key="i" class="flex justify-between">
        <span class="text-slate-700">{{ f.name }}</span>
        <span class="text-caption text-slate-400">{{ f.category }}<template v-if="f.distance"> · {{ f.distance }}m</template></span>
      </li>
    </ul>
  </div>
</template>
```

- [ ] **Step 4: 통과 + Commit**

Run: `npx vitest run tests/components/auction/AuctionRankingTable.test.ts tests/components/auction/AuctionFilters.test.ts` → PASS.
```bash
git add frontend/components/auction/AuctionPriceCompare.vue frontend/components/auction/AuctionNearbyFacilities.vue frontend/components/auction/AuctionRankingTable.vue frontend/components/auction/AuctionFilters.vue frontend/tests/components/auction/AuctionRankingTable.test.ts frontend/tests/components/auction/AuctionFilters.test.ts
git commit -m "feat(auction): price-compare, nearby, ranking table, filters"
```

---

## Task 7: 물건 상세 페이지 `item/[cltrMngNo].vue` (핵심, SEO 게이트)

> **B1 수정(리뷰 반영):** head 헬퍼를 `.vue`의 named export로 두면 테스트가 `<script setup>`의 top-level `await useAsyncData`/`throw createError`를 import 시점에 실행해 깨진다(전역 mock에 `createError` 없음). → **헬퍼를 `utils/auctionHead.ts`(순수 .ts)로 분리**하고 페이지·테스트 모두 거기서 import. 페이지는 land `[dong].vue`처럼 **auto-import**(`#imports` 사용 안 함, I2)로 `useRoute/useAsyncData/createError/useHead` 사용.

**Files:**
- Create: `frontend/utils/auctionHead.ts` (head 헬퍼, 순수 함수)
- Create: `frontend/pages/auction/item/[cltrMngNo].vue`
- Test: `frontend/tests/utils/auctionHead.test.ts` (헬퍼 단위 테스트 — .vue import 안 함)

- [ ] **Step 1: 실패 테스트 (헬퍼 단위, .vue import 금지)**

```typescript
// frontend/tests/utils/auctionHead.test.ts
import { describe, it, expect } from 'vitest';
import { computeAuctionItemHead } from '~/utils/auctionHead';

describe('computeAuctionItemHead', () => {
  it('취소 물건은 noindex + canonical 생략', () => {
    const head = computeAuctionItemHead({ cltrMngNo: 'A', address: '강남구 역삼동', usage: '오피스텔', status: 'cancelled', apslAssAmt: 1, minBidPrc: 1 } as any, 'https://ilsangkit.co.kr/auction/item/A');
    expect(head.meta.some((m: any) => m.name === 'robots' && m.content.includes('noindex'))).toBe(true);
    expect((head as any).link).toBeUndefined();
  });
  it('진행중 물건은 canonical 출력', () => {
    const head = computeAuctionItemHead({ cltrMngNo: 'A', address: '강남구 역삼동', usage: '오피스텔', status: 'ongoing', apslAssAmt: 1, minBidPrc: 1 } as any, 'https://ilsangkit.co.kr/auction/item/A');
    expect(head.meta.some((m: any) => m.name === 'robots')).toBe(false);
    expect((head as any).link[0].rel).toBe('canonical');
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3 구현 (헬퍼 .ts + 페이지)**

```typescript
// frontend/utils/auctionHead.ts
import type { AuctionItem } from '~/types/auction'
import { isAuctionItemIndexable } from '~/types/auction'
import { buildAuctionItemTitle, buildAuctionItemDescription, buildAuctionRegionTitle, buildAuctionRegionDescription } from '~/utils/auctionMeta'

type Head = { title: string; meta: Array<Record<string, string>>; link?: Array<Record<string, string>> }

export function computeAuctionItemHead(item: AuctionItem, selfUrl: string): Head {
  const title = buildAuctionItemTitle(item)
  const description = buildAuctionItemDescription(item)
  const noindex = !isAuctionItemIndexable(item)
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfUrl },
    { property: 'og:type', content: 'website' },
  ]
  if (noindex) meta.push({ name: 'robots', content: 'noindex, follow' })
  return noindex ? { title, meta } : { title, meta, link: [{ rel: 'canonical', href: selfUrl }] }
}

export function computeAuctionRegionHead(
  o: { city: string; district: string; isIndexable: boolean; avgBidRate: number | null; activeCount: number },
  selfUrl: string
): Head {
  const title = buildAuctionRegionTitle({ city: o.city, district: o.district })
  const description = buildAuctionRegionDescription({ city: o.city, district: o.district, avgBidRate: o.avgBidRate, activeCount: o.activeCount })
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfUrl },
  ]
  if (!o.isIndexable) meta.push({ name: 'robots', content: 'noindex, follow' })
  return o.isIndexable ? { title, meta, link: [{ rel: 'canonical', href: selfUrl }] } : { title, meta }
}

export function buildAuctionListTitle(usage: string): string {
  const map: Record<string, string> = { residential: '아파트·주거용', land: '토지', commercial: '상가·업무', industrial: '공장·창고' }
  return usage && map[usage] ? `${map[usage]} 공매 물건 | 일상킷` : '부동산 공매 물건 | 일상킷'
}
```

```vue
<!-- frontend/pages/auction/item/[cltrMngNo].vue  — land [dong].vue와 동일하게 auto-import 사용(#imports 금지) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuction } from '~/composables/useAuction'
import { SITE_URL } from '~/utils/seoConstants'
import { computeAuctionItemHead } from '~/utils/auctionHead'
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue'
import AuctionBidHistory from '~/components/auction/AuctionBidHistory.vue'
import AuctionMap from '~/components/auction/AuctionMap.vue'
import AuctionCard from '~/components/auction/AuctionCard.vue'
// useRoute/useAsyncData/createError/useHead 는 Nuxt auto-import (land [dong].vue와 동일)

const route = useRoute()
const cltrMngNo = String(route.params.cltrMngNo)
const auction = useAuction()
const { data } = await useAsyncData(`auction-item-${cltrMngNo}`, () => auction.getItemDetail(cltrMngNo), { default: () => null })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })

const item = computed(() => data.value!.item)
const nearby = computed(() => data.value!.nearby)
const selfUrl = `${SITE_URL}/auction/item/${cltrMngNo}`
useHead(() => computeAuctionItemHead(item.value, selfUrl))
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-6">
    <div class="flex items-center gap-2 mb-2">
      <AuctionStatusBadge :status="item.status" />
      <span v-if="item.propertyType" class="text-caption text-slate-500">{{ item.propertyType }}</span>
    </div>
    <h1 class="text-display-3 font-bold text-slate-900">{{ item.address }}</h1>
    <p class="text-caption text-slate-500 mt-1">{{ item.usage }} · {{ item.orgNm }}</p>

    <div class="mt-4 grid gap-4">
      <AuctionBidHistory :item="item" />
      <AuctionMap v-if="item.lat != null && item.lng != null" :lat="item.lat" :lng="item.lng" :address="item.address" />

      <div v-if="nearby.length" class="bg-white rounded-xl border border-line p-4 shadow-card">
        <h3 class="text-sm font-semibold text-slate-900 mb-3">같은 지역 공매 물건</h3>
        <div class="grid gap-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
      </div>

      <p class="text-caption text-slate-400">출처: 한국자산관리공사 온비드 (공공데이터포털)</p>
    </div>
  </div>
</template>
```

> **부가②③ 범위 (리뷰 반영):**
> - **부가② 실거래가 시세비교**: 물건의 `district`(좌표 불필요) 기준으로 `useRealEstate`/`useLand`에서 같은 지역 평균을 받아 `AuctionPriceCompare`에 주입 → **v1에서 활성화**. (상세 페이지에서 `getRegions`/실거래가 조회 후 props로 전달)
> - **부가③ 주변 인프라**: `useFacilitySearch` 반경검색이 **좌표(lat/lng)에 의존** → Plan1 geocoding 후속에 종속. 좌표 있는 물건만 `AuctionNearbyFacilities` 렌더(지도와 동일하게 `v-if`). 좌표 없으면 dormant. = 지도/로드뷰와 동일한 점진 활성화.

- [ ] **Step 4: 통과 확인 + Commit**

Run: `npx vitest run tests/utils/auctionHead.test.ts` → PASS (2).
```bash
git add frontend/utils/auctionHead.ts frontend/pages/auction/item/ frontend/tests/utils/auctionHead.test.ts
git commit -m "feat(auction): item detail page + head helpers (SEO gate)"
```

---

## Task 8: 리스트·허브·랭킹·시도·시군구 페이지

각 페이지는 `useAsyncData` + 컴포넌트 조합. 시군구 페이지는 토지 `[dong].vue`의 noindex 게이트 패턴(아래)을 따른다.

**Files:**
- Create: `frontend/pages/auction/list.vue`, `index.vue`, `ranking.vue`, `[city]/index.vue`, `[city]/[district]/index.vue`
- Test: `frontend/tests/pages/auction/list.test.ts`, `districtDetail.test.ts`

- [ ] **Step 1: 실패 테스트 (헬퍼는 utils/auctionHead에서 import — .vue import 금지)**

```typescript
// frontend/tests/utils/auctionHead.region.test.ts  (item head 테스트와 동일 파일에 합쳐도 됨)
import { describe, it, expect } from 'vitest';
import { computeAuctionRegionHead, buildAuctionListTitle } from '~/utils/auctionHead';

describe('시군구 집계 SEO', () => {
  it('isIndexable=false면 noindex+canonical 생략', () => {
    const head = computeAuctionRegionHead({ city: '서울', district: '강남구', isIndexable: false, avgBidRate: null, activeCount: 1 }, 'https://ilsangkit.co.kr/auction/seoul/gangnam-gu');
    expect(head.meta.some((m: any) => m.name === 'robots')).toBe(true);
    expect((head as any).link).toBeUndefined();
  });
  it('isIndexable=true면 canonical 출력', () => {
    const head = computeAuctionRegionHead({ city: '서울', district: '강남구', isIndexable: true, avgBidRate: 82, activeCount: 10 }, 'https://ilsangkit.co.kr/auction/seoul/gangnam-gu');
    expect((head as any).link[0].rel).toBe('canonical');
  });
  it('list 타이틀 용도별', () => {
    expect(buildAuctionListTitle('land')).toContain('토지');
    expect(buildAuctionListTitle('')).toContain('공매');
  });
});
```

- [ ] **Step 2: 실패 확인 → Step 3 구현**

`computeAuctionRegionHead`/`buildAuctionListTitle`는 **Task 7에서 만든 `utils/auctionHead.ts`에 이미 정의됨** — 페이지들은 거기서 import만. 페이지는 land 패턴(auto-import, `#imports` 금지) 사용.

**슬러그 매핑 (I3 수정):** `import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'` (land `[dong].vue:203`과 동일 — `~/types/facility` 아님). `DISTRICT_SLUG_MAP`은 한글→slug라 slug→한글은 역매핑 필요:
```typescript
const districtSlugToName = Object.fromEntries(Object.entries(DISTRICT_SLUG_MAP).map(([name, slug]) => [slug, name]))
```
페이지 테스트는 land처럼 `vi.mock('~/shared/regionSlugs', ...)` 필요(landDongDetail.test.ts:156-166 참고).

**bjdCode 해석 (GAP 수정):** `/auction/seoul/gangnam-gu` 직접 진입 시 bjdCode가 없으므로 land 패턴대로 도출 — `getRegions({ city })`(Plan1 `/regions`) 호출 → `items.find(i => i.district === districtName)?.bjdCode`. 그 bjdCode로 `getRegionDetail(bjdCode)` 호출. noindex 판정 = `regionDetail.usageGroups.some(g => g.isIndexable)`, avgBidRate/activeCount는 usageGroups 집계 합산.
```typescript
// [city]/[district]/index.vue <script setup> 골자
const { getRegions, getRegionDetail } = useAuction()
const { data } = await useAsyncData(`auction-region-${citySlug}-${districtSlug}`, async () => {
  const list = await getRegions({ city: cityName })
  const row = list.items.find((i) => i.district === districtName)
  if (!row) return null
  const detail = await getRegionDetail(row.bjdCode)
  return { row, detail }
}, { default: () => null })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
const isIndexable = computed(() => data.value!.detail.usageGroups.some((g) => g.isIndexable))
const avgBidRate = computed(() => { /* sold 가중평균 or 최댓값 그룹 */ return data.value!.detail.usageGroups.find((g) => g.avgBidRate != null)?.avgBidRate ?? null })
useHead(() => computeAuctionRegionHead({ city: cityName, district: districtName, isIndexable: isIndexable.value, avgBidRate: avgBidRate.value, activeCount: data.value!.row.activeCount }, selfUrl))
```

`list.vue` — `AuctionFilters` + `AuctionCard` 그리드 + `Pagination`. 필터 상태를 `route.query`에 반영. 타이틀은 `buildAuctionListTitle(usage)`. 기본 리스트/`?usage=` 고정진입만 색인(임의 필터 조합 noindex — robots 메타).
`index.vue`(허브) — `getHubSummary` + 부가④: `getItems({ status:'ongoing', sort:'deadline', limit:8 })`(마감임박) + 용도별 진입 카드 + 인기 지역.
`ranking.vue` — `getRanking({ order, usage })` → `AuctionRankingTable`, 용도/정렬 토글.
`[city]/index.vue` — `getCityDetail(city)` 또는 `getRegions({ city })` → 시군구 카드 그리드(각 카드 bjdCode/링크 포함).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run tests/pages/auction/` → PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/pages/auction/ frontend/tests/pages/auction/
git commit -m "feat(auction): list, hub, ranking, city, district pages"
```

---

## Task 9: 네비 + 아이콘 + 카피 통합

**Files:**
- Modify: `frontend/types/facility.ts` (네비)
- Create: `frontend/public/icons/category/auction.webp`
- Modify: 카피 파일들(부동산 허브/about/terms/seoConstants 등), `frontend/utils/dataSource.ts`
- Test: `frontend/tests/types/navGroups.test.ts`(기존 — 카운트 갱신)

- [ ] **Step 1: 아이콘 제작 + 폰트 서브셋 등록 (I4)** (기존 세트 톤 일치, SVG→sharp→webp 128px). 망치/문서+도장 모티프. `project_category_icon_set` 메모리 참고. 기존(land-plot/무순위 등)과 구분.

```bash
node scripts-tmp/makeAuctionIcon.mjs  # → frontend/public/icons/category/auction.webp (결과만 커밋)
```
**⚠️ I4:** 네비 그룹 아이콘 `gavel`은 `nuxt.config.ts:219` `icon_names=` 서브셋에 **없음** → 빈 박스로 렌더됨(AppHeader.vue:49가 material-symbol로 출력). `gavel`을 **알파벳 순서로**(`first_page` 다음, `grid_view` 앞) 추가 후 **`.nuxt`/`.output` 삭제 + dev 재시작 + 브라우저 폰트캐시 클리어**(`project_nuxt_config_icon_cache` 메모리). 링크 아이콘은 모두 `iconImg`라 material 불필요. (대안: 서브셋에 이미 있는 `sell`/`payments`로 그룹 아이콘 대체 — 캐시 작업 회피.)

- [ ] **Step 2: 네비 — 독립 "공매" 그룹을 `NAV_LINK_GROUPS` 끝(index 2)에 추가** (B2: 기존 `[0]=부동산`, `[1]=청약·임대` 순서 보존 → 테스트 churn 최소)

```typescript
// NAV_LINK_GROUPS 배열의 마지막 요소로 추가 (청약·임대 그룹 뒤)
{
  title: '공매',
  icon: 'gavel', // 서브셋 등록 필수(I4). 회피 시 'sell'
  links: [
    { to: '/auction', label: '공매 홈', icon: 'gavel', iconImg: 'auction' },
    { to: '/auction/list?usage=residential', label: '아파트·주거용', icon: 'apartment', iconImg: 'auction' },
    { to: '/auction/list?usage=land', label: '토지', icon: 'landscape', iconImg: 'auction' },
    { to: '/auction/list?usage=commercial', label: '상가·업무', icon: 'storefront', iconImg: 'auction' },
    { to: '/auction/list?usage=industrial', label: '공장·창고', icon: 'storefront', iconImg: 'auction' },
    { to: '/auction/ranking', label: '낙찰가율 랭킹', icon: 'bar_chart', iconImg: 'auction' },
    { to: '/auction/list', label: '전체 물건', icon: 'grid_view', iconImg: 'auction' },
  ],
},
```
(링크 `icon`은 서브셋에 있는 값만 사용: `apartment/landscape/storefront/bar_chart/grid_view` 전부 존재 확인됨. `factory`/`leaderboard`/`list`는 서브셋에 없어 사용 안 함.)

- [ ] **Step 3: `navGroups.test.ts` 갱신 (B2 — 정확한 단언값 명시)**

`NAV_GROUPS = [...NAV_LINK_GROUPS, ...CATEGORY_GROUPS]`. auction을 NAV_LINK_GROUPS index 2에 추가하면:
- `NAV_LINK_GROUPS.length` : 2 → **3**
- `NAV_LINK_GROUPS[0].title==='부동산'`, `[1].title==='청약·임대'` : **유지(불변)**
- 신규 단언 추가: `NAV_LINK_GROUPS[2].title==='공매'`, `NAV_LINK_GROUPS[2].links.length===7`
- `NAV_GROUPS.length` : 6 → **7** (CATEGORY_GROUPS 4개 가정)
- `NAV_GROUPS.slice(0,2)===NAV_LINK_GROUPS` → **`slice(0,3)`**로 변경
- `NAV_GROUPS.slice(2,6)===CATEGORY_GROUPS` → **`slice(3,7)`**로 변경

(실제 CATEGORY_GROUPS 길이는 파일에서 확인 후 숫자 확정. 단언을 약화/삭제하지 말 것 — 위 값으로 정확히 갱신.)

Run: `npx vitest run tests/types/navGroups.test.ts`
Expected: 갱신 후 PASS.

- [ ] **Step 4: 카피 — `dataSource.ts`에 별도 const 추가 (M3)**

`FACILITY_DATA_SOURCE`는 `Record<FacilityCategory>`라 auction을 넣을 수 없음(타입 에러). **별도 export** 추가:
```typescript
// utils/dataSource.ts 하단
export const AUCTION_DATA_SOURCE: DataSourceInfo = {
  datasetName: '차세대 온비드 부동산 물건목록 조회서비스',
  provider: '한국자산관리공사',
  url: 'https://www.data.go.kr/data/15157207/openapi.do',
}
```
공매 페이지 출처 표기에서 `AUCTION_DATA_SOURCE` 사용. 부동산 허브/about/terms/seoConstants의 "아파트·빌라·오피스텔·토지"류 카피엔 필요한 곳만 공매 언급(사용자 정책 — 과도 추가 금지).

- [ ] **Step 5: Commit**

```bash
git add frontend/types/facility.ts frontend/public/icons/category/auction.webp frontend/utils/dataSource.ts frontend/tests/types/navGroups.test.ts
git commit -m "feat(auction): nav dropdown, icon, data source"
```

---

## Task 10: 사이트맵 + 최종 검증

**Files:**
- Modify: `frontend/server/utils/sitemap.ts` (land과 동일 패턴: `fetchLandSitemap`가 `/api/real-estate/land/sitemap` 호출 → `fetchAuctionSitemap` 추가하여 `/api/auction/sitemap` 호출)
- Modify: `frontend/server/routes/sitemap/[...].ts` (catch-all 청크에 auction 청크 등록) + `sitemap.xml.ts`(인덱스에 추가)

- [ ] **Step 1: 사이트맵에 공매 색인 URL 추가 (land 패턴 그대로)**

`server/utils/sitemap.ts:281`의 `fetchLandSitemap`를 본떠 `fetchAuctionSitemap()` 추가 — `ssrFetch('/api/auction/sitemap')`로 `{ regions, items }` 받아 URL 생성:
- 색인 시군구: `/auction/{citySlug}/{districtSlug}` (regions 중 isIndexable)
- 색인 물건: `/auction/item/{cltrMngNo}` (items)
catch-all `routes/sitemap/[...].ts`에 `auction` 세그먼트 청크 추가(facilities/real-estate-hubs와 동일 분기), 사이트맵 인덱스에도 추가. citySlug/districtSlug 변환은 `~/shared/regionSlugs` 사용.

- [ ] **Step 2: 프로덕션 프리뷰 검증** (dev 하이드레이션 노이즈 회피)

```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run build && node .output/server/index.mjs &
# /auction, /auction/list, /auction/item/<id> 응답 확인 (백엔드 8000 기동 필요)
```
Expected: 페이지 200, noindex 게이트/메타 정상.
> **I5:** AuctionMap/로드뷰 및 부가③ 주변인프라는 좌표(lat/lng)에 의존 — Plan1 geocoding이 좌표를 채우기 전까지 `v-if`로 **대부분 렌더 안 됨(정상)**. Task 10 프리뷰에서 지도 부재를 실패로 보지 말 것. geocoding 후속 도입 시 자동 활성화.

- [ ] **Step 3: 전체 테스트 + lint**

Run:
```bash
cd frontend && source ~/.nvm/nvm.sh && nvm use 20 && npm run test 2>&1 | tail -15 && npm run lint 2>&1 | tail -5
cd ../backend && npm run test 2>&1 | tail -8
```
Expected: 프론트/백 전체 PASS, lint 0 errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(auction): sitemap entries + final integration"
```

---

## Self-Review (작성자 체크 — 완료)

- **Spec 커버리지:** 상세(Task7)·리스트/허브/랭킹/시도/시군구(8)·카드/뱃지/이력/지도+로드뷰(4,5)·부가①랭킹(6,8)·②시세비교/③인프라(6,7 데이터주입)·④마감임박(8 허브)·⑤할인율(types+card)·네비/아이콘/카피(9)·사이트맵(10) 매핑.
- **Placeholder:** 부가②③는 "데이터 주입 지점 마련 + 좌표 확보 후 활성화"로 명시(좌표는 Plan1 후속 geocode 의존). 가이드 본문은 spec상 골격만 → 별도 Task 없음(라우트는 기존 /guide 활용, 본문 후속).
- **타입 일관성:** `cltrMngNo` 경로키, `usageGroup` 6값, `formatWon*` 원단위, `computeAuctionItemHead`/`computeAuctionRegionHead` named export로 테스트.
- **위험:** ①실데이터 0부터 → 초기 대부분 noindex(정상) ②좌표 없으면 지도/로드뷰/주변인프라 `v-if` 생략(geocoding 후속) ③백엔드 계약 의존: `/api/auction/*` 응답 필드명(usageGroups/districts[].bjdCode/{item,nearby})이 Plan1 구현과 일치해야 함 — Plan1 완료 후 첫 페이지 작업 시 실제 응답으로 1건 검증(필드명 불일치 시 조용히 깨짐).
- **리뷰 반영(2026-06-05):** BLOCKER B1(head 헬퍼를 `.vue` named export → `utils/auctionHead.ts` .ts로 분리, 테스트가 .vue import 안 함) / B2(nav를 NAV_LINK_GROUPS index 2에 추가 + navGroups.test 정확한 단언값 명시) / I1(addMarkers `lat/lng`+Facility 형태) / I2(`#imports` 제거, auto-import) / I3(슬러그 `~/shared/regionSlugs`, district 역매핑) / I4(`gavel` 폰트 서브셋 등록+캐시 클리어) / M3(dataSource 별도 `AUCTION_DATA_SOURCE`) / GAP(district bjdCode를 `/regions`로 도출, sitemap=`fetchLandSitemap` 패턴) / 부가②=v1, 부가③=좌표 의존(점진).

---

## 실행 메모
- 두 Plan 모두 `feature/auction-pages`에서 순차 진행(Plan1 → Plan2).
- 완료 후 PR → develop (CI 통과 후 사용자 머지).
- 배포 후 온비드 활용신청 완료되면 첫 스냅샷 수동 실행 → 데이터 누적 시작.
