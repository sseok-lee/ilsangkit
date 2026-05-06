<template>
  <SectionBlock heading="단지 정보" subtext="LH 마이홈 포털에서 제공하는 단지 기본 제원입니다.">
    <dl class="grid grid-cols-2 md:grid-cols-4 gap-3">
      <div v-for="spec in specs" :key="spec.label" class="rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-3">
        <dt class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{{ spec.label }}</dt>
        <dd :class="['mt-1 text-sm md:text-base font-bold break-keep', spec.value === NO_DATA ? 'text-slate-400' : 'text-slate-900']">
          {{ spec.value }}
        </dd>
      </div>
    </dl>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import SectionBlock from '~/components/common/SectionBlock.vue'
import {
  fmtArea,
  fmtCount,
  fmtCompletionDate,
  fmtText,
  NO_DATA,
} from '~/utils/publicRentalMeta'

const props = defineProps<{
  rental: PublicRentalComplex
}>()

const specs = computed(() => [
  { label: '전용면적', value: fmtArea(props.rental.exclusiveArea) },
  { label: '공용면적', value: fmtArea(props.rental.commonArea ?? null) },
  { label: '세대수', value: fmtCount(props.rental.householdCount, '세대') },
  { label: '주차대수', value: fmtCount(props.rental.parkingCount ?? null, '대') },
  { label: '난방방식', value: fmtText(props.rental.heatingMethod ?? null) },
  { label: '승강기', value: fmtText(props.rental.hasElevator ?? null) },
  { label: '건물형태', value: fmtText(props.rental.buildingStyle ?? null) },
  { label: '준공일', value: fmtCompletionDate(props.rental.completionDate ?? null) },
])
</script>
