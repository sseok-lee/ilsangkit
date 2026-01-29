<template>
  <div ref="mapContainer" class="kakao-map w-full h-full">
    <!-- Loading overlay -->
    <div v-if="!isMapLoaded" class="absolute inset-0 flex items-center justify-center bg-gray-100">
      <div class="text-center">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500 mx-auto mb-2"></div>
        <p class="text-sm text-gray-500">지도 로딩 중...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { FacilitySearchItem, FacilityCategory } from '~/types/api'

interface Props {
  center: { lat: number; lng: number }
  markers?: FacilitySearchItem[]
  category?: FacilityCategory
  zoom?: number
}

const props = withDefaults(defineProps<Props>(), {
  markers: () => [],
  zoom: 15
})

const emit = defineEmits<{
  (e: 'marker-click', marker: FacilitySearchItem): void
  (e: 'map-move', center: { lat: number; lng: number }): void
}>()

const mapContainer = ref<HTMLElement | null>(null)
const isMapLoaded = ref(false)

const { map, initMap, setCenter, addMarkers, panTo, clearMarkers } = useKakaoMap()

// Category marker colors
const categoryColors: Record<string, string> = {
  toilet: '#8b5cf6',
  trash: '#10b981',
  wifi: '#f59e0b',
  clothes: '#ec4899',
  kiosk: '#6366f1',
}

// Initialize map
onMounted(async () => {
  if (mapContainer.value) {
    await initMap(mapContainer.value, {
      center: props.center,
      level: props.zoom
    })
    isMapLoaded.value = true

    // Listen for map move
    if (map.value) {
      window.kakao.maps.event.addListener(map.value, 'dragend', () => {
        const center = map.value.getCenter()
        emit('map-move', { lat: center.getLat(), lng: center.getLng() })
      })
    }
  }
})

// Watch center changes
watch(() => props.center, (newCenter) => {
  if (isMapLoaded.value) {
    setCenter(newCenter.lat, newCenter.lng)
  }
}, { deep: true })

// Watch markers changes
watch(() => props.markers, (newMarkers) => {
  if (isMapLoaded.value && newMarkers) {
    clearMarkers()
    addMarkers(newMarkers, {
      color: props.category ? categoryColors[props.category] : '#3b82f6',
      onClick: (marker) => emit('marker-click', marker)
    })
  }
}, { deep: true })

// Expose panTo method
defineExpose({
  panTo: (lat: number, lng: number) => panTo(lat, lng)
})
</script>

<style scoped>
.kakao-map {
  position: relative;
}
</style>
