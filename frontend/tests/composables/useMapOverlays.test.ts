import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatPriceLabel, formatPyeongLabel, useMapOverlays } from '~/composables/useMapOverlays'
import type { MapBuildingItem, MapRegionItem } from '~/types/realEstateMap'

function building(over: Partial<MapBuildingItem>): MapBuildingItem {
  return {
    buildingName: 'A', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: null, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 1,
    ...over,
  }
}

function regionItem(over: Partial<MapRegionItem>): MapRegionItem {
  return {
    name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: null, transactionCount: 10,
    ...over,
  }
}

describe('formatPriceLabel', () => {
  it('매매(monthlyRent=null)는 금액만 보여준다', () => {
    expect(formatPriceLabel(building({ latestPrice: 168340, monthlyRent: null }))).toBe('16억 8,340')
  })

  it('전세는 monthlyRent=0 이다 — IS NULL 이 아니다', () => {
    expect(formatPriceLabel(building({ latestPrice: 30000, monthlyRent: 0 }))).toBe('전세 3억')
  })

  it('월세는 보증금·월세를 함께 보여준다', () => {
    expect(formatPriceLabel(building({ latestPrice: 10000, monthlyRent: 80 }))).toBe('월 1억·80')
  })

  it('억 단위가 딱 떨어지지 않으면 만원 자리를 붙인다', () => {
    expect(formatPriceLabel(building({ latestPrice: 45500, monthlyRent: null }))).toBe('4억 5,500')
  })

  it('1억 미만은 만원 단위로만 보여준다', () => {
    expect(formatPriceLabel(building({ latestPrice: 8500, monthlyRent: null }))).toBe('8,500')
  })

  it('가격이 없으면 대시', () => {
    expect(formatPriceLabel(building({ latestPrice: null }))).toBe('—')
  })
})

describe('formatPyeongLabel', () => {
  const region = (p: number | null): MapRegionItem => ({
    name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: p, transactionCount: 10,
  })

  it('평당가에 단위를 붙인다', () => {
    expect(formatPyeongLabel(region(7732))).toBe('7,732/평')
  })

  it('1억 이상이면 억 표기', () => {
    expect(formatPyeongLabel(region(16834))).toBe('1억 6,834/평')
  })

  it('데이터 없는 지역은 대시', () => {
    expect(formatPyeongLabel(region(null))).toBe('—')
  })
})

describe('useMapOverlays', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let created: any[]

  class FakeLatLng {
    constructor(public lat: number, public lng: number) {}
  }

  class FakeOverlay {
    setMapCalls: unknown[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(public opts: any) {
      created.push(this)
    }
    setMap(m: unknown) {
      this.setMapCalls.push(m)
    }
  }

  const fakeMap = { id: 'fake-map' }

  beforeEach(() => {
    created = []
    ;(window as any).kakao = {
      maps: {
        LatLng: FakeLatLng,
        CustomOverlay: FakeOverlay,
      },
    }
  })

  afterEach(() => {
    delete (window as any).kakao
  })

  // 밀집 지역에서 라벨이 서로 덮으면 아무것도 못 읽는다(대전 시내 실측: 200개 전량 렌더 시
  // 판독 불가). projection 이 있으면 화면좌표로 겹침을 판정해 뒤엣것을 생략한다.
  // items 는 서버가 transactionCount DESC 로 주므로 순서가 곧 우선순위다.
  describe('겹침 회피', () => {
    /** 위/경도를 그대로 픽셀로 쓰는 단순 투영 — 좌표 차이가 곧 픽셀 거리가 된다. */
    const projMap = {
      id: 'proj-map',
      getProjection: () => ({
        containerPointFromCoords: (ll: FakeLatLng) => ({ x: ll.lng, y: ll.lat }),
      }),
    }

    it('같은 지점에 몰리면 첫 번째만 라벨, 나머지는 점으로 남는다', () => {
      // 아예 건너뛰면 좌측 목록엔 있는데 지도엔 없는 건물이 생긴다(실측 강남 level 4:
      // 목록 114 vs 라벨 76 → 38개 실종). 점으로라도 위치·클릭 대상을 유지한다.
      const { renderOverlays } = useMapOverlays()
      renderOverlays(projMap, [
        building({ buildingName: 'A', latestPrice: 50000, monthlyRent: null, lat: 100, lng: 100 }),
        building({ buildingName: 'B', latestPrice: 60000, monthlyRent: null, lat: 100, lng: 100 }),
        building({ buildingName: 'C', latestPrice: 70000, monthlyRent: null, lat: 100, lng: 100 }),
      ])

      expect(created).toHaveLength(3)
      const classes = created.map((o) => o.opts.content.className)
      expect(classes).toEqual(['map-price-label', 'map-price-dot', 'map-price-dot'])
      // 라벨은 첫 번째(우선순위 최상)가 가져간다
      expect(created[0].opts.content.textContent).toBe('5억')
      // 점은 텍스트를 비우고 값은 title 로 남긴다
      expect(created[1].opts.content.textContent).toBe('')
      expect(created[1].opts.content.title).toBe('6억')
    })

    it('충분히 떨어진 라벨은 모두 남는다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(projMap, [
        building({ buildingName: 'A', latestPrice: 50000, monthlyRent: null, lat: 100, lng: 100 }),
        building({ buildingName: 'B', latestPrice: 60000, monthlyRent: null, lat: 400, lng: 400 }),
      ])
      expect(created).toHaveLength(2)
    })

    it('projection 이 없으면(구형 SDK 등) 생략 없이 전부 그린다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [
        building({ buildingName: 'A', latestPrice: 50000, monthlyRent: null, lat: 100, lng: 100 }),
        building({ buildingName: 'B', latestPrice: 60000, monthlyRent: null, lat: 100, lng: 100 }),
      ])
      expect(created).toHaveLength(2)
    })
  })

  it('건물 아이템은 가격 라벨(map-price-label), 지역 아이템은 버블(map-region-bubble) 오버레이를 그린다', () => {
    const { renderOverlays } = useMapOverlays()
    const b = building({ latestPrice: 50000, monthlyRent: null, lat: 37.1, lng: 127.1 })
    const r = regionItem({ avgPricePerPyeong: 3000, lat: 37.2, lng: 127.2 })

    renderOverlays(fakeMap, [b, r])

    expect(created).toHaveLength(2)
    const [bOverlay, rOverlay] = created

    expect(bOverlay.opts.content.className).toBe('map-price-label')
    expect(bOverlay.opts.content.textContent).toBe(formatPriceLabel(b))
    expect(bOverlay.opts.position).toBeInstanceOf(FakeLatLng)
    expect(bOverlay.opts.position.lat).toBe(b.lat)
    expect(bOverlay.opts.position.lng).toBe(b.lng)
    expect(bOverlay.setMapCalls).toEqual([fakeMap])

    expect(rOverlay.opts.content.className).toBe('map-region-bubble')
    expect(rOverlay.opts.content.textContent).toBe(formatPyeongLabel(r))
    expect(rOverlay.opts.position.lat).toBe(r.lat)
    expect(rOverlay.opts.position.lng).toBe(r.lng)
    expect(rOverlay.setMapCalls).toEqual([fakeMap])
  })

  it('lat 또는 lng 가 null 인 아이템은 건너뛰고, 주변 아이템은 그대로 렌더된다', () => {
    const { renderOverlays } = useMapOverlays()
    const skippedLat = building({ latestPrice: 10000, lat: null })
    const skippedLng = building({ latestPrice: 20000, lng: null })
    const okBuilding = building({ latestPrice: 30000, monthlyRent: null })
    const okRegion = regionItem({ avgPricePerPyeong: 4000 })

    renderOverlays(fakeMap, [skippedLat, skippedLng, okBuilding, okRegion])

    expect(created).toHaveLength(2)
    expect(created[0].opts.content.textContent).toBe(formatPriceLabel(okBuilding))
    expect(created[1].opts.content.textContent).toBe(formatPyeongLabel(okRegion))
  })

  it('clear-before-render: 이전 호출의 오버레이는 전부 setMap(null) 되고 최신 호출분만 남는다', () => {
    const { renderOverlays } = useMapOverlays()
    const first = building({ latestPrice: 10000 })
    renderOverlays(fakeMap, [first])
    expect(created).toHaveLength(1)
    const firstOverlay = created[0]
    expect(firstOverlay.setMapCalls).toEqual([fakeMap])

    const second = building({ latestPrice: 20000 })
    const third = regionItem({ avgPricePerPyeong: 5000 })
    renderOverlays(fakeMap, [second, third])

    // 이전 호출분은 clearOverlays() 로 인해 setMap(null) 이 추가로 호출된다
    expect(firstOverlay.setMapCalls).toEqual([fakeMap, null])

    expect(created).toHaveLength(3)
    const [, secondOverlay, thirdOverlay] = created
    expect(secondOverlay.setMapCalls).toEqual([fakeMap])
    expect(thirdOverlay.setMapCalls).toEqual([fakeMap])
  })

  it('clearOverlays() 는 모든 오버레이를 떼어내고, 이후 renderOverlays 는 깨끗한 상태에서 동작한다', () => {
    const { renderOverlays, clearOverlays } = useMapOverlays()
    const a = building({ latestPrice: 10000 })
    const b = building({ latestPrice: 20000 })
    renderOverlays(fakeMap, [a, b])
    expect(created).toHaveLength(2)
    const [overlayA, overlayB] = created

    clearOverlays()
    expect(overlayA.setMapCalls).toEqual([fakeMap, null])
    expect(overlayB.setMapCalls).toEqual([fakeMap, null])

    const c = building({ latestPrice: 30000 })
    renderOverlays(fakeMap, [c])

    // 이미 떼어진 오버레이가 다시 setMap(null) 되지 않고, 새 오버레이 하나만 추가된다
    expect(overlayA.setMapCalls).toEqual([fakeMap, null])
    expect(overlayB.setMapCalls).toEqual([fakeMap, null])
    expect(created).toHaveLength(3)
    const overlayC = created[2]
    expect(overlayC.setMapCalls).toEqual([fakeMap])
    expect(overlayC.opts.content.textContent).toBe(formatPriceLabel(c))
  })

  it('클릭/호버 핸들러가 올바른 아이템으로 호출된다 — mouseleave 는 null 을 전달한다', () => {
    const { renderOverlays } = useMapOverlays()
    const item = building({ latestPrice: 10000 })
    const onClick = vi.fn()
    const onHover = vi.fn()

    renderOverlays(fakeMap, [item], { onClick, onHover })

    const el: HTMLElement = created[0].opts.content
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClick).toHaveBeenCalledTimes(1)
    expect(onClick).toHaveBeenCalledWith(item)

    el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }))
    expect(onHover).toHaveBeenNthCalledWith(1, item)

    el.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
    expect(onHover).toHaveBeenNthCalledWith(2, null)
    expect(onHover).toHaveBeenCalledTimes(2)
  })
})
