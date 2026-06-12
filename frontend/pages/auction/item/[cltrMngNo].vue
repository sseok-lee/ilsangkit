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
import AuctionDetailInfo from '~/components/auction/AuctionDetailInfo.vue'
import AuctionMap from '~/components/auction/AuctionMap.vue'
import AuctionCard from '~/components/auction/AuctionCard.vue'
import AuctionPriceCompare from '~/components/auction/AuctionPriceCompare.vue'
import NearbyFacilities from '~/components/realEstate/NearbyFacilities.vue'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
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
const marketCompare = computed(() => data.value!.marketCompare ?? null)
// land: apslAssAmtForCompare(원/평)가 있으면 그 값을 컴포넌트에 주입해 단위 일치
const compareApslAmt = computed(() =>
  marketCompare.value?.apslAssAmtForCompare ?? item.value.apslAssAmt ?? null,
)
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
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero :description="[item.usage, item.orgNm].filter(Boolean).join(' · ')">
        <template #title>
          <span class="mb-2 flex items-center gap-2">
            <AuctionStatusBadge :status="item.status" />
            <span v-if="item.propertyType" class="text-caption font-normal text-muted">{{ item.propertyType }}</span>
          </span>
          {{ item.address }}
        </template>
      </PageHero>

      <AdBanner />

      <div class="mt-1 grid grid-cols-1 gap-4">
        <AuctionBidHistory :item="item" />
        <AuctionDetailInfo :item="item" />

        <!-- Ad: 입찰이력·상세정보 이후 -->
        <AdBanner />

        <AuctionPriceCompare
          v-if="marketCompare"
          :apsl-ass-amt="compareApslAmt"
          :market-avg="marketCompare.marketAvg"
          :market-label="marketCompare.label"
        />
        <AuctionMap v-if="item.lat != null && item.lng != null" :lat="item.lat" :lng="item.lng" :address="item.address" />

        <!-- Ad: 시세비교·지도 이후 -->
        <AdBanner />

        <SectionBlock v-if="nearby.length" heading="같은 지역 공매 물건">
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
        </SectionBlock>

        <!-- 주변 생활시설 (같은 지역 물건 아래) — 부동산 상세와 동일 컴포넌트 -->
        <SectionBlock
          v-if="item.lat != null && item.lng != null"
          heading="주변 생활시설"
          subtext="부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다."
        >
          <NearbyFacilities :lat="item.lat" :lng="item.lng" />
        </SectionBlock>
      </div>

      <!-- Ad: 같은지역·주변시설 이후 -->
      <AdBanner />

      <!-- FAQ -->
      <SectionBlock heading="자주 묻는 질문" subtext="공매와 관련된 자주 묻는 질문입니다.">
        <dl class="flex flex-col gap-4">
          <div v-for="faq in AUCTION_FAQ" :key="faq.q" class="rounded-xl border border-line bg-white p-4">
            <dt class="text-body font-semibold text-ink">{{ faq.q }}</dt>
            <dd class="mt-2 text-body text-muted leading-relaxed">{{ faq.a }}</dd>
          </div>
        </dl>
      </SectionBlock>

      <!-- Ad: 쿠팡 (페이지 맨 아래) -->
      <CoupangBanner />

      <DataSourceSection domain="auction" />
    </main>
  </div>
</template>
