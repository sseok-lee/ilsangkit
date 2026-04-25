<template>
  <NuxtLink :to="`/subscription/rent/lh/announcement/${announcement.id}`" class="block">
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 p-4 hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
      <div class="flex items-start justify-between gap-3 mb-2">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-slate-900 text-sm md:text-base line-clamp-2">
            {{ announcement.panNm }}
          </h3>
          <p class="text-xs md:text-sm text-slate-500 mt-1">{{ announcement.cnpNm }}</p>
        </div>
        <span :class="statusBadgeClass">{{ statusLabel }}</span>
      </div>

      <div class="flex flex-wrap items-center gap-2 text-xs mb-3">
        <span :class="typeBadgeClass">{{ announcement.uppAisTpNm }}</span>
        <span v-if="announcement.aisTpNm" class="bg-slate-100 text-slate-700 px-2 py-1 rounded">
          {{ announcement.aisTpNm }}
        </span>
      </div>

      <div class="mt-auto space-y-1 text-xs text-slate-600">
        <p v-if="announcement.panDt">
          <span class="font-medium">공고일:</span> {{ formatDate(announcement.panDt) }}
        </p>
        <p v-if="announcement.clsgDt">
          <span class="font-medium">마감:</span> {{ formatDate(announcement.clsgDt) }}
          <span v-if="ddayLabel" :class="ddayClass">{{ ddayLabel }}</span>
        </p>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LhAnnouncement } from '~/types/lhAnnouncement'

const props = defineProps<{
  announcement: LhAnnouncement
}>()

const isRental = computed(() => props.announcement.uppAisTpNm.includes('임대'))

const typeBadgeClass = computed(() => {
  const base = 'px-2 py-1 rounded font-medium'
  if (isRental.value) return `${base} bg-amber-100 text-amber-700`
  return `${base} bg-blue-100 text-blue-700`
})

const statusLabel = computed(() => {
  if (props.announcement.panSs === '공고중') return '공고중'
  if (props.announcement.panSs === '마감') return '마감'
  return props.announcement.panSs ?? ''
})

const statusBadgeClass = computed(() => {
  const baseClass = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0'
  if (props.announcement.panSs === '공고중') {
    return `${baseClass} bg-green-100 text-green-700 ring-1 ring-inset ring-green-200`
  }
  return `${baseClass} bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200`
})

function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const y = date.getUTCFullYear()
  const m = String(date.getUTCMonth() + 1).padStart(2, '0')
  const d = String(date.getUTCDate()).padStart(2, '0')
  return `${y}.${m}.${d}`
}

const ddayLabel = computed(() => {
  if (!props.announcement.clsgDt) return null
  if (props.announcement.panSs === '마감') return null
  const close = new Date(props.announcement.clsgDt).getTime()
  if (Number.isNaN(close)) return null
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const diff = Math.ceil((close - today.getTime()) / 86_400_000)
  if (diff < 0) return null
  if (diff === 0) return 'D-day'
  return `D-${diff}`
})

const ddayClass = computed(() => {
  if (!ddayLabel.value) return ''
  return 'ml-1 text-rose-600 font-bold'
})
</script>
