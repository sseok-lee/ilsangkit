import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import SegmentedControl from '~/components/common/SegmentedControl.vue'

const radioItems = [
  { value: 'apt', label: '아파트' },
  { value: 'villa', label: '빌라' },
  { value: 'offitel', label: '오피스텔' },
]

describe('SegmentedControl — 라디오 모드', () => {
  it('radiogroup 과 aria-checked 를 렌더한다', () => {
    const w = mount(SegmentedControl, { props: { items: radioItems, modelValue: 'villa', ariaLabel: '건물 유형' } })
    const group = w.get('[role="radiogroup"]')
    expect(group.attributes('aria-label')).toBe('건물 유형')
    const radios = w.findAll('[role="radio"]')
    expect(radios.map((r) => r.attributes('aria-checked'))).toEqual(['false', 'true', 'false'])
    expect(radios[1].classes()).toContain('ui-segmented__item--selected')
  })

  it('선택 칸만 tabindex=0(로빙 tabindex), 선택이 없으면 첫 칸', () => {
    const sel = mount(SegmentedControl, { props: { items: radioItems, modelValue: 'offitel', ariaLabel: 'x' } })
    expect(sel.findAll('[role="radio"]').map((r) => r.attributes('tabindex'))).toEqual(['-1', '-1', '0'])
    const none = mount(SegmentedControl, { props: { items: radioItems, ariaLabel: 'x' } })
    expect(none.findAll('[role="radio"]').map((r) => r.attributes('tabindex'))).toEqual(['0', '-1', '-1'])
  })

  it('클릭하면 update:modelValue 를 내보낸다', async () => {
    const w = mount(SegmentedControl, { props: { items: radioItems, modelValue: 'apt', ariaLabel: 'x' } })
    await w.findAll('[role="radio"]')[2].trigger('click')
    expect(w.emitted('update:modelValue')).toEqual([['offitel']])
  })

  it('방향키로 이동하며 끝에서 처음으로 돈다', async () => {
    const w = mount(SegmentedControl, { props: { items: radioItems, modelValue: 'offitel', ariaLabel: 'x' }, attachTo: document.body })
    const group = w.get('[role="radiogroup"]')
    await group.trigger('keydown', { key: 'ArrowRight' })
    await group.trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')).toEqual([['apt'], ['villa']])
    w.unmount()
  })
})

describe('SegmentedControl — 링크 모드', () => {
  const linkItems = [
    { value: 'sale', label: '매매', to: '/real-estate/apt-sale' },
    { value: 'rent', label: '전월세', to: '/real-estate/apt-rent' },
  ]

  it('모든 항목에 to 가 있으면 링크 그룹으로 렌더하고 선택 칸에 aria-current', () => {
    const w = mount(SegmentedControl, { props: { items: linkItems, modelValue: 'rent', ariaLabel: '거래 유형' } })
    expect(w.find('[role="radiogroup"]').exists()).toBe(false)
    expect(w.get('[role="group"]').attributes('aria-label')).toBe('거래 유형')
    const links = w.findAll('a')
    expect(links.map((a) => a.attributes('href'))).toEqual(['/real-estate/apt-sale', '/real-estate/apt-rent'])
    expect(links[0].attributes('aria-current')).toBeUndefined()
    expect(links[1].attributes('aria-current')).toBe('page')
    expect(links[1].classes()).toContain('ui-segmented__item--selected')
  })
})

describe('SegmentedControl — fill', () => {
  it('fill 이면 ui-segmented--fill 클래스(라디오·링크 모드 모두), 기본은 없다', () => {
    const base = { items: radioItems, ariaLabel: 'x' }
    expect(mount(SegmentedControl, { props: base }).get('.ui-segmented').classes()).not.toContain('ui-segmented--fill')
    expect(mount(SegmentedControl, { props: { ...base, fill: true } }).get('.ui-segmented').classes()).toContain('ui-segmented--fill')
    const linkItems = radioItems.map((i) => ({ ...i, to: `/${i.value}` }))
    const link = mount(SegmentedControl, { props: { items: linkItems, ariaLabel: 'x', fill: true } })
    expect(link.get('.ui-segmented').classes()).toContain('ui-segmented--fill')
  })

  it.runIf(import.meta.dev)('to 가 일부만 있으면 dev 경고 후 라디오 모드', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const w = mount(SegmentedControl, { props: { items: [{ ...radioItems[0], to: '/a' }, radioItems[1]], ariaLabel: 'x' } })
    expect(w.find('[role="radiogroup"]').exists()).toBe(true)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
