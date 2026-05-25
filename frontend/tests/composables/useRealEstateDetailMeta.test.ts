import { describe, it, expect } from 'vitest'
import { buildRealEstateDetailMeta } from '~/composables/useRealEstateDetailMeta'

const base = {
  buildingName: '새한A',
  region: { city: '광주', district: '북구', dong: '용봉동' },
  propertyType: 'apt' as const,
  transactionMode: 'sale' as const,
  buildYear: 1996,
  areaRange: { min: 60 },
  facilitySummary: '학교 5곳, 병원 12곳 등 생활시설',
} as const

describe('buildRealEstateDetailMeta', () => {
  it('full payload — title with dong, description with all chunks', () => {
    const { title, description } = buildRealEstateDetailMeta({
      ...base,
      summary: {
        totalCount: 30,
        recentDeal: { amount: 10700, dealDate: '2026년 5월' },
      },
    })
    expect(title).toBe('새한A 아파트 매매 실거래 · 광주 북구 용봉동')
    expect(description).toContain('광주 북구 새한A 아파트 매매 실거래 30건')
    expect(description).toContain('최근 거래가는 1억 700만원(2026년 5월)')
    expect(description).toContain('1996년 준공된 단지입니다')
    expect(description).toContain('전용 60㎡')
    expect(description).toContain('인근 학교 5곳, 병원 12곳 등 생활시설')
    expect(description).toContain('주변 시세를 함께 확인하세요')
  })

  it('dong missing — title omits dong segment', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      region: { city: '광주', district: '북구' },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toBe('새한A 아파트 매매 실거래 · 광주 북구')
  })

  it('city+district missing — title is buildingName-only', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      region: { city: '', district: '' },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toBe('새한A 아파트 매매 실거래')
  })

  it('totalCount 0 — description omits count clause', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      summary: { totalCount: 0 },
    })
    expect(description).not.toMatch(/실거래 \d+건/)
    expect(description).toContain('주변 시세를 함께 확인하세요')
  })

  it('buildYear null — description omits "준공된 단지입니다"', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      buildYear: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('준공된 단지입니다')
    expect(description).toContain('최근 거래가는 1억 700만원')
  })

  it('areaRange range — formats as min~max', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      areaRange: { min: 39, max: 59 },
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).toContain('전용 39~59㎡')
  })

  it('facilitySummary null — description omits "인근 ... 생활시설" but keeps 주변 시세', () => {
    const { description } = buildRealEstateDetailMeta({
      ...base,
      facilitySummary: null,
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(description).not.toContain('인근')
    expect(description).toContain('주변 시세를 함께 확인하세요')
  })

  it('all optionals missing — minimal description', () => {
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
    expect(description).toBe('광주 북구 새한A 아파트 매매 실거래가. 주변 시세를 함께 확인하세요.')
  })

  it('rent mode — uses 전월세 label', () => {
    const { title, description } = buildRealEstateDetailMeta({
      ...base,
      transactionMode: 'rent',
      summary: { totalCount: 30, recentDeal: { amount: 10700, dealDate: '2026년 5월' } },
    })
    expect(title).toContain('전월세 실거래')
    expect(description).toContain('전월세 실거래 30건')
  })

  it('villa — uses 빌라 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      propertyType: 'villa',
      summary: null,
    })
    expect(title).toContain('빌라')
  })

  it('offitel — uses 오피스텔 label', () => {
    const { title } = buildRealEstateDetailMeta({
      ...base,
      propertyType: 'offitel',
      summary: null,
    })
    expect(title).toContain('오피스텔')
  })
})
