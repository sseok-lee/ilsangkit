import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import DealSnapshotComponent from '~/components/realEstate/DealSnapshot.vue'
import type { DealSnapshot } from '~/types/realEstateExploration'

const sale: DealSnapshot = {
  kind: 'sale',
  amount: 125000,
  deposit: null,
  monthlyRent: null,
  exclusiveArea: 84.92,
  floor: 12,
  dealYear: 2026,
  dealMonth: 8,
  dealDay: null,
}

describe('DealSnapshot', () => {
  it('shows amount, area, floor, and null-day contract month from one sale snapshot', () => {
    const wrapper = mount(DealSnapshotComponent, { props: { deal: sale, kind: 'sale' } })

    expect(wrapper.text()).toContain('12억 5,000만원')
    expect(wrapper.text()).toContain('84.92')
    expect(wrapper.text()).toContain('12층')
    expect(wrapper.text()).toContain('2026.08 계약')
    expect(wrapper.text()).not.toContain('2026.08.01')
  })

  it('renders jeonse and wolse as separate rental conditions', () => {
    const jeonseWrapper = mount(DealSnapshotComponent, {
      props: {
        kind: 'jeonse',
        deal: { ...sale, kind: 'jeonse', amount: null, deposit: 70000, monthlyRent: null, dealDay: 10 },
      },
    })
    const wolseWrapper = mount(DealSnapshotComponent, {
      props: {
        kind: 'wolse',
        deal: { ...sale, kind: 'wolse', amount: null, deposit: 10000, monthlyRent: 120, dealDay: 11 },
      },
    })

    expect(jeonseWrapper.text()).toContain('전세')
    expect(jeonseWrapper.text()).toContain('7억')
    expect(jeonseWrapper.text()).toContain('2026.08.10 계약')
    expect(jeonseWrapper.text()).not.toContain('/120')
    expect(wolseWrapper.text()).toContain('월세')
    expect(wolseWrapper.text()).toContain('보증금 1억 / 월세 120만원')
  })

  it('preserves zero values and distinguishes null missing fields', () => {
    const wrapper = mount(DealSnapshotComponent, {
      props: {
        kind: 'wolse',
        deal: {
          kind: 'wolse',
          amount: null,
          deposit: 0,
          monthlyRent: 0,
          exclusiveArea: null,
          floor: 0,
          dealYear: 2026,
          dealMonth: 8,
          dealDay: 1,
        },
      },
    })

    expect(wrapper.text()).toContain('보증금 0만원 / 월세 0만원')
    expect(wrapper.text()).toContain('0층')
    expect(wrapper.text()).toContain('면적 정보 없음')
  })

  it('shows no-deal copy for a null slot', () => {
    const wrapper = mount(DealSnapshotComponent, { props: { deal: null, kind: 'jeonse' } })
    expect(wrapper.text()).toContain('거래 없음')
  })

  it('uses explicit missing copy for null area and floor', () => {
    const wrapper = mount(DealSnapshotComponent, {
      props: {
        kind: 'sale',
        deal: { ...sale, exclusiveArea: null, floor: null },
      },
    })

    expect(wrapper.text()).toContain('면적 정보 없음')
    expect(wrapper.text()).toContain('층 정보 없음')
  })

  it('compact mode groups deal text in one narrow column without changing content', () => {
    const wrapper = mount(DealSnapshotComponent, { props: { deal: sale, kind: 'sale', compact: true } })

    expect(wrapper.classes()).toContain('deal-snapshot--compact')
    expect(wrapper.text()).toContain('12억 5,000만원')
  })
})
