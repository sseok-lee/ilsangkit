import { SITE_NAME, compactCityName } from '~/utils/seoConstants'

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
  // 아파트는 이름이 타입을 암시 → 타입어 생략. 빌라/오피스텔은 유지
  const typePart = input.propertyType === 'apt' ? '' : `${propertyLabel} `
  let core = `${input.buildingName} ${typePart}${transactionLabel} 실거래가`
  // 핵심 헤드라인 길이 가드: 30자(지역·브랜드 제외 ~22자) 초과 + 타입어 있으면 타입어 생략
  if (core.length > 22 && typePart) {
    core = `${input.buildingName} ${transactionLabel} 실거래가`
  }
  // 지역(시축약 구)을 헤드라인 뒤에 접미사로 (길이 가드 이후). 제목이 길어 잘려도 핵심 키워드
  // (단지명·실거래가)는 앞에 보존되고 지역/브랜드만 우아하게 잘린다. 지역 정보가 없으면 세그먼트 생략.
  const regionLabel = [compactCityName(input.region.city), input.region.district].filter(Boolean).join(' ')
  const regionPart = regionLabel ? ` | ${regionLabel}` : ''
  return `${core}·시세${regionPart} | ${SITE_NAME}`
}

function buildDescription(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const cityShort = compactCityName(input.region.city)
  const regionLabel = [cityShort, input.region.district].filter(Boolean).join(' ')

  const totalCount = input.summary?.totalCount ?? 0
  const recentDeal = input.summary?.recentDeal
  const areaText = formatArea(input.areaRange)

  const facilityClause = input.facilitySummary
    ? `${input.facilitySummary} 등 주변 생활시설과 `
    : '주변 생활시설과 '
  const areaClause = areaText ? `전용 ${areaText} ` : ''

  if (totalCount === 0) {
    return `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래가. ${facilityClause}${areaClause}면적별 시세를 함께 확인하세요.`.replace(/\s+/g, ' ').trim()
  }

  const priceText = recentDeal ? formatKoreanPrice(recentDeal.amount) : ''
  const priceClause = priceText ? `, 최근 ${priceText}(${recentDeal!.dealDate})` : ''
  const opening = `${regionLabel} ${input.buildingName} ${propertyLabel} ${transactionLabel} 실거래 ${totalCount.toLocaleString()}건${priceClause}.`

  return `${opening} ${facilityClause}${areaClause}면적별 시세를 함께 확인하세요.`.replace(/\s+/g, ' ').trim()
}

export function buildRealEstateDetailMeta(input: DetailMetaInput): DetailMetaResult {
  return {
    title: buildTitle(input),
    description: buildDescription(input),
  }
}
