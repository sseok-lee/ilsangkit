<template>
  <div class="bg-background-light">
    <!-- Loading State (lazy navigation) -->
    <div v-if="ssrLoading" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-gray-600">로딩 중...</p>
      </div>
    </div>

    <template v-else>
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
              class="flex size-11 items-center justify-center rounded-full bg-white/90 shadow-sm"
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

    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-4 md:pt-5 pb-20 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" class="hidden md:block" />

      <!-- Mobile: badge + share row -->
      <div class="md:hidden flex items-center justify-between">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-700 ring-1 ring-inset ring-purple-700/10">
          <span class="material-symbols-outlined text-[14px]">place</span> {{ propertyMeta?.label }}
        </span>
        <button class="text-slate-500 hover:text-primary transition-colors p-1 rounded-full hover:bg-gray-100" aria-label="이 건물 공유하기" @click="handleShare">
          <span class="material-symbols-outlined">share</span>
        </button>
      </div>

      <!-- PageHero -->
      <PageHero
        :eyebrow="`${propertyMeta?.label ?? ''} 실거래가`"
        :title="buildingName"
        :description="fullAddress !== '-' ? fullAddress : undefined"
        :stats="heroStats"
      />

      <!-- Ad: Hero 직후 (fold 하단) -->
      <AdBanner />

      <!-- "위치·로드뷰" 데스크톱 -->
      <SectionBlock v-if="buildingInfo?.lat && buildingInfo?.lng" heading="위치와 로드뷰" subtext="지도와 로드뷰로 건물 주변을 바로 확인할 수 있습니다." class="hidden md:block">
        <template #right>
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
        </template>
        <div class="grid grid-cols-2 gap-4">
          <div class="rounded-xl border border-line overflow-hidden h-[300px]">
            <ClientOnly>
              <FacilityMap
                :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
                :facilities="buildingMarker"
                :level="3"
              />
            </ClientOnly>
          </div>
          <div class="roadview-wrapper rounded-xl border border-line overflow-hidden h-[300px]">
            <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
          </div>
        </div>
      </SectionBlock>

      <!-- 로드뷰 (모바일) -->
      <SectionBlock v-if="buildingInfo?.lat && buildingInfo?.lng" heading="로드뷰" class="md:hidden">
        <div class="roadview-wrapper rounded-xl overflow-hidden h-[200px]">
          <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
        </div>
      </SectionBlock>

      <!-- "시세 추이" 블록 -->
      <SectionBlock heading="시세 추이" subtext="매매·전월세 탭과 기간별 추이로 가격 흐름을 비교합니다.">
        <template #right>
          <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1">
            <button
              v-for="opt in periodOptions"
              :key="opt.value ?? 'all'"
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
        </template>

        <!-- 매매/전월세 탭 -->
        <TransactionModeTab v-model="currentTab" class="mb-4" />

        <!-- 전월세 구분 토글 -->
        <RentTypeToggle
          v-if="currentTab === 'rent'"
          v-model="selectedRentType"
          class="mb-4"
        />

        <!-- 면적 선택 -->
        <AreaSelector
          v-if="areaGroups.length > 0"
          v-model="selectedArea"
          :areas="areaGroups"
          class="mb-4"
        />

        <!-- 시세 요약 (인라인 summary-grid) -->
        <div
          v-if="monthly.length > 0 && !statsLoading"
          class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 pt-4 border-t border-line"
        >
          <div>
            <span class="block text-slate-500 text-xs font-bold">최근 평균가</span>
            <strong class="block mt-1 text-base md:text-lg font-bold text-slate-900 truncate">{{ summaryLatestAvg }}</strong>
          </div>
          <div>
            <span class="block text-slate-500 text-xs font-bold">전월 대비</span>
            <strong :class="['block mt-1 text-base md:text-lg font-bold truncate', changeRateColor]">
              {{ summaryChangeRate }}
            </strong>
          </div>
          <div>
            <span class="block text-slate-500 text-xs font-bold">총 거래</span>
            <strong class="block mt-1 text-base md:text-lg font-bold text-slate-900 truncate">{{ summaryTotalCount }}건</strong>
          </div>
        </div>

        <!-- lowVolume 경고 -->
        <p v-if="summary?.lowVolume === true && !statsLoading" class="mb-3 text-xs text-amber-600">
          거래 건수가 적어 변동률이 부정확할 수 있습니다
        </p>

        <div v-if="statsLoading" class="flex justify-center py-8">
          <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
        <PriceTrendChart
          v-else-if="monthly.length > 0"
          :stats="monthly"
          :loading="false"
          :price-label="summary?.priceLabel"
        />
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          시세 데이터가 아직 없습니다.
        </div>
        <p v-if="currentTab === 'rent' && monthly.length > 0" class="mt-2 text-xs text-slate-400">
          ※ 월세 거래는 전환율 5% 기준 환산보증금으로 표시됩니다
        </p>
      </SectionBlock>

      <!-- Ad: 시세 추이 이후 (In-Article) -->
      <AdBanner />

      <!-- "거래 내역" 블록 -->
      <SectionBlock heading="거래 내역" subtext="계약일·전용면적·층·거래금액을 바로 비교하세요.">
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
          class="mt-4"
        />
      </SectionBlock>

      <!-- Ad: 거래내역 이후 1회 -->
      <AdBanner />

      <!-- "인근 단지" 블록 -->
      <SectionBlock
        v-if="nearbyComplexes.length > 0"
        :heading="`${buildingInfo?.district ?? ''} 인근 ${propertyMeta?.label ?? ''} 단지`"
        subtext="같은 지역 내 다른 단지 시세를 빠르게 비교해 보세요."
      >
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplexCard
            v-for="complex in nearbyComplexes"
            :key="`${complex.bjdCode}-${complex.buildingName}`"
            :complex="complex"
            :property-type="propertyTypeParam"
            :tab="currentTab"
          />
        </div>
      </SectionBlock>

      <!-- "주변 생활시설" 블록 -->
      <SectionBlock
        v-if="buildingInfo?.lat && buildingInfo?.lng"
        heading="주변 생활시설"
        subtext="부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다."
      >
        <NearbyFacilities :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
      </SectionBlock>

      <!-- 리뷰 -->
      <SectionBlock heading="사용자 리뷰" subtext="이 건물에 거주하거나 방문한 사용자들의 후기입니다.">
        <ClientOnly>
          <ReviewSection :category="propertyTypeParam" :facility-id="buildingName" />
        </ClientOnly>
      </SectionBlock>

      <!-- 관련 가이드 -->
      <RelatedGuides :categories="PROPERTY_GUIDE_CATEGORIES" :limit="3" />

      <!-- Ad: 본문 마무리 (하단) -->
      <AdBanner />

      <!-- 데이터 정보 -->
      <DataSourceCard
        v-if="lastSyncDate"
        :source="REAL_ESTATE_DATA_SOURCE"
        :last-sync-date="lastSyncDate"
      />
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

    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import type { FacilitySearchItem } from '~/types'
import type { RealEstatePropertyType, TransactionMode, RealEstateSearchResponse, TransactionStats, BuildingInfo, StatsSummary, AreaGroup, ComplexInfo } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { shouldNoindexRealEstateDetail } from '~/utils/realEstateNoindex'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useAnalytics } from '~/composables/useAnalytics'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, toRealEstateListUrl, isRealEstateUrlType } from '~/utils/realEstateUrl'
import type { RealEstateUrlType } from '~/utils/realEstateUrl'
import {
  hasUsableRealEstateDetailData,
  type RealEstateDetailData,
} from '~/utils/realEstateDetailData'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))

const route = useRoute()
const router = useRouter()

const PROPERTY_GUIDE_CATEGORIES: string[] = ['apt-sale', 'apt-rent', 'subscription']

// ── Route params ────────────────────────────────────────────────────────────

const realEstateTypeParam = route.params.realEstateType as string
const citySlugParam = route.params.city as string
const districtSlugParam = route.params.district as string

// Validate realEstateType
if (!isRealEstateUrlType(realEstateTypeParam)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// Build reverse map: slug → Korean district name
const DISTRICT_SLUG_TO_NAME: Record<string, string> = Object.entries(DISTRICT_SLUG_MAP).reduce(
  (acc, [name, slug]) => ({ ...acc, [slug]: name }),
  {} as Record<string, string>,
)

// Validate city slug
const cityName = CITY_SLUG_MAP[citySlugParam]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// Validate district slug
const districtName = DISTRICT_SLUG_TO_NAME[districtSlugParam]
if (!districtName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const buildingName = computed(() =>
  decodeURIComponent(route.params.buildingName as string).normalize('NFC'),
)

// ── Derived values ────────────────────────────────────────────────────────────

// Split realEstateType: e.g. "apt-sale" → propertyType="apt", tab="sale"
const realEstateType = realEstateTypeParam as RealEstateUrlType
const [propertyTypePart, tabPart] = realEstateType.split('-') as [string, string]
const propertyTypeParam = computed<RealEstatePropertyType>(() => propertyTypePart as RealEstatePropertyType)

// Tab is canonical from URL — no ?tab= query param
const currentTab = computed<TransactionMode>({
  get: () => tabPart as TransactionMode,
  set: (val) => {
    const siblingType = `${propertyTypePart}-${val}` as RealEstateUrlType
    router.push(
      toRealEstateUrl({
        type: siblingType,
        city: cityName,
        district: districtName,
        buildingName: buildingName.value,
      }),
    )
  },
})

const apiSlug = computed(() => toApiSlug(propertyTypeParam.value, currentTab.value))
const propertyMeta = computed(() => PROPERTY_TYPE_META[propertyTypeParam.value])

// ── SEO / Head ────────────────────────────────────────────────────────────────

const buildingInfo = ref<BuildingInfo | null>(null)
const summary = ref<StatsSummary | null>(null)
const statsLoading = ref(true)
const txLoading = ref(true)

// noindex 판정 (canonical 정책과 함께 사용) — .omc/notes/noindex-canonical-policy.md
const noindex = computed(() =>
  shouldNoindexRealEstateDetail({
    buildingName: buildingName.value,
    loaded: !statsLoading.value && !txLoading.value,
    hasBuildingInfo: buildingInfo.value !== null,
    totalCount: summary.value?.totalCount,
  }),
)

const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')

useHead(() => {
  const tab = tabLabel.value
  const cityShort = (buildingInfo.value?.city || cityName).replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
  const district = buildingInfo.value?.district || districtName
  const locLabel = cityShort && district ? `${cityShort} ${district}` : (district || cityShort)
  const transactionLabel = tab === '매매' ? '매매' : '전세·월세'
  const title = `${buildingName.value} ${transactionLabel} 실거래가 | ${locLabel} | 일상킷`
  const subject = [locLabel, `${buildingName.value}의`].filter(Boolean).join(' ')
  const description = summary.value?.totalCount
    ? `${subject} ${transactionLabel} 실거래가 정보입니다. 최근 ${summary.value.totalCount.toLocaleString()}건 거래, 시세 추이와 면적별 가격을 확인하세요.`
    : `${subject} ${transactionLabel} 실거래가 정보입니다. 시세 추이와 면적별 가격을 확인하세요.`

  // Canonical uses new URL structure — distinct per realEstateType (apt-sale ≠ apt-rent)
  const canonicalUrl = `${SITE_URL}${toRealEstateUrl({
    type: realEstateType,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
  })}`

  const ogImage = buildingInfo.value
    ? `${SITE_URL}/og?category=${propertyTypeParam.value}&title=${encodeURIComponent(buildingName.value)}&city=${encodeURIComponent(buildingInfo.value.city || '')}&district=${encodeURIComponent(buildingInfo.value.district || '')}`
    : DEFAULT_OG_IMAGE

  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImage },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'place' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
  ]
  // noindex/canonical 정책: noindex 일 때는 robots 만 보내고 canonical 은 생략한다.
  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    link: noindex.value ? [] : [{ rel: 'canonical', href: canonicalUrl }],
  }
})

// ── Composables ───────────────────────────────────────────────────────────────

const { useRealEstate } = await import('~/composables/useRealEstate')
const { searchTransactions, getTransactionStats, getBuildingInfo, getAreaGroups, getComplexList } = useRealEstate()

const { setBuildingPlaceSchema, setBreadcrumbSchema, setRealEstateListingSchema } = useStructuredData()

// Breadcrumb JSON-LD
const listUrl = toRealEstateListUrl({ type: realEstateType, city: cityName, district: districtName })
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산', url: '/real-estate' },
  { name: `${propertyMeta.value?.label ?? ''} ${tabLabel.value}`, url: `/real-estate/${propertyTypePart}` },
  { name: cityName, url: `/real-estate/${realEstateType}/${citySlugParam}` },
  { name: districtName, url: listUrl },
  { name: buildingName.value, url: toRealEstateUrl({ type: realEstateType, city: cityName, district: districtName, buildingName: buildingName.value }) },
])

// Breadcrumb 컴포넌트용 아이템
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산', href: '/real-estate', current: false },
  { label: `${propertyMeta.value?.label ?? ''} ${tabLabel.value}`, href: `/real-estate/${propertyTypePart}`, current: false },
  { label: cityName, href: `/real-estate/${realEstateType}/${citySlugParam}`, current: false },
  { label: districtName, href: listUrl, current: false },
  { label: buildingName.value, current: true },
])

// ── Navigation helpers ────────────────────────────────────────────────────────

const kakaoMapUrl = computed(() =>
  `https://map.kakao.com/link/to/${encodeURIComponent(buildingName.value)},${buildingInfo.value?.lat},${buildingInfo.value?.lng}`)
const naverMapUrl = computed(() =>
  `https://map.naver.com/v5/directions/-/${buildingInfo.value?.lng},${buildingInfo.value?.lat},${encodeURIComponent(buildingName.value)}/-/walk`)

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

async function handleShare() {
  const canShare = !!navigator.share
  trackShareClick({
    contentType: 'building',
    contentId: buildingName.value,
    method: canShare ? 'native' : 'clipboard',
  })

  const shareData = {
    title: buildingName.value,
    text: `${buildingName.value} ${propertyMeta.value?.label} 실거래가`,
    url: window.location.href,
  }
  try {
    if (canShare) {
      await navigator.share(shareData)
    } else {
      await navigator.clipboard.writeText(window.location.href)
      alert('링크가 복사되었습니다.')
    }
  } catch (err) {
    console.error('공유 실패:', err)
  }
}

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

// ── Sync status ───────────────────────────────────────────────────────────────

const { data: syncStatusResponse } = await useAsyncData(
  'real-estate-sync-status',
  () => $fetch<{ success: boolean; data: Record<string, string | null> }>('/api/meta/sync-status'),
  { lazy: true }
)
const lastSyncDate = computed(() => {
  if (!syncStatusResponse.value?.data) return null
  const key = apiSlug.value.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  const iso = syncStatusResponse.value.data[key]
  if (!iso) return null
  return iso.slice(0, 10)
})

// ── Computed display values ───────────────────────────────────────────────────

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

const heroStats = computed(() => {
  const items: { label: string; value: string }[] = []
  if (latestPrice.value !== '-') items.push({ label: '최근 거래', value: latestPrice.value })
  if (buildingInfo.value?.buildYear) items.push({ label: '건축년도', value: `${buildingInfo.value.buildYear}년` })
  if (areaRange.value !== '-') items.push({ label: '전용면적', value: areaRange.value })
  return items
})

// ── Stats / Transactions ──────────────────────────────────────────────────────

const monthly = ref<TransactionStats[]>([])
const areaGroups = ref<AreaGroup[]>([])
const selectedArea = ref<number | null>(null)
const selectedRentType = ref<'all' | 'jeonse' | 'wolse'>('all')

const selectedMonths = ref<number | null>(null)
const periodOptions: { label: string; value: number | null }[] = [
  { label: '전체', value: null },
  { label: '6개월', value: 6 },
  { label: '1년', value: 12 },
  { label: '3년', value: 36 },
  { label: '5년', value: 60 },
]

const summaryLatestAvg = computed(() => {
  if (summary.value?.recentAvg == null) return '-'
  return formatSummaryPrice(summary.value.recentAvg)
})

const summaryChangeRate = computed(() => {
  if (summary.value?.changeRate == null) return '-'
  const rate = summary.value.changeRate
  const sign = rate > 0 ? '▲' : rate < 0 ? '▼' : ''
  return `${sign} ${Math.abs(rate).toFixed(1)}%`
})

const changeRateColor = computed(() => {
  if (summary.value?.changeRate == null) return 'text-slate-500'
  if (summary.value.changeRate > 0) return 'text-red-500'
  if (summary.value.changeRate < 0) return 'text-blue-500'
  return 'text-slate-500'
})

const summaryTotalCount = computed(() => {
  return (summary.value?.totalCount ?? 0).toLocaleString()
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
const currentPage = ref(1)
const nearbyComplexes = ref<ComplexInfo[]>([])

const EMPTY_STATS_RESPONSE: RealEstateDetailData['statsResponse'] = { monthly: [], summary: null }
const EMPTY_TRANSACTIONS: RealEstateSearchResponse = { items: [], total: 0, page: 1, totalPages: 0 }

// ── bjdCode resolution ────────────────────────────────────────────────────────
// Resolve bjdCode from complex list before initial data load

const resolvedBjdCode = ref('')

function buildTransactionSearchParams(
  bjdCode: string,
  page: number
): Parameters<typeof searchTransactions>[1] {
  return {
    city: bjdCode ? undefined : cityName,
    district: bjdCode ? undefined : districtName,
    bjdCode: bjdCode || undefined,
    buildingName: buildingName.value,
    exclusiveArea: selectedArea.value ?? undefined,
    rentType: getRentTypeParam(),
    months: selectedMonths.value ?? undefined,
    page,
    limit: 5,
  }
}

async function resolveBuildingContext(): Promise<{ bjdCode: string; building: BuildingInfo | null }> {
  if (resolvedBjdCode.value) {
    return {
      bjdCode: resolvedBjdCode.value,
      building: buildingInfo.value,
    }
  }

  try {
    const listResult = await getComplexList(apiSlug.value, cityName, districtName, buildingName.value, 1, 1)
    const candidate = listResult.items[0]
    if (candidate?.bjdCode) {
      return { bjdCode: candidate.bjdCode, building: null }
    }
  } catch {
    // fall through to building-info based recovery
  }

  try {
    const fallbackBuilding = await getBuildingInfo(apiSlug.value, '', buildingName.value)
    if (fallbackBuilding?.bjdCode) {
      return { bjdCode: fallbackBuilding.bjdCode, building: fallbackBuilding }
    }
  } catch {
    // final fallback keeps empty bjdCode
  }

  return { bjdCode: '', building: null }
}

// ── SSR initial data load ─────────────────────────────────────────────────────

const { data: ssrData, error: ssrError, status: ssrStatus } = await useAsyncData(
  `re-detail-new-${realEstateType}-${citySlugParam}-${districtSlugParam}-${route.params.buildingName}`,
  async () => {
    const { bjdCode, building: primedBuilding } = await resolveBuildingContext()

    const [statsResult, txResult, infoResult, areaResult] = await Promise.allSettled([
      bjdCode
        ? getTransactionStats(apiSlug.value, bjdCode, buildingName.value, selectedMonths.value ?? undefined)
        : Promise.resolve(EMPTY_STATS_RESPONSE),
      searchTransactions(apiSlug.value, buildTransactionSearchParams(bjdCode, 1)),
      primedBuilding
        ? Promise.resolve(primedBuilding)
        : getBuildingInfo(apiSlug.value, bjdCode, buildingName.value),
      bjdCode
        ? getAreaGroups(apiSlug.value, bjdCode, buildingName.value)
        : Promise.resolve([]),
    ])
    return {
      bjdCode,
      statsResponse: statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS_RESPONSE,
      transactions: txResult.status === 'fulfilled' ? txResult.value : EMPTY_TRANSACTIONS,
      buildingInfo: infoResult.status === 'fulfilled' ? infoResult.value : null,
      areaGroups: areaResult.status === 'fulfilled' ? areaResult.value : [],
    }
  },
  { lazy: true }
)
const ssrLoading = computed(() => ssrStatus.value === 'pending')

watch(ssrData, (data) => {
  if (!data) return
  resolvedBjdCode.value = data.bjdCode || data.buildingInfo?.bjdCode || ''
  monthly.value = data.statsResponse.monthly as TransactionStats[]
  summary.value = data.statsResponse.summary as StatsSummary | null
  transactions.value = data.transactions as RealEstateSearchResponse
  buildingInfo.value = data.buildingInfo as BuildingInfo | null
  areaGroups.value = (data.areaGroups ?? []) as AreaGroup[]
  statsLoading.value = false
  txLoading.value = false

  if (import.meta.client && !hasUsableRealEstateDetailData(data)) {
    loadData()
    loadAreaGroups()
  }
}, { immediate: true })

if (import.meta.client && !ssrData.value && ssrStatus.value !== 'pending') {
  loadData()
  loadAreaGroups()
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getRentTypeParam(): string | undefined {
  if (selectedRentType.value === 'jeonse') return '전세'
  if (selectedRentType.value === 'wolse') return '월세'
  return undefined
}

async function reloadStats() {
  if (!buildingName.value) return
  statsLoading.value = true
  try {
    const { bjdCode, building } = await resolveBuildingContext()
    resolvedBjdCode.value = bjdCode
    if (building) {
      buildingInfo.value = building
    }

    if (!bjdCode) {
      monthly.value = []
      summary.value = null
      return
    }

    const res = await getTransactionStats(
      apiSlug.value, bjdCode, buildingName.value, selectedMonths.value ?? undefined,
      selectedArea.value ?? undefined,
      getRentTypeParam()
    )
    monthly.value = res.monthly
    summary.value = res.summary
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    statsLoading.value = false
  }
}

async function loadAreaGroups() {
  const { bjdCode } = await resolveBuildingContext()
  resolvedBjdCode.value = bjdCode
  if (!bjdCode) {
    areaGroups.value = []
    return
  }
  try {
    areaGroups.value = await getAreaGroups(apiSlug.value, bjdCode, buildingName.value)
  } catch {
    areaGroups.value = []
  }
}

async function loadData() {
  if (!buildingName.value) return

  statsLoading.value = true
  txLoading.value = true

  const { bjdCode, building: primedBuilding } = await resolveBuildingContext()
  resolvedBjdCode.value = bjdCode
  if (primedBuilding) {
    buildingInfo.value = primedBuilding
  }

  const [statsResult, txResult, infoResult] = await Promise.allSettled([
    bjdCode
      ? getTransactionStats(apiSlug.value, bjdCode, buildingName.value, selectedMonths.value ?? undefined,
        selectedArea.value ?? undefined, getRentTypeParam())
      : Promise.resolve(EMPTY_STATS_RESPONSE),
    searchTransactions(apiSlug.value, buildTransactionSearchParams(bjdCode, currentPage.value)),
    primedBuilding
      ? Promise.resolve(primedBuilding)
      : getBuildingInfo(apiSlug.value, bjdCode, buildingName.value),
  ])

  if (statsResult.status === 'fulfilled') {
    monthly.value = statsResult.value.monthly
    summary.value = statsResult.value.summary
  } else {
    monthly.value = []
    summary.value = null
  }
  transactions.value = txResult.status === 'fulfilled' ? txResult.value : EMPTY_TRANSACTIONS
  buildingInfo.value = infoResult.status === 'fulfilled' ? infoResult.value : null

  statsLoading.value = false
  txLoading.value = false
}

function goToPage(page: number) {
  currentPage.value = page
  loadData()
}

// Reload when URL changes (tab switch navigates to sibling URL)
watch(() => [apiSlug.value, buildingName.value], () => {
  currentPage.value = 1
  selectedArea.value = null
  selectedRentType.value = 'all'
  resolvedBjdCode.value = ''
  loadData()
  loadAreaGroups()
})

watch(selectedMonths, () => { currentPage.value = 1; loadData() })
watch(selectedArea, () => { currentPage.value = 1; loadData() })
watch(selectedRentType, () => { currentPage.value = 1; loadData() })

// ── Structured data + analytics ───────────────────────────────────────────────

// JSON-LD 스키마를 SSR-safe 경로로 등록 — buildingInfo lazy-load 전에도 route 파라미터로 유추 가능한
// 필드는 이미 들어가 있으며, buildingInfo 가 도착하면 useHead 가 reactive 하게 새 스키마로 교체된다.
setBuildingPlaceSchema(() => ({
  name: buildingName.value,
  address: fullAddress.value !== '-' ? fullAddress.value : buildingName.value,
  lat: buildingInfo.value?.lat ?? null,
  lng: buildingInfo.value?.lng ?? null,
  buildYear: buildingInfo.value?.buildYear,
  propertyType: propertyMeta.value?.label || '',
}))
setRealEstateListingSchema(() => ({
  name: buildingName.value,
  address: fullAddress.value !== '-' ? fullAddress.value : buildingName.value,
  city: buildingInfo.value?.city || cityName,
  district: buildingInfo.value?.district || districtName,
  propertyType: propertyMeta.value?.label || '',
  url: `${SITE_URL}${toRealEstateUrl({
    type: realEstateType,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
  })}`,
  buildYear: buildingInfo.value?.buildYear,
  totalCount: summary.value?.totalCount,
  lat: buildingInfo.value?.lat ?? null,
  lng: buildingInfo.value?.lng ?? null,
}))

// building_viewed analytics 는 클라이언트에서 buildingInfo 로드 후만 발화
watch(() => buildingInfo.value, (info) => {
  if (info) {
    trackBuildingView({
      propertyType: propertyTypeParam.value,
      buildingName: buildingName.value,
      city: info.city,
      district: info.district,
    })
  }
})

// ── Nearby complexes ──────────────────────────────────────────────────────────

watchEffect(async () => {
  if (buildingInfo.value?.city && buildingInfo.value?.district) {
    try {
      const response = await getComplexList(
        apiSlug.value,
        buildingInfo.value.city,
        buildingInfo.value.district,
        undefined,
        1,
        6
      )
      nearbyComplexes.value = response.items
        .filter(c => c.buildingName !== buildingName.value)
        .slice(0, 5)
    } catch (err) {
      console.error('Failed to load nearby complexes:', err)
      nearbyComplexes.value = []
    }
  }
})

// noindex / robots 는 상단 useHead 팩토리에서 canonical 과 함께 처리한다
// (.omc/notes/noindex-canonical-policy.md).
</script>

<style scoped>
.roadview-wrapper :deep(> div) {
  height: 100% !important;
}
.roadview-wrapper :deep(> div > div) {
  height: 100% !important;
}
</style>
