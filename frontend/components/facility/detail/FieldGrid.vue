<template>
  <div class="grid gap-3" :class="colsClass">
    <template v-for="(item, i) in items" :key="`${item.label}-${i}`">
      <div
        v-if="alwaysShow || hasValue(item.value)"
        class="bg-slate-50 rounded-lg text-center"
        :class="variant === 'prominent' ? 'p-3' : 'py-2.5 px-2 flex flex-col items-center justify-center'"
      >
        <p class="text-xs text-gray-600" :class="variant === 'prominent' ? 'mb-1' : ''">{{ item.label }}</p>
        <p v-if="hasValue(item.value)" class="font-bold text-slate-900 tabular-nums" :class="variant === 'prominent' ? 'text-lg' : 'text-sm'">
          {{ item.value }}<span v-if="item.unit" class="text-xs font-normal text-gray-600">{{ item.unit }}</span>
        </p>
        <p v-else class="text-sm text-slate-500">{{ EMPTY_FIELD_TEXT }}</p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { EMPTY_FIELD_TEXT } from '~/utils/emptyField'

export interface FieldGridItem { label: string; value: string | number | null | undefined; unit?: string }

const props = withDefaults(defineProps<{
  items: FieldGridItem[]
  cols?: 2 | 3
  variant?: 'prominent' | 'compact'
  alwaysShow?: boolean
}>(), { cols: 2, variant: 'prominent', alwaysShow: false })

const colsClass = computed(() => (props.cols === 3 ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-2'))
function hasValue(v: unknown): boolean { return v !== null && v !== undefined && v !== '' }
</script>
