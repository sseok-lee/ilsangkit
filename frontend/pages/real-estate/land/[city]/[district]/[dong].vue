<template>
  <div class="property-redesign bg-white min-h-screen">
    <div class="max-w-[1200px] mx-auto px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
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
        class="property-hero hidden md:block order-2 md:order-2"
        title-tag="div"
        eyebrow="토지 실거래가"
        :title="`${dong} 토지 실거래가`"
        :description="`${cityName} ${districtName} ${dong} 지역의 토지 매매 실거래가와 평당 시세를 확인하세요.`"
      />

      <div v-if="landError" role="alert" class="order-3 rounded-lg border border-line p-5">
        <p>토지 정보를 불러오지 못했습니다.</p>
        <button type="button" class="min-h-11 px-4 text-primary" @click="refreshLand()">다시 시도</button>
      </div>

      <!-- T1: 헤드라인 카드 (대지 평당가) — 첫 광고보다 위로 승격 -->
      <div class="order-3 md:order-3 property-stat">
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
          <p class="mt-2 text-caption text-slate-500 leading-relaxed">
            비지분 대지 {{ summary.daeNonShareCount ?? 0 }}건 기준 · 최근 12개월 · 최신 거래 {{ formatLandDealDate(summary.latestDealDate) }} · 지분·도로 자투리 제외
          </p>
        </template>
        <div v-else class="rounded-xl bg-background-light p-6 text-center text-caption text-slate-500">
          비지분 대지 거래 없음 — 아래 지목별 시세를 참고하세요
        </div>
      </div>

      <!-- Ad①: T0/T1 직후 (고가시성 보존) -->
      <AdBanner class="order-4 md:order-4" />

      <SectionBlock v-if="detail" class="property-section order-5 md:order-5 min-w-0" heading="전체 거래 내역" :subtext="txCountLabel">
        <form class="mb-5 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px_200px_auto]" @submit.prevent="submitTxSearch">
          <label class="grid gap-1 text-sm text-muted" for="land-tx-keyword">지번·지목·용도지역 검색
            <input id="land-tx-keyword" v-model="txDraft" maxlength="100" class="min-h-11 min-w-0 rounded-lg border border-line px-3 text-ink" placeholder="지번, 지목, 용도지역">
          </label>
          <label class="grid gap-1 text-sm text-muted" for="land-tx-jimok">지목
            <select id="land-tx-jimok" :value="txJimok" class="min-h-11 min-w-0 rounded-lg border border-line px-3 text-ink" @change="pushTxQuery({ jimok: ($event.target as HTMLSelectElement).value || undefined, page: 1 })">
              <option value="" :selected="!txJimok">전체 지목</option>
              <option v-for="option in filterOptions.jimok" :key="option" :value="option" :selected="option === txJimok">{{ option }}</option>
            </select>
          </label>
          <label class="grid gap-1 text-sm text-muted" for="land-tx-land-use">용도지역
            <select id="land-tx-land-use" :value="txLandUse" class="min-h-11 min-w-0 rounded-lg border border-line px-3 text-ink" @change="pushTxQuery({ landUse: ($event.target as HTMLSelectElement).value || undefined, page: 1 })">
              <option value="" :selected="!txLandUse">전체 용도지역</option>
              <option v-for="option in filterOptions.landUse" :key="option" :value="option" :selected="option === txLandUse">{{ option }}</option>
            </select>
          </label>
          <button type="submit" class="min-h-11 self-end rounded-lg bg-primary px-5 font-semibold text-white">검색</button>
        </form>
        <div v-if="txError" role="alert" class="py-8 text-center">
          <p>거래 내역을 불러오지 못했습니다.</p>
          <button type="button" class="min-h-11 px-4 text-primary" @click="refreshTransactions()">다시 시도</button>
        </div>
        <p v-else-if="txPending" role="status" class="py-8 text-center text-muted">거래 내역을 불러오는 중입니다.</p>
        <p v-else-if="txItems.length === 0" class="py-8 text-center text-muted">조건에 맞는 거래가 없습니다.</p>
        <div v-else class="overflow-x-auto">
            <table class="min-w-[760px] w-full text-sm border-collapse tabular-nums">
              <thead>
                <tr class="border-b border-slate-200 text-left text-xs font-semibold text-slate-500">
                  <th class="py-2 pr-3">지번</th>
                  <th class="py-2 pr-3">지목</th>
                  <th class="py-2 pr-3">용도지역</th>
                  <th class="py-2 pr-3 text-right">면적(㎡)</th>
                  <th class="py-2 pr-3 text-right">거래금액</th>
                  <th class="py-2 pr-3 text-right">평당가</th>
                  <th class="py-2 pr-3">거래일</th>
                  <th class="py-2">지분</th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="tx in txItems"
                  :key="tx.id"
                  class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
                >
                  <td class="py-2.5 pr-3 text-slate-700">{{ tx.jibun ?? '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700">{{ tx.jimok ?? '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700">{{ tx.landUse ?? '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700 text-right">{{ tx.dealArea != null ? tx.dealArea.toLocaleString('ko-KR') : '-' }}</td>
                  <td class="py-2.5 pr-3 text-slate-700 text-right font-semibold">{{ formatManwonKorean(tx.dealAmount) }}</td>
                  <td class="py-2.5 pr-3 text-slate-700 text-right">{{ formatManwonKorean(tx.pricePerPyeong) }}</td>
                  <td class="py-2.5 pr-3 text-slate-700">
                    {{ tx.dealYear }}.{{ String(tx.dealMonth).padStart(2, '0') }}{{ tx.dealDay != null ? '.' + String(tx.dealDay).padStart(2, '0') : '' }}
                  </td>
                  <td class="py-2.5 text-slate-500">
                    <span v-if="tx.shareDeal" class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">지분</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        <Pagination v-if="!txError && !txPending" :href-for="txPageHref" class="flex-wrap" :current-page="txPage" :total-pages="txTotalPages" @page-change="goToTxPage" />
      </SectionBlock>

      <AdBanner class="order-5 md:order-5" />

      <p v-if="detail?.statsMeta" class="order-6 text-sm text-muted">
        동 전체 기준 통계 · {{ detail.statsMeta.sampledTransactions.toLocaleString('ko-KR') }}건 사용
        <template v-if="detail.statsMeta.isSampleCapped"> · 전체 {{ detail.statsMeta.totalTransactions.toLocaleString('ko-KR') }}건 중 최대 {{ detail.statsMeta.sampleLimit.toLocaleString('ko-KR') }}건 표본</template>
      </p>
      <!-- T1: 지목별 시세 -->
      <SectionBlock class="property-section order-6 md:order-6" heading="지목별 시세" subtext="지목 그룹별 평균 평당가와 거래 건수입니다.">
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
              <span class="block text-caption text-slate-500 mt-0.5 tabular-nums">{{ g.count.toLocaleString('ko-KR') }}건</span>
            </template>
            <span v-else class="block mt-1 text-caption text-slate-500 tabular-nums">
              거래 {{ g.count.toLocaleString('ko-KR') }}건
            </span>
          </div>
        </div>
        <div v-else class="rounded-xl bg-slate-50 p-8 text-center text-slate-500 text-sm">
          지목별 시세 데이터가 없습니다.
        </div>
      </SectionBlock>

      <!-- T3: 대지 거래 사례 -->
      <SectionBlock class="property-section order-7 md:order-7" heading="대지 거래 사례" subtext="비지분 대지 거래 최신 사례입니다.">
        <div v-if="detail && detail.daeSamples.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          <div
            v-for="tx in detail.daeSamples"
            :key="tx.id"
            class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-2"
          >
            <div class="flex items-center justify-between">
              <span class="text-caption text-slate-500 tabular-nums">{{ String(tx.dealYear).slice(2) }}.{{ String(tx.dealMonth).padStart(2, '0') }}.{{ tx.dealDay != null ? String(tx.dealDay).padStart(2, '0') : '??' }}</span>
              <span v-if="tx.shareDeal" class="rounded-full bg-amber-50 px-2 py-0.5 text-caption font-semibold text-amber-700">지분</span>
            </div>
            <div class="flex flex-wrap items-baseline gap-1.5">
              <strong class="text-body font-bold text-slate-900 tabular-nums">{{ formatManwonKorean(tx.dealAmount) }}</strong>
              <span v-if="tx.dealArea != null" class="text-caption text-slate-500 tabular-nums">{{ tx.dealArea.toLocaleString('ko-KR') }}㎡</span>
            </div>
            <div class="text-caption text-slate-600">
              평당 <span class="font-semibold text-primary tabular-nums">{{ formatManwonKorean(tx.pricePerPyeong) }}</span>
            </div>
            <div v-if="tx.landUse" class="text-caption text-slate-500">{{ tx.landUse }}</div>
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
        class="order-8 md:order-8 grid grid-cols-1 md:grid-cols-2 gap-3"
      >
        <!-- 분기별 대지 평당가 추이 -->
        <SectionBlock
        class="property-section"
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
        class="property-section"
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


      <!-- T3: 전체 거래 내역 -->


      <!-- Ad③: 전체거래 이후 -->
      <AdBanner class="order-10 md:order-10" />

      <!-- T5: FAQ -->
      <SectionBlock class="property-section order-11 md:order-11" heading="자주 묻는 질문" subtext="토지 실거래가와 관련된 자주 묻는 질문입니다.">
        <p class="text-sm text-slate-700 mb-6 leading-relaxed">{{ pageDescription }}</p>
        <dl class="flex flex-col gap-4">
          <div v-for="faq in LAND_FAQ" :key="faq.q" class="rounded-xl border border-line bg-white p-4">
            <dt class="text-body font-semibold text-slate-800">{{ faq.q }}</dt>
            <dd class="mt-2 text-body text-slate-600 leading-relaxed">{{ faq.a }}</dd>
          </div>
        </dl>
      </SectionBlock>


      <!-- T6: 데이터 출처 (멀티루트 컴포넌트 → wrapper div에 order 부여) -->
      <div class="order-12 md:order-12">
        <DataSourceSection domain="real-estate" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch, watchEffect } from 'vue'
import { suppressAds } from '~/composables/useAdsPolicy'
import { CITY_SLUG_MAP, DISTRICT_SLUG_MAP } from '~/shared/regionSlugs'
import { useStructuredData } from '~/composables/useStructuredData'
import { useLand } from '~/composables/useLand'
import { buildLandRegionTitle, buildLandRegionDescription, LAND_FAQ } from '~/utils/landMeta'
import { pyeongToSqm, formatManwonKorean, formatLandDealDate } from '~/types/land'
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { isTransactionDocumentIndexable } from '~/utils/indexability'
import Breadcrumb from '~/components/navigation/Breadcrumb.vue'
import PageHero from '~/components/common/PageHero.vue'
import MobileDetailHeader from '~/components/common/MobileDetailHeader.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import Pagination from '~/components/common/Pagination.vue'
import DataSourceSection from '~/components/common/DataSourceSection.vue'
import { markDegradedResponse } from '~/composables/useDegradedResponse'

const route = useRoute()
const router = useRouter()
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

const { data, error: landError, refresh: refreshLand } = await useAsyncData(
  `land-dong-${citySlug}-${districtSlug}-${dong}`,
  async () => {
    // 목록을 받아 find 하지 않는다. 목록은 transactionCount desc 정렬이라 `limit: 100` 은
    // "구·군당 상위 100개만 존재한다"는 뜻이었고, 101위부터는 실재하는 동인데도 하드 404 가 됐다.
    // 실측 2026-09-04(프로덕션): 사이트맵에 실린 URL 113개가 이 창 밖이라 전부 404.
    // 단건은 단건으로 조회한다 — 창 크기와 무관해진다.
    const list = await land.getRegions({ city: cityName, district: districtName, dongName: dong, limit: 1 })
    const summary = list.items[0]
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

// 확정 부재(목록에 그 동이 없음)만 하드 404. 일시 장애(5xx·네트워크·타임아웃)는 fail-open.
//
// useLand 의 getRegions/getRegionDetail 은 $fetch 예외를 삼키지 않으므로 실패가 landError 로 올라온다.
// 기존엔 error 를 보지 않고 `!data.value` 만으로 404 를 던져, 백엔드가 잠깐 흔들리면
// 사이트맵에 살아있는 정상 URL 이 하드 404 로 굳었다.
// 실측(2026-07-28 네이버 진단): `페이지를 찾을 수 없습니다` 그룹 50건 중 49건이 이 land 경로였고,
// 같은 시점 사이트맵 land URL 표본은 전부 200 이었다 — 그때의 일시 장애가 404 로 기록돼 남은 것이다.
// 정책은 #467(fail-open) / #674(시설 상세)와 동일하다. 대상 4,888 URL.
if (landError.value) {
  if (import.meta.server) markDegradedResponse()
} else if (!data.value) {
  throw createError({ statusCode: 404, statusMessage: 'Page Not Found' })
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
function queryText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}
const txKeyword = computed(() => queryText(route.query?.q))
const txJimok = computed(() => queryText(route.query?.jimok))
const txLandUse = computed(() => queryText(route.query?.landUse))
const txPage = computed(() => {
  const number = Number(queryText(route.query?.page) || 1)
  return Number.isSafeInteger(number) && number > 0 ? number : 1
})
const hasTxFilter = computed(() => Boolean(txKeyword.value || txJimok.value || txLandUse.value))
const hasTxQuery = computed(() => Object.keys(route.query ?? {}).length > 0)
const txDraft = ref(txKeyword.value)
watch(txKeyword, value => { txDraft.value = value })
const txKey = computed(() => `land-transactions-${citySlug}-${districtSlug}-${dong}-${JSON.stringify([txKeyword.value, txJimok.value, txLandUse.value, txPage.value])}`)
const { data: txResult, error: txError, pending: txPending, refresh: refreshTransactions } = await useAsyncData(
  txKey,
  async () => {
    const bjdCode = summary.value?.bjdCode
    if (!bjdCode) return null
    if (!hasTxFilter.value && txPage.value === 1) return detail.value
    return land.getTransactions({
      bjdCode, dongName: dong,
      keyword: txKeyword.value || undefined,
      jimok: txJimok.value || undefined,
      landUse: txLandUse.value || undefined,
      page: txPage.value, limit: TX_LIMIT,
    })
  },
  { default: () => null, watch: [summary] },
)
if (txError.value && import.meta.server) markDegradedResponse()
const txItems = computed(() => txResult.value?.items ?? [])
const txTotalPages = computed(() => txResult.value?.totalPages ?? 0)
const filterOptions = computed(() => detail.value?.filterOptions ?? txResult.value?.filterOptions ?? { jimok: [], landUse: [] })
const txCountLabel = computed(() => `${hasTxFilter.value ? '검색 결과' : '전체'} ${(txResult.value?.total ?? 0).toLocaleString('ko-KR')}건 · 요약과 추이는 동 전체 기준`)
watchEffect(() => suppressAds(hasTxQuery.value || !!landError.value || !!txError.value || !!txPending.value || !summary.value?.transactionCount))

function pushTxQuery(patch: Record<string, string | number | undefined>) {
  return router.push({ query: { ...route.query, ...patch, page: patch.page === 1 ? undefined : patch.page } })
}
function submitTxSearch() {
  return pushTxQuery({ q: txDraft.value.trim() || undefined, page: 1 })
}
function goToTxPage(page: number) {
  return pushTxQuery({ page })
}
function txPageHref(page: number) {
  const query = new URLSearchParams()
  if (txKeyword.value) query.set('q', txKeyword.value)
  if (txJimok.value) query.set('jimok', txJimok.value)
  if (txLandUse.value) query.set('landUse', txLandUse.value)
  if (page > 1) query.set('page', String(page))
  return `/real-estate/land/${citySlug}/${districtSlug}/${encodeURIComponent(dong)}${query.size ? `?${query}` : ''}`
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

// 색인 판정 — 요청 시점 거래 건수로 평가한다(utils/indexability.ts).
//
// 예전엔 `!(data.value?.summary?.isIndexable)` 였고 두 방향으로 동시에 틀렸다.
//
// 1) 과잉 제외: summary.isIndexable 은 backend/src/scripts/syncLandSale.ts 가 sync 시점에
//    "최근 12개월 5건 이상 또는 누적 10건 이상"으로 계산한 스냅샷이다. 거래 5건 중 3건이
//    최근인 동은 두 조건 모두 미달 → 지목별 시세 그리드와 대지 거래 사례 카드를 전부
//    렌더하면서도 noindex 로 나갔다. 임계값을 요청 시점 3건으로 낮춰 회복한다.
// 2) fail-open 위반: landError 가 있으면 data.value 는 null 이라 옵셔널 체이닝이
//    undefined → noindex=true 가 됐다. 즉 위(70줄 위)에서 markDegradedResponse() 로
//    503 을 찍어 놓고 같은 응답에 'noindex, follow' 를 함께 실어 보냈다.
//    일시 장애는 절대 색인 신호를 건드리면 안 되므로 fetchFailed 로 넘겨 fail-open 시킨다.
const noindex = computed(() =>
  hasTxQuery.value || !isTransactionDocumentIndexable({
    transactionCount: summary.value?.transactionCount,
    fetchFailed: !!landError.value,
  }),
)

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
    link: noindex.value ? [] : [{ rel: 'canonical', href: selfCanonical }],
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

<style src="~/assets/css/remaining-property.css"></style>
