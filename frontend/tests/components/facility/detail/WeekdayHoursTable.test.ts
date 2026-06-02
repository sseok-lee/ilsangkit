import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import WeekdayHoursTable from '~/components/facility/detail/WeekdayHoursTable.vue'

const rows = [
  { day: '월', time: '09:00 ~ 18:00', isToday: false, closed: false },
  { day: '화', time: '09:00 ~ 18:00', isToday: true, closed: false },
  { day: '일', time: '휴무', isToday: false, closed: true },
]

describe('WeekdayHoursTable', () => {
  it('title과 시간 헤더, 요일 행을 렌더한다', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', rows } })
    expect(w.text()).toContain('요일별 진료시간')
    expect(w.text()).toContain('진료시간')
    expect(w.findAll('tbody tr')).toHaveLength(3)
    expect(w.text()).toContain('09:00 ~ 18:00')
  })

  it('isToday 행에 ★ 및 강조 클래스를 적용한다', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', rows } })
    const todayRow = w.findAll('tbody tr')[1]
    expect(todayRow.text()).toContain('★')
    expect(todayRow.classes()).toContain('bg-primary-50')
  })

  it('closed 행은 회색 스타일', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', rows } })
    const closedCell = w.findAll('tbody tr')[2].findAll('td')[1]
    expect(closedCell.classes()).toContain('text-gray-400')
  })

  it('allDay 행은 green 스타일', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 이용시간', timeHeader: '이용시간', rows: [{ day: '월', time: '24시간', isToday: false, allDay: true }] } })
    const cell = w.find('tbody tr').findAll('td')[1]
    expect(cell.classes()).toContain('text-green-600')
  })

  it('showLunch=true면 점심 컬럼을 렌더한다', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 진료시간', timeHeader: '진료시간', showLunch: true, rows: [{ day: '월', time: '09:00 ~ 18:00', isToday: false, lunch: '12:30 ~ 13:30' }] } })
    expect(w.text()).toContain('점심')
    expect(w.text()).toContain('12:30 ~ 13:30')
  })

  it('showLunch 기본 false면 점심 헤더 없음', () => {
    const w = mount(WeekdayHoursTable, { props: { title: '요일별 이용시간', timeHeader: '이용시간', rows } })
    expect(w.find('thead').text()).not.toContain('점심')
  })
})
