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

  // ─── Task 2: FAQPage JSON-LD ───────────────────────────────────────────────

  describe('setFAQSchema', () => {
    it('setFAQSchema 호출 시 useHead를 호출한다', () => {
      const { setFAQSchema } = useStructuredData()
      setFAQSchema([{ question: '어디서 찾나요?', answer: '지도에서 찾을 수 있습니다.' }])
      expect(mockUseHead).toHaveBeenCalled()
    })

    it('JSON-LD @type이 FAQPage인지 검증한다', () => {
      const { setFAQSchema } = useStructuredData()
      setFAQSchema([{ question: 'Q1', answer: 'A1' }])

      const call = mockUseHead.mock.calls[0][0]
      const script = call.script[0]
      const parsed = JSON.parse(script.innerHTML)
      expect(parsed['@type']).toBe('FAQPage')
    })

    it('mainEntity 배열 각 항목이 Question/Answer 구조를 가진다', () => {
      const { setFAQSchema } = useStructuredData()
      setFAQSchema([
        { question: '화장실 운영시간은?', answer: '24시간 운영합니다.' },
        { question: '장애인 화장실이 있나요?', answer: '일부 시설에 있습니다.' },
      ])

      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)

      expect(Array.isArray(parsed.mainEntity)).toBe(true)
      expect(parsed.mainEntity).toHaveLength(2)

      parsed.mainEntity.forEach((item: any) => {
        expect(item['@type']).toBe('Question')
        expect(typeof item.name).toBe('string')
        expect(item.acceptedAnswer).toBeDefined()
        expect(item.acceptedAnswer['@type']).toBe('Answer')
        expect(typeof item.acceptedAnswer.text).toBe('string')
      })
    })

    it('빈 배열 전달 시 에러 없이 동작한다', () => {
      const { setFAQSchema } = useStructuredData()
      expect(() => setFAQSchema([])).not.toThrow()
      expect(mockUseHead).toHaveBeenCalled()
    })

    it('HTML 특수문자를 안전하게 직렬화한다', () => {
      const { setFAQSchema } = useStructuredData()
      setFAQSchema([{ question: '<script>alert(1)</script>', answer: '"따옴표" & <앰퍼샌드>' }])

      const call = mockUseHead.mock.calls[0][0]
      const raw = call.script[0].innerHTML
      // JSON.parse가 성공해야 하며 값이 보존되어야 한다
      const parsed = JSON.parse(raw)
      expect(parsed.mainEntity[0].name).toBe('<script>alert(1)</script>')
      expect(parsed.mainEntity[0].acceptedAnswer.text).toBe('"따옴표" & <앰퍼샌드>')
    })

    it('@context가 schema.org이다', () => {
      const { setFAQSchema } = useStructuredData()
      setFAQSchema([{ question: 'Q', answer: 'A' }])
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@context']).toBe('https://schema.org')
    })
  })

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

  // ─── Task 13: HowTo 스키마 - 쓰레기배출 ────────────────────────────────────

  describe('setHowToSchema', () => {
    it('setHowToSchema 호출 시 useHead를 호출한다', () => {
      const { setHowToSchema } = useStructuredData()
      setHowToSchema({
        name: '쓰레기 배출 방법',
        description: '올바른 쓰레기 배출 절차 안내',
        steps: [{ name: '분리수거', text: '재활용 가능한 쓰레기를 분리합니다.' }],
      })
      expect(mockUseHead).toHaveBeenCalled()
    })

    it('JSON-LD @type이 HowTo인지 검증한다', () => {
      const { setHowToSchema } = useStructuredData()
      setHowToSchema({
        name: '쓰레기 배출 방법',
        description: '올바른 쓰레기 배출 절차 안내',
        steps: [{ name: '분리수거', text: '재활용 가능한 쓰레기를 분리합니다.' }],
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@type']).toBe('HowTo')
    })

    it('step 배열 각 항목이 @type HowToStep, name, text를 포함한다', () => {
      const { setHowToSchema } = useStructuredData()
      setHowToSchema({
        name: '쓰레기 배출 방법',
        description: '올바른 쓰레기 배출 절차 안내',
        steps: [
          { name: '분리수거 기준 확인', text: '지역별 분리수거 기준을 확인합니다.' },
          { name: '쓰레기봉투 구매', text: '규격 종량제 봉투를 구매합니다.' },
        ],
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(Array.isArray(parsed.step)).toBe(true)
      expect(parsed.step).toHaveLength(2)
      parsed.step.forEach((s: any) => {
        expect(s['@type']).toBe('HowToStep')
        expect(typeof s.name).toBe('string')
        expect(typeof s.text).toBe('string')
      })
    })

    it('steps 빈 배열이면 스키마를 생성하지 않는다', () => {
      const { setHowToSchema } = useStructuredData()
      setHowToSchema({
        name: '쓰레기 배출 방법',
        description: '올바른 쓰레기 배출 절차 안내',
        steps: [],
      })
      expect(mockUseHead).not.toHaveBeenCalled()
    })

    it('totalTime 선택적 필드를 포함하면 JSON-LD에 반영된다', () => {
      const { setHowToSchema } = useStructuredData()
      setHowToSchema({
        name: '쓰레기 배출 방법',
        description: '올바른 쓰레기 배출 절차 안내',
        steps: [{ name: '배출', text: '지정 장소에 배출합니다.' }],
        totalTime: 'PT10M',
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed.totalTime).toBe('PT10M')
    })

    it('@context가 schema.org이다', () => {
      const { setHowToSchema } = useStructuredData()
      setHowToSchema({
        name: '쓰레기 배출 방법',
        description: '올바른 쓰레기 배출 절차 안내',
        steps: [{ name: '배출', text: '지정 장소에 배출합니다.' }],
      })
      const call = mockUseHead.mock.calls[0][0]
      const parsed = JSON.parse(call.script[0].innerHTML)
      expect(parsed['@context']).toBe('https://schema.org')
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
