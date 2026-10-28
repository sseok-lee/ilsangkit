<template>
  <SectionBlock variant="flat" heading="단지 정보" :subtext="subtext">
    <div class="grid gap-5 md:grid-cols-2 md:gap-8">
      <dl v-if="rows.length > 0" class="text-[13px] md:text-sm" data-testid="complex-info-rows">
        <div
          v-for="row in rows"
          :key="row.label"
          class="flex gap-3 py-2 border-b border-line last:border-b-0"
        >
          <dt class="w-[38%] shrink-0 text-muted">{{ row.label }}</dt>
          <dd class="min-w-0 font-semibold text-strong break-keep">{{ row.value }}</dd>
        </div>
      </dl>

      <div v-if="areaGroups.length > 0" data-testid="complex-info-areas">
        <h3 class="mb-2 text-[13px] md:text-sm font-bold text-strong">면적별 세대수 (전용)</h3>
        <ul class="space-y-1.5">
          <li
            v-for="group in areaGroups"
            :key="group.label"
            class="grid grid-cols-[72px_1fr_48px] items-center gap-2 text-[12px] md:text-[13px]"
          >
            <span class="text-strong tabular-nums">{{ group.label }}</span>
            <span class="h-2 rounded bg-surface-2 overflow-hidden" aria-hidden="true">
              <span class="block h-full rounded bg-primary" :style="{ width: `${Math.max(group.ratio * 100, 2)}%` }" />
            </span>
            <span class="text-right text-muted tabular-nums">{{ group.householdCount.toLocaleString('ko-KR') }}세대</span>
          </li>
        </ul>
      </div>
    </div>

    <p class="mt-4 text-[12px] text-faint">
      출처: 국토교통부 K-apt 공동주택관리정보시스템 · 관리비 공개 의무단지만 제공
    </p>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { ComplexInfo } from '~/types/housingRedesign'
import { buildComplexInfoRows, groupComplexAreas } from '~/utils/complexInfo'

const props = defineProps<{
  complex: ComplexInfo
}>()

const subtext = computed(() => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(props.complex.sourceDate ?? '')
  return m ? `K-apt 공동주택관리정보 · ${m[1]}.${m[2]}.${m[3]}. 기준` : 'K-apt 공동주택관리정보'
})
const rows = computed(() => buildComplexInfoRows(props.complex, new Date()))
const areaGroups = computed(() => groupComplexAreas(props.complex.areas))
</script>
