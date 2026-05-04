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
        <!-- 데이터 기준 배지 -->
        <div class="flex items-center gap-2 text-xs">
          <span class="w-2 h-2 rounded-full bg-primary shrink-0"></span>
          <span class="text-primary font-semibold">공공데이터 기반</span>
          <span class="hidden md:inline text-slate-300">·</span>
          <span class="hidden md:inline text-slate-500">공공데이터포털 · 국토교통부</span>
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
                  class="h-10 px-4 md:px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-1.5"
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

    <!-- "오늘 확인할 정보" 3카드 -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="mb-4">
        <h2 class="text-lg font-bold text-slate-900">오늘 확인할 정보</h2>
        <p class="text-sm text-slate-500 mt-1">자주 찾는 세 가지 흐름을 먼저 확인하세요.</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
        <NuxtLink
          v-for="card in todayCards"
          :key="card.title"
          :to="card.to"
          class="group flex items-start gap-4 p-5 border border-line rounded-2xl shadow-card hover:shadow-md hover:bg-primary/5 transition-all duration-300 bg-white"
        >
          <div class="w-11 h-11 rounded-lg bg-primary/10 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
            <img :src="`/icons/category/${card.icon}.webp?v2`" :alt="card.title" class="w-8 h-8" width="32" height="32" loading="lazy" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-slate-900 font-bold text-[17px]">{{ card.title }}</h3>
            <p class="text-slate-500 text-xs mt-1">{{ card.desc }}</p>
            <span v-if="card.stat" class="inline-flex mt-2 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[11px] font-bold">
              {{ card.stat }}
            </span>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- 부동산 실거래가 3카드 -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="flex items-end justify-between gap-4 mb-4">
        <div>
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">apartment</span>
            부동산 실거래가
          </h2>
          <p class="text-sm text-slate-500 mt-1">매매·전월세 거래 내역을 건물 유형별로 확인하세요.</p>
        </div>
        <NuxtLink to="/real-estate" class="text-sm text-primary font-bold hover:underline whitespace-nowrap">전체 보기 →</NuxtLink>
      </div>
      <div class="grid grid-cols-3 gap-2 md:gap-4">
        <NuxtLink
          v-for="link in realEstateLinks"
          :key="link.to"
          :to="link.to"
          :aria-label="`${link.label} 실거래가`"
          class="group flex flex-col md:flex-row md:items-start gap-2 md:gap-4 p-4 md:p-5 border border-line rounded-2xl shadow-card hover:shadow-md hover:bg-primary/5 transition-all duration-300 bg-white"
        >
          <div class="w-12 h-12 rounded-xl bg-primary/10 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
            <img :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-9 h-9" width="36" height="36" loading="lazy" />
          </div>
          <div class="flex-1 min-w-0">
            <h3 class="text-slate-900 font-bold text-[15px] md:text-[17px]">{{ link.label }}</h3>
            <p class="text-slate-500 text-[11px] md:text-xs mt-1 truncate">{{ link.sub }}</p>
            <div class="flex flex-wrap gap-1 mt-2">
              <span class="inline-flex px-2 py-1 rounded-lg bg-primary/10 text-primary text-[11px] md:text-xs font-bold">
                {{ link.count }}
              </span>
              <span class="hidden md:inline-flex px-2 py-1 rounded-lg bg-slate-100 text-slate-600 text-[11px] md:text-xs font-semibold">
                거래 {{ link.txnCount }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>
    </section>

    <!-- Ad: 부동산 실거래가 이후 -->
    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <AdBanner />
    </div>

    <!-- 청약·임대 일정 섹션 -->
    <HomeSubscriptionSection />

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
        <NuxtLink
          v-for="q in quickFacilities"
          :key="q.id"
          :to="`/${q.id}`"
          :aria-label="q.label"
          class="flex flex-col items-center justify-center py-3 px-2 bg-white border border-line rounded-xl shadow-card hover:border-primary hover:bg-primary/5 transition-all"
        >
          <img :src="`/icons/category/${q.id}.webp?v2`" :alt="q.label" class="w-8 h-8 mb-1.5" width="32" height="32" loading="lazy" />
          <span class="text-[13px] font-bold text-slate-700">{{ q.label }}</span>
        </NuxtLink>
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
        <NuxtLink
          v-for="city in CITY_LINKS"
          :key="city.slug"
          :to="`/${city.slug}/`"
          class="px-3.5 py-2 text-sm bg-white border border-line rounded-full shadow-card text-slate-700 hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
        >
          {{ city.label }}
        </NuxtLink>
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
        <NuxtLink
          to="/guide"
          class="text-sm text-primary font-bold hover:underline flex items-center gap-1 whitespace-nowrap"
        >
          더보기
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </NuxtLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <NuxtLink
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
        </NuxtLink>
      </div>
    </section>

    <!-- Ad: 생활 가이드 이후 -->
    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
      <AdBanner />
    </div>

    <!-- 최근 리뷰 (하단 보조 콘텐츠) -->
    <section v-if="recentReviews.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
        <span class="material-symbols-outlined text-primary text-[24px]">rate_review</span>
        최근 리뷰
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        <LazyRecentReviewCard
          v-for="review in recentReviews"
          :key="review.id"
          :review="review"
        />
      </div>
    </section>

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
        <NuxtLink
          to="/about#data-sources"
          class="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-bold hover:bg-primary/20 transition-colors"
        >
          전체 출처 보기 →
        </NuxtLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import AdBanner from '~/components/ads/AdBanner.vue'
import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'
import type { ReviewWithFacility } from '~/types/review'
import type { GuideSummary } from '~/composables/useGuides'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CITY_LINKS } from '~/utils/seoConstants'
import { FACILITY_DATA_SOURCE, REAL_ESTATE_DATA_SOURCE, SUBSCRIPTION_DATA_SOURCE } from '~/utils/dataSource'

const config = useRuntimeConfig()

// SEO 메타태그 - 기존 유지
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터 - 기존 유지
const { setWebsiteSchema, setOrganizationSchema, setDatasetSchema } = useStructuredData()
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

// Stats: SSR에서 대기 (above-fold, CLS 방지)
const { data: statsResponse } = await useAsyncData('home-stats', () =>
  $fetch<{ success: boolean; data: Record<string, unknown> }>(
    `${config.public.apiBase}/api/meta/stats`
  )
)

const { data: recentReviewsData } = await useAsyncData('recent-reviews', () =>
  $fetch<{ success: boolean; data: ReviewWithFacility[] }>(
    `${config.public.apiBase}/api/reviews/recent`,
    { query: { limit: 6 } }
  )
)
const { data: recentGuidesData } = await useAsyncData('recent-guides', () =>
  $fetch<{ success: boolean; data: GuideSummary[] }>(
    `${config.public.apiBase}/api/guides/recent`,
    { query: { limit: 4 } }
  )
)
const recentReviews = computed(() => recentReviewsData.value?.data ?? [])
const recentGuides = computed(() => recentGuidesData.value?.data ?? [])

const stats = computed(() => {
  const d = (statsResponse.value?.data ?? {}) as Record<string, number> & {
    realEstate?: Record<string, number>
    realEstateBuildings?: Record<string, number>
    subscriptionActiveCount?: number
  }
  return {
    total: d.total ?? 0,
    buildingCount: d.buildingCount ?? 0,
    regionCount: d.regionCount ?? 0,
    realEstate: d.realEstate ?? { aptSale: 0, aptRent: 0, villaSale: 0, villaRent: 0, offitelSale: 0, offitelRent: 0 },
    realEstateBuildings: d.realEstateBuildings ?? { apt: 0, villa: 0, offitel: 0 },
    subscriptionActiveCount: d.subscriptionActiveCount ?? 0,
  }
})

// 등록 부동산 건물 수 (만 단위, 소수점 1자리)
const buildingCountKor = computed(() => (stats.value.buildingCount / 10000).toFixed(1))

// 시설 수 만 단위
const facilityCountKor = computed(() => Math.floor(stats.value.total / 10000))

function formatBuildingCount(n: number): string {
  if (n === 0) return '-'
  if (n >= 10000) {
    const val = (n / 10000).toFixed(1).replace(/\.0$/, '')
    return `${val}만+`
  }
  const rounded = Math.floor(n / 1000) * 1000
  return `${rounded.toLocaleString('ko-KR')}+`
}

// "오늘 확인할 정보" 3카드 — 실시간 수치 포함
const todayCards = computed(() => {
  const s = stats.value
  return [
    {
      title: '실거래가',
      desc: '아파트·빌라·오피스텔',
      stat: s.buildingCount ? `전국 ${formatBuildingCount(s.buildingCount)}` : null,
      icon: 'apt',
      to: '/real-estate',
    },
    {
      title: '청약·임대',
      desc: '청약중·청약예정',
      stat: s.subscriptionActiveCount > 0 ? `모집·예정 ${s.subscriptionActiveCount}건` : null,
      icon: 'subscription',
      to: '/subscription',
    },
    {
      title: '생활시설',
      desc: '병원·약국·주차장',
      stat: s.total ? `전국 ${formatBuildingCount(s.total)}` : null,
      icon: 'hospital',
      to: '#facilities',
    },
  ]
})

// 부동산 실거래가 링크
const realEstateLinks = computed(() => {
  const reb = stats.value.realEstateBuildings
  const re = stats.value.realEstate
  return [
    { to: '/real-estate/apt-sale', label: '아파트', iconImg: 'apt', sub: '매매·전월세 실거래가', count: formatBuildingCount(reb.apt || 0), txnCount: formatBuildingCount((re.aptSale || 0) + (re.aptRent || 0)) },
    { to: '/real-estate/villa-sale', label: '빌라', iconImg: 'villa', sub: '연립·다세대 실거래가', count: formatBuildingCount(reb.villa || 0), txnCount: formatBuildingCount((re.villaSale || 0) + (re.villaRent || 0)) },
    { to: '/real-estate/offitel-sale', label: '오피스텔', iconImg: 'offitel', sub: '매매·전월세 실거래가', count: formatBuildingCount(reb.offitel || 0), txnCount: formatBuildingCount((re.offitelSale || 0) + (re.offitelRent || 0)) },
  ]
})

// 빠른 생활시설 찾기 (와이어프레임 8개)
const quickFacilities: { id: string; label: string }[] = [
  { id: 'hospital', label: '병원' },
  { id: 'pharmacy', label: '약국' },
  { id: 'parking', label: '주차' },
  { id: 'ev-charger', label: '충전' },
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
