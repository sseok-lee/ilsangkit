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

const hotspotPayload = {
  sale: {
    rising: [
      {
        citySlug: 'seoul',
        city: '서울',
        districtSlug: 'gangnam-gu',
        district: '강남구',
        pricePerPyeong: 9000,
        changePct: 3.2,
        txnCount: 40,
        volumeChangePct: 12,
      },
    ],
    falling: [],
    active: [],
  },
  jeonse: { rising: [], falling: [], active: [] },
  wolse: { active: [] },
}

;(globalThis as any).$fetch = vi.fn(() =>
  Promise.resolve({ success: true, data: hotspotPayload }),
)
;(globalThis as any).useApiBase = () => ''
;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })

vi.mock('~/composables/useRealEstate', () => ({
  useRealEstate: () => ({
    getComplexList: vi.fn(() =>
      Promise.resolve({
        items: [
          {
            buildingName: '래미안',
            bjdCode: '11680',
            city: '서울',
            district: '강남구',
            transactionCount: 30,
            latestPrice: 250000,
          },
        ],
        total: 1,
        page: 1,
        totalPages: 1,
      }),
    ),
  }),
}))

import RankingPage from '~/pages/real-estate/ranking/[realEstateType].vue'

const stubs = {
  HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
  HotspotCard: {
    template: '<div class="hotspot-card"><slot/></div>',
    props: ['signal', 'regions', 'propertyType', 'txnType'],
  },
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
})

describe('real-estate/ranking/[realEstateType]', () => {
  it('거래량 TOP 단지를 SSR 렌더하고 단지 상세로 링크', async () => {
    const w = await mountSuspended(RankingPage)
    expect(w.text()).toContain('래미안')
    expect(w.html()).toContain('/real-estate/apt-sale/seoul/gangnam-gu')
  })

  it('유효하지 않은 타입은 404 에러를 throw한다', async () => {
    ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'bogus' } })
    try {
      // mountSuspended rethrows the captured setup error → expect.rejects consumes it
      await expect(mountSuspended(RankingPage)).rejects.toMatchObject({ statusCode: 404 })
    } finally {
      ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })
    }
  })
})
