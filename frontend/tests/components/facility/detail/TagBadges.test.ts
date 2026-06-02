import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import TagBadges from '~/components/facility/detail/TagBadges.vue'

describe('TagBadges', () => {
  it('items를 칩으로 렌더한다', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '내과' }, { label: '외과' }], variant: 'teal' } })
    expect(w.text()).toContain('내과')
    expect(w.text()).toContain('외과')
    expect(w.findAll('span').length).toBeGreaterThanOrEqual(2)
  })
  it('teal variant는 teal 클래스', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '내과' }], variant: 'teal' } })
    expect(w.html()).toContain('bg-teal-50')
  })
  it('suffix를 렌더한다', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '내과', suffix: '(3명)' }], variant: 'teal' } })
    expect(w.text()).toContain('(3명)')
  })
  it('per-item colorClass 적용(childcare)', () => {
    const w = mount(TagBadges, { props: { items: [{ label: '경력', suffix: '5명', colorClass: 'bg-indigo-100 text-indigo-700' }], variant: 'custom' } })
    expect(w.html()).toContain('bg-indigo-100')
  })
})
