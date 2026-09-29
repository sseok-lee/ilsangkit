import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, reactive, ref, nextTick } from 'vue'
import type { BrowseResult } from '~/types/facilityBrowse'

const state = vi.hoisted(() => ({
  route: undefined as unknown as {
    path: string
    fullPath: string
    query: Record<string, string>
  },
  regionError: undefined as unknown as { value: string | null },
  isLoaded: undefined as unknown as { value: boolean },
  useHead: vi.fn(),
}))

const mocks = vi.hoisted(() => ({
  loadRegions: vi.fn(),
  fetchBrowse: vi.fn(),
  routerPush: vi.fn(),
  markDegradedResponse: vi.fn(),
  suppressAds: vi.fn(),
}))

const regions = [
  { city: '서울특별시', district: '강남구', slug: 'gangnam', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
  { city: '부산광역시', district: '중구', slug: 'jung', lat: 35.1, lng: 129.03, bjdCode: '26110' },
]

vi.mock('vue-router', () => ({
  useRoute: () => state.route,
  useRouter: () => ({ push: mocks.routerPush }),
}))

vi.mock('~/composables/useRegions', () => ({
  useRegions: () => ({
    loadRegions: mocks.loadRegions,
    isLoaded: state.isLoaded,
    error: state.regionError,
    citiesWithDistricts: ref([
      { slug: 'seoul', name: '서울', districts: [{ slug: 'gangnam', name: '강남구', lat: 37.5172, lng: 127.0473, bjdCode: '11680' }] },
      { slug: 'busan', name: '부산', districts: [{ slug: 'jung', name: '중구', lat: 35.1, lng: 129.03, bjdCode: '26110' }] },
    ]),
    getDistrictsByCity: (city: string) =>
      city === 'seoul'
        ? [{ slug: 'gangnam', name: '강남구', lat: 37.5172, lng: 127.0473, bjdCode: '11680' }]
        : city === 'busan'
          ? [{ slug: 'jung', name: '중구', lat: 35.1, lng: 129.03, bjdCode: '26110' }]
          : [],
    findRegionBySlug: (city: string, district: string) =>
      city === 'seoul' && district === 'gangnam'
        ? regions[0]
        : city === 'busan' && district === 'jung'
          ? regions[1]
          : undefined,
    syncFromHydration: vi.fn(),
  }),
}))

vi.mock('~/composables/useFacilityBrowse', () => ({
  useFacilityBrowse: () => ({ fetchBrowse: mocks.fetchBrowse }),
}))

vi.mock('~/composables/useDegradedResponse', () => ({ markDegradedResponse: mocks.markDegradedResponse }))
vi.mock('~/composables/useAdsPolicy', () => ({ suppressAds: mocks.suppressAds }))

const testGlobal = globalThis as typeof globalThis & {
  useAsyncData: unknown
  useHead: typeof state.useHead
}

testGlobal.useAsyncData = vi.fn(async (_key: string, handler: () => Promise<unknown>, options?: { default?: () => unknown }) => {
  try {
    const value = await handler()
    return {
      data: ref(value),
      status: ref('success'),
      error: ref(null),
      refresh: vi.fn(),
      pending: ref(false),
    }
  } catch (error) {
    return {
      data: ref(options?.default?.() ?? null),
      status: ref('error'),
      error: ref(error),
      refresh: vi.fn(),
      pending: ref(false),
    }
  }
})

const grouped: BrowseResult = {
  mode: 'grouped',
  groups: [{
    category: 'parking',
    label: '공영주차장',
    unit: '시설',
    count: 3,
    items: [{ id: 'p1', category: 'parking', name: '강남 주차장', address: null, roadAddress: '서울 강남구', lat: 37.5, lng: 127, extras: {} }],
  }],
}

const listPage2: BrowseResult = {
  mode: 'list',
  category: 'parking',
  unit: '시설',
  total: 21,
  page: 2,
  totalPages: 2,
  items: [{ id: 'p21', category: 'parking', name: '2페이지 주차장', address: null, roadAddress: null, lat: null, lng: null, extras: {} }],
}

async function mountPage() {
  const page = await import('~/pages/facilities.vue')
  const wrapper = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(page.default) }) }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Pagination: { template: '<nav data-testid="pagination" />', props: ['currentPage', 'totalPages', 'hrefFor'] },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  state.route = reactive({ path: '/facilities', fullPath: '/facilities', query: {} as Record<string, string> })
  state.regionError = ref<string | null>(null)
  state.isLoaded = ref(true)
  testGlobal.useHead = state.useHead
  state.useHead.mockReset()
  mocks.loadRegions.mockResolvedValue(regions)
  mocks.fetchBrowse.mockResolvedValue(grouped)
})

describe('/facilities browse page', () => {
  it('hydrates a serialized region failure with retry even when local error is empty', async () => {
    state.isLoaded.value = false
    state.route.query = { city: 'seoul', district: 'gangnam' }
    const data = ref({ items: [] as typeof regions, error: '지역 API 실패' as string | null })
    const refresh = vi.fn(async () => { data.value = { items: regions, error: null }; state.isLoaded.value = true })
    vi.mocked(testGlobal.useAsyncData as (...args: unknown[]) => Promise<unknown>).mockImplementationOnce(async () => ({ data, error: ref(null), pending: ref(false), refresh }))
    const wrapper = await mountPage()
    expect(mocks.loadRegions).not.toHaveBeenCalled()
    expect(mocks.fetchBrowse).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('지역 API 실패')
    expect(wrapper.text()).not.toContain('지역 정보를 준비하는 중입니다')
    await wrapper.findAll('button').find(button => button.text() === '다시 시도')!.trigger('click')
    await flushPromises()
    expect(refresh).toHaveBeenCalledOnce()
    expect(mocks.fetchBrowse).toHaveBeenCalled()
    expect(wrapper.text()).toContain('강남 주차장')
  })

  it('does not fetch nationwide results before region dictionary is loaded', async () => {
    state.isLoaded.value = false
    state.route.query = { city: 'seoul', district: 'gangnam' }

    const wrapper = await mountPage()

    expect(mocks.fetchBrowse).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('지역 정보를 준비하는 중입니다')
  })

  it('keeps selected values and shows a region failure instead of treating [] as success', async () => {
    state.isLoaded.value = false
    state.regionError.value = '지역 API 실패'
    mocks.loadRegions.mockResolvedValue([])
    state.route.query = { city: 'seoul', district: 'gangnam' }

    const wrapper = await mountPage()

    expect(mocks.fetchBrowse).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('지역 API 실패')
    expect(wrapper.find('select[aria-label="시·도 선택"]').element.value).toBe('seoul')
  })

  it('renders grouped browse data for a valid region', async () => {
    state.route.query = { city: 'seoul', district: 'gangnam' }

    const wrapper = await mountPage()

    expect(mocks.fetchBrowse).toHaveBeenCalledWith(expect.objectContaining({ city: 'seoul', district: 'gangnam', category: '' }), undefined)
    expect(wrapper.text()).toContain('공영주차장')
    expect(wrapper.text()).toContain('강남 주차장')
  })

  it('renders list page 2 from a direct URL', async () => {
    mocks.fetchBrowse.mockResolvedValue(listPage2)
    state.route.query = { city: 'seoul', district: 'gangnam', category: 'parking', page: '2' }

    const wrapper = await mountPage()

    expect(mocks.fetchBrowse).toHaveBeenCalledWith(expect.objectContaining({ category: 'parking', page: 2 }), undefined)
    expect(wrapper.text()).toContain('2페이지 주차장')
  })

  it('shows empty results separately from fetch failures', async () => {
    mocks.fetchBrowse.mockResolvedValue({ mode: 'grouped', groups: [] })
    state.route.query = { city: 'seoul', district: 'gangnam' }

    const empty = await mountPage()
    expect(empty.text()).toContain('조건에 맞는 생활시설이 없습니다')

    vi.resetModules()
    state.route.query = { city: 'seoul', district: 'gangnam' }
    mocks.fetchBrowse.mockRejectedValue(new Error('adapter failed'))
    const failed = await mountPage()
    expect(failed.text()).toContain('생활시설 정보를 불러오지 못했습니다')
    expect(failed.text()).not.toContain('조건에 맞는 생활시설이 없습니다')
  })

  it('does not fetch when city and district slugs do not belong together', async () => {
    state.route.query = { city: 'seoul', district: 'jung' }

    const wrapper = await mountPage()

    expect(mocks.fetchBrowse).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('선택한 지역 조합을 찾을 수 없습니다')
  })

  it('catches overlong q without throwing an SSR 500 and keeps the input editable', async () => {
    state.route.query = { city: 'seoul', district: 'gangnam', q: '가'.repeat(101) }

    const wrapper = await mountPage()

    expect(mocks.fetchBrowse).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('100자')
    expect((wrapper.find('input[aria-label="생활시설 검색어"]').element as HTMLInputElement).value).toHaveLength(101)
  })

  it('keeps the latest route response when A to B responses resolve out of order', async () => {
    let resolveA!: (value: BrowseResult) => void
    let resolveB!: (value: BrowseResult) => void
    state.route.query = {}
    const wrapper = await mountPage()

    mocks.fetchBrowse
      .mockImplementationOnce(() => new Promise<BrowseResult>((resolve) => { resolveA = resolve }))
      .mockImplementationOnce(() => new Promise<BrowseResult>((resolve) => { resolveB = resolve }))

    state.route.query = { city: 'seoul', district: 'gangnam' }
    await nextTick()
    state.route.query = { city: 'busan', district: 'jung' }
    await nextTick()

    resolveB({ mode: 'grouped', groups: [{ ...grouped.groups[0], label: '부산 주차장', items: [{ ...grouped.groups[0].items[0], id: 'b1', name: '부산 최신' }] }] })
    await flushPromises()
    resolveA(grouped)
    await flushPromises()

    expect(wrapper.text()).toContain('부산 최신')
    expect(wrapper.text()).not.toContain('강남 주차장')
  })

  it('validates submitted long q before router.push', async () => {
    state.route.query = { city: 'seoul', district: 'gangnam' }
    const wrapper = await mountPage()
    await wrapper.find('input[aria-label="생활시설 검색어"]').setValue('나'.repeat(101))
    await wrapper.find('form').trigger('submit')

    expect(mocks.routerPush).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('100자')
  })

  it('sets noindex follow head without canonical or structured data', async () => {
    state.route.query = { city: 'seoul', district: 'gangnam' }
    await mountPage()

    expect(state.useHead).toHaveBeenCalledWith(expect.objectContaining({
      meta: expect.arrayContaining([{ name: 'robots', content: 'noindex, follow' }]),
    }))
    expect(JSON.stringify(state.useHead.mock.calls)).not.toContain('canonical')
  })
})
