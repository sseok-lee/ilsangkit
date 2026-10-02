import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'

const fetchMock = vi.fn()
const useHeadMock = vi.fn()

const detail = {
  generationId: 'g1',
  area: {
    areaId: 101,
    name: '역삼1동',
    city: '서울특별시',
    district: '강남구',
    href: '/trash/areas/101',
    matchReason: 'region',
    scheduleCount: 2,
    conditionalCount: 1,
    summary: '조건별 일정 포함',
    dataDate: '2026-09-20T00:00:00.000Z',
  },
  schedules: [
    {
      schedule: {
        id: 6567,
        city: '서울특별시',
        district: '강남구',
        targetRegion: '역삼1동+역삼2동',
        emissionPlace: '문전 배출',
        sourceUrl: 'https://example.go.kr/waste',
        details: {
          livingWaste: { dayOfWeek: '월+수+금', beginTime: '18:00', endTime: '22:00', method: '종량제 봉투' },
          manageDepartment: '청소행정과',
          managePhone: '02-3423-1234567890',
          dataCreatedDate: '2026-09-20',
        },
      },
      scope: 'conditional',
      conditionText: '역삼1동 공동주택 제외',
      evidence: [],
    },
  ],
  unresolved: { count: 1, href: '/trash?coverage=unresolved&city=서울특별시&district=강남구' },
  indexEligible: true,
  indexReason: 'verified',
  contentUpdatedAt: '2026-09-28T00:00:00.000Z',
  predecessorOrSuccessorLinks: [{ name: '이전 안내', href: '/trash/areas/100' }],
}

beforeEach(() => {
  vi.resetModules()
  fetchMock.mockReset()
  useHeadMock.mockReset()
  vi.stubGlobal('$fetch', fetchMock)
  vi.stubGlobal('useApiBase', () => '/proxy')
  vi.stubGlobal('useRoute', () => ({ path: '/trash/areas/101', params: { areaId: '101' }, query: {}, fullPath: '/trash/areas/101' }))
  vi.stubGlobal('useHead', useHeadMock)
  vi.stubGlobal('createError', (opts: { statusCode: number; statusMessage: string }) => Object.assign(new Error(opts.statusMessage), opts))
  vi.stubGlobal('useAsyncData', async (_key: string, handler: () => Promise<unknown>) => {
    const result = { data: ref(null as unknown), error: ref(null as unknown), status: ref('success'), pending: ref(false), refresh: vi.fn() }
    try {
      result.data.value = await handler()
    } catch (error) {
      result.error.value = error
    }
    return result
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function mountPage(capturedErrors: unknown[] = []) {
  const Page = (await import('~/pages/trash/areas/[areaId].vue')).default
  const wrapper = mount(defineComponent({
    render() {
      return h(Suspense, null, { default: () => h(Page) })
    },
  }), {
    global: {
      stubs: {
        Breadcrumb: { template: '<nav />' },
        PageHead: { props: ['title', 'description'], template: '<header><h1>{{ title }}</h1><p>{{ description }}</p><slot name="breadcrumb" /><slot /></header>' },
        SectionBlock: { props: ['heading', 'subtext'], template: '<section><h2>{{ heading }}</h2><slot /></section>' },
        DataSourceSection: { template: '<div />' },
        ClientOnly: { template: '<slot />' },
        NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' },
        WasteScheduleContent: { props: ['schedule', 'conditionText'], template: '<article><a :href="`/trash/${schedule.id}`">원문 보기</a>{{ conditionText }} {{ schedule.emissionPlace }}</article>' },
      },
      config: {
        errorHandler: (error: unknown) => {
          capturedErrors.push(error)
        },
        warnHandler: () => {},
      },
    },
  })
  await new Promise(resolve => setTimeout(resolve, 0))
  return wrapper
}

describe('/trash/areas/:areaId', () => {
  it('renders area-owned title, conditions, source links, and backend related link shape', async () => {
    fetchMock.mockResolvedValue({ success: true, data: detail })

    const wrapper = await mountPage()

    expect(wrapper.get('h1').text()).toContain('역삼1동')
    expect(wrapper.text()).toContain('역삼1동 공동주택 제외')
    expect(wrapper.text()).toContain('문전 배출')
    expect(wrapper.get('a[href="/trash/6567"]').text()).toContain('원문 보기')
    expect(wrapper.get('a[href="/trash/areas/100"]').text()).toContain('이전 안내')
    expect(wrapper.text()).not.toContain('역삼2동 쓰레기 배출 안내')
  })

  it('marks known areas with no schedules as noindex but keeps a 200 page body', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { ...detail, schedules: [], indexEligible: false } })

    const wrapper = await mountPage()
    const head = useHeadMock.mock.calls.at(-1)?.[0]

    expect(wrapper.text()).toContain('확인된 배출 일정이 없습니다')
    expect(head.value.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
  })

  it('uses source dataDate for the visible source date instead of contentUpdatedAt lastmod', async () => {
    fetchMock.mockResolvedValue({ success: true, data: detail })

    const wrapper = await mountPage()

    expect(wrapper.text()).toContain('2026-09-20')
    expect(wrapper.text()).not.toContain('2026-09-28')
  })

  it('throws safe status errors for bad id and backend missing/gone/unavailable', async () => {
    const errors: unknown[] = []
    vi.stubGlobal('useRoute', () => ({ path: '/trash/areas/abc', params: { areaId: 'abc' }, query: {}, fullPath: '/trash/areas/abc' }))
    await mountPage(errors)
    expect(errors[0]).toMatchObject({ statusCode: 400 })

    vi.resetModules()
    vi.stubGlobal('useRoute', () => ({ path: '/trash/areas/101', params: { areaId: '101' }, query: {}, fullPath: '/trash/areas/101' }))
    fetchMock.mockRejectedValueOnce({ statusCode: 404 })
    errors.length = 0
    await mountPage(errors)
    expect(errors[0]).toMatchObject({ statusCode: 404 })

    vi.resetModules()
    fetchMock.mockRejectedValueOnce({ statusCode: 410 })
    errors.length = 0
    await mountPage(errors)
    expect(errors[0]).toMatchObject({ statusCode: 410 })

    vi.resetModules()
    fetchMock.mockRejectedValueOnce({ statusCode: 503 })
    errors.length = 0
    await mountPage(errors)
    expect(errors[0]).toMatchObject({ statusCode: 503 })
  })

  it('흰색 평면형: 정렬 컨테이너·평면 섹션이고 hex 클래스가 없다', async () => {
    fetchMock.mockResolvedValue({ success: true, data: detail })
    const wrapper = await mountPage()
    expect(wrapper.findAll('h1')).toHaveLength(1)
    expect(wrapper.html()).not.toMatch(/-\[#[0-9a-fA-F]{3,8}\]|max-w-\[1120px\]/)
    expect(wrapper.find('main').exists()).toBe(false)
  })
})
