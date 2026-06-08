<!-- frontend/components/auction/AuctionMap.vue -->
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
import SectionBlock from '~/components/common/SectionBlock.vue'
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
  <SectionBlock data-testid="auction-map" heading="위치">
    <!-- 지도 + 로드뷰 반반(데스크톱), 모바일 세로 적층. 로드뷰 없으면 자리는 유지하고 안내 표시 -->
    <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
      <div>
        <p class="text-caption text-slate-500 mb-1">🗺️ 지도</p>
        <div ref="mapEl" class="w-full h-64 rounded-lg overflow-hidden bg-slate-100" />
      </div>
      <div>
        <p class="text-caption text-slate-500 mb-1">🛣️ 로드뷰</p>
        <div class="relative w-full h-64 rounded-lg overflow-hidden bg-slate-100">
          <div v-show="roadviewAvailable" ref="roadviewEl" class="w-full h-full" />
          <div v-show="!roadviewAvailable" class="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <span class="text-3xl opacity-40" aria-hidden="true">🛣️</span>
            <p class="text-caption text-slate-400">로드뷰가 제공되지 않는 위치입니다</p>
          </div>
        </div>
      </div>
    </div>
    <p v-if="address" class="mt-2 text-caption text-slate-500">{{ address }}</p>
  </SectionBlock>
</template>
