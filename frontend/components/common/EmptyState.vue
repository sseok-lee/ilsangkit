<template>
  <div class="py-12 text-center">
    <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
      <span class="material-symbols-outlined text-[32px] text-slate-500">{{ icon }}</span>
    </div>
    <p class="text-slate-700 font-semibold text-lg">{{ title }}</p>
    <p v-if="description" class="text-slate-500 text-sm mt-1 mb-6">{{ description }}</p>
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
