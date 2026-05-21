import type { ApiResponse } from '~/types/facility'

export interface HospitalDepartmentItem {
  name: string
  count: number
}

/**
 * 병원 진료과목 목록 (보유 병원 수 내림차순). 1시간 백엔드 캐시.
 */
export function useHospitalDepartments() {
  const apiBase = useApiBase()
  return useAsyncData(
    'hospital-departments',
    async () => {
      const res = await $fetch<ApiResponse<HospitalDepartmentItem[]>>(
        `${apiBase}/api/meta/hospital-departments`,
      )
      return res.data ?? []
    },
  )
}
