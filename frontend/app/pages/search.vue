<template>
  <div class="min-h-screen bg-gray-50">
    <div class="container mx-auto px-4 py-6">
      <!-- Search Header -->
      <div class="mb-6">
        <h1 class="text-2xl font-bold text-gray-900 mb-2">검색 결과</h1>
        <p v-if="!error" class="text-gray-600">
          총 <span class="font-semibold text-primary-600">{{ total }}</span>개의 시설을 찾았습니다
        </p>
      </div>

      <!-- Error State -->
      <div
        v-if="error"
        class="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700"
      >
        ⚠️ {{ error }}
      </div>

      <!-- View Toggle (Mobile/Desktop) -->
      <div class="mb-6 flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'list'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
            ]"
            @click="viewMode = 'list'"
          >
            📋 목록
          </button>
          <button
            :class="[
              'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              viewMode === 'map'
                ? 'bg-primary-600 text-white'
                : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
            ]"
            @click="viewMode = 'map'"
          >
            🗺️ 지도
          </button>
        </div>
      </div>

      <!-- Main Content (Responsive Layout) -->
      <div class="grid grid-cols-1 md:grid-cols-12 gap-6">
        <!-- Left Sidebar - Filters (Desktop) -->
        <aside class="md:col-span-3">
          <SearchFilters
            :category="selectedCategory"
            :sort="selectedSort"
            @update:category="handleCategoryChange"
            @update:sort="handleSortChange"
          />
        </aside>

        <!-- Main Content Area -->
        <main class="md:col-span-9">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
            <!-- Left: Facility List (always visible in list mode) -->
            <div :class="viewMode === 'map' && 'md:col-span-1'">
              <FacilityList :facilities="facilities" :loading="loading" />
            </div>

            <!-- Right: Map Placeholder (only in map mode, Phase 4) -->
            <div
              v-if="viewMode === 'map'"
              class="hidden md:block bg-white border border-gray-200 rounded-xl p-8 h-[600px]"
            >
              <div class="flex flex-col items-center justify-center h-full text-gray-400">
                <div class="text-6xl mb-4">🗺️</div>
                <p class="text-lg font-medium">지도 뷰</p>
                <p class="text-sm">Phase 4에서 구현 예정</p>
              </div>
            </div>
          </div>

          <!-- Pagination -->
          <div
            v-if="totalPages > 1"
            class="mt-8 flex items-center justify-center gap-2"
          >
            <button
              :disabled="currentPage === 1"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentPage === 1
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
              ]"
              @click="handlePageChange(currentPage - 1)"
            >
              이전
            </button>

            <div class="flex items-center gap-1" data-testid="pagination">
              <button
                v-for="page in displayPages"
                :key="page"
                :class="[
                  'px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                  page === currentPage
                    ? 'bg-primary-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
                ]"
                @click="handlePageChange(page)"
              >
                {{ page }}
              </button>
            </div>

            <button
              :disabled="currentPage === totalPages"
              :class="[
                'px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                currentPage === totalPages
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-50',
              ]"
              @click="handlePageChange(currentPage + 1)"
            >
              다음
            </button>
          </div>
        </main>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()
const router = useRouter()

// Search State
const { loading, facilities, total, currentPage, totalPages, error, search } =
  useFacilitySearch()

// UI State
const viewMode = ref<'list' | 'map'>('list')
const selectedCategory = ref<FacilityCategory | undefined>(undefined)
const selectedSort = ref<'distance' | 'name'>('distance')

// Computed
const displayPages = computed(() => {
  const pages: number[] = []
  const maxDisplay = 5
  const half = Math.floor(maxDisplay / 2)

  let start = Math.max(1, currentPage.value - half)
  let end = Math.min(totalPages.value, start + maxDisplay - 1)

  if (end - start < maxDisplay - 1) {
    start = Math.max(1, end - maxDisplay + 1)
  }

  for (let i = start; i <= end; i++) {
    pages.push(i)
  }

  return pages
})

// Methods
const performSearch = () => {
  const params: any = {}

  if (route.query.keyword) {
    params.keyword = route.query.keyword as string
  }

  if (selectedCategory.value) {
    params.category = selectedCategory.value
  }

  if (selectedSort.value) {
    params.sort = selectedSort.value
  }

  params.page = currentPage.value
  params.limit = 20

  search(params)
}

const handleCategoryChange = (category: FacilityCategory | undefined) => {
  selectedCategory.value = category
  performSearch()
}

const handleSortChange = (sort: 'distance' | 'name') => {
  selectedSort.value = sort
  performSearch()
}

const handlePageChange = (page: number) => {
  if (page < 1 || page > totalPages.value) return

  // Update URL query
  router.push({
    query: {
      ...route.query,
      page: page.toString(),
    },
  })

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' })

  performSearch()
}

// Lifecycle
onMounted(() => {
  // Read query params
  if (route.query.category) {
    selectedCategory.value = route.query.category as FacilityCategory
  }

  if (route.query.sort) {
    selectedSort.value = route.query.sort as 'distance' | 'name'
  }

  // Initial search
  performSearch()
})
</script>
