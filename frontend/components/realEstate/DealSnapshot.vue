<template>
  <article class="deal-snapshot" :class="{ 'deal-snapshot--compact': compact }" :aria-label="label">
    <template v-if="deal">
      <div class="deal-kind">{{ label }}</div>
      <div data-testid="amount-cell" class="deal-amount">{{ amountText }}</div>
      <div data-testid="area-floor-cell" class="deal-conditions">
        <span>{{ areaText }}</span>
        <span>{{ floorText }}</span>
      </div>
      <div data-testid="date-cell" class="deal-date">{{ dateText }}</div>
    </template>
    <p v-else class="deal-empty">{{ label }} 거래 없음</p>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { DealKind, DealSnapshot } from '~/types/realEstateExploration'
import { formatDeposit } from '~/utils/formatDeposit'
import { formatDealDate } from '~/utils/realEstateLatestDeals'

interface Props {
  deal: DealSnapshot | null
  kind: DealKind
  compact?: boolean
}

const props = defineProps<Props>()

const label = computed(() => {
  if (props.kind === 'sale') return '매매'
  if (props.kind === 'jeonse') return '전세'
  return '월세'
})

function formatPrice(value: number | null): string {
  return value == null ? '-' : formatDeposit(value)
}

const amountText = computed(() => {
  const deal = props.deal
  if (!deal) return ''
  if (props.kind === 'sale') return formatPrice(deal.amount)
  if (props.kind === 'jeonse') return formatPrice(deal.deposit)

  const deposit = formatPrice(deal.deposit)
  const monthlyRent = formatPrice(deal.monthlyRent)
  return `보증금 ${deposit} / 월세 ${monthlyRent}`
})

const areaText = computed(() => {
  if (!props.deal || props.deal.exclusiveArea == null) return '면적 정보 없음'
  return `${props.deal.exclusiveArea}㎡`
})

const floorText = computed(() => {
  if (!props.deal || props.deal.floor == null) return '층 정보 없음'
  return `${props.deal.floor}층`
})

const dateText = computed(() => props.deal ? formatDealDate(props.deal) : '')
</script>

<style scoped>
.deal-snapshot {
  display: grid;
  grid-template-columns: minmax(3rem, 0.4fr) minmax(9rem, 1.1fr) minmax(7rem, 0.7fr) minmax(6rem, 0.6fr);
  align-items: center;
  gap: 1rem;
  color: rgb(var(--ink-rgb));
  min-width: 0;
}

.deal-kind {
  color: rgb(var(--muted-rgb));
  font-size: 0.8125rem;
  font-weight: 700;
}

.deal-amount {
  font-size: 1.125rem;
  font-weight: 800;
  line-height: 1.25;
  word-break: keep-all;
}

.deal-conditions,
.deal-date {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  color: rgb(var(--ink-rgb));
  font-size: 0.875rem;
  line-height: 1.35;
}

.deal-empty {
  grid-column: 1 / -1;
  margin: 0;
  color: rgb(var(--muted-rgb));
  font-size: 0.875rem;
}

.deal-snapshot--compact {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.125rem 0.75rem;
}

.deal-snapshot--compact .deal-kind {
  grid-column: 1;
  color: rgb(var(--brand-rgb));
  font-size: 0.75rem;
}

.deal-snapshot--compact .deal-amount {
  grid-column: 1;
  font-size: 1rem;
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.deal-snapshot--compact .deal-conditions {
  grid-column: 2;
  grid-row: 1 / span 2;
  align-self: center;
  text-align: right;
  font-size: 0.75rem;
}

.deal-snapshot--compact .deal-date {
  grid-column: 1 / -1;
  font-size: 0.75rem;
}

@media (max-width: 640px) {
  .deal-snapshot {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.25rem 0.75rem;
  }

  .deal-kind,
  .deal-conditions,
  .deal-date {
    grid-column: 1;
  }

  .deal-amount {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: center;
    max-width: 11rem;
    text-align: right;
    font-size: clamp(1rem, 5vw, 1.25rem);
  }
}
.deal-snapshot--compact {
  grid-template-columns: minmax(0, 1fr);
  gap: 0.125rem;
}

.deal-snapshot--compact .deal-kind,
.deal-snapshot--compact .deal-amount,
.deal-snapshot--compact .deal-conditions,
.deal-snapshot--compact .deal-date {
  grid-column: 1;
  grid-row: auto;
  text-align: left;
}

.deal-snapshot--compact .deal-conditions {
  align-self: auto;
  color: rgb(var(--muted-rgb));
}

</style>
