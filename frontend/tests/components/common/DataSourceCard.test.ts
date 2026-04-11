import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import { FACILITY_DATA_SOURCE, REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'

describe('DataSourceCard', () => {
  it('제공기관과 데이터셋명을 렌더링한다', () => {
    const wrapper = mount(DataSourceCard, {
      props: { source: FACILITY_DATA_SOURCE.hospital },
    })
    expect(wrapper.text()).toContain('건강보험심사평가원')
    expect(wrapper.text()).toContain('건강보험심사평가원 병원 정보')
  })

  it('데이터셋 링크를 새 탭에서 열리도록 렌더링한다', () => {
    const wrapper = mount(DataSourceCard, {
      props: { source: FACILITY_DATA_SOURCE.toilet },
    })
    const link = wrapper.get('a')
    expect(link.attributes('href')).toBe(FACILITY_DATA_SOURCE.toilet.url)
    expect(link.attributes('target')).toBe('_blank')
    expect(link.attributes('rel')).toBe('noopener noreferrer')
  })

  it('kogl 유형이 있으면 "공공누리 제N유형" 문구를 포함한다', () => {
    const wrapper = mount(DataSourceCard, {
      props: {
        source: { ...FACILITY_DATA_SOURCE.toilet, kogl: 1 },
      },
    })
    expect(wrapper.text()).toContain('공공누리 제1유형')
  })

  it('kogl 유형이 없으면 "공공누리 제N유형" 문구를 표시하지 않는다', () => {
    const wrapper = mount(DataSourceCard, {
      props: { source: FACILITY_DATA_SOURCE.toilet },
    })
    expect(wrapper.text()).not.toContain('공공누리 제')
  })

  it('dataDate와 lastSyncDate가 전달되면 표시한다', () => {
    const wrapper = mount(DataSourceCard, {
      props: {
        source: FACILITY_DATA_SOURCE.toilet,
        dataDate: '2026-03-15',
        lastSyncDate: '2026-04-10',
      },
    })
    expect(wrapper.text()).toContain('데이터 기준일')
    expect(wrapper.text()).toContain('2026-03-15')
    expect(wrapper.text()).toContain('최근 동기화')
    expect(wrapper.text()).toContain('2026-04-10')
  })

  it('date 필드가 없으면 해당 행을 렌더링하지 않는다', () => {
    const wrapper = mount(DataSourceCard, {
      props: { source: FACILITY_DATA_SOURCE.toilet },
    })
    expect(wrapper.text()).not.toContain('데이터 기준일')
    expect(wrapper.text()).not.toContain('최근 동기화')
  })

  it('부동산 출처(REAL_ESTATE_DATA_SOURCE)도 정상 렌더링한다', () => {
    const wrapper = mount(DataSourceCard, {
      props: { source: REAL_ESTATE_DATA_SOURCE },
    })
    expect(wrapper.text()).toContain('국토교통부')
    expect(wrapper.text()).toContain('국토교통부 실거래가 공개시스템')
    expect(wrapper.get('a').attributes('href')).toBe('https://rt.molit.go.kr')
  })
})
