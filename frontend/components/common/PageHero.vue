<template>
  <section class="p-4 md:p-5 bg-white border border-line rounded-xl shadow-card">
    <!-- Main (eyebrow + title + desc + search slot) -->
    <div>
      <span v-if="eyebrow" class="inline-flex mb-2 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-black">
        {{ eyebrow }}
      </span>
      <h1 class="text-2xl md:text-[32px] leading-tight font-bold text-slate-900 mb-2">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="text-slate-500 text-sm md:text-base">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot name="search" />
    </div>

    <!-- Inline summary-grid (below main) -->
    <div
      v-if="stats?.length || $slots.sidebar"
      class="mt-4 pt-4 border-t border-line flex flex-wrap gap-x-8 gap-y-4"
    >
      <slot name="sidebar">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="pl-3 border-l-2 border-slate-200 min-w-0 flex-1 sm:flex-initial sm:max-w-xs"
        >
          <span class="block text-slate-400 text-[11px] font-semibold uppercase tracking-wide">{{ stat.label }}</span>
          <strong
            class="block mt-1 text-base md:text-lg font-bold break-keep"
            :class="stat.color ?? 'text-slate-900'"
          >
            {{ stat.value }}
          </strong>
        </div>
      </slot>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Stat {
  label: string
  value: string
  color?: string
}

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  stats?: Stat[]
}>(), {
  eyebrow: '',
  title: '',
  description: '',
  stats: () => [],
})
</script>
