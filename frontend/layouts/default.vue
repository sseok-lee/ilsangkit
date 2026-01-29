<template>
  <div class="min-h-screen flex flex-col bg-gray-50">
    <!-- Header -->
    <header class="h-14 bg-white border-b border-gray-200 sticky top-0 z-50">
      <div class="container h-full flex items-center justify-between">
        <NuxtLink to="/" class="text-xl font-bold text-primary-600">
          일상킷
        </NuxtLink>
        <nav class="flex items-center gap-4">
          <button
            type="button"
            class="p-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="검색"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </nav>
      </div>
    </header>

    <!-- Category Tabs -->
    <CommonCategoryTabs />

    <!-- Main Content -->
    <main class="flex-1 flex flex-col">
      <slot />
    </main>

    <!-- Footer (hidden on category pages to maximize map space) -->
    <footer v-if="showFooter" class="py-6 bg-white border-t border-gray-200">
      <div class="container text-center text-sm text-gray-500">
        <p>&copy; 2024 일상킷. All rights reserved.</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
const route = useRoute()

const showFooter = computed(() => {
  // Hide footer on category pages to maximize content space
  const categoryRoutes = ['toilet', 'wifi', 'clothes', 'battery', 'kiosk', 'trash']
  const currentPath = route.path.split('/')[1]
  return !categoryRoutes.includes(currentPath)
})
</script>
