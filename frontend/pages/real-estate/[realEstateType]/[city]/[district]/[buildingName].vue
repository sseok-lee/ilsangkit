<template>
  <div class="bg-background-light">
    <!-- Loading State (lazy navigation) -->
    <div v-if="ssrLoading" class="flex items-center justify-center py-20 min-h-[400px]" role="status" aria-label="정보 로딩 중">
      <div class="text-center">
        <div class="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary mb-4"></div>
        <p class="text-gray-600">{{ UI_MESSAGES.loading }}</p>
      </div>
    </div>

    <template v-else>
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
      <!-- Unified Breadcrumb + Share (모바일 badge는 PageHero eyebrow가 흡수) -->
      <div class="flex items-center justify-between gap-2 order-1 md:order-1">
        <Breadcrumb :items="breadcrumbItems" />
        <button
          class="flex shrink-0 items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-lg border border-line text-slate-600 hover:text-primary hover:border-primary transition-colors text-sm"
          aria-label="이 건물 공유하기"
          @click="handleShare"
        >
          <span class="material-symbols-outlined text-[16px]">share</span>
          <span class="hidden sm:inline">공유</span>
        </button>
      </div>

      <!-- Hero: 모바일 헤더 / 데스크톱 PageHero -->
      <MobileDetailHeader
        class="order-2 md:order-2"
        :title="buildingName"
        :eyebrow="getDetailEyebrow(propertyMeta?.label ?? '', currentTab)"
        :stats="mobileHeaderStats"
        :kakao-map-url="kakaoMapUrl"
        :naver-map-url="naverMapUrl"
        share-label="이 건물 공유하기"
        @share="handleShare"
        @directions="(p) => openNavigation(p === 'kakao' ? kakaoMapUrl : naverMapUrl)"
      />
      <PageHero
        class="hidden md:block order-2 md:order-2"
        title-tag="div"
        :eyebrow="getDetailEyebrow(propertyMeta?.label ?? '', currentTab)"
        :title="buildingName"
        :description="fullAddress !== '-' ? fullAddress : undefined"
        :stats="heroStats"
      />

      <!-- Ad: Hero 직후 (fold 하단) -->
      <AdBanner class="order-3 md:order-3" variant="compact-mobile" />

      <!-- 위치·로드뷰 (responsive: mobile은 로드뷰만, md+에서 지도+로드뷰 2-col) -->
      <SectionBlock v-if="buildingInfo?.lat && buildingInfo?.lng" class="order-9 md:order-7" heading="위치와 로드뷰" subtext="지도와 로드뷰로 건물 주변을 바로 확인할 수 있습니다.">
        <template #right>
          <div class="hidden md:flex items-center gap-1">
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
                class="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-dark transition-colors px-2 py-1 rounded-lg hover:bg-primary-50"
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
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- 지도: 모바일에서도 노출 (짧은 높이 + 크게 보기 버튼) -->
          <div class="relative rounded-xl border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
            <ClientOnly>
              <FacilityMap
                :center="{ lat: buildingInfo.lat, lng: buildingInfo.lng }"
                :facilities="buildingMarker"
                :level="3"
              />
            </ClientOnly>
            <button
              class="md:hidden absolute bottom-3 left-3 z-20 flex items-center gap-1.5 bg-white/90 text-slate-700 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm text-xs font-medium hover:bg-white transition-colors"
              @click="isMapExpanded = true"
            >
              <span class="material-symbols-outlined text-[16px]">open_in_full</span>
              지도 크게 보기
            </button>
          </div>
          <div class="roadview-wrapper rounded-xl border border-line overflow-hidden" :class="DETAIL_MAP_MEDIA_HEIGHT">
            <FacilityRoadview :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
          </div>
        </div>
      </SectionBlock>

      <!-- Ad: 로드뷰 이후 (데스크톱은 위치(md:order-7)와 거래내역(md:order-9) 사이) -->
      <AdBanner class="order-10 md:order-8" variant="compact-mobile" />

      <!-- "전·월세 거래 비중" 블록 (rent 전용) — 시세추이(order-4) 직후로 승격 -->
      <SectionBlock
        v-if="currentTab === 'rent' && rentRatioTotal > 0"
        class="order-5 md:order-5"
        heading="전·월세 거래 비중"
        subtext="전체 거래의 전세·월세 구성입니다."
      >
        <RentRatioBar :jeonse-count="buildingInfo?.jeonseCount" :wolse-count="buildingInfo?.wolseCount" />
      </SectionBlock>

      <!-- "시세 추이" 블록 — T1 고유 콘텐츠: 데스크톱·모바일 모두 헤더 광고 직후 최상단(order-4) -->
      <SectionBlock class="order-4 md:order-4" :heading="getTrendSectionTitle(currentTab)" subtext="매매·전월세 탭과 기간별 추이로 가격 흐름을 비교합니다.">
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

        <!-- 시세 요약: 차트 위에서 선택 기간의 거래 흐름을 데이터 카드로 먼저 요약 -->
        <div
          v-if="monthly.length > 0 && !statsLoading"
          class="mb-4 rounded-xl border border-primary-100 bg-primary-50/40 p-4"
        >
          <div class="grid grid-cols-2 gap-3 md:grid-cols-5">
            <div class="rounded-lg border border-primary-100 bg-white p-3">
              <span class="block text-faint text-xs font-bold">{{ periodTradeLabel }}</span>
              <strong class="block mt-1 text-base md:text-lg font-display font-extrabold text-strong tabular-nums truncate">{{ periodTradeCount }}건</strong>
            </div>
            <div class="rounded-lg border border-primary-100 bg-white p-3">
              <span class="block text-faint text-xs font-bold">최근 평균가</span>
              <strong class="block mt-1 text-base md:text-lg font-display font-extrabold text-strong tabular-nums truncate">{{ summaryLatestAvg }}</strong>
            </div>
            <div class="rounded-lg border border-primary-100 bg-white p-3">
              <span class="block text-faint text-xs font-bold">최고 거래가</span>
              <strong class="block mt-1 text-base md:text-lg font-display font-extrabold text-strong tabular-nums truncate">{{ periodMaxPriceLabel }}</strong>
            </div>
            <div class="rounded-lg border border-primary-100 bg-white p-3">
              <span class="block text-faint text-xs font-bold">최저 거래가</span>
              <strong class="block mt-1 text-base md:text-lg font-display font-extrabold text-strong tabular-nums truncate">{{ periodMinPriceLabel }}</strong>
            </div>
            <div class="rounded-lg border border-primary-100 bg-white p-3">
              <span class="block text-faint text-xs font-bold">전월 대비</span>
              <strong :class="['block mt-1 text-base md:text-lg font-display font-extrabold tabular-nums truncate', changeRateColor]">
                {{ summaryChangeRate }}
              </strong>
            </div>
          </div>

          <div v-if="tradeFlowBadges.length > 0" class="mt-3 flex flex-wrap gap-2">
            <span
              v-for="badge in tradeFlowBadges"
              :key="badge.label"
              :class="['rounded-full px-2.5 py-1 text-xs font-bold', summaryBadgeClass(badge.tone)]"
            >
              {{ badge.label }}
            </span>
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
        <div v-else class="rounded-xl bg-background-light p-8 text-center text-faint">
          시세 데이터가 아직 없습니다.
        </div>
        <p v-if="currentTab === 'rent' && monthly.length > 0" class="mt-2 text-xs text-slate-400">
          ※ 월세 거래는 전환율 5% 기준 환산보증금으로 표시됩니다
        </p>
      </SectionBlock>

      <!-- Ad: 시세 추이/비중 ↔ 위치 사이 (데스크톱 md:order-6, 모바일 order-5는 비중 뒤로 tie-break) -->
      <AdBanner class="order-5 md:order-6" variant="compact-mobile" />

      <!-- "거래 내역" 블록 -->
      <SectionBlock class="order-6 md:order-9" :heading="getTxSectionTitle(currentTab)" subtext="계약일·전용면적·층·거래금액을 바로 비교하세요.">
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
        <div v-else class="rounded-xl bg-background-light p-8 text-center text-faint">
          {{ emptyFiltered('거래 내역') }}
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

      <!-- Ad: 거래내역 이후 (In-Article) -->
      <AdBanner class="order-7 md:order-10" variant="compact-mobile" />

      <!-- "인근 단지" 블록 — cross-property 3섹션 (apt → offitel → villa) -->
      <div
        v-if="nearbyByType.apt.length > 0 || nearbyByType.offitel.length > 0 || nearbyByType.villa.length > 0"
        class="flex flex-col gap-3 order-12 md:order-12"
      >
        <SectionBlock
          v-if="nearbyByType.apt.length > 0"
          subtext="같은 동 내 다른 아파트 단지를 함께 확인하세요."
        >
          <template #heading>
            <h3 class="text-display-3 text-slate-900 flex items-center gap-2">
              <img src="/icons/category/apt.webp?v2" alt="아파트" class="w-6 h-6" width="24" height="24" />
              {{ nearbyHeading('apt') }}
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NearbyComplexCard
              v-for="item in nearbyByType.apt"
              :key="`apt-${item.buildingName}-${item.bjdCode}`"
              :item="item"
              property-type="apt"
              :mode="currentTab"
              :rent-type="selectedRentType"
            />
          </div>
        </SectionBlock>

        <SectionBlock
          v-if="nearbyByType.offitel.length > 0"
          subtext="같은 동 내 오피스텔 단지의 실거래를 함께 확인하세요."
        >
          <template #heading>
            <h3 class="text-display-3 text-slate-900 flex items-center gap-2">
              <img src="/icons/category/offitel.webp?v2" alt="오피스텔" class="w-6 h-6" width="24" height="24" />
              {{ nearbyHeading('offitel') }}
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NearbyComplexCard
              v-for="item in nearbyByType.offitel"
              :key="`offitel-${item.buildingName}-${item.bjdCode}`"
              :item="item"
              property-type="offitel"
              :mode="currentTab"
              :rent-type="selectedRentType"
            />
          </div>
        </SectionBlock>

        <SectionBlock
          v-if="nearbyByType.villa.length > 0"
          subtext="같은 동 내 빌라 단지의 실거래를 비교해 보세요."
        >
          <template #heading>
            <h3 class="text-display-3 text-slate-900 flex items-center gap-2">
              <img src="/icons/category/villa.webp?v2" alt="빌라" class="w-6 h-6" width="24" height="24" />
              {{ nearbyHeading('villa') }}
            </h3>
          </template>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <NearbyComplexCard
              v-for="item in nearbyByType.villa"
              :key="`villa-${item.buildingName}-${item.bjdCode}`"
              :item="item"
              property-type="villa"
              :mode="currentTab"
              :rent-type="selectedRentType"
            />
          </div>
        </SectionBlock>
      </div>

      <!-- Ad: 인근 단지 이후 -->
      <AdBanner class="order-12 md:order-12" variant="compact-mobile" />

      <!-- "주변 생활시설" 블록 -->
      <SectionBlock
        v-if="buildingInfo?.lat && buildingInfo?.lng"
        class="order-12 md:order-12"
        heading="주변 생활시설"
        subtext="부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다."
      >
        <NearbyFacilities :lat="buildingInfo.lat" :lng="buildingInfo.lng" />
      </SectionBlock>

      <!-- Ad: 주변 생활시설 이후 -->
      <AdBanner class="order-12 md:order-12" variant="compact-mobile" />

      <!-- 네이버 블로그 후기 -->
      <BlogReviewSection
        v-if="buildingName"
        class="order-12 md:order-12"
        kind="real-estate"
        :primary-key="(realEstateTypeParam as string)"
        :secondary-key="`${cityName}|${districtName}|${buildingName}`"
      />

      <!-- 관련 가이드 -->
      <RelatedGuides class="order-12 md:order-12" :categories="PROPERTY_GUIDE_CATEGORIES" :limit="3" />

      <!-- 쿠팡 배너 -->
      <CoupangBanner class="order-12 md:order-12" />

      <!-- 데이터 출처 -->
      <!-- DataSourceSection은 멀티 루트 템플릿(compact/full v-if·v-else)이라 class fall-through가 안 됨 → order를 wrapper div에 부여 -->
      <div class="order-12 md:order-12">
        <DataSourceSection domain="real-estate" :last-sync-date="lastSyncDate" />
      </div>
    </main>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, defineAsyncComponent, onMounted, onBeforeUnmount } from 'vue'
import { useStructuredData } from '~/composables/useStructuredData'
import { UI_MESSAGES, emptyFiltered } from '~/utils/uiMessages'
import type { FacilitySearchItem } from '~/types'
import type { RealEstatePropertyType, TransactionMode, RealEstateSearchResponse, TransactionStats, BuildingInfo, StatsSummary, AreaGroup, ComplexInfo, PriceAnalysis, NearbyResponse } from '~/types/realEstate'
import { toApiSlug } from '~/types/realEstate'
import { shouldNoindexRealEstateDetail } from '~/utils/realEstateNoindex'
import { getDetailEyebrow, getTrendSectionTitle, getTxSectionTitle, getJeonsePct } from '~/utils/realEstateDetailLabels'
import RentRatioBar from '~/components/realEstate/RentRatioBar.vue'
import { formatKoreanPrice, formatKstDate } from '~/utils/formatters'
import {
  getPeriodTradeLabel,
  getPriceExtremes,
  getPriceRangeBadge,
  getRecencyBadge,
  getTradeActivityBadge,
  normalizeFacilitySummary,
  sumTransactionCount,
  type RealEstateSummaryBadge,
} from '~/utils/realEstateDetailSummary'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { buildRealEstateDetailMeta } from '~/composables/useRealEstateDetailMeta'
import { useAnalytics } from '~/composables/useAnalytics'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { toRealEstateUrl, toRealEstateListUrl, isRealEstateUrlType } from '~/utils/realEstateUrl'
import type { RealEstateUrlType } from '~/utils/realEstateUrl'
import {
  hasUsableRealEstateDetailData,
  type RealEstateDetailData,
} from '~/utils/realEstateDetailData'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import NearbyComplexCard from '~/components/realEstate/NearbyComplexCard.vue'
import RelatedGuides from '~/components/guide/RelatedGuides.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import BlogReviewSection from '~/components/blog/BlogReviewSection.vue'

const FacilityMap = defineAsyncComponent(() => import('~/components/map/FacilityMap.vue'))
import { DETAIL_MAP_MEDIA_HEIGHT } from '~/utils/mapMedia'

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
const propertyTypeParam = propertyTypePart as RealEstatePropertyType

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

const apiSlug = computed(() => toApiSlug(propertyTypeParam, currentTab.value))
const propertyMeta = computed(() => PROPERTY_TYPE_META[propertyTypeParam])

// ── SEO / Head ────────────────────────────────────────────────────────────────

const buildingInfo = ref<BuildingInfo | null>(null)
const fetchFailed = ref(false)   // SSR building-info 일시 실패 여부
const summary = ref<StatsSummary | null>(null)
const statsLoading = ref(true)
const txLoading = ref(true)
const facilitySummary = ref<string | null>(null)
// useHead가 SSR/hydration 시점에 callback을 평가하므로 그 안에서 참조하는 ref는
// useHead보다 위에 선언해야 한다. 아래로 옮기면 const TDZ ReferenceError가 발생해
// page가 unmount → @unhead beforeUnmount의 dispose() throw → error.vue로 fallback.
const areaGroups = ref<AreaGroup[]>([])
const transactions = ref<RealEstateSearchResponse>({ items: [], total: 0, page: 1, totalPages: 0 })

// noindex 판정 (canonical 정책과 함께 사용) — .omc/notes/noindex-canonical-policy.md
const noindex = computed(() =>
  shouldNoindexRealEstateDetail({
    buildingName: buildingName.value,
    loaded: !statsLoading.value && !txLoading.value,
    hasBuildingInfo: buildingInfo.value !== null,
    fetchFailed: fetchFailed.value,
  }),
)

const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')

function buildOgImage(info: BuildingInfo | null | undefined): string {
  if (!info) return DEFAULT_OG_IMAGE
  const hasCoords = !!(info.lat && info.lng)
  if (hasCoords) {
    return `${SITE_URL}/og-map?lat=${info.lat}&lng=${info.lng}&label=${encodeURIComponent(buildingName.value)}&category=${propertyTypeParam}&title=${encodeURIComponent(buildingName.value)}&city=${encodeURIComponent(info.city || '')}&district=${encodeURIComponent(info.district || '')}`
  }
  return `${SITE_URL}/og?category=${propertyTypeParam}&title=${encodeURIComponent(buildingName.value)}&city=${encodeURIComponent(info.city || '')}&district=${encodeURIComponent(info.district || '')}`
}

useHead(() => {
  const mode = currentTab.value

  // Area range from areaGroups (AreaGroup.area is the exclusive area in ㎡)
  let areaRange: { min: number; max?: number } | null = null
  const areaValues = areaGroups.value
    .map((g: AreaGroup) => Number(g.area))
    .filter((n: number) => Number.isFinite(n) && n > 0)
  if (areaValues.length > 0) {
    const minA = Math.min(...areaValues)
    const maxA = Math.max(...areaValues)
    areaRange = maxA > minA ? { min: minA, max: maxA } : { min: minA }
  }

  // Recent deal from first transaction item
  let recentDeal: { amount: number; dealDate: string } | undefined
  const firstTx = transactions.value.items[0]
  if (firstTx) {
    const amount = 'dealAmount' in firstTx ? firstTx.dealAmount : firstTx.deposit
    if (amount) {
      recentDeal = {
        amount: Number(amount),
        dealDate: `${firstTx.dealYear}년 ${firstTx.dealMonth}월`,
      }
    }
  }

  const totalCount = summary.value?.totalCount ?? 0
  const buildYearVal = firstTx?.buildYear ?? buildingInfo.value?.buildYear ?? null

  const { title, description } = buildRealEstateDetailMeta({
    buildingName: buildingName.value,
    region: {
      city: buildingInfo.value?.city || cityName,
      district: buildingInfo.value?.district || districtName,
      dong: buildingInfo.value?.dongName ?? null,
    },
    propertyType: propertyTypeParam,
    transactionMode: mode,
    summary: summary.value ? { totalCount, recentDeal } : null,
    buildYear: buildYearVal,
    areaRange,
    facilitySummary: facilitySummary.value,
  })

  // Canonical uses new URL structure — distinct per realEstateType (apt-sale ≠ apt-rent)
  const canonicalUrl = `${SITE_URL}${toRealEstateUrl({
    type: realEstateType,
    city: cityName,
    district: districtName,
    buildingName: buildingName.value,
  })}`

  const hasCoords = !!(buildingInfo.value?.lat && buildingInfo.value?.lng)
  const ogImage = buildOgImage(buildingInfo.value)
  const ogImageWidth = hasCoords ? '1024' : '1200'
  const ogImageHeight = hasCoords ? '536' : '630'

  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: ogImage },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: ogImage },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:image:width', content: ogImageWidth },
    { property: 'og:image:height', content: ogImageHeight },
  ]
  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  // noindex-canonical-policy.md: noindex 페이지는 canonical 을 출력하지 않는다 (신호 충돌 방지)
  return {
    title,
    meta,
    ...(noindex.value ? {} : { link: [{ rel: 'canonical', href: canonicalUrl }] }),
  }
})

// ── Composables ───────────────────────────────────────────────────────────────

const { useRealEstate } = await import('~/composables/useRealEstate')
const { searchTransactions, getTransactionStats, getBuildingInfo, getAreaGroups, getComplexList, getApartmentPriceAnalysis, getNearby } = useRealEstate()
const { useApiBase } = await import('~/composables/useApiBase')
const apiBase = useApiBase()

const { setBuildingPlaceSchema, setBreadcrumbSchema, setRealEstateListingSchema } = useStructuredData()

// Breadcrumb JSON-LD
const listUrl = toRealEstateListUrl({ type: realEstateType, city: cityName, district: districtName })
const typeHubPath = `/real-estate/${realEstateType}`
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: `${propertyMeta.value?.label ?? ''} ${tabLabel.value}`, url: typeHubPath },
  { name: cityName, url: `/real-estate/${realEstateType}/${citySlugParam}` },
  { name: districtName, url: listUrl },
  { name: buildingName.value, url: toRealEstateUrl({ type: realEstateType, city: cityName, district: districtName, buildingName: buildingName.value }) },
])

// Breadcrumb 컴포넌트용 아이템
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: `${propertyMeta.value?.label ?? ''} ${tabLabel.value}`, href: typeHubPath, current: false },
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

const { trackBuildingView, trackDirectionsClick, trackShareClick } = useAnalytics()

function openNavigation(url: string) {
  const provider = url.includes('kakao') ? 'kakao' : 'naver'
  trackDirectionsClick({ facilityId: buildingName.value, category: propertyTypeParam, provider })
  window.open(url, '_blank')
  showNavDropdown.value = false
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
  }
}
onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

// ── Sync status ───────────────────────────────────────────────────────────────

// Secondary fetches — sync-status를 secondary 패턴으로 통일 (Phase 2 spec 5.5).
// 현재는 단일 항목이지만 향후 확장성·시설 상세/홈과 일관성을 위해 동일 구조 채택.
const { data: secondaryResponse } = await useAsyncData(
  'real-estate-secondary',
  async () => {
    const signal = AbortSignal.timeout(8000)
    const [syncR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: Record<string, string | null> }>(
        `${apiBase}/api/meta/sync-status`,
        { signal }
      ),
    ])
    if (syncR.status === 'rejected') {
      console.warn('[real-estate-secondary] sync-status failed:', syncR.reason)
    }
    return {
      syncStatus: syncR.status === 'fulfilled' ? syncR.value.data : null,
    }
  },
  {
    lazy: true,
    default: () => ({ syncStatus: null as Record<string, string | null> | null }),
  }
)
const lastSyncDate = computed(() => {
  const syncStatus = secondaryResponse.value?.syncStatus
  if (!syncStatus) return null
  const key = apiSlug.value.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  return formatKstDate(syncStatus[key])
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
  const info = buildingInfo.value
  if (!info?.latestDealAmount) return '-'
  const deposit = formatKoreanPrice(info.latestDealAmount)
  if (info.latestMonthlyRent && info.latestMonthlyRent > 0) {
    return `${deposit} / ${formatKoreanPrice(info.latestMonthlyRent)}`
  }
  return deposit
})

const compactFacilitySummary = computed(() => normalizeFacilitySummary(facilitySummary.value))

const rentRatioTotal = computed(
  () => (buildingInfo.value?.jeonseCount ?? 0) + (buildingInfo.value?.wolseCount ?? 0),
)
const rentRatioLabel = computed(() => {
  const j = buildingInfo.value?.jeonseCount ?? 0
  const w = buildingInfo.value?.wolseCount ?? 0
  if (rentRatioTotal.value === 0) return '정보 없음'
  const jPct = getJeonsePct(j, w)
  return jPct >= 50 ? `전세 ${jPct}%` : `월세 ${100 - jPct}%`
})
const heroStats = computed(() => {
  const PLACEHOLDER = '정보 없음'
  const dealDate = buildingInfo.value?.latestDealYear && buildingInfo.value?.latestDealMonth
    ? `${buildingInfo.value.latestDealYear}년 ${buildingInfo.value.latestDealMonth}월`
    : PLACEHOLDER
  const area = { label: '전용면적', value: areaRange.value !== '-' ? areaRange.value : PLACEHOLDER }
  const recent = latestPrice.value !== '-' ? latestPrice.value : PLACEHOLDER
  if (currentTab.value === 'sale') {
    return [
      { label: '최근 거래가', value: recent },
      { label: '최근 거래일', value: dealDate },
      { label: '건축년도', value: buildingInfo.value?.buildYear ? `${buildingInfo.value.buildYear}년` : PLACEHOLDER },
      area,
    ]
  }
  return [
    { label: '최근 거래', value: recent },
    { label: '최근 거래일', value: dealDate },
    { label: '전·월세 비중', value: rentRatioLabel.value },
    area,
  ]
})

// 모바일 헤더 칩 — heroStats 재사용, '정보 없음' 항목 제외, 최대 4개
const mobileHeaderStats = computed(() =>
  heroStats.value.filter(s => s.value && s.value !== '정보 없음').slice(0, 4),
)

// ── Stats / Transactions ──────────────────────────────────────────────────────

const monthly = ref<TransactionStats[]>([])
// `areaGroups`는 useHead TDZ 회피를 위해 파일 상단(useHead 위)에서 이미 선언됨.
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
  return formatKoreanPrice(summary.value.recentAvg)
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
  if (summary.value.changeRate < 0) return 'text-primary-500'
  return 'text-slate-500'
})

const periodTradeLabel = computed(() => getPeriodTradeLabel(selectedMonths.value))

const periodTradeCount = computed(() => sumTransactionCount(monthly.value).toLocaleString())

const periodPriceExtremes = computed(() => getPriceExtremes(monthly.value))

const periodMaxPriceLabel = computed(() => {
  const price = periodPriceExtremes.value.maxPrice
  return price ? formatKoreanPrice(price) : '-'
})

const periodMinPriceLabel = computed(() => {
  const price = periodPriceExtremes.value.minPrice
  return price ? formatKoreanPrice(price) : '-'
})

const tradeFlowBadges = computed<RealEstateSummaryBadge[]>(() => {
  const badges: RealEstateSummaryBadge[] = [
    getTradeActivityBadge(sumTransactionCount(monthly.value)),
  ]

  const recency = getRecencyBadge(
    buildingInfo.value?.latestDealYear,
    buildingInfo.value?.latestDealMonth,
  )
  if (recency) badges.push(recency)

  const range = getPriceRangeBadge(
    periodPriceExtremes.value.maxPrice,
    periodPriceExtremes.value.minPrice,
    summary.value?.recentAvg,
  )
  if (range) badges.push(range)

  return badges
})

function summaryBadgeClass(tone: RealEstateSummaryBadge['tone']): string {
  if (tone === 'green') return 'bg-emerald-50 text-emerald-700'
  if (tone === 'blue') return 'bg-primary-50 text-primary-700'
  if (tone === 'amber') return 'bg-amber-50 text-amber-700'
  return 'bg-slate-100 text-slate-600'
}

// `transactions`는 useHead TDZ 회피를 위해 파일 상단(useHead 위)에서 이미 선언됨.
const currentPage = ref(1)
const nearbyComplexes = ref<ComplexInfo[]>([])
const nearbyByType = ref<NearbyResponse>({ apt: [], villa: [], offitel: [] })
const isApt = computed(() => propertyTypeParam === 'apt')
const priceAnalysis = ref<PriceAnalysis | null>(null)
const showPriceAnalysis = computed(() => isApt.value && !!priceAnalysis.value && priceAnalysis.value.saleCount >= 5)

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
    limit: 10,
  }
}

async function resolveBuildingContext(): Promise<{ bjdCode: string; building: BuildingInfo | null }> {
  if (resolvedBjdCode.value) {
    return { bjdCode: resolvedBjdCode.value, building: buildingInfo.value }
  }

  // getComplexList: HTTP 에러(일시 장애)면 throw되어 상위 로더가 잡는다. 빈 목록은 정상 통과.
  const listResult = await getComplexList(apiSlug.value, cityName, districtName, buildingName.value, 1, 1)
  const candidate = listResult.items[0]
  if (candidate?.bjdCode) {
    return { bjdCode: candidate.bjdCode, building: null }
  }

  // fallback: getBuildingInfo는 404→null(없는 건물), 일시 장애→throw.
  const fallbackBuilding = await getBuildingInfo(apiSlug.value, '', buildingName.value)
  if (fallbackBuilding?.bjdCode) {
    return { bjdCode: fallbackBuilding.bjdCode, building: fallbackBuilding }
  }

  return { bjdCode: '', building: null }
}

// ── SSR initial data load ─────────────────────────────────────────────────────

const { data: ssrData, error: ssrError, status: ssrStatus } = await useAsyncData(
  `re-detail-new-${realEstateType}-${citySlugParam}-${districtSlugParam}-${route.params.buildingName}`,
  async () => {
    let infoFetchFailed = false
    let bjdCode = ''
    let primedBuilding: BuildingInfo | null = null
    try {
      const ctx = await resolveBuildingContext()
      bjdCode = ctx.bjdCode
      primedBuilding = ctx.building
    } catch {
      infoFetchFailed = true   // bjdCode 해석 단계의 일시 장애
    }

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
    const resolvedBuildingInfo = infoResult.status === 'fulfilled' ? infoResult.value : null
    if (infoResult.status === 'rejected') infoFetchFailed = true
    let facilitySummarySSR: string | null = null
    if (resolvedBuildingInfo?.lat && resolvedBuildingInfo?.lng) {
      try {
        const facilityRes = await $fetch(`${apiBase}/api/facilities/search`, {
          method: 'POST',
          body: { lat: resolvedBuildingInfo.lat, lng: resolvedBuildingInfo.lng, radius: 1000 },
        })
        const facilityItems: any[] = (facilityRes as any)?.data?.items ?? (facilityRes as any)?.items ?? []
        const DISPLAY_CATS = ['school', 'hospital', 'park', 'childcare', 'sports', 'pharmacy'] as const
        const FACILITY_LABELS: Record<string, string> = {
          school: '학교', hospital: '병원', park: '공원', childcare: '어린이집', sports: '체육시설', pharmacy: '약국',
        }
        const parts = DISPLAY_CATS
          .map(cat => ({ cat, count: facilityItems.filter((i: any) => i.category === cat).length }))
          .filter(({ count }) => count > 0)
          .slice(0, 2)
          .map(({ cat, count }) => `${FACILITY_LABELS[cat]} ${count}곳`)
        if (parts.length > 0) facilitySummarySSR = parts.join('·')
      } catch {
        // best-effort — facility summary is optional SEO enhancement
      }
    }
    return {
      bjdCode,
      statsResponse: statsResult.status === 'fulfilled' ? statsResult.value : EMPTY_STATS_RESPONSE,
      transactions: txResult.status === 'fulfilled' ? txResult.value : EMPTY_TRANSACTIONS,
      buildingInfo: resolvedBuildingInfo,
      areaGroups: areaResult.status === 'fulfilled' ? areaResult.value : [],
      facilitySummary: facilitySummarySSR,
      infoFetchFailed,
    }
  },
)
if (import.meta.server && ssrData.value?.infoFetchFailed) {
  fetchFailed.value = true
  markDegradedResponse()
}
const ssrLoading = computed(() => ssrStatus.value === 'pending')

watch(ssrData, (data) => {
  if (!data) return
  resolvedBjdCode.value = data.bjdCode || data.buildingInfo?.bjdCode || ''
  monthly.value = data.statsResponse.monthly as TransactionStats[]
  summary.value = data.statsResponse.summary as StatsSummary | null
  transactions.value = data.transactions as RealEstateSearchResponse
  buildingInfo.value = data.buildingInfo as BuildingInfo | null
  areaGroups.value = (data.areaGroups ?? []) as AreaGroup[]
  facilitySummary.value = data.facilitySummary ?? null
  statsLoading.value = false
  txLoading.value = false
  fetchFailed.value = data.infoFetchFailed ?? false

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
  address: fullAddress.value !== '-' ? fullAddress.value : `${cityName} ${districtName}`,
  city: buildingInfo.value?.city || cityName,
  district: buildingInfo.value?.district || districtName,
  lat: buildingInfo.value?.lat ?? null,
  lng: buildingInfo.value?.lng ?? null,
  buildYear: buildingInfo.value?.buildYear,
  propertyType: propertyMeta.value?.label || '',
  propertySlug: propertyTypePart as 'apt' | 'villa' | 'offitel',
  image: buildOgImage(buildingInfo.value),
}))
setRealEstateListingSchema(() => {
  const info = buildingInfo.value
  const latestDealDate = info?.latestDealYear && info?.latestDealMonth
    ? `${info.latestDealYear}-${String(info.latestDealMonth).padStart(2, '0')}-01`
    : undefined
  return {
    name: buildingName.value,
    address: fullAddress.value !== '-' ? fullAddress.value : `${cityName} ${districtName}`,
    city: info?.city || cityName,
    district: info?.district || districtName,
    propertyType: propertyMeta.value?.label || '',
    url: `${SITE_URL}${toRealEstateUrl({
      type: realEstateType,
      city: cityName,
      district: districtName,
      buildingName: buildingName.value,
    })}`,
    buildYear: info?.buildYear,
    totalCount: summary.value?.totalCount,
    lat: info?.lat ?? null,
    lng: info?.lng ?? null,
    image: buildOgImage(info),
    // summary.recentAvg는 만원 단위 — schema.org offers.price는 KRW(원) 이므로 10_000 곱해 전달
    recentAvg: summary.value?.recentAvg != null ? summary.value.recentAvg * 10_000 : undefined,
    latestDealDate,
  }
})

// building_viewed analytics 는 클라이언트에서 buildingInfo 로드 후만 발화
watch(() => buildingInfo.value, (info) => {
  if (info) {
    trackBuildingView({
      propertyType: propertyTypeParam,
      buildingName: buildingName.value,
      city: info.city,
      district: info.district,
    })
  }
})

// ── Nearby complexes ──────────────────────────────────────────────────────────

// 가격 심화 분석 (아파트만, bjdCode 확보 후)
watch(resolvedBjdCode, async (code) => {
  if (!code || !isApt.value) return
  try {
    priceAnalysis.value = await getApartmentPriceAnalysis(code, buildingName.value)
  } catch {
    priceAnalysis.value = null
  }
}, { immediate: true })

function nearbyHeading(propertyType: 'apt' | 'villa' | 'offitel'): string {
  const label = propertyType === 'apt' ? '아파트' : propertyType === 'villa' ? '빌라' : '오피스텔'
  if (currentTab.value === 'sale') return `주변 ${label} 매매가`
  if (selectedRentType.value === 'jeonse') return `주변 ${label} 전세가`
  if (selectedRentType.value === 'wolse') return `주변 ${label} 월세가`
  return `주변 ${label} 전월세`
}

async function loadNearby() {
  const bjd = resolvedBjdCode.value
  if (!bjd) {
    nearbyByType.value = { apt: [], villa: [], offitel: [] }
    return
  }
  const mode = currentTab.value
  const rentTypeKey = mode === 'rent'
    ? (selectedRentType.value === 'jeonse' ? 'jeonse'
       : selectedRentType.value === 'wolse' ? 'wolse'
       : 'all') as 'all' | 'jeonse' | 'wolse'
    : undefined
  try {
    nearbyByType.value = await getNearby(bjd, mode, {
      rentType: rentTypeKey,
      dongName: buildingInfo.value?.dongName,
      excludeBuildingName: buildingName.value,
      limitPerType: 4,
    })
  } catch (err) {
    console.error('Failed to load nearby:', err)
    nearbyByType.value = { apt: [], villa: [], offitel: [] }
  }
}

watch(
  () => [resolvedBjdCode.value, currentTab.value, selectedRentType.value, buildingInfo.value?.dongName] as const,
  () => { loadNearby() },
  { immediate: true }
)

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
