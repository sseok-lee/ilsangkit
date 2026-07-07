<template>
  <footer class="bg-background-light border-t border-line-2 py-6 md:py-10">
    <div class="container mx-auto px-4">
      <!-- 4-column grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8 max-w-4xl mx-auto">
        <!-- 브랜드 -->
        <div class="col-span-2 md:col-span-1">
          <HardLink to="/" class="text-base font-semibold text-strong hover:text-primary transition-colors">
            일상킷
          </HardLink>
          <p class="mt-2 text-xs text-muted leading-relaxed">
            {{ SITE_TAGLINE }}
          </p>
        </div>

        <!-- 서비스 -->
        <div>
          <p class="text-xs font-semibold text-faint uppercase tracking-wider mb-3">서비스</p>
          <nav aria-label="서비스 링크" data-testid="footer-links" class="flex flex-col gap-2">
            <HardLink to="/real-estate" class="text-sm text-muted hover:text-primary transition-colors">부동산</HardLink>
            <HardLink to="/subscription" class="text-sm text-muted hover:text-primary transition-colors">청약</HardLink>
            <HardLink to="/search" class="text-sm text-muted hover:text-primary transition-colors">생활시설</HardLink>
          </nav>
        </div>

        <!-- 정보 · 지원 -->
        <div>
          <p class="text-xs font-semibold text-faint uppercase tracking-wider mb-3">정보 · 지원</p>
          <nav aria-label="정보 및 지원 링크" class="flex flex-col gap-2">
            <HardLink to="/about" class="text-sm text-muted hover:text-primary transition-colors">소개</HardLink>
            <HardLink to="/faq" class="text-sm text-muted hover:text-primary transition-colors">자주 묻는 질문</HardLink>
            <HardLink to="/contact" class="text-sm text-muted hover:text-primary transition-colors">문의</HardLink>
          </nav>
        </div>

        <!-- 법적 고지 -->
        <div>
          <p class="text-xs font-semibold text-faint uppercase tracking-wider mb-3">법적 고지</p>
          <nav aria-label="법적 고지 링크" class="flex flex-col gap-2">
            <HardLink to="/privacy" class="text-sm text-muted hover:text-primary transition-colors">개인정보처리방침</HardLink>
            <HardLink to="/terms" class="text-sm text-muted hover:text-primary transition-colors">이용약관</HardLink>
          </nav>
        </div>
      </div>

      <!-- 하단 바 -->
      <div class="border-t border-line-2 pt-6 space-y-1 text-center">
        <p class="text-xs text-muted">
          © {{ currentYear }} 일상킷. All rights reserved.
        </p>
        <p class="text-xs text-faint">
          <a
            href="https://www.data.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="새 창에서 공공데이터포털 열기"
            class="hover:text-muted transition-colors"
          >공공데이터포털(data.go.kr)</a> 및 <a
            href="https://rt.molit.go.kr"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="새 창에서 국토교통부 실거래가 공개시스템 열기"
            class="hover:text-muted transition-colors"
          >국토교통부 실거래가 공개시스템</a> 자료를 공공누리(KOGL) 조건에 따라 이용합니다 · 데이터셋별 출처는 각 상세페이지 참조
        </p>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { SITE_TAGLINE } from '~/utils/seoConstants'

const currentYear = computed(() => new Date().getFullYear())
</script>
