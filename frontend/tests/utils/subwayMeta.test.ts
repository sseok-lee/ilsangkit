import { describe, it, expect } from 'vitest'
import { buildSubwayDescription, buildSubwayTitle } from '~/utils/subwayMeta'
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

describe('buildSubwayTitle — region suffix', () => {
  it('역명·호선·지역(시축약 구)·브랜드를 포함한다', () => {
    expect(buildSubwayTitle(makeStation())).toBe('강남역 (2호선) | 서울 강남구 | 일상킷')
  })

  it('full city form(서울특별시) 대신 compact(서울)을 쓴다', () => {
    const title = buildSubwayTitle(makeStation())
    expect(title).toContain('서울 강남구')
    expect(title).not.toContain('서울특별시')
  })

  it('지역 정보가 없으면 지역 세그먼트를 생략한다', () => {
    expect(buildSubwayTitle(makeStation({ city: null, district: null }))).toBe('강남역 (2호선) | 일상킷')
  })

  it('역명이 이미 "역"으로 끝나면 중복 접미하지 않는다', () => {
    const title = buildSubwayTitle(makeStation({ name: '시청역', line: '1호선', district: '중구' }))
    expect(title).toBe('시청역 (1호선) | 서울 중구 | 일상킷')
    expect(title).not.toContain('역역')
  })
})

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

  it('uses compact city name (서울 강남구), not full form (서울특별시)', () => {
    const desc = buildSubwayDescription(makeStation())
    expect(desc).toContain('서울 강남구')
    expect(desc).not.toContain('서울특별시')
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
