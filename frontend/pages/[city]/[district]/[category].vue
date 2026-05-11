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

    <!-- ========== Trash: 배출 일정 ========== -->
    <SectionBlock v-if="isTrash" heading="배출 일정" :subtext="`${wasteTotal.toLocaleString('ko-KR')}건 · 지역별 배출 요일과 방법`">
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{{ wasteTotal.toLocaleString('ko-KR') }}건</span>
      </template>

      <!-- 로딩 -->
      <div v-if="wasteLoading" class="flex items-center justify-center py-10">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p class="text-slate-500 text-sm">배출 일정 조회 중...</p>
        </div>
      </div>

      <div v-else>
        <!-- 담당 부서 연락처 -->
        <div v-if="wasteContact" class="bg-blue-50 rounded-xl p-4 border border-blue-100 mb-4">
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
        <div v-if="wasteSchedules.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <WasteScheduleCard
            v-for="region in wasteSchedules"
            :key="region.id"
            :region="region"
          />
        </div>

        <!-- 결과 없음 -->
        <div v-else class="py-12 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-[32px] text-slate-500">delete</span>
          </div>
          <p class="text-slate-700 font-semibold text-lg">등록된 배출 일정이 없습니다</p>
          <p class="text-slate-500 text-sm mt-1">해당 지역의 배출 정보가 아직 등록되지 않았어요</p>
        </div>

        <!-- 페이지네이션 -->
        <Pagination
          v-if="wasteTotalPages > 1"
          :current-page="wasteCurrentPage"
          :total-pages="wasteTotalPages"
          @page-change="goToWastePage"
        />
      </div>
    </SectionBlock>

    <!-- ========== 일반 시설 ========== -->
    <SectionBlock v-else :heading="`${categoryName} 목록`" :subtext="`${districtName} 지역 ${categoryName} 정보`">
      <template #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">{{ (total || 0).toLocaleString('ko-KR') }}건</span>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="text-center py-10">
        <div class="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
        <p class="mt-4 text-slate-500 text-sm">시설 정보를 불러오는 중...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p class="text-red-800">{{ error }}</p>
        <button
          class="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          @click="loadFacilities()"
        >
          다시 시도
        </button>
      </div>

      <!-- Facilities Grid -->
      <div v-else>
        <div v-if="facilities.length === 0" class="py-12 text-center">
          <p class="text-slate-600">해당 지역에 등록된 시설이 없습니다.</p>
        </div>

        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <FacilityCard
            v-for="facility in facilities"
            :key="facility.id"
            :facility="facility"
          />
        </div>

        <!-- Pagination -->
        <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-4">
          <button
            :disabled="currentPage === 1"
            class="px-4 py-2 border border-line rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            @click="goToPage(currentPage - 1)"
          >
            이전
          </button>
          <span class="text-slate-700 text-sm">{{ currentPage }} / {{ totalPages }}</span>
          <button
            :disabled="currentPage === totalPages"
            class="px-4 py-2 border border-line rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            @click="goToPage(currentPage + 1)"
          >
            다음
          </button>
        </div>
      </div>
    </SectionBlock>

    <!-- Ad: 결과 뒤 -->
    <AdBanner />

    <!-- 이 지역 다른 카테고리 -->
    <RegionRelatedCategories
      :city="city"
      :district="district"
      :district-name="districtName"
      :categories="otherCategories"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useRegionFacilities } from '~/composables/useRegionFacilities'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import type { RegionSchedule } from '~/composables/useWasteSchedule'
import { useRegions, CITY_SLUG_MAP } from '~/composables/useRegions'
import { CITY_FULL_NAME_TO_SLUG } from '~/shared/regionSlugs'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import RegionRelatedCategories from '~/components/region/RegionRelatedCategories.vue'

// Route params
const route = useRoute()
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
const config = useRuntimeConfig()
const { data: summary } = await useAsyncData<AreaSummary | null>(
  `area-summary-${city.value}-${district.value}-${category.value}`,
  async () => {
    if (category.value === 'trash') return null
    try {
      const res = await $fetch<{ success: boolean; data: AreaSummary }>(
        `${config.public.apiBase}/api/area/${city.value}/${district.value}/${category.value}/summary`,
      )
      return res?.success ? res.data : null
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
const heroStats = computed(() => {
  const s: { label: string; value: string }[] = []
  const count = isTrash.value ? wasteTotal.value : (summary.value?.count ?? total.value ?? 0)
  if (count > 0) {
    s.push({ label: isTrash.value ? '배출 일정' : '시설 수', value: `${count.toLocaleString('ko-KR')}${isTrash.value ? '건' : '곳'}` })
  }
  if (!isTrash.value && summary.value?.nearbyDistricts?.length) {
    s.push({ label: '주변 지역', value: summary.value.nearbyDistricts.slice(0, 2).map(n => n.district).join(' · ') })
  }
  s.push({ label: '업데이트', value: isTrash.value ? '매일 자동' : '월 1회 자동' })
  return s
})

// Other categories (dynamically from CATEGORY_GROUPS, excluding current)
const EXCLUDED_REGION_CATEGORIES = new Set<string>([])
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
const initialPage = Math.max(1, Number(route.query.page) || 1)

// ========== Waste Schedule (trash) ==========
const { getSchedules, isLoading: wasteLoading } = useWasteSchedule()
const wasteSchedules = ref<RegionSchedule[]>([])
const wasteContact = ref<{ name: string; phone?: string } | null>(null)
const wasteCurrentPage = ref(initialPage)
const wasteTotalPages = ref(1)
const wasteTotal = ref(0)

// slug → DB 풀네임 (서울특별시 등) 역매핑
const SLUG_TO_FULL_CITY = Object.entries(CITY_FULL_NAME_TO_SLUG).reduce(
  (acc, [fullName, slug]) => ({ ...acc, [slug]: fullName }),
  {} as Record<string, string>,
)

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
function syncPageQuery(page: number) {
  const nextQuery: Record<string, unknown> = { ...route.query }
  if (page > 1) nextQuery.page = String(page)
  else delete nextQuery.page
  return nextQuery
}

async function goToWastePage(page: number) {
  wasteCurrentPage.value = page
  await navigateTo({ query: syncPageQuery(page) })
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
  page,
  totalPages,
  fetchFacilities,
} = useRegionFacilities()

const currentPage = ref(initialPage)
const selectedDepartments = ref<string[]>([])

async function loadFacilities() {
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

// 초기 데이터 로드
if (isTrash.value) {
  loadWasteSchedules()
} else {
  loadFacilities()
}

// URL → 상태 동기화: 브라우저 뒤로가기/앞으로가기 혹은 query-only 네비게이션에서도
// pageQueryParam(아래 computed)과 실제 페이지 상태가 어긋나지 않도록 한다.
// goToPage 등 페이지 액션은 상태를 먼저 갱신하므로 같은 값일 때는 재조회를 스킵한다.
watch(() => route.query.page, (next) => {
  const nextPage = Math.max(1, Number(next) || 1)
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

// noindex 조건: 시설 0건(완전히 비어있는 경우) 또는 페이지 2 이상.
// 정책: noindex 일 때는 canonical 을 함께 내보내지 않는다 (.omc/notes/noindex-canonical-policy.md).
// route.query.page 변경에 reactive 하게 반응해야 client-side 페이지 이동에서도 정책이 유지된다.
const pageQueryParam = computed(() => Math.max(1, Number(route.query.page) || 1))
useHead(computed(() => {
  const isEmpty = isTrash.value
    ? (!wasteLoading.value && wasteSchedules.value.length === 0)
    : (!loading.value && facilities.value.length === 0 && !error.value)
  const isNoindex = isEmpty || pageQueryParam.value > 1
  if (isNoindex) {
    return { meta: [{ name: 'robots', content: 'noindex, follow' }] }
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
watch([facilities, currentPage, totalPages], () => {
  if (isTrash.value) return
  if (facilities.value.length > 0) {
    setItemListSchema(
      facilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = `https://ilsangkit.co.kr/${city.value}/${district.value}/${category.value}`

  if (currentPage.value > 1) {
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?page=${currentPage.value - 1}` })
  }
  if (currentPage.value < totalPages.value) {
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?page=${currentPage.value + 1}` })
  }

  useHead({ link: paginationLinks })
})

// ItemList 구조화 데이터 (trash)
watch([wasteSchedules, wasteCurrentPage, wasteTotalPages], () => {
  if (!isTrash.value) return
  if (wasteSchedules.value.length > 0) {
    setItemListSchema(
      wasteSchedules.value.map((s, index) => ({
        name: s.targetRegion,
        url: `/trash/${s.id}`,
        position: (wasteCurrentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

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
