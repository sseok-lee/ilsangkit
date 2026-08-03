# SSR 누락 복구 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `onMounted`/`watch` 기반 클라 전용 패칭으로 SSR HTML에서 빠지던 관련 가이드·공공임대 목록·주변시설을 `useAsyncData`로 전환해 SSR에 포함시킨다.

**Architecture:** Nuxt 3의 `useAsyncData`는 서버 렌더 중 resolve되어 HTML/payload에 반영된다. 보조 콘텐츠 3곳을 `useAsyncData`로 옮기되, 실패는 빈 결과로 폴백해 페이지 핵심 렌더는 보존한다. `useApiBase` 루프백·`config.public.apiBase`(이미지) 규칙은 유지한다.

**Tech Stack:** Nuxt 3 SSR, Vue 3 `<script setup>`, Vitest + @vue/test-utils + happy-dom.

**참조 spec:** `docs/superpowers/specs/2026-06-02-ssr-restoration-design.md`

**전제:** 모든 명령은 Node 20에서. 각 터미널 단계 앞에 `nvm use 20`가 적용된 상태로 가정한다(`source ~/.nvm/nvm.sh && nvm use 20`). 작업 디렉터리는 `frontend/`.

---

## File Structure

- `frontend/components/guide/RelatedGuides.vue` — (수정) onMounted→useAsyncData
- `frontend/pages/guide/[slug].vue` — (수정) `<ClientOnly>` 래퍼 제거
- `frontend/tests/components/guide/RelatedGuides.test.ts` — (신규) 단위 테스트
- `frontend/composables/usePublicRental.ts` — (수정) 비변경 `getList` 추가
- `frontend/components/subscription/PublicRentalListView.vue` — (수정) 로컬 ref + useAsyncData SSR
- `frontend/tests/components/subscription/PublicRentalListView.test.ts` — (수정) useAsyncData 핸들러 실행 모킹
- `frontend/pages/[category]/[id].vue` — (수정) 주변시설 watch→useAsyncData
- `frontend/tests/pages/detail.test.ts` — (수정) 주변시설 SSR 렌더 테스트 추가

---

## Task 1: RelatedGuides SSR 전환 (#1)

**Files:**
- Modify: `frontend/components/guide/RelatedGuides.vue` (script setup, 현재 `:50-90`)
- Modify: `frontend/pages/guide/[slug].vue:102-108`
- Test: `frontend/tests/components/guide/RelatedGuides.test.ts` (신규)

- [ ] **Step 1: 실패하는 테스트 작성**

`frontend/tests/components/guide/RelatedGuides.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref } from 'vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
vi.stubGlobal('useRuntimeConfig', () => ({ public: { apiBase: 'http://localhost:8000' } }))

// 기본 setup 모킹은 data:null을 반환하므로, 핸들러를 실제 실행하도록 오버라이드
vi.stubGlobal('useAsyncData', (_key: string, handler: () => Promise<unknown>, opts?: { default?: () => unknown }) => {
  const data = ref<unknown>(opts?.default ? opts.default() : null)
  const error = ref<unknown>(null)
  const result = { data, pending: ref(false), error, refresh: vi.fn() }
  const p = handler()
    .then((r) => { data.value = r; return result })
    .catch((e) => { error.value = e; return result })
  return Object.assign(p, result)
})

const stubs = { NuxtLink: { template: '<a><slot /></a>', props: ['to'] } }
const item = (id: number, slug: string, title: string) => ({
  id, slug, title, summary: '요약', category: 'hospital', thumbnailUrl: null,
})

beforeEach(() => vi.clearAllMocks())

describe('RelatedGuides', () => {
  it('SSR 데이터의 가이드 링크를 렌더링한다', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { items: [item(1, 'a', '가이드 A'), item(2, 'b', '가이드 B')] } })
    const wrapper = mount(RelatedGuides, { props: { category: 'hospital' }, global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).toContain('가이드 A')
    expect(wrapper.text()).toContain('가이드 B')
  })

  it('가이드가 없으면 섹션을 렌더링하지 않는다', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { items: [] } })
    const wrapper = mount(RelatedGuides, { props: { category: 'hospital' }, global: { stubs } })
    await flushPromises()
    expect(wrapper.find('section').exists()).toBe(false)
  })

  it('excludeSlug에 해당하는 가이드를 제외한다', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { items: [item(1, 'a', '가이드 A'), item(2, 'b', '가이드 B')] } })
    const wrapper = mount(RelatedGuides, { props: { category: 'hospital', excludeSlug: 'a', limit: 3 }, global: { stubs } })
    await flushPromises()
    expect(wrapper.text()).not.toContain('가이드 A')
    expect(wrapper.text()).toContain('가이드 B')
  })
})
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/components/guide/RelatedGuides.test.ts`
Expected: FAIL — 현재 `onMounted` 패칭이라 첫 렌더에 데이터가 없어 "가이드 A" 미포함, 또는 onMounted 비동기 타이밍으로 단언 실패.

- [ ] **Step 3: RelatedGuides.vue 스크립트 교체**

`frontend/components/guide/RelatedGuides.vue`의 `<script setup lang="ts"> ... </script>` 전체를 아래로 교체:

```ts
import { computed } from 'vue'
import { useGuides } from '~/composables/useGuides'
import type { GuideSummary } from '~/composables/useGuides'

const props = withDefaults(defineProps<{
  category?: string
  categories?: string[]
  excludeSlug?: string
  limit?: number
}>(), {
  limit: 3,
})

const config = useRuntimeConfig()
// Image src URLs must use the public base (not loopback) so browsers can load them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase
const { fetchGuides } = useGuides()

const asyncKey = `related-guides-${props.categories?.join('-') ?? props.category ?? 'all'}`

const { data: rawItems } = await useAsyncData<GuideSummary[]>(
  asyncKey,
  async () => {
    try {
      const data = await fetchGuides({
        ...(props.categories?.length ? { categories: props.categories } : { category: props.category }),
        limit: props.limit + (props.excludeSlug ? 1 : 0),
      })
      return data.items
    } catch {
      // 보조 콘텐츠 — 실패 시 조용히 빈 목록
      return []
    }
  },
  { default: () => [] },
)

const guides = computed(() => {
  const items = rawItems.value ?? []
  if (props.excludeSlug) {
    return items.filter(g => g.slug !== props.excludeSlug).slice(0, props.limit)
  }
  return items.slice(0, props.limit)
})
```

(`useAsyncData`/`useRuntimeConfig`는 Nuxt 자동 import — 별도 import 불필요. `ref`/`onMounted` import는 제거됨.)

- [ ] **Step 4: guide/[slug].vue의 ClientOnly 래퍼 제거**

`frontend/pages/guide/[slug].vue:102-108` 현재:

```html
        <ClientOnly>
          <RelatedGuides
            v-if="guide.category"
            :category="guide.category"
            :exclude-slug="guide.slug"
          />
        </ClientOnly>
```

교체:

```html
        <RelatedGuides
          v-if="guide.category"
          :category="guide.category"
          :exclude-slug="guide.slug"
        />
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/components/guide/RelatedGuides.test.ts`
Expected: PASS (3 passed)

- [ ] **Step 6: 커밋**

```bash
git add frontend/components/guide/RelatedGuides.vue frontend/pages/guide/[slug].vue frontend/tests/components/guide/RelatedGuides.test.ts
git commit -m "feat(frontend): RelatedGuides SSR 패칭 전환 + guide/[slug] ClientOnly 제거"
```

---

## Task 2: PublicRentalListView SSR 전환 (#2)

**Files:**
- Modify: `frontend/composables/usePublicRental.ts` (`getList` 추가 + return)
- Modify: `frontend/components/subscription/PublicRentalListView.vue` (`<script setup>` 전체)
- Test: `frontend/tests/components/subscription/PublicRentalListView.test.ts` (수정)

- [ ] **Step 1: 기존 테스트를 useAsyncData 핸들러 실행 모킹으로 갱신(실패 상태로)**

`frontend/tests/components/subscription/PublicRentalListView.test.ts` 상단 import 직후(기존 `vi.stubGlobal('usePublicRental', usePublicRental)` 다음 줄)에 추가:

```ts
// 컴포넌트가 useAsyncData(handler)로 SSR 시딩하므로 핸들러를 실제 실행시킨다
vi.stubGlobal('useAsyncData', (_key: string, handler: () => Promise<unknown>, opts?: { default?: () => unknown }) => {
  const data = ref<unknown>(opts?.default ? opts.default() : null)
  const error = ref<unknown>(null)
  const result = { data, pending: ref(false), error, refresh: vi.fn() }
  const p = handler()
    .then((r) => { data.value = r; return result })
    .catch((e) => { error.value = e; return result })
  return Object.assign(p, result)
})
```

그리고 파일 맨 위 import에 `ref`를 추가:

```ts
import { ref } from 'vue'
```

기존 "shows error block when fetch fails" 테스트를 아래로 교체(초기 SSR은 성공, 이후 필터 변경 시 실패 → 에러 블록):

```ts
  it('필터 변경 reload 실패 시 에러 블록을 표시한다', async () => {
    mockFetch.mockResolvedValueOnce({
      success: true,
      data: { items: [], pagination: { page: 1, limit: 18, total: 0, totalPages: 0 } } as PublicRentalListResponse,
    })
    const wrapper = mount(PublicRentalListView, {
      global: {
        stubs: {
          SectionBlock: { template: '<section><slot /></section>' },
          Pagination: { template: '<nav />' },
          PublicRentalCard: true,
        },
      },
    })
    await flushPromises()

    mockFetch.mockRejectedValueOnce(new Error('boom'))
    await wrapper.find('select').setValue('seoul')
    await flushPromises()

    expect(wrapper.text()).toContain('데이터를 불러오는 중 오류가 발생했습니다')
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/components/subscription/PublicRentalListView.test.ts`
Expected: FAIL — 현재 컴포넌트는 `getList` 미존재 + `onMounted` 경로라 신규 모킹/단언과 불일치.

- [ ] **Step 3: usePublicRental에 getList 추가**

`frontend/composables/usePublicRental.ts`의 `fetchList` 함수 정의 바로 다음에 추가:

```ts
  const getList = async (params: PublicRentalListQuery = {}): Promise<PublicRentalListResponse> => {
    const res = await $fetch<ApiEnvelope<PublicRentalListResponse>>(
      `${apiBase()}/api/public-rental`,
      { query: params },
    )
    if (res.success && res.data) return res.data
    return { items: [], pagination: { page: 1, limit: 18, total: 0, totalPages: 0 } }
  }
```

그리고 `return { ... }` 객체에 `getList,`를 추가(예: `fetchList,` 다음 줄):

```ts
    fetchList,
    getList,
    fetchDetail,
```

- [ ] **Step 4: PublicRentalListView.vue 스크립트 교체**

`frontend/components/subscription/PublicRentalListView.vue`의 `<script setup lang="ts"> ... </script>` 전체를 아래로 교체(`CITY_OPTIONS` 배열은 기존 값 그대로 유지):

```ts
import { ref, watch } from 'vue'
import { usePublicRental } from '~/composables/usePublicRental'
import type { PublicRentalComplex, PublicRentalType } from '~/types/publicRental'

const props = defineProps<{
  rentalTypeCode?: PublicRentalType
}>()

// 모든 광역시·도 (slug, label) — 청약 select 와 동일한 옵션셋 + 도 단위까지 포함.
const CITY_OPTIONS = [
  { slug: 'seoul', label: '서울' },
  { slug: 'busan', label: '부산' },
  { slug: 'daegu', label: '대구' },
  { slug: 'incheon', label: '인천' },
  { slug: 'gwangju', label: '광주' },
  { slug: 'daejeon', label: '대전' },
  { slug: 'ulsan', label: '울산' },
  { slug: 'sejong', label: '세종' },
  { slug: 'gyeonggi', label: '경기' },
  { slug: 'gangwon', label: '강원' },
  { slug: 'chungbuk', label: '충북' },
  { slug: 'chungnam', label: '충남' },
  { slug: 'jeonbuk', label: '전북' },
  { slug: 'jeonnam', label: '전남' },
  { slug: 'gyeongbuk', label: '경북' },
  { slug: 'gyeongnam', label: '경남' },
  { slug: 'jeju', label: '제주' },
]

const { getList } = usePublicRental()

// 로컬 상태 (SubscriptionListView SSR 패턴과 정렬)
const items = ref<PublicRentalComplex[]>([])
const total = ref(0)
const totalPages = ref(0)
const currentPage = ref(1)
const loading = ref(false)
const error = ref<string | null>(null)

const currentCity = ref<string>('')
const districtDetail = ref<string>('')
const page = ref(1)

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    const data = await getList({
      city: currentCity.value || undefined,
      district: districtDetail.value.trim() || undefined,
      rentalType: props.rentalTypeCode,
      page: page.value,
      limit: 18,
    })
    items.value = data.items
    total.value = data.pagination.total
    totalPages.value = data.pagination.totalPages
    currentPage.value = data.pagination.page
  } catch (err) {
    error.value = err instanceof Error ? err.message : '공공임대 목록 조회에 실패했습니다.'
    items.value = []
    total.value = 0
    totalPages.value = 0
  } finally {
    loading.value = false
  }
}

// 템플릿의 "다시 시도" 버튼이 호출
const reload = (): Promise<void> => load()

function goToPage(p: number) {
  page.value = p
  void load()
}

watch([currentCity, () => props.rentalTypeCode], () => {
  page.value = 1
  void load()
})

// 상세 검색 입력은 디바운스 — 타이핑마다 호출 방지.
let detailTimer: ReturnType<typeof setTimeout> | null = null
watch(districtDetail, () => {
  if (detailTimer) clearTimeout(detailTimer)
  detailTimer = setTimeout(() => {
    page.value = 1
    void load()
  }, 300)
})

// SSR: 초기 목록을 서버에서 패칭해 HTML에 포함
const { data: ssrData } = await useAsyncData(
  `public-rental-${props.rentalTypeCode ?? 'all'}`,
  () => getList({ rentalType: props.rentalTypeCode, page: 1, limit: 18 }),
)
if (ssrData.value) {
  items.value = ssrData.value.items
  total.value = ssrData.value.pagination.total
  totalPages.value = ssrData.value.pagination.totalPages
  currentPage.value = ssrData.value.pagination.page
}
```

(템플릿은 변경 없음 — `items`/`total`/`totalPages`/`currentPage`/`loading`/`error`/`reload`/`goToPage`/`currentCity`/`districtDetail`/`CITY_OPTIONS` 모두 그대로 노출됨.)

- [ ] **Step 5: 테스트 통과 확인**

Run: `npx vitest run tests/components/subscription/PublicRentalListView.test.ts`
Expected: PASS (renders cards / empty state / 필터 변경 reload 실패 → 에러 블록)

- [ ] **Step 6: 커밋**

```bash
git add frontend/composables/usePublicRental.ts frontend/components/subscription/PublicRentalListView.vue frontend/tests/components/subscription/PublicRentalListView.test.ts
git commit -m "feat(frontend): usePublicRental getList 추가 + PublicRentalListView SSR 전환"
```

---

## Task 3: 주변시설 SSR 합류 (#4)

**Files:**
- Modify: `frontend/pages/[category]/[id].vue` (`:906-944` 스크립트, `:167-170` 템플릿, `:307` import)
- Test: `frontend/tests/pages/detail.test.ts` (테스트 1건 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`frontend/tests/pages/detail.test.ts`의 `describe('DetailPage', ...)` 내부 마지막 `it(...)` 다음에 추가:

```ts
  it('주변 시설(nearby/cross)을 SSR 데이터로 렌더링', async () => {
    // key-aware: nearby-* 키는 주변시설, 그 외는 facility 응답
    ;(globalThis as any).useAsyncData = vi.fn((key: string, _handler?: () => Promise<unknown>, opts?: any) => {
      const isNearby = typeof key === 'string' && key.startsWith('nearby-')
      const data = ref(
        isNearby
          ? {
              nearby: [{ id: 'toilet-2', category: 'toilet', name: '역삼역 화장실', address: 'A', lat: 37.5, lng: 127.03 }],
              cross: [{ id: 'hospital-9', category: 'hospital', name: '강남병원', address: 'B', lat: 37.5, lng: 127.03 }],
            }
          : { success: true, data: mockFacility },
      )
      const result = { data, status: ref('success'), error: ref(null), refresh: vi.fn(), pending: ref(false) }
      void opts
      return Object.assign(Promise.resolve(result), result)
    })

    const wrapper = await mountSuspended(DetailPage, { global: { stubs: globalStubs } })

    expect(wrapper.text()).toContain('역삼역 화장실') // 동일 카테고리 반경 nearby
    expect(wrapper.text()).toContain('강남병원')       // cross-category nearby
  })
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/pages/detail.test.ts -t '주변 시설'`
Expected: FAIL — 현재 주변시설은 `watch` 기반 클라 패칭이라 SSR/마운트 렌더에 미포함, "역삼역 화장실" 단언 실패.

- [ ] **Step 3: [id].vue 주변시설 스크립트 교체**

`frontend/pages/[category]/[id].vue`의 현재 `// 주변 시설` 블록(`:906`부터 `crossFacilitiesGrouped` computed 끝 `:944`까지) 전체를 아래로 교체:

```ts
// 주변 시설 — 메인 facility가 lazy라 좌표 확보 위해 상세 1회 재패칭 후 allSettled로 SSR 합류
const { data: nearbyData, status: nearbyStatus } = await useAsyncData(
  `nearby-${category.value}-${id.value}`,
  async () => {
    const detail = await $fetch<{ success: boolean; data: FacilityDetail }>(
      `${apiBase}/api/facilities/${category.value}/${id.value}`,
    ).catch(() => null)
    const f = detail?.data
    const crossP = $fetch<{ success: boolean; data: { items: FacilityDetail[] } }>(
      `${apiBase}/api/facilities/${category.value}/${id.value}/nearby`,
    )
    const nearbyP = (f?.lat && f?.lng)
      ? $fetch<{ success: boolean; data: { items: FacilityDetail[] } }>(
          `${apiBase}/api/facilities/search`,
          {
            method: 'POST',
            body: { category: f.category, lat: f.lat, lng: f.lng, radius: 1000, page: 1, limit: 100 },
          },
        )
      : Promise.resolve(null)
    const [nearbyR, crossR] = await Promise.allSettled([nearbyP, crossP])
    return {
      nearby: nearbyR.status === 'fulfilled' ? (nearbyR.value?.data?.items ?? []) : [],
      cross: crossR.status === 'fulfilled' ? (crossR.value?.data?.items ?? []) : [],
    }
  },
  { lazy: true, default: () => ({ nearby: [] as FacilityDetail[], cross: [] as FacilityDetail[] }) },
)

const nearbyPending = computed(() => nearbyStatus.value === 'pending')

const nearbyFiltered = computed(() =>
  (nearbyData.value?.nearby ?? []).filter(f => f.id !== facility.value?.id).slice(0, 4)
)

const crossFacilitiesGrouped = computed(() => {
  const items = nearbyData.value?.cross ?? []
  if (items.length === 0) return []

  const grouped = new Map<string, Array<(typeof items)[number]>>()
  for (const item of items) {
    const list = grouped.get(item.category) ?? []
    list.push(item)
    grouped.set(item.category, list)
  }

  return Array.from(grouped.entries()).map(([cat, facilities]) => ({
    category: cat as FacilityCategory,
    meta: CATEGORY_META[cat as FacilityCategory],
    items: facilities,
  }))
})
```

- [ ] **Step 4: useFacilitySearch import 제거**

`frontend/pages/[category]/[id].vue:307`의 다음 줄을 삭제:

```ts
import { useFacilitySearch } from '~/composables/useFacilitySearch'
```

(이 파일에서 `useFacilitySearch`는 주변시설 외 사용처가 없음 — Step 3에서 destructure를 제거했으므로 import도 불필요.)

- [ ] **Step 5: DetailNearby loading 프롭 갱신**

`frontend/pages/[category]/[id].vue:167-170`을 아래로 교체:

```html
                :nearby-facilities="nearbyFiltered"
                :nearby-loading="nearbyPending"
                :cross-facilities-grouped="crossFacilitiesGrouped"
                :cross-loading="nearbyPending"
```

- [ ] **Step 6: 테스트 통과 확인**

Run: `npx vitest run tests/pages/detail.test.ts`
Expected: PASS — 신규 '주변 시설' 테스트 통과 + 기존 detail 테스트 회귀 없음.

- [ ] **Step 7: 커밋**

```bash
git add frontend/pages/[category]/[id].vue frontend/tests/pages/detail.test.ts
git commit -m "feat(frontend): [category]/[id] 주변시설 useAsyncData SSR 합류"
```

---

## Task 4: 전체 회귀 검증 + 수동 SSR 확인

**Files:** (없음 — 검증만)

- [ ] **Step 1: 프론트 lint**

Run: `cd frontend && npm run lint`
Expected: 통과(에러 0). `ref`/`onMounted` 미사용 import 잔존 시 여기서 잡힘 — 발견되면 제거 후 재실행.

- [ ] **Step 2: 프론트 전체 단위 테스트**

Run: `cd frontend && npm run test`
Expected: 전체 PASS. 실패 시 해당 테스트 즉시 수정(메모리: 기존 실패 테스트도 즉시 수정).

- [ ] **Step 3: dev 서버 기동 후 SSR HTML 수동 확인**

```bash
cd frontend && npm run dev   # 별도 터미널, port 3000
```

JS 미실행 상태(curl)에서 콘텐츠가 HTML에 포함되는지 확인:

```bash
# 가이드 상세: 관련 가이드 링크가 SSR에 포함
curl -s http://localhost:3000/guide/<실제-slug> | grep -c 'href="/guide/'
# 공공임대 목록: 카드/건수가 SSR에 포함 (단지명 또는 "건" 표기)
curl -s http://localhost:3000/public-rental/<실제-type> | grep -o '건</span>' | head
# 시설 상세: 주변 시설 섹션이 SSR에 포함
curl -s http://localhost:3000/toilet/<실제-id> | grep -c 'href="/'
```

Expected: 각 grep 결과 1 이상 — 관련 가이드 링크/공공임대 카드/주변시설 링크가 SSR HTML에 존재.
(slug/type/id는 로컬 DB의 실제 값으로 대체. 비어 있으면 `npm run db:seed`로 시드.)

- [ ] **Step 4: PR 생성**

```bash
git push -u origin <feature-branch>
gh pr create --base develop --title "SSR 누락 복구: RelatedGuides · 공공임대목록 · 주변시설" --body "frontend audit ② — #1·#2·#4. search.vue(#3)는 noindex라 별도 UX 태스크로 분리."
```

CI 통과 확인 후 머지(메모리: PR 워크플로우, ground-truth 재확인).

---

## Self-Review 결과

- **Spec coverage:** #1(Task1) · #2(Task2) · #4(Task3) 전부 매핑. #3 제외는 spec/계획 일치. 검증(단위+curl)은 Task1·2·3 단위테스트 + Task4 curl로 충족.
- **Placeholder scan:** 모든 코드 단계에 실제 코드 포함. curl의 `<실제-slug/type/id>`는 로컬 DB 의존 값으로 의도적 치환 지시(플레이스홀더 아님).
- **Type consistency:** `getList` 반환 `PublicRentalListResponse`(items + pagination{page,limit,total,totalPages}) — 컴포넌트 시딩과 일치. `nearbyData` 형태 `{nearby, cross}` — computed 읽기와 일치. `nearbyPending`(Task3 Step3 정의) → 템플릿(Step5)에서 사용 일치.
- **Out of scope:** 백엔드 `/nearby` 병합, search.vue, audit ③④⑤⑥.
