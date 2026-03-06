<template>
  <div class="flex flex-col sm:flex-row py-2 border-b border-gray-100 last:border-0 gap-0.5 sm:gap-4">
    <dt class="text-sm font-medium text-gray-600 min-w-[7rem] shrink-0">{{ label }}</dt>
    <dd class="text-sm text-gray-900">
      <a
        v-if="type === 'phone' && value"
        :href="`tel:${String(value).replace(/[^0-9+\-]/g, '')}`"
        class="text-primary font-medium underline"
      >
        {{ value }}
      </a>
      <template v-else>{{ value }}</template>
    </dd>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  type?: 'text' | 'phone' | 'link'
}>()
</script>
