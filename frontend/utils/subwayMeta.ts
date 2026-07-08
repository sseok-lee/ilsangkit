import type { SubwayStation } from '~/types/subway'
import { compactCityName } from '~/utils/seoConstants'

const SITE_NAME = '일상킷'

// 역사명이 이미 '역'으로 끝나면 중복 접미를 막는다 (일부 원천 데이터는 '역'을 포함). 역곡/역삼 등 '역'으로
// 끝나지 않는 이름은 그대로 접미한다.
function stationDisplayName(name: string): string {
  return name.endsWith('역') ? name : `${name}역`
}

export function buildSubwayTitle(station: SubwayStation): string {
  // 지역(시축약 구)을 역명·호선 뒤 접미사로 — 동명이역(예: 여러 도시의 시청역) 구분 + 로컬 검색 신호.
  const cityCompact = station.city ? compactCityName(station.city) : ''
  const region = [cityCompact, station.district].filter(Boolean).join(' ')
  const regionPart = region ? ` | ${region}` : ''
  return `${stationDisplayName(station.name)} (${station.line})·주변 시설${regionPart} | ${SITE_NAME}`
}

export function buildSubwayDescription(station: SubwayStation): string {
  const stationName = stationDisplayName(station.name)
  const cityCompact = station.city ? compactCityName(station.city) : ''
  const region = [cityCompact, station.district].filter(Boolean).join(' ')

  // 개요 문장
  const regionPart = region ? `${region}의 ` : ''
  let desc = `${stationName}(${station.line})은(는) ${regionPart}지하철역입니다.`

  // 환승 정보 — '-' 등 플레이스홀더 토큰은 제외 (백엔드가 빈 환승을 '-'로 채우는 경우 방지).
  const transfers = (station.transferLines ?? []).filter(t => t && t.trim() && t.trim() !== '-')
  if (transfers.length > 0) {
    desc += ` ${transfers.join(', ')} 환승이 가능하며,`
  }

  // CTA
  desc += ' 위치·노선·환승 정보를 확인하세요.'

  return desc
}

interface PlaceJsonLd {
  '@context': string
  '@type': string
  name: string
  address?: {
    '@type': string
    streetAddress?: string
    addressLocality?: string
    addressRegion?: string
    addressCountry: string
  }
  geo: {
    '@type': string
    latitude: number
    longitude: number
  }
  publicAccess: boolean
  isAccessibleForFree: boolean
  containedInPlace?: {
    '@type': string
    name: string
  }
}

export function buildSubwayJsonLd(station: SubwayStation): PlaceJsonLd {
  const jsonLd: PlaceJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TrainStation',
    name: stationDisplayName(station.name),
    geo: {
      '@type': 'GeoCoordinates',
      latitude: station.lat,
      longitude: station.lng,
    },
    publicAccess: true,
    isAccessibleForFree: true,
  }

  if (station.roadAddress || station.city) {
    jsonLd.address = {
      '@type': 'PostalAddress',
      addressCountry: 'KR',
    }
    if (station.roadAddress) jsonLd.address.streetAddress = station.roadAddress
    if (station.district) jsonLd.address.addressLocality = station.district
    if (station.city) jsonLd.address.addressRegion = station.city
  }

  return jsonLd
}
