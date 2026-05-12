<template>
  <section class="p-4 md:p-5 bg-white border border-line rounded-xl shadow-card">
    <!-- Main (eyebrow + title + desc + search slot) -->
    <div>
      <span v-if="eyebrow" class="inline-flex mb-3 px-2 py-1 bg-primary/10 text-primary rounded text-eyebrow">
        {{ eyebrow }}
      </span>
      <h1 class="text-display-1 text-slate-900 mb-2">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="text-body text-slate-500">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot name="search" />
    </div>

    <!-- Inline summary-grid (below main) -->
    <div
      v-if="stats?.length || $slots.sidebar"
      class="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8"
    >
      <slot name="sidebar">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="min-w-0 sm:flex-initial sm:max-w-xs"
        >
          <span class="block text-caption text-slate-400">{{ stat.label }}</span>
          <strong
            class="block mt-1 text-display-3 break-keep"
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
