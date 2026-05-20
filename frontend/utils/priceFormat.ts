/** manwon 단위 금액 → '5.4억' / '8,500만' / '—'. */
export function formatPrice(manwon: number | null): string {
  if (manwon === null || manwon === 0) return '—';
  if (manwon >= 10000) {
    const eok = manwon / 10000;
    const rounded = Math.round(eok * 10) / 10;
    return rounded % 1 === 0 ? `${rounded}억` : `${rounded.toFixed(1)}억`;
  }
  return `${Math.round(manwon).toLocaleString('ko-KR')}만`;
}

/** 변동률(%) → '+2.3%' / '-0.8%' / '0.0%' / '—'. */
export function formatChange(pct: number | null): string {
  if (pct === null) return '—';
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return '0.0%';
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded.toFixed(1)}%`;
}
