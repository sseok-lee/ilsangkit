<template>
  <NuxtLink
    :to="linkUrl"
    :prefetch="false"
    class="group bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-300 border border-slate-200 hover:border-primary/30 cursor-pointer block"
  >
    <div class="flex gap-3">
      <!-- 건물 유형 컬러 인디케이터 -->
      <div
        :class="[
          'shrink-0 w-10 h-10 rounded-lg flex items-center justify-center',
          propertyTypeColor,
        ]"
      >
        <img :src="`/icons/category/${propertyTypeImg}.webp?v2`" :alt="props.propertyType" class="w-7 h-7" width="28" height="28" />
      </div>

      <div class="flex-1 min-w-0">
        <!-- 건물명 -->
        <h3 class="text-slate-900 text-base font-bold truncate">
          {{ complex.buildingName }}
        </h3>

        <!-- 지역 정보 -->
        <p class="text-slate-500 text-xs truncate mt-0.5">
          {{ complex.city }} {{ complex.district }} {{ complex.dongName }}
        </p>

        <div class="flex items-center justify-between mt-2">
          <!-- 최근 거래가 -->
          <span class="text-primary font-bold text-lg leading-tight">
            {{ complex.latestPrice != null ? formatAmount(complex.latestPrice) : '거래 정보 확인' }}
          </span>

          <!-- 거래 건수 배지 -->
          <span class="shrink-0 bg-slate-100 text-slate-600 text-xs font-semibold px-2 py-0.5 rounded-md">
            거래 {{ complex.transactionCount }}건
          </span>
        </div>
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

const PROPERTY_ICONS: Record<string, { img: string; bg: string }> = {
  apt: { img: 'apt', bg: 'bg-blue-50' },
  villa: { img: 'villa', bg: 'bg-emerald-50' },
  offitel: { img: 'offitel', bg: 'bg-violet-50' },
}

const propertyTypeImg = computed(() => PROPERTY_ICONS[props.propertyType]?.img || 'apt')
const propertyTypeColor = computed(() => PROPERTY_ICONS[props.propertyType]?.bg || 'bg-slate-100')

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
