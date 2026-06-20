import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('$fetch', mockFetch)
vi.stubGlobal('useApiBase', () => 'http://localhost:8000')

import { useRealEstate } from '~/composables/useRealEstate'

const mockNearbyResponse = { success: true, data: { apt: [], villa: [], offitel: [] } }

describe('useRealEstate.getNearby', () => {
  beforeEach(() => {
    mockFetch.mockClear()
    mockFetch.mockResolvedValue(mockNearbyResponse)
  })

  it('mode=sale 호출: rentType 미포함', async () => {
    const { getNearby } = useRealEstate()
    await getNearby('1144012700', 'sale', { excludeBuildingName: '래미안' })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/real-estate/nearby')
    expect(url).toContain('bjdCode=1144012700')
    expect(url).toContain('mode=sale')
    expect(url).toContain('excludeBuildingName=%EB%9E%98%EB%AF%B8%EC%95%88')
    expect(url).not.toContain('rentType')
  })

  it('mode=rent + rentType=jeonse: rentType 포함', async () => {
    const { getNearby } = useRealEstate()
    await getNearby('1144012700', 'rent', { rentType: 'jeonse' })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('mode=rent')
    expect(url).toContain('rentType=jeonse')
  })

  it('mode=rent + rentType=all: rentType=all 포함', async () => {
    const { getNearby } = useRealEstate()
    await getNearby('1144012700', 'rent', { rentType: 'all' })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('rentType=all')
  })

  it('mode=sale + rentType 전달 시 rentType 제외', async () => {
    const { getNearby } = useRealEstate()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await getNearby('1144012700', 'sale', { rentType: 'jeonse' } as any)
    const [url] = mockFetch.mock.calls[0]
    expect(url).not.toContain('rentType')
  })

  it('limitPerType 전달', async () => {
    const { getNearby } = useRealEstate()
    await getNearby('1144012700', 'sale', { limitPerType: 8 })
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('limitPerType=8')
  })

  it('res.data를 반환', async () => {
    const { getNearby } = useRealEstate()
    const result = await getNearby('1144012700', 'sale')
    expect(result).toEqual({ apt: [], villa: [], offitel: [] })
  })

  it('URL에 /api/real-estate/nearby 경로 포함', async () => {
    const { getNearby } = useRealEstate()
    await getNearby('1144012700', 'sale')
    const [url] = mockFetch.mock.calls[0]
    expect(url).toContain('/api/real-estate/nearby')
  })
})

describe('useRealEstate.getBuildingInfo — 실패 구분', () => {
  beforeEach(() => { mockFetch.mockReset() })

  it('정상 응답이면 data 반환', async () => {
    mockFetch.mockResolvedValue({ success: true, data: { buildingName: '래미안', bjdCode: '1' } })
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '래미안')).resolves.toEqual({ buildingName: '래미안', bjdCode: '1' })
  })

  it('404(없는 건물)면 null 반환', async () => {
    mockFetch.mockRejectedValue({ statusCode: 404 })
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '없는건물')).resolves.toBeNull()
  })

  it('500(서버 장애)면 throw (일시 장애)', async () => {
    mockFetch.mockRejectedValue({ statusCode: 500 })
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '래미안')).rejects.toBeTruthy()
  })

  it('status 없는 에러(timeout/network)면 throw', async () => {
    mockFetch.mockRejectedValue(new Error('aborted'))
    const { getBuildingInfo } = useRealEstate()
    await expect(getBuildingInfo('apt-sale' as never, '1', '래미안')).rejects.toBeTruthy()
  })
})
