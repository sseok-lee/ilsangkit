import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ContentToc from '~/components/guide/ContentToc.vue'

describe('ContentToc', () => {
  it('has real heading links and a native collapsible mobile navigation', () => {
    const wrapper = mount(ContentToc, { props: { items: [
      { id: 'content-section-1', depth: 2, labelHtml: '이용 <strong>안내</strong>' },
      { id: 'content-section-2', depth: 3, labelHtml: '세부 안내' },
    ] } })
    expect(wrapper.findAll('a[href="#content-section-1"]')).toHaveLength(2)
    expect(wrapper.findAll('a[href="#content-section-2"]')).toHaveLength(2)
    expect(wrapper.get('summary').text()).toBe('목차')
    expect(wrapper.get('details').attributes('open')).toBeUndefined()
    expect(wrapper.get('strong').text()).toBe('안내')
  })
  it('renders no navigation when the body has no headings', () => {
    const wrapper = mount(ContentToc, { props: { items: [] } })
    expect(wrapper.find('nav').exists()).toBe(false)
    expect(wrapper.find('details').exists()).toBe(false)
  })
})
