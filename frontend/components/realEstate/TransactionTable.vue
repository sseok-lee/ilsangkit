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
              v-for="tx in transactions"
              :key="tx.id"
              :class="[
                'border-b border-slate-100 hover:bg-slate-50 transition-colors',
                isCancelled(tx) ? 'opacity-50' : '',
              ]"
            >
              <td class="px-4 py-3 whitespace-nowrap text-slate-600">
                <span>{{ formatDate(tx) }}</span>
                <span
                  v-if="isCancelled(tx)"
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
                {{ tx.exclusiveArea != null ? `${tx.exclusiveArea}㎡` : '-' }}
              </td>

              <!-- 매매 전용: 거래금액 + 평당가 + 거래유형 + 매수/매도자 -->
              <template v-if="type === 'sale'">
                <td class="px-4 py-3 font-semibold text-slate-900">
                  {{ formatAmount((tx as SaleTransaction).dealAmount) }}
                </td>
                <td class="px-4 py-3 text-slate-600">
                  {{ pricePerPyeong(tx as SaleTransaction) }}
                </td>
                <td class="px-4 py-3 text-slate-600">
                  {{ (tx as SaleTransaction).dealType || '-' }}
                </td>
                <td class="px-4 py-3 text-slate-500 text-xs">
                  <template v-if="(tx as SaleTransaction).buyerType || (tx as SaleTransaction).sellerType">
                    {{ (tx as SaleTransaction).buyerType || '-' }} / {{ (tx as SaleTransaction).sellerType || '-' }}
                  </template>
                  <template v-else>-</template>
                </td>
              </template>

              <!-- 전월세 전용: 보증금, 월세, 구분, 계약유형, 계약기간 -->
              <template v-else>
                <td class="px-4 py-3 font-semibold text-slate-900">
                  <div>{{ formatAmount((tx as RentTransaction).deposit) }}</div>
                  <div
                    v-if="depositChangeRate(tx as RentTransaction) !== null"
                    :class="[
                      'text-xs mt-0.5',
                      depositChangeRate(tx as RentTransaction)! > 0 ? 'text-red-500' : 'text-blue-500',
                    ]"
                  >
                    {{ formatChangeRate(depositChangeRate(tx as RentTransaction)!) }}
                  </div>
                </td>
                <td class="px-4 py-3 text-slate-600">
                  <div>{{ formatMonthlyRent(tx as RentTransaction) }}</div>
                  <div
                    v-if="monthlyRentChangeRate(tx as RentTransaction) !== null"
                    :class="[
                      'text-xs mt-0.5',
                      monthlyRentChangeRate(tx as RentTransaction)! > 0 ? 'text-red-500' : 'text-blue-500',
                    ]"
                  >
                    {{ formatChangeRate(monthlyRentChangeRate(tx as RentTransaction)!) }}
                  </div>
                </td>
                <td class="px-4 py-3">
                  <span
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                      (tx as RentTransaction).rentType === '전세'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-orange-50 text-orange-700',
                    ]"
                  >
                    {{ (tx as RentTransaction).rentType }}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <span
                    v-if="(tx as RentTransaction).contractType"
                    :class="[
                      'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                      (tx as RentTransaction).contractType === '갱신'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-green-50 text-green-700',
                    ]"
                  >
                    {{ (tx as RentTransaction).contractType }}
                  </span>
                  <span v-else class="text-slate-600">-</span>
                </td>
                <td class="px-4 py-3 text-slate-600">
                  {{ (tx as RentTransaction).contractTerm || '-' }}
                </td>
              </template>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- 모바일 카드 리스트 -->
      <div class="md:hidden space-y-3 px-1">
        <div
          v-for="tx in transactions"
          :key="tx.id"
          :class="[
            'rounded-lg border bg-white p-4',
            isCancelled(tx) ? 'border-red-200 opacity-60' : 'border-slate-200',
          ]"
        >
          <!-- 상단: 거래일 + 건물명 -->
          <div class="flex items-center justify-between text-sm">
            <span class="text-slate-500">
              {{ formatDate(tx) }}
              <span
                v-if="isCancelled(tx)"
                class="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600"
              >
                취소
              </span>
            </span>
            <span v-if="!hideBuilding" class="font-medium text-slate-900 truncate ml-2 max-w-[55%] text-right">
              {{ tx.buildingName }}
            </span>
          </div>

          <!-- 매매 카드 -->
          <template v-if="type === 'sale'">
            <div class="mt-2 flex items-baseline justify-between">
              <span class="text-base font-semibold text-slate-900">
                {{ formatAmount((tx as SaleTransaction).dealAmount) }}
              </span>
              <span class="text-xs text-slate-500">
                {{ (tx as SaleTransaction).dealType || '' }}
              </span>
            </div>
            <div class="mt-1.5 text-sm text-slate-500">
              {{ tx.floor != null ? `${tx.floor}층` : '-' }} · {{ tx.exclusiveArea != null ? `${tx.exclusiveArea}㎡` : '-' }}
              <span v-if="pricePerPyeong(tx as SaleTransaction) !== '-'" class="ml-1">· 평당 {{ pricePerPyeong(tx as SaleTransaction) }}</span>
            </div>
            <div v-if="(tx as SaleTransaction).buyerType || (tx as SaleTransaction).sellerType" class="mt-1 text-xs text-slate-500">
              매수 {{ (tx as SaleTransaction).buyerType || '-' }} / 매도 {{ (tx as SaleTransaction).sellerType || '-' }}
            </div>
          </template>

          <!-- 전월세 카드 -->
          <template v-else>
            <div class="mt-2 flex items-center gap-2">
              <span class="text-base font-semibold text-slate-900">
                {{ formatAmount((tx as RentTransaction).deposit) }}
                <span
                  v-if="depositChangeRate(tx as RentTransaction) !== null"
                  :class="[
                    'text-xs ml-1',
                    depositChangeRate(tx as RentTransaction)! > 0 ? 'text-red-500' : 'text-blue-500',
                  ]"
                >
                  {{ formatChangeRate(depositChangeRate(tx as RentTransaction)!) }}
                </span>
              </span>
              <span
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                  (tx as RentTransaction).rentType === '전세'
                    ? 'bg-blue-50 text-blue-700'
                    : 'bg-orange-50 text-orange-700',
                ]"
              >
                {{ (tx as RentTransaction).rentType }}
              </span>
              <span
                v-if="(tx as RentTransaction).contractType"
                :class="[
                  'inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium',
                  (tx as RentTransaction).contractType === '갱신'
                    ? 'bg-purple-50 text-purple-700'
                    : 'bg-green-50 text-green-700',
                ]"
              >
                {{ (tx as RentTransaction).contractType }}
              </span>
            </div>
            <div class="mt-1.5 text-sm text-slate-500">
              <template v-if="(tx as RentTransaction).rentType !== '전세' && (tx as RentTransaction).monthlyRent">
                월세 {{ formatAmount((tx as RentTransaction).monthlyRent!) }}
                <span
                  v-if="monthlyRentChangeRate(tx as RentTransaction) !== null"
                  :class="[
                    'text-xs',
                    monthlyRentChangeRate(tx as RentTransaction)! > 0 ? 'text-red-500' : 'text-blue-500',
                  ]"
                >
                  {{ formatChangeRate(monthlyRentChangeRate(tx as RentTransaction)!) }}
                </span>
                ·
              </template>
              {{ tx.floor != null ? `${tx.floor}층` : '-' }} · {{ tx.exclusiveArea != null ? `${tx.exclusiveArea}㎡` : '-' }}
            </div>
            <div v-if="(tx as RentTransaction).contractTerm" class="mt-1 text-xs text-slate-500">
              계약 {{ (tx as RentTransaction).contractTerm }}
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { SaleTransaction, RentTransaction } from '~/types/realEstate'

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
  return formatAmount(tx.monthlyRent)
}

function formatAmount(amount: number): string {
  const uk = Math.floor(amount / 10000) // 억 단위
  const man = amount % 10000           // 만원 단위
  if (uk > 0 && man > 0) {
    return `${uk}억 ${man.toLocaleString()}만원`
  }
  if (uk > 0) {
    return `${uk}억`
  }
  return `${amount.toLocaleString()}만원`
}

function pricePerPyeong(tx: SaleTransaction): string {
  if (tx.exclusiveArea == null || tx.exclusiveArea === 0) return '-'
  const pyeong = tx.exclusiveArea / 3.305
  const price = Math.round(tx.dealAmount / pyeong)
  return formatAmount(price)
}

function isCancelled(tx: SaleTransaction | RentTransaction): boolean {
  if (props.type !== 'sale') return false
  return !!(tx as SaleTransaction).cancelDealDay
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
