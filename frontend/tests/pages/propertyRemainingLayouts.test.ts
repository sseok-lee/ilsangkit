import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import { loadLandRegions } from '~/utils/landRegionNavigation'

const item = { cltrMngNo: 'remaining-001', address: '서울 강남구 역삼동', usage: '대지', usageGroup: 'land', district: '강남구', status: 'scheduled', failCnt: 0, bidRound: 1, apslAssAmt: 300000000, minBidPrc: 300000000, bidCloseDtm: null }
describe('remaining property navigation', () => {
  it('row preserves a full-area detail link and both price labels even when equal', () => {
    const wrapper = mount(AuctionCard, { props: { item: item as any, variant: 'row' }, global: { stubs: { HardLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
    expect(wrapper.get('a').attributes('href')).toBe('/auction/item/remaining-001')
    expect(wrapper.text()).toContain('최저입찰가')
    expect(wrapper.text()).toContain('감정가')
    expect(wrapper.text()).toContain('일정 미제공')
    expect(wrapper.text()).not.toContain('예상 수익률')
  })
  it('region candidates include every server page before local name search', async () => {
    const getPage = vi.fn(async (page: number) => ({ items: [{ dongName: page === 1 ? '역삼동' : '삼성동' }], total: 2, page, totalPages: 2 }))
    const result = await loadLandRegions(getPage as any)
    expect(getPage.mock.calls).toEqual([[1], [2]])
    expect(result.items.map(row => row.dongName)).toEqual(['역삼동', '삼성동'])
  })
  it('a later region page failure does not produce a partial complete list', async () => {
    const getPage = vi.fn().mockResolvedValueOnce({ items: [], total: 2, page: 1, totalPages: 2 }).mockRejectedValueOnce(new Error('503'))
    await expect(loadLandRegions(getPage)).rejects.toThrow('503')
  })
})

it('parent region selection uses real clean links without carrying child or page queries', async () => {
  const { default: Navigation } = await import('~/components/realEstate/LandRegionNavigation.vue')
  const wrapper = mount(Navigation, { props: { citySlug: 'seoul', districtSlug: 'gangnam' }, global: { stubs: { HardLink: { props: ['to'], template: '<a :href="to"><slot /></a>' } } } })
  expect(wrapper.get('a[href="/real-estate/land/busan"]').attributes('href')).toBe('/real-estate/land/busan')
  expect(wrapper.get('a[href="/real-estate/land/seoul/seocho"]').attributes('href')).toBe('/real-estate/land/seoul/seocho')
  expect(wrapper.get('a[href="/real-estate/land/seoul/gangnam"]').attributes('aria-current')).toBe('page')
})
