<template>
  <SectionBlock :heading="`${rentalType} 안내`" :subtext="`${rentalType} 제도의 핵심 특징과 대상자입니다.`">
    <p class="text-sm md:text-base text-slate-700 leading-relaxed break-keep">
      {{ guide.summary }}
    </p>

    <div class="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
      <div class="rounded-lg border border-blue-100 bg-blue-50/40 p-4">
        <h4 class="text-sm font-bold text-blue-900 mb-2 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]">check_circle</span>
          주요 특징
        </h4>
        <ul class="space-y-1.5 text-sm text-slate-700">
          <li v-for="feature in guide.features" :key="feature" class="flex items-start gap-2">
            <span class="text-blue-500 mt-1">•</span>
            <span class="break-keep">{{ feature }}</span>
          </li>
        </ul>
      </div>

      <div class="rounded-lg border border-emerald-100 bg-emerald-50/40 p-4">
        <h4 class="text-sm font-bold text-emerald-900 mb-2 flex items-center gap-1.5">
          <span class="material-symbols-outlined text-[16px]">groups</span>
          신청 대상
        </h4>
        <p class="text-sm text-slate-700 leading-relaxed break-keep">
          {{ guide.targetAudience }}
        </p>
      </div>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SectionBlock from '~/components/common/SectionBlock.vue'
import {
  RENTAL_TYPE_GUIDES,
  RENTAL_TYPE_GUIDE_DEFAULT,
} from '~/utils/publicRentalContent'

const props = defineProps<{
  rentalType: string
}>()

const guide = computed(() => RENTAL_TYPE_GUIDES[props.rentalType] ?? RENTAL_TYPE_GUIDE_DEFAULT)
</script>
