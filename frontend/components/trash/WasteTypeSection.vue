<template>
  <section class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
    <div class="flex items-center gap-3 mb-3">
      <div
        class="w-10 h-10 rounded-full flex items-center justify-center"
        :class="iconBgClass"
      >
        <span class="material-symbols-outlined text-[20px]" :class="iconTextClass">{{ icon }}</span>
      </div>
      <h3 class="font-bold text-slate-900 dark:text-white">{{ title }}</h3>
    </div>
    <div class="text-sm text-slate-600 dark:text-slate-300 space-y-2 pl-1">
      <div v-if="info.dayOfWeek" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">calendar_month</span>
        <p>
          <span class="font-medium text-slate-700 dark:text-slate-200">배출 요일:</span>
          <span class="ml-1">{{ info.dayOfWeek }}</span>
        </p>
      </div>
      <div v-if="timeRange" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">schedule</span>
        <p>
          <span class="font-medium text-slate-700 dark:text-slate-200">배출 시간:</span>
          <span class="ml-1">{{ timeRange }}</span>
        </p>
      </div>
      <div v-if="info.method" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">info</span>
        <p>
          <span class="font-medium text-slate-700 dark:text-slate-200">배출 방법:</span>
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
  amber: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-600 dark:text-amber-400' },
  green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400' },
  teal: { bg: 'bg-teal-100 dark:bg-teal-900/30', text: 'text-teal-600 dark:text-teal-400' },
  purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400' },
}

const iconBgClass = computed(() => colorMap[props.iconColor].bg)
const iconTextClass = computed(() => colorMap[props.iconColor].text)

const timeRange = computed(() => {
  if (!props.info.beginTime && !props.info.endTime) return null
  if (props.info.beginTime && props.info.endTime) return `${props.info.beginTime} ~ ${props.info.endTime}`
  return props.info.beginTime || props.info.endTime
})
</script>
