<!-- frontend/components/auction/AuctionFilters.vue -->
<script setup lang="ts">
import { USAGE_GROUP_LABEL } from '~/types/auction'
defineProps<{ usage: string; status: string; city: string; district: string }>()
defineEmits<{ 'update:usage': [string]; 'update:status': [string]; 'update:city': [string]; 'update:district': [string] }>()
const usageOptions = Object.entries(USAGE_GROUP_LABEL)
</script>
<template>
  <div class="flex flex-wrap gap-2">
    <select data-testid="usage" :value="usage" class="rounded-lg border border-line px-3 py-2 text-sm" @change="$emit('update:usage', ($event.target as HTMLSelectElement).value)">
      <option value="">전체 용도</option>
      <option v-for="[k, v] in usageOptions" :key="k" :value="k">{{ v }}</option>
    </select>
    <select data-testid="status" :value="status" class="rounded-lg border border-line px-3 py-2 text-sm" @change="$emit('update:status', ($event.target as HTMLSelectElement).value)">
      <option value="">전체 상태</option>
      <option value="ongoing">진행중·예정</option>
      <option value="closed">마감</option>
    </select>
  </div>
</template>
