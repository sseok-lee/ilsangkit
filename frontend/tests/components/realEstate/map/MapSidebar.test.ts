import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import MapSidebar from '~/components/realEstate/map/MapSidebar.vue'
import type { MapItem } from '~/types/realEstateMap'

const REGIONS: MapItem[] = [
  { name: '서울', district: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 12043 },
  { name: '세종', district: null, lat: 36.48, lng: 127.28, avgPricePerPyeong: null, transactionCount: 0 },
]

const BUILDINGS: MapItem[] = [
  {
    buildingName: '래미안블레스티지', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
  },
]

function mountSidebar(over = {}) {
  return mount(MapSidebar, {
    props: { items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false, type: 'apt-sale', ...over },
  })
}

describe('MapSidebar', () => {
  it('지역 모드에서 시/도 이름과 평당가를 렌더한다', () => {
    const w = mountSidebar()
    expect(w.text()).toContain('서울')
    expect(w.text()).toContain('7,732/평')
  })

  it('데이터 없는 시/도도 링크는 렌더한다 (fail-open)', () => {
    const w = mountSidebar()
    expect(w.text()).toContain('세종')
    expect(w.text()).toContain('—')
  })

  it('집계가 전부 실패해도 시/도 16개 링크를 상수에서 렌더한다', () => {
    // 이게 이 페이지의 유일한 SSR 콘텐츠다. 비면 부동산 허브가 빈 페이지가 된다.
    const w = mountSidebar({ items: [], total: 0 })
    const links = w.findAll('a')
    expect(links.length).toBeGreaterThanOrEqual(16)
    expect(w.text()).toContain('전남·광주')
  })

  it('건물 모드에서 건물명과 가격 라벨을 렌더한다', () => {
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1 })
    expect(w.text()).toContain('래미안블레스티지')
    expect(w.text()).toContain('16억 8,340')
  })

  it('절단되면 total 과 함께 알린다', () => {
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1820, exact: false })
    expect(w.text()).toContain('1,820')
  })

  it('항목 hover 시 키를 emit 한다', async () => {
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1 })
    await w.find('[data-testid="map-sidebar-item"]').trigger('mouseenter')
    expect(w.emitted('hover')?.[0]).toEqual(['래미안블레스티지|강남구'])
  })

  it('인피드 광고 자리를 5번째 항목 뒤에 둔다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...BUILDINGS[0], buildingName: `B${i}` }))
    const w = mountSidebar({ items: many, granularity: 'building', total: 8 })
    expect(w.find('[data-testid="map-sidebar-ad"]').exists()).toBe(true)
  })
})
