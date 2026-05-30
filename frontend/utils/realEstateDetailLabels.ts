export type RealEstateDetailMode = 'sale' | 'rent'

export function getDetailEyebrow(label: string, mode: RealEstateDetailMode): string {
  return mode === 'sale' ? `${label} 매매 실거래` : `${label} 전세·월세 시세`
}
export function getTrendSectionTitle(mode: RealEstateDetailMode): string {
  return mode === 'sale' ? '매매가 추이' : '전월세 시세 추이'
}
export function getTxSectionTitle(mode: RealEstateDetailMode): string {
  return mode === 'sale' ? '매매 거래 내역' : '전월세 거래 내역'
}
