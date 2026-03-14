import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import PriceTrendChart from '~/components/realEstate/PriceTrendChart.vue'
import type { TransactionStats } from '~/types/realEstate'

// Mock lightweight-charts
vi.mock('lightweight-charts', () => ({
  createChart: vi.fn(() => ({
    addSeries: vi.fn(() => ({
      setData: vi.fn(),
    })),
    applyOptions: vi.fn(),
    priceScale: vi.fn(() => ({
      applyOptions: vi.fn(),
    })),
    timeScale: vi.fn(() => ({
      fitContent: vi.fn(),
    })),
    subscribeCrosshairMove: vi.fn(),
    resize: vi.fn(),
    remove: vi.fn(),
  })),
  ColorType: { Solid: 'solid' },
  AreaSeries: 'AreaSeries',
  LineSeries: 'LineSeries',
  HistogramSeries: 'HistogramSeries',
}))

const mockStats: TransactionStats[] = [
  { year: 2024, month: 1, avgPrice: 50000, maxPrice: 60000, minPrice: 40000, count: 10 },
  { year: 2024, month: 2, avgPrice: 52000, maxPrice: 62000, minPrice: 42000, count: 15 },
  { year: 2024, month: 3, avgPrice: 55000, maxPrice: 65000, minPrice: 45000, count: 12 },
]

describe('PriceTrendChart', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stats 데이터와 함께 렌더링된다', () => {
    const wrapper = mount(PriceTrendChart, {
      props: { stats: mockStats, loading: false },
    })
    expect(wrapper.exists()).toBe(true)
  })

  it('차트 컨테이너 엘리먼트가 존재한다', () => {
    const wrapper = mount(PriceTrendChart, {
      props: { stats: mockStats, loading: false },
    })
    const container = wrapper.find('[data-testid="chart-container"]')
    expect(container.exists()).toBe(true)
  })

  describe('로딩 상태', () => {
    it('loading=true일 때 스켈레톤 UI를 표시한다', () => {
      const wrapper = mount(PriceTrendChart, {
        props: { stats: [], loading: true },
      })
      const skeleton = wrapper.find('[data-testid="chart-skeleton"]')
      expect(skeleton.exists()).toBe(true)
    })

    it('loading=true일 때 차트 컨테이너를 숨긴다', () => {
      const wrapper = mount(PriceTrendChart, {
        props: { stats: [], loading: true },
      })
      const container = wrapper.find('[data-testid="chart-container"]')
      expect(container.exists()).toBe(false)
    })

    it('loading=false일 때 스켈레톤을 숨긴다', () => {
      const wrapper = mount(PriceTrendChart, {
        props: { stats: mockStats, loading: false },
      })
      const skeleton = wrapper.find('[data-testid="chart-skeleton"]')
      expect(skeleton.exists()).toBe(false)
    })
  })

  describe('빈 상태', () => {
    it('stats가 비어있으면 "데이터가 없습니다" 메시지를 표시한다', () => {
      const wrapper = mount(PriceTrendChart, {
        props: { stats: [], loading: false },
      })
      expect(wrapper.text()).toContain('데이터가 없습니다')
    })
  })
})
