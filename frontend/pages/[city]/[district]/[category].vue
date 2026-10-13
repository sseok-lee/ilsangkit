<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="page-container pb-8 md:pb-10 flex flex-col">
      <PageHead
        :eyebrow="isTrash ? '지역 쓰레기 배출' : '지역 시설 목록'"
        :title="heroTitle"
        :description="heroDescription"
      >
        <template #breadcrumb>
          <Breadcrumb :items="breadcrumbItems" class="mb-4" />
        </template>
      </PageHead>

    <!-- 지역 요약 (non-trash) -->
    <SectionBlock
      variant="flat"
      v-if="summary && !isTrash"
      heading="지역 요약"
      subtext="이 지역의 전체 개수·상위 동·주변 지역을 한눈에 확인하세요."
    >
      <div class="flex flex-col gap-6">
        <DistrictSummaryCard
          :summary="summary"
          :district-name="districtName"
          :category-label="categoryName"
        />
        <NearbyDistrictsNav
          :city-slug="city"
          :category="category"
          :category-label="categoryName"
          :districts="summary.nearbyDistricts"
        />
      </div>
    </SectionBlock>

    <!-- 진료과목 필터 (병원 전용) -->
    <HospitalDepartmentFilter
      v-if="category === 'hospital' && !isTrash"
      variant="flat"
      v-model="selectedDepartments"
      @apply="handleDepartmentApply"
    />

    <!-- Trash: 배출 일정 -->
    <template v-if="isTrash">
      <WasteListSearch
        :query="wasteListQuery"
        :areas="wasteAreaOptionItems"
        :selected-area="wasteList.result.value?.selectedArea"
        :areas-pending="wasteAreaOptions.state.pending.value"
        :areas-error="wasteAreaOptions.state.error.value"
        :area-filter-enabled="wasteAreaFilterEnabled"
        @search="searchWasteList"
        @retry-areas="refreshWasteAreaOptions"
      />
      <WasteListPanel
        :result="wasteList.result.value"
        :query="wasteListQuery"
        :pending="wasteList.state.pending.value"
        :error="wasteList.state.error.value"
        :href-for="wasteListPageHref"
        :clear-keyword-href="clearWasteKeywordHref"
        :clear-area-href="clearWasteAreaHref"
        :first-page-href="firstWasteListPageHref"
        @retry="refreshWasteList"
        @page-change="goToWastePage"
      />
    </template>

    <!-- 일반 시설 그리드 -->
    <RegionFacilitiesGrid
      v-else
      :category-name="categoryName"
      :district-name="districtName"
      :total="displayTotal"
      :loading="displayLoading"
      :error="error"
      :facilities="displayFacilities"
      :current-page="currentPage"
      :total-pages="displayTotalPages"
      :category-slug="category"
      :href-for="pageHref"
      variant="rows"
      @page-change="goToPage"
      @retry="loadFacilities"
    />

    <!-- Ad: 결과 뒤 -->
    <AdBanner v-if="showRegionAd" />

    <!-- 이 지역 다른 카테고리 -->
    <RegionRelatedCategories
      :city="city"
      :district="district"
      :district-name="districtName"
      :categories="otherCategories"
    />

    <AffiliateBanner v-if="showRegionAd" />

    <!-- 데이터 출처 -->
    <DataSourceSection variant="flat" domain="facility" :category="(category as FacilityCategory)" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { useRegionFacilities } from '~/composables/useRegionFacilities'
import { useWasteList } from '~/composables/useWasteList'
import { useWasteAreaOptions } from '~/composables/useWasteAreaOptions'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { CITY_FULL_NAME_TO_SLUG } from '~/shared/regionSlugs'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS, NON_REGION_CATEGORIES } from '~/types/facility'
import { PAGINATION_ROBOTS_CONTENT, parsePositivePageQuery } from '~/utils/pageQuery'
import { shouldNoindexFacilityList } from '~/utils/facilityListRobots'
import { computeAreaNoindex } from '~/utils/areaNoindex'
import { buildPageHref, stripUiStateQuery } from '~/utils/paginationHref'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { resolveRegionDisplay } from '~/utils/regionDisplayState'
import { shouldShowTrashRegionAd } from '~/utils/trashRegionAds'
import type { FacilityCategory, Facility } from '~/types/facility'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHead from '~/components/common/PageHead.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import RegionRelatedCategories from '~/components/region/RegionRelatedCategories.vue'
import WasteListSearch from '~/components/trash/WasteListSearch.vue'
import WasteListPanel from '~/components/trash/WasteListPanel.vue'
import RegionFacilitiesGrid from '~/components/region/RegionFacilitiesGrid.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { normalizeWasteAreaCity, WasteAreaQueryError } from '~/utils/wasteAreaQuery'
import { parseWasteListQuery, wasteListPathForQuery } from '~/utils/wasteListQuery'
import { wasteListSeo } from '~/utils/wasteListSeo'
import type { WasteListQuery } from '~/types/wasteList'

// Route params
const route = useRoute()
definePageMeta({
  middleware: ['legacy-trash-schedule'],
})
const city = computed(() => route.params.city as string)
const district = computed(() => route.params.district as string)
const category = computed(() => route.params.category as string)
const isTrash = computed(() => category.value === 'trash')

// Validate city slug (Soft 404 방지)
if (!CITY_SLUG_MAP[city.value]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Validate category (Soft 404 방지)
if (!CATEGORY_META[category.value as FacilityCategory]) {
  throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
}

// Dynamic region data
const { loadRegions, syncFromHydration, getCityName, getDistrictName, getDistrictsByCity } = useRegions()

// SSR: 서버에서 지역 정보 로드
const { data: regionsData } = await useAsyncData(
  `region-${city.value}-${district.value}`,
  () => loadRegions()
)
// useAsyncData의 hydrated data로 캐시 동기화
syncFromHydration(regionsData)

// Validate district slug (Soft 404 방지)
if (regionsData.value?.length) {
  const validDistricts = getDistrictsByCity(city.value)
  if (validDistricts.length > 0 && !validDistricts.some(d => d.slug === district.value)) {
    throw createError({ statusCode: 404, statusMessage: '페이지를 찾을 수 없습니다' })
  }
}

// Korean names (동적으로 가져옴)
const cityName = computed(() => getCityName(city.value))
// 축약 도시명 (서울특별시 → 서울) — H1에 사용해 title과 일관성 유지
const cityShortName = computed(() =>
  cityName.value.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
)
const districtName = computed(() => getDistrictName(city.value, district.value))
const categoryName = computed(() => {
  const meta = CATEGORY_META[category.value as keyof typeof CATEGORY_META]
  return meta?.label || category.value
})

// slug → DB 풀네임 (서울특별시 등) 역매핑 — waste APIs 는 정식 시도명으로 정확매칭한다.
const SLUG_TO_FULL_CITY = Object.entries(CITY_FULL_NAME_TO_SLUG).reduce(
  (acc, [fullName, slug]) => ({ ...acc, [slug]: fullName }),
  {} as Record<string, string>,
)
const fullCityName = computed(() => SLUG_TO_FULL_CITY[city.value] || cityName.value)
function inactiveWasteListQuery(): WasteListQuery {
  return { page: parsePositivePageQuery(route.query.page), limit: 20 }
}

function parseCurrentWasteListQuery(): WasteListQuery {
  if (!isTrash.value) return inactiveWasteListQuery()

  try {
    if (Array.isArray(route.query.city) || Array.isArray(route.query.district)) {
      throw createError({ statusCode: 400, statusMessage: '중복 지역 query는 사용할 수 없습니다' })
    }
    const queryCity = route.query.city
    const queryDistrict = route.query.district
    if (typeof queryCity === 'string' && queryCity.trim() && normalizeWasteAreaCity(queryCity) !== fullCityName.value) {
      throw createError({ statusCode: 400, statusMessage: '경로 지역과 city query가 충돌합니다' })
    }
    if (typeof queryDistrict === 'string' && queryDistrict.trim() && queryDistrict.trim() !== districtName.value) {
      throw createError({ statusCode: 400, statusMessage: '경로 지역과 district query가 충돌합니다' })
    }
    return parseWasteListQuery({
        ...route.query,
        city: fullCityName.value,
        district: districtName.value,
      }, { city: fullCityName.value, district: districtName.value })
  } catch (error) {
    if ((error as { statusCode?: number }).statusCode) throw error
    const typed = error as WasteAreaQueryError
    throw createError({ statusCode: typed.statusCode || 400, statusMessage: typed.message || '잘못된 요청입니다' })
  }
}

const wasteListQuery = computed(() => parseCurrentWasteListQuery())

// 지역 요약 (/api/area/:city/:district/:category/summary) SSR 주입
interface AreaSummary {
  count: number
  countDiff: number
  highlights: Array<{ key: string; label: string; count: number; percent: number }>
  nearbyDistricts: Array<{ slug: string; district: string; count: number }>
  lastSyncedAt: string | null
}
const apiBase = useApiBase()
// 실패를 삼키지 않는다. 예전엔 try/catch 로 null 을 돌려줘 useAsyncData 가 에러를
// 볼 수조차 없었고, 인근 구·군 블록과 건수가 빠진 얇은 본문이 HTTP 200 으로 나갔다.
// `success:false` 도 마찬가지다 — 200 이라고 성공은 아니다.
// trash 는 이 요약을 쓰지 않으므로 null 반환이 정상이다(에러 아님).
const { data: summary, error: summaryError } = await useAsyncData<AreaSummary | null>(
  `area-summary-${city.value}-${district.value}-${category.value}`,
  async () => {
    if (category.value === 'trash') return null
    const res = await $fetch<{ success: boolean; data: AreaSummary }>(
      `${apiBase}/api/area/${city.value}/${district.value}/${category.value}/summary`,
    )
    if (!res?.success) throw new Error('area summary responded success:false')
    return res.data
  },
)
// fail-open: SSR 페치 실패 시 503+no-store. 시설 경로와 동일 정책(#467).
if (import.meta.server && summaryError.value) markDegradedResponse()

// URL `?page=N` 에서 초기 페이지를 유추 — SSR/클라이언트 진입 모두 동일한 페이지를 렌더하도록.
const initialPage = parsePositivePageQuery(route.query.page)

// trash 지역: 배출 일정 "목록"을 SSR 에서 로드한다.
//
// 기존엔 건수(limit=1)만 SSR 하고 목록은 클라이언트 로드였다. 그래서 크롤러가 받는 HTML 에는
// "배출 일정 0건 · 배출 일정 조회 중..." 만 남아 전국 구·군 trash 페이지의 본문이 사실상 동일했다.
// 실측(2026-07-28 라이브): /jeonbuk/gochang/trash 의 SSR HTML 에 schedule 링크 0개, 목록 0건,
// __NUXT__ payload 에 schedules 없음 — meta description 만 "704건" 으로 채워져 본문과 어긋났다.
// 시설 카테고리는 #550/552 에서 SSR 화됐지만 trash 만 제외돼 있었다([category].vue 주석에 명시).
//
// 목록까지 SSR 하면 지역별 실제 배출 요일·구역이 렌더되어 본문이 차별화되고,
// meta 용 건수도 같은 응답에서 얻으므로 요청 수는 늘지 않는다(limit=1 → limit=20 로 대체).
const wasteList = useWasteList({ active: () => isTrash.value, query: () => wasteListQuery.value })
await wasteList.state
if (import.meta.server && wasteList.state.error.value) markDegradedResponse()

const wasteOptionCity = computed(() => wasteList.result.value?.selectedArea?.city ?? wasteListQuery.value.city)
const wasteOptionDistrict = computed(() => wasteList.result.value?.selectedArea?.district ?? wasteListQuery.value.district)
const wasteAreaOptions = useWasteAreaOptions({
  city: () => wasteOptionCity.value,
  district: () => wasteOptionDistrict.value,
  enabled: () => isTrash.value && !!wasteOptionCity.value && !!wasteOptionDistrict.value,
})
await wasteAreaOptions.state
const wasteAreaOptionItems = computed(() => wasteAreaOptions.result.value?.items ?? [])
const wasteAreaFilterEnabled = computed(() => !!wasteOptionCity.value && !!wasteOptionDistrict.value)
const wasteCount = computed<number | null>(() => wasteList.result.value?.total ?? null)

// SEO - top-level에서 설정 (SSR에서 메타태그 렌더링).
// canonical 은 아래 useHead(computed...) 에서 noindex 상태와 함께 reactive 하게 관리한다 (정책: .omc/notes/noindex-canonical-policy.md).
const { setRegionMeta } = useFacilityMeta()
setRegionMeta({
  city: city.value,
  cityName: cityName.value,
  district: district.value,
  districtName: districtName.value,
  category: category.value as FacilityCategory,
  count: isTrash.value ? (wasteCount.value ?? undefined) : summary.value?.count,
  canonical: false,
})

// Breadcrumb JSON-LD
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: cityName.value, url: `/${city.value}` },
  { name: districtName.value, url: `/${city.value}/${district.value}` },
  { name: categoryName.value, url: `/${city.value}/${district.value}/${category.value}` },
])

// Breadcrumb
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: cityName.value, href: `/${city.value}`, current: false },
  { label: districtName.value, href: `/${city.value}/${district.value}`, current: false },
  {
    label: categoryName.value,
    href: `/${city.value}/${district.value}/${category.value}`,
    current: true,
  },
])

// Hero title/description/stats
const heroTitle = computed(() => {
  const countSuffix = summary.value?.count && summary.value.count > 0 ? ` ${summary.value.count.toLocaleString('ko-KR')}곳` : ''
  return `${cityShortName.value} ${districtName.value} ${categoryName.value}${countSuffix}`
})
const heroDescription = computed(() =>
  isTrash.value
    ? `${cityName.value} ${districtName.value}의 쓰레기 배출 일정 정보를 확인하세요.`
    : `${cityName.value} ${districtName.value}의 ${categoryName.value} 위치·운영시간을 확인하세요.`
)


// Other categories (dynamically from CATEGORY_GROUPS, excluding current)
// 지역 페이지가 없는 카테고리(subway 등)는 "이 지역 다른 카테고리" 링크에서 제외 (404 방지).
const EXCLUDED_REGION_CATEGORIES = new Set<string>(NON_REGION_CATEGORIES)
const otherCategories = computed(() => {
  const all: { slug: string; name: string }[] = []
  for (const group of CATEGORY_GROUPS) {
    for (const id of group.categories) {
      if (id !== category.value && !EXCLUDED_REGION_CATEGORIES.has(id)) {
        all.push({ slug: id, name: CATEGORY_META[id].label })
      }
    }
  }
  return all
})

const showRegionAd = computed(() => shouldShowTrashRegionAd({
  isTrash: isTrash.value,
  hasQuery: Object.keys(route.query).length > 0,
  coverage: wasteListQuery.value.coverage,
  showWasteAreaList: false,
  wasteAreaItemCount: 0,
  wasteAreaError: wasteAreaOptions.state.error.value,
  wasteScheduleCount: wasteList.result.value?.schedules.length ?? 0,
  wasteScheduleError: !!wasteList.state.error.value,
}))

function refreshWasteList() {
  return wasteList.state.refresh()
}

function refreshWasteAreaOptions() {
  return wasteAreaOptions.state.refresh()
}

// URL query 를 함께 갱신해야 reactive noindex 가 정확히 동작한다.
// UI 상태 키(`?schedule=`)는 stripUiStateQuery 로 떨군다 — buildPageHref 가 만드는 href 와
// 클릭 후 SPA 가 만드는 URL 이 문자 단위로 같아야 크롤러/사용자가 같은 페이지를 본다.
function syncPageQuery(page: number): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = stripUiStateQuery(route.query)
  if (page > 1) nextQuery.page = String(page)
  else delete nextQuery.page
  return nextQuery
}

// 페이지네이션을 <a href> 로 렌더하기 위한 URL. syncPageQuery 와 동일한 의미론이어야
// 크롤러가 보는 URL 과 클릭 후 SPA 가 만드는 URL 이 일치한다.
function pageHref(page: number): string {
  return buildPageHref(route.path, route.query, page)
}

function wasteListPageHref(page: number): string {
  return wasteListPathForQuery(route.path, { ...wasteListQuery.value, page })
}

const clearWasteKeywordHref = computed(() => wasteListPathForQuery(route.path, { ...wasteListQuery.value, keyword: undefined, page: 1 }))
const clearWasteAreaHref = computed(() => wasteListPathForQuery(route.path, { ...wasteListQuery.value, areaId: undefined, page: 1 }))
const firstWasteListPageHref = computed(() => wasteListPathForQuery(route.path, { ...wasteListQuery.value, page: 1 }))

async function searchWasteList(query: Pick<WasteListQuery, 'city' | 'district' | 'areaId' | 'keyword' | 'coverage'>) {
  await navigateTo(wasteListPathForQuery(route.path, {
    city: fullCityName.value,
    district: districtName.value,
    areaId: query.areaId,
    keyword: query.keyword,
    coverage: query.coverage,
    page: 1,
    limit: 20,
  }))
}

async function goToWastePage(page: number) {
  await navigateTo(wasteListPathForQuery(route.path, { ...wasteListQuery.value, page }))
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// ========== Facilities (non-trash) ==========
const {
  facilities,
  loading,
  error,
  total,
  totalPages,
  loadRegionFacilities,
  fetchFacilities,
} = useRegionFacilities()

const currentPage = ref(initialPage)
const selectedDepartments = ref<string[]>([])

// SSR: 시설 목록을 서버에서 로드해 HTML 에 실제 시설 데이터를 렌더한다.
// (기존엔 클라이언트 fetch 라 SSR HTML 에 로딩 자리표시자만 남아 네이버가 얇은 중복 문서로 인식했다.)
const { data: ssrFacilityData, error: ssrFacilityError } = await useAsyncData(
  `region-facilities-${city.value}-${district.value}-${category.value}-p${initialPage}`,
  () => isTrash.value
    ? Promise.resolve(null)
    : loadRegionFacilities(city.value, district.value, category.value, initialPage, 20),
)
// fail-open: SSR 페치 실패 시 503+no-store (크롤러는 기존 색인 유지·재방문, 조용한 noindex 금지).
// 과거 SSR 풀고갈→noindex 사고 방지 (.omc/notes 정책).
if (import.meta.server && ssrFacilityError.value) markDegradedResponse()

// 표시 상태: 초기(SSR)엔 서버 데이터, 클라이언트 페이지네이션/필터 후엔 composable ref 우선.
// 선택 규칙은 resolveRegionDisplay(순수 함수, 단위 테스트 대상)에 위임한다.
const ssrConsumed = ref(false)
const displayState = computed(() =>
  resolveRegionDisplay({
    ssrConsumed: ssrConsumed.value,
    ssr: ssrFacilityData.value,
    client: {
      items: facilities.value as Facility[],
      total: total.value || 0,
      totalPages: totalPages.value,
      loading: loading.value,
    },
  })
)
const displayFacilities = computed(() => displayState.value.facilities)
const displayTotal = computed(() => displayState.value.total)
const displayTotalPages = computed(() => displayState.value.totalPages)
const displayLoading = computed(() => displayState.value.loading)

async function loadFacilities() {
  ssrConsumed.value = true
  const departments = category.value === 'hospital' && selectedDepartments.value.length > 0
    ? selectedDepartments.value
    : undefined
  await fetchFacilities(city.value, district.value, category.value, currentPage.value, 20, departments)
}

async function handleDepartmentApply() {
  currentPage.value = 1
  await navigateTo({ query: syncPageQuery(1) })
  loadFacilities()
}

async function goToPage(pageNum: number) {
  currentPage.value = pageNum
  await navigateTo({ query: syncPageQuery(pageNum) })
  loadFacilities()
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

// 초기 데이터: trash·비-trash 모두 위 useAsyncData(SSR)가 로드한다.
// SSR 페치가 실패(degraded)했을 때만 클라이언트에서 1회 보충 로드 — 실사용자 정상 표시.
onMounted(() => {
  if (isTrash.value) {
    if (!wasteList.result.value) refreshWasteList()
  } else if (!ssrFacilityData.value) {
    loadFacilities()
  }
})

// URL → 상태 동기화: 브라우저 뒤로가기/앞으로가기 혹은 query-only 네비게이션에서도
// pageQueryParam(아래 computed)과 실제 페이지 상태가 어긋나지 않도록 한다.
// goToPage 등 페이지 액션은 상태를 먼저 갱신하므로 같은 값일 때는 재조회를 스킵한다.
watch(() => route.query.page, (next) => {
  const nextPage = parsePositivePageQuery(next)
  if (isTrash.value) {
    return
  }
  if (currentPage.value === nextPage) return
  currentPage.value = nextPage
  loadFacilities()
})

watch(() => wasteList.key.value, () => refreshWasteList())

// noindex 조건: SSR summary.count 기반(비-trash) 또는 일정 없음(trash) 또는 페이지 2 이상.
// 정책: noindex 일 때는 canonical 을 함께 내보내지 않는다 (.omc/notes/noindex-canonical-policy.md).
// route.query.page 변경에 reactive 하게 반응해야 client-side 페이지 이동에서도 정책이 유지된다.
const pageQueryParam = computed(() => parsePositivePageQuery(route.query.page))
// isPageNoindex 를 shared computed 로 추출해 rel=prev/next 게이팅에도 재사용한다.
const isPageNoindex = computed(() =>
  shouldNoindexFacilityList({ page: pageQueryParam.value, query: route.query }) ||
  computeAreaNoindex({
    isTrash: isTrash.value,
    summaryCount: summary.value?.count,
    // ⚠️ SSR 반영 값(display*)을 읽어야 한다. 클라이언트 전용 ref(wasteSchedules/wasteLoading)를
    // 읽으면 SSR 시점엔 항상 비어 있어(로드는 useAsyncData 가 wasteSsr 로 한다) 모든 trash
    // 지역 페이지가 noindex 로 나간다 — #677 배포 직후 실제로 발생한 회귀.
    wasteEmpty: !wasteList.state.pending.value && (wasteList.result.value?.schedules.length ?? 0) === 0,
    page: pageQueryParam.value,
  })
)
const trashListSeo = computed(() => wasteListSeo({
  query: wasteListQuery.value,
  result: wasteList.result.value,
  regionalCanonical: `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`,
  failed: !!wasteList.state.error.value,
}))

useHead(computed(() => {
  if (isTrash.value) {
    const seo = trashListSeo.value
    if (seo.noindex) return { meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] }
    return { link: [{ rel: 'canonical', href: seo.canonical, key: 'canonical' }] }
  }
  if (isPageNoindex.value) {
    return { meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] }
  }
  return {
    link: [
      {
        rel: 'canonical',
        href: `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`,
        key: 'canonical',
      },
    ],
  }
}))

// ItemList 구조화 데이터 (non-trash only)
// display* 를 소스로 immediate:true → SSR HTML 에도 ItemList/rel=prev·next 가 포함된다.
// 링크에 key 를 부여해 재실행 시 중복 태그가 쌓이지 않게 한다.
watch([displayFacilities, currentPage, displayTotalPages], () => {
  if (isTrash.value) return
  if (displayFacilities.value.length > 0) {
    setItemListSchema(
      displayFacilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  // noindex 페이지에는 rel=prev/next 를 내보내지 않는다 (모순 신호 방지).
  if (isPageNoindex.value) return

  const paginationLinks: Array<{ rel: string; href: string; key: string }> = []
  const baseUrl = `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`

  if (currentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${currentPage.value - 1}`, key: 'seo-rel-prev' })
  }
  if (currentPage.value < displayTotalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${currentPage.value + 1}`, key: 'seo-rel-next' })
  }

  useHead({ link: paginationLinks })
}, { immediate: true })

// ItemList 구조화 데이터 (trash)
watch([() => wasteList.result.value, () => wasteListQuery.value.page, () => trashListSeo.value.noindex], () => {
  if (!isTrash.value) return
  if (wasteList.result.value?.schedules.length) {
    setItemListSchema(
      wasteList.result.value.schedules.map((s, index) => ({
        name: s.targetRegion,
        position: (wasteListQuery.value.page - 1) * 20 + index + 1,
      }))
    )
  }

  // noindex 페이지에는 rel=prev/next 를 내보내지 않는다 (모순 신호 방지).
  if (trashListSeo.value.noindex) return

  // 비-trash 블록과 동일하게 key 를 붙인다. unkeyed 로 두면 client 네비게이션마다
  // rel=prev/next 태그가 head 에 누적돼 한 문서가 여러 페이지를 동시에 가리킨다.
  const paginationLinks: Array<{ rel: string; href: string; key: string }> = []
  const baseUrl = `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`

  if (wasteListQuery.value.page > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${wasteListQuery.value.page - 1}`, key: 'seo-rel-prev' })
  }
  if (wasteList.result.value && wasteListQuery.value.page < wasteList.result.value.totalPages) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${wasteListQuery.value.page + 1}`, key: 'seo-rel-next' })
  }

  useHead({ link: paginationLinks })
})
</script>
