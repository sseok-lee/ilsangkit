import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailLocationGuide from '~/components/facility/detail/DetailLocationGuide.vue'

const base = {
  stations: [{ id: '1', name: '천호(풍납토성)', nameSlug: 'cheonho', line: '5호선', distance: 96, type: 'subway' as const }],
  alternatives: [{ id: 'a', category: 'toilet', name: '강동역 화장실', roadAddress: '서울 강동구', distance: 802 }],
}

describe('DetailLocationGuide', () => {
  it('가까운 역과 도보 환산을 표시', () => {
    const text = mount(DetailLocationGuide, { props: { ...base, alternativeLabel: '가까운 다른 화장실' } }).text()
    expect(text).toContain('천호(풍납토성)')
    expect(text).toContain('5호선')
    expect(text).toContain('도보') // 96m < 800 → 도보 N분
  })

  it('대안 리스트를 링크로 렌더', () => {
    const wrapper = mount(DetailLocationGuide, { props: { ...base } })
    const a = wrapper.find('a')
    expect(a.attributes('href')).toBe('/toilet/a')
    expect(wrapper.text()).toContain('강동역 화장실')
    expect(wrapper.text()).toContain('802m')
  })

  it('stations·alternatives 모두 비면 렌더 안 함', () => {
    const wrapper = mount(DetailLocationGuide, { props: { stations: [], alternatives: [] } })
    expect(wrapper.text().trim()).toBe('')
  })
})
