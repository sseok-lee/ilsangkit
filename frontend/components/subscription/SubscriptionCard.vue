<template>
  <HardLink :to="`/subscription/${subscription.id}`" class="block">
    <div class="bg-white rounded-xl shadow-sm border border-line-2 overflow-hidden hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
      <!-- Header with status badge -->
      <div class="p-4 pb-3 flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-strong text-sm md:text-base truncate">
            {{ subscription.houseName }}
          </h3>
          <p class="text-xs md:text-sm text-muted mt-1">{{ subscription.regionName }}</p>
        </div>
        <span :class="statusBadgeClass">
          {{ statusLabel }}
        </span>
      </div>

      <!-- Content -->
      <div class="px-4 pb-4 flex-1 space-y-3">
        <!-- Supply count -->
        <div v-if="subscription.totalSupplyCount" class="flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-faint text-[18px]">home</span>
          <span class="text-muted">공급</span>
          <span class="font-semibold text-strong font-display tabular-nums">{{ subscription.totalSupplyCount.toLocaleString() }}호</span>
        </div>

        <!-- House type & detail -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span v-if="subscription.sourceType && subscription.sourceType !== 'APT'" class="bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">{{ getSourceTypeLabel(subscription.sourceType) }}</span>
          <span class="bg-slate-100 text-slate-700 px-2 py-1 rounded">{{ subscription.houseType }}</span>
          <span v-if="subscription.houseDetailType" class="bg-slate-100 text-slate-700 px-2 py-1 rounded">{{ subscription.houseDetailType }}</span>
          <span v-if="subscription.rentType" :class="rentTypeBadgeClass">{{ rentTypeLabel }}</span>
        </div>

        <!-- Date range -->
        <div class="text-xs text-muted space-y-1">
          <p v-if="receptionDateRange">
            <span class="font-medium text-muted">접수:</span>
            {{ receptionDateRange }}
          </p>
          <p v-if="specialDateRange">
            <span class="font-medium text-muted">특공:</span>
            {{ specialDateRange }}
          </p>
        </div>
      </div>
    </div>
  </HardLink>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'
import type { Subscription } from '~/types/subscription'
import { getSourceTypeLabel } from '~/utils/subscriptionMeta'

const props = defineProps<{
  subscription: Subscription
}>()

const rentTypeLabel = computed(() => {
  const rt = props.subscription.rentType
  if (rt === '분양전환 가능임대') return '분양전환형'
  if (rt === '분양전환 불가임대') return '장기형'
  if (rt === '분양주택') return '분양'
  if (rt === '임대주택') return '임대' // legacy
  return rt ?? ''
})

const rentTypeBadgeClass = computed(() => {
  const rt = props.subscription.rentType
  const isRent = rt?.includes('임대')
  return isRent
    ? 'bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium'
    : 'bg-primary-100 text-primary-700 px-2 py-1 rounded font-medium'
})

const statusLabel = computed(() => {
  const status = props.subscription.status
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '청약중'
  if (status === 'closed') return '마감'
  return ''
})

const statusBadgeClass = computed(() => {
  const status = props.subscription.status
  const baseClass = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0'
  if (status === 'upcoming') return `${baseClass} bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200`
  if (status === 'ongoing') return `${baseClass} bg-green-100 text-green-700 ring-1 ring-inset ring-green-200`
  return `${baseClass} bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200`
})

const receptionDateRange = computed(() => {
  const start = props.subscription.receptionStartDate
  const end = props.subscription.receptionEndDate
  if (!start || !end) return null
  return `${formatDate(start)} ~ ${formatDate(end)}`
})

const specialDateRange = computed(() => {
  const start = props.subscription.specialStartDate
  const end = props.subscription.specialEndDate
  if (!start || !end) return null
  return `${formatDate(start)} ~ ${formatDate(end)}`
})

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`
}
</script>
