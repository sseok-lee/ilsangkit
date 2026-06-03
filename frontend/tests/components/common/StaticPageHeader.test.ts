import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import StaticPageHeader from '~/components/common/StaticPageHeader.vue'

describe('StaticPageHeader', () => {
  it('renders the title in an h1', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: '일상킷 소개' } })
    const h1 = wrapper.find('h1')
    expect(h1.exists()).toBe(true)
    expect(h1.text()).toBe('일상킷 소개')
  })

  it('renders the lead paragraph when lead prop is given', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T', lead: '한줄 소개입니다.' } })
    expect(wrapper.text()).toContain('한줄 소개입니다.')
  })

  it('does NOT render the update badge when updatedAt is absent', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T' } })
    expect(wrapper.text()).not.toContain('마지막 업데이트')
  })

  it('renders the update badge when updatedAt is given', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T', updatedAt: '2026.06.01' } })
    expect(wrapper.text()).toContain('마지막 업데이트 2026.06.01')
  })

  it('renders the update badge icon as a material-symbol, not an emoji', () => {
    const wrapper = mount(StaticPageHeader, { props: { title: 'T', updatedAt: '2026.06.01' } })
    expect(wrapper.text()).not.toContain('📅')
    const icon = wrapper.find('.material-symbols-outlined')
    expect(icon.exists()).toBe(true)
    expect(icon.text()).toBe('calendar_month')
  })
})

