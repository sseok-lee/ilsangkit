/**
 * KST 달력 하루 경계 유틸.
 *
 * 청약 접수일 같은 "시각 없는 날짜"는 KST 달력 날짜가 UTC 자정으로 저장돼 있다
 * (syncSubscription.parseDate 가 'YYYY-MM-DD' 를 new Date() 에 넘기고, 명세상
 * date-only ISO 는 UTC 로 파싱된다 — 프로덕션 5,671건 전부 시각부 00:00:00).
 *
 * 그 값을 현재 "시각"과 직접 비교하면 KST 하루와 어긋난다. 2026-08-13 마감인
 * 공고가 같은 날 오전 9시(=00:00Z)부터 마감으로 뒤집혔다.
 *
 * 그래서 비교 대상도 같은 표현으로 맞춘다 — "오늘(KST)의 UTC 자정".
 * 한국은 서머타임이 없어 고정 +9 로 안전하다.
 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/**
 * 지금이 KST 로 며칠인지 구해, 그 날짜의 UTC 자정을 돌려준다.
 *
 * 서버 타임존과 무관하게 동작한다 — 배포 환경 TZ 에 기대지 않는다.
 */
export function kstCalendarToday(now: Date = new Date()): Date {
  const shifted = new Date(now.getTime() + KST_OFFSET_MS);
  return new Date(Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate()));
}
