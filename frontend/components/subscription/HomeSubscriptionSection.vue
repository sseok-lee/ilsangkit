<template>
  <section v-if="hasAny" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 청약중 -->
      <div v-if="ongoing.length > 0">
        <div class="flex items-center gap-2 mb-3 text-[15px] font-bold text-slate-900">
          <StatusBadge variant="green">청약중</StatusBadge>
          <span>지금 신청 가능</span>
        </div>
        <NuxtLink
          v-for="item in ongoing"
          :key="item.id"
          :to="`/subscription/${item.id}`"
          class="block mb-2 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md transition-shadow"
        >
          <StatusBadge variant="green">접수중</StatusBadge>
          <strong class="block mt-1.5 mb-1 text-[15px] text-slate-900">{{ item.houseName }}</strong>
          <p class="m-0 text-xs text-slate-500">{{ formatMeta(item, 'ongoing') }}</p>
        </NuxtLink>
      </div>

      <!-- 청약예정 -->
      <div v-if="upcoming.length > 0">
        <div class="flex items-center gap-2 mb-3 text-[15px] font-bold text-slate-900">
          <StatusBadge variant="blue">청약예정</StatusBadge>
          <span>곧 시작</span>
        </div>
        <NuxtLink
          v-for="item in upcoming"
          :key="item.id"
          :to="`/subscription/${item.id}`"
          class="block mb-2 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md transition-shadow"
        >
          <StatusBadge variant="blue">접수예정</StatusBadge>
          <strong class="block mt-1.5 mb-1 text-[15px] text-slate-900">{{ item.houseName }}</strong>
          <p class="m-0 text-xs text-slate-500">{{ formatMeta(item, 'upcoming') }}</p>
        </NuxtLink>
      </div>
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
