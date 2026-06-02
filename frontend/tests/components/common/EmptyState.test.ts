import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import EmptyState from '~/components/common/EmptyState.vue'

describe('EmptyState', () => {
  it('title과 기본 아이콘(search_off)을 렌더한다', () => {
    const w = mount(EmptyState, { props: { title: '검색 결과가 없습니다' } })
    expect(w.text()).toContain('검색 결과가 없습니다')
    expect(w.find('.material-symbols-outlined').text()).toBe('search_off')
  })
  it('icon prop을 반영한다', () => {
    const w = mount(EmptyState, { props: { title: 'x', icon: 'subway' } })
    expect(w.find('.material-symbols-outlined').text()).toBe('subway')
  })
  it('description이 있으면 렌더, 없으면 미렌더', () => {
    const withDesc = mount(EmptyState, { props: { title: 'x', description: '다른 검색어를 시도해보세요' } })
    expect(withDesc.text()).toContain('다른 검색어를 시도해보세요')
    const without = mount(EmptyState, { props: { title: 'x' } })
    expect(without.findAll('p').length).toBe(1)
  })
  it('기본 슬롯(액션)을 렌더한다', () => {
    const w = mount(EmptyState, { props: { title: 'x' }, slots: { default: '<a class="cta">홈으로</a>' } })
    expect(w.find('a.cta').exists()).toBe(true)
  })
})
