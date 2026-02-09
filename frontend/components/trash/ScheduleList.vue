<template>
  <div class="schedule-list space-y-3">
    <div
      v-for="schedule in schedules"
      :key="schedule.id"
      class="schedule-item bg-white rounded-xl p-4 shadow-sm"
    >
      <div class="flex items-start gap-3">
        <span class="text-2xl">{{ getWasteIcon(schedule.wasteType) }}</span>
        <div class="flex-1">
          <h4 class="font-medium text-gray-900">{{ schedule.wasteType }}</h4>
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
          <p v-if="schedule.timeRange" class="text-sm text-gray-500 mt-2">
            <span class="font-medium">배출 시간:</span> {{ schedule.timeRange }}
          </p>
          <p v-if="schedule.note" class="text-sm text-gray-500 mt-1">
            {{ schedule.note }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
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
  '일반쓰레기': '🗑️',
  '음식물쓰레기': '🥬',
  '재활용': '♻️',
  '비닐': '🛍️',
  '종이류': '📦',
  '유리': '🫙',
  '플라스틱': '🥤',
  '캔': '🥫',
  '대형폐기물': '🛋️',
}

function getWasteIcon(wasteType: string): string {
  // Find matching icon
  for (const [key, icon] of Object.entries(wasteIcons)) {
    if (wasteType.includes(key)) {
      return icon
    }
  }
  return '🗑️'
}

function getDayClass(day: string): string {
  const baseClass = 'bg-gray-100 text-gray-700'
  const todayClass = 'bg-primary-100 text-primary-700 ring-1 ring-primary-500'

  const today = new Date().getDay()
  const dayMap: Record<string, number> = {
    '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6,
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3, '목요일': 4, '금요일': 5, '토요일': 6
  }

  const dayNum = dayMap[day]
  return dayNum === today ? todayClass : baseClass
}
</script>
