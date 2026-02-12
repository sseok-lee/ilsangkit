import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import CurrentLocationButton from '~/components/location/CurrentLocationButton.vue'

// Mock useGeolocation composable
const mockGetCurrentPosition = vi.fn()
const mockIsLoading = ref(false)
const mockError = ref<any>(null)
const mockPosition = ref<any>(null)

vi.mock('~/composables/useGeolocation', () => ({
  useGeolocation: () => ({
    isLoading: mockIsLoading,
    error: mockError,
    position: mockPosition,
    getCurrentPosition: mockGetCurrentPosition,
  }),
}))

describe('CurrentLocationButton', () => {
  beforeEach(() => {
    mockGetCurrentPosition.mockClear()
    mockIsLoading.value = false
    mockError.value = null
    mockPosition.value = null
  })

  describe('렌더링', () => {
    it('기본 상태에서 올바르게 렌더링되는지 확인', () => {
      const wrapper = mount(CurrentLocationButton)

      expect(wrapper.find('button').exists()).toBe(true)
      expect(wrapper.text()).toContain('현재 위치')
    })

    it('아이콘이 표시되는지 확인', () => {
      const wrapper = mount(CurrentLocationButton)

      // Material Symbols 아이콘이 있는지 확인 (SVG에서 Material Symbols로 변경)
      expect(wrapper.find('.material-symbols-outlined').exists()).toBe(true)
    })
  })

  describe('로딩 상태', () => {
    it('로딩 중일 때 스피너가 표시되는지 확인', () => {
      mockIsLoading.value = true

      const wrapper = mount(CurrentLocationButton)

      expect(wrapper.text()).toContain('위치 확인 중')
      // 스피너 확인 (animate-spin 클래스)
      const spinner = wrapper.find('.animate-spin')
      expect(spinner.exists()).toBe(true)
    })

    it('로딩 중일 때 버튼이 비활성화되는지 확인', () => {
      mockIsLoading.value = true

      const wrapper = mount(CurrentLocationButton)

      expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    })
  })

  describe('에러 상태', () => {
    it('에러가 있을 때 에러 메시지가 표시되는지 확인', async () => {
      const wrapper = mount(CurrentLocationButton)

      mockError.value = {
        code: 1,
        message: '위치 권한이 거부되었습니다.',
      }

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('위치 권한이 거부')
    })

    it('권한 거부 시 안내 메시지가 표시되는지 확인', async () => {
      const wrapper = mount(CurrentLocationButton)

      mockError.value = {
        code: 1,
        message: '위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.',
      }

      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('설정에서 위치 권한을 허용')
    })
  })

  describe('클릭 동작', () => {
    it('버튼 클릭 시 getCurrentPosition이 호출되는지 확인', async () => {
      mockGetCurrentPosition.mockResolvedValue({
        lat: 37.4979,
        lng: 127.0276,
      })

      const wrapper = mount(CurrentLocationButton)
      await wrapper.find('button').trigger('click')

      expect(mockGetCurrentPosition).toHaveBeenCalled()
    })

    it('위치 획득 성공 시 locationFound 이벤트가 발생하는지 확인', async () => {
      const mockPosition = { lat: 37.4979, lng: 127.0276 }
      mockGetCurrentPosition.mockResolvedValue(mockPosition)

      const wrapper = mount(CurrentLocationButton)
      await wrapper.find('button').trigger('click')

      // Promise가 resolve될 때까지 대기
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(wrapper.emitted('locationFound')).toBeTruthy()
      expect(wrapper.emitted('locationFound')?.[0]).toEqual([mockPosition])
    })

    it('위치 획득 실패 시 error 이벤트가 발생하는지 확인', async () => {
      const errorMessage = '위치 정보를 가져올 수 없습니다.'
      mockGetCurrentPosition.mockRejectedValue({
        code: 2,
        message: errorMessage,
      })

      const wrapper = mount(CurrentLocationButton)
      await wrapper.find('button').trigger('click')

      // Promise가 reject될 때까지 대기
      await new Promise((resolve) => setTimeout(resolve, 0))

      expect(wrapper.emitted('error')).toBeTruthy()
      expect(wrapper.emitted('error')?.[0]).toEqual([errorMessage])
    })
  })

  describe('disabled prop', () => {
    it('disabled prop이 true일 때 버튼이 비활성화되는지 확인', () => {
      const wrapper = mount(CurrentLocationButton, {
        props: { disabled: true },
      })

      expect(wrapper.find('button').attributes('disabled')).toBeDefined()
    })

    it('disabled 상태에서 클릭 이벤트가 발생하지 않는지 확인', async () => {
      const wrapper = mount(CurrentLocationButton, {
        props: { disabled: true },
      })

      await wrapper.find('button').trigger('click')

      expect(mockGetCurrentPosition).not.toHaveBeenCalled()
    })
  })

  describe('접근성', () => {
    it('버튼에 적절한 aria-label이 있는지 확인', () => {
      const wrapper = mount(CurrentLocationButton)

      const button = wrapper.find('button')
      expect(button.attributes('aria-label')).toBeDefined()
      expect(button.attributes('aria-label')).toContain('현재 위치')
    })

    it('로딩 중일 때 aria-busy가 true인지 확인', () => {
      mockIsLoading.value = true

      const wrapper = mount(CurrentLocationButton)

      expect(wrapper.find('button').attributes('aria-busy')).toBe('true')
    })
  })

  describe('UI 상태', () => {
    it('기본 상태: 위치 아이콘 + "현재 위치"', () => {
      const wrapper = mount(CurrentLocationButton)

      // Material Symbols 아이콘이 있는지 확인 (SVG에서 Material Symbols로 변경)
      expect(wrapper.find('.material-symbols-outlined').exists()).toBe(true)
      expect(wrapper.text()).toContain('현재 위치')
    })

    it('로딩 상태: 스피너 + "위치 확인 중..."', () => {
      mockIsLoading.value = true

      const wrapper = mount(CurrentLocationButton)

      expect(wrapper.find('.animate-spin').exists()).toBe(true)
      expect(wrapper.text()).toContain('위치 확인 중')
    })

    it('에러 상태: 경고 아이콘 또는 에러 메시지', async () => {
      const wrapper = mount(CurrentLocationButton)

      mockError.value = {
        code: 1,
        message: '위치 권한이 거부되었습니다.',
      }

      await wrapper.vm.$nextTick()

      // 에러 메시지가 표시되어야 함
      expect(wrapper.text()).toContain('위치 권한')
    })
  })
})
