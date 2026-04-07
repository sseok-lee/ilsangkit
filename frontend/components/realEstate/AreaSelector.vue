<template>
  <div class="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
    <button
      class="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      :class="modelValue === null
        ? 'bg-primary-500 text-white font-bold'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
      @click="$emit('update:modelValue', null)"
    >
      전체
    </button>
    <button
      v-for="group in areas"
      :key="group.area"
      class="flex-shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
      :class="modelValue === group.area
        ? 'bg-primary-500 text-white font-bold'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'"
      @click="$emit('update:modelValue', group.area)"
    >
      {{ group.area }}㎡ · {{ group.pyeong }}평
    </button>
  </div>
</template>

<script setup lang="ts">
import type { AreaGroup } from '~/types/realEstate'

defineProps<{
  areas: AreaGroup[]
  modelValue: number | null
}>()

defineEmits<{
  'update:modelValue': [value: number | null]
}>()
</script>
