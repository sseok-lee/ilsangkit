import { formatKstDate } from './formatters'

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
