import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UiChip from '~/components/common/UiChip.vue'

describe('UiChip', () => {
  it('to 가 있으면 링크, 선택 시 aria-current=page + 선택 클래스', () => {
    const w = mount(UiChip, { props: { to: '/hospital?city=seoul', selected: true }, slots: { default: '서울' } })
    const a = w.get('a')
    expect(a.attributes('href')).toBe('/hospital?city=seoul')
    expect(a.attributes('aria-current')).toBe('page')
    expect(a.classes()).toEqual(expect.arrayContaining(['ui-chip', 'ui-chip--selected']))
  })

  it('선택되지 않은 링크 칩에는 aria-current 가 없다', () => {
    const a = mount(UiChip, { props: { to: '/hospital?city=busan' } }).get('a')
    expect(a.attributes('aria-current')).toBeUndefined()
    expect(a.classes()).not.toContain('ui-chip--selected')
  })

  it('to 가 없으면 aria-pressed 토글 버튼이고 click 을 내보낸다', async () => {
    const w = mount(UiChip, { props: { selected: false }, slots: { default: '내과' } })
    const b = w.get('button')
    expect(b.attributes('type')).toBe('button')
    expect(b.attributes('aria-pressed')).toBe('false')
    await b.trigger('click')
    expect(w.emitted('click')).toHaveLength(1)
    await w.setProps({ selected: true })
    expect(w.get('button').attributes('aria-pressed')).toBe('true')
    expect(w.get('button').classes()).toContain('ui-chip--selected')
  })
})
