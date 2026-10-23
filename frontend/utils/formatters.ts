export function formatKoreanPrice(amount: number): string {
  const roundedAmount = Math.round(amount)
  const eok = Math.floor(roundedAmount / 10000)
  const man = roundedAmount % 10000
  if (eok > 0 && man > 0) return `${eok}억 ${man.toLocaleString()}만원`
  if (eok > 0) return `${eok}억`
  return `${roundedAmount.toLocaleString()}만원`
}

/**
 * 좁은 화면용 짧은 가격(만원 단위 입력). 억은 소수 둘째 자리(100만원)까지 반올림, 끝의 0 은 뗀다:
 * 14500 → "1.45억", 45000 → "4.5억", 90000 → "9억", 9480 → "9,480만".
 * 정수(100만원 단위)로 먼저 반올림한다 — 1.45 같은 값을 소수로 반올림하면 1.4499… 로 저장돼 내려간다.
 */
export function formatCompactPrice(amount: number): string {
  const roundedAmount = Math.round(amount)
  if (roundedAmount < 10000) return `${roundedAmount.toLocaleString()}만`
  return `${Math.round(roundedAmount / 100) / 100}억`
}

/** 좁은 화면용 월세 표기: 31000·80 → "3.1억/80만" */
export function formatCompactWolsePrice(deposit: number, monthlyRent: number): string {
  return `${formatCompactPrice(deposit)}/${Math.round(monthlyRent).toLocaleString()}만`
}

/** 월세 표기: 보증금/월세(만원 단위 입력). 예: 10000·120 → "1억/120만원" */
export function formatWolsePrice(deposit: number, monthlyRent: number): string {
  return `${formatKoreanPrice(deposit)}/${formatKoreanPrice(monthlyRent)}`
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
 * 준공연도 + 경과 연차. currentYear는 호출측에서 getCurrentYear() 주입(테스트 결정성).
 * 연차 1 이상일 때만 병기, 그 외(당해 준공·미래 데이터 방어)는 연도만.
 */
export function buildYearLabel(buildYear: number | null | undefined, currentYear: number): string | null {
  if (typeof buildYear !== 'number' || Number.isNaN(buildYear)) return null
  const age = currentYear - buildYear
  return age >= 1 ? `${buildYear}년 (${age}년차)` : `${buildYear}년`
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
