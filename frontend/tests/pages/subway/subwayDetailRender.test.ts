import { describe, it, expect, vi, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'

// 역정보 headline 단위만 검증하는 경량 하니스.
// 페이지 전체 mount는 useAsyncData/$fetch/카카오맵 의존이 커서,
// headline 마크업(노선 dedupe 배지 + h1 단일성)을 재현한 SFC 스니펫으로 가드한다.
import { lineColor, lineLabel, dedupeLines } from '~/utils/subwayLineColors'

const StationHeadline = defineComponent({
  props: { rawLines: { type: Array, default: () => [] }, name: { type: String, default: '' } },
  setup(props) {
    const lines = dedupeLines(props.rawLines as string[])
    return () =>
      h('section', [
        h('h1', props.name),
        h(
          'div',
          { 'data-test': 'line-headline' },
          lines.map((ln) =>
            h('span', { key: ln, style: { backgroundColor: lineColor(ln) } }, lineLabel(ln)),
          ),
        ),
      ])
  },
})

afterEach(() => vi.restoreAllMocks())

describe('subway 역정보 headline', () => {
  it('단일 h1을 유지한다', () => {
    const w = mount(StationHeadline, { props: { name: '강남역', rawLines: ['2호선'] } })
    expect(w.findAll('h1').length).toBe(1)
  })

  it('환승 노선을 dedupe해 색상 배지로 headline에 노출한다', () => {
    const w = mount(StationHeadline, { props: { name: '종로3가역', rawLines: ['1호선', '3호선', '5호선', '1호선'] } })
    const headline = w.find('[data-test="line-headline"]')
    expect(headline.exists()).toBe(true)
    const badges = headline.findAll('span')
    expect(badges.length).toBe(3) // 중복 1호선 제거
    expect(headline.text()).toContain('1호선')
    expect(headline.text()).toContain('5호선')
    badges.forEach((b) => expect(b.attributes('style')).toMatch(/background-color/))
  })

  it('렌더 중 콘솔 에러가 없다', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mount(StationHeadline, { props: { name: '강남역', rawLines: ['2호선'] } })
    expect(spy).not.toHaveBeenCalled()
  })
})
