<template>
  <div
    class="flex items-center gap-4 p-4 rounded-xl border border-[#e7ecf4] dark:border-gray-700 bg-white dark:bg-[#1a2634] shadow-sm hover:shadow-md transition-shadow"
  >
    <div
      :class="[
        'size-12 rounded-full flex items-center justify-center',
        colorClasses.bg,
        colorClasses.text,
      ]"
    >
      <span v-if="materialIcon" class="material-symbols-outlined">{{ materialIcon }}</span>
      <span v-else class="text-lg">{{ icon }}</span>
    </div>
    <div>
      <p class="text-xs font-semibold text-[#48699d] dark:text-gray-400 uppercase tracking-wide">
        {{ label }}
      </p>
      <p class="text-xl font-bold text-[#0d131c] dark:text-white">
        {{ value }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  icon: string
  label: string
  value: string
  color?: string
  materialIcon?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: 'gray',
  materialIcon: undefined,
})

const colorClasses = computed(() => {
  const colorMap: Record<string, { bg: string; text: string }> = {
    pink: { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-500' },
    blue: { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-500' },
    purple: { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-500' },
    orange: { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-500' },
    green: { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-500' },
    red: { bg: 'bg-red-50 dark:bg-red-900/20', text: 'text-red-500' },
    teal: { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-600' },
    indigo: { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-500' },
    gray: { bg: 'bg-gray-50 dark:bg-gray-900/20', text: 'text-gray-500' },
  }
  return colorMap[props.color] || colorMap.gray
})
</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
