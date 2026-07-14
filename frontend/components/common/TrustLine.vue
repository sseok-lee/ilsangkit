<template>
  <div class="w-full max-w-4xl mx-auto px-4 pb-5">
    <div class="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-primary-100 bg-primary-50 px-4 py-2.5 text-xs text-muted">
      <span class="font-extrabold text-primary" aria-hidden="true">✓</span>
      <span>공공데이터 기반 서비스 — 행정안전부 · 국토교통부 · 보건복지부 등 공식 API/CSV를 공공누리(KOGL) 조건에 따라 사용합니다</span>
      <HardLink to="/about#data-sources" class="ml-auto whitespace-nowrap font-bold text-primary hover:underline">
        전체 출처 보기 →
      </HardLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'
</script>
