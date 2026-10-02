<template>
  <div v-if="isLinkMode" class="ui-segmented" :class="{ 'ui-segmented--fill': fill }" role="group" :aria-label="ariaLabel">
    <NuxtLink
      v-for="item in items"
      :key="item.value"
      :to="item.to as string"
      class="ui-segmented__item"
      :class="{ 'ui-segmented__item--selected': item.value === modelValue }"
      :aria-current="item.value === modelValue ? 'page' : undefined"
    >{{ item.label }}</NuxtLink>
  </div>
  <div v-else class="ui-segmented" :class="{ 'ui-segmented--fill': fill }" role="radiogroup" :aria-label="ariaLabel" @keydown="onKeydown">
    <button
      v-for="(item, index) in items"
      :key="item.value"
      ref="buttons"
      type="button"
      role="radio"
      class="ui-segmented__item"
      :class="{ 'ui-segmented__item--selected': item.value === modelValue }"
      :aria-checked="item.value === modelValue ? 'true' : 'false'"
      :tabindex="index === tabStopIndex ? 0 : -1"
      @click="select(item.value)"
    >{{ item.label }}</button>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

// 세그먼트(스펙 2026-10-02 §3.6, D5). 페이지 이동형(부동산 유형 전환)은 링크 모드로 SSR 링크를 유지한다.
export interface SegmentedItem {
  value: string
  label: string
  to?: string
}

const props = withDefaults(defineProps<{
  items: SegmentedItem[]
  modelValue?: string
  ariaLabel: string
  fill?: boolean
}>(), {
  modelValue: undefined,
  fill: false,
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const buttons = ref<HTMLButtonElement[]>([])

if (import.meta.dev) {
  const withTo = props.items.filter((item) => !!item.to).length
  if (withTo > 0 && withTo < props.items.length) {
    console.warn('SegmentedControl: items 의 to 가 일부만 지정됨 — 라디오 모드로 렌더')
  }
}

const isLinkMode = computed(() => props.items.length > 0 && props.items.every((item) => !!item.to))

const selectedIndex = computed(() => props.items.findIndex((item) => item.value === props.modelValue))
const tabStopIndex = computed(() => (selectedIndex.value >= 0 ? selectedIndex.value : 0))

function select(value: string) {
  emit('update:modelValue', value)
}

function onKeydown(event: KeyboardEvent) {
  const step = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1
    : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1
      : 0
  if (step === 0 || props.items.length === 0) return
  event.preventDefault()
  const count = props.items.length
  const next = (tabStopIndex.value + step + count) % count
  select(props.items[next].value)
  buttons.value[next]?.focus()
}
</script>
