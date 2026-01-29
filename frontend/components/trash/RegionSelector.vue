<template>
  <div class="region-selector flex gap-2">
    <!-- City Select -->
    <div class="flex-1 relative">
      <select
        :value="city"
        class="w-full h-10 px-3 pr-8 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm bg-white appearance-none cursor-pointer"
        :disabled="loading"
        @change="$emit('update:city', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">시/도 선택</option>
        <option v-for="c in cities" :key="c" :value="c">{{ c }}</option>
      </select>
      <svg
        class="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>

    <!-- District Select -->
    <div class="flex-1 relative">
      <select
        :value="district"
        class="w-full h-10 px-3 pr-8 rounded-lg border border-gray-300 focus:border-primary-500 focus:ring-1 focus:ring-primary-500 text-sm bg-white appearance-none cursor-pointer"
        :disabled="loading || !city"
        @change="$emit('update:district', ($event.target as HTMLSelectElement).value)"
      >
        <option value="">구/군 선택</option>
        <option v-for="d in districts" :key="d" :value="d">{{ d }}</option>
      </select>
      <svg
        class="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400 pointer-events-none"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
      </svg>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  city: string
  district: string
  cities: string[]
  districts: string[]
  loading?: boolean
}>()

defineEmits<{
  (e: 'update:city', value: string): void
  (e: 'update:district', value: string): void
}>()
</script>
