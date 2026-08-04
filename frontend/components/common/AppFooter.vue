<template>
  <footer :class="['bg-background-light border-t border-line-2', props.compact ? 'py-5' : 'py-6 md:py-10']">
    <div :class="props.compact ? 'px-4' : 'container mx-auto px-4'">
      <!-- 기본 4열 / compact 1열 (사이드바 320px 폭에 4열은 들어가지 않는다) -->
      <div :class="['grid gap-8', props.compact ? 'grid-cols-1 mb-5' : 'grid-cols-2 md:grid-cols-4 mb-8 max-w-4xl mx-auto']">
        <!-- 브랜드 -->
        <div class="col-span-2 md:col-span-1">
          <HardLink to="/" class="text-base font-semibold text-strong hover:text-primary transition-colors">
            일상킷
          </HardLink>
          <p class="mt-2 text-xs text-muted leading-relaxed">
            {{ SITE_TAGLINE }}
          </p>
          <div class="mt-3 space-y-1 text-xs text-faint">
            <p>
              운영 <span class="font-semibold text-muted">일상킷 팀</span> · 문의
              <a href="mailto:contact@ilsangkit.co.kr" class="text-primary hover:underline">contact@ilsangkit.co.kr</a>
            </p>
            <p>
              <HardLink to="/contact#data-fix" class="font-semibold text-primary hover:underline">정보 수정 요청</HardLink>
              — 확인 후 3~5일 내 반영
            </p>
            <p v-if="latestSyncLabel">
              데이터 최종 동기화 <span class="tabular-nums">{{ latestSyncLabel }}</span>
            </p>
          </div>
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
          본 서비스의 정보는 공공데이터포털(data.go.kr)·국토교통부 실거래가 공개시스템 자료를 가공한 참고용 정보입니다.
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
import { useSyncStatus } from '~/composables/useSyncStatus'
import { formatDotDateTime, isSyncStale, RE_STALE_DAYS } from '~/utils/syncFreshness'

/**
 * 좁은 컨테이너(지도 사이드바 320px)용 1열 렌더.
 * 링크·문구는 바꾸지 않는다 — 다른 페이지 푸터와 내용이 같아야 한다.
 */
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const currentYear = computed(() => new Date().getFullYear())

const { latestOverall } = useSyncStatus()
// 전체 max는 daily sync(부동산)가 지배하므로 stale 기준 2일 — 파이프라인이 죽으면 행 자체를 숨긴다
const latestSyncLabel = computed(() => {
  const iso = latestOverall.value
  if (!iso || isSyncStale(iso, RE_STALE_DAYS)) return null
  return formatDotDateTime(iso)
})
</script>
