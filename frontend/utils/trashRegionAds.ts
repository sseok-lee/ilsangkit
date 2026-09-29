export interface TrashRegionAdState {
  isTrash: boolean
  hasQuery: boolean
  coverage: string | null | undefined
  showWasteAreaList: boolean
  wasteAreaItemCount: number
  wasteAreaError: boolean
  wasteScheduleCount: number
  wasteScheduleError: boolean
}

export function shouldShowTrashRegionAd(state: TrashRegionAdState): boolean {
  if (!state.isTrash) return true
  if (state.hasQuery) return false
  if (state.coverage === 'unresolved') return false
  if (state.showWasteAreaList) return state.wasteAreaItemCount > 0 && !state.wasteAreaError
  return state.wasteScheduleCount > 0 && !state.wasteScheduleError
}
