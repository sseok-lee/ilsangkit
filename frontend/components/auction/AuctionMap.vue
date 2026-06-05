<!-- frontend/components/auction/AuctionMap.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
const props = defineProps<{ lat: number; lng: number; address?: string }>()
const mapEl = ref<HTMLElement | null>(null)
const roadviewEl = ref<HTMLElement | null>(null)
const roadviewAvailable = ref(false)
const showRoadview = ref(false)
const { initMap, addMarkers, initRoadview } = useKakaoMap()

onMounted(async () => {
  if (!import.meta.client || !mapEl.value) return
  await initMap(mapEl.value, { center: { lat: props.lat, lng: props.lng }, level: 4 })
  // ⚠️ I1: addMarkers는 Facility 형태({lat,lng,id:string,name,category,...})를 받음. latitude/longitude 아님!
  addMarkers([{ id: 'auction', name: props.address ?? '위치', category: 'parking', address: null, roadAddress: null, lat: props.lat, lng: props.lng, city: '', district: '' } as any], {})
  if (roadviewEl.value) {
    await initRoadview(roadviewEl.value, props.lat, props.lng, (ok: boolean) => { roadviewAvailable.value = ok })
  }
})
</script>
<template>
  <div data-testid="auction-map" class="bg-white rounded-xl border border-line p-4 shadow-card">
    <div class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-slate-900">위치</h3>
      <button v-if="roadviewAvailable" type="button" class="text-caption text-primary" @click="showRoadview = !showRoadview">
        {{ showRoadview ? '지도 보기' : '로드뷰 보기' }}
      </button>
    </div>
    <div v-show="!showRoadview" ref="mapEl" class="w-full h-64 rounded-lg overflow-hidden" />
    <div v-show="showRoadview" ref="roadviewEl" class="w-full h-64 rounded-lg overflow-hidden" />
    <p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
  </div>
</template>
