<template>
  <div>
    <!-- Loading state -->
    <template v-if="loading">
      <!-- 데스크탑 스켈레톤 -->
      <div class="hidden md:block overflow-x-auto rounded-lg overflow-hidden border border-line">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="border-b border-line">
              <th
                v-for="col in columns"
                :key="col.key"
                :class="[
                  'px-4 py-3 text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap',
                  numericColumnKeys.has(col.key) ? 'text-right' : 'text-left',
                ]"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="i in 5"
              :key="i"
              data-testid="skeleton-row"
              class="border-b border-line"
            >
              <td v-for="col in columns" :key="col.key" class="px-4 py-3">
                <div class="h-4 bg-line rounded animate-pulse" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <!-- 모바일 스켈레톤 -->
      <div class="md:hidden space-y-3 px-1">
        <div
          v-for="i in 5"
          :key="i"
          data-testid="skeleton-card"
          class="rounded-lg border border-line p-4 space-y-3"
        >
          <div class="h-4 w-2/3 bg-line rounded animate-pulse" />
          <div class="h-5 w-1/2 bg-line rounded animate-pulse" />
          <div class="h-4 w-1/3 bg-line rounded animate-pulse" />
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div
      v-else-if="transactions.length === 0"
      class="flex items-center justify-center py-16 text-muted text-sm"
    >
      {{ emptyFiltered('거래 내역') }}
    </div>

    <!-- 매매 거래 내역 -->
    <template v-else-if="type === 'sale'">
      <!-- 데스크탑 테이블 -->
      <div class="hidden md:block overflow-x-auto rounded-lg overflow-hidden border border-line">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="border-b border-line bg-background-light">
              <th
                v-for="col in columns"
                :key="col.key"
                :class="[
                  'px-4 py-3 text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap',
                  numericColumnKeys.has(col.key) ? 'text-right' : 'text-left',
                ]"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tx in saleTransactions"
              :key="tx.id"
              :class="[
                'border-b border-line hover:bg-background-light transition-colors',
                tx.cancelDealDay ? 'opacity-50' : '',
              ]"
            >
              <td class="px-4 py-3 whitespace-nowrap text-muted">
                <span>{{ formatDate(tx) }}</span>
                <span
                  v-if="tx.cancelDealDay"
                  class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600"
                >
                  취소
                </span>
              </td>
              <td v-if="!hideBuilding" class="px-4 py-3 font-medium text-ink">
                {{ tx.buildingName }}
              </td>
              <td class="px-4 py-3 text-right text-muted">
                {{ tx.floor != null ? `${tx.floor}층` : '-' }}
              </td>
              <td class="px-4 py-3 text-right text-muted">
                {{ formatArea(tx) }}
              </td>
              <td class="px-4 py-3 text-right font-display font-bold text-strong tabular-nums">
                {{ formatKoreanPrice(tx.dealAmount) }}
              </td>
              <td class="px-4 py-3 text-right text-muted">
                {{ pricePerPyeong(tx) ?? '-' }}
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="tx.dealType"
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                    tx.dealType === '직거래'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-background-light text-muted',
                  ]"
                >
                  {{ tx.dealType }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="px-4 py-3 text-muted text-xs">
                <template v-if="tx.buyerType || tx.sellerType">
                  {{ tx.buyerType || '-' }} / {{ tx.sellerType || '-' }}
                </template>
                <template v-else>-</template>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 모바일 카드 리스트 -->
      <div v-if="!isDetailPresentation" class="md:hidden space-y-3 px-1">
        <div
          v-for="tx in saleTransactions"
          :key="tx.id"
          :class="[
            'rounded-lg border bg-white p-4',
            tx.cancelDealDay ? 'border-red-200 opacity-60' : 'border-line',
          ]"
        >
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">
              {{ formatDate(tx) }}
              <span
                v-if="tx.cancelDealDay"
                class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600"
              >
                취소
              </span>
            </span>
            <span v-if="!hideBuilding" class="font-medium text-ink truncate ml-2 max-w-[55%] text-right">
              {{ tx.buildingName }}
            </span>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-base font-display font-bold text-strong tabular-nums">
              {{ formatKoreanPrice(tx.dealAmount) }}
            </span>
            <span
              v-if="tx.dealType"
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                tx.dealType === '직거래'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-background-light text-muted',
              ]"
            >
              {{ tx.dealType }}
            </span>
          </div>
          <div class="mt-1.5 text-sm text-muted">
            {{ tx.floor != null ? `${tx.floor}층` : '-' }} · {{ formatArea(tx) }}
            <span v-if="pricePerPyeong(tx)" class="ml-1">· 평당 {{ pricePerPyeong(tx) }}</span>
          </div>
          <div v-if="tx.buyerType || tx.sellerType" class="mt-1 text-xs text-muted">
            매수 {{ tx.buyerType || '-' }} / 매도 {{ tx.sellerType || '-' }}
          </div>
        </div>
      </div>
      <div v-else class="md:hidden space-y-3 px-1">
        <article
          v-for="tx in saleTransactions"
          :key="tx.id"
          data-testid="detail-transaction-card"
          :class="[
            'rounded-lg border bg-white p-4',
            tx.cancelDealDay ? 'border-red-200 opacity-60' : 'border-line',
          ]"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-muted">{{ formatDate(tx) }}</p>
              <strong class="mt-1 block font-display text-lg text-strong tabular-nums">
                {{ formatDetailKoreanPrice(tx.dealAmount) }}
              </strong>
            </div>
            <span
              v-if="tx.cancelDealDay"
              class="inline-flex items-center rounded bg-red-50 px-1.5 py-0.5 text-xs font-medium text-red-600"
            >
              취소
            </span>
          </div>
          <details class="mt-3 border-t border-line pt-3 text-sm text-muted">
            <summary class="min-h-11 cursor-pointer py-2 font-medium text-primary-700">
              거래 정보 보기
            </summary>
            <dl class="grid gap-2 pt-2">
              <div v-if="!hideBuilding" class="flex justify-between gap-3">
                <dt>건물</dt>
                <dd class="text-right text-strong">{{ tx.buildingName }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>층</dt>
                <dd class="text-right text-strong">{{ floorDetailLabel(tx.floor) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>면적</dt>
                <dd class="text-right text-strong">전용 {{ formatArea(tx) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>거래유형</dt>
                <dd class="text-right text-strong">{{ tx.dealType || '-' }}</dd>
              </div>
              <div v-if="tx.buyerType || tx.sellerType" class="flex justify-between gap-3">
                <dt>매수/매도</dt>
                <dd class="text-right text-strong">{{ tx.buyerType || '-' }} / {{ tx.sellerType || '-' }}</dd>
              </div>
            </dl>
          </details>
        </article>
      </div>
    </template>

    <!-- 전월세 거래 내역 -->
    <template v-else>
      <!-- 데스크탑 테이블 -->
      <div class="hidden md:block overflow-x-auto rounded-lg overflow-hidden border border-line">
        <table class="w-full text-sm tabular-nums">
          <thead>
            <tr class="border-b border-line bg-background-light">
              <th
                v-for="col in columns"
                :key="col.key"
                :class="[
                  'px-4 py-3 text-xs font-semibold text-faint uppercase tracking-wider whitespace-nowrap',
                  numericColumnKeys.has(col.key) ? 'text-right' : 'text-left',
                ]"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tx in rentTransactions"
              :key="tx.id"
              class="border-b border-line hover:bg-background-light transition-colors"
            >
              <td class="px-4 py-3 whitespace-nowrap text-muted">
                {{ formatDate(tx) }}
              </td>
              <td v-if="!hideBuilding" class="px-4 py-3 font-medium text-ink">
                {{ tx.buildingName }}
              </td>
              <td class="px-4 py-3 text-right text-muted">
                {{ tx.floor != null ? `${tx.floor}층` : '-' }}
              </td>
              <td class="px-4 py-3 text-right text-muted">
                {{ formatArea(tx) }}
              </td>
              <td class="px-4 py-3 text-right font-display font-bold text-strong tabular-nums">
                <div>{{ formatKoreanPrice(tx.deposit) }}</div>
                <div
                  v-if="depositChangeRate(tx) !== null"
                  :class="[
                    'text-xs mt-0.5',
                    depositChangeRate(tx)! > 0 ? 'text-delta-up' : 'text-delta-down',
                  ]"
                >
                  {{ formatChangeRate(depositChangeRate(tx)!) }}
                </div>
              </td>
              <td class="px-4 py-3 text-right text-muted">
                <div>{{ formatMonthlyRent(tx) }}</div>
                <div
                  v-if="monthlyRentChangeRate(tx) !== null"
                  :class="[
                    'text-xs mt-0.5',
                    monthlyRentChangeRate(tx)! > 0 ? 'text-delta-up' : 'text-delta-down',
                  ]"
                >
                  {{ formatChangeRate(monthlyRentChangeRate(tx)!) }}
                </div>
              </td>
              <td class="px-4 py-3">
                <span
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                    tx.rentType === '전세'
                      ? 'bg-primary-50 text-primary-700'
                      : 'bg-orange-50 text-orange-700',
                  ]"
                >
                  {{ tx.rentType }}
                </span>
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="tx.contractType"
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                    tx.contractType === '갱신'
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-green-50 text-green-700',
                  ]"
                >
                  {{ tx.contractType }}
                </span>
                <span v-else class="text-muted">-</span>
              </td>
              <td class="px-4 py-3 text-muted">
                {{ tx.contractTerm || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 모바일 카드 리스트 -->
      <div v-if="!isDetailPresentation" class="md:hidden space-y-3 px-1">
        <div
          v-for="tx in rentTransactions"
          :key="tx.id"
          class="rounded-lg border bg-white p-4 border-line"
        >
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted">{{ formatDate(tx) }}</span>
            <span v-if="!hideBuilding" class="font-medium text-ink truncate ml-2 max-w-[55%] text-right">
              {{ tx.buildingName }}
            </span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <span class="text-base font-display font-bold text-strong tabular-nums">
              {{ formatKoreanPrice(tx.deposit) }}
              <span
                v-if="depositChangeRate(tx) !== null"
                :class="[
                  'text-xs ml-1',
                  depositChangeRate(tx)! > 0 ? 'text-delta-up' : 'text-delta-down',
                ]"
              >
                {{ formatChangeRate(depositChangeRate(tx)!) }}
              </span>
            </span>
            <span
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                tx.rentType === '전세'
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-orange-50 text-orange-700',
              ]"
            >
              {{ tx.rentType }}
            </span>
            <span
              v-if="tx.contractType"
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                tx.contractType === '갱신'
                  ? 'bg-purple-50 text-purple-700'
                  : 'bg-green-50 text-green-700',
              ]"
            >
              {{ tx.contractType }}
            </span>
          </div>
          <div class="mt-1.5 text-sm text-muted">
            <template v-if="tx.rentType !== '전세' && tx.monthlyRent">
              월세 {{ formatKoreanPrice(tx.monthlyRent) }}
              <span
                v-if="monthlyRentChangeRate(tx) !== null"
                :class="[
                  'text-xs',
                  monthlyRentChangeRate(tx)! > 0 ? 'text-delta-up' : 'text-delta-down',
                ]"
              >
                {{ formatChangeRate(monthlyRentChangeRate(tx)!) }}
              </span>
              ·
            </template>
            {{ tx.floor != null ? `${tx.floor}층` : '-' }} · {{ formatArea(tx) }}
          </div>
          <div v-if="tx.contractTerm" class="mt-1 text-xs text-muted">
            계약 {{ tx.contractTerm }}
          </div>
        </div>
      </div>
      <div v-else class="md:hidden space-y-3 px-1">
        <article
          v-for="tx in rentTransactions"
          :key="tx.id"
          data-testid="detail-transaction-card"
          class="rounded-lg border border-line bg-white p-4"
        >
          <div class="flex items-start justify-between gap-4">
            <div>
              <p class="text-sm text-muted">{{ formatDate(tx) }}</p>
              <strong class="mt-1 block font-display text-lg text-strong tabular-nums">
                {{ formatRentDetailPrice(tx) }}
              </strong>
            </div>
            <span
              :class="[
                'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium',
                tx.rentType === '전세'
                  ? 'bg-primary-50 text-primary-700'
                  : 'bg-orange-50 text-orange-700',
              ]"
            >
              {{ tx.rentType }}
            </span>
          </div>
          <details class="mt-3 border-t border-line pt-3 text-sm text-muted">
            <summary class="min-h-11 cursor-pointer py-2 font-medium text-primary-700">
              거래 정보 보기
            </summary>
            <dl class="grid gap-2 pt-2">
              <div v-if="!hideBuilding" class="flex justify-between gap-3">
                <dt>건물</dt>
                <dd class="text-right text-strong">{{ tx.buildingName }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>층</dt>
                <dd class="text-right text-strong">{{ floorDetailLabel(tx.floor) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>면적</dt>
                <dd class="text-right text-strong">전용 {{ formatArea(tx) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>계약구분</dt>
                <dd class="text-right text-strong">{{ tx.contractType || '-' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>갱신권</dt>
                <dd class="text-right text-strong">{{ tx.useRenewalRight || '-' }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>종전금액</dt>
                <dd class="text-right text-strong">{{ previousRentLabel(tx) }}</dd>
              </div>
              <div class="flex justify-between gap-3">
                <dt>기간</dt>
                <dd class="text-right text-strong">{{ tx.contractTerm ? `계약 ${tx.contractTerm}개월` : '-' }}</dd>
              </div>
            </dl>
          </details>
        </article>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SaleTransaction, RentTransaction } from '~/types/realEstate'
import { emptyFiltered } from '~/utils/uiMessages'
import { formatKoreanPrice } from '~/utils/formatters'

interface Column {
  key: string
  label: string
}

interface Props {
  transactions: (SaleTransaction | RentTransaction)[]
  type: 'sale' | 'rent'
  loading: boolean
  hideBuilding?: boolean
  presentation?: 'default' | 'detail'
}

const props = defineProps<Props>()

const saleTransactions = computed(() => props.transactions as SaleTransaction[])
const rentTransactions = computed(() => props.transactions as RentTransaction[])
const isDetailPresentation = computed(() => props.presentation === 'detail')

const saleColumnsAll: Column[] = [
  { key: 'date', label: '거래일' },
  { key: 'buildingName', label: '건물명' },
  { key: 'floor', label: '층' },
  { key: 'exclusiveArea', label: '전용면적(㎡)' },
  { key: 'dealAmount', label: '거래금액' },
  { key: 'pricePerPyeong', label: '평당가' },
  { key: 'dealType', label: '거래유형' },
  { key: 'parties', label: '매수/매도' },
]

const rentColumnsAll: Column[] = [
  { key: 'date', label: '거래일' },
  { key: 'buildingName', label: '건물명' },
  { key: 'floor', label: '층' },
  { key: 'exclusiveArea', label: '전용면적(㎡)' },
  { key: 'deposit', label: '보증금' },
  { key: 'monthlyRent', label: '월세' },
  { key: 'rentType', label: '전월세구분' },
  { key: 'contractType', label: '계약유형' },
  { key: 'contractTerm', label: '계약기간' },
]

const numericColumnKeys = new Set(['floor', 'exclusiveArea', 'dealAmount', 'pricePerPyeong', 'deposit', 'monthlyRent'])

const columns = computed(() => {
  const base = props.type === 'sale' ? saleColumnsAll : rentColumnsAll
  if (props.hideBuilding) {
    return base.filter((c) => c.key !== 'buildingName')
  }
  return base
})

function formatDate(tx: SaleTransaction | RentTransaction): string {
  const month = String(tx.dealMonth).padStart(2, '0')
  const day = tx.dealDay != null ? String(tx.dealDay).padStart(2, '0') : '01'
  return `${String(tx.dealYear).slice(2)}.${month}.${day}`
}

function formatMonthlyRent(tx: RentTransaction): string {
  if (tx.rentType === '전세' || tx.monthlyRent == null || tx.monthlyRent === 0) return '-'
  return formatKoreanPrice(tx.monthlyRent)
}

// Prisma Decimal은 문자열로 직렬화되므로 Number 변환
function getArea(tx: SaleTransaction | RentTransaction): number | null {
  const raw = tx.exclusiveArea
  if (raw == null || raw === '') return null
  const num = typeof raw === 'number' ? raw : parseFloat(String(raw))
  return Number.isFinite(num) && num > 0 ? num : null
}

function formatArea(tx: SaleTransaction | RentTransaction): string {
  const area = getArea(tx)
  return area != null ? `${area}㎡` : '-'
}

function formatDetailKoreanPrice(amount: number): string {
  const roundedAmount = Math.round(amount)
  const eok = Math.floor(roundedAmount / 10000)
  const man = roundedAmount % 10000
  const jo = Math.floor(eok / 10000)
  const eokRemainder = eok % 10000
  if (jo > 0) {
    const eokLabel = `${eokRemainder}억`
    return man > 0
      ? `${jo}만 ${eokLabel} ${man.toLocaleString()}만원`
      : `${jo}만 ${eokLabel}`
  }
  return formatKoreanPrice(amount)
}

function floorDetailLabel(floor: number | null): string {
  return floor == null ? '층 정보 없음' : `${floor}층`
}

function formatRentDetailPrice(tx: RentTransaction): string {
  if (tx.rentType === '전세') return formatDetailKoreanPrice(tx.deposit)
  return `${formatDetailKoreanPrice(tx.deposit)} / ${formatDetailKoreanPrice(tx.monthlyRent ?? 0)}`
}

function previousRentLabel(tx: RentTransaction): string {
  if (tx.preDeposit == null && tx.preMonthlyRent == null) return '-'
  if (tx.rentType === '전세') {
    return tx.preDeposit == null ? '-' : `이전 ${formatDetailKoreanPrice(tx.preDeposit)}`
  }
  return `이전 ${formatDetailKoreanPrice(tx.preDeposit ?? 0)} / ${formatDetailKoreanPrice(tx.preMonthlyRent ?? 0)}`
}

function pricePerPyeong(tx: SaleTransaction): string | null {
  const area = getArea(tx)
  if (area == null) return null
  const pyeong = area / 3.305
  const price = Math.round(tx.dealAmount / pyeong)
  return formatKoreanPrice(price)
}

function depositChangeRate(tx: RentTransaction): number | null {
  if (tx.preDeposit == null || tx.preDeposit === 0) return null
  return ((tx.deposit - tx.preDeposit) / tx.preDeposit) * 100
}

function monthlyRentChangeRate(tx: RentTransaction): number | null {
  if (tx.monthlyRent == null || tx.preMonthlyRent == null || tx.preMonthlyRent === 0) return null
  return ((tx.monthlyRent - tx.preMonthlyRent) / tx.preMonthlyRent) * 100
}

function formatChangeRate(rate: number): string {
  const sign = rate > 0 ? '↑' : '↓'
  return `${sign}${Math.abs(rate).toFixed(1)}%`
}
</script>
