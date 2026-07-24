<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Hero -->
      <PageHero
        eyebrow="통합 검색"
        :title="heroTitle"
        :description="heroDescription"
        :stats="heroStats"
      >
        <template #search>
          <div class="flex items-center gap-2 bg-white rounded-lg p-1.5 border-2 border-slate-300 focus-within:border-primary">
            <div class="flex items-center pl-2 pr-1 pointer-events-none">
              <span class="material-symbols-outlined text-slate-500 text-[20px]">search</span>
            </div>
            <input
              v-model="searchKeyword"
              aria-label="통합 검색"
              class="flex-1 min-w-0 bg-transparent text-slate-900 text-sm font-medium focus:outline-none"
              type="text"
              placeholder="장소·단지명·시설명 검색"
              @keyup.enter="handleSearch"
            />
            <button
              v-if="searchKeyword"
              aria-label="검색어 지우기"
              class="p-1 text-slate-500 hover:text-slate-700"
              @click="clearSearch"
            >
              <span class="material-symbols-outlined text-[18px]">cancel</span>
            </button>
            <button
              class="inline-flex items-center justify-center min-w-[72px] min-h-[40px] px-3 bg-primary text-white rounded-lg text-sm font-bold"
              @click="handleSearch"
            >
              다시 검색
            </button>
          </div>
        </template>
      </PageHero>

      <!-- 지역 필터 -->
      <SectionBlock heading="지역" subtext="시·도·구·군으로 결과를 좁힐 수 있습니다.">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">시/도</label>
            <div class="relative">
              <select
                v-model="selectedCity"
                aria-label="시/도 선택"
                class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
                @change="handleCityChange"
              >
                <option value="">시/도 선택</option>
                <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1">구/군</label>
            <div class="relative">
              <select
                v-model="selectedDistrict"
                :disabled="!selectedCity"
                aria-label="구/군 선택"
                class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                @change="handleDistrictChange"
              >
                <option value="">구/군 선택</option>
                <option v-for="dist in districts" :key="dist" :value="dist">{{ dist }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
        </div>
      </SectionBlock>

      <!-- 데이터 의존 영역: isMounted 가드로 hydration mismatch 방지 -->
      <template v-if="isMounted">
      <!-- Loading Skeleton -->
      <div v-if="loading" aria-live="polite" aria-busy="true">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
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

      <div v-else aria-live="polite">
        <!-- 부동산 페이징 뷰 (유형 선택 시) -->
        <template v-if="selectedRealEstateType">
          <button
            type="button"
            class="inline-flex items-center gap-1 text-sm font-semibold text-primary mb-4 hover:underline"
            @click="clearRealEstateTypeFilter"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
            통합 검색 결과로
          </button>
          <div v-if="reLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
              <div class="space-y-2.5">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-100 rounded w-full"></div>
                <div class="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            </div>
          </div>
          <div v-else-if="reComplexItems.length > 0">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <NuxtLink
                v-for="item in reComplexItems"
                :key="`${item.buildingName}-${item.bjdCode}`"
                :to="complexCardUrl(item)"
                class="bg-white rounded-xl p-4 border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div class="flex items-start gap-3">
                  <img :src="`/icons/category/${selectedRealEstateType}.webp?v2`" :alt="RE_PROPERTY_META[selectedRealEstateType]?.label" class="w-10 h-10 shrink-0" width="40" height="40" />
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-slate-800 text-sm truncate">{{ item.buildingName }}</p>
                    <p class="text-xs text-slate-500 mt-0.5 truncate">{{ item.city }} {{ item.district }} {{ item.dongName }}</p>
                    <div class="flex items-center gap-2 mt-2">
                      <span v-if="item.latestPrice" class="text-xs font-semibold text-primary">{{ formatKoreanPrice(item.latestPrice) }}</span>
                      <span class="text-[10px] text-slate-500">거래 {{ item.transactionCount }}건</span>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>
            <Pagination :current-page="reCurrentPage" :total-pages="reTotalPages" @page-change="goToRealEstatePage" />
          </div>
          <div v-else class="py-16 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-[32px] text-slate-500">search_off</span>
            </div>
            <p class="text-slate-700 font-semibold text-lg">{{ UI_MESSAGES.emptySearch }}</p>
          </div>

          <!-- Ad: 부동산 페이징 뷰 결과 후 -->
          <AdBanner v-if="reComplexItems.length > 0" class="my-4" />
        </template>

        <!-- 통합 도메인 뷰 (유형 미선택 시): 부동산 먼저 → 생활시설 -->
        <template v-if="!selectedRealEstateType">
          <SearchDomainSection
            v-if="realEstateGroups.length"
            title="부동산"
            :count="realEstateTotalCount"
            count-label="실거래가"
          >
            <SearchResultGroup
              v-for="g in realEstateGroups"
              :key="g.propertyType"
              :label="g.label"
              :count="g.totalCount"
              count-unit="곳"
              :icon-img="g.iconImg"
              @more="selectRealEstateType(g.propertyType)"
            >
              <ComplexCard
                v-for="(it, i) in g.items.slice(0, 3)"
                :key="`${it.buildingName}-${i}`"
                :complex="reItemToComplex(it)"
                :property-type="g.propertyType"
                tab="sale"
              />
            </SearchResultGroup>
          </SearchDomainSection>

          <SearchDomainSection
            v-if="facilityGroups.length"
            title="생활시설"
            :count="facilityTotalCount"
            :count-label="`${facilityGroups.length}개 카테고리`"
          >
            <SearchResultGroup
              v-for="g in facilityGroups"
              :key="g.category"
              :label="g.label"
              :count="g.count"
              count-unit="곳"
              :cat-category="g.category"
              :more-href="facilityMoreHref(g.category)"
            >
              <FacilityCard v-for="item in g.items.slice(0, 3)" :key="item.id" :facility="item" />
            </SearchResultGroup>
          </SearchDomainSection>

          <!-- Ad: 통합 검색결과 후 -->
          <AdBanner v-if="realEstateGroups.length || facilityGroups.length" class="my-4" />

          <!-- Empty State -->
          <EmptyState
            v-if="realEstateGroups.length === 0 && facilityGroups.length === 0"
            :title="searchKeyword ? '검색 결과가 없어요' : UI_MESSAGES.emptySearch"
            description="장소·단지명·시설명으로 검색해보세요"
          >
            <NuxtLink
              to="/real-estate"
              class="btn-primary inline-flex items-center gap-1.5 text-sm"
            >
              <span class="material-symbols-outlined text-[16px]">apartment</span>
              부동산 실거래가 보기
            </NuxtLink>
          </EmptyState>
        </template>
      </div>
      </template>

      <!-- SSR 스켈레톤: isMounted 전까지 표시 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { toRealEstateUrl, type RealEstateUrlType } from '~/utils/realEstateUrl'
import { formatKoreanPrice } from '~/utils/formatters'
import { useRealEstate } from '~/composables/useRealEstate'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useAnalytics } from '~/composables/useAnalytics'
import { useSearchSuggest } from '~/composables/useSearchSuggest'
import { isFacilityCategory, type GroupedCategory } from '~/types/facility'
import type { RealEstateType, ComplexInfo, RealEstatePropertyType, TransactionMode } from '~/types/realEstate'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import SearchDomainSection from '~/components/search/SearchDomainSection.vue'
import SearchResultGroup from '~/components/search/SearchResultGroup.vue'
import ComplexCard from '~/components/realEstate/ComplexCard.vue'
import FacilityCard from '~/components/facility/FacilityCard.vue'

const route = useRoute()
const { searchAll: searchRealEstate, getComplexList } = useRealEstate()
const { searchGrouped: searchFacilitiesGrouped, groupedResults, groupedTotalCount } = useFacilitySearch()
const { setSearchMeta } = useFacilityMeta()
const { trackSearchResultsView, trackSearchNoResults } = useAnalytics()
const { logSearch } = useSearchSuggest()

// 통합 검색 상태: 부동산 + 시설(grouped) 병렬 fetch
const loading = ref(false)

// Region dropdowns (reuse waste schedule API for city/district lists)
const { getCities, getDistricts } = useWasteSchedule()

const selectedCity = ref('')
const selectedDistrict = ref('')
const cities = ref<string[]>([])
const districts = ref<string[]>([])

// Hydration guard: SSR과 클라이언트가 동일한 초기 HTML을 렌더링하도록 보장
const isMounted = ref(false)

// UI State
const searchKeyword = ref('')
interface RealEstateResultCategory {
  type: RealEstateType
  count: number
  items: Array<{ buildingName: string; bjdCode: string; [key: string]: unknown }>
}
const realEstateResults = ref<RealEstateResultCategory[]>([])

const RE_TYPE_LABELS: Record<string, string> = {
  'apt-sale': '아파트 매매', 'apt-rent': '아파트 전월세',
  'villa-sale': '빌라 매매', 'villa-rent': '빌라 전월세',
  'offitel-sale': '오피스텔 매매', 'offitel-rent': '오피스텔 전월세',
}

// 부동산 결과를 건물유형별(apt/villa/offitel)로 재그룹
type RealEstatePreviewItem = {
  type: string
  buildingName: string
  bjdCode: string
  propertyType: string
  tab: string
  typeLabel: string
  dealAmount: number | null
  deposit: number | null
  city: string
  district: string
  dongName: string
  dealYear: number | null
  dealMonth: number | null
  buildYear: number | null
  transactionCount: number
}
const RE_PROPERTY_META: Record<string, { label: string; iconImg: string }> = {
  apt: { label: '아파트', iconImg: 'apt' },
  villa: { label: '빌라', iconImg: 'villa' },
  offitel: { label: '오피스텔', iconImg: 'offitel' },
}

const realEstateGrouped = computed(() => {
  const map = new Map<string, { propertyType: string; label: string; iconImg: string; items: RealEstatePreviewItem[]; totalCount: number }>()
  for (const cat of realEstateResults.value) {
    const propertyType = cat.type.replace(/-(?:sale|rent)$/, '')
    const tab = cat.type.endsWith('-rent') ? 'rent' : 'sale'
    const priceKey = tab === 'sale' ? 'dealAmount' : 'deposit'
    if (!map.has(propertyType)) {
      const meta = RE_PROPERTY_META[propertyType] || { label: propertyType, iconImg: 'apt' }
      map.set(propertyType, { propertyType, label: meta.label, iconImg: meta.iconImg, items: [], totalCount: 0 })
    }
    const group = map.get(propertyType)!
    group.totalCount += cat.count
    for (const item of cat.items) {
      group.items.push({
        type: cat.type,
        buildingName: item.buildingName,
        bjdCode: item.bjdCode,
        propertyType,
        tab,
        typeLabel: RE_TYPE_LABELS[cat.type] || cat.type,
        dealAmount: (item[priceKey] as number) ?? null,
        deposit: (item.deposit as number) ?? null,
        city: (item.city as string) || '',
        district: (item.district as string) || '',
        dongName: (item.dongName as string) || '',
        dealYear: (item.dealYear as number) ?? null,
        dealMonth: (item.dealMonth as number) ?? null,
        buildYear: (item.buildYear as number) ?? null,
        transactionCount: (item.transactionCount as number) || 0,
      })
    }
  }
  return [...map.values()]
})

// 부동산 유형 필터
const selectedRealEstateType = ref('')
const reComplexItems = ref<ComplexInfo[]>([])
const reCurrentPage = ref(1)
const reTotalPages = ref(0)
const reTotal = ref(0)
const reLoading = ref(false)

const rePaginationRange = computed(() => {
  const total = reTotalPages.value
  const current = reCurrentPage.value
  const delta = 2
  const range: number[] = []
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i)
  }
  return range
})

const filteredRealEstateGrouped = computed(() => {
  if (!selectedRealEstateType.value) return realEstateGrouped.value
  return realEstateGrouped.value.filter(g => g.propertyType === selectedRealEstateType.value)
})

async function searchRealEstatePaged(propertyType: string, page: number = 1) {
  reLoading.value = true
  try {
    const type = `${propertyType}-sale` as RealEstateType
    const result = await getComplexList(
      type,
      selectedCity.value || undefined,
      selectedDistrict.value || undefined,
      searchKeyword.value || undefined,
      page,
      20
    )
    reComplexItems.value = result.items
    reCurrentPage.value = result.page
    reTotalPages.value = result.totalPages
    reTotal.value = result.total
  } catch {
    reComplexItems.value = []
    reTotalPages.value = 0
    reTotal.value = 0
  } finally {
    reLoading.value = false
  }
}

const realEstateTotalCount = computed(() => realEstateResults.value.reduce((s, r) => s + r.count, 0))

// 부동산 도메인 섹션: 유형 표시 순서 고정 (아파트 → 빌라 → 오피스텔)
const RE_ORDER: Record<string, number> = { apt: 0, villa: 1, offitel: 2 }
const realEstateGroups = computed(() =>
  [...realEstateGrouped.value].sort((a, b) => (RE_ORDER[a.propertyType] ?? 9) - (RE_ORDER[b.propertyType] ?? 9))
)

// 생활시설 도메인 섹션: 건수 많은 카테고리부터
const facilityGroups = computed<GroupedCategory[]>(() =>
  [...groupedResults.value].filter(g => g.count > 0).sort((a, b) => b.count - a.count)
)
const facilityTotalCount = computed(() => groupedTotalCount.value)
const combinedTotalCount = computed(() => facilityTotalCount.value + realEstateTotalCount.value)

// Hero content — 통합 검색(부동산 + 생활시설)
const heroTitle = computed(() => (searchKeyword.value ? `'${searchKeyword.value}' 검색 결과` : '통합 검색'))
const heroDescription = computed(() => searchKeyword.value
  ? '생활시설과 부동산 실거래가를 한 번에 찾았어요.'
  : '장소·단지명·시설명으로 생활시설과 부동산을 함께 검색하세요.')
const heroStats = computed(() => {
  if (!searchKeyword.value) return []
  return [
    { label: '생활시설', value: facilityTotalCount.value > 0 ? `${facilityTotalCount.value.toLocaleString('ko-KR')}곳` : '—' },
    { label: '부동산', value: realEstateTotalCount.value > 0 ? `${realEstateTotalCount.value.toLocaleString('ko-KR')}건` : '—' },
  ]
})

// Methods
async function performSearch() {
  loading.value = true
  try {
    if (selectedRealEstateType.value) {
      await searchRealEstatePaged(selectedRealEstateType.value, reCurrentPage.value)
      return
    }
    const kw = searchKeyword.value || undefined
    const city = selectedCity.value || undefined
    const district = selectedDistrict.value || undefined
    await Promise.all([
      searchRealEstate(kw, city, district)
        .then(r => { realEstateResults.value = ((r?.categories as unknown) as RealEstateResultCategory[] | undefined)?.filter(c => c.count > 0) || [] })
        .catch(() => { realEstateResults.value = [] }),
      // 시설은 키워드가 있을 때만 (grouped는 전국 팬아웃이라 빈 키워드 방지)
      kw
        ? searchFacilitiesGrouped({ keyword: kw, city, district, limit: 20 }).catch(() => undefined)
        : Promise.resolve(),
    ])
  } finally {
    loading.value = false
  }
}

function handleSearch() {
  performSearch()
}

function clearSearch() {
  searchKeyword.value = ''
  handleSearch()
}

// 단지 카드 링크 — 4-세그먼트 정식 URL.
// 구 2-세그먼트(/real-estate/{propertyType}/{building})는 서버 리다이렉트만 있고
// 클라이언트 내비게이션에선 404가 난다. 페이지드 목록은 항상 {propertyType}-sale 데이터.
function complexCardUrl(item: { buildingName: string; city?: string; district?: string }): string {
  return toRealEstateUrl({
    type: `${selectedRealEstateType.value}-sale` as RealEstateUrlType,
    city: item.city || '',
    district: item.district || '',
    buildingName: item.buildingName,
  })
}

// 도메인 뷰 부동산 프리뷰 아이템 → ComplexCard 소비용 매핑.
// ComplexCard 내부 isRenderable 가드가 city/district/유효 buildingName을 요구하므로 그대로 전달.
function reItemToComplex(item: RealEstatePreviewItem): ComplexInfo {
  return {
    buildingName: item.buildingName,
    city: item.city || '',
    district: item.district || '',
    dongName: item.dongName || '',
    lastDealYear: item.dealYear ?? null,
    lastDealMonth: item.dealMonth ?? null,
    buildYear: item.buildYear ?? null,
    transactionCount: item.transactionCount ?? 0,
  } as ComplexInfo
}

// 생활시설 더보기 링크 — 카테고리 목록 페이지로 현재 키워드/지역 조건을 그대로 전달.
function facilityMoreHref(category: string): string {
  const kw = encodeURIComponent(searchKeyword.value.trim())
  const city = selectedCity.value ? `&city=${encodeURIComponent(selectedCity.value)}` : ''
  return `/${category}?keyword=${kw}${city}`
}

function selectRealEstateType(type: string) {
  selectedRealEstateType.value = type
  reCurrentPage.value = 1
  searchRealEstatePaged(type, 1)
}

// 부동산 유형 드릴다운(페이징 뷰) → 통합 결과(2도메인) 뷰로 복귀
function clearRealEstateTypeFilter() {
  selectedRealEstateType.value = ''
  reComplexItems.value = []
  reCurrentPage.value = 1
  reTotalPages.value = 0
  performSearch()
}

function goToRealEstatePage(page: number) {
  reCurrentPage.value = page
  searchRealEstatePaged(selectedRealEstateType.value, page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function handleCityChange() {
  selectedDistrict.value = ''

  if (selectedCity.value) {
    districts.value = await getDistricts(selectedCity.value)
  } else {
    districts.value = []
  }

  performSearch()
}

function handleDistrictChange() {
  performSearch()
}

// SSR redirect: /search?category=X → /X (301)
// 카테고리 목록은 types/facility.FACILITY_CATEGORIES 단일 소스에서 파생한다.
if (route.query.category && isFacilityCategory(String(route.query.category))) {
  const redirectCategory = route.query.category as string
  const redirectParams = new URLSearchParams()
  if (route.query.keyword) redirectParams.set('keyword', String(route.query.keyword))
  const redirectQuery = redirectParams.toString()
  navigateTo(`/${redirectCategory}${redirectQuery ? '?' + redirectQuery : ''}`, { replace: true, redirectCode: 301 })
}

// SSR: 초기 쿼리 파라미터에서 메타태그 설정
const initialKeyword = (route.query.keyword as string) || ''

// 검색 결과 페이지: 동적 메타 + 크롤링 방지
useHead({
  title: initialKeyword ? `${initialKeyword} 검색 결과 | 일상킷` : '검색 | 일상킷',
  meta: [
    { name: 'robots', content: 'noindex, follow' },
    { name: 'description', content: initialKeyword ? `${initialKeyword} 관련 부동산 실거래가 정보를 찾아보세요.` : '단지명이나 지역으로 부동산 실거래가 정보를 검색하세요.' },
  ],
  // noindex 페이지에서는 canonical 제거 (Google 신호 충돌 방지)
})
setSearchMeta({
  keyword: initialKeyword || undefined,
})

// Watch for route query changes (keyword only)
watch(
  () => route.query.keyword,
  (newKeyword, oldKeyword) => {
    if (newKeyword !== oldKeyword) {
      searchKeyword.value = (newKeyword as string) || ''
      selectedRealEstateType.value = ''
      reComplexItems.value = []
      performSearch()
    }
  }
)

// Lifecycle
onMounted(async () => {
  isMounted.value = true

  // Redirect /search?category=X → /X (client-side fallback)
  if (route.query.category) {
    const category = String(route.query.category)
    if (isFacilityCategory(category)) {
      const params = new URLSearchParams()
      if (route.query.keyword) params.set('keyword', String(route.query.keyword))
      const queryStr = params.toString()
      navigateTo(`/${category}${queryStr ? '?' + queryStr : ''}`, { replace: true, redirectCode: 301 })
      return
    }
  }

  // Read initial query params
  if (route.query.keyword) {
    searchKeyword.value = route.query.keyword as string
  }

  // Load cities for region filter
  cities.value = await getCities()

  // Read city filter from query param
  if (route.query.city) {
    const cityParam = route.query.city as string
    // 단축명(서울)→풀네임(서울특별시) 정규화
    const matchedCity = cities.value.find(c => c === cityParam || c.startsWith(cityParam))
    selectedCity.value = matchedCity || cityParam
    if (selectedCity.value) {
      districts.value = await getDistricts(selectedCity.value)
    }
  }

  // Read district filter from query param
  if (route.query.district) {
    selectedDistrict.value = route.query.district as string
  }

  // Initial search
  performSearch()
})

// 검색 조건 변경 시 메타태그 업데이트
watch(searchKeyword, () => {
  setSearchMeta({
    keyword: searchKeyword.value || undefined,
  })
  useHead({
    title: searchKeyword.value ? `${searchKeyword.value} 검색 결과 | 일상킷` : '검색 | 일상킷',
  })
})

// 검색 완료 시 결과 viewed 이벤트 (loading true → false 전이 + keyword 있을 때만)
watch(loading, (now, prev) => {
  if (prev && !now && searchKeyword.value) {
    const resultCount = selectedRealEstateType.value ? reTotal.value : combinedTotalCount.value
    trackSearchResultsView({
      keyword: searchKeyword.value,
      resultCount,
      category: 'unified',
    })
    logSearch({
      keyword: searchKeyword.value,
      resultCount,
      city: selectedCity.value || undefined,
      district: selectedDistrict.value || undefined,
      category: 'unified',
    })
    if (resultCount === 0) {
      trackSearchNoResults({ keyword: searchKeyword.value })
    }
  }
})
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Material Icon fill variant */
.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
