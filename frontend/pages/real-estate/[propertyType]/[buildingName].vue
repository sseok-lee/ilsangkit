<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div class="mb-6">
        <nav class="flex items-center gap-1 text-sm text-slate-500 mb-3">
          <NuxtLink to="/real-estate" class="hover:text-primary">부동산</NuxtLink>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <NuxtLink :to="`/real-estate/${propertyTypeParam}`" class="hover:text-primary">{{ propertyMeta?.label }}</NuxtLink>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <span class="text-slate-800">{{ buildingName }}</span>
        </nav>
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
          {{ buildingName }}
        </h1>
        <p class="mt-1 text-slate-500">{{ propertyMeta?.label }} 실거래가</p>
      </div>

      <!-- 건물 정보 -->
      <section v-if="buildingInfo" class="mb-6 rounded-2xl bg-white border border-slate-100 p-5">
        <!-- 주소 + 동 -->
        <div class="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 text-sm">
          <p class="font-medium text-slate-800">{{ fullAddress }}</p>
          <span v-if="buildingInfo.dongName" class="text-slate-400 text-xs">{{ buildingInfo.dongName }}</span>
        </div>
        <!-- 상세 정보 -->
        <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
          <div v-if="buildingInfo.buildYear" class="flex items-center gap-1.5">
            <span class="text-slate-400">건축</span>
            <span class="font-medium text-slate-700">{{ buildingInfo.buildYear }}년</span>
          </div>
          <span v-if="buildingInfo.buildYear && areaRange !== '-'" class="text-slate-200">|</span>
          <div v-if="areaRange !== '-'" class="flex items-center gap-1.5">
            <span class="text-slate-400">전용</span>
            <span class="font-medium text-slate-700">{{ areaRange }}</span>
          </div>
          <span v-if="latestPrice !== '-'" class="text-slate-200">|</span>
          <div v-if="latestPrice !== '-'" class="flex items-center gap-1.5">
            <span class="text-slate-400">최근 거래</span>
            <span class="font-semibold text-primary">{{ latestPrice }}</span>
          </div>
        </div>
      </section>

      <!-- 지도 + 로드뷰 -->
      <section v-if="buildingInfo?.lat && buildingInfo?.lng" class="mb-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-slate-800">위치</h2>
          <a
            :href="`https://map.kakao.com/link/to/${encodeURIComponent(buildingName)},${buildingInfo.lat},${buildingInfo.lng}`"
            target="_blank"
            rel="noopener noreferrer"
            class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors"
          >
            <span class="material-symbols-outlined text-[18px]">directions</span>
            길찾기
          </a>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div class="rounded-2xl bg-white border border-slate-100 overflow-hidden h-[250px] md:h-[300px]">
            <ClientOnly>
              <FacilityMap
                :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
                :facilities="buildingMarker"
                :level="3"
              />
            </ClientOnly>
          </div>
          <div class="roadview-wrapper rounded-2xl bg-white border border-slate-100 overflow-hidden h-[250px] md:h-[300px]">
            <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
          </div>
        </div>
      </section>

      <!-- 매매/전월세 탭 -->
      <TransactionModeTab v-model="currentTab" class="mb-6" />

      <!-- 시세 추이 차트 -->
      <section class="mb-8">
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 class="text-lg font-semibold text-slate-800">시세 추이</h2>
          <!-- 기간 선택 -->
          <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              v-for="opt in periodOptions"
              :key="opt.value"
              :class="[
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                selectedMonths === opt.value
                  ? 'bg-white text-slate-800 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              ]"
              @click="selectedMonths = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- 시세 요약 카드 -->
        <div v-if="stats.length > 0 && !statsLoading" class="grid grid-cols-3 gap-3 mb-4">
          <div class="rounded-xl bg-white border border-slate-100 p-4 text-center">
            <p class="text-xs text-slate-400 mb-1">최근 평균가</p>
            <p class="text-base sm:text-lg font-bold text-slate-800">{{ summaryLatestAvg }}</p>
          </div>
          <div class="rounded-xl bg-white border border-slate-100 p-4 text-center">
            <p class="text-xs text-slate-400 mb-1">전월 대비</p>
            <p
              class="text-base sm:text-lg font-bold"
              :class="changeRateColor"
            >
              {{ summaryChangeRate }}
            </p>
          </div>
          <div class="rounded-xl bg-white border border-slate-100 p-4 text-center">
            <p class="text-xs text-slate-400 mb-1">총 거래</p>
            <p class="text-base sm:text-lg font-bold text-slate-800">{{ summaryTotalCount }}건</p>
          </div>
        </div>

        <div v-if="statsLoading" class="flex justify-center py-8">
          <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <PriceTrendChart
          v-else-if="stats.length > 0"
          :stats="stats"
          :loading="false"
        />
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          시세 데이터가 아직 없습니다.
        </div>
      </section>

      <!-- 거래 내역 테이블 -->
      <section>
        <h2 class="text-lg font-semibold text-slate-800 mb-4">거래 내역</h2>
        <div v-if="txLoading" class="flex justify-center py-8">
          <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <TransactionTable
          v-else-if="transactions.items.length > 0"
          :transactions="transactions.items"
          :type="currentTab"
          :loading="false"
          :hide-building="true"
        />
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          거래 내역이 없습니다.
        </div>

        <!-- 페이지네이션 -->
        <div v-if="transactions.totalPages > 1" class="flex justify-center gap-2 mt-6">
          <button
            v-for="p in Math.min(transactions.totalPages, 10)"
            :key="p"
            :class="[
              'size-10 rounded-lg text-sm font-medium transition-colors',
              p === currentPage
                ? 'bg-primary text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            ]"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
        </div>
      </section>

      <!-- 주변 생활시설 -->
      <section v-if="buildingInfo?.lat && buildingInfo?.lng" class="mt-8">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">주변 생활시설</h2>
        <NearbyFacilities :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import type { FacilitySearchItem } from '~/types'
import type { RealEstatePropertyType, TransactionMode, RealEstateSearchResponse, TransactionStats, BuildingInfo } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'

const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const router = useRouter()

const propertyTypeParam = computed(() => route.params.propertyType as RealEstatePropertyType)
const buildingName = computed(() => decodeURIComponent(route.params.buildingName as string))
const bjdCode = computed(() => (route.query.bjdCode as string) || '')

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
// SEO 메타
const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')
useHead(() => {
  const title = `${buildingName.value} ${propertyMeta.value?.label} ${tabLabel.value} 실거래가 | 일상킷`
  const description = `${buildingName.value} ${propertyMeta.value?.label} ${tabLabel.value} 실거래가를 확인하세요. 국토교통부 데이터 기반 최신 거래 내역과 시세 추이를 제공합니다.`
  const canonicalBase = `${SITE_URL}/real-estate/${propertyTypeParam.value}/${encodeURIComponent(buildingName.value)}`
  const canonicalUrl = bjdCode.value ? `${canonicalBase}?bjdCode=${bjdCode.value}` : canonicalBase
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: DEFAULT_OG_IMAGE },
      { property: 'og:url', content: canonicalUrl },
      { property: 'og:type', content: 'place' },
    ],
    link: [
      { rel: 'canonical', href: canonicalUrl },
    ],
  }
})

const { useRealEstate } = await import('~/composables/useRealEstate')
const { searchTransactions, getTransactionStats, getBuildingInfo } = useRealEstate()

const { setBuildingPlaceSchema, setBreadcrumbSchema } = useStructuredData()

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: propertyMeta.value?.label || '', url: `/real-estate/${propertyTypeParam.value}` },
  { name: buildingName.value, url: `/real-estate/${propertyTypeParam.value}/${encodeURIComponent(buildingName.value)}` },
])

const buildingInfo = ref<BuildingInfo | null>(null)

const fullAddress = computed(() => {
  if (!buildingInfo.value) return '-'
  const { city, district, roadName, dongName, jibun } = buildingInfo.value
  const detail = roadName || (dongName + (jibun ? ` ${jibun}` : ''))
  return `${city} ${district} ${detail}`
})

const buildingMarker = computed<FacilitySearchItem[]>(() => {
  if (!buildingInfo.value?.lat || !buildingInfo.value?.lng) return []
  return [{
    id: 'building',
    name: buildingInfo.value.buildingName,
    category: 'toilet' as const,
    address: fullAddress.value,
    roadAddress: null,
    lat: buildingInfo.value.lat,
    lng: buildingInfo.value.lng,
    city: buildingInfo.value.city,
    district: buildingInfo.value.district,
  }]
})

const areaRange = computed(() => {
  if (!buildingInfo.value) return '-'
  const { minArea, maxArea } = buildingInfo.value
  if (minArea === null && maxArea === null) return '-'
  if (minArea === maxArea) return `${minArea}㎡`
  return `${minArea ?? '?'}~${maxArea ?? '?'}㎡`
})

const latestPrice = computed(() => {
  if (!buildingInfo.value?.latestDealAmount) return '-'
  const amount = buildingInfo.value.latestDealAmount
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000)
    const remainder = amount % 10000
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억`
  }
  return `${amount.toLocaleString()}만원`
})

const stats = ref<TransactionStats[]>([])
const statsLoading = ref(true)

// 기간 선택
const selectedMonths = ref(12)
const periodOptions = [
  { label: '6개월', value: 6 },
  { label: '1년', value: 12 },
  { label: '3년', value: 36 },
  { label: '5년', value: 60 },
]

// 시세 요약 computed
const summaryLatestAvg = computed(() => {
  if (stats.value.length === 0) return '-'
  const latest = stats.value[stats.value.length - 1]
  return formatSummaryPrice(latest.avgPrice)
})

const summaryChangeRate = computed(() => {
  if (stats.value.length < 2) return '-'
  const latest = stats.value[stats.value.length - 1]
  const prev = stats.value[stats.value.length - 2]
  if (!prev.avgPrice) return '-'
  const rate = ((latest.avgPrice - prev.avgPrice) / prev.avgPrice * 100)
  const sign = rate > 0 ? '▲' : rate < 0 ? '▼' : ''
  return `${sign} ${Math.abs(rate).toFixed(1)}%`
})

const changeRateColor = computed(() => {
  if (stats.value.length < 2) return 'text-slate-500'
  const latest = stats.value[stats.value.length - 1]
  const prev = stats.value[stats.value.length - 2]
  const rate = latest.avgPrice - prev.avgPrice
  if (rate > 0) return 'text-red-500'
  if (rate < 0) return 'text-blue-500'
  return 'text-slate-500'
})

const summaryTotalCount = computed(() => {
  return stats.value.reduce((sum, s) => sum + s.count, 0).toLocaleString()
})

function formatSummaryPrice(price: number): string {
  const rounded = Math.round(price)
  const eok = Math.floor(rounded / 10000)
  const man = rounded % 10000
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만`
  if (eok > 0) return `${eok}억`
  return `${rounded.toLocaleString()}만원`
}

const transactions = ref<RealEstateSearchResponse>({ items: [], total: 0, page: 1, totalPages: 0 })
const txLoading = ref(true)
const currentPage = ref(1)

async function loadData() {
  if (!bjdCode.value || !buildingName.value) return

  statsLoading.value = true
  txLoading.value = true

  const [statsResult, txResult, infoResult] = await Promise.allSettled([
    getTransactionStats(apiSlug.value, bjdCode.value, buildingName.value, selectedMonths.value),
    searchTransactions(apiSlug.value, {
      bjdCode: bjdCode.value,
      buildingName: buildingName.value,
      page: currentPage.value,
      limit: 5,
    }),
    getBuildingInfo(apiSlug.value, bjdCode.value, buildingName.value),
  ])

  stats.value = statsResult.status === 'fulfilled' ? statsResult.value : []
  transactions.value = txResult.status === 'fulfilled' ? txResult.value : { items: [], total: 0, page: 1, totalPages: 0 }
  buildingInfo.value = infoResult.status === 'fulfilled' ? infoResult.value : null

  statsLoading.value = false
  txLoading.value = false
}

function goToPage(page: number) {
  currentPage.value = page
  loadData()
}

// 탭 전환 또는 파라미터 변경 시 데이터 재로드
watch(() => [apiSlug.value, buildingName.value, bjdCode.value], () => {
  currentPage.value = 1
  loadData()
}, { immediate: true })

// 기간 변경 시 시세 데이터만 재로드
watch(selectedMonths, async () => {
  if (!bjdCode.value || !buildingName.value) return
  statsLoading.value = true
  try {
    stats.value = await getTransactionStats(apiSlug.value, bjdCode.value, buildingName.value, selectedMonths.value)
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    statsLoading.value = false
  }
})

// buildingInfo 로드 후 구조화 데이터 설정 + thin content noindex
watch(() => buildingInfo.value, (info) => {
  if (info?.lat && info?.lng) {
    setBuildingPlaceSchema({
      name: buildingName.value,
      address: fullAddress.value,
      lat: info.lat,
      lng: info.lng,
      buildYear: info.buildYear,
      propertyType: propertyMeta.value?.label || '',
    })
  }
})

// bjdCode 없거나 데이터 로드 실패 시 noindex
const noindex = computed(() => {
  if (!bjdCode.value) return true
  if (!statsLoading.value && !txLoading.value && buildingInfo.value === null) return true
  return false
})

useHead(() => {
  if (!noindex.value) return {}
  return {
    meta: [{ name: 'robots', content: 'noindex, follow' }],
  }
})
</script>

<style scoped>
.roadview-wrapper :deep(> div) {
  height: 100% !important;
}
.roadview-wrapper :deep(> div > div) {
  height: 100% !important;
}
</style>
