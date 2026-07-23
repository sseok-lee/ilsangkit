import { describe, it, expect } from 'vitest'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import type { FacilityDetail, PharmacyDetails, HospitalDetails, AEDDetails, LibraryDetails } from '~/types/facility'

describe('generateDynamicFAQ - Time Formatting', () => {
  it('should format pharmacy dutyTime as HH:MM in answer', () => {
    const facility: FacilityDetail = {
      id: 'test-pharmacy',
      name: '테스트약국',
      category: 'pharmacy',
      latitude: 37.5,
      longitude: 127.0,
      address: 'test address',
      details: {
        dutyTime1s: '900',
        dutyTime1c: '2000',
      } as PharmacyDetails,
    }

    const faqs = generateDynamicFAQ(facility)
    const timesFAQ = faqs.find(faq => faq.question.includes('영업 시간'))
    expect(timesFAQ).toBeDefined()
    expect(timesFAQ?.answer).toContain('09:00~20:00')
    expect(timesFAQ?.answer).not.toContain('900~2000')
  })

  it('should format hospital treatment times as HH:MM in answer', () => {
    const facility: FacilityDetail = {
      id: 'test-hospital',
      name: '테스트병원',
      category: 'hospital',
      latitude: 37.5,
      longitude: 127.0,
      address: 'test address',
      details: {
        trmtMonStart: '0900',
        trmtMonEnd: '1730',
        clCdNm: '종합병원',
      } as HospitalDetails,
    }

    const faqs = generateDynamicFAQ(facility)
    const timesFAQ = faqs.find(faq => faq.question.includes('진료 시간'))
    expect(timesFAQ).toBeDefined()
    expect(timesFAQ?.answer).toContain('09:00~17:30')
    expect(timesFAQ?.answer).not.toContain('0900~1730')
  })

  it('should format AED access times as HH:MM in answer', () => {
    const facility: FacilityDetail = {
      id: 'test-aed',
      name: '테스트AED',
      category: 'aed',
      latitude: 37.5,
      longitude: 127.0,
      address: 'test address',
      details: {
        monSttTme: '0800',
        monEndTme: '2200',
        buildPlace: '테스트 건물',
      } as AEDDetails,
    }

    const faqs = generateDynamicFAQ(facility)
    const timesFAQ = faqs.find(faq => faq.question.includes('언제 이용'))
    expect(timesFAQ).toBeDefined()
    expect(timesFAQ?.answer).toContain('08:00~22:00')
    expect(timesFAQ?.answer).not.toContain('0800~2200')
  })

  it('should handle library times already in HH:MM format', () => {
    const facility: FacilityDetail = {
      id: 'test-library',
      name: '테스트도서관',
      category: 'library',
      latitude: 37.5,
      longitude: 127.0,
      address: 'test address',
      details: {
        weekdayOpenTime: '09:00',
        weekdayCloseTime: '20:00',
      } as LibraryDetails,
    }

    const faqs = generateDynamicFAQ(facility)
    const timesFAQ = faqs.find(faq => faq.question.includes('운영 시간'))
    expect(timesFAQ).toBeDefined()
    expect(timesFAQ?.answer).toContain('09:00~20:00')
  })
})

describe('generateDynamicFAQ - 중복콘텐츠 방지', () => {
  // 카테고리 공통 정적 FAQ로 5개까지 채우면 카테고리 내 전 상세가 동일 Q&A를 공유해
  // 중복콘텐츠(SEO)가 된다. 시설 데이터 기반 FAQ만(최대 3개) 반환해야 한다.
  it('시설 데이터 기반 FAQ만 반환하고 카테고리 공통 정적 FAQ로 채우지 않는다', () => {
    const facility: FacilityDetail = {
      id: 'p1',
      name: '테스트약국',
      category: 'pharmacy',
      latitude: 37.5,
      longitude: 127.0,
      address: 'test address',
      details: { dutyTime1s: '900', dutyTime1c: '2000' } as PharmacyDetails,
    }
    const faqs = generateDynamicFAQ(facility)
    // 최대 3개(정적 보충 없음)
    expect(faqs.length).toBeLessThanOrEqual(3)
    // 카테고리 공통 정적 FAQ 질문이 포함되지 않는다
    const staticQuestions = new Set((CATEGORY_FAQ['pharmacy'] ?? []).map(f => f.question))
    expect(faqs.every(f => !staticQuestions.has(f.question))).toBe(true)
    // 데이터 기반 FAQ는 유지
    expect(faqs.some(f => f.question.includes('영업 시간'))).toBe(true)
  })

  it('데이터가 없으면 빈 배열을 반환한다 (정적 보일러플레이트로 채우지 않음)', () => {
    const facility: FacilityDetail = {
      id: 'p2',
      name: '데이터없는약국',
      category: 'pharmacy',
      latitude: 37.5,
      longitude: 127.0,
      address: 'test address',
      details: {} as PharmacyDetails,
    }
    const faqs = generateDynamicFAQ(facility)
    const staticQuestions = new Set((CATEGORY_FAQ['pharmacy'] ?? []).map(f => f.question))
    expect(faqs.every(f => !staticQuestions.has(f.question))).toBe(true)
  })
})
