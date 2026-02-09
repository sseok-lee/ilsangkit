import { ref, readonly } from 'vue'

interface WasteTypeInfo {
  dayOfWeek?: string
  beginTime?: string
  endTime?: string
  method?: string
}

interface BulkWasteInfo {
  beginTime?: string
  endTime?: string
  method?: string
  place?: string
}

export type WasteType = '일반쓰레기' | '음식물쓰레기' | '재활용' | '대형폐기물'

export interface WasteTypeBadge {
  type: WasteType
  dayOfWeek: string[]
}

export interface RegionSchedule {
  id: number
  targetRegion: string
  emissionPlace?: string
  emissionPlaceType?: string
  uncollectedDay?: string
  wasteTypes: WasteTypeBadge[]
}

interface ContactInfo {
  name: string
  phone?: string
}

interface RegionScheduleResponse {
  schedules: RegionSchedule[]
  contact?: ContactInfo
}

// Backend response types
interface BackendScheduleItem {
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

interface BackendScheduleData {
  items: BackendScheduleItem[]
  total: number
  page: number
  totalPages: number
}

function parseDayOfWeek(dayStr?: string): string[] {
  if (!dayStr) return []
  return dayStr.split(/[,\s]+/).filter(Boolean)
}

function transformToRegionSchedules(data: BackendScheduleData): RegionScheduleResponse {
  const schedules: RegionSchedule[] = data.items.map((item) => {
    const details = item.details
    const wasteTypes: WasteTypeBadge[] = []

    if (details?.livingWaste) {
      wasteTypes.push({ type: '일반쓰레기', dayOfWeek: parseDayOfWeek(details.livingWaste.dayOfWeek) })
    }
    if (details?.foodWaste) {
      wasteTypes.push({ type: '음식물쓰레기', dayOfWeek: parseDayOfWeek(details.foodWaste.dayOfWeek) })
    }
    if (details?.recyclable) {
      wasteTypes.push({ type: '재활용', dayOfWeek: parseDayOfWeek(details.recyclable.dayOfWeek) })
    }
    if (details?.bulkWaste) {
      wasteTypes.push({ type: '대형폐기물', dayOfWeek: [] })
    }

    return {
      id: item.id,
      targetRegion: item.targetRegion || '지역 미상',
      emissionPlace: item.emissionPlace || undefined,
      emissionPlaceType: details?.emissionPlaceType || undefined,
      uncollectedDay: details?.uncollectedDay || undefined,
      wasteTypes,
    }
  })

  const contactItem = data.items.find(item => item.details?.manageDepartment)
  const contact: ContactInfo | undefined = contactItem?.details?.manageDepartment
    ? { name: contactItem.details.manageDepartment, phone: contactItem.details.managePhone }
    : undefined

  return { schedules, contact }
}

export function useWasteSchedule() {
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase || 'http://localhost:8000'

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

  async function getSchedules(city: string, district: string, keyword?: string): Promise<RegionScheduleResponse> {
    isLoading.value = true
    error.value = null

    try {
      let url = `${apiBase}/api/waste-schedules?city=${encodeURIComponent(city)}&district=${encodeURIComponent(district)}`
      if (keyword) {
        url += `&keyword=${encodeURIComponent(keyword)}`
      }
      const response = await $fetch<{ success: boolean; data: BackendScheduleData }>(url)
      return transformToRegionSchedules(response.data)
    } catch (e) {
      console.error('Failed to fetch schedules:', e)
      error.value = e as Error
      return getMockSchedules(district)
    } finally {
      isLoading.value = false
    }
  }

  async function getScheduleDetail(id: number): Promise<BackendScheduleItem | null> {
    try {
      const response = await $fetch<{ success: boolean; data: BackendScheduleItem }>(
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
    '강원도',
    '충청북도',
    '충청남도',
    '전라북도',
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

function getMockSchedules(district: string): RegionScheduleResponse {
  return {
    schedules: [
      {
        id: 1,
        targetRegion: `${district} 1동~3동`,
        emissionPlace: '각 세대 앞',
        emissionPlaceType: '문전수거',
        uncollectedDay: '명절(설 및 추석)',
        wasteTypes: [
          { type: '일반쓰레기', dayOfWeek: ['월', '수', '금'] },
          { type: '음식물쓰레기', dayOfWeek: ['화', '목', '토'] },
          { type: '재활용', dayOfWeek: ['수', '토'] },
          { type: '대형폐기물', dayOfWeek: [] },
        ],
      },
      {
        id: 2,
        targetRegion: `${district} 4동~6동`,
        emissionPlace: '거점 수거',
        emissionPlaceType: '거점수거',
        wasteTypes: [
          { type: '일반쓰레기', dayOfWeek: ['월', '수', '금'] },
          { type: '재활용', dayOfWeek: ['화', '목'] },
        ],
      },
    ],
    contact: {
      name: `${district} 청소행정과`,
      phone: '02-1234-5678',
    },
  }
}
