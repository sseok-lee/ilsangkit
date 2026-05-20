import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { ref } from 'vue'
import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'

vi.mock('~/composables/useHomeSubscriptions', () => ({
  useHomeSubscriptions: () => ({
    ongoing: ref([
      {
        id: 1,
        houseName: '래미안 강동 팰리스',
        regionName: '서울 강동구',
        receptionStartDate: null,
        receptionEndDate: '2026-05-21',
        status: 'ongoing',
        totalSupplyCount: 540,
      },
    ]),
    upcoming: ref([
      {
        id: 2,
        houseName: '디에이치 방배',
        regionName: '서울 서초구',
        receptionStartDate: '2026-05-25',
        receptionEndDate: null,
        status: 'upcoming',
        totalSupplyCount: 1221,
      },
    ]),
    hasAny: ref(true),
  }),
}))

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
})
