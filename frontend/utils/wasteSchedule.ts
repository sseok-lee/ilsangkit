/**
 * 쓰레기 배출 일정 표시 유틸.
 *
 * 원본 공공데이터는 미제공 값을 빈 문자열이 아니라 '빈칸', '없음' 같은 자리표시자
 * 문자열로 담는다(달서 10817 의 `method: 빈칸`). 그대로 렌더하면 "배출 방법: 빈칸"
 * 처럼 틀린 안내가 되므로 표시 직전에 걸러낸다.
 */
const PLACEHOLDER_TEXT = new Set(['빈칸', '없음', '해당없음', '해당사항없음', '미제공', '미상', '-', '.'])

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

function hasBalancedParentheses(value: string): boolean {
  let depth = 0
  for (const char of value) {
    if (char === '(') depth += 1
    if (char === ')') {
      depth -= 1
      if (depth < 0) return false
    }
  }
  return depth === 0
}

export function splitWasteTargetForDisplay(value: string): string[] {
  const target = normalizeProvidedText(value)
  if (!target) return []
  if (!hasBalancedParentheses(target)) return [target]

  const tokens: string[] = []
  let depth = 0
  let start = 0
  for (let index = 0; index < target.length; index += 1) {
    const char = target[index]
    if (char === '(') depth += 1
    if (char === ')') depth = Math.max(0, depth - 1)
    if (depth === 0 && (char === ',' || char === '+' || char === ';')) {
      const token = target.slice(start, index).trim()
      if (token) tokens.push(token)
      start = index + 1
    }
  }
  const tail = target.slice(start).trim()
  if (tail) tokens.push(tail)
  return tokens.length ? tokens : [target]
}

export function summarizeWasteTarget(value: string): string {
  const tokens = splitWasteTargetForDisplay(value)
  if (tokens.length === 0) return ''

  const picked: string[] = []
  for (const token of tokens.slice(0, 3)) {
    const next = [...picked, token].join('·')
    if (picked.length > 0 && [...next].length > 18) break
    picked.push(token)
  }

  const omitted = picked.length < tokens.length
  return `${picked.join('·')}${omitted ? ' 등' : ''}`
}

export function wasteSourceTitle(input: {
  targetRegion?: string | null
  emissionPlace?: string | null
  city: string
  district: string
}): string {
  const target = normalizeProvidedText(input.targetRegion)
  const place = normalizeProvidedText(input.emissionPlace)
  const singleBroadLabel = !!target && (
    target === input.city ||
    target === input.district ||
    /^[가-힣0-9·]+[읍면동]$/.test(target)
  )
  const roadAddress = !!place && /(?:로|길)\s*\d/.test(place)
  if (singleBroadLabel && roadAddress) return place
  return target ? summarizeWasteTarget(target) : place || '적용 구역 확인 필요'
}
