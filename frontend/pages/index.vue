<template>
  <div class="flex flex-col">
      <!-- Mobile Hero Section -->
      <section class="md:hidden flex flex-col gap-6 px-4 pb-8 pt-4 relative overflow-hidden">
        <!-- 배경 이미지 레이어 -->
        <div class="absolute inset-0 opacity-10 dark:opacity-[0.07]">
          <img src="/images/hero-bg-light.png" class="w-full h-full object-cover object-bottom dark:hidden" alt="" aria-hidden="true" />
          <img src="/images/hero-bg-dark.png" class="w-full h-full object-cover object-bottom hidden dark:block" alt="" aria-hidden="true" />
        </div>
        <!-- 하단 그라데이션 페이드 -->
        <div class="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent"></div>

        <!-- 콘텐츠 -->
        <div class="relative z-10 flex flex-col gap-6">
        <!-- Title & Subtitle -->
        <div class="flex flex-col gap-2 pt-4">
          <h1 class="text-[#111418] dark:text-white tracking-tight text-[32px] font-bold leading-[1.2]">
            내 주변 생활 편의 정보,<br />
            <span class="text-primary">한 번에 찾기</span>
          </h1>
          <p class="text-[#60708a] dark:text-slate-400 text-base font-normal leading-normal">
            지금 필요한 생활 시설을 검색해보세요.
          </p>
        </div>

        <!-- Search Bar (Mobile) -->
        <label class="flex flex-col h-14 w-full shadow-sm rounded-xl">
          <div class="flex w-full flex-1 items-stretch rounded-xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary transition-all">
            <div class="text-[#60708a] dark:text-slate-400 flex items-center justify-center pl-4 pr-2">
              <span class="material-symbols-outlined">search</span>
            </div>
            <input
              v-model="searchKeyword"
              aria-label="장소 또는 시설 검색"
              class="flex w-full min-w-0 flex-1 resize-none bg-transparent text-[#111418] dark:text-white placeholder:text-[#94a3b8] px-2 text-base font-medium leading-normal focus:outline-none border-none focus:ring-0 rounded-xl"
              placeholder="장소, 시설 검색..."
              @keydown.enter="handleSearch"
            />
          </div>
        </label>

        <!-- Hero Stats Banner (Mobile) -->
        <div class="flex justify-center gap-6 mt-2">
          <div class="text-center">
            <div class="text-2xl font-black text-primary">{{ formatStatCount(groupStats.living) }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">생활 편의</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-black text-primary">{{ formatStatCount(groupStats.health) }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">건강/안전</div>
          </div>
          <div class="text-center">
            <div class="text-2xl font-black text-primary">{{ formatStatCount(groupStats.culture) }}</div>
            <div class="text-xs text-slate-500 dark:text-slate-400">문화/환경</div>
          </div>
        </div>

        <!-- Popular Regions (Mobile) -->
        <div class="mt-4" role="region" aria-label="인기 지역">
          <h2 class="text-[#111418] dark:text-white text-lg font-bold leading-tight mb-4">인기 지역</h2>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="region in popularRegionsMobile"
              :key="region.name"
              :data-testid="`region-${region.name}`"
              class="px-4 py-2.5 bg-white dark:bg-[#1e293b] rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300 shadow-sm border border-slate-100 dark:border-slate-700 hover:border-primary/50 dark:hover:border-primary/50 hover:text-primary transition-colors"
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
        <!-- 배경 이미지 레이어 -->
        <div class="absolute inset-0 opacity-[0.08] dark:opacity-[0.05]">
          <img src="/images/hero-bg-light.png" class="w-full h-full object-cover object-bottom dark:hidden" alt="" aria-hidden="true" />
          <img src="/images/hero-bg-dark.png" class="w-full h-full object-cover object-bottom hidden dark:block" alt="" aria-hidden="true" />
        </div>
        <!-- 하단 그라데이션 페이드 -->
        <div class="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background-light dark:from-background-dark to-transparent"></div>

        <div class="relative z-10 max-w-3xl mx-auto flex flex-col gap-6 items-center text-center">
          <div class="space-y-4">
            <h1 class="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              내 주변 생활 편의 정보, 한 번에 찾기
            </h1>
            <p class="text-lg text-slate-600 dark:text-slate-400 font-normal">
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
              class="block w-full pl-12 pr-4 py-4 bg-white dark:bg-surface-dark border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
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
              <div class="text-sm text-slate-500 dark:text-slate-400">생활 편의</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-black text-primary">{{ formatStatCount(groupStats.health) }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400">건강/안전</div>
            </div>
            <div class="text-center">
              <div class="text-3xl font-black text-primary">{{ formatStatCount(groupStats.culture) }}</div>
              <div class="text-sm text-slate-500 dark:text-slate-400">문화/환경</div>
            </div>
          </div>
        </div>
      </section>

      <!-- Grouped Category Cards (Unified Responsive) -->
      <section class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div v-for="group in categoryGroups" :key="group.title" class="mb-8">
          <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
            <span class="material-symbols-outlined text-primary text-[24px]">{{ group.icon }}</span>
            {{ group.title }}
          </h2>
          <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
            <a
              v-for="item in group.items"
              :key="item.id"
              :href="`/${item.id}`"
              :aria-label="`${CATEGORY_LABELS[item.id]} - ${item.desc} - ${formatCount(stats[item.id] || 0)}`"
              class="group flex flex-col p-4 md:p-5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
            >
              <div :class="`w-12 h-12 rounded-full ${getCategoryBgColor(item.id)} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`">
                <CategoryIcon :category-id="item.id" size="lg" />
              </div>
              <h3 class="text-slate-900 dark:text-white font-bold text-base mb-1">{{ CATEGORY_LABELS[item.id] }}</h3>
              <p class="text-slate-500 dark:text-slate-400 text-xs md:text-sm leading-snug mb-2">{{ item.desc }}</p>
              <span class="text-primary font-bold text-sm mt-auto">{{ formatCount(stats[item.id] || 0) }}</span>
            </a>
          </div>
        </div>
      </section>

      <!-- Recent Reviews Section -->
      <section v-if="recentReviews.length > 0" class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
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
          <h2 class="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <span class="material-symbols-outlined text-primary">trending_up</span>
            인기 지역
          </h2>
          <div class="flex flex-wrap gap-3">
            <button
              v-for="region in popularRegions"
              :key="region.name"
              :data-testid="`region-${region.name}`"
              class="px-5 py-2.5 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-700 rounded-full text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-primary hover:border-primary hover:text-white dark:hover:bg-primary dark:hover:border-primary dark:hover:text-white transition-all shadow-sm"
              @click="handleRegionClick(region.query, 'city')"
            >
              {{ region.name }}
            </button>
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
import { useStructuredData } from '~/composables/useStructuredData'

// SEO 메타태그
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터
const { setWebsiteSchema } = useStructuredData()
setWebsiteSchema()

const config = useRuntimeConfig()
const searchKeyword = ref('')

// 최근 리뷰 (client-side fetch)
const { recentReviews, fetchRecentReviews } = useRecentReviews()
onMounted(() => {
  fetchRecentReviews()
})

// SSR: 통계 API를 useAsyncData로 fetch
const { data: statsResponse } = await useAsyncData('home-stats', () =>
  $fetch<{ success: boolean; data: Record<string, number> }>(
    `${config.public.apiBase}/api/meta/stats`
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
  return count.toLocaleString('ko-KR') + '개'
}

// 통계 배너용 포맷 (1000 단위 반올림)
function formatStatCount(count: number): string {
  if (count === 0) return '-'
  const rounded = Math.floor(count / 1000) * 1000
  return rounded.toLocaleString('ko-KR') + '+'
}

// 카테고리 기본 정보
const categoryConfig: Array<{ id: CategoryId | 'all'; label: string; bgColor: string }> = [
  { id: 'all', label: '전체', bgColor: 'bg-slate-50 dark:bg-slate-700' },
  { id: 'toilet', label: '화장실', bgColor: 'bg-purple-50 dark:bg-purple-900/30' },
  { id: 'wifi', label: '와이파이', bgColor: 'bg-orange-50 dark:bg-orange-900/30' },
  { id: 'clothes', label: '의류수거함', bgColor: 'bg-pink-50 dark:bg-pink-900/30' },
  { id: 'kiosk', label: '발급기', bgColor: 'bg-indigo-50 dark:bg-indigo-900/30' },
  { id: 'parking', label: '주차장', bgColor: 'bg-sky-50 dark:bg-sky-900/30' },
  { id: 'aed', label: 'AED', bgColor: 'bg-red-50 dark:bg-red-900/30' },
  { id: 'library', label: '도서관', bgColor: 'bg-amber-50 dark:bg-amber-900/30' },
  { id: 'trash', label: '쓰레기', bgColor: 'bg-green-50 dark:bg-green-900/30' },
  { id: 'hospital', label: '병원', bgColor: 'bg-teal-50 dark:bg-teal-900/30' },
  { id: 'pharmacy', label: '약국', bgColor: 'bg-emerald-50 dark:bg-emerald-900/30' },
]

// 카테고리 배경색 헬퍼
function getCategoryBgColor(id: CategoryId): string {
  const config = categoryConfig.find(c => c.id === id)
  return config?.bgColor || 'bg-slate-50 dark:bg-slate-700'
}

// 카테고리별 설명 (홈페이지 전용)
const categoryDescriptions: Record<string, string> = {
  toilet: '전국 공공화장실 위치 정보',
  wifi: '무료 무선 인터넷 존',
  parking: '공영 주차 시설 안내',
  kiosk: '무인 민원 서류 발급',
  aed: '자동심장충격기 위치',
  library: '공공도서관 이용 안내',
  clothes: '의류 수거함 위치 안내',
  trash: '쓰레기 배출 일정 및 장소',
  hospital: '병원 및 의원 진료 안내',
  pharmacy: '약국 위치 및 운영 정보',
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

// 데스크톱용 인기 지역
const popularRegions = [
  { name: '서울', query: '서울' },
  { name: '경기', query: '경기' },
  { name: '부산', query: '부산' },
  { name: '대구', query: '대구' },
  { name: '인천', query: '인천' },
  { name: '광주', query: '광주' },
  { name: '대전', query: '대전' },
  { name: '울산', query: '울산' },
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
