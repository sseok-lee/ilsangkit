<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <!-- 히어로 -->
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="max-w-6xl mx-auto px-4 py-8 md:px-6 md:py-10">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
          {{ pageTitle }}
        </h1>
        <p class="mt-2 text-slate-500 text-sm">
          {{ pageDescription }}
        </p>
      </div>
    </div>

    <!-- Main Content -->
    <div class="max-w-6xl mx-auto px-4 md:px-6 pb-8">
      <!-- Error State -->
      <div
        v-if="facilityError"
        role="alert"
        class="p-5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4"
      >
        {{ facilityError }}
      </div>

      <!-- Category Intro -->
      <CategoryIntro :category="categoryParam" />

      <!-- Region Filter -->
      <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
        <div class="flex items-center gap-2 mb-3 md:hidden">
          <span class="material-symbols-outlined text-amber-500 text-[20px]">location_city</span>
          <span class="font-semibold text-slate-900 text-sm">지역 선택</span>
        </div>
        <div class="flex flex-col md:flex-row gap-3">
          <!-- 시/도 선택 -->
          <div class="flex-1">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">시/도</label>
            <div class="relative">
              <select
                v-model="selectedCity"
                aria-label="시/도 선택"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
                @change="handleCityChange"
              >
                <option value="">시/도 선택</option>
                <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          <!-- 구/군 선택 -->
          <div class="flex-1">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">구/군</label>
            <div class="relative">
              <select
                v-model="selectedDistrict"
                :disabled="!selectedCity"
                aria-label="구/군 선택"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                @change="handleDistrictChange"
              >
                <option value="">구/군 선택</option>
                <option v-for="dist in districtList" :key="dist" :value="dist">{{ dist }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          <!-- 키워드 검색 -->
          <div class="flex-1">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">키워드</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                <span class="material-symbols-outlined text-slate-400 text-[18px]">search</span>
              </div>
              <input
                v-model="filterKeyword"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-9 pr-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
                type="text"
                :placeholder="categoryParam === 'trash' ? '동/지역 이름 검색' : '시설명/주소 검색'"
                @input="handleFilterSearch"
              />
            </div>
          </div>
        </div>
      </div>

      <!-- Trash category: waste schedule UI -->
      <template v-if="categoryParam === 'trash'">
        <!-- 로딩 상태 -->
        <div v-if="wasteLoading || initialLoading" class="flex items-center justify-center py-10" role="status" aria-label="배출 일정 로딩 중" aria-live="polite" aria-busy="true">
          <div class="text-center">
            <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
            <p class="text-slate-500 text-sm">배출 일정 조회 중...</p>
          </div>
        </div>

        <!-- 담당 부서 연락처 -->
        <div v-if="wasteContact && !wasteLoading && !initialLoading" class="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
          <div class="flex items-center gap-2 mb-1">
            <span class="material-symbols-outlined text-blue-500 text-[18px]">support_agent</span>
            <span class="font-semibold text-blue-900 text-sm">{{ wasteContact.name }}</span>
          </div>
          <a
            v-if="wasteContact.phone"
            :href="`tel:${wasteContact.phone}`"
            class="text-blue-600 text-sm hover:underline flex items-center gap-1"
          >
            <span class="material-symbols-outlined text-[16px]">call</span>
            {{ wasteContact.phone }}
          </a>
        </div>

        <!-- 배출 일정 목록 -->
        <template v-if="wasteSchedules.length > 0 && !wasteLoading && !initialLoading">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-slate-900 text-base font-bold">배출 일정</h2>
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
        <Pagination v-if="!wasteLoading && !initialLoading" :current-page="wasteCurrentPage" :total-pages="wasteTotalPages" @page-change="goToWastePage" />

        <!-- 결과 없음 -->
        <div v-if="wasteSchedules.length === 0 && !wasteLoading && !initialLoading" class="py-16 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-[32px] text-slate-400">delete</span>
          </div>
          <p class="text-slate-700 font-semibold text-lg">등록된 배출 일정이 없습니다</p>
          <p class="text-slate-400 text-sm mt-1 mb-6">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
          <div class="flex items-center justify-center gap-3">
            <button
              v-if="selectedCity || selectedDistrict"
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
              @click="selectedCity = ''; selectedDistrict = ''; filterKeyword = ''; loadWasteSchedules()"
            >
              <span class="material-symbols-outlined text-[16px]">refresh</span>
              필터 초기화
            </button>
            <NuxtLink
              to="/"
              class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
            >
              <span class="material-symbols-outlined text-[16px]">home</span>
              홈으로 돌아가기
            </NuxtLink>
          </div>
        </div>
      </template>

      <!-- Non-trash: facility card grid -->
      <template v-else>
        <!-- Results bar: title + count -->
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-slate-900 text-base font-bold">
            {{ resultTitle }}
          </h2>
          <span class="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
            {{ total }}건
          </span>
        </div>

        <!-- Loading Skeleton -->
        <div v-if="loading || initialLoading" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
              <div class="flex items-start gap-4">
                <div class="shrink-0 w-12 h-12 rounded-full bg-slate-200"></div>
                <div class="flex-1 space-y-2.5">
                  <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                  <div class="h-3 bg-slate-100 rounded w-full"></div>
                  <div class="flex gap-2 mt-1">
                    <div class="h-5 bg-slate-100 rounded-md w-14"></div>
                    <div class="h-5 bg-slate-100 rounded-md w-20"></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <template v-else-if="!initialLoading">
          <!-- Card Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FacilityCard
              v-for="facility in facilities"
              :key="facility.id"
              :facility="facility"
            />
          </div>

          <!-- Empty State -->
          <div v-if="facilities.length === 0" class="py-16 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-[32px] text-slate-400">{{ categoryMeta?.icon || 'search_off' }}</span>
            </div>
            <p class="text-slate-700 font-semibold text-lg">검색 결과가 없습니다</p>
            <p class="text-slate-400 text-sm mt-1 mb-6">다른 지역이나 검색어를 시도해보세요</p>
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="selectedCity || selectedDistrict || filterKeyword"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="selectedCity = ''; selectedDistrict = ''; filterKeyword = ''; performSearch()"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                필터 초기화
              </button>
              <NuxtLink
                to="/"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </div>

          <!-- Pagination -->
          <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
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
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { CITY_SLUG_MAP, useRegions } from '~/composables/useRegions'
import type { RegionSchedule } from '~/composables/useWasteSchedule'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()

// Route params
const categoryParam = computed(() => route.params.category as FacilityCategory)
const categoryMeta = computed(() => CATEGORY_META[categoryParam.value])

// Validate category slug (Soft 404 방지)
if (!CATEGORY_META[route.params.category as FacilityCategory]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Query params (city slug → Korean name)
const queryCitySlug = computed(() => (route.query.city as string) || '')

// Search composables
const { loading, facilities, total, currentPage, totalPages, error: facilityError, search, resetPage, setPage } = useFacilitySearch()
const { getCities, getDistricts, getSchedules, isLoading: wasteLoading } = useWasteSchedule()
const { loadRegions, citiesWithDistricts } = useRegions()
const { setMeta } = useFacilityMeta()
const { setItemListSchema, setBreadcrumbSchema, setFAQSchema } = useStructuredData()

// Region state
const selectedCity = ref('')
const selectedDistrict = ref('')
const cities = ref<string[]>([])
const districtList = ref<string[]>([])

// Initial loading state (스켈레톤 표시용 - 첫 데이터 로드 전까지 true)
const initialLoading = ref(true)

// Filter state
const filterKeyword = ref('')
// Waste schedule state
const wasteSchedules = ref<RegionSchedule[]>([])
const wasteContact = ref<{ name: string; phone?: string } | null>(null)
const wasteCurrentPage = ref(1)
const wasteTotalPages = ref(1)
const wasteTotal = ref(0)

// Page title
const pageTitle = computed(() => {
  const catLabel = categoryMeta.value?.label || categoryParam.value
  if (selectedCity.value && selectedDistrict.value) {
    return `${selectedCity.value} ${selectedDistrict.value} ${catLabel}`
  }
  if (selectedCity.value) {
    return `${selectedCity.value} ${catLabel}`
  }
  return `전국 ${catLabel} 찾기`
})

const pageDescription = computed(() => {
  const catLabel = categoryMeta.value?.label || categoryParam.value
  if (selectedCity.value) {
    return `${selectedCity.value}${selectedDistrict.value ? ' ' + selectedDistrict.value : ''}의 ${catLabel} 위치와 운영시간을 확인하세요.`
  }
  return `전국 ${catLabel} 위치와 운영시간을 검색하세요.`
})

const resultTitle = computed(() => {
  if (selectedCity.value && selectedDistrict.value) {
    return `${selectedCity.value} ${selectedDistrict.value}`
  }
  if (selectedCity.value) {
    return selectedCity.value
  }
  return '전체 지역'
})

// SEO meta (top-level for SSR)
const initialCityName = CITY_SLUG_MAP[route.query.city as string] || ''
const catLabel = CATEGORY_META[route.params.category as FacilityCategory]?.label || (route.params.category as string)

setMeta({
  title: initialCityName ? `${initialCityName} ${catLabel}` : `전국 ${catLabel} 찾기`,
  description: initialCityName
    ? `${initialCityName}의 ${catLabel} 위치와 운영시간을 확인하세요. 주변 생활시설 정보를 한눈에 검색할 수 있습니다.`
    : `전국 ${catLabel} 위치와 운영시간을 검색하세요. 지역별 생활시설 정보를 한눈에 확인할 수 있습니다.`,
  path: `/${route.params.category}`,
})

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: catLabel, url: `/${route.params.category}` },
])

// FAQ JSON-LD
const categoryFAQ = CATEGORY_FAQ[route.params.category as FacilityCategory]
if (categoryFAQ) {
  setFAQSchema(categoryFAQ)
}

// Canonical URL: city+district → region route, city only → city route, otherwise self
const canonicalPath = computed(() => {
  const citySlug = queryCitySlug.value
  const districtSlug = (route.query.district as string) || ''
  if (citySlug && districtSlug) {
    return `/${citySlug}/${districtSlug}/${categoryParam.value}`
  }
  if (citySlug) {
    return `/${citySlug}/${categoryParam.value}`
  }
  return `/${categoryParam.value}`
})
useHead(computed(() => ({
  link: [{ rel: 'canonical', href: `https://ilsangkit.co.kr${canonicalPath.value}`, key: 'canonical' }],
})))

// Pagination: page 2+ noindex (검색엔진 중복 콘텐츠 방지)
const pageQueryParam = Number(route.query.page) || 1
if (pageQueryParam >= 2) {
  useHead({ meta: [{ name: 'robots', content: 'noindex, follow' }] })
}

// Methods
async function performSearch() {
  if (categoryParam.value === 'trash') return

  const params: Record<string, unknown> = {
    page: currentPage.value,
    limit: 20,
    category: categoryParam.value,
  }
  if (selectedCity.value) params.city = selectedCity.value
  if (selectedDistrict.value) params.district = selectedDistrict.value
  if (filterKeyword.value) params.keyword = filterKeyword.value

  search(params)
}

async function loadWasteSchedules() {
  const result = await getSchedules({
    city: selectedCity.value || undefined,
    district: selectedDistrict.value || undefined,
    keyword: filterKeyword.value || undefined,
    page: wasteCurrentPage.value,
    limit: 20,
  })
  wasteSchedules.value = result.schedules
  wasteContact.value = result.contact || null
  wasteTotal.value = result.total
  wasteTotalPages.value = result.totalPages
}

async function handleCityChange() {
  selectedDistrict.value = ''
  filterKeyword.value = ''

  if (selectedCity.value) {
    if (categoryParam.value === 'trash') {
      districtList.value = await getDistricts(selectedCity.value)
    } else {
      const cityData = citiesWithDistricts.value.find(c => c.name === selectedCity.value)
      districtList.value = cityData?.districts.map(d => d.name) || []
    }
  } else {
    districtList.value = []
  }

  if (categoryParam.value === 'trash') {
    wasteCurrentPage.value = 1
    await loadWasteSchedules()
  } else {
    resetPage()
    performSearch()
  }
}

async function handleDistrictChange() {
  filterKeyword.value = ''

  if (categoryParam.value === 'trash') {
    wasteCurrentPage.value = 1
    await loadWasteSchedules()
  } else {
    resetPage()
    performSearch()
  }
}

let filterSearchTimer: ReturnType<typeof setTimeout> | null = null

function handleFilterSearch() {
  if (filterSearchTimer) clearTimeout(filterSearchTimer)
  filterSearchTimer = setTimeout(async () => {
    if (categoryParam.value === 'trash') {
      wasteCurrentPage.value = 1
      await loadWasteSchedules()
    } else {
      resetPage()
      performSearch()
    }
  }, 300)
}

function goToWastePage(page: number) {
  wasteCurrentPage.value = page
  loadWasteSchedules()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function goToPage(page: number) {
  setPage(page)
  performSearch()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Initialize
onMounted(async () => {
  // Load cities for dropdown
  if (categoryParam.value === 'trash') {
    cities.value = await getCities()
  } else {
    await loadRegions()
    cities.value = citiesWithDistricts.value.map(c => c.name)
  }

  // Restore city from query param (slug → Korean)
  if (queryCitySlug.value) {
    const cityName = CITY_SLUG_MAP[queryCitySlug.value]
    if (cityName && cities.value.includes(cityName)) {
      selectedCity.value = cityName
      if (categoryParam.value === 'trash') {
        districtList.value = await getDistricts(cityName)
      } else {
        const cityData = citiesWithDistricts.value.find(c => c.name === cityName)
        districtList.value = cityData?.districts.map(d => d.name) || []
      }
    }
  }

  // Initial data load
  if (categoryParam.value === 'trash') {
    await loadWasteSchedules()
  } else {
    await performSearch()
  }
  initialLoading.value = false
})

// Update meta when filters change
watch([selectedCity, selectedDistrict], () => {
  const cat = categoryParam.value
  const catName = categoryMeta.value?.label || cat
  const title = selectedCity.value
    ? `${selectedCity.value}${selectedDistrict.value ? ' ' + selectedDistrict.value : ''} ${catName}`
    : `전국 ${catName} 찾기`
  const description = selectedCity.value
    ? `${selectedCity.value}${selectedDistrict.value ? ' ' + selectedDistrict.value : ''}의 ${catName} 위치와 운영시간을 확인하세요. 주변 생활시설 정보를 한눈에 검색할 수 있습니다.`
    : `전국 ${catName} 위치와 운영시간을 검색하세요. 지역별 생활시설 정보를 한눈에 확인할 수 있습니다.`

  setMeta({ title, description, path: `/${cat}` })
})

// ItemList structured data + 페이지네이션 rel link 태그
watch([facilities, currentPage, totalPages], () => {
  if (facilities.value.length > 0 && categoryParam.value !== 'trash') {
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
  const siteUrl = useRuntimeConfig().public.siteUrl || 'https://ilsangkit.co.kr'
  const baseUrl = `${siteUrl}/${categoryParam.value}`

  if (currentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${currentPage.value - 1}` })
  }
  if (currentPage.value < totalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${currentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})
</script>
