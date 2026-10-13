export interface AreaNoindexInput {
  isTrash: boolean
  /** 비-trash 카테고리의 SSR summary.count. 미확보 시 undefined */
  summaryCount: number | undefined
  /** trash 카테고리에서 실제로 렌더된 목록(동 목록 또는 원본 일정)이 비었는지 */
  wasteEmpty: boolean
  /** trash `?coverage=unresolved` — 같은 시·군·구 기본 경로의 부분집합이라 중복 색인 방지 */
  wasteSourceSubset: boolean
  page: number
}

/**
 * 지역×카테고리 페이지 noindex 판정.
 * - page>1 → noindex (페이지네이션 정책)
 * - trash → 원문 부분집합이거나 렌더된 목록이 비면 noindex
 * - 그 외 → SSR summary.count === 0 이면 noindex (summary 미확보 시 보수적으로 indexable)
 */
export function computeAreaNoindex(input: AreaNoindexInput): boolean {
  if (input.page > 1) return true
  if (input.isTrash) return input.wasteSourceSubset || input.wasteEmpty
  return input.summaryCount === 0
}
