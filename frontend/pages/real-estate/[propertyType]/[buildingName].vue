<template>
  <div class="bg-background-light">
    <!-- Mobile: Map at top -->
    <div v-if="buildingInfo?.lat && buildingInfo?.lng" class="md:hidden relative h-[240px] w-full overflow-hidden bg-gray-200">
      <ClientOnly>
        <FacilityMap
          :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
          :facilities="buildingMarker"
          :level="3"
          class="w-full h-full !min-h-0 !rounded-none"
        />
      </ClientOnly>

      <!-- Back & Name Overlay -->
      <div class="absolute top-4 left-4 z-20 flex items-center gap-2">
        <div class="flex size-11 cursor-pointer items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm transition hover:bg-white active:scale-95" @click="$router.back()">
          <span class="material-symbols-outlined text-slate-800">arrow_back</span>
        </div>
        <span class="max-w-[calc(100vw-100px)] truncate rounded-full bg-white/90 px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm backdrop-blur-sm">{{ buildingName }}</span>
      </div>

      <!-- Gradient Overlay -->
      <div class="absolute bottom-0 left-0 h-12 w-full bg-gradient-to-t from-background-light to-transparent"></div>

      <!-- Map expand button -->
      <button
        class="absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
        @click="isMapExpanded = true"
      >
        <span class="material-symbols-outlined text-[16px]">open_in_full</span>
        지도 크게 보기
      </button>
    </div>

    <!-- Fullscreen Map Overlay (Mobile) -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-opacity duration-200"
        enter-from-class="opacity-0"
        enter-to-class="opacity-100"
        leave-active-class="transition-opacity duration-200"
        leave-from-class="opacity-100"
        leave-to-class="opacity-0"
      >
        <div
          v-if="isMapExpanded && buildingInfo?.lat && buildingInfo?.lng"
          class="md:hidden fixed inset-0 z-[60] bg-background-light"
        >
          <div class="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-white/80 to-transparent">
            <button
              class="flex size-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur-sm"
              @click="isMapExpanded = false"
            >
              <span class="material-symbols-outlined text-slate-700">close</span>
            </button>
            <span class="text-sm font-bold text-slate-900 bg-white/90 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm truncate max-w-[60vw]">{{ buildingName }}</span>
            <div class="size-10"></div>
          </div>
          <ClientOnly>
            <FacilityMap
              :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
              :facilities="buildingMarker"
              :level="3"
              class="w-full h-full"
            />
          </ClientOnly>
        </div>
      </Transition>
    </Teleport>

    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6 pb-20 md:pb-0">
      <div class="mb-6">
        <nav class="hidden md:flex items-center gap-1 text-sm text-slate-500 mb-3">
          <NuxtLink to="/real-estate" class="hover:text-primary">부동산</NuxtLink>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <NuxtLink :to="`/real-estate/${propertyTypeParam}`" class="hover:text-primary">{{ propertyMeta?.label }}</NuxtLink>
          <span class="material-symbols-outlined text-[14px]">chevron_right</span>
          <span class="text-slate-800">{{ buildingName }}</span>
        </nav>
        <!-- Mobile: badge + share -->
        <div class="md:hidden flex items-start justify-between mb-3">
          <span class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10">
            <span class="material-symbols-outlined text-[14px]">place</span> {{ propertyMeta?.label }}
          </span>
          <button class="text-slate-400 hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100" aria-label="이 건물 공유하기" @click="handleShare">
            <span class="material-symbols-outlined">share</span>
          </button>
        </div>
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

      <!-- 지도 + 로드뷰 (데스크톱) -->
      <section v-if="buildingInfo?.lat && buildingInfo?.lng" class="mb-6 hidden md:block">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <div class="flex items-center justify-between mb-2">
              <h2 class="text-lg font-semibold text-slate-800">위치</h2>
              <div class="flex items-center gap-1">
                <button
                  class="flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-primary transition-colors px-2 py-1 rounded-lg hover:bg-slate-50"
                  aria-label="이 건물 공유하기"
                  @click="handleShare"
                >
                  <span class="material-symbols-outlined text-[18px]">share</span>
                  공유
                </button>
                <div class="relative">
                  <button
                    class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-blue-50"
                    @click="showNavDropdown = !showNavDropdown"
                  >
                    <span class="material-symbols-outlined text-[18px]">directions</span>
                    길찾기
                    <span class="material-symbols-outlined text-[14px]">expand_more</span>
                  </button>
                  <div v-if="showNavDropdown" class="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl)">
                      <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
                    </button>
                    <div class="h-px bg-slate-100"></div>
                    <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl)">
                      <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
                    </button>
                  </div>
                </div>
              </div>
            </div>
            <div class="rounded-2xl bg-white border border-slate-100 overflow-hidden h-[300px]">
              <ClientOnly>
                <FacilityMap
                  :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
                  :facilities="buildingMarker"
                  :level="3"
                />
              </ClientOnly>
            </div>
          </div>
          <div>
            <h2 class="text-lg font-semibold text-slate-800 mb-2">로드뷰</h2>
            <div class="roadview-wrapper rounded-2xl bg-white border border-slate-100 overflow-hidden h-[300px]">
              <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
            </div>
          </div>
        </div>
      </section>

      <!-- 로드뷰 (모바일) -->
      <section v-if="buildingInfo?.lat && buildingInfo?.lng" class="mb-6 md:hidden">
        <div class="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100">
            <h2 class="text-slate-800 text-lg font-bold">로드뷰</h2>
          </div>
          <div class="p-4">
            <div class="roadview-wrapper rounded-xl overflow-hidden h-[200px]">
              <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
            </div>
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
        <Pagination
          v-if="transactions.totalPages > 1"
          :current-page="currentPage"
          :total-pages="transactions.totalPages"
          @page-change="goToPage"
        />
      </section>

      <!-- 주변 생활시설 -->
      <section v-if="buildingInfo?.lat && buildingInfo?.lng" class="mt-8">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">주변 생활시설</h2>
        <NearbyFacilities :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
      </section>

      <!-- 데이터 정보 -->
      <section v-if="lastSyncDate" class="mt-8">
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div class="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <span class="material-symbols-outlined text-slate-400 text-[20px]">description</span>
            <h2 class="text-slate-800 text-lg font-bold">데이터 정보</h2>
          </div>
          <div class="p-5 flex flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500">최근 동기화</span>
              <span class="text-sm font-medium text-slate-800">{{ lastSyncDate }}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-slate-500">출처</span>
              <a href="https://rt.molit.go.kr" target="_blank" rel="noopener noreferrer" class="text-sm font-medium text-primary hover:underline">국토교통부 실거래가 공개시스템</a>
            </div>
            <div class="mt-1 flex items-start gap-1.5 text-xs text-slate-400">
              <span class="material-symbols-outlined text-[14px] mt-px">info</span>
              <span>국토교통부 실거래가 공개시스템 기준 정보입니다</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- Mobile: Sticky Bottom Action Bar -->
    <div v-if="buildingInfo?.lat && buildingInfo?.lng" class="md:hidden fixed bottom-0 left-0 z-50 w-full bg-white/95 px-4 pt-3 shadow-[0_-4px_16px_-1px_rgba(0,0,0,0.05)] backdrop-blur-sm" :style="{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }">
      <div class="flex gap-3">
        <button
          class="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3.5 text-base font-bold text-slate-800 border border-slate-200 transition hover:bg-slate-200 active:scale-[0.98]"
          aria-label="이 건물 공유하기"
          @click="handleShare"
        >
          <span class="material-symbols-outlined text-[20px]">share</span>
          공유하기
        </button>
        <div class="relative flex-[2]">
          <button
            class="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-base font-bold text-white shadow-lg shadow-blue-500/30 transition hover:bg-blue-600 active:scale-[0.98]"
            @click="showMobileNavDropdown = !showMobileNavDropdown"
          >
            <span class="material-symbols-outlined text-[20px]">directions</span>
            길찾기
            <span class="material-symbols-outlined text-[16px]">expand_more</span>
          </button>
          <div v-if="showMobileNavDropdown" class="absolute bottom-full left-0 right-0 mb-2 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden z-20">
            <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(kakaoMapUrl); showMobileNavDropdown = false">
              <img src="/images/icons/kakaomap.svg" alt="카카오맵" class="w-5 h-5 rounded" /> 카카오맵으로 길찾기
            </button>
            <div class="h-px bg-slate-100"></div>
            <button class="w-full px-4 py-3 text-left text-sm font-medium text-slate-800 hover:bg-gray-50 flex items-center gap-3 transition-colors" @click="openNavigation(naverMapUrl); showMobileNavDropdown = false">
              <img src="/images/icons/navermap.svg" alt="네이버맵" class="w-5 h-5 rounded" /> 네이버맵으로 길찾기
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import type { FacilitySearchItem } from '~/types'
import type { RealEstatePropertyType, TransactionMode, RealEstateSearchResponse, TransactionStats, BuildingInfo } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useAnalytics } from '~/composables/useAnalytics'

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
  const tab = tabLabel.value
  const title = tab === '매매'
    ? `${buildingName.value} 매매 실거래가·시세 - 일상킷`
    : `${buildingName.value} 전월세 실거래가·전세가 - 일상킷`
  const description = tab === '매매'
    ? `${buildingName.value}의 최신 매매 실거래가와 시세 변동 추이를 확인하세요. 국토부 공식 데이터 기반 거래 내역과 주변 생활 인프라 정보를 함께 제공합니다.`
    : `${buildingName.value}의 최신 전월세 실거래가를 확인하세요. 전세가와 월세 시세, 거래 내역을 국토부 공식 데이터로 제공합니다.`
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

// 길찾기 URL
const kakaoMapUrl = computed(() =>
  `https://map.kakao.com/link/to/${encodeURIComponent(buildingName.value)},${buildingInfo.value?.lat},${buildingInfo.value?.lng}`)
const naverMapUrl = computed(() =>
  `https://map.naver.com/v5/directions/-/${buildingInfo.value?.lng},${buildingInfo.value?.lat},${encodeURIComponent(buildingName.value)}/-/walk`)

// 드롭다운 상태
const isMapExpanded = ref(false)
const showNavDropdown = ref(false)
const showMobileNavDropdown = ref(false)

const { trackBuildingView, trackDirectionsClick, trackShareClick } = useAnalytics()

function openNavigation(url: string) {
  const provider = url.includes('kakao') ? 'kakao' : 'naver'
  trackDirectionsClick({ facilityId: buildingName.value, category: propertyTypeParam.value, provider })
  window.open(url, '_blank')
  showNavDropdown.value = false
  showMobileNavDropdown.value = false
}

// 공유
async function handleShare() {
  trackShareClick({
    contentType: 'building',
    contentId: buildingName.value,
    method: navigator.share ? 'native' : 'clipboard',
  })

  const shareData = {
    title: buildingName.value,
    text: `${buildingName.value} ${propertyMeta.value?.label} 실거래가`,
    url: window.location.href,
  }
  try {
    if (navigator.share) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('링크가 복사되었습니다.')
    }
  } catch (err) {
    console.error('공유 실패:', err)
  }
}

// 외부 클릭 시 드롭다운 닫기
function handleClickOutside(e: MouseEvent) {
  const target = e.target as HTMLElement
  if (!target.closest('.relative')) {
    showNavDropdown.value = false
    showMobileNavDropdown.value = false
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// 최근 동기화 날짜
const { data: syncStatusResponse } = await useAsyncData(
  'real-estate-sync-status',
  () => $fetch<{ success: boolean; data: Record<string, string | null> }>('/api/meta/sync-status'),
  { lazy: true }
)
const lastSyncDate = computed(() => {
  if (!syncStatusResponse.value?.data) return null
  // apiSlugは "apt-sale" 형식 → 백엔드 키는 "aptSale" (camelCase)
  const key = apiSlug.value.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const iso = syncStatusResponse.value.data[key]
  if (!iso) return null
  return iso.slice(0, 10)
})

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

  // 현재 탭에 거래 데이터가 없으면 반대 탭으로 자동 전환 (최초 로드 시)
  if (transactions.value.total === 0 && stats.value.length === 0 && !route.query.tab) {
    const otherTab: TransactionMode = currentTab.value === 'sale' ? 'rent' : 'sale'
    currentTab.value = otherTab
    // watch가 재로드를 트리거하므로 여기서 return
    statsLoading.value = false
    txLoading.value = false
    return
  }

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

// buildingInfo 로드 후 building_viewed 이벤트 + 구조화 데이터 설정 + thin content noindex
watch(() => buildingInfo.value, (info) => {
  if (info) {
    trackBuildingView({
      propertyType: propertyTypeParam.value,
      buildingName: buildingName.value,
      city: info.city,
      district: info.district,
    })
  }
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
