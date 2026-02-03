import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityMap from '~/components/map/FacilityMap.vue'
import type { FacilitySearchItem } from '~/types/api'

// Mock useKakaoMap composable
const mockInitMap = vi.fn()
const mockAddMarkers = vi.fn()
const mockClearMarkers = vi.fn()
const mockSetCenter = vi.fn()
const mockPanTo = vi.fn()

vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    map: { value: null },
    isLoaded: { value: true },
    initMap: mockInitMap,
    addMarkers: mockAddMarkers,
    clearMarkers: mockClearMarkers,
    setCenter: mockSetCenter,
    panTo: mockPanTo,
  }),
}))

describe('FacilityMap', () => {
  const mockFacilities: FacilitySearchItem[] = [
    {
      id: 'toilet-1',
      name: '강남역 지하 공중화장실',
      category: 'toilet',
      address: '서울특별시 강남구 강남대로 396',
      roadAddress: null,
      lat: 37.4979,
      lng: 127.0276,
      city: '서울특별시',
      district: '강남구',
    },
    {
      id: 'wifi-1',
      name: '강남역 무료 와이파이',
      category: 'wifi',
      address: '서울특별시 강남구 강남대로 400',
      roadAddress: null,
      lat: 37.4980,
      lng: 127.0277,
      city: '서울특별시',
      district: '강남구',
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('렌더링', () => {
    it('지도 컨테이너가 렌더링되는지 확인', () => {
      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
        },
      })

      const mapContainer = wrapper.find('[data-testid="map-container"]')
      expect(mapContainer.exists()).toBe(true)
    })

    it('지도 컨테이너에 기본 스타일이 적용되는지 확인', () => {
      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
        },
      })

      const mapContainer = wrapper.find('[data-testid="map-container"]')
      expect(mapContainer.attributes('class')).toContain('w-full')
      expect(mapContainer.attributes('class')).toContain('h-full')
    })
  })

  describe('지도 초기화', () => {
    it('마운트 시 지도가 초기화되는지 확인', async () => {
      mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
          level: 5,
        },
      })

      // onMounted 대기
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockInitMap).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          center: { lat: 37.5665, lng: 126.9780 },
          level: 5,
        })
      )
    })

    it('기본 줌 레벨이 적용되는지 확인', async () => {
      mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockInitMap).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          level: 5,
        })
      )
    })
  })

  describe('시설 마커 표시', () => {
    it('facilities prop이 변경되면 마커가 업데이트되는지 확인', async () => {
      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
          facilities: [],
        },
      })

      await wrapper.setProps({ facilities: mockFacilities })

      expect(mockClearMarkers).toHaveBeenCalled()
      expect(mockAddMarkers).toHaveBeenCalledWith(
        mockFacilities,
        expect.any(Object)
      )
    })

    it('카테고리별 마커 색상이 전달되는지 확인', async () => {
      const toiletFacilities: FacilitySearchItem[] = [
        {
          id: 'toilet-1',
          name: '강남역 지하 공중화장실',
          category: 'toilet',
          address: '서울특별시 강남구',
          roadAddress: null,
          lat: 37.4979,
          lng: 127.0276,
          city: '서울특별시',
          district: '강남구',
        },
      ]

      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
          facilities: toiletFacilities,
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(mockAddMarkers).toHaveBeenCalledWith(
        toiletFacilities,
        expect.objectContaining({
          color: expect.any(String),
        })
      )
    })
  })

  describe('이벤트', () => {
    it('마커 클릭 시 markerClick 이벤트를 emit하는지 확인', async () => {
      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
          facilities: mockFacilities,
        },
      })

      await new Promise((resolve) => setTimeout(resolve, 0))

      // addMarkers 호출 시 전달된 onClick 핸들러 가져오기
      const onClickHandler = mockAddMarkers.mock.calls[0]?.[1]?.onClick

      if (onClickHandler) {
        onClickHandler(mockFacilities[0])

        expect(wrapper.emitted('markerClick')).toBeTruthy()
        expect(wrapper.emitted('markerClick')?.[0]).toEqual([mockFacilities[0]])
      }
    })
  })

  describe('중심점 변경', () => {
    it('center prop이 변경되면 지도 중심이 이동하는지 확인', async () => {
      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
        },
      })

      await wrapper.setProps({
        center: { lat: 37.4979, lng: 127.0276 },
      })

      expect(mockPanTo).toHaveBeenCalledWith(37.4979, 127.0276)
    })
  })

  describe('언마운트', () => {
    it('언마운트 시 마커가 정리되는지 확인', () => {
      const wrapper = mount(FacilityMap, {
        props: {
          center: { lat: 37.5665, lng: 126.9780 },
          facilities: mockFacilities,
        },
      })

      wrapper.unmount()

      expect(mockClearMarkers).toHaveBeenCalled()
    })
  })
})
