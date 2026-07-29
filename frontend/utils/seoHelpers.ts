/**
 * 억 단위 가격 포맷
 * @example formatPrice(1234000000) → "12.3억원"
 */
export function formatPrice(price: number): string {
  if (!price || price <= 0) return ''
  const billions = price / 100000000
  if (billions >= 1) {
    return billions % 1 === 0
      ? `${billions}억원`
      : `${billions.toFixed(1)}억원`
  }
  return `${(price / 10000).toLocaleString()}만원`
}

/**
 * 지역 페이지 서술형 텍스트 생성
 */
export function generateAreaDescription(params: {
  city: string
  district: string
  facilityStats?: Record<string, number>
  totalFacilities?: number
  avgAptPrice?: number
}): string {
  const { city, district, facilityStats, totalFacilities, avgAptPrice } = params
  const parts: string[] = []

  if (facilityStats) {
    const statParts: string[] = []
    if (facilityStats.hospital) statParts.push(`병원 ${facilityStats.hospital.toLocaleString()}곳`)
    if (facilityStats.pharmacy) statParts.push(`약국 ${facilityStats.pharmacy.toLocaleString()}곳`)
    if (facilityStats.school) statParts.push(`학교 ${facilityStats.school.toLocaleString()}곳`)
    if (facilityStats.park) statParts.push(`공원 ${facilityStats.park.toLocaleString()}곳`)
    if (statParts.length > 0) {
      parts.push(`${city} ${district}에는 ${statParts.join(', ')} 등`)
      if (totalFacilities) {
        parts.push(`총 ${totalFacilities.toLocaleString()}곳의 생활시설이 등록되어 있습니다.`)
      } else {
        parts.push('생활시설이 등록되어 있습니다.')
      }
    }
  }

  if (avgAptPrice && avgAptPrice > 0) {
    parts.push(`아파트 매매 평균가는 ${formatPrice(avgAptPrice)}입니다.`)
  }

  return parts.join(' ')
}

/**
 * meta description 에 넣을 시설 통계 후보. 검색 의도가 강한 순서.
 * 설명문 길이(한국어 SERP 노출 ~80자)를 지키려고 상위 N개만 쓴다.
 */
const META_STAT_CATEGORIES: ReadonlyArray<readonly [key: string, label: string]> = [
  ['hospital', '병원'],
  ['pharmacy', '약국'],
  ['school', '학교'],
  ['park', '공원'],
  ['parking', '주차장'],
] as const

function formatFacilityStatParts(
  stats: Record<string, number> | undefined,
  limit: number,
): string[] {
  if (!stats) return []
  const out: string[] = []
  for (const [key, label] of META_STAT_CATEGORIES) {
    if (out.length >= limit) break
    const count = stats[key]
    if (count) out.push(`${label} ${count.toLocaleString()}곳`)
  }
  return out
}

/**
 * 구·군 허브 meta description.
 *
 * 배경: 267개 구·군 허브가 지역 토큰만 다른 동일 문장을 내보내 네이버 SEO 진단에서
 * "중복 설명문"으로 대량 플래그됐다(2026-07 실측: 중복 desc 대상 189,316건).
 * 같은 페이지가 본문용으로는 이미 실데이터 설명을 만들고 있었으므로, 그 데이터를
 * meta 에도 쓴다. 부동산 쪽(utils/realEstateMeta.ts)이 먼저 같은 방식으로 해소했다.
 *
 * 폴백: 수집 실패나 시설 0건 지역에서는 기존 문구를 그대로 쓴다. 빈 description 은
 * 중복보다 나쁘다(스니펫을 검색엔진이 임의 생성).
 */
export function buildDistrictMetaDescription(params: {
  city: string
  district: string
  facilityStats?: Record<string, number>
  totalFacilities?: number
}): string {
  const { city, district, facilityStats, totalFacilities } = params
  const statParts = formatFacilityStatParts(facilityStats, 3)

  if (statParts.length === 0) {
    return `${city} ${district}의 부동산 실거래가와 병원, 약국, 주차장, 공공화장실 등 주요 생활 인프라 정보를 확인하세요.`
  }

  const head = totalFacilities
    ? `${city} ${district}에는 ${statParts.join(', ')} 등 총 ${totalFacilities.toLocaleString()}곳의 생활시설이 있습니다.`
    : `${city} ${district}에는 ${statParts.join(', ')} 등 생활시설 정보가 등록되어 있습니다.`

  return `${head} 아파트·빌라·오피스텔 실거래가도 함께 확인하세요.`
}

/**
 * 시/도 허브 meta description. 구·군과 같은 이유로 실데이터를 앞세운다.
 * 시/도는 카테고리별 통계 대신 시군구 수·총 시설 수로 차별화한다.
 */
export function buildCityMetaDescription(params: {
  city: string
  districtCount?: number
  totalFacilities?: number
}): string {
  const { city, districtCount, totalFacilities } = params
  const facts: string[] = []
  if (districtCount) facts.push(`${districtCount}개 시군구`)
  if (totalFacilities) facts.push(`생활시설 ${totalFacilities.toLocaleString()}곳`)

  if (facts.length === 0) {
    return `${city} 아파트·빌라·오피스텔·토지 실거래가와 병원, 약국, 주차장, 공공화장실 등 주요 생활 정보를 확인하세요.`
  }

  return `${city}의 ${facts.join(', ')} 정보를 제공합니다. 아파트·빌라·오피스텔·토지 실거래가와 병원·약국·주차장 위치를 확인하세요.`
}
