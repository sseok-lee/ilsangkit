import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EstatePriceHero from '~/components/realEstate/EstatePriceHero.vue'
import type { AreaGroup, DetailOverview, PriceBasis } from '~/types/housingRedesign'

function basis(partial: Partial<PriceBasis> = {}): PriceBasis {
  return {
    representative: null,
    sampleCount: 0,
    latestAny: null,
    max12m: null,
    yearAgo: null,
    changeRate: null,
    ...partial,
  }
}

const GROUPS: AreaGroup[] = [
  { key: '60', label: '59', pyeong: 18, saleCount36m: 73, jeonseCount36m: 145 },
  { key: '85', label: '84', pyeong: 26, saleCount36m: 326, jeonseCount36m: 1107 },
]

function makeOverview(partial: Partial<DetailOverview> = {}): DetailOverview {
  return {
    identity: { bjdCode: '4159012500', buildingName: '병점역아이파크캐슬' } as DetailOverview['identity'],
    latestSale: null,
    buildYear: 2021,
    minArea: '59',
    maxArea: '84',
    saleCount6m: 40,
    window6m: { from: '2026-04-23', to: '2026-10-23' },
    addresses: [],
    location: null,
    locationAmbiguous: false,
    basisMode: 'sale',
    defaultAreaGroup: '85',
    areaGroups: GROUPS,
    saleBasis: {
      '85': basis({
        representative: 94000,
        sampleCount: 5,
        latestAny: { id: 11, date: '2026-10-19', amount: 91000, floor: 20, direct: false },
        max12m: 103000,
        yearAgo: 71600,
        changeRate: 0.3128,
      }),
      '60': basis({
        representative: 78000,
        sampleCount: 5,
        latestAny: { id: 21, date: '2026-10-02', amount: 79000, floor: 7, direct: false },
        max12m: 85900,
      }),
    },
    jeonseBasis: {},
    wolseLatest: {
      '60': { date: '2026-09-11', deposit: 10000, monthlyRent: 120, floor: 4 },
      '85': null,
    },
    generatedAt: '2026-10-23T00:00:00.000Z',
    ...partial,
  }
}

function mountHero(overview: DetailOverview, selectedArea: string | null = null) {
  return mount(EstatePriceHero, { props: { overview, selectedArea } })
}


// 표 칸: 데스크톱 전체 표기 + 날짜 / 모바일 짧은 표기
const cellText = (td: { find: (s: string) => { exists: () => boolean; text: () => string }; text: () => string }): string => {
  const full = td.find('.estate-price-hero__table-value--full')
  if (!full.exists()) return td.text()
  return full.text() + td.find('.estate-price-hero__table-date').text()
}
const compactText = (td: { find: (s: string) => { exists: () => boolean; text: () => string }; text: () => string }): string => {
  const compact = td.find('.estate-price-hero__table-value--compact')
  return compact.exists() ? compact.text() : td.text()
}

describe('EstatePriceHero', () => {
  it('leads with the latest deal and shows the median as a sub line', () => {
    const wrapper = mountHero(makeOverview())
    const lead = wrapper.get('.estate-price-hero__cell--lead')
    expect(lead.get('.estate-price-hero__label').text()).toBe('최근 매매')
    expect(lead.get('.estate-price-hero__value').text()).toBe('9억 1,000만원')
    expect(lead.text()).toContain('26.10.19 · 20층')
    expect(lead.text()).not.toContain('직거래')
    expect(lead.get('[data-testid="estate-price-median"]').text()).toBe('최근 1년 5건 중간 9억 4,000만원 · 1년 전보다 +31%')
    const text = wrapper.text()
    expect(text).toContain('최고가 · 12개월')
    expect(text).toContain('10억 3,000만')
    expect(text).not.toContain('시세')
    expect(text).not.toContain('최근 실거래')

    const pressed = wrapper.findAll('.estate-price-hero__chips button[aria-pressed="true"]')
    expect(pressed).toHaveLength(1)
    expect(pressed[0].text()).toContain('84㎡ · 전용 26평')
    expect(pressed[0].text()).toContain('매매 326건')
  })

  it('selectedArea overrides the default group', () => {
    const wrapper = mountHero(makeOverview(), '60')
    expect(wrapper.get('.estate-price-hero__cell--lead .estate-price-hero__value').text()).toBe('7억 9,000만원')
    expect(wrapper.get('[data-testid="estate-price-median"]').text()).toBe('최근 1년 5건 중간 7억 8,000만원')
    expect(wrapper.get('.estate-price-hero__chips button[aria-pressed="true"]').text()).toContain('59㎡ · 전용 18평')
  })

  it('shows decline / flat and omits the change part when changeRate is null', () => {
    const declining = makeOverview()
    declining.saleBasis['85'] = { ...declining.saleBasis['85'], changeRate: -0.057 }
    expect(mountHero(declining).get('[data-testid="estate-price-median"]').text()).toContain('1년 전보다 −5%')

    const same = makeOverview()
    same.saleBasis['85'] = { ...same.saleBasis['85'], changeRate: 0.001 }
    expect(mountHero(same).get('[data-testid="estate-price-median"]').text()).toContain('1년 전보다 변동 없음')

    const flat = makeOverview()
    flat.saleBasis['85'] = { ...flat.saleBasis['85'], changeRate: null }
    expect(mountHero(flat).text()).not.toContain('1년 전보다')
  })

  it.each([
    [0.29, '1년 전보다 +29%'],
    [-0.29, '1년 전보다 −29%'],
    [0.57, '1년 전보다 +57%'],
    [0.58, '1년 전보다 +58%'],
    [0.3128, '1년 전보다 +31%'],
    [-0.057, '1년 전보다 −5%'],
  ])('changeRate %s renders %s without float drift', (rate, expected) => {
    const overview = makeOverview()
    overview.saleBasis['85'] = { ...overview.saleBasis['85'], changeRate: rate }
    expect(mountHero(overview).text()).toContain(expected)
  })

  it('has no excluded-deal notice', () => {
    const wrapper = mountHero(makeOverview())
    expect(wrapper.text()).not.toContain('뺀 거래')
    expect(wrapper.find('a[href="#transactions"]').exists()).toBe(false)
  })

  it('labels a direct latest deal as 직거래 in the lead note', () => {
    const overview = makeOverview()
    overview.saleBasis['85'] = {
      ...overview.saleBasis['85'],
      latestAny: { id: 30, date: '2026-10-21', amount: 52000, floor: 3, direct: true },
    }
    const lead = mountHero(overview).get('.estate-price-hero__cell--lead')
    expect(lead.get('.estate-price-hero__value').text()).toBe('5억 2,000만원')
    expect(lead.text()).toContain('26.10.21 · 3층 · 직거래')
  })

  it('omits the floor when unknown and the median line without a representative', () => {
    const overview = makeOverview({
      saleBasis: {
        '85': basis({
          latestAny: { id: 11, date: '2026-10-19', amount: 91000, floor: null, direct: false },
        }),
      },
    })
    const wrapper = mountHero(overview)
    const lead = wrapper.get('.estate-price-hero__cell--lead')
    expect(lead.get('.estate-price-hero__value').text()).toBe('9억 1,000만원')
    expect(lead.get('.estate-price-hero__note').text()).toBe('26.10.19')
    expect(wrapper.find('[data-testid="estate-price-median"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('중간')
    expect(wrapper.text()).not.toContain('시세')
  })

  it('shows 최근 3년 거래 없음 when the group has no deal in the mode', () => {
    const overview = makeOverview({
      saleBasis: {},
      latestSale: { id: 9, amount: 27000, year: 2021, month: 3, day: 5, area: '84.43', floor: 2 },
    })
    const wrapper = mountHero(overview)
    const lead = wrapper.get('.estate-price-hero__cell--lead')
    expect(lead.get('.estate-price-hero__label').text()).toBe('최근 매매')
    expect(lead.get('.estate-price-hero__value').text()).toBe('최근 3년 거래 없음')
    // 면적 무관·3년 넘은 최근 매매로 대신하지 않는다.
    expect(wrapper.text()).not.toContain('2억 7,000만')
    expect(wrapper.find('[data-testid="estate-price-median"]').exists()).toBe(false)
    expect(wrapper.findAll('.estate-price-hero__chips button[aria-pressed]').length).toBeGreaterThan(0)
  })

  it('emits select-area on chip click', async () => {
    const wrapper = mountHero(makeOverview())
    const chip = wrapper.findAll('.estate-price-hero__chips button[aria-pressed]').find(b => b.text().includes('59㎡'))!
    await chip.trigger('click')
    expect(wrapper.emitted('select-area')?.[0]).toEqual(['60'])
  })

  it('rent URL leads with the latest jeonse and adds the same group latest sale', () => {
    const overview = makeOverview({
      basisMode: 'jeonse',
      jeonseBasis: {
        '85': basis({
          representative: 48000,
          sampleCount: 6,
          latestAny: { id: 41, date: '2026-10-20', amount: 47000, floor: 9, direct: false },
          max12m: 50000,
        }),
      },
    })
    const wrapper = mountHero(overview)
    const lead = wrapper.get('.estate-price-hero__cell--lead')
    expect(lead.get('.estate-price-hero__label').text()).toBe('최근 전세')
    expect(lead.get('.estate-price-hero__value').text()).toBe('4억 7,000만원')
    expect(lead.text()).toContain('26.10.20 · 9층')
    expect(wrapper.get('[data-testid="estate-price-median"]').text()).toBe('최근 1년 6건 중간 4억 8,000만원')
    const saleCell = wrapper.findAll('.estate-price-hero__cell').find(c => c.get('.estate-price-hero__label').text() === '최근 매매')!
    expect(saleCell).toBeTruthy()
    // 매매 보조 셀은 중간값(9.4억)이 아니라 최근 매매 1건(9.1억)
    expect(saleCell.get('.estate-price-hero__value').text()).toBe('9억 1,000만원')
    expect(wrapper.find('[data-testid="estate-price-body"]').text()).not.toContain('9억 4,000만')
    expect(wrapper.text()).not.toContain('시세')
    expect(wrapper.get('.estate-price-hero__chips button[aria-pressed="true"]').text()).toContain('전세 1,107건')
  })

  it('rent URL omits the sale secondary when the group has no sale deal', () => {
    const overview = makeOverview({
      basisMode: 'jeonse',
      saleBasis: {},
      jeonseBasis: { '85': basis({ representative: 48000, sampleCount: 6 }) },
    })
    const wrapper = mountHero(overview)
    const labels = wrapper.findAll('.estate-price-hero__label').map(l => l.text())
    expect(labels).toEqual(['최근 전세'])
    expect(wrapper.get('.estate-price-hero__cell--lead .estate-price-hero__value').text()).toBe('최근 3년 거래 없음')
  })

  it('more button reveals groups beyond six', async () => {
    const groups: AreaGroup[] = Array.from({ length: 8 }, (_, i) => ({
      key: String(40 + i * 10),
      label: String(39 + i * 10),
      pyeong: 12 + i * 3,
      saleCount36m: 100 - i,
      jeonseCount36m: 0,
    }))
    const wrapper = mountHero(makeOverview({ areaGroups: groups, defaultAreaGroup: '40', saleBasis: {} }))
    expect(wrapper.findAll('.estate-price-hero__chips button[aria-pressed]')).toHaveLength(6)
    const more = wrapper.findAll('button').find(b => b.text() === '더보기')!
    expect(more).toBeTruthy()
    await more.trigger('click')
    expect(wrapper.findAll('.estate-price-hero__chips button[aria-pressed]')).toHaveLength(8)
  })

  it('keeps a selected group visible even when it ranks beyond six', () => {
    const groups: AreaGroup[] = Array.from({ length: 8 }, (_, i) => ({
      key: String(40 + i * 10),
      label: String(39 + i * 10),
      pyeong: 12 + i * 3,
      saleCount36m: 100 - i,
      jeonseCount36m: 0,
    }))
    const wrapper = mountHero(makeOverview({ areaGroups: groups, defaultAreaGroup: '40', saleBasis: {} }), '110')
    expect(wrapper.get('.estate-price-hero__chips button[aria-pressed="true"]').text()).toContain('109㎡')
  })

  it('orders chips by basisMode count descending', () => {
    const wrapper = mountHero(makeOverview())
    const chips = wrapper.findAll('.estate-price-hero__chips button[aria-pressed]')
    expect(chips[0].text()).toContain('84㎡')
    expect(chips[1].text()).toContain('59㎡')
  })

  describe('면적별 최근 거래가 표', () => {
    it('lists every area group with latest sale, jeonse and wolse', () => {
      const overview = makeOverview({
        jeonseBasis: {
          '85': basis({ latestAny: { id: 41, date: '2026-10-20', amount: 47000, floor: 9, direct: false } }),
        },
      })
      const wrapper = mountHero(overview)
      const table = wrapper.get('[data-testid="estate-area-latest"]')
      expect(table.findAll('thead th').map(th => th.text())).toEqual(['전용면적', '매매', '전세', '월세'])
      const rows = table.findAll('tbody tr')
      expect(rows).toHaveLength(2)
      // 칩과 같은 순서(매매 거래 수 많은 순)·라벨
      expect(rows[0].get('th').text()).toBe('84㎡ · 26평')
      expect(rows[1].get('th').text()).toBe('59㎡ · 18평')
      const cells85 = rows[0].findAll('td').map(cellText)
      expect(cells85[0]).toBe('9억 1,000만원26.10')
      expect(cells85[1]).toBe('4억 7,000만원26.10')
      expect(cells85[2]).toBe('-')
      const cells60 = rows[1].findAll('td').map(cellText)
      expect(cells60[1]).toBe('-')
      expect(cells60[2]).toBe('1억/120만원26.09')
      // 모바일 전용 짧은 표기(4.5억 형식) — 같은 칸에 함께 렌더하고 CSS 로 화면 폭에 따라 하나만 보인다
      const compact85 = rows[0].findAll('td').map(compactText)
      expect(compact85[0]).toBe('9.1억')
      expect(compact85[1]).toBe('4.7억')
      expect(rows[1].findAll('td').map(compactText)[2]).toBe('1억/120만')
      expect(table.text()).toContain('최근 3년 중 가장 최근 거래 · 출처 국토교통부 실거래가')
      expect(table.text()).not.toContain('시세')
    })

    it('always shows monthly rent in the wolse cell, even 0', () => {
      const wrapper = mountHero(makeOverview({
        wolseLatest: {
          '60': { date: '2026-09-11', deposit: 30000, monthlyRent: 0, floor: 4 },
          '85': { date: '2026-08-01', deposit: 0, monthlyRent: 150, floor: 2 },
        },
      }))
      const rows = wrapper.get('[data-testid="estate-area-latest"]').findAll('tbody tr')
      expect(cellText(rows[0].findAll('td')[2])).toBe('0만원/150만원26.08')
      expect(cellText(rows[1].findAll('td')[2])).toBe('3억/0만원26.09')
      expect(compactText(rows[1].findAll('td')[2])).toBe('3억/0만')
    })

    it('rows without a deal in the current mode are display-only', async () => {
      const groups: AreaGroup[] = [
        { key: '60', label: '59', pyeong: 18, saleCount36m: 0, jeonseCount36m: 12 },
        { key: '85', label: '84', pyeong: 26, saleCount36m: 30, jeonseCount36m: 4 },
      ]
      const wrapper = mountHero(makeOverview({ areaGroups: groups }))
      const rows = wrapper.get('[data-testid="estate-area-latest"]').findAll('tbody tr')
      expect(rows).toHaveLength(2)
      const jeonseOnly = rows[1]
      expect(jeonseOnly.get('th').text()).toBe('59㎡ · 18평')
      expect(jeonseOnly.find('button').exists()).toBe(false)
      expect(jeonseOnly.classes()).not.toContain('estate-price-hero__row--selectable')
      await jeonseOnly.trigger('click')
      expect(wrapper.emitted('select-area')).toBeUndefined()
      expect(rows[0].classes()).toContain('estate-price-hero__row--selectable')
    })

    it('marks the active row and emits select-area on row click', async () => {
      const wrapper = mountHero(makeOverview())
      const rows = wrapper.get('[data-testid="estate-area-latest"]').findAll('tbody tr')
      expect(rows[0].attributes('aria-current')).toBe('true')
      expect(rows[1].attributes('aria-current')).toBeUndefined()
      expect(rows[0].get('button').attributes('aria-pressed')).toBe('true')
      expect(rows[1].get('button').attributes('aria-pressed')).toBe('false')
      await rows[1].trigger('click')
      expect(wrapper.emitted('select-area')?.[0]).toEqual(['60'])
      await rows[1].get('button').trigger('click')
      expect(wrapper.emitted('select-area')).toHaveLength(2)
      expect(wrapper.emitted('select-area')?.[1]).toEqual(['60'])
    })

    it('hides the table when there is only one area group', () => {
      const wrapper = mountHero(makeOverview({ areaGroups: [GROUPS[1]] }))
      expect(wrapper.find('[data-testid="estate-area-latest"]').exists()).toBe(false)
    })

    it('tolerates an overview without wolseLatest', () => {
      const wrapper = mountHero(makeOverview({ wolseLatest: undefined }))
      const rows = wrapper.get('[data-testid="estate-area-latest"]').findAll('tbody tr')
      expect(rows[0].findAll('td')[2].text()).toBe('-')
    })
  })

  describe('현재 모드 거래가 없는 면적 칩', () => {
    const mixed: AreaGroup[] = [
      { key: '60', label: '59', pyeong: 18, saleCount36m: 0, jeonseCount36m: 12 },
      { key: '85', label: '84', pyeong: 26, saleCount36m: 30, jeonseCount36m: 4 },
    ]

    it('hides chips with zero count for the basis mode', () => {
      const wrapper = mountHero(makeOverview({ areaGroups: mixed }))
      const chips = wrapper.findAll('.estate-price-hero__chips button[aria-pressed]')
      expect(chips).toHaveLength(1)
      expect(chips[0].text()).toContain('84㎡')
      expect(wrapper.text()).not.toContain('매매 0건')
    })

    it('keeps the active group even with zero count', () => {
      const wrapper = mountHero(makeOverview({ areaGroups: mixed }), '60')
      const chips = wrapper.findAll('.estate-price-hero__chips button[aria-pressed]')
      expect(chips).toHaveLength(2)
      expect(wrapper.get('.estate-price-hero__chips button[aria-pressed="true"]').text()).toContain('59㎡')
    })

    it('rent URL hides groups without jeonse deals', () => {
      const groups: AreaGroup[] = [
        { key: '60', label: '59', pyeong: 18, saleCount36m: 9, jeonseCount36m: 0 },
        { key: '85', label: '84', pyeong: 26, saleCount36m: 30, jeonseCount36m: 4 },
      ]
      const wrapper = mountHero(makeOverview({ basisMode: 'jeonse', areaGroups: groups, jeonseBasis: {} }))
      expect(wrapper.findAll('.estate-price-hero__chips button[aria-pressed]')).toHaveLength(1)
      expect(wrapper.text()).not.toContain('전세 0건')
    })
  })
})
