<template>
  <SectionBlock heading="같은 단지 다른 평형/유형" subtext="동일 단지의 다른 면적 또는 공급유형 매물입니다.">
    <template #right>
      <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
        {{ siblings.length.toLocaleString() }}건
      </span>
    </template>

    <div v-if="siblings.length === 0" class="rounded-xl bg-slate-50 p-6 text-center text-slate-500 text-sm">
      이 단지는 단일 공급유형/면적으로 등록되어 있습니다. 다른 면적·유형이 등록되면 이곳에 함께 표시됩니다.
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <NuxtLink
        v-for="item in siblings"
        :key="item.id"
        :to="linkFor(item)"
        class="block rounded-xl border border-slate-200 bg-white p-4 hover:border-primary hover:shadow-md transition-all"
      >
        <div class="flex items-center gap-2 mb-2">
          <span :class="badgeClass(item.rentalType)">{{ item.rentalType }}</span>
          <span class="text-xs text-slate-500">{{ fmtArea(item.exclusiveArea) }}</span>
        </div>
        <p class="text-sm font-bold text-slate-900">
          {{ fmtDeposit(item.depositAmount) }}
        </p>
        <p v-if="!isJeonseRental(item.monthlyRent)" class="text-xs text-slate-600 mt-0.5">
          월 {{ fmtRent(item.monthlyRent, false) }}
        </p>
        <p v-else class="text-xs text-emerald-600 font-medium mt-0.5">전세 (월세 없음)</p>
      </NuxtLink>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import type { PublicRentalComplex } from '~/types/publicRental'
import SectionBlock from '~/components/common/SectionBlock.vue'
import {
  fmtArea,
  fmtDeposit,
  fmtRent,
  isJeonseRental,
  rentalTypeToSlug,
} from '~/utils/publicRentalMeta'

defineProps<{
  siblings: PublicRentalComplex[]
}>()

function linkFor(item: PublicRentalComplex): string {
  const slug = rentalTypeToSlug(item.rentalType) ?? 'buy-lease'
  return `/public-rental/${slug}/${item.id}`
}

function badgeClass(rentalType: string): string {
  const base = 'inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold'
  if (rentalType === '전세임대') return `${base} bg-emerald-100 text-emerald-700`
  if (rentalType === '매입임대') return `${base} bg-primary-100 text-primary-700`
  return `${base} bg-slate-100 text-slate-700`
}
</script>
