<template>
  <div
    data-testid="category-cards"
    class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5"
  >
    <NuxtLink
      v-for="category in categories"
      :key="category.id"
      :to="`/${category.id}`"
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
    toilet: 'bg-purple-50',
    trash: 'bg-green-50',
    wifi: 'bg-orange-50',
    clothes: 'bg-pink-50',
    parking: 'bg-sky-50',
    aed: 'bg-red-50',
    library: 'bg-amber-50',
    park: 'bg-green-50',
    school: 'bg-indigo-50',
    market: 'bg-orange-50',
  }
  return bgMap[categoryId] || 'bg-slate-50'
}

const getCategoryIconBgClass = (categoryId: string): string => {
  const bgMap: Record<string, string> = {
    toilet: '',
    trash: '',
    wifi: '',
    clothes: '',
    parking: '',
    aed: '',
    library: '',
    park: '',
    school: '',
    market: '',
  }
  return bgMap[categoryId] || ''
}

const getCategoryTextClass = (categoryId: string): string => {
  const textMap: Record<string, string> = {
    toilet: 'text-purple-900',
    trash: 'text-green-900',
    wifi: 'text-orange-900',
    clothes: 'text-pink-900',
    parking: 'text-sky-900',
    aed: 'text-red-900',
    library: 'text-amber-900',
    park: 'text-green-900',
    school: 'text-indigo-900',
    market: 'text-orange-900',
  }
  return textMap[categoryId] || 'text-slate-900'
}
</script>
