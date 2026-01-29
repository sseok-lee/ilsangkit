<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header with back button -->
    <div class="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="flex items-center h-16">
          <button
            @click="router.back()"
            class="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span class="text-sm font-medium">뒤로가기</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p class="text-gray-600">로딩 중...</p>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-white rounded-lg shadow-sm p-8 text-center">
        <svg
          class="w-16 h-16 text-red-500 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
          />
        </svg>
        <h2 class="text-xl font-semibold text-gray-900 mb-2">시설 정보를 불러올 수 없습니다</h2>
        <p class="text-gray-600 mb-6">{{ error.message }}</p>
        <button
          @click="router.back()"
          class="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          돌아가기
        </button>
      </div>

      <!-- Facility Detail -->
      <div v-else-if="facility" class="lg:grid lg:grid-cols-12 lg:gap-8">
        <!-- Left Column: Detail Info (Mobile: Full Width, Desktop: 7 cols) -->
        <div class="lg:col-span-7">
          <div class="bg-white rounded-lg shadow-sm overflow-hidden">
            <FacilityDetail :facility="facility">
              <template #map>
                <!-- Map placeholder for Phase 4 -->
                <div class="h-64 bg-gray-100 flex items-center justify-center">
                  <p class="text-gray-500">지도 (Phase 4에서 구현 예정)</p>
                </div>
              </template>
            </FacilityDetail>

            <!-- Navigation Links -->
            <div class="p-6 bg-gray-50 border-t border-gray-200">
              <h3 class="text-sm font-semibold text-gray-900 mb-3">길찾기</h3>
              <div class="grid grid-cols-2 gap-3">
                <a
                  :href="kakaoMapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-gray-900 rounded-lg hover:bg-yellow-500 transition-colors font-medium"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 3c5.799 0 10.5 3.664 10.5 8.185 0 4.52-4.701 8.184-10.5 8.184a13.5 13.5 0 0 1-1.727-.11l-4.408 2.883c-.501.265-.678.236-.472-.413l.892-3.678c-2.88-1.46-4.785-3.99-4.785-6.866C1.5 6.665 6.201 3 12 3z"/>
                  </svg>
                  <span>카카오맵</span>
                </a>
                <a
                  :href="naverMapUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium"
                >
                  <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M16.273 12.845L7.376 0H0v24h7.726V11.156L16.624 24H24V0h-7.727v12.845z"/>
                  </svg>
                  <span>네이버지도</span>
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Map (Desktop Only, 5 cols) -->
        <div class="hidden lg:block lg:col-span-5">
          <div class="sticky top-24">
            <div class="bg-white rounded-lg shadow-sm overflow-hidden">
              <div class="h-96 bg-gray-100 flex items-center justify-center">
                <p class="text-gray-500">지도 (Phase 4에서 구현 예정)</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilityDetail } from '../../../composables/useFacilityDetail'
import type { FacilityCategory } from '../../../types/facility'

const route = useRoute()
const router = useRouter()

const category = computed(() => route.params.category as FacilityCategory)
const id = computed(() => route.params.id as string)

const { loading, error, facility, fetchDetail } = useFacilityDetail()

// Fetch facility detail on mount
onMounted(async () => {
  await fetchDetail(category.value, id.value)
})

// Generate map URLs
const kakaoMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.kakao.com/link/map/${encodeURIComponent(name)},${lat},${lng}`
})

const naverMapUrl = computed(() => {
  if (!facility.value) return '#'
  const { lat, lng, name } = facility.value
  return `https://map.naver.com/v5/search/${encodeURIComponent(name)}/place?c=${lng},${lat},15,0,0,0,dh`
})
</script>
