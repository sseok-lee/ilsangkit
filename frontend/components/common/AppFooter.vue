<template>
  <footer class="hidden md:block bg-gray-50 border-t border-gray-200 py-8">
    <div class="container mx-auto px-4">
      <!-- Footer Links -->
      <div class="mb-6 flex flex-wrap justify-center gap-4" data-testid="footer-links">
        <nav class="contents" aria-label="푸터 네비게이션">
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
        <p class="text-xs text-gray-400 mt-1">
          <a
            href="https://www.data.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="새 창에서 공공데이터포털 열기"
            class="hover:text-gray-500 transition-colors"
          >공공데이터포털(data.go.kr)</a> 제공 공공데이터 활용 | 공공누리 제1유형
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>
