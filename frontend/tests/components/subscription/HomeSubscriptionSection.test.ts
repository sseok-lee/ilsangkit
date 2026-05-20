import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'

// vi.mock 은 hoisted 라서 일반 변수 참조 불가 → vi.hoisted 로 ref 들을 끌어올림.
const { ongoingRef, upcomingRef } = vi.hoisted(() => {
  // vitest hoisted scope 안에서 vue 동적 import.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { ref } = require('vue')
  return {
    ongoingRef: ref<Array<Record<string, unknown>>>([]),
    upcomingRef: ref<Array<Record<string, unknown>>>([]),
  }
})

vi.mock('~/composables/useHomeSubscriptions', async () => {
  const { computed } = await import('vue')
  return {
    useHomeSubscriptions: () => ({
      ongoing: ongoingRef,
      upcoming: upcomingRef,
      hasAny: computed(() => ongoingRef.value.length > 0 || upcomingRef.value.length > 0),
    }),
  }
})

import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'

const sampleOngoing = [
  {
    id: 1,
    houseName: '래미안 강동 팰리스',
    regionName: '서울 강동구',
    receptionStartDate: null,
    receptionEndDate: '2026-05-21',
    status: 'ongoing',
    totalSupplyCount: 540,
  },
]
const sampleUpcoming = [
  {
    id: 2,
    houseName: '디에이치 방배',
    regionName: '서울 서초구',
    receptionStartDate: '2026-05-25',
    receptionEndDate: null,
    status: 'upcoming',
    totalSupplyCount: 1221,
  },
]

const summary = {
  closingThisWeek: 12,
  upcomingNextWeek: 18,
  avgSupplyPrice: 68000,
  imminent: [
    { id: 1, houseName: '래미안 강동 팰리스', regionName: '서울 강동구', endDate: '2026-05-21' },
    { id: 3, houseName: '힐스테이트 광교', regionName: '경기 수원시', endDate: '2026-05-22' },
  ],
}

describe('HomeSubscriptionSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    ongoingRef.value = sampleOngoing
    upcomingRef.value = sampleUpcoming
    ;(globalThis as any).useState = vi.fn((key: string, init?: () => string) => {
      if (key === 'home-today-iso') return { value: '2026-05-20' }
      return { value: init ? init() : null }
    })
  })

  it('renders summary line with counts and average price', () => {
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } })
    const text = wrapper.text()
    expect(text).toContain('12건')
    expect(text).toContain('18건')
    expect(text).toContain('6.8억')
  })

  it('renders imminent (D-3) highlight with house names', () => {
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } })
    const text = wrapper.text()
    expect(text).toContain('마감 임박')
    expect(text).toContain('래미안 강동 팰리스')
  })

  it('renders meta line with totals and shown counts', () => {
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } })
    const text = wrapper.text()
    expect(text).toMatch(/접수중\s+12건\s+중\s+1건/)
    expect(text).toMatch(/예정\s+18건\s+중\s+1건/)
  })

  it('hides imminent block when imminent is empty', () => {
    const summaryNoImminent = { ...summary, imminent: [] }
    const wrapper = mount(HomeSubscriptionSection, { props: { summary: summaryNoImminent } })
    expect(wrapper.text()).not.toContain('마감 임박')
  })

  it('shows section when only summary has counts (no cards)', () => {
    ongoingRef.value = []
    upcomingRef.value = []
    const wrapper = mount(HomeSubscriptionSection, { props: { summary } })
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).toContain('12건')
    expect(wrapper.text()).toContain('마감 임박')
    // 카드 그리드 / 메타 라인은 카드 없을 때 미렌더
    expect(wrapper.text()).not.toContain('표시')
  })

  it('renders section with empty state when summary and cards all empty', () => {
    ongoingRef.value = []
    upcomingRef.value = []
    const emptySummary = {
      closingThisWeek: 0,
      upcomingNextWeek: 0,
      avgSupplyPrice: null,
      imminent: [],
    }
    const wrapper = mount(HomeSubscriptionSection, { props: { summary: emptySummary } })
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).toContain('청약 한눈에')
    expect(wrapper.text()).toContain('현재 접수 중이거나 예정된 청약 공고가 없어요')
  })

  it('renders section with empty state when summary prop is null and no cards', () => {
    ongoingRef.value = []
    upcomingRef.value = []
    const wrapper = mount(HomeSubscriptionSection, { props: { summary: null } })
    expect(wrapper.find('section').exists()).toBe(true)
    expect(wrapper.text()).toContain('현재 접수 중이거나 예정된 청약 공고가 없어요')
  })
})
