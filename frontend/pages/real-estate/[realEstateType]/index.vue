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
    <SectionBlock heading="거래 유형과 지역" subtext="매매/전월세 탭을 고르고 시/도를 선택해 지역별 실거래가를 확인하세요.">
      <TransactionModeTab v-model="currentTab" class="mb-3" />
      <RegionChips :href-for="(slug) => `/real-estate/${apiSlug}/${slug}`" />
    </SectionBlock>

    <!-- Ad: 거래유형·지역 필터 직후 -->
    <AdBanner />

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
          <p class="text-red-700 font-semibold">{{ UI_MESSAGES.fetchError }}</p>
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
            :property-type="baseType"
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
        <div class="rounded-xl bg-background-light p-12 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-white flex items-center justify-center shadow-card">
            <img :src="`/icons/category/${propertyMeta?.iconImg || 'apt'}.webp?v2`" :alt="propertyMeta?.label || '부동산'" class="w-10 h-10" width="40" height="40" />
          </div>
          <p class="text-slate-700 font-semibold text-lg">지역을 선택해주세요</p>
          <p class="text-slate-500 text-sm mt-1">시/도와 구/군을 선택하면 거래 내역을 확인할 수 있습니다</p>
        </div>
      </SectionBlock>
    </template>

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
      <DataSourceSection domain="real-estate" />
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { RealEstatePropertyType, TransactionMode, ComplexInfo, ComplexListResponse, RealEstateHubType } from '~/types/realEstate'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { HUB_TYPES } from '~/types/realEstate'
import { toRealEstateUrl } from '~/utils/realEstateUrl'
import { PROPERTY_TYPE_META, PROPERTY_TYPE_FAQ, PROPERTY_TYPE_DESCRIPTIONS } from '~/utils/realEstateMeta'
import { isValidBuildingName } from '~/utils/realEstateBuildingName'
import { SITE_URL } from '~/utils/seoConstants'
import { useRealEstate } from '~/composables/useRealEstate'
import { useStructuredData } from '~/composables/useStructuredData'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import { resolveRealEstateListSsrOutcome } from '~/utils/realEstateListSsrOutcome'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { PAGINATION_ROBOTS_CONTENT } from '~/utils/pageQuery'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import RegionChips from '~/components/common/RegionChips.vue'

const route = useRoute()
const router = useRouter()

const realEstateTypeParam = computed(() => route.params.realEstateType as RealEstateHubType)

// 유효하지 않은 realEstateType이면 404
if (!HUB_TYPES.includes(realEstateTypeParam.value as RealEstateHubType)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const baseType = computed(() => realEstateTypeParam.value.split('-')[0] as RealEstatePropertyType)

const currentTab = computed<TransactionMode>({
  get: () => (realEstateTypeParam.value.endsWith('-rent') ? 'rent' : 'sale'),
  set: (val) => {
    router.push(`/real-estate/${baseType.value}-${val}`)
  },
})

const apiSlug = computed(() => realEstateTypeParam.value)
const propertyMeta = computed(() => PROPERTY_TYPE_META[baseType.value])
const propertyDescription = computed(() => PROPERTY_TYPE_DESCRIPTIONS[baseType.value])
const faqs = computed(() => PROPERTY_TYPE_FAQ[baseType.value] || [])

const { getComplexList } = useRealEstate()

const complexes = ref<ComplexInfo[]>([])
// 렌더링 단계에서 invalid buildingName 만 한 번 더 검증.
// 거래 건수 임계값은 noindex/sitemap 정책에 맞춰 제거.
const renderableComplexes = computed<ComplexInfo[]>(() =>
  complexes.value.filter((c) => isValidBuildingName(c.buildingName)),
)
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(true)
const error = ref(false)

// SSR: 초기 건물 목록을 서버에서 로드.
// 2026-05 villa-sale 허브가 한 번의 fetch 실패로 빈 본문이 stale-while-revalidate
// 캐시(s-maxage=300)에 박혀 5분간 모든 사용자/Googlebot 에게 "지역을 선택해주세요"
// 만 반환되던 사고가 있었다. SSR 단계에서 complexes 가 비어있으면 응답에
// `Cache-Control: no-store` 를 강제해 같은 사고 재발을 막는다.
const { data: initialData, error: initialFetchError, status: initialFetchStatus } = await useAsyncData(
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

// SSR 응답 판정 — 장애(degraded)와 정상 0건(empty)을 구분한다.
// 판정 근거·회귀 배경은 utils/realEstateListSsrOutcome.ts 주석 참조.
// h3 의 setResponseHeader 는 server/ 전용 자동 import 라 앱 코드에서 ReferenceError 가 난다.
if (import.meta.server) {
  const outcome = resolveRealEstateListSsrOutcome({
    hasError: !!initialFetchError.value,
    fetchSettled: initialFetchStatus.value === 'success',
    hasItems: complexes.value.length > 0,
  })
  if (outcome === 'degraded') {
    // 503 + no-store. 200 으로 내보내면 빈 본문이 swr(s-maxage=300) 캐시에 박혀 색인된다.
    markDegradedResponse()
  }
  // outcome === 'empty' 는 의도적으로 아무것도 하지 않는다.
  //
  // 예전엔 여기서 no-store 를 걸었다. 목적은 "한 번의 fetch 실패로 생긴 빈 본문이
  // swr 캐시에 박혀 5분간 서빙되는" 사고(2026-05 villa-sale) 방지였다.
  // 그 실패 경로는 #686 이 degraded(503) 로 분리했고, 503 은
  // server/plugins/no-store-on-server-error.ts 가 실제로 no-store 를 강제한다.
  //
  // 그래서 여기 남는 건 "페치 성공 + 진짜로 0건" = 거래가 없는 지역이다.
  // 정확한 내용이므로 캐시되어도 문제가 없다.
  //
  // 게다가 그 no-store 는 애초에 동작하지도 않았다. Nitro 의 cachedEventHandler 가
  // swr 이 걸린 경로의 cache-control 을 무조건 덮어쓰고(errorResponseCache.ts 주석 참조),
  // beforeResponse 훅의 교정은 5xx 에만 적용된다. 200 에는 손이 닿지 않는다.
  // 동작하지 않는 코드를 살리려 커스텀 헤더 신호 같은 기계장치를 늘리는 대신 제거했다.
}

// SEO 메타
const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')
const { setMeta } = useFacilityMeta()

watch(
  [tabLabel, realEstateTypeParam, currentPage],
  () => {
    const tab = tabLabel.value
    const propertyLabel = propertyMeta.value?.label || ''
    // 페이지 2 이상은 noindex (thin content 방지). 정책상 canonical 도 함께 제거
    // (.omc/notes/noindex-canonical-policy.md).
    const isNoindex = currentPage.value > 1
    if (isNoindex) {
      useHead({ meta: [{ name: 'robots', content: PAGINATION_ROBOTS_CONTENT }] })
    }
    setMeta({
      title: `${propertyLabel} ${tab} 실거래가`,
      description: `전국 ${propertyLabel} ${tab} 실거래가와 시세, 최근 거래 내역을 확인하세요.`,
      path: `/real-estate/${realEstateTypeParam.value}`,
      canonical: isNoindex ? false : undefined,
    })
  },
  { immediate: true },
)

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

async function loadComplexes(page: number = 1) {
  pending.value = true
  error.value = false
  try {
    const result = await getComplexList(apiSlug.value, undefined, undefined, undefined, page)
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
  loadComplexes(page)
}

function retryLoad() {
  loadComplexes(currentPage.value)
}

// 탭 전환 시 SSR 데이터와 다른 탭이면 재로드 (클라이언트)
if (import.meta.client && !initialData.value) {
  loadComplexes()
}

// 탭 전환 시 목록 재로드
watch(currentTab, () => {
  loadComplexes()
})

// Breadcrumb + ItemList JSON-LD
const { setBreadcrumbSchema, setItemListSchema, setDatasetSchema, setFAQSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: propertyMeta.value?.label ?? realEstateTypeParam.value, url: `/real-estate/${realEstateTypeParam.value}` },
])
setDatasetSchema({
  name: `전국 ${propertyMeta.value?.label ?? realEstateTypeParam.value} 실거래가 데이터`,
  description: `국토교통부 실거래가 공개시스템 기반 전국 ${propertyMeta.value?.label ?? realEstateTypeParam.value} 거래 데이터입니다. 지역별·단지별 거래 금액, 전용면적, 층수, 거래일 등 상세 정보를 통합 제공합니다.`,
  url: `/real-estate/${realEstateTypeParam.value}`,
  sources: [REAL_ESTATE_DATA_SOURCE],
  keywords: ['부동산', '실거래가', propertyMeta.value?.label ?? realEstateTypeParam.value, '국토교통부'],
})
setFAQSchema(faqs.value.map(f => ({ question: f.q, answer: f.a })))

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
      setItemListSchema([{ name: propertyMeta.value?.label ?? realEstateTypeParam.value, url: `/real-estate/${realEstateTypeParam.value}` }])
    }
  },
  { immediate: true },
)

// Breadcrumb + hero stats
const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: propertyMeta.value?.label ?? realEstateTypeParam.value, href: `/real-estate/${realEstateTypeParam.value}`, current: true },
])

const heroStats = computed(() => {
  const stats: { label: string; value: string }[] = []
  if (totalComplexes.value > 0) {
    stats.push({ label: '전국 등록', value: `${totalComplexes.value.toLocaleString('ko-KR')}곳` })
  }
  stats.push({ label: '보기 방식', value: '매매 / 전월세' })
  return stats
})
</script>
