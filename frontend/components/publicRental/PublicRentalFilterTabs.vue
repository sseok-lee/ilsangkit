<template>
  <div class="flex flex-wrap gap-2">
    <NuxtLink
      v-for="tab in TABS"
      :key="tab.match"
      :to="tab.to"
      :class="['px-4 py-2 rounded-lg font-medium text-sm transition-colors', active === tab.match ? 'bg-primary text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50']"
    >
      {{ tab.label }}
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  // 활성 탭 식별자 — 'announcements' | 'buy-lease' | 'charter' | undefined(=전체)
  active?: string
}>()

const TABS = [
  { match: 'announcements', to: '/public-rental/announcements', label: '모집공고' },
  { match: 'buy-lease', to: '/public-rental/buy-lease', label: '매입임대' },
  { match: 'charter', to: '/public-rental/charter', label: '전세임대' },
]
</script>
