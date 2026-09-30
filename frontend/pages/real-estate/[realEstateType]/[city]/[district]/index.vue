<template>
  <div class="bg-background-light min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" />

      <!-- Hero -->
      <PageHero
        class="exploration-page-hero"
        :title="heroTitle"
        :description="heroDescription"
        :stats="heroStats"
      />

      <SectionBlock heading="거래 유형과 지역" subtext="건물·거래 유형과 지역을 바꾸면 첫 페이지부터 표시됩니다.">
        <ExplorationFilters
          :type="realEstateType"
          :city="cityName"
          :district="districtName"
        />
        <div class="mt-4 pt-4 border-t border-line flex justify-end">
          <NuxtLink :to="mapHref" class="map-link">{{ mapLinkLabel }}</NuxtLink>
        </div>
      </SectionBlock>

      <!-- Ad: 거래 유형 토글 직후 -->
      <AdBanner />

      <!-- 결과 -->
      <template v-if="pending">
        <SectionBlock heading="건물 목록" :subtext="UI_MESSAGES.loading">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
              <div class="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div class="h-3 bg-slate-100 rounded w-full"></div>
            </div>
          </div>
        </SectionBlock>
      </template>

      <template v-else-if="fetchFailed">
        <SectionBlock heading="건물 목록">
          <div class="rounded-lg bg-red-50 px-5 py-8 text-center">
            <p class="font-semibold text-red-700">건물 목록을 불러오지 못했습니다</p>
            <p class="mt-1 text-sm text-red-600">잠시 후 다시 시도해 주세요.</p>
            <button class="retry-button" type="button" @click="retryLoad">다시 시도</button>
          </div>
        </SectionBlock>
      </template>

      <template v-else-if="renderableComplexes.length > 0">
        <p v-if="districtSummaryText" class="rounded-xl bg-white border border-slate-200 px-5 py-4 text-sm text-slate-600 leading-relaxed">
          {{ districtSummaryText }}
        </p>

        <SectionBlock
          class="exploration-list-section"
          :heading="`${districtName} ${typeLabel} 단지 목록`"
          :subtext="`서버 집계 기준 총 ${totalComplexes.toLocaleString()}곳`"
        >
          <div class="building-list">
            <ExplorationBuildingRow
              v-for="building in renderableComplexes"
              :key="building.buildingKey ?? `${building.buildingName}:${building.bjdCode}:${building.dongName}:${building.jibun ?? ''}`"
              :building="building"
              :real-estate-type="realEstateType"
              :mode="tab"
            />
          </div>
          <AdBanner class="mt-4" />
          <Pagination
            v-if="totalPages > 1"
            :current-page="currentPage"
            :total-pages="totalPages"
            :href-for="pageHref"
            class="mt-4"
            @page-change="goToPage"
          />
        </SectionBlock>
      </template>

      <template v-else>
        <SectionBlock heading="건물 목록">
          <EmptyState
            icon="apartment"
            title="이 지역에는 아직 공개 가능한 단지가 없습니다"
            description="국토교통부 실거래 신고가 누적되면 순차적으로 노출됩니다."
          >
            <div class="flex items-center justify-center gap-2">
              <NuxtLink to="/real-estate" class="btn-primary inline-flex items-center gap-1.5 text-sm min-h-[44px]">
                전국 부동산 허브로
              </NuxtLink>
              <NuxtLink :to="`/${citySlug}/${districtSlug}`" class="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
                지역 허브로
              </NuxtLink>
            </div>
          </EmptyState>
        </SectionBlock>
      </template>

      <!-- 지역 내 다른 카테고리 (교차 링크) -->
      <SectionBlock heading="이 지역의 생활 인프라">
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="cat in crossCategoryLinks"
            :key="cat.slug"
            :to="`/${citySlug}/${districtSlug}/${cat.slug}`"
            class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 transition-colors"
          >
            {{ cat.label }}
          </NuxtLink>
        </div>
      </SectionBlock>

      <DataSourceSection domain="real-estate" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { UI_MESSAGES } from '~/utils/uiMessages'
import EmptyState from '~/components/common/EmptyState.vue'
import type { ComplexInfo, RealEstatePropertyType, TransactionMode } from '~/types/realEstate'
import { KOREA_BOUNDS } from '~/types/realEstateMap'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import {
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
  type RealEstateUrlType,
} from '~/utils/realEstateUrl'
import { isValidBuildingName } from '~/utils/realEstateBuildingName'
import { PROPERTY_TYPE_META, buildReRegionDescription } from '~/utils/realEstateMeta'
import { staticOgImageUrl } from '~/utils/ogImageUrl'
import { useRealEstate } from '~/composables/useRealEstate'
import { useNationalComplexCount } from '~/composables/useNationalComplexCount'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
import { PAGINATION_ROBOTS_CONTENT, parsePositivePageQuery } from '~/utils/pageQuery'
import { buildPageHref } from '~/utils/paginationHref'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { suppressAds } from '~/composables/useAdsPolicy'
import { useRegions } from '~/composables/useRegions'
import { explorationMapHref } from '~/utils/explorationNavigation'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import ExplorationFilters from '~/components/realEstate/ExplorationFilters.vue'
import ExplorationBuildingRow from '~/components/realEstate/ExplorationBuildingRow.vue'

const route = useRoute()
const realEstateType = computed(() => route.params.realEstateType as string)
const citySlug = computed(() => route.params.city as string)
const districtSlug = computed(() => route.params.district as string)

// 유효성 검증 (realEstateType)
if (!isRealEstateUrlType(realEstateType.value)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const [propertyTypePart, tabPart] = realEstateType.value.split('-') as [
  RealEstatePropertyType,
  TransactionMode,
]

// citySlug → 한글 이름 (compact: strip 특별시/광역시/도 suffix)
const cityName = computed(() => {
  const raw = CITY_SLUG_MAP[citySlug.value]
  return raw ? raw.replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '') : raw
})
if (!cityName.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// districtSlug → 한글 이름 (역매핑)
const districtSlugToName = Object.fromEntries(
  Object.entries(DISTRICT_SLUG_MAP).map(([name, slug]) => [slug, name]),
)
const districtName = computed(() => districtSlugToName[districtSlug.value])
if (!districtName.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const propertyType = propertyTypePart
const tab = tabPart
const propertyMeta = computed(() => PROPERTY_TYPE_META[propertyType])
const typeLabel = computed(() => {
  const base = propertyMeta.value?.label ?? ''
  return tab === 'sale' ? `${base} 매매` : `${base} 전월세`
})
const typeHubPath = computed(() => `/real-estate/${realEstateType.value}`)

const heroTitle = computed(() => `${districtName.value} ${typeLabel.value} 실거래가`)
const heroDescription = computed(() =>
  buildReRegionDescription({
    cityName: cityName.value,
    districtName: districtName.value,
    typeLabel: typeLabel.value,
    count: totalComplexes.value,
    topComplexName: topComplex.value?.buildingName,
    topComplexTx: topComplex.value?.transactionCount,
  }),
)

// 데이터
const { getComplexList } = useRealEstate()
const complexes = ref<ComplexInfo[]>([])
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(true)
const clientError = ref(false)

const renderableComplexes = computed<ComplexInfo[]>(() =>
  complexes.value.filter((c) => isValidBuildingName(c.buildingName)),
)

const topComplex = computed<ComplexInfo | null>(() => renderableComplexes.value[0] ?? null)

const PAGE_SIZE = 24

// SSR 시점에 `?page=N` 을 읽어 그 페이지를 렌더한다.
// 예전에는 항상 1페이지를 가져왔다. 그래서 `?page=2` 가 1페이지와 바이트 단위로 같은
// 본문을 내보냈고, 페이지네이션을 <a href> 로 열면 같은 콘텐츠가 여러 URL 로 노출되는
// 중복이 새로 생기는 상태였다(#719 에서 부동산을 제외한 이유).
// ★ useAsyncData 키에 page 를 반드시 포함해야 한다. 키가 같으면 2페이지 요청이
//   1페이지 캐시를 그대로 돌려받아 같은 버그가 재현된다.
const initialPage = parsePositivePageQuery(route.query.page)
const { data: ssrData, error } = await useAsyncData(
  `re-region-${realEstateType.value}-${citySlug.value}-${districtSlug.value}-p${initialPage}`,
  () =>
    getComplexList(
      realEstateType.value as never,
      cityName.value,
      districtName.value,
      undefined,
      initialPage,
      PAGE_SIZE,
    ),
)
if (import.meta.server && error.value) markDegradedResponse()
if (ssrData.value) {
  complexes.value = ssrData.value.items
  totalComplexes.value = ssrData.value.total
  totalPages.value = ssrData.value.totalPages
  currentPage.value = ssrData.value.page
}
pending.value = false
const fetchFailed = computed(() => !!error.value || clientError.value)

watchEffect(() => suppressAds(fetchFailed.value || totalComplexes.value === 0))

async function loadPage(page: number) {
  pending.value = true
  clientError.value = false
  try {
    const res = await getComplexList(
      realEstateType.value as never,
      cityName.value,
      districtName.value,
      undefined,
      page,
      PAGE_SIZE,
    )
    complexes.value = res.items
    totalComplexes.value = res.total
    currentPage.value = res.page
    totalPages.value = res.totalPages
  } catch {
    clientError.value = true
  } finally {
    pending.value = false
  }
}

function retryLoad(): void {
  void loadPage(currentPage.value)
}

// URL `?page=N` 을 갱신한다. page 1 이면 page 키 자체를 제거해 canonical URL 과 동일하게 유지.
function syncPageQuery(page: number): LocationQueryRaw {
  const nextQuery: LocationQueryRaw = { ...route.query }
  if (page > 1) nextQuery.page = String(page)
  else delete nextQuery.page
  return nextQuery
}

// 페이지네이션을 <a href> 로 렌더하기 위한 URL. syncPageQuery 와 같은 의미론이어야
// 크롤러가 보는 URL 과 클릭 후 SPA 가 만드는 URL 이 일치한다.
function pageHref(page: number): string {
  return buildPageHref(route.path, route.query, page)
}

async function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  currentPage.value = page
  await navigateTo({ query: syncPageQuery(page) })
  await loadPage(page)
  if (import.meta.client) window.scrollTo({ top: 0, behavior: 'smooth' })
}

// URL → 상태 동기화. 뒤로/앞으로가기와 query-only 네비게이션에서도 어긋나지 않게 한다.
// goToPage 는 상태를 먼저 갱신하므로 같은 값이면 재조회를 건너뛴다.
watch(
  () => route.query.page,
  (next) => {
    const nextPage = parsePositivePageQuery(next)
    if (currentPage.value === nextPage) return
    currentPage.value = nextPage
    loadPage(nextPage)
  },
)

// 전국 등록 단지 수 — '이 지역'과 동일 단위(VALID_NAME 단지 수) 비교용.
// fail-open 컴포저블: 실패 시 total=null → 셀 부재만, shouldNoindexSsr(아래)에는 절대 연결하지 않는다.
const { total: nationalComplexes } = useNationalComplexCount(realEstateType)

const heroStats = computed(() => {
  const items = [] as { label: string; value: string }[]
  if (totalComplexes.value > 0) items.push({ label: '이 지역', value: `${totalComplexes.value.toLocaleString()}곳` })
  const nat = nationalComplexes.value
  if (typeof nat === 'number' && nat > 0) items.push({ label: '전국 등록', value: `${nat.toLocaleString('ko-KR')}곳` })
  items.push({ label: '데이터 출처', value: '국토교통부' })
  return items
})

const districtSummaryText = computed(() => {
  const count = totalComplexes.value || renderableComplexes.value.length
  if (count === 0) return ''
  const top = topComplex.value
  const parts: string[] = [
    `${districtName.value} ${typeLabel.value} 실거래가를 확인할 수 있는 단지는 총 ${count.toLocaleString()}곳입니다.`,
  ]
  if (top) {
    parts.push(`거래가 가장 활발한 단지는 ${top.buildingName}(${top.transactionCount.toLocaleString()}건)입니다.`)
  }
  parts.push('국토교통부 실거래가 공개시스템 기반 데이터입니다.')
  return parts.join(' ')
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: typeLabel.value, href: typeHubPath.value, current: false },
  { label: cityName.value, href: `/real-estate/${realEstateType.value}/${citySlug.value}`, current: false },
  { label: districtName.value, current: true },
])

// 구/군 좌표는 지역 메타 API의 실제 좌표만 사용한다. 준비 실패 시 전국 지도 fallback이며,
// 이 보조 요청의 실패는 위 건물 목록의 오류 상태로 전파하지 않는다.
const { loadRegions, syncFromHydration, findRegionBySlug } = useRegions()
const { data: loadedRegions } = await useAsyncData(
  `re-region-map-center-${citySlug.value}-${districtSlug.value}`,
  () => loadRegions(),
  { default: () => [] },
)
syncFromHydration(loadedRegions)
const districtMapCenter = computed(() => {
  const region = findRegionBySlug(citySlug.value, districtSlug.value)
  if (
    !region
    || !Number.isFinite(region.lat)
    || !Number.isFinite(region.lng)
    || region.lat < KOREA_BOUNDS.LAT_MIN
    || region.lat > KOREA_BOUNDS.LAT_MAX
    || region.lng < KOREA_BOUNDS.LNG_MIN
    || region.lng > KOREA_BOUNDS.LNG_MAX
  ) return null
  return { lat: region.lat, lng: region.lng, level: 7 }
})
const mapHref = computed(() =>
  explorationMapHref(realEstateType.value as RealEstateUrlType, districtMapCenter.value),
)
const mapLinkLabel = computed(() =>
  districtMapCenter.value ? `${cityName.value} ${districtName.value} 지도에서 보기` : '전국 지도에서 보기',
)

const crossCategoryLinks = [
  { slug: 'hospital', label: '병원' },
  { slug: 'school', label: '학교' },
  { slug: 'park', label: '공원' },
  { slug: 'pharmacy', label: '약국' },
  { slug: 'library', label: '도서관' },
  { slug: 'parking', label: '주차장' },
]

// SEO
const canonicalPath = computed(() =>
  toRealEstateListUrl({
    type: realEstateType.value as never,
    city: cityName.value,
    district: districtName.value,
  }),
)

const { setMeta } = useFacilityMeta()

// page 2+ 는 thin/중복 방지를 위해 noindex 하고 canonical 도 함께 제거한다(정책 통일).
// route.query.page 에 reactive 로 연동해야 client-side 페이지 이동에서도 정책이 켜진다.
const pageQueryParam = computed(() => parsePositivePageQuery(route.query.page))

watch(
  [cityName, districtName, typeLabel, totalComplexes, complexes, pageQueryParam],
  () => {
    const isNoindex =
      shouldNoindexSsr({
        fetchFailed: fetchFailed.value,
        confirmedEmpty: !fetchFailed.value && totalComplexes.value === 0,
      }) || pageQueryParam.value > 1
    // 지역 허브는 대표 좌표가 없다 — 동적 `/og?...` 는 프로덕션에서 100% 302 이므로
    // 최종 도착지(정적 PNG)를 그대로 쓴다. utils/ogImageUrl.ts 주석 참고.
    const ogImage = staticOgImageUrl()
    if (isNoindex) {
      useHead({ meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] })
    }
    setMeta({
      title: `${cityName.value} ${districtName.value} ${typeLabel.value} 실거래가`,
      description: heroDescription.value,
      path: canonicalPath.value,
      image: ogImage,
      canonical: isNoindex ? false : undefined,
    })
  },
  { immediate: true },
)

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: typeLabel.value, url: typeHubPath.value },
  { name: cityName.value, url: `/real-estate/${realEstateType.value}/${citySlug.value}` },
  { name: districtName.value, url: canonicalPath.value },
])

watch(
  complexes,
  (list) => {
    if (list.length > 0) {
      setItemListSchema(
        list.slice(0, 20).map((c) => ({
          name: c.buildingName,
          url: toRealEstateUrl({
            type: realEstateType.value as never,
            city: cityName.value,
            district: districtName.value,
            buildingName: c.buildingName,
            buildingKey: c.buildingKey,
            canonicalPath: c.canonicalPath,
          }),
        })),
      )
    } else {
      setItemListSchema([{ name: `${districtName.value} ${typeLabel.value}`, url: canonicalPath.value }])
    }
  },
  { immediate: true },
)
</script>

<style scoped>
.exploration-page-hero,
.exploration-list-section {
  border-radius: 0;
  border-right: 0;
  border-left: 0;
  box-shadow: none;
}

.exploration-page-hero :deep(h1) {
  font-size: 27px;
}

@media (min-width: 768px) {
  .exploration-page-hero :deep(h1) {
    font-size: 36px;
  }
}

.map-link,
.retry-button {
  display: inline-flex;
  min-height: 44px;
  align-items: center;
  justify-content: center;
  font-size: 0.875rem;
  font-weight: 700;
}

.map-link {
  color: #2450dc;
  text-decoration: none;
}

.retry-button {
  margin-top: 1rem;
  border-radius: 0.5rem;
  background: #2450dc;
  padding: 0.5rem 1rem;
  color: #fff;
}

.map-link:focus-visible,
.retry-button:focus-visible {
  outline: 2px solid #2450dc;
  outline-offset: 2px;
}

.building-list {
  border-top: 1px solid #e6e9f0;
}
</style>
