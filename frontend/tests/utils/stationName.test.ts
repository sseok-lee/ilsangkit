import { describe, it, expect } from 'vitest'
import { withStationSuffix } from '~/utils/stationName'

describe('withStationSuffix — 표시 역명은 끝 "역" 1개 보장', () => {
  it('"역" 이 없으면 붙인다', () => {
    expect(withStationSuffix('강남')).toBe('강남역')
  })

  it('"역" 이 이미 있으면 그대로(이중 "역역" 방지)', () => {
    expect(withStationSuffix('가산디지털단지역')).toBe('가산디지털단지역')
  })

  it('앞뒤 공백을 다듬는다', () => {
    expect(withStationSuffix(' 역삼 ')).toBe('역삼역')
    expect(withStationSuffix('역삼역 ')).toBe('역삼역')
  })

  it('빈 이름이나 "역" 하나뿐이면 빈 문자열', () => {
    expect(withStationSuffix('')).toBe('')
    expect(withStationSuffix('역')).toBe('')
  })
})
