import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapBottomSheet from '~/components/realEstate/map/MapBottomSheet.vue'

describe('MapBottomSheet', () => {
  it('기본은 접힌 상태다 — aria-expanded=false, 낮은 높이(38vh)', () => {
    const w = mount(MapBottomSheet)
    const handle = w.find('button')
    expect(handle.attributes('aria-expanded')).toBe('false')
    expect(w.get('[class*="fixed"]').attributes('style')).toContain('height: 38vh')
  })

  it('핸들 클릭 시 펼쳐진다 — aria-expanded=true, 높은 높이(75vh)', async () => {
    const w = mount(MapBottomSheet)
    await w.find('button').trigger('click')

    expect(w.find('button').attributes('aria-expanded')).toBe('true')
    expect(w.get('[class*="fixed"]').attributes('style')).toContain('height: 75vh')
  })

  it('다시 클릭하면 접힌다 (토글)', async () => {
    const w = mount(MapBottomSheet)
    await w.find('button').trigger('click')
    await w.find('button').trigger('click')

    expect(w.find('button').attributes('aria-expanded')).toBe('false')
    expect(w.get('[class*="fixed"]').attributes('style')).toContain('height: 38vh')
  })

  it('슬롯 콘텐츠를 렌더한다', () => {
    const w = mount(MapBottomSheet, {
      slots: { default: '<div data-testid="sheet-content">목록</div>' },
    })
    expect(w.find('[data-testid="sheet-content"]').exists()).toBe(true)
    expect(w.text()).toContain('목록')
  })
})
