<template>
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Hero -->
    <PageHero
      :eyebrow="isTrash ? '지역 쓰레기 배출' : '지역 시설 목록'"
      :title="heroTitle"
      :description="heroDescription"
      :stats="heroStats"
    />

    <!-- 지역 요약 (non-trash) -->
    <SectionBlock
      v-if="summary && !isTrash"
      heading="지역 요약"
      subtext="이 지역의 전체 개수·상위 동·주변 지역을 한눈에 확인하세요."
    >
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
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
      v-model="selectedDepartments"
      @apply="handleDepartmentApply"
    />

    <!-- Trash: 배출 일정 -->
    <RegionTrashSchedule
      v-if="isTrash"
      :total="wasteTotal"
      :loading="wasteLoading"
      :contact="wasteContact"
      :schedules="wasteSchedules"
      :current-page="wasteCurrentPage"
      :total-pages="wasteTotalPages"
      @page-change="goToWastePage"
      @select="openWasteSchedule"
    />

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
      @page-change="goToPage"
      @retry="loadFacilities"
    />

    <WasteScheduleDetailModal
      :open="selectedWasteScheduleId !== null"
      :schedule="selectedWasteSchedule"
      :loading="wasteDetailLoading"
      :error="wasteDetailError"
      @close="closeWasteSchedule"
    />

    <!-- Ad: 결과 뒤 -->
    <AdBanner />

    <!-- 이 지역 다른 카테고리 -->
    <RegionRelatedCategories
      :city="city"
      :district="district"
      :district-name="districtName"
      :categories="otherCategories"
    />

    <!-- 데이터 출처 -->
    <DataSourceSection domain="facility" :category="(category as FacilityCategory)" />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import type { LocationQueryRaw } from 'vue-router'
import { useRegionFacilities } from '~/composables/useRegionFacilities'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import type { RegionSchedule, WasteScheduleDetail } from '~/composables/useWasteSchedule'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { CITY_FULL_NAME_TO_SLUG } from '~/shared/regionSlugs'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS, NON_REGION_CATEGORIES } from '~/types/facility'
import { PAGINATION_ROBOTS_CONTENT, parsePositivePageQuery } from '~/utils/pageQuery'
import { computeAreaNoindex } from '~/utils/areaNoindex'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { resolveRegionDisplay } from '~/utils/regionDisplayState'
import { withSyncDate, TRASH_STALE_DAYS, FACILITY_STALE_DAYS } from '~/utils/syncFreshness'
import { useSyncStatus } from '~/composables/useSyncStatus'
import { useNationalStats } from '~/composables/useNationalStats'
import { buildRegionCategoryStats } from '~/utils/heroBandStats'
import type { FacilityCategory, Facility } from '~/types/facility'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import RegionRelatedCategories from '~/components/region/RegionRelatedCategories.vue'
import RegionTrashSchedule from '~/components/region/RegionTrashSchedule.vue'
import RegionFacilitiesGrid from '~/components/region/RegionFacilitiesGrid.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import WasteScheduleDetailModal from '~/components/trash/WasteScheduleDetailModal.vue'

// Route params
const route = useRoute()
const router = useRouter()
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

// 지역 요약 (/api/area/:city/:district/:category/summary) SSR 주입
interface AreaSummary {
  count: number
  countDiff: number
  highlights: Array<{ key: string; label: string; count: number; percent: number }>
  nearbyDistricts: Array<{ slug: string; district: string; count: number }>
  lastSyncedAt: string | null
}
const apiBase = useApiBase()
const { data: summary } = await useAsyncData<AreaSummary | null>(
  `area-summary-${city.value}-${district.value}-${category.value}`,
  async () => {
    if (category.value === 'trash') return null
    try {
      const res = await $fetch<{ success: boolean; data: AreaSummary }>(
        `${apiBase}/api/area/${city.value}/${district.value}/${category.value}/summary`,
      )
      return res?.success ? res.data : null
    } catch {
      return null
    }
  },
)

// slug → DB 풀네임 (서울특별시 등) 역매핑 — waste-schedules 는 정식 시도명으로 정확매칭한다.
const SLUG_TO_FULL_CITY = Object.entries(CITY_FULL_NAME_TO_SLUG).reduce(
  (acc, [fullName, slug]) => ({ ...acc, [slug]: fullName }),
  {} as Record<string, string>,
)

// trash 지역: 배출 일정 건수를 SSR 에서 확보해 meta description 을 지역별로 차별화한다.
// 경량(count) · fail-open(에러/타임아웃 → null → 일반 설명문 폴백) · non-trash 는 네트워크 미발생.
const { data: wasteCount } = await useAsyncData<number | null>(
  `waste-count-${city.value}-${district.value}-${category.value}`,
  async () => {
    if (category.value !== 'trash') return null
    try {
      const fullCityName = SLUG_TO_FULL_CITY[city.value] || cityName.value
      const res = await $fetch<{ success: boolean; data: { total: number } }>(
        `${apiBase}/api/waste-schedules`,
        {
          query: { city: fullCityName, district: districtName.value, page: 1, limit: 1 },
          signal: AbortSignal.timeout(8000),
        },
      )
      return res?.success ? (res.data?.total ?? null) : null
    } catch {
      return null
    }
  },
)

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
const { syncStatus } = useSyncStatus()
const { stats: nationalStats } = useNationalStats()

const heroStats = computed(() => {
  const count = isTrash.value ? wasteTotal.value : (summary.value?.count ?? total.value ?? 0)
  const nat = nationalStats.value?.[category.value]
  return buildRegionCategoryStats({
    regionCount: count,
    nationalCount: typeof nat === 'number' ? nat : null,
    unit: isTrash.value ? '건' : '곳',
    syncCellValue: withSyncDate(
      isTrash.value ? '매일 자동' : '월 1회 자동',
      syncStatus.value?.[category.value],
      isTrash.value ? TRASH_STALE_DAYS : FACILITY_STALE_DAYS,
    ),
    syncLabel: '업데이트',
  })
})

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

// URL `?page=N` 에서 초기 페이지를 유추 — SSR/클라이언트 진입 모두 동일한 페이지를 렌더하도록.
const initialPage = parsePositivePageQuery(route.query.page)

// ========== Waste Schedule (trash) ==========
const { getSchedules, getScheduleDetail, isLoading: wasteLoading } = useWasteSchedule()
const wasteSchedules = ref<RegionSchedule[]>([])
const wasteContact = ref<{ name: string; phone?: string } | null>(null)
const wasteCurrentPage = ref(initialPage)
const wasteTotalPages = ref(1)
const wasteTotal = ref(0)
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

const selectedWasteScheduleId = computed(() => isTrash.value ? parseScheduleQuery(route.query.schedule) : null)

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

async function loadWasteSchedules() {
  const fullCityName = SLUG_TO_FULL_CITY[city.value] || cityName.value
  const result = await getSchedules({
    city: fullCityName || undefined,
    district: districtName.value || undefined,
    page: wasteCurrentPage.value,
    limit: 20,
  })
  wasteSchedules.value = result.schedules
  wasteContact.value = result.contact || null
  wasteTotal.value = result.total
  wasteTotalPages.value = result.totalPages
}

// URL query 를 함께 갱신해야 reactive noindex 가 정확히 동작한다.
function syncPageQuery(page: number): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query }
  if (page > 1) nextQuery.page = String(page)
  else delete nextQuery.page
  return nextQuery
}

async function goToWastePage(page: number) {
  wasteCurrentPage.value = page
  const nextQuery = syncPageQuery(page)
  delete nextQuery.schedule
  await navigateTo({ query: nextQuery })
  loadWasteSchedules()
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

// 초기 데이터: 비-trash 목록은 위 useAsyncData(SSR)가 로드한다. trash 만 클라이언트 로드.
if (isTrash.value) {
  loadWasteSchedules()
}

// SSR 페치가 실패(degraded)했을 때만 클라이언트에서 1회 보충 로드 — 실사용자 정상 표시.
onMounted(() => {
  if (!isTrash.value && !ssrFacilityData.value) loadFacilities()
})

// URL → 상태 동기화: 브라우저 뒤로가기/앞으로가기 혹은 query-only 네비게이션에서도
// pageQueryParam(아래 computed)과 실제 페이지 상태가 어긋나지 않도록 한다.
// goToPage 등 페이지 액션은 상태를 먼저 갱신하므로 같은 값일 때는 재조회를 스킵한다.
watch(() => route.query.page, (next) => {
  const nextPage = parsePositivePageQuery(next)
  if (isTrash.value) {
    if (wasteCurrentPage.value === nextPage) return
    wasteCurrentPage.value = nextPage
    loadWasteSchedules()
  } else {
    if (currentPage.value === nextPage) return
    currentPage.value = nextPage
    loadFacilities()
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

// noindex 조건: SSR summary.count 기반(비-trash) 또는 일정 없음(trash) 또는 페이지 2 이상.
// 정책: noindex 일 때는 canonical 을 함께 내보내지 않는다 (.omc/notes/noindex-canonical-policy.md).
// route.query.page 변경에 reactive 하게 반응해야 client-side 페이지 이동에서도 정책이 유지된다.
const pageQueryParam = computed(() => parsePositivePageQuery(route.query.page))
// isPageNoindex 를 shared computed 로 추출해 rel=prev/next 게이팅에도 재사용한다.
const isPageNoindex = computed(() =>
  computeAreaNoindex({
    isTrash: isTrash.value,
    summaryCount: summary.value?.count,
    wasteEmpty: !wasteLoading.value && wasteSchedules.value.length === 0,
    page: pageQueryParam.value,
  })
)
useHead(computed(() => {
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
watch([wasteSchedules, wasteCurrentPage, wasteTotalPages], () => {
  if (!isTrash.value) return
  if (wasteSchedules.value.length > 0) {
    setItemListSchema(
      wasteSchedules.value.map((s, index) => ({
        name: s.targetRegion,
        position: (wasteCurrentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  // noindex 페이지에는 rel=prev/next 를 내보내지 않는다 (모순 신호 방지).
  if (isPageNoindex.value) return

  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`

  if (wasteCurrentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${wasteCurrentPage.value - 1}` })
  }
  if (wasteCurrentPage.value < wasteTotalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${wasteCurrentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})
</script>
