import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RegionTrashSchedule from '~/components/region/RegionTrashSchedule.vue'

const stubs = {
  WasteScheduleCard: { props: ['region'], template: '<div class="card">{{ region.targetRegion }}</div>' },
  Pagination: { template: '<nav />' },
}

function mountWith(props: Record<string, unknown> = {}) {
  return mount(RegionTrashSchedule, {
    props: {
      total: 0,
      loading: false,
      contact: null,
      schedules: [],
      currentPage: 1,
      totalPages: 1,
      error: null,
      ...props,
    },
    global: { stubs },
  })
}

describe('RegionTrashSchedule 조회 실패 표시', () => {
  // 조회가 실패했을 때 "등록된 배출 일정이 없습니다" 로 렌더하면
  // 데이터가 없는 지역과 장애를 구분할 수 없다. 시설 그리드(RegionFacilitiesGrid)와
  // 같이 오류 + 재시도로 분리한다.
  it('오류일 때 재시도 버튼을 보여준다', () => {
    const wrapper = mountWith({ error: '배출 일정을 불러오지 못했습니다' })

    expect(wrapper.text()).toContain('배출 일정을 불러오지 못했습니다')
    expect(wrapper.find('button').exists()).toBe(true)
  })

  it('오류를 "등록된 배출 일정이 없습니다" 로 바꿔 표시하지 않는다', () => {
    const wrapper = mountWith({ error: '배출 일정을 불러오지 못했습니다' })

    expect(wrapper.text()).not.toContain('등록된 배출 일정이 없습니다')
  })

  it('재시도 버튼은 retry 이벤트를 올린다', async () => {
    const wrapper = mountWith({ error: '배출 일정을 불러오지 못했습니다' })

    await wrapper.get('button').trigger('click')

    expect(wrapper.emitted('retry')).toHaveLength(1)
  })

  it('오류가 없고 결과가 0건이면 기존 빈 상태를 유지한다', () => {
    const wrapper = mountWith({ error: null })

    expect(wrapper.text()).toContain('등록된 배출 일정이 없습니다')
  })
})
