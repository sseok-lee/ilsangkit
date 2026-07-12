<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" class="order-1 md:order-1" />

      <!-- T0: 모바일 핵심정보 헤더 (literal h1 1개 소유). 좌표 없음 → hideDirections(공유만). -->
      <MobileDetailHeader
        :title="dong"
        eyebrow="토지 실거래가"
        :stats="mobileHeaderStats"
        hide-directions
        class="order-2 md:order-2"
        @share="handleShare"
      />

      <!-- T0: 데스크톱 제목 (title-tag="div"로 강등 → 단일 h1 유지) -->
      <PageHero
        class="hidden md:block order-2 md:order-2"
        title-tag="div"
        eyebrow="토지 실거래가"
        :title="`${dong} 토지 실거래가`"
        :description="`${cityName} ${districtName} ${dong} 지역의 토지 매매 실거래가와 평당 시세를 확인하세요.`"
      />

      <!-- T1: 헤드라인 카드 (대지 평당가) — 첫 광고보다 위로 승격 -->
      <div class="order-3 md:order-3 bg-white rounded-xl border border-line shadow-card p-5 md:p-6">
        <div class="text-eyebrow text-slate-500 mb-1">대지(일반 거래) 평당가</div>
        <template v-if="summary && summary.avgPricePerPyeong != null">
          <div class="flex flex-wrap items-baseline gap-2">
            <strong class="text-display-1 text-slate-900">
              {{ formatManwonKorean(summary.avgPricePerPyeong) }}
            </strong>
            <span class="text-caption text-slate-500">
              (㎡당 {{ formatManwonKorean(pyeongToSqm(summary.avgPricePerPyeong)) }})
            </span>
          </div>
          <p class="mt-2 text-caption text-slate-400 leading-relaxed">
            비지분 대지 {{ summary.daeNonShareCount ?? 0 }}건 기준 · 최근 12개월 · 최신 거래 {{ formatLandDealDate(summary.latestDealDate) }} · 지분·도로 자투리 제외
          </p>
        </template>
        <div v-else class="rounded-xl bg-background-light p-6 text-center text-caption text-slate-500">
          비지분 대지 거래 없음 — 아래 지목별 시세를 참고하세요
        </div>
      </div>

      <!-- Ad①: T0/T1 직후 (고가시성 보존) -->
      <AdBanner class="order-4 md:order-4" />

      <!-- T1: 지목별 시세 -->
      <SectionBlock class="order-5 md:order-5" heading="지목별 시세" subtext="지목 그룹별 평균 평당가와 거래 건수입니다.">
        <div v-if="detail && detail.jimokGroups.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div
            v-for="g in detail.jimokGroups"
            :key="g.group"
            class="rounded-xl border p-4"
            :class="g.group === '대지' ? 'border-primary/40 bg-primary-50/40' : 'bg-white border-slate-200'"
          >
            <span class="block text-display-3 text-slate-800">{{ g.group }}</span>
            <template v-if="g.avgPricePerPyeong != null">
              <span class="block mt-1 text-body font-bold text-slate-900 tabular-nums">
                {{ formatManwonKorean(g.avgPricePerPyeong) }}
              </span>
              <span class="block text-caption text-slate-400 mt-0.5 tabular-nums">{{ g.count.toLocaleString('ko-KR') }}건</span>
            </template>
            <span v-else class="block mt-1 text-caption text-slate-500">
              거래 {{ g.count.toLocaleString('ko-KR') }}건
            </span>
          </div>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
          지목별 시세 데이터가 없습니다.
        </div>
      </SectionBlock>

      <!-- T3: 대지 거래 사례 -->
      <SectionBlock class="order-6 md:order-6" heading="대지 거래 사례" subtext="비지분 대지 거래 최신 사례입니다.">
        <div v-if="detail && detail.daeSamples.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div
            v-for="tx in detail.daeSamples"
            :key="tx.id"
            class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-caption text-slate-400">{{ String(tx.dealYear).slice(2) }}.{{ String(tx.dealMonth).padStart(2, '0') }}.{{ tx.dealDay != null ? String(tx.dealDay).padStart(2, '0') : '??' }}</span>
              <span v-if="tx.shareDeal" class="rounded-full bg-amber-50 px-2 py-0.5 text-caption font-semibold text-amber-700">지분</span>
            </div>
            <div class="flex flex-wrap items-baseline gap-1.5">
              <strong class="text-body font-bold text-slate-900 tabular-nums">{{ formatManwonKorean(tx.dealAmount) }}</strong>
              <span v-if="tx.dealArea != null" class="text-caption text-slate-500 tabular-nums">{{ tx.dealArea.toLocaleString('ko-KR') }}㎡</span>
            </div>
            <div class="text-caption text-slate-600">
              평당 <span class="font-semibold text-primary tabular-nums">{{ formatManwonKorean(tx.pricePerPyeong) }}</span>
            </div>
            <div v-if="tx.landUse" class="text-caption text-slate-400">{{ tx.landUse }}</div>
            <div v-if="tx.jibun" class="text-caption text-slate-300 mt-0.5">{{ tx.jibun }}</div>
          </div>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
          비지분 대지 거래 사례가 없습니다.
        </div>
      </SectionBlock>

      <!-- T3: 분기별 추이 + 용도지역 분포 (2-col grid) -->
      <div
        v-if="detail && (detail.priceTimeline.length > 0 || detail.landUseDistribution.length > 0)"
        class="order-7 md:order-7 grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <!-- 분기별 대지 평당가 추이 -->
        <SectionBlock
          v-if="detail.priceTimeline.length > 0"
          heading="분기별 대지 평당가 추이"
          subtext="비지분 대지 기준 분기별 평균 평당가입니다."
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse tabular-nums">
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th class="py-2 pr-3">분기</th>
                  <th class="py-2 pr-3 text-right">평균 평당가</th>
                  <th class="py-2 text-right">거래</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="point in detail.priceTimeline"
                  :key="`${point.year}-Q${point.quarter}`"
                  class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2 pr-3 text-slate-700">{{ point.year }}년 {{ point.quarter }}Q</td>
                  <td class="py-2 pr-3 text-slate-700 text-right">{{ formatManwonKorean(point.avgPricePerPyeong) }}</td>
                  <td class="py-2 text-slate-700 text-right">{{ point.count }}건</td>
                </tr>
              </tbody>
            </table>
          </div>
        </SectionBlock>

        <!-- 용도지역 분포 -->
        <SectionBlock
          v-if="detail.landUseDistribution.length > 0"
          heading="용도지역 분포"
          subtext="거래된 토지의 용도지역별 건수입니다."
        >
          <ul class="flex flex-col gap-2">
            <li
              v-for="item in detail.landUseDistribution"
              :key="item.landUse"
              class="flex items-center justify-between rounded-lg border border-line bg-background-light px-3 py-2 text-sm"
            >
              <span class="text-slate-700">{{ item.landUse }}</span>
              <span class="font-semibold text-slate-900 tabular-nums">{{ item.count.toLocaleString('ko-KR') }}건</span>
            </li>
          </ul>
        </SectionBlock>
      </div>

      <!-- Ad②: 추이/분포 ↔ 전체거래 사이로 이동 -->
      <AdBanner class="order-8 md:order-8" />

      <!-- T3: 전체 거래 내역 -->
      <SectionBlock v-if="detail && detail.total > 0" class="order-9 md:order-9" heading="전체 거래 내역" :subtext="`전체 ${detail.total.toLocaleString('ko-KR')}건 · 지분·도로 포함`">
        <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse tabular-nums">
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th class="py-2 pr-3">지목</th>
                  <th class="py-2 pr-3 text-right">면적(㎡)</th>
                  <th class="py-2 pr-3 text-right">평당가</th>
                  <th class="py-2 pr-3">거래일</th>
                  <th class="py-2"></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="tx in txItems"
                  :key="tx.id"
                  class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2.5 pr-3 text-slate-700">{{ tx.jimok ?? '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700 text-right">{{ tx.dealArea != null ? tx.dealArea.toLocaleString('ko-KR') : '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700 text-right">{{ formatManwonKorean(tx.pricePerPyeong) }}</td>
                  <td class="py-2.5 pr-3 text-slate-700">
                    {{ String(tx.dealYear).slice(2) }}.{{ String(tx.dealMonth).padStart(2, '0') }}.{{ tx.dealDay != null ? String(tx.dealDay).padStart(2, '0') : '??' }}
                  </td>
                  <td class="py-2.5 text-slate-500">
                    <span v-if="tx.shareDeal" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">지분</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        <Pagination :current-page="txPage" :total-pages="txTotalPages" @page-change="goToTxPage" />
      </SectionBlock>

      <!-- Ad③: 전체거래 이후 -->
      <AdBanner class="order-10 md:order-10" />

      <!-- T5: FAQ -->
      <SectionBlock class="order-11 md:order-11" heading="자주 묻는 질문" subtext="토지 실거래가와 관련된 자주 묻는 질문입니다.">
        <p class="text-sm text-slate-700 mb-6 leading-relaxed">{{ pageDescription }}</p>
        <dl class="flex flex-col gap-4">
          <div v-for="faq in LAND_FAQ" :key="faq.q" class="rounded-xl border border-line bg-white p-4">
            <dt class="text-body font-semibold text-slate-800">{{ faq.q }}</dt>
            <dd class="mt-2 text-body text-slate-600 leading-relaxed">{{ faq.a }}</dd>
          </div>
        </dl>
      </SectionBlock>

      <!-- Ad: 쿠팡 (페이지 맨 아래) -->
      <CoupangBanner class="order-12 md:order-12" />

      <!-- T6: 데이터 출처 (멀티루트 컴포넌트 → wrapper div에 order 부여) -->
      <div class="order-12 md:order-12">
        <DataSourceSection domain="real-estate" />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import { useLand } from '~/composables/useLand'
import { buildLandRegionTitle, buildLandRegionDescription, LAND_FAQ } from '~/utils/landMeta'
import { pyeongToSqm, formatManwonKorean, formatLandDealDate } from '~/types/land'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Pagination from '~/components/common/Pagination.vue'
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

// dong: URL-decode + NFC normalize
const dong = decodeURIComponent(route.params.dong as string).normalize('NFC')

// ── Data fetch ────────────────────────────────────────────────────────────────

const land = useLand()

const { data } = await useAsyncData(
  `land-dong-${citySlug}-${districtSlug}-${dong}`,
  async () => {
    const list = await land.getRegions({ city: cityName, district: districtName, page: 1, limit: 100 })
    const summary = list.items.find((i) => i.dongName === dong)
    if (!summary) return null
    const detail = await land.getRegionDetail({
      bjdCode: summary.bjdCode,
      dongName: dong,
      page: 1,
      limit: 20,
    })
    return { summary, detail }
  },
  { default: () => null },
)

// 404 if dong not found
if (import.meta.server || !data.value) {
  if (!data.value) {
    throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
  }
}

// ── Computed helpers ──────────────────────────────────────────────────────────

const summary = computed(() => data.value?.summary ?? null)
const detail = computed(() => data.value?.detail ?? null)

// 모바일 헤더 stat 칩: 평당가 · 거래건수 · 최신거래일 ('정보없음' 필터 후 최대 4개)
const mobileHeaderStats = computed(() => {
  const s = summary.value
  if (!s) return []
  const stats: Array<{ label: string; value: string; color?: string }> = []
  if (s.avgPricePerPyeong != null) {
    stats.push({ label: '평당가', value: formatManwonKorean(s.avgPricePerPyeong), color: 'text-primary' })
  }
  if (s.transactionCount != null && s.transactionCount > 0) {
    stats.push({ label: '거래', value: `${s.transactionCount.toLocaleString('ko-KR')}건` })
  }
  if (s.latestDealDate) {
    stats.push({ label: '최신거래', value: formatLandDealDate(s.latestDealDate) })
  }
  return stats.slice(0, 4)
})

// ── 전체 거래 내역 페이지네이션 ───────────────────────────────────────────────

const TX_LIMIT = 20
const txItems = ref([...(data.value?.detail?.items ?? [])])
const txPage = ref(1)
const txTotalPages = computed(() =>
  detail.value ? (detail.value.total === 0 ? 0 : Math.ceil(detail.value.total / TX_LIMIT)) : 1
)

async function goToTxPage(p: number) {
  const bjd = summary.value?.bjdCode
  if (!bjd) return
  const res = await useLand().getTransactions({ bjdCode: bjd, dongName: dong, page: p, limit: TX_LIMIT })
  txItems.value = res.items
  txPage.value = res.page
}

// 헤더 공유 버튼: Web Share API 우선, 미지원 시 URL 클립보드 복사
async function handleShare() {
  if (!import.meta.client) return
  const url = window.location.href
  if (navigator.share) {
    try {
      await navigator.share({ title: pageTitle, url })
    } catch {
      // 사용자가 취소한 경우 등 — 무시
    }
    return
  }
  try {
    await navigator.clipboard.writeText(url)
    alert('링크가 복사되었습니다.')
  } catch {
    // 클립보드 미지원 — 무시
  }
}

// ── SEO / Head ────────────────────────────────────────────────────────────────

// noindex: if data not found or not indexable
const noindex = computed(() => !(data.value?.summary?.isIndexable))

const pageTitle = buildLandRegionTitle({ city: cityName, district: districtName, dong })

const pageDescription = computed(() =>
  buildLandRegionDescription({
    city: cityName,
    district: districtName,
    dong,
    avgPricePerPyeong: summary.value?.avgPricePerPyeong ?? null,
    count: summary.value?.transactionCount ?? 0,
  })
)

useHead(() => {
  const title = pageTitle
  const description = pageDescription.value

  const selfCanonical = `${SITE_URL}/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}`

  // 토지 동상세는 단일 대표 좌표가 없어(LandRegionSummary에 lat/lng 없음) /og-map 대신
  // 정적 대표 PNG를 사용. 네이버 썸네일 크롤러는 webp/SVG를 미렌더하므로 항상 PNG여야 한다.
  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfCanonical },
    { property: 'og:type', content: 'website' },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ]

  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }

  // noindex-canonical-policy: noindex 페이지는 canonical 을 출력하지 않는다 (혼합 신호 방지)
  return {
    title,
    meta,
    ...(noindex.value ? {} : { link: [{ rel: 'canonical', href: selfCanonical }] }),
  }
})

// ── Breadcrumb ────────────────────────────────────────────────────────────────

const breadcrumbItems = [
  { label: '홈', href: '/', current: false },
  { label: '부동산 실거래가', href: '/real-estate', current: false },
  { label: '토지 실거래가', href: '/real-estate/land', current: false },
  { label: cityName, href: `/real-estate/land/${citySlug}`, current: false },
  { label: districtName, href: `/real-estate/land/${citySlug}/${districtSlug}`, current: false },
  { label: dong, href: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}`, current: true },
]

const { setBreadcrumbSchema, setFAQSchema, setDetailProvenance } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
  { name: cityName, url: `/real-estate/land/${citySlug}` },
  { name: districtName, url: `/real-estate/land/${citySlug}/${districtSlug}` },
  { name: dong, url: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}` },
])

// FAQPage JSON-LD (LAND_FAQ는 {q,a} → setFAQSchema는 {question,answer} 요구 → 어댑터)
setFAQSchema(LAND_FAQ.map((f) => ({ question: f.q, answer: f.a })))

// 출처 Dataset(provenance) — 국토교통부 토지 실거래가. (토지 요약엔 page updatedAt 없음 → dateModified 생략)
setDetailProvenance({
  domain: 'real-estate',
  path: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}`,
  description: pageDescription.value,
  updatedAt: null,
  noindex: noindex.value,
})

// 동(洞) 엔티티 — 좌표 없는 행정구역이라 minimal Place(주소 기반). 인덱서블일 때만.
if (!noindex.value) {
  useHead({
    script: [
      {
        key: 'jsonld-land-place',
        type: 'application/ld+json',
        innerHTML: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'Place',
          name: `${districtName} ${dong}`,
          address: {
            '@type': 'PostalAddress',
            addressCountry: 'KR',
            addressRegion: cityName,
            addressLocality: `${districtName} ${dong}`,
          },
        }),
      },
    ],
  })
}
</script>
