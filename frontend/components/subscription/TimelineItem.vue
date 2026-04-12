<template>
  <div class="flex gap-4">
    <!-- Timeline marker -->
    <div class="flex flex-col items-center">
      <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <span class="material-symbols-outlined text-primary text-[18px]">{{ icon }}</span>
      </div>
      <div v-if="!isLast" class="w-0.5 h-12 bg-slate-200 mt-2"></div>
    </div>
    <!-- Content -->
    <div class="pb-6">
      <p class="text-sm font-medium text-slate-900">{{ title }}</p>
      <p class="text-xs text-slate-500 mt-1">{{ formattedDate }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  title: string
  date: string | null
  icon: string
  isLast?: boolean
}>()

const formattedDate = computed(() => {
  if (!props.date) return '-'
  const d = new Date(props.date)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`
})
</script>
