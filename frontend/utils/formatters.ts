export function formatKoreanPrice(amount: number): string {
  const roundedAmount = Math.round(amount)
  const eok = Math.floor(roundedAmount / 10000)
  const man = roundedAmount % 10000
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${roundedAmount.toLocaleString()}만원`
}

/**
 * 거리를 사람이 읽기 쉬운 문자열로 변환
 */
export function formatDistance(distance: number): string {
  if (distance >= 1000) {
    return `${(distance / 1000).toFixed(1)}km`
  }
  return `${Math.round(distance)}m`
}

/**
 * ISO 시각을 KST(Asia/Seoul) 기준 YYYY-MM-DD 문자열로 변환.
 * UTC 새벽 시간이 KST 전날로 잘리는 문제(예: 새벽 3시 KST sync가 5/6으로 표시되는 버그) 방지용.
 * 잘못된 입력은 null 반환.
 */
export function formatKstDate(iso: string | null | undefined): string | null {
  if (!iso) return null
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * 날짜를 상대 시간 문자열로 변환 (예: "3일 전", "1시간 전")
 */
export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)
  const diffMonth = Math.floor(diffDay / 30)
  const diffYear = Math.floor(diffDay / 365)

  if (diffYear > 0) return `${diffYear}년 전`
  if (diffMonth > 0) return `${diffMonth}개월 전`
  if (diffDay > 0) return `${diffDay}일 전`
  if (diffHour > 0) return `${diffHour}시간 전`
  if (diffMin > 0) return `${diffMin}분 전`
  return '방금 전'
}
