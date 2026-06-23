import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted } from 'vue'

;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).useHead = vi.fn()

;(globalThis as any).createError = (opts: any) => {
  const e = new Error(opts.statusMessage)
  ;(e as any).statusCode = opts.statusCode
  return e
}

;(globalThis as any).useRoute = vi.fn(() => ({
  params: { cltrMngNo: '2024-00001-001' },
  query: {},
}))

// useAsyncData: 핸들러를 즉시 실행해 data ref 를 채운다(페이지가 await useAsyncData 사용).
;(globalThis as any).useAsyncData = vi.fn(async (_key: string, handler: any) => ({
  data: ref(await handler()),
}))

const item = {
  id: 1, cltrMngNo: '2024-00001-001', pbctCdtnNo: 'X', plnmNo: null,
  city: '서울특별시', district: '강남구', bjdCode: '1168000000', dongName: '역삼동',
  address: '서울 강남구 역삼동 123-4', usage: '아파트', usageGroup: 'residential',
  propertyType: '주거용', dpslMtdNm: '매각', bidMethod: null, competitionMethod: null,
  bidType: null, evictionResp: null, isShare: false, thumbnailUrl: null,
  landArea: null, bldArea: 84.5,
  apslAssAmt: 980000000, minBidPrc: 686000000, failCnt: 2, bidRound: 3,
  bidBeginDtm: null, bidCloseDtm: null, orgNm: '한국자산관리공사', pvctTrgtYn: false,
  status: 'ongoing', isClosed: false,
  resultType: null, winBidPrc: null, bidRate: null, resultDate: null,
  lat: 37.5, lng: 127.04,
}

vi.mock('~/composables/useAuction', () => ({
  useAuction: () => ({
    getItemDetail: vi.fn().mockResolvedValue({
      item,
      nearby: [],
      marketCompare: { marketAvg: 1100000000, label: '역삼동', apslAssAmtForCompare: undefined },
    }),
  }),
}))

const mockSetBreadcrumbSchema = vi.fn()
const mockSetFAQSchema = vi.fn()
const mockSetDetailProvenance = vi.fn()
vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({
    setBreadcrumbSchema: mockSetBreadcrumbSchema,
    setFAQSchema: mockSetFAQSchema,
    setDetailProvenance: mockSetDetailProvenance,
  }),
}))

vi.mock('~/utils/seoConstants', () => ({
  SITE_URL: 'https://ilsangkit.co.kr',
  SITE_NAME: '일상킷',
  DEFAULT_OG_IMAGE: 'https://ilsangkit.co.kr/og.png',
}))

vi.mock('~/shared/regionSlugs', () => ({
  CITY_SLUG_MAP: { seoul: '서울' },
  DISTRICT_SLUG_MAP: { '강남구': 'gangnam' },
}))

beforeEach(() => {
  mockSetBreadcrumbSchema.mockClear()
  mockSetFAQSchema.mockClear()
  mockSetDetailProvenance.mockClear()
})

async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    {
      global: {
        stubs: {
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          Breadcrumb: { template: '<nav data-stub="breadcrumb" />' },
          PageHero: { template: '<section><component :is="titleTag || \'h1\'"><slot name="title" />{{ title }}</component></section>', props: ['eyebrow', 'title', 'description', 'stats', 'titleTag'] },
          AuctionStatusBadge: { template: '<span data-stub="status-badge" />' },
          AuctionMap: { template: '<section data-stub="auction-map" />' },
          NearbyFacilities: { template: '<div data-stub="nearby-facilities" />' },
          AdBanner: { template: '<div data-stub="ad" />' },
          CoupangBanner: { template: '<div data-stub="coupang" />' },
          DataSourceSection: { template: '<div data-stub="datasource" />' },
        },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('auction/item/[cltrMngNo].vue — 입찰정보 상세 재배치', () => {
  it('컴포넌트가 존재해야 한다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    expect(m.default).toBeDefined()
  })

  // 단일 h1 불변식: 모바일 헤더(md:hidden)가 literal h1, PageHero 는 title-tag="div" 강등.
  it('h1은 raw HTML 에서 정확히 1개(모바일 헤더)이며 주소', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    const h1s = wrapper.findAll('h1')
    expect(h1s.length).toBe(1)
    expect(h1s[0].text()).toContain('서울 강남구 역삼동 123-4')
  })

  it('입찰 정보(T1)·시세 비교(T1b)·기본정보(T3)가 모두 렌더된다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    const text = wrapper.text()
    expect(text).toContain('입찰 정보')
    expect(text).toContain('실거래가 시세 비교')
    expect(text).toContain('공매 기본정보')
  })

  it('입찰정보 섹션이 order-1, 시세비교가 order-2 클래스를 갖는다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.find('[data-test="tier-bid-history"]').classes()).toContain('order-1')
    expect(wrapper.find('[data-test="tier-price-compare"]').classes()).toContain('order-2')
  })

  it('스펙(AuctionDetailInfo) wrapper 가 order-4(멀티루트 wrapper)를 갖는다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.find('[data-test="tier-detail-info"]').classes()).toContain('order-4')
  })

  it('광고 AdBanner 4개 + 쿠팡 1개가 유지된다(개수 불변)', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    expect(wrapper.findAll('[data-stub="ad"]').length).toBe(4)
    expect(wrapper.findAll('[data-stub="coupang"]').length).toBe(1)
  })

  it('setFAQSchema 가 AUCTION_FAQ(5건)로 호출된다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    await mountSuspended(m.default)
    expect(mockSetFAQSchema).toHaveBeenCalled()
    const faqs = mockSetFAQSchema.mock.calls[0][0]
    expect(faqs).toHaveLength(5)
    expect(faqs[0]).toHaveProperty('question')
    expect(faqs[0]).toHaveProperty('answer')
  })

  it('온비드 입찰 외부 링크(onbid.co.kr)가 렌더된다', async () => {
    const m = await import('~/pages/auction/item/[cltrMngNo].vue')
    const wrapper = await mountSuspended(m.default)
    const onbidLink = wrapper.find('a[href*="onbid.co.kr"]')
    expect(onbidLink.exists()).toBe(true)
    expect(onbidLink.attributes('href')).toContain('2024-00001-001')
  })
})
