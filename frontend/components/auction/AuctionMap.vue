<!-- frontend/components/auction/AuctionMap.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
const props = defineProps<{ lat: number; lng: number; address?: string }>()
const mapEl = ref<HTMLElement | null>(null)
const roadviewEl = ref<HTMLElement | null>(null)
const roadviewAvailable = ref(false)
const { initMap, addMarkers, initRoadview } = useKakaoMap()

onMounted(async () => {
  if (!import.meta.client || !mapEl.value) return
  await initMap(mapEl.value, { center: { lat: props.lat, lng: props.lng }, level: 4 })
  // ⚠️ addMarkers는 Facility 형태({lat,lng,id:string,name,category,...})를 받음. latitude/longitude 아님!
  addMarkers([{ id: 'auction', name: props.address ?? '위치', category: 'parking', address: null, roadAddress: null, lat: props.lat, lng: props.lng, city: '', district: '' } as any], {})
  if (roadviewEl.value) {
    await initRoadview(roadviewEl.value, props.lat, props.lng, (ok: boolean) => { roadviewAvailable.value = ok })
  }
})
</script>
<template>
  <div data-testid="auction-map" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <h3 class="text-sm font-semibold text-slate-900 mb-2">위치</h3>
    <!-- 지도 + 로드뷰 반반(데스크톱), 모바일 세로 적층. 로드뷰 없으면 지도 전체폭 -->
    <div class="grid gap-3 md:grid-cols-2">
      <div :class="roadviewAvailable ? '' : 'md:col-span-2'">
        <p class="text-caption text-slate-500 mb-1">🗺️ 지도</p>
        <div ref="mapEl" class="w-full h-64 rounded-lg overflow-hidden bg-slate-100" />
      </div>
      <div v-show="roadviewAvailable">
        <p class="text-caption text-slate-500 mb-1">🛣️ 로드뷰</p>
        <div ref="roadviewEl" class="w-full h-64 rounded-lg overflow-hidden bg-slate-100" />
      </div>
    </div>
    <p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
  </div>
</template>
