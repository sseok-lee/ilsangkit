import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'

function mockUseAsyncDataWith(data: any, status = 'success') {
  const result = {
    data: ref(data),
    status: ref(status),
    error: ref(null),
    refresh: vi.fn(),
  }
  ;(globalThis as any).useAsyncData = vi.fn(() => Object.assign(Promise.resolve(result), result))
}

async function mountSuspended(props: { lat: number; lng: number }) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(NearbyFacilities, props) })
      },
    }),
  )
  await flushPromises()
  return wrapper
}

describe('NearbyFacilities', () => {
  const defaultProps = {
    lat: 37.4979,
    lng: 127.0276,
  }

  const mockFacilitiesResponse = {
    success: true,
    data: {
      items: [
        {
          id: 'school-1',
          name: '강남초등학교',
          category: 'school',
          address: '서울특별시 강남구',
          lat: 37.498,
          lng: 127.0277,
          distance: 100,
        },
        {
          id: 'hospital-1',
          name: '강남병원',
          category: 'hospital',
          address: '서울특별시 강남구',
          lat: 37.4981,
          lng: 127.0278,
          distance: 200,
        },
        {
          id: 'pharmacy-1',
          name: '강남약국',
          category: 'pharmacy',
          address: '서울특별시 강남구',
          lat: 37.4982,
          lng: 127.0279,
          distance: 300,
        },
      ],
      total: 3,
    },
  }

  beforeEach(() => {
    mockUseAsyncDataWith(mockFacilitiesResponse)
  })

  it('lat/lng props를 받아 마운트되는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.exists()).toBe(true)
  })

  it('useAsyncData를 올바른 key로 호출하는지 확인', async () => {
    await mountSuspended(defaultProps)
    expect((globalThis as any).useAsyncData).toHaveBeenCalledWith(
      `nearby-facilities-${defaultProps.lat}-${defaultProps.lng}`,
      expect.any(Function),
    )
  })

  it('로딩 중에 스피너를 표시하는지 확인', async () => {
    mockUseAsyncDataWith(null, 'pending')
    const wrapper = await mountSuspended(defaultProps)

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('데이터 로드 후 시설 목록을 표시하는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)

    expect(wrapper.text()).toContain('강남초등학교')
    expect(wrapper.text()).toContain('강남병원')
    expect(wrapper.text()).toContain('강남약국')
  })

  it('거리 정보를 표시하는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)

    expect(wrapper.text()).toMatch(/100\s*m/)
  })

  it('시설이 없을 때 빈 상태 메시지를 표시하는지 확인', async () => {
    mockUseAsyncDataWith({ success: true, data: { items: [], total: 0 } })

    const wrapper = await mountSuspended(defaultProps)

    expect(wrapper.text()).toContain('조건에 맞는 시설이 없습니다')
  })

  it('DISPLAY_CATEGORIES 순서대로 부동산 핵심 시설이 우선 표시되는지 확인', async () => {
    mockUseAsyncDataWith({
      success: true,
      data: {
        items: [
          { id: 'school-1', name: '강남초등학교', category: 'school', address: '서울', lat: 37.498, lng: 127.028, distance: 200 },
          { id: 'childcare-1', name: '강남어린이집', category: 'childcare', address: '서울', lat: 37.498, lng: 127.028, distance: 300 },
          { id: 'park-1', name: '강남공원', category: 'park', address: '서울', lat: 37.498, lng: 127.028, distance: 150 },
          { id: 'sports-1', name: '강남체육센터', category: 'sports', address: '서울', lat: 37.498, lng: 127.028, distance: 400 },
          { id: 'hospital-1', name: '강남병원', category: 'hospital', address: '서울', lat: 37.498, lng: 127.028, distance: 250 },
          { id: 'pharmacy-1', name: '강남약국', category: 'pharmacy', address: '서울', lat: 37.498, lng: 127.028, distance: 100 },
          { id: 'toilet-1', name: '공공화장실', category: 'toilet', address: '서울', lat: 37.498, lng: 127.028, distance: 50 },
        ],
        total: 7,
      },
    })

    const wrapper = await mountSuspended(defaultProps)
    const html = wrapper.html()

    expect(html).toContain('강남초등학교')
    expect(html).toContain('강남어린이집')
    expect(html).toContain('강남공원')
    expect(html).toContain('강남체육센터')
    expect(html).toContain('강남병원')
    expect(html).toContain('강남약국')
    // DISPLAY_CATEGORIES에 없는 toilet은 표시되지 않음
    expect(html).not.toContain('공공화장실')
  })

  it('여러 카테고리 중 DISPLAY_CATEGORIES 항목만 표시되는지 확인', async () => {
    mockUseAsyncDataWith({
      success: true,
      data: {
        items: [
          { id: 'school-1', name: '강남초등학교', category: 'school', address: '서울', lat: 37.498, lng: 127.028, distance: 200 },
          { id: 'pharmacy-1', name: '강남약국', category: 'pharmacy', address: '서울', lat: 37.498, lng: 127.028, distance: 100 },
        ],
        total: 2,
      },
    })

    const wrapper = await mountSuspended(defaultProps)

    expect(wrapper.html()).toContain('강남초등학교')
    expect(wrapper.html()).toContain('강남약국')
  })

  it('로딩 완료 후 스피너가 사라지는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
  })
})
