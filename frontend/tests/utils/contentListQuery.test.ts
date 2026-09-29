import { describe, expect, it } from 'vitest'
import { CONTENT_TOPICS, contentListHref, contentListQuery, contentListRequest, normalizeContentListQuery } from '~/utils/contentListQuery'

describe('content list URL contract', () => {
  it('maps existing topics and preserves server pagination', () => {
    expect(contentListRequest(normalizeContentListQuery({ topic: 'parking', page: '2' }))).toEqual({ page: 2, limit: 12, categories: ['parking', 'ev-charger'] })
    expect(contentListRequest({ topic: '', page: 1 })).toEqual({ page: 1, limit: 12 })
    expect(CONTENT_TOPICS.map(topic => topic.key)).toEqual(['', 'real-estate', 'subscription', 'health', 'parking', 'env'])
    expect(contentListRequest({ topic: 'subscription', page: 1 }).categories).toEqual(['subscription', 'sale', 'rent'])
    expect(contentListRequest({ topic: 'real-estate', page: 1 }).categories).toEqual(['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'])
    expect(contentListRequest({ topic: 'health', page: 1 }).categories).toEqual(['hospital', 'pharmacy', 'aed'])
    expect(contentListRequest({ topic: 'env', page: 1 }).categories).toEqual(['trash', 'clothes'])
  })
  it('normalizes array values, whitespace, unknown topics and invalid pages', () => {
    expect(normalizeContentListQuery({ topic: [' parking ', 'env'], page: ['2', '3'] })).toEqual({ topic: 'parking', page: 2 })
    expect(normalizeContentListQuery({ topic: 'unknown', page: '-1' })).toEqual({ topic: '', page: 1 })
    for (const page of ['0', '2.5', '2x', 'Infinity', '9007199254740992']) {
      expect(normalizeContentListQuery({ page }).page).toBe(1)
    }
  })
  it('omits defaults and generates navigable links for both content types', () => {
    expect(contentListQuery({ topic: '', page: 1 })).toEqual({})
    expect(contentListHref('guide', { topic: '', page: 1 })).toBe('/guide')
    expect(contentListHref('article', { topic: 'health', page: 2 })).toBe('/article?topic=health&page=2')
    expect(contentListQuery({ topic: 'env', page: 1 })).toEqual({ topic: 'env' })
  })
})
