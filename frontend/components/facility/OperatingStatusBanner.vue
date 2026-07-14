<template>
  <div
    v-if="statusInfo"
    :class="[
      'flex items-center gap-3 px-4 py-3 rounded-lg text-sm',
      statusInfo.unknown ? neutralClasses : (statusInfo.isOpen ? openClasses : closedClasses),
    ]"
  >
    <span class="relative flex h-2.5 w-2.5 shrink-0">
      <span
        v-if="statusInfo.isOpen"
        class="absolute inline-flex h-full w-full rounded-full animate-pulse bg-green-400"
      ></span>
      <span
        class="relative inline-flex rounded-full h-2.5 w-2.5"
        :class="statusInfo.unknown ? 'bg-slate-400' : (statusInfo.isOpen ? 'bg-green-500' : 'bg-red-400')"
      ></span>
    </span>
    <div class="flex flex-wrap items-center gap-x-2 gap-y-0.5">
      <span class="font-bold">{{ statusInfo.unknown ? '운영시간 정보 없음' : (statusInfo.isOpen ? '운영중' : '운영종료') }}</span>
      <span
        v-if="!statusInfo.unknown && statusInfo.description"
        class="text-xs opacity-75"
      >{{ statusInfo.description }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import type {
  FacilityCategory,
  HospitalDetails,
  PharmacyDetails,
  AedDetails,
  LibraryDetails,
  FacilityDetailsAll,
} from '~/types/facility'

interface Props {
  category: FacilityCategory
  details: FacilityDetailsAll
}

const props = defineProps<Props>()

interface StatusInfo {
  isOpen: boolean
  description: string
  unknown?: boolean
}

function parseTime(val?: string | null): { hour: number; minute: number } | null {
  if (!val) return null
  const s = String(val).replace(':', '').trim()
  if (s.length < 3) return null
  const padded = s.padStart(4, '0')
  const hour = parseInt(padded.slice(0, 2), 10)
  const minute = parseInt(padded.slice(2, 4), 10)
  if (isNaN(hour) || isNaN(minute)) return null
  return { hour, minute }
}

function formatHM(h: number, m: number): string {
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function checkTimeRange(
  startStr?: string | null,
  endStr?: string | null,
  now?: { hour: number; minute: number },
): StatusInfo | null {
  const start = parseTime(startStr)
  const end = parseTime(endStr)
  if (!start || !end || !now) return null

  const nowMin = now.hour * 60 + now.minute
  const startMin = start.hour * 60 + start.minute
  const endMin = end.hour * 60 + end.minute

  if (nowMin >= startMin && nowMin < endMin) {
    return { isOpen: true, description: `오늘 ${formatHM(end.hour, end.minute)}까지` }
  } else if (nowMin < startMin) {
    return { isOpen: false, description: `오늘 ${formatHM(start.hour, start.minute)}부터` }
  } else {
    return { isOpen: false, description: `내일부터 이용 가능` }
  }
}

// Defer time computation to client to prevent SSR/client hydration mismatch
const clientNow = ref<Date | null>(null)
onMounted(() => {
  clientNow.value = new Date()
})

const statusInfo = computed<StatusInfo | null>(() => {
  const d = props.details
  if (!d) return null

  // Return null during SSR to avoid hydration mismatch
  if (!clientNow.value) return null

  const now = clientNow.value
  const dayOfWeek = now.getDay() // 0=Sun, 1=Mon, ...
  const currentTime = { hour: now.getHours(), minute: now.getMinutes() }

  const noOpCategories: FacilityCategory[] = ['wifi', 'clothes', 'trash']
  if (noOpCategories.includes(props.category)) return null

  switch (props.category) {
    case 'hospital': {
      const h = d as HospitalDetails
      const dayMap: Record<number, { start?: string | null; end?: string | null }> = {
        1: { start: h.trmtMonStart, end: h.trmtMonEnd },
        2: { start: h.trmtTueStart, end: h.trmtTueEnd },
        3: { start: h.trmtWedStart, end: h.trmtWedEnd },
        4: { start: h.trmtThuStart, end: h.trmtThuEnd },
        5: { start: h.trmtFriStart, end: h.trmtFriEnd },
        6: { start: h.trmtSatStart, end: h.trmtSatEnd },
        0: { start: h.trmtSunStart, end: h.trmtSunEnd },
      }
      const hasAnyHours = Object.values(dayMap).some((v) => !!v.start)
      if (!hasAnyHours) return { isOpen: false, unknown: true, description: '운영시간 정보 없음' }
      const today = dayMap[dayOfWeek]
      if (!today?.start) return { isOpen: false, description: '오늘 휴진' }
      return checkTimeRange(today.start, today.end, currentTime)
    }

    case 'pharmacy': {
      const p = d as PharmacyDetails
      const dayMap: Record<number, { start?: string | null; end?: string | null }> = {
        1: { start: p.dutyTime1s, end: p.dutyTime1c },
        2: { start: p.dutyTime2s, end: p.dutyTime2c },
        3: { start: p.dutyTime3s, end: p.dutyTime3c },
        4: { start: p.dutyTime4s, end: p.dutyTime4c },
        5: { start: p.dutyTime5s, end: p.dutyTime5c },
        6: { start: p.dutyTime6s, end: p.dutyTime6c },
        0: { start: p.dutyTime7s, end: p.dutyTime7c },
      }
      const hasAnyHours = Object.values(dayMap).some((v) => !!v.start)
      if (!hasAnyHours) return { isOpen: false, unknown: true, description: '운영시간 정보 없음' }
      const today = dayMap[dayOfWeek]
      if (!today?.start) return { isOpen: false, description: '오늘 휴무' }
      return checkTimeRange(today.start, today.end, currentTime)
    }

    case 'aed': {
      const a = d as AedDetails
      const dayMap: Record<number, { start?: string | null; end?: string | null }> = {
        1: { start: a.monSttTme, end: a.monEndTme },
        2: { start: a.tueSttTme, end: a.tueEndTme },
        3: { start: a.wedSttTme, end: a.wedEndTme },
        4: { start: a.thuSttTme, end: a.thuEndTme },
        5: { start: a.friSttTme, end: a.friEndTme },
        6: { start: a.satSttTme, end: a.satEndTme },
        0: { start: a.sunSttTme, end: a.sunEndTme },
      }
      const hasAnyHours = Object.values(dayMap).some((v) => !!v.start)
      if (!hasAnyHours) return { isOpen: false, unknown: true, description: '운영시간 정보 없음' }
      const today = dayMap[dayOfWeek]
      if (!today?.start) return { isOpen: false, description: '오늘 이용 불가' }
      return checkTimeRange(today.start, today.end, currentTime)
    }

    case 'library': {
      const l = d as LibraryDetails
      if (dayOfWeek === 0) {
        return checkTimeRange(l.holidayOpenTime, l.holidayCloseTime, currentTime)
          ?? { isOpen: false, description: '오늘 휴관' }
      }
      if (dayOfWeek === 6) {
        return checkTimeRange(l.saturdayOpenTime, l.saturdayCloseTime, currentTime)
          ?? checkTimeRange(l.weekdayOpenTime, l.weekdayCloseTime, currentTime)
          ?? { isOpen: false, description: '오늘 휴관' }
      }
      return checkTimeRange(l.weekdayOpenTime, l.weekdayCloseTime, currentTime)
        ?? { isOpen: false, description: '운영시간 정보 없음' }
    }

    case 'parking':
    case 'toilet': {
      const t = d as FacilityDetailsAll
      if (!t.operatingHours) return null
      const lower = String(t.operatingHours).toLowerCase()
      if (lower.includes('24시간') || lower.includes('상시')) {
        return { isOpen: true, description: '24시간 운영' }
      }
      return { isOpen: true, description: String(t.operatingHours) }
    }

    default:
      return null
  }
})

const openClasses = 'bg-green-50 text-green-800 border border-green-200'
const closedClasses = 'bg-red-50 text-red-800 border border-red-200'
const neutralClasses = 'bg-slate-50 text-slate-600 border border-slate-200'
</script>
