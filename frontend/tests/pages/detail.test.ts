import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import DetailPage from '../../app/pages/[category]/[id].vue'
import type { FacilityDetail } from '../../types/facility'
import FacilityDetail from '../../app/components/facility/FacilityDetail.vue'

const mockFacility: FacilityDetail = {
  id: 'toilet-1',
  category: 'toilet',
  name: '강남역 공중화장실',
  address: '서울특별시 강남구 강남대로 396',
  roadAddress: '서울특별시 강남구 강남대로 396',
  lat: 37.4979,
  lng: 127.0276,
  city: '서울',
  district: '강남구',
  bjdCode: '11680',
  details: {
    operatingHours: '24시간',
    maleToilets: 3,
    femaleToilets: 5,
    hasDisabledToilet: true,
  },
  sourceId: 'src-1',
  sourceUrl: null,
  viewCount: 10,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  syncedAt: '2024-01-01T00:00:00Z',
}

// Mock composable
vi.mock('../../composables/useFacilityDetail', () => ({
  useFacilityDetail: vi.fn(() => ({
    loading: ref(false),
    error: ref(null),
    facility: ref(mockFacility),
    fetchDetail: vi.fn(),
  })),
}))

// Mock useRoute
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: {
      category: 'toilet',
      id: 'toilet-1',
    },
  }),
  useRouter: () => ({
    push: vi.fn(),
    back: vi.fn(),
  }),
}))

describe('DetailPage', () => {
  it('시설 이름과 주소를 표시', () => {
    const wrapper = mount(DetailPage, {
      global: {
        stubs: {
          FacilityDetail: {
            template: '<div>{{ facility.name }} {{ facility.roadAddress }}</div>',
            props: ['facility'],
          },
        },
      },
    })

    expect(wrapper.text()).toContain('강남역 공중화장실')
    expect(wrapper.text()).toContain('서울특별시 강남구 강남대로 396')
  })

  it('카테고리별 상세 컴포넌트를 렌더링', () => {
    const wrapper = mount(DetailPage, {
      global: {
        components: {
          FacilityDetail,
        },
        stubs: {
          ToiletDetail: { template: '<div>운영시간</div>' },
          DetailRow: true,
        },
      },
    })

    // FacilityDetail 컴포넌트가 렌더링되어야 함
    expect(wrapper.html()).toContain('강남역 공중화장실')
  })

  it('길찾기 링크가 올바른 URL을 가짐', () => {
    const wrapper = mount(DetailPage, {
      global: {
        stubs: {
          FacilityDetail: true,
        },
      },
    })

    const kakaoLink = wrapper.find('a[href*="map.kakao.com"]')
    expect(kakaoLink.exists()).toBe(true)
    expect(kakaoLink.attributes('href')).toContain('37.4979')
    expect(kakaoLink.attributes('href')).toContain('127.0276')

    const naverLink = wrapper.find('a[href*="map.naver.com"]')
    expect(naverLink.exists()).toBe(true)
  })

  it('뒤로가기 버튼이 존재', () => {
    const wrapper = mount(DetailPage, {
      global: {
        stubs: {
          FacilityDetail: true,
        },
      },
    })

    const backButton = wrapper.find('button')
    expect(backButton.exists()).toBe(true)
  })

  it('로딩 중 상태 표시', async () => {
    const { useFacilityDetail } = await import('../../composables/useFacilityDetail')
    vi.mocked(useFacilityDetail).mockReturnValueOnce({
      loading: ref(true),
      error: ref(null),
      facility: ref(null),
      fetchDetail: vi.fn(),
    } as any)

    const wrapper = mount(DetailPage, {
      global: {
        stubs: {
          FacilityDetail: true,
        },
      },
    })

    expect(wrapper.text()).toContain('로딩')
  })

  it('에러 상태 표시', async () => {
    const { useFacilityDetail } = await import('../../composables/useFacilityDetail')
    vi.mocked(useFacilityDetail).mockReturnValueOnce({
      loading: ref(false),
      error: ref(new Error('Failed to fetch')),
      facility: ref(null),
      fetchDetail: vi.fn(),
    } as any)

    const wrapper = mount(DetailPage, {
      global: {
        stubs: {
          FacilityDetail: true,
        },
      },
    })

    expect(wrapper.text()).toContain('시설 정보를 불러올 수 없습니다')
  })
})
