import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import FacilityRoadview from '~/components/facility/FacilityRoadview.vue'

// initRoadview 는 호출하지 않도록 stub (마크업만 검증)
vi.mock('~/composables/useKakaoMap', () => ({
  useKakaoMap: () => ({ initRoadview: vi.fn() }),
}))

const stubs = { ClientOnly: { template: '<div><slot /></div>' } }

describe('FacilityRoadview — 높이는 부모가 결정', () => {
  it('외곽 컨테이너는 h-full 이며 자기 높이를 강제하지 않는다', () => {
    const w = mount(FacilityRoadview, { props: { lat: 37.5, lng: 127.0 }, global: { stubs } })
    const outer = w.find('div.relative')
    expect(outer.classes()).toContain('h-full')
    expect(outer.classes()).not.toContain('h-[200px]')
    expect(outer.classes()).not.toContain('md:h-[240px]')
  })
})
