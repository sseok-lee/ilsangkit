import { describe, expect, it } from 'vitest'
import type { CityData } from '~/composables/useRegions'
import {
  normalizeSubscriptionQuery,
  subscriptionApiParams,
  subscriptionListKey,
  subscriptionScopeForPath,
} from '~/utils/subscriptionListQuery'

const cities: CityData[] = [
  {
    slug: 'seoul',
    name: '서울',
    districts: [
      { slug: 'gangnam-gu', name: '강남구', lat: 37.5172, lng: 127.0473, bjdCode: '11680' },
    ],
  },
  {
    slug: 'gyeonggi',
    name: '경기',
    districts: [
      { slug: 'suwon-si', name: '수원시', lat: 37.2636, lng: 127.0286, bjdCode: '41110' },
    ],
  },
]

describe('subscriptionListQuery', () => {
  it('normalizes valid filters and omits defaults from the shareable query', () => {
    const scope = { category: 'sale' as const, type: 'apt', sourceType: 'APT' as const }
    const result = normalizeSubscriptionQuery({
      q: '  한강   자이  ',
      city: '서울',
      district: '강남구',
      status: 'ongoing',
      sort: 'deadline',
    }, scope, cities)

    expect(result.keywordError).toBeNull()
    expect(result.filters).toEqual({
      q: '한강 자이',
      city: '서울',
      district: '강남구',
      status: 'ongoing',
      sort: 'deadline',
    })
    expect(result.query).toEqual({
      q: '한강 자이',
      city: '서울',
      district: '강남구',
      status: 'ongoing',
      sort: 'deadline',
    })

    const defaults = normalizeSubscriptionQuery({
      q: '',
      city: '',
      district: '',
      status: 'all',
      sort: 'priority',
    }, scope, cities)
    expect(defaults.query).toEqual({})
  })

  it('drops unknown city and district without a valid parent city', () => {
    const scope = { category: 'rent' as const }

    expect(normalizeSubscriptionQuery({ city: '부산', district: '해운대구' }, scope, cities).filters)
      .toMatchObject({ city: '', district: '' })
    expect(normalizeSubscriptionQuery({ district: '강남구' }, scope, cities).filters)
      .toMatchObject({ city: '', district: '' })
    expect(normalizeSubscriptionQuery({ city: '경기', district: '강남구' }, scope, cities).filters)
      .toMatchObject({ city: '경기', district: '' })
  })

  it('selects the exact first repeated query entry', () => {
    const scope = { category: 'sale' as const }
    const result = normalizeSubscriptionQuery({
      q: [null, ' 첫번째 ', '두번째'],
      city: [undefined, '서울', '경기'],
      district: ['강남구', '수원시'],
      status: ['closed', 'ongoing'],
      sort: ['recent', 'deadline'],
    }, scope, cities)

    expect(result.filters).toMatchObject({
      q: '',
      city: '',
      district: '',
      status: 'closed',
      sort: 'recent',
    })
  })

  it('keeps unknown only for rent all and public rent scopes', () => {
    expect(normalizeSubscriptionQuery(
      { status: 'unknown' },
      { category: 'rent' },
      cities,
    ).filters.status).toBe('unknown')
    expect(normalizeSubscriptionQuery(
      { status: 'unknown' },
      { category: 'rent', type: 'public', rentType: '임대주택' },
      cities,
    ).filters.status).toBe('unknown')
    expect(normalizeSubscriptionQuery(
      { status: 'unknown' },
      { category: 'rent', type: 'private', sourceType: 'PRIVATE_RENT' },
      cities,
    ).filters.status).toBe('all')
    expect(normalizeSubscriptionQuery(
      { status: 'unknown' },
      { category: 'rent', sourceType: 'PRIVATE_RENT' },
      cities,
    ).filters.status).toBe('all')
    expect(normalizeSubscriptionQuery(
      { status: 'unknown' },
      { category: 'sale', type: 'apt', sourceType: 'APT' },
      cities,
    ).filters.status).toBe('all')
  })

  it('selects the first repeated query string when it exists', () => {
    const scope = { category: 'sale' as const }
    const result = normalizeSubscriptionQuery({
      q: [' 첫번째 ', '두번째'],
      city: ['서울', '경기'],
      district: ['강남구', '수원시'],
      status: ['closed', 'ongoing'],
      sort: ['recent', 'deadline'],
    }, scope, cities)

    expect(result.filters).toMatchObject({
      q: '첫번째',
      city: '서울',
      district: '강남구',
      status: 'closed',
      sort: 'recent',
    })
  })

  it('clears unknown status when resolving a sale type filter', () => {
    const scope = { category: 'sale' as const, type: 'apt', sourceType: 'APT' as const }

    expect(normalizeSubscriptionQuery({ status: 'unknown' }, scope, cities).filters.status).toBe('all')
  })

  it('reports a keyword error over 100 characters and excludes q from the shareable query', () => {
    const scope = { category: 'rent' as const }
    const result = normalizeSubscriptionQuery({ q: '가'.repeat(101) }, scope, cities)

    expect(result.filters.q).toBe('가'.repeat(101))
    expect(result.keywordError).toBe('검색어는 100자 이하로 입력해 주세요.')
    expect(result.query.q).toBeUndefined()
  })

  it('keeps apartment-sale classification even with a source filter', () => {
    const params = subscriptionApiParams(
      { category: 'sale', type: 'apt', sourceType: 'APT' },
      { q: '한강', city: '서울', district: '강남구', status: 'all', sort: 'priority' },
      1,
    )
    expect(params).toMatchObject({ category: 'sale', sourceType: 'APT', q: '한강', region: '서울 강남구', sort: 'priority', page: 1, limit: 20 })
    expect(params.status).toBeUndefined()
  })

  it('includes scope and normalized filters in the list key', () => {
    expect(subscriptionListKey(
      { category: 'rent', type: 'public', rentType: '임대주택' },
      { q: '한강', city: '서울', district: '강남구', status: 'ongoing', sort: 'deadline' },
    )).toBe('rent:public::임대주택:한강:서울:강남구:ongoing:deadline')
  })

  it('resolves only valid subscription type paths', () => {
    expect(subscriptionScopeForPath('/subscription/sale/apt')).toEqual({
      category: 'sale',
      type: 'apt',
      sourceType: 'APT',
    })
    expect(subscriptionScopeForPath('/subscription/rent/public')).toEqual({
      category: 'rent',
      type: 'public',
      rentType: '임대주택',
    })
    expect(subscriptionScopeForPath('/subscription/sale/unknown')).toBeNull()
    expect(subscriptionScopeForPath('/subscription/rent/apt')).toBeNull()
    expect(subscriptionScopeForPath('/subscription/sale/apt/extra')).toBeNull()
    expect(subscriptionScopeForPath('/subscription')).toBeNull()
  })
})
