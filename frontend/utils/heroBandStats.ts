export interface Stat { label: string; value: string; color?: string }

/** 지역×카테고리 밴드: [이 지역] [전국 등록(옵션)] [업데이트(융합, 항상 마지막)] */
export function buildRegionCategoryStats(opts: {
  regionCount: number
  nationalCount: number | null
  unit: string           // '곳' | '건'
  syncCellValue: string  // withSyncDate(...) 결과
  syncLabel: string      // '업데이트'
}): Stat[] {
  const { regionCount, nationalCount, unit, syncCellValue, syncLabel } = opts
  const stats: Stat[] = []
  if (regionCount > 0) stats.push({ label: '이 지역', value: `${regionCount.toLocaleString('ko-KR')}${unit}` })
  if (typeof nationalCount === 'number' && nationalCount > 0) {
    stats.push({ label: '전국 등록', value: `${nationalCount.toLocaleString('ko-KR')}${unit}` })
  }
  stats.push({ label: syncLabel, value: syncCellValue })
  return stats
}

/** 전국 카테고리 목록 밴드. isRegionScoped면 이 지역+전국 등록, 아니면 전국 등록 단독(no-duplicate). 융합/목록기준 셀은 마지막. */
export function buildCategoryListStats(opts: {
  isRegionScoped: boolean
  displayTotal: number       // 스코프 반영된 현재 총계
  nationalCount: number | null
  unit: string
  syncCellValue: string
  basisValue: string         // '목록 기준' 값
}): Stat[] {
  const { isRegionScoped, displayTotal, nationalCount, unit, syncCellValue, basisValue } = opts
  const stats: Stat[] = []
  if (isRegionScoped) {
    if (displayTotal > 0) stats.push({ label: '이 지역', value: `${displayTotal.toLocaleString('ko-KR')}${unit}` })
    if (typeof nationalCount === 'number' && nationalCount > 0) stats.push({ label: '전국 등록', value: `${nationalCount.toLocaleString('ko-KR')}${unit}` })
    stats.push({ label: '데이터 갱신', value: syncCellValue })   // 3칸 유지 위해 필터 시 목록기준 드롭
  } else {
    if (displayTotal > 0) stats.push({ label: '전국 등록', value: `${displayTotal.toLocaleString('ko-KR')}${unit}` })  // no-duplicate: 전국 하나만
    stats.push({ label: '데이터 갱신', value: syncCellValue })
    stats.push({ label: '목록 기준', value: basisValue })
  }
  return stats
}
