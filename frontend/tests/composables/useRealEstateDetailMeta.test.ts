import { describe, it, expect } from 'vitest'
import { buildRealEstateDetailMeta, type DetailMetaInput } from '~/composables/useRealEstateDetailMeta'

const base: DetailMetaInput = {
  buildingName: '래미안대치팰리스',
  region: { city: '서울특별시', district: '강남구', dong: '대치동' },
  propertyType: 'apt',
  transactionMode: 'sale',
  summary: { totalCount: 312, recentDeal: { amount: 285000, dealDate: '2025.3' } },
  buildYear: 2015,
  areaRange: { min: 84, max: 114 },
  facilitySummary: '학교 4곳·병원 6곳',
}

describe('buildRealEstateDetailMeta - title', () => {
  it('브랜드 | 일상킷 가 1회 붙는다', () => {
    const { title } = buildRealEstateDetailMeta(base)
    expect(title.endsWith(' | 일상킷')).toBe(true)
    expect(title.match(/일상킷/g)).toHaveLength(1)
  })
  it('아파트는 "아파트" 타입어를 생략한다', () => {
    expect(buildRealEstateDetailMeta(base).title).toBe('래미안대치팰리스 매매 실거래가 | 일상킷')
  })
  it('빌라/오피스텔은 타입어를 유지한다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, buildingName: '역삼e편한세상', propertyType: 'villa', transactionMode: 'rent' })
    expect(title).toBe('역삼e편한세상 빌라 전월세 실거래가 | 일상킷')
  })
  it('이름이 길면 타입어를 생략해 30자에 근접시킨다', () => {
    const { title } = buildRealEstateDetailMeta({ ...base, buildingName: '강남역푸르지오시티', propertyType: 'offitel', transactionMode: 'rent' })
    expect(title).toBe('강남역푸르지오시티 전월세 실거래가 | 일상킷')
  })
})

describe('buildRealEstateDetailMeta - description', () => {
  it('주변 생활시설(학교·병원)을 면적/마무리보다 앞에 배치한다', () => {
    const { description } = buildRealEstateDetailMeta(base)
    const facIdx = description.indexOf('주변 생활시설')
    const areaIdx = description.indexOf('면적별')
    expect(facIdx).toBeGreaterThan(-1)
    expect(facIdx).toBeLessThan(areaIdx)
    expect(description).toContain('학교 4곳·병원 6곳 등 주변 생활시설')
  })
  it('준공년도 문구를 더는 넣지 않는다(압축)', () => {
    expect(buildRealEstateDetailMeta(base).description).not.toContain('준공')
  })
  it('전체 길이 120자 이하', () => {
    expect(buildRealEstateDetailMeta(base).description.length).toBeLessThanOrEqual(120)
  })
  it('가격이 있어도 전용 면적 범위를 포함한다', () => {
    expect(buildRealEstateDetailMeta(base).description).toContain('전용 84~114㎡')
  })
  it('facilitySummary 없으면 "주변 생활시설과"로 일반화', () => {
    expect(buildRealEstateDetailMeta({ ...base, facilitySummary: null }).description).toContain('주변 생활시설과')
  })
})

describe('buildRealEstateDetailMeta - legacy cases (updated to new format)', () => {
  const legacyBase: DetailMetaInput = {
    buildingName: '새한A',
    region: { city: '광주', district: '북구', dong: '용봉동' },
    propertyType: 'apt',
    transactionMode: 'sale',
    buildYear: 1996,
    areaRange: { min: 60 },
    facilitySummary: '학교 5곳, 병원 12곳 등 생활시설',
    summary: null,
  }

  it('full payload — title has brand suffix, no location segment', () => {
    const { title } = buildRealEstateDetailMeta({
      ...legacyBase,
      summary: {
        totalCount: 30,
        recentDeal: { amount: 10700, dealDate: '2026년 5월' },
      },
    })
    expect(title).toBe('새한A 매매 실거래가 | 일상킷')
  })

  it('full payload — description has 실거래 count and recent price', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      summary: {
        totalCount: 30,
        recentDeal: { amount: 10700, dealDate: '2026년 5월' },
      },
    })
    expect(description).toContain('광주 북구 새한A 아파트 매매 실거래 30건')
    expect(description).toContain('1억 700만원(2026년 5월)')
    expect(description).toContain('전용 60㎡')
    expect(description).not.toContain('준공')
  })

  it('totalCount 0 — description omits count clause', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      summary: { totalCount: 0 },
    })
    expect(description).not.toMatch(/실거래 \d+건/)
    expect(description).toContain('면적별 시세를 함께 확인하세요')
  })

  it('buildYear null — description omits 준공', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      buildYear: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('준공')
    expect(description).toContain('1억 700만원(2026년 5월)')
  })

  it('areaRange range — formats as min~max', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      areaRange: { min: 39, max: 59 },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).toContain('전용 39~59㎡')
  })

  it('facilitySummary null — no "인근" but has 주변 생활시설과', () => {
    const { description } = buildRealEstateDetailMeta({
      ...legacyBase,
      facilitySummary: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('인근')
    expect(description).toContain('주변 생활시설과')
  })

  it('all optionals missing — minimal description has 면적별 시세', () => {
    const { description } = buildRealEstateDetailMeta({
      buildingName: '새한A',
      region: { city: '광주', district: '북구' },
      propertyType: 'apt',
      transactionMode: 'sale',
      buildYear: null,
      areaRange: null,
      facilitySummary: null,
      summary: null,
    })
    expect(description).toContain('광주 북구 새한A 아파트 매매 실거래가')
    expect(description).toContain('주변 생활시설과')
    expect(description).toContain('면적별 시세를 함께 확인하세요')
  })

  it('rent mode — uses 전월세 label', () => {
    const { title, description } = buildRealEstateDetailMeta({
      ...legacyBase,
      transactionMode: 'rent',
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toContain('전월세 실거래가')
    expect(description).toContain('전월세 실거래 30건')
  })

  it('villa — uses 빌라 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...legacyBase,
      propertyType: 'villa',
      summary: null,
    })
    expect(title).toContain('빌라')
  })

  it('offitel — uses 오피스텔 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...legacyBase,
      propertyType: 'offitel',
      summary: null,
    })
    expect(title).toContain('오피스텔')
  })
})
