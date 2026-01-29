<template>
  <div
    ref="mapContainer"
    data-testid="map-container"
    class="w-full h-full min-h-[400px] rounded-lg overflow-hidden"
  />
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
import type { FacilitySearchItem } from '~/types/api'
import { CATEGORY_META } from '~/types/facility'

interface Props {
  center: { lat: number; lng: number }
  level?: number
  facilities?: FacilitySearchItem[]
}

interface Emits {
  (e: 'markerClick', facility: FacilitySearchItem): void
}

const props = withDefaults(defineProps<Props>(), {
  level: 5,
  facilities: () => [],
})

const emit = defineEmits<Emits>()

const mapContainer = ref<HTMLElement | null>(null)
const { initMap, addMarkers, clearMarkers, panTo } = useKakaoMap()

// 카테고리별 마커 색상
const CATEGORY_COLORS: Record<string, string> = {
  toilet: '#3b82f6', // blue-500
  wifi: '#10b981', // green-500
  clothes: '#8b5cf6', // purple-500
  kiosk: '#f97316', // orange-500
  trash: '#ef4444', // red-500
  battery: '#eab308', // yellow-500
}

// 지도 초기화
onMounted(async () => {
  if (mapContainer.value) {
    await initMap(mapContainer.value, {
      center: props.center,
      level: props.level,
    })

    // 초기 마커 표시
    if (props.facilities.length > 0) {
      updateMarkers(props.facilities)
    }
  }
})

// 마커 업데이트
function updateMarkers(facilities: FacilitySearchItem[]) {
  clearMarkers()

  if (facilities.length === 0) return

  // 첫 번째 시설의 카테고리로 색상 결정 (또는 혼합된 경우 기본 색상)
  const primaryCategory = facilities[0]?.category || 'toilet'
  const markerColor = CATEGORY_COLORS[primaryCategory] || CATEGORY_COLORS.toilet

  addMarkers(facilities, {
    color: markerColor,
    onClick: (facility) => {
      emit('markerClick', facility)
    },
  })
}

// facilities prop 변경 감지
watch(
  () => props.facilities,
  (newFacilities) => {
    updateMarkers(newFacilities)
  }
)

// center prop 변경 감지
watch(
  () => props.center,
  (newCenter) => {
    panTo(newCenter.lat, newCenter.lng)
  }
)

// 정리
onUnmounted(() => {
  clearMarkers()
})
</script>

<style scoped>
/* Kakao Maps specific styles */
:deep(.kakao-marker-overlay) {
  z-index: 10;
  transition: all 0.2s ease;
}

:deep(.kakao-marker-overlay:hover) {
  transform: scale(1.05);
  z-index: 20;
}
</style>
