<template>
  <SectionBlock variant="flat" :heading="registerSectionTitle(register)" :subtext="subtext">
    <dl v-if="rows.length > 0" class="text-[13px] md:text-sm md:max-w-[50%]" data-testid="register-info-rows">
      <div
        v-for="row in rows"
        :key="row.label"
        class="flex gap-3 py-2 border-b border-line last:border-b-0"
      >
        <dt class="w-[38%] shrink-0 text-muted">{{ row.label }}</dt>
        <dd class="min-w-0 font-semibold text-strong break-keep">{{ row.value }}</dd>
      </div>
    </dl>

    <p class="mt-4 text-[12px] text-faint">
      출처: 국토교통부 건축물대장(건축HUB) · 세대수는 대장 기재 기준<template v-if="unitNote"> · {{ unitNote }}</template>
    </p>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import type { BuildingRegisterInfo } from '~/types/housingRedesign'
import { buildRegisterInfoRows, formatRegisterMonth, registerSectionTitle } from '~/utils/buildingRegister'

const props = defineProps<{
  register: BuildingRegisterInfo
}>()

const subtext = computed(() => {
  const month = formatRegisterMonth(props.register.sourceMonth)
  return month ? `건축물대장 · ${month} 기준` : '건축물대장'
})
const rows = computed(() => buildRegisterInfoRows(props.register, new Date()))
const unitNote = computed(() => {
  if (props.register.kind !== 'offitel' || props.register.offitelUnitCount == null) return null
  const month = formatRegisterMonth(props.register.unitSourceMonth)
  return `오피스텔 호수는 호별 용도 기준(상가 제외)${month ? `, ${month} 기준` : ''}`
})
</script>
