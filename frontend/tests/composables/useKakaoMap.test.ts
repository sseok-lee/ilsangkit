import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, ref, shallowReadonly, shallowRef } from 'vue'

const setPanoId = vi.fn()
const getNearestPanoId = vi.fn()

class MockLatLng {
  constructor(
    private readonly lat: number,
    private readonly lng: number
  ) {}

  getLat(): number {
    return this.lat
  }

  getLng(): number {
    return this.lng
  }
}

class MockRoadview {
  setPanoId = setPanoId
}

class MockRoadviewClient {
  getNearestPanoId = getNearestPanoId
}

function installKakaoMock(): void {
  window.kakao = {
    maps: {
      load: (callback: () => void) => callback(),
      LatLng: MockLatLng,
      Map: vi.fn() as never,
      Marker: vi.fn() as never,
      InfoWindow: vi.fn() as never,
      CustomOverlay: vi.fn() as never,
      event: {
        addListener: vi.fn(),
      },
      Roadview: MockRoadview as never,
      RoadviewClient: MockRoadviewClient as never,
      services: {
        Geocoder: vi.fn() as never,
        Status: { OK: 'OK', ZERO_RESULT: 'ZERO_RESULT', ERROR: 'ERROR' },
      },
    },
  }
}

describe('useKakaoMap.initRoadview', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    ;(globalThis as { ref: typeof ref }).ref = ref
    ;(globalThis as { computed: typeof computed }).computed = computed
    ;(globalThis as { shallowRef: typeof shallowRef }).shallowRef = shallowRef
    ;(globalThis as { shallowReadonly: typeof shallowReadonly }).shallowReadonly = shallowReadonly
    installKakaoMock()
  })

  it('50m 내 pano 가 없으면 더 넓은 반경으로 재시도한다', async () => {
    getNearestPanoId
      .mockImplementationOnce((_position, _radius, callback) => callback(null))
      .mockImplementationOnce((_position, _radius, callback) => callback(null))
      .mockImplementationOnce((_position, _radius, callback) => callback(1234))

    const { useKakaoMap } = await import('~/composables/useKakaoMap')
    const { initRoadview } = useKakaoMap()
    const onResult = vi.fn()

    await initRoadview(document.createElement('div'), 37.5, 127, onResult)

    expect(getNearestPanoId.mock.calls.map(([, radius]) => radius)).toEqual([50, 100, 200])
    expect(setPanoId).toHaveBeenCalledTimes(1)
    expect(setPanoId).toHaveBeenCalledWith(1234, expect.any(MockLatLng))
    expect(onResult).toHaveBeenCalledWith(true)
  })

  it('모든 반경에서 pano 를 찾지 못하면 unavailable 로 처리한다', async () => {
    getNearestPanoId.mockImplementation((_position, _radius, callback) => callback(null))

    const { useKakaoMap } = await import('~/composables/useKakaoMap')
    const { initRoadview } = useKakaoMap()
    const onResult = vi.fn()

    await initRoadview(document.createElement('div'), 37.5, 127, onResult)

    expect(getNearestPanoId.mock.calls.map(([, radius]) => radius)).toEqual([50, 100, 200, 400])
    expect(setPanoId).not.toHaveBeenCalled()
    expect(onResult).toHaveBeenCalledWith(false)
  })
})
