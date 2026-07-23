<template>
  <div class="flex gap-1 rounded-xl bg-slate-100 p-1">
    <button
      v-for="tab in tabs"
      :key="tab.value"
      :disabled="tab.value === 'rent' && disableRent"
      :class="[
        'flex-1 min-h-[44px] flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50',
        modelValue === tab.value
          ? 'bg-white text-primary shadow-sm'
          : 'text-slate-500 hover:text-slate-700 disabled:hover:text-slate-500',
      ]"
      @click="tab.value !== 'rent' || !disableRent ? $emit('update:modelValue', tab.value) : null"
    >
      {{ tab.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
import type { TransactionMode } from '~/types/realEstate'

defineProps<{
  modelValue: TransactionMode
  disableRent?: boolean
}>()

defineEmits<{
  'update:modelValue': [value: TransactionMode]
}>()

const tabs = [
  { value: 'sale' as const, label: '매매' },
  { value: 'rent' as const, label: '전월세' },
]
</script>
