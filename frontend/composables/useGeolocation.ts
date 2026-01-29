import { ref, readonly } from 'vue'

interface GeolocationPosition {
  lat: number
  lng: number
}

interface GeolocationError {
  code: number
  message: string
}

export function useGeolocation() {
  const position = ref<GeolocationPosition | null>(null)
  const error = ref<GeolocationError | null>(null)
  const isLoading = ref(false)

  /**
   * Get current position
   */
  function getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        const err = { code: 0, message: 'Geolocation is not supported' }
        error.value = err
        reject(err)
        return
      }

      isLoading.value = true
      error.value = null

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const result = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude
          }
          position.value = result
          isLoading.value = false
          resolve(result)
        },
        (err) => {
          const geoError = {
            code: err.code,
            message: getErrorMessage(err.code)
          }
          error.value = geoError
          isLoading.value = false
          reject(geoError)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000
        }
      )
    })
  }

  /**
   * Watch position changes
   */
  function watchPosition(callback: (pos: GeolocationPosition) => void): () => void {
    if (!navigator.geolocation) {
      error.value = { code: 0, message: 'Geolocation is not supported' }
      return () => {}
    }

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const result = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude
        }
        position.value = result
        callback(result)
      },
      (err) => {
        error.value = {
          code: err.code,
          message: getErrorMessage(err.code)
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000
      }
    )

    return () => navigator.geolocation.clearWatch(watchId)
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  function calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number
  ): number {
    const R = 6371e3 // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180
    const φ2 = (lat2 * Math.PI) / 180
    const Δφ = ((lat2 - lat1) * Math.PI) / 180
    const Δλ = ((lng2 - lng1) * Math.PI) / 180

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    return R * c // Distance in meters
  }

  return {
    position: readonly(position),
    error: readonly(error),
    isLoading: readonly(isLoading),
    getCurrentPosition,
    watchPosition,
    calculateDistance
  }
}

function getErrorMessage(code: number): string {
  switch (code) {
    case 1:
      return '위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.'
    case 2:
      return '위치 정보를 가져올 수 없습니다.'
    case 3:
      return '위치 요청 시간이 초과되었습니다.'
    default:
      return '알 수 없는 오류가 발생했습니다.'
  }
}
