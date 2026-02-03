<template>
  <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700">
    <div class="flex items-center gap-3 mb-3">
      <div class="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <span class="material-symbols-outlined text-amber-600 dark:text-amber-400 text-[20px]">delete</span>
      </div>
      <h3 class="font-bold text-slate-900 dark:text-white">{{ schedule.wasteType }}</h3>
    </div>
    <div class="text-sm text-slate-600 dark:text-slate-300 space-y-2 pl-1">
      <div class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">calendar_month</span>
        <p>
          <span class="font-medium text-slate-700 dark:text-slate-200">배출 요일:</span>
          <span class="ml-1">{{ formatDayOfWeek(schedule.dayOfWeek) }}</span>
        </p>
      </div>
      <div v-if="schedule.time" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">schedule</span>
        <p>
          <span class="font-medium text-slate-700 dark:text-slate-200">배출 시간:</span>
          <span class="ml-1">{{ schedule.time }}</span>
        </p>
      </div>
      <div v-if="schedule.note" class="flex items-start gap-2">
        <span class="material-symbols-outlined text-[18px] text-slate-400 shrink-0 mt-0.5">info</span>
        <p class="text-slate-500 dark:text-slate-400">{{ schedule.note }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface WasteSchedule {
  id: string
  wasteType: string
  dayOfWeek: string[]
  time?: string
  note?: string
}

defineProps<{
  schedule: WasteSchedule
}>()

const formatDayOfWeek = (days: string[]): string => {
  if (days.length === 1 && days[0] === '예약제') {
    return '예약제'
  }
  return days.join(', ')
}
</script>
