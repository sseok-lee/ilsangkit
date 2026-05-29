import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref } from 'vue'

// Mock Nuxt globals
;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage ?? 'Error')
  ;(e as any).statusCode = opts.statusCode
  return e
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

async function mountSuspended(c: any) {
  const w = mount(
    defineComponent({ render: () => h(Suspense, null, { default: () => h(c) }) }),
    { global: { stubs } },
  )
  await flushPromises()
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
    let caughtError: unknown = null
    const origWarn = console.warn
    const origError = console.error
    // Vue catches setup errors via callWithErrorHandling → emits as console.warn
    console.warn = (...args: any[]) => {
      const msg = args.join(' ')
      if (msg.includes('Unhandled error') || msg.includes('setup')) caughtError = args
    }
    console.error = (...args: any[]) => {
      caughtError = args
    }
    // createError throws synchronously in setup — Vue catches it but the error IS created
    let thrownError: unknown = null
    const origCreateError = (globalThis as any).createError
    ;(globalThis as any).createError = (opts: any) => {
      const e = new Error(opts.statusMessage ?? 'Error')
      ;(e as any).statusCode = opts.statusCode
      thrownError = e
      return e
    }
    try {
      await mountSuspended(RankingPage)
    } catch {
      // mount may or may not throw
    }
    console.warn = origWarn
    console.error = origError
    ;(globalThis as any).createError = origCreateError
    ;(globalThis as any).useRoute = () => ({ params: { realEstateType: 'apt-sale' } })
    // Verify createError was called with statusCode 404
    expect(thrownError).toBeTruthy()
    expect((thrownError as any).statusCode).toBe(404)
  })
})
