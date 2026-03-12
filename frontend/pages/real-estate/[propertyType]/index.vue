<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div class="mb-6">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">
          {{ propertyMeta?.label }} 실거래가
        </h1>
        <p class="mt-2 text-slate-600">{{ propertyDescription }}</p>
      </div>

      <!-- 매매/전월세 탭 -->
      <TransactionModeTab v-model="currentTab" class="mb-6" />

      <!-- 검색 필터 -->
      <RealEstateSearchFilter
        :type="apiSlug"
        @search="handleSearch"
      />

      <!-- 결과 -->
      <div v-if="pending" class="flex justify-center py-12">
        <div class="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>

      <div v-else-if="error" class="rounded-xl bg-red-50 p-6 text-center text-red-600">
        데이터를 불러오는 중 오류가 발생했습니다.
      </div>

      <div v-else-if="complexes.length > 0" class="mt-6">
        <h2 class="text-lg font-semibold text-slate-800 mb-4">
          건물 목록 ({{ totalComplexes }}개)
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ComplexCard
            v-for="complex in complexes"
            :key="`${complex.buildingName}-${complex.bjdCode}`"
            :complex="complex"
            :property-type="propertyTypeParam"
            :tab="currentTab"
          />
        </div>

        <!-- 페이지네이션 -->
        <nav v-if="totalPages > 1" class="mt-8 flex items-center justify-center gap-1">
          <button
            :disabled="currentPage <= 1"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
            @click="goToPage(currentPage - 1)"
          >
            이전
          </button>
          <button
            v-for="p in paginationRange"
            :key="p"
            :class="[
              'min-w-[36px] px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              p === currentPage
                ? 'bg-primary text-white'
                : 'text-slate-600 hover:bg-slate-100',
            ]"
            @click="goToPage(p)"
          >
            {{ p }}
          </button>
          <button
            :disabled="currentPage >= totalPages"
            class="px-3 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-100 text-slate-600"
            @click="goToPage(currentPage + 1)"
          >
            다음
          </button>
        </nav>
      </div>

      <div v-else-if="!pending" class="rounded-xl bg-slate-50 p-12 text-center text-slate-500">
        <span class="material-symbols-outlined text-[48px] mb-2 block">search</span>
        <p>지역을 선택하면 거래 내역을 확인할 수 있습니다.</p>
      </div>

      <!-- FAQ -->
      <section v-if="faqs.length > 0" class="mt-12">
        <h2 class="text-lg font-bold text-slate-800 mb-4">자주 묻는 질문</h2>
        <div class="space-y-3">
          <details
            v-for="(faq, i) in faqs"
            :key="i"
            class="group rounded-xl border border-slate-100 bg-white"
          >
            <summary class="cursor-pointer px-5 py-4 text-[15px] font-medium text-slate-800 flex items-center justify-between">
              {{ faq.q }}
              <span class="material-symbols-outlined text-[18px] text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <p class="px-5 pb-4 text-[14px] text-slate-600 leading-relaxed">{{ faq.a }}</p>
          </details>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { RealEstatePropertyType, TransactionMode, ComplexInfo, ComplexListResponse } from '~/types/realEstate'
import { toApiSlug, PROPERTY_TYPES } from '~/types/realEstate'
import { PROPERTY_TYPE_META, PROPERTY_TYPE_FAQ, PROPERTY_TYPE_DESCRIPTIONS } from '~/utils/realEstateMeta'

const route = useRoute()
const router = useRouter()

const propertyTypeParam = computed(() => route.params.propertyType as RealEstatePropertyType)

// 유효하지 않은 propertyType이면 404
if (!PROPERTY_TYPES.includes(propertyTypeParam.value as RealEstatePropertyType)) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const currentTab = computed<TransactionMode>({
  get: () => (route.query.tab === 'rent' ? 'rent' : 'sale'),
  set: (val) => {
    router.replace({ query: { ...route.query, tab: val } })
  },
})

const apiSlug = computed(() => toApiSlug(propertyTypeParam.value, currentTab.value))
const propertyMeta = computed(() => PROPERTY_TYPE_META[propertyTypeParam.value])
const propertyDescription = computed(() => PROPERTY_TYPE_DESCRIPTIONS[propertyTypeParam.value])
const faqs = computed(() => PROPERTY_TYPE_FAQ[propertyTypeParam.value] || [])

// SEO 메타
const tabLabel = computed(() => currentTab.value === 'sale' ? '매매' : '전월세')
useHead(() => {
  const title = `${propertyMeta.value?.label} ${tabLabel.value} 실거래가 | 일상킷`
  const description = propertyDescription.value
  return {
    title,
    meta: [
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
    ],
    link: [
      { rel: 'canonical', href: `https://ilsangkit.com/real-estate/${propertyTypeParam.value}` },
    ],
  }
})

// JSON-LD
useHead(() => ({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: `${propertyMeta.value?.label} ${tabLabel.value} 실거래가`,
        description: propertyDescription.value,
      }),
    },
  ],
}))

const complexes = ref<ComplexInfo[]>([])
const totalComplexes = ref(0)
const currentPage = ref(1)
const totalPages = ref(0)
const pending = ref(false)
const error = ref(false)
const lastSearch = ref<{ city: string; district: string; buildingName: string } | null>(null)

const paginationRange = computed(() => {
  const total = totalPages.value
  const current = currentPage.value
  const delta = 2
  const range: number[] = []
  for (let i = Math.max(1, current - delta); i <= Math.min(total, current + delta); i++) {
    range.push(i)
  }
  return range
})

const { useRealEstate } = await import('~/composables/useRealEstate')
const { getComplexList } = useRealEstate()

async function handleSearch(params: { city: string; district: string; buildingName: string }) {
  if (!params.city && !params.district && !params.buildingName) return
  lastSearch.value = params
  currentPage.value = 1
  await loadComplexes(params.city || undefined, params.district || undefined, params.buildingName || undefined)
}

async function loadComplexes(city?: string, district?: string, buildingName?: string, page: number = 1) {
  pending.value = true
  error.value = false
  try {
    const result = await getComplexList(apiSlug.value, city, district, buildingName, page)
    complexes.value = result.items
    totalComplexes.value = result.total
    currentPage.value = result.page
    totalPages.value = result.totalPages
  } catch {
    error.value = true
  } finally {
    pending.value = false
  }
}

function goToPage(page: number) {
  if (page < 1 || page > totalPages.value) return
  const s = lastSearch.value
  loadComplexes(s?.city || undefined, s?.district || undefined, s?.buildingName || undefined, page)
}

// 마운트 시 인기 건물 자동 로드
loadComplexes()

// 탭 전환 시 마지막 검색 조건으로 재로드
watch(currentTab, () => {
  if (lastSearch.value) {
    loadComplexes(lastSearch.value.city || undefined, lastSearch.value.district || undefined, lastSearch.value.buildingName || undefined)
  } else {
    loadComplexes()
  }
})
</script>
