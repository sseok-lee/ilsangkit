<script setup lang="ts">
defineProps<{ current: 'privacy' | 'terms' }>()
</script>
<template>
  <nav aria-label="법적 문서" class="mb-8 flex flex-wrap gap-2 border-b border-line pb-5">
    <NuxtLink v-for="item in [{ key: 'privacy', label: '개인정보처리방침' }, { key: 'terms', label: '이용약관' }]" :key="item.key" :to="`/${item.key}`" :aria-current="current === item.key ? 'page' : undefined" class="inline-flex min-h-11 items-center rounded-md px-4 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" :class="current === item.key ? 'bg-primary text-white' : 'text-muted hover:bg-background-light'">{{ item.label }}</NuxtLink>
  </nav>
</template>
