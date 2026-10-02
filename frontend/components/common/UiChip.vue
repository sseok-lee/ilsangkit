<template>
  <NuxtLink
    v-if="to"
    :to="to"
    :class="classes"
    :aria-current="selected ? 'page' : undefined"
  ><slot /></NuxtLink>
  <button
    v-else
    type="button"
    :class="classes"
    :aria-pressed="selected ? 'true' : 'false'"
    @click="emit('click', $event)"
  ><slot /></button>
</template>

<script setup lang="ts">
import { computed } from 'vue'

// 칩(스펙 2026-10-02 §3.6). 지역 선택처럼 페이지를 바꾸면 to(링크, SSR 크롤 가능), 필터 토글이면 버튼.
const props = withDefaults(defineProps<{
  selected?: boolean
  to?: string
}>(), {
  selected: false,
  to: undefined,
})

const emit = defineEmits<{ click: [event: MouseEvent] }>()

const classes = computed(() => ['ui-chip', { 'ui-chip--selected': props.selected }])
</script>
