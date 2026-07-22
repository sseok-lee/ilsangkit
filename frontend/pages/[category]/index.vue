<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" />

      <!-- Hero -->
      <PageHero
        :eyebrow="categoryParam === 'trash' ? '쓰레기 배출 목록' : '생활시설 목록'"
        :title="pageTitle"
        :description="pageDescription"
        :stats="heroStats"
      />

      <!-- Error State -->
      <div
        v-if="facilityError"
        role="alert"
        class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm"
      >
        {{ facilityError }}
      </div>

      <!-- 지역 선택 -->
      <SectionBlock
        heading="지역 선택"
        :subtext="categoryParam === 'trash' ? '시/도를 선택해 배출 정보를 확인하세요.' : '지역을 먼저 선택하면 정확한 목록을 빠르게 찾을 수 있어요.'"
      >
        <RegionChips
          :href-for="(slug) => (slug ? `/${categoryParam}?city=${slug}` : `/${categoryParam}`)"
          :active-slug="queryCitySlug"
        />
      </SectionBlock>

      <!-- 진료과목 필터 (병원 전용) -->
      <HospitalDepartmentFilter
        v-if="categoryParam === 'hospital'"
        v-model="selectedDepartments"
        @apply="handleDepartmentApply"
      />

      <!-- Ad: 필터 직후 -->
      <AdBanner />

      <!-- Trash category: waste schedule UI -->
      <template v-if="categoryParam === 'trash'">
        <SectionBlock heading="배출 일정" :subtext="`${wasteTotal.toLocaleString('ko-KR')}건 · 지역·동별 배출 요일과 방법`">
          <template #right>
            <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{{ wasteTotal.toLocaleString('ko-KR') }}건</span>
          </template>

          <!-- 로딩 상태 -->
          <div v-if="wasteLoading || initialLoading" class="flex items-center justify-center py-10" role="status" aria-label="배출 일정 로딩 중" aria-live="polite" aria-busy="true">
            <div class="text-center">
              <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
              <p class="text-slate-500 text-sm">배출 일정 조회 중...</p>
            </div>
          </div>

          <!-- 담당 부서 연락처 -->
          <div v-if="wasteContact && !wasteLoading && !initialLoading" class="bg-primary-50 rounded-xl p-4 border border-primary-100 mb-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-primary-500 text-[18px]">support_agent</span>
              <span class="font-semibold text-primary-900 text-sm">{{ wasteContact.name }}</span>
            </div>
            <a
              v-if="wasteContact.phone"
              :href="`tel:${wasteContact.phone}`"
              class="text-primary text-sm hover:underline flex items-center gap-1"
            >
              <span class="material-symbols-outlined text-[16px]">call</span>
              {{ wasteContact.phone }}
            </a>
          </div>

          <!-- 배출 일정 목록 -->
          <div v-if="wasteSchedules.length > 0 && !wasteLoading && !initialLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <WasteScheduleCard
              v-for="region in wasteSchedules"
              :key="region.id"
              :region="region"
              @select="openWasteSchedule"
            />
          </div>

          <!-- 페이지네이션 -->
          <Pagination v-if="!wasteLoading && !initialLoading" :current-page="wasteCurrentPage" :total-pages="wasteTotalPages" @page-change="goToWastePage" />

          <!-- 결과 없음 -->
          <EmptyState
            v-if="wasteSchedules.length === 0 && !wasteLoading && !initialLoading"
            icon="delete"
            title="등록된 배출 일정이 없습니다"
            description="해당 지역의 배출 정보가 아직 등록되지 않았어요"
          >
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="queryCitySlug"
                class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="resetCityFilter"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                필터 초기화
              </button>
              <NuxtLink
                to="/"
                class="btn-primary inline-flex items-center gap-1.5 text-sm min-h-[44px]"
              >
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </EmptyState>
        </SectionBlock>

        <WasteScheduleDetailModal
          :open="selectedWasteScheduleId !== null"
          :schedule="selectedWasteSchedule"
          :loading="wasteDetailLoading"
          :error="wasteDetailError"
          @close="closeWasteSchedule"
        />
      </template>

      <!-- Non-trash: facility card grid -->
      <template v-else>
        <SectionBlock :heading="`${resultTitle} ${catLabel} 목록`" subtext="지역 선택 후 목록·페이지를 확인하세요.">
          <template #right>
            <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{{ displayTotal.toLocaleString('ko-KR') }}건</span>
          </template>

          <!-- Loading Skeleton -->
          <div v-if="loading || initialLoading" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
            <LoadingSkeleton variant="facility-card" />
          </div>

          <template v-else-if="!initialLoading">
            <!-- Card Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <FacilityCard
                v-for="facility in displayFacilities"
                :key="facility.id"
                :facility="facility"
              />
            </div>

            <!-- Empty State -->
            <EmptyState
              v-if="displayFacilities.length === 0"
              :icon="categoryMeta?.icon || 'search_off'"
              :title="UI_MESSAGES.emptySearch"
              description="다른 지역이나 검색어를 시도해보세요"
            >
              <div class="flex items-center justify-center gap-3">
                <button
                  v-if="queryCitySlug"
                  class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  @click="resetCityFilter"
                >
                  <span class="material-symbols-outlined text-[16px]">refresh</span>
                  필터 초기화
                </button>
                <NuxtLink
                  to="/"
                  class="btn-primary inline-flex items-center gap-1.5 min-h-[44px] text-sm"
                >
                  <span class="material-symbols-outlined text-[16px]">home</span>
                  홈으로 돌아가기
                </NuxtLink>
              </div>
            </EmptyState>

            <!-- Pagination -->
            <Pagination :current-page="currentPage" :total-pages="displayTotalPages" @page-change="goToPage" />
          </template>
        </SectionBlock>
      </template>

      <!-- Ad: 결과 뒤 -->
      <AdBanner />

      <!-- 관련 탐색 -->
      <SectionBlock
        v-if="relatedCategories.length > 0 || popularRegionLinks.length > 0"
        heading="관련 탐색"
        subtext="비슷한 카테고리나 인기 지역으로 탐색을 이어가세요."
      >
        <div v-if="relatedCategories.length > 0" class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-slate-500 font-medium pr-1">관련 카테고리</span>
          <NuxtLink
            v-for="cat in relatedCategories"
            :key="cat.slug"
            :to="`/${cat.slug}`"
            class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
          >
            {{ cat.label }}
          </NuxtLink>
        </div>
        <div v-if="popularRegionLinks.length > 0" class="flex flex-wrap items-center gap-2 mt-3">
          <span class="text-xs text-slate-500 font-medium pr-1">인기 지역</span>
          <NuxtLink
            v-for="region in popularRegionLinks"
            :key="`${region.citySlug}-${region.districtSlug}`"
            :to="`/${region.citySlug}/${region.districtSlug}/${categoryParam}`"
            class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
          >
            {{ region.label }} {{ catLabel }}
          </NuxtLink>
        </div>
      </SectionBlock>

      <!-- FAQ Section -->
      <SectionBlock v-if="faqItems && faqItems.length > 0" heading="자주 묻는 질문">
        <div class="space-y-1">
          <details v-for="(faq, i) in faqItems" :key="i" class="border-b border-line last:border-b-0">
            <summary class="py-3 cursor-pointer font-medium text-slate-800 hover:text-primary">
              {{ faq.question }}
            </summary>
            <p class="pb-3 text-slate-600 text-sm leading-relaxed">{{ faq.answer }}</p>
          </details>
        </div>
      </SectionBlock>

      <!-- 관련 가이드 (SSR 렌더 — 내부링크 색인 노출) -->
      <RelatedGuides :category="categoryParam" />


      <!-- 데이터 출처 -->
      <DataSourceSection domain="facility" :category="categoryParam" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useWasteSchedule, transformToRegionSchedules } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { RELATED_CATEGORIES, POPULAR_REGIONS } from '~/utils/seoConstants'
import { FACILITY_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import WasteScheduleDetailModal from '~/components/trash/WasteScheduleDetailModal.vue'
import RegionChips from '~/components/common/RegionChips.vue'
import { resolveCityParam, buildListFetch } from '~/utils/regionChips'
import type { RegionSchedule, WasteScheduleDetail } from '~/composables/useWasteSchedule'
import type { FacilityCategory } from '~/types/facility'
import { useAnalytics } from '~/composables/useAnalytics'
import { PAGINATION_ROBOTS_CONTENT, parsePositivePageQuery } from '~/utils/pageQuery'
import { withSyncDate, TRASH_STALE_DAYS, FACILITY_STALE_DAYS } from '~/utils/syncFreshness'
import { useSyncStatus } from '~/composables/useSyncStatus'
import { useNationalStats } from '~/composables/useNationalStats'
import { buildCategoryListStats } from '~/utils/heroBandStats'

const route = useRoute()
const router = useRouter()

// Route params
const categoryParam = computed(() => route.params.category as FacilityCategory)
const categoryMeta = computed(() => CATEGORY_META[categoryParam.value])
const categoryDataSource = computed(() => FACILITY_DATA_SOURCE[categoryParam.value] ?? null)

const relatedCategories = computed(() => {
  const related = RELATED_CATEGORIES[categoryParam.value] || []
  return related
    .filter(c => c !== categoryParam.value)
    .map(c => ({ slug: c, label: CATEGORY_META[c as FacilityCategory]?.label || c }))
})

// Validate category slug (Soft 404 방지)
if (!CATEGORY_META[route.params.category as FacilityCategory]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Query params (city slug → Korean name)
const queryCitySlug = computed(() => (route.query.city as string) || '')
const cityName = computed(() => resolveCityParam(queryCitySlug.value) || '')

// Search composables
const { loading, facilities, total, currentPage, totalPages, error: facilityError, search, resetPage, setPage } = useFacilitySearch()
const { trackCategoryPageView } = useAnalytics()
const { getSchedules, getScheduleDetail, isLoading: wasteLoading } = useWasteSchedule()
const { setCategoryMeta } = useFacilityMeta()
const { setItemListSchema, setBreadcrumbSchema, setFAQSchema, setDatasetSchema } = useStructuredData()

// SSR: 초기 데이터를 서버에서 로드.
// route.query.page 를 SSR 시점에서 읽어 동일 페이지 데이터를 반환해야
// `/toilet?page=2` 직접 진입 시 SSR HTML이 page 1 콘텐츠로 엇나가지 않는다.
// route.query.city 도 SSR 시점에서 한글 city명으로 변환해 반영해야 `/toilet?city=seoul` 직접
// 진입 시 SSR HTML이 전국 목록이 아닌 서울 필터 목록으로 렌더된다(thin-dup 해소).
// fetch 대상(url/options) 결정 로직은 buildListFetch(순수 함수, ~/utils/regionChips)로 분리해
// 라우터 주입·Suspense 없이도 city 필터를 단위 테스트할 수 있게 한다.
const isTrash = categoryParam.value === 'trash'
const initialPage = parsePositivePageQuery(route.query.page)
const { data: ssrData } = await useAsyncData(
  `cat-list-${categoryParam.value}-${queryCitySlug.value || 'all'}-p${initialPage}`,
  () => {
    const { url, options } = buildListFetch(categoryParam.value, queryCitySlug.value, initialPage)
    return $fetch<any>(url, options)
  },
)

// SSR 데이터가 있으면 초기 로딩 완료
const initialLoading = ref(!ssrData.value?.data)

// Filter state
const selectedDepartments = ref<string[]>([])
// Waste schedule state — SSR 데이터로 초기화
const ssrItems = ssrData.value?.data
// SSR 경로는 backend raw items를 반환하므로 client 페이지네이션과 동일하게 transform 적용
// (시/도·wasteTypes·uncollectedDay·emissionPlaceType 등이 모두 채워지도록)
const ssrTransformed = isTrash && ssrItems && !ssrItems.schedules
  ? transformToRegionSchedules(ssrItems)
  : null
const wasteSchedules = ref<RegionSchedule[]>(
  isTrash && ssrItems
    ? (ssrTransformed?.schedules ?? ssrItems.schedules ?? [])
    : []
)
const wasteContact = ref<{ name: string; phone?: string } | null>(
  isTrash && ssrItems
    ? (ssrTransformed?.contact ?? ssrItems.contact ?? null)
    : null
)
const wasteCurrentPage = ref(initialPage)
const wasteTotalPages = ref(isTrash && ssrItems ? ssrItems.totalPages ?? 1 : 1)
const wasteTotal = ref(isTrash && ssrItems ? ssrItems.total ?? 0 : 0)
const selectedWasteSchedule = ref<WasteScheduleDetail | null>(null)
const wasteDetailLoading = ref(false)
const wasteDetailError = ref(false)
let detailRequestId = 0
let modalOpenedFromList = false

function parseScheduleQuery(value: unknown): number | null {
  const raw = Array.isArray(value) ? value[0] : value
  const id = Number(raw)
  return Number.isInteger(id) && id > 0 ? id : null
}

const selectedWasteScheduleId = computed(() =>
  categoryParam.value === 'trash' ? parseScheduleQuery(route.query.schedule) : null
)

async function loadWasteScheduleDetail(id: number) {
  const requestId = ++detailRequestId
  wasteDetailLoading.value = true
  wasteDetailError.value = false
  selectedWasteSchedule.value = null

  const detail = await getScheduleDetail(id)
  if (requestId !== detailRequestId) return

  selectedWasteSchedule.value = detail
  wasteDetailError.value = detail === null
  wasteDetailLoading.value = false
}

async function openWasteSchedule(schedule: RegionSchedule) {
  modalOpenedFromList = true
  await navigateTo({ query: { ...route.query, schedule: String(schedule.id) } })
}

function closeWasteSchedule() {
  if (modalOpenedFromList) {
    modalOpenedFromList = false
    router.back()
    return
  }

  const nextQuery: LocationQueryRaw = { ...route.query }
  delete nextQuery.schedule
  navigateTo({ query: nextQuery }, { replace: true })
}

// 시설 목록 — SSR 데이터가 있으면 composable 대신 표시
const ssrFacilities = ref(!isTrash && ssrItems ? ssrItems.items ?? [] : [])
const ssrTotal = ref(!isTrash && ssrItems ? ssrItems.total ?? 0 : 0)
const ssrTotalPages = ref(!isTrash && ssrItems ? ssrItems.totalPages ?? 0 : 0)
const ssrConsumed = ref(false)

// URL `?page=N` 을 composable 의 currentPage 에 동기화 (client nav 진입 시 바로 2페이지가 켜져 있어야 함)
if (!isTrash && initialPage > 1) {
  setPage(initialPage)
}

// 템플릿용 display computed — SSR 데이터 우선, 이후 composable 데이터
const displayFacilities = computed(() => {
  if (ssrConsumed.value || facilities.value.length > 0) return facilities.value
  return ssrFacilities.value
})
const displayTotal = computed(() => {
  if (ssrConsumed.value || total.value > 0) return total.value
  return ssrTotal.value
})
const displayTotalPages = computed(() => {
  if (ssrConsumed.value || totalPages.value > 0) return totalPages.value
  return ssrTotalPages.value
})

// h1/hero 전용 (Set C). <head> title/description은 setCategoryMeta(CATEGORY_SEO_*)가 담당한다.
const SEO_TITLES: Record<string, string> = {
  toilet: '지금 이용 가능한 공공화장실 · 24시간 개방 위치 지도',
  parking: '내 주변 공영주차장 요금·운영시간 · 무료 주차장 검색',
  'ev-charger': '전기차 충전소 실시간 현황 · 급속/완속 사용 가능 확인',
  park: '산책하기 좋은 내 주변 공원 · 운동시설·산책로 한눈에',
  school: '우리 동네 학군 정보 · 초·중·고 학교 위치 찾기',
  childcare: '내 주변 어린이집 · 정원·현원·빈자리 확인 국공립/민간',
  library: '내 주변 도서관 운영시간 · 주말·야간 개방 확인',
  hospital: '지금 문 연 병원 찾기 · 야간·주말 진료 실시간',
  pharmacy: '지금 문 연 약국 찾기 · 심야·공휴일 운영 약국',
  aed: '가장 가까운 AED 위치 · 심폐소생 골든타임 지키기',
  sports: '내 주변 공공체육시설 · 헬스·수영·풋살장 이용 안내',
  market: '내 주변 전통시장 · 장날·개장시간·상점 정보',
  clothes: '헌옷 버리는 곳 · 내 주변 의류수거함 위치 지도',
  trash: '우리 동네 쓰레기 배출일 달력 · 재활용·음식물 요일',
  wifi: '내 주변 공공 와이파이 무료 접속 위치 지도',
}

const SEO_DESCRIPTIONS: Record<string, string> = {
  toilet: '지금 이용 가능한 주변 공공화장실과 개방화장실 위치를 확인하세요. 24시간 운영 여부와 장애인화장실 정보를 제공합니다.',
  parking: '목적지 근처 공영주차장의 위치와 요금을 한눈에 비교하세요. 무료 주차 여부와 주차 가능 면수 정보를 제공합니다.',
  'ev-charger': '주변 전기차 충전소 위치와 급속/완속 충전기 대수를 확인하세요. 운영기관, 주차 요금, 이용 시간 정보를 제공합니다.',
  park: '산책하기 좋은 주변 공원을 찾아보세요. 운동시설, 놀이시설, 편의시설 정보와 면적을 한눈에 확인할 수 있습니다.',
  school: '주변 초등학교, 중학교, 고등학교 위치와 학교 정보를 검색하세요. 설립유형, 교육청 정보를 제공합니다.',
  childcare: '집 근처 어린이집의 정원, 현원, 빈자리 현황을 확인하세요. 국공립/민간/가정 유형별 검색이 가능합니다.',
  library: '가까운 공공도서관의 운영시간과 휴관일을 확인하세요. 좌석수, 장서 정보를 한눈에 볼 수 있습니다.',
  hospital: '현재 진료 중인 가까운 병원을 빠르게 찾으세요. 진료과목별 검색과 야간/주말 진료 여부를 확인할 수 있습니다.',
  pharmacy: '지금 문 연 주변 약국을 찾아보세요. 야간 운영, 주말/공휴일 영업 약국 위치와 연락처를 제공합니다.',
  aed: '골든타임을 지키는 가장 가까운 자동심장충격기(AED) 위치를 미리 확인하세요. 설치 장소와 이용 시간을 안내합니다.',
  sports: '운동하기 좋은 주변 공공체육시설을 검색하세요. 시설 종류, 규모, 관리기관 정보를 제공합니다.',
  market: '주변 전통시장의 위치와 개장 정보를 확인하세요. 취급품목, 주차장/화장실 유무, 상점 수 정보를 제공합니다.',
  clothes: '안 입는 옷을 버릴 수 있는 가장 가까운 의류수거함 위치를 지도에서 확인하세요.',
  trash: '지역별 쓰레기 배출 요일과 분리수거 방법을 확인하세요. 일반/음식물/재활용 배출 일정을 안내합니다.',
}

// Page title
const pageTitle = computed(() => {
  const catLabel = categoryMeta.value?.label || categoryParam.value
  if (cityName.value) {
    return `${cityName.value} ${catLabel}`
  }
  return SEO_TITLES[categoryParam.value] || `전국 ${catLabel} 찾기`
})

const pageDescription = computed(() => {
  const catLabel = categoryMeta.value?.label || categoryParam.value
  if (cityName.value) {
    return `${cityName.value}의 ${catLabel} 위치와 운영시간을 확인하세요.`
  }
  return SEO_DESCRIPTIONS[categoryParam.value] || `전국 ${catLabel} 위치와 운영시간을 검색하세요.`
})

const resultTitle = computed(() => cityName.value || '전체 지역')

// SEO meta (top-level for SSR)
const catLabel = CATEGORY_META[route.params.category as FacilityCategory]?.label || (route.params.category as string)
const initialPageQueryParam = parsePositivePageQuery(route.query.page)

if (initialPageQueryParam >= 2) {
  // 2페이지+ 는 noindex 정책 — setCategoryMeta에 canonical:false 위임
  setCategoryMeta(route.params.category as FacilityCategory, {
    cityName: cityName.value || undefined,
  }, { canonical: false })
} else {
  setCategoryMeta(route.params.category as FacilityCategory, {
    cityName: cityName.value || undefined,
  })
}

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: catLabel, url: `/${route.params.category}` },
])

// Dataset JSON-LD — 카테고리별 출처를 AI 검색에 노출
if (categoryDataSource.value) {
  setDatasetSchema({
    name: `전국 ${catLabel} 데이터`,
    description: `${categoryDataSource.value.provider}에서 제공하는 전국 ${catLabel} 공공데이터를 시·군·구 단위로 가공·정제해 위치, 운영 정보, 연락처 등을 통합 조회할 수 있도록 구성한 데이터셋입니다.`,
    url: `/${route.params.category}`,
    sources: [categoryDataSource.value],
    keywords: [catLabel, '공공데이터', categoryDataSource.value.provider, '대한민국'],
  })
}

// FAQ HTML + JSON-LD (정보성 사이트는 FAQPage 리치결과 대상)
const categoryFAQ = CATEGORY_FAQ[route.params.category as FacilityCategory]
const faqItems = computed(() => CATEGORY_FAQ[categoryParam.value as FacilityCategory] || [])

// FAQPage JSON-LD — SERP 점유 면적 확대
if (categoryFAQ && categoryFAQ.length > 0) {
  setFAQSchema(categoryFAQ.map((faq: { question: string; answer: string }) => ({
    question: faq.question,
    answer: faq.answer,
  })))
}

// Popular regions
const popularRegionLinks = computed(() => POPULAR_REGIONS || [])

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  {
    label: catLabel,
    href: `/${categoryParam.value}`,
    current: true,
  },
])

const { syncStatus } = useSyncStatus()
const { stats: nationalStats } = useNationalStats()

// 현재 필터가 지역으로 좁혀졌는지 여부. cityName 은 route.query.city(RegionChips 클릭)에서
// 파생되는 유일한 지역 필터 소스다. Task 2(SSR city 필터)부터 useAsyncData 자체가 이미 city 로
// 필터한 데이터를 반환하므로(딥링크 `/{category}?city=slug` 진입 시에도 displayTotal/wasteTotal 이
// 처음부터 지역 스코프 값) 과거처럼 ssrConsumed 로 게이팅할 필요가 없다 — 오히려 게이팅하면
// 초기 SSR 렌더에서 이미 올바른 지역 수치에 "전국" 라벨이 붙는 회귀가 생긴다.
const isRegionScoped = computed(() => !!cityName.value)

// PageHero sidebar stats
const heroStats = computed(() => {
  const trash = categoryParam.value === 'trash'
  const totalCount = trash ? wasteTotal.value : displayTotal.value
  const nat = nationalStats.value?.[categoryParam.value]
  return buildCategoryListStats({
    isRegionScoped: isRegionScoped.value,
    displayTotal: totalCount,
    nationalCount: typeof nat === 'number' ? nat : null,
    unit: trash ? '건' : '곳',
    syncCellValue: withSyncDate(
      trash ? '매일 자동' : '월 1회 자동',
      syncStatus.value?.[categoryParam.value],
      trash ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS,
    ),
    basisValue: trash ? '시·군·구 / 동' : '지역 선택 후 정렬',
  })
})

// Canonical URL: city+district → region route, city only → city route, otherwise self
const canonicalPath = computed(() => {
  const citySlug = queryCitySlug.value
  const districtSlug = (route.query.district as string) || ''
  if (citySlug && districtSlug) {
    return `/${citySlug}/${districtSlug}/${categoryParam.value}`
  }
  if (citySlug) {
    // 2-segment /[city]/[category] 라우트는 실재하지 않으므로(과거엔 404·noindex 페이지를 가리켜 색인 손실)
    // 도시-only 필터 페이지는 자기 자신을 canonical 로 지정한다.
    return `/${categoryParam.value}?city=${citySlug}`
  }
  return `/${categoryParam.value}`
})
// Pagination: page 2+ 는 noindex 하고 canonical 은 함께 제거 (noindex/canonical 정책 통일)
// pageQueryParam 은 route.query.page 에 reactive 로 연동해야 client-side 페이지 이동 시에도 정책이 켜진다.
const pageQueryParam = computed(() => parsePositivePageQuery(route.query.page))
const isNoindex = computed(() => pageQueryParam.value >= 2)

useHead(computed(() => {
  if (isNoindex.value) {
    return { meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] }
  }
  return {
    link: [{ rel: 'canonical', href: `https://ilsangkit.co.kr${canonicalPath.value}`, key: 'canonical' }],
  }
}))

// Methods
async function performSearch() {
  if (categoryParam.value === 'trash') return
  ssrConsumed.value = true

  const params: Record<string, unknown> = {
    page: currentPage.value,
    limit: 20,
    category: categoryParam.value,
  }
  if (cityName.value) params.city = cityName.value
  if (categoryParam.value === 'hospital' && selectedDepartments.value.length > 0) {
    params.departments = selectedDepartments.value
  }

  search(params)
}

function handleDepartmentApply(): void {
  currentPage.value = 1
  resetToFirstPageUrl()
  performSearch()
}

async function loadWasteSchedules() {
  // trash 카테고리는 performSearch()를 타지 않아 ssrConsumed 가 영영 false 로 남는 문제 수정.
  // 인터랙티브 지역 재조회(여기) 진입 시점에 동기 설정 — SSR 직후 딥링크 onMounted 는
  // `!ssrData.value?.data` 가드로 이 함수 호출 자체가 스킵되므로 영향받지 않는다(전국 등록 유지).
  ssrConsumed.value = true

  const result = await getSchedules({
    city: cityName.value || undefined,
    district: undefined,
    keyword: undefined,
    page: wasteCurrentPage.value,
    limit: 20,
  })
  wasteSchedules.value = result.schedules
  wasteContact.value = result.contact || null
  wasteTotal.value = result.total
  wasteTotalPages.value = result.totalPages
}

// URL `?page=N` 을 갱신해 reactive noindex/canonical 이 정확히 켜지도록 한다.
// page=1 이면 query 에서 page 키 자체를 제거해 canonical URL 과 동일하게 유지한다.
function syncPageQuery(page: number): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query }
  if (page > 1) nextQuery.page = String(page)
  else delete nextQuery.page
  return nextQuery
}

// 필터(도시·구·키워드)가 바뀌면 결과는 항상 page 1 로 되돌아간다.
// 내부 상태만 리셋하면 URL 의 `?page=N` 이 남아 head 의 pageQueryParam 이 여전히 noindex 를
// 켠 채 있게 되므로, 여기서도 navigateTo 로 URL 을 page 1 상태(query 에서 page 키 삭제)로 맞춘다.
async function resetToFirstPageUrl() {
  if (route.query.page === undefined) return
  await navigateTo({ query: syncPageQuery(1) })
}

// "필터 초기화" — ?city= 를 제거해 전국 목록으로 돌아간다. 실제 재조회는
// watch(() => route.query.city, ...) 가 담당한다.
async function resetCityFilter() {
  const nextQuery: LocationQueryRaw = { ...route.query }
  delete nextQuery.city
  delete nextQuery.page
  await navigateTo({ query: nextQuery })
}

async function goToWastePage(page: number) {
  wasteCurrentPage.value = page
  const nextQuery = syncPageQuery(page)
  delete nextQuery.schedule
  await navigateTo({ query: nextQuery })
  loadWasteSchedules()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function goToPage(page: number) {
  setPage(page)
  await navigateTo({ query: syncPageQuery(page) })
  performSearch()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Initialize
onMounted(async () => {
  // Initial data load — SSR 데이터가 있으면 스킵
  if (!ssrData.value?.data) {
    if (categoryParam.value === 'trash') {
      await loadWasteSchedules()
    } else {
      await performSearch()
    }
  }
  initialLoading.value = false
  trackCategoryPageView({ category: categoryParam.value })
})

// 칩 클릭(=?city= 변경) 시 page1 로 리셋하고 재조회. immediate 없음 — 첫 페인트/하이드레이션은
// useAsyncData(SSR) 가 이미 city 로 필터해 렌더하므로 재조회하지 않는다.
watch(() => route.query.city, () => {
  if (categoryParam.value === 'trash') {
    wasteCurrentPage.value = 1
    loadWasteSchedules()
  } else {
    resetPage()
    performSearch()
  }
})

// URL → 상태 동기화: 브라우저 뒤로가기/앞으로가기 혹은 같은 라우트로의 query-only 네비게이션에서도
// pageQueryParam computed 와 실제 데이터(currentPage / wasteCurrentPage) 가 어긋나지 않도록 한다.
// goToPage/goToWastePage 등 페이지 액션은 이미 상태를 먼저 갱신하므로, 값이 같은 경우 조용히 스킵한다.
watch(() => route.query.page, (next) => {
  const nextPage = parsePositivePageQuery(next)
  if (categoryParam.value === 'trash') {
    if (wasteCurrentPage.value === nextPage) return
    wasteCurrentPage.value = nextPage
    loadWasteSchedules()
  } else {
    if (currentPage.value === nextPage) return
    setPage(nextPage)
    performSearch()
  }
})

watch(selectedWasteScheduleId, (id) => {
  if (id === null) {
    modalOpenedFromList = false
    detailRequestId += 1
    selectedWasteSchedule.value = null
    wasteDetailLoading.value = false
    wasteDetailError.value = false
    return
  }
  loadWasteScheduleDetail(id)
}, { immediate: true })

// Update meta when city filter changes
watch(cityName, () => {
  setCategoryMeta(categoryParam.value, {
    cityName: cityName.value || undefined,
  })
})

// ItemList structured data + 페이지네이션 rel link 태그
watch([facilities, currentPage, totalPages], () => {
  if (facilities.value.length > 0 && categoryParam.value !== 'trash') {
    setItemListSchema(
      facilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  // 페이지네이션 rel link 태그
  const paginationLinks: Array<{ rel: string; href: string }> = []
  const siteUrl = useRuntimeConfig().public.siteUrl || 'https://ilsangkit.co.kr'
  const baseUrl = `${siteUrl}/${categoryParam.value}`

  if (currentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${currentPage.value - 1}` })
  }
  if (currentPage.value < totalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${currentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})
</script>
