<template>
  <div class="container py-16">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl lg:text-5xl font-bold text-gray-900 mb-4">
        내 주변 생활 편의 정보, 한 번에 찾기
      </h1>
      <p class="text-lg text-gray-600 mb-8">
        공공화장실, 쓰레기 배출, 무료 와이파이 정보를 통합 검색합니다
      </p>

      <!-- Category chips for demonstration -->
      <div class="flex flex-wrap justify-center gap-3 mt-12">
        <button
          v-for="category in categories"
          :key="category.id"
          class="px-6 py-3 bg-gray-100 hover:bg-primary-500 hover:text-white text-gray-700 rounded-full font-medium transition-all duration-200"
        >
          {{ category.icon }} {{ category.name }}
        </button>
      </div>

      <!-- Demo card to showcase Tailwind styles -->
      <div class="mt-16 max-w-md mx-auto">
        <div class="card-base cursor-pointer">
          <div class="flex items-start gap-3">
            <span class="text-2xl">🚻</span>
            <div class="flex-1 text-left">
              <h3 class="font-semibold text-gray-900">강남역 공중화장실</h3>
              <p class="text-sm text-gray-500 mt-1">서울시 강남구 강남대로 396</p>
              <p class="text-xs text-gray-400 mt-1">24시간 운영</p>
            </div>
            <span class="text-sm text-primary-500 font-medium">120m</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const categories = [
  { id: 'toilet', name: '화장실', icon: '🚻' },
  { id: 'trash', name: '쓰레기', icon: '🗑️' },
  { id: 'wifi', name: '와이파이', icon: '📶' },
  { id: 'clothes', name: '의류수거함', icon: '👕' },
  { id: 'battery', name: '폐배터리', icon: '🔋' },
  { id: 'kiosk', name: '무인민원', icon: '🏧' },
]
</script>
