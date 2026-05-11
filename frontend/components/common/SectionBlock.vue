<template>
  <section
    class="bg-white border border-line rounded-xl shadow-card"
    :class="paddingClass"
  >
    <header v-if="heading || $slots.heading || $slots.right" class="flex justify-between items-end gap-4 mb-3">
      <div class="min-w-0">
        <slot name="heading">
          <h3 v-if="heading" class="text-base md:text-lg font-bold text-slate-900 leading-tight">{{ heading }}</h3>
        </slot>
        <p v-if="subtext" class="mt-1 text-slate-500 text-xs md:text-sm">{{ subtext }}</p>
      </div>
      <div v-if="$slots.right" class="shrink-0">
        <slot name="right" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  heading?: string
  subtext?: string
  // 정보 위계에 따른 패딩 variant (shape 브리프: "Hero는 넓게, FAQ는 좁게")
  size?: 'hero' | 'default' | 'compact'
}>(), {
  heading: '',
  subtext: '',
  size: 'default',
})

const paddingClass = computed(() => {
  if (props.size === 'hero') return 'p-5 md:p-6'
  if (props.size === 'compact') return 'p-3 md:p-4'
  return 'p-4 md:p-5'
})
</script>
