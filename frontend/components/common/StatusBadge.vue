<template>
  <span
    class="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold"
    :class="variantClass"
  >
    <slot />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'

type Variant = 'green' | 'blue' | 'amber' | 'rose' | 'purple' | 'default'

const props = withDefaults(defineProps<{
  variant?: Variant
}>(), {
  variant: 'default',
})

const VARIANT_CLASS: Record<Variant, string> = {
  green: 'bg-emerald-50 text-emerald-700',
  blue: 'bg-blue-50 text-blue-700',
  amber: 'bg-amber-50 text-amber-700',
  rose: 'bg-rose-50 text-rose-700',
  purple: 'bg-violet-50 text-violet-700',
  default: 'bg-slate-100 text-slate-600',
}

const variantClass = computed(() => VARIANT_CLASS[props.variant])
</script>
