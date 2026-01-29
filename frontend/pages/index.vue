<template>
  <div class="home-page">
    <!-- Hero Section -->
    <div class="bg-gradient-to-b from-primary-50 to-white py-12 px-4">
      <div class="max-w-4xl mx-auto text-center">
        <h1 class="text-3xl lg:text-4xl font-bold text-gray-900 mb-3">
          내 주변 생활 편의 정보
        </h1>
        <p class="text-lg text-gray-600">
          공공화장실, 와이파이, 쓰레기 배출 일정까지<br class="sm:hidden" />
          한 곳에서 찾아보세요
        </p>
      </div>
    </div>

    <!-- Category Grid -->
    <div class="container py-8">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">카테고리 선택</h2>
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <NuxtLink
          v-for="category in categories"
          :key="category.id"
          :to="`/${category.id}`"
          class="category-card group bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md hover:border-gray-200 transition-all"
        >
          <div class="text-4xl mb-3">{{ category.icon }}</div>
          <h3 class="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">
            {{ category.name }}
          </h3>
          <p class="text-sm text-gray-500 mt-1">{{ category.description }}</p>
        </NuxtLink>
      </div>
    </div>

    <!-- Quick Access Section -->
    <div class="container pb-12">
      <h2 class="text-lg font-semibold text-gray-900 mb-4">빠른 접근</h2>
      <div class="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
        <button
          type="button"
          class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 transition-colors"
          @click="handleLocationSearch"
        >
          <div class="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div class="flex-1 text-left">
            <p class="font-medium text-gray-900">현재 위치에서 찾기</p>
            <p class="text-sm text-gray-500">주변 모든 시설을 한 번에 검색</p>
          </div>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const router = useRouter()

interface Category {
  id: string
  name: string
  icon: string
  description: string
}

const categories: Category[] = [
  { id: 'toilet', name: '공공화장실', icon: '🚻', description: '24시간 무료 이용' },
  { id: 'wifi', name: '무료 와이파이', icon: '📶', description: '공공 Wi-Fi 위치' },
  { id: 'clothes', name: '의류수거함', icon: '👕', description: '헌 옷 기부장소' },
  { id: 'kiosk', name: '무인민원', icon: '🏧', description: '민원서류 발급기' },
  { id: 'trash', name: '쓰레기배출', icon: '🗑️', description: '배출 일정 확인' },
]

function handleLocationSearch() {
  // Default to toilet page with location trigger
  router.push('/toilet')
}
</script>

<style scoped>
.category-card:hover {
  transform: translateY(-2px);
}
</style>
