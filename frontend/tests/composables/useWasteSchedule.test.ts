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
})

describe('useWasteSchedule().getSchedules', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
