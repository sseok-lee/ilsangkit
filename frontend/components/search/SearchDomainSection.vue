<template>
  <section class="mt-8 first:mt-0">
    <div class="flex items-baseline gap-3 pb-3 mb-5 border-b border-line">
      <h2 class="text-xl md:text-2xl font-bold text-strong tracking-tight">{{ title }}</h2>
      <span class="text-[13px] font-semibold text-faint tabular-nums">
        <template v-if="countLabel">{{ countLabel }} · </template>{{ count.toLocaleString('ko-KR') }}건
      </span>
    </div>
    <slot />
  </section>
</template>

<script setup lang="ts">
defineProps<{ title: string; count: number; countLabel?: string }>()
</script>
