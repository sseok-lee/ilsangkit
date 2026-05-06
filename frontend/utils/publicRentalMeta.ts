// 공공임대 상세페이지 표시 헬퍼 + slug↔rentalType 매핑
import type { LhRentalTypeKey } from '~/utils/subscriptionMeta'

export const NO_DATA = '정보없음'

export const RENTAL_TYPE_TO_SLUG: Record<string, LhRentalTypeKey> = {
  매입임대: 'buy-lease',
  전세임대: 'charter',
}

export const SLUG_TO_RENTAL_TYPE: Record<LhRentalTypeKey, string> = {
  'buy-lease': '매입임대',
  charter: '전세임대',
}

export function rentalTypeToSlug(rentalType: string): LhRentalTypeKey | null {
  return RENTAL_TYPE_TO_SLUG[rentalType] ?? null
}

export function fmtArea(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA
  return `${value}㎡`
}

export function fmtCount(value: number | null | undefined, unit: string): string {
  if (value === null || value === undefined) return NO_DATA
  return `${value.toLocaleString()}${unit}`
}

export function fmtCompletionDate(value: string | null | undefined): string {
  if (!value || value.length < 8) return NO_DATA
  return `${value.slice(0, 4)}.${value.slice(4, 6)}.${value.slice(6, 8)}`
}

export function fmtText(value: string | null | undefined): string {
  if (!value || !value.trim()) return NO_DATA
  return value
}

export function fmtDeposit(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) return NO_DATA
  if (amount === 0) return '0원'
  if (amount >= 100_000_000) {
    const eok = Math.floor(amount / 100_000_000)
    const man = Math.floor((amount % 100_000_000) / 10_000)
    return man > 0 ? `${eok}억 ${man.toLocaleString()}만원` : `${eok}억원`
  }
  return `${Math.floor(amount / 10_000).toLocaleString()}만원`
}

export function fmtRent(amount: number | null | undefined, isJeonse: boolean): string {
  if (isJeonse) return '없음 (전세)'
  if (amount === null || amount === undefined) return NO_DATA
  if (amount === 0) return '없음 (전세)'
  return `${Math.floor(amount / 10_000).toLocaleString()}만원`
}

export function isJeonseRental(monthlyRent: number | null | undefined): boolean {
  return monthlyRent === 0 || monthlyRent === null || monthlyRent === undefined
}
