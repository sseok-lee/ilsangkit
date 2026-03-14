<template>
  <section class="bg-white rounded-xl p-4 shadow-sm border border-slate-100">
    <div class="flex items-center gap-3 mb-3">
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center"
        :class="iconBgClass"
      >
        <span class="material-symbols-outlined text-[20px]" :class="iconTextClass">{{ icon }}</span>
      </div>
      <h3 class="font-bold text-slate-900">{{ title }}</h3>
    </div>
    <div class="text-sm text-slate-600 space-y-2 pl-1">
      <div v-if="info.dayOfWeek" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">calendar_month</span>
        <p>
          <span class="font-medium text-slate-700">배출 요일:</span>
          <span class="ml-1">{{ info.dayOfWeek }}</span>
        </p>
      </div>
      <ClientOnly>
        <div v-if="nextCollectionText" class="flex items-start gap-2">
          <span class="material-symbols-outlined text-[18px] shrink-0 mt-0.5" :class="iconTextClass">event_upcoming</span>
          <p>
            <span class="font-medium" :class="iconTextClass">다음 배출일:</span>
            <span class="ml-1 font-medium text-slate-800">{{ nextCollectionText }}</span>
          </p>
        </div>
      </ClientOnly>
      <div v-if="timeRange" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">schedule</span>
        <p>
          <span class="font-medium text-slate-700">배출 시간:</span>
          <span class="ml-1">{{ timeRange }}</span>
        </p>
      </div>
      <div v-if="info.method" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-500 shrink-0 mt-0.5">info</span>
        <p>
          <span class="font-medium text-slate-700">배출 방법:</span>
          <span class="ml-1">{{ info.method }}</span>
        </p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface WasteTypeInfo {
  dayOfWeek?: string
  beginTime?: string
  endTime?: string
  method?: string
}

const props = defineProps<{
  icon: string
  iconColor: 'amber' | 'green' | 'teal' | 'purple'
  title: string
  info: WasteTypeInfo
}>()

const colorMap = {
  amber: { bg: 'bg-amber-100', text: 'text-amber-600' },
  green: { bg: 'bg-green-100', text: 'text-green-600' },
  teal: { bg: 'bg-teal-100', text: 'text-teal-600' },
  purple: { bg: 'bg-purple-100', text: 'text-purple-600' },
}

const iconBgClass = computed(() => colorMap[props.iconColor].bg)
const iconTextClass = computed(() => colorMap[props.iconColor].text)

const timeRange = computed(() => {
  if (!props.info.beginTime && !props.info.endTime) return null
  if (props.info.beginTime && props.info.endTime) return `${props.info.beginTime} ~ ${props.info.endTime}`
  return props.info.beginTime || props.info.endTime
})

// 다음 배출일 계산 (dayOfWeek: "월, 수, 금" 등에서 파싱)
const DAY_MAP: Record<string, number> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 }

const nextCollectionText = computed(() => {
  if (!props.info.dayOfWeek) return null
  const days = props.info.dayOfWeek
    .split(/[,\s·]+/)
    .map((d) => d.trim())
    .filter((d) => d in DAY_MAP)
    .map((d) => DAY_MAP[d])
  if (days.length === 0) return null

  const now = new Date()
  const today = now.getDay()
  // 오늘 포함, 가장 가까운 배출 요일 찾기
  let minDiff = 7
  for (const day of days) {
    const diff = (day - today + 7) % 7
    if (diff < minDiff) minDiff = diff
  }
  const next = new Date(now)
  next.setDate(next.getDate() + minDiff)
  const month = next.getMonth() + 1
  const date = next.getDate()
  const dayNames = ['일', '월', '화', '수', '목', '금', '토']
  const label = minDiff === 0 ? '오늘' : minDiff === 1 ? '내일' : `${minDiff}일 후`
  return `${month}/${date}(${dayNames[next.getDay()]}) — ${label}`
})
</script>
