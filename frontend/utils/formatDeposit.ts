/**
 * 만원 단위의 숫자를 "X억 X,XXX만원" 형식으로 포맷
 * @param manwon - 만원 단위의 숫자
 * @returns 포맷된 문자열
 */
export function formatDeposit(manwon: number): string {
  if (manwon === 0) return '0만원'

  const eok = Math.floor(manwon / 10000)
  const remainder = manwon % 10000

  if (eok === 0) {
    return `${manwon.toLocaleString()}만원`
  }

  if (remainder === 0) {
    return `${eok}억`
  }

  return `${eok}억 ${remainder.toLocaleString()}만원`
}
