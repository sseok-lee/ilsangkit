/**
 * 쓰레기 배출 일정 표시 유틸.
 *
 * 원본 공공데이터는 미제공 값을 빈 문자열이 아니라 '빈칸', '없음' 같은 자리표시자
 * 문자열로 담는다(달서 10817 의 `method: 빈칸`). 그대로 렌더하면 "배출 방법: 빈칸"
 * 처럼 틀린 안내가 되므로 표시 직전에 걸러낸다.
 */
const PLACEHOLDER_TEXT = new Set(['빈칸', '없음', '해당없음', '미제공', '미상', '-', '.'])

export function normalizeProvidedText(value?: string | null): string | undefined {
  const trimmed = value?.trim()
  if (!trimmed) return undefined
  return PLACEHOLDER_TEXT.has(trimmed) ? undefined : trimmed
}

export function formatDays(days: string[]): string {
  return days.filter(Boolean).join(' · ')
}

/**
 * 배출 시간대 표기.
 *
 * - 종료가 시작보다 이르면 자정을 넘긴 것이므로 '익일' 을 붙인다(20:00 ~ 익일 02:00).
 * - 시작과 종료가 같으면 원본 그대로 둔다. 고창 음식물 13500 의 20:00~20:00 을
 *   24시간 운영으로 추정하면 없는 사실을 만들어내는 것이다.
 */
export function formatTimeRange(beginTime?: string, endTime?: string): string {
  const begin = normalizeProvidedText(beginTime)
  const end = normalizeProvidedText(endTime)
  if (!begin && !end) return ''
  if (!begin) return end as string
  if (!end) return begin
  const nextDay = end < begin ? '익일 ' : ''
  return `${begin} ~ ${nextDay}${end}`
}
