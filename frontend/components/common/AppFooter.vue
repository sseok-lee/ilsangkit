<template>
  <footer class="bg-slate-50 border-t border-slate-200 py-6 md:py-8">
    <div class="container mx-auto px-4">
      <div class="mb-4 md:mb-6 flex flex-wrap justify-center gap-2 md:gap-4" data-testid="footer-links">
        <nav class="contents" aria-label="푸터 하단 네비게이션">
          <NuxtLink
            to="/about"
            class="text-slate-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            소개
          </NuxtLink>
          <NuxtLink
            to="/privacy"
            class="text-slate-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            개인정보처리방침
          </NuxtLink>
          <NuxtLink
            to="/terms"
            class="text-slate-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            이용약관
          </NuxtLink>
          <NuxtLink
            to="/faq"
            class="text-slate-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            자주 묻는 질문
          </NuxtLink>
          <NuxtLink
            to="/contact"
            class="text-slate-600 hover:text-primary-600 transition-colors text-xs md:text-sm min-h-11 flex items-center px-2"
          >
            문의
          </NuxtLink>
        </nav>
      </div>

      <!-- Copyright -->
      <div class="text-center">
        <p class="text-xs md:text-sm text-slate-600">
          © {{ currentYear }} 일상킷. All rights reserved.
        </p>
        <p class="text-xs text-slate-500 mt-1">
          <a
            href="https://www.data.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="새 창에서 공공데이터포털 열기"
            class="hover:text-slate-500 transition-colors"
          >공공데이터포털(data.go.kr)</a> 및 <a
            href="https://rt.molit.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="새 창에서 국토교통부 실거래가 공개시스템 열기"
            class="hover:text-slate-500 transition-colors"
          >국토교통부 실거래가 공개시스템</a> 자료를 공공누리(KOGL) 조건에 따라 이용합니다 · 데이터셋별 출처는 각 상세페이지 참조
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const currentYear = computed(() => new Date().getFullYear())
</script>
