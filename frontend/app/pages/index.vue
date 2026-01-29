<template>
  <div class="min-h-screen bg-gradient-to-b from-indigo-50 via-white to-gray-50">
    <!-- Hero Section -->
    <section class="py-12 md:py-20">
      <div data-testid="main-container" class="container mx-auto px-4 max-w-4xl">
        <!-- Title & Subtitle -->
        <div class="text-center mb-10">
          <h1 class="text-4xl md:text-5xl font-bold text-gray-900 mb-4 tracking-tight">
            일상킷
          </h1>
          <p class="text-xl md:text-2xl text-gray-700 font-medium mb-2">
            내 주변 생활 편의 정보, 한 번에 찾기
          </p>
          <p class="text-base md:text-lg text-gray-600">
            위치 기반으로 공공화장실, 쓰레기 배출, 무료 와이파이 정보를 통합 검색합니다.
          </p>
        </div>

        <!-- Search Section -->
        <div class="space-y-6 mb-12">
          <!-- Search Input -->
          <div class="max-w-xl mx-auto">
            <SearchInput
              v-model="searchKeyword"
              placeholder="지역명 또는 시설명을 입력하세요"
              @search="handleSearch"
            />
          </div>

          <!-- Category Chips -->
          <div class="max-w-3xl mx-auto">
            <CategoryChips
              :categories="categories"
              :selected-category="selectedCategory"
              @select="handleCategorySelect"
            />
          </div>

          <!-- Current Location Button -->
          <div class="text-center">
            <button
              data-testid="location-button"
              type="button"
              class="inline-flex items-center gap-2 px-6 py-3 bg-white border-2 border-indigo-600 text-indigo-600 rounded-lg font-medium hover:bg-indigo-600 hover:text-white transition-all shadow-md hover:shadow-lg"
              @click="handleLocationSearch"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                stroke-width="2"
                stroke="currentColor"
                class="w-5 h-5"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z"
                />
              </svg>
              현재 위치에서 검색
            </button>
          </div>
        </div>

        <!-- Popular Regions -->
        <div class="max-w-3xl mx-auto">
          <h2 class="text-lg font-bold text-gray-900 mb-4">인기 지역</h2>
          <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
            <button
              v-for="region in popularRegions"
              :key="region"
              :data-testid="`region-${region}`"
              type="button"
              class="px-4 py-3 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:border-indigo-500 hover:bg-indigo-50 hover:text-indigo-700 transition-all"
              @click="handleRegionClick(region)"
            >
              {{ region }}
            </button>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import SearchInput from '~/app/components/search/SearchInput.vue'
import CategoryChips from '~/app/components/category/CategoryChips.vue'

const searchKeyword = ref('')
const selectedCategory = ref<string | null>(null)

const categories = [
  { id: 'toilet', label: '공공화장실' },
  { id: 'trash', label: '쓰레기 배출' },
  { id: 'wifi', label: '무료 와이파이' },
  { id: 'clothes', label: '의류수거함' },
  { id: 'kiosk', label: '무인민원발급기' },
]

const popularRegions = [
  '서울 강남구',
  '서울 송파구',
  '부산 해운대구',
  '경기 수원시',
  '인천 연수구',
  '대전 유성구',
]

function handleSearch() {
  // Don't navigate if both keyword and category are empty
  if (!searchKeyword.value && !selectedCategory.value) {
    return
  }

  const params = new URLSearchParams()
  if (searchKeyword.value) {
    params.append('keyword', searchKeyword.value)
  }
  if (selectedCategory.value) {
    params.append('category', selectedCategory.value)
  }

  navigateTo(`/search?${params.toString()}`)
}

function handleCategorySelect(categoryId: string | null) {
  selectedCategory.value = categoryId
}

function handleLocationSearch() {
  // Placeholder for geolocation feature
  // TODO: Implement geolocation-based search
  console.log('Location search requested')
}

function handleRegionClick(region: string) {
  navigateTo(`/search?keyword=${encodeURIComponent(region)}`)
}
</script>
