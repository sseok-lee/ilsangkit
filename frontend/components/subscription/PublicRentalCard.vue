<template>
  <HardLink
    :to="detailLink"
    class="block bg-white rounded-xl shadow-sm border border-line-2 p-4 hover:shadow-md hover:border-primary transition-all duration-200"
  >
    <div class="flex items-start justify-between gap-3 mb-2">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5 mb-1">
          <span
            v-if="rental.announcementStatus === 'ongoing'"
            class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200"
          >
            모집중
          </span>
          <span
            v-else-if="rental.announcementStatus === 'upcoming'"
            class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-primary-50 text-primary-700 ring-1 ring-inset ring-primary-200"
          >
            모집예정
          </span>
        </div>
        <h3 class="font-bold text-strong text-sm md:text-base truncate">
          {{ rental.complexName }}
        </h3>
        <p class="text-xs md:text-sm text-muted mt-1">{{ regionLabel }}</p>
      </div>
      <span :class="rentalTypeBadgeClass">{{ rental.rentalType }}</span>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs mb-3">
      <span v-if="rental.houseType" class="bg-slate-100 text-slate-700 px-2 py-1 rounded">
        {{ rental.houseType }}
      </span>
      <span v-if="rental.exclusiveArea" class="bg-slate-100 text-slate-700 px-2 py-1 rounded">
        전용 {{ rental.exclusiveArea }}㎡
      </span>
      <span v-if="rental.householdCount" class="bg-slate-100 text-slate-700 px-2 py-1 rounded">
        {{ rental.householdCount.toLocaleString() }}세대
      </span>
      <span v-if="isJeonse" class="bg-emerald-100 text-emerald-700 px-2 py-1 rounded font-medium">
        전세
      </span>
    </div>

    <div class="space-y-1 text-xs text-ink">
      <p v-if="rental.depositAmount !== null">
        <span class="font-medium">보증금:</span>
        {{ formatDeposit(rental.depositAmount) }}
      </p>
      <p v-if="rental.monthlyRent !== null && rental.monthlyRent > 0">
        <span class="font-medium">월세:</span>
        {{ formatRent(rental.monthlyRent) }}
      </p>
    </div>
  </HardLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import { rentalTypeToSlug } from '~/utils/publicRentalMeta'

const props = defineProps<{
  rental: PublicRentalComplex
}>()

const detailLink = computed(() => {
  const slug = rentalTypeToSlug(props.rental.rentalType) ?? 'buy-lease'
  return `/public-rental/${slug}/${props.rental.id}`
})

const regionLabel = computed(() => {
  return [props.rental.city, props.rental.district].filter(Boolean).join(' ')
})

const isJeonse = computed(() => {
  return props.rental.monthlyRent === 0 || props.rental.monthlyRent === null
})

const rentalTypeBadgeClass = computed(() => {
  const baseClass = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0'
  if (props.rental.rentalType === '전세임대') {
    return `${baseClass} bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200`
  }
  if (props.rental.rentalType === '매입임대') {
    return `${baseClass} bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200`
  }
  return `${baseClass} bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200`
})

function formatDeposit(amount: number): string {
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000)
    const man = Math.floor((amount % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
  }
  return `${Math.floor(amount / 10_000).toLocaleString()}만원`
}

function formatRent(amount: number): string {
  return `${Math.floor(amount / 10_000).toLocaleString()}만원`
}
</script>
