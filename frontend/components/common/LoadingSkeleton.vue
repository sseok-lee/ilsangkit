<template>
  <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    <div v-for="i in count" :key="i" class="bg-white rounded-xl p-4 border border-line animate-pulse">
      <div v-if="variant === 'facility-card'" class="flex items-start gap-4">
        <div class="shrink-0 w-12 h-12 rounded-full bg-slate-200"></div>
        <div class="flex-1 space-y-2.5">
          <div class="h-4 bg-slate-200 rounded w-3/4"></div>
          <div class="h-3 bg-slate-100 rounded w-full"></div>
          <div class="flex gap-2 mt-1">
            <div class="h-5 bg-slate-100 rounded-md w-14"></div>
            <div class="h-5 bg-slate-100 rounded-md w-20"></div>
          </div>
        </div>
      </div>
      <div v-else class="space-y-3">
        <div class="h-4 bg-slate-200 rounded w-2/3"></div>
        <div class="h-3 bg-slate-100 rounded w-full"></div>
        <div class="h-3 bg-slate-100 rounded w-3/4"></div>
        <div v-if="footer" class="h-8 bg-slate-200 rounded w-24 mt-4"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  variant?: 'facility-card' | 'card'
  count?: number
  footer?: boolean
}>(), {
  variant: 'card',
  count: 6,
  footer: false,
})
</script>
