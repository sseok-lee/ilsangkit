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

      <!-- 지역과 키워드 필터 -->
      <SectionBlock
        heading="지역과 키워드"
        :subtext="categoryParam === 'trash' ? '시·군·구와 동을 선택해 배출 정보를 확인하세요.' : '지역을 먼저 선택하면 정확한 목록을 빠르게 찾을 수 있어요.'"
      >
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <!-- 시/도 선택 -->
          <div class="relative">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">시/도</label>
            <select
              v-model="selectedCity"
              aria-label="시/도 선택"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              @change="handleCityChange"
            >
              <option value="">시/도 선택</option>
              <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-2.5 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
          </div>
          <!-- 구/군 선택 -->
          <div class="relative">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">구/군</label>
            <select
              v-model="selectedDistrict"
              :disabled="!selectedCity"
              aria-label="구/군 선택"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              @change="handleDistrictChange"
            >
              <option value="">구/군 선택</option>
              <option v-for="dist in districtList" :key="dist" :value="dist">{{ dist }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-2.5 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
          </div>
          <!-- 키워드 검색 -->
          <div class="relative">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">키워드</label>
            <div class="absolute left-3 bottom-2.5 pointer-events-none">
              <span class="material-symbols-outlined text-slate-500 text-[18px]">search</span>
            </div>
            <input
              v-model="filterKeyword"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 pl-9 pr-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              type="text"
              :placeholder="categoryParam === 'trash' ? '동/지역 이름 검색' : '시설명/주소 검색'"
              @input="handleFilterSearch"
            />
          </div>
        </div>
      </SectionBlock>

      <!-- Ad: 필터 직후 -->
      <AdBanner ad-format="horizontal" full-width-responsive="false" />

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
          <div v-if="wasteContact && !wasteLoading && !initialLoading" class="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
            <div class="flex items-center gap-2 mb-1">
              <span class="material-symbols-outlined text-blue-500 text-[18px]">support_agent</span>
              <span class="font-semibold text-blue-900 text-sm">{{ wasteContact.name }}</span>
            </div>
            <a
              v-if="wasteContact.phone"
              :href="`tel:${wasteContact.phone}`"
              class="text-blue-600 text-sm hover:underline flex items-center gap-1"
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
            />
          </div>

          <!-- 페이지네이션 -->
          <Pagination v-if="!wasteLoading && !initialLoading" :current-page="wasteCurrentPage" :total-pages="wasteTotalPages" @page-change="goToWastePage" />

          <!-- 결과 없음 -->
          <div v-if="wasteSchedules.length === 0 && !wasteLoading && !initialLoading" class="py-12 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-[32px] text-slate-500">delete</span>
            </div>
            <p class="text-slate-700 font-semibold text-lg">등록된 배출 일정이 없습니다</p>
            <p class="text-slate-500 text-sm mt-1 mb-6">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="selectedCity || selectedDistrict"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="selectedCity = ''; selectedDistrict = ''; filterKeyword = ''; loadWasteSchedules()"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                필터 초기화
              </button>
              <NuxtLink
                to="/"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </div>
        </SectionBlock>
      </template>

      <!-- Non-trash: facility card grid -->
      <template v-else>
        <SectionBlock :heading="`${resultTitle} ${catLabel} 목록`" subtext="지역 선택 후 목록·페이지를 확인하세요.">
          <template #right>
            <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{{ displayTotal.toLocaleString('ko-KR') }}건</span>
          </template>

          <!-- Loading Skeleton -->
          <div v-if="loading || initialLoading" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
                <div class="flex items-start gap-4">
                  <div class="shrink-0 w-12 h-12 rounded-full bg-slate-200"></div>
                  <div class="flex-1 space-y-2.5">
                    <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                    <div class="h-3 bg-slate-100 rounded w-full"></div>
                    <div class="flex gap-2 mt-1">
                      <div class="h-5 bg-slate-100 rounded-md w-14"></div>
                      <div class="h-5 bg-slate-100 rounded-md w-20"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
            <div v-if="displayFacilities.length === 0" class="py-12 text-center">
              <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <span class="material-symbols-outlined text-[32px] text-slate-500">{{ categoryMeta?.icon || 'search_off' }}</span>
              </div>
              <p class="text-slate-700 font-semibold text-lg">검색 결과가 없습니다</p>
              <p class="text-slate-500 text-sm mt-1 mb-6">다른 지역이나 검색어를 시도해보세요</p>
              <div class="flex items-center justify-center gap-3">
                <button
                  v-if="selectedCity || selectedDistrict || filterKeyword"
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                  @click="selectedCity = ''; selectedDistrict = ''; filterKeyword = ''; performSearch()"
                >
                  <span class="material-symbols-outlined text-[16px]">refresh</span>
                  필터 초기화
                </button>
                <NuxtLink
                  to="/"
                  class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
                >
                  <span class="material-symbols-outlined text-[16px]">home</span>
                  홈으로 돌아가기
                </NuxtLink>
              </div>
            </div>

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

      <!-- 관련 가이드 -->
      <ClientOnly>
        <RelatedGuides :category="categoryParam" />
      </ClientOnly>

      <!-- 쿠팡 배너 -->
      <CoupangBanner />

      <!-- 데이터 출처 -->
      <section v-if="categoryDataSource">
        <DataSourceCard :source="categoryDataSource" />
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useWasteSchedule, transformToRegionSchedules } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { RELATED_CATEGORIES, POPULAR_REGIONS, CATEGORY_SEO_INTENT } from '~/utils/seoConstants'
import { FACILITY_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import { CITY_SLUG_MAP, useRegions } from '~/composables/useRegions'
import type { RegionSchedule } from '~/composables/useWasteSchedule'
import type { FacilityCategory } from '~/types/facility'
import { useAnalytics } from '~/composables/useAnalytics'

const route = useRoute()

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

// Search composables
const { loading, facilities, total, currentPage, totalPages, error: facilityError, search, resetPage, setPage } = useFacilitySearch()
const { trackCategoryPageView, trackSearchNoResults } = useAnalytics()
const { getCities, getDistricts, getSchedules, isLoading: wasteLoading } = useWasteSchedule()
const { loadRegions, citiesWithDistricts } = useRegions()
const { setMeta } = useFacilityMeta()
const { setItemListSchema, setBreadcrumbSchema, setFAQSchema, setDatasetSchema } = useStructuredData()

// Region state
const selectedCity = ref('')
const selectedDistrict = ref('')
const cities = ref<string[]>([])
const districtList = ref<string[]>([])

// SSR: 초기 데이터를 서버에서 로드.
// route.query.page 를 SSR 시점에서 읽어 동일 페이지 데이터를 반환해야
// `/toilet?page=2` 직접 진입 시 SSR HTML이 page 1 콘텐츠로 엇나가지 않는다.
const isTrash = categoryParam.value === 'trash'
const initialPage = Math.max(1, Number(route.query.page) || 1)
const { data: ssrData } = await useAsyncData(
  `cat-list-${categoryParam.value}-p${initialPage}`,
  () => isTrash
    ? $fetch<any>('/api/waste-schedules', { params: { page: initialPage, limit: 20 } })
    : $fetch<any>('/api/facilities/search', { method: 'POST', body: { category: categoryParam.value, page: initialPage, limit: 20 } }),
)

// SSR 데이터가 있으면 초기 로딩 완료
const initialLoading = ref(!ssrData.value?.data)

// Filter state
const filterKeyword = ref('')
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

// 카테고리별 SEO 타이틀/설명
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

function buildCategorySeoTitle(category: FacilityCategory, cityName?: string, districtName?: string): string {
  const categoryName = CATEGORY_META[category]?.label || category
  const intent = CATEGORY_SEO_INTENT[category] || '정보'
  const location = [cityName, districtName].filter(Boolean).join(' ')
  return location
    ? `${location} ${categoryName} | ${intent}`
    : `${categoryName} | ${intent}`
}

function buildCategorySeoDescription(category: FacilityCategory, cityName?: string, districtName?: string): string {
  const categoryName = CATEGORY_META[category]?.label || category
  const intent = CATEGORY_SEO_INTENT[category] || '정보'
  const location = [cityName, districtName].filter(Boolean).join(' ')
  return location
    ? `${location}의 ${categoryName} ${intent} 정보를 확인하세요.`
    : `전국 ${categoryName}의 ${intent} 정보를 한눈에 확인하세요.`
}

// Page title
const pageTitle = computed(() => {
  const catLabel = categoryMeta.value?.label || categoryParam.value
  if (selectedCity.value && selectedDistrict.value) {
    return `${selectedCity.value} ${selectedDistrict.value} ${catLabel}`
  }
  if (selectedCity.value) {
    return `${selectedCity.value} ${catLabel}`
  }
  return SEO_TITLES[categoryParam.value] || `전국 ${catLabel} 찾기`
})

const pageDescription = computed(() => {
  const catLabel = categoryMeta.value?.label || categoryParam.value
  if (selectedCity.value) {
    return `${selectedCity.value}${selectedDistrict.value ? ' ' + selectedDistrict.value : ''}의 ${catLabel} 위치와 운영시간을 확인하세요.`
  }
  return SEO_DESCRIPTIONS[categoryParam.value] || `전국 ${catLabel} 위치와 운영시간을 검색하세요.`
})

const resultTitle = computed(() => {
  if (selectedCity.value && selectedDistrict.value) {
    return `${selectedCity.value} ${selectedDistrict.value}`
  }
  if (selectedCity.value) {
    return selectedCity.value
  }
  return '전체 지역'
})

// SEO meta (top-level for SSR)
const initialCityName = CITY_SLUG_MAP[route.query.city as string] || ''
const initialDistrictName = (route.query.district as string) || ''
const catLabel = CATEGORY_META[route.params.category as FacilityCategory]?.label || (route.params.category as string)
const initialPageQueryParam = Math.max(1, Number(route.query.page) || 1)

setMeta({
  title: buildCategorySeoTitle(route.params.category as FacilityCategory, initialCityName, initialDistrictName),
  description: buildCategorySeoDescription(route.params.category as FacilityCategory, initialCityName, initialDistrictName),
  path: `/${route.params.category}`,
  ...(initialPageQueryParam >= 2 ? { canonical: false as const } : {}),
})

// Breadcrumb JSON-LD
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: catLabel, url: `/${route.params.category}` },
])

// Dataset JSON-LD — 카테고리별 출처를 AI 검색에 노출
if (categoryDataSource.value) {
  setDatasetSchema({
    name: `전국 ${catLabel} 데이터`,
    description: `${categoryDataSource.value.provider}에서 제공하는 전국 ${catLabel} 공공데이터를 가공해 제공합니다.`,
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

// PageHero sidebar stats
const heroStats = computed(() => {
  const totalCount = categoryParam.value === 'trash' ? wasteTotal.value : displayTotal.value
  const stats: { label: string; value: string }[] = []
  if (totalCount > 0) {
    stats.push({ label: '전체', value: `${totalCount.toLocaleString('ko-KR')}${categoryParam.value === 'trash' ? '건' : '곳'}` })
  }
  stats.push({
    label: '데이터 갱신',
    value: categoryParam.value === 'trash' ? '매일 자동' : '월 1회 자동',
  })
  stats.push({
    label: '목록 기준',
    value: categoryParam.value === 'trash' ? '시·군·구 / 동' : '지역 선택 후 정렬',
  })
  return stats
})

// Canonical URL: city+district → region route, city only → city route, otherwise self
const canonicalPath = computed(() => {
  const citySlug = queryCitySlug.value
  const districtSlug = (route.query.district as string) || ''
  if (citySlug && districtSlug) {
    return `/${citySlug}/${districtSlug}/${categoryParam.value}`
  }
  if (citySlug) {
    return `/${citySlug}/${categoryParam.value}`
  }
  return `/${categoryParam.value}`
})
// Pagination: page 2+ 는 noindex 하고 canonical 은 함께 제거 (noindex/canonical 정책 통일)
// pageQueryParam 은 route.query.page 에 reactive 로 연동해야 client-side 페이지 이동 시에도 정책이 켜진다.
const pageQueryParam = computed(() => Math.max(1, Number(route.query.page) || 1))
const isNoindex = computed(() => pageQueryParam.value >= 2)

useHead(computed(() => {
  if (isNoindex.value) {
    return { meta: [{ name: 'robots', content: 'noindex, follow' }] }
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
  if (selectedCity.value) params.city = selectedCity.value
  if (selectedDistrict.value) params.district = selectedDistrict.value
  if (filterKeyword.value) params.keyword = filterKeyword.value

  search(params)
}

async function loadWasteSchedules() {
  const result = await getSchedules({
    city: selectedCity.value || undefined,
    district: selectedDistrict.value || undefined,
    keyword: filterKeyword.value || undefined,
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
function syncPageQuery(page: number) {
  const nextQuery: Record<string, unknown> = { ...route.query }
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

async function handleCityChange() {
  selectedDistrict.value = ''
  filterKeyword.value = ''

  if (selectedCity.value) {
    if (categoryParam.value === 'trash') {
      districtList.value = await getDistricts(selectedCity.value)
    } else {
      const cityData = citiesWithDistricts.value.find(c => c.name === selectedCity.value)
      districtList.value = cityData?.districts.map(d => d.name) || []
    }
  } else {
    districtList.value = []
  }

  if (categoryParam.value === 'trash') {
    wasteCurrentPage.value = 1
    await resetToFirstPageUrl()
    await loadWasteSchedules()
  } else {
    resetPage()
    await resetToFirstPageUrl()
    performSearch()
  }
}

async function handleDistrictChange() {
  filterKeyword.value = ''

  if (categoryParam.value === 'trash') {
    wasteCurrentPage.value = 1
    await resetToFirstPageUrl()
    await loadWasteSchedules()
  } else {
    resetPage()
    await resetToFirstPageUrl()
    performSearch()
  }
}

let filterSearchTimer: ReturnType<typeof setTimeout> | null = null

onUnmounted(() => {
  if (filterSearchTimer) clearTimeout(filterSearchTimer)
})

function handleFilterSearch() {
  if (filterSearchTimer) clearTimeout(filterSearchTimer)
  filterSearchTimer = setTimeout(async () => {
    if (categoryParam.value === 'trash') {
      wasteCurrentPage.value = 1
      await resetToFirstPageUrl()
      await loadWasteSchedules()
    } else {
      resetPage()
      await resetToFirstPageUrl()
      performSearch()
    }
  }, 300)
}

async function goToWastePage(page: number) {
  wasteCurrentPage.value = page
  await navigateTo({ query: syncPageQuery(page) })
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
  // Load cities for dropdown
  if (categoryParam.value === 'trash') {
    cities.value = await getCities()
  } else {
    await loadRegions()
    cities.value = citiesWithDistricts.value.map(c => c.name)
  }

  // Restore city from query param (slug → Korean)
  if (queryCitySlug.value) {
    const cityName = CITY_SLUG_MAP[queryCitySlug.value]
    if (cityName && cities.value.includes(cityName)) {
      selectedCity.value = cityName
      if (categoryParam.value === 'trash') {
        districtList.value = await getDistricts(cityName)
      } else {
        const cityData = citiesWithDistricts.value.find(c => c.name === cityName)
        districtList.value = cityData?.districts.map(d => d.name) || []
      }
    }
  }

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

// URL → 상태 동기화: 브라우저 뒤로가기/앞으로가기 혹은 같은 라우트로의 query-only 네비게이션에서도
// pageQueryParam computed 와 실제 데이터(currentPage / wasteCurrentPage) 가 어긋나지 않도록 한다.
// goToPage/goToWastePage 등 페이지 액션은 이미 상태를 먼저 갱신하므로, 값이 같은 경우 조용히 스킵한다.
watch(() => route.query.page, (next) => {
  const nextPage = Math.max(1, Number(next) || 1)
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

watch(loading, (isLoading) => {
  if (!isLoading && ssrConsumed.value && filterKeyword.value && displayTotal.value === 0) {
    trackSearchNoResults({ keyword: filterKeyword.value, category: categoryParam.value })
  }
})

// Update meta when filters change
watch([selectedCity, selectedDistrict], () => {
  const cat = categoryParam.value
  const title = buildCategorySeoTitle(cat, selectedCity.value || undefined, selectedDistrict.value || undefined)
  const description = buildCategorySeoDescription(cat, selectedCity.value || undefined, selectedDistrict.value || undefined)

  setMeta({ title, description, path: `/${cat}` })
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
