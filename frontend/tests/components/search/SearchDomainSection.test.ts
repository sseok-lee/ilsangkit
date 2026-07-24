import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchDomainSection from '~/components/search/SearchDomainSection.vue'

describe('SearchDomainSection', () => {
  it('제목·건수 라벨·슬롯을 렌더한다', () => {
    const w = mount(SearchDomainSection, {
      props: { title: '부동산', count: 13, countLabel: '실거래가' },
      slots: { default: '<div class="g">그룹</div>' },
    })
    expect(w.find('h2').text()).toBe('부동산')
    expect(w.text()).toContain('13')
    // 단위는 건물·시설 수(곳)이지 거래 건수(건)가 아니다 — 오해 소지 있는 '건' 금지
    expect(w.text()).toContain('곳')
    expect(w.text()).not.toContain('건')
    expect(w.find('.g').exists()).toBe(true)
  })
})
