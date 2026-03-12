<template>
  <div class="bg-background-light">
    <main class="mx-auto max-w-5xl px-4 py-8 md:px-6">
      <div class="mb-8">
        <h1 class="text-2xl md:text-3xl font-bold text-slate-900">부동산 실거래가</h1>
        <p class="mt-2 text-slate-600">
          국토교통부 공식 데이터 기반 아파트, 빌라, 오피스텔 매매·전월세 실거래가 정보를 확인하세요.
        </p>
      </div>

      <RealEstateCategoryCards />

      <section class="mt-12">
        <h2 class="text-lg font-bold text-slate-800 mb-4">부동산 실거래가란?</h2>
        <div class="rounded-2xl bg-white border border-slate-100 p-6 text-[15px] text-slate-600 leading-relaxed space-y-3">
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
useHead({
  title: '부동산 실거래가 | 일상킷',
  meta: [
    {
      name: 'description',
      content: '전국 아파트, 빌라, 오피스텔 매매 및 전월세 실거래가를 확인하세요. 국토교통부 공식 데이터 기반 실거래 정보 제공.',
    },
  ],
})

useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: '부동산 실거래가',
        description: '전국 아파트, 빌라, 오피스텔 매매 및 전월세 실거래가를 확인하세요.',
      }),
    },
  ],
})
</script>
