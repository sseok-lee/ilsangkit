import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const { setRegion, refresh, marketState } = vi.hoisted(() => ({
  setRegion: vi.fn(),
  refresh: vi.fn(),
  marketState: { state: {} as Record<string, unknown> },
}))

vi.mock('~/composables/useHomeMarket', async () => {
  const { ref } = await import('vue')
  const defaultMarket = {
    region: { city: 'seoul', district: 'gangnam', label: '서울 강남구' },
    window: { from: '2026-08-23', to: '2026-09-21' },
    generatedAt: '2026-09-21T00:00:00.000Z',
    counts: {
      apt: { status: 'ok', data: { total: 12, daily: [{ date: '2026-09-20', count: 3 }, { date: '2026-09-21', count: 9 }] } },
      villa: { status: 'ok', data: { total: 0, daily: [] } },
      offitel: { status: 'error', data: null, code: 'UNAVAILABLE' },
    },
    recent: {
      status: 'ok',
      data: [
        {
          type: 'apt',
          transactionId: 10,
          buildingKey: 'a'.repeat(64),
          city: '서울특별시',
          district: '강남구',
          bjdCode: '11680',
          buildingName: '테스트아파트',
          dongName: '대치동',
          jibun: '934-2',
          date: '2026-09-21',
          amount: 123000,
          area: null,
        },
        {
          type: 'villa',
          transactionId: 11,
          buildingKey: 'b'.repeat(64),
          city: '서울특별시',
          district: '마포구',
          bjdCode: '11440',
          buildingName: '테스트빌라',
          dongName: '서교동',
          jibun: null,
          date: '2026-09-20',
          amount: 45000,
          area: '59.50',
        },
        {
          type: 'offitel',
          transactionId: 12,
          buildingKey: 'c'.repeat(64),
          city: '부산광역시',
          district: '해운대구',
          bjdCode: '26350',
          buildingName: '테스트오피스텔',
          dongName: '우동',
          jibun: null,
          date: '2026-09-19',
          amount: 32000,
          area: '42.00',
        },
      ],
    },
  }

  return {
    useHomeMarket: () => ({
      region: ref({ city: 'seoul', district: 'gangnam' }),
      data: ref(defaultMarket),
      pending: ref(false),
      error: ref(null),
      setRegion,
      refresh,
      ...marketState.state,
    }),
  }
})

import HomeMarketSection from '~/components/home/HomeMarketSection.vue'

function mountWith(state: Record<string, unknown>) {
  marketState.state = state
  return mount(HomeMarketSection, {
    global: {
      stubs: {
        HardLink: {
          template: '<a :href="to"><slot /></a>',
          props: ['to'],
        },
      },
    },
  })
}

describe('HomeMarketSection', () => {
  it.each([
    ['2026-09-30T14:59:00.000Z', '2026. 09. 30. 23:59'],
    ['2026-09-30T15:00:00.000Z', '2026. 10. 01. 00:00'],
    ['2026-09-30T15:19:00.000Z', '2026. 10. 01. 00:19'],
  ])('KST 자정 전후 조회시각 %s를 00~23시로 표시한다', (generatedAt, expected) => {
    const emptyCount = { status: 'ok', data: { total: 0, daily: [] } }
    const wrapper = mountWith({
      data: ref({
        region: { city: '', district: '', label: '전국' },
        window: { from: '2026-09-02', to: '2026-10-01' },
        generatedAt,
        counts: { apt: emptyCount, villa: emptyCount, offitel: emptyCount },
        recent: { status: 'ok', data: [] },
      }),
    })

    expect(wrapper.text()).toContain(expected)
  })

  it('3유형 total, 30일 건수 sparkline, 최근 거래 5개 목록을 렌더한다', () => {
    const wrapper = mountWith({})

    expect(wrapper.text()).toContain('서울 강남구')
    expect(wrapper.text()).toContain('아파트')
    expect(wrapper.text()).toContain('12건')
    expect(wrapper.text()).toContain('기간')
    expect(wrapper.text()).toContain('2026.08.23~2026.09.21')
    expect(wrapper.text()).toContain('조회시각')
    expect(wrapper.text()).toContain('계약일 기준')
    expect(wrapper.text()).toContain('추가 신고에 따라 수치가 달라질 수 있습니다')
    expect(wrapper.text()).toContain('단위 건')
    expect(wrapper.find('svg[aria-label*="단위 건"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('테스트아파트')
    expect(wrapper.text()).toContain('테스트빌라')
    expect(wrapper.text()).toContain('테스트오피스텔')
    expect(wrapper.text()).toContain('아파트')
    expect(wrapper.text()).toContain('빌라')
    expect(wrapper.text()).toContain('오피스텔')
    expect(wrapper.text()).toContain('면적 미제공')
    expect(wrapper.text()).toContain('대치동 934-2')
    expect(wrapper.find('a[href="/real-estate/apt-sale/seoul/gangnam/%ED%85%8C%EC%8A%A4%ED%8A%B8%EC%95%84%ED%8C%8C%ED%8A%B8"]').exists()).toBe(true)
  })

  it('native select 변경으로 지역 변경을 요청하고 live status를 노출한다', async () => {
    const wrapper = mountWith({})

    await wrapper.find('select[aria-label="시도 선택"]').setValue('busan')
    await wrapper.find('select[aria-label="시군구 선택"]').setValue('haeundae')

    expect(setRegion).toHaveBeenLastCalledWith('busan', 'haeundae')
    expect(wrapper.find('[aria-live="polite"]').text()).toContain('지역')
  })

  it('로딩과 오류 상태에서는 이전 성공 데이터를 성공처럼 보여주지 않는다', () => {
    const loading = mountWith({ data: ref(null), pending: ref(true) })
    expect(loading.text()).toContain('불러오는 중')
    expect(loading.text()).not.toContain('테스트아파트')

    const failed = mountWith({ data: ref(null), error: ref(new Error('fail')) })
    expect(failed.text()).toContain('시장 정보를 불러오지 못했습니다')
    expect(failed.text()).not.toContain('테스트아파트')
  })

  describe('평당가·최고가 줄', () => {
    const emptyCount = { status: 'ok', data: { total: 0, daily: [] } }
    const deal = (n: number, canonicalPath: string | null) => ({
      buildingName: `최고단지${n}`,
      bjdCode: '1168010600',
      dongName: '대치동',
      jibun: '1-1',
      area: '84.97',
      amount: 300000 - n * 10000,
      date: '2026-09-01',
      canonicalPath,
    })
    const stats = (overrides: Record<string, unknown> = {}) => ({
      status: 'ok',
      data: {
        ppMedian: 7840,
        ppYoyPct: 10.1,
        dealCount12m: 321,
        topDeals: [
          deal(1, '/real-estate/apt-sale/seoul/gangnam/a'),
          deal(2, '/real-estate/apt-sale/seoul/gangnam/b'),
          deal(3, null),
        ],
        computedAt: '2026-10-30T00:00:00.000Z',
        ...overrides,
      },
    })
    const market = (priceStats: unknown, region = { city: 'seoul', district: 'gangnam', label: '서울 강남구' }) =>
      mountWith({
        data: ref({
          region,
          window: { from: '2026-09-02', to: '2026-10-01' },
          generatedAt: '2026-10-01T00:00:00.000Z',
          counts: { apt: emptyCount, villa: emptyCount, offitel: emptyCount },
          recent: { status: 'ok', data: [] },
          priceStats,
        }),
      })

    it('평당가·증감·TOP 3와 링크를 렌더한다', () => {
      const wrapper = market(stats())
      const text = wrapper.text()
      expect(text).toContain('아파트 평당가 중간값')
      expect(text).toContain('7,840만원')
      expect(text).toContain('1년 전 대비 +10.1%')
      expect(text).toContain('최고가 거래 TOP 3')
      expect(text).toContain('최고단지1')
      expect(text).toContain('최고단지3')
      expect(wrapper.find('a[href="/real-estate/apt-sale/seoul/gangnam/a"]').exists()).toBe(true)
      expect(wrapper.find('a[href="/real-estate/apt-sale/seoul/gangnam/b"]').exists()).toBe(true)
      expect(wrapper.findAll('a').some((a) => a.text().includes('최고단지3'))).toBe(false)
      expect(text).toContain('서울 강남구 실거래가 자세히')
    })

    it('TOP 3 링크는 44px 이상 터치 영역을 가지며 canonicalPath 없는 행은 링크가 아니다', () => {
      const wrapper = market(stats())
      const links = wrapper.findAll('ol a')
      expect(links).toHaveLength(2)
      links.forEach((a) => expect(a.classes()).toContain('min-h-[44px]'))
      expect(links[0].text()).toContain('최고단지1')
      const plain = wrapper.findAll('ol li').find((li) => li.text().includes('최고단지3'))
      expect(plain?.find('a').exists()).toBe(false)
      expect(plain?.find('div').classes()).toContain('min-h-[44px]')
    })

    it('ppYoyPct가 null이면 변화율만 숨긴다', () => {
      const text = market(stats({ ppYoyPct: null })).text()
      expect(text).toContain('7,840만원')
      expect(text).not.toContain('1년 전 대비')
    })

    it('음수 변화율은 부호와 함께 표시한다', () => {
      expect(market(stats({ ppYoyPct: -3.25 })).text()).toContain('1년 전 대비 -3.3%')
    })

    it.each([
      ['null 데이터', { status: 'ok', data: null }],
      ['error', { status: 'error', data: null, code: 'UNAVAILABLE' }],
      ['필드 없음', undefined],
    ])('%s이면 줄 전체를 렌더하지 않는다', (_name, priceStats) => {
      const text = market(priceStats).text()
      expect(text).not.toContain('아파트 평당가 중간값')
      expect(text).not.toContain('최고가 거래 TOP 3')
      expect(text).not.toContain('자세히')
    })

    it.each([
      [{ city: 'seoul', district: 'gangnam', label: '서울 강남구' }, '/real-estate/apt-sale/seoul/gangnam'],
      [{ city: 'seoul', district: null, label: '서울' }, '/real-estate/apt-sale/seoul'],
      [{ city: null, district: null, label: '전국' }, '/real-estate/apt-sale'],
    ])('자세히 링크는 선택 지역 목록으로 간다', (region, href) => {
      const wrapper = market(stats(), region)
      const link = wrapper.findAll('a').find((a) => a.text().includes('실거래가 자세히'))
      expect(link?.attributes('href')).toBe(href)
      expect(link?.text()).toBe(`${region.label} 실거래가 자세히`)
    })
  })
})
