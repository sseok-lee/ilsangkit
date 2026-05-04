<template>
  <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
    <!-- Breadcrumb -->
    <Breadcrumb :items="breadcrumbItems" />

    <!-- Hero -->
    <PageHero
      eyebrow="가이드 목록"
      title="생활 가이드"
      description="부동산·청약·생활시설 이용 팁을 카테고리별로 확인하세요."
      :stats="heroStats"
    />

    <!-- 카테고리 -->
    <SectionBlock heading="카테고리" subtext="관심 있는 주제로 가이드를 좁혀 보세요.">
      <div class="flex flex-wrap gap-2">
        <button
          v-for="chip in CATEGORY_CHIPS"
          :key="chip.key ?? 'all'"
          :class="[
            'px-3.5 py-1.5 rounded-full text-sm font-bold transition-colors border',
            activeChip === chip.key
              ? 'bg-primary text-white border-primary'
              : 'bg-white text-slate-700 border-line hover:border-primary hover:text-primary'
          ]"
          @click="selectChip(chip.key)"
        >
          {{ chip.label }}
        </button>
      </div>
    </SectionBlock>

    <!-- 최근 가이드 -->
    <SectionBlock heading="최근 가이드" subtext="카드에는 카테고리·제목·요약·날짜·조회수를 표시합니다.">
      <template v-if="totalCount > 0" #right>
        <span class="inline-flex px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold">
          {{ totalCount.toLocaleString('ko-KR') }}건
        </span>
      </template>

      <!-- Loading -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <div class="text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary mb-2"></div>
          <p class="text-slate-500 text-sm">가이드를 불러오는 중...</p>
        </div>
      </div>

      <!-- Guide Cards Grid -->
      <div v-else-if="guides.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <NuxtLink
          v-for="guide in guides"
          :key="guide.id"
          :to="`/guide/${guide.slug}`"
          :prefetch="false"
          class="group bg-white rounded-xl border border-line overflow-hidden shadow-card hover:shadow-md hover:-translate-y-0.5 transition-all duration-300"
        >
          <div class="aspect-video bg-slate-100 overflow-hidden">
            <img
              v-if="guide.thumbnailUrl"
              :src="`${config.public.apiBase}${guide.thumbnailUrl}`"
              :alt="guide.title"
              width="400"
              height="225"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              loading="lazy"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
            />
            <div v-else class="w-full h-full flex items-center justify-center">
              <span class="material-symbols-outlined text-[48px] text-slate-300">article</span>
            </div>
          </div>
          <div class="p-4">
            <span class="inline-block px-2.5 py-0.5 bg-primary/10 text-primary text-xs font-bold rounded-full mb-2">
              {{ getCategoryLabel(guide.category) }}
            </span>
            <h2 class="text-base font-bold text-slate-900 mb-2 line-clamp-2 group-hover:text-primary transition-colors">
              {{ guide.title }}
            </h2>
            <p class="text-sm text-slate-500 line-clamp-2 mb-3">
              {{ guide.summary }}
            </p>
            <div class="flex items-center justify-between text-xs text-slate-500">
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
      <div v-else class="py-16 text-center">
        <span class="material-symbols-outlined text-[48px] text-slate-300 mb-4 block">article</span>
        <p class="text-slate-600 font-medium">조건에 맞는 가이드가 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">다른 카테고리를 선택해 보세요.</p>
      </div>

      <!-- 광고: 첫 그리드 이후 -->
      <AdBanner class="mt-4" />

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex justify-center items-center gap-4 mt-4">
        <button
          :disabled="currentPage <= 1"
          class="px-4 py-2 border border-line rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          @click="goToPage(currentPage - 1)"
        >
          이전
        </button>
        <span class="text-sm text-slate-600">{{ currentPage }} / {{ totalPages }}</span>
        <button
          :disabled="currentPage >= totalPages"
          class="px-4 py-2 border border-line rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors"
          @click="goToPage(currentPage + 1)"
        >
          다음
        </button>
      </div>
    </SectionBlock>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useGuides } from '~/composables/useGuides'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { useAnalytics } from '~/composables/useAnalytics'
import { CATEGORY_META } from '~/types/facility'
import { REAL_ESTATE_META } from '~/utils/realEstateMeta'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'

// 카테고리 칩: 콘텐츠 주제별 묶음 (backend categories 배열 필터 사용)
const CATEGORY_CHIPS: { key: string | null; label: string; categories?: string[] }[] = [
  { key: null, label: '전체' },
  { key: 'real-estate', label: '부동산', categories: ['apt-sale', 'apt-rent', 'villa-sale', 'villa-rent', 'offitel-sale', 'offitel-rent'] },
  { key: 'subscription', label: '청약', categories: ['subscription', 'sale', 'rent'] },
  { key: 'health', label: '병원·약국', categories: ['hospital', 'pharmacy', 'aed'] },
  { key: 'parking', label: '주차·충전', categories: ['parking', 'ev-charger'] },
  { key: 'env', label: '쓰레기배출', categories: ['trash', 'clothes'] },
]

// SEO
const { setMeta } = useFacilityMeta()
setMeta({
  title: '생활 가이드 | 부동산·청약·생활시설',
  description: '부동산, 청약, 병원, 약국, 주차장 등 생활 가이드를 카테고리별로 확인하세요.',
  path: '/guide',
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '생활 가이드', url: '/guide' },
])

const { trackGuideListView } = useAnalytics()
onMounted(() => trackGuideListView())

const config = useRuntimeConfig()
const { fetchGuides } = useGuides()

const currentPage = ref(1)
const activeChip = ref<string | null>(null)

const chipCategories = computed(() => {
  if (!activeChip.value) return undefined
  return CATEGORY_CHIPS.find(c => c.key === activeChip.value)?.categories
})

// SSR: useAsyncData로 첫 페이지 데이터 서버에서 로드 (기본: 전체)
const { data: guidesData, status } = await useAsyncData(
  'guide-list',
  () => fetchGuides({ page: currentPage.value, limit: 12 }),
)

const guides = computed(() => guidesData.value?.items ?? [])
const totalCount = computed(() => guidesData.value?.total ?? 0)
const totalPages = computed(() => guidesData.value?.totalPages ?? 1)
const loading = computed(() => status.value === 'pending')

const breadcrumbItems = computed(() => [
  { label: '홈', href: '/', current: false },
  { label: '생활 가이드', href: '/guide', current: true },
])

const heroStats = computed(() => [
  { label: '게시글', value: totalCount.value > 0 ? `${totalCount.value.toLocaleString('ko-KR')}개` : '—' },
  { label: '주요 주제', value: '부동산 · 청약' },
  { label: '보기', value: '최신순' },
])

async function selectChip(key: string | null) {
  if (activeChip.value === key) return
  activeChip.value = key
  currentPage.value = 1
  guidesData.value = await fetchGuides({
    page: 1,
    limit: 12,
    categories: chipCategories.value,
  })
}

function getCategoryLabel(category: string): string {
  if (category === 'apt-sale' || category === 'apt-rent') return '부동산'
  if (category === 'subscription') return '청약/임대'
  const facilityLabel = CATEGORY_META[category as keyof typeof CATEGORY_META]?.label
  if (facilityLabel) return facilityLabel
  const camelKey = category.replace(/-([a-z])/g, (_, c) => c.toUpperCase())
  return REAL_ESTATE_META[camelKey as keyof typeof REAL_ESTATE_META]?.label ?? category
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
}

async function goToPage(page: number) {
  currentPage.value = page
  guidesData.value = await fetchGuides({ page, limit: 12, categories: chipCategories.value })
  if (import.meta.client) {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
}
</script>
