import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatJeonseLabel, formatPriceLabel, formatPyeongLabel, formatWolseLabel, getRentDisplay, useMapOverlays } from '~/composables/useMapOverlays'
import type { MapBuildingItem, MapRegionItem } from '~/types/realEstateMap'
import type { DealSnapshot, LatestDeals } from '~/types/realEstateExploration'

function saleDeal(amount: number): DealSnapshot {
  return {
    kind: 'sale', amount, deposit: null, monthlyRent: null,
    exclusiveArea: 84.9, floor: 10, dealYear: 2026, dealMonth: 8, dealDay: 1,
  }
}

function jeonseDeal(deposit: number): DealSnapshot {
  return {
    kind: 'jeonse', amount: null, deposit, monthlyRent: null,
    exclusiveArea: 84.9, floor: 10, dealYear: 2026, dealMonth: 8, dealDay: 1,
  }
}

function wolseDeal(deposit: number, monthlyRent: number): DealSnapshot {
  return {
    kind: 'wolse', amount: null, deposit, monthlyRent,
    exclusiveArea: 59.4, floor: 8, dealYear: 2026, dealMonth: 8, dealDay: 2,
  }
}

function deals(over: Partial<LatestDeals> = {}): LatestDeals {
  return { sale: null, jeonse: null, wolse: null, ...over }
}

function building(over: Partial<MapBuildingItem>): MapBuildingItem {
  return {
    buildingName: 'A', city: '서울', district: '강남구', dongName: '개포동',
    bjdCode: '1168010300',
    lat: 37.48, lng: 127.06, latestPrice: null, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 1,
    jeonseDeposit: null, jeonseDealKey: null,
    wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
    latestDeals: deals(),
    ...over,
  }
}

function saleBuilding(amount: number, over: Partial<MapBuildingItem> = {}): MapBuildingItem {
  return building({ latestDeals: deals({ sale: saleDeal(amount) }), ...over })
}

function rentBuilding(
  snapshots: { jeonse?: DealSnapshot | null; wolse?: DealSnapshot | null },
  over: Partial<MapBuildingItem> = {},
): MapBuildingItem {
  return building({ latestDeals: deals(snapshots), ...over })
}

function regionItem(over: Partial<MapRegionItem>): MapRegionItem {
  return {
    name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: null, transactionCount: 10,
    ...over,
  }
}

describe('formatPriceLabel', () => {
  it('매매 마커는 latestDeals.sale 금액을 보여준다', () => {
    expect(formatPriceLabel(saleBuilding(168340), 'apt-sale')).toBe('16억 8,340만')
  })

  it('latestDeals.sale 이 있으면 마커 라벨도 같은 거래 금액을 쓴다', () => {
    expect(formatPriceLabel(building({
      latestPrice: 168340,
      monthlyRent: null,
      latestDeals: {
        sale: {
          kind: 'sale',
          amount: 170000,
          deposit: null,
          monthlyRent: null,
          exclusiveArea: 84.9,
          floor: 16,
          dealYear: 2026,
          dealMonth: 9,
          dealDay: null,
        },
        jeonse: null,
        wolse: null,
      },
    }), 'apt-sale')).toBe('17억')
  })

  it('전월세 마커는 최신 전세 snapshot 을 보여준다', () => {
    expect(formatPriceLabel(rentBuilding({ jeonse: jeonseDeal(30000) }), 'apt-rent')).toBe('전세 3억')
  })

  it('전월세 마커는 최신 월세 snapshot 의 보증금과 월세를 보여준다', () => {
    expect(formatPriceLabel(rentBuilding({ wolse: wolseDeal(10000, 80) }), 'apt-rent')).toBe('보 1억/월 80만')
  })

  it('억 단위가 딱 떨어지지 않으면 만원 자리를 붙인다', () => {
    expect(formatPriceLabel(saleBuilding(45500), 'villa-sale')).toBe('4억 5,500만')
  })

  it('1억 미만은 만 단위로 보여준다', () => {
    expect(formatPriceLabel(saleBuilding(8500), 'offitel-sale')).toBe('8,500만')
  })

  it('latestDeals 슬롯이 null 이면 stale flat 금액 대신 거래 없음을 표시한다', () => {
    expect(formatPriceLabel(building({
      latestPrice: 98765,
      monthlyRent: null,
      latestDeals: deals(),
    }), 'apt-sale')).toBe('거래 없음')
  })

  it('latestDeals bundle 이 없으면 stale flat 금액 대신 로드 실패를 표시한다', () => {
    expect(formatPriceLabel(building({
      latestPrice: 98765,
      monthlyRent: null,
      latestDeals: undefined,
    }), 'apt-sale')).toBe('거래 정보를 불러오지 못했습니다')
  })
})

describe('formatJeonseLabel / formatWolseLabel', () => {
  it('전세 보증금을 만원 단위로 보여준다', () => {
    expect(formatJeonseLabel(rentBuilding({ jeonse: jeonseDeal(96000) }))).toBe('9억 6,000만')
  })

  it('전세 거래가 없으면 null 이다 — 호출부가 "거래 없음" 을 그릴 수 있게 한다', () => {
    expect(formatJeonseLabel(rentBuilding({ jeonse: null }))).toBeNull()
  })

  it('전세 보증금 0원도 그린다 — 0 을 "없음" 으로 쓰지 않는다', () => {
    expect(formatJeonseLabel(rentBuilding({ jeonse: jeonseDeal(0) }))).toBe('0만')
  })

  it('월세는 보증금과 월세액을 가운뎃점으로 가른다', () => {
    expect(formatWolseLabel(rentBuilding({ wolse: wolseDeal(75000, 340) }))).toBe('7억 5,000만 · 340만')
  })

  it('월세 보증금이 억으로 딱 떨어지면 만원 자리를 붙이지 않는다', () => {
    expect(formatWolseLabel(rentBuilding({ wolse: wolseDeal(90000, 100) }))).toBe('9억 · 100만')
  })

  it('월세 거래가 없으면 null 이다', () => {
    expect(formatWolseLabel(rentBuilding({ wolse: null }))).toBeNull()
  })

  it('보증금은 있는데 월세액이 없으면 null 이다 — 반쪽 값을 그리지 않는다', () => {
    expect(formatWolseLabel(building({
      latestDeals: deals({ wolse: { ...wolseDeal(75000, 340), monthlyRent: null } }),
    }))).toBeNull()
  })

  it('보증금 0원 월세도 그린다 — 0 을 "없음" 으로 쓰지 않는다', () => {
    expect(formatWolseLabel(rentBuilding({ wolse: wolseDeal(0, 50) }))).toBe('0만 · 50만')
  })
})

describe('getRentDisplay — latestDeals bundle contract', () => {
  it('present snapshot slots provide the two popup values', () => {
    const item = rentBuilding({ jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) })
    expect(getRentDisplay(item)).toEqual({
      jeonse: formatJeonseLabel(item),
      wolse: formatWolseLabel(item),
      unavailable: false,
    })
  })

  it('latestDeals.jeonse/wolse 가 있으면 선택 팝업도 같은 거래 bundle 을 우선한다', () => {
    const item = building({
      jeonseDeposit: 96000,
      wolseDeposit: 75000,
      wolseMonthlyRent: 340,
      latestDeals: {
        sale: null,
        jeonse: {
          kind: 'jeonse',
          amount: null,
          deposit: 97000,
          monthlyRent: null,
          exclusiveArea: 84.9,
          floor: 12,
          dealYear: 2026,
          dealMonth: 9,
          dealDay: 1,
        },
        wolse: {
          kind: 'wolse',
          amount: null,
          deposit: 76000,
          monthlyRent: 350,
          exclusiveArea: 59.4,
          floor: 8,
          dealYear: 2026,
          dealMonth: 9,
          dealDay: 2,
        },
      },
    })

    expect(getRentDisplay(item)).toEqual({
      jeonse: '9억 7,000만',
      wolse: '7억 6,000만 · 350만',
      unavailable: false,
    })
  })

  it('present null slots mean verified no transaction even when flat amounts are stale', () => {
    const item = building({
      jeonseDeposit: 87654, wolseDeposit: 76543, wolseMonthlyRent: 321,
      latestPrice: 98765, monthlyRent: 432,
      latestDeals: deals(),
    })
    expect(getRentDisplay(item)).toEqual({ jeonse: null, wolse: null, unavailable: false })
  })

  it('absent bundle means transaction data is unavailable even when flat amounts are populated', () => {
    const item = building({
      jeonseDeposit: 87654, wolseDeposit: 76543, wolseMonthlyRent: 321,
      latestPrice: 98765, monthlyRent: 432,
      latestDeals: undefined,
    })
    expect(getRentDisplay(item)).toEqual({ jeonse: null, wolse: null, unavailable: true })
  })
})

describe('formatPyeongLabel', () => {
  const region = (p: number | null): MapRegionItem => ({
    name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: p, transactionCount: 10,
  })

  it('평당가에 단위를 붙인다', () => {
    expect(formatPyeongLabel(region(7732))).toBe('7,732만/평')
  })

  it('1억 이상이면 억 표기', () => {
    expect(formatPyeongLabel(region(16834))).toBe('1억 6,834만/평')
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
        saleBuilding(50000, { buildingName: 'A', lat: 100, lng: 100 }),
        saleBuilding(60000, { buildingName: 'B', lat: 100, lng: 100 }),
        saleBuilding(70000, { buildingName: 'C', lat: 100, lng: 100 }),
      ], {}, { type: 'apt-sale' })

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
        saleBuilding(50000, { buildingName: 'A', lat: 100, lng: 100 }),
        saleBuilding(60000, { buildingName: 'B', lat: 400, lng: 400 }),
      ], {}, { type: 'apt-sale' })
      expect(created).toHaveLength(2)
    })

    it('projection 이 없으면(구형 SDK 등) 생략 없이 전부 그린다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [
        saleBuilding(50000, { buildingName: 'A', lat: 100, lng: 100 }),
        saleBuilding(60000, { buildingName: 'B', lat: 100, lng: 100 }),
      ], {}, { type: 'apt-sale' })
      expect(created).toHaveLength(2)
    })
  })

  it('건물 아이템은 가격 라벨(map-price-label), 지역 아이템은 버블(map-region-bubble) 오버레이를 그린다', () => {
    const { renderOverlays } = useMapOverlays()
    const b = saleBuilding(50000, { lat: 37.1, lng: 127.1 })
    const r = regionItem({ avgPricePerPyeong: 3000, lat: 37.2, lng: 127.2 })

    renderOverlays(fakeMap, [b, r], {}, { type: 'apt-sale' })

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

  it('마커 라벨은 null snapshot 과 absent bundle 을 거래 없음과 로드 실패로 구분한다', () => {
    const { renderOverlays } = useMapOverlays()
    renderOverlays(fakeMap, [
      building({
        buildingName: '거래없음', latestPrice: 98765, monthlyRent: null,
        latestDeals: deals(), lat: 37.1, lng: 127.1,
      }),
      building({
        buildingName: 'bundle누락', latestPrice: 87654, monthlyRent: null,
        latestDeals: undefined, lat: 37.2, lng: 127.2,
      }),
    ], {}, { type: 'apt-sale' })

    expect(created[0].opts.content.textContent).toBe('거래 없음')
    expect(created[1].opts.content.textContent).toBe('거래 정보를 불러오지 못했습니다')
  })

  it('lat 또는 lng 가 null 인 아이템은 건너뛰고, 주변 아이템은 그대로 렌더된다', () => {
    const { renderOverlays } = useMapOverlays()
    const skippedLat = saleBuilding(10000, { lat: null })
    const skippedLng = saleBuilding(20000, { lng: null })
    const okBuilding = saleBuilding(30000)
    const okRegion = regionItem({ avgPricePerPyeong: 4000 })

    renderOverlays(fakeMap, [skippedLat, skippedLng, okBuilding, okRegion], {}, { type: 'apt-sale' })

    expect(created).toHaveLength(2)
    expect(created[0].opts.content.textContent).toBe(formatPriceLabel(okBuilding))
    expect(created[1].opts.content.textContent).toBe(formatPyeongLabel(okRegion))
  })

  it('clear-before-render: 이전 호출의 오버레이는 전부 setMap(null) 되고 최신 호출분만 남는다', () => {
    const { renderOverlays } = useMapOverlays()
    const first = saleBuilding(10000)
    renderOverlays(fakeMap, [first], {}, { type: 'apt-sale' })
    expect(created).toHaveLength(1)
    const firstOverlay = created[0]
    expect(firstOverlay.setMapCalls).toEqual([fakeMap])

    const second = saleBuilding(20000)
    const third = regionItem({ avgPricePerPyeong: 5000 })
    renderOverlays(fakeMap, [second, third], {}, { type: 'apt-sale' })

    // 이전 호출분은 clearOverlays() 로 인해 setMap(null) 이 추가로 호출된다
    expect(firstOverlay.setMapCalls).toEqual([fakeMap, null])

    expect(created).toHaveLength(3)
    const [, secondOverlay, thirdOverlay] = created
    expect(secondOverlay.setMapCalls).toEqual([fakeMap])
    expect(thirdOverlay.setMapCalls).toEqual([fakeMap])
  })

  it('clearOverlays() 는 모든 오버레이를 떼어내고, 이후 renderOverlays 는 깨끗한 상태에서 동작한다', () => {
    const { renderOverlays, clearOverlays } = useMapOverlays()
    const a = saleBuilding(10000)
    const b = saleBuilding(20000)
    renderOverlays(fakeMap, [a, b], {}, { type: 'apt-sale' })
    expect(created).toHaveLength(2)
    const [overlayA, overlayB] = created

    clearOverlays()
    expect(overlayA.setMapCalls).toEqual([fakeMap, null])
    expect(overlayB.setMapCalls).toEqual([fakeMap, null])

    const c = saleBuilding(30000)
    renderOverlays(fakeMap, [c], {}, { type: 'apt-sale' })

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
    const item = saleBuilding(10000)
    const onClick = vi.fn()
    const onHover = vi.fn()

    renderOverlays(fakeMap, [item], { onClick, onHover }, { type: 'apt-sale' })

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

  describe('선택 시 펼침', () => {
    /** 마커 하나의 DOM 요소를 꺼낸다. */
    function contentOf(i: number): HTMLElement {
      return created[i].opts.content as HTMLElement
    }

    it('선택하지 않으면 라벨은 한 줄이다 — 두 줄이면 겹쳐서 접히는 마커가 늘어난다', () => {
      const { renderOverlays } = useMapOverlays()
      const item = rentBuilding(
        { jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) },
        { buildingName: '은마' },
      )
      renderOverlays(fakeMap, [item], {}, { type: 'apt-rent', selectedKey: null })
      const el = contentOf(0)
      expect(el.className).toContain('map-price-label')
      expect(el.querySelector('a')).toBeNull()
      // 한 줄이다: 자식 엘리먼트(<br> 등)가 전혀 없고, textContent 가 라벨 문자열과 정확히 같다.
      expect(el.children.length).toBe(0)
      expect(el.textContent).toBe(formatPriceLabel(item, 'apt-rent'))
    })

    it('선택된 항목은 전세·월세와 상세 링크를 펼친다', () => {
      const { renderOverlays } = useMapOverlays()
      const item = rentBuilding(
        { jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) },
        { buildingName: '은마', city: '서울', district: '강남구' },
      )
      renderOverlays(fakeMap, [item], {}, { type: 'apt-rent', selectedKey: '은마|1168010300' })
      const el = contentOf(0)
      expect(el.className).toContain('map-popup')
      expect(el.textContent).toContain('9억 6,000만')
      expect(el.textContent).toContain('7억 5,000만 · 340만')
      expect(el.querySelector('a')?.getAttribute('href')).toBe('/real-estate/apt-rent/seoul/gangnam/%EC%9D%80%EB%A7%88')
    })

    it('buildingKey로 선택한 팝업 링크는 주소 식별 경로를 사용한다', () => {
      const { renderOverlays } = useMapOverlays()
      const buildingKey = 'a'.repeat(64)
      const item = rentBuilding(
        { jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) },
        { buildingName: '은마', city: '서울', district: '강남구', buildingKey },
      )

      renderOverlays(fakeMap, [item], {}, { type: 'apt-rent', selectedKey: buildingKey })

      expect(contentOf(0).querySelector('a')?.getAttribute('href')).toBe(
        `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('은마')}/${buildingKey}`,
      )
    })

    it('펼침 카드의 상세 링크 클릭은 onClick 토글을 막고, 카드의 다른 영역 클릭은 토글을 부른다', () => {
      // 링크는 이동이 목적이다 — onClick 이 같이 돌면 이동 직전에 카드가 접힌다(useMapOverlays.ts:249 가드).
      const { renderOverlays } = useMapOverlays()
      const item = rentBuilding(
        { jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) },
        { buildingName: '은마', city: '서울', district: '강남구' },
      )
      const onClick = vi.fn()
      renderOverlays(fakeMap, [item], { onClick }, { type: 'apt-rent', selectedKey: '은마|1168010300' })

      const el = contentOf(0)
      const link = el.querySelector('a')
      expect(link).not.toBeNull()

      link!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(onClick).not.toHaveBeenCalled()

      el.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      expect(onClick).toHaveBeenCalledTimes(1)
      expect(onClick).toHaveBeenCalledWith(item)
    })

    it('매매도 펼쳐진다 — 값은 한 줄이고 상세 링크가 붙는다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [saleBuilding(245000, {
        buildingName: '도곡렉슬', city: '서울', district: '강남구',
      })], {}, { type: 'apt-sale', selectedKey: '도곡렉슬|1168010300' })
      const el = contentOf(0)
      expect(el.className).toContain('map-popup')
      expect(el.textContent).toContain('24억 5,000만')
      expect(el.querySelector('a')).not.toBeNull()
    })

    it('거래가 없는 종류는 "거래 없음" 으로 그린다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [rentBuilding(
        { jeonse: jeonseDeal(60000), wolse: null },
        { buildingName: '신동아', city: '서울', district: '강남구' },
      )], {}, { type: 'apt-rent', selectedKey: '신동아|1168010300' })
      expect(contentOf(0).textContent).toContain('거래 없음')
    })

    it('present null slots make the popup show 거래 없음 without stale flat amounts', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [building({
        buildingName: '거래없음', city: '서울', district: '강남구',
        latestPrice: 98765, monthlyRent: 432,
        jeonseDeposit: 87654, wolseDeposit: 76543, wolseMonthlyRent: 321,
        latestDeals: deals(),
      })], {}, { type: 'apt-rent', selectedKey: '거래없음|1168010300' })
      const el = contentOf(0)
      expect(el.textContent?.match(/거래 없음/g)).toHaveLength(2)
      expect(el.textContent).not.toContain('9억 8,765만')
      expect(el.textContent).not.toContain('8억 7,654만')
      expect(el.textContent).not.toContain('7억 6,543만')
    })

    it('absent bundle makes the popup show an explicit load failure without stale flat amounts', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [building({
        buildingName: 'bundle누락', city: '서울', district: '강남구',
        latestPrice: 98765, monthlyRent: 432,
        jeonseDeposit: 87654, wolseDeposit: 76543, wolseMonthlyRent: 321,
        latestDeals: undefined,
      })], {}, { type: 'apt-rent', selectedKey: 'bundle누락|1168010300' })
      const el = contentOf(0)
      expect(el.textContent).toContain('거래 정보를 불러오지 못했습니다')
      expect(el.textContent).not.toContain('거래 없음')
      expect(el.textContent).not.toContain('9억 8,765만')
    })

    // "보조값이냐"(secondary)와 "값이 없냐"(absent)는 다른 축이다. 월세만 있는 건물에서
    // 전세 줄은 없는 값이므로 --absent 여야 하고, 그 옆의 실제 월세 금액은 보조값이지만
    // 존재하므로 --sub 만 붙어야 한다. 둘을 한 클래스로 합치면 "거래 없음"과 실제 금액이
    // 같은 회색이 되어 없는 값이 값처럼 읽힌다.
    it('전세 거래가 없으면 전세 줄은 --absent, 실제 값이 있는 월세 줄은 --sub 이다 (M-4)', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [rentBuilding(
        { jeonse: null, wolse: wolseDeal(75000, 340) },
        { buildingName: '월세만', city: '서울', district: '강남구' },
      )], {}, { type: 'apt-rent', selectedKey: '월세만|1168010300' })
      const el = contentOf(0)
      const lines = Array.from(el.querySelectorAll('.map-popup-line'))
      const jeonseLine = lines.find((l) => l.textContent?.includes('전세'))
      const wolseLine = lines.find((l) => l.textContent?.includes('월세'))
      expect(jeonseLine?.className).toContain('map-popup-line--absent')
      expect(wolseLine?.className).toContain('map-popup-line--sub')
      expect(wolseLine?.className).not.toContain('map-popup-line--absent')
    })

    it('선택된 항목을 맨 뒤에 그린다 — Kakao wrapper 는 DOM 순서로 페인트되므로 이웃 라벨에 가려 클릭이 막히면 안 된다', () => {
      const projMap = {
        id: 'proj-map',
        getProjection: () => ({
          containerPointFromCoords: (ll: { lat: number; lng: number }) => ({ x: ll.lng, y: ll.lat }),
        }),
      }
      const { renderOverlays } = useMapOverlays()
      // 셋이 같은 지점 — 순서상 뒤엣것은 점이 된다. B 를 선택하면 B 가 살아남아야 한다.
      renderOverlays(projMap, [
        saleBuilding(50000, { buildingName: 'A', city: '서울', district: '강남구', lat: 100, lng: 100 }),
        saleBuilding(60000, { buildingName: 'B', city: '서울', district: '강남구', lat: 100, lng: 100 }),
        saleBuilding(70000, { buildingName: 'C', city: '서울', district: '강남구', lat: 100, lng: 100 }),
      ], {}, { type: 'apt-sale', selectedKey: 'B|1168010300' })
      expect(created).toHaveLength(3)
      // 그 wrapper 가 마지막 형제여야 이웃 라벨보다 위에 그려져 클릭을 가로채이지 않는다.
      const lastIndex = created.length - 1
      expect(contentOf(lastIndex).className).toContain('map-popup')
      // 점으로 접히지 않는다는 기존 보장은 그대로 유지된다.
      expect(contentOf(lastIndex).textContent).toContain('6억')
    })

    it('같은 이름·구의 건물 중 bjdCode 가 일치하는 하나만 선택 팝업으로 마지막에 그린다', () => {
      const projMap = {
        id: 'proj-map',
        getProjection: () => ({
          containerPointFromCoords: (ll: { lat: number; lng: number }) => ({ x: ll.lng, y: ll.lat }),
        }),
      }
      const { renderOverlays } = useMapOverlays()
      const daechi = saleBuilding(50000, {
        buildingName: '은마', district: '강남구', dongName: '대치동', bjdCode: '1168010100',
        lat: 100, lng: 100,
      })
      const dogok = saleBuilding(60000, {
        buildingName: '은마', district: '강남구', dongName: '도곡동', bjdCode: '1168010300',
        lat: 100, lng: 100,
      })

      renderOverlays(projMap, [dogok, daechi], {}, {
        type: 'apt-sale',
        selectedKey: '은마|1168010300',
      })

      const contents = created.map((_, index) => contentOf(index))
      expect(contents.filter((content) => content.className.includes('map-popup'))).toHaveLength(1)
      expect(contents.at(-1)?.className).toContain('map-popup')
      expect(contents.at(-1)?.textContent).toContain('6억')
      expect(contents.at(-1)?.textContent).not.toContain('5억')
    })

    it('opts 를 안 넘기면 기존 동작 그대로다 — 지역 오버레이 호출부가 깨지지 않는다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [regionItem({ avgPricePerPyeong: 7732 })])
      expect(contentOf(0).className).toContain('map-region-bubble')
    })
  })
})
