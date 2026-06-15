# [공매 auction] 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. 각 Step은 2~5분 단위이며, 실패테스트 → 실패확인 → 구현 → 통과확인 → 커밋 순서를 지킨다.

**Goal:** 공매 물건 상세(`pages/auction/item/[cltrMngNo].vue`)를 spec §4.5 사다리에 맞춘다. (1) 공용 `MobileDetailHeader`(md:hidden) 신규 도입 + `PageHero`를 `title-tag="div"`+`hidden md:block`로 강등(단일 h1 유지). (2) 본문 상단 `grid` wrapper → `flex flex-col`+`order` 전환. (3) **T1=AuctionBidHistory(입찰정보)**, **T1b=AuctionPriceCompare(시세비교)**, **T3=AuctionDetailInfo(스펙, 강등)** 로 순서 재배치. (4) `order-N`/`md:order-N`(1~12, JIT 안전). 데스크톱은 단일맵이라 사이드바 패턴 없이 시세비교 뒤 `md:order-8`. (5) 공유 CTA 신규(현재 없음) + 길찾기 URL 헬퍼(address/lat·lng → kakao/naver). (6) `setFAQSchema(AUCTION_FAQ)` 발행. **광고 4개(AdBanner) + 쿠팡 1개(CoupangBanner)는 개수·위치 불변.**

**Architecture:** 현재 페이지는 `PageHero`(literal h1) → `AdBanner①` → `grid`{입찰정보, 스펙, `AdBanner②`, 시세비교, 지도, `AdBanner③`, 같은지역, 주변시설} → `AdBanner④` → FAQ → `CoupangBanner` → `DataSourceSection`. 변경 후: 모바일 헤더(literal h1)가 폴드 상단을 차지하고, `PageHero`는 데스크톱 전용 `title-tag="div"`로 강등된다. 상단 `grid grid-cols-1`을 `flex flex-col`로 바꾸고 각 자식에 `order-N md:order-N`을 부여해 **입찰정보(T1) → 시세비교(T1b) → 광고② → 스펙(T3) → 지도(T2) → 광고③ → 같은지역(T4) → 주변시설(T4)** 순서를 만든다. 광고 4개의 "단 사이 끼임" 위치는 인접 콘텐츠와 동일 order를 부여해 보존한다. `AuctionDetailInfo`는 루트가 SectionBlock 3개인 **멀티루트 컴포넌트**라 class fall-through가 불가 → **wrapper `<div>`에 order**를 건다(spec §3.3 캐논 ④).

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom, TailwindCSS(JIT). 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`).

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` — §2 사다리, §3.1 단일 h1, §3.2 광고 cadence, §3.3 order 컨벤션, §3.4 headline-first, §4.5 공매, §5 내부배치.

**선행:** Foundation 플랜(공용 헤더) 먼저 적용 — `~/components/common/MobileDetailHeader.vue`(props: `title`·`eyebrow?`·`status?`·`stats?`·`phone?`·`copyable?`·`hideDirections?`·`kakaoMapUrl?`·`naverMapUrl?` / emits: `share`·`copy`·`directions(provider)`)가 존재해야 본 플랜이 컴파일된다. Foundation은 `docs/superpowers/plans/2026-06-15-detail-ordering-00-foundation.md`.

---

## 현재 마크업 기준점 (변경 전, 실제 라인)

`pages/auction/item/[cltrMngNo].vue` 템플릿 현황(라인 94~162):

- `PageHero`(`#title` 슬롯: `AuctionStatusBadge` + `propertyType` 캡션 + `item.address`) ← **literal h1**, 라인 99~107
- `<AdBanner />` (헤더 직후, 광고①) — 라인 109
- `<div class="mt-1 grid grid-cols-1 gap-4">` — 라인 111
  - `AuctionBidHistory`(입찰 정보) — 라인 112
  - `AuctionDetailInfo`(스펙, 멀티루트 3섹션) — 라인 113
  - `<AdBanner />` (광고②) — 라인 116
  - `AuctionPriceCompare`(`v-if="marketCompare"`) — 라인 118~123
  - `AuctionMap`(`v-if lat&&lng`) — 라인 124
  - `<AdBanner />` (광고③) — 라인 127
  - `SectionBlock`(같은 지역 공매, `v-if="nearby.length"`) — 라인 129~131
  - `SectionBlock`(주변 생활시설, `v-if lat&&lng` + `NearbyFacilities`) — 라인 134~140
- `</div>` — 라인 141
- `<AdBanner />` (광고④, grid 바깥) — 라인 144
- FAQ `SectionBlock`(`AUCTION_FAQ` 펼친 dl) — 라인 147~154
- `<CoupangBanner />` — 라인 157
- `<DataSourceSection domain="auction" />` — 라인 159

**광고 인벤토리(불변):** `AdBanner` ×4 (라인 109/116/127/144), `CoupangBanner` ×1 (라인 157). 본 플랜은 추가·삭제·이동 없이 order만 동반 부여한다.

**현재 미존재(신규 추가 대상):** 공유 버튼, 길찾기 헬퍼(`kakaoMapUrl`/`naverMapUrl`/`openNavigation`/`handleShare`), 모바일 헤더, `setFAQSchema` 호출, eyebrow/stat 칩.

---

## 목표 order 매핑 (T0~T6)

상단 flex 컨테이너(`flex flex-col`) 내부. 모바일=데스크톱 **동일 순서**(공매는 단일맵·사이드바 없음 → 뷰포트 분기 불필요)이지만, spec §4.5가 명시적으로 `md:order-8`을 요구하므로 `order-N md:order-N` 쌍을 그대로 부여한다(데스크톱 회귀 가드).

| order | 콘텐츠 | Tier | v-if |
|---|---|---|---|
| `order-1 md:order-1` | AuctionBidHistory (입찰정보) | **T1** | 항상 |
| `order-2 md:order-2` | AuctionPriceCompare (시세비교) | **T1b** | `marketCompare` |
| `order-3 md:order-3` | AdBanner (광고②) | 광고 | 항상 |
| `order-4 md:order-4` | AuctionDetailInfo wrapper (스펙) | **T3** | 항상 |
| `order-5 md:order-5` | AuctionMap (위치) | **T2** | `lat&&lng` |
| `order-6 md:order-6` | AdBanner (광고③) | 광고 | 항상 |
| `order-7 md:order-7` | SectionBlock 같은지역 공매 | **T4** | `nearby.length` |
| `order-8 md:order-8` | SectionBlock 주변 생활시설 | **T4** | `lat&&lng` |

> spec §4.5 "시세비교 뒤 `md:order-8`"는 *지도를 시세비교 뒤로 보낸다*는 의미. 본 매핑에서 지도는 시세비교(order-2)·스펙(order-4) 뒤인 `order-5`에 위치 → 시세비교보다 뒤라는 제약을 만족하며 사다리 T2(위치는 T1·T1b·T3 뒤) 순서와 일치한다. (라벨상의 "8"은 spec 작성 시 단 번호 예시이며, 본 컨테이너는 8개 슬롯이므로 지도가 `order-5`로 매핑된다. 핵심 불변식 = 지도가 입찰정보·시세비교보다 뒤.)

광고①(라인 109, `flex` 컨테이너 **바깥**, 헤더 직후)·광고④(grid 바깥)·FAQ·쿠팡·출처는 컨테이너 외부 형제라 **소스 순서가 곧 렌더 순서** → order 불필요(spec §3.3 끝단 규칙).

---

### Task 1: 입찰정보 페이지 회귀 테스트 신설 (실패부터)

이 페이지는 현재 page-level 테스트가 없다(`tests/pages/auction/` 부재). `realEstateBuildingDetail.test.ts`의 `mountSuspended` 패턴을 그대로 차용해 h1 가드 + 섹션 렌더 + order 클래스 가드를 신설한다.

**Files:**
- Create: `frontend/tests/pages/auction/auctionItemDetail.test.ts`

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/pages/auction/auctionItemDetail.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).useHead = vi.fn()

;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

;(globalThis as any).useRoute = vi.fn(() => ({
  params: { cltrMngNo: '2024-00001-001' },
  query: {},
}))

// useAsyncData: 핸들러를 즉시 실행해 data ref 를 채운다(페이지가 await useAsyncData 사용).
;(globalThis as any).useAsyncData = vi.fn(async (_key: string, handler: any) => ({
  data: ref(await handler()),
}))

const item = {
  id: 1, cltrMngNo: '2024-00001-001', pbctCdtnNo: 'X', plnmNo: null,
  city: '서울특별시', district: '강남구', bjdCode: '1168000000', dongName: '역삼동',
  address: '서울 강남구 역삼동 123-4', usage: '아파트', usageGroup: 'residential',
  propertyType: '주거용', dpslMtdNm: '매각', bidMethod: null, competitionMethod: null,
  bidType: null, evictionResp: null, isShare: false, thumbnailUrl: null,
  landArea: null, bldArea: 84.5,
  apslAssAmt: 980000000, minBidPrc: 686000000, failCnt: 2, bidRound: 3,
  bidBeginDtm: null, bidCloseDtm: null, orgNm: '한국자산관리공사', pvctTrgtYn: false,
  status: 'ongoing', isClosed: false,
  resultType: null, winBidPrc: null, bidRate: null, resultDate: null,
  lat: 37.5, lng: 127.04,
}

vi.mock('~/composables/useAuction', () => ({
  useAuction: () => ({
    getItemDetail: vi.fn().mockResolvedValue({
      item,
      nearby: [],
      marketCompare: { marketAvg: 1100000000, label: '역삼동', apslAssAmtForCompare: undefined },
    }),
  }),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setFAQSchema: mockSetFAQSchema,
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울' },
  DISTRICT_SLUG_MAP: { '강남구': 'gangnam' },
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetFAQSchema.mockClear()
})

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
          PageHero: { template: '<section><component :is="titleTag || \'h1\'"><slot name="title" />{{ title }}</component></section>', props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'] },
          AuctionStatusBadge: { template: '<span data-stub="status-badge" />' },
          AuctionMap: { template: '<section data-stub="auction-map" />' },
          NearbyFacilities: { template: '<div data-stub="nearby-facilities" />' },
          AdBanner: { template: '<div data-stub="ad" />' },
          CoupangBanner: { template: '<div data-stub="coupang" />' },
          DataSourceSection: { template: '<div data-stub="datasource" />' },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('auction/item/[cltrMngNo].vue — 입찰정보 상세 재배치', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    expect(m.default).toBeDefined()
  })

  // 단일 h1 불변식: 모바일 헤더(md:hidden)가 literal h1, PageHero 는 title-tag="div" 강등.
  it('h1은 raw HTML 에서 정확히 1개(모바일 헤더)이며 주소', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toContain('서울 강남구 역삼동 123-4')
  })

  it('입찰 정보(T1)·시세 비교(T1b)·기본정보(T3)가 모두 렌더된다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    const text = wrapper.text()
    expect(text).toContain('입찰 정보')
    expect(text).toContain('실거래가 시세 비교')
    expect(text).toContain('공매 기본정보')
  })

  it('입찰정보 섹션이 order-1, 시세비교가 order-2 클래스를 갖는다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.find('[data-test="tier-bid-history"]').classes()).toContain('order-1')
    expect(wrapper.find('[data-test="tier-price-compare"]').classes()).toContain('order-2')
  })

  it('스펙(AuctionDetailInfo) wrapper 가 order-4(멀티루트 wrapper)를 갖는다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.find('[data-test="tier-detail-info"]').classes()).toContain('order-4')
  })

  it('광고 AdBanner 4개 + 쿠팡 1개가 유지된다(개수 불변)', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.findAll('[data-stub="ad"]').length).toBe(4)
    expect(wrapper.findAll('[data-stub="coupang"]').length).toBe(1)
  })

  it('setFAQSchema 가 AUCTION_FAQ(5건)로 호출된다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    await mountSuspended(m.default)
    expect(mockSetFAQSchema).toHaveBeenCalled()
    const faqs = mockSetFAQSchema.mock.calls[0][0]
    expect(faqs).toHaveLength(5)
    expect(faqs[0]).toHaveProperty('question')
    expect(faqs[0]).toHaveProperty('answer')
  })
})
```

- [ ] **Step 2: 테스트 실행 → 실패 확인**

Run:
```bash
cd frontend && npx vitest run tests/pages/auction/auctionItemDetail.test.ts
```
Expected: FAIL. 기대 출력(요지):
- `h1은 raw HTML 에서 정확히 1개` → 현재 PageHero가 literal h1이고 stub이 `titleTag` 미전달이라 h1 1개로 통과할 수 있으나, 모바일 헤더 미존재로 `h1[0].text()`에 주소가 들어가도 통과 가능 → **이 케이스는 Task 2 이후 의미를 가짐.** 핵심 실패는 아래.
- `입찰정보 섹션이 order-1 ...` → `Cannot call classes on an empty DOMWrapper`(`[data-test="tier-bid-history"]` 미존재). FAIL.
- `스펙 ... order-4` → 동일하게 `[data-test="tier-detail-info"]` 미존재. FAIL.
- `setFAQSchema 가 ... 호출` → 현재 페이지가 `setFAQSchema`를 호출하지 않음 → `mockSetFAQSchema` 0회 → `expected number of calls: >= 1`. FAIL.

> 적어도 3개 케이스(order-1/order-4/setFAQSchema)가 빨갛게 떠야 한다. 떠야 정상.

- [ ] **Step 3: 커밋(실패 테스트 고정)**

```bash
git add frontend/tests/pages/auction/auctionItemDetail.test.ts
git commit -m "test(auction): 입찰정보 상세 재배치 회귀 테스트 (h1/order/FAQ, 실패 상태)"
```

---

### Task 2: 모바일 헤더 도입 + PageHero 강등 + 길찾기/공유 헬퍼

**Files:**
- Modify: `frontend/pages/auction/item/[cltrMngNo].vue` — script(import·헬퍼·FAQ), template(헤더·PageHero)
- Test: `frontend/tests/pages/auction/auctionItemDetail.test.ts` (Task 1, h1·FAQ 케이스가 통과로 전환)

- [ ] **Step 1: script — import 추가**

`pages/auction/item/[cltrMngNo].vue` 라인 18(`import PageHero ...`) 아래에 공용 헤더 import 추가.

변경 전 (라인 18~20):
```ts
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```
변경 후:
```ts
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 2: script — eyebrow/stat 칩 + 길찾기/공유 헬퍼 + FAQ 스키마 추가**

`pages/auction/item/[cltrMngNo].vue` 라인 49(`useHead(() => computeAuctionItemHead(...))`) 바로 아래에 아래 블록을 삽입한다. (헬퍼는 subway·real-estate 페이지의 검증된 패턴을 공매 필드에 맞춰 차용.)

변경 전 (라인 48~50):
```ts
const selfUrl = `${SITE_URL}/auction/item/${cltrMngNo}`
useHead(() => computeAuctionItemHead(item.value, selfUrl))

// ── Breadcrumb ──────────────────────────────────────────────────────────────
```
변경 후:
```ts
const selfUrl = `${SITE_URL}/auction/item/${cltrMngNo}`
useHead(() => computeAuctionItemHead(item.value, selfUrl))

// ── 모바일 헤더: eyebrow(용도/배지) + stat 칩(감정가/최저가/할인율/유찰) ──────────
const headerEyebrow = computed(() =>
  [item.value.usage, item.value.propertyType].filter(Boolean).join(' · ') || '공매 물건',
)
const headerStats = computed(() => {
  const out: Array<{ label: string; value: string; color?: string }> = []
  if (item.value.apslAssAmt != null) out.push({ label: '감정가', value: formatWonKorean(item.value.apslAssAmt) })
  if (item.value.minBidPrc != null) out.push({ label: '최저가', value: formatWonKorean(item.value.minBidPrc), color: 'text-primary' })
  const discount = formatDiscount(item.value.apslAssAmt, item.value.minBidPrc)
  if (discount !== '-') out.push({ label: '할인율', value: discount, color: 'text-emerald-700' })
  out.push({ label: '유찰', value: `${item.value.failCnt}회` })
  return out.slice(0, 4)
})

// ── 길찾기 URL (좌표 우선, 없으면 주소 검색) ──────────────────────────────────
const hasCoords = computed(() => item.value.lat != null && item.value.lng != null)
const kakaoMapUrl = computed(() => {
  const label = encodeURIComponent(item.value.address || '공매 물건')
  return hasCoords.value
    ? `https://map.kakao.com/link/to/${label},${item.value.lat},${item.value.lng}`
    : `https://map.kakao.com/link/search/${label}`
})
const naverMapUrl = computed(() => {
  const label = encodeURIComponent(item.value.address || '공매 물건')
  return hasCoords.value
    ? `https://map.naver.com/v5/directions/-/${item.value.lng},${item.value.lat},${label}/-/walk`
    : `https://map.naver.com/v5/search/${label}`
})
function openNavigation(provider: 'kakao' | 'naver') {
  if (!import.meta.client) return
  window.open(provider === 'kakao' ? kakaoMapUrl.value : naverMapUrl.value, '_blank')
}
async function handleShare() {
  if (!import.meta.client) return
  const shareData = { title: item.value.address || '공매 물건', url: selfUrl }
  try {
    if (navigator.share) await navigator.share(shareData)
    else {
      await navigator.clipboard.writeText(selfUrl)
      alert('링크가 복사되었습니다.')
    }
  } catch (err) {
    console.error('공유 실패:', err)
  }
}

// ── FAQ 구조화 데이터(FAQPage JSON-LD) — spec §3.4 / 결정4 ────────────────────
setFAQSchema(AUCTION_FAQ.map((f) => ({ question: f.q, answer: f.a })))

// ── Breadcrumb ──────────────────────────────────────────────────────────────
```

> `formatWonKorean`·`formatDiscount`는 `~/types/auction`에 이미 존재하지만 본 파일은 아직 import하지 않았다. Step 3에서 import 라인을 추가한다.

- [ ] **Step 3: script — `~/types/auction` 헬퍼 import + `setFAQSchema` 구조분해 추가**

본 파일은 `import { CITY_SLUG_MAP, ... }` 외에 auction 포맷 헬퍼를 import하지 않는다. 라인 8(`import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } ...`) 아래에 추가하고, `useStructuredData` 구조분해에 `setFAQSchema`를 더한다.

변경 전 (라인 7~9):
```ts
import { AUCTION_FAQ } from '~/utils/auctionMeta'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
```
변경 후:
```ts
import { AUCTION_FAQ } from '~/utils/auctionMeta'
import { formatWonKorean, formatDiscount } from '~/types/auction'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
```

그리고 라인 88(`const { setBreadcrumbSchema } = useStructuredData()`)을 변경한다.

변경 전 (라인 88):
```ts
const { setBreadcrumbSchema } = useStructuredData()
```
변경 후:
```ts
const { setBreadcrumbSchema, setFAQSchema } = useStructuredData()
```

> **순서 주의:** Step 2에서 `setFAQSchema(...)`를 라인 49 근처에서 호출하지만, `setFAQSchema`는 라인 88에서 구조분해된다. `<script setup>`은 top-level이 함수 호출 전 hoisting되지 않으므로, **Step 2의 `setFAQSchema(...)` 호출 라인을 라인 88(구조분해) 아래로 옮겨야** 한다. 실제 적용 시: Step 2 블록에서 `setFAQSchema(AUCTION_FAQ.map(...))` 한 줄만 떼어내 라인 88 `const { setBreadcrumbSchema, setFAQSchema } = useStructuredData()` **바로 아래**에 둔다(나머지 eyebrow/stat/길찾기 헬퍼는 Step 2 위치 유지 — 이들은 `item`/`selfUrl`만 의존하므로 라인 49 근처에 둬도 안전). 최종적으로 라인 88~91 영역은:
```ts
const { setBreadcrumbSchema, setFAQSchema } = useStructuredData()
setFAQSchema(AUCTION_FAQ.map((f) => ({ question: f.q, answer: f.a })))
setBreadcrumbSchema(
  breadcrumbItems.value.map((b) => ({ name: b.label, url: b.href })),
)
```

- [ ] **Step 4: template — 모바일 헤더 삽입 + PageHero 강등**

라인 99~107의 `PageHero`를 모바일 헤더 + 강등된 PageHero로 교체한다.

변경 전 (라인 99~107):
```vue
      <PageHero :description="[item.usage, item.orgNm].filter(Boolean).join(' · ')">
        <template #title>
          <span class="mb-2 flex items-center gap-2">
            <AuctionStatusBadge :status="item.status" />
            <span v-if="item.propertyType" class="text-caption font-normal text-muted">{{ item.propertyType }}</span>
          </span>
          {{ item.address }}
        </template>
      </PageHero>
```
변경 후:
```vue
      <!-- 모바일: 공용 핵심정보 헤더(literal h1 1개 소유) -->
      <MobileDetailHeader
        :title="item.address"
        :eyebrow="headerEyebrow"
        :stats="headerStats"
        :kakao-map-url="kakaoMapUrl"
        :naver-map-url="naverMapUrl"
        @share="handleShare"
        @directions="openNavigation"
      />
      <!-- 데스크톱: PageHero(title-tag=div 로 강등 → 단일 h1 유지) -->
      <PageHero
        class="hidden md:block"
        title-tag="div"
        :description="[item.usage, item.orgNm].filter(Boolean).join(' · ')"
      >
        <template #title>
          <span class="mb-2 flex items-center gap-2">
            <AuctionStatusBadge :status="item.status" />
            <span v-if="item.propertyType" class="text-caption font-normal text-muted">{{ item.propertyType }}</span>
          </span>
          {{ item.address }}
        </template>
      </PageHero>
```

> 데스크톱 PageHero가 `AuctionStatusBadge`/`propertyType`을 `#title` 슬롯에 유지한다. 모바일 헤더는 status를 stat 칩 대신 별도로 다루지 않는다(공매 status는 `headerEyebrow`/배지가 데스크톱에서 노출, 모바일은 eyebrow에 용도·유형 노출로 충분 — spec §3.4 "헤더 칩은 보조지표"). 모바일에서 status 배지를 원하면 후속 작업으로 `MobileDetailHeader`의 `status` prop을 쓸 수 있으나 공매 `AuctionStatus`는 헤더의 `OperatingStatus` 타입과 다르므로 본 플랜 범위 밖(전달하지 않음).

- [ ] **Step 5: 테스트 실행 → h1·FAQ 케이스 통과 확인(나머지 order 케이스는 여전히 실패)**

Run:
```bash
cd frontend && npx vitest run tests/pages/auction/auctionItemDetail.test.ts
```
Expected:
- `h1은 raw HTML 에서 정확히 1개(모바일 헤더)이며 주소` → **PASS** (MobileDetailHeader가 literal h1, PageHero는 `title-tag="div"` 강등 → h1 1개).
- `setFAQSchema 가 AUCTION_FAQ(5건)로 호출` → **PASS** (5건, `question`/`answer` 키 보유).
- `입찰 정보·시세 비교·기본정보가 모두 렌더된다` → **PASS** (마크업 미변경, 모두 렌더).
- `광고 4개 + 쿠팡 1개` → **PASS** (개수 불변).
- `order-1 ...` / `order-4 ...` → **여전히 FAIL** (Task 3에서 해결).

- [ ] **Step 6: 커밋**

```bash
git add frontend/pages/auction/item/\[cltrMngNo\].vue
git commit -m "feat(auction): 모바일 MobileDetailHeader 도입 + PageHero title-tag=div 강등 + 공유/길찾기/FAQ스키마"
```

---

### Task 3: grid → flex + order 재배치 (T1→T1b→광고②→T3→T2→광고③→T4)

**Files:**
- Modify: `frontend/pages/auction/item/[cltrMngNo].vue` 라인 111~141 (상단 wrapper + 자식 8개)
- Test: `frontend/tests/pages/auction/auctionItemDetail.test.ts` (order-1/order-4 케이스가 통과로 전환)

- [ ] **Step 1: wrapper를 grid → flex flex-col 로 전환하고 자식에 order 부여**

라인 111~141을 아래로 교체한다. **광고②/광고③은 위치(단 사이)를 보존**하되 새 콘텐츠 순서에 맞춰 인접 콘텐츠 order를 동반 부여한다(spec §3.2 ⑤). 멀티루트 `AuctionDetailInfo`는 **wrapper div**로 감싸 order를 건다(spec §3.3 ④).

변경 전 (라인 111~141):
```vue
      <div class="mt-1 grid grid-cols-1 gap-4">
        <AuctionBidHistory :item="item" />
        <AuctionDetailInfo :item="item" />

        <!-- Ad: 입찰이력·상세정보 이후 -->
        <AdBanner />

        <AuctionPriceCompare
          v-if="marketCompare"
          :apsl-ass-amt="compareApslAmt"
          :market-avg="marketCompare.marketAvg"
          :market-label="marketCompare.label"
        />
        <AuctionMap v-if="item.lat != null && item.lng != null" :lat="item.lat" :lng="item.lng" :address="item.address" />

        <!-- Ad: 시세비교·지도 이후 -->
        <AdBanner />

        <SectionBlock v-if="nearby.length" heading="같은 지역 공매 물건">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
        </SectionBlock>

        <!-- 주변 생활시설 (같은 지역 물건 아래) — 부동산 상세와 동일 컴포넌트 -->
        <SectionBlock
          v-if="item.lat != null && item.lng != null"
          heading="주변 생활시설"
          subtext="부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다."
        >
          <NearbyFacilities :lat="item.lat" :lng="item.lng" />
        </SectionBlock>
      </div>
```
변경 후:
```vue
      <div class="mt-1 flex flex-col gap-4">
        <!-- T1: 입찰 정보 (이 URL 고유 핵심 데이터) -->
        <AuctionBidHistory
          :item="item"
          data-test="tier-bid-history"
          class="order-1 md:order-1"
        />

        <!-- T1b: 실거래가 시세 비교 (입찰정보 직후 상향) -->
        <AuctionPriceCompare
          v-if="marketCompare"
          :apsl-ass-amt="compareApslAmt"
          :market-avg="marketCompare.marketAvg"
          :market-label="marketCompare.label"
          data-test="tier-price-compare"
          class="order-2 md:order-2"
        />

        <!-- Ad②: 입찰정보·시세비교 이후 (단 사이 위치 보존) -->
        <AdBanner class="order-3 md:order-3" />

        <!-- T3: 공매 스펙 (멀티루트 → wrapper div 에 order) -->
        <div data-test="tier-detail-info" class="order-4 md:order-4 flex flex-col gap-4">
          <AuctionDetailInfo :item="item" />
        </div>

        <!-- T2: 위치 (시세비교 뒤로 강등) -->
        <AuctionMap
          v-if="item.lat != null && item.lng != null"
          :lat="item.lat"
          :lng="item.lng"
          :address="item.address"
          class="order-5 md:order-5"
        />

        <!-- Ad③: 스펙·지도 이후 (단 사이 위치 보존) -->
        <AdBanner class="order-6 md:order-6" />

        <!-- T4: 같은 지역 공매 물건 -->
        <SectionBlock
          v-if="nearby.length"
          heading="같은 지역 공매 물건"
          class="order-7 md:order-7"
        >
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
        </SectionBlock>

        <!-- T4: 주변 생활시설 — 부동산 상세와 동일 컴포넌트 -->
        <SectionBlock
          v-if="item.lat != null && item.lng != null"
          heading="주변 생활시설"
          subtext="부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다."
          class="order-8 md:order-8"
        >
          <NearbyFacilities :lat="item.lat" :lng="item.lng" />
        </SectionBlock>
      </div>
```

> **class fall-through 검증:** `AuctionBidHistory`/`AuctionPriceCompare`/`AuctionMap`는 루트가 단일 `<SectionBlock>`(또는 `v-if` SectionBlock)이라 `class`가 루트로 fall-through된다 → 직접 class 부여 OK. `AuctionDetailInfo`만 루트가 3개(멀티루트)라 wrapper div 필요. `SectionBlock`은 단일 루트(`<section>`)라 class 직접 부여 OK.
> **광고 개수 불변:** 본 컨테이너 안 AdBanner 2개(order-3/order-6) = 기존 라인 116/127의 2개 그대로. 컨테이너 밖 AdBanner 2개(라인 109/144) + CoupangBanner 1개(라인 157)는 미변경 → 총 AdBanner 4 + Coupang 1 유지.

- [ ] **Step 2: 테스트 실행 → 전체 통과 확인**

Run:
```bash
cd frontend && npx vitest run tests/pages/auction/auctionItemDetail.test.ts
```
Expected: **PASS (7 tests)**. 특히:
- `입찰정보 섹션이 order-1, 시세비교가 order-2` → PASS.
- `스펙 wrapper 가 order-4` → PASS.
- `광고 4 + 쿠팡 1` → PASS(불변).
- `h1 정확히 1개` → PASS(회귀 없음).

- [ ] **Step 3: 커밋**

```bash
git add frontend/pages/auction/item/\[cltrMngNo\].vue
git commit -m "feat(auction): 상단 grid→flex+order 재배치 (입찰정보 T1·시세비교 T1b·스펙 T3·지도 T2)"
```

---

### Task 4: 전체 회귀 + Nitro 캐시·빌드 검증

**Files:**
- 검증 전용(코드 변경 없음). 변경 시 해당 파일 수정.

- [ ] **Step 1: Nitro route cache 삭제 (재배치 검증 전 필수 — spec §3.3 / 리스크)**

```bash
cd frontend && rm -rf .nuxt/cache/nitro/routes .output 2>/dev/null; echo "nitro route cache cleared"
```

- [ ] **Step 2: 공매 관련 + 신규 테스트 + lint 실행**

Run:
```bash
cd frontend && npx vitest run tests/pages/auction/auctionItemDetail.test.ts tests/components/auction tests/utils/auctionMeta.test.ts tests/types/auction.test.ts
```
Expected: 전부 PASS (기존 auction 테스트 회귀 없음 + 신규 페이지 테스트 PASS).

```bash
cd frontend && npm run lint
```
Expected: 오류 없음(특히 미사용 import·미사용 변수 없음 — `formatWonKorean`/`formatDiscount`/`setFAQSchema`/`MobileDetailHeader` 모두 사용됨).

- [ ] **Step 3: 빌드 검증(컴파일/resolve 오류 없음)**

Run:
```bash
cd frontend && npm run build
```
Expected: 빌드 성공. `~/components/common/MobileDetailHeader.vue` resolve 성공(Foundation 선행 전제). order 클래스(1~8)는 JIT 안전 범위.

- [ ] **Step 4: 커밋(검증 산출물 없으면 생략, 변경 발생 시만)**

검증에서 추가 수정이 발생했을 때만:
```bash
git add -A
git commit -m "fix(auction): 재배치 검증 후속 수정"
```

---

## Self-Review

### spec §4.5(공매) 커버 여부
- **T1=입찰정보 / T1b=시세비교 / T3=스펙 강등** — Task 3 Step 1에서 `AuctionBidHistory`(order-1) → `AuctionPriceCompare`(order-2) → `AuctionDetailInfo`(order-4, wrapper) 로 매핑. ✅
- **＋모바일 헤더 신규(결정2)** — Task 2 Step 4 `MobileDetailHeader`(md:hidden, literal h1) 도입. ✅
- **＋공유 CTA(현재 없음)** — Task 2 Step 2 `handleShare` + 헤더 `@share`. ✅
- **＋order 클래스 / grid→flex 전환** — Task 3 Step 1 `flex flex-col` + `order-N md:order-N`(1~8, JIT 안전). ✅
- **데스크톱 위치=시세비교 뒤(단일맵·사이드바 불필요)** — `AuctionMap` order-5(시세비교 order-2 뒤). 사이드바 패턴 없음. ✅
- **길찾기 URL 헬퍼(address/lat·lng→kakao/naver)** — Task 2 Step 2 `kakaoMapUrl`/`naverMapUrl`(좌표 우선, 미존재 시 주소 검색 폴백) + `openNavigation`. ✅
- **setFAQSchema(AUCTION_FAQ)** — Task 2 Step 3 `setFAQSchema(AUCTION_FAQ.map(f => ({question:f.q, answer:f.a})))`. `AUCTION_FAQ`는 `{q,a}` 형태라 키 변환 필수(검증 케이스 포함). ✅
- **광고 4+쿠팡1 불변** — Task 3 Step 1 주석으로 개수 명시(컨테이너 안 2 + 밖 2 + 쿠팡 1), Task 1 테스트가 `data-stub="ad"` 4개·`coupang` 1개 가드. ✅
- **단일 h1 불변식(§3.1)** — 모바일 헤더 literal h1 + PageHero `title-tag="div"` 강등, Task 1 h1 count===1 테스트. ✅

### 플레이스홀더 스캔
- "적절히 처리/TODO/위와 유사" 표현 없음. 모든 템플릿 변경은 실제 before→after 마크업 코드 블록으로 제시. 헬퍼·헤더·order·FAQ 전부 구체 코드. ✅

### 타입/prop 일관성
- `MobileDetailHeader` prop명(`title`/`eyebrow`/`stats`/`kakao-map-url`/`naver-map-url`)·emit(`share`/`directions(provider)`)은 Foundation API와 일치. `copyable`/`phone`/`hideDirections` 미전달 → 복사·전화·(공매는 길찾기 노출 유지)로 자동 분기. ✅
- `headerStats` 요소는 `{label, value, color?}` — 헤더 `Stat` 타입과 일치, `.slice(0,4)`로 칩 ≤4 (spec §5). ✅
- `setFAQSchema(faqs:{question,answer}[])` 시그니처와 일치(키 변환 적용). ✅
- `formatWonKorean`/`formatDiscount`는 `~/types/auction` 실존 export(확인됨), import 추가. ✅
- `openNavigation(provider)`·`handleShare`는 `import.meta.client` 가드로 SSR 안전(spec/CLAUDE.md SSR 규칙). ✅

### 리스크 / 주의
- **`AuctionDetailInfo` 멀티루트:** wrapper div 누락 시 class fall-through 경고 + order 미적용 → wrapper div(order-4) 필수(Task 3 Step 1에 반영). 테스트가 `[data-test="tier-detail-info"]`로 가드.
- **`setFAQSchema` hoisting:** `<script setup>` top-level 호출 순서 — 구조분해(라인 88) 아래에서 호출(Task 2 Step 3 명시).
- **Nitro route cache:** 재배치가 SSR 응답에 반영 안 될 수 있어 검증 전 캐시 삭제(Task 4 Step 1).
- **`useAsyncData` 모킹:** 테스트가 핸들러를 즉시 실행하므로 `data.value` 채워짐 → `import.meta.server` 가드(라인 37~39)는 happy-dom(`import.meta.server` falsy)에서 통과.
