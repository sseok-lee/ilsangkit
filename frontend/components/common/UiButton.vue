<template>
  <NuxtLink v-if="to" :to="to" :class="classes"><slot /></NuxtLink>
  <a
    v-else-if="href"
    :href="href"
    :class="classes"
    :target="external ? '_blank' : undefined"
    :rel="external ? 'noopener noreferrer' : undefined"
  ><slot /></a>
  <button v-else :type="type" :class="classes" :disabled="disabled"><slot /></button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 버튼 3종(스펙 2026-10-02 §3.6). 기존 .btn-primary 등은 PR7 에서 이 컴포넌트로 옮긴 뒤 정리한다.
const props = withDefaults(defineProps<{
  variant?: 'primary' | 'secondary' | 'link'
  to?: string
  href?: string
  external?: boolean
  type?: 'button' | 'submit'
  disabled?: boolean
}>(), {
  variant: 'primary',
  to: undefined,
  href: undefined,
  external: false,
  type: 'button',
  disabled: false,
})

const classes = computed(() => ['ui-btn', `ui-btn--${props.variant}`])
</script>
