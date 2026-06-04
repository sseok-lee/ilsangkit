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

      <!-- 1. 헤드라인 카드 -->
      <div class="rounded-xl border border-slate-200 bg-white p-5 md:p-6">
        <div class="text-xs font-semibold text-slate-500 mb-1">대지(일반 거래) 평당가</div>
        <template v-if="summary && summary.avgPricePerPyeong != null">
          <div class="flex flex-wrap items-baseline gap-2">
            <strong class="text-2xl md:text-3xl font-bold text-slate-900">
              {{ formatManwonKorean(summary.avgPricePerPyeong) }}
            </strong>
            <span class="text-sm text-slate-500">
              (㎡당 {{ formatManwonKorean(pyeongToSqm(summary.avgPricePerPyeong)) }})
            </span>
          </div>
          <p class="mt-2 text-xs text-slate-400 leading-relaxed">
            비지분 대지 {{ summary.daeNonShareCount }}건 기준 · 최근 12개월 · 최신 거래 {{ formatLandDealDate(summary.latestDealDate) }} · 지분·도로 자투리 제외
          </p>
        </template>
        <div v-else class="rounded-lg bg-slate-50 p-6 text-center text-slate-500 text-sm">
          비지분 대지 거래 없음 — 아래 지목별 시세를 참고하세요
        </div>
      </div>

      <!-- 2. 지목별 시세 -->
      <SectionBlock heading="지목별 시세" subtext="지목 그룹별 평균 평당가와 거래 건수입니다.">
        <div v-if="detail && detail.jimokGroups.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          <div
            v-for="g in detail.jimokGroups"
            :key="g.group"
            class="rounded-xl border bg-white p-4"
            :class="g.group === '대지' ? 'border-blue-200' : 'border-slate-200'"
          >
            <span class="block text-sm font-semibold text-slate-800">{{ g.group }}</span>
            <span v-if="g.avgPricePerPyeong != null" class="block mt-1 text-base font-bold text-slate-900">
              {{ formatManwonKorean(g.avgPricePerPyeong) }}
            </span>
            <span v-else class="block mt-1 text-sm text-slate-500">
              거래만 {{ g.count }}건
            </span>
            <span class="block text-xs text-slate-400 mt-0.5">{{ g.count.toLocaleString('ko-KR') }}건</span>
          </div>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
          지목별 시세 데이터가 없습니다.
        </div>
      </SectionBlock>

      <!-- 3. 대지 거래 사례 -->
      <SectionBlock heading="대지 거래 사례" subtext="비지분 대지 거래 최신 사례입니다.">
        <div v-if="detail && detail.daeSamples.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div
            v-for="tx in detail.daeSamples"
            :key="tx.id"
            class="rounded-xl border border-slate-200 bg-white p-4 flex flex-col gap-1.5"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs text-slate-400">{{ tx.dealYear }}.{{ String(tx.dealMonth).padStart(2, '0') }}.{{ tx.dealDay != null ? String(tx.dealDay).padStart(2, '0') : '??' }}</span>
              <span v-if="tx.shareDeal" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">지분</span>
            </div>
            <div class="flex flex-wrap items-baseline gap-1.5">
              <strong class="text-base font-bold text-slate-900">{{ formatManwonKorean(tx.dealAmount) }}</strong>
              <span v-if="tx.dealArea != null" class="text-xs text-slate-500">{{ tx.dealArea.toLocaleString('ko-KR') }}㎡</span>
            </div>
            <div class="text-xs text-slate-600">
              평당 <span class="font-semibold">{{ formatManwonKorean(tx.pricePerPyeong) }}</span>
            </div>
            <div v-if="tx.landUse" class="text-xs text-slate-400">{{ tx.landUse }}</div>
            <div v-if="tx.jibun" class="text-xs text-slate-300 mt-0.5">{{ tx.jibun }}</div>
          </div>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
          비지분 대지 거래 사례가 없습니다.
        </div>
      </SectionBlock>

      <!-- Ad: 사례 이후 -->
      <AdBanner />

      <!-- 4. 분기별 추이 + 용도지역 분포 (2-col grid) -->
      <div
        v-if="detail && (detail.priceTimeline.length > 0 || detail.landUseDistribution.length > 0)"
        class="grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <!-- 분기별 대지 평당가 추이 -->
        <SectionBlock
          v-if="detail.priceTimeline.length > 0"
          heading="분기별 대지 평당가 추이"
          subtext="비지분 대지 기준 분기별 평균 평당가입니다."
        >
          <div class="overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th class="py-2 pr-3">분기</th>
                  <th class="py-2 pr-3">평균 평당가</th>
                  <th class="py-2">거래</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="point in detail.priceTimeline"
                  :key="`${point.year}-Q${point.quarter}`"
                  class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2 pr-3 text-slate-700">{{ point.year }}년 {{ point.quarter }}Q</td>
                  <td class="py-2 pr-3 text-slate-700">{{ formatManwonKorean(point.avgPricePerPyeong) }}</td>
                  <td class="py-2 text-slate-700">{{ point.count }}건</td>
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
              class="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span class="text-slate-700">{{ item.landUse }}</span>
              <span class="font-semibold text-slate-900">{{ item.count.toLocaleString('ko-KR') }}건</span>
            </li>
          </ul>
        </SectionBlock>
      </div>

      <!-- 5. 전체 거래 내역 (접이식) -->
      <SectionBlock v-if="detail && detail.total > 0" heading="전체 거래 내역" subtext="">
        <details class="group">
          <summary class="cursor-pointer select-none list-none flex items-center gap-2 text-sm font-semibold text-blue-600 hover:text-blue-800 transition-colors py-1">
            <span>전체 거래 {{ detail.total }}건 보기</span>
            <span class="text-slate-400 group-open:rotate-180 transition-transform inline-block">▼</span>
          </summary>
          <div class="mt-3 overflow-x-auto">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th class="py-2 pr-3">지목</th>
                  <th class="py-2 pr-3">면적(㎡)</th>
                  <th class="py-2 pr-3">평당가</th>
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
                  <td class="py-2.5 pr-3 text-slate-700">{{ tx.jimok ?? '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700">{{ tx.dealArea != null ? tx.dealArea.toLocaleString('ko-KR') : '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700">{{ formatManwonKorean(tx.pricePerPyeong) }}</td>
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
        </details>
      </SectionBlock>

      <!-- Ad: 전체거래 이후 -->
      <AdBanner />

      <!-- 6. FAQ -->
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
import { pyeongToSqm, formatManwonKorean, formatLandDealDate } from '~/types/land'
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

  const selfCanonical = `${SITE_URL}/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}`

  const meta: Array<Record<string, string>> = [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: selfCanonical },
    { property: 'og:type', content: 'website' },
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
