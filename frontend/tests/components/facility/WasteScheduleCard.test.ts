import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteScheduleCard from '~/components/facility/WasteScheduleCard.vue'

const schedule = {
  id: 15019,
  city: '대구광역시',
  district: '달성군',
  targetRegion: '간경리',
  emissionPlace: '집앞',
  emissionPlaceType: '문전수거',
  uncollectedDay: '설+추석+일요일',
  wasteTypes: [
    { type: '일반쓰레기' as const, dayOfWeek: ['월', '화', '수', '목', '금'] },
    { type: '음식물쓰레기' as const, dayOfWeek: ['일', '화', '목'] },
  ],
}

describe('WasteScheduleCard', () => {
  it('현재 지역으로 이동하는 링크 대신 상세 선택 이벤트를 발생시킨다', async () => {
    const wrapper = mount(WasteScheduleCard, {
      props: { region: schedule },
      global: {
        stubs: {
          CategoryIcon: { template: '<span />' },
        },
      },
    })

    expect(wrapper.find('a').exists()).toBe(false)
    expect(wrapper.get('button').attributes('aria-label')).toContain('상세 정보 보기')

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('select')).toEqual([[schedule]])
  })
})
