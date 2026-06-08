// frontend/utils/auctionMeta.ts
import { formatWonKorean } from '~/types/auction'

export const AUCTION_META = {
  label: '공매',
  icon: 'gavel',
  description: '온비드(한국자산관리공사) 부동산 공매 물건을 지역·용도별로 조회하세요. 감정가·최저입찰가·입찰일정과 지역별 낙찰가율 통계를 한눈에 확인할 수 있습니다.',
}

export function buildAuctionRegionTitle({ city, district }: { city?: string; district?: string } = {}): string {
  if (district) return `${district} 공매 물건·낙찰가율 | ${city ?? ''} | 일상킷`.replace(' |  |', ' |')
  if (city) return `${city} 공매 물건·낙찰가율 | 일상킷`
  return '전국 부동산 공매 물건·낙찰가율 | 일상킷'
}

export function buildAuctionRegionDescription({ city, district, avgBidRate, activeCount }: { city?: string; district?: string; avgBidRate?: number | null; activeCount?: number } = {}): string {
  const region = district ?? city ?? '전국'
  const ratePart = avgBidRate != null ? ` 평균 낙찰가율 ${avgBidRate}%,` : ''
  const activePart = activeCount != null ? ` 진행중 물건 ${activeCount}건을 포함한` : ''
  return `${region} 부동산 공매 정보입니다.${ratePart}${activePart} 감정가·최저입찰가·입찰일정과 용도별 낙찰가율 통계를 온비드 공식 데이터 기반으로 제공합니다.`
}

export function buildAuctionItemTitle({ address, usage, minBidPrc, winBidPrc, status }: { address: string; usage?: string | null; minBidPrc?: number | null; winBidPrc?: number | null; status?: string }): string {
  const u = usage ?? '부동산'
  if (status === 'sold' && winBidPrc != null) return `${address} ${u} 공매 - 낙찰가 ${formatWonKorean(winBidPrc)} | 일상킷`
  if (minBidPrc != null) return `${address} ${u} 공매 - 최저입찰가 ${formatWonKorean(minBidPrc)} | 일상킷`
  return `${address} ${u} 공매 물건 | 일상킷`
}

export function buildAuctionItemDescription({ address, usage, apslAssAmt, minBidPrc, status, winBidPrc }: { address: string; usage?: string | null; apslAssAmt?: number | null; minBidPrc?: number | null; status?: string; winBidPrc?: number | null }): string {
  const u = usage ?? '부동산'
  if (status === 'sold' && winBidPrc != null) return `${address} ${u} 공매 물건의 낙찰 결과입니다. 감정가 ${formatWonKorean(apslAssAmt)}, 낙찰가 ${formatWonKorean(winBidPrc)}. 온비드 공식 데이터 기반.`
  return `${address} ${u} 공매 물건 정보입니다. 감정가 ${formatWonKorean(apslAssAmt)}, 최저입찰가 ${formatWonKorean(minBidPrc)}. 입찰일정·위치·주변 시세를 확인하세요. 온비드 공식 데이터 기반.`
}

export const AUCTION_FAQ: Array<{ q: string; a: string }> = [
  { q: '공매와 경매는 어떻게 다른가요?', a: '경매는 법원이 채권자의 신청으로 진행하는 강제집행이고, 공매는 한국자산관리공사(온비드)가 세금 체납 압류재산·국유재산 등을 매각하는 절차입니다. 공매는 온비드에서 온라인으로 입찰하며 권리관계가 비교적 단순한 편입니다.' },
  { q: '낙찰가율이란 무엇인가요?', a: '낙찰가율은 감정가 대비 낙찰가의 비율(낙찰가÷감정가×100)입니다. 낙찰가율이 낮을수록 감정가보다 저렴하게 낙찰된 것으로, 지역·용도별 낙찰가율을 비교하면 시세 흐름을 파악할 수 있습니다.' },
  { q: '공매 입찰은 어떻게 참여하나요?', a: '온비드(www.onbid.co.kr) 회원가입 후 공동인증서로 로그인하여 온라인으로 입찰할 수 있습니다. 입찰보증금을 납부하고 입찰서를 제출하면 되며, 최고가 입찰자가 낙찰자가 됩니다.' },
  { q: '공매 데이터는 어디서 제공되나요?', a: '일상킷의 공매 정보는 한국자산관리공사 온비드의 공공데이터 공식 API를 기반으로 합니다. 진행중·예정 물건과 누적된 낙찰 결과를 함께 제공합니다.' },
  { q: '수의계약이란 무엇인가요?', a: '여러 차례 유찰된 공매 물건은 경쟁입찰 대신 수의계약(개별 협상 매각)으로 전환될 수 있습니다. 수의계약 가능 물건은 별도로 표시됩니다.' },
]
