<!-- frontend/components/facility/detail/DetailSpecGrid.vue -->
<template>
  <SectionBlock :heading="heading" size="default">
    <div class="flex flex-col gap-3">
      <template v-for="(group, gi) in visibleGroups" :key="gi">
        <div v-if="gi > 0" class="h-px bg-slate-100 w-full"></div>
        <div>
          <p v-if="group.heading" class="text-xs font-bold text-gray-500 mb-2">{{ group.heading }}</p>

          <table v-if="group.render === 'table' && group.table" class="w-full text-sm">
            <thead>
              <tr>
                <th
                  v-for="(col, ci) in group.table.columns"
                  :key="ci"
                  class="py-1.5 text-xs font-medium text-gray-500"
                  :class="ci === 0 ? 'text-left' : 'text-center'"
                >{{ col }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, ri) in group.table.rows" :key="ri" class="border-t border-slate-100">
                <td class="py-2 text-gray-600">{{ row.label }}</td>
                <td v-for="(cell, ci) in row.cells" :key="ci" class="py-2 text-center font-bold text-slate-900">
                  {{ cell == null ? '—' : cell }}
                </td>
              </tr>
            </tbody>
          </table>

          <div v-else class="flex flex-col gap-3">
            <template v-for="(row, ri) in group.rows" :key="ri">
              <div v-if="!(row.kind === 'flag' && !hasValue(row.value))" class="flex items-center justify-between">
                <span class="text-sm text-gray-600">{{ row.label }}</span>
                <span v-if="hasValue(row.value)" class="text-sm font-medium" :class="row.kind === 'flag' ? 'text-emerald-600' : 'text-slate-900'">
                  {{ row.value }}<span v-if="row.unit" class="text-xs font-normal text-gray-600">{{ row.unit }}</span>
                </span>
                <span v-else class="text-sm text-slate-400">정보 없음</span>
              </div>
            </template>
          </div>
        </div>
      </template>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SpecGroup } from '~/utils/facilitySpecGroups'

const props = withDefaults(defineProps<{ groups: SpecGroup[]; heading?: string }>(), {
  heading: '상세 정보',
})

function hasValue(v: unknown): boolean {
  return v !== null && v !== undefined && v !== ''
}

// flag-only 그룹이 전부 비면 그룹 자체를 숨긴다(빈 헤더 방지)
const visibleGroups = computed(() =>
  props.groups.filter((g) => {
    if (g.render === 'table') return (g.table?.rows.length ?? 0) > 0
    return (g.rows ?? []).some((r) => r.kind !== 'flag' || hasValue(r.value))
  }),
)
</script>
