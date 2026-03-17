<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-6xl px-4 py-8 md:px-6">
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">부동산 실거래가</h1>
        <p class="mt-2 text-slate-500 text-sm">
          전국 아파트·빌라·오피스텔 매매·전월세 실거래가를 지역별로 조회하세요.<br />
          국토교통부 데이터 기반, 시세 추이와 거래 내역을 한눈에 확인할 수 있습니다.
        </p>
      </div>

      <RealEstateCategoryCards />

      <section class="mt-12">
        <h2 class="text-lg font-bold text-slate-800 mb-4">부동산 실거래가란?</h2>
        <div class="rounded-2xl bg-white border border-slate-200 p-6 text-base text-slate-600 leading-relaxed space-y-3">
          <p>
            부동산 실거래가는 실제 거래가 완료된 가격으로, 국토교통부에 신고된 공식 데이터입니다.
            매매·전월세 계약 체결 후 30일 이내에 신고된 금액이므로, 호가(희망 가격)와 다를 수 있습니다.
          </p>
          <p>
            일상킷은 국토교통부 실거래가 공개시스템의 데이터를 매일 수집하여 아파트, 연립다세대(빌라),
            오피스텔의 매매 및 전월세 실거래 내역을 제공합니다.
          </p>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
import { SITE_URL, DEFAULT_OG_IMAGE } from '~/utils/seoConstants'
import { useStructuredData } from '~/composables/useStructuredData'

const title = '부동산 실거래가·시세 조회 · 아파트/빌라/오피스텔 - 일상킷'
const description = '아파트·빌라·오피스텔 실거래가와 시세를 한곳에서 조회하세요. 국토부 공식 데이터 기반 매매가, 전세가, 최근 거래 내역을 확인할 수 있습니다.'
const canonicalUrl = `${SITE_URL}/real-estate`

useHead({
  title,
  meta: [
    { name: 'description', content: description },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:image', content: DEFAULT_OG_IMAGE },
    { property: 'og:url', content: canonicalUrl },
    { property: 'og:type', content: 'website' },
  ],
  link: [
    { rel: 'canonical', href: canonicalUrl },
  ],
})

// Breadcrumb JSON-LD
const { setBreadcrumbSchema } = useStructuredData()
setBreadcrumbSchema([
  { name: '홈', url: '/' },
  { name: '부동산 실거래가', url: '/real-estate' },
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
