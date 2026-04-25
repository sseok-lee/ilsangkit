import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import PublicRentalCard from '~/components/subscription/PublicRentalCard.vue'
import type { PublicRentalComplex } from '~/types/publicRental'

const baseRental: PublicRentalComplex = {
  id: 1,
  complexCode: '12345',
  complexName: '강남 매입임대 1단지',
  city: '서울특별시',
  district: '강남구',
  rentalType: '매입임대',
  houseType: '아파트',
  householdCount: 80,
  exclusiveArea: 59.96,
  depositAmount: 80000000,
  monthlyRent: 200000,
  landlordAgency: 'LH',
  sourceId: 'lh-12345',
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-25T00:00:00Z',
}

describe('PublicRentalCard', () => {
  it('renders complex name + region', () => {
    const wrapper = mount(PublicRentalCard, { props: { rental: baseRental } })
    expect(wrapper.text()).toContain('강남 매입임대 1단지')
    expect(wrapper.text()).toContain('서울특별시 강남구')
  })

  it('formats deposit in 만원/억 units', () => {
    const wrapper = mount(PublicRentalCard, {
      props: { rental: { ...baseRental, depositAmount: 120_000_000 } },
    })
    // 120,000,000 won → 1억 2,000만원
    expect(wrapper.text()).toMatch(/1억\s+2,000만원/)
  })

  it('renders 전세 badge when monthlyRent is 0', () => {
    const wrapper = mount(PublicRentalCard, {
      props: { rental: { ...baseRental, monthlyRent: 0 } },
    })
    expect(wrapper.text()).toContain('전세')
  })

  it('does not render 월세 row when monthlyRent is 0', () => {
    const wrapper = mount(PublicRentalCard, {
      props: { rental: { ...baseRental, monthlyRent: 0 } },
    })
    expect(wrapper.text()).not.toContain('월세:')
  })

  it('applies type badge styling for 전세임대 vs 매입임대', () => {
    const charter = mount(PublicRentalCard, {
      props: { rental: { ...baseRental, rentalType: '전세임대', monthlyRent: 0 } },
    })
    expect(charter.html()).toContain('emerald')

    const buyLease = mount(PublicRentalCard, { props: { rental: baseRental } })
    expect(buyLease.html()).toContain('blue')
  })
})
