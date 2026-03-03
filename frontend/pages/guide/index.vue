<template>
  <div class="bg-background-light dark:bg-background-dark min-h-screen">
    <div class="max-w-7xl mx-auto px-4 md:px-6 py-6">
      <!-- Page Header -->
      <h1 class="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-2">
        생활 가이드
      </h1>
      <p class="text-slate-500 dark:text-slate-400 text-sm mb-6">
        카테고리별 생활 정보와 유용한 가이드를 확인하세요.
      </p>

      <!-- Category Filter Tabs -->
      <div class="flex flex-wrap gap-2 mb-6">
        <button
          :class="[
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            !selectedCategory
              ? 'bg-primary text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/50'
          ]"
          @click="selectCategory('')"
        >
          전체
        </button>
        <button
          v-for="cat in categories"
          :key="cat.slug"
          :class="[
            'px-4 py-2 rounded-full text-sm font-medium transition-colors',
            selectedCategory === cat.slug
              ? 'bg-primary text-white'
              : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-primary/50'
          ]"
          @click="selectCategory(cat.slug)"
        >
          {{ cat.label }}
        </button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-20">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p class="text-slate-500 dark:text-slate-400 text-sm">가이드를 불러오는 중...</p>
        </div>
      </div>

      <!-- Guide Cards Grid -->
      <div v-else-if="guides.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <NuxtLink
          v-for="guide in guides"
          :key="guide.id"
          :to="`/guide/${guide.slug}`"
          class="group bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
        >
          <!-- Thumbnail -->
          <div class="aspect-video bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <img
              v-if="guide.thumbnailUrl"
              :src="`${config.public.apiBase}${guide.thumbnailUrl}`"
              :alt="guide.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600">article</span>
            </div>
          </div>

          <!-- Content -->
          <div class="p-4">
            <!-- Category Tag -->
            <span class="inline-block px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full mb-2">
              {{ getCategoryLabel(guide.category) }}
            </span>

            <!-- Title -->
            <h2 class="text-base font-bold text-slate-900 dark:text-white mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {{ guide.title }}
            </h2>

            <!-- Summary -->
            <p class="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">
              {{ guide.summary }}
            </p>

            <!-- Meta -->
            <div class="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
              <time :datetime="guide.createdAt">{{ formatDate(guide.createdAt) }}</time>
              <span class="flex items-center gap-1">
                <span class="material-symbols-outlined text-[14px]">visibility</span>
                {{ guide.viewCount.toLocaleString() }}
              </span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Empty State -->
      <div v-else class="py-20 text-center">
        <span class="material-symbols-outlined text-[48px] text-slate-300 dark:text-slate-600 mb-4 block">article</span>
        <p class="text-slate-600 dark:text-slate-400 font-medium">아직 등록된 가이드가 없습니다</p>
        <p class="text-slate-400 dark:text-slate-500 text-sm mt-1">곧 유용한 생활 가이드가 업데이트됩니다.</p>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-8">
        <button
          :disabled="currentPage <= 1"
          class="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          @click="goToPage(currentPage - 1)"
        >
          이전
        </button>
        <span class="text-sm text-slate-600 dark:text-slate-400">
          {{ currentPage }} / {{ totalPages }}
        </span>
        <button
          :disabled="currentPage >= totalPages"
          class="px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
          @click="goToPage(currentPage + 1)"
        >
          다음
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGuides } from '~/composables/useGuides'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CATEGORY_META } from '~/types/facility'
import type { GuideSummary } from '~/composables/useGuides'
import type { FacilityCategory } from '~/types/facility'

// SEO
const { setMeta } = useFacilityMeta()
setMeta({
  title: '생활 가이드 - 일상킷',
  description: '공공시설 이용 가이드, 생활 정보, 유용한 팁을 확인하세요. 화장실, 병원, 약국, 주차장 등 카테고리별 생활 가이드.',
  path: '/guide',
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '생활 가이드', url: '/guide' },
])

const config = useRuntimeConfig()
const { fetchGuides } = useGuides()

const guides = ref<GuideSummary[]>([])
const loading = ref(true)
const currentPage = ref(1)
const totalPages = ref(1)
const selectedCategory = ref('')

const categories = Object.entries(CATEGORY_META).map(([slug, meta]) => ({
  slug,
  label: meta.shortLabel,
}))

function getCategoryLabel(category: string): string {
  return CATEGORY_META[category as FacilityCategory]?.label ?? category
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

async function loadGuides() {
  loading.value = true
  try {
    const result = await fetchGuides({
      page: currentPage.value,
      limit: 12,
      category: selectedCategory.value || undefined,
    })
    guides.value = result.items
    totalPages.value = result.totalPages
  } catch {
    guides.value = []
  } finally {
    loading.value = false
  }
}

function selectCategory(category: string) {
  selectedCategory.value = category
  currentPage.value = 1
  loadGuides()
}

function goToPage(page: number) {
  currentPage.value = page
  loadGuides()
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}

onMounted(() => {
  loadGuides()
})
</script>
