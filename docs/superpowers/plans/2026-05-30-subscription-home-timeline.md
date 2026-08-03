# 청약 한눈에 타임라인 재설계 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 "청약 한눈에" 섹션을 카드 그리드에서 통합 일정 타임라인(접수중/예정 2그룹 · 6종 타입 뱃지)으로 교체한다.

**Architecture:** 백엔드 리스트 API에 `sort` 옵션(마감/시작 임박순)을 추가하고, 프론트 composable이 접수중·예정을 각각 임박순 5건씩 가져온다. 신규 유틸 `subscriptionTypeBadge()`가 `(sourceType, rentType)`을 6종 뱃지로 매핑하고, 컴포넌트는 2그룹 타임라인을 렌더한다. 임대 2종은 회색 뱃지로 묶는다.

**Tech Stack:** Express 5 + Prisma 6 (ESM, `.js` import 필수), Zod, Nuxt 3 + Vue 3 + TailwindCSS, Vitest.

**관련 스펙:** `docs/superpowers/specs/2026-05-30-subscription-home-timeline-design.md`

**커밋 정책:** 이 repo는 `develop` 브랜치에서 작업하며 main 직접 커밋 금지(PR 경유). `docs/`는 `.gitignore` 대상이라 plan/spec 문서는 커밋하지 않는다. 각 Task는 코드 변경만 커밋한다. Node 20(`nvm use 20`) 기준. lock 파일 재생성 금지.

---

## File Structure

| 파일 | 책임 | 변경 |
|---|---|---|
| `backend/src/schemas/subscription.ts` | 리스트 쿼리 검증 | `sort` enum 추가 |
| `backend/src/services/subscriptionService.ts` | 리스트 조회/정렬 | `buildOrderBy()` 추가, `getSubscriptionList` orderBy 분기 |
| `backend/__tests__/schemas/subscription.test.ts` | 스키마 테스트 | `sort` 케이스 추가 |
| `backend/__tests__/services/subscriptionService.test.ts` | 서비스 테스트 | `sort` 정렬 케이스 추가 |
| `frontend/utils/subscriptionMeta.ts` | 청약 타입 메타 | `PUBLIC_RENT_TYPES`, `subscriptionTypeBadge()` 추가 |
| `frontend/tests/utils/subscriptionMeta.test.ts` | 유틸 테스트 | 신규 |
| `frontend/tailwind.config.ts` | Tailwind content | `utils` 글롭 추가 |
| `frontend/composables/useHomeSubscriptions.ts` | 홈 청약 데이터 | item 필드·totals·sort 반영 |
| `frontend/tests/composables/useHomeSubscriptions.test.ts` | composable 테스트 | 신규 |
| `frontend/components/subscription/HomeSubscriptionSection.vue` | 홈 섹션 UI | 타임라인으로 전면 교체 |
| `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts` | 컴포넌트 테스트 | 전면 교체 |
| `frontend/pages/index.vue` | 홈 페이지 | `:summary` prop 제거, 미사용 computed 정리 |

---

## Task 1: 백엔드 — 리스트 스키마에 `sort` 옵션 추가

**Files:**
- Modify: `backend/src/schemas/subscription.ts:9-18`
- Test: `backend/__tests__/schemas/subscription.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/schemas/subscription.test.ts` 파일 끝에 (마지막 `});` 들보다 바깥, 파일 최하단) 아래 describe 블록을 추가한다. 기존 import(`SubscriptionListSchema`)가 이미 있으면 재사용하고, 없으면 상단 import에 추가한다.

```ts
import { SubscriptionListSchema } from '../../src/schemas/subscription';

describe('SubscriptionListSchema sort', () => {
  it('sort 미지정도 통과한다', () => {
    const parsed = SubscriptionListSchema.parse({});
    expect(parsed.sort).toBeUndefined();
  });

  it('deadline / startSoon / announcement 값을 허용한다', () => {
    expect(SubscriptionListSchema.parse({ sort: 'deadline' }).sort).toBe('deadline');
    expect(SubscriptionListSchema.parse({ sort: 'startSoon' }).sort).toBe('startSoon');
    expect(SubscriptionListSchema.parse({ sort: 'announcement' }).sort).toBe('announcement');
  });

  it('잘못된 sort 값은 거부한다', () => {
    expect(() => SubscriptionListSchema.parse({ sort: 'random' })).toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/schemas/subscription.test.ts`
Expected: FAIL — `sort` 가 스키마에 없어 `'random'` 거부 케이스 또는 타입 단언에서 실패.

- [ ] **Step 3: 스키마에 `sort` 추가**

`backend/src/schemas/subscription.ts` 의 `SubscriptionListSchema` 객체에 `sort` 필드를 추가한다 (`limit` 줄 바로 아래):

```ts
export const SubscriptionListSchema = z.object({
  status: SubscriptionStatusSchema.optional(),
  region: z.string().max(100).optional(),
  houseType: z.string().max(20).optional(),
  rentType: z.string().max(20).optional(),
  sourceType: SubscriptionSourceTypeSchema.optional(),
  category: SubscriptionCategorySchema.optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sort: z.enum(['announcement', 'deadline', 'startSoon']).optional(),
});
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd backend && npx vitest run __tests__/schemas/subscription.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add backend/src/schemas/subscription.ts backend/__tests__/schemas/subscription.test.ts
git commit -m "feat(subscription): add sort option to list schema"
```

---

## Task 2: 백엔드 — `getSubscriptionList` 정렬 분기

`sort` 값에 따라 orderBy를 바꾼다. 미지정 시 기존 동작(`announcementDate desc`)을 100% 유지해 기존 테스트가 그대로 통과해야 한다.

**Files:**
- Modify: `backend/src/services/subscriptionService.ts:71-189`
- Test: `backend/__tests__/services/subscriptionService.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`backend/__tests__/services/subscriptionService.test.ts` 의 `describe('getSubscriptionList', ...)` 블록 안, 마지막 `it(...)` 다음에 아래 두 테스트를 추가한다.

```ts
  it('sort=deadline 이면 receptionEndDate 오름차순(nulls last)으로 정렬한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'ongoing', sort: 'deadline', page: 1, limit: 5 });

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({
      receptionEndDate: { sort: 'asc', nulls: 'last' },
    });
  });

  it('sort=startSoon 이면 receptionStartDate 오름차순(nulls last)으로 정렬한다', async () => {
    mockFindMany.mockResolvedValue([]);
    mockCount.mockResolvedValue(0);

    await getSubscriptionList({ status: 'upcoming', sort: 'startSoon', page: 1, limit: 5 });

    expect(mockFindMany.mock.calls[0][0].orderBy).toEqual({
      receptionStartDate: { sort: 'asc', nulls: 'last' },
    });
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd backend && npx vitest run __tests__/services/subscriptionService.test.ts`
Expected: FAIL — orderBy가 여전히 `{ announcementDate: 'desc' }` 라서 `deadline`/`startSoon` 케이스 불일치.

- [ ] **Step 3: `buildOrderBy` 추가 및 적용**

`backend/src/services/subscriptionService.ts` 에서 `getSubscriptionList` 함수 **위**에 헬퍼를 추가한다:

```ts
type SubscriptionSort = 'announcement' | 'deadline' | 'startSoon';

function buildOrderBy(sort?: SubscriptionSort): Prisma.SubscriptionOrderByWithRelationInput {
  if (sort === 'deadline') return { receptionEndDate: { sort: 'asc', nulls: 'last' } };
  if (sort === 'startSoon') return { receptionStartDate: { sort: 'asc', nulls: 'last' } };
  return { announcementDate: 'desc' };
}
```

그 다음 `getSubscriptionList` 안에서 `sort` 를 구조분해에 추가한다 (line 72):

```ts
  const { status, region, houseType, rentType, sourceType, category, page, limit, sort } = params;
```

그리고 `findMany` 의 `orderBy: { announcementDate: 'desc' }` 두 곳(status 분기 line 117, 그룹 분기 line 170)을 모두 `orderBy: buildOrderBy(sort)` 로 교체한다.

- [ ] **Step 4: 테스트 통과 확인 (신규 + 기존 회귀)**

Run: `cd backend && npx vitest run __tests__/services/subscriptionService.test.ts`
Expected: PASS — 신규 2건 통과 + 기존 `orderBy: { announcementDate: 'desc' }` 단언 케이스도 그대로 통과(미지정 시 동일 반환).

- [ ] **Step 5: 커밋**

```bash
git add backend/src/services/subscriptionService.ts backend/__tests__/services/subscriptionService.test.ts
git commit -m "feat(subscription): sort list by reception deadline/start"
```

---

## Task 3: 프론트 — `subscriptionTypeBadge` 유틸

`(sourceType, rentType)` → `{ label, classes, kind }`. 임대 2종은 회색.

**Files:**
- Modify: `frontend/utils/subscriptionMeta.ts` (파일 끝에 추가)
- Test: `frontend/tests/utils/subscriptionMeta.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/utils/subscriptionMeta.test.ts` 생성:

```ts
import { describe, it, expect } from 'vitest'
import { subscriptionTypeBadge, PUBLIC_RENT_TYPES } from '~/utils/subscriptionMeta'

describe('subscriptionTypeBadge', () => {
  it('APT 분양(rentType null)은 아파트(인디고)', () => {
    const b = subscriptionTypeBadge('APT', null)
    expect(b.label).toBe('아파트')
    expect(b.kind).toBe('sale')
    expect(b.classes).toContain('indigo')
  })

  it('OFFITEL은 오피스텔(틸)', () => {
    expect(subscriptionTypeBadge('OFFITEL', null).label).toBe('오피스텔')
    expect(subscriptionTypeBadge('OFFITEL', null).classes).toContain('teal')
  })

  it('REMAINING은 무순위·잔여(오렌지)', () => {
    expect(subscriptionTypeBadge('REMAINING', null).label).toBe('무순위·잔여')
    expect(subscriptionTypeBadge('REMAINING', null).classes).toContain('orange')
  })

  it('OPTIONAL은 임의공급(퍼플)', () => {
    expect(subscriptionTypeBadge('OPTIONAL', null).label).toBe('임의공급')
    expect(subscriptionTypeBadge('OPTIONAL', null).classes).toContain('fuchsia')
  })

  it('APT + 공공임대 rentType은 공공임대(회색, rent)', () => {
    const b = subscriptionTypeBadge('APT', PUBLIC_RENT_TYPES[0])
    expect(b.label).toBe('공공임대')
    expect(b.kind).toBe('rent')
    expect(b.classes).toContain('slate')
  })

  it('PRIVATE_RENT는 민간임대(회색, rent)', () => {
    const b = subscriptionTypeBadge('PRIVATE_RENT', null)
    expect(b.label).toBe('민간임대')
    expect(b.kind).toBe('rent')
    expect(b.classes).toContain('slate')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/utils/subscriptionMeta.test.ts`
Expected: FAIL — `subscriptionTypeBadge`/`PUBLIC_RENT_TYPES` export 없음.

- [ ] **Step 3: 유틸 구현**

`frontend/utils/subscriptionMeta.ts` 파일 **맨 끝**에 추가한다 (`getSourceTypeLabel` 아래):

```ts
// 청약홈 API가 '임대주택' 대신 반환하는 실제 공공임대 rentType 값 (백엔드와 동일)
export const PUBLIC_RENT_TYPES = ['분양전환 가능임대', '분양전환 불가임대']

export interface SubscriptionTypeBadge {
  label: string
  classes: string
  kind: 'sale' | 'rent'
}

/**
 * (sourceType, rentType) → 홈 타임라인 타입 뱃지.
 * 분양 4종은 컬러, 임대 2종(공공/민간)은 회색으로 묶고 라벨로 구분.
 * 색 클래스 문자열은 tailwind content 글롭에 utils 가 포함돼야 purge 되지 않음(Task 4).
 */
export function subscriptionTypeBadge(
  sourceType: string,
  rentType: string | null,
): SubscriptionTypeBadge {
  if (sourceType === 'OFFITEL') return { label: '오피스텔', classes: 'bg-teal-50 text-teal-700', kind: 'sale' }
  if (sourceType === 'REMAINING') return { label: '무순위·잔여', classes: 'bg-orange-50 text-orange-700', kind: 'sale' }
  if (sourceType === 'OPTIONAL') return { label: '임의공급', classes: 'bg-fuchsia-50 text-fuchsia-700', kind: 'sale' }
  if (sourceType === 'PRIVATE_RENT') return { label: '민간임대', classes: 'bg-slate-100 text-slate-600', kind: 'rent' }
  if (sourceType === 'APT' && rentType != null && PUBLIC_RENT_TYPES.includes(rentType)) {
    return { label: '공공임대', classes: 'bg-slate-100 text-slate-600', kind: 'rent' }
  }
  // APT 분양 (rentType null 또는 분양 rentType)
  return { label: '아파트', classes: 'bg-indigo-50 text-indigo-700', kind: 'sale' }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/utils/subscriptionMeta.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/utils/subscriptionMeta.ts frontend/tests/utils/subscriptionMeta.test.ts
git commit -m "feat(subscription): add subscriptionTypeBadge util"
```

---

## Task 4: 프론트 — Tailwind content 글롭에 `utils` 추가

뱃지 색 클래스가 `utils/*.ts` 문자열에 있으므로, Tailwind가 스캔하도록 content 글롭에 utils를 추가하지 않으면 색이 purge 된다.

**Files:**
- Modify: `frontend/tailwind.config.ts:5-11` (content 배열)

- [ ] **Step 1: content 배열에 utils/composables 글롭 추가**

`frontend/tailwind.config.ts` 의 `content` 배열을 아래로 교체한다:

```ts
  content: [
    './app/**/*.{vue,js,ts}',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.{vue,js,ts}',
    './pages/**/*.{vue,js,ts}',
    './plugins/**/*.{js,ts}',
    './composables/**/*.{js,ts}',
    './utils/**/*.{js,ts}'
  ],
```

- [ ] **Step 2: 색 클래스가 빌드에 포함되는지 검증**

Run: `cd frontend && npx nuxi prepare && npm run build 2>&1 | tail -20`
Expected: 빌드 성공. (스모크) 빌드 산출물에서 회색/틸 뱃지 클래스 존재 확인:
Run: `grep -ro "bg-teal-50" frontend/.output/public/_nuxt 2>/dev/null | head -1 || echo "검색 생략 가능 — 빌드 성공이면 OK"`
Expected: 클래스가 발견되거나 최소한 빌드가 성공.

> 빌드가 느리면 이 스텝은 Task 8의 통합 빌드로 갈음할 수 있다. 단 글롭 추가 자체는 반드시 커밋한다.

- [ ] **Step 3: 커밋**

```bash
git add frontend/tailwind.config.ts
git commit -m "build(tailwind): scan utils/composables for purge safety"
```

---

## Task 5: 프론트 — `useHomeSubscriptions` 확장

item에 `sourceType`/`rentType` 추가, 접수중=`sort=deadline`·예정=`sort=startSoon`·`limit=5`로 페치, 응답 `total`로 `ongoingTotal`/`upcomingTotal` 노출.

**Files:**
- Modify: `frontend/composables/useHomeSubscriptions.ts`
- Test: `frontend/tests/composables/useHomeSubscriptions.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/composables/useHomeSubscriptions.test.ts` 생성:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ref } from 'vue'
import { flushPromises } from '@vue/test-utils'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'

const fetchCalls: Array<Record<string, unknown>> = []

beforeEach(() => {
  fetchCalls.length = 0
  ;(globalThis as any).useApiBase = () => 'http://api'
  ;(globalThis as any).$fetch = vi.fn((_url: string, opts: { query: Record<string, unknown> }) => {
    fetchCalls.push(opts.query)
    const status = opts.query.status
    if (status === 'ongoing') {
      return Promise.resolve({
        success: true,
        data: {
          items: [
            { id: 1, houseName: '래미안', regionName: '서울 서초구', totalSupplyCount: 100, receptionStartDate: '2026-05-28', receptionEndDate: '2026-05-31', status: 'ongoing', sourceType: 'APT', rentType: null },
          ],
          total: 7, page: 1, totalPages: 7,
        },
      })
    }
    return Promise.resolve({
      success: true,
      data: {
        items: [
          { id: 2, houseName: 'SK뷰', regionName: '광명', totalSupplyCount: 50, receptionStartDate: '2026-06-05', receptionEndDate: null, status: 'upcoming', sourceType: 'OPTIONAL', rentType: null },
        ],
        total: 3, page: 1, totalPages: 3,
      },
    })
  })
  // useAsyncData mock: handler 를 즉시 실행하고 data ref 에 결과 주입
  ;(globalThis as any).useAsyncData = (_key: string, handler: () => Promise<unknown>) => {
    const data = ref<unknown>(null)
    handler().then((r) => { data.value = r })
    return { data, pending: ref(false), error: ref(null), refresh: vi.fn() }
  }
})

describe('useHomeSubscriptions', () => {
  it('접수중은 sort=deadline, 예정은 sort=startSoon, limit=5로 페치한다', async () => {
    useHomeSubscriptions()
    await flushPromises()
    const ongoing = fetchCalls.find((q) => q.status === 'ongoing')
    const upcoming = fetchCalls.find((q) => q.status === 'upcoming')
    expect(ongoing).toMatchObject({ status: 'ongoing', sort: 'deadline', limit: 5 })
    expect(upcoming).toMatchObject({ status: 'upcoming', sort: 'startSoon', limit: 5 })
  })

  it('응답 total을 ongoingTotal/upcomingTotal로 노출한다', async () => {
    const { ongoingTotal, upcomingTotal } = useHomeSubscriptions()
    await flushPromises()
    expect(ongoingTotal.value).toBe(7)
    expect(upcomingTotal.value).toBe(3)
  })

  it('item에 sourceType/rentType을 담는다', async () => {
    const { ongoing, upcoming } = useHomeSubscriptions()
    await flushPromises()
    expect(ongoing.value[0].sourceType).toBe('APT')
    expect(upcoming.value[0].sourceType).toBe('OPTIONAL')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/composables/useHomeSubscriptions.test.ts`
Expected: FAIL — `ongoingTotal`/`upcomingTotal` 미존재, sort 쿼리 미전송.

- [ ] **Step 3: composable 구현 교체**

`frontend/composables/useHomeSubscriptions.ts` 전체를 아래로 교체한다:

```ts
import { readonly, computed } from 'vue'

export interface HomeSubscriptionItem {
  id: number
  houseName: string
  regionName: string
  totalSupplyCount: number | null
  receptionStartDate: string | null
  receptionEndDate: string | null
  status: 'ongoing' | 'upcoming' | 'closed'
  sourceType: string
  rentType: string | null
}

interface ApiListResponse {
  success: boolean
  data: {
    items: HomeSubscriptionItem[]
    total: number
    page: number
    totalPages: number
  }
}

const EMPTY: ApiListResponse = { success: false, data: { items: [], total: 0, page: 1, totalPages: 0 } }

/**
 * 홈 "청약 한눈에" 타임라인용.
 * 접수중(마감 임박순) + 예정(시작 임박순) 각 5건 + 총 건수.
 * SSR 블로킹 (above-the-fold CLS 방지).
 */
export function useHomeSubscriptions() {
  const apiBase = useApiBase()

  const fetchByStatus = (status: 'ongoing' | 'upcoming', sort: 'deadline' | 'startSoon') =>
    $fetch<ApiListResponse>(`${apiBase}/api/subscription`, {
      query: { status, sort, limit: 5, page: 1 },
    }).catch(() => EMPTY)

  const asyncState = useAsyncData('home-subscriptions', async () => {
    const [ongoingRes, upcomingRes] = await Promise.all([
      fetchByStatus('ongoing', 'deadline'),
      fetchByStatus('upcoming', 'startSoon'),
    ])
    return {
      ongoing: ongoingRes.data?.items ?? [],
      upcoming: upcomingRes.data?.items ?? [],
      ongoingTotal: ongoingRes.data?.total ?? 0,
      upcomingTotal: upcomingRes.data?.total ?? 0,
    }
  })

  const ongoing = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.ongoing ?? [])
  const upcoming = computed<HomeSubscriptionItem[]>(() => asyncState.data.value?.upcoming ?? [])
  const ongoingTotal = computed(() => asyncState.data.value?.ongoingTotal ?? 0)
  const upcomingTotal = computed(() => asyncState.data.value?.upcomingTotal ?? 0)
  const hasAny = computed(() => ongoing.value.length > 0 || upcoming.value.length > 0)

  return {
    ongoing: readonly(ongoing),
    upcoming: readonly(upcoming),
    ongoingTotal: readonly(ongoingTotal),
    upcomingTotal: readonly(upcomingTotal),
    hasAny: readonly(hasAny),
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/composables/useHomeSubscriptions.test.ts`
Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add frontend/composables/useHomeSubscriptions.ts frontend/tests/composables/useHomeSubscriptions.test.ts
git commit -m "feat(subscription): home composable fetches imminent-sorted with totals"
```

---

## Task 6: 프론트 — `HomeSubscriptionSection.vue` 타임라인 교체

카드 그리드 → 접수중/예정 2그룹 타임라인. summary prop 제거, D-3 배너·평균가 제거. 데스크톱 2열, 모바일 1열(5번째 줄·지역 숨김).

**Files:**
- Modify (전면 교체): `frontend/components/subscription/HomeSubscriptionSection.vue`
- Test (전면 교체): `frontend/tests/components/subscription/HomeSubscriptionSection.test.ts`

- [ ] **Step 1: 실패하는 테스트로 교체**

`frontend/tests/components/subscription/HomeSubscriptionSection.test.ts` 전체를 아래로 교체한다:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const { ongoingRef, upcomingRef, ongoingTotalRef, upcomingTotalRef } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    ongoingRef: ref<Array<Record<string, unknown>>>([]),
    upcomingRef: ref<Array<Record<string, unknown>>>([]),
    ongoingTotalRef: ref(0),
    upcomingTotalRef: ref(0),
  }
})

vi.mock('~/composables/useHomeSubscriptions', async () => {
  const { computed } = await import('vue')
  return {
    useHomeSubscriptions: () => ({
      ongoing: ongoingRef,
      upcoming: upcomingRef,
      ongoingTotal: ongoingTotalRef,
      upcomingTotal: upcomingTotalRef,
      hasAny: computed(() => ongoingRef.value.length > 0 || upcomingRef.value.length > 0),
    }),
  }
})

import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'

const ongoingSample = [
  { id: 1, houseName: '래미안 원페를라', regionName: '서울 서초구', totalSupplyCount: 540, receptionStartDate: '2026-05-19', receptionEndDate: '2026-05-21', status: 'ongoing', sourceType: 'APT', rentType: null },
  { id: 2, houseName: 'LH 고덕강일', regionName: '서울 강동구', totalSupplyCount: 120, receptionStartDate: '2026-05-18', receptionEndDate: '2026-05-25', status: 'ongoing', sourceType: 'APT', rentType: '분양전환 가능임대' },
]
const upcomingSample = [
  { id: 3, houseName: 'SK뷰 광명센트럴', regionName: '경기 광명시', totalSupplyCount: 80, receptionStartDate: '2026-05-28', receptionEndDate: null, status: 'upcoming', sourceType: 'OPTIONAL', rentType: null },
]

describe('HomeSubscriptionSection (timeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ongoingRef.value = ongoingSample
    upcomingRef.value = upcomingSample
    ongoingTotalRef.value = 7
    upcomingTotalRef.value = 3
    ;(globalThis as any).useState = vi.fn((key: string, init?: () => string) => {
      if (key === 'home-today-iso') return { value: '2026-05-20' }
      return { value: init ? init() : null }
    })
  })

  it('요약 한 줄에 접수중/예정 총 건수를 표시한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('접수중')
    expect(text).toContain('7건')
    expect(text).toContain('예정')
    expect(text).toContain('3건')
  })

  it('평균 분양가와 D-3 배너는 더 이상 렌더하지 않는다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    expect(wrapper.text()).not.toContain('평균 분양가')
    expect(wrapper.text()).not.toContain('마감 임박')
  })

  it('접수중/예정 2그룹과 타입 뱃지를 렌더한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('접수 중')
    expect(text).toContain('접수 예정')
    expect(text).toContain('아파트')      // APT 분양
    expect(text).toContain('공공임대')    // APT + 임대 rentType
    expect(text).toContain('임의공급')    // OPTIONAL
  })

  it('접수중은 마감 D-day, 예정은 시작 D-day를 표시한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('D-1')   // 래미안 마감 05-21 vs today 05-20
    expect(text).toContain('D-8')   // SK뷰 시작 05-28 vs today 05-20
  })

  it('한쪽 그룹이 비면 그 그룹 헤더를 숨긴다', () => {
    upcomingRef.value = []
    upcomingTotalRef.value = 0
    const wrapper = mount(HomeSubscriptionSection)
    expect(wrapper.text()).toContain('접수 중')
    expect(wrapper.text()).not.toContain('접수 예정')
  })

  it('둘 다 비면 빈 상태를 렌더한다', () => {
    ongoingRef.value = []
    upcomingRef.value = []
    ongoingTotalRef.value = 0
    upcomingTotalRef.value = 0
    const wrapper = mount(HomeSubscriptionSection)
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).toContain('현재 접수 중이거나 예정된 청약 공고가 없어요')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/HomeSubscriptionSection.test.ts`
Expected: FAIL — 구버전 컴포넌트가 새 mock 형태(ongoingTotal 등)·새 UI를 만족 못 함.

- [ ] **Step 3: 컴포넌트 전면 교체**

`frontend/components/subscription/HomeSubscriptionSection.vue` 전체를 아래로 교체한다:

```vue
<template>
  <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-display-2 text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">calendar_month</span>
          청약 한눈에
        </h2>
        <p class="text-sm text-slate-500 mt-1">지금 신청 가능한 공고와 예정된 일정을 확인하세요.</p>
      </div>
      <HardLink to="/subscription" class="inline-flex items-center min-h-[44px] text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 보기 →
      </HardLink>
    </div>

    <template v-if="hasAny">
      <!-- 요약 한 줄 -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-green-500" aria-hidden="true"></span>
          접수중 <strong>{{ ongoingTotal }}건</strong>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-primary-500" aria-hidden="true"></span>
          예정 <strong>{{ upcomingTotal }}건</strong>
        </span>
      </div>

      <!-- 타임라인 2그룹 -->
      <div class="grid sm:grid-cols-2 gap-x-8 gap-y-4">
        <div v-if="ongoing.length > 0">
          <h3 class="text-sm font-bold text-slate-700 mb-1.5">🔴 접수 중</h3>
          <ul>
            <li
              v-for="(item, idx) in ongoing"
              :key="`ongoing-${item.id}`"
              :class="['border-b border-slate-100', idx === 4 ? 'hidden sm:block' : '']"
            >
              <HardLink :to="`/subscription/${item.id}`" class="flex items-center gap-2 py-2 -mx-1 px-1 rounded hover:bg-slate-50">
                <span
                  v-if="dayBadge(item.receptionEndDate)"
                  class="shrink-0 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 min-w-[34px] text-center"
                >{{ dayBadge(item.receptionEndDate) }}</span>
                <span :class="['shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded', badge(item).classes]">{{ badge(item).label }}</span>
                <span class="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{{ item.houseName }}</span>
                <span class="hidden sm:inline shrink-0 text-[11px] text-slate-400">{{ item.regionName }}</span>
              </HardLink>
            </li>
          </ul>
        </div>

        <div v-if="upcoming.length > 0">
          <h3 class="text-sm font-bold text-slate-700 mb-1.5">🔵 접수 예정</h3>
          <ul>
            <li
              v-for="(item, idx) in upcoming"
              :key="`upcoming-${item.id}`"
              :class="['border-b border-slate-100', idx === 4 ? 'hidden sm:block' : '']"
            >
              <HardLink :to="`/subscription/${item.id}`" class="flex items-center gap-2 py-2 -mx-1 px-1 rounded hover:bg-slate-50">
                <span
                  v-if="dayBadge(item.receptionStartDate)"
                  class="shrink-0 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 min-w-[34px] text-center"
                >{{ dayBadge(item.receptionStartDate) }}</span>
                <span :class="['shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded', badge(item).classes]">{{ badge(item).label }}</span>
                <span class="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{{ item.houseName }}</span>
                <span class="hidden sm:inline shrink-0 text-[11px] text-slate-400">{{ item.regionName }}</span>
              </HardLink>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- 빈 상태 -->
    <div v-else class="bg-white border border-line rounded-2xl px-6 py-8 text-center">
      <span class="material-symbols-outlined text-slate-300 text-[32px]" aria-hidden="true">event_upcoming</span>
      <p class="text-sm text-slate-500 mt-2">현재 접수 중이거나 예정된 청약 공고가 없어요.</p>
      <HardLink to="/subscription" class="inline-flex items-center mt-3 text-sm text-primary font-bold hover:underline">
        지난 공고 보기 →
      </HardLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'
import type { HomeSubscriptionItem } from '~/composables/useHomeSubscriptions'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'
import { subscriptionTypeBadge } from '~/utils/subscriptionMeta'

const { ongoing, upcoming, hasAny, ongoingTotal, upcomingTotal } = useHomeSubscriptions()

// SSR/CSR 동일한 "오늘" 보장 (hydration mismatch 방지)
const todayIso = useState<string>('home-today-iso', () => new Date().toISOString().split('T')[0])

const MS_PER_DAY = 86_400_000

function diffDaysFromToday(isoDate: string | null): number | null {
  if (!isoDate) return null
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(`${todayIso.value}T00:00:00`)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

function dayBadge(isoDate: string | null): string | null {
  const d = diffDaysFromToday(isoDate)
  if (d === null || d < 0) return null
  return d === 0 ? 'D-Day' : `D-${d}`
}

function badge(item: HomeSubscriptionItem) {
  return subscriptionTypeBadge(item.sourceType, item.rentType)
}
</script>
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/components/subscription/HomeSubscriptionSection.test.ts`
Expected: PASS (6건)

- [ ] **Step 5: 커밋**

```bash
git add frontend/components/subscription/HomeSubscriptionSection.vue frontend/tests/components/subscription/HomeSubscriptionSection.test.ts
git commit -m "feat(subscription): timeline home section with type badges"
```

---

## Task 7: 프론트 — `index.vue` 정리 (`:summary` prop 제거)

컴포넌트가 더 이상 `summary` prop을 받지 않으므로 호출부와 미사용 computed를 정리한다.

**Files:**
- Modify: `frontend/pages/index.vue:101`, `frontend/pages/index.vue:336`

- [ ] **Step 1: prop 바인딩 제거**

`frontend/pages/index.vue:101` 을 교체한다:

```vue
    <HomeSubscriptionSection />
```

- [ ] **Step 2: 미사용 computed 제거**

`frontend/pages/index.vue:336` 의 아래 줄을 삭제한다 (다른 곳에서 미참조 확인 완료 — 101·336 두 곳만 존재):

```ts
const subscriptionSummary = computed(() => dashboard.value?.subscriptionSummary ?? null)
```

- [ ] **Step 3: 잔여 참조 없음 + 린트 확인**

Run: `cd frontend && grep -n "subscriptionSummary" pages/index.vue || echo "OK: no refs"`
Expected: `OK: no refs`
Run: `cd frontend && npm run lint 2>&1 | tail -20`
Expected: 에러 없음 (`subscriptionSummary` 미사용 변수 경고 없음).

- [ ] **Step 4: 커밋**

```bash
git add frontend/pages/index.vue
git commit -m "refactor(home): drop summary prop from subscription section"
```

---

## Task 8: 통합 검증 (lint + test + build)

**Files:** 없음 (검증 전용)

- [ ] **Step 1: 백엔드 전체 테스트**

Run: `cd backend && npm run test`
Expected: 전부 PASS (기존 회귀 포함).

- [ ] **Step 2: 프론트 전체 테스트**

Run: `cd frontend && npm run test`
Expected: 전부 PASS.

- [ ] **Step 3: 프론트 lint + build**

Run: `cd frontend && npm run lint && npm run build 2>&1 | tail -25`
Expected: lint 통과, 빌드 성공. 뱃지 색 클래스가 purge 되지 않음(Task 4 글롭 덕분).

- [ ] **Step 4: 백엔드 lint + build**

Run: `cd backend && npm run lint && npm run build`
Expected: 통과.

- [ ] **Step 5: 수동 스모크 (선택, dev 서버)**

Run: `cd backend && npm run dev` (별도 터미널) + `cd frontend && npm run dev`
확인: 메인 페이지 "청약 한눈에" 섹션에 접수중/예정 2그룹 타임라인, 6종 뱃지(임대 회색), 요약 "접수중 N · 예정 N"이 보이고 평균가·D-3 배너가 없는지. 모바일 폭(<640px)에서 지역명·5번째 줄이 숨는지.

- [ ] **Step 6: (해당 시) 잔여물 정리**

`.superpowers/` 가 `.gitignore` 에 없으면 추가:
Run: `cd /Users/leemyeongseok/projects/ilsangkit && grep -q "^.superpowers" .gitignore || echo ".superpowers/" >> .gitignore`
이미 있으면 변경 없음. 변경 시:
```bash
git add .gitignore && git commit -m "chore: ignore .superpowers brainstorm artifacts"
```

---

## Self-Review 결과

**Spec coverage:**
- 통합 타임라인 전환 → Task 6 ✓
- 분양+임대 전체(6종) → Task 3 뱃지 매핑(6 케이스) ✓
- 접수중/예정 2그룹·임박순 → Task 2(정렬) + Task 5(페치) + Task 6(렌더) ✓
- 임대 회색 묶음 → Task 3(공공/민간 slate) ✓
- 요약 한 줄(접수중 N·예정 N), 평균가·D-3 제거 → Task 5(totals) + Task 6(UI/테스트) ✓
- 5+5 / 모바일 4+4 → Task 5(limit 5) + Task 6(`idx===4` `hidden sm:block`) ✓
- 모바일 지역 생략 → Task 6(`hidden sm:inline`) ✓
- 빈 그룹 헤더 숨김 / 둘 다 빈 빈상태 → Task 6(`v-if` + 테스트) ✓
- 백엔드 sort 옵션, 기존 호출부 무영향 → Task 1·2 ✓
- 신규 유틸 rentType 인지 → Task 3 ✓
- Tailwind purge 리스크(utils) → Task 4 ✓

**Placeholder scan:** 모든 코드 스텝에 실제 코드 포함, TODO/TBD 없음. ✓

**Type consistency:** `HomeSubscriptionItem`(sourceType/rentType 추가)·`subscriptionTypeBadge(sourceType, rentType)`·composable 반환(`ongoingTotal`/`upcomingTotal`/`hasAny`)·컴포넌트 사용처가 전 Task에서 동일 시그니처. `buildOrderBy` 반환 `Prisma.SubscriptionOrderByWithRelationInput`. ✓

**알려진 의존:** Prisma 6.19(`nulls: 'last'` GA), Node 20, lock 재생성 금지.
