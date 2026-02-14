<template>
  <div class="bg-background-light dark:bg-background-dark text-slate-900 dark:text-white font-display min-h-screen">
    <!-- Mobile Header with Back Button + Search -->
    <header class="md:hidden sticky top-0 z-30 bg-background-light/95 dark:bg-background-dark/95 backdrop-blur-md transition-colors duration-200">
      <!-- Top Search Bar Area -->
      <div class="px-4 py-3 flex items-center gap-3">
        <!-- Back Button -->
        <button
          aria-label="뒤로가기"
          class="shrink-0 flex items-center justify-center w-11 h-11 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
          @click="$router.back()"
        >
          <span class="material-symbols-outlined text-slate-700 dark:text-slate-200 text-[24px]">arrow_back</span>
        </button>
        <!-- Search Input -->
        <div class="flex-1 relative group">
          <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <span class="material-symbols-outlined text-slate-400 text-[20px]">search</span>
          </div>
          <input
            v-model="searchKeyword"
            aria-label="시설 검색"
            class="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-3 pl-10 pr-10 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-primary/20 shadow-sm text-base font-medium"
            type="text"
            placeholder="장소를 검색하세요..."
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchKeyword"
            aria-label="검색어 지우기"
            class="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            @click="clearSearch"
          >
            <span class="material-symbols-outlined text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-[20px]">cancel</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Desktop Header -->
    <header class="hidden md:flex items-center justify-between whitespace-nowrap border-b border-solid border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 py-3 z-20 shadow-sm">
      <div class="flex items-center gap-8">
        <!-- Persistent Search (Desktop) -->
        <label class="flex flex-col min-w-64 h-10 lg:w-96">
          <div
            class="flex w-full flex-1 items-stretch rounded-xl h-full bg-slate-100 dark:bg-slate-800 transition-colors focus-within:ring-2 focus-within:ring-primary/20"
          >
            <div class="text-slate-400 flex border-none items-center justify-center pl-3">
              <span class="material-symbols-outlined text-[20px]">search</span>
            </div>
            <input
              v-model="searchKeyword"
              aria-label="시설 검색"
              class="form-input flex w-full min-w-0 flex-1 resize-none overflow-hidden rounded-xl text-slate-900 dark:text-white focus:outline-0 focus:ring-0 border-none bg-transparent h-full placeholder:text-slate-400 px-3 text-sm font-normal leading-normal"
              placeholder="장소를 검색하세요..."
              @keyup.enter="handleSearch"
            />
            <button
              v-if="searchKeyword"
              class="px-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              @click="clearSearch"
            >
              <span class="material-symbols-outlined text-[20px]">cancel</span>
            </button>
          </div>
        </label>
      </div>

      <!-- Right Side Nav -->
      <div class="flex items-center gap-6">
        <!-- Bookmark button -->
        <button class="text-slate-500 hover:text-primary transition-colors">
          <span class="material-symbols-outlined">bookmark</span>
        </button>
      </div>
    </header>

    <!-- Main Content -->
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-4">
      <!-- Error State -->
      <div
        v-if="error"
        role="alert"
        class="p-5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-sm mb-4"
      >
        {{ error }}
      </div>

      <!-- Region Filter Card -->
      <div class="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-100 dark:border-slate-700 space-y-3 mb-4">
        <div class="flex items-center gap-2 mb-2">
          <span class="material-symbols-outlined text-amber-500 text-[20px]">location_city</span>
          <span class="font-semibold text-slate-900 dark:text-white text-sm">지역 선택</span>
        </div>
        <!-- 시/도 선택 -->
        <div class="relative">
          <select
            v-model="selectedCity"
            class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 px-3 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            @change="handleCityChange"
          >
            <option value="">시/도 선택</option>
            <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
          </select>
          <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
        </div>
        <!-- 구/군 선택 -->
        <div class="relative">
          <select
            v-model="selectedDistrict"
            :disabled="!selectedCity"
            class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 px-3 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            @change="handleDistrictChange"
          >
            <option value="">구/군 선택</option>
            <option v-for="dist in districts" :key="dist" :value="dist">{{ dist }}</option>
          </select>
          <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
        </div>
      </div>

      <!-- Category Chip Bar -->
      <div v-if="groupedResults.length > 0 || selectedCategory" class="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        <button
          :class="[
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border',
            !selectedCategory
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/40',
          ]"
          @click="selectCategory(null)"
        >
          전체 ({{ displayTotalCount }})
        </button>
        <button
          v-for="group in groupedResults"
          :key="group.category"
          :class="[
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border',
            selectedCategory === group.category
              ? 'bg-primary text-white border-primary'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-primary/40',
          ]"
          @click="selectCategory(group.category)"
        >
          {{ CATEGORY_META[group.category]?.icon }} {{ CATEGORY_META[group.category]?.shortLabel || group.label }} ({{ group.count }})
        </button>
      </div>

      <!-- Results count -->
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-slate-900 dark:text-white text-base font-bold">
          {{ searchTitle }}
        </h1>
        <span class="text-xs text-slate-500 font-medium">{{ displayTotalCount }}건</span>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="flex items-center justify-center py-20" aria-live="polite" aria-busy="true">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p class="text-slate-500 dark:text-slate-400 text-sm">검색 중...</p>
        </div>
      </div>

      <template v-else>
        <!-- Grouped View (no category selected) -->
        <div v-if="!selectedCategory && groupedResults.length > 0" class="space-y-6">
          <div
            v-for="group in groupedResults"
            :key="group.category"
            class="bg-white dark:bg-slate-800 rounded-xl p-5 shadow-sm border border-slate-100 dark:border-slate-700"
          >
            <!-- Group Header -->
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <span class="text-lg">{{ CATEGORY_META[group.category]?.icon }}</span>
                <h2 class="text-slate-900 dark:text-white text-base font-bold">
                  {{ group.label }}
                </h2>
                <span class="text-xs text-slate-400 font-medium">({{ group.count }}건)</span>
              </div>
              <button
                class="text-primary text-sm font-medium hover:underline flex items-center gap-1"
                @click="selectCategory(group.category)"
              >
                전체 {{ group.count }}건 보기
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
            <!-- Preview Cards -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <FacilityCard
                v-for="facility in group.items"
                :key="facility.id"
                :facility="facility"
              />
            </div>
          </div>
        </div>

        <!-- Flat View (category selected) -->
        <template v-if="selectedCategory">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FacilityCard
              v-for="facility in facilities"
              :key="facility.id"
              :facility="facility"
            />
          </div>

          <!-- Empty State (flat view) -->
          <div v-if="facilities.length === 0" class="py-20 text-center">
            <div class="text-5xl mb-4">🔍</div>
            <p class="text-slate-600 dark:text-slate-400 font-medium">검색 결과가 없습니다</p>
            <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">다른 검색어를 입력해보세요</p>
          </div>

          <!-- Pagination -->
          <div v-if="totalPages > 1" class="flex justify-center items-center space-x-4 py-8">
            <button
              :disabled="currentPage === 1"
              class="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 text-sm font-medium"
              @click="goToPage(currentPage - 1)"
            >
              이전
            </button>
            <span class="text-slate-700 dark:text-slate-300 text-sm">
              {{ currentPage }} / {{ totalPages }}
            </span>
            <button
              :disabled="currentPage === totalPages"
              class="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 text-sm font-medium"
              @click="goToPage(currentPage + 1)"
            >
              다음
            </button>
          </div>
        </template>

        <!-- Empty State (grouped view) -->
        <div v-if="!selectedCategory && groupedResults.length === 0" class="py-20 text-center">
          <div class="text-5xl mb-4">🔍</div>
          <p class="text-slate-600 dark:text-slate-400 font-medium">검색 결과가 없습니다</p>
          <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">다른 검색어를 입력해보세요</p>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()
const { setSearchMeta } = useFacilityMeta()
const { setItemListSchema } = useStructuredData()

// Search State
const {
  loading, facilities, total, currentPage, totalPages, error,
  groupedResults, groupedTotalCount,
  search, searchGrouped, resetPage, setPage,
} = useFacilitySearch()

// Region dropdowns (reuse waste schedule API for city/district lists)
const { getCities, getDistricts } = useWasteSchedule()

const selectedCity = ref('')
const selectedDistrict = ref('')
const cities = ref<string[]>([])
const districts = ref<string[]>([])

// UI State
const searchKeyword = ref('')
const selectedCategory = ref<FacilityCategory | null>(null)

// Computed
const searchTitle = computed(() => {
  const categoryLabel = selectedCategory.value
    ? CATEGORY_META[selectedCategory.value]?.label
    : null

  if (searchKeyword.value && categoryLabel) {
    return `"${searchKeyword.value}" ${categoryLabel} 검색 결과`
  }
  if (searchKeyword.value) {
    return `"${searchKeyword.value}" 검색 결과`
  }
  if (categoryLabel) {
    return `${categoryLabel} 검색 결과`
  }
  return '주변 시설'
})

const displayTotalCount = computed(() => {
  if (selectedCategory.value) {
    return total.value
  }
  return groupedTotalCount.value
})

// Build common search params
function buildSearchParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  if (searchKeyword.value) params.keyword = searchKeyword.value
  if (selectedCity.value) params.city = selectedCity.value
  if (selectedDistrict.value) params.district = selectedDistrict.value
  return params
}

// Methods
function performSearch() {
  if (selectedCategory.value) {
    // Flat view: single category with pagination
    search({
      ...buildSearchParams(),
      category: selectedCategory.value,
      page: currentPage.value,
      limit: 20,
    })
  } else {
    // Grouped view
    searchGrouped(buildSearchParams())
  }
}

function handleSearch() {
  selectedCategory.value = null
  resetPage()
  performSearch()
}

function clearSearch() {
  searchKeyword.value = ''
  handleSearch()
}

function selectCategory(category: FacilityCategory | null) {
  selectedCategory.value = category
  resetPage()
  performSearch()
}

async function handleCityChange() {
  selectedDistrict.value = ''

  if (selectedCity.value) {
    districts.value = await getDistricts(selectedCity.value)
  } else {
    districts.value = []
  }

  selectedCategory.value = null
  resetPage()
  performSearch()
}

function handleDistrictChange() {
  selectedCategory.value = null
  resetPage()
  performSearch()
}

function goToPage(page: number) {
  setPage(page)
  performSearch()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// SSR redirect: /search?category=X → /X (301)
const validCategoryList = ['toilet', 'trash', 'wifi', 'clothes', 'kiosk', 'parking', 'aed', 'library']
if (route.query.category && validCategoryList.includes(route.query.category as string)) {
  const redirectCategory = route.query.category as string
  const redirectParams = new URLSearchParams()
  if (route.query.keyword) redirectParams.set('keyword', String(route.query.keyword))
  const redirectQuery = redirectParams.toString()
  navigateTo(`/${redirectCategory}${redirectQuery ? '?' + redirectQuery : ''}`, { replace: true, redirectCode: 301 })
}

// 검색 결과 페이지는 크롤링 방지 (중복 콘텐츠 인덱싱 방지)
useHead({ meta: [{ name: 'robots', content: 'noindex, follow' }] })

// SSR: 초기 쿼리 파라미터에서 메타태그 설정
const initialKeyword = (route.query.keyword as string) || ''
setSearchMeta({
  keyword: initialKeyword || undefined,
})

// Watch for route query changes (keyword only)
watch(
  () => route.query.keyword,
  (newKeyword, oldKeyword) => {
    if (newKeyword !== oldKeyword) {
      searchKeyword.value = (newKeyword as string) || ''
      selectedCategory.value = null
      resetPage()
      performSearch()
    }
  }
)

// Lifecycle
onMounted(async () => {
  // Redirect /search?category=X → /X (client-side fallback)
  if (route.query.category) {
    const category = route.query.category as string
    if (validCategoryList.includes(category)) {
      const params = new URLSearchParams()
      if (route.query.keyword) params.set('keyword', String(route.query.keyword))
      const queryStr = params.toString()
      navigateTo(`/${category}${queryStr ? '?' + queryStr : ''}`, { replace: true, redirectCode: 301 })
      return
    }
  }

  // Read initial query params
  if (route.query.keyword) {
    searchKeyword.value = route.query.keyword as string
  }

  // Load cities for region filter
  cities.value = await getCities()

  // Initial search (grouped)
  performSearch()
})

// 검색 조건 변경 시 메타태그 업데이트
watch(searchKeyword, () => {
  setSearchMeta({
    keyword: searchKeyword.value || undefined,
  })
})

// ItemList 구조화 데이터 + 페이지네이션 link 태그 (flat view only)
watch([facilities, currentPage, totalPages], () => {
  if (facilities.value.length > 0) {
    setItemListSchema(
      facilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  // 페이지네이션 rel link 태그
  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = 'https://ilsangkit.co.kr/search'
  const queryParams = new URLSearchParams()
  if (searchKeyword.value) queryParams.set('keyword', searchKeyword.value)
  const baseQuery = queryParams.toString()

  if (currentPage.value > 1) {
    const prevParams = new URLSearchParams(baseQuery)
    prevParams.set('page', String(currentPage.value - 1))
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?${prevParams.toString()}` })
  }
  if (currentPage.value < totalPages.value) {
    const nextParams = new URLSearchParams(baseQuery)
    nextParams.set('page', String(currentPage.value + 1))
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?${nextParams.toString()}` })
  }

  useHead({ link: paginationLinks })
})
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Material Icon fill variant */
.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
