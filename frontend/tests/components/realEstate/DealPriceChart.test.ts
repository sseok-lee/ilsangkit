import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DealPriceChart from '~/components/realEstate/DealPriceChart.vue'
import type { DealPoint } from '~/types/housingRedesign'

const canvasContext = {
  clearRect: vi.fn(),
  scale: vi.fn(),
  beginPath: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  stroke: vi.fn(),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  setTransform: vi.fn(),
}

const points: DealPoint[] = [
  { id: 1, date: '2026-09-12', amount: 84500, area: '84.90', floor: 0, deposit: 0 },
  { id: 2, date: '2026-09-12', amount: 84500, area: '84.90', floor: null, deposit: 0 },
  { id: 3, date: '2026-08-20', amount: 120, area: '84.90', floor: 10, deposit: 5000 },
]

beforeEach(() => {
  resizeObserverInstances = []
  vi.stubGlobal('ResizeObserver', class {
    observe = vi.fn()
    disconnect = vi.fn()
    constructor() {
      resizeObserverInstances.push(this)
    }
  })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
  vi.stubGlobal('cancelAnimationFrame', vi.fn())
  Object.values(canvasContext).forEach(mock => {
    if (typeof mock === 'function' && 'mockClear' in mock) mock.mockClear()
  })
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: () => canvasContext,
  })
})

let resizeObserverInstances: Array<{ observe: ReturnType<typeof vi.fn>; disconnect: ReturnType<typeof vi.fn> }> = []

describe('DealPriceChart', () => {
  it('월 중앙값을 선택하면 같은 월의 거래를 모두 보여주고 날짜 선택으로 돌아간다', async () => {
    const wrapper = mount(DealPriceChart, {
      props: {
        points: [
          { ...points[0], date: '2026-08-03', amount: 30000 },
          { ...points[1], date: '2026-08-20', amount: 50000 },
          { ...points[2], date: '2026-10-03', amount: 60000 },
        ],
        window: { from: '2026-08-01', to: '2026-10-31' }, mode: 'sale', loading: false,
      },
    })
    expect(wrapper.text()).toContain('월별 중앙값')
    await wrapper.get('select[name="deal-month"]').setValue('2026-08')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('4억')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(2)
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-date"]').element.value).toBe('')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')[0].text()).toContain('2026.08.20')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')[1].text()).toContain('2026.08.03')
    await wrapper.get('select[name="deal-month"]').setValue('2026-09')
    expect(wrapper.text()).toContain('이 달에는 거래가 없습니다')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(0)
    await wrapper.get('select[name="deal-date"]').setValue('2026-08-03')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(1)
    expect(wrapper.find('[data-testid="monthly-price-summary"]').exists()).toBe(false)
  })

  it('같은 points로 날짜 선택과 겹친 거래 목록을 제공한다', async () => {
    const wrapper = mount(DealPriceChart, {
      props: {
        points,
        window: { from: '2026-08-01', to: '2026-09-30' },
        mode: 'wolse',
        loading: false,
        error: null,
      },
    })

    const dateSelect = wrapper.find('select[name="deal-date"]')
    expect(dateSelect.exists()).toBe(true)
    await dateSelect.setValue('2026-09-12')

    expect(wrapper.text()).toContain('2026.09.12')
    expect(wrapper.text()).toContain('2건')
    expect(wrapper.text()).toContain('0층')
    expect(wrapper.text()).toContain('층 정보 없음')
    expect(wrapper.text()).toContain('보증금 0만원')
  })

  it('가격 축과 날짜 축을 Canvas 밖 HTML/SVG로 제공한다', () => {
    const wrapper = mount(DealPriceChart, {
      props: {
        points,
        window: { from: '2026-08-01', to: '2026-09-30' },
        mode: 'wolse',
        loading: false,
        error: null,
      },
    })

    expect(wrapper.find('[data-testid="price-axis"]').text()).toContain('만원')
    expect(wrapper.find('[data-testid="date-axis"]').text()).toContain('26.08')
    expect(wrapper.find('[data-testid="date-axis"]').text()).toContain('26.09')
    expect(canvasContext.fillText).not.toHaveBeenCalled()
  })

  it('loading 이후 차트가 나타나도 ResizeObserver를 연결하고 해제한다', async () => {
    const wrapper = mount(DealPriceChart, {
      props: {
        points,
        window: { from: '2026-08-01', to: '2026-09-30' },
        mode: 'wolse',
        loading: true,
        error: null,
      },
    })

    expect(resizeObserverInstances).toHaveLength(0)
    await wrapper.setProps({ loading: false })
    await nextTick()
    expect(resizeObserverInstances).toHaveLength(1)
    expect(resizeObserverInstances[0].observe).toHaveBeenCalled()
    wrapper.unmount()
    expect(resizeObserverInstances[0].disconnect).toHaveBeenCalled()
  })

  it('긴 날짜별 거래 목록은 20개씩 펼친다', async () => {
    const many = Array.from({ length: 21 }, (_, index) => ({
      id: index + 1,
      date: '2026-09-12',
      amount: 80000 + index,
      area: '84.90',
      floor: index,
      deposit: null,
    }))
    const wrapper = mount(DealPriceChart, {
      props: {
        points: many,
        window: { from: '2026-09-01', to: '2026-09-30' },
        mode: 'sale',
        loading: false,
        error: null,
      },
    })

    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(20)
    await wrapper.get('button[data-testid="show-more-deals"]').trigger('click')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(21)
  })

  it('loading, empty, error 상태를 별도 영역으로 표시하고 retry를 emit한다', async () => {
    const loading = mount(DealPriceChart, {
      props: { points: [], window: { from: '2026-09-01', to: '2026-09-30' }, mode: 'sale', loading: true },
    })
    expect(loading.find('[data-testid="deal-chart-loading"]').exists()).toBe(true)

    const empty = mount(DealPriceChart, {
      props: { points: [], window: { from: '2026-09-01', to: '2026-09-30' }, mode: 'sale', loading: false },
    })
    expect(empty.text()).toContain('거래 데이터가 없습니다')

    const error = mount(DealPriceChart, {
      props: { points: [], window: { from: '2026-09-01', to: '2026-09-30' }, mode: 'sale', loading: false, error: new Error('fail') },
    })
    await error.get('button').trigger('click')
    expect(error.emitted('retry')).toHaveLength(1)
  })
})
