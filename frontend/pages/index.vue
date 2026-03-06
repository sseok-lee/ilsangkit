<template>
  <div class="flex flex-col">
      <!-- Mobile Hero Section -->
      <section class="md:hidden flex flex-col gap-6 px-4 pb-8 pt-4 relative overflow-hidden">
        <!-- 배경 이미지 레이어 (목표: 각 WebP 200KB 이하) -->
        <div class="absolute inset-0 opacity-10">
          <picture>
            <source srcset="/images/hero-bg-light.webp" type="image/webp" />
            <img src="/images/hero-bg-light.png" class="w-full h-full object-cover object-bottom" loading="lazy" width="1920" height="1080" fetchpriority="low" aria-hidden="true" alt="" />
          </picture>
        </div>
        <!-- 하단 그라데이션 페이드 -->
        <div class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background-light to-transparent"></div>

        <!-- 콘텐츠 -->
        <div class="relative z-10 flex flex-col gap-6">
        <!-- Title & Subtitle -->
        <div class="flex flex-col gap-2 pt-4">
          <h1 class="text-[#111418] tracking-tight text-[32px] font-bold leading-[1.2]">
            내 주변 생활 편의 정보,<br />
            <span class="text-primary">한 번에 찾기</span>
          </h1>
          <p class="text-[#60708a] text-base font-normal leading-normal">
            지금 필요한 생활 시설을 검색해보세요.
          </p>
        </div>

        <!-- Search Bar (Mobile) -->
        <label class="flex flex-col h-14 w-full shadow-sm rounded-xl">
          <div class="flex w-full flex-1 items-stretch rounded-xl bg-white#1e293b] border border-slate-200 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <div class="text-[#60708a] flex items-center justify-center pl-4 pr-2">
              <span class="material-symbols-outlined">search</span>
            </div>
            <input
              v-model="searchKeyword"
              aria-label="장소 또는 시설 검색"
              class="flex w-full min-w-0 flex-1 resize-none bg-transparent text-[#111418] placeholder:text-[#94a3b8] px-2 text-base font-medium leading-normal focus:outline-none border-none focus:ring-0 rounded-xl"
              placeholder="장소, 시설 검색..."
              @keydown.enter="handleSearch"
            />
          </div>
        </label>

        <!-- Hero Stats Banner (Mobile) -->
        <div class="flex justify-center gap-6 mt-2">
          <div class="text-center">
            <div class="text-2xl font-black text-primary">{{ formatStatCount(groupStats.living) }}</div>
            <div class="text-xs text-slate-500">생활 편의</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-black text-primary">{{ formatStatCount(groupStats.health) }}</div>
            <div class="text-xs text-slate-500">건강/안전</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-black text-primary">{{ formatStatCount(groupStats.culture) }}</div>
            <div class="text-xs text-slate-500">문화/환경</div>
          </div>
        </div>

        <!-- Popular Regions (Mobile) -->
        <div class="mt-4" role="region" aria-label="인기 지역">
          <h2 class="text-[#111418] text-lg font-bold leading-tight mb-4">인기 지역</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="region in popularRegionsMobile"
              :key="region.name"
              :data-testid="`region-${region.name}`"
              class="px-4 py-2.5 bg-white#1e293b] rounded-lg text-sm font-medium text-slate-700 shadow-sm border border-slate-100 hover:border-primary/50 hover:text-primary transition-colors"
              @click="handleRegionClick(region.query)"
            >
              # {{ region.name }}
            </button>
          </div>
        </div>
        </div>
      </section>

      <!-- Desktop Hero Section -->
      <section class="hidden md:block w-full pt-16 pb-12 px-4 sm:px-6 relative overflow-hidden">
        <!-- 배경 이미지 레이어 (목표: 각 WebP 200KB 이하) -->
        <div class="absolute inset-0 opacity-[0.08]">
          <picture>
            <source srcset="/images/hero-bg-light.webp" type="image/webp" />
            <img src="/images/hero-bg-light.png" class="w-full h-full object-cover object-bottom" loading="lazy" width="1920" height="1080" fetchpriority="low" aria-hidden="true" alt="" />
          </picture>
        </div>
        <!-- 하단 그라데이션 페이드 -->
        <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background-light to-transparent"></div>

        <div class="relative z-10 max-w-3xl mx-auto flex flex-col gap-6 items-center text-center">
          <div class="space-y-4">
            <p class="text-4xl md:text-5xl font-black text-slate-900 tracking-tight leading-tight" aria-hidden="true">
              내 주변 생활 편의 정보, 한 번에 찾기
            </p>
            <p class="text-lg text-slate-600 font-normal">
              지금 필요한 생활 시설을 검색해보세요.
            </p>
          </div>
          <!-- Search Input Component (Desktop) -->
          <div class="w-full max-w-[560px] relative group mt-4">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
              <span class="material-symbols-outlined text-[24px]">search</span>
            </div>
            <input
              v-model="searchKeyword"
              aria-label="장소 또는 시설 검색"
              class="block w-full pl-12 pr-4 py-4 bg-white border-2 border-slate-200 rounded-2xl text-base text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm hover:border-slate-300"
              placeholder="장소, 시설 검색..."
              type="text"
              @keydown.enter="handleSearch"
            />
            <div class="absolute inset-y-2 right-2">
              <button
                aria-label="검색"
                class="h-full px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                @click="handleSearch"
              >
                <span class="material-symbols-outlined text-[18px]">search</span>
                <span>검색</span>
              </button>
            </div>
          </div>

          <!-- Hero Stats Banner (Desktop) -->
          <div class="flex justify-center gap-10 mt-6">
            <div class="text-center">
              <div class="text-3xl font-black text-primary">{{ formatStatCount(groupStats.living) }}</div>
              <div class="text-sm text-slate-500">생활 편의</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-black text-primary">{{ formatStatCount(groupStats.health) }}</div>
              <div class="text-sm text-slate-500">건강/안전</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-black text-primary">{{ formatStatCount(groupStats.culture) }}</div>
              <div class="text-sm text-slate-500">문화/환경</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Grouped Category Cards (Unified Responsive) -->
      <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div v-for="group in categoryGroups" :key="group.title" class="mb-8">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary text-[24px]">{{ group.icon }}</span>
            {{ group.title }}
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            <a
              v-for="item in group.items"
              :key="item.id"
              :href="`/${item.id}`"
              :aria-label="`${CATEGORY_LABELS[item.id]} - ${item.desc} - ${formatCount(stats[item.id] || 0)}`"
              :class="[
                'group relative flex flex-col p-4 md:p-5 border border-slate-200 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300',
                getCategoryHoverBg(item.id),
              ]"
            >
              <div :class="`w-14 h-14 rounded-full ${getCategoryBgColor(item.id)} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`">
                <CategoryIcon :category-id="item.id" size="lg" />
              </div>
              <h3 class="text-slate-900 font-bold text-base mb-1">{{ CATEGORY_LABELS[item.id] }}</h3>
              <p class="text-slate-500 text-xs md:text-sm leading-snug mb-2">{{ item.desc }}</p>
              <div class="flex items-center justify-between mt-auto">
                <span class="text-primary font-bold text-sm">{{ formatCount(stats[item.id] || 0) }}</span>
                <span class="text-slate-300 group-hover:text-primary group-hover:translate-x-1 transition-all duration-300 text-lg">→</span>
              </div>
            </a>
          </div>
        </div>
      </section>

      <!-- Recent Guides Section -->
      <section v-if="recentGuides.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">menu_book</span>
            생활 가이드
          </h2>
          <NuxtLink
            to="/guide"
            class="text-sm text-primary font-medium hover:underline flex items-center gap-1"
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

      <!-- Recent Reviews Section -->
      <section v-if="recentReviews.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2 mb-4">
          <span class="material-symbols-outlined text-primary">rate_review</span>
          최근 리뷰
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          <RecentReviewCard
            v-for="review in recentReviews"
            :key="review.id"
            :review="review"
          />
        </div>
      </section>

      <!-- Popular Regions Section (Desktop) -->
      <section class="hidden md:block w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8" role="region" aria-label="인기 지역">
        <div class="flex flex-col gap-4">
          <h2 class="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">trending_up</span>
            인기 지역
          </h2>
          <div class="flex flex-wrap gap-3">
            <NuxtLink
              v-for="region in popularRegions"
              :key="region.slug"
              :to="`/${region.slug}`"
              :data-testid="`region-${region.name}`"
              class="px-5 py-2.5 bg-white border border-slate-200 rounded-full text-sm font-medium text-slate-700 hover:bg-primary hover:border-primary hover:text-white transition-all shadow-sm"
            >
              {{ region.name }}
            </NuxtLink>
          </div>
        </div>
      </section>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { CategoryId } from '~/utils/categoryIcons'
import { CATEGORY_LABELS } from '~/utils/categoryIcons'
import { CATEGORY_GROUPS } from '~/types/facility'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useRecentReviews } from '~/composables/useReviews'
import { useGuides } from '~/composables/useGuides'
import type { GuideSummary } from '~/composables/useGuides'
import { useStructuredData } from '~/composables/useStructuredData'

const config = useRuntimeConfig()

// SEO 메타태그
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터
const { setWebsiteSchema } = useStructuredData()
setWebsiteSchema()

const searchKeyword = ref('')

// 최근 리뷰 (client-side fetch)
const { recentReviews, fetchRecentReviews } = useRecentReviews()

// 최근 가이드 (client-side fetch)
const { fetchRecentGuides } = useGuides()
const recentGuides = ref<GuideSummary[]>([])

onMounted(async () => {
  fetchRecentReviews()
  try {
    recentGuides.value = await fetchRecentGuides(4)
  } catch {
    // 가이드 로드 실패 시 무시
  }
})

// SSR: 통계 API를 useAsyncData로 fetch
const { data: statsResponse } = await useAsyncData('home-stats', () =>
  $fetch<{ success: boolean; data: Record<string, number> }>(
    '/api/meta/stats'
  )
)
const stats = computed(() => statsResponse.value?.data ?? {
  toilet: 0,
  wifi: 0,
  clothes: 0,
  kiosk: 0,
  trash: 0,
  parking: 0,
  aed: 0,
  library: 0,
  hospital: 0,
  pharmacy: 0,
  total: 0,
})

// 그룹별 합산 통계
const groupStats = computed(() => ({
  living: stats.value.toilet + stats.value.wifi + stats.value.parking + stats.value.kiosk,
  health: stats.value.hospital + stats.value.pharmacy + stats.value.aed,
  culture: stats.value.library + stats.value.clothes + stats.value.trash,
}))

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

// 카테고리 기본 정보
const categoryConfig: Array<{ id: CategoryId | 'all'; label: string; bgColor: string }> = [
  { id: 'all', label: '전체', bgColor: 'bg-slate-50' },
  { id: 'toilet', label: '화장실', bgColor: 'bg-purple-50' },
  { id: 'wifi', label: '와이파이', bgColor: 'bg-orange-50' },
  { id: 'clothes', label: '의류수거함', bgColor: 'bg-pink-50' },
  { id: 'kiosk', label: '발급기', bgColor: 'bg-indigo-50' },
  { id: 'parking', label: '주차장', bgColor: 'bg-sky-50' },
  { id: 'aed', label: 'AED', bgColor: 'bg-red-50' },
  { id: 'library', label: '도서관', bgColor: 'bg-amber-50' },
  { id: 'trash', label: '쓰레기', bgColor: 'bg-green-50' },
  { id: 'hospital', label: '병원', bgColor: 'bg-teal-50' },
  { id: 'pharmacy', label: '약국', bgColor: 'bg-emerald-50' },
]

// 카테고리 배경색 헬퍼
function getCategoryBgColor(id: CategoryId): string {
  const config = categoryConfig.find(c => c.id === id)
  return config?.bgColor || 'bg-slate-50'
}

// 카테고리별 호버 배경색
const categoryHoverBgMap: Record<string, string> = {
  toilet: 'bg-white hover:bg-purple-50',
  wifi: 'bg-white hover:bg-orange-50',
  parking: 'bg-white hover:bg-sky-50',
  kiosk: 'bg-white hover:bg-indigo-50',
  aed: 'bg-white hover:bg-red-50',
  library: 'bg-white hover:bg-amber-50',
  clothes: 'bg-white hover:bg-pink-50',
  trash: 'bg-white hover:bg-green-50',
  hospital: 'bg-white hover:bg-teal-50',
  pharmacy: 'bg-white hover:bg-emerald-50',
}

function getCategoryHoverBg(id: CategoryId): string {
  return categoryHoverBgMap[id] || 'bg-white'
}

// 카테고리별 설명 (홈페이지 전용)
const categoryDescriptions: Record<string, string> = {
  toilet: '급할 때 바로, 24시간 운영 포함',
  wifi: '비밀번호 없이 무료, 전국 핫스팟',
  parking: '민영보다 저렴한 공영주차장 요금 비교',
  kiosk: '주민센터 안 가도 OK, 주말도 운영',
  aed: '내 주변 AED 위치, 미리 알아두세요',
  library: '열람실 좌석·장서 정보, 휴관일 확인',
  clothes: '헌 옷 기부·재활용, 가까운 수거함',
  trash: '오늘 버려도 되나요? 배출 요일 확인',
  hospital: '오늘 진료 가능한 병원, 과목별 검색',
  pharmacy: '야간·주말 운영 약국 바로 찾기',
}

// 그룹화된 카테고리 (공유 상수 + 페이지 전용 desc)
const categoryGroups = CATEGORY_GROUPS.map(group => ({
  title: group.title,
  icon: group.icon,
  items: group.categories.map(id => ({
    id: id as CategoryId,
    desc: categoryDescriptions[id] || '',
  })),
}))

// 모바일용 인기 지역 (# 태그 형식)
const popularRegionsMobile = [
  { name: '강남', query: '강남' },
  { name: '홍대', query: '홍대' },
  { name: '신촌', query: '신촌' },
  { name: '명동', query: '명동' },
  { name: '이태원', query: '이태원' },
  { name: '건대입구', query: '건대입구' },
]

// 데스크톱용 인기 지역 (17개 시/도 허브 링크)
const popularRegions = [
  { name: '서울', slug: 'seoul' },
  { name: '경기', slug: 'gyeonggi' },
  { name: '부산', slug: 'busan' },
  { name: '대구', slug: 'daegu' },
  { name: '인천', slug: 'incheon' },
  { name: '광주', slug: 'gwangju' },
  { name: '대전', slug: 'daejeon' },
  { name: '울산', slug: 'ulsan' },
  { name: '세종', slug: 'sejong' },
  { name: '강원', slug: 'gangwon' },
  { name: '충북', slug: 'chungbuk' },
  { name: '충남', slug: 'chungnam' },
  { name: '전북', slug: 'jeonbuk' },
  { name: '전남', slug: 'jeonnam' },
  { name: '경북', slug: 'gyeongbuk' },
  { name: '경남', slug: 'gyeongnam' },
  { name: '제주', slug: 'jeju' },
]

function handleSearch() {
  if (!searchKeyword.value) {
    return
  }

  navigateTo(`/search?keyword=${encodeURIComponent(searchKeyword.value)}`)
}

function handleRegionClick(query: string, type: 'keyword' | 'city' = 'keyword') {
  if (type === 'city') {
    navigateTo(`/search?city=${encodeURIComponent(query)}`)
  } else {
    navigateTo(`/search?keyword=${encodeURIComponent(query)}`)
  }
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
