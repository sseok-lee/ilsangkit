<template>
  <div class="bg-white text-ink min-h-screen">
    <div class="page-container pb-10">
      <PageHead
        eyebrow="공매"
        title="부동산 공매 물건 검색"
        :description="AUCTION_META.description"
      >
        <template #breadcrumb>
          <Breadcrumb :items="breadcrumbItems" class="mb-4" />
        </template>
      </PageHead>

      <!-- 요약 통계 -->
      <div v-if="hub" class="mt-6 grid grid-cols-3 gap-3">
        <div class="rounded-lg bg-background-light p-5 min-w-0 text-center">
          <p class="text-caption text-muted mb-1">진행중 물건</p>
          <p class="text-xl md:text-3xl font-bold text-ink">{{ hub.totalActive.toLocaleString('ko-KR') }}</p>
        </div>
        <div class="rounded-lg bg-background-light p-5 min-w-0 text-center">
          <p class="text-caption text-muted mb-1">누적 낙찰</p>
          <p class="text-xl md:text-3xl font-bold text-ink">{{ hub.totalSold.toLocaleString('ko-KR') }}</p>
        </div>
        <div class="rounded-lg bg-background-light p-5 min-w-0 text-center">
          <p class="text-caption text-muted mb-1">집계 지역</p>
          <p class="text-xl md:text-3xl font-bold text-ink">{{ hub.regionCount.toLocaleString('ko-KR') }}</p>
        </div>
      </div>

      <!-- 용도별 진입 카드 -->
      <SectionBlock variant="flat" heading="용도별 공매 물건" subtext="용도별로 공매 물건을 조회하세요.">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="usage in usageCards"
            :key="usage.key"
            :to="`/auction/list?usage=${usage.key}`"
            class="flex min-h-11 min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-white p-5 hover:border-primary hover:text-primary transition-colors"
          >
            <span class="text-display-3 text-ink">{{ usage.label }}</span>
            <span class="text-caption text-muted">공매 물건 조회 →</span>
          </NuxtLink>
          <NuxtLink
            to="/auction/list"
            class="flex min-h-11 min-w-0 flex-col gap-1 rounded-[10px] border border-line bg-white p-5 hover:border-primary hover:text-primary transition-colors"
          >
            <span class="text-display-3 text-ink">전체</span>
            <span class="text-caption text-muted">모든 용도 보기 →</span>
          </NuxtLink>
        </div>
      </SectionBlock>

      <SectionBlock variant="flat" heading="지역별 공매" subtext="시·도와 구·군을 선택해 지역의 공매 물건을 확인하세요.">
        <nav class="flex flex-wrap gap-2" aria-label="공매 지역 선택">
          <UiChip v-for="region in regionCities" :key="region.slug" :to="`/auction/${region.slug}`">{{ region.city }}</UiChip>
        </nav>
        <p v-if="regionsError" role="alert" class="text-sm text-muted">지역 정보를 불러오지 못했습니다.</p>
      </SectionBlock>

      <!-- 부가④ 마감임박 물건 -->
      <SectionBlock variant="flat" v-if="deadline && deadline.items.length > 0" heading="마감 임박 물건" subtext="입찰 마감이 가까운 물건입니다.">
        <div class="flex flex-col">
          <AuctionCard variant="row" v-for="item in deadline.items" :key="item.cltrMngNo" :item="item" />
        </div>
        <div class="mt-3 text-right">
          <NuxtLink to="/auction/list?sort=deadline" class="text-sm text-primary hover:underline">전체 보기 →</NuxtLink>
        </div>
      </SectionBlock>

      <!-- 랭킹 진입 -->
      <div class="bg-white rounded-[10px] border border-line p-4 flex items-center justify-between gap-4 mt-6">
        <div>
          <p class="text-sm font-semibold text-ink">낙찰가율 랭킹</p>
          <p class="text-caption text-muted mt-0.5">지역별·용도별 낙찰가율 통계를 확인하세요</p>
        </div>
        <UiButton variant="primary" to="/auction/ranking">랭킹 보기</UiButton>
      </div>

      <AdBanner />

      <!-- FAQ -->
      <SectionBlock variant="flat" heading="자주 묻는 질문">
        <div class="space-y-1">
          <details
            v-for="(faq, index) in AUCTION_FAQ"
            :key="index"
            class="group border-b border-line last:border-b-0"
          >
            <summary class="cursor-pointer py-3 text-base font-medium text-ink flex items-center justify-between hover:text-primary">
              {{ faq.q }}
              <span aria-hidden="true" class="material-symbols-outlined text-[18px] text-muted group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <p class="pb-3 text-sm text-muted leading-relaxed">{{ faq.a }}</p>
          </details>
        </div>
      </SectionBlock>


      <DataSourceSection variant="flat" domain="auction" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUGS, CITY_FULL_NAME_TO_SLUG } from '~/shared/regionSlugs'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useAuction } from '~/composables/useAuction'
import { AUCTION_META, AUCTION_FAQ } from '~/utils/auctionMeta'
import { USAGE_GROUP_LABEL } from '~/types/auction'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import PageHead from '~/components/common/PageHead.vue'
import UiButton from '~/components/common/UiButton.vue'
import UiChip from '~/components/common/UiChip.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const auction = useAuction()

const { data: hub, error: hubError } = await useAsyncData(
  'auction-hub-summary',
  () => auction.getHubSummary(),
  { default: () => null },
)

const { data: regions, error: regionsError } = await useAsyncData(
  'auction-hub-regions', () => auction.getRegions({ onlyIndexable: true }), { default: () => ({ items: [] }) },
)
const regionCities = computed(() => [...new Set(regions.value.items.map(row => row.city))].map(city => ({
  city, slug: CITY_SLUGS[city] ?? CITY_FULL_NAME_TO_SLUG[city],
})).filter(row => row.slug))

const { data: deadline, error: deadlineError } = await useAsyncData(
  'auction-deadline',
  () => auction.getItems({ status: 'ongoing', sort: 'deadline', limit: 8 }),
  { default: () => null },
)

// 일시 장애를 200 + index 로 굳히지 않는다 (#467 / #674). 사용자에겐 페이지를 그대로
// 보여주되(fail-open) 크롤러에겐 503 + no-store 로 알린다.
//
// ⚠️ useAsyncData 핸들러 **밖**에서 불러야 한다. 핸들러 본문은 중첩 async 라 Nuxt 인스턴스
// 컨텍스트가 없고, 그 안에서 부르면 useNuxtApp() 이 throw 해 503 이 영영 나가지 않는다.
if ((hubError.value || deadlineError.value || regionsError.value) && import.meta.server) markDegradedResponse()

const usageCards = computed(() =>
  (Object.entries(USAGE_GROUP_LABEL) as [string, string][]).map(([key, label]) => ({ key, label })),
)

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '공매', href: '/auction', current: true },
]

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공매', url: '/auction' },
])

useHead({
  title: '부동산 공매 물건 검색 | 일상킷',
  meta: [
    { name: 'description', content: AUCTION_META.description },
    { property: 'og:title', content: '부동산 공매 물건 검색 | 일상킷' },
    { property: 'og:description', content: AUCTION_META.description },
    { property: 'og:url', content: `${SITE_URL}/auction` },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: '부동산 공매 물건 검색 | 일상킷' },
    { name: 'twitter:description', content: AUCTION_META.description },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ],
  link: [{ rel: 'canonical', href: `${SITE_URL}/auction` }],
})
</script>
