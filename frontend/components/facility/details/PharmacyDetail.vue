<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.phone"
      label="전화번호"
      :value="details.phone"
      type="phone"
    />
    <DetailRow
      v-if="details.dutyTel3"
      label="응급전화"
      :value="details.dutyTel3"
      type="phone"
    />
    <DetailRow
      v-if="details.pharmacistCnt != null && details.pharmacistCnt > 0"
      label="약사 수"
      :value="`${details.pharmacistCnt}명`"
    />

    <div v-if="details.dutyInf" class="pt-3 border-t border-slate-200">
      <p class="text-xs font-medium text-slate-500 mb-1">비고</p>
      <p class="text-sm text-slate-700">{{ details.dutyInf }}</p>
    </div>

    <div v-if="operatingHours.length > 0" class="pt-3 border-t border-slate-200">
      <p class="text-xs font-medium text-slate-500 mb-2">운영시간</p>
      <div class="space-y-1">
        <div
          v-for="item in operatingHours"
          :key="item.day"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-slate-600 w-16">{{ item.day }}</span>
          <span class="text-slate-700">{{ item.time }}</span>
        </div>
        <div v-if="details.lunchWeek" class="flex items-center justify-between text-sm">
          <span class="text-slate-600 w-16">점심(평일)</span>
          <span class="text-slate-700">{{ details.lunchWeek }}</span>
        </div>
        <div v-if="details.lunchSat" class="flex items-center justify-between text-sm">
          <span class="text-slate-600 w-16">점심(토)</span>
          <span class="text-slate-700">{{ details.lunchSat }}</span>
        </div>
      </div>
      <div v-if="details.recpWeek" class="mt-2 text-xs text-slate-500">
        <span class="font-medium">접수(평일):</span> {{ details.recpWeek }}
      </div>
      <div v-if="details.recpSat" class="mt-1 text-xs text-slate-500">
        <span class="font-medium">접수(토):</span> {{ details.recpSat }}
      </div>
      <div v-if="details.noTrmtSun" class="mt-2 text-xs text-slate-500">
        <span class="font-medium">일요일 안내:</span> {{ details.noTrmtSun }}
      </div>
      <div v-if="details.noTrmtHoli" class="mt-1 text-xs text-slate-500">
        <span class="font-medium">공휴일 안내:</span> {{ details.noTrmtHoli }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PharmacyDetails } from '~/types/facility'

const props = defineProps<{
  details: PharmacyDetails
}>()

function formatTime(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const s = String(start).padStart(4, '0')
  const e = String(end).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)} ~ ${e.slice(0, 2)}:${e.slice(2)}`
}

const operatingHours = computed(() => {
  const days = [
    { day: '월요일', start: props.details.dutyTime1s, end: props.details.dutyTime1c },
    { day: '화요일', start: props.details.dutyTime2s, end: props.details.dutyTime2c },
    { day: '수요일', start: props.details.dutyTime3s, end: props.details.dutyTime3c },
    { day: '목요일', start: props.details.dutyTime4s, end: props.details.dutyTime4c },
    { day: '금요일', start: props.details.dutyTime5s, end: props.details.dutyTime5c },
    { day: '토요일', start: props.details.dutyTime6s, end: props.details.dutyTime6c },
    { day: '일요일', start: props.details.dutyTime7s, end: props.details.dutyTime7c },
    { day: '공휴일', start: props.details.dutyTime8s, end: props.details.dutyTime8c },
  ]

  return days
    .map(({ day, start, end }) => ({ day, time: formatTime(start, end) }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})
</script>
