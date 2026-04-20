<template>
  <section class="bg-white border border-line rounded-xl shadow-card p-4 md:p-5">
    <header v-if="heading || $slots.heading || $slots.right" class="flex justify-between items-end gap-4 mb-3.5">
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
withDefaults(defineProps<{
  heading?: string
  subtext?: string
}>(), {
  heading: '',
  subtext: '',
})
</script>
