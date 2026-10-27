import { describe, it, expect } from 'vitest'
import { buildMapLocationPath } from '~/utils/mapLocationPath'
import type { MapBuildingItem, MapRegionItem } from '~/types/realEstateMap'

function building(over: Partial<MapBuildingItem>): MapBuildingItem {
  return {
    buildingName: 'A', city: '서울', district: '서초구', dongName: '서초동', bjdCode: '1165010800',
    lat: 37.49, lng: 127.01, latestPrice: null, monthlyRent: null,
    latestDealYear: null, latestDealMonth: null, latestDealDay: null, transactionCount: 1,
    jeonseDeposit: null, jeonseDealKey: null, wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
    ...over,
  }
}

function region(over: Partial<MapRegionItem>): MapRegionItem {
  return { name: '서울', district: null, dong: null, lat: 37.5, lng: 127, avgPricePerPyeong: 5000, transactionCount: 10, ...over }
}

const CENTER = { lat: 37.49, lng: 127.01 }

describe('buildMapLocationPath', () => {
  it('시·도 단계는 "전국" 한 칸(현재 위치, 링크 아님)', () => {
    expect(buildMapLocationPath('city', [], CENTER, 'apt-sale')).toEqual([
      { label: '전국', href: null, level: null },
    ])
  })

  it('단지 단계는 전국 › 시·도 › 구·군 › 동 — 상위 칸은 목록 허브 링크와 올라갈 level 을 갖는다', () => {
    const path = buildMapLocationPath('building', [building({})], CENTER, 'apt-sale')
    expect(path?.map((c) => c.label)).toEqual(['전국', '서울', '서초구', '서초동'])
    expect(path?.map((c) => c.href)).toEqual([
      '/real-estate/apt-sale', '/real-estate/apt-sale/seoul', '/real-estate/apt-sale/seoul/seocho', null,
    ])
    expect(path?.map((c) => c.level)).toEqual([13, 9, 7, null])
  })

  it('지도 중심에서 가장 가까운 항목의 지역을 쓴다', () => {
    const far = building({ buildingName: 'far', district: '강남구', dongName: '역삼동', lat: 37.6, lng: 127.2 })
    const near = building({ buildingName: 'near', lat: 37.491, lng: 127.011 })
    expect(buildMapLocationPath('building', [far, near], CENTER, 'apt-sale')?.at(-1)?.label).toBe('서초동')
  })

  it('구·군 단계는 전국 › 시·도, 동 단계는 전국 › 시·도 › 구·군', () => {
    expect(buildMapLocationPath('district', [region({ district: '서초구' })], CENTER, 'villa-rent')?.map((c) => c.label))
      .toEqual(['전국', '서울'])
    const dong = buildMapLocationPath('dong', [region({ district: '서초구', dong: '서초동' })], CENTER, 'villa-rent')
    expect(dong?.map((c) => c.label)).toEqual(['전국', '서울', '서초구'])
    expect(dong?.[1].href).toBe('/real-estate/villa-rent/seoul')
  })

  it('통합시는 목록과 같은 짧은 이름으로 보인다', () => {
    const path = buildMapLocationPath('district', [region({ name: '전남광주통합특별시', district: '북구', lat: 35.17, lng: 126.91 })], { lat: 35.17, lng: 126.91 }, 'apt-sale')
    expect(path?.[1].label).toBe('전남·광주')
  })

  it('좌표 있는 항목이 없으면 위치를 정할 수 없어 null(숨김)', () => {
    expect(buildMapLocationPath('building', [], CENTER, 'apt-sale')).toBeNull()
    expect(buildMapLocationPath('dong', [region({ lat: null, lng: null })], CENTER, 'apt-sale')).toBeNull()
  })
})
