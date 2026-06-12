<template>
  <section class="p-4 md:p-5 bg-white border border-line rounded-xl shadow-card">
    <!-- Main (eyebrow/kicker + title + desc + search slot) -->
    <div>
      <span
        v-if="eyebrow"
        class="inline-flex items-center mb-3 px-2.5 py-1 rounded-full text-eyebrow"
        :style="{ color: 'var(--cat, var(--brand))', background: 'color-mix(in srgb, var(--cat, var(--brand)) 10%, white)' }"
      >
        {{ eyebrow }}
      </span>
      <h1 class="text-display-1 text-strong mb-2">
        <slot name="title">{{ title }}</slot>
      </h1>
      <p v-if="description || $slots.description" class="text-body text-muted">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot name="search" />
    </div>

    <!-- Summary stats: OD 테두리 분할 그리드 (sidebar 슬롯이 있으면 기존 레이아웃 유지) -->
    <template v-if="$slots.sidebar">
      <div class="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8">
        <slot name="sidebar" />
      </div>
    </template>
    <div
      v-else-if="stats?.length"
      class="od-hero-stats mt-4"
      :style="{ '--od-cols': Math.min(stats.length, 4) }"
    >
      <div v-for="stat in stats" :key="stat.label" class="s">
        <div class="k">{{ stat.label }}</div>
        <div class="v break-keep" :class="stat.color">{{ stat.value }}</div>
      </div>
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
