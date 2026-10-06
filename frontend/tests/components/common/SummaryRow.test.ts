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

const leadItems = [
  { label: '최근 매매', value: '12억 5,000만', note: '2026.09 · 84㎡ · 12층' },
  { label: '건축연도', value: '2000년' },
  { label: '거래된 전용면적', value: '59~114㎡' },
  { label: '6개월 매매 · 전체 면적', value: '8건' },
]

describe('SummaryRow lead·note', () => {
  it('기본은 lead 클래스가 없고 note 가 없으면 보조 줄도 없다', () => {
    const w = mount(SummaryRow, { props: { items: leadItems.map(({ note, ...rest }) => rest) } })
    expect(w.get('dl').classes()).not.toContain('summary-row--lead')
    expect(w.find('.summary-row__note').exists()).toBe(false)
  })

  it('lead 면 루트에 summary-row--lead, note 는 값 아래 dd 로 그린다', () => {
    const w = mount(SummaryRow, { props: { items: leadItems, lead: true }, attrs: { 'aria-label': '실거래 요약' } })
    const dl = w.get('dl')
    expect(dl.classes()).toContain('summary-row--lead')
    expect(dl.attributes('aria-label')).toBe('실거래 요약')
    const first = w.findAll('.summary-row__item')[0]
    const dds = first.findAll('dd')
    expect(dds).toHaveLength(2)
    expect(dds[0].classes()).toContain('summary-row__value')
    expect(dds[1].classes()).toContain('summary-row__note')
    expect(dds[1].text()).toBe('2026.09 · 84㎡ · 12층')
  })
})
