# 토지(land) 상세 섹션 재배치 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 토지 동(dong) 상세 페이지(`pages/real-estate/land/[city]/[district]/[dong].vue`)를 spec §4.4 / §5 사다리에 맞춘다. (1) 공용 `MobileDetailHeader`(md:hidden, `hideDirections`=true — 좌표 없음, 공유만) 신규 도입 + `PageHero`에 `title-tag="div"`+`hidden md:block` 부여(단일 h1 불변식). (2) 헤드라인 카드(대지 평당가)를 첫 광고보다 위로 승격(T1). (3) 전 콘텐츠/광고 단에 `order-N`/`md:order-N`(1~12) 부여, 둘째 광고를 "추이·분포 ↔ 전체거래" 사이로 이동, `DataSourceSection`(멀티루트)은 wrapper div에 order. (4) `setFAQSchema(LAND_FAQ)` 발행(FAQPage JSON-LD).

**Architecture:** 페이지 `<main>`은 이미 단일 flex 컨테이너(`flex flex-col gap-3`)라 모든 직계 자식에 `order-*`가 그대로 적용된다(좌/우 2컬럼 grid 없음 → order 스케일 1개로 충분). 좌표가 없어 **T2(위치·로드뷰) 섹션은 존재하지 않는다** → 데스크톱 사다리 충돌도 없다. 모바일 헤더(literal `<h1>`)와 PageHero(`title-tag="div"`)는 `md:hidden`/`hidden md:block`로 상호 배타 → 어느 뷰포트든 literal h1 정확히 1개. `LAND_FAQ`는 `{q,a}[]`이고 `setFAQSchema`는 `{question,answer}[]`를 받으므로 `.map()` 어댑터가 필요하다.

**Tech Stack:** Nuxt 3 + Vue 3 `<script setup lang="ts">`, Vitest + `@vue/test-utils` + happy-dom, TailwindCSS (JIT — order는 1~12만 사용).

**참조 spec:** `docs/superpowers/specs/2026-06-15-detail-section-ordering-design.md` (§2 사다리, §3.1 단일 h1, §3.2 광고 cadence, §3.3 order 컨벤션, §3.4 headline-first, §4.4 토지, §5 내부배치)

**선행:** Foundation 플랜(`2026-06-15-detail-ordering-00-foundation.md`)의 공용 헤더(`~/components/common/MobileDetailHeader.vue`)가 먼저 적용/머지되어 있어야 한다. 본 플랜은 그 컴포넌트를 import만 한다.

**전제:** 명령은 모두 `cd frontend` 기준. Node 20 (`nvm use 20`). 작업 브랜치는 Foundation과 동일 또는 그 뒤에 스택된 feat 브랜치.

**광고 인벤토리 (불변 — 현 개수 인용):** AdBanner ×3 (현재 line 13 Hero직후 / line 91 사례직후 / line 183 전체거래직후) + CoupangBanner ×1 (line 197 맨아래). 본 플랜은 광고를 **추가·삭제하지 않는다.** 둘째 AdBanner의 "끼임 위치"만 한 단 아래(추이·분포 ↔ 전체거래)로 옮긴다(spec §3.2 ⑤: 인접 콘텐츠 order 동반 부여).

---

## 섹션 → 사다리 → order 매핑 (목표 최종 상태)

`<main class="... flex flex-col gap-3">`의 직계 자식 순서(모바일=데스크톱 동일 순서이지만, 헤더 2종만 뷰포트 배타). order 값은 **DOM 소스 순서와 동일하게** 부여해 가독성을 유지한다.

| # | 섹션 | tier | order 클래스 | 비고 |
|---|---|---|---|---|
| 1 | Breadcrumb | — | `order-1 md:order-1` | 최상단 고정 |
| 2 | **MobileDetailHeader (신규)** | T0 | `order-2 md:order-2` | `md:hidden`, literal h1, `hideDirections` |
| 3 | PageHero (`title-tag="div"` + `hidden md:block`) | T0 | `order-2 md:order-2` | 데스크톱 제목(h1 강등) |
| 4 | **헤드라인 카드 (대지 평당가)** | T1 | `order-3 md:order-3` | **첫 광고 위로 승격** |
| 5 | AdBanner ① | 광고 | `order-4 md:order-4` | T0/T1 직후 고가시성 보존 |
| 6 | 지목별 시세 (SectionBlock) | T1 | `order-5 md:order-5` | 헤드라인 근거 그리드 |
| 7 | 대지 거래 사례 (SectionBlock) | T3 | `order-6 md:order-6` | |
| 8 | 분기별 추이 + 용도지역 분포 (2-col grid div) | T3 | `order-7 md:order-7` | |
| 9 | AdBanner ② | 광고 | `order-8 md:order-8` | **추이·분포 ↔ 전체거래 사이로 이동** |
| 10 | 전체 거래 내역 (SectionBlock) | T3 | `order-9 md:order-9` | |
| 11 | AdBanner ③ | 광고 | `order-10 md:order-10` | |
| 12 | FAQ (SectionBlock) | T5 | `order-11 md:order-11` | |
| 13 | CoupangBanner | 광고 | `order-12 md:order-12` | 맨 아래 |
| 14 | DataSourceSection **(wrapper div)** | T6 | wrapper `order-12 md:order-12` | 멀티루트 → wrapper div에 order, 소스는 Coupang 뒤 |

> 순서 변경 핵심 두 가지: **헤드라인 카드(#4)가 AdBanner①(#5) 위로** 올라간다(현재는 Ad가 먼저). **AdBanner②(#9)가 "대지 거래 사례→추이/분포" 뒤가 아니라 "추이/분포→전체거래" 사이로** 내려간다(현재 line 91은 사례 직후). 둘 다 소스 순서를 재배열하면서 동시에 order 클래스를 부여해 의도를 명시한다.

---

### Task 1: order 검증 테스트 + 헤더/FAQ 가드 테스트 작성 (실패 확인)

기존 테스트 파일 `frontend/tests/pages/real-estate/landDongDetail.test.ts`를 재사용·확장한다. 이 파일은 이미 `useLand`·`useRoute`·`useAsyncData`·`useStructuredData`를 mock하고 `globalStubs`로 마운트한다.

**Files:**
- Modify: `frontend/tests/pages/real-estate/landDongDetail.test.ts` (`globalStubs` 확장 + describe 블록 추가, setFAQSchema mock 캡처 추가)

- [ ] **Step 1: `globalStubs`에 신규 컴포넌트 stub 추가**

`frontend/tests/pages/real-estate/landDongDetail.test.ts:222-229` 의 `globalStubs` 객체를 아래로 교체. 공용 헤더·쿠팡·페이지네이션 stub를 추가하고, 헤더 stub는 literal `<h1>`을 렌더해 단일 h1 검증이 가능하게 한다. (PageHero stub는 `title-tag="div"`를 받으므로 h1을 렌더하지 않는다 → 단일 h1 보장.)

```ts
// 변경 전 (line 222-229)
const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  PageHero: { template: '<div data-stub="hero" />' },
  SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
  AdBanner: { template: '<div class="stub-ad" />' },
  DataSourceSection: { template: '<div />' },
}
```

```ts
// 변경 후
const globalStubs = {
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
  // PageHero: title-tag prop을 받아 h1 미렌더(데스크톱 제목은 div 강등). 단일 h1 불변식 검증용.
  PageHero: {
    template: '<div data-stub="hero" :data-title-tag="titleTag" :class="$attrs.class" />',
    props: ['titleTag'],
    inheritAttrs: false,
  },
  // 공용 모바일 헤더: literal h1 1개 소유.
  MobileDetailHeader: {
    template: '<section data-stub="mobile-header" :data-hide-directions="hideDirections"><h1>{{ title }}</h1></section>',
    props: ['title', 'eyebrow', 'status', 'stats', 'phone', 'copyable', 'hideDirections', 'kakaoMapUrl', 'naverMapUrl'],
  },
  SectionBlock: { template: '<section><slot /><slot name="heading" /><slot name="right" /></section>' },
  AdBanner: { template: '<div class="stub-ad" />' },
  CoupangBanner: { template: '<div class="stub-coupang" />' },
  Pagination: { template: '<div data-stub="pagination" />' },
  DataSourceSection: { template: '<div data-stub="datasource" />' },
}
```

- [ ] **Step 2: `setFAQSchema` mock을 캡처 가능하게 변경**

`frontend/tests/pages/real-estate/landDongDetail.test.ts:46-55` 의 mock에서 `setFAQSchema`를 모듈 스코프 spy로 끌어올려 호출 인자를 검증할 수 있게 한다.

```ts
// 변경 전 (line 46-55)
const mockSetBreadcrumbSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))
```

```ts
// 변경 후
const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setFAQSchema: mockSetFAQSchema,
  }),
}))
```

그리고 `beforeEach` 안의 `mockSetBreadcrumbSchema.mockClear()` 줄(line 178) 다음에 `mockSetFAQSchema.mockClear()` 를 추가:

```ts
// 변경 전 (line 177-181 일부)
beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockGetRegions.mockClear()
  mockGetRegionDetail.mockClear()
  capturedHeadCalls.length = 0
```

```ts
// 변경 후
beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetFAQSchema.mockClear()
  mockGetRegions.mockClear()
  mockGetRegionDetail.mockClear()
  capturedHeadCalls.length = 0
```

- [ ] **Step 3: 재배치 검증 describe 블록 추가**

파일 맨 끝(line 428 `})` 닫힘 뒤)에 새 describe 블록을 추가한다. 검증 항목: 단일 h1, 모바일 헤더 렌더 + `hideDirections`, PageHero 강등(`title-tag="div"`+`hidden md:block`), 헤드라인 카드가 첫 광고보다 DOM 앞에 위치, 핵심 섹션의 order 클래스 존재, AdBanner 3개/Coupang 1개 개수 불변, FAQPage 스키마 발행, 콘솔 에러 없음.

```ts
describe('real-estate/land/[city]/[district]/[dong].vue — 섹션 재배치(spec §4.4)', () => {
  it('렌더된 DOM에 literal h1이 정확히 1개다(단일 h1 불변식)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('h1')).toHaveLength(1)
  })

  it('모바일 헤더(MobileDetailHeader)가 렌더되고 title=동 이름이다', async () => {
    const wrapper = await mountPage()
    const header = wrapper.find('[data-stub="mobile-header"]')
    expect(header.exists()).toBe(true)
    expect(header.find('h1').text()).toBe('역삼동')
  })

  it('토지 헤더는 hideDirections=true(좌표 없음 → 공유만)다', async () => {
    const wrapper = await mountPage()
    const header = wrapper.find('[data-stub="mobile-header"]')
    // boolean prop은 stub 속성으로 "true"/"false" 문자열화됨
    expect(header.attributes('data-hide-directions')).toBe('true')
  })

  it('PageHero는 title-tag="div"로 강등되고 hidden md:block을 갖는다', async () => {
    const wrapper = await mountPage()
    const hero = wrapper.find('[data-stub="hero"]')
    expect(hero.exists()).toBe(true)
    expect(hero.attributes('data-title-tag')).toBe('div')
    expect(hero.classes()).toContain('hidden')
    expect(hero.classes()).toContain('md:block')
  })

  it('헤드라인 카드(대지 평당가)가 첫 AdBanner보다 DOM 앞에 온다(T1 승격)', async () => {
    const wrapper = await mountPage()
    const html = wrapper.html()
    const headlineIdx = html.indexOf('대지(일반 거래) 평당가')
    const firstAdIdx = html.indexOf('stub-ad')
    expect(headlineIdx).toBeGreaterThan(-1)
    expect(firstAdIdx).toBeGreaterThan(-1)
    expect(headlineIdx).toBeLessThan(firstAdIdx)
  })

  it('헤드라인 카드 wrapper에 order 클래스가 부여된다', async () => {
    const wrapper = await mountPage()
    // 헤드라인 카드는 "대지(일반 거래) 평당가" 텍스트를 포함하는 카드 div
    const card = wrapper
      .findAll('div')
      .find((d) => d.text().includes('대지(일반 거래) 평당가') && d.classes().some((c) => c.startsWith('order-')))
    expect(card, '헤드라인 카드에 order-* 클래스가 있어야 한다').toBeTruthy()
    expect(card!.classes().some((c) => c.startsWith('order-'))).toBe(true)
    expect(card!.classes()).toContain('order-3')
  })

  it('DataSourceSection은 order 클래스를 가진 wrapper로 감싸진다(멀티루트)', async () => {
    const wrapper = await mountPage()
    const ds = wrapper.find('[data-stub="datasource"]')
    expect(ds.exists()).toBe(true)
    // wrapper div(부모)에 order 클래스
    const parent = ds.element.parentElement as HTMLElement
    expect(parent.className).toContain('order-12')
  })

  it('AdBanner는 정확히 3개, CoupangBanner는 1개다(광고 개수 불변)', async () => {
    const wrapper = await mountPage()
    expect(wrapper.findAll('.stub-ad')).toHaveLength(3)
    expect(wrapper.findAll('.stub-coupang')).toHaveLength(1)
  })

  it('AdBanner②가 추이/분포 섹션과 전체거래 섹션 사이에 위치한다', async () => {
    const wrapper = await mountPage()
    const html = wrapper.html()
    const distIdx = html.indexOf('용도지역 분포')
    const totalIdx = html.indexOf('전체 거래 내역')
    // 추이/분포 < (둘째)Ad < 전체거래 순서. 광고 인덱스를 분포~전체거래 구간에서 탐색.
    const adInBetween = html.slice(distIdx, totalIdx).includes('stub-ad')
    expect(distIdx).toBeGreaterThan(-1)
    expect(totalIdx).toBeGreaterThan(-1)
    expect(distIdx).toBeLessThan(totalIdx)
    expect(adInBetween, '추이/분포와 전체거래 사이에 AdBanner가 있어야 한다').toBe(true)
  })

  it('setFAQSchema가 LAND_FAQ 길이만큼 {question,answer} 형태로 호출된다', async () => {
    await mountPage()
    expect(mockSetFAQSchema).toHaveBeenCalledTimes(1)
    const faqs = mockSetFAQSchema.mock.calls[0][0]
    expect(Array.isArray(faqs)).toBe(true)
    expect(faqs.length).toBeGreaterThan(0)
    expect(faqs[0]).toHaveProperty('question')
    expect(faqs[0]).toHaveProperty('answer')
    expect(faqs[0].question).toContain('토지 실거래가 데이터는 어디서')
  })

  it('마운트 시 콘솔 에러가 없다', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    await mountPage()
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })
})
```

- [ ] **Step 4: 테스트 실행 → 실패 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/landDongDetail.test.ts`

Expected: 기존 테스트는 PASS, **신규 describe 블록은 FAIL**. 대표 실패 메시지:
- `모바일 헤더(MobileDetailHeader)가 렌더되고...` → `[data-stub="mobile-header"]` not found (헤더 아직 미도입)
- `PageHero는 title-tag="div"로 강등...` → `data-title-tag` is `undefined` (PageHero에 prop 미전달)
- `헤드라인 카드(대지 평당가)가 첫 AdBanner보다 DOM 앞에...` → headlineIdx > firstAdIdx (현재 Ad가 먼저)
- `setFAQSchema가 LAND_FAQ 길이만큼...` → called `0` times (FAQ 스키마 미발행)
- `AdBanner②가 추이/분포 섹션과 전체거래 섹션 사이...` → adInBetween is `false` (현재 둘째 Ad는 사례 직후)

- [ ] **Step 5: 커밋(실패 테스트)**

```bash
git add frontend/tests/pages/real-estate/landDongDetail.test.ts
git commit -m "test(land): 동상세 섹션 재배치/헤더/FAQ스키마 가드 추가 (red)"
```

---

### Task 2: 공용 모바일 헤더 도입 + PageHero 강등 + FAQ 스키마 발행 (script + 헤더 마크업)

**Files:**
- Modify: `frontend/pages/real-estate/land/[city]/[district]/[dong].vue:6-10` (PageHero에 `title-tag` + `class`), `:6-13` 사이(모바일 헤더 삽입), `:204-216` (import 추가), `:344` 근처(setFAQSchema 호출 추가)
- Test: `frontend/tests/pages/real-estate/landDongDetail.test.ts`

- [ ] **Step 1: 공용 헤더 + 헤더 stats용 computed import 추가**

`frontend/pages/real-estate/land/[city]/[district]/[dong].vue:212-216` 의 import 블록에 공용 헤더를 추가한다.

```ts
// 변경 전 (line 212-216)
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Pagination from '~/components/common/Pagination.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

```ts
// 변경 후
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Pagination from '~/components/common/Pagination.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
```

- [ ] **Step 2: 모바일 헤더 stats computed 추가 (평당가/거래건수/최신거래일)**

`<script setup>` 안, `const detail = computed(...)`(line 271) 바로 다음에 헤더 칩용 computed를 추가한다. spec §5: '정보없음' 필터 후 ≤4개. 좌표 없음 → 공유만이므로 `hideDirections`.

```ts
// 변경 전 (line 270-271)
const summary = computed(() => data.value?.summary ?? null)
const detail = computed(() => data.value?.detail ?? null)
```

```ts
// 변경 후
const summary = computed(() => data.value?.summary ?? null)
const detail = computed(() => data.value?.detail ?? null)

// 모바일 헤더 stat 칩: 평당가 · 거래건수 · 최신거래일 ('정보없음' 필터 후 최대 4개)
const mobileHeaderStats = computed(() => {
  const s = summary.value
  if (!s) return []
  const stats: Array<{ label: string; value: string; color?: string }> = []
  if (s.avgPricePerPyeong != null) {
    stats.push({ label: '평당가', value: formatManwonKorean(s.avgPricePerPyeong), color: 'text-primary' })
  }
  if (s.transactionCount != null && s.transactionCount > 0) {
    stats.push({ label: '거래', value: `${s.transactionCount.toLocaleString('ko-KR')}건` })
  }
  if (s.latestDealDate) {
    stats.push({ label: '최신거래', value: formatLandDealDate(s.latestDealDate) })
  }
  return stats.slice(0, 4)
})
```

> `summary` 타입은 `useLand().getRegions().items[]`의 원소다. `avgPricePerPyeong`/`transactionCount`/`latestDealDate` 필드는 테스트 mock(line 66-78)과 헤드라인 카드(line 18-28)에서 이미 사용 중이라 존재가 확인된다.

- [ ] **Step 3: 헤더 마크업 추가 + PageHero 강등**

`frontend/pages/real-estate/land/[city]/[district]/[dong].vue:6-10` 의 PageHero에 `title-tag="div"` + `class="hidden md:block"`를 부여하고, 그 **앞에** 모바일 헤더를 삽입한다. (order 클래스는 Task 3에서 일괄 부여 — 여기선 헤더 도입과 강등만.)

```vue
<!-- 변경 전 (line 6-10) -->
      <PageHero
        eyebrow="토지 실거래가"
        :title="`${dong} 토지 실거래가`"
        :description="`${cityName} ${districtName} ${dong} 지역의 토지 매매 실거래가와 평당 시세를 확인하세요.`"
      />
```

```vue
<!-- 변경 후 -->
      <!-- T0: 모바일 핵심정보 헤더 (literal h1 1개 소유). 좌표 없음 → hideDirections(공유만). -->
      <MobileDetailHeader
        :title="dong"
        eyebrow="토지 실거래가"
        :stats="mobileHeaderStats"
        hide-directions
        @share="handleShare"
      />

      <!-- T0: 데스크톱 제목 (title-tag="div"로 강등 → 단일 h1 유지) -->
      <PageHero
        class="hidden md:block"
        title-tag="div"
        eyebrow="토지 실거래가"
        :title="`${dong} 토지 실거래가`"
        :description="`${cityName} ${districtName} ${dong} 지역의 토지 매매 실거래가와 평당 시세를 확인하세요.`"
      />
```

- [ ] **Step 4: 공유 핸들러 추가 (`handleShare`)**

헤더가 `@share`를 emit한다. `<script setup>` 안 `goToTxPage`(line 282-288) 다음에 SSR-safe 공유 핸들러를 추가한다. (CLAUDE.md SSR 가드: 브라우저 API는 `import.meta.client` 가드.)

```ts
// 변경 전 (line 282-288)
async function goToTxPage(p: number) {
  const bjd = summary.value?.bjdCode
  if (!bjd) return
  const res = await useLand().getTransactions({ bjdCode: bjd, dongName: dong, page: p, limit: TX_LIMIT })
  txItems.value = res.items
  txPage.value = res.page
}
```

```ts
// 변경 후
async function goToTxPage(p: number) {
  const bjd = summary.value?.bjdCode
  if (!bjd) return
  const res = await useLand().getTransactions({ bjdCode: bjd, dongName: dong, page: p, limit: TX_LIMIT })
  txItems.value = res.items
  txPage.value = res.page
}

// 헤더 공유 버튼: Web Share API 우선, 미지원 시 URL 클립보드 복사
async function handleShare() {
  if (!import.meta.client) return
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: pageTitle, url })
    } catch {
      // 사용자가 취소한 경우 등 — 무시
    }
    return
  }
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // 클립보드 미지원 — 무시
  }
}
```

- [ ] **Step 5: FAQPage JSON-LD 발행 (`setFAQSchema(LAND_FAQ)`)**

`<script setup>` 하단의 `setBreadcrumbSchema([...])` 호출(line 344-352) 직후에 FAQ 스키마 발행을 추가한다. `LAND_FAQ`는 이미 import되어 있고(line 209), `{q,a}` → `{question,answer}` 어댑터가 필요하다.

```ts
// 변경 전 (line 344-352)
const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
  { name: cityName, url: `/real-estate/land/${citySlug}` },
  { name: districtName, url: `/real-estate/land/${citySlug}/${districtSlug}` },
  { name: dong, url: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}` },
])
```

```ts
// 변경 후
const { setBreadcrumbSchema, setFAQSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
  { name: cityName, url: `/real-estate/land/${citySlug}` },
  { name: districtName, url: `/real-estate/land/${citySlug}/${districtSlug}` },
  { name: dong, url: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}` },
])

// FAQPage JSON-LD (LAND_FAQ는 {q,a} → setFAQSchema는 {question,answer} 요구 → 어댑터)
setFAQSchema(LAND_FAQ.map((f) => ({ question: f.q, answer: f.a })))
```

- [ ] **Step 6: 헤더/FAQ 관련 테스트 부분 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/landDongDetail.test.ts`

Expected: 다음 테스트 PASS — `literal h1 정확히 1개`, `모바일 헤더 렌더 + title`, `hideDirections=true`, `PageHero title-tag="div" + hidden md:block`, `setFAQSchema {question,answer} 호출`, `콘솔 에러 없음`. 아직 FAIL — `헤드라인 카드가 첫 광고 앞`, `헤드라인 order-3`, `DataSourceSection wrapper order-12`, `AdBanner② 추이/분포↔전체거래 사이`(Task 3에서 처리).

- [ ] **Step 7: 커밋**

```bash
git add frontend/pages/real-estate/land/\[city\]/\[district\]/\[dong\].vue
git commit -m "feat(land): 동상세 공용 모바일헤더 도입 + PageHero 강등 + FAQPage 스키마"
```

---

### Task 3: 콘텐츠/광고 단 재배치 + order 클래스 부여

헤드라인 카드를 첫 광고 위로 승격, 둘째 광고를 추이/분포 ↔ 전체거래 사이로 이동, 전 단에 order 부여, DataSourceSection을 wrapper div로 감싼다. **광고 개수 불변(AdBanner 3 + Coupang 1).**

**Files:**
- Modify: `frontend/pages/real-estate/land/[city]/[district]/[dong].vue:12-199` (template 본문 재배열 + order 클래스)
- Test: `frontend/tests/pages/real-estate/landDongDetail.test.ts`

- [ ] **Step 1: Breadcrumb에 order 부여**

`:4` (Breadcrumb) — order만 추가.

```vue
<!-- 변경 전 (line 4) -->
      <Breadcrumb :items="breadcrumbItems" />
```

```vue
<!-- 변경 후 -->
      <Breadcrumb :items="breadcrumbItems" class="order-1 md:order-1" />
```

- [ ] **Step 2: 헤더 2종에 order 부여 (T0)**

Task 2에서 삽입한 MobileDetailHeader / PageHero 에 `order-2 md:order-2`를 추가한다.

```vue
<!-- 변경 전 (Task 2 결과) -->
      <MobileDetailHeader
        :title="dong"
        eyebrow="토지 실거래가"
        :stats="mobileHeaderStats"
        hide-directions
        @share="handleShare"
      />

      <PageHero
        class="hidden md:block"
        title-tag="div"
```

```vue
<!-- 변경 후 -->
      <MobileDetailHeader
        :title="dong"
        eyebrow="토지 실거래가"
        :stats="mobileHeaderStats"
        hide-directions
        class="order-2 md:order-2"
        @share="handleShare"
      />

      <PageHero
        class="hidden md:block order-2 md:order-2"
        title-tag="div"
```

- [ ] **Step 3: 헤드라인 카드를 첫 광고 위로 승격 + order-3**

현재 순서는 `AdBanner(line 13) → 헤드라인 카드(line 16)`. 이를 `헤드라인 카드(order-3) → AdBanner(order-4)`로 **소스 순서를 뒤집고** order를 부여한다. AdBanner 주석도 갱신.

```vue
<!-- 변경 전 (line 12-34) -->
      <!-- Ad: Hero 직후 -->
      <AdBanner />

      <!-- 1. 헤드라인 카드 -->
      <div class="bg-white rounded-xl border border-line shadow-card p-5 md:p-6">
        <div class="text-eyebrow text-slate-500 mb-1">대지(일반 거래) 평당가</div>
        <template v-if="summary && summary.avgPricePerPyeong != null">
          <div class="flex flex-wrap items-baseline gap-2">
            <strong class="text-display-1 text-slate-900">
              {{ formatManwonKorean(summary.avgPricePerPyeong) }}
            </strong>
            <span class="text-caption text-slate-500">
              (㎡당 {{ formatManwonKorean(pyeongToSqm(summary.avgPricePerPyeong)) }})
            </span>
          </div>
          <p class="mt-2 text-caption text-slate-400 leading-relaxed">
            비지분 대지 {{ summary.daeNonShareCount ?? 0 }}건 기준 · 최근 12개월 · 최신 거래 {{ formatLandDealDate(summary.latestDealDate) }} · 지분·도로 자투리 제외
          </p>
        </template>
        <div v-else class="rounded-xl bg-background-light p-6 text-center text-caption text-slate-500">
          비지분 대지 거래 없음 — 아래 지목별 시세를 참고하세요
        </div>
      </div>
```

```vue
<!-- 변경 후 -->
      <!-- T1: 헤드라인 카드 (대지 평당가) — 첫 광고보다 위로 승격 -->
      <div class="order-3 md:order-3 bg-white rounded-xl border border-line shadow-card p-5 md:p-6">
        <div class="text-eyebrow text-slate-500 mb-1">대지(일반 거래) 평당가</div>
        <template v-if="summary && summary.avgPricePerPyeong != null">
          <div class="flex flex-wrap items-baseline gap-2">
            <strong class="text-display-1 text-slate-900">
              {{ formatManwonKorean(summary.avgPricePerPyeong) }}
            </strong>
            <span class="text-caption text-slate-500">
              (㎡당 {{ formatManwonKorean(pyeongToSqm(summary.avgPricePerPyeong)) }})
            </span>
          </div>
          <p class="mt-2 text-caption text-slate-400 leading-relaxed">
            비지분 대지 {{ summary.daeNonShareCount ?? 0 }}건 기준 · 최근 12개월 · 최신 거래 {{ formatLandDealDate(summary.latestDealDate) }} · 지분·도로 자투리 제외
          </p>
        </template>
        <div v-else class="rounded-xl bg-background-light p-6 text-center text-caption text-slate-500">
          비지분 대지 거래 없음 — 아래 지목별 시세를 참고하세요
        </div>
      </div>

      <!-- Ad①: T0/T1 직후 (고가시성 보존) -->
      <AdBanner class="order-4 md:order-4" />
```

- [ ] **Step 4: 지목별 시세 + 대지 거래 사례에 order 부여, 둘째 광고 제거(아래로 이동 준비)**

지목별 시세(T1) = order-5, 대지 거래 사례(T3) = order-6. 사례 직후의 `AdBanner(line 90-91, "Ad: 사례 이후")`는 여기서 **삭제**하고 Step 5에서 추이/분포 다음으로 옮긴다(개수 보존 — 옮기는 것이지 삭제 아님).

```vue
<!-- 변경 전 (line 36-37) -->
      <!-- 2. 지목별 시세 -->
      <SectionBlock heading="지목별 시세" subtext="지목 그룹별 평균 평당가와 거래 건수입니다.">
```

```vue
<!-- 변경 후 -->
      <!-- T1: 지목별 시세 -->
      <SectionBlock class="order-5 md:order-5" heading="지목별 시세" subtext="지목 그룹별 평균 평당가와 거래 건수입니다.">
```

```vue
<!-- 변경 전 (line 62-63) -->
      <!-- 3. 대지 거래 사례 -->
      <SectionBlock heading="대지 거래 사례" subtext="비지분 대지 거래 최신 사례입니다.">
```

```vue
<!-- 변경 후 -->
      <!-- T3: 대지 거래 사례 -->
      <SectionBlock class="order-6 md:order-6" heading="대지 거래 사례" subtext="비지분 대지 거래 최신 사례입니다.">
```

그리고 사례 SectionBlock 닫힘(line 88) 다음의 둘째 광고를 삭제:

```vue
<!-- 변경 전 (line 88-92) -->
      </SectionBlock>

      <!-- Ad: 사례 이후 -->
      <AdBanner />

      <!-- 4. 분기별 추이 + 용도지역 분포 (2-col grid) -->
```

```vue
<!-- 변경 후 -->
      </SectionBlock>

      <!-- T3: 분기별 추이 + 용도지역 분포 (2-col grid) -->
```

> 주의: `SectionBlock`은 `class`를 루트로 fall-through 한다(단일 루트 컴포넌트). 멀티루트가 아니므로 wrapper 불필요.

- [ ] **Step 5: 추이/분포 grid에 order-7, 그 뒤에 둘째 광고(order-8) 삽입**

추이/분포 2-col grid wrapper(line 93-97)에 order-7을 부여하고, 닫는 `</div>`(line 145) 다음에 **둘째 AdBanner를 order-8로 삽입**(Step 4에서 제거한 그 광고가 여기로 이동).

```vue
<!-- 변경 전 (line 93-97) -->
      <!-- 4. 분기별 추이 + 용도지역 분포 (2-col grid) -->
      <div
        v-if="detail && (detail.priceTimeline.length > 0 || detail.landUseDistribution.length > 0)"
        class="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
```

```vue
<!-- 변경 후 -->
      <!-- T3: 분기별 추이 + 용도지역 분포 (2-col grid) -->
      <div
        v-if="detail && (detail.priceTimeline.length > 0 || detail.landUseDistribution.length > 0)"
        class="order-7 md:order-7 grid grid-cols-1 md:grid-cols-2 gap-3"
      >
```

```vue
<!-- 변경 전 (line 145-148) -->
      </div>

      <!-- 5. 전체 거래 내역 -->
      <SectionBlock v-if="detail && detail.total > 0" heading="전체 거래 내역" :subtext="`전체 ${detail.total.toLocaleString('ko-KR')}건 · 지분·도로 포함`">
```

```vue
<!-- 변경 후 -->
      </div>

      <!-- Ad②: 추이/분포 ↔ 전체거래 사이로 이동 -->
      <AdBanner class="order-8 md:order-8" />

      <!-- T3: 전체 거래 내역 -->
      <SectionBlock v-if="detail && detail.total > 0" class="order-9 md:order-9" heading="전체 거래 내역" :subtext="`전체 ${detail.total.toLocaleString('ko-KR')}건 · 지분·도로 포함`">
```

- [ ] **Step 6: 셋째 광고 order-10, FAQ order-11**

전체거래 직후 광고(line 182-183)에 order-10, FAQ SectionBlock(line 185-186)에 order-11.

```vue
<!-- 변경 전 (line 182-186) -->
      <!-- Ad: 전체거래 이후 -->
      <AdBanner />

      <!-- 6. FAQ -->
      <SectionBlock heading="자주 묻는 질문" subtext="토지 실거래가와 관련된 자주 묻는 질문입니다.">
```

```vue
<!-- 변경 후 -->
      <!-- Ad③: 전체거래 이후 -->
      <AdBanner class="order-10 md:order-10" />

      <!-- T5: FAQ -->
      <SectionBlock class="order-11 md:order-11" heading="자주 묻는 질문" subtext="토지 실거래가와 관련된 자주 묻는 질문입니다.">
```

- [ ] **Step 7: 쿠팡 order-12, DataSourceSection을 order-12 wrapper로 감싸기**

CoupangBanner(line 196-197)에 order-12, DataSourceSection(line 199, 멀티루트 → class fall-through 불가)을 `order-12` wrapper div로 감싼다. 소스 순서는 Coupang → DataSource 유지(T5 끝단 → 쿠팡 → T6 출처).

```vue
<!-- 변경 전 (line 196-200) -->
      <!-- Ad: 쿠팡 (페이지 맨 아래) -->
      <CoupangBanner />

      <DataSourceSection domain="real-estate" />
    </main>
```

```vue
<!-- 변경 후 -->
      <!-- Ad: 쿠팡 (페이지 맨 아래) -->
      <CoupangBanner class="order-12 md:order-12" />

      <!-- T6: 데이터 출처 (멀티루트 컴포넌트 → wrapper div에 order 부여) -->
      <div class="order-12 md:order-12">
        <DataSourceSection domain="real-estate" />
      </div>
    </main>
```

> order-12 공유군(쿠팡·출처)은 같은 order 값이라 **DOM 소스 순서**가 곧 렌더 순서(spec §3.3) → 소스에서 쿠팡 → 출처 순서를 유지했으므로 의도대로 렌더된다.

- [ ] **Step 8: 전체 테스트 통과 확인**

Run: `cd frontend && npx vitest run tests/pages/real-estate/landDongDetail.test.ts`

Expected: PASS (기존 테스트 + 신규 describe 블록 전부). 특히:
- `헤드라인 카드가 첫 AdBanner보다 DOM 앞` → PASS
- `헤드라인 card order-3` → PASS
- `DataSourceSection wrapper order-12` → PASS
- `AdBanner 3개 / Coupang 1개` → PASS
- `AdBanner② 추이/분포 ↔ 전체거래 사이` → PASS

- [ ] **Step 9: 커밋**

```bash
git add frontend/pages/real-estate/land/\[city\]/\[district\]/\[dong\].vue
git commit -m "feat(land): 동상세 섹션/광고 order 재배치 (헤드라인 승격·광고② 이동)"
```

---

### Task 4: 회귀 검증 (전체 land 테스트 + 빌드 + 캐시 주의)

**Files:** (검증 전용 — 코드 변경 없음)

- [ ] **Step 1: land 관련 전체 테스트 실행**

Run: `cd frontend && npx vitest run tests/pages/real-estate/landDongDetail.test.ts tests/utils/landMeta.test.ts tests/composables/useLand.test.ts`

Expected: 전부 PASS. (헤더 도입·order 추가가 `landMeta`/`useLand` 계약을 깨지 않음 확인.)

- [ ] **Step 2: lint + 빌드 검증**

Run: `cd frontend && npm run lint && npm run build`

Expected: lint 통과(미사용 import 없음 — `MobileDetailHeader`·`setFAQSchema`·`handleShare`·`mobileHeaderStats` 모두 사용됨), build 성공.

- [ ] **Step 3: (수동) dev 스모크 — Nitro route cache 주의**

> spec §3.3 / §8: 재배치 검증 시 Nitro route cache 삭제 필요. 동상세는 `useHead`에 `s-maxage`를 직접 설정하지 않지만, 안전하게 캐시를 비우고 dev 재시작 후 모바일/데스크톱 뷰포트로 확인한다.

```bash
cd frontend
rm -rf .nuxt/cache/nitro/routes
npm run dev
# 브라우저: http://localhost:3000/real-estate/land/seoul/gangnam/역삼동
# 모바일 뷰포트(<768px): MobileDetailHeader(제목+칩, 길찾기 버튼 없음, 공유만) 노출 / PageHero 숨김
# 데스크톱 뷰포트(≥768px): PageHero 제목 노출 / MobileDetailHeader 숨김
# 두 뷰포트 모두: 헤드라인 카드가 첫 광고 위, 광고 3개 + 쿠팡 1개, 콘솔 에러 없음
# DevTools: document.querySelectorAll('h1').length === 1
```

Expected: 모바일/데스크톱 둘 다 literal h1 1개, 광고 개수 3+1 유지, 헤드라인 카드 폴드 상단.

- [ ] **Step 4: 최종 커밋(필요 시) / 작업 마무리**

코드 변경이 없으면 별도 커밋 불필요. 검증 로그만 기록한다.

---

## Self-Review

### Spec §4.4 (토지 land) 커버리지
- **＋모바일 헤더 신규 도입 (결정 2)** → Task 2 Step 1·3 (`MobileDetailHeader` import + 마크업, `md:hidden` 내장). ✅
- **헤더 CTA=공유만(길찾기 비활성, `hideDirections`)** → Task 2 Step 3 (`hide-directions` prop), Task 1 가드 테스트(`data-hide-directions==="true"`). ✅
- **PageHero `title-tag="div"`+`hidden md:block`** → Task 2 Step 3, Task 3 Step 2(order 추가), 가드 테스트. ✅
- **헤드라인 카드를 첫 광고보다 위로 승격(T1)** → Task 3 Step 3 (소스 순서 뒤집기 + order-3 vs order-4), 가드 테스트(headlineIdx < firstAdIdx). ✅
- **＋order 클래스 신규(1~12)** → Task 3 Step 1-7 (order-1~12, 13+ 없음). ✅
- **둘째 광고를 추이·분포 ↔ 전체거래 사이로 이동** → Task 3 Step 4(제거)·Step 5(재삽입 order-8), 가드 테스트(추이/분포~전체거래 구간에 stub-ad). ✅
- **DataSourceSection은 wrapper div에 order(멀티루트)** → Task 3 Step 7, 가드 테스트(parent className contains order-12). ✅
- **setFAQSchema(LAND_FAQ) — FAQPage JSON-LD** → Task 2 Step 5 (`{q,a}→{question,answer}` 어댑터), 가드 테스트. ✅
- **T2(위치) 섹션 없음(좌표 없음)** → 좌표·지도 마크업을 추가하지 않음. 데스크톱 사다리 충돌 없음(2컬럼 grid 미사용). ✅
- **광고 3 + 쿠팡 1 불변** → Task 3에서 추가·삭제 0건(둘째 광고는 이동만), 가드 테스트(AdBanner 3 / Coupang 1). ✅

### spec §3 불변 규칙 점검
- §3.1 단일 h1: 모바일 헤더 literal h1 1개 + PageHero `title-tag="div"` 강등 → 가드 테스트 `findAll('h1').toHaveLength(1)`. ✅
- §3.2 광고 cadence: 첫 광고가 T0/T1 직후(order-4), 단 경계마다 1개, T1 두 핵심(헤드라인·지목별)을 광고로 끊지 않음, 쿠팡은 FAQ 뒤·출처 앞. ✅
- §3.3 order: N=1~12만 사용, 끝단(쿠팡·출처) order-12 공유 + 소스 순서 의존. 단일 flex 컨테이너라 스케일 혼선 없음. ✅
- §3.4 headline-first: 헤드라인 카드는 이미 평당가 수치를 가장 크게(`text-display-1`) 먼저 노출 — 구조 유지(리라이트 없음). 헤더 칩은 보조지표(차등). ✅

### 플레이스홀더 스캔
- "적절히/TODO/위와 유사" 표현 없음. 모든 마크업 변경은 실제 before→after 코드 블록으로 명시. ✅
- 모든 vitest 명령은 정확한 경로(`tests/pages/real-estate/landDongDetail.test.ts` 등) 포함. ✅

### 타입/prop 일관성
- `MobileDetailHeader` props: `title`(string) · `eyebrow`(string) · `stats`(`{label,value,color?}[]`) · `hideDirections`(boolean) — Foundation 정의와 일치. `phone`/`copyable`/`status`/`kakao-map-url`/`naver-map-url` 미전달(좌표·전화 없음) → 전화/복사/길찾기 pill 자동 숨김. ✅
- `mobileHeaderStats` 반환 타입 `{label,value,color?}[]` = 헤더 `stats` prop 타입과 일치. `color: 'text-primary'`는 Tailwind 정적 클래스. ✅
- `setFAQSchema` 시그니처(`{question,answer}[]`)에 어댑터로 정확히 맞춤. ✅
- `handleShare`는 SSR 가드(`import.meta.client`) 적용(CLAUDE.md SSR 규칙). ✅

### 리스크
- **summary 필드명**: `transactionCount`/`avgPricePerPyeong`/`latestDealDate`가 `getRegions` 응답에 존재한다고 가정(테스트 mock·헤드라인 카드에서 사용 확인). 실제 타입에서 필드명이 다르면 Task 2 Step 2의 stat computed를 해당 필드로 조정. (mock 기준으로는 일치.)
- **둘째 광고 이동 위치 v-if 갭**: 추이/분포 grid가 `v-if`로 빠지면(데이터 없음) order-7 섹션 부재 → order-8 광고가 사례(order-6) 다음에 붙는다. 광고 개수는 불변이므로 회귀 아님(spec §8 조건부 갭 허용). ✅
