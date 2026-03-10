<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Page Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">
        {{ cityName }} 생활 편의시설
      </h1>
      <p class="text-gray-600 mb-4">
        {{ cityName }}의 구/군을 선택하여 주변 시설을 찾아보세요.
      </p>
      <div class="bg-slate-50 rounded-lg p-4 border border-slate-100 text-sm text-slate-600 leading-relaxed space-y-2">
        <p v-if="cityStats">
          {{ cityName }}에는 {{ topCategoryText }} 등
          총 {{ cityStats.total.toLocaleString() }}개의 편의시설이 등록되어 있습니다.
        </p>
        <p v-else>
          일상킷에서 {{ cityName }} 지역의 공공화장실, 무료 와이파이, 공영주차장, 병원, 약국 등
          다양한 생활 편의시설 정보를 한눈에 확인할 수 있습니다.
        </p>
        <p>
          아래에서 구/군을 선택하면 해당 지역의 시설 목록을 상세하게 볼 수 있으며,
          카테고리별 검색을 통해 원하는 시설을 빠르게 찾을 수 있습니다.
        </p>
      </div>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12" role="status" aria-label="지역 정보 로딩 중">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600">지역 정보를 불러오는 중...</p>
    </div>

    <!-- Content -->
    <div v-else>
      <!-- 인기 구/군 TOP 5 -->
      <section v-if="topDistricts.length > 0" class="mb-10">
        <h2 class="text-xl font-bold text-gray-900 mb-4">{{ cityName }} 인기 지역</h2>
        <p class="text-sm text-gray-500 mb-4">시설이 가장 많은 상위 {{ topDistricts.length }}개 지역입니다.</p>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <NuxtLink
            v-for="(d, idx) in topDistricts"
            :key="d.slug"
            :to="`/${city}/${d.slug}`"
            class="relative block p-4 bg-gradient-to-br from-blue-50 to-white border border-blue-200 rounded-lg hover:shadow-md hover:border-blue-400 transition-all text-center"
          >
            <span class="absolute top-2 left-2 text-xs font-bold text-blue-500">TOP {{ idx + 1 }}</span>
            <div class="font-semibold text-gray-900 mt-2">{{ d.name }}</div>
            <div class="text-sm text-blue-600 font-medium">시설 {{ d.count.toLocaleString() }}개</div>
          </NuxtLink>
        </div>
      </section>

      <!-- 구/군 선택 -->
      <h2 class="text-xl font-bold text-gray-900 mb-4">구/군 선택</h2>

      <!-- No Districts -->
      <div v-if="districts.length === 0" class="text-center py-12">
        <p class="text-gray-600">해당 지역의 정보가 없습니다.</p>
      </div>

      <!-- Grid -->
      <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-8">
        <NuxtLink
          v-for="district in districts"
          :key="district.slug"
          :to="`/${city}/${district.slug}`"
          class="block p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-primary/50 transition-all text-center"
        >
          <div class="font-semibold text-gray-900">{{ district.name }}</div>
          <div v-if="district.count > 0" class="text-sm text-gray-500">시설 {{ district.count.toLocaleString() }}개</div>
        </NuxtLink>
      </div>

    </div>

    <!-- Category Section -->
    <section class="mt-12 border-t border-gray-200 pt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">카테고리별 검색</h2>
      <div v-for="group in categoryGroups" :key="group.title" class="mb-6">
        <h3 class="text-lg font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-xl">{{ group.icon }}</span>
          {{ group.title }}
        </h3>
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
          <NuxtLink
            v-for="cat in group.items"
            :key="cat.id"
            :to="`/${cat.id}?city=${city}`"
            class="flex flex-col items-center p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md hover:border-primary/50 transition-all"
          >
            <CategoryIcon :category-id="cat.id" size="lg" />
            <span class="mt-2 font-medium text-gray-900">{{ cat.label }}</span>
            <span v-if="cat.count > 0" class="text-sm text-gray-500">{{ cat.count.toLocaleString() }}개</span>
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- 지역 생활 FAQ -->
    <section v-if="regionFAQs.length > 0" class="mt-12 border-t border-gray-200 pt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-4">{{ cityName }} 생활 편의시설 자주 묻는 질문</h2>
      <div class="space-y-6">
        <div v-for="(faq, idx) in regionFAQs" :key="idx" class="bg-white border border-gray-200 rounded-lg p-5">
          <h3 class="font-semibold text-gray-900 mb-2">{{ faq.question }}</h3>
          <p class="text-sm text-gray-600 leading-relaxed">{{ faq.answer }}</p>
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
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'

interface CityStats {
  city: string
  citySlug: string
  total: number
  categories: Record<string, number>
  topCategories: string[]
  districts: Array<{ district: string; total: number }>
}

const route = useRoute()
const city = computed(() => route.params.city as string)

// Validate city slug (Soft 404 방지)
if (!CITY_SLUG_MAP[route.params.city as string]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Region data
const { loadRegions, syncFromHydration, getDistrictsByCity, getCityName } = useRegions()

// SSR: 서버에서 지역 정보 + 통계 병렬 로드
const [{ data: regionsData, status }, { data: statsData }] = await Promise.all([
  useAsyncData(`city-${city.value}`, () => loadRegions()),
  useAsyncData(`city-stats-${city.value}`, () =>
    $fetch<{ success: boolean; data: CityStats }>(`/api/meta/stats/${city.value}`).catch(() => null)
  ),
])
// useAsyncData의 hydrated data로 캐시 동기화
syncFromHydration(regionsData)
const loading = computed(() => status.value === 'pending')

// City stats - 응답 구조 검증
const cityStats = computed(() => {
  const raw = statsData.value
  if (!raw || typeof raw !== 'object' || !('data' in raw)) return null
  const data = raw.data
  if (!data || typeof data.total !== 'number') return null
  return data
})

// 상위 카테고리 텍스트 (예: "병원 12,456개, 약국 4,532개, 공공화장실 3,245개")
const topCategoryText = computed(() => {
  if (!cityStats.value) return ''
  return cityStats.value.topCategories
    .map((cat) => {
      const meta = CATEGORY_META[cat as FacilityCategory]
      const count = cityStats.value!.categories[cat] ?? 0
      return `${meta?.label ?? cat} ${count.toLocaleString()}개`
    })
    .join(', ')
})

// City name
const cityName = computed(() => getCityName(city.value))

// District별 시설 수 매핑
const districtCountMap = computed(() => {
  if (!cityStats.value?.districts) return new Map<string, number>()
  return new Map(cityStats.value.districts.map((d) => [d.district, d.total]))
})

// Districts
const districts = computed(() =>
  getDistrictsByCity(city.value).map((d) => ({
    slug: d.slug,
    name: d.name,
    count: districtCountMap.value.get(d.name) ?? 0,
  }))
)

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: true },
])

// 인기 구/군 TOP 5 (시설 수 기준 내림차순)
const topDistricts = computed(() =>
  [...districts.value]
    .filter((d) => d.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)
)

// 지역 생활 FAQ (상위 3개 카테고리에서 각 1개 FAQ 선택)
const regionFAQs = computed(() => {
  if (!cityStats.value?.topCategories) return []
  return cityStats.value.topCategories
    .slice(0, 3)
    .map((cat) => {
      const faqs = CATEGORY_FAQ[cat as FacilityCategory]
      return faqs?.[0] ?? null
    })
    .filter((faq): faq is { question: string; answer: string } => faq !== null)
})

// Categories (grouped) with facility counts
const categoryGroups = computed(() =>
  CATEGORY_GROUPS.map(group => ({
    title: group.title,
    icon: group.icon,
    items: group.categories.map(id => ({
      id,
      label: CATEGORY_META[id].label,
      count: cityStats.value?.categories[id] ?? 0,
    })),
  }))
)

// SEO - top-level에서 설정 (SSR에서 메타태그 렌더링)
const { setMeta } = useFacilityMeta()
const metaDescription = computed(() => {
  if (cityStats.value) {
    return `${cityName.value}의 ${topCategoryText.value} 등 총 ${cityStats.value.total.toLocaleString()}개 편의시설 정보를 찾아보세요.`
  }
  return `${cityName.value}의 공공화장실, 무료 와이파이, 병원, 약국 등 생활 편의시설 정보를 찾아보세요.`
})
setMeta({
  title: `${cityName.value} 생활 편의시설`,
  description: metaDescription.value,
  path: `/${city.value}`,
})

// Breadcrumb JSON-LD
const { setBreadcrumbSchema, setFAQSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${city.value}` },
])

// FAQ JSON-LD
if (regionFAQs.value.length > 0) {
  setFAQSchema(regionFAQs.value)
}
</script>
