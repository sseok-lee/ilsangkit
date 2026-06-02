import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense, onErrorCaptured } from 'vue'
import DetailPage from '~/pages/public-rental/announcements/[pblancId].vue'

const mockState = {
  detail: ref<any>(null),
  loading: ref(false),
  error: ref<string | null>(null),
  fetchDetail: vi.fn(async () => mockState.detail.value),
}
vi.mock('~/composables/useRentalAnnouncements', () => ({
  useRentalAnnouncements: () => mockState,
}))

const setBreadcrumbSchema = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setBreadcrumbSchema, setItemListSchema: vi.fn() }),
}))

vi.mock('vue-router', () => ({
  useRoute: () => ({ params: { pblancId: 'PBLANC-1' } }),
}))

const useHeadMock = vi.fn()
vi.stubGlobal('useHead', useHeadMock)
const createErrorMock = vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as any).statusCode = opts.statusCode
  return err
})
vi.stubGlobal('createError', createErrorMock)

const stubs = {
  NuxtLink: { template: '<a><slot /></a>', props: ['to'] },
  AdBanner: true,
}

function makeDetail(over: Record<string, any> = {}) {
  return {
    pblancId: 'PBLANC-1', pblancNm: '강남 행복주택 입주자 모집공고',
    status: 'ongoing', suplyInsttNm: 'LH', suplyTyNm: '행복주택',
    variants: [], matchedComplexes: [],
    beginDe: null, endDe: null, ...over,
  }
}

async function mountSuspended() {
  const wrapper = mount(
    defineComponent({
      setup() {
        onErrorCaptured(() => true)
        return () => h(Suspense, null, { default: () => h(DetailPage) })
      },
    }),
    { global: { stubs, config: { errorHandler: () => {} } } },
  )
  await flushPromises()
  return wrapper
}

function lastHead() {
  const arg = useHeadMock.mock.calls.at(-1)?.[0]
  return typeof arg === 'function' ? arg() : arg
}

beforeEach(() => {
  vi.clearAllMocks()
  mockState.detail.value = null
  mockState.error.value = null
})

describe('announcements 상세 색인 위생', () => {
  it('없는/만료 공고(detail null)는 404를 던진다', async () => {
    mockState.detail.value = null
    await mountSuspended()
    expect(createErrorMock).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404 }),
    )
  })

  it('마감(closed) 공고는 robots noindex,follow + canonical 제거', async () => {
    mockState.detail.value = makeDetail({ status: 'closed' })
    await mountSuspended()
    const head = lastHead()
    expect(head.meta).toContainEqual({ name: 'robots', content: 'noindex, follow' })
    expect(head.link ?? []).toHaveLength(0)
  })

  it('진행중 공고는 indexable(robots 없음) + canonical 유지 + Breadcrumb 스키마', async () => {
    mockState.detail.value = makeDetail({ status: 'ongoing' })
    await mountSuspended()
    const head = lastHead()
    expect(head.meta.some((m: any) => m.name === 'robots')).toBe(false)
    expect(head.link).toContainEqual({ rel: 'canonical', href: 'https://ilsangkit.co.kr/public-rental/announcements/PBLANC-1' })
    expect(setBreadcrumbSchema).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ name: '강남 행복주택 입주자 모집공고' }),
      ]),
    )
  })
})
