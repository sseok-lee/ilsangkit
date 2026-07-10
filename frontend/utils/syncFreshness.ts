import { formatKstDate } from './formatters'

/** 도메인별 동기화 신선도 한계(일) — 초과 시 날짜 표기 숨김 (스펙 §5-1) */
export const RE_STALE_DAYS = 2       // 부동산·청약 (daily sync)
export const TRASH_STALE_DAYS = 3    // 쓰레기 배출 일정 (daily sync)
export const FACILITY_STALE_DAYS = 62 // 시설 (월 1회 sync)

/** ISO/날짜 문자열 → KST 'YYYY.MM.DD'. 무효 입력은 null. */
export function formatDotDate(iso?: string | null): string | null {
  const ymd = formatKstDate(iso)
  return ymd ? ymd.replace(/-/g, '.') : null
}

/**
 * 마지막 동기화가 staleDays를 초과해 오래됐으면 true — 날짜 표기를 숨겨야 한다.
 * 낡은 날짜의 상시 노출은 무표기보다 신뢰를 깎는다(스펙 §5-1 stale 가드).
 */
export function isSyncStale(iso: string | null | undefined, staleDays: number): boolean {
  if (!iso) return true
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return true
  return Date.now() - t > staleDays * 86_400_000
}

/** 갱신 주기 선언 라벨에 실제 동기화 날짜를 병기. stale이면 라벨만. */
export function withSyncDate(label: string, iso?: string | null, staleDays = 62): string {
  if (isSyncStale(iso, staleDays)) return label
  const dot = formatDotDate(iso)
  return dot ? `${label} · ${dot}` : label
}

/** ISO → KST 'YYYY.MM.DD HH:mm'. 무효 입력은 null. */
export function formatDotDateTime(iso?: string | null): string | null {
  if (!iso) return null
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
  // en-CA: 'YYYY-MM-DD, HH:mm'
  return fmt.format(t).replace(/-/g, '.').replace(',', '')
}
