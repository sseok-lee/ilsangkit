export interface SubwayStation {
  id: string
  sourceId: string
  name: string
  nameSlug: string
  line: string
  transferLines: string[]
  operator: string | null
  lat: number
  lng: number
  address: string | null
  roadAddress: string | null
  city: string | null
  district: string | null
  regionSlug: string | null
  phoneNumber: string | null
  dataDate: string | null
  updatedAt: string
}
