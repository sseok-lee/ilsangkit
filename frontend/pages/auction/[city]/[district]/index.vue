<template>
  <div class="bg-background-light min-h-screen">
    <div class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="공매"
        :title="`${districtName} 공매 물건·낙찰가율`"
        :description="`${cityName} ${districtName} 부동산 공매 물건과 용도별 낙찰가율 통계를 확인하세요.`"
      />

      <!-- fail-open: 일시 장애(503)면 집계가 비어 보인다. 빈 화면 대신 이유를 밝힌다. -->
      <p v-if="regionFetchFailed" class="py-6 text-center text-sm text-slate-600">
        공매 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.
      </p>

      <!-- 용도별 집계 카드 -->
      <SectionBlock v-if="usageGroups.length > 0" heading="용도별 현황" subtext="용도별 낙찰가율과 물건 현황입니다.">
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div
            v-for="g in usageGroups"
            :key="g.usageGroup"
            class="bg-white rounded-xl border border-line p-4 shadow-card"
          >
            <p class="text-caption text-slate-500 mb-1">{{ USAGE_GROUP_LABEL[g.usageGroup] }}</p>
            <p class="text-sm font-bold text-slate-900">{{ formatBidRate(g.avgBidRate) }}</p>
            <p class="text-caption text-slate-500 mt-1">진행 {{ g.activeCount }}건 · 낙찰 {{ g.soldCount }}건</p>
          </div>
        </div>
      </SectionBlock>

      <!-- 진행중 물건 -->
      <SectionBlock v-if="activeItems.length > 0" heading="진행중 물건" subtext="현재 입찰 진행 중인 공매 물건입니다.">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AuctionCard v-for="item in activeItems" :key="item.cltrMngNo" :item="item" />
        </div>
        <div class="mt-3 text-right">
          <NuxtLink :to="`/auction/list?city=${cityName}&district=${districtName}`" class="text-sm text-primary hover:underline">전체 물건 보기 →</NuxtLink>
        </div>
      </SectionBlock>

      <!-- 최근 낙찰 물건 -->
      <SectionBlock v-if="recentSold.length > 0" heading="최근 낙찰" subtext="최근 낙찰된 공매 물건입니다.">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AuctionCard v-for="item in recentSold" :key="item.cltrMngNo" :item="item" />
        </div>
      </SectionBlock>

      <AdBanner />

      <!-- FAQ -->
      <SectionBlock heading="자주 묻는 질문">
        <div class="space-y-1">
          <details
            v-for="faq in AUCTION_FAQ"
            :key="faq.q"
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
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useAuction } from '~/composables/useAuction'
import { markDegradedResponse } from '~/composables/useDegradedResponse'
import { USAGE_GROUP_LABEL, formatBidRate } from '~/types/auction'
import { AUCTION_FAQ } from '~/utils/auctionMeta'
import { computeAuctionRegionHead } from '~/utils/auctionHead'
import { useStructuredData } from '~/composables/useStructuredData'
import { SITE_URL } from '~/utils/seoConstants'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const route = useRoute()
const citySlug = route.params.city as string
const districtSlug = route.params.district as string

// citySlug → 한글 이름
const cityName = CITY_SLUG_MAP[citySlug]
if (!cityName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

// districtSlug → 한글 이름 (역매핑)
const districtSlugToName = Object.fromEntries(
  Object.entries(DISTRICT_SLUG_MAP).map(([name, slug]) => [slug, name]),
)
const districtName = districtSlugToName[districtSlug]
if (!districtName) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const auction = useAuction()

const { data, error: regionError } = await useAsyncData(
  `auction-region-${citySlug}-${districtSlug}`,
  async () => {
    // derive bjdCode from /regions list then fetch detail
    const list = await auction.getRegions({ city: cityName })
    const row = list.items.find((i) => i.district === districtName)
    if (!row) return null
    const detail = await auction.getRegionDetail(row.bjdCode)
    return { row, detail }
  },
  { default: () => null },
)

// 확정 부재(지역 목록에 그 구·군이 없음)만 하드 404. 일시 장애는 fail-open.
//
// 기존엔 핸들러 안 try/catch 가 실패를 null 로 뭉갠 뒤 `!data.value` 로 404 를 던져,
// 백엔드가 한 번 흔들리면 사이트맵에 살아있는 공매 지역 허브가 통째로 하드 404 로 굳었다
// (2026-09-04 네이버 진단 "접근 불가" 523건의 경로 중 하나).
// getRegions/getRegionDetail 은 $fetch 예외를 삼키지 않으므로 실패가 regionError 로 올라오고,
// "그 구·군이 목록에 없음"은 예외 없이 null 로 구분된다 — land [dong].vue 와 같은 형태.
const regionFetchFailed = computed(() => !!regionError.value)
if (regionError.value) {
  if (import.meta.server) markDegradedResponse()
} else if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const usageGroups = computed(() => data.value?.detail.usageGroups ?? [])
const activeItems = computed(() => data.value?.detail.activeItems ?? [])
const recentSold = computed(() => data.value?.detail.recentSold ?? [])

const isIndexable = computed(() => usageGroups.value.some((g) => g.isIndexable))
const avgBidRate = computed(() => usageGroups.value.find((g) => g.avgBidRate != null)?.avgBidRate ?? null)
const totalActiveCount = computed(() => usageGroups.value.reduce((sum, g) => sum + g.activeCount, 0))

const selfUrl = `${SITE_URL}/auction/${citySlug}/${districtSlug}`

useHead(() =>
  computeAuctionRegionHead(
    {
      city: cityName,
      district: districtName,
      isIndexable: isIndexable.value,
      avgBidRate: avgBidRate.value,
      activeCount: totalActiveCount.value,
    },
    selfUrl,
  ),
)

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '공매', href: '/auction', current: false },
  { label: cityName, href: `/auction/${citySlug}`, current: false },
  { label: districtName, href: `/auction/${citySlug}/${districtSlug}`, current: true },
]

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '공매', url: '/auction' },
  { name: cityName, url: `/auction/${citySlug}` },
  { name: districtName, url: `/auction/${citySlug}/${districtSlug}` },
])
</script>
