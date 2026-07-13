<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue'
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
import { SITE_URL } from '~/utils/seoConstants'
import { useRealEstate } from '~/composables/useRealEstate'
import { useNationalComplexCount } from '~/composables/useNationalComplexCount'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { shouldNoindexSsr } from '~/utils/ssrIndexability'
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

const { data: ssrData, error } = await useAsyncData(
  `re-region-${realEstateType.value}-${citySlug.value}-${districtSlug.value}`,
  () => getComplexList(realEstateType.value as never, cityName.value, districtName.value, undefined, 1, 24),
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

async function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  pending.value = true
  try {
    const res = await getComplexList(
      realEstateType.value as never,
      cityName.value,
      districtName.value,
      undefined,
      page,
      24,
    )
    complexes.value = res.items
    currentPage.value = res.page
    totalPages.value = res.totalPages
  } finally {
    pending.value = false
  }
}

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

watch(
  [cityName, districtName, typeLabel, totalComplexes, complexes],
  () => {
    const isNoindex = shouldNoindexSsr({
      fetchFailed: fetchFailed.value,
      confirmedEmpty: !fetchFailed.value && totalComplexes.value === 0,
    })
    const ogImage = `${SITE_URL}/og?category=${propertyType}&city=${encodeURIComponent(cityName.value)}&district=${encodeURIComponent(districtName.value)}&title=${encodeURIComponent(`${cityName.value} ${districtName.value} ${typeLabel.value} 실거래가`)}`
    if (isNoindex) {
      useHead({ meta: [{ name: 'robots', content: 'noindex, follow' }] })
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
