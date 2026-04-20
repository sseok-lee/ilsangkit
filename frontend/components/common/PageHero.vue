<template>
  <section class="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.6fr)] gap-5 items-stretch p-5 md:p-6 bg-white border border-line rounded-xl shadow-card">
    <!-- Main (eyebrow + title + desc + search slot) -->
    <div>
      <span v-if="eyebrow" class="inline-flex mb-2.5 px-2 py-1 bg-primary/10 text-primary rounded-lg text-xs font-black">
        {{ eyebrow }}
      </span>
      <h1 class="text-2xl md:text-[32px] leading-tight font-bold text-slate-900 mb-2">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="text-slate-500 text-sm md:text-base mb-4">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot name="search" />
    </div>

    <!-- Sidebar stats -->
    <aside v-if="stats?.length || $slots.sidebar" class="grid gap-2.5 content-start">
      <slot name="sidebar">
        <div
          v-for="stat in stats"
          :key="stat.label"
          class="p-3 bg-white border border-line rounded-xl shadow-card"
        >
          <span class="block text-slate-500 text-xs font-bold">{{ stat.label }}</span>
          <strong class="block mt-1 text-lg md:text-xl font-bold text-slate-900">{{ stat.value }}</strong>
        </div>
      </slot>
    </aside>
  </section>
</template>

<script setup lang="ts">
interface Stat {
  label: string
  value: string
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
