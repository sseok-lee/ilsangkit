import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'

const stubs = { NuxtLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } }

describe('SearchResultGroup', () => {
  it('라벨·건수·더보기 링크를 렌더한다', () => {
    const w = mount(SearchResultGroup, {
      props: { label: '화장실', count: 12, countUnit: '곳', moreHref: '/toilet?keyword=강남' },
      slots: { default: '<div class="card">c</div>' },
      global: { stubs },
    })
    expect(w.text()).toContain('화장실')
    expect(w.text()).toContain('12')
    const more = w.find('a[href="/toilet?keyword=강남"]')
    expect(more.exists()).toBe(true)
    expect(more.text()).toContain('더보기')
    expect(w.find('.card').exists()).toBe(true)
  })

  it('moreHref 없으면 더보기가 버튼이고 클릭 시 more 이벤트를 emit한다', async () => {
    const w = mount(SearchResultGroup, { props: { label: '아파트', count: 3 }, global: { stubs } })
    const btn = w.find('button')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')
    expect(w.emitted('more')).toBeTruthy()
  })
})
