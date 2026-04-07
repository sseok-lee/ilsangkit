<template>
  <div class="bg-background-light text-slate-900 font-display min-h-screen">
    <!-- Mobile Search Bar -->
    <header class="md:hidden sticky top-0 z-30 bg-background-light/95 backdrop-blur-md transition-colors duration-200">
      <div class="px-4 py-3">
        <div class="relative group">
          <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <span class="material-symbols-outlined text-slate-500 text-[20px]">search</span>
          </div>
          <input
            v-model="searchKeyword"
            aria-label="시설 검색"
            class="w-full bg-white border-none rounded-2xl py-3 pl-10 pr-10 text-slate-900 placeholder-slate-400 focus:ring-2 focus:ring-primary/20 shadow-sm text-base font-medium"
            type="text"
            placeholder="장소를 검색하세요..."
            @keyup.enter="handleSearch"
          />
          <button
            v-if="searchKeyword"
            aria-label="검색어 지우기"
            class="absolute inset-y-0 right-3 flex items-center cursor-pointer"
            @click="clearSearch"
          >
            <span class="material-symbols-outlined text-slate-500 hover:text-slate-600 text-[20px]">cancel</span>
          </button>
        </div>
      </div>
    </header>

    <!-- Main Content -->
    <div class="max-w-6xl mx-auto px-4 md:px-6 py-4">
      <!-- Desktop Search Bar (replaces removed custom header) -->
      <div class="hidden md:block mb-4">
        <div class="flex items-center gap-3 bg-white rounded-xl p-3 shadow-sm border border-slate-200">
          <div class="flex-1 relative">
            <div class="absolute inset-y-0 left-3 flex items-center pointer-events-none">
              <span class="material-symbols-outlined text-slate-500 text-[20px]">search</span>
            </div>
            <input
              v-model="searchKeyword"
              aria-label="시설 검색"
              class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 pl-10 pr-10 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary"
              type="text"
              placeholder="장소를 검색하세요..."
              @keyup.enter="handleSearch"
            />
            <button
              v-if="searchKeyword"
              aria-label="검색어 지우기"
              class="absolute inset-y-0 right-3 flex items-center cursor-pointer"
              @click="clearSearch"
            >
              <span class="material-symbols-outlined text-slate-500 hover:text-slate-600 text-[20px]">cancel</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div
        v-if="error"
        role="alert"
        class="p-5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm mb-4"
      >
        {{ error }}
      </div>

      <!-- Region Filter Card -->
      <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-4">
        <div class="flex items-center gap-2 mb-3 md:hidden">
          <span class="material-symbols-outlined text-amber-500 text-[20px]">location_city</span>
          <span class="font-semibold text-slate-900 text-sm">지역 선택</span>
        </div>
        <div class="flex flex-col md:flex-row gap-3">
          <!-- 시/도 선택 -->
          <div class="flex-1">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">시/도</label>
            <div class="relative">
              <select
                v-model="selectedCity"
                aria-label="시/도 선택"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
                @change="handleCityChange"
              >
                <option value="">시/도 선택</option>
                <option v-for="city in cities" :key="city" :value="city">{{ city }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
          <!-- 구/군 선택 -->
          <div class="flex-1">
            <label class="block text-xs font-medium text-slate-600 mb-1 hidden md:block">구/군</label>
            <div class="relative">
              <select
                v-model="selectedDistrict"
                :disabled="!selectedCity"
                aria-label="구/군 선택"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                @change="handleDistrictChange"
              >
                <option value="">구/군 선택</option>
                <option v-for="dist in districts" :key="dist" :value="dist">{{ dist }}</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 데이터 의존 영역: isMounted 가드로 hydration mismatch 방지 -->
      <template v-if="isMounted">
      <!-- 시설/부동산 탭 -->
      <div v-if="groupedResults.length > 0 || realEstateResults.length > 0" class="flex gap-2 mb-4">
        <button
          :class="[
            'px-4 py-2 rounded-full text-sm font-semibold transition-colors border',
            searchTab === 'all'
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
          ]"
          @click="searchTab = 'all'"
        >
          전체
        </button>
        <button
          :class="[
            'px-4 py-2 rounded-full text-sm font-semibold transition-colors border',
            searchTab === 'realEstate'
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
            realEstateResults.length === 0 ? 'opacity-50 cursor-not-allowed' : '',
          ]"
          :disabled="realEstateResults.length === 0"
          @click="searchTab = 'realEstate'"
        >
          부동산
        </button>
        <button
          :class="[
            'px-4 py-2 rounded-full text-sm font-semibold transition-colors border',
            searchTab === 'facility'
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
            groupedResults.length === 0 ? 'opacity-50 cursor-not-allowed' : '',
          ]"
          :disabled="groupedResults.length === 0"
          @click="searchTab = 'facility'"
        >
          생활시설
        </button>
      </div>

      <!-- 통합 Category Chip Bar -->
      <div v-if="groupedResults.length > 0 || selectedCategory || realEstateResults.length > 0" class="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4">
        <!-- 전체 버튼 -->
        <button
          :class="[
            'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border',
            !selectedCategory && !selectedRealEstateType
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
          ]"
          @click="clearChipFilter"
        >
          전체
        </button>
        <!-- 부동산 유형 chips (전체/부동산 탭) -->
        <template v-if="searchTab !== 'facility' && realEstateResults.length > 0">
          <button
            v-for="group in realEstateGrouped"
            :key="group.propertyType"
            :class="[
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5',
              selectedRealEstateType === group.propertyType
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
            ]"
            @click="selectRealEstateType(group.propertyType)"
          >
            <img :src="`/icons/category/${group.iconImg}.webp?v2`" :alt="group.label" class="w-4 h-4" width="16" height="16" />
            {{ group.label }}
          </button>
        </template>
        <!-- 시설 카테고리 chips (전체/시설 탭) -->
        <template v-if="searchTab !== 'realEstate'">
          <button
            v-for="group in sortedGroupedResults"
            :key="group.category"
            :class="[
              'shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors border flex items-center gap-1.5',
              selectedCategory === group.category
                ? 'bg-primary text-white border-primary'
                : 'bg-white text-slate-600 border-slate-200 hover:border-primary/40',
            ]"
            @click="selectCategory(group.category)"
          >
            <img :src="`/icons/category/${group.category}.webp?v2`" :alt="group.label" class="w-4 h-4" width="16" height="16" />
            {{ CATEGORY_META[group.category]?.shortLabel || group.label }}
          </button>
        </template>
      </div>

      <!-- Results count -->
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-slate-900 text-base font-bold">
          {{ searchTitle }}
        </h1>
        <span class="text-xs text-slate-500 font-medium">{{ displayTotalCount }}건</span>
      </div>

      <!-- Loading Skeleton -->
      <div v-if="loading" aria-live="polite" aria-busy="true">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
            <div class="flex items-start gap-4">
              <div class="shrink-0 w-12 h-12 rounded-full bg-slate-200"></div>
              <div class="flex-1 space-y-2.5">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-100 rounded w-full"></div>
                <div class="flex gap-2 mt-1">
                  <div class="h-5 bg-slate-100 rounded-md w-14"></div>
                  <div class="h-5 bg-slate-100 rounded-md w-20"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-else aria-live="polite">
        <!-- 부동산 페이징 뷰 (유형 선택 시) -->
        <template v-if="selectedRealEstateType && searchTab !== 'facility'">
          <div v-if="reLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
              <div class="space-y-2.5">
                <div class="h-4 bg-slate-200 rounded w-3/4"></div>
                <div class="h-3 bg-slate-100 rounded w-full"></div>
                <div class="h-3 bg-slate-100 rounded w-1/2"></div>
              </div>
            </div>
          </div>
          <div v-else-if="reComplexItems.length > 0">
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <NuxtLink
                v-for="item in reComplexItems"
                :key="`${item.buildingName}-${item.bjdCode}`"
                :to="`/real-estate/${selectedRealEstateType}/${encodeURIComponent(item.buildingName)}?bjdCode=${item.bjdCode}`"
                class="bg-white rounded-xl p-4 border border-slate-200 hover:border-primary/30 hover:shadow-sm transition-all"
              >
                <div class="flex items-start gap-3">
                  <img :src="`/icons/category/${selectedRealEstateType}.webp?v2`" :alt="RE_PROPERTY_META[selectedRealEstateType]?.label" class="w-10 h-10 shrink-0" width="40" height="40" />
                  <div class="flex-1 min-w-0">
                    <p class="font-semibold text-slate-800 text-sm truncate">{{ item.buildingName }}</p>
                    <p class="text-xs text-slate-500 mt-0.5 truncate">{{ item.city }} {{ item.district }} {{ item.dongName }}</p>
                    <div class="flex items-center gap-2 mt-2">
                      <span v-if="item.latestPrice" class="text-xs font-semibold text-primary">{{ formatRealEstatePrice(item.latestPrice) }}</span>
                      <span class="text-[10px] text-slate-500">거래 {{ item.transactionCount }}건</span>
                    </div>
                  </div>
                </div>
              </NuxtLink>
            </div>
            <Pagination :current-page="reCurrentPage" :total-pages="reTotalPages" @page-change="goToRealEstatePage" />
          </div>
          <div v-else class="py-16 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-[32px] text-slate-500">search_off</span>
            </div>
            <p class="text-slate-700 font-semibold text-lg">검색 결과가 없습니다</p>
          </div>
        </template>

        <!-- 부동산 그룹 뷰 (유형 미선택 시) -->
        <div v-else-if="!selectedCategory && realEstateResults.length > 0 && searchTab !== 'facility'" class="mb-6 bg-white rounded-xl p-5 shadow-sm border border-slate-200">
          <div class="flex items-center gap-2 mb-5">
            <span class="material-symbols-outlined text-primary text-[22px]">apartment</span>
            <h2 class="text-slate-900 text-base font-bold">부동산 실거래가</h2>
          </div>
          <div class="space-y-5">
            <div v-for="group in realEstateGrouped" :key="group.propertyType">
              <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                  <img :src="`/icons/category/${group.iconImg}.webp?v2`" :alt="group.label" class="w-6 h-6" width="24" height="24" />
                  <h3 class="text-slate-800 text-sm font-bold">{{ group.label }}</h3>
                </div>
                <button
                  class="text-primary text-xs font-medium hover:underline flex items-center gap-0.5"
                  @click="selectRealEstateType(group.propertyType)"
                >
                  더보기
                  <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
              <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <NuxtLink
                  v-for="item in group.items.slice(0, 3)"
                  :key="`${item.type}-${item.buildingName}-${item.bjdCode}`"
                  :to="`/real-estate/${item.propertyType}/${encodeURIComponent(item.buildingName)}?bjdCode=${item.bjdCode}&tab=${item.tab}`"
                  class="p-3 rounded-lg border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                >
                  <p class="font-medium text-slate-800 text-sm truncate">{{ item.buildingName }}</p>
                  <div class="flex items-center gap-2 mt-1">
                    <span :class="[
                      'px-1.5 py-0.5 rounded-full text-[10px] font-medium',
                      item.tab === 'sale' ? 'bg-primary/10 text-primary' : 'bg-slate-100 text-slate-500',
                    ]">{{ item.tab === 'sale' ? '매매' : '전월세' }}</span>
                    <span v-if="item.dealAmount" class="text-xs font-semibold text-primary ml-auto">{{ formatRealEstatePrice(item.dealAmount) }}</span>
                  </div>
                  <p v-if="item.city" class="text-xs text-slate-500 mt-0.5 truncate">{{ item.city }} {{ item.district }}</p>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>

        <!-- Grouped View (섹션별 묶음) -->
        <div v-if="!selectedCategory && groupedResults.length > 0 && searchTab !== 'realEstate'" class="space-y-6">
          <div
            v-for="section in facilityGroupedBySection"
            :key="section.title"
            class="bg-white rounded-xl p-5 shadow-sm border border-slate-200"
          >
            <!-- Section Header -->
            <div class="flex items-center gap-2 mb-5">
              <span class="material-symbols-outlined text-primary text-[22px]">{{ section.icon }}</span>
              <h2 class="text-slate-900 text-base font-bold">{{ section.title }}</h2>
            </div>
            <!-- 카테고리별 서브 섹션 -->
            <div class="space-y-5">
              <div v-for="group in section.items" :key="group.category">
                <div class="flex items-center justify-between mb-3">
                  <div class="flex items-center gap-2">
                    <img :src="`/icons/category/${group.category}.webp?v2`" :alt="group.label" class="w-6 h-6" width="24" height="24" />
                    <h3 class="text-slate-800 text-sm font-bold">{{ group.label }}</h3>
                  </div>
                  <button
                    class="text-primary text-xs font-medium hover:underline flex items-center gap-0.5"
                    @click="selectCategory(group.category)"
                  >
                    더보기
                    <span class="material-symbols-outlined text-[14px]">arrow_forward</span>
                  </button>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <NuxtLink
                    v-for="facility in group.items"
                    :key="facility.id"
                    :to="`/${facility.category}/${facility.id}`"
                    class="p-3 rounded-lg border border-slate-100 hover:border-primary/30 hover:bg-primary/5 transition-colors"
                  >
                    <p class="font-medium text-slate-800 text-sm truncate">{{ facility.name }}</p>
                    <div class="flex items-center gap-2 mt-1">
                      <span class="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                        {{ CATEGORY_META[facility.category]?.shortLabel || CATEGORY_META[facility.category]?.label }}
                      </span>
                    </div>
                    <p v-if="facility.roadAddress || facility.address" class="text-xs text-slate-500 mt-0.5 truncate">
                      {{ facility.roadAddress || facility.address }}
                    </p>
                  </NuxtLink>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Flat View (category selected) -->
        <template v-if="selectedCategory && searchTab !== 'realEstate'">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <FacilityCard
              v-for="facility in facilities"
              :key="facility.id"
              :facility="facility"
            />
          </div>

          <!-- Empty State (flat view) -->
          <div v-if="facilities.length === 0" class="py-16 text-center">
            <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span class="material-symbols-outlined text-[32px] text-slate-500">search_off</span>
            </div>
            <p class="text-slate-700 font-semibold text-lg">검색 결과가 없습니다</p>
            <p class="text-slate-500 text-sm mt-1 mb-6">다른 검색어를 입력해보세요</p>
            <div class="flex items-center justify-center gap-3">
              <button
                v-if="searchKeyword"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
                @click="clearSearch"
              >
                <span class="material-symbols-outlined text-[16px]">refresh</span>
                검색 초기화
              </button>
              <NuxtLink
                to="/"
                class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
              >
                <span class="material-symbols-outlined text-[16px]">home</span>
                홈으로 돌아가기
              </NuxtLink>
            </div>
          </div>

          <!-- Pagination -->
          <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
        </template>

        <!-- Empty State (grouped view) -->
        <div v-if="!selectedCategory && groupedResults.length === 0 && realEstateResults.length === 0" class="py-16 text-center">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
            <span class="material-symbols-outlined text-[32px] text-slate-500">search_off</span>
          </div>
          <p class="text-slate-700 font-semibold text-lg">검색 결과가 없습니다</p>
          <p class="text-slate-500 text-sm mt-1 mb-5">다른 검색어를 입력해보세요</p>
          <div class="flex flex-wrap items-center justify-center gap-2 mb-6">
            <NuxtLink
              v-for="cat in ['toilet', 'hospital', 'parking', 'pharmacy']"
              :key="cat"
              :to="`/${cat}`"
              class="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-50 border border-slate-200 text-slate-600 rounded-full text-xs font-medium hover:border-primary/40 hover:text-primary transition-colors"
            >
              <span class="material-symbols-outlined text-[14px]">{{ CATEGORY_META[cat as keyof typeof CATEGORY_META]?.icon }}</span>
              {{ CATEGORY_META[cat as keyof typeof CATEGORY_META]?.label }}
            </NuxtLink>
          </div>
          <NuxtLink
            to="/"
            class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors"
          >
            <span class="material-symbols-outlined text-[16px]">home</span>
            홈으로 돌아가기
          </NuxtLink>
        </div>
      </div>
      </template>

      <!-- SSR 스켈레톤: isMounted 전까지 표시 -->
      <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
          <div class="flex items-start gap-4">
            <div class="shrink-0 w-12 h-12 rounded-full bg-slate-200"></div>
            <div class="flex-1 space-y-2.5">
              <div class="h-4 bg-slate-200 rounded w-3/4"></div>
              <div class="h-3 bg-slate-100 rounded w-full"></div>
              <div class="flex gap-2 mt-1">
                <div class="h-5 bg-slate-100 rounded-md w-14"></div>
                <div class="h-5 bg-slate-100 rounded-md w-20"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useFacilitySearch } from '~/composables/useFacilitySearch'
import { useRealEstate } from '~/composables/useRealEstate'
import { useWasteSchedule } from '~/composables/useWasteSchedule'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'
import type { FacilityCategory } from '~/types/facility'
import type { RealEstateType, ComplexInfo } from '~/types/realEstate'

const route = useRoute()
const { searchAll: searchRealEstate, getComplexList } = useRealEstate()
const { setSearchMeta } = useFacilityMeta()
const { setItemListSchema } = useStructuredData()

// Search State
const {
  loading, facilities, total, currentPage, totalPages, error,
  groupedResults, groupedTotalCount,
  search, searchGrouped, resetPage, setPage,
} = useFacilitySearch()

// Region dropdowns (reuse waste schedule API for city/district lists)
const { getCities, getDistricts } = useWasteSchedule()

const selectedCity = ref('')
const selectedDistrict = ref('')
const cities = ref<string[]>([])
const districts = ref<string[]>([])

// Hydration guard: SSR과 클라이언트가 동일한 초기 HTML을 렌더링하도록 보장
const isMounted = ref(false)

// UI State
const searchKeyword = ref('')
const selectedCategory = ref<FacilityCategory | null>(null)
const searchTab = ref<'all' | 'facility' | 'realEstate'>('all')
interface RealEstateResultCategory {
  type: RealEstateType
  count: number
  items: Array<{ buildingName: string; bjdCode: string; [key: string]: unknown }>
}
const realEstateResults = ref<RealEstateResultCategory[]>([])

const RE_TYPE_LABELS: Record<string, string> = {
  'apt-sale': '아파트 매매', 'apt-rent': '아파트 전월세',
  'villa-sale': '빌라 매매', 'villa-rent': '빌라 전월세',
  'offitel-sale': '오피스텔 매매', 'offitel-rent': '오피스텔 전월세',
}

// 시설 그룹 결과를 개수 내림차순 정렬
const sortedGroupedResults = computed(() =>
  [...groupedResults.value].sort((a, b) => b.count - a.count)
)

// 시설 카테고리를 CATEGORY_GROUPS 섹션별로 묶기 (chip bar + 결과 뷰 공용)
const chipGroupedBySection = computed(() => {
  const resultMap = new Map(groupedResults.value.map(g => [g.category, g]))
  return CATEGORY_GROUPS
    .map(section => ({
      title: section.title,
      items: section.categories
        .filter(cat => resultMap.has(cat))
        .map(cat => resultMap.get(cat)!)
        .sort((a, b) => b.count - a.count),
    }))
    .filter(section => section.items.length > 0)
})

// 시설 결과를 섹션별로 묶기 (결과 뷰용, 아이콘 포함)
const facilityGroupedBySection = computed(() => {
  const resultMap = new Map(groupedResults.value.map(g => [g.category, g]))
  return CATEGORY_GROUPS
    .map(section => {
      const items = section.categories
        .filter(cat => resultMap.has(cat))
        .map(cat => resultMap.get(cat)!)
        .sort((a, b) => b.count - a.count)
      return {
        title: section.title,
        icon: section.icon,
        items,
        totalCount: items.reduce((sum, g) => sum + g.count, 0),
      }
    })
    .filter(section => section.items.length > 0)
})

// 부동산 결과를 건물유형별(apt/villa/offitel)로 재그룹
type RealEstatePreviewItem = { type: string; buildingName: string; bjdCode: string; propertyType: string; tab: string; typeLabel: string; dealAmount: number | null; city: string; district: string }
const RE_PROPERTY_META: Record<string, { label: string; iconImg: string }> = {
  apt: { label: '아파트', iconImg: 'apt' },
  villa: { label: '빌라', iconImg: 'villa' },
  offitel: { label: '오피스텔', iconImg: 'offitel' },
}

const realEstateGrouped = computed(() => {
  const map = new Map<string, { propertyType: string; label: string; iconImg: string; items: RealEstatePreviewItem[]; totalCount: number }>()
  for (const cat of realEstateResults.value) {
    const propertyType = cat.type.replace(/-(?:sale|rent)$/, '')
    const tab = cat.type.endsWith('-rent') ? 'rent' : 'sale'
    const priceKey = tab === 'sale' ? 'dealAmount' : 'deposit'
    if (!map.has(propertyType)) {
      const meta = RE_PROPERTY_META[propertyType] || { label: propertyType, iconImg: 'apt' }
      map.set(propertyType, { propertyType, label: meta.label, iconImg: meta.iconImg, items: [], totalCount: 0 })
    }
    const group = map.get(propertyType)!
    group.totalCount += cat.count
    for (const item of cat.items) {
      group.items.push({
        type: cat.type,
        buildingName: item.buildingName,
        bjdCode: item.bjdCode,
        propertyType,
        tab,
        typeLabel: RE_TYPE_LABELS[cat.type] || cat.type,
        dealAmount: (item[priceKey] as number) ?? null,
        city: (item.city as string) || '',
        district: (item.district as string) || '',
      })
    }
  }
  return [...map.values()]
})

// 부동산 탭 유형 필터
const selectedRealEstateType = ref('')
const reComplexItems = ref<ComplexInfo[]>([])
const reCurrentPage = ref(1)
const reTotalPages = ref(0)
const reTotal = ref(0)
const reLoading = ref(false)

const rePaginationRange = computed(() => {
  const total = reTotalPages.value
  const current = reCurrentPage.value
  const delta = 2
  const range: number[] = []
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i)
  }
  return range
})

const filteredRealEstateGrouped = computed(() => {
  if (!selectedRealEstateType.value) return realEstateGrouped.value
  return realEstateGrouped.value.filter(g => g.propertyType === selectedRealEstateType.value)
})

async function searchRealEstatePaged(propertyType: string, page: number = 1) {
  reLoading.value = true
  try {
    const type = `${propertyType}-sale` as RealEstateType
    const result = await getComplexList(
      type,
      selectedCity.value || undefined,
      selectedDistrict.value || undefined,
      searchKeyword.value || undefined,
      page,
      20
    )
    reComplexItems.value = result.items
    reCurrentPage.value = result.page
    reTotalPages.value = result.totalPages
    reTotal.value = result.total
  } catch {
    reComplexItems.value = []
    reTotalPages.value = 0
    reTotal.value = 0
  } finally {
    reLoading.value = false
  }
}

function formatRealEstatePrice(amount: number): string {
  const uk = Math.floor(amount / 10000)
  const man = amount % 10000
  if (uk > 0 && man > 0) return `${uk}억 ${man.toLocaleString()}만원`
  if (uk > 0) return `${uk}억`
  return `${amount.toLocaleString()}만원`
}

// Computed
const searchTitle = computed(() => {
  const categoryLabel = selectedCategory.value
    ? CATEGORY_META[selectedCategory.value]?.label
    : null

  if (searchKeyword.value && categoryLabel) {
    return `"${searchKeyword.value}" ${categoryLabel} 검색 결과`
  }
  if (searchKeyword.value) {
    return `"${searchKeyword.value}" 검색 결과`
  }
  if (categoryLabel) {
    return `${categoryLabel} 검색 결과`
  }
  if (selectedCity.value || selectedDistrict.value) {
    const regionParts = [selectedCity.value, selectedDistrict.value].filter(Boolean)
    return `"${regionParts.join(' ')}" 검색 결과`
  }
  return '주변 시설'
})

const realEstateTotalCount = computed(() => realEstateResults.value.reduce((s, r) => s + r.count, 0))

const displayTotalCount = computed(() => {
  if (selectedCategory.value) {
    return total.value
  }
  if (selectedRealEstateType.value) {
    return reTotal.value
  }
  return groupedTotalCount.value + realEstateTotalCount.value
})

// Build common search params
function buildSearchParams(): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  if (searchKeyword.value) params.keyword = searchKeyword.value
  if (selectedCity.value) params.city = selectedCity.value
  if (selectedDistrict.value) params.district = selectedDistrict.value
  return params
}

// Methods
async function performSearch() {
  if (selectedCategory.value) {
    // Flat view: single category with pagination
    search({
      ...buildSearchParams(),
      category: selectedCategory.value,
      page: currentPage.value,
      limit: 20,
    })
    realEstateResults.value = []
  } else {
    // 시설 + 부동산 병렬 검색
    const [, reResult] = await Promise.all([
      searchGrouped(buildSearchParams()),
      searchRealEstate(searchKeyword.value || undefined, selectedCity.value || undefined, selectedDistrict.value || undefined).catch(() => null),
    ])
    realEstateResults.value = ((reResult?.categories as unknown) as RealEstateResultCategory[] | undefined)?.filter(c => c.count > 0) || []
  }
}

function handleSearch() {
  selectedCategory.value = null
  searchTab.value = 'all'
  resetPage()
  performSearch()
}

function clearSearch() {
  searchKeyword.value = ''
  handleSearch()
}

function clearChipFilter() {
  selectedCategory.value = null
  selectedRealEstateType.value = ''
  reComplexItems.value = []
  reCurrentPage.value = 1
  reTotalPages.value = 0
  resetPage()
  performSearch()
}

function selectCategory(category: FacilityCategory | null) {
  selectedCategory.value = category
  selectedRealEstateType.value = ''
  resetPage()
  performSearch()
}

function selectRealEstateType(type: string) {
  selectedRealEstateType.value = type
  selectedCategory.value = null
  reCurrentPage.value = 1
  if (searchTab.value === 'all') {
    searchTab.value = 'realEstate'
  }
  searchRealEstatePaged(type, 1)
}

function goToRealEstatePage(page: number) {
  reCurrentPage.value = page
  searchRealEstatePaged(selectedRealEstateType.value, page)
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function handleCityChange() {
  selectedDistrict.value = ''

  if (selectedCity.value) {
    districts.value = await getDistricts(selectedCity.value)
  } else {
    districts.value = []
  }

  selectedCategory.value = null
  resetPage()
  performSearch()
}

function handleDistrictChange() {
  selectedCategory.value = null
  resetPage()
  performSearch()
}

function goToPage(page: number) {
  setPage(page)
  performSearch()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// SSR redirect: /search?category=X → /X (301)
const validCategoryList = ['toilet', 'trash', 'wifi', 'clothes', 'parking', 'aed', 'library', 'hospital', 'pharmacy', 'park', 'school', 'market']
if (route.query.category && validCategoryList.includes(route.query.category as string)) {
  const redirectCategory = route.query.category as string
  const redirectParams = new URLSearchParams()
  if (route.query.keyword) redirectParams.set('keyword', String(route.query.keyword))
  const redirectQuery = redirectParams.toString()
  navigateTo(`/${redirectCategory}${redirectQuery ? '?' + redirectQuery : ''}`, { replace: true, redirectCode: 301 })
}

// SSR: 초기 쿼리 파라미터에서 메타태그 설정
const initialKeyword = (route.query.keyword as string) || ''

// 검색 결과 페이지: 동적 메타 + 크롤링 방지
useHead({
  title: initialKeyword ? `${initialKeyword} 검색 결과 - 일상킷` : '검색 - 일상킷',
  meta: [
    { name: 'robots', content: 'noindex, follow' },
    { name: 'description', content: initialKeyword ? `${initialKeyword} 관련 생활시설 및 부동산 정보를 찾아보세요.` : '주변 생활시설과 부동산 정보를 검색하세요.' },
  ],
  // noindex 페이지에서는 canonical 제거 (Google 신호 충돌 방지)
})
setSearchMeta({
  keyword: initialKeyword || undefined,
})

// Watch for route query changes (keyword only)
watch(
  () => route.query.keyword,
  (newKeyword, oldKeyword) => {
    if (newKeyword !== oldKeyword) {
      searchKeyword.value = (newKeyword as string) || ''
      selectedCategory.value = null
      resetPage()
      performSearch()
    }
  }
)

// Lifecycle
onMounted(async () => {
  isMounted.value = true

  // Redirect /search?category=X → /X (client-side fallback)
  if (route.query.category) {
    const category = route.query.category as string
    if (validCategoryList.includes(category)) {
      const params = new URLSearchParams()
      if (route.query.keyword) params.set('keyword', String(route.query.keyword))
      const queryStr = params.toString()
      navigateTo(`/${category}${queryStr ? '?' + queryStr : ''}`, { replace: true, redirectCode: 301 })
      return
    }
  }

  // Read initial query params
  if (route.query.keyword) {
    searchKeyword.value = route.query.keyword as string
  }

  // Load cities for region filter
  cities.value = await getCities()

  // Read city filter from query param
  if (route.query.city) {
    const cityParam = route.query.city as string
    // 단축명(서울)→풀네임(서울특별시) 정규화
    const matchedCity = cities.value.find(c => c === cityParam || c.startsWith(cityParam))
    selectedCity.value = matchedCity || cityParam
    if (selectedCity.value) {
      districts.value = await getDistricts(selectedCity.value)
    }
  }

  // Read district filter from query param
  if (route.query.district) {
    selectedDistrict.value = route.query.district as string
  }

  // Initial search (grouped)
  performSearch()
})

// 검색 조건 변경 시 메타태그 업데이트
watch(searchKeyword, () => {
  setSearchMeta({
    keyword: searchKeyword.value || undefined,
  })
  useHead({
    title: searchKeyword.value ? `${searchKeyword.value} 검색 결과 - 일상킷` : '검색 - 일상킷',
  })
})

// ItemList 구조화 데이터 + 페이지네이션 link 태그 (flat view only)
watch([facilities, currentPage, totalPages], () => {
  if (facilities.value.length > 0) {
    setItemListSchema(
      facilities.value.map((f, index) => ({
        name: f.name,
        url: `/${f.category}/${f.id}`,
        position: (currentPage.value - 1) * 20 + index + 1,
      }))
    )
  }

  // 페이지네이션 rel link 태그
  const paginationLinks: Array<{ rel: string; href: string }> = []
  const baseUrl = 'https://ilsangkit.co.kr/search'
  const queryParams = new URLSearchParams()
  if (searchKeyword.value) queryParams.set('keyword', searchKeyword.value)
  const baseQuery = queryParams.toString()

  if (currentPage.value > 1) {
    const prevParams = new URLSearchParams(baseQuery)
    prevParams.set('page', String(currentPage.value - 1))
    paginationLinks.push({ rel: 'prev', href: `${baseUrl}?${prevParams.toString()}` })
  }
  if (currentPage.value < totalPages.value) {
    const nextParams = new URLSearchParams(baseQuery)
    nextParams.set('page', String(currentPage.value + 1))
    paginationLinks.push({ rel: 'next', href: `${baseUrl}?${nextParams.toString()}` })
  }

  useHead({ link: paginationLinks })
})
</script>

<style scoped>
.no-scrollbar::-webkit-scrollbar {
  display: none;
}
.no-scrollbar {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>

<style>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}

/* Material Icon fill variant */
.material-symbols-outlined.fill-1 {
  font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
