<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="page-container pb-10">
      <PageHead eyebrow="생활시설 목록" :title="pageTitle" :description="pageDescription">
        <template #breadcrumb>
          <Breadcrumb :items="breadcrumbItems" class="mb-4" />
        </template>
      </PageHead>

      <!-- Error -->
      <div v-if="error" role="alert" class="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
        지하철역 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
      </div>

      <!-- 지역과 키워드 필터 -->
      <SectionBlock variant="flat" heading="지역과 키워드" subtext="지역을 먼저 선택하면 정확한 목록을 빠르게 찾을 수 있어요.">
        <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1.4fr]">
          <div class="relative">
            <label class="block text-[13px] font-semibold text-muted mb-1.5 hidden md:block">시/도</label>
            <select
              v-model="selectedCitySlug"
              aria-label="시/도 선택"
              class="w-full bg-white border border-line rounded-[7px] min-h-[44px] py-2 pl-3 pr-9 text-ink text-base md:text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
            >
              <option value="">시/도 선택</option>
              <option v-for="c in cityOptions" :key="c.slug" :value="c.slug">{{ c.name }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-3 text-muted pointer-events-none text-[18px]" aria-hidden="true">expand_more</span>
          </div>
          <div class="relative">
            <label class="block text-[13px] font-semibold text-muted mb-1.5 hidden md:block">구/군</label>
            <select
              v-model="selectedDistrict"
              :disabled="!selectedCitySlug"
              aria-label="구/군 선택"
              class="w-full bg-white border border-line rounded-[7px] min-h-[44px] py-2 pl-3 pr-9 text-ink text-base md:text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="">구/군 선택</option>
              <option v-for="d in districtOptions" :key="d" :value="d">{{ d }}</option>
            </select>
            <span class="material-symbols-outlined absolute right-3 bottom-3 text-muted pointer-events-none text-[18px]" aria-hidden="true">expand_more</span>
          </div>
          <div class="relative">
            <label class="block text-[13px] font-semibold text-muted mb-1.5 hidden md:block">키워드</label>
            <div class="absolute left-3 bottom-3 pointer-events-none">
              <span class="material-symbols-outlined text-muted text-[18px]" aria-hidden="true">search</span>
            </div>
            <input
              v-model="keyword"
              class="w-full bg-white border border-line rounded-[7px] min-h-[44px] py-2 pl-9 pr-3 text-ink text-base md:text-[15px] font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              type="search"
              placeholder="역 이름 검색 (예: 강남)"
            />
          </div>
        </div>
      </SectionBlock>

      <!-- Ad -->
      <AdBanner />

      <!-- 결과 목록 -->
      <SectionBlock variant="flat" :heading="`${resultTitle} 지하철역 목록`" subtext="환승역은 1건으로 묶여 노선 배지로 표시됩니다.">
        <template #right>
          <span data-testid="list-count" class="text-sm text-muted tabular-nums"><strong class="font-semibold text-ink">{{ (stations?.total ?? 0).toLocaleString('ko-KR') }}</strong>곳</span>
        </template>

        <!-- Loading Skeleton -->
        <div v-if="pending" role="status" aria-label="정보 로딩 중" aria-live="polite" aria-busy="true">
          <LoadingSkeleton variant="facility-card" />
        </div>

        <template v-else>
          <FacilityList
            v-if="facilities.length > 0"
            :facilities="facilities"
            :loading="false"
            variant="rows"
          />

          <!-- Empty -->
          <EmptyState
            v-else
            icon="subway"
            :title="UI_MESSAGES.emptySearch"
            description="다른 지역이나 검색어를 시도해보세요"
          >
            <div class="flex items-center justify-center gap-3">
              <UiButton
                v-if="selectedCitySlug || selectedDistrict || keyword"
                variant="secondary"
                @click="resetFilters"
              >필터 초기화</UiButton>
              <UiButton variant="primary" to="/">홈으로 돌아가기</UiButton>
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
        variant="flat"
        heading="관련 탐색"
        subtext="비슷한 카테고리로 탐색을 이어가세요."
      >
        <div v-if="relatedCategories.length > 0" class="flex flex-wrap items-center gap-2">
          <span class="text-[13px] font-semibold text-muted pr-1">관련 카테고리</span>
          <UiChip v-for="cat in relatedCategories" :key="cat.slug" :to="`/${cat.slug}`">{{ cat.label }}</UiChip>
        </div>
      </SectionBlock>

      <!-- FAQ -->
      <SectionBlock v-if="faqItems.length > 0" variant="flat" heading="자주 묻는 질문">
        <div class="space-y-1">
          <details v-for="(faq, i) in faqItems" :key="i" class="border-b border-line last:border-b-0">
            <summary class="py-3 cursor-pointer font-medium text-ink hover:text-primary">
              {{ faq.question }}
            </summary>
            <p class="pb-3 text-muted text-sm leading-relaxed">{{ faq.answer }}</p>
          </details>
        </div>
      </SectionBlock>


      <!-- 데이터 출처 -->
      <DataSourceSection domain="facility" category="subway" variant="flat" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { useStructuredData } from '~/composables/useStructuredData'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHead from '~/components/common/PageHead.vue'
import UiButton from '~/components/common/UiButton.vue'
import UiChip from '~/components/common/UiChip.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import EmptyState from '~/components/common/EmptyState.vue'
import LoadingSkeleton from '~/components/common/LoadingSkeleton.vue'
import Pagination from '~/components/common/Pagination.vue'
import FacilityList from '~/components/facility/FacilityList.vue'
import { useRegions } from '~/composables/useRegions'
import { CITY_SLUGS } from '~/shared/regionSlugs'
import { RELATED_CATEGORIES } from '~/utils/seoConstants'
import { buildFacilityListHead } from '~/utils/facilityListHead'
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

// error 를 빨간 알림 렌더에만 쓰고 있었다. 그 알림이 붙은 문서가 HTTP 200 + index 로 나가면
// 크롤러에겐 그냥 얇은 페이지다 — 서버에서는 503 + no-store 로 알린다 (#467 / #674).
if (import.meta.server && error.value) markDegradedResponse()

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
    canonical: false,
  })
}

applySubwayIndexMeta()

// Subway retains its existing page/keyword policy; only lat/lng/q are excluded.
// One reactive owner removes and restores canonical on query navigation.
useHead(computed(() => buildFacilityListHead({
  page: 1,
  query: route.query,
  canonicalHref: 'https://ilsangkit.co.kr/subway',
})))

watch(pageTitle, () => {
  applySubwayIndexMeta()
})
</script>
