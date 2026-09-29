import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import ExplorationBuildingRow from '~/components/realEstate/ExplorationBuildingRow.vue'
import type { ComplexInfo } from '~/types/realEstate'

const building: ComplexInfo = {
  type: 'apt-rent',
  buildingKey: 'a'.repeat(64),
  buildingName: '도곡렉슬',
  bjdCode: '1168011800',
  dongName: '도곡동',
  jibun: '527',
  city: '서울특별시',
  district: '강남구',
  latestPrice: 70000,
  transactionCount: 35,
  lat: 37.49,
  lng: 127.05,
  lastDealYear: 2026,
  lastDealMonth: 8,
  buildYear: 2006,
  latestDeals: {
    sale: {
      kind: 'sale',
      amount: 357000,
      deposit: null,
      monthlyRent: null,
      exclusiveArea: 84.92,
      floor: 16,
      dealYear: 2026,
      dealMonth: 9,
      dealDay: null,
    },
    jeonse: {
      kind: 'jeonse',
      amount: null,
      deposit: 97000,
      monthlyRent: null,
      exclusiveArea: 84.92,
      floor: 11,
      dealYear: 2026,
      dealMonth: 9,
      dealDay: null,
    },
    wolse: {
      kind: 'wolse',
      amount: null,
      deposit: 20000,
      monthlyRent: 230,
      exclusiveArea: 84.92,
      floor: 5,
      dealYear: 2026,
      dealMonth: 8,
      dealDay: 30,
    },
  },
}

describe('ExplorationBuildingRow', () => {
  it('renders a sale row with desktop column hooks for name, amount, area-floor, and date', () => {
    const wrapper = mount(ExplorationBuildingRow, { props: { building, mode: 'sale' } })

    expect(wrapper.text()).toContain('도곡렉슬')
    expect(wrapper.text()).toContain('35억 7,000만원')
    expect(wrapper.text()).toContain('84.92㎡')
    expect(wrapper.text()).toContain('16층')
    expect(wrapper.text()).toContain('2026.09 계약')
    expect(wrapper.find('[data-testid="building-cell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="amount-cell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="area-floor-cell"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="date-cell"]').exists()).toBe(true)
  })

  it('renders jeonse and wolse independently in rent mode', () => {
    const wrapper = mount(ExplorationBuildingRow, { props: { building, mode: 'rent' } })
    const text = wrapper.text()

    expect(text).toContain('전세')
    expect(text).toContain('9억 7,000만원')
    expect(text).toContain('월세')
    expect(text).toContain('보증금 2억 / 월세 230만원')
  })

  it('distinguishes a missing latestDeals bundle from empty deal slots', () => {
    const loadFailure = mount(ExplorationBuildingRow, {
      props: { building: { ...building, latestDeals: undefined }, mode: 'representative' },
    })
    const noDeals = mount(ExplorationBuildingRow, {
      props: {
        building: { ...building, latestDeals: { sale: null, jeonse: null, wolse: null } },
        mode: 'representative',
      },
    })

    expect(loadFailure.text()).toContain('거래 정보를 불러오지 못했습니다')
    expect(loadFailure.find('[role="status"]').exists()).toBe(true)
    expect(noDeals.text()).toContain('거래 없음')
    expect(noDeals.text()).not.toContain('불러오지 못했습니다')
  })

  it('links to the representative deal type and passes rental detail mode query', () => {
    const wrapper = mount(ExplorationBuildingRow, {
      props: {
        building: {
          ...building,
          latestDeals: {
            sale: { ...building.latestDeals!.sale!, dealMonth: 8 },
            jeonse: { ...building.latestDeals!.jeonse!, dealMonth: 9, dealDay: 1 },
            wolse: building.latestDeals!.wolse,
          },
        },
        mode: 'representative',
      },
    })

    expect(wrapper.find('a').attributes('href')).toBe(
      `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('도곡렉슬')}/${building.buildingKey}?mode=jeonse`,
    )
    expect(wrapper.text()).toContain('도곡동 527')
  })

  it('uses the original building type link when there are no deals', () => {
    const wrapper = mount(ExplorationBuildingRow, {
      props: {
        building: { ...building, latestDeals: { sale: null, jeonse: null, wolse: null } },
        mode: 'representative',
      },
    })

    expect(wrapper.find('a').attributes('href')).toBe(
      `/real-estate/apt-rent/seoul/gangnam/${encodeURIComponent('도곡렉슬')}/${building.buildingKey}`,
    )
  })

  it('keeps same-name addresses distinct by building key', () => {
    const first = mount(ExplorationBuildingRow, {
      props: { building, mode: 'sale' },
    })
    const second = mount(ExplorationBuildingRow, {
      props: {
        building: {
          ...building,
          buildingKey: 'b'.repeat(64),
          dongName: '역삼동',
          jibun: '785-10',
        },
        mode: 'sale',
      },
    })

    expect(first.find('a').attributes('href')).not.toBe(second.find('a').attributes('href'))
    expect(first.text()).toContain('도곡동 527')
    expect(second.text()).toContain('역삼동 785-10')
  })

  it('does not create nested links inside the row link', () => {
    const wrapper = mount(ExplorationBuildingRow, { props: { building, mode: 'rent' } })
    expect(wrapper.findAll('a')).toHaveLength(1)
  })

  it('switches before the 768px target can overflow from fixed desktop columns', () => {
    const source = readFileSync(
      `${process.cwd()}/components/realEstate/ExplorationBuildingRow.vue`,
      'utf8',
    )

    expect(source).toContain('@media (max-width: 768px)')
  })
})
