<template>
  <div class="bg-slate-50 rounded-lg p-4 text-center">
    <p class="text-xs text-slate-600 mb-2">{{ label }}</p>
    <p class="text-2xl font-bold text-primary">{{ count }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  count: number | null
}>()
</script>
