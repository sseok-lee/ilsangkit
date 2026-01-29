<template>
  <header class="bg-white border-b border-gray-200 sticky top-0 z-50">
    <div class="container mx-auto px-4">
      <div class="h-16 flex items-center justify-between">
        <!-- Logo -->
        <NuxtLink
          to="/"
          class="text-2xl font-bold text-primary-600 hover:text-primary-700 transition-colors"
        >
          일상킷
        </NuxtLink>

        <!-- Desktop Navigation -->
        <nav class="hidden md:flex items-center gap-6">
          <NuxtLink
            to="/toilet"
            class="text-gray-700 hover:text-primary-600 transition-colors font-medium"
          >
            화장실
          </NuxtLink>
          <NuxtLink
            to="/trash"
            class="text-gray-700 hover:text-primary-600 transition-colors font-medium"
          >
            쓰레기
          </NuxtLink>
          <NuxtLink
            to="/wifi"
            class="text-gray-700 hover:text-primary-600 transition-colors font-medium"
          >
            와이파이
          </NuxtLink>
          <NuxtLink
            to="/clothes"
            class="text-gray-700 hover:text-primary-600 transition-colors font-medium"
          >
            의류수거함
          </NuxtLink>
          <NuxtLink
            to="/kiosk"
            class="text-gray-700 hover:text-primary-600 transition-colors font-medium"
          >
            무인민원발급기
          </NuxtLink>
        </nav>

        <!-- Mobile Menu Button -->
        <button
          class="md:hidden min-h-11 min-w-11 flex items-center justify-center text-gray-700 hover:text-primary-600 transition-colors"
          aria-label="메뉴 열기"
          @click="toggleMobileMenu"
        >
          <svg
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              v-if="!isMobileMenuOpen"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M4 6h16M4 12h16M4 18h16"
            />
            <path
              v-else
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Mobile Menu -->
      <div
        v-if="isMobileMenuOpen"
        data-testid="mobile-menu"
        class="md:hidden py-4 border-t border-gray-200"
      >
        <nav class="flex flex-col gap-2">
          <NuxtLink
            to="/toilet"
            class="px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors rounded-lg font-medium"
            @click="closeMobileMenu"
          >
            화장실
          </NuxtLink>
          <NuxtLink
            to="/trash"
            class="px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors rounded-lg font-medium"
            @click="closeMobileMenu"
          >
            쓰레기
          </NuxtLink>
          <NuxtLink
            to="/wifi"
            class="px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors rounded-lg font-medium"
            @click="closeMobileMenu"
          >
            와이파이
          </NuxtLink>
          <NuxtLink
            to="/clothes"
            class="px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors rounded-lg font-medium"
            @click="closeMobileMenu"
          >
            의류수거함
          </NuxtLink>
          <NuxtLink
            to="/kiosk"
            class="px-4 py-3 text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors rounded-lg font-medium"
            @click="closeMobileMenu"
          >
            무인민원발급기
          </NuxtLink>
        </nav>
      </div>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isMobileMenuOpen = ref(false)

const toggleMobileMenu = () => {
  isMobileMenuOpen.value = !isMobileMenuOpen.value
}

const closeMobileMenu = () => {
  isMobileMenuOpen.value = false
}
</script>
