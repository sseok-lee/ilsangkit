<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Page Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        {{ cityName }} {{ districtName }} {{ categoryName }}
      </h1>
      <p class="text-gray-600">
        {{ isTrash
          ? `${cityName} ${districtName}의 쓰레기 배출 일정 정보를 확인하세요.`
          : `${cityName} ${districtName}의 ${categoryName} 위치 정보를 확인하세요.`
        }}
      </p>
    </header>

    <!-- ========== Trash: 배출 일정 ========== -->
    <template v-if="isTrash">
      <!-- 로딩 -->
      <div v-if="wasteLoading" class="flex items-center justify-center py-12">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p class="text-slate-500 text-sm">배출 일정 조회 중...</p>
        </div>
      </div>

      <div v-else>
        <!-- 담당 부서 연락처 -->
        <div v-if="wasteContact" class="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
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
        <template v-if="wasteSchedules.length > 0">
          <div class="flex items-center justify-between mb-4">
            <h2 class="text-slate-900 text-base font-bold">배출 일정</h2>
            <span class="text-xs text-slate-500 font-medium">{{ wasteTotal }}건</span>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <WasteScheduleCard
              v-for="region in wasteSchedules"
              :key="region.id"
              :region="region"
            />
          </div>
        </template>

        <!-- 결과 없음 -->
        <div v-else class="py-16 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-[32px] text-slate-400">delete</span>
          </div>
          <p class="text-slate-700 font-semibold text-lg">등록된 배출 일정이 없습니다</p>
          <p class="text-slate-400 text-sm mt-1">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
        </div>

        <!-- 페이지네이션 -->
        <Pagination
          v-if="wasteTotalPages > 1"
          :current-page="wasteCurrentPage"
          :total-pages="wasteTotalPages"
          @page-change="goToWastePage"
        />
      </div>
    </template>

    <!-- ========== 일반 시설 ========== -->
    <template v-else>
      <!-- Loading State -->
      <div v-if="loading" class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">시설 정보를 불러오는 중...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p class="text-red-800">{{ error }}</p>
        <button
          @click="loadFacilities()"
          class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>

      <!-- Facilities Grid -->
      <div v-else>
        <!-- No Results -->
        <div v-if="facilities.length === 0" class="text-center py-12">
          <p class="text-gray-600">해당 지역에 등록된 시설이 없습니다.</p>
        </div>

        <!-- Grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <FacilityCard
            v-for="facility in facilities"
            :key="facility.id"
            :facility="facility"
          />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center items-center space-x-4">
          <button
            :disabled="currentPage === 1"
            @click="goToPage(currentPage - 1)"
            class="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            이전
          </button>
          <span class="text-gray-700">
            {{ currentPage }} / {{ totalPages }}
          </span>
          <button
            :disabled="currentPage === totalPages"
            @click="goToPage(currentPage + 1)"
            class="px-4 py-2 border rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
          >
            다음
          </button>
        </div>
      </div>
    </template>

    <!-- Other Categories -->
    <section class="mt-12 border-t pt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">다른 카테고리</h2>
      <div class="grid grid-cols-2 md:grid-cols-5 gap-3">
        <NuxtLink
          v-for="cat in otherCategories"
          :key="cat.slug"
          :to="`/${city}/${district}/${cat.slug}`"
          class="group flex flex-col items-center p-4 rounded-2xl border border-slate-200 bg-white hover:shadow-md hover:-translate-y-0.5 transition-all duration-200"
        >
          <img :src="`/icons/category/${cat.slug}.webp?v2`" :alt="cat.name" class="w-8 h-8 mb-2" width="32" height="32" loading="lazy" />
          <span class="text-xs text-slate-600 font-medium">{{ cat.name }}</span>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRegionFacilities } from '~/composables/useRegionFacilities'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import type { RegionSchedule } from '~/composables/useWasteSchedule'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { CITY_FULL_NAME_TO_SLUG } from '~/shared/regionSlugs'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

// Route params
const route = useRoute()
const city = computed(() => route.params.city as string)
const district = computed(() => route.params.district as string)
const category = computed(() => route.params.category as string)
const isTrash = computed(() => category.value === 'trash')

// Validate city slug (Soft 404 방지)
if (!CITY_SLUG_MAP[city.value]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Validate category (Soft 404 방지)
if (!CATEGORY_META[category.value as FacilityCategory]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Dynamic region data
const { loadRegions, syncFromHydration, getCityName, getDistrictName, getDistrictsByCity } = useRegions()

// SSR: 서버에서 지역 정보 로드
const { data: regionsData } = await useAsyncData(
  `region-${city.value}-${district.value}`,
  () => loadRegions()
)
// useAsyncData의 hydrated data로 캐시 동기화
syncFromHydration(regionsData)

// Validate district slug (Soft 404 방지)
if (regionsData.value?.length) {
  const validDistricts = getDistrictsByCity(city.value)
  if (validDistricts.length > 0 && !validDistricts.some(d => d.slug === district.value)) {
    throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
  }
}

// Korean names (동적으로 가져옴)
const cityName = computed(() => getCityName(city.value))
const districtName = computed(() => getDistrictName(city.value, district.value))
const categoryName = computed(() => {
  const meta = CATEGORY_META[category.value as keyof typeof CATEGORY_META]
  return meta?.label || category.value
})

// SEO - top-level에서 설정 (SSR에서 메타태그 렌더링)
const { setRegionMeta } = useFacilityMeta()
setRegionMeta({
  city: city.value,
  cityName: cityName.value,
  district: district.value,
  districtName: districtName.value,
  category: category.value as FacilityCategory,
})

// Breadcrumb JSON-LD
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${city.value}` },
  { name: districtName.value, url: `/${city.value}/${district.value}` },
  { name: categoryName.value, url: `/${city.value}/${district.value}/${category.value}` },
])

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: false },
  { label: districtName.value, href: `/${city.value}/${district.value}`, current: false },
  {
    label: categoryName.value,
    href: `/${city.value}/${district.value}/${category.value}`,
    current: true,
  },
])

// Other categories (dynamically from CATEGORY_GROUPS, excluding current)
const EXCLUDED_REGION_CATEGORIES = new Set<string>([])
const otherCategories = computed(() => {
  const all: { slug: string; name: string }[] = []
  for (const group of CATEGORY_GROUPS) {
    for (const id of group.categories) {
      if (id !== category.value && !EXCLUDED_REGION_CATEGORIES.has(id)) {
        all.push({ slug: id, name: CATEGORY_META[id].label })
      }
    }
  }
  return all
})

// ========== Waste Schedule (trash) ==========
const { getSchedules, isLoading: wasteLoading } = useWasteSchedule()
const wasteSchedules = ref<RegionSchedule[]>([])
const wasteContact = ref<{ name: string; phone?: string } | null>(null)
const wasteCurrentPage = ref(1)
const wasteTotalPages = ref(1)
const wasteTotal = ref(0)

// slug → DB 풀네임 (서울특별시 등) 역매핑
const SLUG_TO_FULL_CITY = Object.entries(CITY_FULL_NAME_TO_SLUG).reduce(
  (acc, [fullName, slug]) => ({ ...acc, [slug]: fullName }),
  {} as Record<string, string>,
)

async function loadWasteSchedules() {
  const fullCityName = SLUG_TO_FULL_CITY[city.value] || cityName.value
  const result = await getSchedules({
    city: fullCityName || undefined,
    district: districtName.value || undefined,
    page: wasteCurrentPage.value,
    limit: 20,
  })
  wasteSchedules.value = result.schedules
  wasteContact.value = result.contact || null
  wasteTotal.value = result.total
  wasteTotalPages.value = result.totalPages
}

function goToWastePage(page: number) {
  wasteCurrentPage.value = page
  loadWasteSchedules()
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// ========== Facilities (non-trash) ==========
const {
  facilities,
  loading,
  error,
  total,
  page,
  totalPages,
  fetchFacilities,
} = useRegionFacilities()

const currentPage = ref(1)

async function loadFacilities() {
  await fetchFacilities(city.value, district.value, category.value, currentPage.value)
}

function goToPage(pageNum: number) {
  currentPage.value = pageNum
  loadFacilities()
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 초기 데이터 로드
if (isTrash.value) {
  loadWasteSchedules()
} else {
  loadFacilities()
}

// noindex 조건: 시설 5건 미만 또는 페이지 2 이상
const pageQueryParam = Number(route.query.page) || 1
useHead(computed(() => {
  const isEmpty = isTrash.value
    ? (!wasteLoading.value && wasteSchedules.value.length < 5)
    : (!loading.value && facilities.value.length < 5 && !error.value)
  if (isEmpty || pageQueryParam > 1) {
    return { meta: [{ name: 'robots', content: 'noindex, follow' }] }
  }
  return { meta: [] }
}))

// ItemList 구조화 데이터 (non-trash only)
watch([facilities, currentPage, totalPages], () => {
  if (isTrash.value) return
  if (facilities.value.length > 0) {
    setItemListSchema(
      facilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`

  if (currentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${currentPage.value - 1}` })
  }
  if (currentPage.value < totalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${currentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})

// ItemList 구조화 데이터 (trash)
watch([wasteSchedules, wasteCurrentPage, wasteTotalPages], () => {
  if (!isTrash.value) return
  if (wasteSchedules.value.length > 0) {
    setItemListSchema(
      wasteSchedules.value.map((s, index) => ({
        name: s.targetRegion,
        url: `/trash/${s.id}`,
        position: (wasteCurrentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`

  if (wasteCurrentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${wasteCurrentPage.value - 1}` })
  }
  if (wasteCurrentPage.value < wasteTotalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${wasteCurrentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})
</script>
