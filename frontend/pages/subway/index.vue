<template>
  <div class="bg-background-light text-strong font-display min-h-screen">
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
            <label class="block text-xs font-medium text-muted mb-1 hidden md:block">시/도</label>
            <select
              v-model="selectedCitySlug"
              aria-label="시/도 선택"
              class="w-full bg-surface-2 border border-line rounded-lg py-2.5 px-3 text-strong text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">시/도 선택</option>
              <option v-for="c in cityOptions" :key="c.slug" :value="c.slug">{{ c.name }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-2.5 text-muted pointer-events-none text-[18px]">expand_more</span>
          </div>
          <div class="relative">
            <label class="block text-xs font-medium text-muted mb-1 hidden md:block">구/군</label>
            <select
              v-model="selectedDistrict"
              :disabled="!selectedCitySlug"
              aria-label="구/군 선택"
              class="w-full bg-surface-2 border border-line rounded-lg py-2.5 px-3 text-strong text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">구/군 선택</option>
              <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-2.5 text-muted pointer-events-none text-[18px]">expand_more</span>
          </div>
          <div class="relative">
            <label class="block text-xs font-medium text-muted mb-1 hidden md:block">키워드</label>
            <div class="absolute left-3 bottom-2.5 pointer-events-none">
              <span class="material-symbols-outlined text-muted text-[18px]">search</span>
            </div>
            <input
              v-model="keyword"
              class="w-full bg-surface-2 border border-line rounded-lg py-2.5 pl-9 pr-3 text-strong text-base md:text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
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
          <LoadingSkeleton variant="facility-card" />
        </div>

        <template v-else>
          <!-- Card Grid (FacilityCard 재사용) -->
          <div v-if="facilities.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FacilityCard v-for="f in facilities" :key="f.id" :facility="f" />
          </div>

          <!-- Empty -->
          <EmptyState
            v-else
            icon="subway"
            :title="UI_MESSAGES.emptySearch"
            description="다른 지역이나 검색어를 시도해보세요"
          >
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="selectedCitySlug || selectedDistrict || keyword"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-background-light text-ink rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="resetFilters"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                필터 초기화
              </button>
              <NuxtLink to="/" class="btn-primary inline-flex items-center gap-1.5 text-sm">
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </EmptyState>

          <!-- Pagination -->
          <Pagination v-if="totalPages > 1" :current-page="page" :total-pages="totalPages" @page-change="(p) => (page = p)" />
        </template>
      </SectionBlock>

      <!-- Ad: 결과 뒤 -->
      <AdBanner />

      <!-- 관련 탐색 -->
      <SectionBlock
        v-if="relatedCategories.length > 0"
        heading="관련 탐색"
        subtext="비슷한 카테고리로 탐색을 이어가세요."
      >
        <div v-if="relatedCategories.length > 0" class="flex flex-wrap items-center gap-2">
          <span class="text-xs text-muted font-medium pr-1">관련 카테고리</span>
          <NuxtLink
            v-for="cat in relatedCategories"
            :key="cat.slug"
            :to="`/${cat.slug}`"
            class="px-3 py-1.5 bg-white border border-line rounded-full text-sm text-ink hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
          >
            {{ cat.label }}
          </NuxtLink>
        </div>
      </SectionBlock>

      <!-- FAQ -->
      <SectionBlock v-if="faqItems.length > 0" heading="자주 묻는 질문">
        <div class="space-y-1">
          <details v-for="(faq, i) in faqItems" :key="i" class="border-b border-line last:border-b-0">
            <summary class="py-3 cursor-pointer font-medium text-ink hover:text-primary">
              {{ faq.question }}
            </summary>
            <p class="pb-3 text-muted text-sm leading-relaxed">{{ faq.answer }}</p>
          </details>
        </div>
      </SectionBlock>

      <!-- 쿠팡 배너 -->
      <CoupangBanner />

      <!-- 데이터 출처 -->
      <DataSourceSection domain="facility" category="subway" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { useStructuredData } from '~/composables/useStructuredData'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import CoupangBanner from '~/components/ads/CoupangBanner.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
import Pagination from '~/components/common/Pagination.vue'
import FacilityCard from '~/components/facility/FacilityCard.vue'
import { useRegions } from '~/composables/useRegions'
import { CITY_SLUGS } from '~/shared/regionSlugs'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { CATEGORY_META } from '~/types/facility'
import type { Facility, FacilityCategory } from '~/types/facility'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'

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

const apiBase = useApiBase()

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

const { setItemListSchema } = useStructuredData()
setItemListSchema(
  facilities.value.map((f, i) => ({ name: f.name, url: `/subway/${f.id}`, position: i + 1 })),
)

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


const faqItems = computed(() => CATEGORY_FAQ.subway ?? [])

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

const { setMeta } = useFacilityMeta()

function applySubwayIndexMeta() {
  setMeta({
    title: pageTitle.value,
    description: '전국 지하철역의 위치·노선·환승 정보를 지도에서 확인하세요. 환승역은 모든 노선이 함께 표시됩니다.',
    path: '/subway',
  })
}

applySubwayIndexMeta()

watch(pageTitle, () => {
  applySubwayIndexMeta()
})
</script>
