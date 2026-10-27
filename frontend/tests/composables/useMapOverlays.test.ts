import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  buildingMarkerTone, formatJeonseLabel, formatPriceLabel, formatPyeongLabel, formatRegionLabel,
  formatWolseLabel, getRentDisplay, isDealOlderThanYear, overlayPriority, useMapOverlays,
} from '~/composables/useMapOverlays'
import type { MapBuildingItem, MapRegionItem } from '~/types/realEstateMap'
import { cityDisplayName } from '~/utils/regionChips'
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

/** 단지 핀의 가격 줄 / 단지명 줄. */
function priceOf(el: HTMLElement): string | null {
  return el.querySelector('.map-price-label-price')?.textContent ?? null
}
function nameOf(el: HTMLElement): string | null {
  return el.querySelector('.map-price-label-name')?.textContent ?? null
}

/** 픽스처 거래일(2026-08)이 최근 1년 안에 들도록 고정한 기준일. */
const NOW = new Date(2026, 9, 27)

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

describe('단지 핀 색 구분 — 계약일 기준 1년', () => {
  const dealOn = (y: number, m: number, d: number | null): DealSnapshot => ({ ...saleDeal(50000), dealYear: y, dealMonth: m, dealDay: d })

  it('정확히 1년 전 같은 날은 아직 1년 안쪽, 그 전날부터 1년 넘음', () => {
    expect(isDealOlderThanYear(dealOn(2025, 10, 27), NOW)).toBe(false)
    expect(isDealOlderThanYear(dealOn(2025, 10, 26), NOW)).toBe(true)
  })

  it('계약일(일)이 없으면 그 달 말일로 본다 — 모르는 날짜를 오래된 쪽으로 몰지 않는다', () => {
    expect(isDealOlderThanYear(dealOn(2025, 10, null), NOW)).toBe(false)
    expect(isDealOlderThanYear(dealOn(2025, 9, null), NOW)).toBe(true)
  })

  it('최근 거래는 recent, 1년 넘은 거래·거래 없음·로드 실패는 muted', () => {
    expect(buildingMarkerTone(saleBuilding(50000), 'apt-sale', NOW)).toBe('recent')
    expect(buildingMarkerTone(building({ latestDeals: deals({ sale: dealOn(2024, 11, 7) }) }), 'apt-sale', NOW)).toBe('muted')
    expect(buildingMarkerTone(building({ latestDeals: deals() }), 'apt-sale', NOW)).toBe('muted')
    expect(buildingMarkerTone(building({ latestDeals: undefined }), 'apt-sale', NOW)).toBe('muted')
  })

  it('전월세는 핀에 보이는 거래(전세·월세 중 최근)의 날짜로 판정한다', () => {
    const oldJeonse = { ...jeonseDeal(30000), dealYear: 2024, dealMonth: 1, dealDay: 1 }
    expect(buildingMarkerTone(rentBuilding({ jeonse: oldJeonse, wolse: wolseDeal(1000, 50) }), 'apt-rent', NOW)).toBe('recent')
    expect(buildingMarkerTone(rentBuilding({ jeonse: oldJeonse, wolse: null }), 'apt-rent', NOW)).toBe('muted')
  })
})

describe('지역 핀 라벨 — 이름 + 평당가', () => {
  it('시·도는 이름과 평당가를 한 줄로', () => {
    expect(formatRegionLabel(regionItem({ name: '서울', avgPricePerPyeong: 5117 }))).toBe('서울 5,117만/평')
  })

  it('값이 없어도 이름은 남긴다', () => {
    expect(formatRegionLabel(regionItem({ name: '제주', avgPricePerPyeong: null }))).toBe('제주 —')
  })

  it('구·군 단계는 구·군 이름, 동 단계는 동 이름', () => {
    expect(formatRegionLabel(regionItem({ district: '강남구', avgPricePerPyeong: 8000 }))).toBe('강남구 8,000만/평')
    expect(formatRegionLabel(regionItem({ district: '강남구', dong: '개포동', avgPricePerPyeong: 9000 }))).toBe('개포동 9,000만/평')
  })

  it('통합시 풀네임은 목록과 같은 짧은 이름으로', () => {
    expect(cityDisplayName('전남광주통합특별시')).toBe('전남·광주')
    expect(cityDisplayName('서울')).toBe('서울')
  })

  it('정식명(서울특별시·경기도)도 칩 라벨로 맞춘다', () => {
    expect(cityDisplayName('서울특별시')).toBe('서울')
    expect(cityDisplayName('경기도')).toBe('경기')
    expect(cityDisplayName('어딘가')).toBe('어딘가')
  })
})

describe('overlayPriority — 겹칠 때 자리 잡는 순서', () => {
  it('거래 많은 순, 같으면 원래 순서', () => {
    const a = regionItem({ name: '경기', transactionCount: 50 })
    const b = regionItem({ name: '서울', transactionCount: 500 })
    const c = regionItem({ name: '인천', transactionCount: 50 })
    expect(overlayPriority([a, b, c]).map((i) => (i as MapRegionItem).name)).toEqual(['서울', '경기', '인천'])
  })

  it('선택된 단지가 거래 수보다 먼저다', () => {
    const big = saleBuilding(10000, { buildingName: 'BIG', transactionCount: 900 })
    const sel = saleBuilding(10000, { buildingName: 'SEL', transactionCount: 1 })
    expect(overlayPriority([big, sel], 'SEL|1168010300').map((i) => (i as MapBuildingItem).buildingName)).toEqual(['SEL', 'BIG'])
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
      expect(priceOf(created[0].opts.content)).toBe('5억')
      // 점은 텍스트를 비우고 이름·값은 title 로 남긴다
      expect(created[1].opts.content.textContent).toBe('')
      expect(created[1].opts.content.title).toBe('B 6억')
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
    expect(priceOf(bOverlay.opts.content)).toBe(formatPriceLabel(b))
    expect(bOverlay.opts.position).toBeInstanceOf(FakeLatLng)
    expect(bOverlay.opts.position.lat).toBe(b.lat)
    expect(bOverlay.opts.position.lng).toBe(b.lng)
    expect(bOverlay.setMapCalls).toEqual([fakeMap])

    expect(rOverlay.opts.content.className).toBe('map-region-bubble')
    expect(rOverlay.opts.content.textContent).toBe(`서울${formatPyeongLabel(r)}`)
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

    expect(priceOf(created[0].opts.content)).toBe('거래 없음')
    expect(priceOf(created[1].opts.content)).toBe('거래 정보를 불러오지 못했습니다')
  })

  it('lat 또는 lng 가 null 인 아이템은 건너뛰고, 주변 아이템은 그대로 렌더된다', () => {
    const { renderOverlays } = useMapOverlays()
    const skippedLat = saleBuilding(10000, { lat: null })
    const skippedLng = saleBuilding(20000, { lng: null })
    const okBuilding = saleBuilding(30000)
    const okRegion = regionItem({ avgPricePerPyeong: 4000 })

    renderOverlays(fakeMap, [skippedLat, skippedLng, okBuilding, okRegion], {}, { type: 'apt-sale' })

    expect(created).toHaveLength(2)
    expect(priceOf(created[0].opts.content)).toBe(formatPriceLabel(okBuilding))
    expect(created[1].opts.content.textContent).toContain(formatPyeongLabel(okRegion))
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
    expect(priceOf(overlayC.opts.content)).toBe(formatPriceLabel(c))
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

    it('선택하지 않으면 단지명·가격 두 줄 말풍선이고 상세 링크는 없다', () => {
      const { renderOverlays } = useMapOverlays()
      const item = rentBuilding(
        { jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) },
        { buildingName: '은마' },
      )
      renderOverlays(fakeMap, [item], {}, { type: 'apt-rent', selectedKey: null, now: NOW })
      const el = contentOf(0)
      expect(el.className).toContain('map-price-label')
      expect(el.querySelector('a')).toBeNull()
      expect(nameOf(el)).toBe('은마')
      expect(priceOf(el)).toBe(formatPriceLabel(item, 'apt-rent'))
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

    it('buildingKey로 선택한 팝업 링크도 공개 URL에는 해시를 붙이지 않는다', () => {
      const { renderOverlays } = useMapOverlays()
      const buildingKey = 'a'.repeat(64)
      const item = rentBuilding(
        { jeonse: jeonseDeal(96000), wolse: wolseDeal(75000, 340) },
        { buildingName: '은마', city: '서울', district: '강남구', buildingKey },
      )

      renderOverlays(fakeMap, [item], {}, { type: 'apt-rent', selectedKey: buildingKey })

      expect(contentOf(0).querySelector('a')?.getAttribute('href')).toBe(
        `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('은마')}`,
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
  describe('A안 말풍선 핀', () => {
    const projMap = {
      id: 'proj-map',
      getProjection: () => ({
        containerPointFromCoords: (ll: FakeLatLng) => ({ x: ll.lng, y: ll.lat }),
      }),
    }

    it('단지명은 텍스트로만 들어간다 — 마크업이 섞여도 요소로 해석되지 않는다', () => {
      const { renderOverlays } = useMapOverlays()
      const evil = '<img src=x onerror=alert(1)>래미안'
      renderOverlays(fakeMap, [saleBuilding(50000, { buildingName: evil })], {}, { type: 'apt-sale', now: NOW })
      const el: HTMLElement = created[0].opts.content
      expect(el.querySelector('img')).toBeNull()
      expect(nameOf(el)).toBe(evil)
    })

    it('전월세 핀은 기존 접두 규칙 그대로("전세 …", "보 …/월 …")', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [
        rentBuilding({ jeonse: jeonseDeal(30000) }, { buildingName: '전세집', lat: 1, lng: 1 }),
        rentBuilding({ wolse: wolseDeal(10000, 80) }, { buildingName: '월세집', lat: 2, lng: 2 }),
      ], {}, { type: 'apt-rent', now: NOW })
      expect(priceOf(created[0].opts.content)).toBe('전세 3억')
      expect(priceOf(created[1].opts.content)).toBe('보 1억/월 80만')
    })

    it('1년 넘은 거래·거래 없음은 같은 모양의 회색 핀', () => {
      const { renderOverlays } = useMapOverlays()
      const old = { ...saleDeal(216500), dealYear: 2024, dealMonth: 11, dealDay: 7 }
      renderOverlays(fakeMap, [
        saleBuilding(50000, { buildingName: '최근', lat: 1, lng: 1 }),
        building({ buildingName: '신동아', latestDeals: deals({ sale: old }), lat: 2, lng: 2 }),
        building({ buildingName: '빈집', latestDeals: deals(), lat: 3, lng: 3 }),
      ], {}, { type: 'apt-sale', now: NOW })
      expect(created.map((o) => o.opts.content.className)).toEqual([
        'map-price-label',
        'map-price-label map-price-label--muted',
        'map-price-label map-price-label--muted',
      ])
      expect(priceOf(created[1].opts.content)).toBe('21억 6,500만')
      expect(nameOf(created[2].opts.content)).toBe('빈집')
      expect(priceOf(created[2].opts.content)).toBe('거래 없음')
    })

    it('지역 핀은 이름과 평당가 두 조각, 값이 없으면 이름 + —', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(fakeMap, [
        regionItem({ name: '서울', avgPricePerPyeong: 5117, lat: 1, lng: 1 }),
        regionItem({ name: '제주', avgPricePerPyeong: null, lat: 2, lng: 2 }),
      ])
      const [seoul, jeju] = created.map((o) => o.opts.content as HTMLElement)
      expect(seoul.querySelector('.map-region-bubble-name')?.textContent).toBe('서울')
      expect(seoul.querySelector('.map-region-bubble-price')?.textContent).toBe('5,117만/평')
      expect(jeju.querySelector('.map-region-bubble-name')?.textContent).toBe('제주')
      expect(jeju.querySelector('.map-region-bubble-price')?.textContent).toBe('—')
    })

    it('지역 핀이 겹치면 거래 많은 지역이 기본 자리를 갖고, 밀린 지역은 아래로 비껴 놓인다 — 가까운 시·도끼리 한쪽이 숨지 않는다', () => {
      // 서버는 뷰포트 중심에서 가까운 순으로 준다. 인천이 앞에 와도 거래 많은 서울이 기본 자리(좌표 위)를 가져야 한다.
      const { renderOverlays } = useMapOverlays()
      renderOverlays(projMap, [
        regionItem({ name: '인천', avgPricePerPyeong: 1878, transactionCount: 300, lat: 100, lng: 100 }),
        regionItem({ name: '서울', avgPricePerPyeong: 5117, transactionCount: 900, lat: 100, lng: 100 }),
      ])
      const [incheon, seoul] = created
      expect(seoul.opts.content.className).toBe('map-region-bubble')
      expect(seoul.opts.yAnchor).toBe(1)
      expect(incheon.opts.content.className).toBe('map-region-bubble map-region-bubble--below')
      expect(incheon.opts.yAnchor).toBe(0)
      expect(incheon.opts.content.querySelector('.map-region-bubble-name')?.textContent).toBe('인천')
    })

    it('비껴 놓을 자리까지 다 차면 그때 점으로 접는다(거래 적은 지역부터)', () => {
      // 같은 좌표면 위·아래 두 자리뿐이다(좌우로 민 자리도 가운데 핀과 겹친다).
      const { renderOverlays } = useMapOverlays()
      renderOverlays(projMap, ['가', '나', '다'].map((name, i) =>
        regionItem({ name, avgPricePerPyeong: 1000, transactionCount: 100 - i, lat: 100, lng: 100 })))
      expect(created.map((o) => o.opts.content.className)).toEqual([
        'map-region-bubble', 'map-region-bubble map-region-bubble--below', 'map-price-dot',
      ])
      expect(created[2].opts.content.title).toBe('다 1,000만/평')
    })

    it('옆 핀과 살짝 겹치면 좌우로 민 자리에 꼬리를 옮겨 놓는다', () => {
      const { renderOverlays } = useMapOverlays()
      // 서울 위·아래를 이미 다른 핀이 차지한 상태에서, 오른쪽으로 약간 떨어진 강원은 좌표 오른쪽으로 민다.
      renderOverlays(projMap, [
        regionItem({ name: '서울', avgPricePerPyeong: 1000, transactionCount: 900, lat: 100, lng: 100 }),
        regionItem({ name: '인천', avgPricePerPyeong: 1000, transactionCount: 800, lat: 100, lng: 100 }),
        regionItem({ name: '강원', avgPricePerPyeong: 1000, transactionCount: 10, lat: 100, lng: 200 }),
      ])
      const gangwon = created[2]
      expect(gangwon.opts.content.className).toBe('map-region-bubble')
      expect(gangwon.opts.xAnchor).toBe(0.15)
      expect(gangwon.opts.content.style.getPropertyValue('--tail-x')).toBe('15%')
    })

    it('실좌표 회귀: 경기가 거래가 많아 먼저 자리를 잡아도, 서울 좌표가 그 말풍선 안이면 경기가 아래로 비켜 서울·경기 둘 다 보인다', () => {
      // 전국 뷰(level 13, 1440px)의 근사 투영: 경도 1° ≈ 80px, 위도 1° ≈ 100px. 좌표·거래 수는 로컬 실측.
      const level13 = {
        id: 'level13',
        getProjection: () => ({
          containerPointFromCoords: (ll: FakeLatLng) => ({ x: (ll.lng - 124) * 80, y: (39 - ll.lat) * 100 }),
        }),
      }
      const { renderOverlays } = useMapOverlays()
      renderOverlays(level13, [
        regionItem({ name: '경기', avgPricePerPyeong: 2403, transactionCount: 16325, lat: 37.43, lng: 127.03 }),
        regionItem({ name: '서울', avgPricePerPyeong: 4999, transactionCount: 4459, lat: 37.55, lng: 126.99 }),
        regionItem({ name: '인천', avgPricePerPyeong: 1878, transactionCount: 3261, lat: 37.51, lng: 126.64 }),
      ])
      const byName = Object.fromEntries(created.map((o) => {
        const el = o.opts.content as HTMLElement
        return [el.querySelector('.map-region-bubble-name')?.textContent ?? el.title, o]
      }))
      expect(byName['서울'].opts.content.className).toContain('map-region-bubble')
      expect(byName['경기'].opts.content.className).toContain('map-region-bubble')
      expect(byName['경기'].opts.yAnchor).toBe(0)
      // 핀 좌표는 서버 좌표 그대로다 — 뷰포트 판정과 핀 위치가 어긋나지 않는다.
      expect(byName['경기'].opts.position.lat).toBe(37.43)
      expect(byName['서울'].opts.position.lat).toBe(37.55)
    })

    it('단지 단계: 선택된 단지 > 거래 많은 단지 순으로 자리를 잡는다', () => {
      const { renderOverlays } = useMapOverlays()
      renderOverlays(projMap, [
        saleBuilding(50000, { buildingName: 'BIG', transactionCount: 900, lat: 100, lng: 100 }),
        saleBuilding(60000, { buildingName: 'MID', transactionCount: 400, lat: 100, lng: 100 }),
        saleBuilding(70000, { buildingName: 'SEL', transactionCount: 1, lat: 100, lng: 100 }),
      ], {}, { type: 'apt-sale', selectedKey: 'SEL|1168010300', now: NOW })
      const classes = created.map((o) => o.opts.content.className)
      // 그리는 순서는 원래 순서 + 선택 맨 뒤, 자리는 선택이 먼저 잡아 나머지는 점이 된다.
      expect(classes).toEqual(['map-price-dot', 'map-price-dot', 'map-popup'])

      created = []
      renderOverlays(projMap, [
        saleBuilding(60000, { buildingName: 'MID', transactionCount: 400, lat: 100, lng: 100 }),
        saleBuilding(50000, { buildingName: 'BIG', transactionCount: 900, lat: 100, lng: 100 }),
      ], {}, { type: 'apt-sale', now: NOW })
      expect(created.map((o) => [nameOf(o.opts.content) ?? o.opts.content.title, o.opts.content.className])).toEqual([
        ['MID 6억', 'map-price-dot'],
        ['BIG', 'map-price-label'],
      ])
    })
  })
})
