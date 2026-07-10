import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailBasicInfo from '~/components/facility/detail/DetailBasicInfo.vue'
import type { FacilityDetail } from '~/types/facility'

const pharmacyFixture = {
  id: 'pharmacy-test',
  category: 'pharmacy',
  name: '테스트약국',
  address: '서울특별시 강남구 테스트로 1',
  lat: 37.5,
  lng: 127.0,
} as unknown as FacilityDetail

const baseProps = {
  hospitalOperatingHours: [],
  hospitalWeeklyHours: [],
  hospitalWeeklyHoursCount: 0,
  aedOperatingHours: [],
  aedWeeklyHours: [],
  aedWeeklyHoursCount: 0,
  pharmacyWeeklyHours: [],
}

describe('DetailBasicInfo — SourceStamp', () => {
  it('제공기관과 동기화 날짜를 섹션 헤더에 렌더한다', () => {
    const w = mount(DetailBasicInfo, {
      props: { facility: pharmacyFixture, ...baseProps, rawSyncDate: '2026-06-19T00:00:00.000Z' },
    })
    expect(w.text()).toContain('건강보험심사평가원')
    expect(w.text()).toContain('2026.06.19 동기화')
  })

  it('rawSyncDate가 없어도 제공기관은 렌더한다', () => {
    const w = mount(DetailBasicInfo, { props: { facility: pharmacyFixture, ...baseProps } })
    expect(w.text()).toContain('건강보험심사평가원')
    expect(w.text()).not.toContain('동기화')
  })
})
