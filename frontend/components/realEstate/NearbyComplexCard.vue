<template>
  <HardLink
    :to="linkUrl"
    class="block bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition border border-slate-200 hover:border-primary/30"
  >
    <div class="flex items-start gap-2 mb-2">
      <h3 class="text-slate-900 text-[15px] font-bold truncate flex-1 min-w-0">{{ item.buildingName }}</h3>
      <span :class="['shrink-0 text-[11px] font-bold rounded-md px-2 py-0.5', badgeClass]">{{ propertyLabel }}</span>
    </div>
    <p class="text-slate-500 text-xs truncate">{{ item.city }} {{ item.district }} {{ item.dongName }}</p>
    <p :class="['mt-2 text-[13px] font-bold rounded-md inline-flex items-center gap-1 px-2 py-1', priceBadgeClass]">
      <span>{{ priceLabel }}</span>
      <span>{{ priceText }}</span>
    </p>
  </HardLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import type { NearbyComplexItem, RealEstatePropertyType } from '~/types/realEstate'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'

interface Props {
  item: NearbyComplexItem
  propertyType: RealEstatePropertyType
  mode: 'sale' | 'rent'
  rentType: 'all' | 'jeonse' | 'wolse'
}
const props = defineProps<Props>()

const propertyLabel = computed(() =>
  props.propertyType === 'apt' ? '아파트'
    : props.propertyType === 'villa' ? '빌라'
    : '오피스텔'
)

const badgeClass = computed(() => {
  if (props.propertyType === 'apt') return 'bg-blue-50 text-blue-700'
  if (props.propertyType === 'villa') return 'bg-emerald-50 text-emerald-700'
  return 'bg-amber-50 text-amber-700'
})

const priceLabel = computed(() => {
  if (props.mode === 'sale') return '매매'
  if (props.rentType === 'jeonse') return '전세'
  if (props.rentType === 'wolse') return '월세'
  return '전월세'
})

const priceBadgeClass = computed(() =>
  props.mode === 'sale' ? 'bg-blue-50 text-blue-700' : 'bg-rose-50 text-rose-700'
)

const priceText = computed(() => {
  const v = props.item.latestPrice
  if (v == null) return '-'
  if (v >= 100_000_000) {
    const eok = Math.floor(v / 100_000_000)
    const man = Math.floor((v % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만` : `${eok}억`
  }
  return `${Math.floor(v / 10_000).toLocaleString()}만`
})

const linkUrl = computed(() => {
  const type = `${props.propertyType}-${props.mode}` as RealEstateUrlType
  return toRealEstateUrl({
    type,
    city: props.item.city,
    district: props.item.district,
    buildingName: props.item.buildingName,
  })
})
</script>
