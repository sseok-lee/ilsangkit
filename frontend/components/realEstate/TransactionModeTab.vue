<template>
  <div class="flex gap-1 rounded-xl bg-slate-100 p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      :class="[
        'flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all',
        modelValue === tab.value
          ? 'bg-white text-primary shadow-sm'
          : 'text-slate-500 hover:text-slate-700',
      ]"
      @click="$emit('update:modelValue', tab.value)"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TransactionMode } from '~/types/realEstate'

defineProps<{
  modelValue: TransactionMode
}>()

defineEmits<{
  'update:modelValue': [value: TransactionMode]
}>()

const tabs = [
  { value: 'sale' as const, label: '매매' },
  { value: 'rent' as const, label: '전월세' },
]
</script>
