<template>
  <SectionBlock heading="자주 묻는 질문" subtext="공공임대 신청자가 가장 많이 묻는 질문에 답합니다.">
    <ul class="divide-y divide-line">
      <li v-for="(item, idx) in faqs" :key="idx" class="py-3 first:pt-0 last:pb-0">
        <details class="group">
          <summary class="flex items-start justify-between gap-3 cursor-pointer list-none">
            <p class="text-sm md:text-base font-bold text-strong break-keep">
              <span class="text-primary mr-2">Q.</span>{{ item.question }}
            </p>
            <span class="material-symbols-outlined text-[18px] text-faint mt-0.5 transition-transform group-open:rotate-180">
              expand_more
            </span>
          </summary>
          <p class="mt-2 ml-6 text-sm text-ink leading-relaxed break-keep">
            {{ item.answer }}
          </p>
        </details>
      </li>
    </ul>
  </SectionBlock>
</template>

<script setup lang="ts">
import SectionBlock from '~/components/common/SectionBlock.vue'
import { PUBLIC_RENTAL_FAQ } from '~/utils/publicRentalContent'

const faqs = PUBLIC_RENTAL_FAQ
</script>
