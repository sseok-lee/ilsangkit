import { describe, it, expect } from 'vitest'
import { formatPriceLabel, formatPyeongLabel } from '~/composables/useMapOverlays'
import type { MapBuildingItem, MapRegionItem } from '~/types/realEstateMap'

function building(over: Partial<MapBuildingItem>): MapBuildingItem {
  return {
    buildingName: 'A', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: null, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 1,
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
    name: '서울', district: null, lat: 37.5, lng: 127, avgPricePerPyeong: p, transactionCount: 10,
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
