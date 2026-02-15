<template>
  <div class="space-y-3">
    <DetailRow
      v-if="details.buildPlace"
      label="설치위치"
      :value="details.buildPlace"
    />
    <DetailRow
      v-if="details.org"
      label="설치기관"
      :value="details.org"
    />
    <DetailRow
      v-if="details.clerkTel"
      label="전화번호"
      :value="details.clerkTel"
    />
    <DetailRow
      v-if="details.mfg"
      label="제조사"
      :value="details.mfg"
    />
    <DetailRow
      v-if="details.model"
      label="모델명"
      :value="details.model"
    />

    <DetailRow
      v-if="details.dataDate"
      label="데이터 기준일"
      :value="details.dataDate"
    />

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
import type { AedDetails } from '~/types/facility'

const props = defineProps<{
  details: AedDetails
}>()

/**
 * 시간 문자열(0000~2400)을 "00:00~24:00" 형태로 포맷
 */
function formatTime(start?: string | null, end?: string | null): string | null {
  if (!start || !end) return null
  const s = start.padStart(4, '0')
  const e = end.padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}~${e.slice(0, 2)}:${e.slice(2)}`
}

const operatingHours = computed(() => {
  const days = [
    { day: '월요일', start: props.details.monSttTme, end: props.details.monEndTme },
    { day: '화요일', start: props.details.tueSttTme, end: props.details.tueEndTme },
    { day: '수요일', start: props.details.wedSttTme, end: props.details.wedEndTme },
    { day: '목요일', start: props.details.thuSttTme, end: props.details.thuEndTme },
    { day: '금요일', start: props.details.friSttTme, end: props.details.friEndTme },
    { day: '토요일', start: props.details.satSttTme, end: props.details.satEndTme },
    { day: '일요일', start: props.details.sunSttTme, end: props.details.sunEndTme },
    { day: '공휴일', start: props.details.holSttTme, end: props.details.holEndTme },
  ]

  return days
    .map(({ day, start, end }) => ({
      day,
      time: formatTime(start, end),
    }))
    .filter((item): item is { day: string; time: string } => item.time !== null)
})
</script>
