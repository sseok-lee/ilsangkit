<template>
  <div class="flex justify-between py-2 border-b border-gray-100 last:border-0">
    <dt class="text-sm font-medium text-gray-600">{{ label }}</dt>
    <dd class="text-sm text-gray-900 text-right">{{ value }}</dd>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
}>()
</script>
