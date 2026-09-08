import { formatKoreanPrice } from '~/utils/formatters'

export interface RecentDealSource {
  latestDealAmount: number | null
  latestMonthlyRent: number | null
  latestDealYear: number | null
  latestDealMonth: number | null
}

export interface RecentDeal {
  /** rent 에서는 보증금. 0(무보증)과 null(거래 없음)은 다르다. */
  amount: number | null
  /** 0(전세)과 null(미상)을 구분한다 — null 을 전세로 단정하면 안 된다. */
  monthlyRent: number | null
  dealDate: string | null
}

/**
 * 최근 거래 단일 소스. meta description·헤더(heroStats·latestPrice)가 같은 값을 쓰도록
 * buildingInfo 에서만 산출한다.
 *
 * 예전엔 `info?.latestDealAmount ? ... : null` 이라 보증금 0(무보증 월세) 거래가
 * "거래 없음" 으로 뭉개졌다. 0 과 null 을 구분한다.
 */
export function resolveRecentDeal(info: RecentDealSource | null | undefined): RecentDeal {
  return {
    amount: info?.latestDealAmount != null ? Number(info.latestDealAmount) : null,
    monthlyRent: info?.latestMonthlyRent != null ? Number(info.latestMonthlyRent) : null,
    dealDate: info?.latestDealYear != null && info?.latestDealMonth != null
      ? `${info.latestDealYear}년 ${info.latestDealMonth}월`
      : null,
  }
}

/** 헤더의 최근 거래가 표기. 유효 금액(>0)이 하나도 없으면 대시. */
export function formatLatestPrice(deal: RecentDeal): string {
  const hasDeposit = deal.amount != null && deal.amount > 0
  const hasRent = deal.monthlyRent != null && deal.monthlyRent > 0
  if (!hasDeposit && !hasRent) return '-'
  if (!hasRent) return formatKoreanPrice(deal.amount as number)
  const rentText = formatKoreanPrice(deal.monthlyRent as number)
  return hasDeposit ? `${formatKoreanPrice(deal.amount as number)} / ${rentText}` : `월세 ${rentText}`
}
