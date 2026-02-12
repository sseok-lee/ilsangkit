<template>
  <div class="relative w-full h-full min-h-[400px] rounded-lg overflow-hidden">
    <div
      ref="mapContainer"
      role="application"
      aria-label="시설 위치 지도"
      data-testid="map-container"
      class="w-full h-full"
    />
    <div class="sr-only" aria-live="polite" aria-atomic="true">
      {{ facilities.length }}개의 시설이 지도에 표시됩니다. 마커를 클릭하면 상세 정보를 확인할 수 있습니다.
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useKakaoMap } from '~/composables/useKakaoMap'
import type { FacilitySearchItem } from '~/types'

interface Props {
  center: { lat: number; lng: number }
  level?: number
  facilities?: FacilitySearchItem[]
  userLocation?: { lat: number; lng: number } | null
}

interface MapBounds {
  center: { lat: number; lng: number }
  sw: { lat: number; lng: number }
  ne: { lat: number; lng: number }
}

interface Emits {
  (e: 'markerClick', facility: FacilitySearchItem): void
  (e: 'boundsChanged', bounds: MapBounds): void
}

const props = withDefaults(defineProps<Props>(), {
  level: 5,
  facilities: () => [],
})

const emit = defineEmits<Emits>()

const mapContainer = ref<HTMLElement | null>(null)
const { map, initMap, addMarkers, clearMarkers, panTo, setUserLocationMarker, getCenter, getBounds } = useKakaoMap()

function emitBounds() {
  const center = getCenter()
  const bounds = getBounds()
  if (center && bounds) {
    emit('boundsChanged', { center, sw: bounds.sw, ne: bounds.ne })
  }
}

// 카테고리별 마커 색상
const CATEGORY_COLORS: Record<string, string> = {
  toilet: '#3b82f6', // blue-500
  wifi: '#10b981', // green-500
  clothes: '#8b5cf6', // purple-500
  kiosk: '#f97316', // orange-500
  trash: '#ef4444', // red-500
  parking: '#0ea5e9', // sky-500
  aed: '#ef4444', // red-500
  library: '#d97706', // amber-600
}

// 지도 초기화
onMounted(async () => {
  if (mapContainer.value) {
    await initMap(mapContainer.value, {
      center: props.center,
      level: props.level,
    })

    // 지도 이동/줌 시 bounds emit
    if (map.value) {
      window.kakao.maps.event.addListener(map.value, 'dragend', emitBounds)
      window.kakao.maps.event.addListener(map.value, 'zoom_changed', emitBounds)
    }

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

// userLocation prop 변경 감지
watch(
  () => props.userLocation,
  (loc) => {
    if (loc) setUserLocationMarker(loc.lat, loc.lng)
  },
  { immediate: true }
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

:deep(.user-location-dot) {
  width: 16px;
  height: 16px;
  background: #4285f4;
  border: 3px solid white;
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
  position: relative;
}

:deep(.user-location-pulse) {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 40px;
  height: 40px;
  background: rgba(66, 133, 244, 0.2);
  border-radius: 50%;
  animation: pulse 2s ease-out infinite;
}

@keyframes pulse {
  0% {
    transform: translate(-50%, -50%) scale(0.5);
    opacity: 1;
  }
  100% {
    transform: translate(-50%, -50%) scale(1.2);
    opacity: 0;
  }
}
</style>
