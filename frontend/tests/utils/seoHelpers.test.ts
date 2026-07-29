import { describe, it, expect } from 'vitest'
import {
  formatPrice,
  generateAreaDescription,
  buildDistrictMetaDescription,
  buildCityMetaDescription,
} from '~/utils/seoHelpers'

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

// 네이버 진단 "중복 설명문" 대응: 구·군/시도 허브 283페이지의 meta description 이
// 지역 토큰만 다른 보일러플레이트였다. 실데이터를 앞세워 차별화하되,
// 데이터가 없을 때는 기존 문구로 폴백해 빈 description 을 만들지 않는다.
describe('buildDistrictMetaDescription', () => {
  const stats = { hospital: 1234, pharmacy: 567, school: 89, park: 45 }

  it('시설 통계와 총 시설 수를 앞세운다', () => {
    const result = buildDistrictMetaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: stats,
      totalFacilities: 5678,
    })
    expect(result).toContain('서울 강남구')
    expect(result).toContain('병원 1,234곳')
    expect(result).toContain('5,678곳')
  })

  it('통계 항목은 3개까지만 넣어 설명문 길이를 제한한다', () => {
    const result = buildDistrictMetaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: stats,
      totalFacilities: 5678,
    })
    expect(result).toContain('병원 1,234곳')
    expect(result).toContain('약국 567곳')
    expect(result).toContain('학교 89곳')
    expect(result).not.toContain('공원 45곳')
  })

  it('서로 다른 지역은 서로 다른 설명문을 만든다 (중복 방지 핵심)', () => {
    const a = buildDistrictMetaDescription({
      city: '서울', district: '강남구', facilityStats: { hospital: 100 }, totalFacilities: 500,
    })
    const b = buildDistrictMetaDescription({
      city: '부산', district: '해운대구', facilityStats: { hospital: 30 }, totalFacilities: 210,
    })
    expect(a).not.toBe(b)
  })

  it('같은 지역명이라도 시설 수가 다르면 설명문이 다르다', () => {
    const a = buildDistrictMetaDescription({
      city: '서울', district: '강남구', facilityStats: { hospital: 100 }, totalFacilities: 500,
    })
    const b = buildDistrictMetaDescription({
      city: '서울', district: '강남구', facilityStats: { hospital: 101 }, totalFacilities: 500,
    })
    expect(a).not.toBe(b)
  })

  it('통계가 없으면 기존 보일러플레이트로 폴백한다 (빈 문자열 금지)', () => {
    const result = buildDistrictMetaDescription({ city: '서울', district: '강남구' })
    expect(result).not.toBe('')
    expect(result).toContain('서울 강남구')
    expect(result).toContain('생활 인프라')
  })

  it('빈 통계 객체도 폴백한다', () => {
    const result = buildDistrictMetaDescription({
      city: '서울', district: '강남구', facilityStats: {},
    })
    expect(result).toContain('생활 인프라')
  })

  it('totalFacilities 가 없어도 통계가 있으면 데이터 문장을 만든다', () => {
    const result = buildDistrictMetaDescription({
      city: '서울', district: '강남구', facilityStats: { hospital: 10 },
    })
    expect(result).toContain('병원 10곳')
    expect(result).not.toContain('생활 인프라')
  })
})

describe('buildCityMetaDescription', () => {
  it('시군구 수와 총 시설 수를 포함한다', () => {
    const result = buildCityMetaDescription({
      city: '서울', districtCount: 25, totalFacilities: 123456,
    })
    expect(result).toContain('서울')
    expect(result).toContain('25개 시군구')
    expect(result).toContain('123,456곳')
  })

  it('서로 다른 시/도는 서로 다른 설명문을 만든다', () => {
    const a = buildCityMetaDescription({ city: '서울', districtCount: 25, totalFacilities: 123456 })
    const b = buildCityMetaDescription({ city: '부산', districtCount: 16, totalFacilities: 45678 })
    expect(a).not.toBe(b)
  })

  it('데이터가 전혀 없으면 기존 보일러플레이트로 폴백한다', () => {
    const result = buildCityMetaDescription({ city: '서울' })
    expect(result).not.toBe('')
    expect(result).toContain('서울')
    expect(result).toContain('실거래가')
  })

  it('시군구 수만 있어도 데이터 문장을 만든다', () => {
    const result = buildCityMetaDescription({ city: '세종', districtCount: 1 })
    expect(result).toContain('1개 시군구')
  })

  it('총 시설 수가 0이면 시군구 수만 사용한다', () => {
    const result = buildCityMetaDescription({ city: '서울', districtCount: 25, totalFacilities: 0 })
    expect(result).toContain('25개 시군구')
    expect(result).not.toContain('0곳')
  })
})

// 실제 /api/area 응답 수치(2026-07-29 프로덕션)로 최종 문자열을 고정한다.
// 리뷰어가 실제 SERP 에 나갈 문구를 그대로 볼 수 있게 하는 것이 목적.
describe('허브 meta description — 프로덕션 데이터 형태', () => {
  it('구·군: 지역마다 다른 실데이터 문장을 만든다', () => {
    const gangnam = buildDistrictMetaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: { hospital: 3213, pharmacy: 523, school: 86, park: 146, parking: 60 },
      totalFacilities: 14568,
    })
    const haeundae = buildDistrictMetaDescription({
      city: '부산',
      district: '해운대구',
      facilityStats: { hospital: 723, pharmacy: 182, school: 68, park: 49, parking: 164 },
      totalFacilities: 8921,
    })

    expect(gangnam).toBe(
      '서울 강남구에는 병원 3,213곳, 약국 523곳, 학교 86곳 등 총 14,568곳의 생활시설이 있습니다. 아파트·빌라·오피스텔 실거래가도 함께 확인하세요.',
    )
    expect(haeundae).toBe(
      '부산 해운대구에는 병원 723곳, 약국 182곳, 학교 68곳 등 총 8,921곳의 생활시설이 있습니다. 아파트·빌라·오피스텔 실거래가도 함께 확인하세요.',
    )
    expect(gangnam).not.toBe(haeundae)
  })

  it('시/도: 시군구 수와 총 시설 수로 차별화한다', () => {
    expect(buildCityMetaDescription({ city: '서울', districtCount: 25, totalFacilities: 172045 })).toBe(
      '서울의 25개 시군구, 생활시설 172,045곳 정보를 제공합니다. 아파트·빌라·오피스텔·토지 실거래가와 병원·약국·주차장 위치를 확인하세요.',
    )
  })

  it('설명문이 한국어 SERP 노출 길이(120자)를 넘지 않는다', () => {
    const gangnam = buildDistrictMetaDescription({
      city: '서울',
      district: '강남구',
      facilityStats: { hospital: 3213, pharmacy: 523, school: 86 },
      totalFacilities: 14568,
    })
    const seoul = buildCityMetaDescription({ city: '서울', districtCount: 25, totalFacilities: 172045 })
    expect(gangnam.length).toBeLessThanOrEqual(120)
    expect(seoul.length).toBeLessThanOrEqual(120)
  })
})
