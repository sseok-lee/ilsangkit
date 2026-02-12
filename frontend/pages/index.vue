<template>
  <div class="flex flex-col">
      <!-- Mobile Hero Section -->
      <section class="md:hidden flex flex-col gap-6 px-4 pb-8 pt-4">
        <!-- Title & Subtitle -->
        <div class="flex flex-col gap-2 pt-4">
          <h1 class="text-[#111418] dark:text-white tracking-tight text-[32px] font-bold leading-[1.2]">
            내 주변 생활 편의 정보,<br />
            <span class="text-primary">한 번에 찾기</span>
          </h1>
          <p class="text-[#60708a] dark:text-slate-400 text-base font-normal leading-normal">
            화장실부터 와이파이까지, 일상킷이 도와드려요.
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
              class="flex w-full min-w-0 flex-1 resize-none bg-transparent text-[#111418] dark:text-white placeholder:text-[#94a3b8] px-2 text-base font-medium leading-normal focus:outline-none border-none focus:ring-0 rounded-xl"
              placeholder="장소, 시설 검색..."
              @keydown.enter="handleSearch"
            />
          </div>
        </label>

        <!-- Category Chips (Mobile - Horizontal Scroll) -->
        <div class="w-full overflow-hidden">
          <div class="flex gap-3 overflow-x-auto no-scrollbar pb-1">
            <button
              v-for="category in categories"
              :key="category.id"
              :class="[
                'flex h-10 shrink-0 items-center justify-center gap-x-2 rounded-xl pl-3 pr-4 shadow-sm active:scale-95 transition-transform',
                category.id === 'toilet'
                  ? 'bg-primary text-white'
                  : 'bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800'
              ]"
              @click="navigateTo(`/search?category=${category.id}`)"
            >
              <CategoryIcon :category-id="category.id" size="sm" />
              <span :class="category.id === 'toilet' ? 'text-sm font-bold leading-normal' : 'text-[#111418] dark:text-slate-200 text-sm font-medium leading-normal'">
                {{ category.label }}
              </span>
            </button>
          </div>
        </div>

        <!-- Primary CTA (Mobile) -->
        <div class="pt-2">
          <button
            data-testid="location-button"
            class="relative w-full h-14 bg-primary rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-blue-500/30 hover:bg-blue-600 active:scale-[0.98] transition-all group overflow-hidden"
            @click="handleLocationSearch"
          >
            <!-- Subtle gradient overlay -->
            <div class="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span class="material-symbols-outlined text-white">my_location</span>
            <span class="text-white text-lg font-bold">현재 위치로 검색</span>
          </button>
        </div>

        <!-- Popular Regions (Mobile) -->
        <div class="mt-4">
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

        <!-- Map Placeholder (Mobile) -->
        <div class="mt-4 flex-1 min-h-[160px] w-full rounded-2xl bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-slate-700 overflow-hidden relative">
          <div class="absolute inset-0 bg-[url('/images/map-bg.webp')] bg-cover bg-center opacity-60 dark:opacity-40"></div>
          <div class="absolute inset-0 bg-gradient-to-t from-white/90 via-white/50 to-transparent dark:from-[#1e293b]/90 dark:via-[#1e293b]/50"></div>
          <div class="absolute bottom-4 left-4 right-4 text-center">
            <p class="text-sm text-slate-600 dark:text-slate-300 font-medium">지금 내 주변 350+개 편의시설 검색 가능</p>
          </div>
        </div>
      </section>

      <!-- Desktop Hero Section -->
      <section class="hidden md:block w-full pt-16 pb-12 px-4 sm:px-6">
        <div class="max-w-3xl mx-auto flex flex-col gap-6 items-center text-center">
          <div class="space-y-4">
            <h1 class="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
              내 주변 생활 편의 정보, 한 번에 찾기
            </h1>
            <p class="text-lg text-slate-600 dark:text-slate-400 font-normal">
              화장실부터 와이파이까지, 지금 필요한 시설을 검색해보세요.
            </p>
          </div>
          <!-- Search Input Component (Desktop) -->
          <div class="w-full max-w-[560px] relative group mt-4">
            <div class="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-primary transition-colors">
              <span class="material-symbols-outlined text-[24px]">search</span>
            </div>
            <input
              v-model="searchKeyword"
              class="block w-full pl-12 pr-4 py-4 bg-white dark:bg-surface-dark border-2 border-slate-200 dark:border-slate-700 rounded-2xl text-base text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-sm hover:border-slate-300 dark:hover:border-slate-600"
              placeholder="장소, 시설 검색..."
              type="text"
              @keydown.enter="handleSearch"
            />
            <div class="absolute inset-y-2 right-2">
              <button
                data-testid="location-button"
                class="h-full px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
                @click="handleLocationSearch"
              >
                <span>현재 위치로 검색</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      <!-- Category Grid Section (Desktop) -->
      <section class="hidden md:block w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-9 gap-4">
          <a
            v-for="category in categoriesDesktop"
            :key="category.id"
            :href="`/search?category=${category.id}`"
            class="group flex flex-col items-center justify-center p-6 bg-white dark:bg-surface-dark border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
          >
            <div :class="`w-14 h-14 rounded-full ${category.bgColor} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`">
              <CategoryIcon v-if="category.id !== 'all'" :category-id="category.id" size="lg" />
              <span v-else class="material-symbols-outlined text-slate-600 dark:text-slate-300 text-[28px]">apps</span>
            </div>
            <h2 class="text-slate-900 dark:text-white font-bold text-lg mb-1">{{ category.label }}</h2>
            <p class="text-slate-500 dark:text-slate-400 text-sm font-medium">{{ category.count }}</p>
          </a>
        </div>
      </section>

      <!-- Popular Regions Section (Desktop) -->
      <section class="hidden md:block w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
              @click="handleRegionClick(region.query)"
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
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'

// SEO 메타태그
const { setHomeMeta } = useFacilityMeta()
setHomeMeta()

// JSON-LD 구조화된 데이터
const { setWebsiteSchema } = useStructuredData()
setWebsiteSchema()

const config = useRuntimeConfig()
const searchKeyword = ref('')

// 카테고리별 시설 개수 통계
const stats = ref<Record<string, number>>({
  toilet: 0,
  wifi: 0,
  clothes: 0,
  kiosk: 0,
  trash: 0,
  parking: 0,
  aed: 0,
  library: 0,
  total: 0,
})

// 통계 API 호출
onMounted(async () => {
  try {
    const response = await $fetch<{ success: boolean; data: Record<string, number> }>(
      `${config.public.apiBase}/api/meta/stats`
    )
    if (response.success) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('Failed to fetch stats:', error)
  }
})

// 숫자 포맷 함수
function formatCount(count: number): string {
  return count.toLocaleString('ko-KR') + '개'
}

// 모바일용 카테고리 (가로 스크롤 칩)
const categories: Array<{ id: CategoryId; label: string }> = [
  { id: 'toilet', label: '화장실' },
  { id: 'wifi', label: '와이파이' },
  { id: 'clothes', label: '의류수거함' },
  { id: 'kiosk', label: '발급기' },
  { id: 'parking', label: '주차장' },
  { id: 'aed', label: 'AED' },
  { id: 'library', label: '도서관' },
  { id: 'trash', label: '쓰레기' },
]

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
]

// 데스크톱용 카테고리 (그리드 카드) - 실제 데이터 연동
const categoriesDesktop = computed(() =>
  categoryConfig.map(cat => ({
    ...cat,
    count: formatCount(cat.id === 'all' ? stats.value.total : stats.value[cat.id] || 0),
  }))
)

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

function handleLocationSearch() {
  // Navigate to search page which will request location
  navigateTo('/search?useLocation=true')
}

function handleRegionClick(query: string) {
  navigateTo(`/search?keyword=${encodeURIComponent(query)}`)
}
</script>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Hide scrollbar for Chrome, Safari and Opera */
.no-scrollbar::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for IE, Edge and Firefox */
.no-scrollbar {
  -ms-overflow-style: none; /* IE and Edge */
  scrollbar-width: none; /* Firefox */
}

/* Fill icon for active bottom nav */
.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
