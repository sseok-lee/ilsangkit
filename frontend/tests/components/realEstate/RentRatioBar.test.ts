import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RentRatioBar from '~/components/realEstate/RentRatioBar.vue'

describe('RentRatioBar', () => {
  it('전세/월세 비율을 표시한다', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 7, wolseCount: 3 } })
    expect(w.text()).toContain('전세 70%')
    expect(w.text()).toContain('월세 30%')
  })
  it('합계가 0이면 아무것도 렌더하지 않는다', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 0, wolseCount: 0 } })
    expect(w.find('[data-testid="rent-ratio"]').exists()).toBe(false)
  })
  it('role="img"와 비율·건수 요약 aria-label을 가진다', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 7, wolseCount: 3 } })
    const bar = w.find('[role="img"]')
    expect(bar.exists()).toBe(true)
    const label = bar.attributes('aria-label') ?? ''
    expect(label).toContain('전세 70%')
    expect(label).toContain('월세 30%')
    expect(label).toContain('전세 7건')
    expect(label).toContain('월세 3건')
  })
  it('한쪽이 0%면 그 세그먼트 라벨 텍스트를 렌더하지 않는다(0% 깨짐 방지)', () => {
    const w = mount(RentRatioBar, { props: { jeonseCount: 0, wolseCount: 5 } })
    expect(w.text()).not.toContain('전세 0%')
    expect(w.text()).toContain('월세 100%')
  })
})
