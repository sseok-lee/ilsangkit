/**
 * 표시 역명 — 원본에 "가산디지털단지" / "가산디지털단지역"처럼 끝 "역" 유무가 섞여 있어
 * 항상 "역" 1개를 보장한다(이중 "역역" 방지). 지하철 목록·상세·주변 역 공용.
 */
export function withStationSuffix(name: string): string {
  const base = name.trim().replace(/역$/, '').trim()
  return base ? `${base}역` : ''
}
