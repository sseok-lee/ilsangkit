<template>
  <NuxtLink
    :to="href"
    class="block py-5 transition-colors hover:bg-[#F7F8FA] focus:outline-none focus:ring-2 focus:ring-[#2450DC]/20"
  >
    <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div class="min-w-0">
        <p class="text-base font-bold text-[#15213B]">{{ item.name }}</p>
        <p v-if="displayAddress" class="mt-1 text-sm text-[#56627A]">{{ displayAddress }}</p>
      </div>
      <div class="flex items-center gap-3 text-sm">
        <span v-if="primaryExtra" class="text-[#56627A]">{{ primaryExtra }}</span>
        <span class="rounded bg-[#F1F4F8] px-2.5 py-1 font-semibold text-[#56627A]">{{ categoryLabel }}</span>
      </div>
    </div>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { BrowseItem } from '~/types/facilityBrowse'

const props = defineProps<{ item: BrowseItem }>()

const CATEGORY_LABELS: Record<string, string> = {
  toilet: '화장실',
  trash: '쓰레기',
  wifi: '와이파이',
  clothes: '의류수거함',
  parking: '주차장',
  aed: 'AED',
  library: '도서관',
  hospital: '병원',
  pharmacy: '약국',
  park: '공원',
  school: '학교',
  market: '시장',
  childcare: '어린이집',
  'ev-charger': '전기차 충전소',
  sports: '체육시설',
  subway: '지하철역',
}

function isValidWasteAreaDestination(destination: BrowseItem['destination']): destination is { kind: 'waste-area'; href: string } {
  return destination?.kind === 'waste-area' && /^\/trash\/areas\/\d+$/.test(destination.href)
}

const href = computed(() => {
  if (props.item.category === 'trash' && isValidWasteAreaDestination(props.item.destination)) {
    return props.item.destination.href
  }
  return `/${props.item.category}/${encodeURIComponent(props.item.id)}`
})
const categoryLabel = computed(() => CATEGORY_LABELS[props.item.category] ?? props.item.category)
const displayAddress = computed(() => props.item.roadAddress || props.item.address)
const primaryExtra = computed(() => {
  const extras = props.item.extras || {}
  if (props.item.category === 'subway' && Array.isArray(extras.lines)) return extras.lines.join(' · ')
  if (props.item.category === 'ev-charger' && typeof extras.totalChargers === 'number') return `충전기 ${extras.totalChargers}기`
  if (props.item.category === 'wifi' && typeof extras.accessPointCount === 'number') return `AP ${extras.accessPointCount}대`
  if (props.item.category === 'parking' && typeof extras.capacity === 'number') return `주차 ${extras.capacity}면`
  return ''
})
</script>
