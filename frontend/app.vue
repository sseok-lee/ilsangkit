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
    { name: 'description', content: '공공시설과 생활 편의 정보를 통합 검색합니다.' }
  ]
})
</script>

<style>
/* Global styles are in assets/css/main.css */
</style>
