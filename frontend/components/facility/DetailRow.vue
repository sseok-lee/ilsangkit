<template>
  <div class="flex flex-row py-2 border-b border-slate-100 last:border-0 gap-4">
    <dt class="text-xs font-medium text-slate-500 min-w-[7rem] shrink-0 pt-0.5">{{ label }}</dt>
    <dd class="text-sm text-slate-900 whitespace-pre-line">
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
