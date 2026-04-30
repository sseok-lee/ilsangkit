import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { ref, defineComponent, h, Suspense } from 'vue'
import NearbyTransit from '~/components/realEstate/NearbyTransit.vue'

function mockUseAsyncDataWith(data: any, status = 'success') {
  const result = {
    data: ref(data),
    status: ref(status),
    error: ref(null),
    refresh: vi.fn(),
  }
  ;(globalThis as any).useAsyncData = vi.fn(() => Object.assign(Promise.resolve(result), result))
}

async function mountSuspended(props: { lat: number; lng: number }) {
  const wrapper = mount(
    defineComponent({
      render() {
        return h(Suspense, null, { default: () => h(NearbyTransit, props) })
      },
    }),
  )
  await flushPromises()
  return wrapper
}

describe('NearbyTransit', () => {
  const defaultProps = { lat: 37.4979, lng: 127.0276 }

  const mockTransitResponse = {
    success: true,
    data: {
      stations: [
        { id: '1', name: '강남역', line: '2호선', distance: 234, address: '서울 강남구 역삼동' },
        { id: '2', name: '신논현역', line: '9호선', distance: 850, address: '서울 강남구 논현동' },
      ],
    },
  }

  beforeEach(() => {
    mockUseAsyncDataWith(mockTransitResponse)
  })

  it('lat/lng props를 받아 마운트되는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.exists()).toBe(true)
  })

  it('useAsyncData를 올바른 key로 호출하는지 확인', async () => {
    await mountSuspended(defaultProps)
    expect((globalThis as any).useAsyncData).toHaveBeenCalledWith(
      `nearby-transit-${defaultProps.lat}-${defaultProps.lng}`,
      expect.any(Function),
    )
  })

  it('로딩 중에 스피너를 표시하는지 확인', async () => {
    mockUseAsyncDataWith(null, 'pending')
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(true)
  })

  it('지하철역 목록을 표시하는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.text()).toContain('강남역')
    expect(wrapper.text()).toContain('신논현역')
    expect(wrapper.text()).toContain('2호선')
    expect(wrapper.text()).toContain('9호선')
  })

  it('거리 정보를 표시하는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.text()).toMatch(/234\s*m/)
  })

  it('역이 없을 때 빈 상태 메시지를 표시하는지 확인', async () => {
    mockUseAsyncDataWith({ success: true, data: { stations: [] } })
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.text()).toContain('주변에 지하철역이 없습니다')
  })

  it('로딩 완료 후 스피너가 사라지는지 확인', async () => {
    const wrapper = await mountSuspended(defaultProps)
    expect(wrapper.find('[data-testid="loading"]').exists()).toBe(false)
  })
})
