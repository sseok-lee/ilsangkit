<template>
  <section class="bg-primary/5 rounded-2xl p-5 md:p-6 text-center">
    <h3 class="text-display-3 text-slate-800 mb-2">
      {{ areaName }} 부동산 실거래가 상세 보기
    </h3>
    <p class="text-sm text-slate-600 mb-4">아파트, 빌라, 오피스텔, 토지 실거래가를 확인해보세요</p>
    <div class="flex justify-center gap-3">
      <NuxtLink
        to="/real-estate/apt-sale"
        class="px-4 py-2 bg-primary text-white text-sm font-semibold rounded-xl hover:bg-primary-dark transition-colors"
      >
        아파트
      </NuxtLink>
      <NuxtLink
        to="/real-estate/villa-sale"
        class="px-4 py-2 bg-white text-primary text-sm font-semibold rounded-xl border border-primary hover:bg-primary/5 transition-colors"
      >
        빌라
      </NuxtLink>
      <NuxtLink
        to="/real-estate/offitel-sale"
        class="px-4 py-2 bg-white text-primary text-sm font-semibold rounded-xl border border-primary hover:bg-primary/5 transition-colors"
      >
        오피스텔
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{
  areaName: string
}>()
</script>
