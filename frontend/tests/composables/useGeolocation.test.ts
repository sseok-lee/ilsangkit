import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useGeolocation } from '~/composables/useGeolocation'

describe('useGeolocation', () => {
  let mockGeolocation: any

  beforeEach(() => {
    // Mock navigator.geolocation
    mockGeolocation = {
      getCurrentPosition: vi.fn(),
      watchPosition: vi.fn(),
      clearWatch: vi.fn(),
    }

    vi.stubGlobal('navigator', {
      geolocation: mockGeolocation,
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('초기 상태', () => {
    it('초기 상태가 올바른지 확인', () => {
      const { position, error, isLoading } = useGeolocation()

      expect(position.value).toBeNull()
      expect(error.value).toBeNull()
      expect(isLoading.value).toBe(false)
    })
  })

  describe('getCurrentPosition', () => {
    it('위치 정보 요청 시 로딩 상태가 변경되는지 확인', () => {
      const { isLoading, getCurrentPosition } = useGeolocation()

      getCurrentPosition()

      expect(isLoading.value).toBe(true)
    })

    it('위치 정보 성공 시 position이 업데이트되는지 확인', async () => {
      const mockPosition = {
        coords: {
          latitude: 37.4979,
          longitude: 127.0276,
        },
      }

      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success(mockPosition)
      })

      const { position, isLoading, getCurrentPosition } = useGeolocation()
      const result = await getCurrentPosition()

      expect(result).toEqual({
        lat: 37.4979,
        lng: 127.0276,
      })
      expect(position.value).toEqual({
        lat: 37.4979,
        lng: 127.0276,
      })
      expect(isLoading.value).toBe(false)
    })

    it('위치 정보 실패 시 에러가 설정되는지 확인', async () => {
      const mockError = {
        code: 1, // PERMISSION_DENIED
        message: 'User denied Geolocation',
      }

      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error(mockError)
      })

      const { error, isLoading, getCurrentPosition } = useGeolocation()

      try {
        await getCurrentPosition()
      } catch (err) {
        expect(error.value).toBeDefined()
        expect(error.value?.code).toBe(1)
        expect(error.value?.message).toContain('위치 권한이 거부')
        expect(isLoading.value).toBe(false)
      }
    })

    it('Geolocation API를 지원하지 않을 때 에러가 발생하는지 확인', async () => {
      vi.stubGlobal('navigator', {})

      const { error, getCurrentPosition } = useGeolocation()

      try {
        await getCurrentPosition()
      } catch (err) {
        expect(error.value).toBeDefined()
        expect(error.value?.code).toBe(0)
        expect(error.value?.message).toContain('Geolocation is not supported')
      }
    })

    it('위치 정보 요청 시 올바른 옵션이 전달되는지 확인', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((success: any) => {
        success({
          coords: { latitude: 37.4979, longitude: 127.0276 },
        })
      })

      const { getCurrentPosition } = useGeolocation()
      await getCurrentPosition()

      expect(mockGeolocation.getCurrentPosition).toHaveBeenCalledWith(
        expect.any(Function),
        expect.any(Function),
        expect.objectContaining({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        })
      )
    })
  })

  describe('에러 메시지', () => {
    it('권한 거부(code: 1) 시 적절한 메시지를 반환하는지 확인', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({ code: 1, message: 'Permission denied' })
      })

      const { error, getCurrentPosition } = useGeolocation()

      try {
        await getCurrentPosition()
      } catch (err) {
        expect(error.value?.message).toContain('위치 권한이 거부')
      }
    })

    it('위치 불가(code: 2) 시 적절한 메시지를 반환하는지 확인', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({ code: 2, message: 'Position unavailable' })
      })

      const { error, getCurrentPosition } = useGeolocation()

      try {
        await getCurrentPosition()
      } catch (err) {
        expect(error.value?.message).toContain('위치 정보를 가져올 수 없습니다')
      }
    })

    it('시간 초과(code: 3) 시 적절한 메시지를 반환하는지 확인', async () => {
      mockGeolocation.getCurrentPosition.mockImplementation((_success: any, error: any) => {
        error({ code: 3, message: 'Timeout' })
      })

      const { error, getCurrentPosition } = useGeolocation()

      try {
        await getCurrentPosition()
      } catch (err) {
        expect(error.value?.message).toContain('시간이 초과')
      }
    })
  })

  describe('watchPosition', () => {
    it('watchPosition이 올바르게 호출되는지 확인', () => {
      const callback = vi.fn()
      const { watchPosition } = useGeolocation()

      watchPosition(callback)

      expect(mockGeolocation.watchPosition).toHaveBeenCalled()
    })

    it('watchPosition의 콜백이 실행되는지 확인', () => {
      const callback = vi.fn()
      mockGeolocation.watchPosition.mockImplementation((success: any) => {
        success({
          coords: { latitude: 37.4979, longitude: 127.0276 },
        })
        return 1 // watchId
      })

      const { watchPosition } = useGeolocation()
      watchPosition(callback)

      expect(callback).toHaveBeenCalledWith({
        lat: 37.4979,
        lng: 127.0276,
      })
    })

    it('clearWatch가 올바르게 호출되는지 확인', () => {
      mockGeolocation.watchPosition.mockReturnValue(1) // watchId

      const { watchPosition } = useGeolocation()
      const clearWatch = watchPosition(() => {})

      clearWatch()

      expect(mockGeolocation.clearWatch).toHaveBeenCalledWith(1)
    })
  })

  describe('calculateDistance', () => {
    it('거리 계산이 올바르게 동작하는지 확인', () => {
      const { calculateDistance } = useGeolocation()

      // 서울역 <-> 강남역 (약 7.8km)
      const distance = calculateDistance(37.5547, 126.9707, 37.4979, 127.0276)

      // 약 8000m (오차 범위 고려)
      expect(distance).toBeGreaterThan(7000)
      expect(distance).toBeLessThan(9000)
    })

    it('같은 위치의 거리는 0이어야 함', () => {
      const { calculateDistance } = useGeolocation()

      const distance = calculateDistance(37.4979, 127.0276, 37.4979, 127.0276)

      expect(distance).toBe(0)
    })
  })
})
