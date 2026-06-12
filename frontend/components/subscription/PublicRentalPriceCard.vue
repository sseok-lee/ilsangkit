<template>
  <SectionBlock heading="가격 정보" subtext="공공기관 직접 임대 매물의 보증금과 월 임대료입니다.">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
      <div class="rounded-lg border border-primary-100 bg-primary-50/40 p-4">
        <span class="block text-muted text-xs font-bold uppercase tracking-wide">{{ depositLabel }}</span>
        <strong :class="['block mt-1 text-xl md:text-2xl font-bold break-keep font-display tabular-nums', depositColor]">
          {{ depositText }}
        </strong>
      </div>

      <div class="rounded-lg border border-line bg-white p-4">
        <span class="block text-muted text-xs font-bold uppercase tracking-wide">월 임대료</span>
        <strong :class="['block mt-1 text-xl md:text-2xl font-bold break-keep font-display tabular-nums', rentColor]">
          {{ rentText }}
        </strong>
      </div>

      <div class="rounded-lg border border-line bg-white p-4">
        <span class="block text-muted text-xs font-bold uppercase tracking-wide">전환보증금 한도</span>
        <strong :class="['block mt-1 text-xl md:text-2xl font-bold break-keep font-display tabular-nums', conversionColor]">
          {{ conversionText }}
        </strong>
        <p class="mt-1 text-[11px] text-faint leading-relaxed">월세 일부를 보증금으로 전환할 때 적용되는 한도입니다.</p>
      </div>
    </div>
  </SectionBlock>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PublicRentalComplex } from '~/types/publicRental'
import SectionBlock from '~/components/common/SectionBlock.vue'
import { fmtDeposit, fmtRent, isJeonseRental, NO_DATA } from '~/utils/publicRentalMeta'

const props = defineProps<{
  rental: PublicRentalComplex
}>()

const isJeonse = computed(() => isJeonseRental(props.rental.monthlyRent))

const depositLabel = computed(() => (isJeonse.value ? '전세보증금' : '보증금'))

const depositText = computed(() => fmtDeposit(props.rental.depositAmount))
const rentText = computed(() => fmtRent(props.rental.monthlyRent, isJeonse.value))
const conversionText = computed(() => fmtDeposit(props.rental.conversionDeposit ?? null))

const depositColor = computed(() =>
  depositText.value === NO_DATA ? 'text-faint' : 'text-strong',
)
const rentColor = computed(() =>
  rentText.value === NO_DATA ? 'text-faint' : 'text-strong',
)
const conversionColor = computed(() =>
  conversionText.value === NO_DATA ? 'text-faint' : 'text-strong',
)
</script>
