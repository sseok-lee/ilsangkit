import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import RealEstateMapCanvas from '~/components/realEstate/map/RealEstateMapCanvas.vue'
import type { MapItem } from '~/types/realEstateMap'

// useKakaoMap/useMapOverlays 는 실제 Kakao SDK 로딩(document.createElement('script') 등)에 의존한다.
// 이 테스트는 RealEstateMapCanvas 자체(리스너 등록/해제·center watch·getBounds null 가드)를
// 검증하는 것이 목적이므로, 두 composable 은 관측 가능한 스파이로 대체한다.
// vi.mock 팩토리는 파일 상단으로 호이스팅되어 일반 변수를 참조할 수 없으므로 vi.hoisted 사용.
const mocks = vi.hoisted(() => ({
  mapRef: { value: null as null | { getLevel: () => number } },
  initMap: vi.fn(),
  getBounds: vi.fn(),
  getCenter: vi.fn(),
  panTo: vi.fn(),
  renderOverlays: vi.fn(),
  clearOverlays: vi.fn(),
}))

vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({
    map: mocks.mapRef,
    initMap: mocks.initMap,
    getBounds: mocks.getBounds,
    getCenter: mocks.getCenter,
    panTo: mocks.panTo,
  }),
}))

vi.mock('~/composables/useMapOverlays', () => ({
  useMapOverlays: () => ({
    renderOverlays: mocks.renderOverlays,
    clearOverlays: mocks.clearOverlays,
  }),
}))

const ITEMS: MapItem[] = [
  { name: '서울', district: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 100 },
]

function installFakeKakao(): void {
  ;(window as any).kakao = {
    maps: {
      LatLng: class {
        constructor(public lat: number, public lng: number) {}
      },
      Map: class {
        getLevel(): number {
          return 9
        }
      },
      event: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
    },
  }
}

function mountCanvas(props: Partial<{ items: MapItem[]; center: { lat: number; lng: number }; level: number }> = {}) {
  return mount(RealEstateMapCanvas, {
    props: {
      items: ITEMS,
      center: { lat: 36.5, lng: 127.8 },
      level: 9,
      ...props,
    },
  })
}

describe('RealEstateMapCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.mapRef.value = null
    mocks.initMap.mockImplementation(async () => {
      mocks.mapRef.value = { getLevel: () => 9 }
    })
    mocks.getBounds.mockReturnValue({ sw: { lat: 33, lng: 124 }, ne: { lat: 39, lng: 132 } })
    mocks.getCenter.mockReturnValue({ lat: 36.5, lng: 127.8 })
    // onNuxtReady 는 Nuxt 자동 import 전역이다 — vitest 에는 없으므로 즉시 실행하는 스텁을 심는다.
    ;(globalThis as any).onNuxtReady = (cb: () => void) => cb()
    installFakeKakao()
  })

  afterEach(() => {
    delete (window as any).kakao
    delete (globalThis as any).onNuxtReady
  })

  it('마운트 시 idle 리스너를 등록하고, unmount 시 동일 콜백으로 제거한다 (누수 회귀 가드)', async () => {
    const w = mountCanvas()
    await flushPromises()

    const kakao = (window as any).kakao
    expect(kakao.maps.event.addListener).toHaveBeenCalledTimes(1)
    const [, eventType, addedCallback] = kakao.maps.event.addListener.mock.calls[0]
    expect(eventType).toBe('idle')
    expect(typeof addedCallback).toBe('function')

    w.unmount()

    expect(kakao.maps.event.removeListener).toHaveBeenCalledTimes(1)
    const [, removedType, removedCallback] = kakao.maps.event.removeListener.mock.calls[0]
    expect(removedType).toBe('idle')
    // 등록 때와 "동일한" 콜백 참조여야 리스너가 실제로 해제된다 — 다른 함수면 누수가 재발한다.
    expect(removedCallback).toBe(addedCallback)
  })

  it('initMap 을 (container, { center, level }) 객체 인자로 호출한다 — 위치 인자가 아니다', async () => {
    mountCanvas({ center: { lat: 35.1, lng: 129.0 }, level: 7 })
    await flushPromises()

    expect(mocks.initMap).toHaveBeenCalledTimes(1)
    const [containerArg, optionsArg] = mocks.initMap.mock.calls[0]
    expect(containerArg).toBeInstanceOf(HTMLElement)
    expect(optionsArg).toEqual({ center: { lat: 35.1, lng: 129.0 }, level: 7 })
  })

  it('getBounds 가 null 이면 idle 이벤트를 emit 하지 않는다 (null 가드)', async () => {
    mocks.getBounds.mockReturnValue(null)
    const w = mountCanvas()
    await flushPromises()

    expect(w.emitted('idle')).toBeUndefined()
  })

  it('getBounds 가 값을 반환하면 마운트 시 idle 이벤트를 emit 한다', async () => {
    const w = mountCanvas()
    await flushPromises()

    expect(w.emitted('idle')).toBeTruthy()
    const [bounds, level] = w.emitted('idle')![0] as [unknown, number]
    expect(bounds).toEqual({ swLat: 33, swLng: 124, neLat: 39, neLng: 132 })
    expect(level).toBe(9)
  })

  it('props.center 가 바뀌면 지도를 그 위치로 이동시킨다 (마커/사이드바 선택 반영)', async () => {
    const w = mountCanvas({ center: { lat: 36.5, lng: 127.8 } })
    await flushPromises()
    expect(mocks.panTo).not.toHaveBeenCalled()

    await w.setProps({ center: { lat: 37.5, lng: 127.0 } })

    expect(mocks.panTo).toHaveBeenCalledWith(37.5, 127.0)
  })

  it('map 이 아직 준비되지 않았으면(초기화 실패 등) center 변경에도 panTo 를 호출하지 않는다', async () => {
    mocks.initMap.mockImplementation(async () => {
      mocks.mapRef.value = null
    })
    const w = mountCanvas()
    await flushPromises()

    await w.setProps({ center: { lat: 1, lng: 1 } })

    expect(mocks.panTo).not.toHaveBeenCalled()
  })

  it('idle emit 은 getBounds() 산술중점이 아니라 getCenter() 의 실제 중심을 3번째 인자로 올려보낸다', async () => {
    // getBounds() 의 sw/ne 산술중점 = (36+ (-)... ) 여기선 lat (33+41)/2=37, lng (124+132)/2=128 —
    // getCenter() 가 반환하는 실제 중심(36.5, 127.8)과 의도적으로 다르게 한다(Mercator 왜곡 재현).
    mocks.getBounds.mockReturnValue({ sw: { lat: 33, lng: 124 }, ne: { lat: 41, lng: 132 } })
    mocks.getCenter.mockReturnValue({ lat: 36.5, lng: 127.8 })

    const w = mountCanvas()
    await flushPromises()

    const [, , emittedCenter] = w.emitted('idle')![0] as [unknown, number, { lat: number; lng: number }]
    expect(emittedCenter).toEqual({ lat: 36.5, lng: 127.8 })
  })

  it('루프 회귀 가드: getCenter() 가 getBounds() 산술중점과 다른 상태에서 idle 이 발화돼도, ' +
    '그 idle 이 emit 한 실제 중심을 그대로 되돌려받으면 panTo 를 호출하지 않는다 (0회)', async () => {
    // sw/ne 산술중점(37, 128)과 getCenter() 실제값(36.5, 127.8)을 의도적으로 다르게 둔다.
    // 만약 가드가 (버그로) getCenter() 대신 bounds 중점과 비교하게 되면 아래 setProps 값이
    // "다르다"고 오판해 panTo 를 호출하게 되므로, 이 테스트는 그 회귀를 잡아낸다.
    mocks.getBounds.mockReturnValue({ sw: { lat: 33, lng: 124 }, ne: { lat: 41, lng: 132 } })
    mocks.getCenter.mockReturnValue({ lat: 36.5, lng: 127.8 })

    const w = mountCanvas({ center: { lat: 36.5, lng: 127.8 } })
    await flushPromises()

    // idle 재발화(예: kakao 리스너 콜백을 다시 호출)로 emit 된 실제 중심을 그대로
    // 상위가 echo 해 props.center 로 되돌려주는 정상 왕복을 재현한다.
    const kakao = (window as any).kakao
    const idleCallback = kakao.maps.event.addListener.mock.calls[0][2]
    idleCallback()
    await flushPromises()

    const [, , emittedCenter] = w.emitted('idle')!.at(-1) as [unknown, number, { lat: number; lng: number }]
    await w.setProps({ center: emittedCenter })

    expect(mocks.panTo).toHaveBeenCalledTimes(0)
  })
})
