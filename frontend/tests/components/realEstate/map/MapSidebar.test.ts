import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import MapSidebar from '~/components/realEstate/map/MapSidebar.vue'
import type { MapItem, MapRegionItem } from '~/types/realEstateMap'
import { formatPyeongLabel } from '~/composables/useMapOverlays'
import { toRealEstateListUrl } from '~/utils/realEstateUrl'

const REGIONS: MapItem[] = [
  { name: '서울', district: null, dong: null, lat: 37.55, lng: 126.98, avgPricePerPyeong: 7732, transactionCount: 12043 },
  { name: '세종', district: null, dong: null, lat: 36.48, lng: 127.28, avgPricePerPyeong: null, transactionCount: 0 },
]

const BUILDINGS: MapItem[] = [
  {
    buildingName: '래미안블레스티지', city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 168340, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 812,
    jeonseDeposit: null, jeonseDealKey: null,
    wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  },
]

const RENT_BUILDINGS: MapItem[] = [
  {
    buildingName: '은마', city: '서울', district: '강남구', dongName: '대치동',
    lat: 37.5, lng: 127.06, latestPrice: 75000, monthlyRent: 340,
    latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 114,
    jeonseDeposit: 96000, jeonseDealKey: 20260712,
    wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
  },
  {
    buildingName: '신동아', city: '서울', district: '강남구', dongName: '수서동',
    lat: 37.49, lng: 127.1, latestPrice: 60000, monthlyRent: 0,
    latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 20, transactionCount: 11,
    jeonseDeposit: 60000, jeonseDealKey: 20260720,
    wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
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
    expect(w.text()).toContain('7,732만/평')
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

  it('showAd 를 명시하지 않으면 기본값 true 라 인피드 광고를 렌더한다 (다른 호출부 하위호환)', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...BUILDINGS[0], buildingName: `B${i}` }))
    const w = mountSidebar({ items: many, granularity: 'building', total: 8 })
    expect(w.find('[data-testid="map-sidebar-ad"]').exists()).toBe(true)
  })

  it('showAd=false 면 항목 수가 충분해도 인피드 광고를 렌더하지 않는다', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ ...BUILDINGS[0], buildingName: `B${i}` }))
    const w = mountSidebar({ items: many, granularity: 'building', total: 8, showAd: false })
    expect(w.find('[data-testid="map-sidebar-ad"]').exists()).toBe(false)
  })

  it('전남광주통합특별시는 DB city 원값(풀네임)으로 매칭되어 평당가를 표시한다 (회귀 가드)', () => {
    // API MapRegionItem.name 은 DB city 컬럼 원값이다. 전남광주통합특별시는 축약명이 없어
    // chip.label('전남·광주')도 chip.slug('jeonnamgwangju')도 아닌 풀네임 그대로 온다.
    const jngj: MapItem = {
      name: '전남광주통합특별시', district: null, dong: null, lat: 35.0, lng: 126.9, avgPricePerPyeong: 1850, transactionCount: 320,
    }
    const w = mountSidebar({ items: [jngj], total: 1 })
    const row = w.findAll('[data-testid="map-sidebar-item"]').find((li) => li.text().includes('전남·광주'))
    expect(row).toBeTruthy()
    expect(row!.text()).toContain(formatPyeongLabel(jngj as MapRegionItem))
    expect(row!.text()).not.toContain('—')
  })

  it('items 에 없는 시/도는 링크를 유지한 채 — 를 표시한다 (fail-open)', () => {
    const w = mountSidebar({ items: [REGIONS[0]], total: 1 }) // 서울만 옴, 세종 등 나머지는 집계 없음
    const links = w.findAll('a')
    expect(links.length).toBeGreaterThanOrEqual(16)

    const sejongRow = w.findAll('[data-testid="map-sidebar-item"]').find((li) => li.text().includes('세종'))
    expect(sejongRow).toBeTruthy()
    expect(sejongRow!.find('a').exists()).toBe(true)
    expect(sejongRow!.text()).toContain('—')
  })

  it('items 에 없는 시/도의 폴백 좌표는 null 이다 — 0,0(기니만 앞바다)이 아니다 (회귀 가드)', async () => {
    // (0,0)을 "좌표 없음"으로 쓰면 지도가 실제로 그 좌표(유효한 좌표라 방어되지 않음)로
    // 튀는 사고가 났다. select 로 emit 되는 아이템의 lat/lng 가 null 인지 직접 확인한다.
    const w = mountSidebar({ items: [REGIONS[0]], total: 1 }) // 서울만 옴, 부산은 집계 없음
    const busanRow = w.findAll('[data-testid="map-sidebar-item"]').find((li) => li.text().includes('부산'))!
    const a = busanRow.find('a')
    a.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await nextTick()
    const [emittedItem] = w.emitted('select')![0] as [MapRegionItem]
    expect(emittedItem.lat).toBeNull()
    expect(emittedItem.lng).toBeNull()
  })

  it('건물 모드는 select 를 emit 하지만 기본 동작(이동)을 막지 않는다 — NuxtLink 그대로다', async () => {
    // 건물 행은 이 태스크 범위 밖(변경 없음): 클릭해도 preventDefault 하지 않아야
    // 실제 브라우저에서 상세 페이지로 계속 이동한다.
    const w = mountSidebar({ items: BUILDINGS, granularity: 'building', total: 1 })
    const a = w.find('[data-testid="map-sidebar-item"]').find('a')
    const evt = new MouseEvent('click', { bubbles: true, cancelable: true })
    a.element.dispatchEvent(evt)
    await nextTick()
    expect(evt.defaultPrevented).toBe(false)
    expect(w.emitted('select')?.[0]).toEqual([BUILDINGS[0]])
  })

  describe('city/district 드릴다운 — 허브로 이탈하지 않고 지도를 확대한다', () => {
    it('city 행: href 는 유지한 채 평범한 클릭은 이동을 막고 select 를 emit 한다', async () => {
      const w = mountSidebar()
      const seoulRow = w.findAll('[data-testid="map-sidebar-item"]').find((li) => li.text().includes('서울'))!
      const a = seoulRow.find('a')
      expect(a.attributes('href')).toBe('/real-estate/apt-sale/seoul')

      const evt = new MouseEvent('click', { bubbles: true, cancelable: true })
      a.element.dispatchEvent(evt)
      await nextTick()
      expect(evt.defaultPrevented).toBe(true)
      expect(w.emitted('select')).toBeTruthy()
      expect((w.emitted('select')![0][0] as MapRegionItem).name).toBe('서울')
    })

    it('city 행: ⌘/Ctrl+클릭은 가로채지 않는다 — 새 탭으로 허브가 열려야 한다', async () => {
      const w = mountSidebar()
      const seoulRow = w.findAll('[data-testid="map-sidebar-item"]').find((li) => li.text().includes('서울'))!
      const a = seoulRow.find('a')
      await a.trigger('click', { metaKey: true })
      await a.trigger('click', { ctrlKey: true })
      expect(w.emitted('select')).toBeUndefined()
    })

    it('city 행: ⌘클릭의 기본 동작(새 탭 열기)이 실제로 막히지 않는다 (.exact.prevent 순서 가드)', () => {
      const w = mountSidebar()
      const seoulRow = w.findAll('[data-testid="map-sidebar-item"]').find((li) => li.text().includes('서울'))!
      const el = seoulRow.find('a').element
      const evt = new MouseEvent('click', { metaKey: true, cancelable: true, bubbles: true })
      el.dispatchEvent(evt)
      expect(evt.defaultPrevented).toBe(false)
      expect(w.emitted('select')).toBeUndefined()
    })

    it('district 행: href 는 유지한 채 평범한 클릭은 이동을 막고 select 를 emit 한다', async () => {
      const districtItems: MapItem[] = [
        { name: '경기', district: '성남시 분당구', dong: null, lat: 37.38, lng: 127.12, avgPricePerPyeong: 3200, transactionCount: 210 },
      ]
      const w = mountSidebar({ items: districtItems, granularity: 'district', total: 1 })
      const a = w.find('[data-testid="map-sidebar-item"]').find('a')
      const expectedHref = toRealEstateListUrl({ type: 'apt-sale', city: '경기', district: '성남시 분당구' })
      expect(a.attributes('href')).toBe(expectedHref)

      const evt = new MouseEvent('click', { bubbles: true, cancelable: true })
      a.element.dispatchEvent(evt)
      await nextTick()
      expect(evt.defaultPrevented).toBe(true)
      expect(w.emitted('select')?.[0]).toEqual([districtItems[0]])
    })

    it('district 행: ⌘/Ctrl+클릭은 가로채지 않는다', async () => {
      const districtItems: MapItem[] = [
        { name: '경기', district: '성남시 분당구', dong: null, lat: 37.38, lng: 127.12, avgPricePerPyeong: 3200, transactionCount: 210 },
      ]
      const w = mountSidebar({ items: districtItems, granularity: 'district', total: 1 })
      const a = w.find('[data-testid="map-sidebar-item"]').find('a')
      await a.trigger('click', { metaKey: true })
      await a.trigger('click', { ctrlKey: true })
      expect(w.emitted('select')).toBeUndefined()
    })
  })

  it('district 모드에서는 구/군을 제목으로, 시/도를 부제로 렌더하고 href 는 toRealEstateListUrl 결과와 일치한다', () => {
    const districtItems: MapItem[] = [
      { name: '전남광주통합특별시', district: '광산구', dong: null, lat: 35.15, lng: 126.79, avgPricePerPyeong: 1400, transactionCount: 55 },
      { name: '경기', district: '성남시 분당구', dong: null, lat: 37.38, lng: 127.12, avgPricePerPyeong: 3200, transactionCount: 210 },
    ]
    const w = mountSidebar({ items: districtItems, granularity: 'district', total: 2 })
    const rows = w.findAll('[data-testid="map-sidebar-item"]')
    expect(rows).toHaveLength(2)

    districtItems.forEach((raw, idx) => {
      const r = raw as MapRegionItem
      const row = rows[idx]
      expect(row.find('.font-medium').text()).toBe(r.district)
      expect(row.find('.text-slate-600').text()).toBe(r.name)
      expect(row.text()).toContain(formatPyeongLabel(r))
      const expectedHref = toRealEstateListUrl({ type: 'apt-sale', city: r.name, district: r.district ?? '' })
      expect(row.find('a').attributes('href')).toBe(expectedHref)
    })
  })
})

/** 건물 아이템 n 개를 만든다 — 이름만 다르고 나머지는 동일하다. */
function manyBuildings(n: number): MapItem[] {
  return Array.from({ length: n }, (_, i) => ({
    buildingName: `건물${i}`, city: '서울', district: '강남구', dongName: '개포동',
    lat: 37.48, lng: 127.06, latestPrice: 100000 + i, monthlyRent: null,
    latestDealYear: 2026, latestDealMonth: 8, latestDealDay: 1, transactionCount: 200 - i,
    jeonseDeposit: null, jeonseDealKey: null, wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
  }))
}

function mountBuildings(items: MapItem[], over = {}) {
  return mount(MapSidebar, {
    props: {
      items, granularity: 'building', total: items.length, exact: true, pending: false,
      type: 'apt-sale', ...over,
    },
  })
}

// 목록을 전부 그리면(최대 200개, 항목 약 62px = 12,400px) 그 아래 푸터에 도달할 수 없다.
// 데스크톱 사이드바에서도 12화면을 내려야 한다(설계문서 7.5).
describe('MapSidebar 더보기', () => {
  it('건물 200개 중 초기 20개만 렌더한다', () => {
    const w = mountBuildings(manyBuildings(200))
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
  })

  it('더보기를 누르면 20개씩 늘어난다', async () => {
    const w = mountBuildings(manyBuildings(200))
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(40)
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(60)
  })

  it('20개 이하면 더보기 버튼이 없다', () => {
    const w = mountBuildings(manyBuildings(12))
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(12)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(false)
  })

  it('끝까지 펼치면 더보기 버튼이 사라진다', async () => {
    const w = mountBuildings(manyBuildings(25))
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(true)
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(25)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(false)
  })

  it('지역 모드는 자르지 않는다 — SIDO_CHIPS 16개는 전부 SSR HTML 에 있어야 한다', () => {
    const w = mount(MapSidebar, {
      props: { items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false, type: 'apt-sale' },
    })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(16)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(false)
  })

  it('목록이 새로 오면 표시 개수가 20으로 돌아간다', async () => {
    // 안 그러면 강남에서 100개까지 늘려 둔 상태가 제주로 옮겨가도 남는다.
    const w = mountBuildings(manyBuildings(200))
    await w.find('[data-testid="map-sidebar-more"]').trigger('click')
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(40)

    await w.setProps({ items: manyBuildings(200), total: 200 })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
  })

  it('표시 개수가 전체보다 적으면 두 수를 함께 알린다', () => {
    // 목록 20개인데 지도엔 최대 200개 라벨이 뜨는 이유가 화면에 드러나야 한다.
    const w = mountBuildings(manyBuildings(200), { total: 1234, exact: false })
    expect(w.text()).toContain('이 영역에 1,234곳')
    expect(w.text()).toContain('상위 20곳 표시')
  })

  it('전부 보이면 개수 안내를 띄우지 않는다', () => {
    const w = mountBuildings(manyBuildings(12))
    expect(w.text()).not.toContain('상위')
  })

  it('구·군 모드도 20개씩 자른다 — 수도권은 25~50개라 건물 모드와 동일하게 페이지네이션한다', () => {
    // 지역(시/도) 모드로는 이 조건을 검증할 수 없다: SIDO_CHIPS 가 16개라 PAGE_SIZE(20)
    // 아래여서 슬라이스를 걸어도 결과가 같다. 구·군 모드는 items 가 그대로 행이 되므로
    // 20개를 넘겨야 granularity 조건이 살아 있는지 드러난다.
    const districts: MapItem[] = Array.from({ length: 25 }, (_, i) => ({
      name: '서울', district: `${i}구`, dong: null, lat: 37.5, lng: 127,
      avgPricePerPyeong: 1000 + i, transactionCount: 10,
    }))
    const w = mount(MapSidebar, {
      props: {
        items: districts, granularity: 'district', total: 25, exact: true,
        pending: false, type: 'apt-sale',
      },
    })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(true)
  })

  it('exact 여도 목록이 잘렸으면 개수 안내를 띄운다', () => {
    // showCountNote 가 예전의 !props.exact 였다면 exact=true 인 이 경우 안내가 사라진다.
    // 지도는 최대 200개 라벨을 그리는데 목록은 20개 — 그 불일치가 화면에 드러나야 한다.
    // (이 프로젝트는 과거 지도 개수와 목록 개수가 조용히 어긋나는 버그를 낸 적이 있다.)
    const w = mountBuildings(manyBuildings(200)) // 헬퍼 기본값: total=200, exact=true
    expect(w.text()).toContain('이 영역에 200곳')
    expect(w.text()).toContain('상위 20곳 표시')
  })
})

describe('MapSidebar 푸터', () => {
  const footerStub = {
    // props 를 배열이 아니라 객체로 선언한다. 배열 형식(무타입) stub 은 맨 속성(`<AppFooter compact />`)을
    // 빈 문자열로 받아 props('compact') 가 '' 이 된다 — Boolean 을 명시해야 true 로 캐스팅된다.
    AppFooter: { name: 'AppFooter', template: '<footer data-testid="sidebar-footer" />', props: { compact: Boolean } },
  }

  function mountWithFooter(showFooter: boolean) {
    return mount(MapSidebar, {
      props: {
        items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false,
        type: 'apt-sale', showFooter,
      },
      global: { stubs: footerStub },
    })
  }

  // MapSidebar 는 데스크톱 aside 와 모바일 바텀시트 두 사본이 항상 동시에 마운트된다
  // (안 보이는 쪽은 CSS hidden 일 뿐 DOM 에 남는다). 기본값이 true 면 두 사본이 모두
  // 푸터를 그려 링크 8개와 data-testid="footer-links" 가 2벌 생긴다.
  it('기본값은 렌더하지 않는다', () => {
    const w = mount(MapSidebar, {
      props: { items: REGIONS, granularity: 'city', total: 2, exact: true, pending: false, type: 'apt-sale' },
      global: { stubs: footerStub },
    })
    expect(w.find('[data-testid="sidebar-footer"]').exists()).toBe(false)
  })

  it('showFooter 면 목록 아래에 푸터를 렌더한다', () => {
    expect(mountWithFooter(true).find('[data-testid="sidebar-footer"]').exists()).toBe(true)
  })

  it('푸터에 compact 를 넘긴다 — 320px 폭에 4열 그리드는 들어가지 않는다', () => {
    expect(mountWithFooter(true).findComponent({ name: 'AppFooter' }).props('compact')).toBe(true)
  })

  it('푸터는 목록 뒤에 오고, ul 안에 들어가지 않는다', () => {
    const w = mountWithFooter(true)

    // 순서: 목록이 먼저, 푸터가 뒤
    const html = w.html()
    expect(html.indexOf('map-sidebar-item')).toBeLessThan(html.indexOf('sidebar-footer'))

    // 구조: ul 의 형제여야 한다. ul 안에 들어가면 위 순서 검사는 그대로 통과하지만,
    // ul 의 flex-1 이 짧은 목록에서 푸터를 바닥으로 밀어내는 동작이 깨진다.
    expect(w.find('ul').find('[data-testid="sidebar-footer"]').exists()).toBe(false)
    expect(w.find('[data-testid="sidebar-footer"]').exists()).toBe(true)
  })
})

describe('MapSidebar 동 모드', () => {
  const DONGS: MapItem[] = [
    { name: '서울', district: '강북구', dong: '미아동', lat: 37.63, lng: 127.02,
      avgPricePerPyeong: 3225, transactionCount: 42 },
    { name: '서울', district: '강북구', dong: '번동', lat: 37.64, lng: 127.03,
      avgPricePerPyeong: 3100, transactionCount: 31 },
  ]

  function mountDong(over = {}) {
    return mount(MapSidebar, {
      props: {
        items: DONGS, granularity: 'dong', total: 2, exact: true, pending: false,
        type: 'apt-sale', ...over,
      },
    })
  }

  it('동 이름을 title, 시/도 구·군을 subtitle 로 그린다', () => {
    const w = mountDong()
    const first = w.findAll('[data-testid="map-sidebar-item"]')[0]
    expect(first.text()).toContain('미아동')
    expect(first.text()).toContain('서울 강북구')
  })

  it('동 행은 링크가 아니라 버튼이다 — 6종에는 동 페이지가 없다', () => {
    // href 를 만들면 죽은 링크가 되고, 크롤러가 존재하지 않는 URL 을 따라간다.
    const w = mountDong()
    const first = w.findAll('[data-testid="map-sidebar-item"]')[0]
    expect(first.find('a').exists()).toBe(false)
    expect(first.find('button').exists()).toBe(true)
    expect(first.find('button').attributes('type')).toBe('button')
  })

  it('동 행 클릭이 select 를 emit 한다', async () => {
    const w = mountDong()
    await w.findAll('[data-testid="map-sidebar-item"]')[0].find('button').trigger('click')
    expect(w.emitted('select')?.[0]?.[0]).toMatchObject({ dong: '미아동' })
  })

  it('헤딩이 동별 평균 평당가다', () => {
    expect(mountDong().text()).toContain('동별 평균 평당가')
  })

  it('동 목록도 20개씩 자른다 — 수도권은 뷰포트 안에도 20개를 넘는다', () => {
    // visibleRows 조건이 `granularity !== 'city'` 라 동은 자연히 포함된다.
    // city 만 예외인 이유는 SIDO_CHIPS 16개 링크가 핵심 SSR 콘텐츠이기 때문.
    const many: MapItem[] = Array.from({ length: 25 }, (_, i) => ({
      name: '서울', district: '강남구', dong: `${i}동`, lat: 37.5, lng: 127.05,
      avgPricePerPyeong: 5000 + i, transactionCount: 10,
    }))
    const w = mountDong({ items: many, total: 25 })
    expect(w.findAll('[data-testid="map-sidebar-item"]')).toHaveLength(20)
    expect(w.find('[data-testid="map-sidebar-more"]').exists()).toBe(true)
  })

  it('구·군 행은 여전히 href 를 갖는다 (크롤 경로 회귀 가드)', () => {
    const w = mount(MapSidebar, {
      props: {
        items: [{ name: '서울', district: '강북구', dong: null, lat: 37.63, lng: 127.02,
          avgPricePerPyeong: 3225, transactionCount: 42 }],
        granularity: 'district', total: 1, exact: true, pending: false, type: 'apt-sale',
      },
    })
    expect(w.find('[data-testid="map-sidebar-item"] a').attributes('href')).toBeTruthy()
  })
})

describe('MapSidebar — 전월세 두 줄 병기', () => {
  function mountRent(over = {}) {
    return mount(MapSidebar, {
      props: {
        items: RENT_BUILDINGS, granularity: 'building', total: 2, exact: true,
        pending: false, type: 'apt-rent', ...over,
      },
    })
  }

  it('전세와 월세를 각각 보여준다', () => {
    const t = mountRent().text()
    expect(t).toContain('9억 6,000만')
    expect(t).toContain('7억 5,000만 · 340만')
  })

  it('전세/월세 라벨을 붙여 어느 쪽인지 알린다', () => {
    const t = mountRent().text()
    expect(t).toContain('전세')
    expect(t).toContain('월세')
  })

  it('해당 종류 거래가 없으면 "거래 없음" 이다 — 값이 없는 건지 안 보이는 건지 구분돼야 한다', () => {
    expect(mountRent().text()).toContain('거래 없음')
  })

  it('매매 탭은 한 줄 그대로다 — 전세/월세 라벨이 없다', () => {
    const w = mount(MapSidebar, {
      props: {
        items: BUILDINGS, granularity: 'building', total: 1, exact: true,
        pending: false, type: 'apt-sale',
      },
    })
    expect(w.text()).toContain('16억 8,340만')
    expect(w.text()).not.toContain('거래 없음')
  })

  // B-1: 배포 직후엔 prisma db push 만 돌아 jeonseDeposit/wolseDeposit 등 5개 새 컬럼이
  // 다음 nightly sync 전까지 전부 NULL이다. 폴백이 없으면 이 상태에서 전 건물이
  // "전세 거래 없음 / 월세 거래 없음"으로 보여 데이터 장애처럼 읽힌다.
  it('배포 직후처럼 새 분리 컬럼이 전부 null 이면 레거시 컬럼으로 폴백한다 (B-1)', () => {
    const notSyncedYet = {
      buildingName: '미갱신빌딩', city: '서울', district: '강남구', dongName: '개포동',
      lat: 37.48, lng: 127.06, latestPrice: 60000, monthlyRent: 0,
      latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 20, transactionCount: 5,
      jeonseDeposit: null, jeonseDealKey: null,
      wolseDeposit: null, wolseMonthlyRent: null, wolseDealKey: null,
    }
    const w = mountRent({ items: [notSyncedYet], total: 1 })
    expect(w.text()).toContain('6억')
    expect(w.text()).toContain('거래 없음')
  })

  // M-4: 폴백/미갱신으로 "거래 없음"이 뜨는 줄은 실제 가격처럼 강조되면 안 된다.
  it('전세 거래가 없으면 "거래 없음" 줄은 가격처럼 강조하지 않는다 (M-4)', () => {
    const noJeonse = {
      buildingName: '월세만', city: '서울', district: '강남구', dongName: '개포동',
      lat: 37.48, lng: 127.06, latestPrice: 75000, monthlyRent: 340,
      latestDealYear: 2026, latestDealMonth: 7, latestDealDay: 25, transactionCount: 3,
      jeonseDeposit: null, jeonseDealKey: null,
      wolseDeposit: 75000, wolseMonthlyRent: 340, wolseDealKey: 20260725,
    }
    const w = mountRent({ items: [noJeonse], total: 1 })
    const row = w.findAll('[data-testid="map-sidebar-item"]')[0]
    // 감싸는 래퍼 span 도 텍스트가 "전세"/"거래 없음" 을 포함하므로, block 클래스로 실제
    // 전세 줄 span(가격/거래없음 텍스트가 직접 붙는 요소)만 특정한다.
    const jeonseLine = row.findAll('span').find((s) => s.classes().includes('block') && s.text().includes('전세') && s.text().includes('거래 없음'))
    expect(jeonseLine?.classes()).toContain('text-slate-400')
    expect(jeonseLine?.classes()).not.toContain('text-primary')
    expect(jeonseLine?.classes()).not.toContain('font-semibold')
  })
})
