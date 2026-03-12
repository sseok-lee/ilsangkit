<template>
  <div class="flex rounded-lg overflow-hidden border border-slate-200">
    <button
      v-for="option in options"
      :key="option.value"
      :class="[
        'flex-1 px-4 py-2 text-sm font-medium transition-all',
        modelValue === option.value
          ? 'bg-primary text-white'
          : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
      ]"
      @click="emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type RentType = 'all' | 'jeonse' | 'wolse'

interface Props {
  modelValue: RentType
}

interface Emits {
  (e: 'update:modelValue', value: RentType): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const options: { label: string; value: RentType }[] = [
  { label: '전체', value: 'all' },
  { label: '전세', value: 'jeonse' },
  { label: '월세', value: 'wolse' },
]
</script>
