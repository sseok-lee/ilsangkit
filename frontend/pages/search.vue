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
      <!-- Scrollable Filter Chips -->
      <div class="px-4 pb-2 w-full overflow-x-auto no-scrollbar flex items-center gap-2">
        <!-- Category Chips with Icons -->
        <button
          v-for="cat in categoryTabs"
          :key="cat.id"
          :aria-label="`${cat.label} 카테고리 필터`"
          :aria-pressed="selectedCategory === cat.id"
          :class="[
            'shrink-0 px-3 py-2 rounded-2xl text-sm font-semibold transition-transform active:scale-95 flex items-center gap-1.5',
            selectedCategory === cat.id
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
          ]"
          @click="handleCategoryChange(cat.id)"
        >
          <CategoryIcon v-if="cat.id !== 'all'" :category-id="cat.id" size="sm" />
          <span v-else class="material-symbols-outlined text-[18px]">apps</span>
          {{ cat.label }}
        </button>
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
        <!-- Category Tabs (Desktop) - pill style -->
        <nav class="hidden lg:flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button
            v-for="cat in categoryTabs"
            :key="cat.id"
            :aria-label="`${cat.label} 카테고리 필터`"
            :aria-pressed="selectedCategory === cat.id"
            :class="[
              'px-4 py-1.5 rounded-md text-sm font-medium leading-normal transition-all',
              selectedCategory === cat.id
                ? 'bg-white dark:bg-slate-700 shadow-sm text-primary font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200',
            ]"
            @click="handleCategoryChange(cat.id)"
          >
            {{ cat.label }}
          </button>
        </nav>

        <!-- Divider -->
        <div class="h-8 w-[1px] bg-slate-200 dark:bg-slate-700 hidden lg:block"></div>

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

      <!-- Trash category: waste schedule UI -->
      <template v-if="selectedCategory === 'trash'">
        <div class="mb-4">
          <p class="text-slate-900 dark:text-white text-base font-bold">쓰레기 배출 일정</p>
          <p class="text-slate-500 dark:text-slate-400 text-xs mt-0.5">지역을 선택하여 배출 일정을 확인하세요</p>
        </div>

        <!-- 지역 선택 드롭다운 -->
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
              @change="handleCityChange(selectedCity)"
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
              @change="handleDistrictChange(selectedDistrict)"
            >
              <option value="">구/군 선택</option>
              <option v-for="dist in districts" :key="dist" :value="dist">{{ dist }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
          </div>
          <!-- 동/지역 이름 검색 -->
          <div class="relative">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
            </div>
            <input
              v-model="wasteKeyword"
              class="w-full bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg py-2.5 pl-9 pr-3 text-slate-900 dark:text-white text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              type="text"
              placeholder="동/지역 이름 검색"
              @input="handleWasteSearch"
            />
          </div>
        </div>

        <!-- 로딩 상태 -->
        <div v-if="wasteLoading" class="flex items-center justify-center py-10" aria-live="polite" aria-busy="true">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p class="text-slate-500 dark:text-slate-400 text-sm">배출 일정 조회 중...</p>
          </div>
        </div>

        <!-- 담당 부서 연락처 -->
        <div v-if="wasteContact && !wasteLoading" class="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 border border-blue-100 dark:border-blue-800 mb-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-blue-500 text-[18px]">support_agent</span>
            <span class="font-semibold text-blue-900 dark:text-blue-100 text-sm">{{ wasteContact.name }}</span>
          </div>
          <a
            v-if="wasteContact.phone"
            :href="`tel:${wasteContact.phone}`"
            class="text-blue-600 dark:text-blue-400 text-sm hover:underline flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[16px]">call</span>
            {{ wasteContact.phone }}
          </a>
        </div>

        <!-- 배출 일정 목록 -->
        <template v-if="wasteSchedules.length > 0 && !wasteLoading">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-slate-900 dark:text-white text-base font-bold">배출 일정</h2>
            <span class="text-xs text-slate-500 font-medium">{{ wasteTotal }}건</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <WasteScheduleCard
              v-for="region in wasteSchedules"
              :key="region.id"
              :region="region"
            />
          </div>
        </template>

        <!-- 쓰레기 페이지네이션 -->
        <div v-if="wasteTotalPages > 1 && !wasteLoading" class="flex justify-center items-center space-x-4 py-8">
          <button
            :disabled="wasteCurrentPage === 1"
            class="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 text-sm font-medium"
            @click="goToWastePage(wasteCurrentPage - 1)"
          >
            이전
          </button>
          <span class="text-slate-700 dark:text-slate-300 text-sm">
            {{ wasteCurrentPage }} / {{ wasteTotalPages }}
          </span>
          <button
            :disabled="wasteCurrentPage === wasteTotalPages"
            class="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:border-slate-700 dark:hover:bg-slate-800 text-sm font-medium"
            @click="goToWastePage(wasteCurrentPage + 1)"
          >
            다음
          </button>
        </div>

        <!-- 결과 없음 -->
        <div v-if="wasteSchedules.length === 0 && !wasteLoading" class="py-10 text-center">
          <div class="text-4xl mb-4">📭</div>
          <p class="text-slate-600 dark:text-slate-400 font-medium">등록된 배출 일정이 없습니다</p>
          <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
        </div>
      </template>

      <!-- Non-trash: region filters + card grid -->
      <template v-else>
        <!-- Region Filter Card (unified with trash style) -->
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
              @change="handleCityChange(selectedCity)"
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
              @change="handleDistrictChange(selectedDistrict)"
            >
              <option value="">구/군 선택</option>
              <option v-for="dist in districts" :key="dist" :value="dist">{{ dist }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
          </div>
        </div>

        <!-- Results count -->
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-slate-900 dark:text-white text-base font-bold">
            {{ searchTitle }}
          </h1>
          <span class="text-xs text-slate-500 font-medium">{{ total }}건</span>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex items-center justify-center py-20" aria-live="polite" aria-busy="true">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p class="text-slate-500 dark:text-slate-400 text-sm">검색 중...</p>
          </div>
        </div>

        <template v-else>
          <!-- Card Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FacilityCard
              v-for="facility in facilities"
              :key="facility.id"
              :facility="facility"
            />
          </div>

          <!-- Empty State -->
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
import type { RegionSchedule } from '~/composables/useWasteSchedule'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()
const { setSearchMeta } = useFacilityMeta()
const { setItemListSchema } = useStructuredData()

// Search State
const { loading, facilities, total, currentPage, totalPages, error, search, resetPage, setPage, clearResults } = useFacilitySearch()

// Waste Schedule State (지역 기반 검색)
const { getCities, getDistricts, getSchedules, isLoading: wasteLoading } = useWasteSchedule()

const selectedCity = ref<string>('')
const selectedDistrict = ref<string>('')
const wasteKeyword = ref<string>('')
const cities = ref<string[]>([])
const districts = ref<string[]>([])
const wasteSchedules = ref<RegionSchedule[]>([])
const wasteContact = ref<{ name: string; phone?: string } | null>(null)
const wasteCurrentPage = ref(1)
const wasteTotalPages = ref(1)
const wasteTotal = ref(0)

// UI State
const searchKeyword = ref('')
const selectedCategory = ref<FacilityCategory | 'all'>('all')

// Category tabs
const categoryTabs = [
  { id: 'all' as const, label: '전체' },
  { id: 'toilet' as const, label: '화장실' },
  { id: 'wifi' as const, label: '와이파이' },
  { id: 'clothes' as const, label: '의류수거함' },
  { id: 'kiosk' as const, label: '발급기' },
  { id: 'parking' as const, label: '주차장' },
  { id: 'aed' as const, label: 'AED' },
  { id: 'library' as const, label: '도서관' },
  { id: 'trash' as const, label: '쓰레기' },
]

// Computed
const searchTitle = computed(() => {
  if (searchKeyword.value) {
    return `"${searchKeyword.value}" 검색 결과`
  }
  return '주변 시설'
})

// Methods
const performSearch = async () => {
  // trash는 시설 검색이 아닌 별도 waste-schedules API 사용
  if (selectedCategory.value === 'trash') return

  const params: Record<string, unknown> = {
    page: currentPage.value,
    limit: 20,
  }

  if (searchKeyword.value) {
    params.keyword = searchKeyword.value
  }

  if (selectedCategory.value && selectedCategory.value !== 'all') {
    params.category = selectedCategory.value
  }

  // Region filters
  if (selectedCity.value) params.city = selectedCity.value
  if (selectedDistrict.value) params.district = selectedDistrict.value

  search(params)
}

const handleSearch = () => {
  resetPage()
  performSearch()
}

const clearSearch = () => {
  searchKeyword.value = ''
  handleSearch()
}

const loadWasteSchedules = async () => {
  const result = await getSchedules({
    city: selectedCity.value || undefined,
    district: selectedDistrict.value || undefined,
    keyword: wasteKeyword.value || undefined,
    page: wasteCurrentPage.value,
    limit: 20,
  })
  wasteSchedules.value = result.schedules
  wasteContact.value = result.contact || null
  wasteTotal.value = result.total
  wasteTotalPages.value = result.totalPages
}

const handleCategoryChange = async (category: FacilityCategory | 'all') => {
  selectedCategory.value = category
  resetPage()

  if (category === 'trash') {
    // 쓰레기 선택 시 시/도 목록 로드
    if (cities.value.length === 0) {
      cities.value = await getCities()
    }
    // 기존 검색 결과 초기화
    clearResults()
    // 즉시 전체 데이터 로드
    wasteCurrentPage.value = 1
    await loadWasteSchedules()
  } else {
    // 쓰레기 관련 상태 초기화
    wasteKeyword.value = ''
    wasteSchedules.value = []
    wasteContact.value = null
    performSearch()
  }
}

const handleCityChange = async (city: string) => {
  selectedCity.value = city
  selectedDistrict.value = ''
  wasteKeyword.value = ''

  if (city) {
    districts.value = await getDistricts(city)
  } else {
    districts.value = []
  }

  if (selectedCategory.value === 'trash') {
    wasteCurrentPage.value = 1
    await loadWasteSchedules()
  } else {
    resetPage()
    performSearch()
  }
}

const handleDistrictChange = async (district: string) => {
  selectedDistrict.value = district
  wasteKeyword.value = ''

  if (selectedCategory.value === 'trash') {
    wasteCurrentPage.value = 1
    await loadWasteSchedules()
  } else {
    resetPage()
    performSearch()
  }
}

let wasteSearchTimer: ReturnType<typeof setTimeout> | null = null

const handleWasteSearch = () => {
  if (wasteSearchTimer) clearTimeout(wasteSearchTimer)
  wasteSearchTimer = setTimeout(async () => {
    wasteCurrentPage.value = 1
    await loadWasteSchedules()
  }, 300)
}

const goToWastePage = async (page: number) => {
  wasteCurrentPage.value = page
  await loadWasteSchedules()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const goToPage = (page: number) => {
  setPage(page)
  performSearch()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Watch for route query changes
watch(
  () => route.query,
  (query, oldQuery) => {
    const keywordChanged = query.keyword !== oldQuery?.keyword
    const categoryChanged = query.category !== oldQuery?.category

    if (query.keyword) {
      searchKeyword.value = query.keyword as string
    } else if (keywordChanged) {
      searchKeyword.value = ''
    }

    if (query.category) {
      const newCategory = query.category as FacilityCategory
      if (categoryChanged) {
        handleCategoryChange(newCategory)
      } else {
        selectedCategory.value = newCategory
      }
    } else if (categoryChanged) {
      handleCategoryChange('all')
    }

    if (keywordChanged && !categoryChanged) {
      resetPage()
      performSearch()
    }
  },
  { immediate: true }
)

// SSR: 초기 쿼리 파라미터에서 메타태그 설정 (top-level)
const initialKeyword = (route.query.keyword as string) || ''
const initialCategory = route.query.category as FacilityCategory | undefined
setSearchMeta({
  keyword: initialKeyword || undefined,
  category: initialCategory || undefined,
})

// Lifecycle
onMounted(async () => {
  // Read initial query params
  if (route.query.keyword) {
    searchKeyword.value = route.query.keyword as string
  }
  if (route.query.category) {
    selectedCategory.value = route.query.category as FacilityCategory
  }

  // Load cities for region filter
  cities.value = await getCities()

  // Initial search
  performSearch()
})

// 검색 조건 변경 시 메타태그 업데이트
watch([searchKeyword, selectedCategory], () => {
  setSearchMeta({
    keyword: searchKeyword.value || undefined,
    category: selectedCategory.value !== 'all' ? selectedCategory.value : undefined,
  })
})

// ItemList 구조화 데이터 + 페이지네이션 link 태그
watch([facilities, currentPage, totalPages], () => {
  if (facilities.value.length > 0 && selectedCategory.value !== 'trash') {
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
  if (selectedCategory.value !== 'all') queryParams.set('category', selectedCategory.value)
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
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 20px;
}
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background-color: #94a3b8;
}

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
