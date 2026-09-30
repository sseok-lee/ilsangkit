<template>
  <article class="notice-row">
    <div class="notice-main">
      <NuxtLink
        :to="`/subscription/${item.id}`"
        class="notice-name"
        @click="emit('open-detail')"
      >
        {{ item.houseName }}
      </NuxtLink>
      <div class="tagline">
        <span class="status" :class="item.status">{{ statusLabel }}</span>
        <span v-if="showCategory" :class="categoryBadgeClass" class="category-badge">{{ categoryLabel }}</span>
        <span :class="badge.classes" class="type-badge">{{ badge.label }}</span>
        <span v-if="item.publicRental?.provider">{{ item.publicRental.provider }}</span>
        <span v-else-if="item.constructorName">{{ item.constructorName }}</span>
      </div>
    </div>

    <div class="region">{{ regionLabel }}</div>
    <div class="supply">
      {{ supplyLabel }}
      <small>공고 전체 기준</small>
    </div>
    <div class="period">
      <strong>{{ periodLabel }}</strong>
      <span v-if="deadlineLabel" class="deadline">{{ deadlineLabel }}</span>
      <span v-else class="deadline">공고 전체 기준</span>
    </div>
  </article>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Subscription, PublicRentalSupply } from '~/types/subscription'
import { subscriptionTypeBadge } from '~/utils/subscriptionMeta'

const props = withDefaults(defineProps<{
  item: Subscription
  selectedCity?: string
  selectedDistrict?: string
  showCategory?: boolean
}>(), {
  showCategory: false,
})

const emit = defineEmits<{
  'open-detail': []
}>()

const badge = computed(() => subscriptionTypeBadge(props.item.sourceType, props.item.rentType))
const categoryLabel = computed(() => badge.value.kind === 'rent' ? '임대' : '분양')
const categoryBadgeClass = computed(() =>
  badge.value.kind === 'rent'
    ? 'bg-slate-900 text-white'
    : 'bg-primary-50 text-primary'
)

const statusLabel = computed(() => {
  if (props.item.status === 'ongoing') return '접수 중'
  if (props.item.status === 'upcoming') return '접수 예정'
  if (props.item.status === 'unknown') return '일정 확인 필요'
  return '마감'
})

function formatDate(value: string | null): string {
  if (!value) return ''
  return value.slice(0, 10).replaceAll('-', '.')
}

function daysUntil(value: string | null): number | null {
  if (!value) return null
  const date = new Date(`${value.slice(0, 10)}T00:00:00+09:00`)
  if (Number.isNaN(date.getTime())) return null
  const now = new Date()
  const today = new Date(`${now.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })}T00:00:00+09:00`)
  return Math.ceil((date.getTime() - today.getTime()) / 86_400_000)
}

const CITY_ALIASES: Record<string, string> = {
  서울: '서울특별시',
  부산: '부산광역시',
  대구: '대구광역시',
  인천: '인천광역시',
  광주: '광주광역시',
  대전: '대전광역시',
  울산: '울산광역시',
  세종: '세종특별자치시',
  경기: '경기도',
  강원: '강원특별자치도',
  충북: '충청북도',
  충남: '충청남도',
  전북: '전북특별자치도',
  전남: '전라남도',
  경북: '경상북도',
  경남: '경상남도',
  제주: '제주특별자치도',
}

function expandedRegionParts(): string[] {
  const city = props.selectedCity ? (CITY_ALIASES[props.selectedCity] ?? props.selectedCity) : ''
  return [city, props.selectedDistrict].filter(Boolean)
}

function supplyMatches(supply: PublicRentalSupply): boolean {
  const target = expandedRegionParts().join(' ')
  if (!target) return false
  return supply.region.includes(target) || target.includes(supply.region)
}

const publicSupplies = computed(() => props.item.publicRental?.supplies ?? [])

const regionLabel = computed(() => {
  const supplies = publicSupplies.value
  if (supplies.length > 0) {
    const selected = supplies.find(supplyMatches) ?? supplies[0]
    const others = Math.max(0, supplies.length - 1)
    return others > 0 ? `${selected.region} 외 ${others}개 지역` : selected.region
  }
  return props.item.regionName || props.item.supplyLocation || '지역 확인 필요'
})

const supplyLabel = computed(() => {
  const count = props.item.totalSupplyCount
  return typeof count === 'number' && count > 0 ? `${count.toLocaleString('ko-KR')}세대` : '원문 확인'
})

const periodLabel = computed(() => {
  const start = formatDate(props.item.receptionStartDate)
  const end = formatDate(props.item.receptionEndDate)
  if (start && end) return `${start} ~ ${end}`
  if (start) return `${start}부터`
  return '일정 확인 필요'
})

const deadlineLabel = computed(() => {
  const days = daysUntil(props.item.receptionEndDate ?? props.item.receptionStartDate)
  if (days === null) return ''
  if (days < 0) return '마감'
  if (days === 0) return '오늘 마감'
  return `D-${days}`
})
</script>

<style scoped>
.notice-row {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px 80px 178px;
  gap: 24px;
  align-items: center;
  padding: 22px 18px;
  border-bottom: 1px solid #e6e9f0;
}

.notice-row:hover {
  background: #fbfcff;
}

.notice-main {
  min-width: 0;
}

.notice-name {
  display: block;
  color: #15213b;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.notice-name::after {
  content: '';
  position: absolute;
  inset: 0;
}

.notice-name:focus-visible::after {
  outline: 2px solid #2450dc;
  outline-offset: -2px;
}

.notice-row:hover .notice-name {
  color: #2450dc;
}

.tagline {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-top: 8px;
  color: #56627a;
  font-size: 12px;
}

.status,
.category-badge,
.type-badge {
  display: inline-flex;
  align-items: center;
  border-radius: 5px;
  padding: 3px 8px;
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.status.ongoing {
  background: #edf7f1;
  color: #1d684b;
}

.status.upcoming {
  background: #edf2ff;
  color: #2450dc;
}

.status.closed,
.status.unknown {
  background: #f0f2f6;
  color: #56627a;
}

.region {
  color: #56627a;
  font-size: 13px;
}

.supply {
  color: #15213b;
  font-size: 15px;
  font-variant-numeric: tabular-nums;
  font-weight: 550;
  text-align: right;
  white-space: nowrap;
}

.supply small {
  display: block;
  color: #56627a;
  font-size: 11px;
  font-weight: 400;
}

.period {
  color: #56627a;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.period strong {
  display: block;
  color: #15213b;
  font-weight: 500;
}

.deadline {
  display: block;
  margin-top: 3px;
  color: #b55230;
  font-size: 12px;
}

@media (max-width: 1000px) {
  .notice-row {
    grid-template-columns: minmax(0, 1fr) 90px 70px 156px;
    gap: 14px;
  }
}

@media (max-width: 700px) {
  .notice-row {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 8px 14px;
    padding: 20px 0;
  }

  .notice-row:first-child {
    border-top: 1px solid #e6e9f0;
  }

  .notice-main {
    grid-column: 1 / -1;
  }

  .tagline {
    gap: 6px;
    margin: 9px 0 3px;
    font-size: 11px;
  }

  .region {
    font-size: 12px;
  }

  .supply {
    font-size: 13px;
  }

  .period {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    gap: 8px;
    align-items: center;
    text-align: left;
    font-size: 12px;
  }

  .period strong {
    color: #56627a;
    font-size: 12px;
  }

  .deadline {
    margin: 0;
    white-space: nowrap;
  }
}
</style>
