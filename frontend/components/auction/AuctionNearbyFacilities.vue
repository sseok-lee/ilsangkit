<!-- frontend/components/auction/AuctionNearbyFacilities.vue -->
<script setup lang="ts">
// 부모가 facility 검색 결과(지하철/병원/학교)를 주입.
defineProps<{ facilities: Array<{ category: string; name: string; distance?: number }> }>()
</script>
<template>
  <div v-if="facilities.length" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-2">주변 생활 인프라</h3>
    <ul class="space-y-1 text-sm">
      <li v-for="(f, i) in facilities" :key="i" class="flex justify-between">
        <span class="text-slate-700">{{ f.name }}</span>
        <span class="text-caption text-slate-400">{{ f.category }}<template v-if="f.distance"> · {{ f.distance }}m</template></span>
      </li>
    </ul>
  </div>
</template>
