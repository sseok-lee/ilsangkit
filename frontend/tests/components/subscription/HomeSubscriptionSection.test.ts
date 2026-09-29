import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const { saleRef, publicRentRef, saleErrorRef, publicRentErrorRef, pendingRef, refreshMock } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    saleRef: ref<Array<Record<string, unknown>>>([]),
    publicRentRef: ref<Array<Record<string, unknown>>>([]),
    saleErrorRef: ref(false),
    publicRentErrorRef: ref(false),
    pendingRef: ref(false),
    refreshMock: vi.fn(),
  }
})

vi.mock('~/composables/useHomeSubscriptions', () => ({
  useHomeSubscriptions: () => ({
    sale: saleRef,
    publicRent: publicRentRef,
    saleError: saleErrorRef,
    publicRentError: publicRentErrorRef,
    pending: pendingRef,
    refresh: refreshMock,
  }),
}))

import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'

const saleSample = [
  { id: 1, houseName: '래미안 원페를라', regionName: '서울 서초구', totalSupplyCount: 540, receptionStartDate: '2026-05-19', receptionEndDate: '2026-05-21', status: 'ongoing', sourceType: 'APT', rentType: null },
  { id: 3, houseName: 'SK뷰 광명센트럴', regionName: '경기 광명시', totalSupplyCount: 0, receptionStartDate: '2026-05-28', receptionEndDate: null, status: 'upcoming', sourceType: 'OPTIONAL', rentType: null },
]
const publicRentSample = [
  { id: 2, houseName: 'LH 고덕강일 공공임대', regionName: '전국', totalSupplyCount: 120, receptionStartDate: '2026-05-18', receptionEndDate: '2026-05-25', status: 'ongoing', sourceType: 'APT', rentType: '분양전환 가능임대' },
]

describe('HomeSubscriptionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    saleRef.value = saleSample
    publicRentRef.value = publicRentSample
    saleErrorRef.value = false
    publicRentErrorRef.value = false
    pendingRef.value = false
    ;(globalThis as any).useState = vi.fn((key: string, init?: () => string) => {
      if (key === 'home-today-iso') return { value: '2026-05-20' }
      return { value: init ? init() : null }
    })
  })

  it('일반 청약과 공공임대 두 패널을 렌더하고 전국 공고임을 표시한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('일반 청약')
    expect(text).toContain('공공임대')
    expect(text).toContain('전국 공고')
    expect(text).toContain('래미안 원페를라')
    expect(text).toContain('LH 고덕강일 공공임대')
  })

  it('실제 필드 기반 상태·일정·공급대상만 표시한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('청약중')
    expect(text).toContain('접수예정')
    expect(text).toContain('D-1')
    expect(text).toContain('D-8')
    expect(text).toContain('540호')
    expect(text).toContain('0호')
    expect(text).toContain('임의공급')
    expect(text).not.toContain('평균 분양가')
    expect(text).not.toContain('신청자격')
  })

  it('패널 컬럼에 min-w-0 이 있어 긴 공고명 가로 넘침을 막는다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const panels = wrapper.findAll('[data-testid="subscription-panel"]')
    expect(panels).toHaveLength(2)
    panels.forEach((panel) => {
      expect(panel.attributes('class')).toContain('min-w-0')
    })
  })

  it('한쪽 패널 실패와 빈 상태를 각각 표시하고 전체 공고 링크를 유지한다', () => {
    saleRef.value = []
    publicRentRef.value = []
    saleErrorRef.value = true
    publicRentErrorRef.value = false

    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('일반 청약 정보를 불러오지 못했습니다')
    expect(text).toContain('현재 접수 중이거나 예정된 공공임대 공고가 없습니다')
    expect(wrapper.find('a[href="/subscription"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/subscription/sale"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/subscription/rent/public"]').exists()).toBe(true)
  })

  it('둘 다 비어도 섹션과 전체 공고 링크를 렌더하고 중복 전체 empty banner는 표시하지 않는다', () => {
    saleRef.value = []
    publicRentRef.value = []

    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()

    expect(wrapper.find('section').exists()).toBe(true)
    expect(text).toContain('현재 접수 중이거나 예정된 일반 청약 공고가 없습니다')
    expect(text).toContain('현재 접수 중이거나 예정된 공공임대 공고가 없습니다')
    expect(text).not.toContain('접수 중이거나 예정된 공고가 없습니다')
    expect(wrapper.find('a[href="/subscription"]').exists()).toBe(true)
  })
})
