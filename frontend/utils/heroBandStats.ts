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
