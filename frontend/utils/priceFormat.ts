/**
 * 만원 단위 금액 → '5.4억' / '8,500만' / '—'.
 *
 * 이름이 `formatPrice` 가 아닌 `formatPriceManwon` 인 이유:
 * `~/utils/seoHelpers.ts` 의 기존 `formatPrice(price: number)` 는 원(₩) 단위 입력에
 * `12.3억원` 처럼 단위 접미사가 붙은 문자열을 돌려준다. Nuxt auto-import 가 같은
 * 이름을 만나면 한 쪽을 무시한다고 경고하므로(둘 다 살려둬야 함) 만원 입력 버전은
 * 다른 이름으로 노출한다.
 */
export function formatPriceManwon(manwon: number | null): string {
  if (manwon === null || manwon === 0) return '—';
  if (manwon >= 10000) {
    const eok = manwon / 10000;
    const rounded = Math.round(eok * 10) / 10;
    return rounded % 1 === 0 ? `${rounded}억` : `${rounded.toFixed(1)}억`;
  }
  return `${Math.round(manwon).toLocaleString('ko-KR')}만`;
}

/**
 * 평당가(만원/평) → '평당 2,150만' / '평당 1.2억' / '—'.
 * "오늘의 부동산 시장" 9슬롯 카드에서 사용. 면적 가중 평당가의 사람용 표기.
 */
export function formatPricePerPyeong(manwonPerPyeong: number | null): string {
  if (manwonPerPyeong === null || manwonPerPyeong <= 0) return '—';
  if (manwonPerPyeong >= 10000) {
    const eok = manwonPerPyeong / 10000;
    const rounded = Math.round(eok * 10) / 10;
    return `평당 ${rounded % 1 === 0 ? rounded : rounded.toFixed(1)}억`;
  }
  return `평당 ${Math.round(manwonPerPyeong).toLocaleString('ko-KR')}만`;
}

/** 변동률(%) → '+2.3%' / '-0.8%' / '0.0%' / '—'. */
export function formatChange(pct: number | null): string {
  if (pct === null) return '—';
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return '0.0%';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}
