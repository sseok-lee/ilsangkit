import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'
import { useRisingRegions } from '~/composables/useRisingRegions'

const payload = {
  scope: 'all',
  window: { from: '2026-08-31', to: '2026-09-29' },
  prevWindow: { from: '2026-08-01', to: '2026-08-30' },
  computedAt: null,
  items: [{ label: '서울 성동구', citySlug: 'seoul', districtSlug: 'seongdong-gu', ppMedian: 5280, volRecent: 60, volPrev: 40, changePct: 34 }],
}

// SSR 순서 재현: setup 시점엔 data=null, 핸들러가 setup 이후에 resolve 된다.
function installSsrLikeAsyncData() {
  const data = ref<unknown>(null)
  const error = ref<unknown>(null)
  let resolveLater: () => Promise<void> = async () => undefined
  ;(globalThis as any).useAsyncData = vi.fn((_key: string, handler: () => Promise<unknown>) => {
    resolveLater = async () => {
      try {
        data.value = await handler()
      } catch (e) {
        error.value = e
      }
    }
    return { data, error, pending: ref(false), status: ref('idle'), refresh: vi.fn() }
  })
  return { resolve: () => resolveLater() }
}

describe('useRisingRegions', () => {
  beforeEach(() => {
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: payload })
  })

  it('핸들러가 setup 이후 resolve 돼도 data 가 반영된다 (SSR 순서)', async () => {
    const ssr = installSsrLikeAsyncData()
    const { data } = useRisingRegions()
    expect(data.value).toBeNull()
    await ssr.resolve()
    expect(data.value?.items).toHaveLength(1)
    expect((globalThis as any).useAsyncData.mock.calls[0][0]).toBe('home-rising:all')
  })

  it('SSR 핸들러 실패는 error 로 드러난다', async () => {
    ;(globalThis as any).$fetch = vi.fn().mockRejectedValue(new Error('boom'))
    const ssr = installSsrLikeAsyncData()
    const { data, error } = useRisingRegions()
    await ssr.resolve()
    expect(data.value).toBeNull()
    expect(error.value).toBeTruthy()
  })

  it('탭 전환은 클라이언트 $fetch 로 조회하고 캐시한다', async () => {
    const ssr = installSsrLikeAsyncData()
    const { data, scope, setScope } = useRisingRegions()
    await ssr.resolve()
    ;(globalThis as any).$fetch = vi.fn().mockResolvedValue({ success: true, data: { ...payload, scope: 'capital' } })
    await setScope('capital')
    expect(scope.value).toBe('capital')
    expect(data.value?.scope).toBe('capital')
    await setScope('all')
    expect(data.value?.scope).toBe('all')
    await setScope('capital')
    expect((globalThis as any).$fetch).toHaveBeenCalledTimes(1)
  })
})
