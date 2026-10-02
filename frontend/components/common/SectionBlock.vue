<template>
  <section :class="sectionClass">
    <header v-if="heading || $slots.heading || $slots.right" :class="headerClass">
      <div class="min-w-0">
        <slot name="heading">
          <!-- 페이지 h1 바로 아래 섹션이 표준 사용처 → 기본 h2로 문서 개요 위계 정합 (h1→h3 점프 방지) -->
          <h2 v-if="heading" :class="variant === 'flat' ? 'ui-h2 text-strong' : 'text-display-2 text-strong'">{{ heading }}</h2>
        </slot>
        <p v-if="subtext" :class="variant === 'flat' ? 'mt-[7px] text-muted text-[13px] md:text-sm' : 'mt-1 text-faint text-xs md:text-sm'">{{ subtext }}</p>
      </div>
      <div v-if="$slots.right" class="md:shrink-0">
        <slot name="right" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  heading?: string
  subtext?: string
  // 정보 위계에 따른 패딩 variant (shape 브리프: "Hero는 넓게, FAQ는 좁게") — card 전용
  size?: 'hero' | 'default' | 'compact'
  // 흰색 평면형(스펙 2026-10-02 §3.1). 기본 card 는 PR7 에서 flat 으로 바꾼다.
  variant?: 'card' | 'flat'
}>(), {
  heading: '',
  subtext: '',
  size: 'default',
  variant: 'card',
})

const paddingClass = computed(() => {
  if (props.size === 'hero') return 'p-5 md:p-6'
  if (props.size === 'compact') return 'p-3 md:p-4'
  return 'p-4 md:p-5'
})

const sectionClass = computed(() =>
  props.variant === 'flat'
    ? 'section-flat'
    : ['bg-white border border-line rounded-xl shadow-card', paddingClass.value],
)

const headerClass = computed(() =>
  props.variant === 'flat'
    ? 'flex flex-col gap-2 md:flex-row md:justify-between md:items-end md:gap-4 mb-4 md:mb-[22px]'
    : 'flex flex-col gap-2 md:flex-row md:justify-between md:items-end md:gap-4 mb-3',
)
</script>
