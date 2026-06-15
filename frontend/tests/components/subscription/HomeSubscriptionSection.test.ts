import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

const { ongoingRef, upcomingRef, ongoingTotalRef, upcomingTotalRef } = vi.hoisted(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    ongoingRef: ref<Array<Record<string, unknown>>>([]),
    upcomingRef: ref<Array<Record<string, unknown>>>([]),
    ongoingTotalRef: ref(0),
    upcomingTotalRef: ref(0),
  }
})

vi.mock('~/composables/useHomeSubscriptions', async () => {
  const { computed } = await import('vue')
  return {
    useHomeSubscriptions: () => ({
      ongoing: ongoingRef,
      upcoming: upcomingRef,
      ongoingTotal: ongoingTotalRef,
      upcomingTotal: upcomingTotalRef,
      hasAny: computed(() => ongoingRef.value.length > 0 || upcomingRef.value.length > 0),
    }),
  }
})

import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'

const ongoingSample = [
  { id: 1, houseName: '래미안 원페를라', regionName: '서울 서초구', totalSupplyCount: 540, receptionStartDate: '2026-05-19', receptionEndDate: '2026-05-21', status: 'ongoing', sourceType: 'APT', rentType: null },
  { id: 2, houseName: 'LH 고덕강일', regionName: '서울 강동구', totalSupplyCount: 120, receptionStartDate: '2026-05-18', receptionEndDate: '2026-05-25', status: 'ongoing', sourceType: 'APT', rentType: '분양전환 가능임대' },
]
const upcomingSample = [
  { id: 3, houseName: 'SK뷰 광명센트럴', regionName: '경기 광명시', totalSupplyCount: 80, receptionStartDate: '2026-05-28', receptionEndDate: null, status: 'upcoming', sourceType: 'OPTIONAL', rentType: null },
]

describe('HomeSubscriptionSection (timeline)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ongoingRef.value = ongoingSample
    upcomingRef.value = upcomingSample
    ongoingTotalRef.value = 7
    upcomingTotalRef.value = 3
    ;(globalThis as any).useState = vi.fn((key: string, init?: () => string) => {
      if (key === 'home-today-iso') return { value: '2026-05-20' }
      return { value: init ? init() : null }
    })
  })

  it('요약 한 줄에 접수중/예정 총 건수를 표시한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('청약중')
    expect(text).toContain('7건')
    expect(text).toContain('예정')
    expect(text).toContain('3건')
  })

  it('평균 분양가와 D-3 배너는 더 이상 렌더하지 않는다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    expect(wrapper.text()).not.toContain('평균 분양가')
    expect(wrapper.text()).not.toContain('마감 임박')
  })

  it('접수중/예정 2그룹과 타입 뱃지를 렌더한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('접수 중')
    expect(text).toContain('접수 예정')
    expect(text).toContain('아파트')
    expect(text).toContain('공공임대')
    expect(text).toContain('임의공급')
  })

  // 가로 넘침 회귀 가드 — 그리드 아이템 기본값 min-width:auto 가 긴 공고명(truncate=nowrap)
  // 너비로 트랙을 늘려 모바일에서 카드가 viewport 밖으로 넘쳤던 버그(2026-06-15) 방지.
  // 컬럼(h3 부모 div)에 min-w-0 이 있어야 truncate 가 작동하고 트랙이 컨테이너에 갇힌다.
  it('타임라인 그룹 컬럼에 min-w-0 이 있어 긴 공고명 가로 넘침을 막는다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const headings = wrapper.findAll('h3')
    const groupCols = headings.filter((h) => h.text().includes('접수 중') || h.text().includes('접수 예정'))
    expect(groupCols.length).toBe(2)
    groupCols.forEach((h) => {
      expect((h.element.parentElement as HTMLElement).className).toContain('min-w-0')
    })
  })

  it('접수중은 마감 D-day, 예정은 시작 D-day를 표시한다', () => {
    const wrapper = mount(HomeSubscriptionSection)
    const text = wrapper.text()
    expect(text).toContain('D-1')
    expect(text).toContain('D-8')
  })

  it('한쪽 그룹이 비면 그 그룹 헤더를 숨긴다', () => {
    upcomingRef.value = []
    upcomingTotalRef.value = 0
    const wrapper = mount(HomeSubscriptionSection)
    expect(wrapper.text()).toContain('접수 중')
    expect(wrapper.text()).not.toContain('접수 예정')
  })

  it('둘 다 비면 빈 상태를 렌더한다', () => {
    ongoingRef.value = []
    upcomingRef.value = []
    const wrapper = mount(HomeSubscriptionSection)
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).toContain('현재 접수 중이거나 예정된 청약 공고가 없어요')
  })
})
