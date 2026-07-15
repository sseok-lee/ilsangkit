<!-- frontend/pages/auction/item/[cltrMngNo].vue  — land [dong].vue와 동일하게 auto-import 사용(#imports 금지) -->
<script setup lang="ts">
import { computed } from 'vue'
import { useAuction } from '~/composables/useAuction'
import { SITE_URL } from '~/utils/seoConstants'
import { computeAuctionItemHead } from '~/utils/auctionHead'
import { AUCTION_FAQ } from '~/utils/auctionMeta'
import { formatWonKorean, formatDiscount, isAuctionItemIndexable } from '~/types/auction'
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
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
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

// ── 모바일 헤더: eyebrow(용도/배지) + stat 칩(감정가/최저가/할인율/유찰) ──────────
const headerEyebrow = computed(() =>
  [item.value.usage, item.value.propertyType].filter(Boolean).join(' · ') || '공매 물건',
)
const headerStats = computed(() => {
  const out: Array<{ label: string; value: string; color?: string }> = []
  if (item.value.apslAssAmt != null) out.push({ label: '감정가', value: formatWonKorean(item.value.apslAssAmt) })
  if (item.value.minBidPrc != null) out.push({ label: '최저가', value: formatWonKorean(item.value.minBidPrc), color: 'text-primary' })
  const discount = formatDiscount(item.value.apslAssAmt, item.value.minBidPrc)
  if (discount !== '-') out.push({ label: '할인율', value: discount, color: 'text-emerald-700' })
  out.push({ label: '유찰', value: `${item.value.failCnt}회` })
  return out.slice(0, 4)
})

// ── 길찾기 URL (좌표 우선, 없으면 주소 검색) ──────────────────────────────────
const hasCoords = computed(() => item.value.lat != null && item.value.lng != null)
const kakaoMapUrl = computed(() => {
  const label = encodeURIComponent(item.value.address || '공매 물건')
  return hasCoords.value
    ? `https://map.kakao.com/link/to/${label},${item.value.lat},${item.value.lng}`
    : `https://map.kakao.com/link/search/${label}`
})
const naverMapUrl = computed(() => {
  const label = encodeURIComponent(item.value.address || '공매 물건')
  return hasCoords.value
    ? `https://map.naver.com/v5/directions/-/${item.value.lng},${item.value.lat},${label}/-/walk`
    : `https://map.naver.com/v5/search/${label}`
})
function openNavigation(provider: 'kakao' | 'naver') {
  if (!import.meta.client) return
  window.open(provider === 'kakao' ? kakaoMapUrl.value : naverMapUrl.value, '_blank')
}
async function handleShare() {
  if (!import.meta.client) return
  const shareData = { title: item.value.address || '공매 물건', url: selfUrl }
  try {
    if (navigator.share) await navigator.share(shareData)
    else {
      await navigator.clipboard.writeText(selfUrl)
      alert('링크가 복사되었습니다.')
    }
  } catch (err) {
    console.error('공유 실패:', err)
  }
}

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

const { setBreadcrumbSchema, setFAQSchema, setDetailProvenance, setAuctionListingSchema } = useStructuredData()
// ── FAQ 구조화 데이터(FAQPage JSON-LD) — spec §3.4 / 결정4 ────────────────────
setFAQSchema(AUCTION_FAQ.map((f) => ({ question: f.q, answer: f.a })))
setBreadcrumbSchema(
  breadcrumbItems.value.map((b) => ({ name: b.label, url: b.href })),
)
setDetailProvenance({
  domain: 'auction', path: `/auction/item/${item.value.cltrMngNo}`,
  description: `${item.value.address ?? '공매 물건'} ${item.value.usage ? item.value.usage + ' ' : ''}물건의 온비드 공매 정보 데이터입니다. 한국자산관리공사 기반으로 감정가·최저입찰가·입찰일정 등 공매 정보를 제공합니다.`,
  updatedAt: null,
  noindex: !isAuctionItemIndexable(item.value),
})
setAuctionListingSchema({
  address: item.value.address,
  usage: item.value.usage,
  minBidPrc: item.value.minBidPrc,
  appraisalAmt: item.value.apslAssAmt,
})
</script>

<template>
  <div class="bg-background-light min-h-screen">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <!-- 모바일: 공용 핵심정보 헤더(literal h1 1개 소유) -->
      <MobileDetailHeader
        :title="item.address"
        :eyebrow="headerEyebrow"
        :stats="headerStats"
        :kakao-map-url="kakaoMapUrl"
        :naver-map-url="naverMapUrl"
        @share="handleShare"
        @directions="openNavigation"
      />
      <!-- 데스크톱: PageHero(title-tag=div 로 강등 → 단일 h1 유지) -->
      <PageHero
        class="hidden md:block"
        title-tag="div"
        :description="[item.usage, item.orgNm].filter(Boolean).join(' · ')"
      >
        <template #title>
          <span class="mb-2 flex items-center gap-2">
            <AuctionStatusBadge :status="item.status" />
            <span v-if="item.propertyType" class="text-caption font-normal text-muted">{{ item.propertyType }}</span>
          </span>
          {{ item.address }}
        </template>
      </PageHero>

      <AdBanner />

      <div class="mt-1 flex flex-col gap-4">
        <!-- T1: 입찰 정보 (이 URL 고유 핵심 데이터) -->
        <AuctionBidHistory
          :item="item"
          data-test="tier-bid-history"
          class="order-1 md:order-1"
        />

        <!-- T1b: 실거래가 시세 비교 (입찰정보 직후 상향) -->
        <AuctionPriceCompare
          v-if="marketCompare"
          :apsl-ass-amt="compareApslAmt"
          :market-avg="marketCompare.marketAvg"
          :market-label="marketCompare.label"
          data-test="tier-price-compare"
          class="order-2 md:order-2"
        />

        <!-- Ad②: 입찰정보·시세비교 이후 (단 사이 위치 보존) -->
        <AdBanner class="order-3 md:order-3" />

        <!-- T3: 공매 스펙 (멀티루트 → wrapper div 에 order) -->
        <div data-test="tier-detail-info" class="order-4 md:order-4 flex flex-col gap-4">
          <AuctionDetailInfo :item="item" />
        </div>

        <!-- T2: 위치 (시세비교 뒤로 강등) -->
        <AuctionMap
          v-if="item.lat != null && item.lng != null"
          :lat="item.lat"
          :lng="item.lng"
          :address="item.address"
          class="order-5 md:order-5"
        />

        <!-- Ad③: 스펙·지도 이후 (단 사이 위치 보존) -->
        <AdBanner class="order-6 md:order-6" />

        <!-- T4: 같은 지역 공매 물건 -->
        <SectionBlock
          v-if="nearby.length"
          heading="같은 지역 공매 물건"
          class="order-7 md:order-7"
        >
          <div class="grid grid-cols-1 gap-2 sm:grid-cols-2"><AuctionCard v-for="n in nearby" :key="n.cltrMngNo" :item="n" /></div>
        </SectionBlock>

        <!-- T4: 주변 생활시설 — 부동산 상세와 동일 컴포넌트 -->
        <SectionBlock
          v-if="item.lat != null && item.lng != null"
          heading="주변 생활시설"
          subtext="부동산 판단에 직결되는 주변 인프라를 한눈에 확인합니다."
          class="order-8 md:order-8"
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

      <!-- 온비드 입찰 외부 CTA (order-9) -->
      <div class="order-9">
        <a :href="`https://www.onbid.co.kr/op/cta/cltrMgNo/ctaCltrMgNoInfo.do?cltrMgNo=${item.cltrMngNo}`"
           target="_blank" rel="noopener noreferrer"
           class="flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm">
          <span class="material-symbols-outlined text-[20px]">gavel</span>
          온비드에서 입찰하기
        </a>
      </div>


      <DataSourceSection domain="auction" :last-sync-date="null" />
    </main>
  </div>
</template>
