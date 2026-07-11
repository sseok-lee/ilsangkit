import { describe, it, expect } from 'vitest'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
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
