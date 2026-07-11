/**
 * 지역 허브(시/구·군) 부동산 평균가 포맷.
 * [city]/index.vue, [city]/[district]/index.vue에 중복 정의되어 있던
 * 동일 로직을 그대로 이관한 공용 유틸 — 텍스트 출력은 기존과 byte-identical.
 * 주의: formatKoreanPrice로 위임 금지 — 지역 허브 평균은 소수일 수 있어
 * round 개입 시 표시 텍스트가 달라짐(이 유틸은 무round).
 */
export function formatRegionAvgPrice(amount: number | null): string {
  if (!amount || amount === 0) return '데이터 없음'
  if (amount >= 10000) {
    const eok = Math.floor(amount / 10000)
    const remainder = amount % 10000
    return remainder > 0 ? `${eok}억 ${remainder.toLocaleString()}만원` : `${eok}억`
  }
  return `${amount.toLocaleString()}만원`
}
