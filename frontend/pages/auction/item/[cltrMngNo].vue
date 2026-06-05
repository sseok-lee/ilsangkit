<!-- frontend/pages/auction/item/[cltrMngNo].vue  — land [dong].vue와 동일하게 auto-import 사용(#imports 금지) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuction } from '~/composables/useAuction'
import { SITE_URL } from '~/utils/seoConstants'
import { computeAuctionItemHead } from '~/utils/auctionHead'
import { AUCTION_FAQ } from '~/utils/auctionMeta'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import AuctionStatusBadge from '~/components/auction/AuctionStatusBadge.vue'
import AuctionBidHistory from '~/components/auction/AuctionBidHistory.vue'
import AuctionMap from '~/components/auction/AuctionMap.vue'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
// useRoute/useAsyncData/createError/useHead 는 Nuxt auto-import (land [dong].vue와 동일)

const route = useRoute()
const cltrMngNo = String(route.params.cltrMngNo)
const auction = useAuction()
const { data } = await useAsyncData(
  `auction-item-${cltrMngNo}`,
  async () => {
    try {
      return await auction.getItemDetail(cltrMngNo)
    } catch {
      return null
    }
  },
  { default: () => null },
)
if (import.meta.server || !data.value) {
  if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
}

const item = computed(() => data.value!.item)
const nearby = computed(() => data.value!.nearby)
const selfUrl = `${SITE_URL}/auction/item/${cltrMngNo}`
useHead(() => computeAuctionItemHead(item.value, selfUrl))

// ── Breadcrumb ──────────────────────────────────────────────────────────────

// slug → 한글 역매핑 (district)
const districtSlugToName = Object.fromEntries(
  Object.entries(DISTRICT_SLUG_MAP).map(([name, slug]) => [slug, name]),
)

// 시/도 slug 찾기 (한글 → slug)
const CITY_NAME_TO_SLUG = Object.fromEntries(
  Object.entries(CITY_SLUG_MAP).map(([slug, name]) => [name, slug]),
)

const breadcrumbItems = computed(() => {
  const city = item.value?.city ?? ''
  const district = item.value?.district ?? ''
  const label = item.value?.address ?? item.value?.usage ?? '물건'

  if (!city || !district) {
    return [
      { label: '홈', href: '/', current: false },
      { label: '공매', href: '/auction', current: false },
      { label: '물건', href: `/auction/item/${cltrMngNo}`, current: true },
    ]
  }

  const citySlug = CITY_NAME_TO_SLUG[city] ?? ''
  const districtSlug = DISTRICT_SLUG_MAP[district] ?? ''

  return [
    { label: '홈', href: '/', current: false },
    { label: '공매', href: '/auction', current: false },
    ...(citySlug ? [{ label: city, href: `/auction/${citySlug}`, current: false }] : []),
    ...(citySlug && districtSlug ? [{ label: district, href: `/auction/${citySlug}/${districtSlug}`, current: false }] : []),
    { label, href: `/auction/item/${cltrMngNo}`, current: true },
  ]
})

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema(
  breadcrumbItems.value.map((b) => ({ name: b.label, url: b.href })),
)
</script>

<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-3xl px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <div class="flex items-center gap-2 mb-2">
        <AuctionStatusBadge :status="item.status" />
        <span v-if="item.propertyType" class="text-caption text-slate-500">{{ item.propertyType }}</span>
      </div>
      <h1 class="text-display-3 font-bold text-slate-900">{{ item.address }}</h1>
      <p class="text-caption text-slate-500 mt-1">{{ item.usage }} · {{ item.orgNm }}</p>

      <div class="mt-4 grid gap-4">
        <AuctionBidHistory :item="item" />
        <AuctionMap v-if="item.lat != null && item.lng != null" :lat="item.lat" :lng="item.lng" :address="item.address" />

        <div v-if="nearby.length" class="bg-white rounded-xl border border-line p-4 shadow-card">
          <h3 class="text-sm font-semibold text-slate-900 mb-3">같은 지역 공매 물건</h3>
          <div class="grid gap-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
        </div>
      </div>

      <!-- FAQ -->
      <SectionBlock heading="자주 묻는 질문" subtext="공매와 관련된 자주 묻는 질문입니다.">
        <dl class="flex flex-col gap-4">
          <div v-for="faq in AUCTION_FAQ" :key="faq.q" class="rounded-xl border border-line bg-white p-4">
            <dt class="text-body font-semibold text-slate-800">{{ faq.q }}</dt>
            <dd class="mt-2 text-body text-slate-600 leading-relaxed">{{ faq.a }}</dd>
          </div>
        </dl>
      </SectionBlock>

      <DataSourceSection domain="auction" />
    </main>
  </div>
</template>
