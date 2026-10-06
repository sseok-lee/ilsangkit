<template>
  <div class="housing-redesign flex flex-col">
    <section class="home-hero-shell w-full border-b border-line bg-white">
      <div class="page-container pt-6 md:pt-10 pb-8 md:pb-10">
        <div class="grid lg:grid-cols-[minmax(0,1fr)_360px] gap-8 lg:gap-12 items-center">
          <div class="min-w-0">
            <h1 class="sr-only">부동산 실거래가·생활시설 통합 검색 - 일상킷</h1>
            <div class="max-w-[620px]">
              <div class="housing-title font-extrabold tracking-tight text-strong">
                집값부터<br />청약 일정까지.
              </div>
              <p class="text-muted text-base mt-5 max-w-[560px] leading-relaxed">
                궁금한 동네의 집값과 새로운 입주 기회를 살펴보세요.
              </p>
            </div>

            <!-- 검색바 -->
            <div class="w-full md:max-w-[680px] mt-7">
          <form class="relative block" @submit.prevent="handleSearch">
            <label class="sr-only" for="home-hero-search">단지명·동네·시설 검색</label>
            <div class="flex items-stretch h-14 rounded-xl md:rounded-2xl bg-white border border-line-2 md:border-2 focus-within:border-primary focus-within:ring-1 focus-within:ring-primary md:hover:border-line-2 md:focus-within:ring-4 md:focus-within:ring-primary/10 transition-all">
              <div class="flex items-center pl-4 pr-2 text-faint">
                <span class="material-symbols-outlined">search</span>
              </div>
              <input
                id="home-hero-search"
                ref="heroInputRef"
                v-model="searchKeyword"
                role="combobox"
                aria-autocomplete="list"
                aria-label="단지명·동네·시설 검색"
                :aria-expanded="heroFocused"
                :aria-controls="heroListboxId"
                :aria-activedescendant="heroActiveDescendant"
                class="flex-1 min-w-0 bg-transparent text-ink placeholder:text-faint px-2 text-base font-medium focus:outline-none border-none focus:ring-0 md:py-4"
                placeholder="단지명, 지역으로 찾아보세요"
                @keydown="onHeroKeydown"
                @input="onHeroInput"
                @focus="heroFocused = true"
                @blur="heroFocused = false"
              />
              <div class="flex items-center pr-2">
                <button
                  type="submit"
                  aria-label="검색"
                  class="h-11 px-4 md:px-5 bg-primary hover:bg-primary-dark text-white text-sm font-bold rounded-xl transition-colors flex items-center gap-1.5"
                  @click.prevent="handleSearch"
                >
                  <span class="material-symbols-outlined text-[18px] md:hidden">search</span>
                  <span class="hidden md:inline">검색</span>
                </button>
              </div>
            </div>
            <div class="absolute left-0 right-0 top-full z-50">
              <SearchAutocomplete
                ref="heroAcRef"
                :open="heroFocused"
                :model-value="searchKeyword"
                :listbox-id="heroListboxId"
                @active-descendant-change="heroActiveDescendant = $event"
                @close="heroFocused = false"
              />
            </div>
          </form>
            </div>
            <p class="mt-3 text-sm text-muted">아파트 · 빌라 · 오피스텔 실거래가</p>
          </div>
          <nav class="lg:border-l lg:border-line lg:pl-8" aria-label="주요 목적지">
            <div class="divide-y divide-line">
              <HardLink
                v-for="link in purposeLinks"
                :key="link.to"
                :to="link.to"
                class="group flex items-center gap-4 py-4 text-strong hover:text-primary transition-colors"
              >
                <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">{{ link.icon }}</span>
                <span class="min-w-0 flex-1">
                  <span class="block text-sm font-extrabold">{{ link.label }}</span>
                  <span class="block text-xs text-muted mt-1 leading-relaxed">{{ link.description }}</span>
                </span>
                <span class="material-symbols-outlined text-[18px] text-faint group-hover:text-primary" aria-hidden="true">chevron_right</span>
              </HardLink>
            </div>
          </nav>
        </div>
      </div>
    </section>

    <section class="page-container py-6">
      <HomeMarketSection />
    </section>

    <!-- Ad: fold 아래 첫 섹션 경계 (히어로 검색은 홈의 핵심 기능이라 그 위/안에는 두지 않는다) -->
    <div class="page-container">
      <AdBanner />
    </div>

    <!-- 청약·임대 일정 섹션 -->
    <HomeSubscriptionSection />

    <!-- 빠른 생활시설 찾기 (8 아이콘) -->
    <section id="facilities" class="page-container py-6">
      <div class="mb-4">
        <h2 class="text-display-2 text-strong flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">location_on</span>
          빠른 생활시설 찾기
        </h2>
      </div>
      <div class="grid grid-cols-4 md:grid-cols-8 gap-3 md:gap-2.5">
        <HardLink
          v-for="q in quickFacilities"
          :key="q.id"
          :to="`/${q.id}`"
          :aria-label="q.label"
          class="flex flex-col items-center justify-center py-3 px-2 bg-white border border-line rounded-xl hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <CategoryIcon :category-id="(q.id as CategoryId)" size="md" class="mb-1.5" />
          <span class="text-[13px] font-semibold text-strong">{{ q.label }}</span>
        </HardLink>
      </div>
    </section>

    <!-- 인기 지역 -->
    <section class="page-container py-4">
      <div class="mb-4">
        <h2 class="text-display-2 text-strong flex items-center gap-2">
          <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">place</span>
          인기 지역
        </h2>
      </div>
      <div class="flex flex-wrap gap-2">
        <HardLink
          v-for="city in CITY_LINKS"
          :key="city.slug"
          :to="`/${city.slug}/`"
          class="ui-chip"
        >
          {{ city.label }}
        </HardLink>
      </div>
    </section>

    <!-- 오늘의 이슈 -->
    <section v-if="recentArticles.length > 0" class="page-container py-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-display-2 text-strong flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">article</span>
            오늘의 이슈
          </h2>
        </div>
        <HardLink
          to="/article"
          class="text-sm text-primary font-semibold hover:underline flex items-center min-h-[44px] gap-1 whitespace-nowrap"
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
          class="group bg-white border border-line rounded-xl overflow-hidden hover:border-primary/30 transition-colors duration-200"
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
            <h3 class="text-sm font-semibold text-strong line-clamp-2 group-hover:text-primary transition-colors">
              {{ article.title }}
            </h3>
            <p class="text-xs text-muted mt-1 line-clamp-1">
              {{ article.summary }}
            </p>
          </div>
        </HardLink>
      </div>
    </section>

    <!-- 생활 가이드 -->
    <section v-if="recentGuides.length > 0" class="page-container py-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h2 class="text-display-2 text-strong flex items-center gap-2">
            <span class="material-symbols-outlined text-primary text-[24px]" aria-hidden="true">menu_book</span>
            생활 가이드
          </h2>
        </div>
        <HardLink
          to="/guide"
          class="text-sm text-primary font-semibold hover:underline flex items-center min-h-[44px] gap-1 whitespace-nowrap"
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
          class="group bg-white border border-line rounded-xl overflow-hidden hover:border-primary/30 transition-colors duration-200"
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
            <h3 class="text-sm font-semibold text-strong line-clamp-2 group-hover:text-primary transition-colors">
              {{ guide.title }}
            </h3>
            <p class="text-xs text-muted mt-1 line-clamp-1">
              {{ guide.summary }}
            </p>
          </div>
        </HardLink>
      </div>
    </section>

    <!-- Ad: 데이터 출처 위 (쿠팡 배너가 있던 자리)
         앞의 생활 가이드·오늘의 이슈는 v-if 조건부라 데이터가 없으면 이 광고가 위로 올라온다. -->
    <div class="page-container">
      <AdBanner />
    </div>

    <!-- 데이터 출처 요약 -->
    <section class="page-container py-6">
      <div class="bg-white border border-line rounded-2xl p-5 flex flex-col md:flex-row md:items-center gap-3 md:gap-5">
        <div class="flex items-start gap-3 flex-1">
          <span class="material-symbols-outlined text-primary text-[22px] mt-0.5">verified</span>
          <div>
            <p class="text-sm font-semibold text-strong">공공데이터 기반 서비스</p>
            <p class="text-xs text-muted mt-1 leading-relaxed">
              행정안전부 · 국토교통부 · 보건복지부 · 한국부동산원 등
              공공데이터포털 및 각 부처 공개 API/CSV를 출처로 사용합니다.
              공공누리(KOGL) 이용 조건을 준수하여 표기합니다.
            </p>
          </div>
        </div>
        <HardLink
          to="/about#data-sources"
          class="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
        >
          전체 출처 보기 →
        </HardLink>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import SearchAutocomplete from '~/components/search/SearchAutocomplete.vue'
// heroAcRef typed as any to avoid circular InstanceType complexity in pages

import HardLink from '~/components/common/HardLink.vue'
import CategoryIcon from '~/components/common/CategoryIcon.vue'
import type { CategoryId } from '~/utils/categoryIcons'
import HomeSubscriptionSection from '~/components/subscription/HomeSubscriptionSection.vue'
import HomeMarketSection from '~/components/home/HomeMarketSection.vue'
import type { GuideSummary } from '~/composables/useGuides'
import type { ArticleSummary } from '~/composables/useArticles'
import { useFacilityMeta } from '~/composables/useFacilityMeta'
import { useStructuredData } from '~/composables/useStructuredData'
import { CITY_LINKS } from '~/utils/seoConstants'
import { FACILITY_DATA_SOURCE, REAL_ESTATE_DATA_SOURCE, SUBSCRIPTION_DATA_SOURCE } from '~/utils/dataSource'
import { useAnalytics } from '~/composables/useAnalytics'

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
const { setWebsiteSchema, setOrganizationSchema, setDatasetSchema } = useStructuredData()
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
const heroListboxId = `home-search-${useId()}-listbox`
const heroActiveDescendant = ref<string | undefined>(undefined)
const heroInputRef = ref<HTMLInputElement | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const heroAcRef = ref<any>(null)

// 홈 보조 콘텐츠 SSR.
// 실거래/청약 홈 섹션은 각 컴포넌트가 자체 데이터를 조회하므로,
// 이 페이지는 fold-below 가이드/기사 실패에 의존하지 않고 렌더한다.
const { data: pageData } = await useAsyncData(
  'home-page',
  async () => {
    const signal = AbortSignal.timeout(8000)
    const [guidesR, articlesR] = await Promise.allSettled([
      $fetch<{ success: boolean; data: GuideSummary[] }>(
        `${apiBase}/api/guides/recent`,
        { query: { limit: 4 }, signal }
      ),
      $fetch<{ success: boolean; data: ArticleSummary[] }>(
        `${apiBase}/api/articles/recent`,
        { query: { limit: 4 }, signal }
      ),
    ])
    if (guidesR.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.warn('[home-page] recent-guides failed:', guidesR.reason)
    }
    if (articlesR.status === 'rejected') {
      // eslint-disable-next-line no-console
      console.warn('[home-page] recent-articles failed:', articlesR.reason)
    }
    return {
      recentGuides: guidesR.status === 'fulfilled' ? guidesR.value.data : ([] as GuideSummary[]),
      recentArticles: articlesR.status === 'fulfilled' ? articlesR.value.data : ([] as ArticleSummary[]),
    }
  },
  {
    default: () => ({
      recentGuides: [] as GuideSummary[],
      recentArticles: [] as ArticleSummary[],
    }),
  }
)

const recentGuides = computed(() => pageData.value?.recentGuides ?? [])
const recentArticles = computed(() => pageData.value?.recentArticles ?? [])

const purposeLinks = [
  { label: '실거래가 찾아보기', to: '/real-estate', icon: 'apartment', description: '최근 거래와 가격 흐름 확인' },
  { label: '청약 일정', to: '/subscription', icon: 'calendar_month', description: '다가오는 접수 일정 확인' },
  { label: '공공임대', to: '/subscription/rent', icon: 'home', description: '내게 맞는 모집 유형 살펴보기' },
]

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
  const q = (heroInputRef.value?.value ?? searchKeyword.value).trim()
  if (!q) return
  searchKeyword.value = q
  trackSearch({ keyword: q })
  navigateTo('/search?keyword=' + encodeURIComponent(q))
}

// IME 조합 중에도 실시간 입력값을 자동완성에 전달(v-model은 조합 종료까지 지연됨)
function onHeroInput(e: Event) {
  heroAcRef.value?.setQuery?.((e.target as HTMLInputElement).value)
}

function onHeroKeydown(e: KeyboardEvent) {
  const handled = heroAcRef.value?.onKeydown?.(e)
  if (!handled && e.key.toLowerCase() === 'enter') {
    e.preventDefault()
    handleSearch()
  }
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
