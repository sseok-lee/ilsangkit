<template>
  <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">calendar_month</span>
          청약 한눈에
        </h2>
        <p class="text-sm text-slate-500 mt-1">지금 신청 가능한 공고와 예정된 일정을 확인하세요.</p>
      </div>
      <HardLink to="/subscription" class="inline-flex items-center min-h-[44px] text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 보기 →
      </HardLink>
    </div>

    <!-- 요약 1줄 박스 -->
    <div v-if="summary" class="flex flex-wrap items-center gap-x-4 gap-y-1.5 mb-4 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full bg-green-500" aria-hidden="true"></span>
        이번 주 마감 <strong>{{ summary.closingThisWeek }}건</strong>
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-2 h-2 rounded-full bg-blue-500" aria-hidden="true"></span>
        다음 주 예정 <strong>{{ summary.upcomingNextWeek }}건</strong>
      </span>
      <span v-if="summary.avgSupplyPrice !== null" class="flex items-center gap-1">
        평균 분양가 <strong>{{ formatPriceManwon(summary.avgSupplyPrice) }}</strong>
      </span>
    </div>

    <!-- D-3 임박 하이라이트 -->
    <div
      v-if="summary && summary.imminent.length > 0"
      role="region"
      aria-label="마감 임박 공고"
      class="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4 flex flex-wrap items-center gap-x-2 gap-y-1"
    >
      <span class="material-symbols-outlined text-red-500 text-[20px] shrink-0" aria-hidden="true">notifications_active</span>
      <strong class="text-red-700 text-sm shrink-0">마감 임박 (D-3 이내)</strong>
      <span class="text-slate-400 text-sm shrink-0">|</span>
      <span class="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <template v-for="(item, idx) in summary.imminent" :key="item.id">
          <span v-if="idx > 0" class="text-slate-300" aria-hidden="true">·</span>
          <HardLink
            :to="`/subscription/${item.id}`"
            class="text-red-700 font-medium hover:underline"
          >{{ item.houseName }}</HardLink>
          <span class="text-red-500 text-[11px] font-semibold">{{ ddayLabel(item.endDate) }}</span>
        </template>
      </span>
    </div>

    <!-- 카드 그리드 (접수중/예정 중 하나라도 있을 때만) -->
    <div v-if="hasAny" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <HardLink
        v-for="item in ongoing"
        :key="`ongoing-${item.id}`"
        :to="`/subscription/${item.id}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-green-300 transition-shadow"
      >
        <StatusBadge variant="green" class="self-start">접수중</StatusBadge>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.houseName }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ formatMeta(item, 'ongoing') }}</p>
      </HardLink>
      <HardLink
        v-for="item in upcoming"
        :key="`upcoming-${item.id}`"
        :to="`/subscription/${item.id}`"
        class="flex flex-col gap-1.5 p-3.5 bg-white border border-line rounded-xl shadow-card hover:shadow-md hover:border-blue-300 transition-shadow"
      >
        <StatusBadge variant="blue" class="self-start">접수예정</StatusBadge>
        <strong class="text-[14px] leading-snug text-slate-900 line-clamp-2">{{ item.houseName }}</strong>
        <p class="text-[11px] text-slate-400 mt-auto">{{ formatMeta(item, 'upcoming') }}</p>
      </HardLink>
    </div>

    <!-- 누락 메타 라인 (카드 그리드 있을 때만 의미 있음) -->
    <p v-if="summary && hasAny" class="text-[11px] text-slate-400 mt-3 text-right">
      접수중 {{ summary.closingThisWeek }}건 중 {{ ongoing.length }}건 · 예정 {{ summary.upcomingNextWeek }}건 중 {{ upcoming.length }}건 표시
      <HardLink to="/subscription" class="ml-2 hover:underline">전체 보기 →</HardLink>
    </p>

    <!-- 빈 상태: 카드도 없고 요약도 없는 경우 -->
    <div v-if="!hasAnyContent" class="bg-white border border-line rounded-2xl px-6 py-8 text-center">
      <span class="material-symbols-outlined text-slate-300 text-[32px]" aria-hidden="true">event_upcoming</span>
      <p class="text-sm text-slate-500 mt-2">현재 접수 중이거나 예정된 청약 공고가 없어요.</p>
      <HardLink to="/subscription" class="inline-flex items-center mt-3 text-sm text-primary font-bold hover:underline">
        지난 공고 보기 →
      </HardLink>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, toRefs } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import StatusBadge from '~/components/common/StatusBadge.vue'
import type { HomeSubscriptionItem } from '~/composables/useHomeSubscriptions'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'
import { formatPriceManwon } from '~/utils/priceFormat'

interface SubscriptionSummary {
  closingThisWeek: number
  upcomingNextWeek: number
  avgSupplyPrice: number | null
  imminent: Array<{ id: number; houseName: string; regionName: string; endDate: string }>
}

const props = defineProps<{ summary?: SubscriptionSummary | null }>()
const { summary } = toRefs(props)

const { ongoing, upcoming, hasAny } = useHomeSubscriptions()

// 카드 / 요약 카운트 / 임박 리스트 중 하나라도 있으면 섹션 표시.
// 셋 다 없으면 메인에서 청약 섹션 자체를 숨김.
const hasAnyContent = computed(() => {
  if (hasAny.value) return true
  const s = summary.value
  if (!s) return false
  return s.closingThisWeek > 0 || s.upcomingNextWeek > 0 || s.imminent.length > 0
})

// SSR/CSR 양쪽에서 동일한 "오늘" 값을 보장. `new Date()` 를 매 호출마다 부르면
// SSR/CSR 시점차로 D-day 가 다르게 계산돼 hydration mismatch 발생.
const todayIso = useState<string>('home-today-iso', () => new Date().toISOString().split('T')[0])

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

const MS_PER_DAY = 86_400_000

function diffDaysFromToday(isoDate: string | null): number | null {
  if (!isoDate) return null
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(`${todayIso.value}T00:00:00`)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

function computeDday(isoDate: string | null, label: '마감' | '시작'): string | null {
  const diffDays = diffDaysFromToday(isoDate)
  if (diffDays === null || diffDays < 0) return null
  if (diffDays === 0) return `${label} 오늘`
  return `${label} D-${diffDays}`
}

function ddayLabel(endDate: string): string {
  const diffDays = diffDaysFromToday(endDate)
  if (diffDays === null) return ''
  if (diffDays === 0) return 'D-Day'
  if (diffDays < 0) return '마감'
  return `D-${diffDays}`
}
</script>
