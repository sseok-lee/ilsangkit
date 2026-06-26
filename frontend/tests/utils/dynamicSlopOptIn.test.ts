import { describe, it, expect } from 'vitest'
import { generateDynamicTips } from '~/utils/dynamicTips'
import { generateDynamicFAQ } from '~/utils/dynamicFAQ'
import type { FacilityDetail, FacilityCategory } from '~/types/facility'

function makeFacility(category: FacilityCategory, details: Record<string, unknown>): FacilityDetail {
  return {
    id: `${category}-1`, category, name: '테스트', address: null, roadAddress: null,
    lat: 37.5, lng: 127, city: '서울', district: '강남구', bjdCode: null,
    details: details as FacilityDetail['details'], sourceId: 's', sourceUrl: null,
    viewCount: 0, createdAt: '', updatedAt: '', syncedAt: '',
  }
}

describe('staticFill 옵트인', () => {
  it('기본(미지정): 정적 보충으로 채운다(현행 유지)', () => {
    const tips = generateDynamicTips(makeFacility('toilet', {}))
    expect(tips.length).toBeGreaterThan(0) // 정적 fallback 존재
  })

  it('staticFill:false → 동적만(필드 없으면 0개)', () => {
    const tips = generateDynamicTips(makeFacility('toilet', {}), { staticFill: false })
    expect(tips).toEqual([])
    const faqs = generateDynamicFAQ(makeFacility('clothes', {}), { staticFill: false })
    expect(faqs).toEqual([])
  })

  it('staticFill:false → 동적은 그대로 살린다', () => {
    const faqs = generateDynamicFAQ(makeFacility('toilet', { openTime: '상시' }), { staticFill: false })
    expect(faqs.length).toBe(1)
    expect(faqs[0].question).toContain('24시간')
  })
})
