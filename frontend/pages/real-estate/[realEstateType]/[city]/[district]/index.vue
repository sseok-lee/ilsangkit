<template>
  <div class="bg-background-light min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" />

      <!-- Hero -->
      <PageHero
        eyebrow="부동산 지역 허브"
        :title="heroTitle"
        :description="heroDescription"
        :stats="heroStats"
      />

      <!-- 거래 유형 토글 (매매 ↔ 전월세) -->
      <SectionBlock heading="거래 유형" subtext="같은 지역에서 매매 시세와 전월세 시세를 바로 비교해 보세요.">
        <div class="flex items-center gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <NuxtLink
            v-for="t in tabOptions"
            :key="t.type"
            :to="t.url"
            :class="[
              'rounded-md px-4 py-1.5 text-sm font-medium transition-colors',
              t.type === realEstateType
                ? 'bg-white text-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-700',
            ]"
          >{{ t.label }}</NuxtLink>
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

      <template v-else-if="renderableComplexes.length > 0">
        <p v-if="districtSummaryText" class="rounded-xl bg-white border border-slate-200 px-5 py-4 text-sm text-slate-600 leading-relaxed">
          {{ districtSummaryText }}
        </p>

        <SectionBlock
          :heading="`${districtName} ${typeLabel} 단지 목록`"
          :subtext="`유효 단지만 노출. 총 ${totalComplexes.toLocaleString()}곳`"
        >
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <ComplexCard
              v-for="complex in renderableComplexes"
              :key="`${complex.buildingName}-${complex.bjdCode}`"
              :complex="complex"
              :property-type="propertyType"
              :tab="tab"
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
          >{{ cat.label }}</NuxtLink>
        </div>
      </SectionBlock>

      <DataSourceSection domain="real-estate" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 전역 TrustLine 억제 — 이 페이지는 자체 데이터 출처 카드를 렌더한다 (#766)
definePageMeta({ hasSourceCard: true })

import { ref, computed, watch, watchEffect } from 'vue'
import type { LocationQueryRaw } from 'vue-router'
import { formatKoreanPrice } from '~/utils/formatters'
import { UI_MESSAGES } from '~/utils/uiMessages'
import EmptyState from '~/components/common/EmptyState.vue'
import type { ComplexInfo, RealEstatePropertyType, TransactionMode } from '~/types/realEstate'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import {
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
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
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const route = useRoute()
const router = useRouter()

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
// meta description 은 데이터 로드 후의 topComplex/avgLatestPrice 를 참조한다 (아래에서 정의).
// computed 는 setMeta watch(immediate) 시점(=데이터 세팅 이후)에 평가되므로 참조 순서 문제 없음.
const heroDescription = computed(() =>
  buildReRegionDescription({
    cityName: cityName.value,
    districtName: districtName.value,
    typeLabel: typeLabel.value,
    count: totalComplexes.value,
    topComplexName: topComplex.value?.buildingName,
    topComplexTx: topComplex.value?.transactionCount,
    avgPriceText: avgLatestPrice.value != null ? formatKoreanPrice(avgLatestPrice.value) : undefined,
  }),
)

// 데이터
const { getComplexList } = useRealEstate()
const complexes = ref<ComplexInfo[]>([])
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(true)

const renderableComplexes = computed<ComplexInfo[]>(() =>
  complexes.value.filter((c) => isValidBuildingName(c.buildingName)),
)

// 대표 단지(거래 활발 상위) 및 상위 단지 평균 시세 — meta description·요약 문단이 공유한다.
const topComplex = computed<ComplexInfo | null>(() => renderableComplexes.value[0] ?? null)
const avgLatestPrice = computed<number | null>(() => {
  const withPrice = renderableComplexes.value.filter((c) => c.latestPrice !== null && c.latestPrice > 0)
  return withPrice.length > 0
    ? Math.round(withPrice.reduce((sum, c) => sum + (c.latestPrice as number), 0) / withPrice.length)
    : null
})

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
const fetchFailed = computed(() => !!error.value)

watchEffect(() => suppressAds(fetchFailed.value || totalComplexes.value === 0))

async function loadPage(page: number) {
  pending.value = true
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
    currentPage.value = res.page
    totalPages.value = res.totalPages
  } finally {
    pending.value = false
  }
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
  const avgPrice = avgLatestPrice.value
  const top = topComplex.value
  const parts: string[] = [
    `${districtName.value} ${typeLabel.value} 실거래가를 확인할 수 있는 단지는 총 ${count.toLocaleString()}곳입니다.`,
  ]
  if (top) {
    parts.push(`거래가 가장 활발한 단지는 ${top.buildingName}(${top.transactionCount.toLocaleString()}건)입니다.`)
  }
  if (avgPrice) {
    parts.push(`상위 단지 최근 평균 시세는 약 ${formatKoreanPrice(avgPrice)}이며, 국토교통부 실거래가 공개시스템 기반 데이터입니다.`)
  } else {
    parts.push('국토교통부 실거래가 공개시스템 기반 데이터입니다.')
  }
  return parts.join(' ')
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: typeLabel.value, href: typeHubPath.value, current: false },
  { label: cityName.value, href: `/real-estate/${realEstateType.value}/${citySlug.value}`, current: false },
  { label: districtName.value, current: true },
])

const tabOptions = computed(() => [
  {
    type: `${propertyType}-sale`,
    label: '매매',
    url: toRealEstateListUrl({
      type: `${propertyType}-sale` as never,
      city: cityName.value,
      district: districtName.value,
    }),
  },
  {
    type: `${propertyType}-rent`,
    label: '전월세',
    url: toRealEstateListUrl({
      type: `${propertyType}-rent` as never,
      city: cityName.value,
      district: districtName.value,
    }),
  },
])

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
