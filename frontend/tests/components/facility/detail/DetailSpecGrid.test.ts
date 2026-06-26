// frontend/tests/components/facility/detail/DetailSpecGrid.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailSpecGrid from '~/components/facility/detail/DetailSpecGrid.vue'
import WeekdayHoursTable from '~/components/facility/detail/WeekdayHoursTable.vue'
import type { SpecGroup } from '~/utils/facilitySpecGroups'

const globalConfig = {
  stubs: { SectionBlock: { template: '<section data-testid="spec-section"><slot /></section>' } },
}

function mountGrid(groups: SpecGroup[]) {
  return mount(DetailSpecGrid, { props: { groups }, global: globalConfig })
}

describe('DetailSpecGrid', () => {
  it('table group: 셀 값을 렌더하고 null은 —', () => {
    const groups: SpecGroup[] = [{
      render: 'table',
      table: { columns: ['구분', '남성', '여성'], rows: [{ label: '소변기', cells: [47, null] }] },
    }]
    const html = mountGrid(groups).html()
    expect(html).toContain('47')
    expect(html).toContain('—')
  })

  it('value 행: 빈 값은 정보 없음', () => {
    const html = mountGrid([{ render: 'kv', rows: [{ label: '개보수 시기', value: '', kind: 'value' }] }]).html()
    expect(html).toContain('개보수 시기')
    expect(html).toContain('정보 없음')
  })

  it('flag 행: 값 없으면 행 자체가 없다', () => {
    const wrapper = mountGrid([{ render: 'kv', rows: [
      { label: 'CCTV', value: '설치됨', kind: 'flag' },
      { label: '비상벨', value: null, kind: 'flag' },
    ] }])
    const text = wrapper.text()
    expect(text).toContain('CCTV')
    expect(text).toContain('설치됨')
    expect(text).not.toContain('비상벨')
  })

  it('빈 groups면 아무 행도 없다', () => {
    const wrapper = mountGrid([])
    expect(wrapper.text()).not.toContain('정보 없음')
  })

  it('tags group: 칩으로 렌더', () => {
    const html = mountGrid([{ render: 'tags', tagVariant: 'gray', tags: [{ label: '채소' }, { label: '과일' }] }]).html()
    expect(html).toContain('채소'); expect(html).toContain('과일')
  })

  it('weekly group: WeekdayHoursTable에 위임', () => {
    const w = mountGrid([{ heading: '진료시간', render: 'weekly', weekly: { timeHeader: '진료시간', rows: [{ day: '월', time: '09:00 ~ 18:00', todayIdx: 1 }] } }])
    expect(w.findComponent(WeekdayHoursTable).exists()).toBe(true)
  })

  it('href row: 앵커로 렌더', () => {
    const w = mountGrid([{ render: 'kv', rows: [{ label: '홈페이지', value: 'example.com', href: 'http://example.com', kind: 'value' }] }])
    const a = w.find('a'); expect(a.exists()).toBe(true); expect(a.attributes('href')).toBe('http://example.com')
  })

  it('visibleGroups: 빈 tags/weekly 그룹 숨김', () => {
    expect(mountGrid([{ render: 'tags', tags: [] }]).text().trim()).toBe('')
    expect(mountGrid([{ render: 'weekly', weekly: { timeHeader: 't', rows: [{ day: '월', time: '휴진', closed: true, todayIdx: 1 }] } }]).text().trim()).toBe('')
  })
})
