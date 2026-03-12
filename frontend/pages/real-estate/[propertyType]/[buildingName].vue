<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-5xl px-4 py-8 md:px-6">
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

      <!-- 매매/전월세 탭 -->
      <TransactionModeTab v-model="currentTab" class="mb-6" />

      <!-- 시세 추이 차트 -->
      <section class="mb-8">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">시세 추이</h2>
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { RealEstatePropertyType, TransactionMode, RealEstateSearchResponse, TransactionStats, BuildingInfo } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'

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
  const description = `${buildingName.value}의 ${propertyMeta.value?.label} ${tabLabel.value} 실거래가 정보입니다. 최신 거래 내역과 시세 추이를 확인하세요.`
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
  }
})

const { useRealEstate } = await import('~/composables/useRealEstate')
const { searchTransactions, getTransactionStats, getBuildingInfo } = useRealEstate()

const buildingInfo = ref<BuildingInfo | null>(null)

const fullAddress = computed(() => {
  if (!buildingInfo.value) return '-'
  const { city, district, roadName, dongName, jibun } = buildingInfo.value
  const detail = roadName || (dongName + (jibun ? ` ${jibun}` : ''))
  return `${city} ${district} ${detail}`
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

const transactions = ref<RealEstateSearchResponse>({ items: [], total: 0, page: 1, totalPages: 0 })
const txLoading = ref(true)
const currentPage = ref(1)

async function loadData() {
  if (!bjdCode.value || !buildingName.value) return

  statsLoading.value = true
  txLoading.value = true

  try {
    const [statsData, txData, infoData] = await Promise.all([
      getTransactionStats(apiSlug.value, bjdCode.value, buildingName.value, 12),
      searchTransactions(apiSlug.value, {
        bjdCode: bjdCode.value,
        buildingName: buildingName.value,
        page: currentPage.value,
        limit: 5,
      }),
      getBuildingInfo(apiSlug.value, bjdCode.value, buildingName.value),
    ])
    stats.value = statsData
    transactions.value = txData
    buildingInfo.value = infoData
  } catch (e) {
    console.error('Failed to load data:', e)
  } finally {
    statsLoading.value = false
    txLoading.value = false
  }
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
</script>
