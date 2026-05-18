/**
 * Date를 KST(Asia/Seoul) 기준 YYYY-MM-DD 문자열로 변환.
 *
 * DB가 UTC로 저장되는데 `.toISOString().split('T')[0]`을 쓰면 UTC 날짜가 나와
 * KST 00:00~09:00 사이 시점은 어제 날짜로 표시되는 문제가 있다.
 * sitemap lastmod 등 사용자 노출 날짜는 KST 기준으로 통일한다.
 */
export function toKstDateString(date: Date | null | undefined): string | null {
  if (!date) return null;
  // en-CA 로케일은 YYYY-MM-DD 형태로 반환
  return date.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}
