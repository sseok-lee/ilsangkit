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
        {{ cityName }} {{ districtName }}의 {{ categoryName }} 위치 정보를 확인하세요.
      </p>
    </header>

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
      <div
        v-else
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8"
      >
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

    <!-- Other Categories -->
    <section class="mt-12 border-t pt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">다른 카테고리</h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <NuxtLink
          v-for="cat in otherCategories"
          :key="cat.slug"
          :to="`/${city}/${district}/${cat.slug}`"
          class="block p-4 border rounded-lg hover:shadow-md transition-shadow text-center"
        >
          <div class="font-semibold text-gray-900">{{ cat.name }}</div>
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRegionFacilities } from '~/composables/useRegionFacilities'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'

// Route params
const route = useRoute()
const city = computed(() => route.params.city as string)
const district = computed(() => route.params.district as string)
const category = computed(() => route.params.category as string)

// Dynamic region data
const { loadRegions, syncFromHydration, getCityName, getDistrictName } = useRegions()

// SSR: 서버에서 지역 정보 로드
const { data: regionsData } = await useAsyncData(
  `region-${city.value}-${district.value}`,
  () => loadRegions()
)
// useAsyncData의 hydrated data로 캐시 동기화
syncFromHydration(regionsData)

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
// trash는 좌표 없는 일정 데이터이므로 지역 허브에서 제외
const EXCLUDED_REGION_CATEGORIES = new Set(['trash'])
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

// Facilities data
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

// 시설 0건일 때 noindex 안전장치
useHead(computed(() => {
  if (!loading.value && facilities.value.length === 0) {
    return { meta: [{ name: 'robots', content: 'noindex' }] }
  }
  return {}
}))

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

// 시설 정보 로드
loadFacilities()

// ItemList 구조화 데이터 + 페이지네이션 rel link 태그
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
</script>
