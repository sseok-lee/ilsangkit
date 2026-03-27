import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockUseHead = vi.fn()
vi.stubGlobal('useHead', mockUseHead)

// SITE_URL mock
vi.mock('~/utils/seoConstants', () => ({
  SITE_NAME: '일상킷',
  SITE_URL: 'https://ilsangkit.co.kr',
}))

// CATEGORY_META mock
vi.mock('~/types/facility', () => ({
  CATEGORY_META: {
    toilet: { label: '공공화장실' },
    hospital: { label: '병원' },
  },
}))

import { useStructuredData } from '~/composables/useStructuredData'

describe('useStructuredData', () => {
  beforeEach(() => {
    mockUseHead.mockClear()
  })

  // ─── FAQPage/HowTo 스키마 제거됨 (2023.08 상업사이트 제한 / 2023.09 폐기) ──

  // ─── Task 4: AggregateRating 스키마 ───────────────────────────────────────

  describe('setAggregateRatingSchema', () => {
    it('setAggregateRatingSchema 호출 시 useHead를 호출한다', () => {
      const { setAggregateRatingSchema } = useStructuredData()
      setAggregateRatingSchema({ ratingValue: 4.2, reviewCount: 15 })
      expect(mockUseHead).toHaveBeenCalled()
    })

    it('JSON-LD @type이 AggregateRating이고 ratingValue/reviewCount를 포함한다', () => {
      const { setAggregateRatingSchema } = useStructuredData()
      setAggregateRatingSchema({ ratingValue: 4.2, reviewCount: 15 })

      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('AggregateRating')
      expect(parsed.ratingValue).toBe(4.2)
      expect(parsed.reviewCount).toBe(15)
    })

    it('ratingValue가 1~5 범위로 clamp된다', () => {
      const { setAggregateRatingSchema } = useStructuredData()

      setAggregateRatingSchema({ ratingValue: 8, reviewCount: 5 })
      let parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.ratingValue).toBe(5)

      mockUseHead.mockClear()

      setAggregateRatingSchema({ ratingValue: -1, reviewCount: 5 })
      parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.ratingValue).toBe(1)
    })

    it('reviewCount가 0이면 스키마를 생성하지 않는다', () => {
      const { setAggregateRatingSchema } = useStructuredData()
      setAggregateRatingSchema({ ratingValue: 4.2, reviewCount: 0 })
      expect(mockUseHead).not.toHaveBeenCalled()
    })

    it('bestRating:5, worstRating:1 기본값을 포함한다', () => {
      const { setAggregateRatingSchema } = useStructuredData()
      setAggregateRatingSchema({ ratingValue: 3.5, reviewCount: 10 })
      const parsed = JSON.parse(mockUseHead.mock.calls[0][0].script[0].innerHTML)
      expect(parsed.bestRating).toBe(5)
      expect(parsed.worstRating).toBe(1)
    })
  })

  // ─── Task 8: Organization sameAs ──────────────────────────────────────────

  describe('setOrganizationSchema sameAs', () => {
    it('setOrganizationSchema 호출 시 sameAs 배열이 포함된다', () => {
      const { setOrganizationSchema } = useStructuredData()
      setOrganizationSchema()
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(Array.isArray(parsed.sameAs)).toBe(true)
    })
  })


  // ─── Task 14: Hospital OpeningHoursSpecification ───────────────────────────

  describe('setFacilitySchema - hospital OpeningHours', () => {
    const makeHospitalFacility = (detailsOverride = {}) => ({
      id: 'hosp-1',
      category: 'hospital' as const,
      name: '테스트병원',
      address: '서울시 강남구 테헤란로 1',
      roadAddress: '서울시 강남구 테헤란로 1',
      lat: 37.5,
      lng: 127.0,
      city: '서울시',
      district: '강남구',
      bjdCode: null,
      sourceId: 'H001',
      sourceUrl: null,
      viewCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
      syncedAt: '2024-01-01T00:00:00Z',
      details: {
        phone: '02-1234-5678',
        clCdNm: '종합병원',
        ...detailsOverride,
      },
    })

    it('hospital facility에 dutyTime1s/dutyTime1c 있을 때 openingHoursSpecification이 포함된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility({ dutyTime1s: '0900', dutyTime1c: '1800' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(Array.isArray(parsed.openingHoursSpecification)).toBe(true)
      expect(parsed.openingHoursSpecification.length).toBeGreaterThan(0)
    })

    it('OpeningHoursSpecification 배열에 Monday 항목이 포함된다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility({ dutyTime1s: '0900', dutyTime1c: '1800' }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      const monday = parsed.openingHoursSpecification.find((s: any) => s.dayOfWeek === 'Monday')
      expect(monday).toBeDefined()
      expect(monday['@type']).toBe('OpeningHoursSpecification')
      expect(monday.opens).toBe('0900')
      expect(monday.closes).toBe('1800')
    })

    it('pharmacy와 동일한 dutyTime 패턴으로 여러 요일을 매핑한다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility({
        dutyTime1s: '0900', dutyTime1c: '1800',
        dutyTime2s: '0900', dutyTime2c: '1800',
        dutyTime6s: '0900', dutyTime6c: '1300',
      }))
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHoursSpecification).toHaveLength(3)
      const days = parsed.openingHoursSpecification.map((s: any) => s.dayOfWeek)
      expect(days).toContain('Monday')
      expect(days).toContain('Tuesday')
      expect(days).toContain('Saturday')
    })

    it('dutyTime 필드가 없으면 openingHoursSpecification이 포함되지 않는다', () => {
      const { setFacilitySchema } = useStructuredData()
      setFacilitySchema(makeHospitalFacility())
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.openingHoursSpecification).toBeUndefined()
    })
  })
})
