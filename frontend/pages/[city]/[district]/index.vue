<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Page Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        {{ cityName }} {{ districtName }} 생활 편의시설
      </h1>
      <p class="text-gray-600 mb-4">
        {{ cityName }} {{ districtName }}의 시설 카테고리를 선택하세요.
      </p>
      <div class="bg-slate-50 rounded-lg p-4 border border-slate-100 text-base md:text-sm text-slate-600 leading-relaxed space-y-2">
        <p v-if="districtStats">
          {{ cityName }} {{ districtName }}에는 {{ districtTopCategoryText }} 등
          총 {{ districtStats.total.toLocaleString() }}개의 편의시설이 등록되어 있습니다.
        </p>
        <p v-else>
          일상킷에서 {{ cityName }} {{ districtName }} 지역의 공공화장실, 무료 와이파이, 공영주차장, 병원, 약국 등
          다양한 생활 편의시설 정보를 한눈에 확인할 수 있습니다.
        </p>
        <p>
          아래에서 카테고리를 선택하면 해당 시설 목록을 상세하게 볼 수 있으며,
          빠른 검색을 통해 원하는 시설을 찾을 수 있습니다.
        </p>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12" role="status" aria-label="정보 로딩 중">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">정보를 불러오는 중...</p>
    </div>

    <!-- Categories Grid -->
    <div v-else>
      <h2 class="text-xl font-bold text-gray-900 mb-4">카테고리 선택</h2>

      <div v-for="group in categoryGroups" :key="group.title" class="mb-8">
        <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-xl">{{ group.icon }}</span>
          {{ group.title }}
        </h3>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          <NuxtLink
            v-for="cat in group.items"
            :key="cat.id"
            :to="`/${city}/${district}/${cat.id}`"
            class="group flex flex-col items-center p-6 bg-white border border-gray-200 rounded-xl hover:shadow-lg hover:-translate-y-1 hover:border-primary/50 transition-all"
          >
            <div :class="`w-16 h-16 rounded-full ${cat.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`">
              <CategoryIcon :category-id="cat.id" size="lg" />
            </div>
            <span class="text-lg font-bold text-gray-900">{{ cat.label }}</span>
            <span class="mt-1 text-sm text-gray-500">시설 목록 보기</span>
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- All Facilities List -->
    <section class="mt-12 border-t border-gray-200 pt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">
        전체 시설 목록
        <span v-if="allTotal > 0" class="text-base font-normal text-gray-500 ml-2">
          총 {{ allTotal.toLocaleString() }}개
        </span>
      </h2>

      <!-- Loading -->
      <div v-if="allLoading" class="text-center py-12" role="status" aria-label="시설 정보 로딩 중">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
        <p class="mt-4 text-gray-600">시설 정보를 불러오는 중...</p>
      </div>

      <!-- Error -->
      <div v-else-if="allError" class="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p class="text-red-800">{{ allError }}</p>
        <button
          @click="loadAllFacilities()"
          class="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
        >
          다시 시도
        </button>
      </div>

      <!-- Empty -->
      <div v-else-if="allFacilities.length === 0" class="text-center py-12">
        <p class="text-gray-600">해당 지역에 등록된 시설이 없습니다.</p>
      </div>

      <!-- Facility Grid -->
      <template v-else>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <FacilityCard
            v-for="facility in allFacilities"
            :key="`${facility.category}-${facility.id}`"
            :facility="facility"
          />
        </div>

        <!-- Pagination -->
        <div v-if="allTotalPages > 1" class="flex justify-center items-center space-x-4">
          <button
            :disabled="allCurrentPage === 1"
            aria-label="이전 페이지"
            @click="goToAllPage(allCurrentPage - 1)"
            class="min-w-[44px] min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
          >
            이전
          </button>
          <span class="text-gray-700">
            {{ allCurrentPage }} / {{ allTotalPages }}
          </span>
          <button
            :disabled="allCurrentPage === allTotalPages"
            aria-label="다음 페이지"
            @click="goToAllPage(allCurrentPage + 1)"
            class="min-w-[44px] min-h-[44px] px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 text-gray-700"
          >
            다음
          </button>
        </div>
      </template>
    </section>

    <!-- Quick Search -->
    <section class="mt-12 border-t border-gray-200 pt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">빠른 검색</h2>
      <div class="flex flex-col sm:flex-row gap-4">
        <NuxtLink
          :to="`/search?city=${encodeURIComponent(cityName)}&district=${encodeURIComponent(districtName)}`"
          class="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
        >
          <span class="material-symbols-outlined">search</span>
          {{ districtName }} 전체 시설 검색
        </NuxtLink>
        <NuxtLink
          :to="`/${city}`"
          class="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
        >
          <span class="material-symbols-outlined">arrow_back</span>
          {{ cityName }} 다른 지역 보기
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { useRegionFacilities } from '~/composables/useRegionFacilities'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

const route = useRoute()
const city = computed(() => route.params.city as string)
const district = computed(() => route.params.district as string)

// Validate city slug (Soft 404 방지)
if (!CITY_SLUG_MAP[city.value]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Region data
const { loadRegions, syncFromHydration, getCityName, getDistrictName, getDistrictsByCity } = useRegions()

// SSR: 서버에서 지역 정보 로드
const { data: regionsData, status } = await useAsyncData(
  `district-${city.value}-${district.value}`,
  () => loadRegions()
)
// useAsyncData의 hydrated data로 캐시 동기화
syncFromHydration(regionsData)

// Validate district slug (Soft 404 방지)
// regionsData가 비어있어도 유효하지 않은 district로 간주
const validDistricts = getDistrictsByCity(city.value)
if (validDistricts.length === 0 || !validDistricts.some(d => d.slug === district.value)) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

const loading = computed(() => status.value === 'pending')

// Names
const cityName = computed(() => getCityName(city.value))
const districtName = computed(() => getDistrictName(city.value, district.value))

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: false },
  { label: districtName.value, href: `/${city.value}/${district.value}`, current: true },
])

// Category bg color mapping
const categoryBgColors: Record<FacilityCategory, string> = {
  toilet: 'bg-purple-50',
  wifi: 'bg-blue-50',
  parking: 'bg-sky-50',
  kiosk: 'bg-orange-50',
  aed: 'bg-red-50',
  library: 'bg-amber-50',
  clothes: 'bg-pink-50',
  trash: 'bg-green-50',
  hospital: 'bg-teal-50',
  pharmacy: 'bg-emerald-50',
}

// Categories (grouped)
const EXCLUDED_REGION_CATEGORIES = new Set<string>([])
const categoryGroups = computed(() =>
  CATEGORY_GROUPS.map(group => ({
    title: group.title,
    icon: group.icon,
    items: group.categories
      .filter(id => !EXCLUDED_REGION_CATEGORIES.has(id))
      .map(id => ({
        id,
        label: CATEGORY_META[id].label,
        bgColor: categoryBgColors[id],
      })),
  })).filter(group => group.items.length > 0)
)

// 구/군 통계 로드
interface DistrictStats {
  total: number
  categories: Record<string, number>
  topCategories: string[]
}

const { data: districtStatsData } = await useAsyncData(
  `district-stats-${city.value}-${district.value}`,
  () => $fetch<{ success: boolean; data: DistrictStats }>(
    `/api/meta/stats/${city.value}/${district.value}`
  ).catch(() => null)
)

const districtStats = computed(() => {
  const raw = districtStatsData.value
  if (!raw || typeof raw !== 'object' || !('data' in raw)) return null
  const data = raw.data
  if (!data || typeof data.total !== 'number') return null
  return data
})

const districtTopCategoryText = computed(() => {
  if (!districtStats.value?.topCategories) return ''
  return districtStats.value.topCategories
    .map((cat) => {
      const meta = CATEGORY_META[cat as FacilityCategory]
      const count = districtStats.value!.categories[cat] ?? 0
      return `${meta?.label ?? cat} ${count.toLocaleString()}개`
    })
    .join(', ')
})

// SEO - top-level에서 설정 (SSR에서 메타태그 렌더링)
const { setMeta } = useFacilityMeta()
const metaDescription = computed(() => {
  if (districtStats.value) {
    return `${cityName.value} ${districtName.value}의 ${districtTopCategoryText.value} 등 총 ${districtStats.value.total.toLocaleString()}개 편의시설 정보를 찾아보세요.`
  }
  return `${cityName.value} ${districtName.value}의 공공화장실, 무료 와이파이, 병원, 약국 등 생활 편의시설 정보를 찾아보세요.`
})
setMeta({
  title: `${cityName.value} ${districtName.value} 생활 편의시설`,
  description: metaDescription.value,
  path: `/${city.value}/${district.value}`,
})

// Breadcrumb JSON-LD
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${city.value}` },
  { name: districtName.value, url: `/${city.value}/${district.value}` },
])

// All facilities data
const {
  facilities: allFacilities,
  loading: allLoading,
  error: allError,
  total: allTotal,
  totalPages: allTotalPages,
  fetchAllFacilities,
} = useRegionFacilities()

const allCurrentPage = ref(1)

async function loadAllFacilities() {
  await fetchAllFacilities(city.value, district.value, allCurrentPage.value)
}

function goToAllPage(pageNum: number) {
  allCurrentPage.value = pageNum
  loadAllFacilities()
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 시설 정보 로드
loadAllFacilities()

// ItemList 구조화 데이터 + 페이지네이션 rel link 태그
watch([allFacilities, allCurrentPage, allTotalPages], () => {
  if (allFacilities.value.length > 0) {
    setItemListSchema(
      allFacilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (allCurrentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  const paginationLinks: Array<{ rel: string; href: string }> = []
  const siteUrl = useRuntimeConfig().public.siteUrl || 'https://ilsangkit.co.kr'
  const baseUrl = `${siteUrl}/${city.value}/${district.value}`

  if (allCurrentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${allCurrentPage.value - 1}` })
  }
  if (allCurrentPage.value < allTotalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${allCurrentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})
</script>
