<template>
  <div class="w-full max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
    <nav class="text-xs text-slate-400 mb-3">
      <HardLink to="/" class="hover:underline">홈</HardLink> ›
      <HardLink to="/subscription" class="hover:underline">청약</HardLink> › 경쟁률·가점
    </nav>

    <h1 class="text-2xl font-bold text-slate-900">청약 경쟁률·가점 커트라인</h1>
    <p class="text-sm text-slate-500 mt-2 leading-relaxed">
      최근 마감된 청약 단지의 1순위 경쟁률과 당첨 가점 커트라인을 한눈에 비교하세요.
      국토교통부 청약홈 공개 데이터 기준이며 매일 갱신됩니다.
    </p>

    <div class="inline-flex bg-slate-100 rounded-full p-1 text-sm font-bold mt-4">
      <button
        v-for="opt in METRIC_OPTIONS"
        :key="opt.value"
        :class="['px-4 py-1.5 rounded-full transition', metric === opt.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500']"
        @click="onMetricChange(opt.value)"
      >{{ opt.label }}</button>
    </div>

    <div v-if="metric === 'rate'" class="mt-5 overflow-x-auto">
      <table class="w-full text-sm whitespace-nowrap">
        <thead>
          <tr class="border-b-2 border-slate-200">
            <th class="text-left py-3 px-3 font-semibold text-slate-800">단지</th>
            <th class="text-left py-3 px-3 font-semibold text-slate-800">지역</th>
            <th class="text-right py-3 px-3 font-semibold text-slate-800">접수/공급</th>
            <th class="text-right py-3 px-3 font-semibold text-slate-800">최고 경쟁률</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.subscriptionId" class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 px-3">
              <HardLink :to="`/subscription/${row.subscriptionId}`" class="text-slate-900 font-medium hover:text-primary hover:underline">{{ row.houseName }}</HardLink>
            </td>
            <td class="py-3 px-3 text-slate-600">{{ row.regionName }}</td>
            <td class="py-3 px-3 text-right text-slate-600">{{ formatRatio(row) }}</td>
            <td class="py-3 px-3 text-right font-bold text-primary">{{ row.maxRate != null ? `${row.maxRate.toFixed(1)} : 1` : '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-else class="mt-5 overflow-x-auto">
      <table class="w-full text-sm whitespace-nowrap">
        <thead>
          <tr class="border-b-2 border-slate-200">
            <th class="text-left py-3 px-3 font-semibold text-slate-800">단지</th>
            <th class="text-left py-3 px-3 font-semibold text-slate-800">지역</th>
            <th class="text-right py-3 px-3 font-semibold text-slate-800">최저</th>
            <th class="text-right py-3 px-3 font-semibold text-slate-800">평균</th>
            <th class="text-right py-3 px-3 font-semibold text-slate-800">최고</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in items" :key="row.subscriptionId" class="border-b border-slate-100 hover:bg-slate-50">
            <td class="py-3 px-3">
              <HardLink :to="`/subscription/${row.subscriptionId}`" class="text-slate-900 font-medium hover:text-primary hover:underline">{{ row.houseName }}</HardLink>
            </td>
            <td class="py-3 px-3 text-slate-600">{{ row.regionName }}</td>
            <td class="py-3 px-3 text-right font-semibold text-primary">{{ fmt(row.minCut) }}</td>
            <td class="py-3 px-3 text-right font-bold text-slate-900">{{ fmt(row.avgCut) }}</td>
            <td class="py-3 px-3 text-right font-semibold text-red-600">{{ fmt(row.maxCut) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p v-if="items.length === 0" class="text-sm text-slate-400 py-10 text-center">표시할 데이터가 없습니다.</p>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useSubscription, type CompetitionRankItem } from '~/composables/useSubscription'
import { useStructuredData } from '~/composables/useStructuredData'

const METRIC_OPTIONS = [
  { value: 'rate' as const, label: '경쟁률' },
  { value: 'score' as const, label: '가점 커트라인' },
]

const title = '청약 경쟁률·가점 커트라인 | 단지별 순위 | 일상킷'
const description = '최근 마감 청약 단지의 1순위 경쟁률과 당첨 가점 커트라인(최저·평균·최고)을 단지별로 비교. 국토교통부 청약홈 데이터, 매일 갱신.'
const canonicalUrl = `${SITE_URL}/subscription/competition`

useHead({
  title,
  meta: [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: SITE_NAME },
    { property: 'og:locale', content: 'ko_KR' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const { getCompetitionRanking } = useSubscription()

const metric = ref<'rate' | 'score'>('rate')

// SSR-blocking: 초기 데이터를 서버에서 로드해 크롤러가 채워진 테이블을 보게 함 (색인 목적)
const { data } = await useAsyncData(
  'subscription-competition',
  () => getCompetitionRanking({ metric: metric.value, page: 1, limit: 30 }),
  { watch: [metric] },
)
const items = computed<CompetitionRankItem[]>(() => data.value?.items ?? [])

function onMetricChange(next: 'rate' | 'score') {
  if (metric.value === next) return
  metric.value = next // watch:[metric] 이 자동 재조회
}

function fmt(v?: number | null): string {
  return v == null ? '—' : `${Math.round(v)}점`
}
function formatRatio(row: CompetitionRankItem): string {
  if (row.totalApplicants == null || row.totalSupply == null || row.totalSupply === 0) return '—'
  return `${row.totalApplicants.toLocaleString('ko-KR')}/${row.totalSupply.toLocaleString('ko-KR')}`
}

const { setFAQSchema, setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
  { name: '경쟁률·가점', url: canonicalUrl },
])
setFAQSchema([
  { question: '청약 경쟁률은 어떻게 계산하나요?', answer: '경쟁률은 접수자 수를 공급 세대수로 나눈 값입니다. 본 페이지는 1순위 해당지역 기준 단지별 최고 경쟁률을 보여줍니다.' },
  { question: '가점 커트라인이란 무엇인가요?', answer: '가점 커트라인은 해당 단지에서 당첨된 사람들의 최저 가점을 의미합니다. 무주택기간·청약통장 가입기간·부양가족수로 산정된 청약가점(84점 만점) 중 당첨 최저선입니다.' },
  { question: '1순위와 2순위는 어떻게 다른가요?', answer: '1순위는 청약통장 가입기간·납입횟수 등 우선 자격을 충족한 신청자이며, 2순위는 그 외 신청자입니다. 본 페이지 경쟁률은 1순위 기준입니다.' },
])
</script>
