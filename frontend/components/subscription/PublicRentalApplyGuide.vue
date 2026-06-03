<template>
  <SectionBlock heading="신청 바로가기" subtext="공식 채널에서 모집공고와 자격 자가진단을 확인하세요.">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <a
        v-for="link in links"
        :key="link.label"
        :href="link.url"
        target="_blank"
        rel="noopener noreferrer"
        class="group rounded-xl border border-slate-200 bg-white p-4 hover:border-primary hover:shadow-md transition-all"
      >
        <div class="flex items-center justify-between mb-2">
          <span class="text-sm font-bold text-slate-900 group-hover:text-primary transition-colors">
            {{ link.label }}
          </span>
          <span class="material-symbols-outlined text-[18px] text-slate-400 group-hover:text-primary transition-colors">
            open_in_new
          </span>
        </div>
        <p class="text-xs text-slate-500 leading-relaxed break-keep">{{ link.description }}</p>
      </a>
    </div>

    <div class="mt-4 rounded-lg border border-amber-100 bg-amber-50/60 p-3 flex items-start gap-2">
      <span class="material-symbols-outlined text-[18px] text-amber-600 mt-0.5">warning</span>
      <p class="text-xs md:text-sm text-amber-800 leading-relaxed">
        모집 일정·자격 요건·서류는 단지별 공고문이 우선합니다. 신청 전 반드시 해당 공고문 원본을 확인하세요.
      </p>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import { APPLY_LINKS } from '~/utils/publicRentalContent'

const links = [APPLY_LINKS.lh, APPLY_LINKS.myhome, APPLY_LINKS.sh]
</script>
