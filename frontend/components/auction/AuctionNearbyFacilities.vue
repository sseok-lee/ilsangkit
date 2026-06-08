<!-- frontend/components/auction/AuctionNearbyFacilities.vue
     물건 좌표 기준 반경 1km 주변 편의시설 (카테고리별 그룹) -->
<script setup lang="ts">
import { computed } from 'vue'
import type { NearbyFacility } from '~/types/auction'

const props = defineProps<{ facilities: NearbyFacility[] }>()

// categoryLabel 기준 그룹(입력 순서 유지: 지하철역→병원→약국→학교→어린이집→공원)
const groups = computed(() => {
  const map = new Map<string, NearbyFacility[]>()
  for (const f of props.facilities) {
    const arr = map.get(f.categoryLabel) ?? []
    arr.push(f)
    map.set(f.categoryLabel, arr)
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }))
})

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}
</script>
<template>
  <div v-if="facilities.length" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-1">주변 생활 인프라</h3>
    <p class="text-caption text-slate-400 mb-3">반경 1km 이내 · 가까운 순</p>
    <div class="flex flex-col gap-3">
      <div v-for="g in groups" :key="g.label">
        <p class="text-caption font-medium text-slate-500 mb-1">{{ g.label }}</p>
        <ul class="flex flex-col gap-1">
          <li v-for="(f, i) in g.items" :key="i" class="flex items-baseline justify-between gap-2 text-sm">
            <span class="text-slate-700 truncate">{{ f.name }}</span>
            <span class="text-caption text-slate-400 shrink-0">{{ fmtDist(f.distance) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>
