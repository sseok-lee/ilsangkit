<template>
  <div>
    <!-- Loading state -->
    <template v-if="loading">
      <!-- 데스크탑 스켈레톤 -->
      <div class="hidden md:block overflow-x-auto rounded-lg overflow-hidden border border-slate-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200">
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
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
              class="border-b border-slate-100"
            >
              <td v-for="col in columns" :key="col.key" class="px-4 py-3">
                <div class="h-4 bg-slate-200 rounded animate-pulse" />
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
          class="rounded-lg border border-slate-200 p-4 space-y-3"
        >
          <div class="h-4 w-2/3 bg-slate-200 rounded animate-pulse" />
          <div class="h-5 w-1/2 bg-slate-200 rounded animate-pulse" />
          <div class="h-4 w-1/3 bg-slate-200 rounded animate-pulse" />
        </div>
      </div>
    </template>

    <!-- Empty state -->
    <div
      v-else-if="transactions.length === 0"
      class="flex items-center justify-center py-16 text-slate-500 text-sm"
    >
      거래 내역이 없습니다
    </div>

    <!-- 매매 거래 내역 -->
    <template v-else-if="type === 'sale'">
      <!-- 데스크탑 테이블 -->
      <div class="hidden md:block overflow-x-auto rounded-lg overflow-hidden border border-slate-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
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
                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                tx.cancelDealDay ? 'opacity-50' : '',
              ]"
            >
              <td class="px-4 py-3 whitespace-nowrap text-slate-600">
                <span>{{ formatDate(tx) }}</span>
                <span
                  v-if="tx.cancelDealDay"
                  class="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600"
                >
                  취소
                </span>
              </td>
              <td v-if="!hideBuilding" class="px-4 py-3 font-medium text-slate-900">
                {{ tx.buildingName }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ tx.floor != null ? `${tx.floor}층` : '-' }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatArea(tx) }}
              </td>
              <td class="px-4 py-3 font-semibold text-slate-900">
                {{ formatKoreanPrice(tx.dealAmount) }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ pricePerPyeong(tx) ?? '-' }}
              </td>
              <td class="px-4 py-3">
                <span
                  v-if="tx.dealType"
                  :class="[
                    'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                    tx.dealType === '직거래'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-slate-100 text-slate-600',
                  ]"
                >
                  {{ tx.dealType }}
                </span>
                <span v-else class="text-slate-600">-</span>
              </td>
              <td class="px-4 py-3 text-slate-500 text-xs">
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
      <div class="md:hidden space-y-3 px-1">
        <div
          v-for="tx in saleTransactions"
          :key="tx.id"
          :class="[
            'rounded-lg border bg-white p-4',
            tx.cancelDealDay ? 'border-red-200 opacity-60' : 'border-slate-200',
          ]"
        >
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-500">
              {{ formatDate(tx) }}
              <span
                v-if="tx.cancelDealDay"
                class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600"
              >
                취소
              </span>
            </span>
            <span v-if="!hideBuilding" class="font-medium text-slate-900 truncate ml-2 max-w-[55%] text-right">
              {{ tx.buildingName }}
            </span>
          </div>
          <div class="mt-2 flex items-center justify-between">
            <span class="text-base font-semibold text-slate-900">
              {{ formatKoreanPrice(tx.dealAmount) }}
            </span>
            <span
              v-if="tx.dealType"
              :class="[
                'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                tx.dealType === '직거래'
                  ? 'bg-amber-50 text-amber-700'
                  : 'bg-slate-100 text-slate-600',
              ]"
            >
              {{ tx.dealType }}
            </span>
          </div>
          <div class="mt-1.5 text-sm text-slate-500">
            {{ tx.floor != null ? `${tx.floor}층` : '-' }} · {{ formatArea(tx) }}
            <span v-if="pricePerPyeong(tx)" class="ml-1">· 평당 {{ pricePerPyeong(tx) }}</span>
          </div>
          <div v-if="tx.buyerType || tx.sellerType" class="mt-1 text-xs text-slate-500">
            매수 {{ tx.buyerType || '-' }} / 매도 {{ tx.sellerType || '-' }}
          </div>
        </div>
      </div>
    </template>

    <!-- 전월세 거래 내역 -->
    <template v-else>
      <!-- 데스크탑 테이블 -->
      <div class="hidden md:block overflow-x-auto rounded-lg overflow-hidden border border-slate-200">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-slate-200 bg-slate-50">
              <th
                v-for="col in columns"
                :key="col.key"
                class="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap"
              >
                {{ col.label }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="tx in rentTransactions"
              :key="tx.id"
              class="border-b border-slate-100 hover:bg-slate-50 transition-colors"
            >
              <td class="px-4 py-3 whitespace-nowrap text-slate-600">
                {{ formatDate(tx) }}
              </td>
              <td v-if="!hideBuilding" class="px-4 py-3 font-medium text-slate-900">
                {{ tx.buildingName }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ tx.floor != null ? `${tx.floor}층` : '-' }}
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ formatArea(tx) }}
              </td>
              <td class="px-4 py-3 font-semibold text-slate-900">
                <div>{{ formatKoreanPrice(tx.deposit) }}</div>
                <div
                  v-if="depositChangeRate(tx) !== null"
                  :class="[
                    'text-xs mt-0.5',
                    depositChangeRate(tx)! > 0 ? 'text-red-500' : 'text-primary-500',
                  ]"
                >
                  {{ formatChangeRate(depositChangeRate(tx)!) }}
                </div>
              </td>
              <td class="px-4 py-3 text-slate-600">
                <div>{{ formatMonthlyRent(tx) }}</div>
                <div
                  v-if="monthlyRentChangeRate(tx) !== null"
                  :class="[
                    'text-xs mt-0.5',
                    monthlyRentChangeRate(tx)! > 0 ? 'text-red-500' : 'text-primary-500',
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
                <span v-else class="text-slate-600">-</span>
              </td>
              <td class="px-4 py-3 text-slate-600">
                {{ tx.contractTerm || '-' }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 모바일 카드 리스트 -->
      <div class="md:hidden space-y-3 px-1">
        <div
          v-for="tx in rentTransactions"
          :key="tx.id"
          class="rounded-lg border bg-white p-4 border-slate-200"
        >
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-500">{{ formatDate(tx) }}</span>
            <span v-if="!hideBuilding" class="font-medium text-slate-900 truncate ml-2 max-w-[55%] text-right">
              {{ tx.buildingName }}
            </span>
          </div>
          <div class="mt-2 flex items-center gap-2">
            <span class="text-base font-semibold text-slate-900">
              {{ formatKoreanPrice(tx.deposit) }}
              <span
                v-if="depositChangeRate(tx) !== null"
                :class="[
                  'text-xs ml-1',
                  depositChangeRate(tx)! > 0 ? 'text-red-500' : 'text-primary-500',
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
          <div class="mt-1.5 text-sm text-slate-500">
            <template v-if="tx.rentType !== '전세' && tx.monthlyRent">
              월세 {{ formatKoreanPrice(tx.monthlyRent) }}
              <span
                v-if="monthlyRentChangeRate(tx) !== null"
                :class="[
                  'text-xs',
                  monthlyRentChangeRate(tx)! > 0 ? 'text-red-500' : 'text-primary-500',
                ]"
              >
                {{ formatChangeRate(monthlyRentChangeRate(tx)!) }}
              </span>
              ·
            </template>
            {{ tx.floor != null ? `${tx.floor}층` : '-' }} · {{ formatArea(tx) }}
          </div>
          <div v-if="tx.contractTerm" class="mt-1 text-xs text-slate-500">
            계약 {{ tx.contractTerm }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SaleTransaction, RentTransaction } from '~/types/realEstate'
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
}

const props = defineProps<Props>()

const saleTransactions = computed(() => props.transactions as SaleTransaction[])
const rentTransactions = computed(() => props.transactions as RentTransaction[])

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
  return `${tx.dealYear}.${month}.${day}`
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
