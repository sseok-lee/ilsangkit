<template>
  <div class="bg-background-light">
    <!-- Hero Section -->
    <div class="bg-gradient-to-b from-slate-50 to-background-light border-b border-slate-100">
      <div class="mx-auto max-w-6xl px-4 py-8 md:px-6 md:py-10">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">청약 일정·분양정보</h1>
        <p class="mt-2 text-slate-500 text-sm">
          아파트·오피스텔 분양, 무순위·잔여세대, 공공·민간 임대까지<br />
          모든 청약 일정과 정보를 한눈에 확인하세요.
        </p>
      </div>
    </div>

    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <!-- 분양 Section -->
      <section class="mb-10">
        <div class="flex items-center gap-2 mb-4">
          <img src="/icons/category/sale.webp?v2" alt="분양" class="w-6 h-6" width="24" height="24" />
          <h2 class="text-xl font-bold text-slate-900">분양</h2>
          <NuxtLink to="/subscription/sale" class="ml-auto text-sm text-primary hover:underline">전체 보기 →</NuxtLink>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <NuxtLink
            v-for="(meta, slug) in SALE_TYPES"
            :key="slug"
            :to="`/subscription/sale/${slug}`"
            class="group block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-primary/30 transition-all"
          >
            <div class="flex items-center gap-3 mb-3">
              <img :src="`/icons/category/${meta.iconImg}.webp?v2`" :alt="meta.label" class="w-10 h-10" width="40" height="40" />
              <h3 class="font-bold text-slate-900 group-hover:text-primary transition-colors">{{ meta.label }}</h3>
            </div>
            <p class="text-sm text-slate-500 leading-relaxed">{{ meta.description }}</p>
          </NuxtLink>
        </div>
      </section>

      <!-- 임대 Section -->
      <section class="mb-10">
        <div class="flex items-center gap-2 mb-4">
          <img src="/icons/category/rent.webp?v2" alt="임대" class="w-6 h-6" width="24" height="24" />
          <h2 class="text-xl font-bold text-slate-900">임대</h2>
          <NuxtLink to="/subscription/rent" class="ml-auto text-sm text-primary hover:underline">전체 보기 →</NuxtLink>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NuxtLink
            v-for="(meta, slug) in RENT_TYPES"
            :key="slug"
            :to="`/subscription/rent/${slug}`"
            class="group block bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md hover:border-amber-300/50 transition-all"
          >
            <div class="flex items-center gap-3 mb-3">
              <img :src="`/icons/category/${meta.iconImg}.webp?v2`" :alt="meta.label" class="w-10 h-10" width="40" height="40" />
              <h3 class="font-bold text-slate-900 group-hover:text-amber-600 transition-colors">{{ meta.label }}</h3>
            </div>
            <p class="text-sm text-slate-500 leading-relaxed">{{ meta.description }}</p>
          </NuxtLink>
        </div>
      </section>

      <!-- Ad Banner -->
      <AdBanner />

      <!-- 접수예정 미리보기 -->
      <section v-if="upcomingItems.length > 0" class="mt-8">
        <div class="flex items-center gap-2 mb-4">
          <img src="/icons/category/subscription.webp?v2" alt="접수예정" class="w-6 h-6" width="24" height="24" />
          <h2 class="text-xl font-bold text-slate-900">접수예정 청약</h2>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SubscriptionCard
            v-for="sub in upcomingItems"
            :key="sub.id"
            :subscription="sub"
          />
        </div>
      </section>

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
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { SALE_TYPES, RENT_TYPES } from '~/utils/subscriptionMeta'
import type { Subscription } from '~/types/subscription'
import { useStructuredData } from '~/composables/useStructuredData'
import { useSubscription } from '~/composables/useSubscription'

const title = '2026 청약 일정·분양정보 — 분양·임대 전체 조회 | 일상킷'
const description = '2026년 아파트·오피스텔 분양, 무순위·잔여세대, 공공·민간 임대 청약 일정과 정보를 한눈에 확인하세요.'
const canonicalUrl = `${SITE_URL}/subscription`

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
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: DEFAULT_OG_IMAGE },
  ],
  link: [{ rel: 'canonical', href: canonicalUrl }],
})

const faqs = [
  { question: '청약통장은 어떻게 가입하나요?', answer: '청약통장은 주택도시기금에 가입하거나 은행에서 직접 가입할 수 있습니다. 만 18세 이상 대한민국 국민이면 가능하며, 매월 일정 금액을 저축하여 청약 자격을 갖춥니다.' },
  { question: '청약 가점은 어떻게 계산하나요?', answer: '청약 가점은 무주택 기간(30점 만점), 청약통장 가입기간(20점 만점), 부양가족 수(15점 만점) 등을 합산합니다. 분양사나 청약홈에서 가점 계산 도구를 제공합니다.' },
  { question: '특별공급 자격 조건은 무엇인가요?', answer: '특별공급은 신혼부부, 다자녀, 생애최초, 노부모부양, 기관추천, 청년, 신생아 등 여러 유형이 있으며 각 유형별로 소득, 자산 등 조건이 다릅니다.' },
  { question: '무순위·잔여세대 청약은 무엇인가요?', answer: '정당 청약에서 미달된 물량이나 취소·해약 물량을 대상으로 하며, 청약통장 없이도 신청 가능합니다. 경쟁률이 상대적으로 낮아 관심이 높습니다.' },
  { question: '분양과 임대의 차이는 무엇인가요?', answer: '분양은 주택을 구매하는 것이고, 임대는 일정 기간 동안 임차하는 것입니다. 공공임대는 시세보다 저렴하며, 민간임대는 민간사업자가 운영합니다.' },
  { question: '청약 접수는 어디서 하나요?', answer: '청약 접수는 청약홈(www.applyhome.co.kr) 또는 분양사 지정 은행에서 가능합니다. 온라인 접수는 청약통장 보유자이면 누구나 신청할 수 있습니다.' },
]

const { setFAQSchema, setBreadcrumbSchema } = useStructuredData()

const { getUpcomingSubscriptions } = useSubscription()

const upcomingItems = ref<Subscription[]>([])

const { data } = await useAsyncData('subscription-upcoming', () => getUpcomingSubscriptions())
if (data.value) {
  upcomingItems.value = data.value
}

setFAQSchema(faqs.map(f => ({ question: f.question, answer: f.answer })))
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
])
</script>
