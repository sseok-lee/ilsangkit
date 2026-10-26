import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DetailNearby from '~/components/facility/detail/DetailNearby.vue'
import type { Facility, FacilityCategory, FacilityNearbyGroup } from '~/types/facility'

function item(category: FacilityCategory, id: string, name: string, distance: number, extras: Record<string, unknown> = {}): Facility {
  return {
    id, name, category, distance, extras,
    address: '경기도 화성시 병점동 1',
    roadAddress: '경기도 화성시 병점노을4로 29, 1층 (병점동)',
    lat: 37.2, lng: 127.0, city: '경기도', district: '화성시',
  }
}

const GROUPS: FacilityNearbyGroup[] = [
  {
    category: 'pharmacy', count: 16, exact: true,
    items: [
      item('pharmacy', 'p1', '병점역약국', 261, { dutyTime1s: '900', dutyTime1c: '1800' }),
      item('pharmacy', 'p2', '온누리약국', 300),
      item('pharmacy', 'p3', '가약국', 400),
      item('pharmacy', 'p4', '나약국', 500),
      item('pharmacy', 'p5', '다약국', 900),
    ],
  },
  { category: 'hospital', count: 1942, exact: false, items: [item('hospital', 'h1', '다나고한의원', 4, { clCdNm: '한의원', drTotCnt: 1 })] },
  { category: 'childcare', count: 0, exact: true, items: [] },
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
  return mount(DetailNearby, {
    props: {
      groups: GROUPS,
      loading: false,
      facilityName: '캐슬약국',
      regionHref: '/gyeonggi/hwaseong/pharmacy',
      regionLabel: '화성시 약국',
      ...props,
    },
    global: globalConfig,
  })
}

function sections(wrapper: ReturnType<typeof mountNearby>) {
  return wrapper.findAll('[data-testid="nearby-facility-section"]')
}

describe('DetailNearby — 주변 시설 한 블록 · 카테고리별 구분선 목록', () => {
  it('제목 "주변 시설" 과 시설명 부제를 쓴다', () => {
    const wrapper = mountNearby()
    expect(wrapper.find('h2').text()).toBe('주변 시설')
    expect(wrapper.find('[data-testid="subtext"]').text())
      .toBe('캐슬약국에서 반경 1km 안의 시설입니다. 거리는 직선거리, 도보 시간은 추정입니다.')
  })

  it('SectionBlock 하나에 flat variant 를 넘긴다', () => {
    const wrapper = mountNearby()
    const blocks = wrapper.findAll('[data-block]')
    expect(blocks).toHaveLength(1)
    expect(blocks[0].attributes('variant')).toBe('flat')
  })

  it('API 그룹 순서대로 "주변 {라벨}" 섹션을 그리고 0곳 섹션은 숨긴다', () => {
    const wrapper = mountNearby()
    expect(sections(wrapper).map((s) => s.find('h3').text())).toEqual(['주변 약국', '주변 병원'])
    expect(wrapper.text()).not.toContain('어린이집')
  })

  it('md 이상 2열 그리드', () => {
    const wrapper = mountNearby()
    expect(wrapper.find('.grid').classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2']))
  })

  it('개수 문구는 "1km 안 N곳", 하한값이면 "이상"', () => {
    const wrapper = mountNearby()
    expect(sections(wrapper).map((s) => s.find('[data-testid="nearby-facility-count"]').text()))
      .toEqual(['1km 안 16곳', '1km 안 1,942곳 이상'])
  })

  it('행: 이름 + 보조 줄, 거리·도보 두 줄, 64px 이상, 시설 상세로 링크', () => {
    const wrapper = mountNearby()
    const first = sections(wrapper)[0].find('li')
    expect(first.text()).toContain('병점역약국')
    expect(first.find('[data-testid="nearby-place-sub"]').text()).toBe('병점노을4로 29 · 평일 09:00~18:00')
    expect(first.text()).toContain('261m')
    expect(first.text()).toContain('도보 약 4분')
    const link = first.find('a')
    expect(link.attributes('href')).toBe('/pharmacy/p1')
    expect(link.classes()).toContain('min-h-[64px]')

    const hospital = sections(wrapper)[1].find('li')
    expect(hospital.find('[data-testid="nearby-place-sub"]').text()).toBe('병점노을4로 29 · 한의원 · 의사 1명')
    expect(hospital.find('a').attributes('href')).toBe('/hospital/h1')
  })

  it('섹션당 최대 5곳, 모바일은 3곳 + 모두 보기(4·5번째도 DOM 에 있음)', () => {
    const many = [{ ...GROUPS[0], items: [...GROUPS[0].items, item('pharmacy', 'p6', '라약국', 950)] }]
    const wrapper = mountNearby({ groups: many })
    const rows = sections(wrapper)[0].findAll('li')
    expect(rows).toHaveLength(5)
    expect(rows.map((r) => r.classes().includes('max-md:hidden'))).toEqual([false, false, false, true, true])
    expect(sections(wrapper)[0].find('button').text()).toBe('5곳 모두 보기')
  })

  it('하단: 출처 문구 + "{구·군} {카테고리} 전체 보기" 지역 목록 링크', () => {
    const wrapper = mountNearby()
    expect(wrapper.text()).toContain('공공데이터포털 시설 데이터 · 카테고리별 가까운 순 최대 5곳')
    const link = wrapper.find('[data-testid="nearby-facilities-region-link"]')
    expect(link.attributes('href')).toBe('/gyeonggi/hwaseong/pharmacy')
    expect(link.text()).toBe('화성시 약국 전체 보기 →')
  })

  it('지역 링크를 만들 수 없으면 링크만 생략한다', () => {
    const wrapper = mountNearby({ regionHref: undefined, regionLabel: undefined })
    expect(wrapper.find('[data-testid="nearby-facilities-region-link"]').exists()).toBe(false)
    expect(wrapper.text()).toContain('공공데이터포털 시설 데이터')
  })

  it('모든 그룹이 0곳이면 블록 자체를 숨긴다', () => {
    const wrapper = mountNearby({ groups: [{ category: 'pharmacy', count: 0, exact: true, items: [] }] })
    expect(wrapper.find('[data-block]').exists()).toBe(false)
    expect(mountNearby({ groups: [] }).find('[data-block]').exists()).toBe(false)
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

describe('DetailNearby — E2E 훅', () => {
  it('블록 루트에 data-testid="facility-nearby"', () => {
    const wrapper = mount(DetailNearby, {
      props: { groups: GROUPS, loading: false, facilityName: '캐슬약국' },
      global: globalConfig,
    })
    expect(wrapper.find('[data-testid="facility-nearby"]').exists()).toBe(true)
  })
})
