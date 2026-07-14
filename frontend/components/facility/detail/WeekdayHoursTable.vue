<template>
  <div>
    <h3 class="text-sm font-bold text-slate-900 mb-3">{{ title }}</h3>
    <table class="w-full text-sm border-collapse">
      <thead>
        <tr class="bg-slate-50">
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium w-12">요일</th>
          <th class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">{{ timeHeader }}</th>
          <th v-if="showLunch" class="text-left py-1.5 px-2 text-xs text-gray-500 font-medium">점심</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-slate-100">
        <tr
          v-for="row in rows"
          :key="row.day"
          :class="row.isToday ? 'bg-primary-50 font-semibold' : ''"
        >
          <td class="py-1.5 px-2 text-xs font-medium" :class="row.isToday ? 'text-primary-700' : 'text-slate-600'">
            {{ row.day }}<span v-if="row.isToday" class="ml-1 inline-block rounded bg-primary-100 px-1 py-0.5 text-[10px] font-semibold text-primary-700 align-middle">오늘</span>
          </td>
          <td
            class="py-1.5 px-2 text-xs"
            :class="row.allDay ? 'text-green-600 font-medium' : row.closed ? 'text-gray-400' : 'text-slate-800'"
          >
            {{ row.time }}
          </td>
          <td v-if="showLunch" class="py-1.5 px-2 text-xs text-gray-500">{{ row.lunch }}</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup lang="ts">
export interface WeekdayHoursRow {
  day: string
  time: string
  isToday: boolean
  closed?: boolean
  allDay?: boolean
  lunch?: string
}

withDefaults(defineProps<{
  title: string
  timeHeader: string
  rows: WeekdayHoursRow[]
  showLunch?: boolean
}>(), {
  showLunch: false,
})
</script>
