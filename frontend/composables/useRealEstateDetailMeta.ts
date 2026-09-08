import { SITE_NAME, compactCityName } from '~/utils/seoConstants'
// 헤더(heroStats·latestPrice)와 동일한 가격 포맷 함수를 공유 — meta·헤더 표기 완전 일치.
import { formatKoreanPrice } from '~/utils/formatters'

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

/**
 * description 길이 상한. 넘으면 정보가치가 낮은 절부터 뺀다(아래 DESCRIPTION_LADDER).
 * 길이를 채우려고 URL·id 같은 무의미 토큰을 붙이지 않는다 — 그건 중복 지표만 속이고
 * 스니펫 품질은 떨어뜨린다.
 */
const DESCRIPTION_MAX = 120

export interface DetailMetaInput {
  buildingName: string
  region: { city: string; district: string; dong?: string | null }
  propertyType: PropertyType
  transactionMode: TransactionMode
  summary: {
    totalCount?: number
    /**
     * 최신 1건. rent 에서 `amount` 는 보증금이고 `monthlyRent` 가 월세다.
     * `monthlyRent` 는 0(전세)과 null(미상)을 구분해야 한다 — sync 는 빈 월세를
     * null 로 보존하면서 rentType 만 전세로 세팅하고(syncAptRent.ts 등),
     * BuildingInfo 는 rentType 을 돌려주지 않는다.
     */
    recentDeal?: { amount: number; dealDate: string; monthlyRent?: number | null }
  } | null
  buildYear?: number | null
  areaRange?: { min: number; max?: number } | null
  facilitySummary?: string | null
}

export interface DetailMetaResult {
  title: string
  description: string
}

function formatArea(range: { min: number; max?: number } | null | undefined): string | null {
  if (!range || !Number.isFinite(range.min)) return null
  const min = Math.round(range.min)
  if (range.max !== undefined && Math.round(range.max) !== min) {
    return `${min}~${Math.round(range.max)}㎡`
  }
  return `${min}㎡`
}

/**
 * 제목 뒤와 설명 앞에 쓰는 지역 표기 — `{시도 축약} {시군구} [{읍면동}]`.
 *
 * 같은 구 안의 동명이 단지를 구별하도록 동을 포함하되,
 * 단지명에 이미 동 이름이 있으면 중복 표기를 생략한다.
 */
function buildRegionLabel(input: DetailMetaInput): string {
  const parts = [compactCityName(input.region.city), input.region.district].filter(Boolean)
  const dong = (input.region.dong ?? '').trim()
  if (dong) {
    // 단지명에는 보통 '동' 접미사 없이 들어간다('역삼동' → '역삼e편한세상')
    const stem = dong.replace(/(읍|면|동|가|리)$/, '')
    const redundant = input.buildingName.includes(dong)
      || (stem.length > 1 && input.buildingName.includes(stem))
    if (!redundant) parts.push(dong)
  }
  return parts.join(' ')
}

function buildTitle(input: DetailMetaInput): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  // 타입어(아파트/빌라/오피스텔)는 어떤 경우에도 생략하지 않는다.
  // 예전엔 22자 가드가 조용히 지웠는데, 그러면 같은 구의 동명이 빌라가 아파트와 완전히 같은
  // title 이 돼(‘{이름} 매매 실거래가·시세’) 중복 문서를 하나 더 찍어냈다.
  const head = [input.buildingName, propertyLabel, transactionLabel]
    .filter(Boolean)
    .join(' ')
  return [`${head} 실거래가·시세`, buildRegionLabel(input), SITE_NAME]
    .filter(Boolean)
    .join(' | ')
}

/**
 * 최근 거래 금액 표기.
 *
 * 매매는 거래가 하나뿐이지만 전월세는 보증금과 월세가 따로다. 예전엔 보증금만 실어
 * "최근 2,000만원" 으로 나갔고, 같은 페이지 본문은 "2,000만원 / 80만원" 이라 어긋났다.
 *
 * 유효 금액(>0)일 때만 절을 붙인다 — formatKoreanPrice 는 0/음수도 "0만원" 을 만든다.
 */
function formatRecentPrice(
  recentDeal: { amount: number; monthlyRent?: number | null },
  mode: TransactionMode,
): string {
  const { amount, monthlyRent } = recentDeal
  const hasDeposit = Number.isFinite(amount) && amount > 0
  if (mode === 'sale') return hasDeposit ? formatKoreanPrice(amount) : ''

  const hasRent = monthlyRent != null && Number.isFinite(monthlyRent) && monthlyRent > 0
  if (hasRent) {
    const rentText = `월세 ${formatKoreanPrice(monthlyRent as number)}`
    // 보증금 0 인 무보증 월세를 "거래 없음" 으로 숨기지 않는다.
    return hasDeposit ? `보증금 ${formatKoreanPrice(amount)}·${rentText}` : `보증금 없음·${rentText}`
  }
  if (!hasDeposit) return ''
  // 월세 0 은 전세로 확정할 수 있지만, null(미상)은 전세로 단정하지 않는다.
  return monthlyRent === 0 ? `전세 ${formatKoreanPrice(amount)}` : `보증금 ${formatKoreanPrice(amount)}`
}

interface DescriptionOptions {
  withBuildYear: boolean
  withArea: boolean
  withFacility: boolean
}

/**
 * description 을 한 번 렌더한다. 모든 토큰은 실데이터(지역·동·단지명·거래종류·거래건수·
 * 최근 거래가/거래월·전용면적·준공년도·주변 생활시설)에서만 나온다.
 */
function renderDescription(input: DetailMetaInput, opts: DescriptionOptions): string {
  const propertyLabel = PROPERTY_LABEL[input.propertyType]
  const transactionLabel = TRANSACTION_LABEL[input.transactionMode]
  const head = [buildRegionLabel(input), input.buildingName, propertyLabel, transactionLabel]
    .filter(Boolean)
    .join(' ')

  const totalCount = input.summary?.totalCount ?? 0
  const recentDeal = input.summary?.recentDeal
  const priceText = recentDeal ? formatRecentPrice(recentDeal, input.transactionMode) : ''
  const priceClause = priceText ? `, 최근 ${priceText}(${recentDeal!.dealDate})` : ''
  const lead = totalCount > 0
    ? `${head} 실거래 ${totalCount.toLocaleString()}건${priceClause}.`
    : `${head} 실거래가.`

  const facts: string[] = []
  const areaText = opts.withArea ? formatArea(input.areaRange) : null
  if (areaText) facts.push(`전용 ${areaText}`)
  if (opts.withBuildYear && input.buildYear && Number.isFinite(input.buildYear)) {
    facts.push(`${input.buildYear}년 준공`)
  }
  const factClause = facts.length > 0 ? ` ${facts.join(', ')}.` : ''

  const facilityClause = opts.withFacility && input.facilitySummary
    ? `${input.facilitySummary} 등 주변 생활시설과 `
    : '주변 생활시설과 '

  return `${lead}${factClause} ${facilityClause}면적별 시세를 함께 확인하세요.`.replace(/\s+/g, ' ').trim()
}

// 길이 상한을 넘을 때 떨어뜨리는 순서 — 준공년도 → 주변 시설 상세 → 전용면적.
// 앞쪽(지역·단지명·거래건수·최근 거래가)은 문서를 서로 구별시키는 축이라 절대 빼지 않는다.
const DESCRIPTION_LADDER: DescriptionOptions[] = [
  { withBuildYear: true, withArea: true, withFacility: true },
  { withBuildYear: false, withArea: true, withFacility: true },
  { withBuildYear: false, withArea: true, withFacility: false },
  { withBuildYear: false, withArea: false, withFacility: false },
]

function buildDescription(input: DetailMetaInput): string {
  let rendered = ''
  for (const opts of DESCRIPTION_LADDER) {
    rendered = renderDescription(input, opts)
    if (rendered.length <= DESCRIPTION_MAX) return rendered
  }
  return rendered
}

export function buildRealEstateDetailMeta(input: DetailMetaInput): DetailMetaResult {
  return {
    title: buildTitle(input),
    description: buildDescription(input),
  }
}
