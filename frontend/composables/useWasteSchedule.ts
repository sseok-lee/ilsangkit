import { ref, readonly } from 'vue'

export interface WasteTypeInfo {
  dayOfWeek?: string
  beginTime?: string
  endTime?: string
  method?: string
}

export interface BulkWasteInfo {
  beginTime?: string
  endTime?: string
  method?: string
  place?: string
}

export type WasteType = '일반쓰레기' | '음식물쓰레기' | '재활용' | '대형폐기물'

export interface WasteTypeBadge {
  type: WasteType
  dayOfWeek: string[]
  beginTime?: string
  endTime?: string
  method?: string
}

export interface RegionSchedule {
  id: number
  city: string
  district: string
  targetRegion: string
  emissionPlace?: string
  emissionPlaceType?: string
  managementZone?: string
  uncollectedDay?: string
  /** 원본 공공데이터의 자료 기준일. DB syncedAt(동기화 시각)과 다르다. */
  dataCreatedDate?: string
  wasteTypes: WasteTypeBadge[]
}

interface ContactInfo {
  name: string
  phone?: string
}

export interface RegionScheduleResponse {
  schedules: RegionSchedule[]
  contact?: ContactInfo
  total: number
  page: number
  totalPages: number
}

// Backend response types
export interface WasteScheduleDetail {
  id: number
  city: string
  district: string
  targetRegion: string | null
  emissionPlace: string | null
  details: {
    emissionPlaceType?: string
    managementZone?: string
    livingWaste?: WasteTypeInfo
    foodWaste?: WasteTypeInfo
    recyclable?: WasteTypeInfo
    bulkWaste?: BulkWasteInfo
    uncollectedDay?: string
    manageDepartment?: string
    managePhone?: string
    dataCreatedDate?: string
    lastModified?: string
  } | null
}

export interface BackendScheduleData {
  items: WasteScheduleDetail[]
  total: number
  page: number
  totalPages: number
}

// 원본은 요일을 '월+수+금' 처럼 '+' 로 잇는다. '+' 를 나누지 않으면
// 배열 원소 하나('월+수+금')가 그대로 남아 카드가 요일을 렌더할 수 없다.
function parseDayOfWeek(dayStr?: string): string[] {
  if (!dayStr) return []
  return dayStr.split(/[+,\s]+/).filter(Boolean)
}

function toBadge(type: WasteType, info: WasteTypeInfo): WasteTypeBadge {
  return {
    type,
    dayOfWeek: parseDayOfWeek(info.dayOfWeek),
    beginTime: info.beginTime || undefined,
    endTime: info.endTime || undefined,
    method: info.method || undefined,
  }
}

export function transformToRegionSchedules(data: BackendScheduleData): RegionScheduleResponse {
  const schedules: RegionSchedule[] = data.items.map((item) => {
    const details = item.details
    const wasteTypes: WasteTypeBadge[] = []

    if (details?.livingWaste) wasteTypes.push(toBadge('일반쓰레기', details.livingWaste))
    if (details?.foodWaste) wasteTypes.push(toBadge('음식물쓰레기', details.foodWaste))
    if (details?.recyclable) wasteTypes.push(toBadge('재활용', details.recyclable))
    if (details?.bulkWaste) {
      wasteTypes.push({
        type: '대형폐기물',
        dayOfWeek: [],
        beginTime: details.bulkWaste.beginTime || undefined,
        endTime: details.bulkWaste.endTime || undefined,
        method: details.bulkWaste.method || undefined,
      })
    }

    return {
      id: item.id,
      city: item.city,
      district: item.district,
      targetRegion: item.targetRegion || '지역 미상',
      emissionPlace: item.emissionPlace || undefined,
      emissionPlaceType: details?.emissionPlaceType || undefined,
      managementZone: details?.managementZone || undefined,
      uncollectedDay: details?.uncollectedDay || undefined,
      dataCreatedDate: details?.dataCreatedDate || undefined,
      wasteTypes,
    }
  })

  const contactItem = data.items.find(item => item.details?.manageDepartment)
  const contact: ContactInfo | undefined = contactItem?.details?.manageDepartment
    ? { name: contactItem.details.manageDepartment, phone: contactItem.details.managePhone }
    : undefined

  return { schedules, contact, total: data.total, page: data.page, totalPages: data.totalPages }
}

export function useWasteSchedule() {
  const apiBase = useApiBase()

  const isLoading = ref(false)
  const error = ref<Error | null>(null)

  async function getCities(): Promise<string[]> {
    try {
      const response = await $fetch<{ success: boolean; data: { items: string[] } }>(
        `${apiBase}/api/waste-schedules/cities`
      )
      return response.data.items
    } catch (e) {
      console.error('Failed to fetch cities:', e)
      return getMockCities()
    }
  }

  async function getDistricts(city: string): Promise<string[]> {
    try {
      const response = await $fetch<{ success: boolean; data: { items: string[] } }>(
        `${apiBase}/api/waste-schedules/districts/${encodeURIComponent(city)}`
      )
      return response.data.items
    } catch (e) {
      console.error('Failed to fetch districts:', e)
      return getMockDistricts(city)
    }
  }

  async function getSchedules(options?: {
    city?: string
    district?: string
    keyword?: string
    page?: number
    limit?: number
  }): Promise<RegionScheduleResponse> {
    isLoading.value = true
    error.value = null

    try {
      const params = new URLSearchParams()
      if (options?.city) params.set('city', options.city)
      if (options?.district) params.set('district', options.district)
      if (options?.keyword) params.set('keyword', options.keyword)
      if (options?.page) params.set('page', String(options.page))
      if (options?.limit) params.set('limit', String(options.limit))
      const url = `${apiBase}/api/waste-schedules?${params.toString()}`
      const response = await $fetch<{ success: boolean; data: BackendScheduleData }>(url)
      return transformToRegionSchedules(response.data)
    } catch (e) {
      // 예전 구현은 여기서 '서울특별시', '{구} 1동~3동', '02-1234-5678' 과 임의 요일
      // 2건을 만들어 실제 공공데이터처럼 반환했다(운영 배포본에서 재현됨).
      // 조회 실패는 데이터가 아니다 — 호출부가 오류로 다루도록 그대로 올린다.
      console.error('Failed to fetch schedules:', e)
      error.value = e as Error
      throw e
    } finally {
      isLoading.value = false
    }
  }

  async function getScheduleDetail(id: number): Promise<WasteScheduleDetail | null> {
    try {
      const response = await $fetch<{ success: boolean; data: WasteScheduleDetail }>(
        `${apiBase}/api/waste-schedules/${id}`
      )
      return response.data
    } catch (e) {
      console.error('Failed to fetch schedule detail:', e)
      return null
    }
  }

  return {
    isLoading: readonly(isLoading),
    error: readonly(error),
    getCities,
    getDistricts,
    getSchedules,
    getScheduleDetail,
  }
}

// Mock data for development
function getMockCities(): string[] {
  return [
    '서울특별시',
    '부산광역시',
    '대구광역시',
    '인천광역시',
    '광주광역시',
    '대전광역시',
    '울산광역시',
    '세종특별자치시',
    '경기도',
    '강원특별자치도',
    '충청북도',
    '충청남도',
    '전북특별자치도',
    '전라남도',
    '경상북도',
    '경상남도',
    '제주특별자치도'
  ]
}

function getMockDistricts(city: string): string[] {
  const districtMap: Record<string, string[]> = {
    '서울특별시': [
      '강남구', '강동구', '강북구', '강서구', '관악구', '광진구', '구로구', '금천구',
      '노원구', '도봉구', '동대문구', '동작구', '마포구', '서대문구', '서초구', '성동구',
      '성북구', '송파구', '양천구', '영등포구', '용산구', '은평구', '종로구', '중구', '중랑구'
    ],
    '부산광역시': [
      '강서구', '금정구', '기장군', '남구', '동구', '동래구', '부산진구', '북구',
      '사상구', '사하구', '서구', '수영구', '연제구', '영도구', '중구', '해운대구'
    ],
    '경기도': [
      '수원시', '성남시', '고양시', '용인시', '부천시', '안산시', '안양시', '남양주시',
      '화성시', '평택시', '의정부시', '시흥시', '파주시', '광명시', '김포시', '군포시'
    ]
  }

  return districtMap[city] || ['중구', '동구', '서구', '남구', '북구']
}
