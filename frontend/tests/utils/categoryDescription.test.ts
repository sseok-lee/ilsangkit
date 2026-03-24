import { describe, it, expect } from 'vitest'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

/**
 * getSeoDescription 로직 재현 (pages/[category]/index.vue 내부 함수)
 * - totalCount > 0 이면 "전국 N곳 {label} 정보를 확인하세요. {baseDesc}" 형태
 * - totalCount === 0 이면 baseDesc 반환
 */
const SEO_DESCRIPTIONS: Record<string, string> = {
  toilet: '지금 이용 가능한 주변 공공화장실과 개방화장실 위치를 확인하세요. 24시간 운영 여부와 장애인화장실 정보를 제공합니다.',
  hospital: '현재 진료 중인 가까운 병원을 빠르게 찾으세요. 진료과목별 검색과 야간/주말 진료 여부를 확인할 수 있습니다.',
  pharmacy: '지금 문 연 주변 약국을 찾아보세요. 야간 운영, 주말/공휴일 영업 약국 위치와 연락처를 제공합니다.',
}

function getSeoDescription(category: string, totalCount?: number): string {
  const baseDesc = SEO_DESCRIPTIONS[category] || ''
  if (totalCount && totalCount > 0) {
    const label = CATEGORY_META[category as FacilityCategory]?.label || category
    return `전국 ${totalCount.toLocaleString()}곳 ${label} 정보를 확인하세요. ${baseDesc}`
  }
  return baseDesc
}

describe('getSeoDescription (카테고리 페이지 동적 설명)', () => {
  it('toilet, 28583 → "28,583곳" 포함', () => {
    const result = getSeoDescription('toilet', 28583)
    expect(result).toContain('28,583곳')
  })

  it('totalCount > 0이면 "확인하세요" CTA 포함', () => {
    const result = getSeoDescription('toilet', 28583)
    expect(result).toContain('확인하세요')
  })

  it('toilet, 0 → "0곳" 미포함 (기본 설명으로 폴백)', () => {
    const result = getSeoDescription('toilet', 0)
    expect(result).not.toContain('0곳')
  })

  it('totalCount 없음 → 기본 설명 반환', () => {
    const result = getSeoDescription('toilet')
    expect(result).toBe(SEO_DESCRIPTIONS.toilet)
    expect(result).not.toContain('전국')
  })

  it('totalCount > 0이면 카테고리 레이블 포함', () => {
    const result = getSeoDescription('hospital', 5000)
    expect(result).toContain('병원')
    expect(result).toContain('5,000곳')
  })

  it('totalCount > 0이면 기본 설명도 포함', () => {
    const result = getSeoDescription('toilet', 28583)
    expect(result).toContain(SEO_DESCRIPTIONS.toilet)
  })
})
