<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <!-- Breadcrumb -->
      <Breadcrumb :items="breadcrumbItems" />

      <!-- Hero -->
      <PageHero
        eyebrow="생활시설 목록"
        :title="pageTitle"
        :description="pageDescription"
        :stats="heroStats"
      />

      <!-- Error -->
      <div v-if="error" role="alert" class="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        지하철역 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>

      <!-- 지역과 키워드 필터 -->
      <SectionBlock heading="지역과 키워드" subtext="지역을 먼저 선택하면 정확한 목록을 빠르게 찾을 수 있어요.">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div class="relative">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">시/도</label>
            <select
              v-model="selectedCitySlug"
              aria-label="시/도 선택"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">시/도 선택</option>
              <option v-for="c in cityOptions" :key="c.slug" :value="c.slug">{{ c.name }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-2.5 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
          </div>
          <div class="relative">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">구/군</label>
            <select
              v-model="selectedDistrict"
              :disabled="!selectedCitySlug"
              aria-label="구/군 선택"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 px-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">구/군 선택</option>
              <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-2.5 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
          </div>
          <div class="relative">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">키워드</label>
            <div class="absolute left-3 bottom-2.5 pointer-events-none">
              <span class="material-symbols-outlined text-slate-500 text-[18px]">search</span>
            </div>
            <input
              v-model="keyword"
              class="w-full bg-slate-50 border border-line rounded-lg py-2.5 pl-9 pr-3 text-slate-900 text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              type="search"
              placeholder="역 이름 검색 (예: 강남)"
            />
          </div>
        </div>
      </SectionBlock>

      <!-- Ad -->
      <AdBanner />

      <!-- 결과 목록 -->
      <SectionBlock :heading="`${resultTitle} 지하철역 목록`" subtext="환승역은 1건으로 묶여 노선 배지로 표시됩니다.">
        <template #right>
          <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {{ (stations?.total ?? 0).toLocaleString('ko-KR') }}건
          </span>
        </template>

        <!-- Loading Skeleton -->
        <div v-if="pending" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
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

        <template v-else>
          <!-- Card Grid (FacilityCard 재사용) -->
          <div v-if="facilities.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FacilityCard v-for="f in facilities" :key="f.id" :facility="f" />
          </div>

          <!-- Empty -->
          <div v-else class="py-12 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-[32px] text-slate-500">subway</span>
            </div>
            <p class="text-slate-700 font-semibold text-lg">검색 결과가 없습니다</p>
            <p class="text-slate-500 text-sm mt-1 mb-6">다른 지역이나 검색어를 시도해보세요</p>
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="selectedCitySlug || selectedDistrict || keyword"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="resetFilters"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                필터 초기화
              </button>
              <NuxtLink to="/" class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors">
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </div>

          <!-- Pagination -->
          <Pagination v-if="totalPages > 1" :current-page="page" :total-pages="totalPages" @page-change="(p) => (page = p)" />
        </template>
      </SectionBlock>

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
            :to="`/${region.citySlug}/${region.districtSlug}/subway`"
            class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
          >
            {{ region.label }} 지하철역
          </NuxtLink>
        </div>
      </SectionBlock>

      <!-- FAQ -->
      <SectionBlock v-if="faqItems.length > 0" heading="자주 묻는 질문">
        <div class="space-y-1">
          <details v-for="(faq, i) in faqItems" :key="i" class="border-b border-line last:border-b-0">
            <summary class="py-3 cursor-pointer font-medium text-slate-800 hover:text-primary">
              {{ faq.question }}
            </summary>
            <p class="pb-3 text-slate-600 text-sm leading-relaxed">{{ faq.answer }}</p>
          </details>
        </div>
      </SectionBlock>

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
import { computed, ref, watch } from 'vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import CoupangBanner from '~/components/ads/CoupangBanner.vue'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import Pagination from '~/components/common/Pagination.vue'
import FacilityCard from '~/components/facility/FacilityCard.vue'
import { useRegions } from '~/composables/useRegions'
import { CITY_SLUGS } from '~/shared/regionSlugs'
import { SITE_URL, POPULAR_REGIONS, RELATED_CATEGORIES } from '~/utils/seoConstants'
import { CATEGORY_META } from '~/types/facility'
import type { Facility, FacilityCategory } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'
import { FACILITY_DATA_SOURCE } from '~/utils/dataSource'

interface SubwayStationGroup {
  id: string
  sourceId: string
  name: string
  nameSlug: string
  primaryLine: string
  lines: string[]
  operator: string | null
  lat: number
  lng: number
  address: string | null
  roadAddress: string | null
  city: string | null
  district: string | null
  regionSlug: string | null
  phoneNumber: string | null
  dataDate: string | null
  updatedAt: string
}

interface ListResponse {
  items: SubwayStationGroup[]
  total: number
  page: number
  limit: number
}

const config = useRuntimeConfig()
const apiBase = config.public.apiBase

const route = useRoute()
const router = useRouter()

const selectedCitySlug = ref(typeof route.query.city === 'string' ? route.query.city : '')
const selectedDistrict = ref(typeof route.query.district === 'string' ? route.query.district : '')
const keyword = ref(typeof route.query.keyword === 'string' ? route.query.keyword : '')
const page = ref(parseInt(typeof route.query.page === 'string' ? route.query.page : '1', 10) || 1)
const limit = 24

const { loadRegions, getDistrictsByCity } = useRegions()
await useAsyncData('subway-regions', () => loadRegions())

const cityOptions = computed(() =>
  Object.entries(CITY_SLUGS).map(([name, slug]) => ({ slug, name })),
)

const districtOptions = computed(() => {
  if (!selectedCitySlug.value) return []
  return getDistrictsByCity(selectedCitySlug.value).map((d) => d.name)
})

const queryParams = computed(() => {
  const p = new URLSearchParams()
  p.set('grouped', 'true')
  p.set('page', String(page.value))
  p.set('limit', String(limit))
  if (selectedCitySlug.value) p.set('city', selectedCitySlug.value)
  if (selectedDistrict.value) p.set('district', selectedDistrict.value)
  if (keyword.value.trim()) p.set('keyword', keyword.value.trim())
  return p.toString()
})

const { data: stations, pending, error } = await useAsyncData<ListResponse>(
  'subway-list',
  () => $fetch<{ success: boolean; data: ListResponse }>(`${apiBase}/api/subway/stations?${queryParams.value}`).then((r) => r.data),
  { watch: [queryParams] },
)

// CSV에 "가산디지털단지" / "가산디지털단지역" 같이 끝 "역" 유무가 혼재 — 항상 "역" 1개 보장
function withStationSuffix(name: string): string {
  const base = name.replace(/역$/, '').trim()
  return base ? `${base}역` : ''
}

// SubwayStationGroup → Facility 매핑 (FacilityCard 재사용용)
const facilities = computed<Facility[]>(() => {
  if (!stations.value) return []
  return stations.value.items.map((g) => ({
    id: g.nameSlug,
    name: withStationSuffix(g.name),
    category: 'subway',
    address: g.address,
    roadAddress: g.roadAddress,
    lat: g.lat,
    lng: g.lng,
    city: g.city ?? '',
    district: g.district ?? '',
    extras: {
      lines: g.lines,
      primaryLine: g.primaryLine,
      operator: g.operator,
    },
  }))
})

const totalPages = computed(() => {
  if (!stations.value) return 0
  return Math.max(1, Math.ceil(stations.value.total / limit))
})

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/' },
  { label: '지하철역', current: true },
])

const pageTitle = computed(() => {
  if (selectedDistrict.value) {
    const cityName = CITY_SLUGS_REVERSE[selectedCitySlug.value] ?? ''
    return `${cityName} ${selectedDistrict.value} 지하철역`
  }
  if (selectedCitySlug.value) {
    const cityName = CITY_SLUGS_REVERSE[selectedCitySlug.value] ?? ''
    return `${cityName} 지하철역`
  }
  return '전국 지하철역'
})

const pageDescription = '역 위치·노선·환승 정보를 한눈에 확인하세요. 환승역은 모든 노선이 함께 표시됩니다.'

const heroStats = computed(() => {
  if (!stations.value) return []
  return [{ label: '총 역수', value: stations.value.total.toLocaleString('ko-KR') }]
})

const resultTitle = computed(() => pageTitle.value)

const CITY_SLUGS_REVERSE: Record<string, string> = Object.fromEntries(
  Object.entries(CITY_SLUGS).map(([name, slug]) => [slug, name]),
)

// 관련 카테고리 / 인기 지역 / FAQ / 데이터 출처 — 다른 카테고리 페이지와 동일 패턴
const relatedCategories = computed(() => {
  const related = RELATED_CATEGORIES['subway'] || []
  return related.map((c) => ({ slug: c, label: CATEGORY_META[c as FacilityCategory]?.label ?? c }))
})

const popularRegionLinks = computed(() => POPULAR_REGIONS)

const faqItems = computed(() => CATEGORY_FAQ.subway ?? [])

const categoryDataSource = computed(() => FACILITY_DATA_SOURCE.subway ?? null)

function resetFilters() {
  selectedCitySlug.value = ''
  selectedDistrict.value = ''
  keyword.value = ''
  page.value = 1
}

// URL 동기화
watch([selectedCitySlug, selectedDistrict, keyword, page], () => {
  const query: Record<string, string> = {}
  if (selectedCitySlug.value) query.city = selectedCitySlug.value
  if (selectedDistrict.value) query.district = selectedDistrict.value
  if (keyword.value.trim()) query.keyword = keyword.value.trim()
  if (page.value > 1) query.page = String(page.value)
  router.replace({ query })
})

watch(selectedCitySlug, () => {
  selectedDistrict.value = ''
  page.value = 1
})
watch([selectedDistrict, keyword], () => {
  page.value = 1
})

useSeoMeta({
  title: () => `${pageTitle.value} - 일상킷`,
  description: pageDescription,
  ogTitle: () => `${pageTitle.value} - 일상킷`,
  ogDescription: pageDescription,
  ogUrl: `${SITE_URL}/subway/`,
  ogType: 'website',
})

useHead({
  link: [{ rel: 'canonical', href: `${SITE_URL}/subway/` }],
})
</script>
