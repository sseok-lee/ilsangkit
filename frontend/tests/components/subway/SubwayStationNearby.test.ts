import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import SubwayStationNearby from '~/components/subway/SubwayStationNearby.vue'
import type { Facility, FacilityCategory } from '~/types/facility'
import type { SubwayNearbyGroup, SubwayNearbyStation } from '~/types/subway'

function station(nameSlug: string, name: string, lines: string[], distance: number): SubwayNearbyStation {
  return { id: `st-${nameSlug}`, name, nameSlug, category: 'subway', lines, distance }
}

function item(category: FacilityCategory, id: string, name: string, distance: number, extras: Record<string, unknown> = {}): Facility {
  return {
    id, name, category, distance, extras,
    address: '서울특별시 강남구 역삼동 1',
    roadAddress: '서울특별시 강남구 강남대로 396, 지하1층 (역삼동)',
    lat: 37.49, lng: 127.02, city: '서울특별시', district: '강남구',
  }
}

const GROUPS: SubwayNearbyGroup[] = [
  {
    category: 'subway', count: 2, exact: true,
    items: [
      station('sinnonhyeon', '신논현', ['서울 도시철도 9호선', '신분당선'], 726),
      station('yeoksam', '역삼역', ['2호선'], 802),
    ],
  },
  {
    category: 'parking', count: 12, exact: true,
    items: [
      item('parking', 'pk1', '강남역 공영주차장', 120),
      item('parking', 'pk2', '가주차장', 200),
      item('parking', 'pk3', '나주차장', 300),
      item('parking', 'pk4', '다주차장', 400),
      item('parking', 'pk5', '라주차장', 500),
    ],
  },
  { category: 'ev-charger', count: 222, exact: false, items: [item('ev-charger', 'ME01', '강남 충전소', 90, { rapidCount: 2, slowCount: 4 })] },
  { category: 'toilet', count: 0, exact: true, items: [] },
  { category: 'market', count: 0, exact: true, items: [] },
]

const globalConfig = {
  stubs: {
    SectionBlock: {
      template: '<section data-block :variant="variant"><h2 v-if="heading">{{ heading }}</h2><p v-if="subtext" data-testid="subtext">{{ subtext }}</p><slot /></section>',
      props: ['heading', 'subtext', 'variant'],
    },
  },
}

function mountNearby(props: Record<string, unknown> = {}) {
  return mount(SubwayStationNearby, {
    props: {
      groups: GROUPS,
      loading: false,
      stationName: '강남역',
      regionHref: '/seoul/gangnam',
      regionLabel: '강남구',
      ...props,
    },
    global: globalConfig,
  })
}

function sections(wrapper: ReturnType<typeof mountNearby>) {
  return wrapper.findAll('[data-testid="nearby-facility-section"]')
}

describe('SubwayStationNearby — 지하철역 상세 주변 시설(공용 목록 틀)', () => {
  it('제목 "주변 시설" 과 역명 부제를 쓰고 SectionBlock 하나(flat)', () => {
    const wrapper = mountNearby()
    expect(wrapper.find('h2').text()).toBe('주변 시설')
    expect(wrapper.find('[data-testid="subtext"]').text())
      .toBe('강남역에서 반경 1km 안의 시설입니다. 거리는 직선거리, 도보 시간은 추정입니다.')
    const blocks = wrapper.findAll('[data-block]')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].attributes('variant')).toBe('flat')
    expect(wrapper.find('[data-testid="subway-nearby"]').exists()).toBe(true)
  })

  it('섹션 순서 = 주변 역 → API 순서(관련 카테고리), 0곳 섹션은 숨긴다', () => {
    const wrapper = mountNearby()
    expect(sections(wrapper).map((s) => s.find('h3').text())).toEqual(['주변 지하철역', '주변 공영주차장', '주변 전기차 충전소'])
    expect(sections(wrapper)).toHaveLength(3)
  })

  it('md 이상 2열 그리드', () => {
    const wrapper = mountNearby()
    expect(wrapper.find('.grid').classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2']))
  })

  it('개수 문구는 "1km 안 N곳", 하한값이면 "이상"', () => {
    const wrapper = mountNearby()
    expect(sections(wrapper).map((s) => s.find('[data-testid="nearby-facility-count"]').text()))
      .toEqual(['1km 안 2곳', '1km 안 12곳', '1km 안 222곳 이상'])
  })

  it('주변 역 행: 노선 수만큼 색 배지 + 역명("역" 1개 보장) + 거리·도보, 역 상세로 링크, 보조 줄 없음', () => {
    const wrapper = mountNearby()
    const rows = sections(wrapper)[0].findAll('li')
    const first = rows[0]
    const badges = first.findAll('[data-testid="subway-line-badge"]')
    expect(badges.map((b) => b.text())).toEqual(['서울 도시철도 9호선', '신분당선'])
    expect(badges[0].attributes('style')).toContain('background-color')
    expect(first.text()).toContain('신논현역')
    expect(first.text()).toContain('726m')
    expect(first.text()).toContain('도보 약')
    expect(first.find('a').attributes('href')).toBe('/subway/sinnonhyeon')
    expect(first.find('[data-testid="nearby-place-sub"]').exists()).toBe(false)
    expect(rows[1].text()).toContain('역삼역')
    expect(rows[1].text()).not.toContain('역삼역역')
    expect(rows[1].findAll('[data-testid="subway-line-badge"]')).toHaveLength(1)
  })

  it('관련 시설 행: 시설 상세와 같은 보조 줄 규칙, 시설 상세로 링크', () => {
    const wrapper = mountNearby()
    const parking = sections(wrapper)[1].find('li')
    expect(parking.find('[data-testid="nearby-place-sub"]').text()).toBe('강남대로 396')
    expect(parking.find('a').attributes('href')).toBe('/parking/pk1')
    expect(parking.find('[data-testid="subway-line-badge"]').exists()).toBe(false)
    const ev = sections(wrapper)[2].find('li')
    expect(ev.find('[data-testid="nearby-place-sub"]').text()).toContain('급속 2')
    expect(ev.find('a').attributes('href')).toBe('/ev-charger/ME01')
  })

  it('섹션당 최대 5곳, 모바일은 3곳 + 모두 보기(4·5번째도 DOM 에 있음)', () => {
    const rows = sections(mountNearby())[1].findAll('li')
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.classes().includes('max-md:hidden'))).toEqual([false, false, false, true, true])
    expect(sections(mountNearby())[1].find('button').text()).toBe('5곳 모두 보기')
  })

  it('하단: 출처 문구 + "{구·군} 생활시설 전체 보기 →" 지역 허브 링크', () => {
    const wrapper = mountNearby()
    expect(wrapper.text()).toContain('공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 5곳')
    const link = wrapper.find('[data-testid="nearby-facilities-region-link"]')
    expect(link.attributes('href')).toBe('/seoul/gangnam')
    expect(link.text()).toBe('강남구 생활시설 전체 보기 →')
  })

  it('지역 링크를 만들 수 없으면 링크만 생략한다', () => {
    const wrapper = mountNearby({ regionHref: undefined, regionLabel: undefined })
    expect(wrapper.find('[data-testid="nearby-facilities-region-link"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('공공데이터포털 시설 데이터')
  })

  it('모든 그룹이 0곳이면 블록 자체를 숨긴다', () => {
    const empty = GROUPS.map((g) => ({ ...g, count: 0, items: [] })) as SubwayNearbyGroup[]
    expect(mountNearby({ groups: empty }).find('[data-block]').exists()).toBe(false)
    expect(mountNearby({ groups: [] }).find('[data-block]').exists()).toBe(false)
  })

  it('주변 역만 있어도 블록을 그린다', () => {
    const wrapper = mountNearby({ groups: [GROUPS[0]] })
    expect(sections(wrapper)).toHaveLength(1)
  })

  it('로딩 중에는 블록 안에 스켈레톤을 표시한다', () => {
    const wrapper = mountNearby({ groups: [], loading: true })
    expect(wrapper.find('[data-block]').exists()).toBe(true)
    expect(wrapper.findAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('FacilityCard·이모지를 쓰지 않는다', () => {
    const wrapper = mountNearby()
    expect(wrapper.html()).not.toContain('facility-card')
    expect(wrapper.text()).not.toMatch(/\p{Extended_Pictographic}/u)
  })
})
