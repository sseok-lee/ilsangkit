<template>
  <NuxtLink
    :to="linkUrl"
    class="group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-transparent hover:border-primary/20 cursor-pointer block"
  >
    <div class="flex flex-col gap-2">
      <!-- 건물명 -->
      <h3 class="text-slate-900 text-base font-bold truncate">
        {{ complex.buildingName }}
      </h3>

      <!-- 지역 정보 -->
      <p class="text-slate-500 text-xs truncate">
        {{ complex.city }} {{ complex.district }} {{ complex.dongName }}
      </p>

      <div class="flex items-center justify-between mt-1">
        <!-- 최근 거래가 -->
        <span class="text-primary font-semibold text-sm">
          {{ complex.latestPrice != null ? formatAmount(complex.latestPrice) : '거래 정보 확인' }}
        </span>

        <!-- 거래 건수 -->
        <span class="text-slate-400 text-xs">
          거래 {{ complex.transactionCount }}건
        </span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ComplexInfo, RealEstatePropertyType, TransactionMode } from '~/types/realEstate'

interface Props {
  complex: ComplexInfo
  propertyType: RealEstatePropertyType
  tab: TransactionMode
}

const props = defineProps<Props>()

const linkUrl = computed(() => {
  const name = encodeURIComponent(props.complex.buildingName)
  return `/real-estate/${props.propertyType}/${name}?tab=${props.tab}&bjdCode=${props.complex.bjdCode}`
})

function formatAmount(amount: number): string {
  const uk = Math.floor(amount / 10000)
  const man = amount % 10000
  if (uk > 0 && man > 0) {
    return `${uk}억 ${man.toLocaleString()}만원`
  }
  if (uk > 0) {
    return `${uk}억`
  }
  return `${amount.toLocaleString()}만원`
}
</script>
