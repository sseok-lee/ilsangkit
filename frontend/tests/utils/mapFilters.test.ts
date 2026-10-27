import { describe, it, expect } from 'vitest'
import {
  AREA_OPTIONS, SALE_PRICE_OPTIONS, JEONSE_PRICE_OPTIONS, WOLSE_PRICE_OPTIONS,
  sanitizeMapFilter, mapFilterParams, isMapFilterActive, areaLabel, priceLabel, priceMenuGroups,
} from '~/utils/mapFilters'

describe('mapFilters 구간', () => {
  // 백엔드 schemas/realEstateMap.ts AREA_BUCKETS·PRICE_BUCKETS 와 같아야 한다 — 다르면 API 422.
  it('구간 id 가 백엔드와 같다', () => {
    expect(AREA_OPTIONS.map((o) => o.id)).toEqual(['0-60', '60-85', '85-135', '135-'])
    expect(SALE_PRICE_OPTIONS.map((o) => o.id)).toEqual(['0-30000', '30000-60000', '60000-90000', '90000-150000', '150000-250000', '250000-'])
    expect(JEONSE_PRICE_OPTIONS.map((o) => o.id)).toEqual(['0-10000', '10000-30000', '30000-50000', '50000-80000', '80000-'])
    expect(WOLSE_PRICE_OPTIONS.map((o) => o.id)).toEqual(['0-50', '50-100', '100-'])
  })

  it('운영자 문구', () => {
    expect(AREA_OPTIONS.map((o) => o.label)).toEqual(['60㎡ 이하', '60~85㎡', '85~135㎡', '135㎡ 초과'])
    expect(SALE_PRICE_OPTIONS.map((o) => o.label)).toEqual(['3억 이하', '3~6억', '6~9억', '9~15억', '15~25억', '25억 초과'])
    expect(WOLSE_PRICE_OPTIONS.map((o) => o.label)).toEqual(['50만 이하', '50~100만', '100만 초과'])
  })
})

describe('sanitizeMapFilter — 유형 전환 시 가격만 초기화', () => {
  it('매매 → 전월세: 면적 유지, 매매 가격 버림', () => {
    expect(sanitizeMapFilter('apt-rent', { area: '60-85', price: '30000-60000', priceKind: null }))
      .toEqual({ area: '60-85', price: null, priceKind: null })
  })

  it('전월세 → 매매: 전세 가격 버림', () => {
    expect(sanitizeMapFilter('villa-sale', { area: null, price: '10000-30000', priceKind: 'jeonse' }))
      .toEqual({ area: null, price: null, priceKind: null })
  })

  it('같은 거래 축(아파트 전월세 → 빌라 전월세)은 가격 유지', () => {
    expect(sanitizeMapFilter('villa-rent', { area: '0-60', price: '50-100', priceKind: 'wolse' }))
      .toEqual({ area: '0-60', price: '50-100', priceKind: 'wolse' })
  })

  it('종류와 구간이 안 맞거나 모르는 값이면 버린다', () => {
    expect(sanitizeMapFilter('apt-rent', { price: '0-10000', priceKind: 'wolse' }).price).toBeNull()
    expect(sanitizeMapFilter('apt-rent', { price: '0-10000' }).price).toBeNull()
    expect(sanitizeMapFilter('apt-sale', { area: '1-2' }).area).toBeNull()
    expect(sanitizeMapFilter('apt-sale', null)).toEqual({ area: null, price: null, priceKind: null })
  })
})

describe('mapFilterParams', () => {
  it('필터가 없으면 빈 객체(예전 요청과 같은 URL)', () => {
    expect(mapFilterParams({ area: null, price: null, priceKind: null })).toEqual({})
  })

  it('매매는 priceKind 없이, 전월세는 priceKind 와 함께', () => {
    expect(mapFilterParams({ area: '60-85', price: '0-30000', priceKind: null })).toEqual({ area: '60-85', price: '0-30000' })
    expect(mapFilterParams({ area: null, price: '80000-', priceKind: 'jeonse' })).toEqual({ price: '80000-', priceKind: 'jeonse' })
  })

  it('isMapFilterActive', () => {
    expect(isMapFilterActive({ area: null, price: null, priceKind: null })).toBe(false)
    expect(isMapFilterActive({ area: '135-', price: null, priceKind: null })).toBe(true)
  })
})

describe('칩 문구·메뉴 묶음', () => {
  it('면적·가격 라벨, 전월세는 종류를 붙인다', () => {
    expect(areaLabel('60-85')).toBe('60~85㎡')
    expect(areaLabel(null)).toBeNull()
    expect(priceLabel('apt-sale', { area: null, price: '90000-150000', priceKind: null })).toBe('9~15억')
    expect(priceLabel('apt-rent', { area: null, price: '30000-50000', priceKind: 'jeonse' })).toBe('전세 3~5억')
    expect(priceLabel('apt-rent', { area: null, price: '0-50', priceKind: 'wolse' })).toBe('월세 50만 이하')
  })

  it('매매는 한 묶음, 전월세는 전세 보증금·월세액 두 묶음', () => {
    expect(priceMenuGroups('offitel-sale').map((g) => g.title)).toEqual([null])
    expect(priceMenuGroups('offitel-rent').map((g) => [g.kind, g.title])).toEqual([['jeonse', '전세 보증금'], ['wolse', '월세액']])
  })
})
