<template>
  <span v-if="useFallback" :class="['material-symbols-outlined object-contain inline-flex items-center justify-center', sizeClass]" :style="{ fontSize: `${sizePixels}px` }" aria-hidden="true">
    {{ fallbackSymbol }}
  </span>
  <img
    v-else
    :src="iconSrc"
    :alt="categoryLabel"
    :class="sizeClass"
    :width="sizePixels"
    :height="sizePixels"
    loading="lazy"
    class="object-contain"
    @error="useFallback = true"
  />
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { CATEGORY_ICONS, CATEGORY_LABELS, type CategoryId } from '~/utils/categoryIcons'

interface Props {
  categoryId: CategoryId
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
})

// 향후 webp 누락 카테고리의 안전망 — Material Symbols 글리프로 fallback
const FALLBACK_SYMBOLS: Partial<Record<CategoryId, string>> = {}

const useFallback = ref(false)

const iconSrc = computed(() => CATEGORY_ICONS[props.categoryId])
const categoryLabel = computed(() => CATEGORY_LABELS[props.categoryId])

const fallbackSymbol = computed(() => FALLBACK_SYMBOLS[props.categoryId] ?? 'place')

const sizeClass = computed(() => {
  const sizeMap = {
    sm: 'w-5 h-5',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
  }
  return sizeMap[props.size]
})

const sizePixels = computed(() => {
  const pixelMap = { sm: 20, md: 32, lg: 48, xl: 64 }
  return pixelMap[props.size]
})
</script>
