import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import TrendBadge from '~/components/realEstate/TrendBadge.vue'

describe('TrendBadge', () => {
  it('null/undefined → 보합', () => {
    const wA = mount(TrendBadge, { props: { ratio: null } })
    expect(wA.text()).toContain('보합')

    const wB = mount(TrendBadge, { props: { ratio: undefined } })
    expect(wB.text()).toContain('보합')
  })

  it('flatThreshold(0.5%) 이내는 보합', () => {
    const wrapper = mount(TrendBadge, { props: { ratio: 0.003 } })
    expect(wrapper.text()).toContain('보합')
  })

  it('양수 → ▲ + 빨강', () => {
    const wrapper = mount(TrendBadge, { props: { ratio: 0.032 } })
    expect(wrapper.text()).toContain('▲')
    expect(wrapper.text()).toContain('3.2%')
    expect(wrapper.html()).toContain('text-red-600')
  })

  it('음수 → ▼ + 초록', () => {
    const wrapper = mount(TrendBadge, { props: { ratio: -0.025 } })
    expect(wrapper.text()).toContain('▼')
    expect(wrapper.text()).toContain('2.5%')
    expect(wrapper.html()).toContain('text-emerald-600')
  })

  it('flatThreshold prop으로 임계값 조정', () => {
    const wrapper = mount(TrendBadge, { props: { ratio: 0.01, flatThreshold: 0.02 } })
    expect(wrapper.text()).toContain('보합')
  })
})
