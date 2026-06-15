<template>
  <section class="p-4 md:p-5 bg-white border border-line rounded-xl shadow-card">
    <!-- Main (eyebrow/kicker + title + desc + search slot) -->
    <div>
      <span
        v-if="eyebrow"
        class="inline-flex items-center mb-3 px-2.5 py-1 rounded-full text-eyebrow"
        :style="{ color: 'var(--cat, var(--brand))', background: 'color-mix(in srgb, var(--cat, var(--brand)) 10%, white)' }"
      >
        {{ eyebrow }}
      </span>
      <!--
        title-tag 기본 'h1' (목록/허브 등 단독 제목 페이지).
        상세 페이지처럼 모바일 전용 헤더가 이미 h1을 갖는 경우엔 title-tag="div" 를 넘겨
        raw HTML 의 literal <h1> 을 1개로 유지한다(네이버 등 비렌더 파서의 중복 h1 방지).
        강등 시에도 role=heading aria-level=1 로 데스크톱 스크린리더의 최상위 제목은 보존.
      -->
      <component
        :is="titleTag"
        class="text-display-1 text-strong mb-2"
        v-bind="titleTag === 'h1' ? {} : { role: 'heading', 'aria-level': 1 }"
      >
        <slot name="title">{{ title }}</slot>
      </component>
      <p v-if="description || $slots.description" class="text-body text-muted">
        <slot name="description">{{ description }}</slot>
      </p>
      <slot name="search" />
    </div>

    <!-- Summary stats: OD 테두리 분할 그리드 (sidebar 슬롯이 있으면 기존 레이아웃 유지) -->
    <template v-if="$slots.sidebar">
      <div class="mt-4 pt-4 border-t border-line grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-8">
        <slot name="sidebar" />
      </div>
    </template>
    <div
      v-else-if="stats?.length"
      class="od-hero-stats mt-4"
      :style="{ '--od-cols': Math.min(stats.length, 4) }"
    >
      <div v-for="stat in stats" :key="stat.label" class="s">
        <div class="k">{{ stat.label }}</div>
        <div class="v break-keep" :class="stat.color">{{ stat.value }}</div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
interface Stat {
  label: string
  value: string
  color?: string
}

withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  stats?: Stat[]
  /** 제목 태그. 기본 'h1'. 모바일 헤더가 별도 h1을 갖는 상세 페이지에선 'div' 로 강등해 중복 h1 방지. */
  titleTag?: string
}>(), {
  eyebrow: '',
  title: '',
  description: '',
  stats: () => [],
  titleTag: 'h1',
})
</script>
