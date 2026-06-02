export interface AreaNoindexInput {
  isTrash: boolean
  /** 비-trash 카테고리의 SSR summary.count. 미확보 시 undefined */
  summaryCount: number | undefined
  /** trash 카테고리에서 일정이 비었는지 */
  wasteEmpty: boolean
  page: number
}

/**
 * 지역×카테고리 페이지 noindex 판정.
 * - page>1 → noindex (페이지네이션 정책)
 * - trash → 일정 비면 noindex
 * - 그 외 → SSR summary.count === 0 이면 noindex (summary 미확보 시 보수적으로 indexable)
 */
export function computeAreaNoindex(input: AreaNoindexInput): boolean {
  if (input.page > 1) return true
  if (input.isTrash) return input.wasteEmpty
  return input.summaryCount === 0
}
