import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, Suspense } from 'vue'

const fetchMock = vi.fn()
const useHeadMock = vi.fn()
const navigateToMock = vi.fn()
const responseHeader = ref('')

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
  vi.stubGlobal('navigateTo', navigateToMock)
  vi.stubGlobal('useRequestEvent', () => ({}))
  responseHeader.value = ''
  vi.stubGlobal('useResponseHeader', () => responseHeader)
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
  it('redirects a one-source area to the source detail with area return context', async () => {
    fetchMock.mockResolvedValue({ success: true, data: detail })

    await mountPage()

    expect(navigateToMock).toHaveBeenCalledWith(
      expect.stringMatching(/^\/trash\/6567#from=/),
      { redirectCode: 302, replace: true }
    )
    const target = navigateToMock.mock.calls[0][0] as string
    expect(decodeURIComponent(target.split('#from=')[1])).toBe('/trash?areaId=101')
  })

  it('redirects zero or multiple-source areas to the area-filtered source list', async () => {
    fetchMock.mockResolvedValue({ success: true, data: { ...detail, schedules: [], indexEligible: false } })

    await mountPage()

    expect(navigateToMock).toHaveBeenCalledWith('/trash?areaId=101', { redirectCode: 302, replace: true })

    vi.resetModules()
    navigateToMock.mockReset()
    fetchMock.mockResolvedValue({
      success: true,
      data: { ...detail, schedules: [...detail.schedules, { ...detail.schedules[0], schedule: { ...detail.schedules[0].schedule, id: 9999 } }] },
    })

    await mountPage()
    expect(navigateToMock).toHaveBeenCalledWith('/trash?areaId=101', { redirectCode: 302, replace: true })
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

  it('동 상세 UI를 렌더하지 않는 redirect-only 페이지다', async () => {
    fetchMock.mockResolvedValue({ success: true, data: detail })
    const wrapper = await mountPage()
    expect(wrapper.find('h1').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('배출 일정')
  })
})

describe('/trash/areas/:areaId 광고 배치', () => {
  it('redirect-only 페이지라 광고 UI를 싣지 않는다', () => {
    const areaSource = readFileSync(resolve(process.cwd().endsWith('/frontend') ? process.cwd() : join(process.cwd(), 'frontend'), 'pages/trash/areas/[areaId].vue'), 'utf8')
    expect(areaSource).not.toContain('<AdBanner')
    expect(areaSource).toContain('await navigateTo(target, { redirectCode: 302, replace: true })')
    expect(areaSource).toContain("useResponseHeader('cache-control').value = 'no-store'")
  })
})
