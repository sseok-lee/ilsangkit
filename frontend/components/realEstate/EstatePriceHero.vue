<template>
  <section class="estate-price-hero" aria-label="면적별 최근 거래가" :aria-busy="pending">
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

    <dl class="estate-price-hero__body" data-testid="estate-price-body">
      <div
        v-for="cell in cells"
        :key="cell.label"
        class="estate-price-hero__cell"
        :class="{ 'estate-price-hero__cell--lead': cell.lead }"
      >
        <dt class="estate-price-hero__label">{{ cell.label }}</dt>
        <dd
          class="estate-price-hero__value"
          :class="{ 'estate-price-hero__value--empty': cell.empty }"
        >
{{ cell.value }}
</dd>
        <dd v-if="cell.note" class="estate-price-hero__note">{{ cell.note }}</dd>
        <dd v-if="cell.median" class="estate-price-hero__median" data-testid="estate-price-median">
          {{ cell.median.text }}<span
            v-if="cell.median.change"
            class="estate-price-hero__change"
            :class="cell.median.change.tone ? `estate-price-hero__change--${cell.median.change.tone}` : undefined"
          > · {{ cell.median.change.text }}</span>
        </dd>
      </div>
    </dl>

    <div v-if="areaRows.length > 1" class="estate-price-hero__table-wrap" data-testid="estate-area-latest">
      <table class="estate-price-hero__table">
        <caption class="estate-price-hero__caption">
최근 3년 중 가장 최근 거래 · 출처 국토교통부 실거래가
</caption>
        <thead>
          <tr>
            <th scope="col">
전용면적
</th>
            <th scope="col">
매매
</th>
            <th scope="col">
전세
</th>
            <th scope="col">
월세
</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="row in areaRows"
            :key="row.key"
            class="estate-price-hero__row"
            :class="{
              'estate-price-hero__row--active': row.key === activeKey,
              'estate-price-hero__row--selectable': row.selectable,
            }"
            :aria-current="row.key === activeKey ? 'true' : undefined"
            @click="row.selectable && emit('select-area', row.key)"
          >
            <th scope="row">
              <button
                v-if="row.selectable"
                type="button"
                class="estate-price-hero__row-button"
                :aria-pressed="row.key === activeKey ? 'true' : 'false'"
                @click.stop="emit('select-area', row.key)"
              >
                {{ row.label }}㎡ · {{ row.pyeong }}평
              </button>
              <span v-else class="estate-price-hero__row-label">{{ row.label }}㎡ · {{ row.pyeong }}평</span>
            </th>
            <td v-for="(cell, index) in row.cells" :key="index">
              <template v-if="cell">
                <span class="estate-price-hero__table-value">{{ cell.value }}</span>
                <span class="estate-price-hero__table-date">{{ cell.month }}</span>
              </template>
              <template v-else>
-
</template>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { formatKoreanPrice, formatWolsePrice } from '~/utils/formatters'
import { resolveHeroBasis } from '~/utils/realEstateDetailPrice'
import type { AreaGroup, DetailOverview } from '~/types/housingRedesign'

const props = withDefaults(defineProps<{
  overview: DetailOverview
  selectedArea: string | null
  pending?: boolean
}>(), { pending: false })

const emit = defineEmits<{
  'select-area': [key: string]
}>()

const VISIBLE_CHIP_LIMIT = 6

const hero = computed(() => resolveHeroBasis(props.overview, props.selectedArea))
const activeKey = computed(() => hero.value.groupKey)

function groupCount(group: AreaGroup): number {
  return props.overview.basisMode === 'jeonse' ? group.jeonseCount36m : group.saleCount36m
}

function countLabel(group: AreaGroup): string {
  const prefix = props.overview.basisMode === 'jeonse' ? '전세' : '매매'
  return `${prefix} ${groupCount(group).toLocaleString()}건`
}

const byCount = (a: AreaGroup, b: AreaGroup): number => groupCount(b) - groupCount(a) || Number(a.key) - Number(b.key)

// 현재 모드(매매/전세) 거래가 없는 그룹은 칩으로 내지 않는다(누르면 아래 필터가 area-reset 된다). 선택된 그룹만 예외.
const sortedGroups = computed(() =>
  [...(props.overview.areaGroups ?? [])]
    .filter(group => groupCount(group) > 0 || group.key === activeKey.value)
    .sort(byCount),
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

function shortMonth(date: string): string {
  const [year, month] = date.split('-')
  return [year?.slice(2), month].filter(Boolean).join('.')
}

function dealLine(deal: { date: string; floor: number | null; direct?: boolean }): string {
  const parts = [shortDate(deal.date)]
  if (deal.floor != null) parts.push(`${deal.floor}층`)
  if (deal.direct) parts.push('직거래')
  return parts.join(' · ')
}

interface HeroCell {
  label: string
  value: string
  note?: string
  median?: { text: string; change?: { text: string; tone: 'up' | 'down' | null } }
  lead?: boolean
  empty?: boolean
}

function changeLine(rate: number | null): { text: string; tone: 'up' | 'down' | null } | undefined {
  if (rate == null || !Number.isFinite(rate)) return undefined
  const percent = Math.trunc(Math.round(rate * 1e4) / 100)
  if (percent > 0) return { text: `1년 전보다 +${percent}%`, tone: 'up' }
  if (percent < 0) return { text: `1년 전보다 −${Math.abs(percent)}%`, tone: 'down' }
  return { text: '1년 전보다 변동 없음', tone: null }
}

// 주 숫자 = 선택 그룹·모드의 가장 최근 거래 1건(사실). 최근 1년 중간값은 그 아래 보조 줄.
const cells = computed<HeroCell[]>(() => {
  const { basis, saleLatest } = hero.value
  const jeonse = props.overview.basisMode === 'jeonse'
  const latest = basis?.latestAny ?? null

  const lead: HeroCell = latest
    ? { label: jeonse ? '최근 전세' : '최근 매매', value: formatKoreanPrice(latest.amount), note: dealLine(latest), lead: true }
    : { label: jeonse ? '최근 전세' : '최근 매매', value: '최근 3년 거래 없음', lead: true, empty: true }
  if (basis?.representative != null) {
    lead.median = {
      text: `최근 1년 ${basis.sampleCount}건 중간 ${formatKoreanPrice(basis.representative)}`,
      change: changeLine(basis.changeRate),
    }
  }

  const result: HeroCell[] = [lead]
  if (basis?.max12m != null) {
    result.push({ label: '최고가 · 12개월', value: formatKoreanPrice(basis.max12m) })
  }
  if (jeonse && saleLatest) {
    result.push({ label: '최근 매매', value: formatKoreanPrice(saleLatest.amount), note: dealLine(saleLatest) })
  }
  return result
})

interface TableCell {
  value: string
  month: string
}

// 면적별 최근 거래가 표: 칩과 같은 순서·라벨, 그룹 전부(현재 모드 거래가 없는 그룹도 다른 모드 칸이 있을 수 있다).
// 현재 모드 거래가 없는 행은 칩처럼 고를 수 없다(고르면 아래 필터가 area-reset 된다) — 보기 전용.
const areaRows = computed(() =>
  [...(props.overview.areaGroups ?? [])].sort(byCount).map((group) => {
    const sale = props.overview.saleBasis?.[group.key]?.latestAny ?? null
    const jeonse = props.overview.jeonseBasis?.[group.key]?.latestAny ?? null
    const wolse = props.overview.wolseLatest?.[group.key] ?? null
    const cells: Array<TableCell | null> = [
      sale ? { value: formatKoreanPrice(sale.amount), month: shortMonth(sale.date) } : null,
      jeonse ? { value: formatKoreanPrice(jeonse.amount), month: shortMonth(jeonse.date) } : null,
      wolse
        ? { value: formatWolsePrice(wolse.deposit, wolse.monthlyRent), month: shortMonth(wolse.date) }
        : null,
    ]
    return { key: group.key, label: group.label, pyeong: group.pyeong, selectable: groupCount(group) > 0, cells }
  }),
)
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
.estate-price-hero__more:focus-visible {
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
.estate-price-hero__median {
  margin: 4px 0 0;
  color: rgb(var(--muted-rgb));
  font-size: 12px;
  line-height: 1.6;
  font-variant-numeric: tabular-nums;
}

.estate-price-hero__change {
  font-weight: 650;
}

.estate-price-hero__cell--lead .estate-price-hero__value--empty {
  color: rgb(var(--muted-rgb));
  font-size: 1.1875rem;
  font-weight: 650;
}

.estate-price-hero__change--up {
  color: rgb(var(--delta-up-rgb));
}

.estate-price-hero__change--down {
  color: rgb(var(--delta-down-rgb));
}

.estate-price-hero__table-wrap {
  margin-top: 20px;
}

.estate-price-hero__table {
  width: 100%;
  table-layout: fixed;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

.estate-price-hero__table th,
.estate-price-hero__table td {
  border-bottom: 1px solid rgb(var(--border-rgb));
  padding: 8px 4px;
  text-align: left;
  vertical-align: top;
  /* 360px 에서도 넘치지 않게 줄바꿈은 허용하되, 금액은 글자 단위가 아니라 띄어쓰기에서 끊는다. */
  word-break: keep-all;
  overflow-wrap: anywhere;
}

.estate-price-hero__table thead th {
  color: rgb(var(--muted-rgb));
  font-size: 12px;
  font-weight: 500;
}

.estate-price-hero__table td {
  color: rgb(var(--strong-rgb));
}

.estate-price-hero__row--selectable {
  cursor: pointer;
}

.estate-price-hero__row--active {
  background: rgb(var(--brand-tint-rgb));
}

.estate-price-hero__row-label {
  color: rgb(var(--muted-rgb));
  font-weight: 500;
}

.estate-price-hero__row-button {
  padding: 0;
  border: 0;
  background: none;
  color: rgb(var(--strong-rgb));
  font: inherit;
  font-weight: 650;
  text-align: left;
}

.estate-price-hero__row--active .estate-price-hero__row-button {
  color: rgb(var(--brand-strong-rgb));
}

.estate-price-hero__row-button:focus-visible {
  outline: 2px solid rgb(var(--brand-rgb));
  outline-offset: 2px;
}

.estate-price-hero__table-value,
.estate-price-hero__table-date {
  display: block;
}

.estate-price-hero__table-date {
  margin-top: 2px;
  color: rgb(var(--faint-rgb));
  font-size: 11px;
}

.estate-price-hero__caption {
  caption-side: bottom;
  margin-top: 8px;
  color: rgb(var(--faint-rgb));
  font-size: 12px;
  text-align: left;
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
  .estate-price-hero__median {
    font-size: 13px;
  }

  .estate-price-hero__table {
    font-size: 14px;
  }

  .estate-price-hero__table th,
  .estate-price-hero__table td {
    padding: 10px 8px;
  }
}
</style>
