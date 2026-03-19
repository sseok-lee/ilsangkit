<template>
  <a
    :href="`/${review.facilityCategory}/${review.facilityId}`"
    class="group flex flex-col p-4 bg-white border border-slate-200 rounded-xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
  >
    <!-- Category Badge + Facility Name -->
    <div class="flex items-center gap-2 mb-2">
      <span
        class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ring-inset"
        :class="categoryBadgeClass"
      >
        {{ categoryLabel }}
      </span>
      <span class="text-sm font-bold text-slate-900 truncate">{{ review.facilityName }}</span>
    </div>

    <!-- Review Content (2-line truncate) -->
    <p class="text-sm text-slate-600 leading-relaxed line-clamp-2 mb-3">
      {{ review.content }}
    </p>

    <!-- Footer: Nickname + Date -->
    <div class="flex items-center justify-between mt-auto">
      <span class="text-xs font-medium text-slate-500">{{ review.nickname }}</span>
      <ClientOnly>
        <span class="text-xs text-slate-500">{{ formatDate(review.createdAt) }}</span>
        <template #fallback>
          <span class="text-xs text-slate-500">{{ formatDateStatic(review.createdAt) }}</span>
        </template>
      </ClientOnly>
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
    toilet: 'bg-purple-50 text-purple-700 ring-purple-700/10',
    wifi: 'bg-orange-50 text-orange-700 ring-orange-700/10',
    parking: 'bg-sky-50 text-sky-700 ring-sky-700/10',
    park: 'bg-green-50 text-green-700 ring-green-700/10',
    school: 'bg-indigo-50 text-indigo-700 ring-indigo-700/10',
    market: 'bg-orange-50 text-orange-700 ring-orange-700/10',
    hospital: 'bg-teal-50 text-teal-700 ring-teal-700/10',
    pharmacy: 'bg-emerald-50 text-emerald-700 ring-emerald-700/10',
    aed: 'bg-red-50 text-red-700 ring-red-700/10',
    library: 'bg-amber-50 text-amber-700 ring-amber-700/10',
    clothes: 'bg-pink-50 text-pink-700 ring-pink-700/10',
    trash: 'bg-green-50 text-green-700 ring-green-700/10',
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

function formatDateStatic(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
</script>
