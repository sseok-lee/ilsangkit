<template>
  <nav class="category-tabs border-b border-gray-200 bg-white sticky top-0 z-40">
    <div class="container">
      <ul class="flex overflow-x-auto scrollbar-hide -mb-px" role="tablist">
        <li v-for="category in categories" :key="category.id" role="presentation">
          <NuxtLink
            :to="`/${category.id}`"
            class="tab-item flex items-center gap-2 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors"
            :class="[
              isActive(category.id)
                ? `text-${category.id} border-${category.id}`
                : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-300'
            ]"
            :style="isActive(category.id) ? { color: getCategoryColor(category.id), borderColor: getCategoryColor(category.id) } : {}"
            :aria-current="isActive(category.id) ? 'page' : undefined"
          >
            <span class="text-lg">{{ category.icon }}</span>
            <span>{{ category.name }}</span>
          </NuxtLink>
        </li>
      </ul>
    </div>
  </nav>
</template>

<script setup lang="ts">
import type { FacilityCategory } from '~/types/api'

interface Category {
  id: FacilityCategory | 'home'
  name: string
  icon: string
}

const categories: Category[] = [
  { id: 'toilet', name: '화장실', icon: '🚻' },
  { id: 'wifi', name: '와이파이', icon: '📶' },
  { id: 'clothes', name: '의류수거함', icon: '👕' },
  { id: 'kiosk', name: '무인민원', icon: '🏧' },
  { id: 'trash', name: '쓰레기배출', icon: '🗑️' },
]

const categoryColors: Record<string, string> = {
  toilet: '#8b5cf6',
  trash: '#10b981',
  wifi: '#f59e0b',
  clothes: '#ec4899',
  kiosk: '#6366f1',
}

const route = useRoute()

function isActive(categoryId: string): boolean {
  return route.path === `/${categoryId}` || route.path.startsWith(`/${categoryId}/`)
}

function getCategoryColor(categoryId: string): string {
  return categoryColors[categoryId] || '#3b82f6'
}
</script>

<style scoped>
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
</style>
