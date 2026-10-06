<template>
  <section class="section-flat">
    <header v-if="heading || $slots.heading || $slots.right" class="flex flex-col gap-2 md:flex-row md:justify-between md:items-end md:gap-4 mb-4 md:mb-[22px]">
      <div class="min-w-0">
        <slot name="heading">
          <!-- 페이지 h1 바로 아래 섹션이 표준 사용처 → 기본 h2로 문서 개요 위계 정합 (h1→h3 점프 방지) -->
          <h2 v-if="heading" class="ui-h2 text-strong">{{ heading }}</h2>
        </slot>
        <p v-if="subtext" class="mt-[7px] text-muted text-[13px] md:text-sm">{{ subtext }}</p>
      </div>
      <div v-if="$slots.right" class="md:shrink-0">
        <slot name="right" />
      </div>
    </header>
    <slot />
  </section>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  heading?: string
  subtext?: string
  // 흰색 평면형만 남았다(스펙 2026-10-02 §3.1). 호출부의 variant="flat" 은 명시로 남겨 둔다.
  variant?: 'flat'
}>(), {
  heading: '',
  subtext: '',
  variant: 'flat',
})
</script>
