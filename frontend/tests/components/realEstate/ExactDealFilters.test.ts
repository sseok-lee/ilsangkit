import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import ExactDealFilters from '~/components/realEstate/ExactDealFilters.vue'
import type { AppliedFilters, DetailOptions } from '~/types/housingRedesign'

const baseFilters: AppliedFilters = {
  bjdCode: '11680',
  buildingName: '일상숲 리버파크',
  mode: 'wolse',
  months: 6,
  area: '85',
  deposit: 0,
}

const options: DetailOptions = {
  areas: [
    { key: '60', label: '59', count: 73 },
    { key: '85', label: '84', count: 326 },
  ],
  deposits: [
    { amount: 0, count: 2 },
    { amount: 10000, count: 4 },
  ],
}

describe('ExactDealFilters', () => {
  it('native controls로 거래유형, 면적, 기간, 보증금을 표시한다', () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: baseFilters, options, pending: false },
    })

    expect((wrapper.find('select[name="mode"]').element as HTMLSelectElement).value).toBe('wolse')
    expect((wrapper.find('select[name="area"]').element as HTMLSelectElement).value).toBe('85')
    expect((wrapper.find('select[name="months"]').element as HTMLSelectElement).value).toBe('6')
    expect((wrapper.find('select[name="deposit"]').element as HTMLSelectElement).value).toBe('0')
    expect(wrapper.find('select[name="area"]').text()).toContain('전용 84㎡')
    expect(wrapper.find('select[name="area"]').text()).not.toContain('선택 가능한 면적 없음')
    expect(wrapper.find('select[name="months"]').text()).toContain('6개월')
    expect(wrapper.find('select[name="months"]').text()).toContain('1년')
    expect(wrapper.find('select[name="months"]').text()).toContain('3년')
    expect(wrapper.find('select[name="deposit"]').text()).toContain('0만원')
    expect(wrapper.find('select[name="deposit"]').text()).not.toContain('선택 가능한 보증금 없음')
    expect(wrapper.find('#exact-filter-status').text()).toBe('적용 조건 · 월세 · 전용 84㎡ · 6개월 · 보증금 0만원')
  })

  it('전체 기간을 표시하고 단기 기간과 전체 사이를 전환한다', async () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: { ...baseFilters, months: 0 }, options, pending: false },
    })

    const period = wrapper.find('select[name="months"]')
    expect((period.element as HTMLSelectElement).value).toBe('0')
    expect(wrapper.find('#exact-filter-status').text()).toContain('전체 기간')
    await period.setValue('6')
    await period.setValue('0')
    expect(wrapper.emitted('patch')).toEqual([[{ months: 6 }], [{ months: 0 }]])
  })

  it('적용된 area/deposit이 options에 없어도 현재 적용 조건을 native value로 보존한다', () => {
    const wrapper = mount(ExactDealFilters, {
      props: {
        filters: { ...baseFilters, area: '101', deposit: 3000 },
        options: { areas: [{ key: '85', label: '84', count: 3 }], deposits: [{ amount: 0, count: 2 }] },
        pending: true,
      },
    })

    expect((wrapper.find('select[name="area"]').element as HTMLSelectElement).value).toBe('101')
    expect((wrapper.find('select[name="deposit"]').element as HTMLSelectElement).value).toBe('3000')
    expect(wrapper.text()).toContain('전용 101㎡')
    expect(wrapper.text()).toContain('보증금 3,000만원')
  })

  it('월세가 아니면 보증금 목록을 숨기고 보증금을 초기화한다', async () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: baseFilters, options, pending: false },
    })

    await wrapper.find('select[name="mode"]').setValue('jeonse')

    expect(wrapper.emitted('patch')?.[0][0]).toEqual({ mode: 'jeonse', deposit: undefined })
    expect(wrapper.find('select[name="deposit"]').exists()).toBe(false)
  })

  it('보증금 0을 값으로 유지해 emit한다', async () => {
    const wrapper = mount(ExactDealFilters, {
      props: {
        filters: { ...baseFilters, deposit: 10000 },
        options,
        pending: false,
      },
    })

    await wrapper.find('select[name="deposit"]').setValue('0')

    expect(wrapper.emitted('patch')?.[0][0]).toEqual({ deposit: 0 })
  })

  it('pending일 때 현재 적용 조건과 진행 상태를 알린다', () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: baseFilters, options, pending: true },
    })

    expect(wrapper.attributes('aria-busy')).toBe('true')
    expect(wrapper.text()).toContain('적용 중')
    expect(wrapper.text()).toContain('월세')
    expect(wrapper.text()).toContain('전용 84㎡')
    expect(wrapper.text()).toContain('보증금 0만원')
  })

  it('그룹 라벨을 `전용 {label}㎡` 로 표시하고 key 를 value 로 쓴다', () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: baseFilters, options, pending: false },
    })
    const optionEls = wrapper.findAll('select[name="area"] option')

    expect(optionEls.map(o => o.text())).toEqual(['전용 59㎡', '전용 84㎡'])
    expect(optionEls.map(o => (o.element as HTMLOptionElement).value)).toEqual(['60', '85'])
  })

  it('면적 선택 시 그룹 key 로 patch 한다', async () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: { ...baseFilters, area: '60' }, options, pending: false },
    })

    await wrapper.find('select[name="area"]').setValue('85')

    expect(wrapper.emitted('patch')?.[0][0]).toEqual({ area: '85' })
  })

  it('areaLabels 에 key 가 있으면 헤더 칩과 같은 라벨을 쓰고 없으면 옵션 라벨을 쓴다', () => {
    const wrapper = mount(ExactDealFilters, {
      props: { filters: baseFilters, options, pending: false, areaLabels: { '85': '84.9' } },
    })
    const texts = wrapper.findAll('select[name="area"] option').map(o => o.text())

    expect(texts).toEqual(['전용 59㎡', '전용 84.9㎡'])
    expect(wrapper.find('#exact-filter-status').text()).toContain('전용 84.9㎡')
  })
})
