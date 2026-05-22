type PropertyType = 'apt' | 'villa' | 'offitel'
type TransactionMode = 'sale' | 'rent'

const PROPERTY_LABEL: Record<PropertyType, string> = {
  apt: '아파트',
  villa: '빌라',
  offitel: '오피스텔',
}

const TRANSACTION_LABEL: Record<TransactionMode, string> = {
  sale: '매매',
  rent: '전월세',
}

export interface DetailMetaInput {
  buildingName: string
  region: { city: string; district: string; dong?: string | null }
  propertyType: PropertyType
  transactionMode: TransactionMode
  summary: {
    totalCount?: number
    recentDeal?: { amount: number; dealDate: string }
  } | null
  buildYear?: number | null
  areaRange?: { min: number; max?: number } | null
  facilitySummary?: string | null
}

export interface DetailMetaResult {
  title: string
  description: string
}

function shortCityName(city: string): string {
  return (city || '').replace(/(특별자치시|특별자치도|특별시|광역시|도)$/, '')
}

function formatKoreanPrice(amountManwon: number): string {
  if (!Number.isFinite(amountManwon) || amountManwon <= 0) return ''
  const eok = Math.floor(amountManwon / 10000)
  const manwon = amountManwon % 10000
  if (eok > 0 && manwon > 0) return `${eok}억 ${manwon.toLocaleString()}만원`
  if (eok > 0) return `${eok}억원`
  return `${manwon.toLocaleString()}만원`
}

function formatArea(range: { min: number; max?: number } | null | undefined): string | null {
  if (!range || !Number.isFinite(range.min)) return null
  const min = Math.round(range.min)
  if (range.max !== undefined && Math.round(range.max) !== min) {
    return `${min}~${Math.round(range.max)}㎡`
  }
  return `${min}㎡`
}

function buildTitle(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const head = `${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래`

  const cityShort = shortCityName(input.region.city)
  const locParts = [cityShort, input.region.district, input.region.dong || '']
    .filter((p) => p && p.length > 0)
  if (locParts.length === 0) return head
  return `${head} · ${locParts.join(' ')}`
}

function buildDescription(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const cityShort = shortCityName(input.region.city)
  const regionLabel = [cityShort, input.region.district].filter(Boolean).join(' ')

  const totalCount = input.summary?.totalCount ?? 0
  const recentDeal = input.summary?.recentDeal
  const buildYear = input.buildYear
  const areaText = formatArea(input.areaRange)

  if (totalCount === 0) {
    return `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래가. 주변 시세를 함께 확인하세요.`
  }

  const opening = `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래 ${totalCount.toLocaleString()}건.`

  const priceFragments: string[] = []
  if (recentDeal) {
    const priceText = formatKoreanPrice(recentDeal.amount)
    if (priceText) {
      priceFragments.push(`최근 거래가는 ${priceText}(${recentDeal.dealDate})`)
    }
  }
  if (buildYear) {
    priceFragments.push(`${buildYear}년 준공된 단지입니다`)
  }
  let priceSentence = ''
  if (priceFragments.length === 1 && recentDeal && !buildYear) {
    priceSentence = `${priceFragments[0]}입니다.`
  } else if (priceFragments.length >= 1) {
    priceSentence = `${priceFragments.join(', ')}.`
  }

  const areaSentence = areaText
    ? `전용 ${areaText} 면적별 시세와 거래 내역, `
    : '면적별 시세와 거래 내역, '

  const closing = input.facilitySummary
    ? `${areaSentence}인근 ${input.facilitySummary}과 주변 시세를 함께 확인하세요.`
    : `${areaSentence}주변 시세를 함께 확인하세요.`

  return [opening, priceSentence, closing].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

export function buildRealEstateDetailMeta(input: DetailMetaInput): DetailMetaResult {
  return {
    title: buildTitle(input),
    description: buildDescription(input),
  }
}
