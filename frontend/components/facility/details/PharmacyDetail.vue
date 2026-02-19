<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.phone"
      label="전화번호"
      :value="details.phone"
    />
    <DetailRow
      v-if="details.dutyTel3"
      label="응급전화"
      :value="details.dutyTel3"
    />

    <div v-if="details.dutyInf" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-1">비고</p>
      <p class="text-sm text-gray-700">{{ details.dutyInf }}</p>
    </div>

    <div v-if="operatingHours.length > 0" class="pt-3 border-t border-gray-200">
      <p class="text-sm font-medium text-gray-600 mb-2">운영시간</p>
      <div class="space-y-1">
        <div
          v-for="item in operatingHours"
          :key="item.day"
          class="flex items-center justify-between text-sm"
        >
          <span class="text-gray-600 w-16">{{ item.day }}</span>
          <span class="text-gray-700">{{ item.time }}</span>
        </div>
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
