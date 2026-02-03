<template>
  <div
    data-testid="category-cards"
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5"
  >
    <NuxtLink
      v-for="category in categories"
      :key="category.id"
      :to="`/search?category=${category.id}`"
      :class="[
        'group flex flex-col items-center justify-center gap-4 rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-lg',
        getCategoryBgClass(category.id),
      ]"
    >
      <div
        :class="[
          'flex size-16 items-center justify-center rounded-full bg-white shadow-sm',
          getCategoryIconBgClass(category.id),
        ]"
      >
        <CategoryIcon :category-id="category.id" size="lg" />
      </div>
      <span
        :class="[
          'text-center text-base font-bold',
          getCategoryTextClass(category.id),
        ]"
      >
        {{ category.label }}
      </span>
    </NuxtLink>
  </div>
</template>

<script setup lang="ts">
import type { CategoryId } from '~/utils/categoryIcons'

defineOptions({
  name: 'CategoryCards',
})

interface Category {
  id: CategoryId
  label: string
  icon?: string
}

interface Props {
  categories: Category[]
}

defineProps<Props>()

const getCategoryBgClass = (categoryId: string): string => {
  const bgMap: Record<string, string> = {
    toilet: 'bg-purple-50 dark:bg-purple-900/20',
    trash: 'bg-green-50 dark:bg-green-900/20',
    wifi: 'bg-orange-50 dark:bg-orange-900/20',
    clothes: 'bg-pink-50 dark:bg-pink-900/20',
    kiosk: 'bg-indigo-50 dark:bg-indigo-900/20',
  }
  return bgMap[categoryId] || 'bg-gray-50 dark:bg-gray-900/20'
}

const getCategoryIconBgClass = (categoryId: string): string => {
  const bgMap: Record<string, string> = {
    toilet: 'dark:bg-purple-900/40',
    trash: 'dark:bg-green-900/40',
    wifi: 'dark:bg-orange-900/40',
    clothes: 'dark:bg-pink-900/40',
    kiosk: 'dark:bg-indigo-900/40',
  }
  return bgMap[categoryId] || 'dark:bg-gray-900/40'
}

const getCategoryTextClass = (categoryId: string): string => {
  const textMap: Record<string, string> = {
    toilet: 'text-purple-900 dark:text-purple-100',
    trash: 'text-green-900 dark:text-green-100',
    wifi: 'text-orange-900 dark:text-orange-100',
    clothes: 'text-pink-900 dark:text-pink-100',
    kiosk: 'text-indigo-900 dark:text-indigo-100',
  }
  return textMap[categoryId] || 'text-gray-900 dark:text-gray-100'
}
</script>
