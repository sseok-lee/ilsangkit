import { describe, it, expect } from 'vitest'
import { buildSubwayDescription } from '~/utils/subwayMeta'
import type { SubwayStation } from '~/types/subway'

function makeStation(overrides: Partial<SubwayStation> = {}): SubwayStation {
  return {
    id: 'gangnam-2',
    sourceId: 'src-1',
    name: '강남',
    nameSlug: 'gangnam',
    line: '2호선',
    transferLines: [],
    lat: 37.4979,
    lng: 127.0276,
    city: '서울특별시',
    district: '강남구',
    address: null,
    roadAddress: null,
    operator: '서울교통공사',
    phoneNumber: null,
    regionSlug: 'seoul/gangnam',
    dataDate: null,
    updatedAt: '2024-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('buildSubwayDescription — prose shape (Fix 3b)', () => {
  it('contains "지하철역입니다" (prose opening)', () => {
    const desc = buildSubwayDescription(makeStation())
    expect(desc).toContain('지하철역입니다')
  })

  it('does NOT start with raw "정보 ·" dump pattern', () => {
    const desc = buildSubwayDescription(makeStation())
    expect(desc).not.toMatch(/^강남역 2호선 정보/)
    expect(desc).not.toMatch(/정보 ·/)
  })

  it('contains station name', () => {
    const desc = buildSubwayDescription(makeStation())
    expect(desc).toContain('강남')
  })

  it('contains transfer info when transferLines present', () => {
    const desc = buildSubwayDescription(makeStation({ transferLines: ['3호선', '신분당선'] }))
    expect(desc).toContain('3호선')
    expect(desc).toContain('신분당선')
    expect(desc).toContain('환승')
  })

  it('works without transfer lines', () => {
    const desc = buildSubwayDescription(makeStation({ transferLines: [] }))
    expect(desc).toContain('지하철역입니다')
    expect(desc).not.toContain('환승이 가능하며')
  })

  it('works without city/district', () => {
    const desc = buildSubwayDescription(makeStation({ city: null, district: null }))
    expect(desc).toContain('지하철역입니다')
  })

  it('ends with 확인하세요', () => {
    const desc = buildSubwayDescription(makeStation())
    expect(desc).toMatch(/확인하세요\.?$/)
  })
})
