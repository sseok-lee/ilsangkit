import type { MaintenanceFeeSummary } from '~/types/housingRedesign'

// 부동산 상세 "관리비"(K-apt) 표시 문구. 금액은 원 단위 세대 평균이며 축약하지 않는다("44만 4,578원").

/** 444578 → "44만 4,578원", 10000 → "1만원", 1626 → "1,626원" */
export function formatWon(amount: number): string {
  const won = Math.round(amount)
  const man = Math.floor(won / 10000)
  const rest = won % 10000
  if (man === 0) return `${won.toLocaleString('ko-KR')}원`
  if (rest === 0) return `${man.toLocaleString('ko-KR')}만원`
  return `${man.toLocaleString('ko-KR')}만 ${rest.toLocaleString('ko-KR')}원`
}

const parts = (month: string) => ({ year: Number(month.slice(0, 4)), month: Number(month.slice(5, 7)) })

/** '2026-08' → '2026년 8월' */
export function formatFeeMonth(month: string): string {
  const p = parts(month)
  return `${p.year}년 ${p.month}월`
}

/** 월별 막대 라벨 '2026-01' → '1월' */
export function feeMonthLabel(month: string): string {
  return `${parts(month).month}월`
}

/** 기간 라벨: 같은 해면 뒤 연도 생략 — '26.7~8', 해가 바뀌면 '25.12~26.2' */
export function formatFeePeriod(period: { from: string; to: string }): string {
  const from = parts(period.from)
  const to = parts(period.to)
  const yy = (year: number) => String(year % 100).padStart(2, '0')
  return from.year === to.year
    ? `${yy(from.year)}.${from.month}~${to.month}`
    : `${yy(from.year)}.${from.month}~${yy(to.year)}.${to.month}`
}

/** 일부 단지만 올라온 달을 뺀 가장 높은·낮은 달. 정상 달이 2개 미만이면 null. */
export function feeExtremes(
  monthly: MaintenanceFeeSummary['monthly'],
): { high: { month: string; amount: number }; low: { month: string; amount: number } } | null {
  const complete = monthly.filter((m) => !m.partial)
  if (complete.length < 2) return null
  const pick = (better: (a: number, b: number) => boolean) =>
    complete.reduce((best, m) => (better(m.amount, best.amount) ? m : best))
  const high = pick((a, b) => a > b)
  const low = pick((a, b) => a < b)
  return { high: { month: high.month, amount: high.amount }, low: { month: low.month, amount: low.amount } }
}

/** 숫자만 온 관리사무소 번호에 하이픈: 0314414250 → 031-441-4250, 0220580890 → 02-2058-0890. 그 밖의 형식은 그대로. */
export function formatOfficePhone(phone: string): string {
  if (!/^\d+$/.test(phone)) return phone
  const seoul = /^(02)(\d{3,4})(\d{4})$/.exec(phone)
  const area = /^(0\d{2})(\d{3,4})(\d{4})$/.exec(phone)
  const nationwide = /^(1\d{3})(\d{4})$/.exec(phone)
  const m = seoul ?? area ?? nationwide
  return m ? m.slice(1).join('-') : phone
}
