<template>
  <footer class="bg-gray-50 border-t border-gray-200 py-8">
    <div class="container mx-auto px-4">
      <!-- Footer Links -->
      <div class="mb-6 flex flex-wrap justify-center gap-4" data-testid="footer-links">
        <nav class="contents">
          <NuxtLink
            to="/about"
            class="text-gray-600 hover:text-primary-600 transition-colors text-sm min-h-11 flex items-center px-2"
          >
            소개
          </NuxtLink>
          <NuxtLink
            to="/privacy"
            class="text-gray-600 hover:text-primary-600 transition-colors text-sm min-h-11 flex items-center px-2"
          >
            개인정보처리방침
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-gray-600 hover:text-primary-600 transition-colors text-sm min-h-11 flex items-center px-2"
          >
            이용약관
          </NuxtLink>
          <NuxtLink
            to="/contact"
            class="text-gray-600 hover:text-primary-600 transition-colors text-sm min-h-11 flex items-center px-2"
          >
            문의
          </NuxtLink>
        </nav>
      </div>

      <!-- Copyright -->
      <div class="text-center">
        <p class="text-sm text-gray-600">
          © {{ currentYear }} 일상킷. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>
