import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import WasteScheduleDetailModal from '~/components/trash/WasteScheduleDetailModal.vue'

const schedule = {
  id: 15019,
  city: '대구광역시',
  district: '달성군',
  targetRegion: '간경리',
  emissionPlace: '집앞',
  details: {
    emissionPlaceType: '문전수거',
    livingWaste: {
      dayOfWeek: '월+화+수+목+금',
      beginTime: '20:00',
      endTime: '02:00',
      method: '규격봉투에 넣어 지정된 요일에 배출',
    },
    foodWaste: {
      dayOfWeek: '일+화+목',
      beginTime: '20:00',
      endTime: '02:00',
      method: '전용용기에 넣고 납부필증을 부착하여 배출',
    },
    recyclable: {
      dayOfWeek: '월+수+금',
      beginTime: '20:00',
      endTime: '02:00',
      method: '투명 비닐봉투에 담아 배출',
    },
    bulkWaste: {
      place: '대구환경자원사업소',
      beginTime: '09:00',
      endTime: '15:00',
      method: '신고 후 지정 장소에 배출',
    },
    uncollectedDay: '설+추석+일요일',
    manageDepartment: '청소위생과',
    managePhone: '053-668-2733',
  },
}

describe('WasteScheduleDetailModal', () => {
  it('배출 일정 상세와 담당부서 연락처를 dialog로 표시한다', () => {
    const wrapper = mount(WasteScheduleDetailModal, {
      attachTo: document.body,
      props: { open: true, schedule, loading: false },
      global: { stubs: { teleport: true } },
    })

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.attributes('aria-modal')).toBe('true')
    expect(dialog.text()).toContain('간경리 쓰레기 배출 일정')
    expect(dialog.text()).toContain('월 · 화 · 수 · 목 · 금')
    expect(dialog.text()).toContain('20:00 ~ 익일 02:00')
    expect(dialog.text()).toContain('대구환경자원사업소')
    expect(dialog.text()).toContain('설 · 추석 · 일요일')
    expect(dialog.get('a[href="tel:053-668-2733"]').attributes('href')).toBe('tel:053-668-2733')

    wrapper.unmount()
  })

  it('닫기 버튼과 Escape 키로 close 이벤트를 발생시킨다', async () => {
    const wrapper = mount(WasteScheduleDetailModal, {
      attachTo: document.body,
      props: { open: true, schedule, loading: false },
      global: { stubs: { teleport: true } },
    })

    await wrapper.get('[data-testid="trash-detail-close"]').trigger('click')
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))

    expect(wrapper.emitted('close')).toHaveLength(2)
    wrapper.unmount()
  })
})
