import { describe, it, expect } from 'vitest'
import {
  resolveSearchScope,
  buildSearchDestination,
  scopeSuggestParam,
  scopePlaceholder,
} from '~/utils/searchScope'

describe('resolveSearchScope', () => {
  it('/[category] index → facility(그 카테고리)', () => {
    const s = resolveSearchScope({ path: '/toilet', params: { category: 'toilet' }, query: {} })
    expect(s).toEqual({ kind: 'facility', category: 'toilet', citySlug: undefined })
  })
  it('/[category]/[id] 상세 → facility(그 카테고리)', () => {
    const s = resolveSearchScope({ path: '/toilet/123', params: { category: 'toilet', id: '123' }, query: {} })
    expect(s.kind).toBe('facility')
    if (s.kind === 'facility') expect(s.category).toBe('toilet')
  })
  it('/[city]/[district]/[category] → facility + 컨텍스트 citySlug(params.city)', () => {
    const s = resolveSearchScope({ path: '/seoul/gangnam/toilet', params: { city: 'seoul', district: 'gangnam', category: 'toilet' }, query: {} })
    expect(s).toEqual({ kind: 'facility', category: 'toilet', citySlug: 'seoul' })
  })
  it('/[category]?city=seoul → facility + query.city 를 citySlug 로', () => {
    const s = resolveSearchScope({ path: '/toilet', params: { category: 'toilet' }, query: { city: 'seoul' } })
    expect(s).toEqual({ kind: 'facility', category: 'toilet', citySlug: 'seoul' })
  })
  it('/trash/[id] 전용 라우트(category 파라미터 없음) → path fallback 으로 facility(trash)', () => {
    const s = resolveSearchScope({ path: '/trash/6693', params: { id: '6693' }, query: {} })
    expect(s.kind).toBe('facility')
    if (s.kind === 'facility') expect(s.category).toBe('trash')
  })
  it('subway 는 시설 스코프에서 제외 → realestate (스펙 §8)', () => {
    expect(resolveSearchScope({ path: '/subway/1-2', params: { slug: '1-2' }, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/subway', params: { category: 'subway' }, query: {} })).toEqual({ kind: 'realestate' })
  })
  it('홈/가이드/부동산/검색 → realestate 기본', () => {
    expect(resolveSearchScope({ path: '/', params: {}, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/guide', params: {}, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/real-estate/apt-sale', params: { realEstateType: 'apt-sale' }, query: {} })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/search', params: {}, query: { keyword: 'x' } })).toEqual({ kind: 'realestate' })
    expect(resolveSearchScope({ path: '/seoul/gangnam', params: { city: 'seoul', district: 'gangnam' }, query: {} })).toEqual({ kind: 'realestate' })
  })
})

describe('buildSearchDestination', () => {
  it('facility → /{category}?keyword= (citySlug 있으면 &city= 부가)', () => {
    expect(buildSearchDestination({ kind: 'facility', category: 'toilet' }, '강남')).toBe('/toilet?keyword=' + encodeURIComponent('강남'))
    expect(buildSearchDestination({ kind: 'facility', category: 'toilet', citySlug: 'seoul' }, '역삼')).toBe('/toilet?keyword=' + encodeURIComponent('역삼') + '&city=seoul')
  })
  it('realestate → /search?keyword=', () => {
    expect(buildSearchDestination({ kind: 'realestate' }, '래미안')).toBe('/search?keyword=' + encodeURIComponent('래미안'))
  })
  it('keyword 는 trim 후 인코딩', () => {
    expect(buildSearchDestination({ kind: 'realestate' }, '  강남 래미안  ')).toBe('/search?keyword=' + encodeURIComponent('강남 래미안'))
  })
})

describe('scopeSuggestParam', () => {
  it('facility → facility:{category}, realestate → realestate', () => {
    expect(scopeSuggestParam({ kind: 'facility', category: 'toilet' })).toBe('facility:toilet')
    expect(scopeSuggestParam({ kind: 'realestate' })).toBe('realestate')
  })
})

describe('scopePlaceholder', () => {
  it('facility 는 카테고리 shortLabel, realestate 는 부동산 문구', () => {
    expect(scopePlaceholder({ kind: 'facility', category: 'toilet' })).toContain('화장실')
    expect(scopePlaceholder({ kind: 'realestate' })).toBe('아파트·단지·지역 검색')
  })
})
