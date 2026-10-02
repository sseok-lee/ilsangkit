<template>
  <div class="page-head">
    <slot name="breadcrumb" />
    <div class="page-head__row">
      <div class="min-w-0">
        <p v-if="eyebrow" class="page-head__eyebrow" data-testid="page-head-eyebrow">{{ eyebrow }}</p>
        <!--
          title-tag 기본 'h1'. 모바일 전용 헤더가 이미 h1 을 갖는 상세 페이지는 'div' 로 강등해
          raw HTML 의 literal <h1> 을 1개로 유지한다(PageHero 와 같은 규칙).
        -->
        <component
          :is="titleTag"
          class="ui-h1 text-strong"
          v-bind="titleTag === 'h1' ? {} : { role: 'heading', 'aria-level': 1 }"
        >
          <slot name="title">{{ title }}</slot>
        </component>
        <p v-if="description || $slots.description" class="page-head__desc">
          <slot name="description">{{ description }}</slot>
        </p>
      </div>
      <div v-if="$slots.actions" class="page-head__actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 흰색 평면형 페이지 머리(스펙 2026-10-02 §3.4). 목록 페이지에는 요약 줄을 두지 않는다(D6) —
// 상세 페이지는 이 컴포넌트 아래에 SummaryRow 를 따로 둔다.
withDefaults(defineProps<{
  eyebrow?: string
  title?: string
  description?: string
  titleTag?: string
}>(), {
  eyebrow: '',
  title: '',
  description: '',
  titleTag: 'h1',
})
</script>
