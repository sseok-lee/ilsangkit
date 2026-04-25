// LH 공고 (분양/임대) 타입

export type LhAnnouncementSupplyListType = '01' | '02' | '03' | '04'

export interface LhAnnouncementSupply {
  id: number
  announcementId: number
  listType: LhAnnouncementSupplyListType
  htyNm: string | null
  rsdnDdoAr: number | null
  splAr: number | null
  silHshCnt: number | null
  totHshCnt: number | null
  silAmt: number | null      // BigInt → Number, dsList01 분양가 (원)
  lsGmy: number | null       // BigInt → Number, dsList02/04 임대보증금 (원)
  mmRfe: number | null       // dsList02/03/04 월세 (원)
  elyDsuAmt: number | null   // BigInt → Number, dsList03 초기분납금 (원)
}

export interface LhAnnouncementAttachment {
  id: number
  announcementId: number
  ahflUrl: string
  slPanAhflDsCdNm: string | null
  cmnAhflNm: string
}

export interface LhAnnouncement {
  id: number
  panId: string
  ccrCnntSysDsCd: string
  uppAisTpCd: string
  uppAisTpNm: string         // '임대주택' | '분양주택' | …
  aisTpCd: string
  aisTpNm: string
  splInfTpCd: string

  panNm: string
  cnpNm: string
  panDt: string | null       // ISO date string
  clsgDt: string | null
  panSs: string | null       // '공고중' | '마감'
  dtlUrl: string | null
  dtlUrlMob: string | null

  bzdtNm: string | null
  lctAraAdr: string | null
  lctAraDtlAdr: string | null
  minMaxRsdnDdoAr: string | null
  sumTotHshCnt: number | null
  mvinXpcYm: string | null
  htnFmlaDsCdNm: string | null
  edcFclCts: string | null
  tffcFclCts: string | null
  cvnFclCts: string | null
  idtFclCts: string | null
  splInfGudFcts: string | null

  acpDttm: string | null
  pzwrAncDt: string | null
  pzwrPprSbmStDt: string | null
  pzwrPprSbmEdDt: string | null
  ctrtStDt: string | null
  ctrtEdDt: string | null
  hsSbscAcpTrgCdNm: string | null
  splScdlGudFcts: string | null

  panDtlCts: string | null
  etcFcts: string | null

  ctrtPlcAdr: string | null
  ctrtPlcDtlAdr: string | null
  silOfcTlno: string | null
  silOfcGudFcts: string | null

  lat: number | null
  lng: number | null

  sourceId: string
  createdAt: string
  updatedAt: string

  supplies?: LhAnnouncementSupply[]
  attachments?: LhAnnouncementAttachment[]
}

export interface LhAnnouncementListQuery {
  uppAisTpCd?: string
  aisTpCd?: string
  cnpNm?: string
  panSs?: string
  page?: number
  limit?: number
}

export interface LhAnnouncementPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface LhAnnouncementListResponse {
  items: LhAnnouncement[]
  pagination: LhAnnouncementPagination
}
