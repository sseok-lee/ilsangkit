import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SummaryRow from '~/components/common/SummaryRow.vue'

const items = [
  { label: '종별', value: '의원' },
  { label: '의사', value: 3, unit: '명' },
  { label: '주차', value: 5, unit: '대' },
]

describe('SummaryRow', () => {
  it('항목마다 dt/dd 쌍을 렌더한다', () => {
    const w = mount(SummaryRow, { props: { items } })
    expect(w.element.tagName).toBe('DL')
    expect(w.findAll('dt').map((d) => d.text())).toEqual(['종별', '의사', '주차'])
    expect(w.findAll('dd').length).toBe(3)
  })

  it('단위를 값 뒤 별도 span 으로 렌더한다', () => {
    const w = mount(SummaryRow, { props: { items } })
    const dd = w.findAll('dd')[1]
    expect(dd.text()).toBe('3명')
    expect(dd.get('.summary-row__unit').text()).toBe('명')
    expect(w.findAll('dd')[0].find('.summary-row__unit').exists()).toBe(false)
  })

  it('PC 열 수를 항목 수(최대 4)로 CSS 변수에 넘긴다', () => {
    const w = mount(SummaryRow, { props: { items } })
    expect(w.attributes('style')).toContain('--summary-cols: 3')
    const many = Array.from({ length: 6 }, (_, i) => ({ label: `k${i}`, value: i }))
    expect(mount(SummaryRow, { props: { items: many } }).attributes('style')).toContain('--summary-cols: 4')
  })
})

describe('SummaryRow — tone', () => {
  it.each(['brand', 'success', 'danger', 'delta-up', 'delta-down'] as const)('tone=%s 이면 값에 summary-row__value--%s 클래스', (tone) => {
    const w = mount(SummaryRow, { props: { items: [{ label: 'a', value: 1, tone }] } })
    expect(w.get('dd').classes()).toContain(`summary-row__value--${tone}`)
  })

  it('tone 이 없으면 톤 클래스가 없다', () => {
    const w = mount(SummaryRow, { props: { items } })
    for (const dd of w.findAll('dd')) {
      expect(dd.classes().filter((c) => c.startsWith('summary-row__value--'))).toEqual([])
    }
  })
})
