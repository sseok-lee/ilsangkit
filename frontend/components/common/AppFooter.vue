<template>
  <footer
    :class="['bg-background-light border-t border-line', props.compact ? 'footer-compact py-5' : 'py-6 md:py-10']"
    :role="props.compact ? 'contentinfo' : undefined"
  >
    <div :class="props.compact ? 'px-4' : 'page-container'">
      <div :class="['mb-6 flex gap-x-4 gap-y-2', props.compact ? 'flex-col' : 'flex-col md:flex-row md:items-start']">
        <HardLink to="/" class="footer-link shrink-0 font-bold tracking-tight text-strong">
          <span class="text-2xl">일상킷<span aria-hidden="true" class="text-primary">.</span></span>
        </HardLink>
        <div class="min-w-0 pt-1.5 text-xs leading-relaxed text-muted">
          <p>{{ SITE_BRAND_LINE }}</p>
          <p v-if="latestSyncLabel" class="mt-1 text-faint">
            데이터 최종 동기화 <span class="tabular-nums">{{ latestSyncLabel }}</span>
          </p>
        </div>
      </div>
      <div
        ref="wideNavigation"
        data-testid="footer-wide-navigation"
        :class="['gap-6 pb-6', props.compact ? 'grid grid-cols-1' : 'hidden md:grid md:grid-cols-4']"
        @focusout="repairHiddenFocus"
      >
        <section v-for="group in FOOTER_GROUPS" :key="group.id" :data-footer-group="group.id" class="min-w-0">
          <h2 class="mb-2 text-sm font-semibold text-strong">
            <HardLink v-if="group.titleTo" :to="group.titleTo" class="footer-link">{{ group.label }}</HardLink>
            <span v-else class="flex min-h-11 items-center md:min-h-8">{{ group.label }}</span>
          </h2>
          <nav :aria-label="`${group.label} 링크`" :data-testid="`footer-${group.id}-links`" class="flex flex-col">
            <HardLink v-for="link in group.links" :key="link.to" :to="link.to" class="footer-link" :class="link.all ? 'text-primary' : 'text-muted'">{{ link.label }}</HardLink>
          </nav>
        </section>
      </div>
      <div v-if="!props.compact" ref="mobileNavigation" data-testid="footer-mobile-navigation" class="md:hidden" @focusout="repairHiddenFocus">
        <details v-for="(group, index) in FOOTER_GROUPS" :key="group.id" :data-footer-group="group.id" :open="index === 0" class="footer-disclosure border-b border-line first:border-t">
          <summary class="flex min-h-[52px] items-center justify-between gap-3 text-sm font-semibold text-strong">
            {{ group.label }}<span class="footer-disclosure-symbol" aria-hidden="true" />
          </summary>
          <nav :aria-label="`${group.label} 링크`" :data-testid="`footer-mobile-${group.id}-links`" class="grid grid-cols-2 gap-x-4 pb-3">
            <HardLink v-for="link in group.links" :key="link.to" :to="link.to" class="footer-link" :class="link.all ? 'col-span-2 text-primary' : 'text-muted'">{{ link.label }}</HardLink>
          </nav>
        </details>
      </div>
      <div data-testid="footer-meta" class="mt-5 border-t border-line pt-5 text-xs text-muted">
        <div class="mb-3 flex flex-col md:flex-row md:items-center md:justify-between" :class="{ 'footer-meta-compact': props.compact }">
          <nav aria-label="약관과 개인정보" class="flex flex-wrap items-center gap-x-3">
            <HardLink to="/privacy" class="footer-link font-semibold text-strong">개인정보처리방침</HardLink>
            <span aria-hidden="true">·</span>
            <HardLink to="/terms" class="footer-link">이용약관</HardLink>
          </nav>
          <a href="mailto:contact@ilsangkit.co.kr" class="footer-link break-all">contact@ilsangkit.co.kr</a>
        </div>
        <p class="flex flex-wrap items-center gap-x-2">
          <span>데이터 출처</span>
          <span aria-hidden="true">·</span>
          <a href="https://www.data.go.kr" target="_blank" rel="noopener noreferrer" aria-label="새 창에서 공공데이터포털 열기" class="footer-link underline underline-offset-4">공공데이터포털</a>
          <span aria-hidden="true">·</span>
          <a href="https://rt.molit.go.kr" target="_blank" rel="noopener noreferrer" aria-label="새 창에서 국토교통부 실거래가 공개시스템 열기" class="footer-link underline underline-offset-4">국토교통부 실거래가</a>
        </p>
        <p class="mt-1 leading-relaxed">공공데이터를 가공한 참고용 정보입니다. 데이터셋별 출처와 이용 조건은 각 상세페이지를 확인해 주세요.</p>
        <div class="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-2">
          <span>© {{ currentYear }} 일상킷</span><span>운영 · 일상킷 팀</span>
        </div>
      </div>
    </div>
  </footer>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import HardLink from '~/components/common/HardLink.vue'
import { SITE_BRAND_LINE } from '~/utils/seoConstants'
import { useSyncStatus } from '~/composables/useSyncStatus'
import { formatDotDateTime, isSyncStale, RE_STALE_DAYS } from '~/utils/syncFreshness'

// 좁은 컨테이너의 기존 호출 계약을 유지한다. 지도에는 새 사용처를 추가하지 않는다.
const props = withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

type FooterLink = { label: string; to: string; all?: boolean }
type FooterGroup = {
  id: 'real-estate' | 'subscription' | 'facilities' | 'support'
  label: string
  titleTo?: string
  links: readonly FooterLink[]
}
const FOOTER_GROUPS: readonly FooterGroup[] = [
  { id: 'real-estate', label: '부동산 실거래가', titleTo: '/real-estate', links: [
    { label: '아파트', to: '/real-estate/apt-sale' },
    { label: '빌라', to: '/real-estate/villa-sale' },
    { label: '오피스텔', to: '/real-estate/offitel-sale' },
    { label: '지도로 찾기', to: '/real-estate' },
  ] },
  { id: 'subscription', label: '청약·임대', titleTo: '/subscription', links: [
    { label: '청약 전체 보기', to: '/subscription' },
    { label: '아파트 청약', to: '/subscription/sale/apt' },
    { label: '공공임대주택', to: '/subscription/rent/public' },
  ] },
  { id: 'facilities', label: '생활시설', titleTo: '/search', links: [
    { label: '병원', to: '/hospital' }, { label: '약국', to: '/pharmacy' },
    { label: '학교', to: '/school' }, { label: '어린이집', to: '/childcare' },
    { label: '전체 시설 보기', to: '/search', all: true },
  ] },
  { id: 'support', label: '일상킷 안내', links: [
    { label: '서비스 소개', to: '/about' }, { label: '생활 가이드', to: '/guide' },
    { label: '자주 묻는 질문', to: '/faq' }, { label: '문의하기', to: '/contact' },
    { label: '정보 수정 요청', to: '/contact#data-fix' },
  ] },
]

const currentYear = computed(() => new Date().getFullYear())

const { latestOverall } = useSyncStatus()
// 전체 max는 daily sync(부동산)가 지배하므로 stale 기준 2일 — 파이프라인이 죽으면 행 자체를 숨긴다
const latestSyncLabel = computed(() => {
  const iso = latestOverall.value
  if (!iso || isSyncStale(iso, RE_STALE_DAYS)) return null
  return formatDotDateTime(iso)
})

const wideNavigation = ref<HTMLElement | null>(null)
const mobileNavigation = ref<HTMLElement | null>(null)
let widthQuery: MediaQueryList | null = null

function repairNavigationFocus(event: Pick<MediaQueryListEvent, 'matches'>, previous?: HTMLElement) {
  if (!import.meta.client || props.compact) return
  const from = event.matches ? mobileNavigation.value : wideNavigation.value
  const to = event.matches ? wideNavigation.value : mobileNavigation.value
  const active = previous ?? document.activeElement
  if (!(active instanceof HTMLElement) || !from?.contains(active) || !to) return
  const groupId = active.closest('[data-footer-group]')?.getAttribute('data-footer-group')
  const group = Array.from(to.querySelectorAll<HTMLElement>('[data-footer-group]'))
    .find(element => element.dataset.footerGroup === groupId)
  if (!group) return
  const href = active.closest('a')?.getAttribute('href')
  const sameLink = Array.from(group.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .find(link => link.getAttribute('href') === href)
  const target = event.matches
    ? sameLink ?? group.querySelector<HTMLAnchorElement>('a[href]')
    : (group as HTMLDetailsElement).open && sameLink
      ? sameLink
      : group.querySelector<HTMLElement>('summary')
  target?.focus()
}

function repairHiddenFocus(event: FocusEvent) {
  if (!import.meta.client || props.compact || !widthQuery) return
  const previous = event.target
  // CSS can hide a focused link before matchMedia's change callback runs.
  // Only repair that blur; ordinary clicks/Tab navigation keep their destination.
  if (!(previous instanceof HTMLElement) || !previous.isConnected
    || event.relatedTarget || previous.getClientRects().length > 0) return
  repairNavigationFocus({ matches: widthQuery.matches }, previous)
}
onMounted(() => {
  if (!import.meta.client || props.compact) return
  widthQuery = window.matchMedia('(min-width: 768px)')
  widthQuery.addEventListener('change', repairNavigationFocus)
})
onBeforeUnmount(() => {
  if (!import.meta.client) return
  widthQuery?.removeEventListener('change', repairNavigationFocus)
})
</script>

<style scoped>
.footer-link { display: flex; align-items: center; min-height: 44px; font-size: 13px; overflow-wrap: anywhere; }
.footer-link:hover { text-decoration: underline; text-underline-offset: 4px; }
.footer-link:focus-visible, summary:focus-visible { outline: 2px solid rgb(var(--brand-rgb)); outline-offset: 3px; }
.footer-disclosure > summary { list-style: none; cursor: pointer; }
.footer-disclosure > summary::-webkit-details-marker { display: none; }
.footer-disclosure-symbol::before { content: '+'; }
.footer-disclosure[open] > summary .footer-disclosure-symbol::before { content: '−'; }
.footer-meta-compact { flex-direction: column; align-items: flex-start; }
@media (max-width: 767px) {
  footer:not(.footer-compact) [data-testid="footer-meta"] { border-top: 0; margin-top: 0; }
}
@media (min-width: 768px) {
  footer:not(.footer-compact) .footer-link { min-height: 34px; }
}
</style>
