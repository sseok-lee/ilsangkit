import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DistrictSummaryCard from '~/components/region/DistrictSummaryCard.vue'

const baseSummary = {
  count: 48,
  countDiff: 3,
  highlights: [
    { key: 'disabled', label: '장애인 화장실', count: 29, percent: 60 },
    { key: 'diaper', label: '수유실', count: 13, percent: 27 },
    { key: 'open24h', label: '24시간 개방', count: 16, percent: 33 },
  ],
  nearbyDistricts: [],
  lastSyncedAt: '2026-04-15T00:00:00Z',
}

describe('DistrictSummaryCard', () => {
  it('총 시설 수를 표시한다', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: { summary: baseSummary, districtName: '강남구', categoryLabel: '공공화장실' },
    })
    expect(wrapper.text()).toContain('48')
  })

  it('지역 + 카테고리 라벨을 표시한다', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: { summary: baseSummary, districtName: '강남구', categoryLabel: '공공화장실' },
    })
    expect(wrapper.text()).toContain('강남구')
    expect(wrapper.text()).toContain('공공화장실')
  })

  it('countDiff가 양수일 때 +가 붙은 증가분 표시', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: { summary: baseSummary, districtName: '강남구', categoryLabel: '공공화장실' },
    })
    expect(wrapper.text()).toContain('+3')
  })

  it('countDiff가 0일 때 증가분 배지를 숨긴다', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: {
        summary: { ...baseSummary, countDiff: 0 },
        districtName: '강남구',
        categoryLabel: '공공화장실',
      },
    })
    expect(wrapper.text()).not.toContain('+0')
  })

  it('highlights를 label·count·percent로 렌더링', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: { summary: baseSummary, districtName: '강남구', categoryLabel: '공공화장실' },
    })
    const text = wrapper.text()
    expect(text).toContain('장애인 화장실')
    expect(text).toContain('29')
    expect(text).toContain('60%')
    expect(text).toContain('24시간 개방')
  })

  it('highlights가 비어있으면 해당 섹션을 표시하지 않는다', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: {
        summary: { ...baseSummary, highlights: [] },
        districtName: '강남구',
        categoryLabel: '공공화장실',
      },
    })
    expect(wrapper.text()).not.toContain('장애인 화장실')
  })

  it('lastSyncedAt이 없으면 업데이트 배지 미표시', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: {
        summary: { ...baseSummary, lastSyncedAt: null },
        districtName: '강남구',
        categoryLabel: '공공화장실',
      },
    })
    expect(wrapper.text()).not.toContain('업데이트')
  })

  it('lastSyncedAt이 있으면 업데이트 배지 표시', () => {
    const wrapper = mount(DistrictSummaryCard, {
      props: { summary: baseSummary, districtName: '강남구', categoryLabel: '공공화장실' },
    })
    expect(wrapper.text()).toContain('업데이트')
  })
})
