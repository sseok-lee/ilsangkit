<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <PageHero
        eyebrow="청약"
        title="청약 일정·분양정보"
        description="아파트·오피스텔 분양, 무순위·잔여세대, 공공·민간 임대까지 모든 청약 일정과 정보를 한눈에 확인하세요."
        :stats="heroStats"
      />

      <!-- 페이지 인트로 (AI 검색·SEO 답변형 콘텐츠) -->
      <section class="bg-white rounded-xl border border-slate-200 p-5 md:p-6 leading-relaxed text-slate-700 text-[15px]">
        <h2 class="text-display-3 text-slate-900 mb-2">청약이란?</h2>
        <p class="mb-3">
          <strong>청약</strong>은 새로 짓는 아파트·오피스텔을 분양받기 위해 사전에 신청하는 절차입니다. 일상킷에서는
          한국부동산원 청약홈, LH·SH, 민간 분양사가 공고하는 모든 청약·임대 일정을
          <NuxtLink to="/subscription/sale" class="text-primary hover:underline">분양</NuxtLink>·<NuxtLink to="/subscription/rent" class="text-primary hover:underline">임대</NuxtLink>·<NuxtLink to="/public-rental" class="text-primary hover:underline">공공임대</NuxtLink> 카테고리로 구분해 모아 보여줍니다.
        </p>
        <h3 class="font-semibold text-slate-900 mt-4 mb-1.5">어떤 정보를 확인할 수 있나요?</h3>
        <ul class="list-disc pl-5 space-y-1 mb-3">
          <li>모집·접수일, 당첨자 발표일, 입주 예정일 등 주요 일정</li>
          <li>분양가·임대료·공급세대수·평형별 면적</li>
          <li>특별공급(신혼부부·다자녀·생애최초·신생아 등) 자격 안내</li>
          <li>경쟁률·당첨 가점 컷·최저당첨선 (공개된 단지)</li>
          <li>주변 시세 비교 (부동산 실거래가 데이터 연동)</li>
        </ul>
        <h3 class="font-semibold text-slate-900 mt-4 mb-1.5">언제 사용하면 좋나요?</h3>
        <p class="mb-1">
          청약통장 가입 후 <strong>접수 기간</strong>이 임박했을 때, 또는 무주택 기간·가점을 점검해
          <strong>예정 단지</strong>를 미리 확인할 때 가장 유용합니다. 청약 신청은
          <a href="https://www.applyhome.co.kr" target="_blank" rel="noopener" class="text-primary hover:underline">청약홈</a>
          (한국부동산원 운영) 또는 분양사 지정 은행에서 진행하며, 일상킷은 일정과 상세 정보 제공에 집중합니다.
        </p>
      </section>

      <!-- 분양 Section -->
      <SectionBlock>
        <template #heading>
          <div class="flex items-center gap-2">
            <img src="/icons/category/sale.webp?v2" alt="분양" class="w-6 h-6" width="24" height="24" />
            <h2 class="text-lg md:text-xl font-bold text-slate-900">분양</h2>
          </div>
        </template>
        <template #right>
          <NuxtLink to="/subscription/sale" class="ml-auto text-sm text-primary hover:underline">전체 보기 →</NuxtLink>
        </template>
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
      </SectionBlock>

      <!-- 임대 Section -->
      <SectionBlock>
        <template #heading>
          <div class="flex items-center gap-2">
            <img src="/icons/category/rent.webp?v2" alt="임대" class="w-6 h-6" width="24" height="24" />
            <h2 class="text-lg md:text-xl font-bold text-slate-900">임대</h2>
          </div>
        </template>
        <template #right>
          <NuxtLink to="/subscription/rent" class="ml-auto text-sm text-primary hover:underline">전체 보기 →</NuxtLink>
        </template>
        <div class="space-y-5">
          <div v-for="group in rentGroups" :key="group" class="space-y-2.5" :data-test-group="group">
            <h3 class="text-sm font-semibold text-slate-700">{{ RENT_GROUP_META[group].heading }}</h3>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <NuxtLink
                v-for="[slug, meta] in rentTypesByGroup(group)"
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
          </div>
        </div>
      </SectionBlock>

      <!-- Ad Banner -->
      <AdBanner />

      <!-- 청약중 미리보기 -->
      <SectionBlock v-if="ongoingItems.length > 0">
        <template #heading>
          <div class="flex items-center gap-2">
            <img src="/icons/category/subscription.webp?v2" alt="청약중" class="w-6 h-6" width="24" height="24" />
            <h2 class="text-lg md:text-xl font-bold text-slate-900">청약중</h2>
          </div>
        </template>
        <template #right>
          <span class="inline-flex px-2.5 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-bold">
            {{ ongoingItems.length }}
          </span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SubscriptionCard
            v-for="sub in ongoingItems"
            :key="sub.id"
            :subscription="sub"
          />
        </div>
      </SectionBlock>

      <!-- 접수예정 미리보기 -->
      <SectionBlock v-if="upcomingItems.length > 0">
        <template #heading>
          <div class="flex items-center gap-2">
            <img src="/icons/category/subscription.webp?v2" alt="접수예정" class="w-6 h-6" width="24" height="24" />
            <h2 class="text-lg md:text-xl font-bold text-slate-900">접수예정 청약</h2>
          </div>
        </template>
        <template #right>
          <span class="inline-flex px-2.5 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-bold">
            {{ upcomingItems.length }}
          </span>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <SubscriptionCard
            v-for="sub in upcomingItems"
            :key="sub.id"
            :subscription="sub"
          />
        </div>
      </SectionBlock>

      <!-- 데이터 출처 -->
      <SectionBlock heading="데이터 정보">
        <DataSourceSection domain="subscription" />
        <p class="mt-3 text-xs text-slate-500 leading-relaxed">
          분양·민영주택 청약 정보는 한국부동산원 청약Home(applyhome.co.kr) 공개 API 기준이며,
          공공임대(LH·SH) 매물은 각 공급기관 공고를 기준으로 합니다.
          실제 신청 전 반드시 청약Home 또는 해당 공급기관의 최신 공고를 확인하세요.
        </p>
      </SectionBlock>

      <!-- FAQ Section -->
      <SectionBlock heading="자주 묻는 질문">
        <div class="space-y-1">
          <details v-for="(faq, i) in faqs" :key="i" class="border-b border-gray-200">
            <summary class="py-3 cursor-pointer font-medium text-gray-800 hover:text-primary">{{ faq.question }}</summary>
            <p class="pb-3 text-gray-600 text-sm leading-relaxed">{{ faq.answer }}</p>
          </details>
        </div>
      </SectionBlock>
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { SALE_TYPES, RENT_GROUP_META, rentTypesByGroup, SUBSCRIPTION_HUB_DESCRIPTION, type RentGroup } from '~/utils/subscriptionMeta'
import DataSourceSection from '~/components/common/DataSourceSection.vue'

const rentGroups: RentGroup[] = ['apply']
import type { Subscription } from '~/types/subscription'
import { useStructuredData } from '~/composables/useStructuredData'
import { useSubscription } from '~/composables/useSubscription'
import { useAnalytics } from '~/composables/useAnalytics'

const title = '청약 일정·분양정보 | 분양·임대 전체 조회 | 일상킷'
const description = SUBSCRIPTION_HUB_DESCRIPTION
const canonicalUrl = `${SITE_URL}/subscription`
const heroStats = [
  { label: '분양', value: '아파트·오피스텔·무순위' },
  { label: '임대', value: '공공·민간임대' },
  { label: '상태', value: '청약중·접수예정' },
]

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

const { getUpcomingSubscriptions, getSubscriptionList } = useSubscription()

const upcomingItems = ref<Subscription[]>([])
const ongoingItems = ref<Subscription[]>([])

const { data: upcomingData } = await useAsyncData('subscription-upcoming', () => getUpcomingSubscriptions())
if (upcomingData.value) {
  upcomingItems.value = upcomingData.value
}

const { data: ongoingData } = await useAsyncData('subscription-ongoing', () =>
  getSubscriptionList({ status: 'ongoing', page: 1, limit: 6 })
)
if (ongoingData.value) {
  ongoingItems.value = ongoingData.value.items
}

setFAQSchema(faqs.map(f => ({ question: f.question, answer: f.answer })))
setBreadcrumbSchema([
  { name: '홈', url: SITE_URL },
  { name: '청약 정보', url: `${SITE_URL}/subscription` },
])

const { trackSubscriptionListView } = useAnalytics()
onMounted(() => trackSubscriptionListView({ listType: 'hub' }))
</script>
