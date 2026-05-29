import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'

vi.mock('~/composables/useStructuredData', () => ({
  useStructuredData: () => ({ setFAQSchema: vi.fn(), setBreadcrumbSchema: vi.fn() }),
}))
const getCompetitionRankingMock = vi.fn()
vi.mock('~/composables/useSubscription', () => ({
  useSubscription: () => ({ getCompetitionRanking: getCompetitionRankingMock }),
}))

import CompetitionPage from '~/pages/subscription/competition.vue'

const sampleRate = {
  items: [
    { subscriptionId: 10, houseName: '래미안 강남', regionName: '서울 강남구', sourceType: 'APT', winnerDate: null, maxRate: 12.3, totalApplicants: 1230, totalSupply: 100 },
  ],
  total: 1, page: 1, totalPages: 1,
}

describe('subscription/competition.vue', () => {
  it('경쟁률 랭킹 테이블에 단지명과 경쟁률을 렌더하고 상세로 링크한다', async () => {
    getCompetitionRankingMock.mockResolvedValue(sampleRate)
    const wrapper = mount(CompetitionPage, {
      global: {
        stubs: {
          HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
        },
        mocks: { useHead: vi.fn(), useSeoMeta: vi.fn() },
      },
    })
    await flushPromises()
    expect(wrapper.text()).toContain('래미안 강남')
    expect(wrapper.html()).toContain('/subscription/10')
  })
})
