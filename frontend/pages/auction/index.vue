<template>
  <div class="bg-background-light min-h-screen">
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="공매"
        title="부동산 공매 물건 검색"
        :description="AUCTION_META.description"
      />

      <!-- 요약 통계 -->
      <div v-if="hub" class="grid grid-cols-3 gap-3">
        <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
          <p class="text-caption text-slate-500 mb-1">진행중 물건</p>
          <p class="text-display-2 font-bold text-slate-900">{{ hub.totalActive.toLocaleString('ko-KR') }}</p>
        </div>
        <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
          <p class="text-caption text-slate-500 mb-1">누적 낙찰</p>
          <p class="text-display-2 font-bold text-slate-900">{{ hub.totalSold.toLocaleString('ko-KR') }}</p>
        </div>
        <div class="bg-white rounded-xl border border-line p-4 shadow-card text-center">
          <p class="text-caption text-slate-500 mb-1">집계 지역</p>
          <p class="text-display-2 font-bold text-slate-900">{{ hub.regionCount.toLocaleString('ko-KR') }}</p>
        </div>
      </div>

      <!-- 용도별 진입 카드 -->
      <SectionBlock heading="용도별 공매 물건" subtext="용도별로 공매 물건을 조회하세요.">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <NuxtLink
            v-for="usage in usageCards"
            :key="usage.key"
            :to="`/auction/list?usage=${usage.key}`"
            class="group bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-sm hover:shadow-md hover:border-primary/30 transition-[box-shadow,border-color] duration-200 ease-out"
          >
            <span class="text-display-3 text-slate-800">{{ usage.label }}</span>
            <span class="text-caption text-slate-500">공매 물건 조회 →</span>
          </NuxtLink>
          <NuxtLink
            to="/auction/list"
            class="group bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-1 shadow-sm hover:shadow-md hover:border-primary/30 transition-[box-shadow,border-color] duration-200 ease-out"
          >
            <span class="text-display-3 text-slate-800">전체</span>
            <span class="text-caption text-slate-500">모든 용도 보기 →</span>
          </NuxtLink>
        </div>
      </SectionBlock>

      <!-- 부가④ 마감임박 물건 -->
      <SectionBlock v-if="deadline && deadline.items.length > 0" heading="마감 임박 물건" subtext="입찰 마감이 가까운 물건입니다.">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AuctionCard v-for="item in deadline.items" :key="item.cltrMngNo" :item="item" />
        </div>
        <div class="mt-3 text-right">
          <NuxtLink to="/auction/list?sort=deadline" class="text-sm text-primary hover:underline">전체 보기 →</NuxtLink>
        </div>
      </SectionBlock>

      <!-- 랭킹 진입 -->
      <div class="bg-white rounded-xl border border-line p-4 shadow-card flex items-center justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-900">낙찰가율 랭킹</p>
          <p class="text-caption text-slate-500 mt-0.5">지역별·용도별 낙찰가율 통계를 확인하세요</p>
        </div>
        <NuxtLink to="/auction/ranking" class="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-dark transition-colors">
          랭킹 보기
        </NuxtLink>
      </div>

      <AdBanner />

      <!-- FAQ -->
      <SectionBlock heading="자주 묻는 질문">
        <div class="space-y-1">
          <details
            v-for="(faq, index) in AUCTION_FAQ"
            :key="index"
            class="group border-b border-line last:border-b-0"
          >
            <summary class="cursor-pointer py-3 text-base font-medium text-slate-800 flex items-center justify-between hover:text-primary">
              {{ faq.q }}
              <span class="material-symbols-outlined text-[18px] text-slate-500 group-open:rotate-180 transition-transform">expand_more</span>
            </summary>
            <p class="pb-3 text-sm text-slate-600 leading-relaxed">{{ faq.a }}</p>
          </details>
        </div>
      </SectionBlock>


      <DataSourceSection domain="auction" />
    </div>
  </div>
</template>

<script setup lang="ts">
// 전역 TrustLine 억제 — 이 페이지는 자체 데이터 출처 카드를 렌더한다 (#766)
definePageMeta({ hasSourceCard: true })

import { computed } from 'vue'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { useAuction } from '~/composables/useAuction'
import { AUCTION_META, AUCTION_FAQ } from '~/utils/auctionMeta'
import { USAGE_GROUP_LABEL } from '~/types/auction'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const auction = useAuction()

const { data: hub, error: hubError } = await useAsyncData(
  'auction-hub-summary',
  () => auction.getHubSummary(),
  { default: () => null },
)

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
if ((hubError.value || deadlineError.value) && import.meta.server) markDegradedResponse()

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
