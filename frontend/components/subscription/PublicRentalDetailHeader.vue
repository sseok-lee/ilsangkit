<template>
  <header class="hidden md:block bg-white border border-line rounded-xl shadow-card p-4 md:p-5">
    <div class="flex flex-wrap items-center gap-2 mb-3">
      <span :class="rentalTypeBadgeClass">{{ rental.rentalType }}</span>
      <span v-if="rental.houseType" class="inline-flex items-center px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">
        {{ rental.houseType }}
      </span>
    </div>

    <div role="heading" aria-level="1" class="text-2xl md:text-3xl font-bold text-strong leading-tight break-keep">
      {{ displayName }}
    </div>

    <p class="mt-2 text-ink text-sm md:text-base break-keep">
      {{ rental.complexName }}
    </p>

    <p class="mt-3 inline-flex items-center gap-1.5 text-xs md:text-sm text-muted">
      <span class="material-symbols-outlined text-[16px]">apartment</span>
      {{ rental.landlordAgency || NO_DATA }}
    </p>
  </header>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import { NO_DATA } from '~/utils/publicRentalMeta'

const props = defineProps<{
  rental: PublicRentalComplex
}>()

const displayName = computed(() => {
  return props.rental.complexNameKor && props.rental.complexNameKor.trim()
    ? props.rental.complexNameKor
    : `${props.rental.city} ${props.rental.district} ${props.rental.rentalType}`
})

const rentalTypeBadgeClass = computed(() => {
  const base = 'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold'
  if (props.rental.rentalType === '전세임대') {
    return `${base} bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200`
  }
  if (props.rental.rentalType === '매입임대') {
    return `${base} bg-primary-100 text-primary-700 ring-1 ring-inset ring-primary-200`
  }
  return `${base} bg-slate-100 text-slate-700 ring-1 ring-inset ring-slate-200`
})
</script>
