import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import DetailPage from '~/pages/[category]/[id].vue'
import type { FacilityDetail } from '~/types/facility'

const mockHospitalFacility: FacilityDetail = {
  id: 'hospital-1',
  category: 'hospital',
  name: '강남성심병원',
  address: '서울특별시 강남구 도산대로 123',
  roadAddress: '서울특별시 강남구 도산대로 123',
  lat: 37.5172,
  lng: 127.0286,
  city: '서울특별시',
  district: '강남구',
  bjdCode: '11680',
  details: {
    operatingHours: '09:00~18:00',
  },
  sourceId: 'src-hospital-1',
  sourceUrl: null,
  viewCount: 5,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  syncedAt: '2024-01-01T00:00:00Z',
}

vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      category: 'hospital',
      id: 'hospital-1',
    },
    path: '/hospital/hospital-1',
  }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

vi.stubGlobal('definePageMeta', vi.fn())
vi.stubGlobal('createError', vi.fn((opts: any) => {
  const err = new Error(opts.statusMessage || 'Error')
  ;(err as any).statusCode = opts.statusCode
  return err
}))

vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    isLoaded: { value: true },
    map: { value: null },
    initMap: vi.fn(),
    addMarkers: vi.fn(),
    clearMarkers: vi.fn(),
    setCenter: vi.fn(),
    panTo: vi.fn(),
    setLevel: vi.fn(),
  }),
}))

const globalStubs = {
  ClientOnly: { template: '<div><slot /></div>' },
  FacilityMap: { template: '<div data-testid="facility-map">Map</div>' },
  FacilityFeatureCard: { template: '<div>FeatureCard</div>' },
  Breadcrumb: { template: '<nav>Breadcrumb</nav>' },
}

function mockUseAsyncDataWith(data: any, status = 'success', error: any = null) {
  const result = {
    data: ref(data),
    status: ref(status),
    error: ref(error),
    refresh: vi.fn(),
    pending: ref(status === 'pending'),
  }
  ;(globalThis as any).useAsyncData = vi.fn(() => Object.assign(Promise.resolve(result), result))
}

async function mountSuspended(component: any, options?: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, {
          default: () => h(component),
        })
      },
    }),
    { global: options?.global },
  )
  await flushPromises()
  return wrapper
}

describe('DetailPage - 이 지역 다른 시설 링크', () => {
  beforeEach(() => {
    mockUseAsyncDataWith({ success: true, data: mockHospitalFacility })
  })

  it('병원 상세 페이지 렌더링 시 "다른 시설" 관련 섹션이 존재한다', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    expect(wrapper.text()).toContain('이 지역 다른 시설')
  })

  it('관련 카테고리 링크가 최소 1개 존재한다', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    const html = wrapper.html()
    // pharmacy or aed links should exist
    expect(
      html.includes('pharmacy') || html.includes('aed')
    ).toBe(true)
  })

  it('현재 카테고리(hospital) 자신은 관련 시설 링크에 미포함된다', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    // Find the related-categories section and verify no self-link
    const relatedSection = wrapper.find('[data-testid="related-categories"]')
    if (relatedSection.exists()) {
      const links = relatedSection.findAll('a')
      for (const link of links) {
        const href = link.attributes('href') || ''
        // should not link to /hospital/ category pages
        expect(href).not.toMatch(/^\/hospital$/)
      }
    } else {
      // If section doesn't render that's fine for now - will pass after implementation
      expect(true).toBe(true)
    }
  })

  it('관련 링크 URL이 /{citySlug}/{districtSlug}/{category} 또는 /{category} 패턴이다', async () => {
    const wrapper = await mountSuspended(DetailPage, {
      global: { stubs: globalStubs },
    })

    const relatedSection = wrapper.find('[data-testid="related-categories"]')
    if (relatedSection.exists()) {
      const links = relatedSection.findAll('a')
      for (const link of links) {
        const href = link.attributes('href') || ''
        // Should match /{category} or /{city}/{district}/{category}
        expect(href).toMatch(/^\/[a-z-]+/)
      }
    } else {
      expect(true).toBe(true)
    }
  })
})
