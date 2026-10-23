<template>
  <section class="estate-price-hero" aria-label="면적별 대표 가격" :aria-busy="pending">
    <div v-if="sortedGroups.length" class="estate-price-hero__areas">
      <p class="estate-price-hero__areas-label">
        전용면적<span class="estate-price-hero__areas-hint"> · 거래가 가장 많은 면적을 먼저 보여줍니다</span>
      </p>
      <div class="estate-price-hero__chips" role="group" aria-label="전용면적 선택">
        <button
          v-for="group in visibleGroups"
          :key="group.key"
          type="button"
          class="estate-price-hero__chip"
          :class="{ 'estate-price-hero__chip--active': group.key === activeKey }"
          :aria-pressed="group.key === activeKey ? 'true' : 'false'"
          @click="emit('select-area', group.key)"
        >
          <span class="estate-price-hero__chip-main">{{ group.label }}㎡ · 전용 {{ group.pyeong }}평</span>
          <span class="estate-price-hero__chip-sub">{{ countLabel(group) }}</span>
        </button>
        <button
          v-if="hiddenCount > 0"
          type="button"
          class="estate-price-hero__more"
          :aria-expanded="expanded ? 'true' : 'false'"
          @click="expanded = true"
        >
더보기
</button>
      </div>
    </div>

    <dl v-if="cells.length" class="estate-price-hero__body" data-testid="estate-price-body">
      <div
        v-for="cell in cells"
        :key="cell.label"
        class="estate-price-hero__cell"
        :class="{ 'estate-price-hero__cell--lead': cell.lead }"
      >
        <dt class="estate-price-hero__label">{{ cell.label }}</dt>
        <dd class="estate-price-hero__value">{{ cell.value }}</dd>
        <dd v-if="cell.note" class="estate-price-hero__note">{{ cell.note }}</dd>
        <dd
          v-if="cell.change"
          class="estate-price-hero__change"
          :class="cell.change.tone ? `estate-price-hero__change--${cell.change.tone}` : undefined"
        >
{{ cell.change.text }}
</dd>
      </div>
    </dl>

    <p v-if="excludedNotice" class="estate-price-hero__excluded">
      <span>{{ excludedNotice }}</span>
      <a href="#transactions" class="estate-price-hero__excluded-link">거래 내역에서 보기</a>
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatKoreanPrice } from '~/utils/formatters'
import type { AreaGroup, DetailOverview, ExcludedDeal, PriceBasis } from '~/types/housingRedesign'

const props = withDefaults(defineProps<{
  overview: DetailOverview
  selectedArea: string | null
  pending?: boolean
}>(), { pending: false })

const emit = defineEmits<{
  'select-area': [key: string]
}>()

const VISIBLE_CHIP_LIMIT = 6

interface HeroBasis {
  groupKey: string | null
  basis: PriceBasis | null
  /** 전월세 URL 에서 같은 그룹 매매 대표 시세(있을 때만) */
  saleRepresentative: number | null
}

// 어떤 면적 그룹·어떤 기준(매매/전세)을 보여줄지 한 곳에서 정한다.
// Task 8 의 resolveDefaultRepresentative 로 옮기기 쉽게 순수 함수로 둔다.
function resolveHeroBasis(overview: DetailOverview, selectedArea: string | null): HeroBasis {
  const keys = new Set((overview.areaGroups ?? []).map(group => group.key))
  const groupKey = selectedArea && keys.has(selectedArea) ? selectedArea : overview.defaultAreaGroup
  if (!groupKey) return { groupKey: null, basis: null, saleRepresentative: null }
  const source = overview.basisMode === 'jeonse' ? overview.jeonseBasis : overview.saleBasis
  const saleRepresentative = overview.basisMode === 'jeonse'
    ? overview.saleBasis?.[groupKey]?.representative ?? null
    : null
  return { groupKey, basis: source?.[groupKey] ?? null, saleRepresentative }
}

const hero = computed(() => resolveHeroBasis(props.overview, props.selectedArea))
const activeKey = computed(() => hero.value.groupKey)

function groupCount(group: AreaGroup): number {
  return props.overview.basisMode === 'jeonse' ? group.jeonseCount36m : group.saleCount36m
}

function countLabel(group: AreaGroup): string {
  const prefix = props.overview.basisMode === 'jeonse' ? '전세' : '매매'
  return `${prefix} ${groupCount(group).toLocaleString()}건`
}

const sortedGroups = computed(() =>
  [...(props.overview.areaGroups ?? [])].sort((a, b) =>
    groupCount(b) - groupCount(a) || Number(a.key) - Number(b.key),
  ),
)

const expanded = ref(false)

const visibleGroups = computed(() => {
  if (expanded.value) return sortedGroups.value
  const top = sortedGroups.value.slice(0, VISIBLE_CHIP_LIMIT)
  const active = sortedGroups.value.find(group => group.key === activeKey.value)
  // 선택된 면적이 상위 6개 밖이어도 선택 상태는 항상 보이게 둔다.
  if (active && !top.includes(active)) top.push(active)
  return top
})

const hiddenCount = computed(() => sortedGroups.value.length - visibleGroups.value.length)

function shortDate(date: string): string {
  const [year, month, day] = date.split('-')
  return [year?.slice(2), month, day].filter(Boolean).join('.')
}

function dealLine(deal: { date: string; floor: number | null }): string {
  const parts = [shortDate(deal.date)]
  if (deal.floor != null) parts.push(`${deal.floor}층`)
  return parts.join(' · ')
}

interface HeroCell {
  label: string
  value: string
  note?: string
  change?: { text: string; tone: 'up' | 'down' | null }
  lead?: boolean
}

function changeLine(rate: number | null): HeroCell['change'] {
  if (rate == null || !Number.isFinite(rate)) return undefined
  const percent = Math.trunc(Math.round(rate * 1e4) / 100)
  if (percent > 0) return { text: `▲ 1년 전보다 ${percent}%`, tone: 'up' }
  if (percent < 0) return { text: `▼ 1년 전보다 ${Math.abs(percent)}%`, tone: 'down' }
  return { text: '1년 전보다 0%', tone: null }
}

const cells = computed<HeroCell[]>(() => {
  const { basis, saleRepresentative } = hero.value
  if (!basis) return []
  const jeonse = props.overview.basisMode === 'jeonse'

  if (basis.representative == null) {
    if (!basis.latest) return []
    return [{
      label: '최근 거래',
      value: formatKoreanPrice(basis.latest.amount),
      note: dealLine(basis.latest),
      lead: true,
    }]
  }

  const sample = basis.sampleCount > 0 ? basis.sampleCount : jeonse ? 6 : 5
  const result: HeroCell[] = [{
    label: '대표 시세',
    value: formatKoreanPrice(basis.representative),
    note: jeonse ? `최근 전세 ${sample}건 중간값` : `최근 중개거래 ${sample}건 중간값`,
    change: changeLine(basis.changeRate),
    lead: true,
  }]
  if (basis.latest) {
    result.push({ label: '최근 실거래', value: formatKoreanPrice(basis.latest.amount), note: dealLine(basis.latest) })
  }
  if (basis.max12m != null) {
    result.push({ label: '최고가 · 12개월', value: formatKoreanPrice(basis.max12m) })
  }
  if (jeonse && saleRepresentative != null) {
    result.push({ label: '매매 시세', value: formatKoreanPrice(saleRepresentative) })
  }
  return result
})

function reasonLabel(deal: ExcludedDeal): string {
  if (deal.reason === 'direct') return '직거래'
  if (deal.deviation == null || !Number.isFinite(deal.deviation)) return '중간값 대비 큰 차이'
  const percent = Math.round(deal.deviation * 100)
  return `중간값 대비 ${percent > 0 ? '+' : ''}${percent}%`
}

const excludedNotice = computed(() => {
  const basis = hero.value.basis
  if (!basis || basis.excluded.length === 0) return null
  const [first] = basis.excluded
  // 대표 시세가 없으면 화면 어디에도 '시세' 를 쓰지 않는다 — 최근 거래 선택에서 뺀 것으로 안내한다.
  const head = basis.representative != null
    ? `시세 계산에서 뺀 거래 ${basis.excluded.length}건`
    : `최근 거래에서 뺀 거래 ${basis.excluded.length}건`
  return `${head} · ${shortDate(first.date)} ${formatKoreanPrice(first.amount)}(${reasonLabel(first)})`
})
</script>

<style scoped>
.estate-price-hero {
  border-top: 1px solid rgb(var(--border-rgb));
  padding-top: 18px;
}

.estate-price-hero[aria-busy='true'] .estate-price-hero__chips {
  opacity: 0.7;
}

.estate-price-hero__areas-label {
  margin: 0 0 10px;
  color: rgb(var(--strong-rgb));
  font-size: 13px;
  font-weight: 650;
}

.estate-price-hero__areas-hint {
  color: rgb(var(--faint-rgb));
  font-weight: 500;
}

.estate-price-hero__chips {
  display: flex;
  gap: 8px;
  margin: 0 -16px;
  padding: 0 16px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.estate-price-hero__chips::-webkit-scrollbar {
  display: none;
}

.estate-price-hero__chip,
.estate-price-hero__more {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  flex-shrink: 0;
  min-height: 48px;
  border: 1px solid rgb(var(--border-rgb));
  border-radius: 8px;
  background: rgb(var(--surface-rgb));
  padding: 6px 12px;
  text-align: left;
  white-space: nowrap;
}

.estate-price-hero__chip:focus-visible,
.estate-price-hero__more:focus-visible,
.estate-price-hero__excluded-link:focus-visible {
  outline: 2px solid rgb(var(--brand-rgb));
  outline-offset: 2px;
}

.estate-price-hero__chip-main {
  color: rgb(var(--strong-rgb));
  font-size: 14px;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.estate-price-hero__chip-sub {
  margin-top: 1px;
  color: rgb(var(--faint-rgb));
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.estate-price-hero__chip--active {
  border-color: rgb(var(--brand-rgb));
  background: rgb(var(--brand-tint-rgb));
}

.estate-price-hero__chip--active .estate-price-hero__chip-main {
  color: rgb(var(--brand-strong-rgb));
}

.estate-price-hero__more {
  align-items: center;
  color: rgb(var(--brand-rgb));
  font-size: 13px;
  font-weight: 650;
}

.estate-price-hero__body {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px 16px;
  margin: 18px 0 0;
}

.estate-price-hero__cell {
  min-width: 0;
}

.estate-price-hero__cell--lead {
  grid-column: 1 / -1;
  border-bottom: 1px solid rgb(var(--border-rgb));
  padding-bottom: 16px;
}

.estate-price-hero__label {
  margin-bottom: 6px;
  color: rgb(var(--muted-rgb));
  font-size: 13px;
}

.estate-price-hero__value {
  margin: 0;
  color: rgb(var(--strong-rgb));
  font-size: 1.1875rem;
  font-weight: 650;
  line-height: 1.4;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.estate-price-hero__cell--lead .estate-price-hero__value {
  font-size: 2.25rem;
  font-weight: 700;
  line-height: 1.2;
}

.estate-price-hero__note,
.estate-price-hero__change {
  margin: 4px 0 0;
  color: rgb(var(--muted-rgb));
  font-size: 12px;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}

.estate-price-hero__change {
  font-weight: 650;
}

.estate-price-hero__change--up {
  color: rgb(var(--delta-up-rgb));
}

.estate-price-hero__change--down {
  color: rgb(var(--delta-down-rgb));
}

.estate-price-hero__excluded {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 16px 0 0;
  border-radius: 8px;
  background: rgb(var(--paper-rgb));
  padding: 10px 12px;
  color: rgb(var(--muted-rgb));
  font-size: 12px;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}

.estate-price-hero__excluded-link {
  display: inline-flex;
  align-items: center;
  min-height: 44px;
  color: rgb(var(--brand-rgb));
  font-weight: 650;
}

@media (min-width: 768px) {
  .estate-price-hero {
    padding-top: 22px;
  }

  .estate-price-hero__chips {
    flex-wrap: wrap;
    margin: 0;
    padding: 0;
    overflow: visible;
  }

  .estate-price-hero__body {
    display: flex;
    align-items: flex-start;
    gap: 0;
    margin-top: 22px;
  }

  .estate-price-hero__cell {
    flex: 1 1 0;
    padding: 0 24px;
  }

  .estate-price-hero__cell + .estate-price-hero__cell {
    border-left: 1px solid rgb(var(--border-rgb));
  }

  .estate-price-hero__cell--lead {
    flex: 1.5 1 0;
    border-bottom: 0;
    padding: 0 24px 0 0;
  }

  .estate-price-hero__value {
    font-size: 1.3125rem;
  }

  .estate-price-hero__cell--lead .estate-price-hero__value {
    font-size: 2.5rem;
  }

  .estate-price-hero__note,
  .estate-price-hero__change,
  .estate-price-hero__excluded {
    font-size: 13px;
  }

  .estate-price-hero__excluded-link {
    min-height: 0;
  }
}
</style>
