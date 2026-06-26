import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fetchTransitNearby } from '~/composables/useTransitNearby'

describe('fetchTransitNearby', () => {
  beforeEach(() => { (globalThis.$fetch as any) = vi.fn() })

  it('정상 응답에서 stations 배열을 반환', async () => {
    (globalThis.$fetch as any).mockResolvedValue({
      success: true,
      data: { stations: [{ id: '1', name: '천호(풍납토성)', nameSlug: 'cheonho', line: '5호선', distance: 96, type: 'subway' }] },
    })
    const out = await fetchTransitNearby('http://x', 37.5391, 127.1244, 2000)
    expect(out).toHaveLength(1)
    expect(out[0].name).toBe('천호(풍납토성)')
    expect((globalThis.$fetch as any)).toHaveBeenCalledWith(
      'http://x/api/transit/nearby',
      { query: { lat: 37.5391, lng: 127.1244, radius: 2000 } },
    )
  })

  it('실패 시 빈 배열', async () => {
    (globalThis.$fetch as any).mockRejectedValue(new Error('boom'))
    expect(await fetchTransitNearby('http://x', 37.5, 127)).toEqual([])
  })
})
