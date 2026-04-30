<template>
  <div>
    <div v-if="loading" data-testid="loading" class="flex items-center justify-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-4 border-primary border-t-transparent"></div>
    </div>

    <div v-else-if="stations.length === 0" class="rounded-2xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
      주변에 지하철역이 없습니다
    </div>

    <div v-else class="flex flex-wrap items-center gap-x-4 gap-y-2">
      <span class="flex items-center gap-1 text-sm font-semibold text-slate-500 shrink-0">
        <span>🚇</span>
        <span>지하철</span>
      </span>
      <div
        v-for="station in stations"
        :key="station.id"
        class="flex items-center gap-1.5"
      >
        <span
          class="shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded-full text-white"
          :style="{ backgroundColor: lineColor(station.line) }"
        >
          {{ station.line }}
        </span>
        <span class="text-sm text-slate-700">{{ station.name }}</span>
        <span
          class="text-[11px] font-medium px-1.5 py-0.5 rounded-full"
          :class="distanceBadgeClass(station.distance)"
        >
          {{ station.distance }}m
        </span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Station {
  id: string
  name: string
  line: string
  distance: number
  address: string
}

interface Props {
  lat: number
  lng: number
}

const props = defineProps<Props>()

const LINE_COLORS: Record<string, string> = {
  '1호선': '#0052A4',
  '2호선': '#00A84D',
  '3호선': '#EF7C1C',
  '4호선': '#00A5DE',
  '5호선': '#996CAC',
  '6호선': '#CD7C2F',
  '7호선': '#747F00',
  '8호선': '#E6186C',
  '9호선': '#BDB092',
  '신분당선': '#D4003B',
  '경의중앙선': '#77C4A3',
  '공항철도': '#0090D2',
  '경춘선': '#0C8E72',
  '수인분당선': '#F5A200',
  'GTX-A': '#9E5D45',
}

const { data: transitResponse, status } = await useAsyncData(
  `nearby-transit-${props.lat}-${props.lng}`,
  () => {
    if (!props.lat || !props.lng) return Promise.resolve(null)
    return $fetch('/api/transit/nearby', {
      query: { lat: props.lat, lng: props.lng, radius: 1000 },
    })
  },
)

const loading = computed(() => status.value === 'pending')

const stations = computed<Station[]>(() => {
  return (transitResponse.value as any)?.data?.stations ?? []
})

function lineColor(line: string): string {
  return LINE_COLORS[line] ?? '#64748b'
}

function distanceBadgeClass(distance: number): string {
  if (distance <= 300) return 'bg-emerald-50 text-emerald-600'
  if (distance <= 700) return 'bg-blue-50 text-blue-500'
  return 'bg-slate-100 text-slate-500'
}
</script>
