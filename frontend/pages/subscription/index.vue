<template>
  <div class="bg-background-light">
    <!-- Hero Section -->
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">청약 일정·분양정보</h1>
        <p class="mt-2 text-slate-500 text-sm">
          2026년 아파트·오피스텔 청약 일정과 분양정보를 한눈에 확인하세요.<br />
          접수 예정, 진행 중, 마감 청약을 모두 조회할 수 있습니다.
        </p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <!-- Status Tabs -->
      <div class="mb-6 flex flex-wrap gap-2">
        <button
          v-for="tab in ['upcoming', 'ongoing', 'closed']"
          :key="tab"
          :class="[
            'px-4 py-2 rounded-lg font-medium text-sm transition-colors',
            currentStatus === tab
              ? 'bg-primary text-white'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
          ]"
          @click="currentStatus = tab as typeof currentStatus"
        >
          {{ getStatusLabel(tab) }}
        </button>
      </div>

      <!-- Filter Section -->
      <div class="bg-white rounded-xl p-4 shadow-sm border border-slate-200 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <!-- Region Filter -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">지역</label>
            <div class="relative">
              <select
                v-model="selectedRegion"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                <option value="">전국</option>
                <option value="서울">서울</option>
                <option value="경기">경기</option>
                <option value="인천">인천</option>
                <option value="대전">대전</option>
                <option value="대구">대구</option>
                <option value="부산">부산</option>
                <option value="광주">광주</option>
                <option value="울산">울산</option>
                <option value="세종">세종</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>

          <!-- House Type Filter -->
          <div>
            <label class="block text-xs font-medium text-slate-600 mb-1.5">주택형</label>
            <div class="relative">
              <select
                v-model="selectedHouseType"
                class="w-full bg-slate-50 border border-slate-200 rounded-lg py-2.5 px-3 text-slate-900 text-sm font-medium focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none cursor-pointer"
              >
                <option value="">전체</option>
                <option value="APT">아파트</option>
                <option value="오피스텔">오피스텔</option>
              </select>
              <span class="material-symbols-outlined absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-[18px]">expand_more</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="pending" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <div v-for="i in 6" :key="i" class="bg-white rounded-xl p-4 border border-slate-200 animate-pulse">
          <div class="space-y-3">
            <div class="h-4 bg-slate-200 rounded w-2/3"></div>
            <div class="h-3 bg-slate-100 rounded w-full"></div>
            <div class="h-3 bg-slate-100 rounded w-3/4"></div>
            <div class="h-8 bg-slate-200 rounded w-24 mt-4"></div>
          </div>
        </div>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="rounded-xl bg-red-50 p-8 text-center">
        <div class="w-14 h-14 mx-auto mb-3 rounded-full bg-red-100 flex items-center justify-center">
          <span class="material-symbols-outlined text-[28px] text-red-400">error_outline</span>
        </div>
        <p class="text-red-700 font-semibold">데이터를 불러오는 중 오류가 발생했습니다</p>
        <p class="text-red-500 text-sm mt-1">잠시 후 다시 시도해주세요</p>
        <button
          class="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
          @click="retryLoad"
        >
          <span class="material-symbols-outlined text-[16px]">refresh</span>
          다시 시도
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="subscriptions.length === 0" class="rounded-xl bg-slate-50 p-12 text-center">
        <span class="material-symbols-outlined text-[48px] text-slate-300 block mb-3">home_work</span>
        <p class="text-slate-600 font-medium">조건에 맞는 청약이 없습니다</p>
        <p class="text-slate-500 text-sm mt-1">다른 조건으로 다시 검색해보세요</p>
      </div>

      <!-- Subscription List -->
      <div v-else class="space-y-6">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-slate-800">
            {{ getStatusLabel(currentStatus) }} 청약
          </h2>
          <span class="bg-primary/10 text-primary text-xs font-bold px-3 py-1 rounded-full">
            {{ total.toLocaleString() }}건
          </span>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SubscriptionCard
            v-for="sub in subscriptions"
            :key="sub.id"
            :subscription="sub"
          />
        </div>

        <!-- Pagination -->
        <Pagination :current-page="currentPage" :total-pages="totalPages" @page-change="goToPage" />
      </div>

      <!-- Ad Banner -->
      <AdBanner />

      <!-- FAQ Section -->
      <section class="mt-12">
        <h2 class="text-lg font-semibold mb-4">자주 묻는 질문</h2>
        <div class="space-y-1">
          <details v-for="(faq, i) in faqs" :key="i" class="border-b border-gray-200">
            <summary class="py-3 cursor-pointer font-medium text-gray-800 hover:text-blue-600">{{ faq.question }}</summary>
            <p class="pb-3 text-gray-600 text-sm leading-relaxed">{{ faq.answer }}</p>
          </details>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
/* eslint-disable-next-line no-undef */
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import type { Subscription } from '~/types/subscription'
import { useStructuredData } from '~/composables/useStructuredData'

const title = `2026 아파트 청약 일정·분양정보 - 일상킷`
const description = '2026년 아파트·오피스텔 청약 접수 일정과 분양정보를 조회하세요. 접수 예정, 진행 중, 마감 청약을 한눈에 확인할 수 있습니다.'
const canonicalUrl = `${SITE_URL}/subscription`

const faqs = [
  {
    question: '청약통장은 어떻게 가입하나요?',
    answer: '청약통장은 주택도시기금에 가입하거나 은행에서 직접 가입할 수 있습니다. 만 18세 이상 대한민국 국민이면 가능하며, 매월 일정 금액을 저축하여 청약 자격을 갖춥니다. 신청은 거주지역 은행 또는 우체국에서 하시면 됩니다.',
  },
  {
    question: '청약 가점은 어떻게 계산하나요?',
    answer: '청약 가점은 무주택 기간(30점 만점), 청약통장 가입기간(20점 만점), 부양가족 수(15점 만점), 주택소유 이력(5점 만점) 등을 합산합니다. 각 요소는 국토교통부 기준에 따라 계산되며, 분양사나 청약홈에서 가점 계산 도구를 제공합니다.',
  },
  {
    question: '특별공급 자격 조건은 무엇인가요?',
    answer: '특별공급은 신혼부부, 다자녀, 생애최초구매자, 노부모부양, 기관추천, 청년, 신생아 우선순위 등 여러 유형이 있습니다. 각 유형별로 소득, 자산, 무주택 기간 등 다양한 조건이 있으며, 모집공고에서 자세한 자격 요건을 확인하실 수 있습니다.',
  },
  {
    question: '청약 당첨 후 계약 절차는 어떻게 되나요?',
    answer: '당첨자는 공고된 계약 기간 내에 분양사 또는 지정된 장소에서 계약금(계약금 5~10%)을 납부하고 계약서에 서명합니다. 이후 기성금, 준공금 등을 단계별로 납부하게 되며, 모든 절차는 모집공고의 분양가 책정 내역에 따릅니다.',
  },
  {
    question: '무주택 기간은 어떻게 산정하나요?',
    answer: '무주택 기간은 청약자가 계속해서 주택을 소유하지 않은 기간을 의미합니다. 배우자 명의 주택도 포함되며, 혼인 전 소유 주택은 제외됩니다. 세부 산정 방식은 분양 유형(아파트, 오피스텔 등)에 따라 다르므로 청약홈에서 확인하세요.',
  },
  {
    question: '청약 접수는 어디서 하나요?',
    answer: '청약 접수는 청약홈(www.applyhome.co.kr) 또는 분양사 지정 은행에서 가능합니다. 온라인 접수는 청약통장 보유자이면 누구나 신청할 수 있으며, 오프라인 접수는 청약일에 지정된 은행 지점을 방문하여 진행하시면 됩니다.',
  },
]

const { setFAQSchema, setBreadcrumbSchema } = useStructuredData()

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
    { property: 'og:image:width', content: '1200' },
    { property: 'og:image:height', content: '630' },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
})

import { useSubscription } from '~/composables/useSubscription'

const { getSubscriptionList } = useSubscription()

const currentStatus = ref<'upcoming' | 'ongoing' | 'closed'>('upcoming')
const selectedRegion = ref('')
const selectedHouseType = ref('')
const currentPage = ref(1)

const subscriptions = ref<Subscription[]>([])
const total = ref(0)
const totalPages = ref(0)
const pending = ref(false)
const error = ref<string | null>(null)

watch([currentStatus, selectedRegion, selectedHouseType], () => {
  currentPage.value = 1
  loadSubscriptions()
})

watch(currentPage, () => {
  loadSubscriptions()
})

async function loadSubscriptions() {
  pending.value = true
  error.value = null
  try {
    const result = await getSubscriptionList({
      status: currentStatus.value,
      region: selectedRegion.value || undefined,
      houseType: selectedHouseType.value || undefined,
      page: currentPage.value,
      limit: 20,
    })
    subscriptions.value = result.items
    total.value = result.total
    totalPages.value = result.totalPages
  } catch (err) {
    error.value = '청약 정보를 불러올 수 없습니다'
    console.error('Failed to load subscriptions:', err)
  } finally {
    pending.value = false
  }
}

function goToPage(page: number) {
  currentPage.value = page
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function retryLoad() {
  loadSubscriptions()
}

function getStatusLabel(status: string): string {
  if (status === 'upcoming') return '접수예정'
  if (status === 'ongoing') return '접수중'
  if (status === 'closed') return '마감'
  return ''
}

// SSR: Load initial data
const { data } = await useAsyncData('subscription-list', () =>
  getSubscriptionList({
    status: 'upcoming',
    page: 1,
    limit: 20,
  })
)

if (data.value) {
  subscriptions.value = data.value.items
  total.value = data.value.total
  totalPages.value = data.value.totalPages
}

// Set JSON-LD schemas
setFAQSchema(faqs.map(f => ({ question: f.question, answer: f.answer })))
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
])
</script>
