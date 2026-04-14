// Subscription (청약) types

export type SubscriptionSourceType = 'APT' | 'OFFITEL' | 'REMAINING' | 'PRIVATE_RENT'

export interface Subscription {
  id: number
  houseManageNo: string
  pblancNo: string
  sourceType: SubscriptionSourceType
  houseName: string
  houseType: string // APT, 오피스텔
  houseDetailType: string | null // 민영, 국민
  rentType: string | null // 분양주택, 임대주택
  regionName: string
  supplyLocation: string | null
  totalSupplyCount: number | null
  announcementDate: string | null
  receptionStartDate: string | null
  receptionEndDate: string | null
  specialStartDate: string | null
  specialEndDate: string | null
  rank1AreaStartDate: string | null
  rank1AreaEndDate: string | null
  rank2AreaStartDate: string | null
  rank2AreaEndDate: string | null
  winnerDate: string | null
  contractStartDate: string | null
  contractEndDate: string | null
  moveInMonth: string | null // YYYYMM
  constructorName: string | null
  developerName: string | null
  homepage: string | null
  pblancUrl: string | null
  inquiryTel: string | null
  status: 'upcoming' | 'ongoing' | 'closed'
  lat?: number | null
  lng?: number | null
  createdAt?: string
  updatedAt?: string
}

export interface SubscriptionUnitType {
  id: number
  modelNo: string
  houseType: string | null // e.g. "084.9421A"
  supplyArea: string | null // ㎡
  generalCount: number | null
  specialCount: number | null
  topAmount: number | null // 만원
  newlywedsCount: number | null
  multiChildCount: number | null
  firstLifeCount: number | null
  elderlyCount: number | null
  institutionCount: number | null
  youthCount: number | null
  newbornCount: number | null
  transferCount: number | null
  etcCount: number | null
}

export interface SubscriptionCompetition {
  id: number
  modelNo: string
  houseType: string | null
  rank: number // 1=1순위, 2=2순위
  regionCode: string // 01=해당지역, 02=기타지역
  regionName: string | null
  supplyCount: number | null
  applicantCount: number | null
  competitionRate: string | null
}

export interface SubscriptionScore {
  id: number
  modelNo: string
  houseType: string | null
  regionCode: string
  regionName: string | null
  minScore: string | null
  maxScore: string | null
  avgScore: string | null
}

export interface SubscriptionSpecialStatus {
  id: number
  houseType: string | null
  resultName: string | null
  specialSupplyCount: number | null
  newlywedsSupply: number | null
  multiChildSupply: number | null
  firstLifeSupply: number | null
  elderlySupply: number | null
  institutionSupply: number | null
  youthSupply: number | null
  newbornSupply: number | null
  transferSupply: number | null
  newlywedsAreaCount: number | null
  multiChildAreaCount: number | null
  firstLifeAreaCount: number | null
  elderlyAreaCount: number | null
  youthAreaCount: number | null
  newbornAreaCount: number | null
  newlywedsOtherCount: number | null
  multiChildOtherCount: number | null
  firstLifeOtherCount: number | null
  elderlyOtherCount: number | null
  youthOtherCount: number | null
  newbornOtherCount: number | null
  institutionDecisionCount: number | null
  institutionPrepareCount: number | null
  transferCount: number | null
}
