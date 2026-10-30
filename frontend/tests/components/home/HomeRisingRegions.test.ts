import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { setScope, state } = vi.hoisted(() => ({
  setScope: vi.fn(),
  state: { override: {} as Record<string, unknown> },
}))

function makeItems(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    label: i === 0 ? '서울 성동구' : `서울 구${i}`,
    citySlug: 'seoul',
    districtSlug: i === 0 ? 'seongdong-gu' : `gu-${i}`,
    ppMedian: i === 0 ? 5280 : null,
    volRecent: 60 - i,
    volPrev: 40,
    changePct: i === 0 ? 34 : 12.5,
  }))
}

vi.mock('~/composables/useRisingRegions', async () => {
  const { ref } = await import('vue')
  return {
    useRisingRegions: () => ({
      scope: ref('all'),
      data: ref({
        scope: 'all',
        window: { from: '2026-08-31', to: '2026-09-29' },
        prevWindow: { from: '2026-08-01', to: '2026-08-30' },
        computedAt: '2026-10-30T00:00:00.000Z',
        items: makeItems(10),
      }),
      pending: ref(false),
      error: ref(null),
      setScope,
      ...state.override,
    }),
  }
})

import HomeRisingRegions from '~/components/home/HomeRisingRegions.vue'

function mountWith(override: Record<string, unknown> = {}) {
  state.override = override
  return mount(HomeRisingRegions, {
    global: {
      stubs: {
        HardLink: { template: '<a :href="to"><slot /></a>', props: ['to'] },
      },
    },
  })
}

describe('HomeRisingRegions', () => {
  beforeEach(() => setScope.mockClear())

  it('제목·기간·출처 문구를 렌더한다', () => {
    const wrapper = mountWith()
    expect(wrapper.find('h2').text()).toBe('요즘 거래가 늘어난 지역')
    expect(wrapper.text()).toContain('8월 31일~9월 29일 계약, 직전 30일 대비')
    expect(wrapper.text()).toContain('국토교통부 아파트 매매 실거래가 · 직거래·취소 제외 · 일상킷 집계')
  })

  it('항목에 순위·라벨·평당가·증가율·링크를 렌더한다', () => {
    const wrapper = mountWith()
    const first = wrapper.findAll('li[data-rising-item]')[0]
    expect(first.text()).toContain('1')
    expect(first.text()).toContain('서울 성동구')
    expect(first.text()).toContain('평당가 5,280만')
    expect(first.text()).toContain('+34%')
    expect(first.find('a').attributes('href')).toBe('/real-estate/apt-sale/seoul/seongdong-gu')
  })

  it('ppMedian 이 null 이면 평당가를 생략하고 소수 증가율은 한 자리로 보인다', () => {
    const wrapper = mountWith()
    const second = wrapper.findAll('li[data-rising-item]')[1]
    expect(second.text()).not.toContain('평당가')
    expect(second.text()).toContain('+12.5%')
  })

  it('10개를 렌더하고 6~10위는 모바일에서 숨긴 뒤 더 보기로 펼친다', async () => {
    const wrapper = mountWith()
    const items = wrapper.findAll('li[data-rising-item]')
    expect(items).toHaveLength(10)
    expect(items[4].classes()).not.toContain('hidden')
    expect(items[5].classes()).toContain('hidden')
    expect(items[5].classes()).toContain('md:block')

    const more = wrapper.find('button[data-testid="rising-more"]')
    expect(more.text()).toBe('10위까지 더 보기')
    expect(more.classes()).toContain('md:hidden')
    await more.trigger('click')
    expect(wrapper.findAll('li[data-rising-item]')[5].classes()).not.toContain('hidden')
    expect(wrapper.find('button[data-testid="rising-more"]').exists()).toBe(false)
  })

  it('5개 이하면 더 보기 버튼이 없다', () => {
    const wrapper = mountWith({
      data: ref({
        scope: 'all',
        window: { from: '2026-08-31', to: '2026-09-29' },
        prevWindow: { from: '2026-08-01', to: '2026-08-30' },
        computedAt: null,
        items: makeItems(3),
      }),
    })
    expect(wrapper.find('button[data-testid="rising-more"]').exists()).toBe(false)
  })

  it('탭은 role=group + aria-pressed 이고 클릭 시 setScope 를 호출한다', async () => {
    const wrapper = mountWith()
    const group = wrapper.find('[role="group"]')
    expect(group.exists()).toBe(true)
    const tabs = group.findAll('button')
    expect(tabs.map((t) => t.text())).toEqual(['전국', '수도권', '지방'])
    expect(tabs[0].attributes('aria-pressed')).toBe('true')
    expect(tabs[1].attributes('aria-pressed')).toBe('false')
    expect(tabs[1].classes()).toContain('min-h-[44px]')
    await tabs[1].trigger('click')
    expect(setScope).toHaveBeenCalledWith('capital')
  })

  it('items 가 비면 빈 문구를 보여 준다', () => {
    const wrapper = mountWith({
      data: ref({
        scope: 'capital',
        window: { from: '2026-08-31', to: '2026-09-29' },
        prevWindow: { from: '2026-08-01', to: '2026-08-30' },
        computedAt: null,
        items: [],
      }),
    })
    expect(wrapper.text()).toContain('이 기간 거래가 늘어난 지역이 없습니다')
    expect(wrapper.find('[role="group"]').exists()).toBe(true)
  })

  it('API 실패 시 목록·탭을 숨기고 제목과 시·도 칩은 렌더한다', () => {
    const wrapper = mountWith({ data: ref(null), error: ref(new Error('x')) })
    expect(wrapper.find('h2').text()).toBe('요즘 거래가 늘어난 지역')
    expect(wrapper.find('li[data-rising-item]').exists()).toBe(false)
    expect(wrapper.find('[role="group"]').exists()).toBe(false)
    expect(wrapper.find('a[href="/seoul/"]').exists()).toBe(true)
  })

  it('시·도 칩은 항상 렌더하고 공통 칩(.ui-chip)을 쓴다', () => {
    const wrapper = mountWith()
    const chip = wrapper.find('a[href="/seoul/"]')
    expect(chip.exists()).toBe(true)
    expect(chip.classes()).toContain('ui-chip')
    expect(chip.classes()).not.toContain('rounded-full')
    expect(wrapper.text()).toContain('시·도별 바로가기')
  })
})
