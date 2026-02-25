<template>
  <NuxtLayout>
    <Head>
      <Title>{{ errorTitle }}</Title>
      <Meta name="robots" content="noindex, nofollow" />
    </Head>

    <main class="flex-1 flex items-center justify-center px-4 py-16">
      <div class="max-w-lg w-full text-center">
        <!-- Error Code -->
        <p class="text-8xl font-bold text-primary mb-4">
          {{ error?.statusCode || 500 }}
        </p>

        <!-- Error Message -->
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white mb-3">
          {{ errorTitle }}
        </h1>
        <p class="text-gray-500 dark:text-slate-400 mb-10">
          {{ errorDescription }}
        </p>

        <!-- Home Button -->
        <button
          class="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white font-medium rounded-lg transition-colors mb-12"
          @click="handleError"
        >
          <span class="material-symbols-outlined text-[20px]">home</span>
          홈으로 돌아가기
        </button>

        <!-- Category Shortcuts -->
        <div class="border-t border-gray-200 dark:border-slate-700 pt-8">
          <p class="text-sm text-gray-500 dark:text-slate-400 mb-4">
            찾고 있는 정보가 있다면 아래 카테고리를 이용해 보세요
          </p>
          <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <NuxtLink
              v-for="cat in categoryShortcuts"
              :key="cat.slug"
              :to="`/${cat.slug}`"
              class="flex items-center gap-2 px-4 py-3 bg-white dark:bg-surface-dark border border-gray-200 dark:border-slate-700 rounded-lg hover:shadow-md hover:border-primary/30 transition-all text-sm font-medium text-gray-700 dark:text-slate-300"
            >
              <span class="material-symbols-outlined text-[18px] text-primary">{{ cat.icon }}</span>
              {{ cat.label }}
            </NuxtLink>
          </div>
        </div>
      </div>
    </main>
  </NuxtLayout>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { NuxtError } from '#app'
import { CATEGORY_META, CATEGORY_GROUPS } from '~/types/facility'

const props = defineProps<{
  error: NuxtError
}>()

const is404 = computed(() => props.error?.statusCode === 404)

const errorTitle = computed(() =>
  is404.value ? '페이지를 찾을 수 없습니다' : '오류가 발생했습니다'
)

const errorDescription = computed(() =>
  is404.value
    ? '요청하신 페이지가 존재하지 않거나 이동되었을 수 있습니다.'
    : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.'
)

// 주요 카테고리 바로가기 (6개)
const categoryShortcuts = computed(() => {
  const shortcuts: { slug: string; label: string; icon: string }[] = []
  for (const group of CATEGORY_GROUPS) {
    for (const id of group.categories) {
      shortcuts.push({
        slug: id,
        label: CATEGORY_META[id].shortLabel,
        icon: CATEGORY_META[id].icon,
      })
    }
  }
  return shortcuts.slice(0, 6)
})

const handleError = () => clearError({ redirect: '/' })
</script>

<style scoped>
.material-symbols-outlined {
  font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
}
</style>
