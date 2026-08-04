import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapBottomSheet from '~/components/realEstate/map/MapBottomSheet.vue'

describe('MapBottomSheet', () => {
  // 높이(height) 클래스가 아니라 top/bottom 인셋으로 크기를 준다 — AdSense 스크립트가
  // 광고 조상 전체에 `height: auto !important` 를 주입해도(RealEstateMapExplorer 와 동일한
  // 기법) top+bottom 이 박스를 확정하므로 무력화되지 않는다. 회귀 방지를 위해 시트 루트에
  // height 기반 사이징 클래스(h-[...])가 다시 붙지 않는지도 함께 검증한다.
  it('기본은 접힌 상태다 — aria-expanded=false, top 인셋이 하단 38%를 차지한다', () => {
    const w = mount(MapBottomSheet)
    const handle = w.find('button')
    const sheet = w.get('[class*="fixed"]')
    expect(handle.attributes('aria-expanded')).toBe('false')
    expect(sheet.classes()).toContain('top-[62dvh]')
    expect(sheet.classes()).toContain('bottom-0')
    expect(sheet.classes().some((c) => /^h-\[/.test(c))).toBe(false)
  })

  it('핸들 클릭 시 펼쳐진다 — aria-expanded=true, top 인셋이 하단 75%를 차지한다', async () => {
    const w = mount(MapBottomSheet)
    await w.find('button').trigger('click')

    const sheet = w.get('[class*="fixed"]')
    expect(w.find('button').attributes('aria-expanded')).toBe('true')
    expect(sheet.classes()).toContain('top-[25dvh]')
    expect(sheet.classes()).toContain('bottom-0')
    expect(sheet.classes().some((c) => /^h-\[/.test(c))).toBe(false)
  })

  it('다시 클릭하면 접힌다 (토글)', async () => {
    const w = mount(MapBottomSheet)
    await w.find('button').trigger('click')
    await w.find('button').trigger('click')

    const sheet = w.get('[class*="fixed"]')
    expect(w.find('button').attributes('aria-expanded')).toBe('false')
    expect(sheet.classes()).toContain('top-[62dvh]')
  })

  it('슬롯 콘텐츠를 렌더한다', () => {
    const w = mount(MapBottomSheet, {
      slots: { default: '<div data-testid="sheet-content">목록</div>' },
    })
    expect(w.find('[data-testid="sheet-content"]').exists()).toBe(true)
    expect(w.text()).toContain('목록')
  })

  it('내부 스크롤 컨테이너도 height 기반이 아닌 absolute 인셋으로 크기를 잡는다', () => {
    const w = mount(MapBottomSheet)
    const scroller = w.get('.overflow-y-auto')
    expect(scroller.classes()).toContain('absolute')
    expect(scroller.classes()).toContain('top-11')
    expect(scroller.classes()).toContain('bottom-0')
    expect(scroller.classes().some((c) => /^h-\[/.test(c))).toBe(false)
  })
})
