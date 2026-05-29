import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, onErrorCaptured } from 'vue'

// Mock Nuxt globals — createError throws synchronously so the page's
// `throw createError(...)` short-circuits at the call site, guaranteeing the
// statusCode-bearing error surfaces before any render (and is then captured by
// the error boundary in mountSuspended). Real Nuxt returns and the caller
// throws; throwing here yields equivalent control flow for the test.
;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage ?? 'Error')
  ;(e as any).statusCode = opts.statusCode
  throw e
}

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: vi.fn(),
    setItemListSchema: vi.fn(),
    setDatasetSchema: vi.fn(),
    setFAQSchema: vi.fn(),
  }),
}))
vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'x',
}))
vi.mock('~/utils/dataSource', () => ({
  REAL_ESTATE_DATA_SOURCE: { name: '국토교통부', url: 'x' },
}))

const newHighPayload = {
  items: [
    {
      buildingName: '래미안대치팰리스',
      city: '서울특별시',
      district: '강남구',
      bjdCode: '11680',
      areaBucket: 85,
      curMax: 350000,
      histMax: 320000,
      risePct: 9.38,
      priorCnt: 5,
      curYm: 202603,
    },
  ],
  asOfYm: 202603,
}

;(globalThis as any).$fetch = vi.fn(() =>
  Promise.resolve({ success: true, data: newHighPayload }),
)
;(globalThis as any).useApiBase = () => ''
;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })

import NewHighPage from '~/pages/real-estate/new-high/[realEstateType].vue'

const stubs = {
  HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  SectionBlock: {
    template: '<div><slot/></div>',
    props: ['heading'],
  },
  DataSourceCard: { template: '<div />' },
}

// Mount the page inside a Suspense + error boundary. If the page's async setup
// throws (e.g. createError 404), we capture it via onErrorCaptured and reject so
// callers can consume the rejection with expect(...).rejects — leaving no
// unhandled rejection that would make vitest exit non-zero.
async function mountSuspended(c: any) {
  let captured: unknown = null
  const boundary = defineComponent({
    setup(_props, { slots }) {
      onErrorCaptured((err) => {
        // Keep only the first error (the setup throw). Subsequent render errors
        // from the half-mounted component must not overwrite it.
        if (captured === null) captured = err
        return false // stop propagation so it doesn't bubble as unhandled
      })
      return () => h(Suspense, null, { default: () => slots.default?.() })
    },
  })
  const w = mount(boundary, {
    slots: { default: () => h(c) },
    global: { stubs },
  })
  await flushPromises()
  if (captured) throw captured
  return w
}

beforeEach(() => {
  ;(globalThis as any).useAsyncData = vi.fn((_k: string, fn: any) => {
    const data = ref(null)
    const p: any = Promise.resolve()
      .then(async () => {
        data.value = await fn()
      })
      .then(() => ({ data }))
    p.data = data
    return p
  })
  // Reset route to valid type before each test
  ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })
})

describe('real-estate/new-high/[realEstateType]', () => {
  it('신고가 단지명을 SSR 렌더하고 단지 상세로 링크', async () => {
    const w = await mountSuspended(NewHighPage)
    expect(w.text()).toContain('래미안대치팰리스')
    expect(w.html()).toContain('/real-estate/apt-sale/')
  })

  it('"기준" 문구를 렌더한다', async () => {
    const w = await mountSuspended(NewHighPage)
    expect(w.text()).toContain('기준')
  })

  it('asOfYm을 YYYY.MM 형식으로 표시한다', async () => {
    const w = await mountSuspended(NewHighPage)
    expect(w.text()).toContain('2026.03')
  })

  it('apt-rent 같은 비매매 타입은 404 에러를 throw한다', async () => {
    ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-rent' } })
    try {
      await expect(mountSuspended(NewHighPage)).rejects.toMatchObject({ statusCode: 404 })
    } finally {
      ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })
    }
  })

  it('완전히 알 수 없는 타입도 404 에러를 throw한다', async () => {
    ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'bogus' } })
    try {
      await expect(mountSuspended(NewHighPage)).rejects.toMatchObject({ statusCode: 404 })
    } finally {
      ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })
    }
  })
})
