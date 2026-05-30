import type { TransactionMode } from '~/types/realEstate'

export function getDetailEyebrow(label: string, mode: TransactionMode): string {
  return mode === 'sale' ? `${label} 매매 실거래` : `${label} 전세·월세 시세`
}
export function getTrendSectionTitle(mode: TransactionMode): string {
  return mode === 'sale' ? '매매가 추이' : '전월세 시세 추이'
}
export function getTxSectionTitle(mode: TransactionMode): string {
  return mode === 'sale' ? '매매 거래 내역' : '전월세 거래 내역'
}

export function getJeonsePct(jeonseCount: number, wolseCount: number): number {
  const total = jeonseCount + wolseCount
  return total === 0 ? 0 : Math.round((jeonseCount / total) * 100)
}
