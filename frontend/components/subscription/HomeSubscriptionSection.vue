<template>
  <section v-if="hasAny" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">calendar_month</span>
          청약·임대 일정
        </h2>
        <p class="text-sm text-slate-500 mt-1">지금 신청 가능한 공고와 예정된 일정을 확인하세요.</p>
      </div>
      <NuxtLink to="/subscription" class="text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 보기 →
      </NuxtLink>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <NuxtLink
        v-for="item in ongoing"
        :key="`ongoing-${item.id}`"
        :to="`/subscription/${item.id}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-green-300 transition-shadow"
      >
        <StatusBadge variant="green" class="self-start">접수중</StatusBadge>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.houseName }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ formatMeta(item, 'ongoing') }}</p>
      </NuxtLink>
      <NuxtLink
        v-for="item in upcoming"
        :key="`upcoming-${item.id}`"
        :to="`/subscription/${item.id}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-blue-300 transition-shadow"
      >
        <StatusBadge variant="blue" class="self-start">접수예정</StatusBadge>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.houseName }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ formatMeta(item, 'upcoming') }}</p>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import StatusBadge from '~/components/common/StatusBadge.vue'
import type { HomeSubscriptionItem } from '~/composables/useHomeSubscriptions'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'

const { ongoing, upcoming, hasAny } = useHomeSubscriptions()

function formatMeta(item: HomeSubscriptionItem, mode: 'ongoing' | 'upcoming'): string {
  const parts: string[] = []
  if (item.regionName) parts.push(item.regionName)

  const dday = computeDday(
    mode === 'ongoing' ? item.receptionEndDate : item.receptionStartDate,
    mode === 'ongoing' ? '마감' : '시작'
  )
  if (dday) parts.push(dday)

  if (item.totalSupplyCount != null) parts.push(`${item.totalSupplyCount.toLocaleString('ko-KR')}호`)
  return parts.join(' · ')
}

function computeDday(isoDate: string | null, label: '마감' | '시작'): string | null {
  if (!isoDate) return null
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  target.setHours(0, 0, 0, 0)
  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000)
  if (diffDays < 0) return null
  if (diffDays === 0) return `${label} 오늘`
  return `${label} D-${diffDays}`
}
</script>
