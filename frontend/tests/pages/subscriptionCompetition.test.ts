import { describe, it, expect, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, Suspense, ref, computed, watch, watchEffect, onMounted, onUnmounted, readonly } from 'vue'

// Stub Vue auto-imports that Nuxt provides but vitest doesn't
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).watchEffect = watchEffect
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted
;(globalThis as any).readonly = readonly

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

const sampleScore = {
  items: [
    { subscriptionId: 20, houseName: '힐스테이트 송파', regionName: '서울 송파구', sourceType: 'APT', winnerDate: null, minCut: 55, avgCut: 62, maxCut: 69 },
  ],
  total: 1, page: 1, totalPages: 1,
}

// 전역 useAsyncData 를 로컬 오버라이드: 'subscription-competition' 키에 payload 직접 주입
// (index.test.ts 패턴 — SSR-blocking await useAsyncData 의 data ref 를 가짜 응답)
function overrideUseAsyncData(payload: unknown) {
  ;(globalThis as any).useAsyncData = vi.fn((key?: string, _fetcher?: () => unknown) => {
    const data = key === 'subscription-competition' ? ref(payload) : ref(null)
    const result = {
      data,
      status: ref('idle'),
      error: ref(null),
      refresh: vi.fn(),
      pending: ref(false),
    }
    return Object.assign(Promise.resolve(result), result)
  })
}

// await useAsyncData(async setup) 컴포넌트는 <Suspense> 로 마운트해야 렌더된다
async function mountSuspended(component: any) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(component) })
      },
    }),
    {
      global: {
        stubs: {
          HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
          NuxtLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
        },
        mocks: { useHead: vi.fn(), useSeoMeta: vi.fn() },
      },
    },
  )
  await flushPromises()
  return wrapper
}

describe('subscription/competition.vue', () => {
  it('경쟁률 랭킹 테이블에 단지명과 경쟁률을 렌더하고 상세로 링크한다', async () => {
    getCompetitionRankingMock.mockResolvedValue(sampleRate)
    overrideUseAsyncData(sampleRate)
    const wrapper = await mountSuspended(CompetitionPage)
    expect(wrapper.text()).toContain('래미안 강남')
    expect(wrapper.html()).toContain('/subscription/10')
  })

  it('가점 metric 선택 시 가점 커트라인 테이블(최저/평균/최고)을 렌더한다', async () => {
    getCompetitionRankingMock.mockResolvedValue(sampleScore)
    overrideUseAsyncData(sampleScore)
    const wrapper = await mountSuspended(CompetitionPage)
    // 가점 커트라인 탭(2번째 metric 버튼)으로 전환
    const buttons = wrapper.findAll('button')
    await buttons[1].trigger('click')
    await flushPromises()
    const text = wrapper.text()
    expect(text).toContain('최저')
    expect(text).toContain('평균')
    expect(text).toContain('최고')
    expect(text).toContain('힐스테이트 송파')
    expect(wrapper.html()).toContain('/subscription/20')
  })
})
