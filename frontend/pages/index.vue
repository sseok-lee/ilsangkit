<template>
  <div class="flex flex-col">
    <!-- Hero Section -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-4 md:pt-8 pb-8 md:pb-12">
      <div class="relative overflow-hidden bg-primary-press text-white -mx-4 sm:-mx-6 md:mx-0 px-4 sm:px-6 md:px-8 py-5 md:py-7 md:rounded-2xl">
        <!-- 출처 배지 + 기준일 스탬프 -->
        <div class="flex items-center gap-2 flex-wrap">
          <span class="hidden md:inline-flex items-center text-[11.5px] font-bold bg-white/[0.12] border border-white/20 px-2.5 py-1 rounded-full text-[#DCE6FD]">공공데이터포털</span>
          <span class="hidden md:inline-flex items-center text-[11.5px] font-bold bg-white/[0.12] border border-white/20 px-2.5 py-1 rounded-full text-[#DCE6FD]">국토교통부 실거래가</span>
          <span class="md:hidden inline-flex items-center text-[10px] font-bold bg-white/[0.12] border border-white/20 px-2 py-0.5 rounded-full text-[#DCE6FD]">공공데이터 기반</span>
          <span class="ml-auto text-[10.5px] md:text-xs font-semibold text-[#B9C9F8]">
            <template v-if="stampDate">
              <b class="text-white font-extrabold tabular-nums">{{ stampDate }} 기준</b><span class="hidden md:inline"> · 매일 자동 동기화</span>
            </template>
            <template v-else>매일 자동 동기화</template>
          </span>
        </div>

        <h1 class="sr-only">부동산 실거래가·생활시설 통합 검색 - 일상킷</h1>
        <div class="tracking-tight font-bold leading-[1.15] mt-3">
          <div class="text-white text-[26px] md:text-[40px] md:font-extrabold">우리 동네 정보,</div>
          <div class="text-[26px] md:text-[40px] md:font-extrabold">
            <span class="md:hidden text-[#9DB4F5]">한번에.</span>
            <span class="hidden md:inline"><span class="text-[#9DB4F5]">일상킷에서</span><span class="text-white"> 한번에.</span></span>
          </div>
        </div>
        <p class="md:hidden text-[#C9D6FA] text-[15px] mt-1">부동산 · 청약 · 생활시설을 한 곳에서</p>
        <p class="hidden md:block text-[#C9D6FA] text-lg mt-1">부동산 실거래가, 청약 정보, 생활시설을 한 곳에서.</p>

        <!-- 검색바 -->
        <div class="w-full md:max-w-[860px] mt-4 md:mt-5">
          <label class="relative block">
            <div class="flex items-stretch h-14 rounded-xl md:rounded-2xl bg-white border border-line-2 md:border-2 shadow-card focus-within:border-primary focus-within:ring-1 focus-within:ring-primary md:hover:border-line-2 md:focus-within:ring-4 md:focus-within:ring-primary/10 transition-all">
              <div class="flex items-center pl-4 pr-2 text-faint">
                <span class="material-symbols-outlined">search</span>
              </div>
              <input
                v-model="searchKeyword"
                aria-label="단지명·동네·시설 검색"
                class="flex-1 min-w-0 bg-transparent text-ink placeholder:text-faint px-2 text-base font-medium focus:outline-none border-none focus:ring-0 md:py-4"
                placeholder="단지명, 지역, 시설 검색"
                @keydown="onHeroKeydown"
                @input="onHeroInput"
                @focus="heroFocused = true"
                @blur="heroFocused = false"
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
            <div class="absolute left-0 right-0 top-full z-50">
              <SearchAutocomplete ref="heroAcRef" :open="heroFocused" :model-value="searchKeyword" @close="heroFocused = false" />
            </div>
          </label>
        </div>

        <!-- 스탯 4칸 -->
        <div class="mt-5 md:mt-6 border-t border-white/[0.16] pt-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-y-4 md:gap-y-0 md:divide-x md:divide-white/[0.14]">
            <div class="flex flex-col md:px-4 md:first:pl-0">
              <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">{{ buildingCountKor }}만</strong>
              <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">실거래 부동산</span>
            </div>
            <div class="flex flex-col md:px-4">
              <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">{{ stats.subscriptionActiveCount }}건</strong>
              <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">진행중 청약</span>
            </div>
            <div class="flex flex-col md:px-4">
              <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">{{ facilityCountKor }}만</strong>
              <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">등록 시설</span>
            </div>
            <div class="flex flex-col md:px-4">
              <strong class="text-white font-display font-extrabold text-lg md:text-xl tracking-tight tabular-nums">
                {{ newlyListedToday.toLocaleString('ko-KR') }}<span v-if="newlyListedToday > 0" class="text-[10px] md:text-xs font-bold text-[#7EE3B8] ml-1 align-middle"><span class="md:hidden">오늘</span><span class="hidden md:inline">오늘 신규</span></span>
              </strong>
              <span class="text-[11px] md:text-xs text-[#AEC0F7] font-semibold mt-0.5">오늘 업데이트</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- 오늘의 부동산 시장 통계 -->
    <HomeHotspotSignals :hotspots="hotspots" />

    <!-- 이번 주 인기 단지 -->
    <HomeTrendingBuildings :buildings="trendingBuildings" />

    <!-- 청약·임대 일정 섹션 -->
    <HomeSubscriptionSection />

    <!-- 빠른 생활시설 찾기 (8 아이콘) -->
    <section id="facilities" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="mb-4">
        <h2 class="text-display-2 text-strong flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">location_on</span>
          빠른 생활시설 찾기
        </h2>
        <p class="text-sm text-muted mt-1">자주 찾는 시설을 바로 확인하세요.</p>
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
          <span class="text-[13px] font-bold text-strong">{{ q.label }}</span>
        </HardLink>
      </div>
    </section>

    <!-- 인기 지역 -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
      <div class="mb-4">
        <h2 class="text-display-2 text-strong flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">place</span>
          인기 지역
        </h2>
        <p class="text-sm text-muted mt-1">많이 찾는 지역부터 둘러보세요.</p>
      </div>
      <div class="flex flex-wrap gap-2">
        <HardLink
          v-for="city in CITY_LINKS"
          :key="city.slug"
          :to="`/${city.slug}/`"
          class="inline-flex items-center min-h-[44px] px-3.5 py-2 text-sm bg-white border border-line rounded-full shadow-card text-strong hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
        >
          {{ city.label }}
        </HardLink>
      </div>
    </section>

    <!-- 생활 가이드 -->
    <section v-if="recentGuides.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-display-2 text-strong flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">menu_book</span>
            생활 가이드
          </h2>
          <p class="text-sm text-muted mt-1">최근 가이드를 확인하세요.</p>
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
          <div class="aspect-video bg-background-light overflow-hidden">
            <img
              v-if="guide.thumbnailUrl"
              :src="`${publicApiBase}${guide.thumbnailUrl}`"
              :alt="guide.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              width="400"
              height="225"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="material-symbols-outlined text-[36px] text-faint">article</span>
            </div>
          </div>
          <div class="p-3">
            <h3 class="text-sm font-bold text-strong line-clamp-2 group-hover:text-primary transition-colors">
              {{ guide.title }}
            </h3>
            <p class="text-xs text-muted mt-1 line-clamp-1">
              {{ guide.summary }}
            </p>
          </div>
        </HardLink>
      </div>
    </section>

    <!-- 오늘의 이슈 -->
    <section v-if="recentArticles.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-display-2 text-strong flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">article</span>
            오늘의 이슈
          </h2>
          <p class="text-sm text-muted mt-1">부동산·청약 시장 소식을 확인하세요.</p>
        </div>
        <HardLink
          to="/article"
          class="text-sm text-primary font-bold hover:underline flex items-center min-h-[44px] gap-1 whitespace-nowrap"
        >
          더보기
          <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
        </HardLink>
      </div>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <HardLink
          v-for="article in recentArticles"
          :key="article.id"
          :to="`/article/${article.slug}`"
          class="group bg-white border border-line rounded-xl overflow-hidden shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
        >
          <div class="aspect-video bg-background-light overflow-hidden">
            <img
              v-if="article.thumbnailUrl"
              :src="`${publicApiBase}${article.thumbnailUrl}`"
              :alt="article.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              width="400"
              height="225"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="material-symbols-outlined text-[36px] text-faint">article</span>
            </div>
          </div>
          <div class="p-3">
            <h3 class="text-sm font-bold text-strong line-clamp-2 group-hover:text-primary transition-colors">
              {{ article.title }}
            </h3>
            <p class="text-xs text-muted mt-1 line-clamp-1">
              {{ article.summary }}
            </p>
          </div>
        </HardLink>
      </div>
    </section>

    <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
    </div>

    <!-- 데이터 출처 요약 -->
    <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div class="bg-white border border-line rounded-2xl p-5 shadow-card flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div class="flex items-start gap-3 flex-1">
          <span class="material-symbols-outlined text-primary text-[22px] mt-0.5">verified</span>
          <div>
            <p class="text-sm font-bold text-strong">공공데이터 기반 서비스</p>
            <p class="text-xs text-muted mt-1 leading-relaxed">
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
import { computed, ref } from 'vue'
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue'
// heroAcRef typed as any to avoid circular InstanceType complexity in pages

import HardLink from '~/components/common/HardLink.vue'
import CategoryIcon from '~/components/common/CategoryIcon.vue'
import type { CategoryId } from '~/utils/categoryIcons'
import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'
import HomeHotspotSignals from '~/components/home/HomeHotspotSignals.vue'
import HomeTrendingBuildings from '~/components/home/HomeTrendingBuildings.vue'
import type { GuideSummary } from '~/composables/useGuides'
import type { ArticleSummary } from '~/composables/useArticles'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import type { HomeDashboard } from '~/composables/useHomeDashboard'
import { CITY_LINKS } from '~/utils/seoConstants'
import { FACILITY_DATA_SOURCE, REAL_ESTATE_DATA_SOURCE, SUBSCRIPTION_DATA_SOURCE } from '~/utils/dataSource'
import { toRealEstateUrl } from '~/utils/realEstateUrl'
import { useAnalytics } from '~/composables/useAnalytics'
import { useSyncStatus } from '~/composables/useSyncStatus'
import { isSyncStale, formatDotDate, RE_STALE_DAYS } from '~/utils/syncFreshness'

const config = useRuntimeConfig()
const apiBase = useApiBase()
const { trackSearch } = useAnalytics()
// Image src URLs must use the public base (not loopback) so browsers can load them.
// eslint-disable-next-line no-restricted-syntax
const publicApiBase = config.public.apiBase

// SEO 메타태그 - 기존 유지
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터 - 기존 유지
const { setWebsiteSchema, setOrganizationSchema, setDatasetSchema, setItemListSchema } = useStructuredData()
setWebsiteSchema()
setOrganizationSchema()
setDatasetSchema({
  name: '일상킷 통합 생활 데이터',
  description: '전국 공공데이터 기반의 부동산 실거래가, 청약 정보, 생활시설(병원·약국·주차장·도서관·공원 등 15개 카테고리) 통합 데이터셋.',
  url: '/',
  sources: [
    ...Object.values(FACILITY_DATA_SOURCE),
    REAL_ESTATE_DATA_SOURCE,
    SUBSCRIPTION_DATA_SOURCE,
  ],
  keywords: ['부동산 실거래가', '청약', '생활시설', '공공데이터', 'KOGL', '대한민국'],
})

const searchKeyword = ref('')
const heroFocused = ref(false)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heroAcRef = ref<any>(null)

// 홈 대시보드 SSR (above-fold, CLS 방지).
// /api/meta/home-dashboard 응답이 /api/meta/stats 의 superset(total, buildingCount,
// subscriptionActiveCount 포함) + 시장 트렌드 / 인기 단지 / 청약 요약을 같이 제공하므로
// 별도 home-stats fetch는 제거함.
// Home dashboard + recent guides를 단일 useAsyncData 안에서 Promise.allSettled로 병렬화.
// dashboard는 critical (hero·JSON-LD에 필수) — null이면 503 throw로 빈 hero 색인 차단.
// recentGuides는 fold-below decorative — null이어도 페이지 정상.
const { data: pageData } = await useAsyncData(
  'home-page',
  async () => {
    const signal = AbortSignal.timeout(8000)
    const [dashR, guidesR, articlesR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: HomeDashboard }>(
        `${apiBase}/api/meta/home-dashboard`,
        { signal }
      ),
      $fetch<{ success: boolean; data: GuideSummary[] }>(
        `${apiBase}/api/guides/recent`,
        { query: { limit: 4 }, signal }
      ),
      $fetch<{ success: boolean; data: ArticleSummary[] }>(
        `${apiBase}/api/articles/recent`,
        { query: { limit: 4 }, signal }
      ),
    ])
    if (dashR.status === 'rejected') {
      console.warn('[home-page] dashboard failed:', dashR.reason)
    }
    if (guidesR.status === 'rejected') {
      console.warn('[home-page] recent-guides failed:', guidesR.reason)
    }
    if (articlesR.status === 'rejected') {
      console.warn('[home-page] recent-articles failed:', articlesR.reason)
    }
    return {
      dashboard: dashR.status === 'fulfilled' ? dashR.value.data : null,
      recentGuides: guidesR.status === 'fulfilled' ? guidesR.value.data : ([] as GuideSummary[]),
      recentArticles: articlesR.status === 'fulfilled' ? articlesR.value.data : ([] as ArticleSummary[]),
    }
  },
  {
    default: () => ({
      dashboard: null as HomeDashboard | null,
      recentGuides: [] as GuideSummary[],
      recentArticles: [] as ArticleSummary[],
    }),
  }
)

// 빈 hero 색인 차단 — dashboard 없으면 503 (봇 retry 유도)
if (import.meta.server && !pageData.value?.dashboard) {
  throw createError({ statusCode: 503, statusMessage: 'Home data temporarily unavailable' })
}

const dashboard = computed(() => pageData.value?.dashboard ?? null)
const trends = computed(() => dashboard.value?.realEstateTrends ?? [])
const hotspots = computed(() => dashboard.value?.realEstateHotspots ?? {})
const trendingBuildings = computed(() => dashboard.value?.trendingBuildings ?? { sale: [], jeonse: [], wolse: [] })
const newlyListedToday = computed(() => dashboard.value?.newlyListedToday ?? 0)

const RE_SYNC_KEYS = ['aptSale', 'aptRent', 'villaSale', 'villaRent', 'offitelSale', 'offitelRent'] as const
const { syncStatus } = useSyncStatus()
// 실거래 6개 테이블 중 가장 최근 동기화 시각(ISO 사전순 = 시간순)
const reSyncedAt = computed<string | null>(() => {
  const s = syncStatus.value
  if (!s) return null
  const dates = RE_SYNC_KEYS.map((k) => s[k]).filter((v): v is string => !!v)
  return dates.length ? [...dates].sort().at(-1) ?? null : null
})
// stale/null이면 날짜 생략(fail-open). "매일 자동 동기화" 라벨은 항상 노출.
const stampDate = computed<string | null>(() => {
  const iso = reSyncedAt.value
  return iso && !isSyncStale(iso, RE_STALE_DAYS) ? formatDotDate(iso) : null
})

// 히어로 4칸 스탯 패널에서 사용하는 필드(subscriptionActiveCount)만 추림. total/buildingCount는
// buildingCountKor/facilityCountKor 계산에 별도로 쓰임.
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

const recentGuides = computed(() => pageData.value?.recentGuides ?? [])
const recentArticles = computed(() => pageData.value?.recentArticles ?? [])

// 등록 부동산 건물 수 (만 단위, 소수점 1자리)
const buildingCountKor = computed(() => (stats.value.buildingCount / 10000).toFixed(1))

// 시설 수 만 단위
const facilityCountKor = computed(() => Math.floor(stats.value.total / 10000))

// 빠른 생활시설 찾기 (전 시설 카테고리 15개 + 지하철 = 16개, 8-col 2줄)
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
  { id: 'wifi', label: '와이파이' },
  { id: 'clothes', label: '의류수거' },
  { id: 'aed', label: 'AED' },
  { id: 'library', label: '도서관' },
  { id: 'park', label: '공원' },
  { id: 'market', label: '전통시장' },
  { id: 'sports', label: '체육시설' },
]

function handleSearch() {
  const q = searchKeyword.value.trim()
  if (!q) return
  trackSearch({ keyword: q })
  navigateTo(`/search?keyword=${encodeURIComponent(q)}`)
}

// IME 조합 중에도 실시간 입력값을 자동완성에 전달(v-model은 조합 종료까지 지연됨)
function onHeroInput(e: Event) {
  heroAcRef.value?.setQuery?.((e.target as HTMLInputElement).value)
}

function onHeroKeydown(e: KeyboardEvent) {
  const handled = heroAcRef.value?.onKeydown?.(e)
  if (!handled && e.key.toLowerCase() === 'enter') handleSearch()
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
