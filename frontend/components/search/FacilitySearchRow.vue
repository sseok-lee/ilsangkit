<template>
  <NuxtLink :to="href" class="facility-search-row">
    <strong>{{ facility.name }}</strong>
    <span v-if="address" class="facility-search-row__address">{{ address }}</span>
    <span v-if="details.length" class="facility-search-row__details">
      <span v-for="detail in details" :key="detail">{{ detail }}</span>
    </span>
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Facility } from '~/types/facility'

const props = defineProps<{ facility: Facility }>()

function isValidWasteAreaDestination(destination: Facility['destination']): destination is { kind: 'waste-area'; href: string } {
  return destination?.kind === 'waste-area' && /^\/trash\/areas\/\d+$/.test(destination.href)
}

const href = computed(() => {
  if (props.facility.category === 'trash' && isValidWasteAreaDestination(props.facility.destination)) {
    return props.facility.destination.href
  }
  return `/${props.facility.category}/${props.facility.id}`
})

const address = computed(() => props.facility.roadAddress || props.facility.address || '')

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function numberText(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

const details = computed(() => {
  const extras = props.facility.extras ?? {}
  const result: string[] = []

  if (props.facility.category === 'parking') {
    const capacity = numberText(extras.capacity)
    const feeType = text(extras.feeType)
    const baseFee = numberText(extras.baseFee)
    if (capacity != null) result.push(`${capacity.toLocaleString('ko-KR')}면`)
    if (feeType) result.push(feeType)
    if (baseFee != null && baseFee > 0) result.push(`기본 ${baseFee.toLocaleString('ko-KR')}원`)
  }

  if (props.facility.category === 'library') {
    const open = text(extras.weekdayOpenTime)
    const close = text(extras.weekdayCloseTime)
    const seats = numberText(extras.seatCount)
    if (open && close) result.push(`평일 ${open}–${close}`)
    if (seats != null) result.push(`${seats.toLocaleString('ko-KR')}석`)
  }

  if (props.facility.category === 'wifi') {
    const ssid = text(extras.ssid)
    const location = text(extras.installLocationDetail) || text(extras.installLocation)
    if (ssid) result.push(ssid)
    if (location) result.push(location)
  }

  if (props.facility.category === 'ev-charger') {
    const useTime = text(extras.useTime)
    const location = text(extras.location) || text(extras.addrDetail)
    if (useTime) result.push(useTime)
    if (location) result.push(location)
  }

  const phone = text(extras.phone)
    || text(extras.phoneNumber)
    || text(extras.dutyTel3)
    || text(extras.clerkTel)
    || text(extras.busiCall)
  if (phone) result.push(`전화 ${phone}`)

  return [...new Set(result)].slice(0, 3)
})
</script>

<style scoped>
.facility-search-row {
  display: flex;
  min-height: 44px;
  flex-direction: column;
  justify-content: center;
  gap: 0.375rem;
  padding: 1rem 0.75rem;
  border-bottom: 1px solid rgb(var(--border-rgb));
  color: rgb(var(--ink-rgb));
  text-decoration: none;
}

.facility-search-row strong {
  font-size: 0.9375rem;
  line-height: 1.4;
  overflow-wrap: anywhere;
}

.facility-search-row__address,
.facility-search-row__details {
  color: rgb(var(--muted-rgb));
  font-size: 0.8125rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.facility-search-row__details {
  display: flex;
  flex-wrap: wrap;
  gap: 0.25rem 0.75rem;
}

.facility-search-row:focus-visible {
  outline: 2px solid rgb(var(--brand-rgb));
  outline-offset: -2px;
}

@media (min-width: 768px) {
  .facility-search-row {
    padding: 1rem;
  }
}
</style>
