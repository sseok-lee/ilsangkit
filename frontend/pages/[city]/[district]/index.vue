<template>
  <div class="container mx-auto px-4 py-8">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Page Header -->
    <header class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-2">
        {{ cityName }} {{ districtName }} 생활 편의시설
      </h1>
      <p class="text-gray-600 dark:text-gray-400">
        {{ cityName }} {{ districtName }}의 시설 카테고리를 선택하세요.
      </p>
    </header>

    <!-- Loading State -->
    <div v-if="loading" class="text-center py-12">
      <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      <p class="mt-4 text-gray-600 dark:text-gray-400">정보를 불러오는 중...</p>
    </div>

    <!-- Categories Grid -->
    <div v-else>
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">카테고리 선택</h2>

      <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        <NuxtLink
          v-for="cat in categories"
          :key="cat.id"
          :to="`/${city}/${district}/${cat.id}`"
          class="group flex flex-col items-center p-6 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl hover:shadow-lg hover:-translate-y-1 hover:border-primary/50 transition-all"
        >
          <div :class="`w-16 h-16 rounded-full ${cat.bgColor} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`">
            <CategoryIcon :category-id="cat.id" size="lg" />
          </div>
          <span class="text-lg font-bold text-gray-900 dark:text-white">{{ cat.label }}</span>
          <span class="mt-1 text-sm text-gray-500 dark:text-gray-400">시설 목록 보기</span>
        </NuxtLink>
      </div>
    </div>

    <!-- Quick Search -->
    <section class="mt-12 border-t border-gray-200 dark:border-slate-700 pt-8">
      <h2 class="text-xl font-bold text-gray-900 dark:text-white mb-4">빠른 검색</h2>
      <div class="flex flex-col sm:flex-row gap-4">
        <NuxtLink
          :to="`/search?keyword=${encodeURIComponent(cityName + ' ' + districtName)}`"
          class="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition-colors"
        >
          <span class="material-symbols-outlined">search</span>
          {{ districtName }} 전체 시설 검색
        </NuxtLink>
        <NuxtLink
          :to="`/${city}`"
          class="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
        >
          <span class="material-symbols-outlined">arrow_back</span>
          {{ cityName }} 다른 지역 보기
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { useRegions } from '~/composables/useRegions'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { CATEGORY_META } from '~/types/facility'

const route = useRoute()
const city = computed(() => route.params.city as string)
const district = computed(() => route.params.district as string)

// Region data
const { loadRegions, getCityName, getDistrictName } = useRegions()

const loading = ref(true)

// Names
const cityName = computed(() => getCityName(city.value))
const districtName = computed(() => getDistrictName(city.value, district.value))

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: false },
  { label: districtName.value, href: `/${city.value}/${district.value}`, current: true },
])

// Categories with colors
const categories = computed(() => [
  { id: 'toilet' as const, label: CATEGORY_META.toilet.label, bgColor: 'bg-purple-50 dark:bg-purple-900/30' },
  { id: 'trash' as const, label: CATEGORY_META.trash.label, bgColor: 'bg-red-50 dark:bg-red-900/30' },
  { id: 'wifi' as const, label: CATEGORY_META.wifi.label, bgColor: 'bg-green-50 dark:bg-green-900/30' },
  { id: 'clothes' as const, label: CATEGORY_META.clothes.label, bgColor: 'bg-pink-50 dark:bg-pink-900/30' },
  { id: 'kiosk' as const, label: CATEGORY_META.kiosk.label, bgColor: 'bg-orange-50 dark:bg-orange-900/30' },
])

// SEO
const { setMeta } = useFacilityMeta()

onMounted(async () => {
  loading.value = true

  // Load regions
  await loadRegions()

  // Set SEO meta
  setMeta({
    title: `${cityName.value} ${districtName.value} 생활 편의시설`,
    description: `${cityName.value} ${districtName.value}의 공공화장실, 무료 와이파이, 의류수거함 등 생활 편의시설 정보를 찾아보세요.`,
    path: `/${city.value}/${district.value}`,
  })

  loading.value = false
})
</script>
