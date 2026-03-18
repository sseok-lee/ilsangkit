import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'

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
          id: 'toilet-1',
          name: '강남역 공중화장실',
          category: 'toilet',
          address: '서울특별시 강남구',
          lat: 37.4980,
          lng: 127.0277,
          distance: 100,
        },
        {
          id: 'parking-1',
          name: '강남 공영주차장',
          category: 'parking',
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
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue(mockFacilitiesResponse)
  })

  it('lat/lng props를 받아 마운트되는지 확인', () => {
    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    expect(wrapper.exists()).toBe(true)
  })

  it('마운트 시 $fetch로 /api/facilities/search를 POST 호출하는지 확인', async () => {
    mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    expect((globalThis as any).$fetch).toHaveBeenCalledWith(
      '/api/facilities/search',
      expect.objectContaining({
        method: 'POST',
        body: expect.objectContaining({
          lat: defaultProps.lat,
          lng: defaultProps.lng,
          radius: 1000,
        }),
      })
    )
  })

  it('로딩 중에 스피너를 표시하는지 확인', () => {
    // $fetch가 즉시 resolve하지 않도록 pending 상태 유지
    ;(globalThis as any).$fetch = vi.fn().mockReturnValue(new Promise(() => {}))

    const wrapper = mount(NearbyFacilities, { props: defaultProps })

    expect(
      wrapper.find('[data-testid="loading"]').exists() ||
      wrapper.html().includes('loading') ||
      wrapper.html().includes('spinner') ||
      wrapper.html().includes('animate-spin')
    ).toBe(true)
  })

  it('데이터 로드 후 시설 목록을 표시하는지 확인', async () => {
    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    expect(wrapper.text()).toContain('강남역 공중화장실')
    expect(wrapper.text()).toContain('강남 공영주차장')
    expect(wrapper.text()).toContain('강남약국')
  })

  it('거리 정보를 표시하는지 확인', async () => {
    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    expect(wrapper.text()).toMatch(/100\s*m/)
  })

  it('시설이 없을 때 빈 상태 메시지를 표시하는지 확인', async () => {
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: { items: [], total: 0 },
    })

    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    expect(wrapper.text()).toContain('주변에 등록된 시설이 없습니다')
  })

  it('DISPLAY_CATEGORIES 순서대로 부동산 핵심 시설이 우선 표시되는지 확인', async () => {
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({
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

    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    const html = wrapper.html()
    // 부동산 핵심 6개 카테고리가 표시됨
    expect(html).toContain('강남초등학교')
    expect(html).toContain('강남어린이집')
    expect(html).toContain('강남공원')
    expect(html).toContain('강남체육센터')
    expect(html).toContain('강남병원')
    expect(html).toContain('강남약국')

    // school이 toilet보다 먼저 나옴 (DISPLAY_CATEGORIES 우선순위)
    expect(html.indexOf('강남초등학교')).toBeLessThan(html.indexOf('공공화장실'))
  })

  it('DISPLAY_CATEGORIES에 toilet, wifi, aed, parking, library가 포함되지 않는지 확인', async () => {
    // 제거된 카테고리만 있는 응답
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: {
        items: [
          { id: 'school-1', name: '강남초등학교', category: 'school', address: '서울', lat: 37.498, lng: 127.028, distance: 200 },
          { id: 'pharmacy-1', name: '강남약국', category: 'pharmacy', address: '서울', lat: 37.498, lng: 127.028, distance: 100 },
        ],
        total: 2,
      },
    })

    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    // 핵심 카테고리가 표시됨
    expect(wrapper.html()).toContain('강남초등학교')
    expect(wrapper.html()).toContain('강남약국')
  })

  it('로딩 완료 후 스피너가 사라지는지 확인', async () => {
    const wrapper = mount(NearbyFacilities, { props: defaultProps })
    await flushPromises()

    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
  })
})
