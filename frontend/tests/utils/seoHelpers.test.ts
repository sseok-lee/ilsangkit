import { describe, it, expect } from 'vitest'
import { formatPrice, generateAreaDescription } from '~/utils/seoHelpers'

describe('formatPrice', () => {
  it('1234000000 → "12.3억원"', () => {
    expect(formatPrice(1234000000)).toBe('12.3억원')
  })

  it('500000000 → "5억원"', () => {
    expect(formatPrice(500000000)).toBe('5억원')
  })

  it('0 → 빈 문자열', () => {
    expect(formatPrice(0)).toBe('')
  })

  it('음수 → 빈 문자열', () => {
    expect(formatPrice(-1000000)).toBe('')
  })

  it('1억 미만은 만원 단위로 반환', () => {
    const result = formatPrice(5000000)
    expect(result).toContain('만원')
  })

  it('정확히 1억 → "1억원"', () => {
    expect(formatPrice(100000000)).toBe('1억원')
  })
})

describe('generateAreaDescription', () => {
  it('병원, 약국 통계와 총 시설 수를 포함한다', () => {
    const result = generateAreaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: { hospital: 100, pharmacy: 50 },
      totalFacilities: 500,
    })
    expect(result).toContain('병원 100곳')
    expect(result).toContain('약국 50곳')
    expect(result).toContain('500곳')
  })

  it('빈 통계 객체이면 빈 문자열을 반환한다', () => {
    const result = generateAreaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: {},
    })
    expect(result).toBe('')
  })

  it('facilityStats 없으면 빈 문자열을 반환한다', () => {
    const result = generateAreaDescription({
      city: '서울',
      district: '강남구',
    })
    expect(result).toBe('')
  })

  it('도시와 구 이름을 포함한다', () => {
    const result = generateAreaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: { hospital: 10 },
    })
    expect(result).toContain('서울')
    expect(result).toContain('강남구')
  })

  it('avgAptPrice가 있으면 아파트 매매가 포함한다', () => {
    const result = generateAreaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: { hospital: 10 },
      avgAptPrice: 1000000000,
    })
    expect(result).toContain('억원')
  })

  it('totalFacilities 없으면 총 N곳 대신 기본 문구 사용', () => {
    const result = generateAreaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: { hospital: 10 },
    })
    expect(result).toContain('생활시설이 등록되어 있습니다')
  })
})
