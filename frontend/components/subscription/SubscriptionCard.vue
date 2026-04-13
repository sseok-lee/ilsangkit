<template>
  <NuxtLink :to="`/subscription/${subscription.id}`" class="block">
    <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden hover:shadow-md transition-shadow duration-200 h-full flex flex-col">
      <!-- Header with status badge -->
      <div class="p-4 pb-3 flex items-start justify-between gap-3">
        <div class="flex-1 min-w-0">
          <h3 class="font-bold text-slate-900 text-sm md:text-base truncate">
            {{ subscription.houseName }}
          </h3>
          <p class="text-xs md:text-sm text-slate-500 mt-1">{{ subscription.regionName }}</p>
        </div>
        <span :class="statusBadgeClass">
          {{ statusLabel }}
        </span>
      </div>

      <!-- Content -->
      <div class="px-4 pb-4 flex-1 space-y-3">
        <!-- Supply count -->
        <div v-if="subscription.totalSupplyCount" class="flex items-center gap-2 text-sm">
          <span class="material-symbols-outlined text-slate-400 text-[18px]">home</span>
          <span class="text-slate-600">공급</span>
          <span class="font-semibold text-slate-900">{{ subscription.totalSupplyCount.toLocaleString() }}호</span>
        </div>

        <!-- House type & detail -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <span v-if="subscription.sourceType && subscription.sourceType !== 'APT'" class="bg-purple-100 text-purple-700 px-2 py-1 rounded font-medium">{{ getSourceTypeLabel(subscription.sourceType) }}</span>
          <span class="bg-slate-100 text-slate-700 px-2 py-1 rounded">{{ subscription.houseType }}</span>
          <span v-if="subscription.houseDetailType" class="bg-slate-100 text-slate-700 px-2 py-1 rounded">{{ subscription.houseDetailType }}</span>
          <span v-if="subscription.rentType" :class="rentTypeBadgeClass">{{ rentTypeLabel }}</span>
        </div>

        <!-- Date range -->
        <div class="text-xs text-slate-500 space-y-1">
          <p v-if="receptionDateRange">
            <span class="font-medium text-slate-600">접수:</span>
            {{ receptionDateRange }}
          </p>
          <p v-if="specialDateRange">
            <span class="font-medium text-slate-600">특공:</span>
            {{ specialDateRange }}
          </p>
        </div>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import type { Subscription } from '~/types/subscription'
import { getSourceTypeLabel } from '~/utils/subscriptionMeta'

const props = defineProps<{
  subscription: Subscription
}>()

const rentTypeLabel = computed(() => {
  const rt = props.subscription.rentType
  if (rt === '분양주택') return '#분양'
  if (rt === '임대주택') return '#임대'
  return rt ? `#${rt}` : ''
})

const rentTypeBadgeClass = computed(() => {
  const rt = props.subscription.rentType
  if (rt === '임대주택') return 'bg-amber-100 text-amber-700 px-2 py-1 rounded font-medium'
  return 'bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium'
})

const statusLabel = computed(() => {
  const status = props.subscription.status
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '접수중'
  if (status === 'closed') return '마감'
  return ''
})

const statusBadgeClass = computed(() => {
  const status = props.subscription.status
  const baseClass = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0'
  if (status === 'upcoming') return `${baseClass} bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200`
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
  return `${date.getMonth() + 1}.${date.getDate()}`
}
</script>
