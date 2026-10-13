// frontend/tests/pages/adsSuppression.test.ts
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { defineComponent, h, Suspense } from 'vue'
import { parse as parseSfc } from '@vue/compiler-sfc'
import { parse as parseTemplate, type ElementNode, type TemplateChildNode } from '@vue/compiler-dom'

const root = process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend')
const read = (p: string) => readFileSync(resolve(root, p), 'utf8')

function templateElements(file: string): ElementNode[] {
  const { descriptor } = parseSfc(read(file))
  const ast = parseTemplate(descriptor.template?.content ?? '')
  const result: ElementNode[] = []

  function visit(nodes: TemplateChildNode[]) {
    for (const node of nodes) {
      if (node.type !== 1) continue
      result.push(node)
      visit(node.children)
    }
  }

  visit(ast.children)
  return result
}

function directiveValue(node: ElementNode, name: string): string | undefined {
  const directive = node.props.find(prop => prop.type === 7 && prop.name === name)
  return directive?.type === 7 ? directive.exp?.loc.source : undefined
}

const pages: [string, RegExp][] = [
  ['pages/[city]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*isNoindex\.value\s*\)/],
  ['pages/[city]/[district]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*isNoindex\.value\s*\)/],
  ['pages/real-estate/[realEstateType]/[city]/[district]/index.vue', /suppressAds\(\s*fetchFailed\.value\s*\|\|\s*totalComplexes\.value === 0\s*\)/],
  ['components/subscription/SubscriptionListView.vue', /suppressAds\(\s*filtered\.value\s*\|\|\s*failed\.value\s*\)/],
]

describe('degraded/noindex 페이지는 reactive로 광고를 억제한다', () => {
  it('real-estate detail은 setup에서 캡처한 ads suppression ref를 reactive로 갱신한다', () => {
    const src = read('pages/real-estate/[realEstateType]/[city]/[district]/[buildingName].vue')
    expect(src).toContain("const adsSuppressed = useState<boolean>('ads:suppressed', () => false)")
    expect(src).toContain('watchEffect(')
    expect(src).toContain('adsSuppressed.value = fetchFailed.value || noindex.value')
    expect(src).not.toContain("import { suppressAds } from '~/composables/useAdsPolicy'")
  })

  it.each(pages)('%s', (p, re) => {
    const src = read(p)
    expect(src).toContain("import { suppressAds } from '~/composables/useAdsPolicy'")
    expect(src).toContain('watchEffect(')
    expect(src).toMatch(re)
  })
})

describe('subscription list 광고 슬롯 생명주기', () => {
  it('필터/실패 시 두 인페이지 광고 슬롯을 unmount하고 기본 상태에서만 렌더한다', () => {
    const src = read('components/subscription/SubscriptionListView.vue')
    const nodes = templateElements('components/subscription/SubscriptionListView.vue')
    const adBanners = nodes.filter(node => node.tag === 'AdBanner')
    const affiliateBanners = nodes.filter(node => node.tag === 'AffiliateBanner')

    expect(src).toContain('const showAds = computed(() => !filtered.value && !failed.value)')
    expect(adBanners).toHaveLength(2)
    expect(src.match(/<div v-if="showAds" class="ad-slot">\s*<AdBanner \/>/g)).toHaveLength(2)
    expect(affiliateBanners).toHaveLength(1)
    expect(directiveValue(affiliateBanners[0], 'if')).toBe('showAds')
    expect(src).toContain('await loadMore()')
    expect(src).not.toContain(':key="page"')
  })
})

describe('trash region 광고 슬롯 생명주기', () => {
  it('query/error/unresolved/empty trash states suppress the region ad slot while keeping the normal slot', () => {
    const src = read('pages/[city]/[district]/[category].vue')

    expect(src).toContain('<AdBanner v-if="showRegionAd" />')
    expect(src).toContain("import { shouldShowTrashRegionAd } from '~/utils/trashRegionAds'")
    expect(src).toContain('const showRegionAd = computed(() => shouldShowTrashRegionAd({')
    expect(src).toContain('hasQuery: Object.keys(route.query).length > 0')
    expect(src).toContain('coverage: wasteAreaQuery.value.coverage')
    expect(src).toContain('wasteAreaItemCount: displayWasteAreaList.value.items.length')
    expect(src).toContain('wasteScheduleError: wasteLoadError.value')
  })
})


const regionAdHarness = vi.hoisted(() => ({
  route: {
    path: '/seoul/gangnam/trash',
    fullPath: '/seoul/gangnam/trash',
    params: { city: 'seoul', district: 'gangnam', category: 'trash' },
    query: {} as Record<string, string>,
  },
  runtimeConfig: {
    public: {
      apiBase: 'http://localhost:8000',
      adsEnabled: true,
      wasteAreaDiscoveryEnabled: true,
    },
  },
  wasteAreaItems: [
    {
      areaId: 101,
      name: '역삼1동',
      city: '서울특별시',
      district: '강남구',
      href: '/trash/areas/101',
      scheduleCount: 2,
      indexEligible: true,
      contentUpdatedAt: '2026-09-28T00:00:00.000Z',
    },
  ],
  wasteAreaReject: false,
  wasteScheduleItems: [
    {
      id: 6567,
      city: '서울특별시',
      district: '강남구',
      targetRegion: '역삼1동',
      emissionPlace: '문전 배출',
      details: {
        livingWaste: { dayOfWeek: '월', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투' },
      },
    },
  ],
  facilityItems: [
    {
      id: 'toilet-1',
      name: '강남역 공중화장실',
      category: 'toilet',
      address: '서울특별시 강남구 강남대로',
      roadAddress: '서울특별시 강남구 강남대로',
      city: '서울특별시',
      district: '강남구',
      lat: 37.5,
      lng: 127.0,
    },
  ],
}))

vi.mock('vue-router', () => ({ useRoute: () => regionAdHarness.route }))
vi.mock('~/composables/useRegions', () => ({
  CITY_SLUG_MAP: { seoul: '서울특별시' },
  useRegions: () => ({
    loadRegions: vi.fn(async () => [{ slug: 'seoul', name: '서울특별시', districts: [{ slug: 'gangnam', name: '강남구' }] }]),
    syncFromHydration: vi.fn(),
    getCityName: () => '서울특별시',
    getDistrictName: () => '강남구',
    getDistrictsByCity: () => [{ slug: 'gangnam', name: '강남구' }],
  }),
}))
vi.mock('~/composables/useRegionFacilities', () => ({
  useRegionFacilities: () => ({
    facilities: { value: [] },
    loading: { value: false },
    error: { value: null },
    total: { value: 0 },
    totalPages: { value: 1 },
    loadRegionFacilities: vi.fn(async () => ({
      items: regionAdHarness.facilityItems,
      total: regionAdHarness.facilityItems.length,
      totalPages: 1,
    })),
    fetchFacilities: vi.fn(async () => undefined),
  }),
}))
vi.mock('~/composables/useWasteSchedule', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/composables/useWasteSchedule')>()
  return {
    ...actual,
    useWasteSchedule: () => ({
      getSchedules: vi.fn(async () => ({
        schedules: actual.transformToRegionSchedules({
          items: regionAdHarness.wasteScheduleItems,
          total: regionAdHarness.wasteScheduleItems.length,
          page: 1,
          totalPages: 1,
        }).schedules,
        total: regionAdHarness.wasteScheduleItems.length,
        totalPages: 1,
        contact: null,
      })),
      isLoading: { value: false },
    }),
  }
})
vi.mock('~/composables/useWasteAreas', () => ({
  useWasteAreas: () => ({
    list: vi.fn(async () => {
      if (regionAdHarness.wasteAreaReject) throw new Error('waste area unavailable')
      return {
        generationId: 'g1',
        items: regionAdHarness.wasteAreaItems,
        total: regionAdHarness.wasteAreaItems.length,
        page: 1,
        totalPages: 1,
        unresolved: { count: 0, href: null },
      }
    }),
  }),
}))
vi.mock('~/composables/useFacilityMeta', () => ({
  useFacilityMeta: () => ({ setRegionMeta: vi.fn(), setWasteScheduleDetailMeta: vi.fn() }),
}))
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema: vi.fn(), setItemListSchema: vi.fn(), setWasteScheduleSchema: vi.fn() }),
}))
vi.mock('~/composables/useDegradedResponse', () => ({ markDegradedResponse: vi.fn() }))

function resetRegionAdHarness() {
  regionAdHarness.route.path = '/seoul/gangnam/trash'
  regionAdHarness.route.fullPath = '/seoul/gangnam/trash'
  regionAdHarness.route.params = { city: 'seoul', district: 'gangnam', category: 'trash' }
  regionAdHarness.route.query = {}
  regionAdHarness.runtimeConfig.public.adsEnabled = true
  regionAdHarness.runtimeConfig.public.wasteAreaDiscoveryEnabled = true
  regionAdHarness.wasteAreaItems = [
    {
      areaId: 101,
      name: '역삼1동',
      city: '서울특별시',
      district: '강남구',
      href: '/trash/areas/101',
      scheduleCount: 2,
      indexEligible: true,
      contentUpdatedAt: '2026-09-28T00:00:00.000Z',
    },
  ]
  regionAdHarness.wasteAreaReject = false
  regionAdHarness.wasteScheduleItems = [
    {
      id: 6567,
      city: '서울특별시',
      district: '강남구',
      targetRegion: '역삼1동',
      emissionPlace: '문전 배출',
      details: {
        livingWaste: { dayOfWeek: '월', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투' },
      },
    },
  ]
}

async function mountRegionAdPage() {
  vi.stubGlobal('useRuntimeConfig', () => regionAdHarness.runtimeConfig)
  vi.stubGlobal('useApiBase', () => 'http://localhost:8000')
  vi.stubGlobal('definePageMeta', vi.fn())
  vi.stubGlobal('createError', (opts: { statusCode: number; statusMessage: string }) => Object.assign(new Error(opts.statusMessage), opts))
  vi.stubGlobal('navigateTo', vi.fn(async () => undefined))
  vi.stubGlobal('useHead', vi.fn())
  vi.stubGlobal('$fetch', vi.fn(async (request: string) => {
    if (request.includes('/api/waste-schedules')) {
      return {
        success: true,
        data: {
          items: regionAdHarness.wasteScheduleItems,
          total: regionAdHarness.wasteScheduleItems.length,
          page: 1,
          totalPages: 1,
        },
      }
    }
    return {
      success: true,
      data: {
        count: regionAdHarness.facilityItems.length,
        countDiff: 0,
        highlights: [],
        nearbyDistricts: [],
        lastSyncedAt: '2026-09-28T00:00:00.000Z',
      },
    }
  }))
  vi.stubGlobal('useAsyncData', async (_key: unknown, handler: () => Promise<unknown> | unknown) => {
    const result = {
      data: { value: null as unknown },
      error: { value: null as unknown },
      pending: { value: false },
      refresh: vi.fn(async () => undefined),
    }
    try {
      result.data.value = await handler()
    } catch (error) {
      result.error.value = error
    }
    return result
  })

  const Page = (await import('~/pages/[city]/[district]/[category].vue')).default
  const wrapper = mount(defineComponent({
    render() {
      return h(Suspense, null, { default: () => h(Page) })
    },
  }), {
    global: {
      stubs: {
        Breadcrumb: { template: '<nav />' },
        SectionBlock: { template: '<section><slot /></section>' },
        DistrictSummaryCard: { template: '<div />' },
        NearbyDistrictsNav: { template: '<div />' },
        HospitalDepartmentFilter: { template: '<div />' },
        WasteAreaList: { template: '<section data-test="waste-area-list" />' },
        RegionTrashSchedule: { template: '<section data-test="waste-schedule-list" />' },
        RegionFacilitiesGrid: { template: '<section data-test="facility-list" />' },
        RegionRelatedCategories: { template: '<section />' },
        DataSourceSection: { template: '<section />' },
        AdBanner: { template: '<aside data-test="region-ad-slot" />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
      },
    },
  })
  await flushPromises()
  await new Promise(resolve => setTimeout(resolve, 0))
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  resetRegionAdHarness()
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('trash region mounted ad slot behavior', () => {
  it.each([
    ['query page state', () => { regionAdHarness.route.query = { page: '2' } }],
    ['area API error state', () => { regionAdHarness.wasteAreaReject = true }],
    ['unresolved source mode', () => { regionAdHarness.route.query = { coverage: 'unresolved' } }],
    ['empty area result', () => { regionAdHarness.wasteAreaItems = [] }],
  ] as const)('suppresses the actual AdBanner slot for %s with ads enabled', async (_label, arrange) => {
    arrange()

    const wrapper = await mountRegionAdPage()

    expect(wrapper.find('[data-test="region-ad-slot"]').exists()).toBe(false)
  })

  it('renders the actual AdBanner slot for a non-empty eligible trash area page with ads enabled', async () => {
    const wrapper = await mountRegionAdPage()

    expect(wrapper.find('[data-test="region-ad-slot"]').exists()).toBe(true)
  })

  it('renders the actual AdBanner slot for a non-trash region page with ads enabled', async () => {
    regionAdHarness.route.path = '/seoul/gangnam/toilet'
    regionAdHarness.route.fullPath = '/seoul/gangnam/toilet'
    regionAdHarness.route.params = { city: 'seoul', district: 'gangnam', category: 'toilet' }

    const wrapper = await mountRegionAdPage()

    expect(wrapper.find('[data-test="region-ad-slot"]').exists()).toBe(true)
  })
})
