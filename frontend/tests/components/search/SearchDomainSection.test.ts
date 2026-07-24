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
    expect(w.find('.g').exists()).toBe(true)
  })
})
