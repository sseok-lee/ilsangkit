<template>
  <div class="bg-background-light min-h-screen">
    <main class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <Breadcrumb :items="breadcrumbItems" />

      <PageHero
        eyebrow="토지 실거래가"
        :title="`${dong} 토지 실거래가`"
        :description="`${cityName} ${districtName} ${dong} 지역의 토지 매매 실거래가와 평당 시세를 확인하세요.`"
      />

      <!-- Ad: Hero 직후 -->
      <AdBanner />

      <!-- 평당가 요약 -->
      <SectionBlock heading="평당가 요약" subtext="대지 기준 평당 시세와 최근 거래 현황입니다.">
        <div v-if="summary && summary.avgPricePerPyeong != null" class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <span class="block text-xs font-semibold text-slate-500">대지 평당가</span>
            <strong class="block mt-1 text-base font-bold text-slate-900">
              평당 {{ summary.avgPricePerPyeong.toLocaleString('ko-KR') }}만원
            </strong>
            <span class="text-xs text-slate-400">
              (㎡당 {{ pyeongToSqm(summary.avgPricePerPyeong)?.toLocaleString('ko-KR') ?? '-' }}만원)
            </span>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <span class="block text-xs font-semibold text-slate-500">대지 거래</span>
            <strong class="block mt-1 text-base font-bold text-slate-900">
              {{ summary.daeCount.toLocaleString('ko-KR') }}건
            </strong>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <span class="block text-xs font-semibold text-slate-500">전체 거래</span>
            <strong class="block mt-1 text-base font-bold text-slate-900">
              {{ summary.transactionCount.toLocaleString('ko-KR') }}건
            </strong>
          </div>
          <div class="rounded-xl border border-slate-200 bg-white p-4">
            <span class="block text-xs font-semibold text-slate-500">최신 거래일</span>
            <strong class="block mt-1 text-base font-bold text-slate-900">
              {{ summary.latestDealDate ?? '-' }}
            </strong>
          </div>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          대지 거래 없음
        </div>
      </SectionBlock>

      <!-- 거래내역 표 -->
      <SectionBlock heading="거래 내역" subtext="최근 토지 거래 내역입니다. 지번·지목·면적·평당가·거래일을 확인하세요.">
        <div v-if="detail && detail.items.length > 0" class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                <th class="py-2 pr-3">지번</th>
                <th class="py-2 pr-3">지목</th>
                <th class="py-2 pr-3">면적(㎡)</th>
                <th class="py-2 pr-3">평당가(만원)</th>
                <th class="py-2 pr-3">거래일</th>
                <th class="py-2"></th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="tx in detail.items"
                :key="tx.id"
                class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td class="py-2.5 pr-3 text-slate-700">{{ tx.jibun ?? '-' }}</td>
                <td class="py-2.5 pr-3 text-slate-700">{{ tx.jimok ?? '-' }}</td>
                <td class="py-2.5 pr-3 text-slate-700">{{ tx.dealArea != null ? tx.dealArea.toLocaleString('ko-KR') : '-' }}</td>
                <td class="py-2.5 pr-3 text-slate-700">
                  {{ tx.pricePerPyeong != null ? tx.pricePerPyeong.toLocaleString('ko-KR') : '-' }}
                </td>
                <td class="py-2.5 pr-3 text-slate-700">
                  {{ tx.dealYear }}.{{ String(tx.dealMonth).padStart(2, '0') }}.{{ tx.dealDay != null ? String(tx.dealDay).padStart(2, '0') : '??' }}
                </td>
                <td class="py-2.5 text-slate-500">
                  <span v-if="tx.shareDeal" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">지분</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500">
          거래 내역이 없습니다.
        </div>
      </SectionBlock>

      <!-- Ad: 거래내역 이후 -->
      <AdBanner />

      <!-- 평당가 시계열 (대지 기준) -->
      <SectionBlock
        v-if="detail && detail.priceTimeline.length > 0"
        heading="평당가 추이"
        subtext="대지 기준 월별 평균 평당가(만원) 추이입니다."
      >
        <div class="overflow-x-auto">
          <table class="w-full text-sm border-collapse">
            <thead>
              <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                <th class="py-2 pr-3">연월</th>
                <th class="py-2 pr-3">평균 평당가(만원)</th>
                <th class="py-2">거래 건수</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="point in detail.priceTimeline"
                :key="`${point.year}-${point.month}`"
                class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <td class="py-2.5 pr-3 text-slate-700">{{ point.year }}.{{ String(point.month).padStart(2, '0') }}</td>
                <td class="py-2.5 pr-3 text-slate-700">
                  {{ point.avgPricePerPyeong != null ? point.avgPricePerPyeong.toLocaleString('ko-KR') : '-' }}
                </td>
                <td class="py-2.5 text-slate-700">{{ point.count }}건</td>
              </tr>
            </tbody>
          </table>
        </div>
      </SectionBlock>

      <!-- 지목 분포 -->
      <SectionBlock
        v-if="detail && detail.jimokDistribution.length > 0"
        heading="지목 분포"
        subtext="거래된 토지의 지목별 건수와 평균 평당가입니다."
      >
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div
            v-for="item in detail.jimokDistribution"
            :key="item.jimok"
            class="rounded-xl border border-slate-200 bg-white p-4"
          >
            <span class="block text-sm font-semibold text-slate-800">{{ item.jimok }}</span>
            <span class="block text-xs text-slate-500 mt-1">{{ item.count.toLocaleString('ko-KR') }}건</span>
            <span v-if="item.avgPricePerPyeong != null" class="block text-xs text-slate-400">
              평당 {{ item.avgPricePerPyeong.toLocaleString('ko-KR') }}만원
            </span>
          </div>
        </div>
      </SectionBlock>

      <!-- 용도지역 분포 -->
      <SectionBlock
        v-if="detail && detail.landUseDistribution.length > 0"
        heading="용도지역 분포"
        subtext="거래된 토지의 용도지역별 건수입니다."
      >
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
          <div
            v-for="item in detail.landUseDistribution"
            :key="item.landUse"
            class="rounded-xl border border-slate-200 bg-white p-4"
          >
            <span class="block text-sm font-semibold text-slate-800">{{ item.landUse }}</span>
            <span class="block text-xs text-slate-500 mt-1">{{ item.count.toLocaleString('ko-KR') }}건</span>
          </div>
        </div>
      </SectionBlock>

      <!-- Ad: 분포 이후 -->
      <AdBanner />

      <!-- 설명 및 FAQ -->
      <SectionBlock heading="자주 묻는 질문" subtext="토지 실거래가와 관련된 자주 묻는 질문입니다.">
        <p class="text-sm text-slate-700 mb-6 leading-relaxed">{{ pageDescription }}</p>
        <dl class="flex flex-col gap-4">
          <div v-for="faq in LAND_FAQ" :key="faq.q" class="rounded-xl border border-slate-200 bg-white p-4">
            <dt class="text-sm font-semibold text-slate-800">{{ faq.q }}</dt>
            <dd class="mt-2 text-sm text-slate-600 leading-relaxed">{{ faq.a }}</dd>
          </div>
        </dl>
      </SectionBlock>

      <DataSourceSection domain="real-estate" />
    </main>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import { useLand } from '~/composables/useLand'
import { buildLandRegionTitle, buildLandRegionDescription, LAND_FAQ } from '~/utils/landMeta'
import { pyeongToSqm } from '~/types/land'
import { SITE_URL } from '~/utils/seoConstants'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
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

  // Canonical: self if indexable, district page if noindex
  const selfCanonical = `${SITE_URL}/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}`
  const districtCanonical = `${SITE_URL}/real-estate/land/${citySlug}/${districtSlug}`
  const canonicalUrl = noindex.value ? districtCanonical : selfCanonical

  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
  ]

  if (noindex.value) {
    meta.push({ name: 'robots', content: 'noindex, follow' })
  }

  return {
    title,
    meta,
    // noindex: point canonical to district (not omit, so crawlers know where to go)
    // indexable: point canonical to self
    link: [{ rel: 'canonical', href: canonicalUrl }],
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

const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
  { name: '토지 실거래가', url: '/real-estate/land' },
  { name: cityName, url: `/real-estate/land/${citySlug}` },
  { name: districtName, url: `/real-estate/land/${citySlug}/${districtSlug}` },
  { name: dong, url: `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}` },
])
</script>
