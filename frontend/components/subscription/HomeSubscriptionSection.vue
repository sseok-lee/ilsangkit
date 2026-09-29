<template>
  <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <div class="flex items-end justify-between gap-4 mb-4">
      <div>
        <h2 class="text-display-2 text-strong flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">calendar_month</span>
          청약 한눈에
        </h2>
        <p class="mt-1 text-sm text-faint">지역과 무관하게 볼 수 있는 전국 공고입니다.</p>
      </div>
      <HardLink to="/subscription" class="inline-flex items-center min-h-[44px] text-sm text-primary font-bold hover:underline whitespace-nowrap">
        전체 공고
      </HardLink>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <article
        v-for="panel in panels"
        :key="panel.key"
        data-testid="subscription-panel"
        class="min-w-0 bg-white border border-line rounded-lg p-4 md:p-5"
      >
        <div class="flex items-start justify-between gap-3 border-b border-line pb-3">
          <div class="min-w-0">
            <h3 class="text-lg font-bold text-strong">{{ panel.title }}</h3>
            <p class="mt-1 text-xs text-faint">{{ panel.description }}</p>
          </div>
          <HardLink :to="panel.href" class="shrink-0 text-sm font-bold text-primary hover:underline">
            더보기
          </HardLink>
        </div>

        <div v-if="panel.error" class="py-8 text-center">
          <span class="material-symbols-outlined text-[30px] text-faint" aria-hidden="true">error</span>
          <p class="mt-2 text-sm font-semibold text-strong">{{ panel.title }} 정보를 불러오지 못했습니다.</p>
          <button class="mt-3 text-sm font-bold text-primary hover:underline" type="button" @click="refresh">
            다시 불러오기
          </button>
        </div>

        <ul v-else-if="panel.items.length > 0" class="divide-y divide-line">
          <li v-for="item in panel.items" :key="`${panel.key}-${item.id}`">
            <HardLink :to="`/subscription/${item.id}`" class="block -mx-2 rounded px-2 py-3 hover:bg-background-light">
              <div class="flex min-w-0 items-center gap-2">
                <span :class="['shrink-0 text-[11px] font-bold px-1.5 py-0.5 rounded', badge(item).classes]">{{ badge(item).label }}</span>
                <span class="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-extrabold" :class="statusClass(item.status)">
                  {{ statusLabel(item.status) }}
                </span>
                <span v-if="dayBadge(item)" class="shrink-0 text-[11px] font-extrabold text-primary">
                  {{ dayBadge(item) }}
                </span>
              </div>
              <p class="mt-2 truncate text-sm font-semibold text-strong">{{ item.houseName }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                <span>{{ item.regionName || '전국' }}</span>
                <span>{{ supplyLabel(item.totalSupplyCount) }}</span>
                <span>{{ dateLabel(item) }}</span>
              </div>
            </HardLink>
          </li>
        </ul>

        <div v-else class="py-8 text-center">
          <span class="material-symbols-outlined text-faint text-[30px]" aria-hidden="true">event_upcoming</span>
          <p class="mt-2 text-sm text-muted">현재 접수 중이거나 예정된 {{ panel.title }} 공고가 없습니다.</p>
          <HardLink :to="panel.href" class="inline-flex items-center mt-3 text-sm text-primary font-bold hover:underline">
            지난 공고 보기
          </HardLink>
        </div>
      </article>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import type { HomeSubscriptionItem } from '~/composables/useHomeSubscriptions'
import { useHomeSubscriptions } from '~/composables/useHomeSubscriptions'
import { subscriptionTypeBadge } from '~/utils/subscriptionMeta'

const { sale, publicRent, saleError, publicRentError, refresh } = useHomeSubscriptions()

const todayIso = useState<string>('home-today-iso', () => new Date().toISOString().split('T')[0])

const MS_PER_DAY = 86_400_000

const panels = computed(() => [
  {
    key: 'sale',
    title: '일반 청약',
    description: '분양, 오피스텔, 무순위, 임의공급',
    href: '/subscription/sale',
    items: sale.value,
    error: saleError.value,
  },
  {
    key: 'public-rent',
    title: '공공임대',
    description: '청약홈·마이홈·LH 공공임대주택',
    href: '/subscription/rent/public',
    items: publicRent.value,
    error: publicRentError.value,
  },
])

function diffDaysFromToday(isoDate: string | null): number | null {
  if (!isoDate) return null
  const target = new Date(isoDate)
  if (Number.isNaN(target.getTime())) return null
  const today = new Date(`${todayIso.value}T00:00:00`)
  target.setHours(0, 0, 0, 0)
  return Math.round((target.getTime() - today.getTime()) / MS_PER_DAY)
}

function dayBadge(item: HomeSubscriptionItem): string | null {
  const d = diffDaysFromToday(item.status === 'ongoing' ? item.receptionEndDate : item.receptionStartDate)
  if (d === null || d < 0) return null
  return d === 0 ? 'D-Day' : `D-${d}`
}

function badge(item: HomeSubscriptionItem) {
  return subscriptionTypeBadge(item.sourceType, item.rentType)
}

function statusLabel(status: HomeSubscriptionItem['status']): string {
  if (status === 'ongoing') return '청약중'
  if (status === 'upcoming') return '접수예정'
  if (status === 'unknown') return '일정 확인 필요'
  return '마감'
}

function statusClass(status: HomeSubscriptionItem['status']): string {
  if (status === 'ongoing') return 'bg-red-50 text-red-700'
  if (status === 'upcoming') return 'bg-blue-50 text-blue-700'
  if (status === 'unknown') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

function supplyLabel(count: number | null): string {
  return count == null ? '공급 미제공' : `${count.toLocaleString()}호`
}

function dateLabel(item: HomeSubscriptionItem): string {
  if (item.status === 'ongoing') {
    return item.receptionEndDate ? `마감 ${item.receptionEndDate}` : '마감일 미제공'
  }
  if (item.status === 'upcoming') {
    return item.receptionStartDate ? `시작 ${item.receptionStartDate}` : '시작일 미제공'
  }
  if (item.status === 'unknown') return '일정 확인 필요'
  return item.receptionEndDate ? `종료 ${item.receptionEndDate}` : '일정 미제공'
}
</script>
