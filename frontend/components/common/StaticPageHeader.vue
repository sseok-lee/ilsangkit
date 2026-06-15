<template>
  <div class="mb-5 md:mb-6">
    <h1 class="text-2xl md:text-3xl font-bold text-strong">
      {{ title }}
    </h1>
    <p v-if="lead" class="mt-2 text-muted text-sm md:text-base">
      {{ lead }}
    </p>
    <p v-if="updatedAt" class="mt-3">
      <span class="inline-flex items-center gap-1.5 rounded-md bg-background-light px-2.5 py-1 text-xs font-medium text-muted">
        <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">calendar_month</span>
        마지막 업데이트 {{ updatedAt }}
      </span>
    </p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  title: string
  lead?: string
  updatedAt?: string
}>()
</script>
