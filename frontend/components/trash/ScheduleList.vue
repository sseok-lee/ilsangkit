<template>
  <div class="schedule-list space-y-3">
    <div
      v-for="schedule in schedules"
      :key="schedule.id"
      class="schedule-item bg-white rounded-xl p-4 shadow-sm"
    >
      <div class="flex items-start gap-3">
        <span class="material-symbols-outlined text-[28px] text-primary">{{ getWasteIcon(schedule.wasteType) }}</span>
        <div class="flex-1">
          <h4 class="font-medium text-slate-900">{{ schedule.wasteType }}</h4>
          <div class="mt-2 flex flex-wrap gap-1">
            <span
              v-for="day in schedule.dayOfWeek"
              :key="day"
              class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
              :class="getDayClass(day)"
            >
              {{ day }}
            </span>
          </div>
          <p v-if="schedule.timeRange" class="text-sm text-slate-500 mt-2">
            <span class="font-medium">배출 시간:</span> {{ schedule.timeRange }}
          </p>
          <p v-if="schedule.note" class="text-sm text-slate-500 mt-1">
            {{ schedule.note }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface WasteSchedule {
  id: string
  wasteType: string
  dayOfWeek: string[]
  timeRange?: string
  note?: string
  sourceItemId?: number
}

defineProps<{
  schedules: WasteSchedule[]
}>()

const wasteIcons: Record<string, string> = {
  '일반쓰레기': 'delete',
  '음식물쓰레기': 'restaurant',
  '재활용': 'recycling',
  '비닐': 'shopping_bag',
  '종이류': 'description',
  '유리': 'liquor',
  '플라스틱': 'local_drink',
  '캔': 'kitchen',
  '대형폐기물': 'chair',
}

function getWasteIcon(wasteType: string): string {
  for (const [key, icon] of Object.entries(wasteIcons)) {
    if (wasteType.includes(key)) {
      return icon
    }
  }
  return 'delete'
}

const clientToday = ref<number | null>(null)
onMounted(() => {
  clientToday.value = new Date().getDay()
})

function getDayClass(day: string): string {
  const baseClass = 'bg-slate-100 text-slate-700'
  const todayClass = 'bg-primary-100 text-primary-700 ring-1 ring-primary-500'

  if (clientToday.value === null) return baseClass

  const dayMap: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
  }

  const dayNum = dayMap[day]
  return dayNum === clientToday.value ? todayClass : baseClass
}
</script>
