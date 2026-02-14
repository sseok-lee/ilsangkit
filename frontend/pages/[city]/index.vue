<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Page Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {{ cityName }} 생활 편의시설
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        {{ cityName }}의 구/군을 선택하여 주변 시설을 찾아보세요.
      </p>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">지역 정보를 불러오는 중...</p>
    </div>

    <!-- Districts Grid -->
    <div v-else>
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">구/군 선택</h2>

      <!-- No Districts -->
      <div v-if="districts.length === 0" class="text-center py-12">
        <p class="text-gray-600 dark:text-gray-400">해당 지역의 정보가 없습니다.</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
        <NuxtLink
          v-for="district in districts"
          :key="district.slug"
          :to="`/${city}/${district.slug}`"
          class="block p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:shadow-md hover:border-primary/50 transition-all text-center"
        >
          <div class="font-semibold text-gray-900 dark:text-white">{{ district.name }}</div>
        </NuxtLink>
      </div>
    </div>

    <!-- Category Section -->
    <section class="mt-12 border-t border-gray-200 dark:border-slate-700 pt-8">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">카테고리별 검색</h2>
      <div v-for="group in categoryGroups" :key="group.title" class="mb-6">
        <h3 class="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-xl">{{ group.icon }}</span>
          {{ group.title }}
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NuxtLink
            v-for="cat in group.items"
            :key="cat.id"
            :to="`/${cat.id}?city=${city}`"
            class="flex flex-col items-center p-4 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg hover:shadow-md hover:border-primary/50 transition-all"
          >
            <CategoryIcon :category-id="cat.id" size="lg" />
            <span class="mt-2 font-medium text-gray-900 dark:text-white">{{ cat.label }}</span>
          </NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'

const route = useRoute()
const city = computed(() => route.params.city as string)

// Region data
const { loadRegions, syncFromHydration, getDistrictsByCity, getCityName } = useRegions()

// SSR: 서버에서 지역 정보 로드
const { data: regionsData, status } = await useAsyncData(
  `city-${city.value}`,
  () => loadRegions()
)
// useAsyncData의 hydrated data로 캐시 동기화
syncFromHydration(regionsData)
const loading = computed(() => status.value === 'pending')

// City name
const cityName = computed(() => getCityName(city.value))

// Districts
const districts = computed(() =>
  getDistrictsByCity(city.value).map((d) => ({
    slug: d.slug,
    name: d.name,
  }))
)

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: true },
])

// Categories (grouped)
const categoryGroups = computed(() =>
  CATEGORY_GROUPS.map(group => ({
    title: group.title,
    icon: group.icon,
    items: group.categories.map(id => ({
      id,
      label: CATEGORY_META[id].label,
    })),
  }))
)

// SEO - top-level에서 설정 (SSR에서 메타태그 렌더링)
const { setMeta } = useFacilityMeta()
setMeta({
  title: `${cityName.value} 생활 편의시설`,
  description: `${cityName.value}의 공공화장실, 무료 와이파이, 의류수거함 등 생활 편의시설 정보를 찾아보세요.`,
  path: `/${city.value}`,
})

// Breadcrumb JSON-LD
const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${city.value}` },
])
</script>
