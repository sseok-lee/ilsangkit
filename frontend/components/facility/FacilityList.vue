<template>
  <div>
    <!-- Loading State - Skeleton -->
    <div v-if="loading" class="space-y-4">
      <div
        v-for="i in 5"
        :key="i"
        data-testid="skeleton"
        class="p-5 bg-white border border-line rounded-xl animate-pulse"
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="h-7 w-24 bg-line rounded-full"></div>
          <div class="h-6 w-16 bg-line rounded-full"></div>
        </div>
        <div class="h-6 bg-line rounded mb-2 w-3/4"></div>
        <div class="h-4 bg-line rounded w-full"></div>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="!loading && facilities.length === 0"
      class="flex flex-col items-center justify-center py-16 px-4"
    >
      <div class="text-6xl mb-4">🔍</div>
      <h3 class="text-xl font-bold text-ink mb-2">{{ UI_MESSAGES.emptySearch }}</h3>
      <p class="text-muted text-center">
        다른 검색어나 필터로 다시 시도해보세요
      </p>
    </div>

    <!-- Facility List -->
    <div v-else-if="variant === 'rows'" class="divide-y divide-line overflow-hidden rounded-xl border border-line bg-white">
      <HardLink
        v-for="facility in facilities"
        :key="facility.id"
        :to="`/${facility.category}/${facility.id}`"
        :aria-label="`${facility.name} 상세보기`"
        data-testid="facility-row"
        class="group flex min-h-[96px] items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-background-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary md:items-center md:px-5"
      >
        <span class="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/5 text-primary md:mt-0">
          <CategoryIcon :category-id="facility.category" size="sm" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="flex flex-col gap-1 md:flex-row md:items-start md:justify-between md:gap-4">
            <strong class="text-base font-bold leading-snug text-ink group-hover:text-primary">
              {{ facility.name }}
            </strong>
            <span v-if="facility.distance !== undefined" class="shrink-0 text-sm font-semibold text-primary">
              {{ formatDistance(facility.distance) }}
            </span>
          </span>
          <span v-if="displayAddress(facility)" class="mt-1 block text-sm leading-relaxed text-muted">
            {{ displayAddress(facility) }}
          </span>
          <span class="mt-2 flex flex-wrap items-center gap-2">
            <OperatingStatusBadge
              v-if="getOperatingStatus(facility)"
              :status="getOperatingStatus(facility)!"
            />
            <span
              v-for="detail in rowDetails(facility)"
              :key="detail"
              class="inline-flex rounded-full bg-background-light px-2.5 py-1 text-xs font-medium text-muted"
            >
              {{ detail }}
            </span>
          </span>
        </span>
        <span class="material-symbols-outlined mt-1 text-[18px] text-faint transition-colors group-hover:text-primary md:mt-0">chevron_right</span>
      </HardLink>
    </div>

    <div v-else class="space-y-4">
      <FacilityCard
        v-for="facility in facilities"
        :key="facility.id"
        :facility="facility"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import HardLink from '~/components/common/HardLink.vue'
import type { Facility } from '~/types/facility'
import { UI_MESSAGES } from '~/utils/uiMessages'
import { formatDistance } from '~/utils/formatters'
import { getOperatingStatus } from '~/utils/facilityStatus'
import FacilityCard from './FacilityCard.vue'
import OperatingStatusBadge from './OperatingStatusBadge.vue'

interface Props {
  facilities: Facility[]
  loading: boolean
  variant?: 'cards' | 'rows'
}

withDefaults(defineProps<Props>(), {
  variant: 'cards',
})

function displayAddress(facility: Facility): string {
  return facility.roadAddress || facility.address || ''
}

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : ''
}

function numberText(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function formatDutyTime(raw: string | number): string {
  const s = String(raw).padStart(4, '0')
  return `${s.slice(0, 2)}:${s.slice(2)}`
}

function rowDetails(facility: Facility): string[] {
  const extras = facility.extras ?? {}
  const details: string[] = []

  if (facility.category === 'parking') {
    const capacity = numberText(extras.capacity)
    const feeType = text(extras.feeType)
    const baseFee = numberText(extras.baseFee)
    if (capacity != null) details.push(`${capacity.toLocaleString('ko-KR')}면`)
    if (feeType) details.push(feeType)
    if (baseFee != null && baseFee > 0) details.push(`기본 ${baseFee.toLocaleString('ko-KR')}원`)
  }

  if (facility.category === 'wifi') {
    const ssid = text(extras.ssid)
    const location = text(extras.installLocationDetail) || text(extras.installLocation)
    if (ssid) details.push(ssid)
    if (location) details.push(location)
  }

  if (facility.category === 'library') {
    const open = text(extras.weekdayOpenTime)
    const close = text(extras.weekdayCloseTime)
    const seats = numberText(extras.seatCount)
    if (open && close) details.push(`평일 ${open}–${close}`)
    if (seats != null) details.push(`${seats.toLocaleString('ko-KR')}석`)
  }

  if (facility.category === 'hospital') {
    const type = text(extras.clCdNm)
    const doctors = numberText(extras.drTotCnt)
    if (type) details.push(type)
    if (doctors != null) details.push(`의사 ${doctors.toLocaleString('ko-KR')}명`)
  }

  if (facility.category === 'pharmacy') {
    const open = text(extras.dutyTime1s)
    const close = text(extras.dutyTime1c)
    if (open && close) details.push(`${formatDutyTime(open)}~${formatDutyTime(close)}`)
  }

  if (facility.category === 'subway' && Array.isArray(extras.lines)) {
    details.push(...extras.lines.filter((line): line is string => typeof line === 'string').slice(0, 3))
  }

  const phone = text(extras.phone)
    || text(extras.phoneNumber)
    || text(extras.dutyTel3)
    || text(extras.clerkTel)
    || text(extras.busiCall)
  if (phone) details.push(`전화 ${phone}`)

  return [...new Set(details)].slice(0, 3)
}
</script>
