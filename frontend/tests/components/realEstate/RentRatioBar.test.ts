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
})
