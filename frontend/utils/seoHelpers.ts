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
