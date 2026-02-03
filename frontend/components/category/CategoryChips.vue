<template>
  <div
    data-testid="chips-container"
    class="flex gap-3 overflow-x-auto pb-2 md:grid md:grid-cols-5 md:overflow-visible scrollbar-hide"
  >
    <button
      v-for="category in categories"
      :key="category.id"
      type="button"
      :class="[
        'px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all border-2 min-h-11',
        selectedCategory === category.id
          ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg'
          : 'bg-white text-gray-700 border-gray-300 hover:border-indigo-400 hover:bg-indigo-50',
      ]"
      @click="onSelect(category.id)"
    >
      {{ category.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineOptions({
  name: 'CategoryChips',
})

interface Category {
  id: string
  label: string
}

interface Props {
  categories: Category[]
  selectedCategory: string | null
}

interface Emits {
  (e: 'select', categoryId: string | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

function onSelect(categoryId: string) {
  // Toggle: if already selected, deselect it
  if (props.selectedCategory === categoryId) {
    emit('select', null)
  } else {
    emit('select', categoryId)
  }
}
</script>

<style scoped>
/* Hide scrollbar for webkit browsers */
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

/* Hide scrollbar for Firefox */
.scrollbar-hide {
  scrollbar-width: none;
}
</style>
