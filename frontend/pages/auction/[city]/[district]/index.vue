<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="공매"
        :title="`${districtName} 공매 물건·낙찰가율`"
        :description="`${cityName} ${districtName} 부동산 공매 물건과 용도별 낙찰가율 통계를 확인하세요.`"
      />

      <!-- 용도별 집계 카드 -->
      <SectionBlock v-if="usageGroups.length > 0" subtext="용도별 낙찰가율과 물건 현황입니다.">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">용도별 현황</h2>
        </template>
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
      <SectionBlock v-if="activeItems.length > 0" subtext="현재 입찰 진행 중인 공매 물건입니다.">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">진행중 물건</h2>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <AuctionCard v-for="item in activeItems" :key="item.cltrMngNo" :item="item" />
        </div>
        <div class="mt-3 text-right">
          <NuxtLink :to="`/auction/list?city=${cityName}&district=${districtName}`" class="text-sm text-primary hover:underline">전체 물건 보기 →</NuxtLink>
        </div>
      </SectionBlock>

      <!-- 최근 낙찰 물건 -->
      <SectionBlock v-if="recentSold.length > 0" subtext="최근 낙찰된 공매 물건입니다.">
        <template #heading>
          <h2 class="text-display-3 text-slate-900">최근 낙찰</h2>
        </template>
        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <AuctionCard v-for="item in recentSold" :key="item.cltrMngNo" :item="item" />
        </div>
      </SectionBlock>

      <AdBanner />

      <!-- FAQ -->
      <SectionBlock>
        <template #heading>
          <h2 class="text-display-3 text-slate-900">자주 묻는 질문</h2>
        </template>
        <dl class="flex flex-col gap-4">
          <div v-for="faq in AUCTION_FAQ" :key="faq.q" class="rounded-xl border border-line bg-white p-4">
            <dt class="text-body font-semibold text-slate-800">{{ faq.q }}</dt>
            <dd class="mt-2 text-body text-slate-600 leading-relaxed">{{ faq.a }}</dd>
          </div>
        </dl>
      </SectionBlock>

      <section>
        <p class="text-caption text-slate-400">출처: 한국자산관리공사 온비드 (공공데이터포털)</p>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useAuction } from '~/composables/useAuction'
import { USAGE_GROUP_LABEL, formatBidRate } from '~/types/auction'
import { AUCTION_FAQ } from '~/utils/auctionMeta'
import { computeAuctionRegionHead } from '~/utils/auctionHead'
import { SITE_URL } from '~/utils/seoConstants'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import AuctionCard from '~/components/auction/AuctionCard.vue'

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

const { data } = await useAsyncData(
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

if (!data.value) {
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
</script>
