import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import SubscriptionNoticeRow from '~/components/subscription/SubscriptionNoticeRow.vue'
import type { Subscription } from '~/types/subscription'

function notice(overrides: Partial<Subscription> = {}): Subscription {
  return {
    id: 101,
    houseManageNo: 'HM-101',
    pblancNo: 'PB-101',
    sourceType: 'APT',
    houseName: '서울 첫 공고 이름이 아주 길어서 두 줄 말줄임과 줄바꿈 안정성을 확인하는 아파트 청약',
    houseType: 'APT',
    houseDetailType: '민영',
    rentType: null,
    regionName: '서울특별시 강남구',
    supplyLocation: '서울특별시 강남구 역삼동',
    totalSupplyCount: 0,
    announcementDate: '2026-09-01',
    receptionStartDate: '2026-09-24',
    receptionEndDate: '2026-09-25',
    specialStartDate: null,
    specialEndDate: null,
    rank1AreaStartDate: null,
    rank1AreaEndDate: null,
    rank1OtherStartDate: null,
    rank1OtherEndDate: null,
    rank2AreaStartDate: null,
    rank2AreaEndDate: null,
    rank2OtherStartDate: null,
    rank2OtherEndDate: null,
    winnerDate: null,
    contractStartDate: null,
    contractEndDate: null,
    moveInMonth: null,
    constructorName: null,
    developerName: null,
    homepage: null,
    pblancUrl: null,
    inquiryTel: null,
    status: 'ongoing',
    publicRental: null,
    ...overrides,
  }
}

describe('SubscriptionNoticeRow', () => {
  it('renders title, source badge, selected region, whole-notice supply and period guidance', () => {
    const wrapper = mount(SubscriptionNoticeRow, {
      props: {
        item: notice(),
        selectedCity: '서울특별시',
        selectedDistrict: '강남구',
      },
    })

    expect(wrapper.text()).toContain('서울 첫 공고')
    expect(wrapper.text()).toContain('아파트')
    expect(wrapper.text()).toContain('서울특별시 강남구')
    expect(wrapper.text()).toContain('원문 확인')
    expect(wrapper.text()).toContain('공고 전체 기준')
    expect(wrapper.text()).toContain('2026.09.24 ~ 2026.09.25')
  })

  it('shows matching public-rental supply region first and counts other regions', () => {
    const wrapper = mount(SubscriptionNoticeRow, {
      props: {
        item: notice({
          sourceType: 'PUBLIC_RENT',
          rentType: '임대주택',
          totalSupplyCount: null,
          regionName: '전국',
          publicRental: {
            provider: 'LH',
            sources: ['LH'],
            sourceIds: { myhome: [], lh: ['lh-1'] },
            sourceStatus: null,
            lastSyncedAt: '2026-09-20',
            isCorrection: false,
            supplies: [
              { key: 'seoul', name: '서울 공급', region: '서울특별시 강남구', address: null, supplyCount: 10, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
              { key: 'gyeonggi', name: '경기 공급', region: '경기도 수원시', address: null, supplyCount: 20, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
            ],
          },
        }),
        selectedCity: '서울특별시',
        selectedDistrict: '강남구',
      },
    })

    expect(wrapper.text()).toContain('서울특별시 강남구 외 1개 지역')
    expect(wrapper.text()).toContain('원문 확인')
  })

  it('matches short selected city names to full public rental supply regions', () => {
    const wrapper = mount(SubscriptionNoticeRow, {
      props: {
        item: notice({
          sourceType: 'PUBLIC_RENT',
          rentType: '임대주택',
          regionName: '전국',
          publicRental: {
            provider: 'LH',
            sources: ['LH'],
            sourceIds: { myhome: [], lh: ['lh-1'] },
            sourceStatus: null,
            lastSyncedAt: '2026-09-20',
            isCorrection: false,
            supplies: [
              { key: 'seoul', name: '서울 공급', region: '서울특별시 강남구', address: null, supplyCount: 10, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
              { key: 'gyeonggi', name: '경기 공급', region: '경기도 수원시', address: null, supplyCount: 20, deposit: null, monthlyRent: null, receptionStartDate: null, receptionEndDate: null },
            ],
          },
        }),
        selectedCity: '경기',
        selectedDistrict: '수원시',
      },
    })

    expect(wrapper.text()).toContain('경기도 수원시 외 1개 지역')
  })

  it('formats positive supply counts as 세대', () => {
    const wrapper = mount(SubscriptionNoticeRow, {
      props: { item: notice({ totalSupplyCount: 1234 }) },
    })

    expect(wrapper.text()).toContain('1,234세대')
    expect(wrapper.text()).not.toContain('1,234호')
  })

  it('hides the sale/rent category label by default to preserve list rows', () => {
    const wrapper = mount(SubscriptionNoticeRow, {
      props: { item: notice() },
    })

    expect(wrapper.find('.category-badge').exists()).toBe(false)
  })

  it('shows explicit sale/rent category labels when enabled for upcoming hub rows', () => {
    const sale = mount(SubscriptionNoticeRow, {
      props: { item: notice({ status: 'upcoming', sourceType: 'REMAINING' }), showCategory: true },
    })
    const rent = mount(SubscriptionNoticeRow, {
      props: {
        item: notice({
          status: 'upcoming',
          sourceType: 'PUBLIC_RENT',
          rentType: '국민임대',
        }),
        showCategory: true,
      },
    })

    expect(sale.find('.category-badge').text()).toBe('분양')
    expect(sale.text()).toContain('무순위·잔여')
    expect(rent.find('.category-badge').text()).toBe('임대')
    expect(rent.text()).toContain('공공임대')
  })

  it('emits open-detail before normal NuxtLink navigation', async () => {
    const wrapper = mount(SubscriptionNoticeRow, {
      props: { item: notice({ id: 333 }) },
    })

    await wrapper.get('a[href="/subscription/333"]').trigger('click')

    expect(wrapper.emitted('open-detail')).toHaveLength(1)
  })

  it('layout="panel" 이면 패널용 클래스를 붙이고 기본은 붙이지 않는다', () => {
    const base = mount(SubscriptionNoticeRow, { props: { item: notice() } })
    const panel = mount(SubscriptionNoticeRow, { props: { item: notice(), layout: 'panel' } })
    expect(base.get('.notice-row').classes()).not.toContain('notice-row--panel')
    expect(panel.get('.notice-row').classes()).toContain('notice-row--panel')
  })
})
