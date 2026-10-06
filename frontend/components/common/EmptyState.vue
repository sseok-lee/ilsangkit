<template>
  <div class="py-12 text-center">
    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-background-light flex items-center justify-center">
      <span class="material-symbols-outlined text-[32px] text-muted">{{ icon }}</span>
    </div>
    <p class="text-ink font-semibold text-lg">{{ title }}</p>
    <p v-if="description" class="text-muted text-sm mt-1 mb-6">{{ description }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  icon?: string
  title: string
  description?: string
}>(), {
  icon: 'search_off',
})
</script>
