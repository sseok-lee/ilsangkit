<template>
  <img :src="iconSrc" :alt="categoryLabel" :class="sizeClass" class="object-contain" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { CATEGORY_ICONS, CATEGORY_LABELS, type CategoryId } from '~/utils/categoryIcons'

interface Props {
  categoryId: CategoryId
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

const iconSrc = computed(() => CATEGORY_ICONS[props.categoryId])
const categoryLabel = computed(() => CATEGORY_LABELS[props.categoryId])

const sizeClass = computed(() => {
  const sizeMap = {
    sm: 'w-5 h-5', // 20px
    md: 'w-8 h-8', // 32px
    lg: 'w-12 h-12', // 48px
    xl: 'w-16 h-16', // 64px
  }
  return sizeMap[props.size]
})
</script>
