import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapDealFilters from '~/components/realEstate/map/MapDealFilters.vue'
import type { MapFilterState } from '~/utils/mapFilters'

const NONE: MapFilterState = { area: null, price: null, priceKind: null }

function mountFilters(props: { type?: string; filter?: MapFilterState; applied?: boolean } = {}) {
  return mount(MapDealFilters, {
    props: { type: 'apt-sale', filter: NONE, applied: true, ...props },
    attachTo: document.body,
  })
}

describe('MapDealFilters', () => {
  it('[면적][가격] 칩, 고른 게 없으면 초기화·안내가 없다', () => {
    const w = mountFilters()
    expect(w.find('[data-testid="map-filter-area"]').text()).toContain('면적')
    expect(w.find('[data-testid="map-filter-price"]').text()).toContain('가격')
    expect(w.find('[data-testid="map-filter-reset"]').exists()).toBe(false)
    expect(w.find('[data-testid="map-filter-deferred"]').exists()).toBe(false)
  })

  it('고른 칩은 값을 보이고 채움으로 구분한다', () => {
    const w = mountFilters({ filter: { area: '60-85', price: '90000-150000', priceKind: null } })
    const area = w.find('[data-testid="map-filter-area"]')
    expect(area.text()).toContain('60~85㎡')
    expect(area.classes()).toEqual(expect.arrayContaining(['bg-primary-50', 'border-primary', 'text-primary']))
    expect(w.find('[data-testid="map-filter-price"]').text()).toContain('9~15억')
    expect(w.find('[data-testid="map-filter-reset"]').exists()).toBe(true)
  })

  it('면적 메뉴에서 고르면 update:filter 를 내고 메뉴를 닫는다', async () => {
    const w = mountFilters()
    await w.find('[data-testid="map-filter-area"]').trigger('click')
    const menu = w.find('[data-testid="map-filter-menu-area"]')
    expect(menu.findAll('button').map((b) => b.text())).toEqual(['전체', '60㎡ 이하', '60~85㎡', '85~135㎡', '135㎡ 초과'])
    await menu.findAll('button')[2].trigger('click')
    expect(w.emitted('update:filter')?.[0]).toEqual([{ area: '60-85', price: null, priceKind: null }])
    expect(w.find('[data-testid="map-filter-menu-area"]').exists()).toBe(false)
  })

  it('전월세 가격 메뉴는 전세 보증금·월세액 두 묶음이고, 고른 쪽 종류가 실린다', async () => {
    const w = mountFilters({ type: 'villa-rent', filter: { area: '0-60', price: null, priceKind: null } })
    await w.find('[data-testid="map-filter-price"]').trigger('click')
    const menu = w.find('[data-testid="map-filter-menu-price"]')
    expect(menu.text()).toContain('전세 보증금')
    expect(menu.text()).toContain('월세액')
    const wolse = menu.findAll('button').find((b) => b.text() === '50~100만')!
    await wolse.trigger('click')
    expect(w.emitted('update:filter')?.[0]).toEqual([{ area: '0-60', price: '50-100', priceKind: 'wolse' }])
  })

  it('초기화는 전부 비운다', async () => {
    const w = mountFilters({ filter: { area: '135-', price: '0-30000', priceKind: null } })
    await w.find('[data-testid="map-filter-reset"]').trigger('click')
    expect(w.emitted('update:filter')?.[0]).toEqual([NONE])
  })

  it('집계 단계(applied=false)면 칩은 그대로 두고 "단지 단계에서 적용" 안내', () => {
    const w = mountFilters({ filter: { area: '60-85', price: null, priceKind: null }, applied: false })
    expect(w.find('[data-testid="map-filter-area"]').text()).toContain('60~85㎡')
    expect(w.find('[data-testid="map-filter-deferred"]').text()).toBe('단지 단계에서 적용')
  })

  it('터치 영역 44px', async () => {
    const w = mountFilters({ filter: { area: '60-85', price: null, priceKind: null } })
    for (const sel of ['map-filter-area', 'map-filter-price', 'map-filter-reset']) {
      expect(w.find(`[data-testid="${sel}"]`).classes()).toContain('min-h-[44px]')
    }
    await w.find('[data-testid="map-filter-area"]').trigger('click')
    for (const b of w.find('[data-testid="map-filter-menu-area"]').findAll('button')) {
      expect(b.classes()).toContain('min-h-[44px]')
    }
  })

  it('바깥을 누르면 메뉴를 닫는다', async () => {
    const w = mountFilters()
    await w.find('[data-testid="map-filter-price"]').trigger('click')
    document.body.click()
    await w.vm.$nextTick()
    expect(w.find('[data-testid="map-filter-menu-price"]').exists()).toBe(false)
    w.unmount()
  })
})
