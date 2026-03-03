<template>
  <section class="mb-6">
    <h2 class="text-lg font-bold text-slate-900 dark:text-white mb-2">
      {{ categoryLabel }} 안내
    </h2>
    <p class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
      {{ description }}
    </p>

    <!-- FAQ Section -->
    <div v-if="faqs.length > 0" class="mt-6">
      <h3 class="text-base font-bold text-slate-900 dark:text-white mb-3">자주 묻는 질문</h3>
      <dl class="space-y-3">
        <div
          v-for="(faq, index) in faqs"
          :key="index"
          class="bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-100 dark:border-slate-700"
        >
          <dt class="font-semibold text-sm text-slate-900 dark:text-white mb-1">
            Q. {{ faq.question }}
          </dt>
          <dd class="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {{ faq.answer }}
          </dd>
        </div>
      </dl>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { FacilityCategory } from '~/types/facility'
import { CATEGORY_META } from '~/types/facility'
import { CATEGORY_DESCRIPTIONS } from '~/utils/categoryDescriptions'
import { CATEGORY_FAQ } from '~/utils/categoryFAQ'

const props = defineProps<{
  category: FacilityCategory
}>()

const categoryLabel = computed(() => CATEGORY_META[props.category]?.label ?? props.category)
const description = computed(() => CATEGORY_DESCRIPTIONS[props.category] ?? '')
const faqs = computed(() => CATEGORY_FAQ[props.category] ?? [])
</script>
