<template>
  <div class="category-page flex flex-col h-[calc(100vh-8rem)]">
    <!-- Action Bar -->
    <div class="action-bar bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-2">
      <CommonSearchBar v-model="searchQuery" placeholder="의류수거함 검색" @search="handleSearch" />
      <button
        type="button"
        class="flex-shrink-0 p-2 rounded-full bg-primary-500 text-white hover:bg-primary-600 transition-colors"
        :disabled="isLocating"
        @click="locateMe"
        aria-label="현재 위치로 이동"
      >
        <svg v-if="!isLocating" xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>
    </div>

    <!-- Map -->
    <div class="flex-1 relative">
      <MapKakaoMap
        ref="mapRef"
        :center="mapCenter"
        :markers="markers"
        :category="'clothes'"
        @marker-click="handleMarkerClick"
        @map-move="handleMapMove"
      />
    </div>

    <!-- Bottom Sheet -->
    <MapFacilityBottomSheet
      :facilities="facilities"
      :loading="isLoading"
      :selected-id="selectedFacilityId"
      category="clothes"
      @select="handleSelectFacility"
    />
  </div>
</template>

<script setup lang="ts">
import type { FacilitySearchItem } from '~/types/api'

definePageMeta({
  title: '의류수거함'
})

useHead({
  title: '의류수거함'
})

const searchQuery = ref('')
const mapCenter = ref({ lat: 37.5665, lng: 126.978 })
const facilities = ref<FacilitySearchItem[]>([])
const markers = ref<FacilitySearchItem[]>([])
const selectedFacilityId = ref<string | null>(null)
const isLoading = ref(false)
const isLocating = ref(false)
const mapRef = ref()

const { getCurrentPosition } = useGeolocation()
const { searchNearby } = useFacilitySearch()

async function loadFacilities() {
  isLoading.value = true
  try {
    const result = await searchNearby({
      lat: mapCenter.value.lat,
      lng: mapCenter.value.lng,
      category: 'clothes',
      radius: 1000
    })
    facilities.value = result.items
    markers.value = result.items
  } finally {
    isLoading.value = false
  }
}

async function locateMe() {
  isLocating.value = true
  try {
    const position = await getCurrentPosition()
    mapCenter.value = { lat: position.lat, lng: position.lng }
    await loadFacilities()
  } catch (error) {
    console.error('Failed to get location:', error)
  } finally {
    isLocating.value = false
  }
}

function handleSearch() {
  loadFacilities()
}

function handleMarkerClick(facility: FacilitySearchItem) {
  selectedFacilityId.value = facility.id
}

function handleMapMove(center: { lat: number; lng: number }) {
  mapCenter.value = center
}

function handleSelectFacility(facility: FacilitySearchItem) {
  selectedFacilityId.value = facility.id
  mapRef.value?.panTo(facility.lat, facility.lng)
}

onMounted(() => {
  locateMe()
})
</script>
