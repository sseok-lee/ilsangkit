<template>
  <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-display-2 text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">calendar_month</span>
          청약 한눈에
        </h2>
        <p class="text-sm text-slate-500 mt-1">지금 신청 가능한 공고와 예정된 일정을 확인하세요.</p>
      </div>
      <HardLink to="/subscription" class="inline-flex items-center min-h-[44px] text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 보기 →
      </HardLink>
    </div>

    <template v-if="hasAny">
      <!-- 요약 한 줄 -->
      <div class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-green-500" aria-hidden="true"></span>
          접수중 <strong>{{ ongoingTotal }}건</strong>
        </span>
        <span class="flex items-center gap-1.5">
          <span class="inline-block w-2 h-2 rounded-full bg-primary-500" aria-hidden="true"></span>
          예정 <strong>{{ upcomingTotal }}건</strong>
        </span>
      </div>

      <!-- 타임라인 2그룹 -->
      <div class="grid sm:grid-cols-2 gap-x-8 gap-y-4">
        <div v-if="ongoing.length > 0">
          <h3 class="text-sm font-bold text-slate-700 mb-1.5">🔴 접수 중</h3>
          <ul>
            <li
              v-for="(item, idx) in ongoing"
              :key="`ongoing-${item.id}`"
              :class="['border-b border-slate-100', idx === 4 ? 'hidden sm:block' : '']"
            >
              <HardLink :to="`/subscription/${item.id}`" class="flex items-center gap-2 py-2 -mx-1 px-1 rounded hover:bg-slate-50">
                <span
                  v-if="dayBadge(item.receptionEndDate)"
                  class="shrink-0 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 min-w-[34px] text-center"
                >{{ dayBadge(item.receptionEndDate) }}</span>
                <span :class="['shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded', badge(item).classes]">{{ badge(item).label }}</span>
                <span class="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{{ item.houseName }}</span>
                <span class="hidden sm:inline shrink-0 text-[11px] text-slate-400">{{ item.regionName }}</span>
              </HardLink>
            </li>
          </ul>
        </div>

        <div v-if="upcoming.length > 0">
          <h3 class="text-sm font-bold text-slate-700 mb-1.5">🔵 접수 예정</h3>
          <ul>
            <li
              v-for="(item, idx) in upcoming"
              :key="`upcoming-${item.id}`"
              :class="['border-b border-slate-100', idx === 4 ? 'hidden sm:block' : '']"
            >
              <HardLink :to="`/subscription/${item.id}`" class="flex items-center gap-2 py-2 -mx-1 px-1 rounded hover:bg-slate-50">
                <span
                  v-if="dayBadge(item.receptionStartDate)"
                  class="shrink-0 text-[11px] font-extrabold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700 min-w-[34px] text-center"
                >{{ dayBadge(item.receptionStartDate) }}</span>
                <span :class="['shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded', badge(item).classes]">{{ badge(item).label }}</span>
                <span class="flex-1 min-w-0 text-sm font-bold text-slate-900 truncate">{{ item.houseName }}</span>
                <span class="hidden sm:inline shrink-0 text-[11px] text-slate-400">{{ item.regionName }}</span>
              </HardLink>
            </li>
          </ul>
        </div>
      </div>
    </template>

    <!-- 빈 상태 -->
    <div v-else class="bg-white border border-line rounded-2xl px-6 py-8 text-center">
      <span class="material-symbols-outlined text-slate-300 text-[32px]" aria-hidden="true">event_upcoming</span>
      <p class="text-sm text-slate-500 mt-2">현재 접수 중이거나 예정된 청약 공고가 없어요.</p>
      <HardLink to="/subscription" class="inline-flex items-center mt-3 text-sm text-primary font-bold hover:underline">
        지난 공고 보기 →
      </HardLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'
import type { HomeSubscriptionItem } from '~/composables/useHomeSubscriptions'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'
import { subscriptionTypeBadge } from '~/utils/subscriptionMeta'

const { ongoing, upcoming, hasAny, ongoingTotal, upcomingTotal } = useHomeSubscriptions()

// SSR/CSR 동일한 "오늘" 보장 (hydration mismatch 방지)
const todayIso = useState<string>('home-today-iso', () => new Date().toISOString().split('T')[0])

const MS_PER_DAY = 86_400_000

function diffDaysFromToday(isoDate: string | null): number | null {
  if (!isoDate) return null
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(`${todayIso.value}T00:00:00`)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

function dayBadge(isoDate: string | null): string | null {
  const d = diffDaysFromToday(isoDate)
  if (d === null || d < 0) return null
  return d === 0 ? 'D-Day' : `D-${d}`
}

function badge(item: HomeSubscriptionItem) {
  return subscriptionTypeBadge(item.sourceType, item.rentType)
}
</script>
