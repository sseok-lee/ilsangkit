<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// App-level setup
useHead({
  titleTemplate: (title) => title || '일상킷 - 내 주변 생활 편의 정보',
  meta: [
    { name: 'description', content: '아파트·빌라·오피스텔 실거래가 조회부터 내 주변 병원·약국·주차장까지, 생활 정보를 한곳에서 확인하세요.' }
  ]
})
</script>

<style>
/* Global styles are in assets/css/main.css */
</style>
