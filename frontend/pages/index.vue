<template>
  <div class="flex flex-col">
      <!-- Hero Section (통합 반응형) -->
      <section class="relative overflow-hidden px-4 sm:px-6 pb-8 pt-4 md:pt-16 md:pb-12">
        <!-- 배경 이미지 레이어 -->
        <div class="absolute inset-0 opacity-10 md:opacity-[0.08]">
          <img src="/images/hero-bg-light.webp" class="w-full h-full object-cover object-bottom" loading="eager" width="480" height="270" fetchpriority="high" aria-hidden="true" alt="일상킷 생활 정보 서비스" sizes="100vw" />
        </div>
        <!-- 하단 그라데이션 페이드 -->
        <div class="absolute bottom-0 left-0 right-0 h-12 md:h-16 bg-gradient-to-t from-background-light to-transparent"></div>

        <div class="relative z-10 flex flex-col gap-6 md:max-w-3xl md:mx-auto md:items-center md:text-center">
          <!-- 제목 -->
          <div class="flex flex-col gap-2 pt-4">
            <h1 class="sr-only">부동산 실거래가·생활시설 통합 검색 - 일상킷</h1>
            <div class="text-slate-900 tracking-tight text-[32px] font-bold leading-[1.25] md:text-5xl md:font-black md:leading-tight">
              내 동네 부동산·생활시설, 한번에 확인
            </div>
            <p class="text-slate-500 text-base md:text-lg">아파트 실거래가부터 근처 약국까지</p>
          </div>

          <!-- 검색바 -->
          <div class="w-full md:max-w-[560px] md:mt-4">
            <label class="relative block">
              <div class="flex items-stretch h-14 md:h-auto rounded-xl md:rounded-2xl bg-white border border-slate-200 md:border-2 shadow-sm focus-within:border-primary focus-within:ring-1 focus-within:ring-primary md:hover:border-slate-300 md:focus-within:ring-4 md:focus-within:ring-primary/10 transition-all">
                <div class="flex items-center pl-4 pr-2 text-slate-400">
                  <span class="material-symbols-outlined">search</span>
                </div>
                <input
                  v-model="searchKeyword"
                  aria-label="장소 또는 시설 검색"
                  class="flex-1 min-w-0 bg-transparent text-slate-900 placeholder:text-slate-400 px-2 text-base font-medium focus:outline-none border-none focus:ring-0 md:py-4"
                  placeholder="장소명 또는 주소로 검색하세요"
                  @keydown.enter="handleSearch"
                />
                <div class="hidden md:flex items-center pr-2">
                  <button
                    aria-label="검색"
                    class="h-10 px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                    @click="handleSearch"
                  >
                    <span class="material-symbols-outlined text-[18px]">search</span>
                    <span>검색</span>
                  </button>
                </div>
              </div>
            </label>
          </div>

          <!-- 통계 -->
          <div class="flex justify-center gap-5 md:gap-10 mt-2 md:mt-6">
            <div class="text-center">
              <div class="text-2xl md:text-3xl font-black text-primary whitespace-nowrap">{{ formatStatCount(stats.buildingCount || 0) }}</div>
              <div class="text-sm text-slate-500">실거래가 매물</div>
            </div>
            <div class="w-px bg-slate-200 self-stretch my-1 md:hidden"></div>
            <div class="text-center">
              <div class="text-2xl md:text-3xl font-black text-primary whitespace-nowrap">{{ formatStatCount(stats.total || 0) }}</div>
              <div class="text-sm text-slate-500">전국 생활시설</div>
            </div>
            <div class="w-px bg-slate-200 self-stretch my-1 md:hidden"></div>
            <div class="text-center">
              <div class="text-2xl md:text-3xl font-black text-primary whitespace-nowrap">{{ stats.regionCount || 0 }}개</div>
              <div class="text-sm text-slate-500">전국 시군구</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Ad: 히어로 아래 -->
      <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <AdBanner />
      </div>

      <!-- 부동산 + 시설 카테고리 통합 Section -->
      <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <!-- 부동산 실거래가 -->
        <div class="mb-8">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-5">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">apartment</span>
            부동산
          </h2>
          <!-- 모바일: 3열 아이콘 그리드 -->
          <div class="md:hidden grid grid-cols-3 gap-y-5 gap-x-3">
            <NuxtLink
              v-for="link in realEstateLinks"
              :key="link.to"
              :to="link.to"
              :aria-label="`${link.label} 실거래가`"
              class="flex flex-col items-center gap-2"
            >
              <div class="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <img :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-9 h-9" width="36" height="36" loading="lazy" />
              </div>
              <span class="text-sm text-slate-700 font-medium">{{ link.label }}</span>
              <div class="flex gap-1">
                <span class="px-1 py-0.5 rounded-full bg-primary/15 text-primary-700 text-[10px] font-medium">매매</span>
                <span class="px-1 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-medium">전월세</span>
              </div>
            </NuxtLink>
          </div>
          <!-- 데스크톱: 가로형 카드 -->
          <div class="hidden md:grid md:grid-cols-3 gap-4">
            <NuxtLink
              v-for="link in realEstateLinks"
              :key="link.to"
              :to="link.to"
              :aria-label="`${link.label} 실거래가 - ${link.sub}`"
              class="group flex items-center gap-4 p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:bg-primary/5 transition-all duration-300 bg-white"
            >
              <div class="w-12 h-12 rounded-xl bg-primary/10 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                <img :src="`/icons/category/${link.iconImg}.webp?v2`" :alt="link.label" class="w-9 h-9" width="36" height="36" loading="lazy" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-slate-900 font-semibold text-[17px]">{{ link.label }}</h3>
                <div class="flex gap-1.5 text-[11px] mt-1">
                  <span class="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary-700 font-medium">매매</span>
                  <span class="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">전월세</span>
                </div>
                <p class="text-slate-500 text-xs leading-snug mt-1 truncate">{{ link.sub }}</p>
              </div>
              <span class="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 text-lg shrink-0">→</span>
            </NuxtLink>
          </div>
        </div>
        <!-- 시설 카테고리 그룹 -->
        <div v-for="group in categoryGroups" :key="group.title" class="mb-8">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-5">
            <span class="material-symbols-outlined text-[24px]" :class="group.colors.iconText" aria-hidden="true">{{ group.icon }}</span>
            {{ group.title }}
          </h2>
          <!-- 모바일: 4열 아이콘 그리드 -->
          <div class="md:hidden grid grid-cols-4 gap-y-5 gap-x-3">
            <NuxtLink
              v-for="item in group.items"
              :key="item.id"
              :to="`/${item.id}`"
              :aria-label="`${CATEGORY_LABELS[item.id]} - ${item.desc}`"
              class="flex flex-col items-center gap-2"
            >
              <div class="w-14 h-14 rounded-2xl flex items-center justify-center" :class="group.colors.bg">
                <img :src="`/icons/category/${item.id}.webp?v2`" :alt="CATEGORY_LABELS[item.id]" class="w-9 h-9" width="36" height="36" loading="lazy" />
              </div>
              <span class="text-sm text-slate-700 font-medium text-center leading-tight">{{ CATEGORY_LABELS[item.id] }}</span>
            </NuxtLink>
          </div>
          <!-- 데스크톱: 가로형 카드 -->
          <div class="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-3">
            <NuxtLink
              v-for="item in group.items"
              :key="item.id"
              :to="`/${item.id}`"
              :aria-label="`${CATEGORY_LABELS[item.id]} - ${item.desc} - ${formatCount(stats[item.id] || 0)}`"
              class="group flex items-center gap-4 p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:bg-primary/5 transition-all duration-300 bg-white"
            >
              <div class="w-12 h-12 rounded-xl bg-primary/5 shrink-0 flex items-center justify-center group-hover:scale-110 transition-transform">
                <img :src="`/icons/category/${item.id}.webp?v2`" :alt="CATEGORY_LABELS[item.id]" class="w-8 h-8" width="32" height="32" loading="lazy" />
              </div>
              <div class="flex-1 min-w-0">
                <h3 class="text-slate-900 font-semibold text-[17px]">{{ CATEGORY_LABELS[item.id] }}</h3>
                <p class="text-slate-500 text-xs mt-1 truncate">{{ item.desc }}</p>
              </div>
              <span class="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 text-lg shrink-0">→</span>
            </NuxtLink>
          </div>
        </div>
      </section>

      <!-- Ad: 카테고리 그리드 아래 -->
      <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <AdBanner />
      </div>

      <!-- Recent Guides Section -->
      <section v-if="recentGuides.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">menu_book</span>
            생활 가이드
          </h2>
          <NuxtLink
            to="/guide"
            class="text-sm text-primary-700 font-medium hover:underline flex items-center gap-1"
          >
            더보기
            <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
          </NuxtLink>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          <NuxtLink
            v-for="guide in recentGuides"
            :key="guide.id"
            :to="`/guide/${guide.slug}`"
            class="group bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
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

      <!-- Ad: Recent Guides 후 -->
      <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 mb-8">
        <AdBanner />
      </div>

      <!-- 지역별 생활 정보 -->
      <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">location_on</span>
          지역별 생활 정보
        </h2>
        <div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          <NuxtLink v-for="city in CITY_LINKS" :key="city.slug" :to="`/${city.slug}/`"
            class="px-3 py-2 text-center text-sm bg-white border border-slate-200 rounded-xl shadow-sm hover:border-primary hover:bg-primary/5 hover:text-primary transition-all">
            {{ city.label }}
          </NuxtLink>
        </div>
      </section>

      <!-- Recent Reviews Section -->
      <section v-if="recentReviews.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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

  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { CategoryId } from '~/utils/categoryIcons'
import { CATEGORY_LABELS } from '~/utils/categoryIcons'
import { CATEGORY_GROUPS, CATEGORY_META } from '~/types/facility'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import type { ReviewWithFacility } from '~/types/review'
import type { GuideSummary } from '~/composables/useGuides'
import { useStructuredData } from '~/composables/useStructuredData'
import { CITY_LINKS } from '~/utils/seoConstants'

const config = useRuntimeConfig()

// SEO 메타태그
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터
const { setWebsiteSchema } = useStructuredData()
setWebsiteSchema()

const searchKeyword = ref('')

// Stats: SSR에서 대기 (above-fold 콘텐츠, lazy 시 CLS 발생) — 백엔드 5분 캐시로 응답 빠름
const { data: statsResponse } = await useAsyncData('home-stats', () =>
  $fetch<{ success: boolean; data: Record<string, any> }>(
    `${config.public.apiBase}/api/meta/stats`
  )
)

// Below-fold: lazy로 SSR 블로킹 없이 클라이언트에서 로딩
const { data: recentReviewsData } = useAsyncData('recent-reviews', () =>
  $fetch<{ success: boolean; data: ReviewWithFacility[] }>(
    `${config.public.apiBase}/api/reviews/recent`,
    { query: { limit: 6 } }
  ),
  { lazy: true }
)
const { data: recentGuidesData } = useAsyncData('recent-guides', () =>
  $fetch<{ success: boolean; data: GuideSummary[] }>(
    `${config.public.apiBase}/api/guides/recent`,
    { query: { limit: 4 } }
  ),
  { lazy: true }
)
const recentReviews = computed(() => recentReviewsData.value?.data ?? [])
const recentGuides = computed(() => recentGuidesData.value?.data ?? [])
const stats = computed(() => statsResponse.value?.data ?? {
  toilet: 0,
  wifi: 0,
  clothes: 0,
  park: 0,
  trash: 0,
  parking: 0,
  aed: 0,
  library: 0,
  hospital: 0,
  pharmacy: 0,
  school: 0,
  market: 0,
  childcare: 0,
  'ev-charger': 0,
  sports: 0,
  total: 0,
  buildingCount: 0,
  regionCount: 0,
})

const realEstateStats = computed(() => {
  const data = statsResponse.value?.data as any
  return data?.realEstate ?? {
    aptSale: 0, aptRent: 0,
    villaSale: 0, villaRent: 0,
    offitelSale: 0, offitelRent: 0,
  }
})

// 숫자 포맷 함수
function formatCount(count: number): string {
  return '전국 ' + count.toLocaleString('ko-KR') + '곳'
}

// 통계 배너용 포맷 (1000 단위 반올림)
function formatStatCount(count: number): string {
  if (count === 0) return '-'
  const rounded = Math.floor(count / 1000) * 1000
  return rounded.toLocaleString('ko-KR') + '+'
}

// 카테고리별 설명 (홈페이지 전용)
const categoryDescriptions: Record<string, string> = {
  toilet: '가까운 화장실 바로 찾기',
  wifi: '무료 와이파이 접속 장소',
  parking: '주차장 위치·요금 비교',
  park: '공원 위치·시설 정보 확인',
  school: '학교 위치·학교급 확인',
  market: '전통시장 개장 정보 확인',
  aed: '가까운 AED 위치 확인',
  library: '좌석·장서·휴관일 확인',
  clothes: '가까운 의류수거함 찾기',
  trash: '배출 요일·방법 안내',
  hospital: '과목별 병원 검색',
  pharmacy: '야간·주말 약국 찾기',
  childcare: '어린이집 정원·현원 확인',
  'ev-charger': '충전소 위치·충전기 현황',
  sports: '체육시설 종류·규모 확인',
}

// 그룹별 컬러 테마
const GROUP_COLORS: Record<string, { bg: string; iconText: string }> = {
  '생활/편의': { bg: 'bg-amber-50', iconText: 'text-amber-500' },
  '교육/육아': { bg: 'bg-sky-50', iconText: 'text-sky-500' },
  '건강/안전': { bg: 'bg-emerald-50', iconText: 'text-emerald-500' },
  '환경/생활': { bg: 'bg-violet-50', iconText: 'text-violet-500' },
}


// 그룹화된 카테고리 (공유 상수 + 페이지 전용 desc + 그룹 컬러)
const categoryGroups = CATEGORY_GROUPS.map(group => ({
  title: group.title,
  icon: group.icon,
  colors: GROUP_COLORS[group.title] || { bg: 'bg-primary/5', iconText: 'text-primary' },
  items: group.categories.map(id => ({
    id: id as CategoryId,
    desc: categoryDescriptions[id] || '',
    icon: CATEGORY_META[id as keyof typeof CATEGORY_META]?.icon || '',
  })),
}))

// 부동산 실거래가 링크
const realEstateLinks = computed(() => {
  const re = realEstateStats.value
  return [
    { to: '/real-estate/apt', label: '아파트', iconImg: 'apt', sub: '최근 실거래가 확인', count: formatCount(re.aptSale + re.aptRent) },
    { to: '/real-estate/villa', label: '빌라', iconImg: 'villa', sub: '최근 실거래가 확인', count: formatCount(re.villaSale + re.villaRent) },
    { to: '/real-estate/offitel', label: '오피스텔', iconImg: 'offitel', sub: '최근 실거래가 확인', count: formatCount(re.offitelSale + re.offitelRent) },
  ]
})



function handleSearch() {
  if (!searchKeyword.value) {
    return
  }

  navigateTo(`/search?keyword=${encodeURIComponent(searchKeyword.value)}`)
}

</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Fill icon for active bottom nav */
.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
