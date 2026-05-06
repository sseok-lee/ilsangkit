<template>
  <SectionBlock heading="자격 요건과 신청 절차" subtext="공공임대 신청 전 반드시 확인해야 할 자격과 단계별 신청 절차입니다.">
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div>
        <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px] text-blue-600">verified_user</span>
          기본 자격 요건
        </h4>
        <dl class="space-y-2.5">
          <div v-for="req in eligibility" :key="req.label" class="rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
            <dt class="text-xs font-bold text-slate-500">{{ req.label }}</dt>
            <dd class="mt-0.5 text-sm text-slate-800 break-keep">{{ req.detail }}</dd>
          </div>
        </dl>
      </div>

      <div>
        <h4 class="text-sm font-bold text-slate-900 mb-3 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[18px] text-emerald-600">checklist</span>
          신청 절차
        </h4>
        <ol class="space-y-3">
          <li v-for="step in steps" :key="step.step" class="flex gap-3">
            <span class="flex-shrink-0 size-7 rounded-full bg-emerald-100 text-emerald-700 text-xs font-bold flex items-center justify-center">
              {{ step.step }}
            </span>
            <div class="flex-1 min-w-0">
              <p class="text-sm font-bold text-slate-900">{{ step.title }}</p>
              <p class="mt-0.5 text-xs text-slate-600 leading-relaxed break-keep">{{ step.description }}</p>
            </div>
          </li>
        </ol>
      </div>
    </div>

    <p class="mt-4 text-[11px] text-slate-400 leading-relaxed">
      ※ 자격 요건과 절차는 공급 유형·모집공고에 따라 달라질 수 있습니다. 정확한 기준은 LH·SH 공고문을 확인하세요.
    </p>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import { ELIGIBILITY_BASE, APPLY_STEPS } from '~/utils/publicRentalContent'

const eligibility = ELIGIBILITY_BASE
const steps = APPLY_STEPS
</script>
