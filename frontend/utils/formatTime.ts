/** HHMM 원값('900'·'1930'·2000) → 'HH:MM'('09:00'·'19:30'). 이미 콜론 있으면 그대로, falsy면 ''. */
export function formatHHMM(raw: string | number | null | undefined): string {
  if (raw === null || raw === undefined || raw === '') return ''
  const s = String(raw).trim()
  if (s.includes(':')) return s
  const padded = s.padStart(4, '0')
  return `${padded.slice(0, 2)}:${padded.slice(2)}`
}
