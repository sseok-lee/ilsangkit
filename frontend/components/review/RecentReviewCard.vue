<template>
  <a
    :href="`/${review.facilityCategory}/${review.facilityId}`"
    class="group flex flex-col p-4 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
  >
    <!-- Category Badge + Facility Name -->
    <div class="flex items-center gap-2 mb-2">
      <span
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset"
        :class="categoryBadgeClass"
      >
        {{ categoryLabel }}
      </span>
      <span class="text-sm font-bold text-slate-900 dark:text-white truncate">{{ review.facilityName }}</span>
    </div>

    <!-- Review Content (2-line truncate) -->
    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-2 mb-3">
      {{ review.content }}
    </p>

    <!-- Footer: Nickname + Date -->
    <div class="flex items-center justify-between mt-auto">
      <span class="text-xs font-medium text-slate-500 dark:text-slate-400">{{ review.nickname }}</span>
      <span class="text-xs text-slate-400 dark:text-slate-500">{{ formatDate(review.createdAt) }}</span>
    </div>
  </a>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReviewWithFacility } from '~/types/review'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

const props = defineProps<{
  review: ReviewWithFacility
}>()

const categoryLabel = computed(() => {
  const meta = CATEGORY_META[props.review.facilityCategory as FacilityCategory]
  return meta?.shortLabel || props.review.facilityCategory
})

const categoryBadgeClass = computed(() => {
  const colorMap: Record<string, string> = {
    toilet: 'bg-purple-50 text-purple-700 ring-purple-700/10 dark:bg-purple-900/30 dark:text-purple-300 dark:ring-purple-400/20',
    wifi: 'bg-orange-50 text-orange-700 ring-orange-700/10 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-400/20',
    parking: 'bg-sky-50 text-sky-700 ring-sky-700/10 dark:bg-sky-900/30 dark:text-sky-300 dark:ring-sky-400/20',
    kiosk: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10 dark:bg-indigo-900/30 dark:text-indigo-300 dark:ring-indigo-400/20',
    hospital: 'bg-teal-50 text-teal-700 ring-teal-700/10 dark:bg-teal-900/30 dark:text-teal-300 dark:ring-teal-400/20',
    pharmacy: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10 dark:bg-emerald-900/30 dark:text-emerald-300 dark:ring-emerald-400/20',
    aed: 'bg-red-50 text-red-700 ring-red-700/10 dark:bg-red-900/30 dark:text-red-300 dark:ring-red-400/20',
    library: 'bg-amber-50 text-amber-700 ring-amber-700/10 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-400/20',
    clothes: 'bg-pink-50 text-pink-700 ring-pink-700/10 dark:bg-pink-900/30 dark:text-pink-300 dark:ring-pink-400/20',
    trash: 'bg-green-50 text-green-700 ring-green-700/10 dark:bg-green-900/30 dark:text-green-300 dark:ring-green-400/20',
  }
  return colorMap[props.review.facilityCategory] || 'bg-slate-50 text-slate-700 ring-slate-700/10'
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  const diffHour = Math.floor(diffMs / 3600000)
  const diffDay = Math.floor(diffMs / 86400000)

  if (diffMin < 1) return '방금 전'
  if (diffMin < 60) return `${diffMin}분 전`
  if (diffHour < 24) return `${diffHour}시간 전`
  if (diffDay < 7) return `${diffDay}일 전`

  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
</script>
