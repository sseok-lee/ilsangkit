<template>
  <div class="search-bar flex-1 relative">
    <div class="relative">
      <input
        :value="modelValue"
        type="text"
        aria-label="장소 검색"
        class="w-full h-10 pl-10 pr-4 rounded-full border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm transition-colors"
        :placeholder="placeholder"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        @keydown.enter="$emit('search')"
      />
      <svg
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        class="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  modelValue: string
  placeholder?: string
}>()

defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'search'): void
}>()
</script>
