<template>
  <div class="flex flex-col">
    <!-- Hero Section -->
    <section class="relative overflow-hidden px-4 sm:px-6 pb-8 pt-6 md:pt-14 md:pb-12">
      <!-- 배경 이미지 레이어 -->
      <div class="absolute inset-0 opacity-10 md:opacity-[0.08]">
        <img src="/images/hero-bg-light.webp" class="w-full h-full object-cover object-bottom" loading="eager" width="480" height="270" fetchpriority="high" aria-hidden="true" alt="일상킷 생활 정보 서비스" sizes="100vw" />
      </div>
      <div class="absolute bottom-0 left-0 right-0 h-10 md:h-12 bg-background-light/80"></div>

      <div class="relative z-10 flex flex-col gap-5 md:max-w-[680px] md:mx-auto">
        <!-- 라이브 뱃지 -->
        <div class="flex items-center gap-2 text-xs flex-wrap">
          <span class="w-2 h-2 rounded-full bg-primary shrink-0"></span>
          <span class="text-primary font-semibold">공공데이터 기반</span>
          <span class="hidden md:inline text-slate-300">·</span>
          <span class="hidden md:inline text-slate-500">공공데이터포털 · 국토교통부</span>
          <span v-if="newlyListedToday > 0" class="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 text-red-600 text-[11px] font-bold">
            <span class="relative flex w-2 h-2">
              <span class="absolute inline-flex w-full h-full rounded-full bg-red-400 opacity-75 animate-ping"></span>
              <span class="relative inline-flex w-2 h-2 rounded-full bg-red-500"></span>
            </span>
            오늘 신규 등록 {{ newlyListedToday.toLocaleString('ko-KR') }}건
          </span>
        </div>

        <!-- 헤드라인 + 서브텍스트 -->
        <div class="flex flex-col gap-2">
          <h1 class="sr-only">부동산 실거래가·생활시설 통합 검색 - 일상킷</h1>
          <div class="tracking-tight font-bold leading-[1.15]">
            <div class="text-slate-900 text-[38px] md:text-[62px] md:font-black">우리 동네 정보,</div>
            <div class="text-[38px] md:text-[62px] md:font-black">
              <span class="md:hidden text-primary">한번에.</span>
              <span class="hidden md:inline"><span class="text-primary">일상킷에서</span><span class="text-slate-900"> 한번에.</span></span>
            </div>
          </div>
          <p class="md:hidden text-slate-500 text-[15px] mt-1">생활시설 · 실거래 · 청약을 한 곳에서</p>
          <p class="hidden md:block text-slate-500 text-lg mt-1">생활시설 · 부동산 실거래가 · 청약 정보를 한 곳에서.</p>
        </div>

        <!-- 검색바 -->
        <div class="w-full md:max-w-[580px]">
          <label class="relative block">
            <div class="flex items-stretch h-14 rounded-xl md:rounded-2xl bg-white border border-slate-200 md:border-2 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary md:hover:border-slate-300 md:focus-within:ring-4 md:focus-within:ring-primary/10 transition-all">
              <div class="flex items-center pl-4 pr-2 text-slate-400">
                <span class="material-symbols-outlined">search</span>
              </div>
              <input
                v-model="searchKeyword"
                aria-label="단지명·동네·시설 검색"
                class="flex-1 min-w-0 bg-transparent text-slate-900 placeholder:text-slate-400 px-2 text-base font-medium focus:outline-none border-none focus:ring-0 md:py-4"
                placeholder="단지명, 지역, 시설 검색"
                @keydown.enter="handleSearch"
              />
              <div class="flex items-center pr-2">
                <button
                  aria-label="검색"
                  class="h-11 px-4 md:px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-1.5"
                  @click="handleSearch"
                >
                  <span class="material-symbols-outlined text-[18px] md:hidden">search</span>
                  <span class="hidden md:inline">검색</span>
                </button>
              </div>
            </div>
          </label>
        </div>

        <!-- 통계 박스 -->
        <div class="bg-white border border-line rounded-2xl shadow-card md:max-w-[580px]">
          <div class="flex items-stretch divide-x divide-slate-100">
            <div class="flex flex-1 flex-col items-center gap-0.5 py-4 px-3">
              <strong class="text-slate-900 font-bold text-xl tracking-tight">{{ buildingCountKor }}만</strong>
              <span class="text-[11px] text-slate-400">실거래 부동산</span>
            </div>
            <div class="flex flex-1 flex-col items-center gap-0.5 py-4 px-3">
              <strong class="text-primary font-bold text-xl tracking-tight">{{ stats.subscriptionActiveCount }}건</strong>
              <span class="text-[11px] text-slate-400">진행중 청약</span>
            </div>
            <div class="flex flex-1 flex-col items-center gap-0.5 py-4 px-3">
              <strong class="text-slate-900 font-bold text-xl tracking-tight">{{ facilityCountKor }}만</strong>
              <span class="text-[11px] text-slate-400">등록 시설</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 오늘의 부동산 시장 통계 -->
    <HomeHotspotSignals :hotspots="hotspots" />

    <!-- 이번 주 인기 단지 -->
    <HomeTrendingBuildings :buildings="trendingBuildings" />

    <!-- Ad: 인기 단지 이후 -->
    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <AdBanner />
    </div>

    <!-- 청약·임대 일정 섹션 -->
    <HomeSubscriptionSection :summary="subscriptionSummary" />

    <!-- Ad: 청약·임대 이후 -->
    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <AdBanner />
    </div>

    <!-- 빠른 생활시설 찾기 (8 아이콘) -->
    <section id="facilities" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="mb-4">
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">location_on</span>
          빠른 생활시설 찾기
        </h2>
        <p class="text-sm text-slate-500 mt-1">자주 찾는 시설을 바로 확인하세요.</p>
      </div>
      <div class="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-2.5">
        <HardLink
          v-for="q in quickFacilities"
          :key="q.id"
          :to="`/${q.id}`"
          :aria-label="q.label"
          class="flex flex-col items-center justify-center py-3 px-2 bg-white border border-line rounded-xl shadow-card hover:border-primary hover:bg-primary/5 transition-all"
        >
          <CategoryIcon :category-id="(q.id as CategoryId)" size="md" class="mb-1.5" />
          <span class="text-[13px] font-bold text-slate-700">{{ q.label }}</span>
        </HardLink>
      </div>
    </section>

    <!-- 인기 지역 -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="mb-4">
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">place</span>
          인기 지역
        </h2>
        <p class="text-sm text-slate-500 mt-1">많이 찾는 지역부터 둘러보세요.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <HardLink
          v-for="city in CITY_LINKS"
          :key="city.slug"
          :to="`/${city.slug}/`"
          class="inline-flex items-center min-h-[44px] px-3.5 py-2 text-sm bg-white border border-line rounded-full shadow-card text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
        >
          {{ city.label }}
        </HardLink>
      </div>
    </section>

    <!-- 생활 가이드 -->
    <section v-if="recentGuides.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">menu_book</span>
            생활 가이드
          </h2>
          <p class="text-sm text-slate-500 mt-1">최근 가이드를 확인하세요.</p>
        </div>
        <HardLink
          to="/guide"
          class="text-sm text-primary font-bold hover:underline flex items-center min-h-[44px] gap-1 whitespace-nowrap"
        >
          더보기
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </HardLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <HardLink
          v-for="guide in recentGuides"
          :key="guide.id"
          :to="`/guide/${guide.slug}`"
          class="group bg-white border border-line rounded-xl overflow-hidden shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
        >
          <div class="aspect-video bg-slate-100 overflow-hidden">
            <img
              v-if="guide.thumbnailUrl"
              :src="`${config.public.apiBase}${guide.thumbnailUrl}`"
              :alt="guide.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              width="400"
              height="225"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="material-symbols-outlined text-[36px] text-slate-300">article</span>
            </div>
          </div>
          <div class="p-3">
            <h3 class="text-sm font-bold text-slate-900 line-clamp-2 group-hover:text-primary transition-colors">
              {{ guide.title }}
            </h3>
            <p class="text-xs text-slate-500 mt-1 line-clamp-1">
              {{ guide.summary }}
            </p>
          </div>
        </HardLink>
      </div>
    </section>

    <!-- Ad: 생활 가이드 이후 -->
    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <AdBanner />
    </div>

    <!-- 데이터 출처 요약 -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="bg-white border border-line rounded-2xl p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div class="flex items-start gap-3 flex-1">
          <span class="material-symbols-outlined text-primary text-[22px] mt-0.5">verified</span>
          <div>
            <p class="text-sm font-bold text-slate-900">공공데이터 기반 서비스</p>
            <p class="text-xs text-slate-500 mt-1 leading-relaxed">
              행정안전부 · 국토교통부 · 보건복지부 · 한국부동산원 등
              공공데이터포털 및 각 부처 공개 API/CSV를 출처로 사용합니다.
              공공누리(KOGL) 이용 조건을 준수하여 표기합니다.
            </p>
          </div>
        </div>
        <HardLink
          to="/about#data-sources"
          class="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
        >
          전체 출처 보기 →
        </HardLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import HardLink from '~/components/common/HardLink.vue'
import CategoryIcon from '~/components/common/CategoryIcon.vue'
import type { CategoryId } from '~/utils/categoryIcons'
import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'
import HomeMarketStats from '~/components/home/HomeMarketStats.vue'
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue'
import HomeTrendingBuildings from '~/components/home/HomeTrendingBuildings.vue'
import type { GuideSummary } from '~/composables/useGuides'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useHomeDashboard } from '~/composables/useHomeDashboard'
import { CITY_LINKS } from '~/utils/seoConstants'
import { FACILITY_DATA_SOURCE, REAL_ESTATE_DATA_SOURCE, SUBSCRIPTION_DATA_SOURCE } from '~/utils/dataSource'
import { toRealEstateUrl } from '~/utils/realEstateUrl'

const config = useRuntimeConfig()

// SEO 메타태그 - 기존 유지
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터 - 기존 유지
const { setWebsiteSchema, setOrganizationSchema, setDatasetSchema, setItemListSchema } = useStructuredData()
setWebsiteSchema()
setOrganizationSchema()
setDatasetSchema({
  name: '일상킷 통합 생활 데이터',
  description: '전국 공공데이터 기반의 생활시설(병원·약국·주차장·도서관·공원 등 15개 카테고리), 부동산 실거래가, 청약 정보 통합 데이터셋.',
  url: '/',
  sources: [
    ...Object.values(FACILITY_DATA_SOURCE),
    REAL_ESTATE_DATA_SOURCE,
    SUBSCRIPTION_DATA_SOURCE,
  ],
  keywords: ['생활시설', '부동산 실거래가', '청약', '공공데이터', 'KOGL', '대한민국'],
})

// 홈 히어로 배경 이미지 preload (홈 한정)
useHead({
  link: [
    { rel: 'preload', href: '/images/hero-bg-light.webp', as: 'image', type: 'image/webp' },
  ],
})

const searchKeyword = ref('')

// 홈 대시보드 SSR (above-fold, CLS 방지).
// /api/meta/home-dashboard 응답이 /api/meta/stats 의 superset(total, buildingCount,
// subscriptionActiveCount 포함) + 시장 트렌드 / 인기 단지 / 청약 요약을 같이 제공하므로
// 별도 home-stats fetch는 제거함.
const { data: dashboardResponse } = await useHomeDashboard()
const dashboard = computed(() => dashboardResponse.value?.data ?? null)
const trends = computed(() => dashboard.value?.realEstateTrends ?? [])
const hotspots = computed(() => dashboard.value?.realEstateHotspots ?? {})
const trendingBuildings = computed(() => dashboard.value?.trendingBuildings ?? { sale: [], jeonse: [], wolse: [] })
const subscriptionSummary = computed(() => dashboard.value?.subscriptionSummary ?? null)
const newlyListedToday = computed(() => dashboard.value?.newlyListedToday ?? 0)

// Hero 통계박스에서 사용하는 3개 필드만 추림.
const stats = computed(() => ({
  total: dashboard.value?.total ?? 0,
  buildingCount: dashboard.value?.buildingCount ?? 0,
  subscriptionActiveCount: dashboard.value?.subscriptionActiveCount ?? 0,
}))

// ItemList JSON-LD — 트렌딩 단지 TOP 15 (매매 5 + 전세 5 + 월세 5)
if (dashboard.value) {
  const buildings = dashboard.value.trendingBuildings
  const buildItems = (
    list: typeof buildings.sale,
    txnLabel: string,
    type: 'apt-sale' | 'apt-rent',
    posOffset: number,
  ) => list.map((b, i) => ({
    name: `${b.buildingName} (${txnLabel})`,
    url: toRealEstateUrl({ type, city: b.city, district: b.district, buildingName: b.buildingName }),
    position: posOffset + i + 1,
    type: 'Apartment' as const,
    address: {
      addressLocality: b.district,
      addressRegion: b.city,
    },
  }))

  const allItems = [
    ...buildItems(buildings.sale, '매매', 'apt-sale', 0),
    ...buildItems(buildings.jeonse, '전세', 'apt-rent', 5),
    ...buildItems(buildings.wolse, '월세', 'apt-rent', 10),
  ]

  if (allItems.length > 0) {
    setItemListSchema(allItems, {
      name: '이번 주 인기 아파트 단지',
      description: '최근 7일 매매·전세·월세 거래가 가장 많은 아파트 단지',
      key: 'jsonld-trending-buildings',
    })
  }
}

const { data: recentGuidesData } = await useAsyncData('recent-guides', () =>
  $fetch<{ success: boolean; data: GuideSummary[] }>(
    `${config.public.apiBase}/api/guides/recent`,
    { query: { limit: 4 } }
  )
)
const recentGuides = computed(() => recentGuidesData.value?.data ?? [])

// 등록 부동산 건물 수 (만 단위, 소수점 1자리)
const buildingCountKor = computed(() => (stats.value.buildingCount / 10000).toFixed(1))

// 시설 수 만 단위
const facilityCountKor = computed(() => Math.floor(stats.value.total / 10000))

// 빠른 생활시설 찾기 (와이어프레임 8개)
const quickFacilities: { id: string; label: string }[] = [
  { id: 'hospital', label: '병원' },
  { id: 'pharmacy', label: '약국' },
  { id: 'parking', label: '주차' },
  { id: 'ev-charger', label: '충전' },
  { id: 'subway', label: '지하철' },
  { id: 'school', label: '학교' },
  { id: 'childcare', label: '어린이집' },
  { id: 'toilet', label: '화장실' },
  { id: 'trash', label: '쓰레기' },
]

function handleSearch() {
  if (!searchKeyword.value) return
  navigateTo(`/search?keyword=${encodeURIComponent(searchKeyword.value)}`)
}
</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
