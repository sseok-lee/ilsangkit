<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-[1200px] px-4 md:px-6 pt-5 md:pt-6 pb-8 md:pb-10 flex flex-col gap-3">
      <PageHero
        eyebrow="부동산"
        title="부동산 실거래가"
        description="전국 아파트·빌라·오피스텔 매매·전월세 실거래가를 지역별로 조회하세요. 국토교통부 데이터 기반 시세 추이와 거래 내역을 한눈에 확인할 수 있습니다."
        :stats="heroStats"
      />

      <SectionBlock subtext="조회할 주택 유형을 먼저 선택하세요.">
        <template #heading>
          <h2 class="text-base md:text-lg font-bold text-slate-900 leading-tight">부동산 유형별 실거래가</h2>
        </template>
        <RealEstateCategoryCards />
      </SectionBlock>

      <!-- Ad: Property Type Cards 후 -->
      <AdBanner />

      <SectionBlock>
        <template #heading>
          <h2 class="text-base md:text-lg font-bold text-slate-900 leading-tight">부동산 실거래가란?</h2>
        </template>
        <div class="text-base text-slate-600 leading-relaxed space-y-3">
          <p>
            부동산 실거래가는 실제 거래가 완료된 가격으로, 국토교통부에 신고된 공식 데이터입니다.
            매매·전월세 계약 체결 후 30일 이내에 신고된 금액이므로, 호가(희망 가격)와 다를 수 있습니다.
          </p>
          <p>
            일상킷은 국토교통부 실거래가 공개시스템의 데이터를 매일 수집하여 아파트, 연립다세대(빌라),
            오피스텔의 매매 및 전월세 실거래 내역을 제공합니다.
          </p>
        </div>
      </SectionBlock>

      <SectionBlock>
        <template #heading>
          <h2 class="text-base md:text-lg font-bold text-slate-900 leading-tight">자주 묻는 질문</h2>
        </template>
        <div class="space-y-3">
          <details
            v-for="(faq, index) in realEstateFAQs"
            :key="index"
            class="rounded-xl bg-white border border-slate-200 overflow-hidden"
          >
            <summary class="flex items-center justify-between px-5 py-4 cursor-pointer text-slate-800 font-medium text-sm hover:bg-slate-50 transition-colors list-none">
              {{ faq.question }}
              <span class="material-symbols-outlined text-slate-500 text-lg flex-shrink-0 ml-3">expand_more</span>
            </summary>
            <div class="px-5 pb-4 text-slate-600 text-sm leading-relaxed border-t border-slate-100 pt-3">
              {{ faq.answer }}
            </div>
          </details>
        </div>
      </SectionBlock>

      <section>
        <DataSourceCard :source="REAL_ESTATE_DATA_SOURCE" />
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useStructuredData } from '~/composables/useStructuredData'
import { REAL_ESTATE_DATA_SOURCE } from '~/utils/dataSource'
import DataSourceCard from '~/components/common/DataSourceCard.vue'
import PageHero from '~/components/common/PageHero.vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import RealEstateCategoryCards from '~/components/realEstate/RealEstateCategoryCards.vue'

const title = '부동산 실거래가 | 아파트·빌라·오피스텔 | 일상킷'
const description = '전국 아파트·빌라·오피스텔 매매·전월세 실거래가를 지역별로 조회하세요.'
const canonicalUrl = `${SITE_URL}/real-estate`
const heroStats = [
  { label: '데이터 출처', value: '국토교통부' },
  { label: '거래 유형', value: '매매·전월세' },
  { label: '주택 유형', value: '아파트·빌라·오피스텔' },
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

const realEstateFAQs = [
  { question: '실거래가란 무엇인가요?', answer: '실거래가는 부동산 거래 시 실제로 거래된 금액으로, 국토교통부에 신고된 공식 데이터입니다.' },
  { question: '실거래가 데이터는 얼마나 자주 업데이트되나요?', answer: '국토교통부 실거래가 공개시스템을 통해 매월 업데이트됩니다.' },
  { question: '아파트, 빌라, 오피스텔의 차이는 무엇인가요?', answer: '아파트는 5층 이상 공동주택, 빌라는 4층 이하 다세대/다가구 주택, 오피스텔은 업무와 주거를 겸할 수 있는 건물입니다.' },
  { question: '전세와 월세의 차이는 무엇인가요?', answer: '전세는 보증금을 맡기고 월 임대료 없이 거주하는 방식이고, 월세는 보증금과 함께 매월 임대료를 지불하는 방식입니다.' },
]

// Breadcrumb + ItemList JSON-LD
const { setBreadcrumbSchema, setItemListSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
])
setItemListSchema([
  { name: '아파트', url: '/real-estate/apt' },
  { name: '빌라', url: '/real-estate/villa' },
  { name: '오피스텔', url: '/real-estate/offitel' },
])

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '부동산 실거래가',
        description: '전국 아파트·빌라·오피스텔 매매·전월세 실거래가를 지역별로 조회하세요. 국토교통부 데이터 기반, 시세 추이와 거래 내역을 한눈에 확인할 수 있습니다.',
      }),
    },
  ],
})
</script>
