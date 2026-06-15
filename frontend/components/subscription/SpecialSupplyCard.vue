<template>
  <div class="bg-background-light rounded-lg p-4 text-center">
    <p class="text-xs text-ink mb-2">{{ label }}</p>
    <p class="text-2xl font-bold text-primary">{{ count }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  count: number | null
}>()
</script>
