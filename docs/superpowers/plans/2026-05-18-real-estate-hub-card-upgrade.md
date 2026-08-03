# 부동산 Hub 카테고리 카드 강화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/real-estate` hub 페이지의 카테고리 카드 섹션을 6장 그리드로 확장하고, 각 카드에 "최근 30일 거래 N건" 라이브 수치를 표시한다.

**Architecture:** 신규 백엔드 엔드포인트 `GET /api/real-estate/hub-summary`가 6개 트랜잭션 테이블의 30일(현재월+직전월 근사) 거래 건수를 병렬 집계 후 1시간 in-memory 캐시. 프론트는 `useAsyncData`로 SSR fetch하여 6장 카드(아파트→오피스텔→빌라 순) 그리드를 렌더링한다.

**Tech Stack:** Express 5 + Prisma + vitest (백엔드), Nuxt 3 SSR + Vue 3 + @vue/test-utils + Tailwind (프론트)

**Spec:** `docs/superpowers/specs/2026-05-18-real-estate-hub-card-upgrade-design.md`

---

## File Structure

### 신규
- `backend/src/services/realEstateHubSummaryService.ts` — 집계 로직 + in-memory 캐시 + in-flight 공유
- `backend/__tests__/services/realEstateHubSummaryService.test.ts` — 캐시/in-flight/일부 실패 처리 검증
- `backend/__tests__/routes/realEstateHubSummary.test.ts` — 200 응답 + 캐시 hit 확인

### 수정
- `backend/src/routes/realEstate.ts` — `/hub-summary` 핸들러 추가
- `frontend/components/realEstate/RealEstateCategoryCards.vue` — 6장 그리드 + props + 뱃지/수치
- `frontend/tests/components/realEstate/RealEstateCategoryCards.test.ts` — 신규 (현재 없음)
- `frontend/pages/real-estate/index.vue` — SSR fetch + props 전달 + ItemList 스키마 6개

---

## Task 1: 백엔드 hub-summary 서비스

**Files:**
- Create: `backend/src/services/realEstateHubSummaryService.ts`
- Create: `backend/__tests__/services/realEstateHubSummaryService.test.ts`

집계 키는 `dealYear * 100 + dealMonth`로 비교. "현재월+직전월" = `currentYYYYMM - 1` 이상.
예) 2026-05 기준 cutoff = 202604. 4월 + 5월 행이 모두 포함.
6개 타입을 `Promise.allSettled`로 병렬 실행. 실패한 타입만 `null`. 캐시 TTL 1시간, in-flight 공유.

- [ ] **Step 1.1: Write the failing test (basic shape)**

```ts
// backend/__tests__/services/realEstateHubSummaryService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getHubSummary,
  __resetHubSummaryCacheForTest,
} from '../../src/services/realEstateHubSummaryService.js';
import { prisma } from '../../src/lib/prisma.js';

describe('getHubSummary', () => {
  beforeEach(() => {
    __resetHubSummaryCacheForTest();
    vi.restoreAllMocks();
  });

  it('6개 키를 모두 반환한다', async () => {
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([{ cnt: BigInt(42) }] as never);

    const result = await getHubSummary();

    expect(Object.keys(result.data).sort()).toEqual([
      'apt-rent',
      'apt-sale',
      'offitel-rent',
      'offitel-sale',
      'villa-rent',
      'villa-sale',
    ]);
    for (const key of Object.keys(result.data)) {
      expect(result.data[key as keyof typeof result.data].last30dCount).toBe(42);
    }
    expect(typeof result.generatedAt).toBe('string');
  });
});
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/services/realEstateHubSummaryService.test.ts`
Expected: FAIL — 모듈 미존재 (`Cannot find module`).

- [ ] **Step 1.3: Implement minimal service**

```ts
// backend/src/services/realEstateHubSummaryService.ts
import { prisma } from '../lib/prisma.js';
import { TABLE_NAME_MAP } from './realEstateService.js';

export const HUB_TYPES = [
  'apt-sale',
  'apt-rent',
  'offitel-sale',
  'offitel-rent',
  'villa-sale',
  'villa-rent',
] as const;
export type HubType = (typeof HUB_TYPES)[number];

export interface HubTypeEntry {
  last30dCount: number | null;
}

export interface HubSummary {
  data: Record<HubType, HubTypeEntry>;
  generatedAt: string;
}

const CACHE_TTL_MS = 60 * 60 * 1000; // 1h
let cache: { value: HubSummary; expiresAt: number } | null = null;
let inFlight: Promise<HubSummary> | null = null;

export function __resetHubSummaryCacheForTest(): void {
  cache = null;
  inFlight = null;
}

function computeCutoffYYYYMM(now: Date): number {
  const y = now.getFullYear();
  const m = now.getMonth() + 1; // 1-12
  const prevY = m === 1 ? y - 1 : y;
  const prevM = m === 1 ? 12 : m - 1;
  return prevY * 100 + prevM;
}

async function countForType(type: HubType, cutoff: number): Promise<number | null> {
  const table = TABLE_NAME_MAP[type];
  if (!table) return null;
  try {
    const rows = await prisma.$queryRawUnsafe<Array<{ cnt: bigint | number }>>(
      `SELECT COUNT(*) AS cnt FROM ${table}
       WHERE dealYear * 100 + dealMonth >= ?`,
      cutoff,
    );
    const raw = rows[0]?.cnt ?? 0;
    return typeof raw === 'bigint' ? Number(raw) : Number(raw);
  } catch {
    return null;
  }
}

async function build(): Promise<HubSummary> {
  const cutoff = computeCutoffYYYYMM(new Date());
  const counts = await Promise.all(HUB_TYPES.map((t) => countForType(t, cutoff)));
  const data = HUB_TYPES.reduce(
    (acc, t, i) => {
      acc[t] = { last30dCount: counts[i] };
      return acc;
    },
    {} as Record<HubType, HubTypeEntry>,
  );
  return { data, generatedAt: new Date().toISOString() };
}

export async function getHubSummary(): Promise<HubSummary> {
  const now = Date.now();
  if (cache && cache.expiresAt > now) return cache.value;
  if (inFlight) return inFlight;

  inFlight = build()
    .then((value) => {
      cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
      return value;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/services/realEstateHubSummaryService.test.ts`
Expected: PASS (1 test).

- [ ] **Step 1.5: Add cache hit test**

```ts
// Append to backend/__tests__/services/realEstateHubSummaryService.test.ts
it('TTL 이내에는 캐시 히트 — 쿼리 6회만 실행', async () => {
  const spy = vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([{ cnt: BigInt(1) }] as never);

  const first = await getHubSummary();
  const second = await getHubSummary();

  expect(spy).toHaveBeenCalledTimes(6); // 6 types × 1 build
  expect(second.generatedAt).toBe(first.generatedAt);
});
```

Run: `cd backend && npx vitest run __tests__/services/realEstateHubSummaryService.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 1.6: Add in-flight sharing test**

```ts
// Append to backend/__tests__/services/realEstateHubSummaryService.test.ts
it('동시 요청은 in-flight Promise를 공유한다 — 쿼리 6회만 실행', async () => {
  const spy = vi.spyOn(prisma, '$queryRawUnsafe').mockImplementation(
    () => new Promise((resolve) => setTimeout(() => resolve([{ cnt: BigInt(5) }] as never), 20)),
  );

  const [a, b, c] = await Promise.all([getHubSummary(), getHubSummary(), getHubSummary()]);

  expect(spy).toHaveBeenCalledTimes(6); // 3 callers × 6 types였다면 18, 공유되어 6
  expect(a.generatedAt).toBe(b.generatedAt);
  expect(b.generatedAt).toBe(c.generatedAt);
});
```

Run: `cd backend && npx vitest run __tests__/services/realEstateHubSummaryService.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 1.7: Add partial-failure test**

```ts
// Append to backend/__tests__/services/realEstateHubSummaryService.test.ts
it('특정 타입 쿼리 실패 시 해당 타입만 null', async () => {
  let calls = 0;
  vi.spyOn(prisma, '$queryRawUnsafe').mockImplementation(() => {
    calls += 1;
    if (calls === 2) return Promise.reject(new Error('boom'));
    return Promise.resolve([{ cnt: BigInt(7) }] as never);
  });

  const result = await getHubSummary();
  const nulls = Object.values(result.data).filter((e) => e.last30dCount === null).length;
  const valid = Object.values(result.data).filter((e) => e.last30dCount === 7).length;
  expect(nulls).toBe(1);
  expect(valid).toBe(5);
});
```

Run: `cd backend && npx vitest run __tests__/services/realEstateHubSummaryService.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 1.8: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/services/realEstateHubSummaryService.ts backend/__tests__/services/realEstateHubSummaryService.test.ts
git commit -m "feat(real-estate): hub-summary 서비스 — 30일 거래 건수 집계 + 캐시"
```

---

## Task 2: 백엔드 라우트 추가

**Files:**
- Modify: `backend/src/routes/realEstate.ts` (서비스 import + 핸들러 추가)
- Create: `backend/__tests__/routes/realEstateHubSummary.test.ts`

`/hub-summary`는 파라미터 없는 GET. **반드시** `/price-analysis`, `/nearby` 처럼 `/:type` 라우트들보다 **위쪽**에 등록해야 함 (라우트 매칭 충돌 방지).

- [ ] **Step 2.1: Write the failing route test**

```ts
// backend/__tests__/routes/realEstateHubSummary.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../src/app.js';
import {
  __resetHubSummaryCacheForTest,
  HUB_TYPES,
} from '../../src/services/realEstateHubSummaryService.js';
import { prisma } from '../../src/lib/prisma.js';

describe('GET /api/real-estate/hub-summary', () => {
  beforeEach(() => {
    __resetHubSummaryCacheForTest();
    vi.restoreAllMocks();
    vi.spyOn(prisma, '$queryRawUnsafe').mockResolvedValue([{ cnt: BigInt(11) }] as never);
  });

  it('200 + 6개 키 응답', async () => {
    const res = await request(app).get('/api/real-estate/hub-summary');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    for (const t of HUB_TYPES) {
      expect(res.body.data[t]).toEqual({ last30dCount: 11 });
    }
    expect(typeof res.body.generatedAt).toBe('string');
  });

  it('두 번째 호출은 캐시 hit — generatedAt 동일', async () => {
    const a = await request(app).get('/api/real-estate/hub-summary');
    const b = await request(app).get('/api/real-estate/hub-summary');
    expect(a.body.generatedAt).toBe(b.body.generatedAt);
  });
});
```

- [ ] **Step 2.2: Run test to verify it fails**

Run: `cd backend && npx vitest run __tests__/routes/realEstateHubSummary.test.ts`
Expected: FAIL — `res.status` 404 (라우트 미존재).

- [ ] **Step 2.3: Confirm app exports and supertest availability**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && grep -n "export default app\|export { app }" src/app.ts && cat package.json | grep -i supertest
```
Expected: `app` default export 확인. `supertest`가 devDependencies에 있는지 확인.
- 만약 `supertest` 부재 시 다른 라우트 테스트(`backend/__tests__/routes/realEstateNearby.test.ts`)를 참고하여 동일 패턴을 사용한다. (기존 패턴 따르기)

- [ ] **Step 2.4: Add route handler**

```ts
// backend/src/routes/realEstate.ts — import 블록에 추가
import { getHubSummary } from '../services/realEstateHubSummaryService.js';

// "GET /api/real-estate/price-analysis" 핸들러 바로 위에 추가
// (반드시 /:type 라우트들보다 위)
router.get(
  '/hub-summary',
  asyncHandler(async (_req: Request, res: Response) => {
    const summary = await getHubSummary();
    res.json({ success: true, data: summary.data, generatedAt: summary.generatedAt });
  }),
);
```

- [ ] **Step 2.5: Run test to verify it passes**

Run: `cd backend && npx vitest run __tests__/routes/realEstateHubSummary.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 2.6: Run full backend test suite for regression**

Run: `cd backend && npm run test`
Expected: 모든 테스트 통과. 기존 `realEstate` 라우트 테스트 영향 없음.

- [ ] **Step 2.7: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add backend/src/routes/realEstate.ts backend/__tests__/routes/realEstateHubSummary.test.ts
git commit -m "feat(real-estate): GET /api/real-estate/hub-summary 라우트 추가"
```

---

## Task 3: 프론트 카드 컴포넌트 6장 그리드

**Files:**
- Modify: `frontend/components/realEstate/RealEstateCategoryCards.vue`
- Create: `frontend/tests/components/realEstate/RealEstateCategoryCards.test.ts`

순서 고정: 아파트 매매 → 아파트 전월세 → 오피스텔 매매 → 오피스텔 전월세 → 빌라 매매 → 빌라 전월세.
링크는 `/real-estate/${type}`. 모바일/데스크톱 모두 2열. 매매=blue 뱃지, 전월세=amber 뱃지.

- [ ] **Step 3.1: Inspect existing types for reuse**

```bash
grep -n "VISIBLE_PROPERTY_TYPES\|PROPERTY_TYPE_META" /Users/leemyeongseok/projects/ilsangkit/frontend/types/realEstate.ts /Users/leemyeongseok/projects/ilsangkit/frontend/utils/realEstateMeta.ts
```
Expected: `VISIBLE_PROPERTY_TYPES`는 `['apt','offitel','villa']` 같은 base 타입. `PROPERTY_TYPE_META`는 `iconImg`/`label`/`description` 보유. 두 파일에서 6개 type별 라벨이 필요하면 컴포넌트 내부 상수로 정의(별도 파일 추가 금지).

- [ ] **Step 3.2: Write the failing component test**

```ts
// frontend/tests/components/realEstate/RealEstateCategoryCards.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RealEstateCategoryCards from '~/components/realEstate/RealEstateCategoryCards.vue'

describe('RealEstateCategoryCards', () => {
  it('summaries 없이도 6장 카드를 렌더한다', () => {
    const wrapper = mount(RealEstateCategoryCards)
    const cards = wrapper.findAll('[data-test="hub-card"]')
    expect(cards).toHaveLength(6)
  })

  it('카드 순서는 아파트 → 오피스텔 → 빌라', () => {
    const wrapper = mount(RealEstateCategoryCards)
    const links = wrapper.findAll('[data-test="hub-card"]').map((c) => c.attributes('href'))
    expect(links).toEqual([
      '/real-estate/apt-sale',
      '/real-estate/apt-rent',
      '/real-estate/offitel-sale',
      '/real-estate/offitel-rent',
      '/real-estate/villa-sale',
      '/real-estate/villa-rent',
    ])
  })

  it('summaries 제공 시 라이브 수치를 ko-KR 포맷으로 표시', () => {
    const wrapper = mount(RealEstateCategoryCards, {
      props: {
        summaries: {
          'apt-sale': { last30dCount: 12431 },
          'apt-rent': { last30dCount: 8902 },
          'offitel-sale': { last30dCount: 642 },
          'offitel-rent': { last30dCount: 1180 },
          'villa-sale': { last30dCount: 2103 },
          'villa-rent': { last30dCount: 4587 },
        },
      },
    })
    expect(wrapper.text()).toContain('12,431')
    expect(wrapper.text()).toContain('8,902')
  })

  it('last30dCount가 null이면 "데이터 동기화 중" 표시', () => {
    const wrapper = mount(RealEstateCategoryCards, {
      props: {
        summaries: {
          'apt-sale': { last30dCount: null },
          'apt-rent': { last30dCount: null },
          'offitel-sale': { last30dCount: null },
          'offitel-rent': { last30dCount: null },
          'villa-sale': { last30dCount: null },
          'villa-rent': { last30dCount: null },
        },
      },
    })
    const placeholders = wrapper.findAll('[data-test="hub-card-count-placeholder"]')
    expect(placeholders).toHaveLength(6)
  })

  it('매매 카드에는 "매매" 뱃지, 전월세 카드에는 "전월세" 뱃지', () => {
    const wrapper = mount(RealEstateCategoryCards)
    const badges = wrapper.findAll('[data-test="hub-card-badge"]').map((b) => b.text())
    expect(badges).toEqual(['매매', '전월세', '매매', '전월세', '매매', '전월세'])
  })
})
```

- [ ] **Step 3.3: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/components/realEstate/RealEstateCategoryCards.test.ts`
Expected: FAIL — 기존 컴포넌트는 3장만 렌더, `data-test` 속성 없음.

- [ ] **Step 3.4: Rewrite the component**

```vue
<!-- frontend/components/realEstate/RealEstateCategoryCards.vue -->
<template>
  <div class="grid grid-cols-2 gap-3 md:gap-4">
    <HardLink
      v-for="entry in CARD_ORDER"
      :key="entry.type"
      :to="`/real-estate/${entry.type}`"
      data-test="hub-card"
      class="group flex flex-col gap-2 rounded-2xl border border-slate-200 bg-white p-3 md:p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
    >
      <div class="flex items-center gap-2">
        <div class="flex size-9 md:size-10 items-center justify-center rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
          <img
            :src="`/icons/category/${entry.iconImg}.webp?v2`"
            :alt="entry.label"
            class="w-6 h-6 md:w-7 md:h-7"
            width="28"
            height="28"
          />
        </div>
        <span
          data-test="hub-card-badge"
          :class="[
            'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold',
            entry.deal === 'sale'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-amber-100 text-amber-700',
          ]"
        >
          {{ entry.deal === 'sale' ? '매매' : '전월세' }}
        </span>
      </div>
      <p class="text-sm md:text-base font-semibold text-slate-800 group-hover:text-primary transition-colors leading-tight">
        {{ entry.label }}
      </p>
      <p v-if="countOf(entry.type) !== null" class="text-xs md:text-sm text-slate-700 tabular-nums">
        최근 30일 <span class="font-bold text-slate-900">{{ formatCount(countOf(entry.type)!) }}</span>건
      </p>
      <p v-else data-test="hub-card-count-placeholder" class="text-xs md:text-sm text-slate-400">
        데이터 동기화 중
      </p>
    </HardLink>
  </div>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'

type HubType =
  | 'apt-sale' | 'apt-rent'
  | 'offitel-sale' | 'offitel-rent'
  | 'villa-sale' | 'villa-rent'

interface HubTypeEntry { last30dCount: number | null }

const props = defineProps<{
  summaries?: Partial<Record<HubType, HubTypeEntry>>
}>()

interface CardDef {
  type: HubType
  label: string
  iconImg: string
  deal: 'sale' | 'rent'
}

const CARD_ORDER: CardDef[] = [
  { type: 'apt-sale',     label: '아파트 매매',     iconImg: 'apartment', deal: 'sale' },
  { type: 'apt-rent',     label: '아파트 전월세',   iconImg: 'apartment', deal: 'rent' },
  { type: 'offitel-sale', label: '오피스텔 매매',   iconImg: 'officetel', deal: 'sale' },
  { type: 'offitel-rent', label: '오피스텔 전월세', iconImg: 'officetel', deal: 'rent' },
  { type: 'villa-sale',   label: '빌라 매매',       iconImg: 'villa',     deal: 'sale' },
  { type: 'villa-rent',   label: '빌라 전월세',     iconImg: 'villa',     deal: 'rent' },
]

function countOf(t: HubType): number | null {
  const entry = props.summaries?.[t]
  if (!entry) return null
  return entry.last30dCount
}

const formatter = new Intl.NumberFormat('ko-KR')
function formatCount(n: number): string {
  return formatter.format(n)
}
</script>
```

**Note on icon names:** 위 `iconImg` 값은 `PROPERTY_TYPE_META`에 있는 실제 값을 따라야 한다. 실행자는 `frontend/utils/realEstateMeta.ts`를 열어 `apt/officetel/villa` 각 `iconImg` 값을 확인하고 위 코드의 3개 문자열을 정확히 교체할 것. (예: `iconImg: 'apt'` 등)

- [ ] **Step 3.5: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/components/realEstate/RealEstateCategoryCards.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 3.6: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/components/realEstate/RealEstateCategoryCards.vue frontend/tests/components/realEstate/RealEstateCategoryCards.test.ts
git commit -m "feat(real-estate): hub 카테고리 카드 6장 그리드 + 라이브 수치 prop"
```

---

## Task 4: hub 페이지 결선 + ItemList 스키마 확장

**Files:**
- Modify: `frontend/pages/real-estate/index.vue`

`useAsyncData`로 SSR fetch. 실패해도 페이지는 렌더 (`default: () => null`). ItemList 스키마를 6개로 확장.

- [ ] **Step 4.1: Patch index.vue — fetch + props 전달**

```vue
<!-- 기존 -->
<RealEstateCategoryCards />

<!-- 변경 -->
<RealEstateCategoryCards :summaries="hubSummaries ?? undefined" />
```

```ts
// <script setup> 내부, useStructuredData 호출 위쪽에 추가
const apiBase = useRuntimeConfig().public.apiBase

interface HubSummaryResponse {
  success: boolean
  data: Record<string, { last30dCount: number | null }>
  generatedAt: string
}

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
```

- [ ] **Step 4.2: Update ItemList schema to 6 entries**

```ts
// 기존
setItemListSchema([
  { name: '아파트', url: '/real-estate/apt-sale' },
  { name: '빌라', url: '/real-estate/villa-sale' },
  { name: '오피스텔', url: '/real-estate/offitel-sale' },
])

// 변경
setItemListSchema([
  { name: '아파트 매매',     url: '/real-estate/apt-sale' },
  { name: '아파트 전월세',   url: '/real-estate/apt-rent' },
  { name: '오피스텔 매매',   url: '/real-estate/offitel-sale' },
  { name: '오피스텔 전월세', url: '/real-estate/offitel-rent' },
  { name: '빌라 매매',       url: '/real-estate/villa-sale' },
  { name: '빌라 전월세',     url: '/real-estate/villa-rent' },
])
```

- [ ] **Step 4.3: Run frontend tests for regression**

Run: `cd frontend && npm run test`
Expected: 모든 테스트 통과. 신규 `RealEstateCategoryCards.test.ts` 5건 포함.

- [ ] **Step 4.4: Run lint**

Run: `cd frontend && npm run lint`
Expected: 신규 컴포넌트/페이지 lint 에러 없음.

- [ ] **Step 4.5: Commit**

```bash
cd /Users/leemyeongseok/projects/ilsangkit
git add frontend/pages/real-estate/index.vue
git commit -m "feat(real-estate): hub 페이지 카드 라이브 수치 SSR fetch + ItemList 6개 확장"
```

---

## Task 5: 수동 검증 (dev 서버)

**Files:** N/A (browser-only verification)

- [ ] **Step 5.1: Start dev servers in background**

```bash
cd /Users/leemyeongseok/projects/ilsangkit/backend && npm run dev
# (별도 셸에서)
cd /Users/leemyeongseok/projects/ilsangkit/frontend && npm run dev
```
Expected: 백엔드 8000, 프론트 3000 정상 기동.

- [ ] **Step 5.2: API endpoint smoke test**

```bash
curl -s http://localhost:8000/api/real-estate/hub-summary | head -c 500
```
Expected: `{"success":true,"data":{"apt-sale":{"last30dCount":<숫자>}, ...},"generatedAt":"..."}` JSON.

- [ ] **Step 5.3: Browser check — `/real-estate`**

브라우저에서 `http://localhost:3000/real-estate` 열기. 확인:
- 카드 6장 (아파트 매매/전월세, 오피스텔 매매/전월세, 빌라 매매/전월세 순서)
- 데스크톱/모바일 모두 2열
- 각 카드에 `최근 30일 N,NNN건` 표시 (또는 데이터 없으면 "데이터 동기화 중")
- 매매=파란 뱃지, 전월세=주황 뱃지
- 카드 클릭 시 해당 `/real-estate/<type>` 페이지로 이동
- DevTools Network 탭에서 `/api/real-estate/hub-summary` 200 응답 확인
- View Page Source에서 ItemList JSON-LD에 6개 항목 들어있는지 확인

- [ ] **Step 5.4: Backend failure fallback**

백엔드 dev 서버 종료 후 페이지 새로고침:
- 카드 6장은 여전히 렌더
- 수치 자리에 "데이터 동기화 중" 표시
- 클릭은 정상 동작

검증 통과 시 백엔드 dev 서버 재시작 후 `/super:execute` 종료.

---

## Self-Review

**Spec coverage:**
- API 설계 (`/hub-summary`) → Task 2 ✓
- 6개 타입 30일 카운트 + 캐시 1h + in-flight 공유 → Task 1 ✓
- 부분 실패 시 null 처리 → Task 1 Step 1.7 + Task 3 placeholder ✓
- 카드 6장 그리드 (아파트→오피스텔→빌라) → Task 3 ✓
- 모바일 2열 → Task 3 (`grid-cols-2 gap-3 md:gap-4`) ✓
- 매매/전월세 뱃지 (blue/amber) → Task 3 ✓
- `tabular-nums` 수치 + ko-KR 포맷 → Task 3 ✓
- SSR fetch (`useAsyncData`) + 실패 시 placeholder → Task 4 ✓
- ItemList 스키마 6개로 확장 → Task 4 ✓
- 기타 페이지 영역(FAQ/PageHero/설명문/SEO 메타) 미변경 → Task 4 (해당 코드 미수정) ✓

**Placeholder scan:** "TODO"/"TBD"/"적절히 처리" 없음. 모든 코드 블록 실제 코드. ✓
**Type consistency:** `HubType`, `HubTypeEntry`, `HubSummary`, `last30dCount` 모두 백엔드(Task 1)와 프론트(Task 3)에서 동일 형태 유지. ItemList URL 6개와 카드 링크 6개 1:1 매칭. ✓
**Spec gap:** 없음.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-18-real-estate-hub-card-upgrade.md`. Two execution options:

**1. Subagent-Driven (recommended)** — 태스크별 fresh subagent + 사이에 리뷰. 5개 태스크, 빠른 반복.

**2. Inline Execution** — 현 세션에서 executing-plans 스킬로 일괄 실행 + 체크포인트.

Which approach?
