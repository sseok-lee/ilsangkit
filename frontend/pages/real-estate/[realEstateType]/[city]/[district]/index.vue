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

      <AdBanner class="mt-2 mb-4" />

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

      <!-- 결과 -->
      <template v-if="pending">
        <SectionBlock heading="건물 목록" subtext="불러오는 중입니다.">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
              <div class="h-4 bg-slate-200 rounded w-2/3 mb-2"></div>
              <div class="h-3 bg-slate-100 rounded w-full"></div>
            </div>
          </div>
        </SectionBlock>
      </template>

      <template v-else-if="renderableComplexes.length > 0">
        <SectionBlock
          :heading="`${districtName} ${typeLabel} 단지 목록`"
          :subtext="`거래 10건 이상 유효 단지만 노출. 총 ${renderableComplexes.length.toLocaleString()}곳`"
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
          <div class="rounded-xl bg-slate-50 p-12 text-center">
            <p class="text-slate-700 font-semibold text-lg">이 지역에는 아직 공개 가능한 단지가 없습니다</p>
            <p class="text-slate-500 text-sm mt-1">국토교통부 실거래 신고가 누적되면 순차적으로 노출됩니다.</p>
            <div class="mt-4 flex items-center justify-center gap-2">
              <NuxtLink to="/real-estate" class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-dark">
                전국 부동산 허브로
              </NuxtLink>
              <NuxtLink :to="`/${citySlug}/${districtSlug}`" class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200">
                지역 허브로
              </NuxtLink>
            </div>
          </div>
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
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ComplexInfo, RealEstatePropertyType, TransactionMode } from '~/types/realEstate'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import {
  isRealEstateUrlType,
  toRealEstateUrl,
  toRealEstateListUrl,
} from '~/utils/realEstateUrl'
import { isValidBuildingName } from '~/utils/realEstateBuildingName'
import { PROPERTY_TYPE_META } from '~/utils/realEstateMeta'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useRealEstate } from '~/composables/useRealEstate'
import { useStructuredData } from '~/composables/useStructuredData'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

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

// citySlug → 한글 이름
const cityName = computed(() => CITY_SLUG_MAP[citySlug.value])
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

const heroTitle = computed(() => `${districtName.value} ${typeLabel.value} 실거래가`)
const heroDescription = computed(
  () =>
    `${cityName.value} ${districtName.value} ${typeLabel.value} 거래 10건 이상 유효 단지만 선별해 노출합니다. 국토교통부 공식 데이터 기반.`,
)

// 데이터
const { getComplexList } = useRealEstate()
const complexes = ref<ComplexInfo[]>([])
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(true)

const renderableComplexes = computed<ComplexInfo[]>(() =>
  complexes.value.filter(
    (c) => isValidBuildingName(c.buildingName) && c.transactionCount >= 10,
  ),
)

const { data: ssrData } = await useAsyncData(
  `re-region-${realEstateType.value}-${citySlug.value}-${districtSlug.value}`,
  () => getComplexList(realEstateType.value as never, cityName.value, districtName.value, undefined, 1, 24),
)
if (ssrData.value) {
  complexes.value = ssrData.value.items
  totalComplexes.value = ssrData.value.total
  totalPages.value = ssrData.value.totalPages
  currentPage.value = ssrData.value.page
}
pending.value = false

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

const heroStats = computed(() => {
  const items = [] as { label: string; value: string }[]
  items.push({ label: '유효 단지', value: `${renderableComplexes.value.length.toLocaleString()}곳` })
  if (totalComplexes.value > 0) items.push({ label: '전체 단지', value: `${totalComplexes.value.toLocaleString()}곳` })
  items.push({ label: '거래 기준', value: '10건 이상' })
  return items
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산', href: '/real-estate', current: false },
  { label: typeLabel.value, href: `/real-estate/${realEstateType.value}`, current: false },
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
const canonicalUrl = computed(() => `${SITE_URL}${canonicalPath.value}`)

useHead(() => {
  const title = `${cityName.value} ${districtName.value} ${typeLabel.value} 실거래가 | 일상킷`
  const description = heroDescription.value
  const ogImage = `${SITE_URL}/og?category=${propertyType}&city=${encodeURIComponent(cityName.value)}&district=${encodeURIComponent(districtName.value)}&title=${encodeURIComponent(title)}`
  const isNoindex = renderableComplexes.value.length === 0
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: ogImage },
      { property: 'og:url', content: canonicalUrl.value },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image', content: ogImage },
      ...(isNoindex ? [{ name: 'robots', content: 'noindex, follow' }] : []),
    ],
    link: isNoindex ? [] : [{ rel: 'canonical', href: canonicalUrl.value }],
  }
})

const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산', url: '/real-estate' },
  { name: `${cityName.value} ${districtName.value}`, url: canonicalPath.value },
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
