import { describe, it, expect } from 'vitest'
import {
  resolveDataSource,
  FACILITY_DATA_SOURCE,
  REAL_ESTATE_DATA_SOURCE,
  SUBSCRIPTION_DATA_SOURCE,
  PUBLIC_RENTAL_DATA_SOURCE,
} from './dataSource'

describe('resolveDataSource', () => {
  it('facility 도메인 + category로 해당 시설 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'facility', category: 'pharmacy' }))
      .toBe(FACILITY_DATA_SOURCE.pharmacy)
  })

  it('facility 도메인인데 category가 없으면 null을 반환한다', () => {
    expect(resolveDataSource({ domain: 'facility' })).toBeNull()
  })

  it('facility 도메인 + 알 수 없는 category면 null을 반환한다', () => {
    // @ts-expect-error 의도적으로 잘못된 category
    expect(resolveDataSource({ domain: 'facility', category: 'nope' })).toBeNull()
  })

  it('real-estate 도메인은 부동산 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'real-estate' })).toBe(REAL_ESTATE_DATA_SOURCE)
  })

  it('subscription 도메인은 청약 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'subscription' })).toBe(SUBSCRIPTION_DATA_SOURCE)
  })

  it('public-rental 도메인은 공공임대 출처를 반환한다', () => {
    expect(resolveDataSource({ domain: 'public-rental' })).toBe(PUBLIC_RENTAL_DATA_SOURCE)
  })
})
