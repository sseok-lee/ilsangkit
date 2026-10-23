import { describe, expect, it } from 'vitest'
import { mount } from '@vue/test-utils'
import EstatePriceHero from '~/components/realEstate/EstatePriceHero.vue'
import type { AreaGroup, DetailOverview, PriceBasis } from '~/types/housingRedesign'

function basis(partial: Partial<PriceBasis> = {}): PriceBasis {
  return {
    representative: null,
    sampleCount: 0,
    latest: null,
    latestAny: null,
    max12m: null,
    yearAgo: null,
    changeRate: null,
    excluded: [],
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
        latest: { id: 11, date: '2026-10-19', amount: 91000, floor: 20 },
        max12m: 103000,
        yearAgo: 71600,
        changeRate: 0.3128,
        excluded: [
          { id: 12, date: '2026-10-14', amount: 53000, floor: 12, reason: 'outlier', deviation: -0.4319 },
        ],
      }),
      '60': basis({
        representative: 78000,
        sampleCount: 5,
        latest: { id: 21, date: '2026-10-02', amount: 79000, floor: 7 },
        max12m: 85900,
      }),
    },
    jeonseBasis: {},
    generatedAt: '2026-10-23T00:00:00.000Z',
    ...partial,
  }
}

function mountHero(overview: DetailOverview, selectedArea: string | null = null) {
  return mount(EstatePriceHero, { props: { overview, selectedArea } })
}

describe('EstatePriceHero', () => {
  it('shows representative price for default group', () => {
    const wrapper = mountHero(makeOverview())
    const text = wrapper.text()
    expect(text).toContain('대표 시세')
    expect(text).toContain('9억 4,000만')
    expect(text).toContain('최근 중개거래 5건 중간값')
    expect(text).toContain('▲ 1년 전보다 31%')
    expect(text).toContain('최근 실거래')
    expect(text).toContain('9억 1,000만')
    expect(text).toContain('26.10.19 · 20층')
    expect(text).toContain('최고가 · 12개월')
    expect(text).toContain('10억 3,000만')

    const pressed = wrapper.findAll('button[aria-pressed="true"]')
    expect(pressed).toHaveLength(1)
    expect(pressed[0].text()).toContain('84㎡ · 전용 26평')
    expect(pressed[0].text()).toContain('매매 326건')
  })

  it('selectedArea overrides the default group', () => {
    const wrapper = mountHero(makeOverview(), '60')
    expect(wrapper.text()).toContain('7억 8,000만')
    expect(wrapper.get('button[aria-pressed="true"]').text()).toContain('59㎡ · 전용 18평')
  })

  it('shows decline with down arrow and omits change line when changeRate is null', () => {
    const declining = makeOverview()
    declining.saleBasis['85'] = { ...declining.saleBasis['85'], changeRate: -0.057 }
    expect(mountHero(declining).text()).toContain('▼ 1년 전보다 5%')

    const flat = makeOverview()
    flat.saleBasis['85'] = { ...flat.saleBasis['85'], changeRate: null }
    expect(mountHero(flat).text()).not.toContain('1년 전보다')
  })

  it.each([
    [0.29, '▲ 1년 전보다 29%'],
    [-0.29, '▼ 1년 전보다 29%'],
    [0.57, '▲ 1년 전보다 57%'],
    [0.58, '▲ 1년 전보다 58%'],
    [0.3128, '▲ 1년 전보다 31%'],
    [-0.057, '▼ 1년 전보다 5%'],
  ])('changeRate %s renders %s without float drift', (rate, expected) => {
    const overview = makeOverview()
    overview.saleBasis['85'] = { ...overview.saleBasis['85'], changeRate: rate }
    expect(mountHero(overview).text()).toContain(expected)
  })

  it('shows excluded notice with link', () => {
    const wrapper = mountHero(makeOverview())
    const text = wrapper.text()
    expect(text).toContain('시세 계산에서 뺀 거래 1건')
    expect(text).toContain('26.10.14')
    expect(text).toContain('5억 3,000만')
    expect(text).toContain('중간값 대비 -43%')
    const link = wrapper.get('a[href="#transactions"]')
    expect(link.text()).toBe('거래 내역에서 보기')
  })

  it('labels direct deals as 직거래', () => {
    const overview = makeOverview()
    overview.saleBasis['85'] = {
      ...overview.saleBasis['85'],
      excluded: [{ id: 30, date: '2026-09-01', amount: 52000, floor: 3, reason: 'direct', deviation: null }],
    }
    expect(mountHero(overview).text()).toContain('직거래')
  })

  it('no 시세 word without representative', () => {
    const overview = makeOverview({
      saleBasis: {
        '85': basis({
          latest: { id: 11, date: '2026-10-19', amount: 91000, floor: null },
          excluded: [{ id: 12, date: '2026-10-14', amount: 53000, floor: 12, reason: 'direct', deviation: null }],
        }),
      },
    })
    const wrapper = mountHero(overview)
    const text = wrapper.text()
    expect(text).not.toContain('시세')
    expect(text).toContain('최근 거래')
    expect(text).toContain('9억 1,000만')
    expect(text).toContain('26.10.19')
    expect(wrapper.find('a[href="#transactions"]').exists()).toBe(true)
  })

  it('renders no price body when neither representative nor latest exists', () => {
    const overview = makeOverview({ saleBasis: {} })
    const wrapper = mountHero(overview)
    expect(wrapper.find('[data-testid="estate-price-body"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('최근 거래')
    expect(wrapper.findAll('button[aria-pressed]').length).toBeGreaterThan(0)
  })

  it('emits select-area on chip click', async () => {
    const wrapper = mountHero(makeOverview())
    const chip = wrapper.findAll('button[aria-pressed]').find(b => b.text().includes('59㎡'))!
    await chip.trigger('click')
    expect(wrapper.emitted('select-area')?.[0]).toEqual(['60'])
  })

  it('rent URL shows jeonse primary and sale secondary', () => {
    const overview = makeOverview({
      basisMode: 'jeonse',
      jeonseBasis: {
        '85': basis({
          representative: 48000,
          sampleCount: 6,
          latest: { id: 41, date: '2026-10-20', amount: 47000, floor: 9 },
          max12m: 50000,
        }),
      },
    })
    const wrapper = mountHero(overview)
    const text = wrapper.text()
    expect(text).toContain('4억 8,000만')
    expect(text).toContain('최근 전세 6건 중간값')
    expect(text).toContain('매매 시세')
    expect(text).toContain('9억 4,000만')
    expect(wrapper.get('button[aria-pressed="true"]').text()).toContain('전세 1,107건')
  })

  it('rent URL omits sale secondary when the group has no sale representative', () => {
    const overview = makeOverview({
      basisMode: 'jeonse',
      saleBasis: {},
      jeonseBasis: { '85': basis({ representative: 48000, sampleCount: 6 }) },
    })
    expect(mountHero(overview).text()).not.toContain('매매 시세')
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
    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(6)
    const more = wrapper.findAll('button').find(b => b.text() === '더보기')!
    expect(more).toBeTruthy()
    await more.trigger('click')
    expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(8)
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
    expect(wrapper.get('button[aria-pressed="true"]').text()).toContain('109㎡')
  })

  it('orders chips by basisMode count descending', () => {
    const wrapper = mountHero(makeOverview())
    const chips = wrapper.findAll('button[aria-pressed]')
    expect(chips[0].text()).toContain('84㎡')
    expect(chips[1].text()).toContain('59㎡')
  })

  describe('정상 거래가 없을 때 최근 거래', () => {
    it('shows latestAny as 최근 거래 · 직거래 when no normal deal exists', () => {
      const overview = makeOverview({
        saleBasis: {
          '85': basis({
            latestAny: { id: 31, date: '2026-05-02', amount: 30500, floor: 4, direct: true },
            excluded: [{ id: 31, date: '2026-05-02', amount: 30500, floor: 4, reason: 'direct', deviation: null }],
          }),
        },
      })
      const wrapper = mountHero(overview)
      const body = wrapper.get('[data-testid="estate-price-body"]').text()
      expect(body).toContain('최근 거래')
      expect(body).toContain('3억 500만')
      expect(body).toContain('26.05.02 · 4층 · 직거래')
      expect(wrapper.text()).not.toContain('시세')
      expect(wrapper.text()).toContain('정상 거래가 아닌 거래 1건')
      expect(wrapper.text()).not.toContain('뺀 거래')
    })

    it('shows latestAny without direct tag when it is a brokered deal', () => {
      const overview = makeOverview({
        saleBasis: {
          '85': basis({ latestAny: { id: 32, date: '2024-02-01', amount: 41000, floor: null, direct: false } }),
        },
      })
      const body = mountHero(overview).get('[data-testid="estate-price-body"]').text()
      expect(body).toContain('4억 1,000만')
      expect(body).toContain('24.02.01')
      expect(body).not.toContain('직거래')
    })

    it('falls back to overview.latestSale when the group has no deal in the loaded window', () => {
      const overview = makeOverview({
        saleBasis: {},
        latestSale: { id: 9, amount: 27000, year: 2021, month: 3, day: 5, area: '84.43', floor: 2 },
      })
      const wrapper = mountHero(overview)
      const body = wrapper.get('[data-testid="estate-price-body"]').text()
      expect(body).toContain('최근 거래')
      expect(body).toContain('2억 7,000만')
      expect(body).toContain('21.03.05')
      expect(body).toContain('전용 84.43㎡')
      expect(wrapper.text()).not.toContain('시세')
    })

    it('falls back to latestSale when basis exists but has no deal at all', () => {
      const overview = makeOverview({
        saleBasis: { '85': basis() },
        latestSale: { id: 9, amount: 27000, year: 2021, month: 3, day: null, area: null, floor: null },
      })
      const body = mountHero(overview).get('[data-testid="estate-price-body"]').text()
      expect(body).toContain('2억 7,000만')
      expect(body).toContain('21.03')
    })

    it('rent URL fallback labels the sale deal as 최근 매매', () => {
      const overview = makeOverview({
        basisMode: 'jeonse',
        saleBasis: {},
        jeonseBasis: {},
        latestSale: { id: 9, amount: 27000, year: 2021, month: 3, day: 5, area: '84.43', floor: 2 },
      })
      const wrapper = mountHero(overview)
      expect(wrapper.text()).toContain('최근 매매')
      expect(wrapper.text()).not.toContain('시세')
    })
  })

  describe('현재 모드 거래가 없는 면적 칩', () => {
    const mixed: AreaGroup[] = [
      { key: '60', label: '59', pyeong: 18, saleCount36m: 0, jeonseCount36m: 12 },
      { key: '85', label: '84', pyeong: 26, saleCount36m: 30, jeonseCount36m: 4 },
    ]

    it('hides chips with zero count for the basis mode', () => {
      const wrapper = mountHero(makeOverview({ areaGroups: mixed }))
      const chips = wrapper.findAll('button[aria-pressed]')
      expect(chips).toHaveLength(1)
      expect(chips[0].text()).toContain('84㎡')
      expect(wrapper.text()).not.toContain('매매 0건')
    })

    it('keeps the active group even with zero count', () => {
      const wrapper = mountHero(makeOverview({ areaGroups: mixed }), '60')
      const chips = wrapper.findAll('button[aria-pressed]')
      expect(chips).toHaveLength(2)
      expect(wrapper.get('button[aria-pressed="true"]').text()).toContain('59㎡')
    })

    it('rent URL hides groups without jeonse deals', () => {
      const groups: AreaGroup[] = [
        { key: '60', label: '59', pyeong: 18, saleCount36m: 9, jeonseCount36m: 0 },
        { key: '85', label: '84', pyeong: 26, saleCount36m: 30, jeonseCount36m: 4 },
      ]
      const wrapper = mountHero(makeOverview({ basisMode: 'jeonse', areaGroups: groups, jeonseBasis: {} }))
      expect(wrapper.findAll('button[aria-pressed]')).toHaveLength(1)
      expect(wrapper.text()).not.toContain('전세 0건')
    })
  })
})
