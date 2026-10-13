import { describe, expect, it, vi, beforeEach } from 'vitest'
import { transformToRegionSchedules, useWasteSchedule } from '~/composables/useWasteSchedule'
import type { BackendScheduleData } from '~/composables/useWasteSchedule'

// 종로 13198 / 달서 10817 / 고창 13500 의 운영 API 실제 형태
// (RESEARCH/naver-decline-2026-09-08/recheck-waste.md 의 실측값).
function backendData(overrides: Partial<BackendScheduleData['items'][number]> = {}): BackendScheduleData {
  return {
    items: [
      {
        id: 10817,
        city: '대구광역시',
        district: '달서구',
        targetRegion: '본리동',
        emissionPlace: '문전배출',
        details: {
          managementZone: '달서구 2권역',
          livingWaste: { dayOfWeek: '월+수+금', beginTime: '20:00', endTime: '02:00', method: '빈칸' },
          foodWaste: { dayOfWeek: '월+수+금', beginTime: '20:00', endTime: '02:00', method: '빈칸' },
          recyclable: { dayOfWeek: '월+수+금', beginTime: '20:00', endTime: '02:00', method: '투명봉투 배출' },
          dataCreatedDate: '2025-10-31',
        },
        ...overrides,
      },
    ],
    total: 1,
    page: 1,
    totalPages: 1,
  }
}

describe('transformToRegionSchedules', () => {
  it("'+' 로 이어진 요일을 개별 요일로 분리한다", () => {
    const result = transformToRegionSchedules(backendData())

    expect(result.schedules[0].wasteTypes[0].dayOfWeek).toEqual(['월', '수', '금'])
  })

  it('배출 시간과 방법을 카드까지 전달한다', () => {
    const result = transformToRegionSchedules(backendData())
    const living = result.schedules[0].wasteTypes[0]

    expect(living.beginTime).toBe('20:00')
    expect(living.endTime).toBe('02:00')
    expect(living.method).toBe('빈칸')
  })

  it('관리구역과 자료 기준일을 보존한다', () => {
    const result = transformToRegionSchedules(backendData())

    expect(result.schedules[0].managementZone).toBe('달서구 2권역')
    expect(result.schedules[0].dataCreatedDate).toBe('2025-10-31')
  })

  it('원본 적용 동과 최종 수정일을 목록 카드까지 전달하고 targetRegion null을 임의 대체하지 않는다', () => {
    const result = transformToRegionSchedules(backendData({
      targetRegion: null,
      applicableAreas: [{ areaId: 101, name: '본리동', href: '/trash?areaId=101', scope: 'whole', conditionText: '' }],
      details: {
        lastModified: '2026-10-01T00:00:00.000Z',
      },
    }))

    expect(result.schedules[0]).toMatchObject({
      targetRegion: null,
      lastModified: '2026-10-01T00:00:00.000Z',
      applicableAreas: [{ areaId: 101, name: '본리동' }],
    })
  })
})

describe('useWasteSchedule().getSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards unresolved source filters as $fetch params instead of dropping them into a partial URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: backendData() })
    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = fetchMock

    const { getSchedules } = useWasteSchedule()

    await getSchedules({
      city: '서울특별시',
      district: '강남구',
      keyword: '역삼',
      coverage: 'unresolved',
      page: 2,
      limit: 20,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/waste-schedules'),
      expect.objectContaining({
        params: {
          city: '서울특별시',
          district: '강남구',
          keyword: '역삼',
          coverage: 'unresolved',
          page: 2,
          limit: 20,
        },
      })
    )
  })

  it('forwards areaId with an owned source AbortSignal', async () => {
    let forwardedSignal: AbortSignal | undefined
    const fetchMock = vi.fn(async (_url, options) => {
      forwardedSignal = options.signal
      return {
        success: true,
        data: {
          ...backendData(),
          selectedArea: { areaId: 101, name: '본리동', city: '대구광역시', district: '달서구' },
          generationId: 'g1',
        },
      }
    })
    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = fetchMock
    const signal = new AbortController().signal

    const { getSchedules } = useWasteSchedule()

    await getSchedules({ areaId: 101, page: 1, limit: 20 }, signal)

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/waste-schedules'),
      expect.objectContaining({
        params: { areaId: 101, page: 1, limit: 20 },
        signal: expect.any(AbortSignal),
      })
    )
    expect(forwardedSignal).toBeInstanceOf(AbortSignal)
    expect(forwardedSignal).not.toBe(signal)
  })

  it('aborts the owned source request when the caller cancels', async () => {
    const controller = new AbortController()
    let forwardedSignal: AbortSignal | undefined
    const fetchMock = vi.fn((_url, options) => {
      forwardedSignal = options.signal
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true })
      })
    })
    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = fetchMock

    const { getSchedules } = useWasteSchedule()
    const promise = getSchedules({ areaId: 101, page: 1, limit: 20 }, controller.signal)
    const reason = new Error('caller cancelled')

    controller.abort(reason)

    await expect(promise).rejects.toThrow('caller cancelled')
    expect(forwardedSignal?.aborted).toBe(true)
    expect(forwardedSignal?.reason).toBe(reason)
  })

  it('rejects unresolved source requests after the source timeout and aborts the owned request', async () => {
    vi.useFakeTimers()
    try {
      const controller = new AbortController()
      let forwardedSignal: AbortSignal | undefined
      let abortEvents = 0
      const fetchMock = vi.fn((_url, options) => {
        forwardedSignal = options.signal
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener('abort', () => {
            abortEvents += 1
            reject(options.signal.reason)
          }, { once: true })
        })
      })
      ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = fetchMock

      const { getSchedules } = useWasteSchedule()
      const promise = getSchedules({ page: 1, limit: 20 }, controller.signal)
      const assertion = expect(promise).rejects.toThrow('waste-schedules request timed out')

      await vi.advanceTimersByTimeAsync(8000)
      await assertion
      expect(forwardedSignal?.aborted).toBe(true)
      expect(forwardedSignal?.reason).toBeInstanceOf(Error)
      expect(abortEvents).toBe(1)
      controller.abort(new Error('late caller abort'))
      expect(abortEvents).toBe(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('rejects failed or malformed source envelopes instead of transforming them', async () => {
    const { getSchedules } = useWasteSchedule()

    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue({ success: false, data: backendData() })
    await expect(getSchedules({ page: 1, limit: 20 })).rejects.toThrow(/waste-schedules/)

    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue({ success: true, data: { total: 0, page: 1, totalPages: 1 } })
    await expect(getSchedules({ page: 1, limit: 20 })).rejects.toThrow(/items/)

    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue({ success: true, data: { ...backendData(), total: Number.NaN } })
    await expect(getSchedules({ page: 1, limit: 20 })).rejects.toThrow(/total/)
  })

  it('requires selectedArea and generationId for area-filtered source results', async () => {
    const { getSchedules } = useWasteSchedule()

    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue({ success: true, data: backendData() })
    await expect(getSchedules({ areaId: 101, page: 1, limit: 20 })).rejects.toThrow(/selectedArea/)

    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: { ...backendData(), selectedArea: { areaId: 101, name: '본리동', city: '대구광역시', district: '달서구' } },
    })
    await expect(getSchedules({ areaId: 101, page: 1, limit: 20 })).rejects.toThrow(/generationId/)

    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi.fn().mockResolvedValue({
      success: true,
      data: { ...backendData(), selectedArea: { areaId: 102, name: '본리동', city: '대구광역시', district: '달서구' }, generationId: 'g1' },
    })
    await expect(getSchedules({ areaId: 101, page: 1, limit: 20 })).rejects.toThrow(/selectedArea/)
  })


  it('normalizes old detail responses without applicableAreas to an empty array', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ success: true, data: { ...backendData().items[0], applicableAreas: undefined } })
    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = fetchMock

    const { getScheduleDetail } = useWasteSchedule()

    await expect(getScheduleDetail(10817)).resolves.toMatchObject({ applicableAreas: [] })
  })

  it('API 실패를 가짜 일정으로 덮지 않고 오류를 전파한다', async () => {
    // 운영 배포본(_nuxt/Bw_e19JL.js)의 catch 분기는 '서울특별시', '{구} 1동~3동',
    // 전화번호 '02-1234-5678' 과 임의 요일 2건을 실제 공공데이터처럼 반환했다.
    ;(globalThis as unknown as { $fetch: ReturnType<typeof vi.fn> }).$fetch = vi
      .fn()
      .mockRejectedValue(new Error('network'))

    const { getSchedules, error } = useWasteSchedule()

    await expect(getSchedules({ city: '대구광역시', district: '달서구', page: 2 })).rejects.toThrow('network')
    expect(error.value).toBeInstanceOf(Error)
  })
})
