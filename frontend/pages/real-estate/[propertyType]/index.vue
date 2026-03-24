<template>
  <div class="bg-background-light">
    <!-- 히어로 -->
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
          {{ propertyMeta?.label }} 실거래가
        </h1>
        <p class="mt-2 text-slate-500 text-sm">{{ propertyDescription }}</p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-6 md:px-6">

      <!-- 매매/전월세 탭 -->
      <TransactionModeTab v-model="currentTab" class="mb-6" />

      <!-- 검색 필터 -->
      <RealEstateSearchFilter
        :type="apiSlug"
        @search="handleSearch"
      />

      <!-- 지역 생활 인프라 요약 -->
      <div v-if="facilityLoading" class="mb-6 flex justify-center py-6">
        <div class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
      <div v-else-if="facilityStats" class="mb-6 rounded-2xl bg-white border border-slate-200 p-5 shadow-sm">
        <h3 class="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[20px]">location_city</span>
          {{ lastSearch?.district || lastSearch?.city }} 생활 인프라
        </h3>
        <div class="flex flex-wrap gap-3">
          <div
            v-for="(count, cat) in topFacilityCategories"
            :key="cat"
            class="flex items-center gap-1.5 text-sm"
          >
            <span class="material-symbols-outlined text-[18px] text-primary">{{ CATEGORY_META[cat as keyof typeof CATEGORY_META]?.icon }}</span>
            <span class="text-slate-600">{{ CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label }}</span>
            <span class="font-semibold text-slate-800">{{ count }}개</span>
          </div>
        </div>
        <p class="mt-2 text-xs text-slate-400">총 {{ facilityStats.total.toLocaleString() }}개 시설</p>
      </div>

      <!-- 결과 -->
      <div v-if="pending" class="mt-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
            <div class="flex gap-3">
              <div class="shrink-0 w-10 h-10 rounded-lg bg-slate-200"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-200 rounded w-2/3"></div>
                <div class="h-3 bg-slate-100 rounded w-full"></div>
                <div class="flex items-center justify-between mt-1">
                  <div class="h-5 bg-slate-200 rounded w-24"></div>
                  <div class="h-5 bg-slate-100 rounded-md w-12"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else-if="error" class="rounded-xl bg-red-50 p-8 text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
        </div>
        <p class="text-red-700 font-semibold">데이터를 불러오는 중 오류가 발생했습니다</p>
        <p class="text-red-500 text-sm mt-1">잠시 후 다시 시도해주세요</p>
        <button
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          @click="retryLoad"
        >
          <span class="material-symbols-outlined text-[16px]">refresh</span>
          다시 시도
        </button>
      </div>

      <div v-else-if="complexes.length > 0" class="mt-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-slate-800">건물 목록</h2>
          <span class="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
            {{ totalComplexes.toLocaleString() }}건
          </span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplexCard
            v-for="complex in complexes"
            :key="`${complex.buildingName}-${complex.bjdCode}`"
            :complex="complex"
            :property-type="propertyTypeParam"
            :tab="currentTab"
          />
        </div>

        <!-- 페이지네이션 -->
        <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
      </div>

      <div v-else-if="!pending" class="rounded-xl bg-slate-50 p-12 text-center">
        <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-sm">
          <img :src="`/icons/category/${propertyMeta?.iconImg || 'apt'}.webp?v2`" :alt="propertyMeta?.label || '부동산'" class="w-10 h-10" width="40" height="40" />
        </div>
        <p class="text-slate-700 font-semibold text-lg">지역을 선택해주세요</p>
        <p class="text-slate-400 text-sm mt-1">시/도와 구/군을 선택하면 거래 내역을 확인할 수 있습니다</p>
      </div>

      <!-- FAQ -->
      <section v-if="faqs.length > 0" class="mt-12">
        <h2 class="text-lg font-bold text-slate-800 mb-4">자주 묻는 질문</h2>
        <div class="space-y-3">
          <details
            v-for="(faq, i) in faqs"
            :key="i"
            class="group rounded-xl border border-slate-200 bg-white"
          >
            <summary class="cursor-pointer px-5 py-4 text-base font-medium text-slate-800 flex items-center justify-between">
              {{ faq.q }}
              <span class="material-symbols-outlined text-[18px] text-slate-500 group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <p class="px-5 pb-4 text-sm text-slate-600 leading-relaxed">{{ faq.a }}</p>
          </details>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import type { RealEstatePropertyType, TransactionMode, ComplexInfo, ComplexListResponse } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META, PROPERTY_TYPE_FAQ, PROPERTY_TYPE_DESCRIPTIONS } from '~/utils/realEstateMeta'
import { CATEGORY_META } from '~/types/facility'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useRealEstate } from '~/composables/useRealEstate'

const route = useRoute()
const router = useRouter()

const propertyTypeParam = computed(() => route.params.propertyType as RealEstatePropertyType)

// 유효하지 않은 propertyType이면 404
if (!PROPERTY_TYPES.includes(propertyTypeParam.value as RealEstatePropertyType)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const currentTab = computed<TransactionMode>({
  get: () => (route.query.tab === 'rent' ? 'rent' : 'sale'),
  set: (val) => {
    router.replace({ query: { ...route.query, tab: val } })
  },
})

const apiSlug = computed(() => toApiSlug(propertyTypeParam.value, currentTab.value))
const propertyMeta = computed(() => PROPERTY_TYPE_META[propertyTypeParam.value])
const propertyDescription = computed(() => PROPERTY_TYPE_DESCRIPTIONS[propertyTypeParam.value])
const faqs = computed(() => PROPERTY_TYPE_FAQ[propertyTypeParam.value] || [])

const { getComplexList } = useRealEstate()

const complexes = ref<ComplexInfo[]>([])
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(false)
const error = ref(false)
const lastSearch = ref<{ city: string; district: string; buildingName: string } | null>(null)

// SEO 메타
const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')
useHead(() => {
  const label = propertyMeta.value?.label || ''
  const tab = tabLabel.value
  const year = new Date().getFullYear()
  const title = tab === '매매'
    ? `${year}년 ${label} 매매 실거래가·시세 조회 - 일상킷`
    : `${year}년 ${label} 전월세 실거래가·전세가 조회 - 일상킷`
  const seoDescriptions: Record<string, Record<string, string>> = {
    apt: {
      매매: '전국 아파트 매매 실거래가와 시세를 단지별로 조회하세요. 국토부 공식 데이터 기반 최근 거래 내역과 매매가 추이를 한눈에 확인할 수 있습니다.',
      전월세: '전국 아파트 전월세 실거래가를 단지별로 조회하세요. 전세가와 월세 시세, 최근 거래 내역을 국토부 공식 데이터로 비교할 수 있습니다.',
    },
    villa: {
      매매: '전국 연립다세대(빌라) 매매 실거래가와 시세를 지역별로 확인하세요. 최근 거래 내역과 매매가 흐름을 한눈에 비교할 수 있습니다.',
      전월세: '전국 연립다세대(빌라) 전월세 실거래가를 지역별로 조회하세요. 전세가와 월세 시세, 최근 거래 내역을 확인할 수 있습니다.',
    },
    offitel: {
      매매: '전국 오피스텔 매매 실거래가와 시세를 건물별로 조회하세요. 국토부 공식 데이터 기반 최근 거래 내역과 매매가 추이를 제공합니다.',
      전월세: '전국 오피스텔 전월세 실거래가를 건물별로 조회하세요. 전세가와 월세 시세, 최근 거래 내역을 한곳에서 비교할 수 있습니다.',
    },
  }
  const description = seoDescriptions[propertyTypeParam.value]?.[tab] || propertyDescription.value
  const canonicalUrl = `${SITE_URL}/real-estate/${propertyTypeParam.value}`
  const meta: Array<{ name?: string; property?: string; content: string }> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
  ]
  // 페이지 2 이상은 noindex (thin content 방지)
  if (currentPage.value > 1) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    link: [
      { rel: 'canonical', href: canonicalUrl },
    ],
  }
})

// JSON-LD
useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${propertyMeta.value?.label} ${tabLabel.value} 실거래가`,
        description: propertyDescription.value,
      }),
    },
  ],
}))

const paginationRange = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const delta = 2
  const range: number[] = []
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i)
  }
  return range
})

async function handleSearch(params: { city: string; district: string; buildingName: string }) {
  if (!params.city && !params.district && !params.buildingName) return
  lastSearch.value = params
  currentPage.value = 1

  // 건물 목록 + 시설 요약을 병렬로 요청
  const complexPromise = loadComplexes(params.city || undefined, params.district || undefined, params.buildingName || undefined)
  const facilityPromise = params.city
    ? fetchFacilitySummary(params.city, params.district || undefined)
    : Promise.resolve()
  await Promise.all([complexPromise, facilityPromise])
}

async function loadComplexes(city?: string, district?: string, buildingName?: string, page: number = 1) {
  pending.value = true
  error.value = false
  try {
    const result = await getComplexList(apiSlug.value, city, district, buildingName, page)
    complexes.value = result.items
    totalComplexes.value = result.total
    currentPage.value = result.page
    totalPages.value = result.totalPages
  } catch {
    error.value = true
  } finally {
    pending.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  const s = lastSearch.value
  loadComplexes(s?.city || undefined, s?.district || undefined, s?.buildingName || undefined, page)
}

function retryLoad() {
  const s = lastSearch.value
  loadComplexes(s?.city || undefined, s?.district || undefined, s?.buildingName || undefined, currentPage.value)
}

// 마운트 시 인기 건물 자동 로드
onMounted(() => {
  if (lastSearch.value) {
    loadComplexes(lastSearch.value.city || undefined, lastSearch.value.district || undefined, lastSearch.value.buildingName || undefined)
  } else {
    loadComplexes()
  }
})

// 탭 전환 시 마지막 검색 조건으로 재로드
watch(currentTab, () => {
  if (lastSearch.value) {
    loadComplexes(lastSearch.value.city || undefined, lastSearch.value.district || undefined, lastSearch.value.buildingName || undefined)
  } else {
    loadComplexes()
  }
})

// 지역 시설 밀집도
const facilityStats = ref<{ categories: Record<string, number>; total: number; topCategories: string[] } | null>(null)
const facilityLoading = ref(false)

async function fetchFacilitySummary(city: string, district?: string) {
  facilityLoading.value = true
  try {
    const res = await $fetch<any>('/api/meta/region-facilities-summary', {
      params: { city, district },
    })
    facilityStats.value = res?.data ?? null
  } catch {
    facilityStats.value = null
  } finally {
    facilityLoading.value = false
  }
}

const topFacilityCategories = computed(() => {
  if (!facilityStats.value) return {}
  const cats = facilityStats.value.categories
  return Object.fromEntries(
    Object.entries(cats)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
  )
})
</script>
