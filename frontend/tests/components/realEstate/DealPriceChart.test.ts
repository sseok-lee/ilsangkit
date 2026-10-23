import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import DealPriceChart from '~/components/realEstate/DealPriceChart.vue'
import type { DealPoint } from '~/types/housingRedesign'
import { projectDealPoints } from '~/utils/realEstateDealPlot'

type PathCommand = ['M' | 'L', number, number]
const averagePaths: PathCommand[][] = []
let currentPath: PathCommand[] = []

const canvasContext = {
  clearRect: vi.fn(),
  scale: vi.fn(),
  strokeStyle: '',
  lineWidth: 0,
  beginPath: vi.fn(() => { currentPath = [] }),
  moveTo: vi.fn((x: number, y: number) => { currentPath.push(['M', x, y]) }),
  lineTo: vi.fn((x: number, y: number) => { currentPath.push(['L', x, y]) }),
  stroke: vi.fn(() => {
    if (canvasContext.strokeStyle === '#2450DC' && canvasContext.lineWidth === 2.5) {
      averagePaths.push([...currentPath])
    }
  }),
  arc: vi.fn(),
  fill: vi.fn(),
  fillText: vi.fn(),
  setTransform: vi.fn(),
}

const points: DealPoint[] = [
  { id: 1, date: '2026-09-12', amount: 84500, area: '84.90', floor: 0, deposit: 0, flag: 'normal' },
  { id: 2, date: '2026-09-12', amount: 84500, area: '84.90', floor: null, deposit: 0, flag: 'normal' },
  { id: 3, date: '2026-08-20', amount: 120, area: '84.90', floor: 10, deposit: 5000, flag: 'normal' },
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

let restoreRect: (() => void) | undefined

beforeEach(() => {
  averagePaths.length = 0
  currentPath = []
  const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')
    .mockReturnValue(new DOMRect(0, 0, 400, 288))
  restoreRect = () => rectSpy.mockRestore()
})

afterEach(() => {
  restoreRect?.()
})

const flowPoints: DealPoint[] = [
  { ...points[0], id: 11, date: '2026-08-01', amount: 10000 },
  { ...points[0], id: 12, date: '2026-08-01', amount: 10000 },
  { ...points[0], id: 13, date: '2026-08-20', amount: 40000 },
  { ...points[0], id: 14, date: '2026-09-15', amount: 30000 },
  { ...points[0], id: 15, date: '2026-11-15', amount: 50000 },
]
const flowWindow = { from: '2026-08-01', to: '2026-11-30' }

async function mountFlow(data = flowPoints) {
  const wrapper = mount(DealPriceChart, {
    props: { points: data, window: flowWindow, mode: 'sale', loading: false },
  })
  await nextTick()
  await nextTick()
  return wrapper
}


describe('DealPriceChart', () => {
  it.each(['sale', 'jeonse', 'wolse'] as const)('%s에서 기존 월 표시만 평균으로 바꾼다', async mode => {
    const wrapper = mount(DealPriceChart, {
      props: {
        points: [100, 101, 101].map((amount, index) => ({
          ...points[0], id: index + 1, date: `2026-08-0${index + 1}`, amount,
        })),
        window: { from: '2026-08-01', to: '2026-08-31' }, mode, loading: false,
      },
    })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('')
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-date"]').element.value).toBe('2026-08-03')
    await wrapper.get('select[name="deal-month"]').setValue('2026-08')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('101만원')
    expect(wrapper.text()).toContain('월별 평균')
    expect(wrapper.text()).not.toContain('중앙값')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(3)
    wrapper.unmount()
  })

  it('점 없이 거래가 있는 월평균을 빈 달 너머로 연결한다', async () => {
    const wrapper = await mountFlow()
    const path = averagePaths.at(-1)!
    expect(path.map(command => command[0])).toEqual(['M', 'L', 'L'])
    expect(canvasContext.arc).not.toHaveBeenCalled()
    expect(canvasContext.fill).not.toHaveBeenCalled()
    await wrapper.get('select[name="deal-month"]').setValue('2026-08')
    await nextTick()
    expect(canvasContext.arc).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('여러 빈 달을 건너 연결해도 빈 달의 평균과 거래를 만들지 않는다', async () => {
    const wrapper = await mountFlow([flowPoints[0], flowPoints[4]])
    expect(averagePaths.at(-1)!.map(command => command[0])).toEqual(['M', 'L'])
    await wrapper.get('select[name="deal-month"]').setValue('2026-09')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('이 달에는 거래가 없습니다')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(0)
    await wrapper.get('select[name="deal-month"]').setValue('2026-10')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('이 달에는 거래가 없습니다')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(0)
    expect(canvasContext.arc).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('단독 거래월에 점이나 임의의 선분을 만들지 않는다', async () => {
    const wrapper = await mountFlow([flowPoints[4]])
    expect(averagePaths.at(-1)!.map(command => command[0])).toEqual(['M'])
    expect(canvasContext.arc).not.toHaveBeenCalled()
    const [month] = averagePaths.at(-1)!
    await wrapper.get('canvas').trigger('click', { clientX: month[1], clientY: month[2] })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('')
    await wrapper.get('select[name="deal-month"]').setValue('2026-11')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('5억')
    wrapper.unmount()
  })

  it('빈 달을 잇는 선분에서는 가까운 거래월을 선택하고 선 밖 거래점은 무시한다', async () => {
    const wrapper = await mountFlow()
    const [aug, sep, nov] = averagePaths.at(-1)!
    const canvas = wrapper.get('canvas')
    await canvas.trigger('click', {
      clientX: aug[1] + (sep[1] - aug[1]) * 0.25,
      clientY: aug[2] + (sep[2] - aug[2]) * 0.25,
    })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('2026-08')
    expect(wrapper.findAll('[data-testid="deal-point-row"]')).toHaveLength(3)

    const oldPoint = projectDealPoints(flowPoints, flowWindow, 400, 288)[0]
    await canvas.trigger('click', { clientX: oldPoint.x, clientY: oldPoint.y })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('2026-08')
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-date"]').element.value).toBe('')

    await canvas.trigger('click', {
      clientX: sep[1] + (nov[1] - sep[1]) * 0.25,
      clientY: sep[2] + (nov[2] - sep[2]) * 0.25,
    })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('2026-09')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('3억')
    await canvas.trigger('click', {
      clientX: sep[1] + (nov[1] - sep[1]) * 0.75,
      clientY: sep[2] + (nov[2] - sep[2]) * 0.75,
    })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('2026-11')
    expect(wrapper.get('[data-testid="monthly-price-summary"]').text()).toContain('5억')
    await canvas.trigger('click', { clientX: nov[1], clientY: nov[2] })
    expect(wrapper.get<HTMLSelectElement>('select[name="deal-month"]').element.value).toBe('2026-11')
    wrapper.unmount()
  })

  it('월평균을 선택하면 같은 월의 거래를 모두 보여주고 날짜 선택으로 돌아간다', async () => {
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
    expect(wrapper.text()).toContain('월별 평균')
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
