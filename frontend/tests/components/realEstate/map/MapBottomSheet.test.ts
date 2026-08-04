import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapBottomSheet from '~/components/realEstate/map/MapBottomSheet.vue'

describe('MapBottomSheet', () => {
  // Tailwind 클래스로 높이를 준다(:style 인라인 바인딩이 아니다) — happy-dom 의 CSSOM은
  // 'dvh' 단위를 인식하지 못해 el.style 로 설정하면 속성 자체가 통째로 드롭된다(vh는 되는데
  // dvh만 안 됨, happy-dom 20.6.1에서 실측). class 는 문자열 그대로 DOM에 반영되므로
  // 실제 브라우저 동작(dvh 적용)과 테스트 가능성을 동시에 만족한다.
  it('기본은 접힌 상태다 — aria-expanded=false, 낮은 높이(38dvh)', () => {
    const w = mount(MapBottomSheet)
    const handle = w.find('button')
    expect(handle.attributes('aria-expanded')).toBe('false')
    expect(w.get('[class*="fixed"]').classes()).toContain('h-[38dvh]')
  })

  it('핸들 클릭 시 펼쳐진다 — aria-expanded=true, 높은 높이(75dvh)', async () => {
    const w = mount(MapBottomSheet)
    await w.find('button').trigger('click')

    expect(w.find('button').attributes('aria-expanded')).toBe('true')
    expect(w.get('[class*="fixed"]').classes()).toContain('h-[75dvh]')
  })

  it('다시 클릭하면 접힌다 (토글)', async () => {
    const w = mount(MapBottomSheet)
    await w.find('button').trigger('click')
    await w.find('button').trigger('click')

    expect(w.find('button').attributes('aria-expanded')).toBe('false')
    expect(w.get('[class*="fixed"]').classes()).toContain('h-[38dvh]')
  })

  it('슬롯 콘텐츠를 렌더한다', () => {
    const w = mount(MapBottomSheet, {
      slots: { default: '<div data-testid="sheet-content">목록</div>' },
    })
    expect(w.find('[data-testid="sheet-content"]').exists()).toBe(true)
    expect(w.text()).toContain('목록')
  })
})
