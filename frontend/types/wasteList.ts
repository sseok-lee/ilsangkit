export interface WasteListQuery {
  city?: string
  district?: string
  areaId?: number
  keyword?: string
  coverage?: 'unresolved'
  page: number
  limit: number
}

export interface SelectedWasteArea {
  areaId: number
  name: string
  city: string
  district: string
}
