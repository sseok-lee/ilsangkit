<template>
  <div class="flex items-center gap-1 text-[11px] font-bold">
    <button
      v-for="opt in OPTIONS"
      :key="opt.value"
      :class="[
        'px-2 py-0.5 rounded-full transition',
        modelValue === opt.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100',
      ]"
      @click="$emit('update:modelValue', opt.value)"
    >
      {{ opt.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
type TxnKey = 'sale' | 'jeonse' | 'wolse';

defineProps<{ modelValue: TxnKey }>();
defineEmits<{ (e: 'update:modelValue', value: TxnKey): void }>();

const OPTIONS: { value: TxnKey; label: string }[] = [
  { value: 'sale', label: '매매' },
  { value: 'jeonse', label: '전세' },
  { value: 'wolse', label: '월세' },
];
</script>
