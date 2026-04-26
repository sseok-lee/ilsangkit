<template>
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Hero -->
    <PageHero
      eyebrow="부동산 목록"
      :title="`${propertyMeta?.label ?? ''} 실거래가`"
      :description="propertyDescription"
      :stats="heroStats"
    />

    <!-- 거래 유형과 지역 -->
    <SectionBlock heading="거래 유형과 지역" subtext="매매/전월세 탭과 시·도·구·군·단지명을 선택하세요.">
      <TransactionModeTab v-model="currentTab" class="mb-3" />
      <RealEstateSearchFilter :type="apiSlug" @search="handleSearch" />
    </SectionBlock>

    <!-- 결과 -->
    <template v-if="pending">
      <SectionBlock heading="건물 목록" subtext="지역 선택 후 결과가 표시됩니다.">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
            <div class="flex gap-3">
              <div class="shrink-0 w-10 h-10 rounded-lg bg-slate-200"></div>
              <div class="flex-1 space-y-2">
                <div class="h-4 bg-slate-200 rounded w-2/3"></div>
                <div class="h-3 bg-slate-100 rounded w-full"></div>
                <div class="flex items-center justify-between mt-1">
                  <div class="h-5 bg-slate-200 rounded w-24"></div>
                  <div class="h-5 bg-slate-100 rounded-md w-12"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SectionBlock>
    </template>

    <template v-else-if="error">
      <SectionBlock heading="건물 목록">
        <div class="rounded-xl bg-red-50 p-8 text-center">
          <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
          </div>
          <p class="text-red-700 font-semibold">데이터를 불러오는 중 오류가 발생했습니다</p>
          <p class="text-red-500 text-sm mt-1">잠시 후 다시 시도해주세요</p>
          <button
            class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
            @click="retryLoad"
          >
            <span class="material-symbols-outlined text-[16px]">refresh</span>
            다시 시도
          </button>
        </div>
      </SectionBlock>
    </template>

    <template v-else-if="renderableComplexes.length > 0">
      <SectionBlock heading="건물 목록" subtext="최근 거래가 있는 건물부터 확인하세요.">
        <template #right>
          <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {{ totalComplexes.toLocaleString() }}건
          </span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplexCard
            v-for="complex in renderableComplexes"
            :key="`${complex.buildingName}-${complex.bjdCode}`"
            :complex="complex"
            :property-type="propertyTypeParam"
            :tab="currentTab"
          />
        </div>
        <!-- Ad: 건물 목록 이후 -->
        <AdBanner class="mt-4" />
        <!-- 페이지네이션 -->
        <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
      </SectionBlock>
    </template>

    <template v-else>
      <SectionBlock heading="건물 목록">
        <div class="rounded-xl bg-slate-50 p-12 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-card">
            <img :src="`/icons/category/${propertyMeta?.iconImg || 'apt'}.webp?v2`" :alt="propertyMeta?.label || '부동산'" class="w-10 h-10" width="40" height="40" />
          </div>
          <p class="text-slate-700 font-semibold text-lg">지역을 선택해주세요</p>
          <p class="text-slate-500 text-sm mt-1">시/도와 구/군을 선택하면 거래 내역을 확인할 수 있습니다</p>
        </div>
      </SectionBlock>
    </template>

    <!-- 지역 생활 인프라 (검색 후에만 노출) -->
    <SectionBlock
      v-if="facilityStats || facilityLoading"
      heading="지역 생활 인프라"
      :subtext="lastSearch?.district || lastSearch?.city ? `${lastSearch?.district || lastSearch?.city} 주변 시설 밀집도` : '부동산 판단에 필요한 주변 인프라를 확인하세요.'"
    >
      <div v-if="facilityLoading" class="flex justify-center py-6">
        <div class="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
      <div v-else-if="facilityStats">
        <div class="flex flex-wrap gap-2">
          <NuxtLink
            v-for="(count, cat) in topFacilityCategories"
            :key="cat"
            :to="`/${cat}`"
            class="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 transition-all"
          >
            <span class="material-symbols-outlined text-[16px] text-primary">{{ CATEGORY_META[cat as keyof typeof CATEGORY_META]?.icon }}</span>
            <span>{{ CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label }}</span>
            <span class="font-bold">{{ count }}곳</span>
          </NuxtLink>
        </div>
        <p class="mt-3 text-xs text-slate-500">총 {{ facilityStats.total.toLocaleString() }}개 시설</p>
      </div>
    </SectionBlock>

    <!-- Ad: FAQ 전 -->
    <AdBanner />

    <!-- FAQ -->
    <SectionBlock v-if="faqs.length > 0" heading="자주 묻는 질문">
      <div class="space-y-1">
        <details
          v-for="(faq, i) in faqs"
          :key="i"
          class="group border-b border-line last:border-b-0"
        >
          <summary class="cursor-pointer py-3 text-base font-medium text-slate-800 flex items-center justify-between hover:text-primary">
            {{ faq.q }}
            <span class="material-symbols-outlined text-[18px] text-slate-500 group-open:rotate-180 transition-transform">expand_more</span>
          </summary>
          <p class="pb-3 text-sm text-slate-600 leading-relaxed">{{ faq.a }}</p>
        </details>
      </div>
    </SectionBlock>

    <!-- 데이터 출처 -->
    <section>
      <DataSourceCard :source="REAL_ESTATE_DATA_SOURCE" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { RealEstatePropertyType, TransactionMode, ComplexInfo, ComplexListResponse } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { toRealEstateUrl } from '~/utils/realEstateUrl'
import { PROPERTY_TYPE_META, PROPERTY_TYPE_FAQ, PROPERTY_TYPE_DESCRIPTIONS } from '~/utils/realEstateMeta'
import { isValidBuildingName } from '~/utils/realEstateBuildingName'
import { toRealEstateUrl } from '~/utils/realEstateUrl'
import { CATEGORY_META } from '~/types/facility'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useRealEstate } from '~/composables/useRealEstate'
import { useStructuredData } from '~/composables/useStructuredData'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

const route = useRoute()
const router = useRouter()

const propertyTypeParam = computed(() => route.params.propertyType as RealEstatePropertyType)

// 유효하지 않은 propertyType이면 404
if (!PROPERTY_TYPES.includes(propertyTypeParam.value as RealEstatePropertyType)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const currentTab = computed<TransactionMode>({
  get: () => (route.query.tab === 'rent' ? 'rent' : 'sale'),
  set: (val) => {
    router.replace({ query: { ...route.query, tab: val } })
  },
})

const apiSlug = computed(() => toApiSlug(propertyTypeParam.value, currentTab.value))
const propertyMeta = computed(() => PROPERTY_TYPE_META[propertyTypeParam.value])
const propertyDescription = computed(() => PROPERTY_TYPE_DESCRIPTIONS[propertyTypeParam.value])
const faqs = computed(() => PROPERTY_TYPE_FAQ[propertyTypeParam.value] || [])

const { getComplexList } = useRealEstate()

const complexes = ref<ComplexInfo[]>([])
// 렌더링 단계에서 invalid buildingName / thin transaction 건을 추가로 걸러낸다.
// (API에서 이미 필터링된 결과여도 SSR 레이어에서 방어적으로 한 번 더 검증)
const renderableComplexes = computed<ComplexInfo[]>(() =>
  complexes.value.filter(
    (c) => isValidBuildingName(c.buildingName) && c.transactionCount >= 10,
  ),
)
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(true)
const error = ref(false)
const lastSearch = ref<{ city: string; district: string; buildingName: string } | null>(null)

// SSR: 초기 건물 목록을 서버에서 로드
const { data: initialData } = await useAsyncData(
  `re-complexes-${apiSlug.value}`,
  () => getComplexList(apiSlug.value),
)
if (initialData.value) {
  complexes.value = initialData.value.items
  totalComplexes.value = initialData.value.total
  totalPages.value = initialData.value.totalPages
  currentPage.value = initialData.value.page
}
pending.value = false

// SEO 메타
const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')
useHead(() => {
  const tab = tabLabel.value
  const propertyLabel = propertyMeta.value?.label || ''
  const title = `${propertyLabel} ${tab} 실거래가 | 일상킷`
  const description = `전국 ${propertyLabel} ${tab} 실거래가와 시세, 최근 거래 내역을 확인하세요.`
  const canonicalUrl = `${SITE_URL}/real-estate/${propertyTypeParam.value}`
  const meta: Array<{ name?: string; property?: string; content: string }> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
  ]
  // 페이지 2 이상은 noindex (thin content 방지). 정책상 canonical 도 함께 제거
  // (.omc/notes/noindex-canonical-policy.md).
  const isNoindex = currentPage.value > 1
  if (isNoindex) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }
  return {
    title,
    meta,
    link: isNoindex ? [] : [{ rel: 'canonical', href: canonicalUrl }],
  }
})

// JSON-LD
useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${propertyMeta.value?.label} ${tabLabel.value} 실거래가`,
        description: propertyDescription.value,
      }),
    },
  ],
}))

const paginationRange = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const delta = 2
  const range: number[] = []
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i)
  }
  return range
})

async function handleSearch(params: { city: string; district: string; buildingName: string }) {
  if (!params.city && !params.district && !params.buildingName) return
  lastSearch.value = params
  currentPage.value = 1

  // 건물 목록 + 시설 요약을 병렬로 요청
  const complexPromise = loadComplexes(params.city || undefined, params.district || undefined, params.buildingName || undefined)
  const facilityPromise = params.city
    ? fetchFacilitySummary(params.city, params.district || undefined)
    : Promise.resolve()
  await Promise.all([complexPromise, facilityPromise])
}

async function loadComplexes(city?: string, district?: string, buildingName?: string, page: number = 1) {
  pending.value = true
  error.value = false
  try {
    const result = await getComplexList(apiSlug.value, city, district, buildingName, page)
    complexes.value = result.items
    totalComplexes.value = result.total
    currentPage.value = result.page
    totalPages.value = result.totalPages
  } catch {
    error.value = true
  } finally {
    pending.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  const s = lastSearch.value
  loadComplexes(s?.city || undefined, s?.district || undefined, s?.buildingName || undefined, page)
}

function retryLoad() {
  const s = lastSearch.value
  loadComplexes(s?.city || undefined, s?.district || undefined, s?.buildingName || undefined, currentPage.value)
}

// 탭 전환 시 SSR 데이터와 다른 탭이면 재로드 (클라이언트)
if (import.meta.client && !initialData.value) {
  loadComplexes()
}

// 탭 전환 시 마지막 검색 조건으로 재로드
watch(currentTab, () => {
  if (lastSearch.value) {
    loadComplexes(lastSearch.value.city || undefined, lastSearch.value.district || undefined, lastSearch.value.buildingName || undefined)
  } else {
    loadComplexes()
  }
})

// 지역 시설 밀집도
const facilityStats = ref<{ categories: Record<string, number>; total: number; topCategories: string[] } | null>(null)
const facilityLoading = ref(false)

async function fetchFacilitySummary(city: string, district?: string) {
  facilityLoading.value = true
  try {
    const res = await $fetch<any>('/api/meta/region-facilities-summary', {
      params: { city, district },
    })
    facilityStats.value = res?.data ?? null
  } catch {
    facilityStats.value = null
  } finally {
    facilityLoading.value = false
  }
}

// Breadcrumb + ItemList JSON-LD
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산', url: '/real-estate' },
  { name: propertyMeta.value?.label ?? propertyTypeParam.value, url: `/real-estate/${propertyTypeParam.value}` },
])

watch(
  complexes,
  (list) => {
    if (list.length > 0) {
      setItemListSchema(
        list.slice(0, 20).map((c) => ({
          name: c.buildingName,
          url: toRealEstateUrl({
            type: apiSlug.value as never,
            city: c.city,
            district: c.district,
            buildingName: c.buildingName,
          }),
        })),
      )
    } else {
      setItemListSchema([{ name: propertyMeta.value?.label ?? propertyTypeParam.value, url: `/real-estate/${propertyTypeParam.value}` }])
    }
  },
  { immediate: true },
)

// Breadcrumb + hero stats
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산', href: '/real-estate', current: false },
  { label: propertyMeta.value?.label ?? propertyTypeParam.value, href: `/real-estate/${propertyTypeParam.value}`, current: true },
])

const heroStats = computed(() => {
  const stats: { label: string; value: string }[] = []
  if (totalComplexes.value > 0) {
    stats.push({ label: `${propertyMeta.value?.label ?? ''} 거래`, value: `${totalComplexes.value.toLocaleString('ko-KR')}건` })
  }
  stats.push({ label: '보기 방식', value: '매매 / 전월세' })
  stats.push({ label: '함께 보기', value: '지역 생활 인프라' })
  return stats
})

const topFacilityCategories = computed(() => {
  if (!facilityStats.value) return {}
  const cats = facilityStats.value.categories
  return Object.fromEntries(
    Object.entries(cats)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
  )
})
</script>
