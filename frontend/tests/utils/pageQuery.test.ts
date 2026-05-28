import { describe, expect, it } from 'vitest'
import {
  normalizePageQueryForUrl,
  parsePositivePageQuery,
} from '~/utils/pageQuery'

describe('parsePositivePageQuery', () => {
  it('accepts strict positive integer strings', () => {
    expect(parsePositivePageQuery('2')).toBe(2)
    expect(parsePositivePageQuery('1204')).toBe(1204)
  })

  it('normalizes leading-zero positive integers', () => {
    expect(parsePositivePageQuery('0012')).toBe(12)
  })

  it('recovers duplicated malformed page query values when the number is repeated', () => {
    expect(parsePositivePageQuery('1204?page=1204')).toBe(1204)
    expect(parsePositivePageQuery('1204?page=1204?page=1204')).toBe(1204)
  })

  it('treats invalid, zero, negative, or conflicting values as page 1', () => {
    expect(parsePositivePageQuery(undefined)).toBe(1)
    expect(parsePositivePageQuery('')).toBe(1)
    expect(parsePositivePageQuery('0')).toBe(1)
    expect(parsePositivePageQuery('-1')).toBe(1)
    expect(parsePositivePageQuery('123abc')).toBe(1)
    expect(parsePositivePageQuery('1204?page=7')).toBe(1)
  })
})

describe('normalizePageQueryForUrl', () => {
  it('leaves canonical page 2+ list URLs unchanged', () => {
    expect(normalizePageQueryForUrl('/pharmacy', '?page=2')).toBeNull()
    expect(normalizePageQueryForUrl('/seoul/gangnam/pharmacy', '?page=3')).toBeNull()
  })

  it('removes page=1 from list URLs', () => {
    expect(normalizePageQueryForUrl('/pharmacy', '?page=1')).toBe('/pharmacy')
    expect(normalizePageQueryForUrl('/seoul/gangnam/pharmacy', '?page=1')).toBe('/seoul/gangnam/pharmacy')
  })

  it('canonicalizes leading zeros and duplicated malformed page query values', () => {
    expect(normalizePageQueryForUrl('/pharmacy', '?page=0012')).toBe('/pharmacy?page=12')
    expect(normalizePageQueryForUrl('/pharmacy', '?page=1204?page=1204')).toBe('/pharmacy?page=1204')
  })

  it('removes invalid page values while preserving other query parameters', () => {
    expect(normalizePageQueryForUrl('/pharmacy', '?page=abc&city=seoul')).toBe('/pharmacy?city=seoul')
    expect(normalizePageQueryForUrl('/pharmacy', '?city=seoul&page=0')).toBe('/pharmacy?city=seoul')
  })

  it('does not normalize detail, API, sitemap, or non-facility paths', () => {
    expect(normalizePageQueryForUrl('/pharmacy/pharmacy-1', '?page=2')).toBeNull()
    expect(normalizePageQueryForUrl('/api/facilities/search', '?page=2')).toBeNull()
    expect(normalizePageQueryForUrl('/sitemap/pharmacy-1.xml', '?page=2')).toBeNull()
    expect(normalizePageQueryForUrl('/about', '?page=2')).toBeNull()
  })
})
